const User = require("../model/User");
const bcrypt = require('bcryptjs');
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, mobile, otp, image, image_path, city, location } = req.body;
   const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      otp,
      image,
      image_path,
      city,
      location
    });
    res.status(201).json({ success: true, user });
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

exports.updateUser = async (req, res) => {
  try {
    const { name, email, password, mobile, otp, image, image_path, city, location } = req.body;
    const [updated] = await User.update(
      { name, email, password, mobile, otp, image, image_path, city, location },
      { where: { id: req.params.id } }
    );  
     if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

