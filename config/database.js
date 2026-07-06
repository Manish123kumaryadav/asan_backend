
require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.POSTGRES_PRIVATE_URL;

const shouldUseSsl =
  process.env.DB_SSL === 'true' ||
  process.env.PGSSLMODE === 'require' ||
  process.env.NODE_ENV === 'production';

const dbName = process.env.DB_NAME || process.env.PGDATABASE || process.env.DATABASE;
const dbUser =
  process.env.DB_USER ||
  process.env.PGUSER ||
  process.env.POSTGRES_USER ||
  (process.env.NODE_ENV === 'production' ? undefined : process.env.USER);
const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.PASSWORD;
const dbHost = process.env.DB_HOST || process.env.PGHOST || process.env.HOST;
const dbPort = Number(process.env.DB_PORT || process.env.PGPORT || 5432);

const commonOptions = {
  dialect: 'postgres',
  logging: false,
  dialectOptions: shouldUseSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
};

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, commonOptions)
  : new Sequelize(
      dbName,
      dbUser,
      dbPassword,
      {
        ...commonOptions,
        host: dbHost,
        port: dbPort,
      }
    );

module.exports = sequelize;
