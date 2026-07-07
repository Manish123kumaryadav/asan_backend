const { Sequelize } = require("sequelize");
require("dotenv").config();

const commonOptions = {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  pool: {
    max: 3,
    min: 0,
    acquire: 30000,
    idle: 10000,
  }
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize(
      process.env.DB_NAME || process.env.DATABASE,
      process.env.DB_USER || process.env.USER,
      process.env.DB_PASSWORD || process.env.PASSWORD,
      {
        ...commonOptions,
        host: process.env.DB_HOST || process.env.HOST,
        port: Number(process.env.DB_PORT || 6543),
      }
    );

module.exports = sequelize;
