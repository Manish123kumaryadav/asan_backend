// Force IPv4 DNS resolution globally — prevents ENETUNREACH on Railway
// where smtp.gmail.com resolves to IPv6 by default (Node 18+).
require('dns').setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const http = require('http');

const color=require('colors');
const sequelize = require('./config/database');
const { attachRealtime } = require('./utils/realtime');
const app = express();
const server = http.createServer(app);
attachRealtime(server);


// parses JSON
// app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const allowed = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json()); 



// Sample route to test
app.get('/api', (req, res) => {
  res.status(200).send(`<h1>Welcomesss my appsss</h1>`);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});


//  Routes
const todoroute = require('./routes/api');
app.use("/api", todoroute);



function getAppPort() {
  const configuredPort = process.env.APP_PORT || process.env.PORT;

  if (configuredPort === '5432' || configuredPort === '6543') {
    console.warn(`Ignoring PORT=${configuredPort}; that looks like a database port. Using 8080 for HTTP.`);
    return 8080;
  }

  return configuredPort || 8000;
}

const PORT = getAppPort();

//  DB check and server start

async function startServer() {
  server.listen(PORT, () => {
    console.log(`server running on port ${PORT}`.bgYellow);
  });

  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.'.bgGreen);
  } catch (error) {
    console.error('Unable to connect to the database:');
    console.error(error.message || error);
  }
}

startServer();
