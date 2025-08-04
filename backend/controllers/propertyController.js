import { Property, PROPERTY_STATUS } from "../models/Property.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AdvancedApiFeatures } from "../utils/apiFeatures.js";


// Environment-based debugging
const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugMode = process.env.ENABLE_DEBUG === 'true' || isDevelopment;

// Helper function for conditional logging
const debugLog = (...args) => {
  if (isDebugMode) {
    console.log(...args);
  }
};

// Helper Functions
const ensureOwnerOrAdmin = (property, user) => {
  if (user.role === "admin") return true;
  return property.createdBy.toString() === user._id.toString();
};

const buildPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildSort = (req) => {
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  return { [sortBy]: sortOrder };
};

const validateCoordinates = (lat, lng) => {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  
  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return { isValid: false, error: "Invalid latitude or longitude format" };
  }
  
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return { isValid: false, error: "Coordinates out of valid range" };
  }
  
  return { isValid: true, lat: parsedLat, lng: parsedLng };
};

const sanitizePropertyData = (data, userRole) => {
  const allowedFields = [
    'title', 'description', 'price', 'location', 'bedrooms', 'bathrooms', 
    'areaSqft', 'propertyType', 'furnishing', 'parking', 'floors', 'ageInYears',
    'facing', 'amenities', 'nearbyMetro', 'nearbyLandmarks', 'images', 
    'balconies', 'pricePerSqft', 'maintenanceCharges', 'securityDeposit',
    'availableFrom', 'isNegotiable', 'contact'
  ];
  
  // Admin can update additional fields
  if (userRole === 'admin') {
    allowedFields.push('status', 'isFeatured', 'featuredAt', 'featuredTill', 'isVerified', 'priority');
  }
  
  const sanitized = {};
  allowedFields.forEach(field => {
    if (data.hasOwnProperty(field)) {
      sanitized[field] = data[field];
    }
  });
  
  return sanitized;
};

/**
 * @desc    Create new property
 * @route   POST /api/properties
 * @access  Private (User/Agent/Admin)
 */
export const createProperty = asyncHandler(async (req, res) => {
  const {
    title, description, price, location = {}, bedrooms, bathrooms, areaSqft,
    propertyType, furnishing, parking, floors, ageInYears, facing,
    amenities = [], nearbyMetro = [], nearbyLandmarks = [], images = [],
    balconies, pricePerSqft, maintenanceCharges, securityDeposit,
    availableFrom, isNegotiable, contact = {}, lat, lng
  } = req.body;

  // Enhanced validation
  const requiredFields = [
    { field: title, name: 'title' },
    { field: description, name: 'description' },
    { field: price, name: 'price' },
    { field: bedrooms, name: 'bedrooms' },
    { field: bathrooms, name: 'bathrooms' },
    { field: areaSqft, name: 'areaSqft' }
  ];

  const missingFields = requiredFields
    .filter(({ field }) => field === undefined || field === null || field === '')
    .map(({ name }) => name);

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`,
      fields: missingFields
    });
  }

  // Location validation
  const locationFields = ['city', 'state', 'address', 'area'];
  const missingLocationFields = locationFields.filter(field => !location[field]);

  if (missingLocationFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing location fields: ${missingLocationFields.join(', ')}`,
      fields: missingLocationFields
    });
  }

  // Contact validation
  if (!contact.phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required"
    });
  }

  // Coordinates validation
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({
      success: false,
      message: "Latitude and longitude are required"
    });
  }

  const coordValidation = validateCoordinates(lat, lng);
  if (!coordValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: coordValidation.error
    });
  }

  // Business validation
  if (price <= 0 || areaSqft <= 0) {
    return res.status(400).json({
      success: false,
      message: "Price and area must be positive numbers"
    });
  }

  if (bedrooms < 0 || bathrooms < 0) {
    return res.status(400).json({
      success: false,
      message: "Bedrooms and bathrooms cannot be negative"
    });
  }

  // Construct enhanced property data
  const propertyData = {
    title: title.trim(),
    description: description.trim(),
    price: Number(price),
    bedrooms: Number(bedrooms),
    bathrooms: Number(bathrooms),
    areaSqft: Number(areaSqft),
    propertyType: propertyType || 'apartment',
    furnishing: furnishing || 'unfurnished',
    amenities: Array.isArray(amenities) ? amenities.map(a => a.trim()) : [],
    images: Array.isArray(images) ? images : [],
    location: {
      ...location,
      coordinates: {
        type: "Point",
        coordinates: [coordValidation.lng, coordValidation.lat]
      }
    },
    contact: {
      phone: contact.phone.trim(),
      email: contact.email?.trim() || "",
      whatsapp: contact.whatsapp?.trim() || contact.phone.trim()
    },
    createdBy: req.user._id
  };

  // Add optional fields if provided
  if (parking !== undefined) propertyData.parking = Number(parking);
  if (floors) propertyData.floors = floors;
  if (ageInYears !== undefined) propertyData.ageInYears = Number(ageInYears);
  if (facing) propertyData.facing = facing;
  if (balconies !== undefined) propertyData.balconies = Number(balconies);
  if (pricePerSqft) propertyData.pricePerSqft = Number(pricePerSqft);
  if (maintenanceCharges) propertyData.maintenanceCharges = Number(maintenanceCharges);
  if (securityDeposit) propertyData.securityDeposit = Number(securityDeposit);
  if (availableFrom) propertyData.availableFrom = new Date(availableFrom);
  if (isNegotiable !== undefined) propertyData.isNegotiable = Boolean(isNegotiable);
  if (nearbyMetro.length > 0) propertyData.nearbyMetro = nearbyMetro;
  if (nearbyLandmarks.length > 0) propertyData.nearbyLandmarks = nearbyLandmarks;

  // Create property
  const property = await Property.create(propertyData);

  // Auto-upgrade user role if needed
  let roleUpdate = null;
  if (req.user.role === "user") {
    await User.findByIdAndUpdate(req.user._id, { role: "agent" });
    roleUpdate = "agent";
  }

  // Populate created property
  await property.populate('createdBy', 'name email role');

  res.status(201).json({
    success: true,
    message: "Property created successfully",
    data: property,
    ...(roleUpdate && { roleUpdatedTo: roleUpdate })
  });
});


