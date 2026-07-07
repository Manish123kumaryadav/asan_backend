require('dotenv').config();
const express = require('express');

const color=require('colors');
const sequelize = require('./config/database');
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
app.use("/api", todoroute); // routes mounted AFTER middleware



const PORT = process.env.PORT || 8000;

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
