// controllers/enhancedPropertyController.js
import { Property } from "../models/Property.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AdvancedApiFeatures } from "../utils/apiFeatures.js";

// Enhanced property view with analytics tracking
export const getPropertyByIdEnhanced = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { trackView = true } = req.query;

  const property = await Property.findById(id)
    .populate("createdBy", "name role phone email")
    .lean();

  if (!property) {
    return res.status(404).json({
      success: false,
      message: "Property not found",
    });
  }

  // Check if property is active or user has permission to view
  if (property.status !== "active") {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this property",
      });
    }

    const canView =
      req.user.role === "admin" ||
      property.createdBy._id.toString() === req.user._id.toString();

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this property",
      });
    }
  }

  // Track view count (only for active properties and if not owner)
  if (trackView === "true" && property.status === "active") {
    const isOwner =
      req.user && property.createdBy._id.toString() === req.user._id.toString();

    if (!isOwner) {
      await Property.findByIdAndUpdate(id, {
        $inc: { viewCount: 1 },
      });
      property.viewCount = (property.viewCount || 0) + 1;
    }
  }

  // Get similar properties
  const similarProperties = await Property.find({
    _id: { $ne: id },
    status: "active",
    "location.city": property.location.city,
    propertyType: property.propertyType,
    bedrooms: {
      $in: [property.bedrooms - 1, property.bedrooms, property.bedrooms + 1],
    },
  })
    .select("title price location bedrooms images")
    .limit(4)
    .lean();

  // Get nearby properties
  let nearbyProperties = [];
  if (property.location.coordinates) {
    const [lng, lat] = property.location.coordinates.coordinates;

    nearbyProperties = await Property.find({
      _id: { $ne: id },
      status: "active",
      "location.coordinates": {
        $geoWithin: {
          $centerSphere: [[lng, lat], 2 / 6378.1], // 2km radius
        },
      },
    })
      .select("title price location images")
      .limit(3)
      .lean();
  }

  return res.status(200).json({
    success: true,
    data: property,
    related: {
      similar: similarProperties,
      nearby: nearbyProperties,
    },
  });
});

// Get property analytics for owner/admin
export const getPropertyAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { timeframe = "30d" } = req.query;

  const property = await Property.findById(id);

  if (!property) {
    return res.status(404).json({
      success: false,
      message: "Property not found",
    });
  }

  // Check ownership
  const canView =
    req.user.role === "admin" ||
    property.createdBy.toString() === req.user._id.toString();

  if (!canView) {
    return res.status(403).json({
      success: false,
      message: "Not authorized",
    });
  }

  // Calculate date range
  const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get analytics data (you would implement proper analytics tracking)
  const analytics = {
    views: {
      total: property.viewCount || 0,
      period: Math.floor((property.viewCount || 0) * 0.3), // Mock recent views
    },
    inquiries: {
      total: property.inquiryCount || 0,
      period: Math.floor((property.inquiryCount || 0) * 0.4),
    },
    shares: {
      total: property.shareCount || 0,
      period: Math.floor((property.shareCount || 0) * 0.2),
    },
    favorites: {
      total: property.favoriteCount || 0,
      period: Math.floor((property.favoriteCount || 0) * 0.3),
    },
    searchAppearances: Math.floor(Math.random() * 100) + 50,
    avgTimeOnPage: "2:34",
    bounceRate: "45%",
  };

  res.json({
    success: true,
    property: {
      id: property._id,
      title: property.title,
      status: property.status,
    },
    timeframe,
    analytics,
  });
});

// Bulk operations for properties
export const bulkUpdateProperties = asyncHandler(async (req, res) => {
  const { propertyIds, operation, data } = req.body;

  if (!propertyIds || !Array.isArray(propertyIds) || !operation) {
    return res.status(400).json({
      success: false,
      message: "Property IDs and operation are required",
    });
  }

  // Check user permissions
  const isAdmin = req.user.role === "admin";

  let query = { _id: { $in: propertyIds } };

  // Non-admin users can only update their own properties
  if (!isAdmin) {
    query.createdBy = req.user._id;
  }

  let updateResult;

  switch (operation) {
    case "activate":
      updateResult = await Property.updateMany(query, {
        status: "active",
        ...(isAdmin && { approvedBy: req.user._id, approvedAt: new Date() }),
      });
      break;

    case "deactivate":
      updateResult = await Property.updateMany(query, { status: "hold" });
      break;

    case "archive":
      updateResult = await Property.updateMany(query, {
        status: "archived",
        archivedAt: new Date(),
      });
      break;

    case "feature":
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only admin can feature properties",
        });
      }
      updateResult = await Property.updateMany(query, {
        isFeatured: true,
        featuredAt: new Date(),
        featuredTill:
          data?.featuredTill || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      break;

    case "unfeature":
      updateResult = await Property.updateMany(query, {
        isFeatured: false,
        featuredTill: null,
      });
      break;

    default:
      return res.status(400).json({
        success: false,
        message: "Invalid operation",
      });
  }

  res.json({
    success: true,
    message: `${operation} completed successfully`,
    modified: updateResult.modifiedCount,
    matched: updateResult.matchedCount,
  });
});

// Property comparison endpoint
export const compareProperties = asyncHandler(async (req, res) => {
  const { ids } = req.query;

  if (!ids) {
    return res.status(400).json({
      success: false,
      message: "Property IDs are required",
    });
  }

  const propertyIds = ids.split(",").slice(0, 4); // Max 4 properties

  const properties = await Property.find({
    _id: { $in: propertyIds },
    status: "active",
  })
    .select(
      "title price location bedrooms bathrooms areaSqft amenities propertyType furnishing ageInYears images"
    )
    .lean();

  if (properties.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No properties found",
    });
  }

  // Calculate comparison metrics
  const comparison = {
    properties,
    metrics: {
      priceRange: {
        min: Math.min(...properties.map((p) => p.price)),
        max: Math.max(...properties.map((p) => p.price)),
      },
      areaRange: {
        min: Math.min(...properties.map((p) => p.areaSqft)),
        max: Math.max(...properties.map((p) => p.areaSqft)),
      },
      pricePerSqft: properties.map((p) => ({
        id: p._id,
        value: Math.round(p.price / p.areaSqft),
      })),
    },
  };

  res.json({
    success: true,
    data: comparison,
  });
});

// Helper function to get search statistics
const getSearchStats = async (queryParams) => {
  const pipeline = [{ $match: { status: "active" } }];

  // Add filters if any
  if (queryParams.city) {
    pipeline.push({
      $match: { "location.city": { $regex: queryParams.city, $options: "i" } },
    });
  }

  pipeline.push({
    $group: {
      _id: null,
      avgPrice: { $avg: "$price" },
      minPrice: { $min: "$price" },
      maxPrice: { $max: "$price" },
      avgArea: { $avg: "$areaSqft" },
      totalProperties: { $sum: 1 },
      propertyTypes: { $push: "$propertyType" },
      cities: { $push: "$location.city" },
    },
  });

  const result = await Property.aggregate(pipeline);

  if (result.length === 0) {
    return {
      avgPrice: 0,
      priceRange: { min: 0, max: 0 },
      avgArea: 0,
      totalProperties: 0,
    };
  }

  const stats = result[0];

  return {
    avgPrice: Math.round(stats.avgPrice),
    priceRange: {
      min: stats.minPrice,
      max: stats.maxPrice,
    },
    avgArea: Math.round(stats.avgArea),
    totalProperties: stats.totalProperties,
    topPropertyTypes: [...new Set(stats.propertyTypes)].slice(0, 3),
    topCities: [...new Set(stats.cities)].slice(0, 5),
  };
};
