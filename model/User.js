const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    guid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
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
    allow_calls: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    active_ads: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    plan: {
      type: DataTypes.STRING,
      defaultValue: "Free",
    },
    role_id: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    tableName: "tbl_user",
    timestamps: false,
  }
);

module.exports = User;