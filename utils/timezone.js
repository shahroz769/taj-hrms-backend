import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const PAKISTAN_TZ = "Asia/Karachi";

const pad2 = (value) => String(value).padStart(2, "0");

export const getCurrentPKYearMonth = () => {
  const now = new Date();
  const year = Number(formatInTimeZone(now, PAKISTAN_TZ, "yyyy"));
  const month = Number(formatInTimeZone(now, PAKISTAN_TZ, "MM"));
  return { year, month };
};

export const isMonthClosedInPakistanTime = (year, month) => {
  const targetYear = Number(year);
  const targetMonth = Number(month);

  const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
  const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;

  const nextMonthStartLocal = `${nextYear}-${pad2(nextMonth)}-01T00:00:00`;
  const nextMonthStartUtc = fromZonedTime(nextMonthStartLocal, PAKISTAN_TZ);

  return new Date() >= nextMonthStartUtc;
};

export const getMonthStartEndUtcForPakistan = (year, month) => {
  const y = Number(year);
  const m = Number(month);

  const monthStartLocal = `${y}-${pad2(m)}-01T00:00:00`;
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextMonthStartLocal = `${nextYear}-${pad2(nextMonth)}-01T00:00:00`;

  const monthStartUtc = fromZonedTime(monthStartLocal, PAKISTAN_TZ);
  const nextMonthStartUtc = fromZonedTime(nextMonthStartLocal, PAKISTAN_TZ);

  return { monthStartUtc, nextMonthStartUtc };
};

/** Calendar day (1–31) in Pakistan for a stored attendance date. */
export const pkCalendarDayFromDate = (date) =>
  Number(formatInTimeZone(date, PAKISTAN_TZ, "d"));

/** UTC instant for Pakistan calendar midnight (year + 0-indexed month + day). */
export const pkCalendarDateUtcFromParts = (year, month0Indexed, day) => {
  const y = Number(year);
  const m = Number(month0Indexed) + 1;
  const d = Number(day);
  return fromZonedTime(`${y}-${pad2(m)}-${pad2(d)}T00:00:00`, PAKISTAN_TZ);
};

/** UTC instant for today's calendar date in Pakistan. */
export const pkTodayDateUtc = () => {
  const pkDate = formatInTimeZone(new Date(), PAKISTAN_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${pkDate}T00:00:00`, PAKISTAN_TZ);
};

/** Full weekday name (e.g. "Monday") for a Pakistan calendar date. */
export const pkDayNameFromParts = (year, month0Indexed, day) =>
  formatInTimeZone(
    pkCalendarDateUtcFromParts(year, month0Indexed, day),
    PAKISTAN_TZ,
    "EEEE",
  );

/** Inclusive month range in UTC for a 0-indexed month viewed in Pakistan time. */
export const getMonthRangeUtcForPakistan = (year, month0Indexed) => {
  const { monthStartUtc, nextMonthStartUtc } = getMonthStartEndUtcForPakistan(
    year,
    month0Indexed + 1,
  );
  return {
    startOfMonth: monthStartUtc,
    endOfMonth: new Date(nextMonthStartUtc.getTime() - 1),
  };
};
