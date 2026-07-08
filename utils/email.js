const nodemailer = require('nodemailer');
const { resolve4 } = require('dns').promises;

function hasMailConfig() {
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

/**
 * Resolves a hostname to an IPv4 address using dns.resolve4().
 * This bypasses the OS/Railway DNS stack that returns IPv6 first,
 * so nodemailer always connects to an IPv4 address — no ENETUNREACH.
 */
async function resolveToIPv4(hostname) {
  try {
    const addresses = await resolve4(hostname);
    if (addresses && addresses.length > 0) {
      console.log(`SMTP: resolved ${hostname} → ${addresses[0]} (IPv4)`);
      return addresses[0];
    }
  } catch (err) {
    console.warn(`SMTP: dns.resolve4 failed for ${hostname} (${err.message}), using hostname directly`);
  }
  return hostname; // fallback to hostname if resolve fails
}

async function createTransporter() {
  const hostname = process.env.SMTP_HOST || 'smtp.gmail.com';
  // Pre-resolve to IPv4 so nodemailer never does its own DNS lookup
  // that could return an IPv6 address unreachable on Railway.
  const host = await resolveToIPv4(hostname);

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    // secure=false means use STARTTLS (correct for port 587)
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: true,
    family: 4, // belt-and-suspenders: also force IPv4 at socket level
    tls: {
      // When host is an IPv4 address, keep TLS/SNI verification tied to the
      // original SMTP hostname instead of the raw IP address.
      servername: hostname,
    },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: Number(process.env.SMTP_TIMEOUT || 30000),
    greetingTimeout: 20000,
    socketTimeout: Number(process.env.SMTP_TIMEOUT || 30000),
  });
}

async function sendOtpEmail(email, otp, purpose, name) {
  if (!hasMailConfig()) {
    return { sent: false };
  }

  const appName = process.env.APP_NAME || 'Asanway';
  const isReset = purpose === 'forgot-password';
  const subject = isReset
    ? `${appName} password reset OTP`
    : `${appName} login OTP`;

  const transporter = await createTransporter(); // now async
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    html: buildTemplate({ otp, name, purpose }),
    text: `Your OTP is ${otp}. It expires in 15 minutes.`,
  });

  return { sent: true };
}

module.exports = {
  sendOtpEmail,
};
