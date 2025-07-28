const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Handle cast errors (invalid ObjectId)
  if (err.name === "CastError") {
    message = `Resource not found. Invalid: ${err.path}`;
    statusCode = 400;
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    message = `Duplicate ${Object.keys(err.keyValue)} entered`;
    statusCode = 400;
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    message = Object.values(err.errors).map(val => val.message).join(", ");
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default errorMiddleware;