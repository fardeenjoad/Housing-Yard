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

const router = express.Router();

// Registration (3-step)
router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/complete-signup", completeSignup);

// Login (email/password)
router.post("/login", login);

// Login with OTP
router.post("/login-otp/request", requestLoginOtp);
router.post("/login-otp/verify", verifyLoginOtp);

// Resend OTP
router.post("/resend-otp", resendOtp);

// Forgot / Reset Password
router.post("/forgot-password", forgotPassword);
router.patch("/change-password", protect, changePassword);

//Temp delete user
router.delete("/delete", deleteUser);

export default router;
