import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UUID_REGEX } from "@/lib/utils/forms";

export const PATIENTS_PAGE_SIZE = 10;

const LIST_COLUMNS = "id, patient_no, first_name, last_name, sex, birthdate, contact_no, created_at";


const sanitizeSearch = (q) => q.replace(/[,()%*\\"]/g, " ").trim();

export async function listPatients({ q = "", page = 1, pageSize = PATIENTS_PAGE_SIZE } = {}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("patients")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("patient_seq", { ascending: false })
    .range(from, from + pageSize - 1);


  const tokens = sanitizeSearch(q).split(/\s+/).filter(Boolean).slice(0, 4);
  for (const token of tokens) {
    query = query.or(
      `first_name.ilike.%${token}%,last_name.ilike.%${token}%,patient_no.ilike.%${token}%`
    );
  }

  const { data, count, error } = await query;


  if (error?.code === "PGRST103") return { data: [], count: 0, outOfRange: true };
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0, outOfRange: false };
}


export async function getPatient(id) {
  if (!UUID_REGEX.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPatientAppointments(patientId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, schedule, status, reason, doctors(id, profiles(full_name))")
    .eq("patient_id", patientId)
    .order("schedule", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}


export async function createPatient(row) {
  const supabase = await createClient();
  return supabase.from("patients").insert(row).select("id").single();
}

export async function updatePatient(id, row) {
  const supabase = await createClient();
  return supabase.from("patients").update(row).eq("id", id).select("id");
}

export async function deletePatient(id) {
  const supabase = await createClient();
  return supabase.from("patients").delete().eq("id", id).select("id");
}
