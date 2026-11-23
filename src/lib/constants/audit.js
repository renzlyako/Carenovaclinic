export const AUDIT_ACTIONS = [
  "INSERT", "UPDATE", "DELETE",
  "LOGIN", "LOGIN_FAILED", "LOGOUT",
  "ADMIN_CREATE_USER", "ADMIN_UPDATE_USER", "ADMIN_ENABLE_USER", "ADMIN_DISABLE_USER", "ADMIN_RESET_PASSWORD",
  "BACKUP", "RESTORE", "REPORT_EXPORT",
];

export const AUDIT_TABLES = [
  "profiles", "doctors", "patients", "medicines", "appointments", "consultations",
  "prescriptions", "invoices", "invoice_items", "payments",
];

export const ACTION_TONE = {
  INSERT: "green", UPDATE: "yellow", DELETE: "red",
  LOGIN: "gray", LOGOUT: "gray", LOGIN_FAILED: "red",
  BACKUP: "green", RESTORE: "red", REPORT_EXPORT: "gray",
};
