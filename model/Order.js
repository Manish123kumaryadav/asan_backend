const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define("Order", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_code: DataTypes.STRING,
  user_id: DataTypes.INTEGER,
  listing_id: DataTypes.INTEGER,
  quantity: DataTypes.INTEGER,
  total: DataTypes.DECIMAL(12, 2),
  status: DataTypes.STRING,
  eta: DataTypes.STRING,
  tracking: DataTypes.JSONB,
  payment_method: { type: DataTypes.STRING, defaultValue: "cod" },
  fulfillment_mode: { type: DataTypes.STRING, defaultValue: "delivery" },
  delivery_address: DataTypes.TEXT,
  created_at: DataTypes.DATE,
  updated_at: DataTypes.DATE,
}, {
  tableName: "tbl_order",
  timestamps: false,
});

module.exports = Order;