/**
 * @desc    Get all properties (admin only)
 * @route   GET /api/properties
 * @access  Private/Admin
 */
export const getAllProperties = asyncHandler(async (req, res) => {
  // Admin authorization check should be in middleware
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }

  const features = new AdvancedApiFeatures(Property.find(), req.query)
    .applyFilters();

  const properties = await features.query
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name role')
    .lean();

  // Get total count with same filters (without pagination)
  const countFeatures = new AdvancedApiFeatures(Property.find(), req.query)
    .locationSearch()
    .priceFilter()
    .propertyFilters()
    .geoSearch();
  
  const total = await Property.countDocuments(countFeatures.query.getQuery());

  res.status(200).json({
    success: true,
    total,
    count: properties.length,
    page: features.page,
    limit: features.limit,
    data: properties
  });
});

/**
 * @desc    List public properties (active only) - DEBUGGED VERSION
 * @route   GET /api/properties/public
 * @access  Public
 */
// Enhanced public property listing
export const listPublicProperties = asyncHandler(async (req, res) => {
  debugLog('=== PROPERTY SEARCH DEBUG ===');
  debugLog('Query params:', req.query);
  
  const baseQuery = { status: "active" };
  
  // Database statistics (only in debug mode)
  let debugInfo = {};
  if (isDebugMode) {
    const totalInDB = await Property.countDocuments({});
    const activeInDB = await Property.countDocuments(baseQuery);
    
    debugLog(` DB Stats: ${totalInDB} total, ${activeInDB} active`);
    
    // Sample properties for debugging
    const sampleProperties = await Property.find(baseQuery)
      .select('title location.city location.area propertyType price bedrooms')
      .limit(3)
      .lean();
    
    debugLog(' Sample active properties:');
    sampleProperties.forEach((prop, idx) => {
      debugLog(`  ${idx + 1}. ${prop.title || 'No Title'}`);
      debugLog(`     City: ${prop.location?.city}, Area: ${prop.location?.area}`);
      debugLog(`     Type: ${prop.propertyType}, Bedrooms: ${prop.bedrooms}`);
    });

    debugInfo = {
      totalInDB,
      activeInDB,
      sampleProperties: sampleProperties.map(p => ({
        title: p.title,
        city: p.location?.city,
        area: p.location?.area,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms
      }))
    };
  }

  // Apply advanced search with optimized error handling
  let properties = [];
  let total = 0;
  let queryExecutionTime = 0;
  
  const startTime = Date.now();
  
  try {
    const features = new AdvancedApiFeatures(Property.find(baseQuery), req.query);
    features.applyFilters();
    
    debugLog(` Query type: ${features.isAggregated ? 'Aggregation' : 'Find'}`);
    
    if (features.isAggregated) {
      // Execute aggregation
      properties = await features.getQuery();
      
      // Optimized count for aggregation
      const countPipeline = features.pipeline().filter(stage => 
        !stage.$skip && !stage.$limit
      );
      countPipeline.push({ $count: "total" });
      
      const countResult = await Property.aggregate(countPipeline);
      total = countResult.length > 0 ? countResult[0].total : 0;
      
    } else {
      // Execute find query with population
      properties = await features.query
        .populate('createdBy', 'name role')
        .select('-contact.phone -contact.email -contact.whatsapp')
        .lean();
      
      // Efficient counting
      const countQuery = Property.find(baseQuery);
      const queryConditions = features.query.getQuery();
      
      Object.keys(queryConditions).forEach(key => {
        if (key !== 'status') {
          countQuery.find({ [key]: queryConditions[key] });
        }
      });
      
      total = await countQuery.countDocuments();
    }
    
    queryExecutionTime = Date.now() - startTime;
    debugLog(` Query executed in ${queryExecutionTime}ms`);
    
  } catch (error) {
    console.error(' Query execution error:', error);
    
    // Graceful fallback to simple query
    debugLog(' Falling back to simple query...');
    
    const { city, area, propertyType, bedrooms, minPrice, maxPrice } = req.query;
    let fallbackQuery = { ...baseQuery };
    
    if (city) fallbackQuery["location.city"] = { $regex: city, $options: "i" };
    if (area) fallbackQuery["location.area"] = { $regex: area, $options: "i" };
    if (propertyType) fallbackQuery.propertyType = propertyType;
    if (bedrooms) fallbackQuery.bedrooms = parseInt(bedrooms);
    if (minPrice) fallbackQuery.price = { ...fallbackQuery.price, $gte: parseInt(minPrice) };
    if (maxPrice) fallbackQuery.price = { ...fallbackQuery.price, $lte: parseInt(maxPrice) };
    
    const skip = ((parseInt(req.query.page) || 1) - 1) * (parseInt(req.query.limit) || 20);
    const limit = parseInt(req.query.limit) || 20;
    
    [properties, total] = await Promise.all([
      Property.find(fallbackQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name role')
        .select('-contact.phone -contact.email -contact.whatsapp')
        .lean(),
      Property.countDocuments(fallbackQuery)
    ]);
    
    queryExecutionTime = Date.now() - startTime;
    debugLog(` Fallback query executed in ${queryExecutionTime}ms`);
  }
  
  debugLog(` Final Results: ${properties.length} properties, total: ${total}`);
  
  // Get search statistics (cached for performance)
  const stats = await Property.aggregate([
    { $match: baseQuery },
    {
      $group: {
        _id: null,
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        avgPricePerSqft: { $avg: '$pricePerSqft' },
        avgArea: { $avg: '$areaSqft' },
        totalProperties: { $sum: 1 }
      }
    }
  ]);
  
  // Clean response object
  const response = {
    success: true,
    total,
    count: properties.length,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    stats: stats[0] || {
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPricePerSqft: null,
      avgArea: 0,
      totalProperties: 0
    },
    data: properties
  };
  
  // Add debug info only in development
  if (isDebugMode) {
    response.debug = {
      ...debugInfo,
      queryParams: req.query,
      executionTime: queryExecutionTime
    };
  }
  
  res.status(200).json(response);
});

// ADMIN/DEBUG ONLY - Property analysis endpoint
export const getPropertyAnalysis = asyncHandler(async (req, res) => {
  // Security check - only allow in development or for admin users
  if (!isDevelopment && (!req.user || req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This endpoint is for development/admin use only.'
    });
  }
  
  const analysis = await Property.aggregate([
    {
      $facet: {
        // Status breakdown
        statusBreakdown: [
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              avgPrice: { $avg: "$price" },
              properties: { 
                $push: {
                  _id: "$_id",
                  title: "$title",
                  city: "$location.city",
                  area: "$location.area",
                  propertyType: "$propertyType",
                  bedrooms: "$bedrooms",
                  price: "$price"
                }
              }
            }
          },
          { $sort: { count: -1 } }
        ],
        
        // Active properties breakdown
        activeBreakdown: [
          { $match: { status: "active" } },
          {
            $group: {
              _id: null,
              totalActive: { $sum: 1 },
              cities: { $addToSet: "$location.city" },
              areas: { $addToSet: "$location.area" },
              propertyTypes: { $addToSet: "$propertyType" },
              bedroomCounts: { $addToSet: "$bedrooms" },
              minPrice: { $min: "$price" },
              maxPrice: { $max: "$price" },
              avgPrice: { $avg: "$price" }
            }
          }
        ],
        
        // Filter options
        filterOptions: [
          { $match: { status: "active" } },
          {
            $group: {
              _id: null,
              cities: { $addToSet: "$location.city" },
              propertyTypes: { $addToSet: "$propertyType" },
              bedroomOptions: { $addToSet: "$bedrooms" }
            }
          }
        ]
      }
    }
  ]);
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    analysis: analysis[0] || {}
  });
});

