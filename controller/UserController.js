const User = require("../model/User");
const { Op } = require("sequelize");

const USER_FIELDS = [
  "name",
  "email",
  "mobile",
  "phone",
  "password",
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

// Request body se allowed fields nikalna
function buildUserPayload(body = {}) {
  const payload = {};

  USER_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  });

  // Mobile aur phone ko sync karna
  if (!payload.phone && payload.mobile) {
    payload.phone = payload.mobile;
  }

  if (!payload.mobile && payload.phone) {
    payload.mobile = payload.phone;
  }

  // Email ko simple lowercase karna
  if (payload.email) {
    payload.email = String(payload.email).trim().toLowerCase();
  }

  return payload;
}

// ID, GUID ya email se user search karna
function getUserWhere(identifier) {
  const value = String(identifier || "").trim();

  const conditions = [
    { guid: value },
    { email: value.toLowerCase() },
  ];

  if (/^\d+$/.test(value)) {
    conditions.push({ id: Number(value) });
  }

  return {
    [Op.or]: conditions,
    is_deleted: false,
  };
}

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        is_deleted: false,
      },
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create user
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email_hash,
      password,
    } = req.body;

    if (!name || !email_hash   || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const normalizedEmail = String(email_hash).trim().toLowerCase();

    const existingUser = await User.findOne({
      where: {
        email_hash: normalizedEmail,
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

    payload.email_hash = normalizedEmail;

    // Plain password save hoga
    payload.password = password;

    payload.guid = `USER-${Date.now()}-${Math.floor(
      Math.random() * 10000
    )}`;

    payload.is_deleted = false;
    payload.created_at = new Date();
    payload.updated_at = new Date();

    const user = await User.create(payload);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error("Create user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single user
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      where: getUserWhere(req.params.id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user by ID, GUID or email
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: getUserWhere(req.params.id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const payload = buildUserPayload(req.body);

    // Updated email kisi dusre user ki nahi honi chahiye
    if (payload.email) {
      const existingUser = await User.findOne({
        where: {
          email_hash: payload.email_hash,
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

    payload.updated_at = new Date();

    await user.update(payload);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update logged-in user
exports.updateCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findOne({
      where: {
        id: userId,
        is_deleted: false,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const payload = buildUserPayload(req.body);

    if (payload.email) {
      const existingUser = await User.findOne({
        where: {
          email_hash: payload.email_hash,
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

    payload.updated_at = new Date();

    await user.update(payload);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update current user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Soft delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: getUserWhere(req.params.id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.update({
      is_deleted: true,
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};