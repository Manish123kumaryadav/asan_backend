require('dotenv').config();

const { sendOtpEmail } = require('../utils/email');

async function main() {
  const to = process.env.TEST_EMAIL_TO || process.env.SMTP_USER;

  if (!to) {
    throw new Error('Set TEST_EMAIL_TO or SMTP_USER before running the email test.');
  }

  const result = await sendOtpEmail(to, '123456', 'login', 'Test User');
  console.log('EMAIL_TEST_OK', {
    to,
    provider: result.provider,
    port: result.port,
  });
}

main().catch((error) => {
  console.error('EMAIL_TEST_FAIL', {
    message: error.message,
    code: error.code,
    command: error.command,
    response: error.response,
  });
  process.exit(1);
});
