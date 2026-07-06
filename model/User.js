const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User=sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  password: DataTypes.STRING,
  mobile: DataTypes.STRING,
  otp: DataTypes.STRING,
  image: DataTypes.STRING,
  image_path: DataTypes.STRING,
  city: DataTypes.STRING,
  location: DataTypes.STRING,
  created_at: DataTypes.DATE,
  updated_at: DataTypes.DATE,
  is_deleted: DataTypes.BOOLEAN,
}, {
  tableName: 'tbl_user',
  timestamps: false,
});
module.exports = User;