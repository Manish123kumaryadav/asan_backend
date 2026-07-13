const crypto = require("crypto");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailHash(email) {
  const normalized = normalizeEmail(email);
  return normalized ? crypto.createHash("sha256").update(normalized).digest("hex") : null;
}

function generateGuid() {
  return crypto.randomBytes(16).toString("hex");
}

async function ensureUserIdentity(user) {
  if (!user) return null;

  const updates = {};
  if (!user.guid) updates.guid = generateGuid();

  if (Object.keys(updates).length > 0) {
    await user.update(updates);
    Object.assign(user, updates);
  }

  return user;
}

module.exports = {
  normalizeEmail,
  emailHash,
  generateGuid,
  ensureUserIdentity,
};