// Simple property listing without advanced features (fallback)
export const getSimpleProperties = asyncHandler(async (req, res) => {
  // Only allow in development
  if (!isDevelopment) {
    return res.status(404).json({
      success: false,
      message: 'Endpoint not found'
    });
  }
  
  const { 
    city, 
    propertyType, 
    bedrooms, 
    minPrice, 
    maxPrice,
    page = 1, 
    limit = 20 
  } = req.query;
  
  // Build simple query
  const query = { status: "active" };
  
  if (city) query["location.city"] = { $regex: city, $options: "i" };
  if (propertyType) query.propertyType = propertyType;
  if (bedrooms) query.bedrooms = parseInt(bedrooms);
  
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseInt(minPrice);
    if (maxPrice) query.price.$lte = parseInt(maxPrice);
  }
  
  console.log('Simple query:', query);
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [properties, total] = await Promise.all([
    Property.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name role')
      .select('-contact.phone -contact.email -contact.whatsapp')
      .lean(),
    Property.countDocuments(query)
  ]);
  
  res.json({
    success: true,
    total,
    count: properties.length,
    page: parseInt(page),
    limit: parseInt(limit),
    data: properties,
    query // for debugging
  });
});

/**
 * @desc    Get nearby properties
 * @route   GET /api/properties/nearby
 * @access  Public
 */
