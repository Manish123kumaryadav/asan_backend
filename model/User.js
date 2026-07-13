const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  guid: { type: DataTypes.STRING(32), allowNull: false },
  name: { type: DataTypes.STRING(160), allowNull: false },
  email_hash: DataTypes.STRING(64),
  password: { type: DataTypes.TEXT, allowNull: false },
  mobile: DataTypes.STRING(30),
  country_code: { type: DataTypes.STRING(8), defaultValue: "+91" },
  otp: DataTypes.TEXT,
  avatar_url: DataTypes.TEXT,
  city: DataTypes.STRING(120),
  location: DataTypes.TEXT,
  allow_calls: { type: DataTypes.BOOLEAN, defaultValue: true },
  show_online_status: { type: DataTypes.BOOLEAN, defaultValue: true },
  active_ads: { type: DataTypes.INTEGER, defaultValue: 0 },
  plan: { type: DataTypes.STRING(30), defaultValue: "free" },
  role_id: { type: DataTypes.INTEGER, defaultValue: 2 },
  created_at: DataTypes.DATE,
  updated_at: DataTypes.DATE,
  is_deleted: { type: DataTypes.SMALLINT, defaultValue: 0 },
  is_otp_verified: { type: DataTypes.SMALLINT, defaultValue: 0 },
}, { tableName: "tbl_user", timestamps: false });

module.exports = User;
