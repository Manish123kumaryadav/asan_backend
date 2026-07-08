const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User=sequelize.define('User', {
  guid: DataTypes.STRING,
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  email_hash: DataTypes.STRING,
  password: DataTypes.STRING,
  mobile: DataTypes.STRING,
  phone: DataTypes.STRING,
  otp: DataTypes.STRING,
  image: DataTypes.STRING,
  image_path: DataTypes.STRING,
  avatar_url: DataTypes.STRING,
  city: DataTypes.STRING,
  location: DataTypes.STRING,
  allow_calls: DataTypes.BOOLEAN,
  active_ads: DataTypes.INTEGER,
  plan: DataTypes.STRING,
  role_id: DataTypes.INTEGER,
  created_at: DataTypes.DATE,
  updated_at: DataTypes.DATE,
  is_deleted: DataTypes.BOOLEAN,
}, {
  tableName: 'tbl_user',
  timestamps: false,
});
module.exports = User;
