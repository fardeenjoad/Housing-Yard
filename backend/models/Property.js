// models/Property.js (Enhanced version)
import mongoose from "mongoose";

const STATUS = [
  "draft",
  "pending",
  "approved",
  "active",
  "hold",
  "sold",
  "rejected",
  "archived",
];

const PROPERTY_TYPES = [
  "apartment",
  "villa", 
  "plot",
  "commercial",
  "pg",
  "office",
  "warehouse",
  "shop",
  "studio"
];

const FURNISHING_TYPES = [
  "fully-furnished",
  "semi-furnished", 
  "unfurnished"
];

const FACING_DIRECTIONS = [
  "north",
  "south", 
  "east",
  "west",
  "north-east",
  "north-west",
  "south-east",
  "south-west"
];

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true
    },
    location: {
      address: { type: String, required: true, trim: true },
      city: { type: String, trim: true, index: true },
      area: { type: String, required: true, trim: true, index: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: "India" },
      pincode: { type: String, trim: true },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
          required: true,
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
          validate: {
            validator: function (val) {
              return val.length === 2;
            },
            message: "Coordinates must have [longitude, latitude]",
          },
        },
      },
    },
    bedrooms: { 
      type: Number, 
      min: 0,
      index: true 
    },
    bathrooms: { 
      type: Number, 
      min: 0 
    },
    areaSqft: { 
      type: Number, 
      min: 0,
      index: true
    },
    
    // Enhanced Fields
    propertyType: {
      type: String,
      enum: PROPERTY_TYPES,
      default: 'apartment',
      index: true
    },
    furnishing: {
      type: String,
      enum: FURNISHING_TYPES,
      default: 'unfurnished'
    },
    parking: { 
      type: Number, 
      default: 0 
    },
    floors: {
      total: { type: Number },
      propertyOn: { type: Number }
    },
    ageInYears: { 
      type: Number, 
      default: 0 
    },
    facing: {
      type: String,
      enum: FACING_DIRECTIONS
    },
    
    amenities: [{ 
      type: String, 
      trim: true 
    }],
    
    // Location Intelligence
    nearbyMetro: [{
      station: { type: String, trim: true },
      line: { type: String, trim: true },
      distance: { type: Number } // in km
    }],
    nearbyLandmarks: [{
      name: { type: String, trim: true },
      type: { 
        type: String, 
        enum: ['hospital', 'school', 'mall', 'airport', 'railway', 'bus-stop', 'market', 'park', 'temple', 'other']
      },
      distance: { type: Number } // in km
    }],
    
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String },
        public_id: { type: String }, // for Cloudinary
        isMain: { type: Boolean, default: false }
      },
    ],
    
    status: {
      type: String,
      enum: STATUS,
      default: "pending",
      index: true,
    },
    
    // Engagement Metrics
    viewCount: { 
      type: Number, 
      default: 0,
      index: true
    },
    inquiryCount: { 
      type: Number, 
      default: 0 
    },
    shareCount: { 
      type: Number, 
      default: 0 
    },
    favoriteCount: {
      type: Number,
      default: 0
    },
    
    // Featured Properties
    isFeatured: { 
      type: Boolean, 
      default: false,
      index: true
    },
    featuredAt: { 
      type: Date 
    },
    featuredTill: {
      type: Date
    },
    
    // Additional Property Details
    balconies: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    
    // Price Details
    pricePerSqft: { type: Number },
    maintenanceCharges: { type: Number },
    securityDeposit: { type: Number },
    
    // Availability
    availableFrom: { type: Date },
    isNegotiable: { type: Boolean, default: true },
    
    // Contact Information
    contact: {
      phone: {
        type: String,
        required: true,
        match: [/^[0-9]{10,14}$/, "Phone number must be valid"],
      },
      email: {
        type: String,
        trim: true,
        lowercase: true
      },
      whatsapp: {
        type: String,
        match: [/^[0-9]{10,14}$/, "Whatsapp number must be valid"],
      },
    },
    
    // User Relations
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    archivedAt: Date,
    
    // SEO and Meta
    slug: {
      type: String,
      unique: true,
      sparse: true
    },
    metaTitle: String,
    metaDescription: String,
    
    // Internal flags
    isActive: { type: Boolean, default: false },
    priority: { type: Number, default: 0 }, // for sorting featured properties
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for property URL
propertySchema.virtual('url').get(function() {
  return `/property/${this.slug || this._id}`;
});

// Virtual for price per sqft calculation
propertySchema.virtual('calculatedPricePerSqft').get(function() {
  if (this.price && this.areaSqft) {
    return Math.round(this.price / this.areaSqft);
  }
  return 0;
});

// Indexes for performance
propertySchema.index({ "location.coordinates": "2dsphere" });
propertySchema.index({ 
  title: "text", 
  description: "text",
  "location.address": "text",
  "location.city": "text",
  "location.area": "text",
  "location.state": "text" 
});

// Compound indexes for common queries
propertySchema.index({ status: 1, createdAt: -1 });
propertySchema.index({ "location.city": 1, price: 1 });
propertySchema.index({ propertyType: 1, bedrooms: 1 });
propertySchema.index({ price: 1, areaSqft: 1 });
propertySchema.index({ isFeatured: 1, featuredAt: -1 });
propertySchema.index({ viewCount: -1, createdAt: -1 });

// Middleware to generate slug before saving
propertySchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Math.random().toString(36).substr(2, 6);
  }
  
  // Calculate price per sqft if not provided
  if (this.price && this.areaSqft && !this.pricePerSqft) {
    this.pricePerSqft = Math.round(this.price / this.areaSqft);
  }
  
  next();
});

// Static method to get popular searches
propertySchema.statics.getPopularSearches = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    { $group: { 
      _id: '$location.city', 
      count: { $sum: 1 },
      avgPrice: { $avg: '$price' }
    }},
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
};

// Method to increment view count
propertySchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

export const PROPERTY_STATUS = STATUS;
export const Property = mongoose.model("Property", propertySchema);