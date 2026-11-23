import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
