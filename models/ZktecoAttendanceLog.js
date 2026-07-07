import mongoose from "mongoose";

const zktecoAttendanceLogSchema = new mongoose.Schema(
  {
    deviceSerialNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    pin: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    punchTime: {
      type: Date,
      required: true,
      index: true,
    },
    statusCode: {
      type: String,
      default: "",
    },
    verifyType: {
      type: String,
      default: "",
    },
    workCode: {
      type: String,
      default: "",
    },
    rawLine: {
      type: String,
      default: "",
    },
    rawPayload: {
      type: String,
      default: "",
    },
    syncedToAttendance: {
      type: Boolean,
      default: false,
    },
    syncError: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

zktecoAttendanceLogSchema.index(
  { deviceSerialNumber: 1, pin: 1, punchTime: 1 },
  { unique: true },
);

const ZktecoAttendanceLog = mongoose.model(
  "ZktecoAttendanceLog",
  zktecoAttendanceLogSchema,
);

export default ZktecoAttendanceLog;
