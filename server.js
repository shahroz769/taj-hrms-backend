import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRouter from "./routes/authRoutes.js";
import departmentRouter from "./routes/departmentRoutes.js";
import positionRouter from "./routes/positionRoutes.js";
import shiftRouter from "./routes/shiftRoutes.js";
import leaveTypeRouter from "./routes/leaveTypeRoutes.js";
import leavePolicyRouter from "./routes/leavePolicyRoutes.js";
import salaryComponentRouter from "./routes/salaryComponentRoutes.js";
import salaryPolicyRouter from "./routes/salaryPolicyRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import connectDB from "./config/db.js";
import chalk from "chalk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// CORS Config
const allowedOrigins = [
  "http://localhost:5173",
  "https://taj-hrms-frontend.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.get("/", (req, res) => {
  res.send(`Server is running on port ${PORT}`);
});

app.use("/api/auth", authRouter);
app.use("/api/departments", departmentRouter);
app.use("/api/positions", positionRouter);
app.use("/api/shifts", shiftRouter);
app.use("/api/leave-types", leaveTypeRouter);
app.use("/api/leave-policies", leavePolicyRouter);
app.use("/api/salary-components", salaryComponentRouter);
app.use("/api/salary-policies", salaryPolicyRouter);

// 404 Fallback
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(chalk.bgCyan(`Server is running on port ${PORT}`));
});
