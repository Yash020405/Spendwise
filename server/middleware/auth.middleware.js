import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

// Middleware to protect routes - verifies JWT token
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extract token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please provide a token.',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user by ID from token (exclude password)
      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found with this token.',
        });
      }

      // Continue to next middleware/route
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during authentication',
      error: error.message,
    });
  }
};

