const jwt = require('jsonwebtoken');
const User = require('../model/User');

module.exports = async (req, res, next) => {
 
  const bearer = req.headers.authorization || '';
  const token  = bearer.startsWith('Bearer ') ? bearer.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = decoded.id
      ? await User.findOne({ where: { id: decoded.id, is_deleted: 0 } })
      : decoded.guid
        ? await User.findOne({ where: { guid: decoded.guid, is_deleted: 0 } })
        : null;
    if (!user) return res.status(401).json({ success: false, message: 'Invalid or expired token' });

    // Always authorize with the current database role rather than a stale JWT role.
    decoded.id = user.id;
    decoded.guid = user.guid;
    decoded.role_id = user.role_id;
    decoded.email_hash = user.email_hash;

    req.user = decoded;               // attach user id / guid / role to request
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
