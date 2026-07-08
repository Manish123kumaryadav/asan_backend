const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContactView = sequelize.define("ContactView", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  viewer_id: DataTypes.INTEGER,
  seller_id: DataTypes.INTEGER,
  listing_id: DataTypes.INTEGER,
  action: DataTypes.STRING,
  created_at: DataTypes.DATE,
}, {
  tableName: "tbl_contact_view",
  timestamps: false,
});

module.exports = ContactView;
