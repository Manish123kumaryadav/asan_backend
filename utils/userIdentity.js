const crypto = require("crypto");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailHash(email) {
  return crypto
    .createHmac("sha256", process.env.EMAIL_HASH_SECRET)
    .update(normalizeEmail(email))
    .digest("hex");
}

function generateGuid() {
  return crypto.randomUUID();
}

async function ensureUserIdentity(user) {
  let changed = false;

  if (!user.guid) {
    user.guid = generateGuid();
    changed = true;
  }

  if (user.email_hash && !user.email) {
    user.email = normalizeEmail(user.email_hash);
    user.email_hash = emailHash(user.email);
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return user;
}

module.exports = {
  normalizeEmail,
  emailHash,
  generateGuid,
  ensureUserIdentity,
};