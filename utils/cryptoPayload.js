const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  return crypto.createHash("sha256").update(key, "utf8").digest();
}

function getMacKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  return crypto.createHash("sha256").update(`${key}:mac`, "utf8").digest();
}

function encode(buffer) {
  return buffer.toString("base64");
}

function decode(value) {
  const text = String(value || "");
  if (/^[0-9a-f]+$/i.test(text) && text.length % 2 === 0) {
    return Buffer.from(text, "hex");
  }

  return Buffer.from(text, "base64");
}

function createHmac(iv, data) {
  return crypto
    .createHmac("sha256", getMacKey())
    .update(`${iv}.${data}`)
    .digest("base64");
}

function isValidHmac(iv, data, hmac) {
  if (!hmac) {
    return false;
  }

  const expected = Buffer.from(createHmac(iv, data), "base64");
  const received = Buffer.from(String(hmac), "base64");

  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function encryptPayload(payload) {
  const ivBuffer = crypto.randomBytes(IV_LENGTH);
  const iv = encode(ivBuffer);
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), ivBuffer);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const data = encode(encrypted);

  return {
    encrypted: true,
    alg: "AES-256-CBC-HMAC-SHA256",
    iv,
    payload: data,
    tag: createHmac(iv, data),
  };
}

function decryptPayload(envelope) {
  const iv = envelope.iv;
  const data = envelope.data || envelope.encryptedData || envelope.payload;
  const hmac = envelope.hmac || envelope.hash || envelope.signature || envelope.tag;

  if (!iv || !data || !hmac) {
    throw new Error("Encrypted payload must include iv, payload and tag");
  }

  if (!isValidHmac(iv, data, hmac)) {
    throw new Error("Invalid encrypted payload signature");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), decode(iv));
  const decrypted = Buffer.concat([decipher.update(decode(data)), decipher.final()]).toString("utf8");

  try {
    return JSON.parse(decrypted);
  } catch (error) {
    return decrypted;
  }
}

function isEncryptedPayload(payload) {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    payload.iv &&
    (payload.data || payload.encryptedData || payload.payload)
  );
}

module.exports = {
  encryptPayload,
  decryptPayload,
  isEncryptedPayload,
};
