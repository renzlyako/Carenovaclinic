import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UUID_REGEX } from "@/lib/utils/forms";
import { clinicLocalToIso, clinicToday } from "@/lib/utils/datetime";

export const CONSULTATIONS_PAGE_SIZE = 10;

const APPT = "appointments(id, schedule, status, patients(id, patient_no, first_name, last_name), doctors(id, specialization, profiles(full_name)))";

// Row Level Security decides what is visible: doctors only see consultations of their own
// appointments, admins see all, receptionists see none.
export async function listConsultations({ page = 1, pageSize = CONSULTATIONS_PAGE_SIZE } = {}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase
    .from("consultations")
    .select(`id, diagnosis, created_at, ${APPT}, prescriptions(id)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error?.code === "PGRST103") return { data: [], count: 0, outOfRange: true };
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0, outOfRange: false };
}

export async function getConsultation(id) {
  if (!UUID_REGEX.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultations")
    .select(`id, appointment_id, diagnosis, notes, created_at, updated_at, ${APPT}`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getConsultationByAppointment(appointmentId) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("consultations").select("id").eq("appointment_id", appointmentId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listPrescriptions(consultationId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescriptions")
    .select("id, dosage, qty, dispensed_at, created_at, medicines(id, name, unit_price)")
    .eq("consultation_id", consultationId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Medicines a doctor can choose from (active only).
export async function listMedicineOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medicines")
    .select("id, name, stock_qty, unit_price")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Appointments (up to the end of today) that are scheduled or completed but have no consultation yet.
export async function listAwaitingConsultation(limit = 20) {
  const supabase = await createClient();
  const endOfToday = clinicLocalToIso(`${clinicToday()}T23:59`);
  const { data, error } = await supabase
    .from("appointments")
    .select("id, schedule, status, reason, patients(id, patient_no, first_name, last_name), consultations(id)")
    .in("status", ["scheduled", "completed"])
    .lte("schedule", endOfToday)
    .order("schedule", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((a) => !(Array.isArray(a.consultations) ? a.consultations.length : a.consultations)).slice(0, limit);
}

// { data, error } style so Server Actions can show friendly messages.
export async function createConsultation(row) {
  const supabase = await createClient();
  return supabase.from("consultations").insert(row).select("id").single();
}

export async function updateConsultation(id, row) {
  const supabase = await createClient();
  return supabase.from("consultations").update(row).eq("id", id).select("id");
}

export async function deleteConsultation(id) {
  const supabase = await createClient();
  return supabase.from("consultations").delete().eq("id", id).select("id");
}

export async function createPrescription(row) {
  const supabase = await createClient();
  return supabase.from("prescriptions").insert(row).select("id").single();
}

export async function deletePrescription(id) {
  const supabase = await createClient();
  return supabase.from("prescriptions").delete().eq("id", id).select("id");
}
