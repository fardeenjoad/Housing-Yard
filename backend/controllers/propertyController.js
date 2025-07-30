import { Property, PROPERTY_STATUS } from "../models/Property.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { buildPagination, buildSort } from "../utils/pagination.js";
import { ApiFeatures } from "../utils/apiFeatures.js";

const ensureOwnerOrAdmin = (property, user) => {
  if (user.role === "admin") return true;
  return property.createdBy.toString() === user._id.toString();
};

/**
 * POST /api/properties
 * User can post property (auto role upgrade to agent)
 */
export const createProperty = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    price,
    location,
    bedrooms,
    bathrooms,
    areaSqft,
    amenities,
    images,
    status,
  } = req.body;

  // 1. Create property
  const property = await Property.create({
    title,
    description,
    price,
    location,
    bedrooms,
    bathrooms,
    areaSqft,
    amenities,
    images,
    status: status && PROPERTY_STATUS.includes(status) ? status : "pending",
    createdBy: req.user._id,
  });

  // 2. If user is normal, upgrade to agent
  let newRole = null;
  if (req.user.role === "user") {
    newRole = "agent";
    await User.findByIdAndUpdate(req.user._id, { role: newRole });
  }

  return res.status(201).json({
    message: "Property created successfully",
    property,
    ...(newRole && { roleUpdatedTo: newRole }),
  });
});

// @desc    Get all properties (admin only)
// @route   GET /api/v1/properties
// @access  Private/Admin
export const getAllProperties = async (req, res, next) => {
  try {
    let baseQuery = Property.find();

    const features = new ApiFeatures(baseQuery, req.query)
      .search("location.city")
      .filter()
      .sort()
      .paginate();

      console.log("Final query filter =>", features.query.getFilter());
      
    // Clone after ALL chaining for consistent result
    const properties = await features.query.clone();

    // Clone again for total count after all filters only (not pagination)
    const totalQuery = new ApiFeatures(Property.find(), req.query)
      .search("title")
      .filter();
    const total = await totalQuery.query.countDocuments();

    res.status(200).json({
      success: true,
      total, // after filters
      count: properties.length, // items on current page
      page: features.page,
      limit: features.limit,
      data: properties,
    });
  } catch (error) {
    next(error);
  }
};

// LIST PUBLIC PROPERTIES — For Users (Only active ones)
export const listPublicProperties = asyncHandler(async (req, res) => {
  const total = await Property.countDocuments({ status: "active" });

  const features = new ApiFeatures(
    Property.find({ status: "active" }),
    req.query
  )
    .search("title")
    .filter()
    .sort()
    .paginate();

  const properties = await features.query.lean();

  res.status(200).json({
    success: true,
    total,
    count: properties.length,
    page: features.page,
    limit: features.limit,
    data: properties,
  });
});

/**
 * GET /api/properties/:id
 * Public: get property by id (but must be active or admin/owner)
 */
export const getPropertyById = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id).populate(
    "createdBy",
    "name role"
  );
  if (!property) return res.status(404).json({ message: "Property not found" });

  if (property.status !== "active") {
    // If property is not active, only admin/owner can view
    if (!req.user) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this property" });
    }

    if (!ensureOwnerOrAdmin(property, req.user)) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this property" });
    }
  }

  return res.status(200).json(property);
});

/**
 * GET /api/properties/me
 * Agent/Admin: list my properties (with all statuses)
 */
export const myProperties = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req);
  const sort = buildSort(req);

  // admin -> can see all, agent -> only his
  const filter = req.user.role === "admin" ? {} : { createdBy: req.user._id };

  const [items, total] = await Promise.all([
    Property.find(filter).sort(sort).skip(skip).limit(limit),
    Property.countDocuments(filter),
  ]);

  return res.status(200).json({
    page,
    limit,
    total,
    items,
  });
});

/**
 * PUT /api/properties/:id
 * Agent (own) / Admin: update property
 */
export const updateProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  const updatable = [
    "title",
    "description",
    "price",
    "location",
    "bedrooms",
    "bathrooms",
    "areaSqft",
    "amenities",
    "images",
    "status", // NOTE: agent shouldn't be able to set random statuses; we’ll sanitize below
  ];

  for (const field of updatable) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
      property[field] = req.body[field];
    }
  }

  // Agent cannot set to active/sold/rejected directly (business rule – optional)
  if (req.user.role !== "admin") {
    const forbiddenStatuses = ["active", "rejected", "sold", "archived"];
    if (forbiddenStatuses.includes(property.status)) {
      return res
        .status(400)
        .json({ message: "Invalid status change by agent" });
    }
  }

  await property.save();

  return res.status(200).json({ message: "Property updated", property });
});

/**
 * DELETE /api/properties/:id
 * Soft delete => archived
 */
export const archiveProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  property.status = "archived";
  property.archivedAt = new Date();
  await property.save();

  return res.status(200).json({ message: "Property archived" });
});

/**
 * PATCH /api/properties/:id/hold
 * Agent/Admin can hold their own property
 */
export const holdProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  property.status = "hold";
  await property.save();

  return res.status(200).json({ message: "Property put on hold", property });
});

/**
 * PATCH /api/properties/:id/resume
 * Agent/Admin can resume -> active
 */
export const resumeProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  if (!ensureOwnerOrAdmin(property, req.user)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  property.status = "active";
  await property.save();

  return res.status(200).json({ message: "Property resumed", property });
});

/**
 * PATCH /api/properties/:id/status
 * Admin moderation: approve/reject/sold/active/etc.
 */
export const changeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  if (!PROPERTY_STATUS.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  property.status = status;
  if (["active", "rejected"].includes(status)) {
    property.approvedBy = req.user._id;
    property.approvedAt = new Date();
  }

  await property.save();

  return res.status(200).json({ message: "Status updated", property });
});
