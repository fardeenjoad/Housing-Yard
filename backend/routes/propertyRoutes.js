import express from "express";
import { protect, checkRole, checkPermission, optionalAuth } from "../middlewares/auth.js";
import {
  createProperty,
  listPublicProperties,
  getPropertyById,
  myProperties,
  updateProperty,
  archiveProperty,
  holdProperty,
  resumeProperty,
  changeStatus,
} from "../controllers/propertyController.js";

const router = express.Router();

/** PUBLIC ROUTES */
router.get("/public", listPublicProperties);
router.get("/:id", optionalAuth, getPropertyById);

/** AUTHENTICATED ROUTES */
router.get("/me/list", protect, checkRole("agent", "admin"), myProperties);

router.post(
  "/properties",
  protect,
  checkPermission("property:create"),
  createProperty
);

router.put(
  "/properties/:id",
  protect,
  checkPermission("property:update"),
  updateProperty
);

router.delete(
  "/properties/:id",
  protect,
  checkPermission("property:delete"),
  archiveProperty
);

router.patch(
  "/properties/:id/hold",
  protect,
  checkPermission("property:hold"),
  holdProperty
);

router.patch(
  "/properties/:id/resume",
  protect,
  checkPermission("property:hold"),
  resumeProperty
);

/** ADMIN ONLY */
router.patch(
  "/:id/status",
  protect,
  checkRole("admin"),
  changeStatus
);

export default router;