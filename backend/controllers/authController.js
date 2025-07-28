import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { generateOtp, otpExpiryAfter, isOtpExpired } from "../utils/otp.js";
import { sendOtp } from "../utils/twilio.js";
import { sendEmail } from "../utils/sendEmail.js";
import { signResetToken, signToken } from "../utils/jwt.js";

/**
 * STEP 1: name, mobile, role -> send OTP
 */
export const signup = asyncHandler(async (req, res) => {
  const { name, mobile, role = "user" } = req.body;

  if (!name || !mobile) {
    return res.status(400).json({ message: "name and mobile are required" });
  }

  let user = await User.findOne({ mobile });

  const otp = generateOtp();
  const otpExpiry = otpExpiryAfter();

  if (!user) {
    user = await User.create({
      name,
      mobile,
      role,
      otp,
      otpExpiry,
      isVerified: false,
    });
  } else {
    if (user.isVerified) {
      return res
        .status(409)
        .json({ message: "Mobile already registered. Please login." });
    }
    user.name = name;
    user.role = role;
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
  }

  await sendOtp(mobile, otp);

  return res.status(200).json({
    message: "OTP sent to your mobile number",
    userId: user._id,
  });
});

/**
 * STEP 2: verify OTP for registration
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp)
    return res.status(400).json({ message: "mobile and otp are required" });

  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.isVerified)
    return res.status(400).json({ message: "Already verified" });

  if (user.otp !== otp || isOtpExpired(user.otpExpiry)) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return res.status(200).json({ message: "OTP verified successfully" });
});

/**
 * STEP 3: complete signup (email + password)
 */
export const completeSignup = asyncHandler(async (req, res) => {
  const { mobile, email, password, confirmPassword } = req.body;

  if (!mobile || !password || !confirmPassword)
    return res
      .status(400)
      .json({ message: "mobile, password & confirmPassword are required" });

  if (password !== confirmPassword)
    return res.status(400).json({ message: "Passwords do not match" });

  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (!user.isVerified)
    return res.status(400).json({ message: "Verify OTP first" });

  if (user.password)
    return res
      .status(400)
      .json({ message: "Already completed. Please login." });

  if (email) {
    const exists = await User.findOne({ email });
    if (exists && exists._id.toString() !== user._id.toString()) {
      return res.status(409).json({ message: "Email already in use" });
    }
    user.email = email;
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  return res.status(200).json({ message: "Signup completed successfully" });
});

/**
 * EMAIL + PASSWORD LOGIN
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "email and password are required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (!user.password)
    return res.status(400).json({ message: "Please Complete signup first" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = signToken({
    id: user._id,
    role: user.role,
  });

  return res.status(200).json({
    message: "Login successful",
    token,
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
      email: user.email,
      mobile: user.mobile,
    },
  });
});

/**
 * OTP LOGIN: Request OTP
 */
export const requestLoginOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile)
    return res.status(400).json({ message: "mobile number is required" });

  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ message: "User not found" });

  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiry = otpExpiryAfter();
  await user.save();

  await sendOtp(mobile, otp);

  return res.status(200).json({ message: "OTP sent" });
});

/**
 * OTP LOGIN: Verify & issue JWT
 */
export const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp)
    return res.status(400).json({ message: "mobile and otp are required" });

  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.otp !== otp || isOtpExpired(user.otpExpiry)) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  const token = signToken({
    id: user._id,
    role: user.role,
  });

  return res.status(200).json({
    message: "Login successful",
    token,
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
      email: user.email,
      mobile: user.mobile,
    },
  });
});

/**
 * RESEND OTP (for signup or login)
 */
export const resendOtp = asyncHandler(async (req, res) => {
  const { mobile, context = "signup" } = req.body;
  if (!mobile)
    return res.status(400).json({ message: "mobile number is required" });

  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (context === "signup") {
    if (user.isVerified) {
      return res
        .status(400)
        .json({ message: "User already verified. Please login." });
    }
  }

  if (context === "login") {
    if (!user.isVerified) {
      return res.status(400).json({ message: "User not registered yet." });
    }
  }

  if (user.otpExpiry && user.otpExpiry > Date.now() - 30 * 1000) {
    return res.status(400).json({ message: "Please wait for 30 seconds" });
  }

  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiry = otpExpiryAfter();
  await user.save();

  await sendOtp(mobile, otp);

  return res.status(200).json({
    message: OTP`resent for ${context}`,
    userId: user._id,
  });
});

/**
 * FORGOT PASSWORD (JWT-based)
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const resetToken = signResetToken({ id: user._id, email: user.email });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  const html = `
    <h3>Password Reset Request</h3>
    <p>You requested a password reset.</p>
    <p>Click the link below to reset your password (valid for ${
      process.env.RESET_JWT_EXPIRES || "10m"
    }):</p>
    <a href="${resetUrl}" target="_blank">${resetUrl}</a>
  `;

  await sendEmail({
    to: user.email,
    subject: "Password Reset Request",
    text: `Reset your password here: ${resetUrl}`,
    html,
  });

  return res
    .status(200)
    .json({ message: "Password reset link sent to your email" });
});

/**
 * CHANGE PASSWORD
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword)
    return res.status(400).json({ message: "All fields are required" });

  if (newPassword !== confirmNewPassword)
    return res.status(400).json({ message: "New Passwords do not match" });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch)
    return res.status(401).json({ message: "Current Password is incorret" });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return res.status(200).json({ message: "Password changed successfully" });
});

/**
 * TEMP DELETE
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) {
    return res.status(400).json({ message: "Mobile number is required" });
  }

  const user = await User.findOne({ mobile });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  await user.deleteOne();
  return res.status(200).json({ message: "User deleted successfully" });
});
