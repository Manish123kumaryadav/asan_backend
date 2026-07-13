const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../model/User");
const SubscriberDashboardGuid = require("../model/SubscriberDashboardGuid");
const { sendOtpEmail } = require("../utils/email");
const { normalizeEmail, emailHash, ensureUserIdentity, generateGuid } = require("../utils/userIdentity");

const OTP_EXPIRES_IN_MS = 15 * 60 * 1000;
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const buildOtpPayload = (otp) => `${otp}:${Date.now() + OTP_EXPIRES_IN_MS}`;
const validateOtpPayload = (saved, otp) => { const [code, expires] = String(saved || "").split(":"); return code === String(otp) && Number(expires) > Date.now(); };

function createToken(user) {
  return jwt.sign({ id: user.id, guid: user.guid, role_id: user.role_id, name: user.name, email_hash: user.email_hash }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1h" });
}

function publicUser(user) {
  return { id: user.id, guid: user.guid, name: user.name, email_hash: user.email_hash, mobile: user.mobile, country_code: user.country_code, avatar_url: user.avatar_url, city: user.city, location: user.location, plan: user.plan, role_id: user.role_id, is_otp_verified: Number(user.is_otp_verified || 0) };
}

function hashFromInput(input) {
  const value = String(input || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(value) ? value : emailHash(value);
}

async function findUser(input) {
  const hash = hashFromInput(input);
  return hash ? User.findOne({ where: { email_hash: hash, is_deleted: 0 } }) : null;
}

async function emailForUser(user, fallback) {
  if (fallback && String(fallback).includes("@")) return normalizeEmail(fallback);
  const identity = await SubscriberDashboardGuid.findByPk(user.guid);
  return identity?.emailid || "";
}

async function findOrCreateUserByEmail(emailInput) {
  const email = normalizeEmail(emailInput);
  let user = await findUser(email);
  if (!user) {
    const guid = generateGuid();
    user = await User.create({ guid, name: email.split("@")[0] || "User", email_hash: emailHash(email), password: "", plan: "free", role_id: 2, allow_calls: true, show_online_status: true, active_ads: 0, is_deleted: 0, is_otp_verified: 0, created_at: new Date(), updated_at: new Date() });
    await SubscriberDashboardGuid.create({ uid: guid, emailid: email, updated_at: new Date(), is_active: true });
  }
  return ensureUserIdentity(user);
}

exports.login = async (req, res) => {
  try {
    const identity = req.body.email || req.body.email_hash;
    if (!identity || !req.body.password) return res.status(400).json({ success: false, message: "Email and password are required" });
    const user = await findUser(identity);
    if (!user || !(await bcrypt.compare(req.body.password, user.password || ""))) return res.status(401).json({ success: false, message: "Invalid credentials" });
    return res.json({ success: true, token: createToken(user), user: publicUser(user) });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

async function sendOtp(req, res, purpose) {
  try {
    const email = req.body.email || req.body.newEmail || req.body.new_email;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
    const user = await findOrCreateUserByEmail(email);
    const targetEmail = await emailForUser(user, email);
    const otp = generateOtp();
    await user.update({ otp: buildOtpPayload(otp), updated_at: new Date() });
    let mail;
    try { mail = await sendOtpEmail(targetEmail, otp, purpose, user.name); }
    catch (error) { mail = { sent: false, error: error.code || error.message }; }
    return res.json({ success: true, message: mail.sent ? "OTP sent successfully" : "OTP generated successfully", email_hash: user.email_hash, ...(mail.sent ? {} : { otp }) });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
}

exports.sendLoginOtp = (req, res) => sendOtp(req, res, "login");
exports.sendForgotPasswordOtp = (req, res) => sendOtp(req, res, "forgot-password");

exports.verifyLoginOtp = async (req, res) => {
  try {
    const identity = req.body.email || req.body.email_hash || req.body.newEmail || req.body.new_email;
    if (!identity || !req.body.otp) return res.status(400).json({ success: false, message: "Email and OTP are required" });
    const user = await findUser(identity);
    if (!user || !validateOtpPayload(user.otp, req.body.otp)) return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
    await user.update({ otp: null, is_otp_verified: 1, updated_at: new Date() });
    return res.json({ success: true, token: createToken(user), user: publicUser(user) });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const identity = req.body.email || req.body.email_hash;
    if (!identity || !req.body.otp || !req.body.password) return res.status(400).json({ success: false, message: "Email, OTP and password are required" });
    const user = await findUser(identity);
    if (!user || !validateOtpPayload(user.otp, req.body.otp)) return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
    await user.update({ password: await bcrypt.hash(req.body.password, 10), otp: null, is_otp_verified: 1, updated_at: new Date() });
    return res.json({ success: true, message: "Password reset successfully" });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.sendOtp = exports.sendLoginOtp;
exports.verifyOtp = exports.verifyLoginOtp;
