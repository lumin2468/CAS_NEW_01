const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env

const JWT_SECRET = process.env.SECRET_KEY; // Access the JWT secret from environment variables



const verifyToken = (req, res, next) => {
    const token = req.session.token
    if (!token) {
      return res.status(403).json({ message: 'Token not provided' });
    }
  
    jwt.verify(token, 'LCu7Ugc54QD3pbaD52pbSIa45tkgbqLT', (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
  
      req.user = decoded.user; // Store the user's payload in the request object
      next(); // Continue to the next middleware/route
    });
}

module.exports = verifyToken; 