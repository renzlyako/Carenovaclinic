import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UUID_REGEX } from "@/lib/utils/forms";

export const MEDICINES_PAGE_SIZE = 10;

// Everyone who is logged in can read medicines; only admins can change them (RLS).
// filter: "" (all) | "low" (active and stock <= reorder level) | "inactive"
export async function listMedicines({ q = "", filter = "", page = 1, pageSize = MEDICINES_PAGE_SIZE } = {}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;

  if (filter === "low") {
    // "stock <= reorder level" compares two columns, so filter in code (the table is small).
    let query = supabase.from("medicines").select("*").eq("is_active", true).order("stock_qty").limit(1000);
    if (q) query = query.ilike("name", `%${q.replace(/[%_,()]/g, " ")}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const low = (data ?? []).filter((m) => m.stock_qty <= m.reorder_level);
    if (from >= low.length && low.length > 0) return { data: [], count: low.length, outOfRange: true };
    return { data: low.slice(from, from + pageSize), count: low.length, outOfRange: false };
  }

  let query = supabase.from("medicines").select("*", { count: "exact" }).order("name").range(from, from + pageSize - 1);
  if (filter === "inactive") query = query.eq("is_active", false);
  if (q) query = query.ilike("name", `%${q.replace(/[%_,()]/g, " ")}%`);
  const { data, count, error } = await query;
  if (error?.code === "PGRST103") return { data: [], count: 0, outOfRange: true };
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0, outOfRange: false };
}

export async function getMedicine(id) {
  if (!UUID_REGEX.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("medicines").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createMedicine(row) {
  const supabase = await createClient();
  return supabase.from("medicines").insert(row).select("id").single();
}

export async function updateMedicine(id, row) {
  const supabase = await createClient();
  return supabase.from("medicines").update(row).eq("id", id).select("id");
}

export async function deleteMedicine(id) {
  const supabase = await createClient();
  return supabase.from("medicines").delete().eq("id", id).select("id");
}
