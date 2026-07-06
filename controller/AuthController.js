const User = require("../model/User");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
    const token = jwt.sign(
      { id: user.id, role_id: user.role_id,name:user.name,email:user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // 4. Send response
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role_id: user.role_id
      }
    });
  }
  catch(error){
    res.status(500).json({ message: error.message });
  }
}