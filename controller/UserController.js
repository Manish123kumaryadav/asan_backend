const User = require("../model/User");
const bcrypt = require('bcryptjs');
const { createToken, publicUser } = require('./AuthController');

function normalizeUserPayload(body) {
  return {
    name: body.name,
    email: body.email ? String(body.email).trim().toLowerCase() : body.email,
    mobile: body.mobile || body.phone,
    phone: body.phone || body.mobile,
    image: body.image,
    image_path: body.image_path || body.avatarUrl,
    avatar_url: body.avatarUrl || body.image_path,
    city: body.city,
    location: body.location,
    allow_calls: body.allowCalls !== undefined ? Boolean(body.allowCalls) : true,
    plan: body.plan || 'free',
    role_id: body.role_id || 2,
    updated_at: new Date(),
  };
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
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists. Please login.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      ...normalizeUserPayload({ ...req.body, email: normalizedEmail }),
      password: hashedPassword,
      active_ads: 0,
      created_at: new Date(),
      is_deleted: false,
    });
    res.status(201).json({ success: true, token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
 exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
    } catch (error) {
    res.status(500).json({ message: error.message });
    }

}

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: publicUser(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMe = async (req, res) => {
  req.params.id = req.user.id;
  return exports.updateUser(req, res);
};

exports.updateUser = async (req, res) => {
  try {
    const payload = normalizeUserPayload(req.body);
    if (req.body.password) {
      payload.password = await bcrypt.hash(req.body.password, 10);
    }
    const [updated] = await User.update(
      payload,
      { where: { id: req.params.id } }
    );  
     if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = await User.findByPk(req.params.id);
    res.status(200).json({ success: true, message: 'User updated successfully', user: publicUser(user), data: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

