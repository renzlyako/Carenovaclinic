export const CLINIC_TIME_ZONE = "Asia/Manila";
const OFFSET_MS = 8 * 60 * 60 * 1000;


export function clinicLocalToIso(value) {
  return new Date(`${value}:00+08:00`).toISOString();
}

export function isoToClinicLocal(iso) {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

export const clinicNowLocal = () => isoToClinicLocal(new Date().toISOString());
export const clinicToday = () => clinicNowLocal().slice(0, 10);
export const clinicStartOfTodayIso = () => clinicLocalToIso(`${clinicToday()}T00:00`);
