import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createSalaryPolicy,
  getAllSalaryPolicies,
  getAllSalaryPoliciesList,
  getSalaryPolicyById,
  updateSalaryPolicy,
  updateSalaryPolicyStatus,
  deleteSalaryPolicy,
} from "../controllers/salaryPolicyController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/salary-policies
// @description     Get all salary policies
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllSalaryPolicies
);

// @route           GET /api/salary-policies/list
// @description     Get all salary policies list for select options
// @access          Admin, Supervisor
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllSalaryPoliciesList
);

// @route           GET /api/salary-policies/:id
// @description     Get single salary policy by ID
// @access          Admin, Supervisor
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getSalaryPolicyById
);

// @route           POST /api/salary-policies
// @description     Create new salary policy
// @access          Admin, Supervisor
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createSalaryPolicy
);

// @route           PUT /api/salary-policies/:id
// @description     Update salary policy
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateSalaryPolicy);

// @route           PATCH /api/salary-policies/:id/status
// @description     Update salary policy status (Approve/Reject)
// @access          Admin only
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  updateSalaryPolicyStatus
);

// @route           DELETE /api/salary-policies/:id
// @description     Delete salary policy
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteSalaryPolicy);

export default router;
