import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";
import {
  getStats,
  listDevices,
  createDevice,
  getDeviceById,
  updateDevice,
  deleteDevice,
  listAttendanceLogs,
  retryLogs,
  listUnmatchedPins,
  assignEmployeePin,
  requestAttlogSync,
} from "../controllers/zktecoDeviceController.js";

const router = express.Router();

router.use(protect, authorize(ROLES.admin));

router.get("/stats", getStats);
router.get("/devices", listDevices);
router.post("/devices", createDevice);
router.get("/devices/:id", getDeviceById);
router.put("/devices/:id", updateDevice);
router.delete("/devices/:id", deleteDevice);
router.post("/devices/:id/request-attlog-sync", requestAttlogSync);
router.get("/logs", listAttendanceLogs);
router.post("/logs/retry", retryLogs);
router.get("/unmatched-pins", listUnmatchedPins);
router.put("/employees/:employeeId/pin", assignEmployeePin);

export default router;
