const {
  decryptPayload,
  encryptPayload,
  isEncryptedPayload,
} = require("../utils/cryptoPayload");

function encryptionMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.locals.skipEncryption || req.query.raw === "true") {
      return originalJson(body);
    }

    return originalJson(encryptPayload(body));
  };

  try {
    if (isEncryptedPayload(req.body)) {
      req.body = decryptPayload(req.body);
    } else if (process.env.ENCRYPTION_REQUIRED === "true" && ["POST", "PUT", "PATCH"].includes(req.method)) {
      res.locals.skipEncryption = true;
      return res.status(400).json({
        success: false,
        message: "Encrypted request body is required",
      });
    }

    return next();
  } catch (error) {
    res.locals.skipEncryption = true;
    return res.status(400).json({
      success: false,
      message: "Invalid encrypted request body",
    });
  }
}

module.exports = encryptionMiddleware;
