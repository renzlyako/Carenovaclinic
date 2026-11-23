

export const BACKUP_APP = "CareNova";
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_BACKUP_ROWS = 200_000;


export const BACKUP_TABLES = [
  "profiles", "doctors", "patients", "medicines",
  "appointments", "consultations", "prescriptions",
  "invoices", "invoice_items", "payments",
];
export const RESTORE_TABLES = [
  "patients", "medicines", "appointments", "consultations",
  "prescriptions", "invoices", "invoice_items", "payments",
];


export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "This file is not valid JSON. Please choose a backup file created by CareNova." };
  }
  if (!json || typeof json !== "object" || Array.isArray(json) || json.app !== BACKUP_APP) {
    return { error: "This is not a CareNova backup file." };
  }
  if (json.format_version !== BACKUP_FORMAT_VERSION) {
    return { error: "This backup was made by a different version and cannot be restored." };
  }
  if (!json.tables || typeof json.tables !== "object" || Array.isArray(json.tables)) {
    return { error: "The backup file has no table data." };
  }

  const tables = {};
  const counts = {};
  let total = 0;
  for (const t of RESTORE_TABLES) {
    const rows = json.tables[t];
    if (!Array.isArray(rows)) return { error: `The backup file is missing the “${t}” table.` };
    if (rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) return { error: `The “${t}” table contains an invalid row.` };
    tables[t] = rows;
    counts[t] = rows.length;
    total += rows.length;
  }
  if (total > MAX_BACKUP_ROWS) return { error: "The backup is too large to restore from the app." };
  return { tables, counts, createdAt: typeof json.created_at === "string" ? json.created_at : null };
}
