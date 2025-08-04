import { Report } from "../models/reportModel.js";
import { Property } from "../models/Property.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { User } from "../models/User.js";

// @desc    Create a report (user complaint)

export const createReport = asyncHandler(async (req, res) => {
  const { reportedUser, reportedProperty, reason } = req.body;

  if (!reason || (!reportedUser && !reportedProperty)) {
    return res.status(400).json({ message: "Invalid report details." });
  }

  // Check if reported user exists
  if (reportedUser) {
    const userExists = await User.findById(reportedUser);
    if (!userExists) {
      return res.status(404).json({ message: "Reported user not found." });
    }
  }

  // Check if reported property exists
  if (reportedProperty) {
    const propertyExists = await Property.findById(reportedProperty);
    if (!propertyExists) {
      return res.status(404).json({ message: "Reported property not found." });
    }
  }

  // Prevent duplicate report by same user
  const alreadyReported = await Report.findOne({
    reportedBy: req.user._id,
    reportedUser,
    reportedProperty,
    reason,
  });

  if (alreadyReported) {
    return res.status(400).json({ message: "You have already reported this." });
  }

  // Create report
  const report = await Report.create({
    reportedBy: req.user._id,
    reportedUser,
    reportedProperty,
    reason,
  });

  res.status(201).json({ message: "Report submitted successfully", report });
});

// @desc    Get all reports (ADMIN) with optional filters

export const getAllReports = asyncHandler(async (req, res) => {
  const { status, userId, propertyId } = req.query;

  const query = {};
  if (status) query.status = status;
  if (userId) query.reportedUser = userId;
  if (propertyId) query.reportedProperty = propertyId;

  const reports = await Report.find(query)
    .populate("reportedBy", "name email")
    .populate("reportedUser", "name email")
    .populate("reportedProperty", "title");

  res.status(200).json({ reports });
});

// @desc    Get logged-in user's own reports

export const getMyReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ reportedBy: req.user._id })
    .populate("reportedUser", "name email")
    .populate("reportedProperty", "title");

  res.status(200).json({ reports });
});

// @desc    Admin update a report's status

export const updateReportStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body;

  const report = await Report.findById(id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  report.status = status || report.status;
  report.adminNote = adminNote || report.adminNote;

  await report.save();

  res.status(200).json({ message: "Report updated", report });
});
