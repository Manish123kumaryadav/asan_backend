const Notification = require("../model/Notification");
const { sendToUser } = require("../utils/realtime");

function toNotification(row) {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    icon: row.icon || "notifications",
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "Now",
    read: Boolean(row.is_read),
  };
}

exports.list = async (req, res) => {
  try {
    const rows = await Notification.findAll({ where: { user_id: req.user.id }, order: [["created_at", "DESC"]] });
    return res.json({ success: true, data: rows.map(toNotification) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    await Notification.update({ is_read: true }, { where: { id: req.params.notificationId, user_id: req.user.id } });
    sendToUser(req.user.id, "notification:read", { id: String(req.params.notificationId) });
    return res.json({ success: true, message: "Notification marked read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const row = await Notification.create({
      user_id: req.body.user_id || req.user.id,
      title: req.body.title,
      body: req.body.body,
      icon: req.body.icon || "notifications",
      is_read: false,
      created_at: new Date(),
    });
    const notification = toNotification(row);
    sendToUser(row.user_id, "notification:new", notification);
    return res.status(201).json({ success: true, data: notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
