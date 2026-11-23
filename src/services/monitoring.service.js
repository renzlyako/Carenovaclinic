import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";


export const MONITORED_TABLES = [
  "profiles", "doctors", "patients", "appointments", "consultations",
  "prescriptions", "medicines", "invoices", "invoice_items", "payments", "audit_logs",
];

export async function getRecordStats() {
  const admin = createAdminClient();
  return Promise.all(
    MONITORED_TABLES.map(async (table) => {
      const [{ count, error }, last] = await Promise.all([
        admin.from(table).select("*", { count: "exact", head: true }),
        table === "audit_logs"
          ? Promise.resolve({ data: null })
          : admin.from("audit_logs").select("created_at").eq("table_name", table)
              .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { table, count: error ? null : count, lastChange: last.data?.created_at ?? null };
    })
  );
}
