// controllers/advancedSearchController.js
import { Property } from "../models/Property.js";
import { SavedSearch } from "../models/savedSearch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AdvancedApiFeatures } from "../utils/apiFeatures.js";

// Enhanced Property Search with advanced filtering
export const advancedSearchProperties = asyncHandler(async (req, res) => {
  try {
    // Ensure req.query exists
    const queryParams = req.query || {};

    // Get total count before pagination
    const countQuery = new AdvancedApiFeatures(
      Property.find({ status: "active" }),
      queryParams
    );

    // Apply filters for counting (without pagination)
    countQuery
      .advancedSearch()
      .locationSearch()
      .priceFilter()
      .propertyFilters()
      .geoSearch();

    const total = await Property.countDocuments(countQuery.query.getQuery());

    // Get properties with all filters including pagination
    const features = new AdvancedApiFeatures(
      Property.find({ status: "active" }),
      queryParams
    ).applyFilters();

    const properties = await features.query
      .populate("createdBy", "name role")
      .lean();

    // Get search suggestions if query is provided and results are few
    let suggestions = [];
    if (queryParams.q && properties.length < 5) {
      suggestions = await getSearchSuggestionsHelper(queryParams.q);
    }

    // Get faceted results for filters
    const facets = await getFacetedResultsHelper(queryParams);

    res.status(200).json({
      success: true,
      total,
      count: properties.length,
      page: features.page || 1,
      limit: features.limit || 10,
      data: properties,
      suggestions,
      facets,
      filters: queryParams,
    });
  } catch (error) {
    console.error("Advanced search error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    });
  }
});

// Helper function for getting search suggestions
const getSearchSuggestionsHelper = async (searchQuery) => {
  try {
    if (!searchQuery || searchQuery.length < 2) {
      return [];
    }

    const suggestions = await Property.aggregate([
      {
        $match: {
          status: "active",
          $or: [
            { "location.city": { $regex: searchQuery, $options: "i" } },
            { "location.area": { $regex: searchQuery, $options: "i" } },
            { title: { $regex: searchQuery, $options: "i" } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          cities: { $addToSet: "$location.city" },
          areas: { $addToSet: "$location.area" },
          localities: { $addToSet: "$location.address" },
        },
      },
      {
        $project: {
          suggestions: {
            $slice: [{ $concatArrays: ["$cities", "$areas"] }, 8],
          },
        },
      },
    ]);

    return suggestions[0]?.suggestions || [];
  } catch (error) {
    console.error("Error getting search suggestions:", error);
    return [];
  }
};

// Search suggestions endpoint
export const getSearchSuggestions = asyncHandler(async (req, res) => {
  const queryParams = req.query || {};
  const { q } = queryParams;

  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  try {
    const suggestions = await getSearchSuggestionsHelper(q);

    res.json({
      success: true,
      suggestions: suggestions || [],
    });
  } catch (error) {
    console.error("Search suggestions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get suggestions",
      suggestions: [],
    });
  }
});

// Helper function for faceted results
const getFacetedResultsHelper = async (queryParams) => {
  try {
    const basePipeline = [{ $match: { status: "active" } }];

    // Add search conditions to base pipeline if needed
    if (queryParams.q) {
      basePipeline.push({
        $match: {
          $or: [
            { $text: { $search: queryParams.q } },
            { title: { $regex: queryParams.q, $options: "i" } },
            { "location.city": { $regex: queryParams.q, $options: "i" } },
          ],
        },
      });
    }

    const facets = await Property.aggregate([
      ...basePipeline,
      {
        $facet: {
          priceRanges: [
            {
              $bucket: {
                groupBy: "$price",
                boundaries: [0, 2500000, 5000000, 10000000, 20000000, 50000000],
                default: "50000000+",
                output: { count: { $sum: 1 } },
              },
            },
          ],
          bedroomCounts: [
            { $group: { _id: "$bedrooms", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          cities: [
            { $group: { _id: "$location.city", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          propertyTypes: [
            { $group: { _id: "$propertyType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          furnishingTypes: [
            { $group: { _id: "$furnishing", count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    return facets[0] || {};
  } catch (error) {
    console.error("Error getting faceted results:", error);
    return {};
  }
};

// Faceted search results for filter counts
export const getFacetedResults = asyncHandler(async (req, res) => {
  const queryParams = req.query || {};

  try {
    const facets = await getFacetedResultsHelper(queryParams);

    res.json({
      success: true,
      facets: facets,
    });
  } catch (error) {
    console.error("Faceted results error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get faceted results",
      facets: {},
    });
  }
});

// Autocomplete endpoint for real-time suggestions
export const autoComplete = asyncHandler(async (req, res) => {
  const queryParams = req.query || {};
  const { q, type = "all" } = queryParams;

  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  try {
    let suggestions = [];

    switch (type) {
      case "location":
        suggestions = await Property.aggregate([
          {
            $match: {
              status: "active",
              $or: [
                { "location.city": { $regex: `^${q}`, $options: "i" } },
                { "location.area": { $regex: `^${q}`, $options: "i" } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              cities: { $addToSet: "$location.city" },
              areas: { $addToSet: "$location.area" },
            },
          },
          {
            $project: {
              suggestions: { $concatArrays: ["$cities", "$areas"] },
            },
          },
        ]);
        break;

      case "property":
        suggestions = await Property.find({
          title: { $regex: q, $options: "i" },
          status: "active",
        })
          .select("title location.city location.area")
          .limit(8)
          .lean();
        break;

      default:
        const allSuggestions = await Property.aggregate([
          {
            $match: {
              status: "active",
              $or: [
                { title: { $regex: q, $options: "i" } },
                { "location.city": { $regex: q, $options: "i" } },
                { "location.area": { $regex: q, $options: "i" } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              titles: { $addToSet: "$title" },
              cities: { $addToSet: "$location.city" },
              areas: { $addToSet: "$location.area" },
            },
          },
        ]);

        if (allSuggestions[0]) {
          suggestions = [
            ...allSuggestions[0].cities,
            ...allSuggestions[0].areas,
            ...allSuggestions[0].titles,
          ].slice(0, 8);
        }
    }

    res.json({
      success: true,
      suggestions: Array.isArray(suggestions)
        ? suggestions
        : suggestions[0]?.suggestions || [],
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    res.status(500).json({
      success: false,
      message: "Autocomplete failed",
      suggestions: [],
    });
  }
});

// Saved searches functionality

export const saveSearch = asyncHandler(async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: "Request body is required",
    });
  }

  const { searchQuery, name, alertFrequency, description } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Search name is required",
    });
  }

  if (!searchQuery) {
    return res.status(400).json({
      success: false,
      message: "Search query is required",
    });
  }

  try {
    // Check if user already has a search with this name
    const existingSearch = await SavedSearch.findOne({
      userId: req.user._id,
      name: name.trim(),
      isActive: true,
    });

    if (existingSearch) {
      return res.status(400).json({
        success: false,
        message: "A search with this name already exists",
      });
    }

    const normalizedSearchQuery = { ...searchQuery };

    if (
      normalizedSearchQuery.bedrooms &&
      !Array.isArray(normalizedSearchQuery.bedrooms)
    ) {
      if (typeof normalizedSearchQuery.bedrooms === "string") {
        normalizedSearchQuery.bedrooms = normalizedSearchQuery.bedrooms
          .split(",")
          .map((b) => b.trim());
      } else {
        normalizedSearchQuery.bedrooms = [
          normalizedSearchQuery.bedrooms.toString(),
        ];
      }
    }

    if (
      normalizedSearchQuery.bathrooms &&
      !Array.isArray(normalizedSearchQuery.bathrooms)
    ) {
      if (typeof normalizedSearchQuery.bathrooms === "string") {
        normalizedSearchQuery.bathrooms = normalizedSearchQuery.bathrooms
          .split(",")
          .map((b) => b.trim());
      } else {
        normalizedSearchQuery.bathrooms = [
          normalizedSearchQuery.bathrooms.toString(),
        ];
      }
    }

    if (
      normalizedSearchQuery.propertyType &&
      !Array.isArray(normalizedSearchQuery.propertyType)
    ) {
      if (typeof normalizedSearchQuery.propertyType === "string") {
        normalizedSearchQuery.propertyType = normalizedSearchQuery.propertyType
          .split(",")
          .map((pt) => pt.trim());
      } else {
        normalizedSearchQuery.propertyType = [
          normalizedSearchQuery.propertyType.toString(),
        ];
      }
    }

    console.log("Normalized searchQuery:", normalizedSearchQuery);

    // Get current result count for this search
    let resultCount = 0;
    try {
      const features = new AdvancedApiFeatures(
        Property.find({ status: "active" }),
        normalizedSearchQuery
      ).applyFilters();

      resultCount = await Property.countDocuments(features.query.getQuery());
    } catch (countError) {
      console.error("Error counting results:", countError);
      // Don't fail the save operation, just set count to 0
      resultCount = 0;
    }

    const savedSearch = await SavedSearch.create({
      userId: req.user._id,
      name: name.trim(),
      searchQuery: normalizedSearchQuery,
      alertFrequency: alertFrequency || "weekly",
      description: description?.trim(),
      resultCount,
    });

    res.status(201).json({
      success: true,
      message: "Search saved successfully",
      data: savedSearch,
    });
  } catch (error) {
    console.error("Save search error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save search",
      error: error.message,
    });
  }
});

// Get saved searches for user
export const getSavedSearches = asyncHandler(async (req, res) => {
  try {
    const savedSearches = await SavedSearch.find({
      userId: req.user._id,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Update result counts for each saved search
    const updatedSearches = await Promise.all(
      savedSearches.map(async (search) => {
        try {
          const features = new AdvancedApiFeatures(
            Property.find({ status: "active" }),
            search.searchQuery
          ).applyFilters();

          const currentCount = await Property.countDocuments(
            features.query.getQuery()
          );

          // Update the count in database if changed
          if (currentCount !== search.resultCount) {
            await SavedSearch.findByIdAndUpdate(search._id, {
              resultCount: currentCount,
            });
          }

          return {
            ...search,
            resultCount: currentCount,
            hasNewResults: currentCount > search.resultCount,
          };
        } catch (error) {
          console.error("Error updating search count:", error);
          return search;
        }
      })
    );

    res.json({
      success: true,
      count: updatedSearches.length,
      data: updatedSearches,
    });
  } catch (error) {
    console.error("Get saved searches error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get saved searches",
      error: error.message,
    });
  }
});

// Update saved search
export const updateSavedSearch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, alertFrequency, isActive, description } = req.body;

  try {
    const savedSearch = await SavedSearch.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!savedSearch) {
      return res.status(404).json({
        success: false,
        message: "Saved search not found",
      });
    }

    // Update fields
    if (name) savedSearch.name = name.trim();
    if (alertFrequency) savedSearch.alertFrequency = alertFrequency;
    if (typeof isActive === "boolean") savedSearch.isActive = isActive;
    if (description !== undefined)
      savedSearch.description = description?.trim();

    await savedSearch.save();

    res.json({
      success: true,
      message: "Search updated successfully",
      data: savedSearch,
    });
  } catch (error) {
    console.error("Update saved search error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update search",
      error: error.message,
    });
  }
});

// Delete saved search
export const deleteSavedSearch = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const deletedSearch = await SavedSearch.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!deletedSearch) {
      return res.status(404).json({
        success: false,
        message: "Saved search not found",
      });
    }

    res.json({
      success: true,
      message: "Saved search deleted successfully",
    });
  } catch (error) {
    console.error("Delete saved search error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete search",
      error: error.message,
    });
  }
});

// Execute saved search to get current results
export const executeSavedSearch = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const savedSearch = await SavedSearch.findOne({
      _id: id,
      userId: req.user._id,
      isActive: true,
    });

    if (!savedSearch) {
      return res.status(404).json({
        success: false,
        message: "Saved search not found",
      });
    }

    // Execute the search with current parameters
    const features = new AdvancedApiFeatures(
      Property.find({ status: "active" }),
      savedSearch.searchQuery
    ).applyFilters();

    const properties = await features.query
      .populate("createdBy", "name role")
      .lean();

    const total = await Property.countDocuments(features.query.getQuery());

    // Update result count and last executed time
    await SavedSearch.findByIdAndUpdate(id, {
      resultCount: total,
      lastExecutedAt: new Date(),
    });

    res.json({
      success: true,
      searchName: savedSearch.name,
      total,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error("Execute saved search error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute search",
      error: error.message,
    });
  }
});

// Similar properties based on current property
export const getSimilarProperties = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Build similarity criteria
    const similarityQuery = {
      _id: { $ne: id },
      status: "active",
      $and: [
        {
          $or: [
            { "location.city": property.location.city },
            { "location.area": property.location.area },
          ],
        },
        {
          $or: [
            { propertyType: property.propertyType },
            {
              bedrooms: {
                $in: [
                  property.bedrooms - 1,
                  property.bedrooms,
                  property.bedrooms + 1,
                ],
              },
            },
          ],
        },
        {
          price: {
            $gte: property.price * 0.6,
            $lte: property.price * 1.4,
          },
        },
      ],
    };

    const similar = await Property.find(similarityQuery)
      .select(
        "title price location bedrooms bathrooms areaSqft images propertyType"
      )
      .sort({
        viewCount: -1,
        createdAt: -1,
      })
      .limit(8)
      .lean();

    res.json({
      success: true,
      count: similar.length,
      data: similar,
    });
  } catch (error) {
    console.error("Get similar properties error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get similar properties",
      error: error.message,
    });
  }
});

