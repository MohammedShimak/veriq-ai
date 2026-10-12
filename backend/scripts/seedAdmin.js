import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User.js";
import { connectDB } from "../config/db.js";

dotenv.config();

async function seedAdmin() {
  console.log("=========================================");
  console.log("LEXAGENT ADMIN SEEDING SCRIPT");
  console.log("=========================================\n");

  await connectDB();

  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    console.log(`👑 Admin user already exists: ${existingAdmin.email} (Role: ${existingAdmin.role})`);
    await mongoose.disconnect();
    return;
  }

  const adminUser = new User({
    name: "LexAgent Admin",
    email: "admin@lexagent.dev",
    password: "admin123",
    role: "admin"
  });

  await adminUser.save();
  console.log(`✅ Admin user successfully created!`);
  console.log(`Email:    admin@lexagent.dev`);
  console.log(`Password: admin123`);
  console.log(`Role:     admin\n`);

  await mongoose.disconnect();
  console.log("=========================================\n");
}

seedAdmin().catch((err) => {
  console.error("🛑 Error seeding admin user:", err);
  process.exit(1);
});
