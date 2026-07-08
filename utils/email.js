const nodemailer = require('nodemailer');
const { resolve4 } = require('dns').promises;
const { Resend } = require('resend');

function hasMailConfig() {
  return Boolean(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
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

function smtpAttempts() {
  const hostname = process.env.SMTP_HOST || 'smtp.gmail.com';
  const configuredPort = Number(process.env.SMTP_PORT || 587);
  const configuredSecure = process.env.SMTP_SECURE === 'true';
  const attempts = [
    {
      hostname,
      port: configuredPort,
      secure: configuredSecure,
    },
  ];

  if (hostname.includes('gmail.com') && configuredPort !== 465) {
    attempts.push({
      hostname,
      port: 465,
      secure: true,
    });
  }

  return attempts;
}

async function createTransporter({ hostname, port, secure }) {
  // Pre-resolve to IPv4 so nodemailer never does its own DNS lookup
  // that could return an IPv6 address unreachable on Railway.
  const host = await resolveToIPv4(hostname);

  return nodemailer.createTransport({
    host,
    port,
    // secure=false means use STARTTLS (correct for port 587)
    secure,
    requireTLS: !secure,
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

async function sendWithResend({ from, to, subject, html, text }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (result.error) {
    const error = new Error(result.error.message || 'Resend failed to send email');
    error.code = result.error.name;
    error.response = result.error;
    throw error;
  }

  return result.data;
}

async function sendWithSmtp({ from, to, subject, html, text }) {
  let lastError;

  for (const attempt of smtpAttempts()) {
    try {
      console.log(`SMTP: sending via ${attempt.hostname}:${attempt.port}`);
      const transporter = await createTransporter(attempt);
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      });

      return { provider: 'smtp', port: attempt.port };
    } catch (error) {
      lastError = error;
      console.error('SMTP attempt failed:', {
        host: attempt.hostname,
        port: attempt.port,
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
      });
    }
  }

  throw lastError;
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
  const from = process.env.MAIL_FROM || process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  const html = buildTemplate({ otp, name, purpose });
  const text = `Your OTP is ${otp}. It expires in 15 minutes.`;

  if (hasResendConfig()) {
    await sendWithResend({
      from,
      to: email,
      subject,
      html,
      text,
    });

    return { sent: true, provider: 'resend' };
  }

  const smtpResult = await sendWithSmtp({
    from,
    to: email,
    subject,
    html,
    text,
  });

  return { sent: true, provider: smtpResult.provider, port: smtpResult.port };
}

module.exports = {
  sendOtpEmail,
};
