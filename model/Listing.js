const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Listing = sequelize.define("Listing", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  seller_id: DataTypes.INTEGER,
  title: DataTypes.STRING,
  category: DataTypes.STRING,
  mode: DataTypes.STRING,
  condition: DataTypes.STRING,
  price: DataTypes.DECIMAL(12, 2),
  rent_unit: DataTypes.STRING,
  location: DataTypes.STRING,
  available_from: DataTypes.STRING,
  available_to: DataTypes.STRING,
  delivery_time: DataTypes.STRING,
  return_policy: DataTypes.STRING,
  return_policy_text: DataTypes.TEXT,
  description: DataTypes.TEXT,
  seller_name: DataTypes.STRING,
  seller_phone: DataTypes.STRING,
  seller_rating: DataTypes.DECIMAL(3, 2),
  payment_upi_masked: DataTypes.STRING,
  payment_upi: DataTypes.TEXT,
  image_path: DataTypes.STRING,
  status: DataTypes.STRING,
  created_at: DataTypes.DATE,
  updated_at: DataTypes.DATE,
}, {
  tableName: "tbl_listing",
  timestamps: false,
});

module.exports = Listing;
