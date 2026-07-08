const User = require("../model/User");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendOtpEmail } = require('../utils/email');

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
    { id: user.id, role_id: user.role_id || 2, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(user) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    phone: user.phone || user.mobile || '',
    location: user.location || user.city || '',
    avatarUrl: user.avatar_url || user.image_path || user.image || '',
    allowCalls: user.allow_calls !== false,
    activeAds: Number(user.active_ads || 0),
    plan: user.plan || 'free',
    role_id: user.role_id || 2
  };
}

exports.publicUser = publicUser;
exports.createToken = createToken;

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try{
const user = await User.findOne({ where: { email } });
   if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    

    // 2. Validate password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 3. Generate JWT
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
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = generateOtp();
    await user.update({ otp: buildOtpPayload(otp) });
    console.log('[OTP] login OTP generated', { email });

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
      return res.status(502).json({ success: false, message: 'Failed to send OTP email' });
    }

    if (!mail.sent) {
      console.error('[OTP] login email not sent: mail service is not configured');
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Please set RESEND_API_KEY or SMTP credentials.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
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

    const user = await User.findOne({ where: { email } });
    if (!user || !validateOtpPayload(user.otp, otp)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

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
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = generateOtp();
    await user.update({ otp: buildOtpPayload(otp) });
    console.log('[OTP] password reset OTP generated', { email });

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
      return res.status(502).json({ success: false, message: 'Failed to send OTP email' });
    }

    if (!mail.sent) {
      console.error('[OTP] forgot password email not sent: mail service is not configured');
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Please set RESEND_API_KEY or SMTP credentials.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;

  try {
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Email, OTP and password are required' });
    }
    if (confirmPassword && confirmPassword !== password) {
      return res.status(400).json({ success: false, message: 'Password and confirm password do not match' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user || !validateOtpPayload(user.otp, otp)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword, otp: null });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      token: createToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
