const router = require("express").Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const OTP = require("../models/OTP.model");
const bcrypt = require("bcryptjs");
const { sendEmail } = require("../services/email.service");

// POST /api/auth/set-password
router.post("/set-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    // Hash the incoming token to compare with DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching token that hasn't expired
    const user = await User.findOne({
      inviteToken: hashedToken,
      inviteTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired invite link.",
      });
    }

    // Set the password
    user.password = password;
    user.isVerified = true;
    user.isPasswordSet = true;
    user.inviteToken = null;
    user.inviteTokenExpiry = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password set successfully. You can now log in.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//login
// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Check if password has been set yet
    if (!user.isPasswordSet) {
      return res.status(401).json({
        success: false,
        message: "Please set your password using the invite link first.",
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email.",
      });
    }

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the OTP before saving
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Save to DB
    await OTP.create({
      email,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send email
    await sendEmail({
      to: email,
      subject: "Password Reset OTP",
      html: `
        <h2>Password Reset</h2>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This OTP expires in 10 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      `,
    });

    res.status(200).json({
      success: true,
      message: "OTP sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find OTP record
    const record = await OTP.findOne({ email, isUsed: false });
    if (!record) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or already used.",
      });
    }

    // Check expiry
    if (record.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Check OTP matches
    const isMatch = await bcrypt.compare(otp, record.otp);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // Mark OTP as used
    record.isUsed = true;
    await record.save();

    res.status(200).json({
      success: true,
      message: "OTP verified. You can now reset your password.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Set new password — pre-save hook will hash it
    user.password = password;
    await user.save();

    // Delete all OTPs for this email
    await OTP.deleteMany({ email });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
