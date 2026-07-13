const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SubscriberDashboardGuid = sequelize.define("SubscriberDashboardGuid", {
  uid: { type: DataTypes.STRING(32), primaryKey: true },
  emailid: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  updated_at: DataTypes.DATE,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: "subscriberdashboardguid", timestamps: false });

module.exports = SubscriberDashboardGuid;
