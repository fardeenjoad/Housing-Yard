import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";

const app = express();
connectDB();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);
app.use(express.json());
app.use(helmet());
app.use(errorMiddleware)

// (optional) basic rate limit
app.use(
  "/api/auth",
  rateLimit({ windowMs: 5 * 60 * 1000, max: 100, standardHeaders: true })
);

app.use("/api/auth", authRoutes);
app.use("/api", propertyRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  return res
    .status(err.statusCode || 500)
    .json({ message: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
