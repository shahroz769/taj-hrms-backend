import ZktecoDevice from "../models/ZktecoDevice.js";

const normalizeSerial = (serial) =>
  String(serial || "")
    .trim()
    .toUpperCase();

const getAllowedSerialsFromEnv = () => {
  const raw = process.env.ZK_ALLOWED_SERIALS || "";
  if (!raw.trim()) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => normalizeSerial(s))
      .filter(Boolean),
  );
};

const isAutoRegisterEnabled = () =>
  String(process.env.ZK_AUTO_REGISTER_DEVICES ?? "true").toLowerCase() !==
  "false";

/**
 * Parse ZKTeco INFO query param for firmware version and device-reported IP.
 */
export const parseDeviceInfo = (info) => {
  if (!info) return { firmwareVersion: "", reportedIp: "" };

  const decoded = decodeURIComponent(String(info));
  const parts = decoded.split(/[,;|]/);

  let firmwareVersion = "";
  let reportedIp = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (/ver/i.test(trimmed) && !firmwareVersion) {
      firmwareVersion = trimmed;
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
      reportedIp = trimmed;
    }
  }

  return { firmwareVersion, reportedIp };
};

export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "";
};

/**
 * Ensure device is allowed and update last-seen metadata.
 * Returns { allowed: boolean, device, reason? }
 */
export const authorizeAndTouchDevice = async (req, serialNumber, info) => {
  const serial = normalizeSerial(serialNumber);
  if (!serial) {
    return { allowed: false, device: null, reason: "Missing serial number" };
  }

  const envAllowList = getAllowedSerialsFromEnv();
  if (envAllowList && !envAllowList.has(serial)) {
    return { allowed: false, device: null, reason: "Serial not in allow-list" };
  }

  const { firmwareVersion, reportedIp } = parseDeviceInfo(info);
  const lastIpAddress = getClientIp(req);
  const touchFields = {
    lastSeenAt: new Date(),
    lastIpAddress,
  };

  if (firmwareVersion) touchFields.firmwareVersion = firmwareVersion;
  if (reportedIp) touchFields.reportedIp = reportedIp;

  let device = await ZktecoDevice.findOne({ serialNumber: serial });

  const wasOffline = device ? !device.lastSeenAt ||
    Date.now() - new Date(device.lastSeenAt).getTime() >=
      (Number(process.env.ZK_ONLINE_THRESHOLD_SECONDS) || 120) * 1000
    : false;

  if (device) {
    if (device.enabled === false) {
      return { allowed: false, device, reason: "Device is disabled" };
    }

    Object.assign(device, touchFields);
    await device.save();
    return { allowed: true, device, wasOffline };
  }

  if (!isAutoRegisterEnabled()) {
    return {
      allowed: false,
      device: null,
      reason: "Device not registered and auto-register is disabled",
    };
  }

  device = await ZktecoDevice.create({
    serialNumber: serial,
    name: "ZKTeco Attendance Device",
    enabled: true,
    ...touchFields,
  });

  return { allowed: true, device, wasOffline: false };
};

export { normalizeSerial };