// Get trending properties based on views and recent activity
export const getTrendingProperties = asyncHandler(async (req, res) => {
  const queryParams = req.query || {};
  const { limit = 20 } = queryParams;

  try {
    const trending = await Property.aggregate([
      { $match: { status: "active" } },
      {
        $addFields: {
          trendingScore: {
            $add: [
              { $multiply: ["$viewCount", 0.3] },
              { $multiply: ["$inquiryCount", 0.5] },
              { $multiply: ["$shareCount", 0.2] },
              {
                $cond: [
                  {
                    $gte: [
                      "$createdAt",
                      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    ],
                  },
                  10,
                  0,
                ],
              },
            ],
          },
        },
      },
      { $sort: { trendingScore: -1, viewCount: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      count: trending.length,
      data: trending,
    });
  } catch (error) {
    console.error("Get trending properties error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get trending properties",
      error: error.message,
    });
  }
});

// Get popular properties based on engagement

export const getPopularProperties = asyncHandler(async (req, res) => {
  const queryParams = req.query || {};
  const { limit = 15, city, propertyType } = queryParams;

  try {
    const matchQuery = {
      status: "active",
    };

    if (city) matchQuery["location.city"] = { $regex: city, $options: "i" };
    if (propertyType) matchQuery.propertyType = propertyType;

    // Get all active properties
    const popular = await Property.find(matchQuery)
      .sort({
        createdAt: -1, // Sort by newest first
      })
      .limit(parseInt(limit))
      .populate("createdBy", "name role")
      .lean();

    res.json({
      success: true,
      count: popular.length,
      data: popular,
    });
  } catch (error) {
    console.error("Get popular properties error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get popular properties",
      error: error.message,
    });
  }
});

