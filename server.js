require('dotenv').config();
const express = require('express');

const color=require('colors');
const sequelize = require('./config/database');
const encryptionMiddleware = require('./middleware/encryption');
const app = express();


// parses JSON
// app.use(express.urlencoded({ extended: true }));
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
app.use("/api", encryptionMiddleware, todoroute); // routes mounted AFTER middleware



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
  app.listen(PORT, () => {
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
