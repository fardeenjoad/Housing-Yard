import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

/**
 * Protect Middleware - Verify JWT token and attach user to request
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Not authorized, user not found" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

/**
 * Role-based access check
 */
export const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Role not allowed" });
    }
    next();
  };
};

/**
 * Permission-based access (optional for fine-grained control)
 */
const rolePermissions = {
  admin: [
    "property:create",
    "property:update",
    "property:delete",
    "property:hold",
  ],
  agent: ["property:create", "property:update", "property:hold"],
  user: ["property:create"], // user can only create property (auto becomes agent)
};

export const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const permissions = rolePermissions[req.user.role] || [];
    if (!permissions.includes(permission)) {
      return res.status(403).json({ message: "Forbidden: No permission" });
    }
    next();
  };
};