export const getNearbyProperties = asyncHandler(async (req, res) => {
  const { lat, lng, distance = 5, unit = "km" } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      message: "Latitude and longitude are required"
    });
  }

  const coordValidation = validateCoordinates(lat, lng);
  if (!coordValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: coordValidation.error
    });
  }

  const maxDistance = Math.min(Number(distance), 50); // Max 50km
  const earthRadius = unit === "mi" ? 3963.2 : 6378.1;
  const radiusInRadians = maxDistance / earthRadius;

  const { page, limit, skip } = buildPagination(req);

  const geoQuery = {
    "location.coordinates": {
      $geoWithin: {
        $centerSphere: [[coordValidation.lng, coordValidation.lat], radiusInRadians]
      }
    },
    status: "active"
  };

  const [properties, totalResults] = await Promise.all([
    Property.find(geoQuery)
      .skip(skip)
      .limit(limit)
      .select('title price location images propertyType bedrooms bathrooms areaSqft pricePerSqft isFeatured')
      .populate('createdBy', 'name role')
      .lean(),
    Property.countDocuments(geoQuery)
  ]);

  // Calculate distances for each property
  const propertiesWithDistance = properties.map(property => {
    const [propLng, propLat] = property.location.coordinates.coordinates;
    const distance = calculateDistance(
      coordValidation.lat, coordValidation.lng, 
      propLat, propLng, unit
    );
    return { ...property, distance: Math.round(distance * 100) / 100 };
  });

  res.status(200).json({
    success: true,
    count: properties.length,
    totalNearby: totalResults,
    currentPage: page,
    totalPages: Math.ceil(totalResults / limit),
    searchRadius: `${maxDistance} ${unit}`,
    data: propertiesWithDistance
  });
});

/**
 * @desc    Get property by ID
 * @route   GET /api/properties/:id
 * @access  Public/Private
 */
export const getPropertyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid property ID format'
    });
  }

  const property = await Property.findById(id)
    .populate('createdBy', 'name role phone email')
    .populate('approvedBy', 'name role')
    .lean();

  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found'
    });
  }

  // Check view permissions
  if (property.status !== "active") {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'Property not available for public viewing'
      });
    }

    if (!ensureOwnerOrAdmin(property, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this property'
      });
    }
  }

  // Increment view count for active properties (non-owners)
  if (property.status === 'active') {
    const isOwner = req.user && property.createdBy._id.toString() === req.user._id.toString();
    if (!isOwner) {
      // Use findByIdAndUpdate to avoid race conditions
      await Property.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
      property.viewCount = (property.viewCount || 0) + 1;
    }
  }

  // Get similar properties
  const similarProperties = await Property.find({
    _id: { $ne: id },
    status: 'active',
    'location.city': property.location.city,
    propertyType: property.propertyType,
    bedrooms: { $in: [property.bedrooms - 1, property.bedrooms, property.bedrooms + 1] }
  })
  .select('title price location bedrooms bathrooms images pricePerSqft')
  .limit(4)
  .lean();

  res.status(200).json({
    success: true,
    data: property,
    similar: similarProperties
  });
});

