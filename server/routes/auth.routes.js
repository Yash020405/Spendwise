import express from "express";
import User, { CURRENCIES } from "../models/user.model.js";
import { generateToken } from "../utils/generateToken.js";
import { protect } from "../middleware/auth.middleware.js";
import { sanitizeString } from "../utils/sanitize.js";

const router = express.Router();

// Get available currencies
router.get("/currencies", (req, res) => {
  res.json({
    success: true,
    data: CURRENCIES,
  });
});

// Sign up
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, currency } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all fields (name, email, password)",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name);
    const sanitizedEmail = sanitizeString(email).toLowerCase();
    const sanitizedCurrency = sanitizeString(currency || 'USD');

    // Check if user already exists
    const userExists = await User.findOne({ email: sanitizedEmail });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create new user
    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password,
      currency: sanitizedCurrency,
    });

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          currency: user.currency,
          currencySymbol: CURRENCIES[user.currency]?.symbol || '$',
          monthlyBudget: user.monthlyBudget,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during signup",
      error: error.message,
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email and password",
      });
    }

    // Sanitize email before query
    const sanitizedEmail = sanitizeString(email).toLowerCase();

    // Find user and include password
    const user = await User.findOne({ email: sanitizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          currency: user.currency,
          currencySymbol: CURRENCIES[user.currency]?.symbol || '$',
          monthlyBudget: user.monthlyBudget,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
});

// Get current user profile
router.get("/me", protect, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          currency: req.user.currency,
          currencySymbol: CURRENCIES[req.user.currency]?.symbol || '$',
          monthlyBudget: req.user.monthlyBudget,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Update user profile
router.put("/me", protect, async (req, res) => {
  try {
    const { name, currency, monthlyBudget } = req.body;

    // Build update object with explicit sanitization
    const updateFields = {};

    // Sanitize and validate each field explicitly
    if (name && typeof name === 'string') {
      updateFields.name = sanitizeString(String(name).trim().slice(0, 100));
    }
    if (currency && typeof currency === 'string' && CURRENCIES[currency]) {
      updateFields.currency = sanitizeString(String(currency));
    }
    if (monthlyBudget !== undefined && typeof monthlyBudget === 'number') {
      updateFields.monthlyBudget = Number(monthlyBudget);
    }

    // Use $set operator explicitly to prevent injection
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          currency: user.currency,
          currencySymbol: CURRENCIES[user.currency]?.symbol || '$',
          monthlyBudget: user.monthlyBudget,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
