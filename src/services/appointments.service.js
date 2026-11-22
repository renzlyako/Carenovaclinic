import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UUID_REGEX } from "@/lib/utils/forms";
import { clinicStartOfTodayIso } from "@/lib/utils/datetime";

export const APPOINTMENTS_PAGE_SIZE = 10;

const LIST_SELECT =
  "id, schedule, status, reason, patients(id, patient_no, first_name, last_name), doctors(id, specialization, profiles(full_name))";

// List with filters + pagination. Row Level Security decides what the user can see
// (doctors only get their own appointments).
// when: "upcoming" (today onwards, soonest first) | "past" (before today, latest first) | "all"
export async function listAppointments({ when = "upcoming", status = "", doctorId = "", page = 1, pageSize = APPOINTMENTS_PAGE_SIZE } = {}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const startOfToday = clinicStartOfTodayIso();

  let query = supabase.from("appointments").select(LIST_SELECT, { count: "exact" });
  if (when === "upcoming") query = query.gte("schedule", startOfToday).order("schedule", { ascending: true });
  else if (when === "past") query = query.lt("schedule", startOfToday).order("schedule", { ascending: false });
  else query = query.order("schedule", { ascending: false });

  if (status) query = query.eq("status", status);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error?.code === "PGRST103") return { data: [], count: 0, outOfRange: true };
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0, outOfRange: false };
}

export async function getAppointment(id) {
  if (!UUID_REGEX.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, patient_no, first_name, last_name, contact_no), doctors(id, specialization, profiles(full_name)), consultations(id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Options for the <select> fields in the form.
export async function listPatientOptions(limit = 500) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, patient_no, first_name, last_name")
    .order("last_name")
    .order("first_name")
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listDoctorOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctors")
    .select("id, specialization, profiles!inner(full_name, is_active)")
    .eq("profiles.is_active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).sort((a, b) => a.profiles.full_name.localeCompare(b.profiles.full_name));
}

// The functions below return { data, error } so the Server Action can show a friendly message.
export async function createAppointment(row) {
  const supabase = await createClient();
  return supabase.from("appointments").insert(row).select("id").single();
}

export async function updateAppointment(id, row) {
  const supabase = await createClient();
  return supabase.from("appointments").update(row).eq("id", id).select("id");
}

// Only a scheduled appointment can move to completed / cancelled / no_show.
export async function changeStatusFromScheduled(id, status) {
  const supabase = await createClient();
  return supabase.from("appointments").update({ status }).eq("id", id).eq("status", "scheduled").select("id");
}

export async function deleteAppointment(id) {
  const supabase = await createClient();
  return supabase.from("appointments").delete().eq("id", id).select("id");
}
