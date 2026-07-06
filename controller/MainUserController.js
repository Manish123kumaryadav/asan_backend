const sub = require("../model/mainUser");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await sub.findAll();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};