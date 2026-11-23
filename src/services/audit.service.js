import "server-only";
import { createClient } from "@/lib/supabase/server";
import { clinicLocalToIso } from "@/lib/utils/datetime";

export const AUDIT_PAGE_SIZE = 20;

const clean = (s) => s.replace(/[%_,()\\]/g, " ").trim();


export async function listAuditLogs({ user = "", action = "", table = "", from = "", to = "", page = 1, pageSize = AUDIT_PAGE_SIZE } = {}) {
  const supabase = await createClient();
  const start = (page - 1) * pageSize;
  let q = supabase
    .from("audit_logs")
    .select("id, created_at, user_email, action, table_name, record_id, old_data, new_data, details", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + pageSize - 1);

  if (user) q = q.ilike("user_email", `%${clean(user)}%`);
  if (action) q = q.eq("action", action);
  if (table) q = q.eq("table_name", table);

  if (from) q = q.gte("created_at", clinicLocalToIso(`${from}T00:00`));
  if (to) q = q.lt("created_at", new Date(new Date(clinicLocalToIso(`${to}T00:00`)).getTime() + 86_400_000).toISOString());

  const { data, count, error } = await q;
  if (error?.code === "PGRST103") return { data: [], count: 0, outOfRange: true };
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0, outOfRange: false };
}


export async function listBackupHistory(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, created_at, user_email, action, details")
    .in("action", ["BACKUP", "RESTORE"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
