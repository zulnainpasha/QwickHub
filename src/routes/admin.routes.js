const router = require("express").Router();
const crypto = require("crypto");
const User = require("../models/User.model");
const { sendEmail } = require("../services/email.service");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

// POST /api/admin/users  Admin creates a new user
router.post("/users", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, email, role } = req.body;

    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    // Generate invite token
    const plainToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(plainToken)
      .digest("hex");

    // Create the user
    const user = new User({
      name,
      email,
      role,
      isVerified: false,
      isPasswordSet: false,
      inviteToken: hashedToken,
      inviteTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await user.save();

    // Send invite email
    const inviteLink = `http://localhost:3000/set-password?token=${plainToken}`;

    await sendEmail({
      to: email,
      subject: "You are invited to QwickHub",
      html: `
        <h2>Hi ${name},</h2>
        <p>You have been added as a <strong>${role}</strong>.</p>
        <p>Click below to set your password:</p>
        <a href="${inviteLink}">${inviteLink}</a>
        <p>This link expires in 24 hours.</p>
      `,
    });

    res.status(201).json({
      success: true,
      message: `User created. Invite sent to ${email}`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
