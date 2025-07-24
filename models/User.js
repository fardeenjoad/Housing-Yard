import mongoose from "mongoose";

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

export const User = mongoose.model("User", userSchema);
