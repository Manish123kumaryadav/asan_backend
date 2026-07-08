const User = require("../model/User");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendOtpEmail } = require('../utils/email');
const { Op } = require('sequelize');
const { normalizeEmail, emailHash, ensureUserIdentity } = require('../utils/userIdentity');

const OTP_EXPIRES_IN_MS = 15 * 60 * 1000;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildOtpPayload(otp) {
  return `${otp}:${Date.now() + OTP_EXPIRES_IN_MS}`;
}

function validateOtpPayload(savedOtp, otp) {
  if (!savedOtp || !otp) {
    return false;
  }

  const [savedCode, expiresAt] = String(savedOtp).split(':');
  return savedCode === String(otp) && Number(expiresAt) > Date.now();
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, guid: user.guid, role_id: user.role_id, name: user.name, email_hash: user.email_hash },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    guid: user.guid,
    name: user.name,
    email: user.email,
    email_hash: user.email_hash,
    mobile: user.mobile,
    phone: user.phone,
    plan: user.plan,
    role_id: user.role_id
  };
}

function buildEmailWhere(email) {
  const normalizedEmail = normalizeEmail(email);
  const hash = emailHash(normalizedEmail);
  return {
    [Op.or]: [
      { email_hash: hash },
      { email: normalizedEmail },
      { email },
    ],
  };
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try{
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ where: buildEmailWhere(email) });
   if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    

    // 2. Validate password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 3. Generate JWT
    await ensureUserIdentity(user);
    const token = createToken(user);

    // 4. Send response
    return res.status(200).json({
      success: true,
      token,
      user: publicUser(user)
    });
  }
  catch(error){
    res.status(500).json({ message: error.message });
  }
}

exports.sendLoginOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ where: buildEmailWhere(email) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await ensureUserIdentity(user);
    const otp = generateOtp();
    await user.update({ otp: buildOtpPayload(otp) });

    let mail;
    try {
      mail = await sendOtpEmail(email, otp, 'login', user.name);
    } catch (error) {
      console.error('Failed to send login OTP email:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
      });
      mail = { sent: false, provider: 'fallback', error: error.code || error.message };
    }

    return res.status(200).json({
      success: true,
      message: mail.sent ? 'OTP sent successfully' : 'OTP generated successfully',
      email_hash: user.email_hash,
      ...(mail.sent ? {} : { otp })
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ where: buildEmailWhere(email) });
    if (!user || !validateOtpPayload(user.otp, otp)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    await ensureUserIdentity(user);
    await user.update({ otp: null });

    return res.status(200).json({
      success: true,
      token: createToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.sendForgotPasswordOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ where: buildEmailWhere(email) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await ensureUserIdentity(user);
    const otp = generateOtp();
    await user.update({ otp: buildOtpPayload(otp) });

    let mail;
    try {
      mail = await sendOtpEmail(email, otp, 'forgot-password', user.name);
    } catch (error) {
      console.error('Failed to send password reset OTP email:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
      });
      mail = { sent: false, provider: 'fallback', error: error.code || error.message };
    }

    return res.status(200).json({
      success: true,
      message: mail.sent ? 'Password reset OTP sent successfully' : 'Password reset OTP generated successfully',
      email_hash: user.email_hash,
      ...(mail.sent ? {} : { otp })
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, password } = req.body;

  try {
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Email, OTP and password are required' });
    }

    const user = await User.findOne({ where: buildEmailWhere(email) });
    if (!user || !validateOtpPayload(user.otp, otp)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword, otp: null });

    return res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
