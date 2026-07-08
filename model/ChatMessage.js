const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ChatMessage = sequelize.define("ChatMessage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  conversation_id: DataTypes.INTEGER,
  sender_id: DataTypes.INTEGER,
  sender_type: DataTypes.STRING,
  text: DataTypes.TEXT,
  created_at: DataTypes.DATE,
}, {
  tableName: "tbl_chat_message",
  timestamps: false,
});

module.exports = ChatMessage;
