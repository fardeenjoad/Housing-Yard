// routes/advancedSearchRoutes.js
import express from "express";
import { 
  protect, 
  checkRole, 
  checkPermission, 
  optionalAuth 
} from "../middlewares/auth.js";
import {
  advancedSearchProperties,
  getSearchSuggestions,
  getFacetedResults,
  autoComplete,
  saveSearch,
  getSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
  executeSavedSearch,
  getSimilarProperties,
  getTrendingProperties,
  getPopularProperties,
  getFeaturedProperties,
  getPropertyRecommendations
} from "../controllers/searchController.js"; 

const router = express.Router();

// Public search routes
router.get("/", advancedSearchProperties);
router.get("/autocomplete", autoComplete);
router.get("/suggestions", getSearchSuggestions);
router.get("/facets", getFacetedResults);

// Property discovery routes
router.get("/trending", getTrendingProperties);
router.get("/popular", getPopularProperties);
router.get("/featured", getFeaturedProperties);

// Property specific routes
router.get("/similar/:id", getSimilarProperties);

// Protected user routes
router.use(protect); // All routes below require authentication

// Saved searches management
router.route("/saved")
  .get(getSavedSearches)
  .post(saveSearch);

router.route("/saved/:id")
  .put(updateSavedSearch)
  .delete(deleteSavedSearch);

router.get("/saved/:id/execute", executeSavedSearch);

// Personalized recommendations
router.get("/recommendations", getPropertyRecommendations);

export default router;