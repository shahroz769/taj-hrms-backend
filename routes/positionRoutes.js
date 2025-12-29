import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getAllPositions,
  getPositionById,
  //   createPosition,
  //   deletePosition,
  //   updatePosition,
} from "../controllers/positionController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/positions
// @description     Get all positions
// @access          Admin
router.get("/", protect, authorize(ROLES.admin), getAllPositions);

// @route           GET /api/positions/:id
// @description     Get single position
// @access          Admin
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin),
  getPositionById
);

// @route           POST /api/positions
// @description     Create new position
// @access          Admin only
// router.post("/", protect, authorize(ROLES.admin), createPosition);

// @route           PUT /api/positions/:id
// @description     Update position
// @access          Admin only
// router.put("/:id", protect, authorize(ROLES.admin), updatePosition);

// @route           DELETE /api/positions/:id
// @description     Delete position
// @access          Admin only
// router.delete("/:id", protect, authorize(ROLES.admin), deletePosition);

export default router;
