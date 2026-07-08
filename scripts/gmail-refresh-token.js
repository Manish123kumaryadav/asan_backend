require('dotenv').config();

async function main() {
  const code = process.argv[2] || process.env.GMAIL_AUTH_CODE;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

  if (!clientId || !clientSecret || !code) {
    throw new Error('Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and pass the auth code as the first argument.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    console.error('GMAIL_TOKEN_FAIL', payload);
    process.exit(1);
  }

  console.log('GMAIL_REFRESH_TOKEN=' + payload.refresh_token);
}

main().catch((error) => {
  console.error('GMAIL_TOKEN_FAIL', {
    message: error.message,
    code: error.code,
    response: error.response,
  });
  process.exit(1);
});
