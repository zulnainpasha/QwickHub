require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User.model");
const connectDB = require("../src/config/db");

const seedAdmin = async () => {
  try {
    await connectDB();

    // Check if admin already exists
    const existing = await User.findOne({ role: "admin" });
    if (existing) {
      console.log("Admin already exists. Skipping.");
      process.exit(0);
    }

    // Create the admin
    const admin = new User({
      name: process.env.SEED_ADMIN_NAME,
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
      role: "admin",
      isVerified: true,
      isPasswordSet: true,
    });

    await admin.save();

    console.log("Admin created successfully!");
    console.log(`Email: ${process.env.SEED_ADMIN_EMAIL}`);
    console.log(`Password: ${process.env.SEED_ADMIN_PASSWORD}`);
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
};

seedAdmin();
