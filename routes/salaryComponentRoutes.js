import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createSalaryComponent,
  getAllSalaryComponents,
  getAllSalaryComponentsList,
  getSalaryComponentById,
  updateSalaryComponent,
  updateSalaryComponentStatus,
  deleteSalaryComponent,
} from "../controllers/salaryComponentController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/salary-components
// @description     Get all salary components
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllSalaryComponents
);

// @route           GET /api/salary-components/list
// @description     Get all salary components list for select options
// @access          Admin, Supervisor
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllSalaryComponentsList
);

// @route           GET /api/salary-components/:id
// @description     Get single salary component by ID
// @access          Admin, Supervisor
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getSalaryComponentById
);

// @route           POST /api/salary-components
// @description     Create new salary component
// @access          Admin, Supervisor
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createSalaryComponent
);

// @route           PUT /api/salary-components/:id
// @description     Update salary component
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateSalaryComponent);

// @route           PATCH /api/salary-components/:id/status
// @description     Update salary component status (Approve/Reject)
// @access          Admin only
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  updateSalaryComponentStatus
);

// @route           DELETE /api/salary-components/:id
// @description     Delete salary component
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteSalaryComponent);

export default router;
