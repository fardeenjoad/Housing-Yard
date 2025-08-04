// models/SavedSearch.js
import mongoose from "mongoose";

const savedSearchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    searchQuery: {
      type: Object,
      required: true
    },
    alertFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'never'],
      default: 'weekly'
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastAlertSent: {
      type: Date
    },
    resultCount: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  { 
    timestamps: true 
  }
);

// Index for efficient queries
savedSearchSchema.index({ userId: 1, isActive: 1 });
savedSearchSchema.index({ alertFrequency: 1, isActive: 1 });

export const SavedSearch = mongoose.model('SavedSearch', savedSearchSchema);