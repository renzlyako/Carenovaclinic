// The clinic works in Philippine time (Asia/Manila = UTC+8, no daylight saving).
// The database stores appointments as timestamptz (an exact moment in time).
// <input type="datetime-local"> gives a value WITHOUT a time zone, like "2026-11-05T09:30",
// so we always interpret it as clinic time. This keeps the schedule correct on any server (even UTC).

export const CLINIC_TIME_ZONE = "Asia/Manila";
const OFFSET_MS = 8 * 60 * 60 * 1000;

// "2026-11-05T09:30" (clinic time) -> "2026-11-05T01:30:00.000Z"
export function clinicLocalToIso(value) {
  return new Date(`${value}:00+08:00`).toISOString();
}

// "2026-11-05T01:30:00+00:00" -> "2026-11-05T09:30" (for <input type="datetime-local">)
export function isoToClinicLocal(iso) {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

export const clinicNowLocal = () => isoToClinicLocal(new Date().toISOString());
export const clinicToday = () => clinicNowLocal().slice(0, 10);
export const clinicStartOfTodayIso = () => clinicLocalToIso(`${clinicToday()}T00:00`);
