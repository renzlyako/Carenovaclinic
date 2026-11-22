import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// For events that a database trigger cannot catch:
// LOGIN, LOGIN_FAILED, LOGOUT, BACKUP, RESTORE, etc.
// INSERT / UPDATE / DELETE on tables are logged automatically by DB triggers.
export async function logAuditEvent({ userId = null, userEmail = null, action, details = null }) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    user_id: userId,
    user_email: userEmail,
    action,
    details,
  });
  if (error) console.error("Audit log failed:", error.message);
}
