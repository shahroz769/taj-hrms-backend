import mongoose from "mongoose";

const zktecoDeviceSchema = new mongoose.Schema(
  {
    serialNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      default: "ZKTeco Attendance Device",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    /** Last acknowledged ATTLOG stamp (YYYY-MM-DDThh:mm:ss PKT) for offline sync */
    attlogStamp: {
      type: String,
      default: "0",
    },
    operlogStamp: {
      type: String,
      default: "0",
    },
    nextCommandId: {
      type: Number,
      default: 1,
    },
    pendingCommands: [
      {
        commandId: { type: Number, required: true },
        command: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    lastSeenAt: {
      type: Date,
      default: null,
    },
    lastIpAddress: {
      type: String,
      default: "",
    },
    reportedIp: {
      type: String,
      default: "",
    },
    firmwareVersion: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

zktecoDeviceSchema.index({ enabled: 1, lastSeenAt: -1 });

const ZktecoDevice = mongoose.model("ZktecoDevice", zktecoDeviceSchema);

export default ZktecoDevice;
