import mongoose from "mongoose";

const STATUS = ["draft", "pending", "active", "hold", "sold", "rejected", "archived"];

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    location: {
      address: { type: String, required: true },
      city: String,
      state: String,
      country: String,
      pincode: String,
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, 
      },
    },
    bedrooms: Number,
    bathrooms: Number,
    areaSqft: Number,
    amenities: [String],
    images: [String], // URLs (Cloudinary/S3)
    status: {
      type: String,
      enum: STATUS,
      default: "pending",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    archivedAt: Date,
  },
  { timestamps: true }
);

propertySchema.index({ "location.coordinates": "2dsphere" });

export const PROPERTY_STATUS = STATUS;
export const Property = mongoose.model("Property", propertySchema);