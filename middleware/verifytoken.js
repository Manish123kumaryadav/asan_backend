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
    if (!decoded.id && decoded.guid) {
      const user = await User.findOne({ where: { guid: decoded.guid } });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
      decoded.id = user.id;
      decoded.email_hash = decoded.email_hash || user.email_hash;
    }

    req.user = decoded;               // attach user id / guid / role to request
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
