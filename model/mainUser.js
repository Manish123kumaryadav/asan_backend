const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const sub = sequelize.define('sub', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
}, {
  tableName: 'tbl_sub',
  timestamps: false,
});

module.exports = sub;