import express from "express";
import {
  signup,
  verifyOtp,
  completeSignup,
  login,
  requestLoginOtp,
  verifyLoginOtp,
  resendOtp,
  deleteUser,
  forgotPassword,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import { mildLimiter, strictLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// Registration (3-step)
router.post("/signup", mildLimiter, signup);
router.post("/verify-otp", strictLimiter, verifyOtp);
router.post("/complete-signup", mildLimiter, completeSignup);

// Login (email/password)
router.post("/login", strictLimiter, login);

// Login with OTP
router.post("/login-otp/request", strictLimiter, requestLoginOtp);
router.post("/login-otp/verify", strictLimiter, verifyLoginOtp);

// Resend OTP
router.post("/resend-otp", strictLimiter, resendOtp);

// Forgot / Reset Password
router.post("/forgot-password", mildLimiter, forgotPassword);
router.patch("/change-password", mildLimiter, protect, changePassword);

//Temp delete user
router.delete("/delete", deleteUser);

export default router;
