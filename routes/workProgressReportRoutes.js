import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createWorkProgressReport,
  deleteWorkProgressReport,
  getAllWorkProgressReports,
  getWorkProgressReportById,
  updateWorkProgressReport,
} from "../controllers/workProgressReportController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/work-progress-reports
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllWorkProgressReports,
);

// @route           GET /api/work-progress-reports/:id
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getWorkProgressReportById,
);

// @route           POST /api/work-progress-reports
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createWorkProgressReport,
);

// @route           PUT /api/work-progress-reports/:id
router.put(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  updateWorkProgressReport,
);

// @route           DELETE /api/work-progress-reports/:id
router.delete(
  "/:id",
  protect,
  authorize(ROLES.admin),
  deleteWorkProgressReport,
);

export default router;
