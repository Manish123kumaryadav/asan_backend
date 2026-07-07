const nodemailer = require('nodemailer');
const { resolve4 } = require('dns').promises;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildTemplate({ otp, name, purpose }) {
  const appName = process.env.APP_NAME || 'Asanway';
  const safeName = escapeHtml(name || 'User');
  const safeOtp = escapeHtml(otp);
  const isReset = purpose === 'forgot-password';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${isReset ? 'Password Reset Code' : 'Verification Code'}</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #ff6b6b; color: #fff; padding: 24px; text-align: center; }
    .content { padding: 32px; }
    .otp-box { background: #fff3f3; border: 2px dashed #ff6b6b; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 32px; font-weight: bold; color: #ff6b6b; letter-spacing: 4px; }
    .footer { background: #fafafa; padding: 16px; text-align: center; font-size: 12px; color: #888; }
    .notice { color: #c0392b; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(appName)}</h1>
      <p>${isReset ? 'Password Reset Request' : 'Your verification code'}</p>
    </div>
    <div class="content">
      <p>Hi ${safeName},</p>
      <p>${isReset ? 'We received a request to reset your password. Use this code to proceed:' : 'Your verification code is:'}</p>
      <div class="otp-box">
        <div class="otp-code">${safeOtp}</div>
      </div>
      <p>This code will expire in <strong>15 minutes</strong>.</p>
      <p class="notice">Security Notice: Do not share this code with anyone.</p>
    </div>
    <div class="footer">
      <p>${escapeHtml(appName)}</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Sender 1: Resend (HTTP API) — use this on Railway / any cloud host
// Railway blocks outbound SMTP ports (587/465), but HTTP is always open.
// Sign up free at https://resend.com → get API key → add RESEND_API_KEY env var.
// ---------------------------------------------------------------------------

async function sendViaResend(email, otp, purpose, name) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const appName = process.env.APP_NAME || 'Asanway';
  const isReset = purpose === 'forgot-password';
  const subject = isReset
    ? `${appName} password reset OTP`
    : `${appName} login OTP`;

  // RESEND_FROM must be a verified sender address in your Resend account.
  // During testing you can use: onboarding@resend.dev (sends to your own email only)
  const from = process.env.RESEND_FROM || process.env.SMTP_FROM || 'onboarding@resend.dev';

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject,
    html: buildTemplate({ otp, name, purpose }),
    text: `Your OTP is ${otp}. It expires in 15 minutes.`,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log(`Email sent via Resend to ${email}`);
  return { sent: true };
}

// ---------------------------------------------------------------------------
// Sender 2: Nodemailer SMTP — fallback for local development
// Works locally; will timeout on Railway (port 587 is blocked by their network).
// ---------------------------------------------------------------------------

async function resolveToIPv4(hostname) {
  try {
    const addresses = await resolve4(hostname);
    if (addresses && addresses.length > 0) {
      console.log(`SMTP: resolved ${hostname} → ${addresses[0]} (IPv4)`);
      return addresses[0];
    }
  } catch (err) {
    console.warn(`SMTP: dns.resolve4 failed for ${hostname} (${err.message}), using hostname`);
  }
  return hostname;
}

async function sendViaSmtp(email, otp, purpose, name) {
  const hostname = process.env.SMTP_HOST || 'smtp.gmail.com';
  const host = await resolveToIPv4(hostname);

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: true,
    family: 4,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: Number(process.env.SMTP_TIMEOUT || 30000),
    greetingTimeout: 20000,
    socketTimeout: Number(process.env.SMTP_TIMEOUT || 30000),
  });

  const appName = process.env.APP_NAME || 'Asanway';
  const isReset = purpose === 'forgot-password';
  const subject = isReset
    ? `${appName} password reset OTP`
    : `${appName} login OTP`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    html: buildTemplate({ otp, name, purpose }),
    text: `Your OTP is ${otp}. It expires in 15 minutes.`,
  });

  console.log(`Email sent via SMTP to ${email}`);
  return { sent: true };
}

// ---------------------------------------------------------------------------
// Main export — prefers Resend (cloud-safe), falls back to SMTP (local dev)
// ---------------------------------------------------------------------------

async function sendOtpEmail(email, otp, purpose, name) {
  if (hasResendConfig()) {
    return sendViaResend(email, otp, purpose, name);
  }

  if (hasSmtpConfig()) {
    return sendViaSmtp(email, otp, purpose, name);
  }

  // No mail config at all — return OTP in response (dev/testing mode)
  console.warn('No email config found (RESEND_API_KEY or SMTP_*). OTP not sent.');
  return { sent: false };
}

module.exports = { sendOtpEmail };
