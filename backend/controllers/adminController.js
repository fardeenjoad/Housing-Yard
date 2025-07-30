import { asyncHandler } from "../middlewares/asyncHandler.js";
import { User } from "../models/User.js";
import ErrorHandler from "../utils/ErrorHandler.js";

//@desc Get all users
//@route GET /api/admin/users
//@access Private
export const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;
  const totalUsers = await User.countDocuments();

  const users = await User.find()
    .skip(skip)
    .limit(limit)
    .select("-password")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
    hasNextPage: page * limit < totalUsers,
    hasPrevPage: page > 1,
    users,
  });
});

// @desc    Get single user by admin
// @route   GET /api/v1/admin/users/:id
// @access  Admin
export const getSingleUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    return next(new ErrorHandler("User not found with this ID", 404));
  }

  res.status(200).json({
    success: true,
    user,
  });
});

//@desc Update user role
//@route PATCH /api/admin/users/:id
//@access Private
export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) throw new Error("User not found");

  user.role = role;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Role Updated",
    user,
  });
});

//@desc Delete user
//@route DELETE /api/admin/users/:id
//@access Private
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) throw new Error("User not found");

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "User deleted",
  });
});
