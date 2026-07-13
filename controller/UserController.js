const email_hash = String(req.body.email_hash || "").trim().toLowerCase();

const user = await User.findOne({
  where: {
    email_hash: email_hash,
    is_deleted: false,
  },
});

if (!user) {
  return res.status(401).json({
    success: false,
    message: "Invalid email hash or password",
  });
}

if (user.password !== req.body.password) {
  return res.status(401).json({
    success: false,
    message: "Invalid email hash or password",
  });
}