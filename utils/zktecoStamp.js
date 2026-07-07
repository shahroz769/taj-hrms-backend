import { formatInTimeZone } from "date-fns-tz";
import { PAKISTAN_TZ } from "./timezone.js";

/** ZKTeco ADMS stamp format: YYYY-MM-DDThh:mm:ss (device local / PKT). */
export const formatDeviceStamp = (date) => {
  if (!date) return "0";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "0";
  return formatInTimeZone(d, PAKISTAN_TZ, "yyyy-MM-dd'T'HH:mm:ss");
};

export const parseDeviceStamp = (stamp) => {
  if (!stamp) return null;
  const raw = String(stamp).trim();
  if (!raw || raw === "0" || raw === "9999" || raw.toLowerCase() === "none") {
    return null;
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(`${normalized}+05:00`);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const maxDeviceStamp = (currentStamp, nextDateOrStamp) => {
  const current = parseDeviceStamp(currentStamp);
  const next =
    nextDateOrStamp instanceof Date
      ? nextDateOrStamp
      : parseDeviceStamp(nextDateOrStamp);

  if (!next) return currentStamp || "0";
  if (!current) return formatDeviceStamp(next);
  return next.getTime() >= current.getTime()
    ? formatDeviceStamp(next)
    : currentStamp || formatDeviceStamp(current);
};
