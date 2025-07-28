import express from "express";
import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getSingleUser,
} from "../controllers/adminController.js";
import { isAdmin, protect } from "../middlewares/auth.js";

const router = express.Router();

router.use(protect, isAdmin);

router.get("/users", getAllUsers);
router.get("/users/:id", getSingleUser);
router.put("/users/:id", updateUserRole);
router.delete("/users/:id", deleteUser);

export default router;
