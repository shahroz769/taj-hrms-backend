import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getAllShifts,
  // getShiftById,
  // createShift,
  // deleteShift,
  // updateShift,
  // getAllShiftsFiltersList,
} from "../controllers/shiftController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/shifts
// @description     Get all shifts
// @access          Admin
router.get("/", protect, authorize(ROLES.admin), getAllShifts);

// @route           GET /api/shifts/filters
// @description     Get all shifts for filter
// @access          Admin
// router.get("/filters", protect, authorize(ROLES.admin), getAllShiftsFiltersList);

// @route           GET /api/shifts/:id
// @description     Get single shift
// @access          Admin
// router.get("/:id", protect, authorize(ROLES.admin), getShiftById);

// @route           POST /api/shifts
// @description     Create new shift
// @access          Admin only
// router.post("/", protect, authorize(ROLES.admin), createShift);

// @route           PUT /api/shifts/:id
// @description     Update shift
// @access          Admin only
// router.put("/:id", protect, authorize(ROLES.admin), updateShift);

// @route           DELETE /api/shifts/:id
// @description     Delete shift
// @access          Admin only
// router.delete("/:id", protect, authorize(ROLES.admin), deleteShift);

export default router;
