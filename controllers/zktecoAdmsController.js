import {
  authorizeAndTouchDevice,
  normalizeSerial,
} from "../utils/zktecoDeviceAuth.js";
import {
  acknowledgeDeviceCommand,
  buildHandshakeResponse,
  handleDeviceReconnect,
  peekDeviceCommand,
  processAttlogBatch,
} from "../services/zktecoDeviceSyncService.js";

const sendText = (res, statusCode, body) => {
  res.status(statusCode);
  res.set("Content-Type", "text/plain; charset=utf-8");
  return res.send(body);
};

const rejectDevice = (res, reason) => {
  console.warn("[ZKTeco ADMS] Device rejected:", reason);
  return sendText(res, 403, "Forbidden");
};

const touchAndMaybeSyncOffline = async (req, serialNumber, info) => {
  const auth = await authorizeAndTouchDevice(req, serialNumber, info);
  if (!auth.allowed || !auth.device) return auth;

  if (auth.wasOffline) {
    await handleDeviceReconnect(auth.device, true);
    console.info(
      `[ZKTeco ADMS] Device ${serialNumber} reconnected — queued offline ATTLOG sync`,
    );
  }

  return auth;
};

/**
 * GET /iclock/cdata?SN=...&options=all
 */
export const getCdataHandshake = async (req, res, next) => {
  try {
    const serialNumber = normalizeSerial(req.query.SN);
    const { allowed, device, reason } = await touchAndMaybeSyncOffline(
      req,
      serialNumber,
      req.query.INFO,
    );

    if (!allowed) {
      return rejectDevice(res, reason);
    }

    const body = await buildHandshakeResponse(serialNumber, device);
    return sendText(res, 200, body);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /iclock/cdata?SN=...&table=ATTLOG&Stamp=...
 */
export const postCdataAttlog = async (req, res, next) => {
  try {
    const serialNumber = normalizeSerial(req.query.SN);
    const table = String(req.query.table || "").toUpperCase();
    const stampParam = req.query.Stamp || req.query.stamp || "";

    const { allowed, device, reason } = await touchAndMaybeSyncOffline(
      req,
      serialNumber,
      req.query.INFO,
    );

    if (!allowed) {
      return rejectDevice(res, reason);
    }

    if (table && table !== "ATTLOG") {
      return sendText(res, 200, "OK");
    }

    const rawPayload =
      typeof req.rawBody === "string"
        ? req.rawBody
        : typeof req.body === "string"
          ? req.body
          : "";

    if (!rawPayload.trim()) {
      return sendText(res, 200, "OK");
    }

    const { processed, duplicates, total } = await processAttlogBatch({
      device,
      serialNumber,
      rawPayload,
      stampParam,
    });

    const count = processed + duplicates;
    if (count > 0 && duplicates > 0 && processed === 0) {
      console.info(
        `[ZKTeco ADMS] ${serialNumber}: acknowledged ${duplicates} duplicate offline punch(es)`,
      );
    }

    return sendText(res, 200, count > 0 ? `OK:${count}` : "OK");
  } catch (err) {
    next(err);
  }
};

/**
 * GET /iclock/getrequest?SN=...&INFO=...
 * Returns queued commands (e.g. DATA QUERY ATTLOG after offline reconnect).
 */
export const getDeviceRequest = async (req, res, next) => {
  try {
    const serialNumber = normalizeSerial(req.query.SN);
    const { allowed, device, reason } = await touchAndMaybeSyncOffline(
      req,
      serialNumber,
      req.query.INFO,
    );

    if (!allowed) {
      return rejectDevice(res, reason);
    }

    const pending = peekDeviceCommand(device);
    if (pending) {
      return sendText(res, 200, `C:${pending.commandId}:${pending.command}`);
    }

    return sendText(res, 200, "OK");
  } catch (err) {
    next(err);
  }
};

/**
 * POST /iclock/devicecmd?SN=...
 * Device reports command execution result.
 */
export const postDeviceCmd = async (req, res, next) => {
  try {
    const serialNumber = normalizeSerial(req.query.SN);
    const { allowed, device, reason } = await authorizeAndTouchDevice(
      req,
      serialNumber,
      req.query.INFO,
    );

    if (!allowed) {
      return rejectDevice(res, reason);
    }

    const rawPayload =
      typeof req.rawBody === "string"
        ? req.rawBody
        : typeof req.body === "string"
          ? req.body
          : "";

    const idMatch = rawPayload.match(/ID=(\d+)/i);
    if (idMatch) {
      await acknowledgeDeviceCommand(device, idMatch[1]);
    }

    return sendText(res, 200, "OK");
  } catch (err) {
    next(err);
  }
};

/**
 * GET /iclock/ping
 */
export const pingDevice = async (req, res) => {
  return sendText(res, 200, "OK");
};
