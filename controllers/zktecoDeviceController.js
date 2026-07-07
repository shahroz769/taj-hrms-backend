import mongoose from "mongoose";
import ZktecoDevice from "../models/ZktecoDevice.js";
import ZktecoAttendanceLog from "../models/ZktecoAttendanceLog.js";
import Employee from "../models/Employee.js";
import {
  saveDevicePunchToAttendance,
} from "../services/zktecoAttendanceService.js";
import { requestAttlogSyncForDevice } from "../services/zktecoDeviceSyncService.js";
import { normalizeSerial } from "../utils/zktecoDeviceAuth.js";
import { formatInTimeZone } from "date-fns-tz";
import { PAKISTAN_TZ } from "../utils/timezone.js";

const getOnlineThresholdMs = () =>
  (Number(process.env.ZK_ONLINE_THRESHOLD_SECONDS) || 120) * 1000;

const isDeviceOnline = (device) => {
  if (!device?.lastSeenAt) return false;
  return (
    Date.now() - new Date(device.lastSeenAt).getTime() < getOnlineThresholdMs()
  );
};

const formatDevice = (device) => ({
  ...device.toObject(),
  online: isDeviceOnline(device),
  pendingCommandCount: device.pendingCommands?.length || 0,
});

const findEmployeeForPin = async (pin) => {
  const normalizedPin = String(pin || "").trim();
  if (!normalizedPin) return null;

  return Employee.findOne({
    status: "Active",
    employeeID: normalizedPin,
  }).select("_id fullName employeeID");
};

const enrichLogWithEmployee = async (log) => {
  const employee = await findEmployeeForPin(log.pin);
  return {
    ...log,
    employee: employee
      ? {
          _id: employee._id,
          fullName: employee.fullName,
          employeeID: employee.employeeID,
        }
      : null,
  };
};

export const getStats = async (req, res, next) => {
  try {
    const [totalDevices, disabledDevices, devices] = await Promise.all([
      ZktecoDevice.countDocuments(),
      ZktecoDevice.countDocuments({ enabled: false }),
      ZktecoDevice.find().lean(),
    ]);

    const onlineCount = devices.filter((d) =>
      isDeviceOnline(d),
    ).length;

    const pkToday = formatInTimeZone(new Date(), PAKISTAN_TZ, "yyyy-MM-dd");
    const todayStart = new Date(`${pkToday}T00:00:00+05:00`);
    const todayEnd = new Date(`${pkToday}T23:59:59.999+05:00`);

    const [totalLogs, syncedLogs, failedLogs, todayLogs, unmatchedPins] =
      await Promise.all([
        ZktecoAttendanceLog.countDocuments(),
        ZktecoAttendanceLog.countDocuments({ syncedToAttendance: true }),
        ZktecoAttendanceLog.countDocuments({
          syncedToAttendance: false,
          syncError: { $ne: "" },
        }),
        ZktecoAttendanceLog.countDocuments({
          punchTime: { $gte: todayStart, $lte: todayEnd },
        }),
        getUnmatchedPinCount(),
      ]);

    res.json({
      devices: {
        total: totalDevices,
        online: onlineCount,
        disabled: disabledDevices,
      },
      logs: {
        total: totalLogs,
        synced: syncedLogs,
        failed: failedLogs,
        today: todayLogs,
      },
      unmatchedPins,
    });
  } catch (err) {
    next(err);
  }
};

const getUnmatchedPinCount = async () => {
  const unmatched = await ZktecoAttendanceLog.aggregate([
    {
      $group: {
        _id: "$pin",
        lastPunchTime: { $max: "$punchTime" },
      },
    },
  ]);

  let count = 0;
  for (const row of unmatched) {
    const employee = await findEmployeeForPin(row._id);
    if (!employee) count += 1;
  }
  return count;
};

export const listDevices = async (req, res, next) => {
  try {
    const devices = await ZktecoDevice.find().sort({ createdAt: -1 });
    res.json({ devices: devices.map(formatDevice) });
  } catch (err) {
    next(err);
  }
};

export const createDevice = async (req, res, next) => {
  try {
    const { serialNumber, name, location, enabled } = req.body;

    if (!serialNumber?.trim()) {
      res.status(400);
      throw new Error("Serial number is required");
    }

    const serial = normalizeSerial(serialNumber);
    const existing = await ZktecoDevice.findOne({ serialNumber: serial });
    if (existing) {
      res.status(409);
      throw new Error("A device with this serial number already exists");
    }

    const device = await ZktecoDevice.create({
      serialNumber: serial,
      name: name?.trim() || "ZKTeco Attendance Device",
      location: location?.trim() || "",
      enabled: enabled !== false,
    });

    res.status(201).json({
      message: "Device registered successfully",
      device: formatDevice(device),
    });
  } catch (err) {
    next(err);
  }
};

export const getDeviceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Device not found");
    }

    const device = await ZktecoDevice.findById(id);
    if (!device) {
      res.status(404);
      throw new Error("Device not found");
    }

    res.json({ device: formatDevice(device) });
  } catch (err) {
    next(err);
  }
};

