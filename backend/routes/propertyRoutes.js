// routes/propertyRoutes.js (Complete Enhanced Version)
import express from "express";
import {
  protect,
  checkRole,
  checkPermission,
  optionalAuth,
  isAdmin,
} from "../middlewares/auth.js";

// Original controllers
import {
  createProperty,
  getAllProperties,
  myProperties,
  updateProperty,
  holdProperty,
  resumeProperty,
  changeStatus,
  getNearbyProperties,
  archiveProperty,
  listPublicProperties,
  getPropertyAnalysis,
  getSimpleProperties,
} from "../controllers/propertyController.js";

// Enhanced controllers
import {
  getPropertyByIdEnhanced,
  getPropertyAnalytics,
  compareProperties,
  bulkUpdateProperties,
} from "../controllers/enhancedPropertyContoller.js";

// Advanced search routes
import advancedSearchRoutes from "./searchRoutes.js";

const router = express.Router();

// ===========================================
// ADVANCED SEARCH ROUTES (Mounted first)
// ===========================================
router.use("/search", advancedSearchRoutes);

//DEBUGGING ROUTES
router.get("/analysis", getPropertyAnalysis);
router.get("/simple", getSimpleProperties);

// ===========================================
// PUBLIC ROUTES
// ===========================================
// Enhanced public property listing with advanced search
router.get("/public", listPublicProperties);

// Nearby properties (requires authentication for better experience)
router.get("/nearby", protect, getNearbyProperties);

// Property comparison
router.get("/compare", compareProperties);

// ===========================================
// ADMIN ROUTES
// ===========================================
// Admin dashboard - all properties
router.get("/admin", protect, isAdmin, getAllProperties);

// Bulk operations (admin only)
router.patch("/bulk", protect, isAdmin, bulkUpdateProperties);

// ===========================================
// USER AUTHENTICATED ROUTES
// ===========================================
// My properties listing
router.get("/me/list", protect, checkRole("agent", "admin"), myProperties);

// ===========================================
// PROPERTY CRUD OPERATIONS
// ===========================================
// Create new property
router.post("/", protect, checkPermission("property:create"), createProperty);

// ===========================================
// INDIVIDUAL PROPERTY ROUTES
// ===========================================
// Property analytics (owner/admin only)
router.get("/:id/analytics", protect, getPropertyAnalytics);

// Enhanced property details with view tracking
router.get("/:id", optionalAuth, getPropertyByIdEnhanced);

// Update property
router.put("/:id", protect, checkPermission("property:update"), updateProperty);

// Archive/Delete property
router.delete(
  "/:id",
  protect,
  checkPermission("property:delete"),
  archiveProperty
);

// ===========================================
// PROPERTY STATUS MANAGEMENT
// ===========================================
// Hold property
router.patch(
  "/:id/hold",
  protect,
  checkPermission("property:hold"),
  holdProperty
);

// Resume property
router.patch(
  "/:id/resume",
  protect,
  checkPermission("property:hold"),
  resumeProperty
);

// Admin status change
router.patch("/:id/status", protect, checkRole("admin"), changeStatus);

export default router;
