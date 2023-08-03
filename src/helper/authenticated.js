const jwt = require('jsonwebtoken');

const dotenv = require('dotenv');

dotenv.config();

  function isAuthenticated(req, res, next) {
    const token = req.session.token;
    if (!token) {
      return res.redirect('/cas');
    }
  
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
      if (err) {
        return res.redirect('/cas');
      }
  
      // User is authenticated, set the user info on the request object
      req.user = decoded;
      next();
    });
  }
  module.exports = isAuthenticated; 