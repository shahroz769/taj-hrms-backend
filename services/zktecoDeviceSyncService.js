import ZktecoDevice from "../models/ZktecoDevice.js";
import ZktecoAttendanceLog from "../models/ZktecoAttendanceLog.js";
import {
  formatDeviceStamp,
  maxDeviceStamp,
} from "../utils/zktecoStamp.js";
import {
  parseAttlogLines,
  saveDevicePunchToAttendance,
} from "./zktecoAttendanceService.js";

const getOnlineThresholdMs = () =>
  (Number(process.env.ZK_ONLINE_THRESHOLD_SECONDS) || 120) * 1000;

export const isDeviceRecentlyOnline = (device) => {
  if (!device?.lastSeenAt) return false;
  return (
    Date.now() - new Date(device.lastSeenAt).getTime() < getOnlineThresholdMs()
  );
};

export const isAttlogQueryOnReconnectEnabled = () =>
  String(process.env.ZK_REQUEST_ATTLOG_ON_RECONNECT ?? "true").toLowerCase() !==
  "false";

export const resolveAttlogStamp = async (device) => {
  if (device?.attlogStamp && device.attlogStamp !== "0") {
    return device.attlogStamp;
  }

  const latest = await ZktecoAttendanceLog.findOne({
    deviceSerialNumber: device.serialNumber,
  })
    .sort({ punchTime: -1 })
    .select("punchTime")
    .lean();

  if (!latest?.punchTime) return "0";
  return formatDeviceStamp(latest.punchTime);
};

export const buildHandshakeResponse = async (serialNumber, device) => {
  const attlogStamp = await resolveAttlogStamp(device);
  const operlogStamp = device?.operlogStamp || "0";

  return [
    `GET OPTION FROM: ${serialNumber}`,
    `ATTLOGStamp=${attlogStamp}`,
    `OPERLOGStamp=${operlogStamp}`,
    "ATTPHOTOStamp=0",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:00",
    "TransInterval=1",
    "TransFlag=1111000000",
    "TimeZone=5",
    "Realtime=1",
    "Encrypt=0",
  ].join("\r\n");
};

export const updateAttlogStampFromBatch = async (device, punchTimes, stampParam) => {
  let stamp = device?.attlogStamp || "0";

  for (const punchTime of punchTimes) {
    stamp = maxDeviceStamp(stamp, punchTime);
  }

  if (stampParam) {
    stamp = maxDeviceStamp(stamp, stampParam);
  }

  if (stamp !== "0" && device?._id) {
    device.attlogStamp = stamp;
    await device.save();
  }

  return stamp;
};

export const queueAttlogQuery = async (device) => {
  if (!device?._id) return null;

  const commandId = device.nextCommandId || 1;
  const command = "DATA QUERY ATTLOG";

  const alreadyQueued = (device.pendingCommands || []).some(
    (entry) => entry.command === command,
  );
  if (alreadyQueued) return null;

  device.pendingCommands = [
    ...(device.pendingCommands || []),
    { commandId, command, createdAt: new Date() },
  ];
  device.nextCommandId = commandId + 1;
  await device.save();

  return { commandId, command };
};

export const peekDeviceCommand = (device) => {
  const pending = device?.pendingCommands || [];
  return pending.length > 0 ? pending[0] : null;
};

export const acknowledgeDeviceCommand = async (device, commandId) => {
  if (!device?._id || commandId === undefined || commandId === null) return;

  const id = Number(commandId);
  device.pendingCommands = (device.pendingCommands || []).filter(
    (entry) => Number(entry.commandId) !== id,
  );
  await device.save();
};

export const handleDeviceReconnect = async (device, wasOffline) => {
  if (!device?._id || !wasOffline || !isAttlogQueryOnReconnectEnabled()) {
    return null;
  }

  return queueAttlogQuery(device);
};

const syncLogToAttendance = async (logDoc) => {
  const result = await saveDevicePunchToAttendance({
    pin: logDoc.pin,
    punchTime: logDoc.punchTime,
    deviceSerialNumber: logDoc.deviceSerialNumber,
  });

  if (result.ok) {
    logDoc.syncedToAttendance = true;
    logDoc.syncError = result.skipped ? result.reason || "" : "";
  } else {
    logDoc.syncedToAttendance = false;
    logDoc.syncError = result.error || "Sync failed";
  }

  await logDoc.save();
  return result;
};

/**
 * Process ATTLOG batch from device (real-time or offline buffer upload).
 */
export const processAttlogBatch = async ({
  device,
  serialNumber,
  rawPayload,
  stampParam,
}) => {
  const lines = parseAttlogLines(rawPayload);
  const punchTimes = [];
  let processed = 0;
  let duplicates = 0;

  for (const line of lines) {
    punchTimes.push(line.punchTime);

    let logDoc;
    let isNew = false;

    try {
      logDoc = await ZktecoAttendanceLog.create({
        deviceSerialNumber: serialNumber,
        pin: line.pin,
        punchTime: line.punchTime,
        statusCode: line.statusCode,
        verifyType: line.verifyType,
        workCode: line.workCode,
        rawLine: line.rawLine,
        rawPayload,
      });
      isNew = true;
      processed += 1;
    } catch (err) {
      if (err?.code !== 11000) {
        console.error("[ZKTeco ADMS] Punch processing error:", err.message);
        continue;
      }

      logDoc = await ZktecoAttendanceLog.findOne({
        deviceSerialNumber: serialNumber,
        pin: line.pin,
        punchTime: line.punchTime,
      });

      if (!logDoc) continue;
      duplicates += 1;
    }

    if (logDoc && (isNew || !logDoc.syncedToAttendance)) {
      await syncLogToAttendance(logDoc);
    }
  }

  const stamp = await updateAttlogStampFromBatch(device, punchTimes, stampParam);
  return { processed, duplicates, stamp, total: lines.length };
};

export const requestAttlogSyncForDevice = async (deviceId) => {
  const device = await ZktecoDevice.findById(deviceId);
  if (!device) {
    return { ok: false, error: "Device not found" };
  }

  const queued = await queueAttlogQuery(device);
  if (!queued) {
    return {
      ok: true,
      queued: false,
      message: "ATTLOG sync already queued for this device",
    };
  }

  return {
    ok: true,
    queued: true,
    commandId: queued.commandId,
    message:
      "Offline log sync queued. Device will upload buffered punches on next poll.",
  };
};
