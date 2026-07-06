
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE,
  process.env.USER,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    dialect: 'postgres',
    logging: false,
  }
);
sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');  
  })
      .catch((error) => {
    console.error('Unable to connect to the database:', error);
  } );

module.exports = sequelize;
