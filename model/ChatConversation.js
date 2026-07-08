const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ChatConversation = sequelize.define("ChatConversation", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  buyer_id: DataTypes.INTEGER,
  seller_id: DataTypes.INTEGER,
  listing_id: DataTypes.INTEGER,
  title: DataTypes.STRING,
  avatar_path: DataTypes.STRING,
  last_message: DataTypes.TEXT,
  unread_count: DataTypes.INTEGER,
  updated_at: DataTypes.DATE,
  created_at: DataTypes.DATE,
}, {
  tableName: "tbl_chat_conversation",
  timestamps: false,
});

module.exports = ChatConversation;
