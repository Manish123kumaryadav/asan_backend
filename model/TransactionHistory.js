const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("TransactionHistory", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  transaction_id: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  trans_guid: DataTypes.STRING(32),
  user_id: { type: DataTypes.BIGINT, allowNull: false },
  user_guid: { type: DataTypes.STRING(64), allowNull: false },
  user_email_hash: { type: DataTypes.STRING(128), allowNull: false },
  user_name: DataTypes.STRING(160),
  plan_id: DataTypes.STRING(30),
  amount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(10), defaultValue: "INR" },
  status: { type: DataTypes.STRING(30), defaultValue: "pending" },
  provider: DataTypes.STRING(40),
  provider_payment_id: DataTypes.STRING(160),
  provider_order_id: DataTypes.STRING(160),
  provider_signature: DataTypes.TEXT,
  payment_method: DataTypes.STRING(40),
  upi_intent: DataTypes.TEXT,
  qr_url: DataTypes.TEXT,
  created_at: DataTypes.DATE,
  updated_at: DataTypes.DATE,
}, { tableName: "tbl_transaction_history", timestamps: false });
