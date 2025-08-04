import express from "express";
import {
  createReport,
  getAllReports,
  updateReportStatus,
  getMyReports,
} from "../controllers/reportController.js";
import { protect, isAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.post("/", protect, createReport);
router.get("/", protect, isAdmin, getAllReports);
router.put("/:id", protect, isAdmin, updateReportStatus);
router.get("/my", protect, getMyReports);

export default router;
