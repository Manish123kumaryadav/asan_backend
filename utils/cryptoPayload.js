const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const keyBuffer = Buffer.from(key, "utf8");
  if (keyBuffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes for AES-256-CBC");
  }

  return keyBuffer;
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
    .createHmac("sha256", getEncryptionKey())
    .update(`${iv}:${data}`)
    .digest("hex");
}

function isValidHmac(iv, data, hmac) {
  if (!hmac) {
    return false;
  }

  const expected = Buffer.from(createHmac(iv, data), "hex");
  const received = Buffer.from(String(hmac), "hex");

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
    iv,
    data,
    hmac: createHmac(iv, data),
  };
}

function decryptPayload(envelope) {
  const iv = envelope.iv;
  const data = envelope.data || envelope.encryptedData || envelope.payload;

  if (!iv || !data) {
    throw new Error("Encrypted payload must include iv and data");
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
