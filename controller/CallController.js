const User = require("../model/User");

exports.start = async (req, res) => {
  return res.json({
    success: true,
    data: {
      callId: `CALL${Date.now()}`,
      status: "requested",
      message: "Call request created",
    },
  });
};

exports.end = async (req, res) => {
  return res.json({ success: true, message: "Call ended", data: { callId: req.params.callId, status: "ended" } });
};

exports.updatePreferences = async (req, res) => {
  try {
    const allowCalls = Boolean(req.body.allowCalls);
    await User.update({ allow_calls: allowCalls, updated_at: new Date() }, { where: { id: req.user.id } });
    return res.json({ success: true, data: { allowCalls } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
