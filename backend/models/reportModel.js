import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reportedProperty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
    },
    response: {
      type: String,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_review", "resolved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Report = mongoose.model("Report", reportSchema);