/**
 * @desc    Get user's properties
 * @route   GET /api/properties/me
 * @access  Private
 */
export const myProperties = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const sort = buildSort(req);

  // Build filter based on user role
  const filter = req.user.role === "admin" ? {} : { createdBy: req.user._id };

  // Add status filter if provided
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [properties, total] = await Promise.all([
    Property.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name role')
      .populate('approvedBy', 'name role')
      .lean(),
    Property.countDocuments(filter)
  ]);

  // Get status summary
  const statusSummary = await Property.aggregate([
    { $match: req.user.role === "admin" ? {} : { createdBy: req.user._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    page,
    limit,
    total,
    statusSummary,
    data: properties
  });
});

/**
 * @desc    Update property
 * @route   PUT /api/properties/:id
 * @access  Private
 */
export const updateProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const property = await Property.findById(id);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found'
    });
  }

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this property'
    });
  }

  // Sanitize update data based on user role
  const updateData = sanitizePropertyData(req.body, req.user.role);

  // Handle coordinate updates
  if (req.body.lat !== undefined && req.body.lng !== undefined) {
    const coordValidation = validateCoordinates(req.body.lat, req.body.lng);
    if (!coordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: coordValidation.error
      });
    }
    
    updateData.location = {
      ...updateData.location,
      coordinates: {
        type: "Point",
        coordinates: [coordValidation.lng, coordValidation.lat]
      }
    };
  }

  // Business rules for status changes
  if (updateData.status && req.user.role !== "admin") {
    const forbiddenStatuses = ["active", "approved", "rejected", "sold"];
    if (forbiddenStatuses.includes(updateData.status)) {
      return res.status(400).json({
        success: false,
        message: `Only admin can set status to '${updateData.status}'`
      });
    }
  }

  // Update property
  const updatedProperty = await Property.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).populate('createdBy', 'name role');

  res.status(200).json({
    success: true,
    message: 'Property updated successfully',
    data: updatedProperty
  });
});

/**
 * @desc    Archive property (soft delete)
 * @route   DELETE /api/properties/:id
 * @access  Private
 */
export const archiveProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const property = await Property.findById(id);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found'
    });
  }

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to archive this property'
    });
  }

  if (property.status === 'archived') {
    return res.status(400).json({
      success: false,
      message: 'Property is already archived'
    });
  }

  await Property.findByIdAndUpdate(id, {
    status: "archived",
    archivedAt: new Date()
  });

  res.status(200).json({
    success: true,
    message: 'Property archived successfully'
  });
});

/**
 * @desc    Hold property
 * @route   PATCH /api/properties/:id/hold
 * @access  Private
 */
export const holdProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const property = await Property.findById(id);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found'
    });
  }

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized'
    });
  }

  if (property.status === 'hold') {
    return res.status(400).json({
      success: false,
      message: 'Property is already on hold'
    });
  }

  property.status = "hold";
  await property.save();

  res.status(200).json({
    success: true,
    message: 'Property put on hold successfully',
    data: property
  });
});

/**
 * @desc    Resume property (activate)
 * @route   PATCH /api/properties/:id/resume
 * @access  Private
 */
export const resumeProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const property = await Property.findById(id);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found'
    });
  }

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized'
    });
  }

  if (property.status === 'active') {
    return res.status(400).json({
      success: false,
      message: 'Property is already active'
    });
  }

  property.status = "active";
  await property.save();

  res.status(200).json({
    success: true,
    message: 'Property resumed successfully',
    data: property
  });
});

/**
 * @desc    Change property status (admin only)
 * @route   PATCH /api/properties/:id/status
 * @access  Private/Admin
 */
export const changeStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admin can change property status'
    });
  }

  const property = await Property.findById(id);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found'
    });
  }

  if (!PROPERTY_STATUS.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value',
      validStatuses: PROPERTY_STATUS
    });
  }

  const updateData = { status };

  // Set approval data for certain statuses
  if (["active", "approved", "rejected"].includes(status)) {
    updateData.approvedBy = req.user._id;
    updateData.approvedAt = new Date();
  }

  // Set archive date for archived status
  if (status === 'archived') {
    updateData.archivedAt = new Date();
  }

  await Property.findByIdAndUpdate(id, updateData);

  res.status(200).json({
    success: true,
    message: `Property status changed to '${status}' successfully`,
    reason: reason || null
  });
});

// Helper function to calculate distance between two points
const calculateDistance = (lat1, lng1, lat2, lng2, unit = 'km') => {
  const R = unit === 'mi' ? 3959 : 6371; // Earth's radius in miles or km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value) => {
  return value * Math.PI / 180;
};