export const updateDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Device not found");
    }

    const device = await ZktecoDevice.findById(id);
    if (!device) {
      res.status(404);
      throw new Error("Device not found");
    }

    const { name, location, enabled } = req.body;
    if (name !== undefined) device.name = String(name).trim();
    if (location !== undefined) device.location = String(location).trim();
    if (enabled !== undefined) device.enabled = Boolean(enabled);

    await device.save();
    res.json({ device: formatDevice(device) });
  } catch (err) {
    next(err);
  }
};

export const deleteDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Device not found");
    }

    const device = await ZktecoDevice.findByIdAndDelete(id);
    if (!device) {
      res.status(404);
      throw new Error("Device not found");
    }

    res.json({ message: "Device deleted successfully" });
  } catch (err) {
    next(err);
  }
};

export const listAttendanceLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.serialNumber) {
      filter.deviceSerialNumber = normalizeSerial(req.query.serialNumber);
    }

    if (req.query.pin) {
      filter.pin = String(req.query.pin).trim();
    }

    if (req.query.synced === "true") {
      filter.syncedToAttendance = true;
    } else if (req.query.synced === "false") {
      filter.syncedToAttendance = false;
    }

    if (req.query.failed === "true") {
      filter.syncedToAttendance = false;
      filter.syncError = { $ne: "" };
    }

    if (req.query.from || req.query.to) {
      filter.punchTime = {};
      if (req.query.from) {
        filter.punchTime.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.punchTime.$lte = toDate;
      }
    }

    const [logs, total] = await Promise.all([
      ZktecoAttendanceLog.find(filter)
        .sort({ punchTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ZktecoAttendanceLog.countDocuments(filter),
    ]);

    const enriched = await Promise.all(logs.map(enrichLogWithEmployee));

    res.json({
      logs: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const retryLogs = async (req, res, next) => {
  try {
    const { logIds } = req.body || {};
    const filter = { syncedToAttendance: false };

    if (Array.isArray(logIds) && logIds.length > 0) {
      const validIds = logIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id),
      );
      filter._id = { $in: validIds };
    }

    const logs = await ZktecoAttendanceLog.find(filter).sort({ punchTime: 1 });
    let synced = 0;
    let failed = 0;

    for (const log of logs) {
      const result = await saveDevicePunchToAttendance({
        pin: log.pin,
        punchTime: log.punchTime,
        deviceSerialNumber: log.deviceSerialNumber,
      });

      if (result.ok) {
        log.syncedToAttendance = true;
        log.syncError = result.skipped ? result.reason || "" : "";
        synced += 1;
      } else {
        log.syncedToAttendance = false;
        log.syncError = result.error || "Sync failed";
        failed += 1;
      }

      await log.save();
    }

    res.json({
      message: `Retried ${logs.length} log(s): ${synced} synced, ${failed} failed`,
      synced,
      failed,
      total: logs.length,
    });
  } catch (err) {
    next(err);
  }
};

export const listUnmatchedPins = async (req, res, next) => {
  try {
    const grouped = await ZktecoAttendanceLog.aggregate([
      {
        $group: {
          _id: "$pin",
          lastPunchTime: { $max: "$punchTime" },
          punchCount: { $sum: 1 },
          deviceSerialNumber: { $last: "$deviceSerialNumber" },
        },
      },
      { $sort: { lastPunchTime: -1 } },
    ]);

    const pins = [];

    for (const row of grouped) {
      const employee = await findEmployeeForPin(row._id);
      if (!employee) {
        pins.push({
          pin: row._id,
          lastPunchTime: row.lastPunchTime,
          punchCount: row.punchCount,
          deviceSerialNumber: row.deviceSerialNumber,
        });
      }
    }

    res.json({ pins });
  } catch (err) {
    next(err);
  }
};

export const requestAttlogSync = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Device not found");
    }

    const result = await requestAttlogSyncForDevice(id);
    if (!result.ok) {
      res.status(404);
      throw new Error(result.error);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const assignEmployeePin = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { pin } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (!pin?.trim()) {
      res.status(400);
      throw new Error("Device User ID (PIN) is required");
    }

    const normalizedPin = String(pin).trim();
    const employee = await Employee.findById(employeeId);

    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (normalizedPin !== String(employee.employeeID || "").trim()) {
      res.status(400);
      throw new Error(
        `Device User ID must match Employee ID (${employee.employeeID}). Update the user on the ZKTeco terminal.`,
      );
    }

    const unsyncedLogs = await ZktecoAttendanceLog.find({
      pin: normalizedPin,
      syncedToAttendance: false,
    }).sort({ punchTime: 1 });

    let resynced = 0;

    for (const log of unsyncedLogs) {
      const result = await saveDevicePunchToAttendance({
        pin: log.pin,
        punchTime: log.punchTime,
        deviceSerialNumber: log.deviceSerialNumber,
      });

      if (result.ok) {
        log.syncedToAttendance = true;
        log.syncError = result.skipped ? result.reason || "" : "";
        resynced += 1;
      } else {
        log.syncedToAttendance = false;
        log.syncError = result.error || "Sync failed";
      }

      await log.save();
    }

    res.json({
      message: `${resynced} punch(es) re-synced for Employee ID ${employee.employeeID}.`,
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        employeeID: employee.employeeID,
      },
      resynced,
    });
  } catch (err) {
    next(err);
  }
};
