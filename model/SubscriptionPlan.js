const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SubscriptionPlan = sequelize.define("SubscriptionPlan", {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: DataTypes.STRING,
  price: DataTypes.DECIMAL(12, 2),
  ads: DataTypes.INTEGER,
  highlight_days: DataTypes.INTEGER,
  support: DataTypes.STRING,
  is_active: DataTypes.BOOLEAN,
}, {
  tableName: "tbl_subscription_plan",
  timestamps: false,
});

module.exports = SubscriptionPlan;
