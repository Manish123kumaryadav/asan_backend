const nodemailer = require('nodemailer');
const { resolve4 } = require('dns').promises;

function hasMailConfig() {
  return Boolean(
    hasGmailApiConfig() ||
    hasResendConfig() ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

function hasGmailApiConfig() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
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
  const host = await resolveToIPv4(hostname);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    tls: {
      servername: hostname,
      rejectUnauthorized: false,
    },

    family: 4,

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });
} // <-- Ye missing tha

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildMimeMessage({ from, to, subject, html, text }) {
  const boundary = `asanway-${Date.now()}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  return [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

async function getGmailAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error_description || payload.error || 'Failed to refresh Gmail access token');
    error.code = payload.error;
    error.response = payload;
    throw error;
  }

  return payload.access_token;
}

async function sendWithGmailApi({ from, to, subject, html, text }) {
  const accessToken = await getGmailAccessToken();
  const raw = encodeBase64Url(buildMimeMessage({ from, to, subject, html, text }));
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Gmail API failed to send email');
    error.code = payload.error?.status;
    error.response = payload;
    throw error;
  }

  return payload;
}

async function sendWithResend({ from, to, subject, html, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || 'Resend API failed to send email');
    error.code = payload.name || response.status;
    error.response = payload;
    throw error;
  }

  return payload;
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
    const error = new Error("Mail configuration is missing.");
    error.code = "MAIL_CONFIG_MISSING";
    throw error;
  }

  const appName = process.env.APP_NAME || "Asanway";
  const isReset = purpose === "forgot-password";

  const subject = isReset
    ? `${appName} Password Reset OTP`
    : `${appName} Login OTP`;

  const from =
    process.env.MAIL_FROM ||
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER;

  const html = buildTemplate({
    otp,
    name,
    purpose,
  });

  const text = `Your OTP is ${otp}. It expires in 15 minutes.`;

  try {
    // Gmail API (if configured)
    if (hasGmailApiConfig()) {
      await sendWithGmailApi({
        from,
        to: email,
        subject,
        html,
        text,
      });

    return { sent: true, provider: 'gmail-api' };
  }

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

  if (isRailwayRuntime()) {
    const error = new Error('Railway runtime cannot reach Gmail SMTP. Configure Gmail API OAuth env vars to send OTP emails over HTTPS.');
    error.code = 'EMAIL_PROVIDER_REQUIRED';
    throw error;
  }

  const smtpResult = await sendWithSmtp({
    from,
    to: email,
    subject,
    html,
    text,
  });

    return {
      sent: true,
      provider: smtpResult.provider,
      port: smtpResult.port,
    };
  } catch (error) {
    console.error("Email send failed:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });

    throw error;
  }
}

module.exports = {
  sendOtpEmail,
}
