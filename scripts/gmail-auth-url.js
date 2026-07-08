require('dotenv').config();

const clientId = process.env.GMAIL_CLIENT_ID;
const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!clientId) {
  console.error('Set GMAIL_CLIENT_ID first.');
  process.exit(1);
}

const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.searchParams.set('client_id', clientId);
url.searchParams.set('redirect_uri', redirectUri);
url.searchParams.set('response_type', 'code');
url.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send');
url.searchParams.set('access_type', 'offline');
url.searchParams.set('prompt', 'consent');

console.log(url.toString());
