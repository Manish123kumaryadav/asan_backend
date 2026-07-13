const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const User = require("../model/User");
const SubscriberDashboardGuid = require("../model/SubscriberDashboardGuid");
const { emailHash, generateGuid, normalizeEmail, ensureUserIdentity } = require("../utils/userIdentity");

const USER_FIELDS = ["name", "mobile", "country_code", "avatar_url", "city", "location", "allow_calls", "show_online_status", "plan", "role_id"];

function publicUser(user) {
  return { id: user.id, guid: user.guid, name: user.name, email_hash: user.email_hash, mobile: user.mobile, country_code: user.country_code, avatar_url: user.avatar_url, city: user.city, location: user.location, allow_calls: user.allow_calls, show_online_status: user.show_online_status, active_ads: user.active_ads, plan: user.plan, role_id: user.role_id, is_otp_verified: Number(user.is_otp_verified || 0) };
}

function userWhere(identifier) {
  const value = String(identifier || "").trim();
  const conditions = [{ guid: value }, { email_hash: value }];
  if (/^\d+$/.test(value)) conditions.push({ id: Number(value) });
  return { [Op.or]: conditions };
}

function updatePayload(body) {
  const payload = {};
  USER_FIELDS.forEach((field) => { if (body[field] !== undefined) payload[field] = body[field]; });
  payload.updated_at = new Date();
  return payload;
}

exports.getAllUsers = async (_req, res) => {
  try { const users = await User.findAll({ where: { is_deleted: 0 } }); return res.json({ success: true, users: users.map(publicUser) }); }
  catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.createUser = async (req, res) => {
  let transaction;
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !req.body.password || !req.body.name) return res.status(400).json({ success: false, message: "Name, email and password are required" });
    transaction = await sequelize.transaction();
    const hash = emailHash(email);
    if (await User.findOne({ where: { email_hash: hash, is_deleted: 0 }, transaction })) { await transaction.rollback(); return res.status(409).json({ success: false, message: "Email already exists" }); }
    const guid = generateGuid();
    const user = await User.create({ ...updatePayload(req.body), guid, name: req.body.name, email_hash: hash, password: await bcrypt.hash(req.body.password, 10), role_id: Number(req.body.role_id || 2), plan: "free", active_ads: 0, is_deleted: 0, is_otp_verified: 1, created_at: new Date() }, { transaction });
    await SubscriberDashboardGuid.create({ uid: guid, emailid: email, updated_at: new Date(), is_active: true }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, message: "User created successfully", data: publicUser(user) });
  } catch (error) { if (transaction && !transaction.finished) await transaction.rollback(); return res.status(500).json({ success: false, message: error.message }); }
};

exports.getUserById = async (req, res) => {
  try { const user = await User.findOne({ where: { ...userWhere(req.params.id), is_deleted: 0 } }); if (!user) return res.status(404).json({ success: false, message: "User not found" }); await ensureUserIdentity(user); return res.json({ success: true, user: publicUser(user) }); }
  catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

async function updateByWhere(where, req, res) {
  try {
    const user = await User.findOne({ where });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const payload = updatePayload(req.body);
    if (req.body.password) payload.password = await bcrypt.hash(req.body.password, 10);
    if (req.body.email) {
      const email = normalizeEmail(req.body.email); payload.email_hash = emailHash(email);
      await SubscriberDashboardGuid.upsert({ uid: user.guid, emailid: email, updated_at: new Date(), is_active: true });
    }
    await user.update(payload);
    return res.json({ success: true, message: "User updated successfully", user: publicUser(user) });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
}

exports.updateUser = (req, res) => updateByWhere(userWhere(req.params.id), req, res);
exports.updateCurrentUser = (req, res) => updateByWhere({ id: req.user.id, is_deleted: 0 }, req, res);
exports.publicUser = publicUser;
