import Attendance from "../models/Attendance.js";
import MonthlyAttendanceSummary from "../models/MonthlyAttendanceSummary.js";
import Employee from "../models/Employee.js";
import EmployeeShift from "../models/EmployeeShift.js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { PAKISTAN_TZ } from "../utils/timezone.js";
import { getAttendanceRules } from "../controllers/attendanceRuleController.js";

const DEFAULT_ATTENDANCE_RULES = {
  graceMinutes: 15,
  absentAfterLateMinutes: 60,
  halfDayEarlyCheckOutMinutes: 60,
};

const normalizeUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  const pkDate = formatInTimeZone(date, PAKISTAN_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${pkDate}T00:00:00`, PAKISTAN_TZ);
};

const buildDateTimeFromShiftTime = (date, timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const dt = new Date(date);
  if (isNaN(dt.getTime())) return null;
  dt.setUTCHours(hours, minutes, 0, 0);
  return dt;
};

const computeStatusFromCheckTimes = ({ shift, date, checkIn, checkOut, rules }) => {
  const activeRules = rules || DEFAULT_ATTENDANCE_RULES;

  if (!shift || !date) {
    return "Present";
  }

  const shiftStart = buildDateTimeFromShiftTime(date, shift.startTime);
  const shiftEnd = buildDateTimeFromShiftTime(date, shift.endTime);

  if (!shiftStart || !shiftEnd) {
    return "Present";
  }

  let computedStatus = "Present";

  if (checkIn) {
    const lateMinutes = Math.floor(
      (checkIn.getTime() - shiftStart.getTime()) / 60000,
    );
    if (lateMinutes >= activeRules.absentAfterLateMinutes) {
      return "Absent";
    }
    if (lateMinutes > activeRules.graceMinutes) {
      computedStatus = "Late";
    }
  }

  if (checkOut) {
    const earlyLeaveMinutes = Math.floor(
      (shiftEnd.getTime() - checkOut.getTime()) / 60000,
    );
    if (
      earlyLeaveMinutes >= activeRules.halfDayEarlyCheckOutMinutes &&
      computedStatus !== "Absent"
    ) {
      computedStatus = "Half Day";
    }
  }

  return computedStatus;
};

const computeLateMinutesFromCheckIn = ({ shift, date, checkIn, rules }) => {
  if (!shift || !date || !checkIn) return 0;
  const activeRules = rules || DEFAULT_ATTENDANCE_RULES;
  const shiftStart = buildDateTimeFromShiftTime(date, shift.startTime);
  if (!shiftStart) return 0;
  const diff = Math.floor((checkIn.getTime() - shiftStart.getTime()) / 60000);
  if (diff <= activeRules.graceMinutes) return 0;
  return diff > 0 ? diff : 0;
};

const isApprovedLeaveLockedRecord = (attendanceRecord) =>
  attendanceRecord?.lockReason === "approved_leave" ||
  (attendanceRecord?.source === "leave_auto" &&
    !!attendanceRecord?.linkedLeaveApplication);

const getEmploymentBoundaryError = (dateUTC, employee) => {
  const joiningDate = normalizeUtcDate(employee?.joiningDate);
  const resignationDate = normalizeUtcDate(employee?.resignationDate);

  if (joiningDate && dateUTC < joiningDate) {
    return `Attendance date is before joining date.`;
  }

  if (resignationDate && dateUTC > resignationDate) {
    return `Attendance date is after resignation date.`;
  }

  return null;
};

const getShiftForDate = async (employeeId, attendanceDate) => {
  const assignment = await EmployeeShift.findOne({
    employee: employeeId,
    effectiveDate: { $lte: attendanceDate },
    $or: [{ endDate: null }, { endDate: { $gte: attendanceDate } }],
  })
    .sort({ effectiveDate: -1 })
    .populate("shift");

  return assignment?.shift || null;
};

export const refreshMonthlySummary = async (employeeId, year, month) => {
  const startOfMonth = new Date(Date.UTC(year, month, 1));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const records = await Attendance.find({
    employee: employeeId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  });

  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    off: 0,
    leave: 0,
    totalWorkingDays: 0,
  };

  for (const rec of records) {
    switch (rec.status) {
      case "Present":
        summary.present += 1;
        break;
      case "Absent":
        summary.absent += 1;
        break;
      case "Late":
        summary.late += 1;
        break;
      case "Half Day":
        summary.halfDay += 1;
        break;
      case "Off":
        summary.off += 1;
        break;
      case "Leave":
        summary.leave += 1;
        break;
      default:
        break;
    }
  }

  summary.totalWorkingDays =
    summary.present + summary.late + summary.halfDay;

  await MonthlyAttendanceSummary.findOneAndUpdate(
    { employee: employeeId, year, month },
    summary,
    { upsert: true, new: true },
  );
};

const computeWorkHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const diffMs = checkOut.getTime() - checkIn.getTime();
  if (diffMs <= 0) return null;
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

const findEmployeeByPin = async (pin) => {
  const normalizedPin = String(pin || "").trim();
  if (!normalizedPin) return null;

  return Employee.findOne({
    status: "Active",
    employeeID: normalizedPin,
  });
};

/**
 * Process a single device punch into Attendance (source: device).
 */
export const saveDevicePunchToAttendance = async ({
  pin,
  punchTime,
  deviceSerialNumber,
}) => {
  const punchDate = new Date(punchTime);
  if (isNaN(punchDate.getTime())) {
    return { ok: false, error: "Invalid punch time" };
  }

  const employee = await findEmployeeByPin(pin);
  if (!employee) {
    return {
      ok: false,
      error: `Employee not found for device PIN: ${pin}`,
    };
  }

  const attendanceDate = normalizeUtcDate(punchDate);
  if (!attendanceDate) {
    return { ok: false, error: "Could not resolve attendance date" };
  }

  const boundaryError = getEmploymentBoundaryError(attendanceDate, employee);
  if (boundaryError) {
    return { ok: false, error: boundaryError };
  }

  const shift = await getShiftForDate(employee._id, attendanceDate);
  const rules = await getAttendanceRules();

  let attendance = await Attendance.findOne({
    employee: employee._id,
    date: attendanceDate,
  });

  if (attendance && isApprovedLeaveLockedRecord(attendance)) {
    return {
      ok: true,
      skipped: true,
      reason: "Approved leave locked record",
      attendanceId: attendance._id,
    };
  }

  if (!attendance) {
    const status = computeStatusFromCheckTimes({
      shift,
      date: attendanceDate,
      checkIn: punchDate,
      checkOut: null,
      rules,
    });

    attendance = await Attendance.create({
      employee: employee._id,
      date: attendanceDate,
      status,
      shift: shift?._id || null,
      checkIn: punchDate,
      checkOut: null,
      lateDurationMinutes: computeLateMinutesFromCheckIn({
        shift,
        date: attendanceDate,
        checkIn: punchDate,
        rules,
      }),
      workHours: null,
      source: "device",
      markedBy: null,
    });
  } else {
    const earliestCheckIn =
      attendance.checkIn && attendance.checkIn < punchDate
        ? attendance.checkIn
        : punchDate;

    const latestCheckOut =
      attendance.checkOut && attendance.checkOut > punchDate
        ? attendance.checkOut
        : punchDate;

    const resolvedCheckOut =
      earliestCheckIn.getTime() === latestCheckOut.getTime()
        ? null
        : latestCheckOut;

    const status = computeStatusFromCheckTimes({
      shift,
      date: attendanceDate,
      checkIn: earliestCheckIn,
      checkOut: resolvedCheckOut,
      rules,
    });

    attendance.checkIn = earliestCheckIn;
    attendance.checkOut = resolvedCheckOut;
    attendance.status = status;
    attendance.shift = shift?._id || attendance.shift;
    attendance.lateDurationMinutes = computeLateMinutesFromCheckIn({
      shift,
      date: attendanceDate,
      checkIn: earliestCheckIn,
      rules,
    });
    attendance.workHours = computeWorkHours(earliestCheckIn, resolvedCheckOut);
    attendance.source = "device";
    attendance.markedBy = null;

    await attendance.save();
  }

  const year = attendanceDate.getUTCFullYear();
  const month = attendanceDate.getUTCMonth();
  await refreshMonthlySummary(employee._id, year, month);

  return {
    ok: true,
    attendanceId: attendance._id,
    employeeId: employee._id,
    deviceSerialNumber,
  };
};

export const parseDevicePunchTime = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  const trimmed = String(dateTimeStr).trim();
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const parsed = fromZonedTime(normalized, PAKISTAN_TZ);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const parseAttlogLines = (rawBody) => {
  if (!rawBody || typeof rawBody !== "string") return [];

  return rawBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length < 2) return null;

      const [pin, dateTime, statusCode = "", verifyType = "", workCode = ""] =
        parts;
      const punchTime = parseDevicePunchTime(dateTime);

      if (!pin?.trim() || !punchTime) return null;

      return {
        pin: pin.trim(),
        punchTime,
        statusCode: String(statusCode).trim(),
        verifyType: String(verifyType).trim(),
        workCode: String(workCode).trim(),
        rawLine: line,
      };
    })
    .filter(Boolean);
};

