const { Op } = require("sequelize");
const ChatConversation = require("../model/ChatConversation");
const ChatMessage = require("../model/ChatMessage");
const Listing = require("../model/Listing");
const User = require("../model/User");
const { sendToUser } = require("../utils/realtime");

function participant(conversation, userId) {
  return [conversation.buyer_id, conversation.seller_id].some((id) => String(id) === String(userId));
}

function otherUserId(conversation, userId) {
  return String(conversation.buyer_id) === String(userId) ? conversation.seller_id : conversation.buyer_id;
}

function toMessage(row, userId) {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    sender: String(row.sender_id) === String(userId) ? "me" : "other",
    senderType: row.sender_type,
    text: row.text,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

async function toConversation(row, userId) {
  const [other, listing] = await Promise.all([
    User.findByPk(otherUserId(row, userId), { attributes: ["id", "name", "avatar_url"] }),
    Listing.findByPk(row.listing_id, { attributes: ["id", "title", "image_path", "status"] }),
  ]);
  let image = listing?.image_path || row.avatar_path || "";
  try { const paths = JSON.parse(image); image = Array.isArray(paths) ? paths[0] || "" : image; } catch { /* legacy image path */ }
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    listingTitle: listing?.title || row.title || "Product chat",
    listingImage: image,
    otherUser: { id: String(other?.id || otherUserId(row, userId)), name: other?.name || "Aashanway user", avatar: other?.avatar_url || "" },
    role: String(row.buyer_id) === String(userId) ? "buyer" : "seller",
    preview: row.last_message || "Start the conversation",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    unread: Number(row.unread_count || 0),
  };
}

async function findConversationForUser(conversationId, userId) {
  const conversation = await ChatConversation.findByPk(conversationId);
  return conversation && participant(conversation, userId) ? conversation : null;
}

exports.openForListing = async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.listingId);
    if (!listing || !["active", "approved"].includes(listing.status)) return res.status(404).json({ success: false, message: "Listing not found" });
    if (String(listing.seller_id) === String(req.user.id)) return res.status(400).json({ success: false, message: "You cannot chat with yourself about your own product" });
    const [conversation] = await ChatConversation.findOrCreate({
      where: { buyer_id: req.user.id, seller_id: listing.seller_id, listing_id: listing.id },
      defaults: { title: listing.title, avatar_path: listing.image_path, last_message: "", unread_count: 0, created_at: new Date(), updated_at: new Date() },
    });
    return res.status(201).json({ success: true, data: await toConversation(conversation, req.user.id) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.conversations = async (req, res) => {
  try {
    const rows = await ChatConversation.findAll({
      where: { [Op.or]: [{ buyer_id: req.user.id }, { seller_id: req.user.id }] },
      order: [["updated_at", "DESC"]],
    });
    return res.json({ success: true, data: await Promise.all(rows.map((row) => toConversation(row, req.user.id))) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.messages = async (req, res) => {
  try {
    const conversation = await findConversationForUser(req.params.conversationId, req.user.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    const rows = await ChatMessage.findAll({ where: { conversation_id: conversation.id }, order: [["created_at", "ASC"]], limit: 500 });
    await conversation.update({ unread_count: 0 });
    return res.json({ success: true, data: rows.map((row) => toMessage(row, req.user.id)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMessage = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ success: false, message: "Message cannot be empty" });
    if (text.length > 2000) return res.status(400).json({ success: false, message: "Message is too long" });
    const conversation = await findConversationForUser(req.params.conversationId, req.user.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    const senderType = String(conversation.seller_id) === String(req.user.id) ? "seller" : "buyer";
    const row = await ChatMessage.create({ conversation_id: conversation.id, sender_id: req.user.id, sender_type: senderType, text, created_at: new Date() });
    await conversation.update({ last_message: text, unread_count: Number(conversation.unread_count || 0) + 1, updated_at: new Date() });
    const recipientId = otherUserId(conversation, req.user.id);
    sendToUser(recipientId, "chat:message", toMessage(row, recipientId));
    sendToUser(req.user.id, "chat:message:sent", toMessage(row, req.user.id));
    return res.status(201).json({ success: true, data: toMessage(row, req.user.id) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
