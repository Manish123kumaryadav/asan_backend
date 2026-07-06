const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
 
  const bearer = req.headers.authorization || '';
  const token  = bearer.startsWith('Bearer ') ? bearer.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;               // attach user id / role to request
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
