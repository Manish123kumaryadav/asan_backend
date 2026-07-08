const ChatConversation = require("../model/ChatConversation");
const ChatMessage = require("../model/ChatMessage");

function toConversation(row) {
  return {
    id: String(row.id),
    name: row.title || "Aashanway chat",
    preview: row.last_message || "No messages yet",
    time: row.updated_at ? new Date(row.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Now",
    unread: Number(row.unread_count || 0),
    avatar: row.avatar_path || "",
  };
}

function toMessage(row, userId) {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    sender: Number(row.sender_id) === Number(userId) ? "me" : row.sender_type || "seller",
    text: row.text,
    createdAt: row.created_at ? new Date(row.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Now",
  };
}

exports.conversations = async (req, res) => {
  try {
    const rows = await ChatConversation.findAll({
      where: { buyer_id: req.user.id },
      order: [["updated_at", "DESC"]],
    });
    return res.json({ success: true, data: rows.map(toConversation) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.messages = async (req, res) => {
  try {
    const rows = await ChatMessage.findAll({
      where: { conversation_id: req.params.conversationId },
      order: [["created_at", "ASC"]],
    });
    return res.json({ success: true, data: rows.map((row) => toMessage(row, req.user.id)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMessage = async (req, res) => {
  try {
    const row = await ChatMessage.create({
      conversation_id: req.params.conversationId,
      sender_id: req.user.id,
      sender_type: "me",
      text: req.body.text,
      created_at: new Date(),
    });
    await ChatConversation.update(
      { last_message: req.body.text, updated_at: new Date() },
      { where: { id: req.params.conversationId } }
    );
    return res.status(201).json({ success: true, data: toMessage(row, req.user.id) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
