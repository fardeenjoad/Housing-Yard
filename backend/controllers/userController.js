import { asyncHandler } from "../middlewares/asyncHandler.js";
import { User } from "../models/User.js";

//@desc Get Logged-in user's profile
//@route GET /api/users/profile
//@access Private
export const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.status(200).json({
    success: true,
    user,
  });
});

//@desc  Update logged-in user's profile
//@route PATCH /api/users/profile
//@access Private

export const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { name, email, password } = req.body;
  if (email) user.email = email;
  if (name) user.name = name;
  if (password) user.password = password;

  const updateUser = await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user: {
      _id: updateUser._id,
      name: updateUser.name,
      email: updateUser.email,
    },
  });
});
