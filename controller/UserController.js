const User = require("../model/User");
const bcrypt = require('bcryptjs');
const { emailHash, generateGuid, normalizeEmail, ensureUserIdentity } = require("../utils/userIdentity");
const { Op } = require("sequelize");

const USER_FIELDS = [
  "name",
  "email",
  "mobile",
  "phone",
  "image",
  "image_path",
  "avatar_url",
  "city",
  "location",
  "allow_calls",
  "active_ads",
  "plan",
  "role_id",
  "is_deleted",
];

function buildUserPayload(body, includePassword = false) {
  const payload = {};

  for (const field of USER_FIELDS) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  if (payload.email) {
    payload.email = normalizeEmail(payload.email);
    payload.email_hash = emailHash(payload.email);
  }

  if (!payload.phone && payload.mobile) payload.phone = payload.mobile;
  if (!payload.mobile && payload.phone) payload.mobile = payload.phone;
  if (includePassword && body.password) payload.password = body.password;

  return payload;
}

function userWhere(identifier) {
  const value = String(identifier || "").trim();
  const normalized = normalizeEmail(value);
  const hash = emailHash(normalized);
  const conditions = [
    { guid: value },
    { email: normalized },
    { email: value },
    { email_hash: hash },
    { email_hash: value },
  ];
  if (/^\d+$/.test(value)) {
    conditions.push({ id: Number(value) });
  }
  return { [Op.or]: conditions };
}

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const payload = buildUserPayload(req.body, true);
    if (!payload.email || !payload.password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    payload.guid = req.body.guid || generateGuid();
    payload.password = await bcrypt.hash(payload.password, 10);
    payload.created_at = new Date();
    payload.updated_at = new Date();

    const user = await User.create(payload);
    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
 exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ where: userWhere(req.params.id) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await ensureUserIdentity(user);
    res.status(200).json({ success: true, user });
    } catch (error) {
    res.status(500).json({ message: error.message });
    }

}

exports.updateUser = async (req, res) => {
  try {
    const payload = buildUserPayload(req.body, false);
    if (req.body.password) {
      payload.password = await bcrypt.hash(req.body.password, 10);
    }
    payload.updated_at = new Date();

    const [updated] = await User.update(payload, { where: userWhere(req.params.id) });  
     if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const payload = buildUserPayload(req.body, false);
    if (req.body.password) {
      payload.password = await bcrypt.hash(req.body.password, 10);
    }
    payload.updated_at = new Date();

    const [updated] = await User.update(payload, { where: { id: userId } });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = await User.findByPk(userId);
    res.status(200).json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