// Get featured properties
export const getFeaturedProperties = asyncHandler(async (req, res) => {
  const queryParams = req.query || {};
  const { limit = 10, city } = queryParams;

  try {
    const matchQuery = {
      status: "active",
    };

    if (city) matchQuery["location.city"] = { $regex: city, $options: "i" };

    // Get all active properties
    const featured = await Property.find(matchQuery)
      .sort({
        createdAt: -1, // Sort by newest first
      })
      .limit(parseInt(limit))
      .populate("createdBy", "name role")
      .lean();

    res.json({
      success: true,
      count: featured.length,
      data: featured,
    });
  } catch (error) {
    console.error("Get featured properties error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get featured properties",
      error: error.message,
    });
  }
});

// Get property recommendations for user
export const getPropertyRecommendations = asyncHandler(async (req, res) => {
  const queryParams = req.query || {};
  const { limit = 10 } = queryParams;
  const userId = req.user._id;

  try {
    // Get user's search history and preferences
    const userSearches = await SavedSearch.find({
      userId,
      isActive: true,
    })
      .select("searchQuery")
      .lean();

    let recommendations = [];

    if (userSearches.length > 0) {
      // Extract common preferences from user's saved searches
      const preferences = extractUserPreferences(userSearches);

      // Find properties matching user preferences
      recommendations = await Property.find({
        status: "active",
        ...buildRecommendationQuery(preferences),
      })
        .sort({
          createdAt: -1,
          viewCount: -1,
        })
        .limit(parseInt(limit))
        .lean();
    }

    // If no recommendations or not enough, add popular properties
    if (recommendations.length < limit) {
      const popular = await Property.find({
        status: "active",
        _id: { $nin: recommendations.map((p) => p._id) },
      })
        .sort({ viewCount: -1 })
        .limit(parseInt(limit) - recommendations.length)
        .lean();

      recommendations = [...recommendations, ...popular];
    }

    res.json({
      success: true,
      count: recommendations.length,
      data: recommendations,
    });
  } catch (error) {
    console.error("Get recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recommendations",
      error: error.message,
    });
  }
});

