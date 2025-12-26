import express from "express";
import User, { CURRENCIES } from "../models/user.model.js";
import { generateToken } from "../utils/generateToken.js";
import { protect } from "../middleware/auth.middleware.js";

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

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      currency: currency || 'USD',
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

    // Find user and include password
    const user = await User.findOne({ email }).select("+password");

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

    const updateFields = {};
    if (name) updateFields.name = name;
    if (currency && CURRENCIES[currency]) updateFields.currency = currency;
    if (monthlyBudget !== undefined) updateFields.monthlyBudget = monthlyBudget;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true }
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
