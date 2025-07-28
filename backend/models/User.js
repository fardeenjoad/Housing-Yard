import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    mobile: { type: String, required: true, unique: true, trim: true },

    email: { type: String, unique: true, sparse: true, trim: true },

    password: { type: String },

    role: {
      type: String,
      enum: ["user", "agent", "admin"],
      default: "user",
    },

    isVerified: { type: Boolean, default: false },

    otp: String,
    otpExpiry: Date,
  },
  { timestamps: true }
);

// Password compare method
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password || " ");
};

// Generate Password Reset Token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 min expiry
  return resetToken;
};

export const User = mongoose.model("User", userSchema);
