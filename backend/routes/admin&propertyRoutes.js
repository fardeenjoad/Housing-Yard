import express from "express";
import { protect, checkRole, checkPermission } from "../middlewares/auth.js";
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
} from "../controllers/admin&propertyController.js";

const router = express.Router();

/** PUBLIC ROUTES */
router.get("/public", listPublicProperties);
router.get("/:id", getPropertyById);

/** AUTHENTICATED ROUTES */
router.get("/me/list", protect, checkRole("agent", "admin"), myProperties);

router.post(
  "/properties",
  protect,
  checkPermission("property:create"),
  createProperty
);

router.put(
  "/:id",
  protect,
  checkPermission("property:update"),
  updateProperty
);

router.delete(
  "/:id",
  protect,
  checkPermission("property:delete"),
  archiveProperty
);

router.patch(
  "/:id/hold",
  protect,
  checkPermission("property:hold"),
  holdProperty
);

router.patch(
  "/:id/resume",
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