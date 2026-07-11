const User = require("../model/User");
const bcrypt = require("bcryptjs");
const {
  emailHash,
  generateGuid,
  normalizeEmail,
  ensureUserIdentity,
} = require("../utils/userIdentity");
const { Op } = require("sequelize");

const USER_FIELDS = [
  "name",
  "email_hash",
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
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  }

  if (payload.email_hash && !payload.email) {
    const normalizedEmail = normalizeEmail(payload.email_hash);

    payload.email_hash = normalizedEmail;
    payload.email_hash = emailHash(normalizedEmail);
  }

  if (!payload.phone && payload.mobile) {
    payload.phone = payload.mobile;
  }

  if (!payload.mobile && payload.phone) {
    payload.mobile = payload.phone;
  }

  if (includePassword && body.password) {
    payload.password = body.password;
  }

  return payload;
}

function userWhere(identifier) {
  const value = String(identifier || "").trim();
  const normalizedEmail = normalizeEmail(value);
  const hashedEmail = emailHash(normalizedEmail);

  const conditions = [
    { guid: value },
    { email: normalizedEmail },
    { email: value },
    { email_hash: hashedEmail },
    { email_hash: value },
  ];

  if (/^\d+$/.test(value)) {
    conditions.push({ id: Number(value) });
  }

  return {
    [Op.or]: conditions,
  };
}

function sanitizeUser(user) {
  if (!user) return null;

  const data = user.toJSON ? user.toJSON() : { ...user };

  delete data.password;
  delete data.otp;

  return data;
}

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: {
        exclude: ["password", "otp"],
      },
    });

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get all users error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { email_hash, password } = req.body;

    if (!email_hash || !password) {
      return res.status(400).json({
        success: false,
        message: "Email hash and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email_hash);
    const hashedEmail = emailHash(normalizedEmail);

    const existingUser = await User.findOne({
      where: {
        email_hash: hashedEmail,
        is_deleted: false,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const payload = buildUserPayload(req.body);

    payload.guid = generateGuid();
    payload.password = await bcrypt.hash(password, 10);
    payload.is_deleted = false;
    payload.created_at = new Date();
    payload.updated_at = new Date();

    const user = await User.create(payload);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Create user error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      where: userWhere(req.params.id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await ensureUserIdentity(user);

    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: userWhere(req.params.id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const payload = buildUserPayload(req.body);

    if (req.body.email) {
      const normalizedEmail = normalizeEmail(req.body.email);
      const hashedEmail = emailHash(normalizedEmail);

      const existingUser = await User.findOne({
        where: {
          email_hash: hashedEmail,
          id: {
            [Op.ne]: user.id,
          },
          is_deleted: false,
        },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    if (req.body.password) {
      payload.password = await bcrypt.hash(req.body.password, 10);
    }

    payload.updated_at = new Date();

    await user.update(payload);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Update user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.updateCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const payload = buildUserPayload(req.body);

    if (req.body.email) {
      const normalizedEmail = normalizeEmail(req.body.email);
      const hashedEmail = emailHash(normalizedEmail);

      const existingUser = await User.findOne({
        where: {
          email_hash: hashedEmail,
          id: {
            [Op.ne]: userId,
          },
          is_deleted: false,
        },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    if (req.body.password) {
      payload.password = await bcrypt.hash(req.body.password, 10);
    }

    payload.updated_at = new Date();

    await user.update(payload);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Update current user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};