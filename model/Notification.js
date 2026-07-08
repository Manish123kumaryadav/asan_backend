const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define("Notification", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: DataTypes.INTEGER,
  title: DataTypes.STRING,
  body: DataTypes.TEXT,
  icon: DataTypes.STRING,
  is_read: DataTypes.BOOLEAN,
  created_at: DataTypes.DATE,
}, {
  tableName: "tbl_notification",
  timestamps: false,
});

module.exports = Notification;
