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
} from "../controllers/authController.js";

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

// Resend registration OTP
router.post("/resend-otp", resendOtp);

//Temp delete api
router.delete("/delete", deleteUser)

export default router;