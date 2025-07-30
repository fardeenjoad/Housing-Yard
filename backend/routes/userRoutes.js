import express from "express";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/userController.js";
import { isAdmin, protect } from "../middlewares/auth.js";
import { getAllUsers } from "../controllers/adminController.js";

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.patch("/update-profile", protect, updateUserProfile);

export default router;
