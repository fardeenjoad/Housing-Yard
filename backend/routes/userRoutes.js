import express from "express";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.patch("/update-profile", protect, updateUserProfile);

export default router;
