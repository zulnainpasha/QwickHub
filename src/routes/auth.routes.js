const router = require("express").Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

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

module.exports = router;