// Helper function to extract user preferences
const extractUserPreferences = (searches) => {
  const preferences = {
    cities: [],
    priceRanges: [],
    propertyTypes: [],
    bedrooms: [],
  };

  searches.forEach((search) => {
    const query = search.searchQuery;
    if (query.city) preferences.cities.push(query.city);
    if (query.propertyType) preferences.propertyTypes.push(query.propertyType);
    if (query.bedrooms) preferences.bedrooms.push(parseInt(query.bedrooms));
    if (query.minPrice || query.maxPrice) {
      preferences.priceRanges.push({
        min: query.minPrice ? parseInt(query.minPrice) : 0,
        max: query.maxPrice ? parseInt(query.maxPrice) : 100000000,
      });
    }
  });

  return preferences;
};

// Helper function to build recommendation query
const buildRecommendationQuery = (preferences) => {
  const query = {};

  if (preferences.cities.length > 0) {
    query["location.city"] = { $in: preferences.cities };
  }

  if (preferences.propertyTypes.length > 0) {
    query.propertyType = { $in: preferences.propertyTypes };
  }

  if (preferences.bedrooms.length > 0) {
    query.bedrooms = { $in: preferences.bedrooms };
  }

  if (preferences.priceRanges.length > 0) {
    const minPrice = Math.min(...preferences.priceRanges.map((r) => r.min));
    const maxPrice = Math.max(...preferences.priceRanges.map((r) => r.max));
    query.price = { $gte: minPrice * 0.8, $lte: maxPrice * 1.2 };
  }

  return query;
};
