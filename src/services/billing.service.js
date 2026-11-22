import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UUID_REGEX } from "@/lib/utils/forms";

export const INVOICES_PAGE_SIZE = 10;

const PATIENT = "patients(id, patient_no, first_name, last_name)";

// RLS: admin and receptionist see all invoices; a doctor only sees invoices of their own appointments.
export async function listInvoices({ q = "", status = "", page = 1, pageSize = INVOICES_PAGE_SIZE } = {}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("invoices")
    .select(`id, invoice_no, total, amount_paid, status, created_at, ${PATIENT}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("invoice_no", `%${q.replace(/[%_,()]/g, " ")}%`);
  const { data, count, error } = await query;
  if (error?.code === "PGRST103") return { data: [], count: 0, outOfRange: true };
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0, outOfRange: false };
}

export async function getInvoice(id) {
  if (!UUID_REGEX.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`*, ${PATIENT}, appointments(id, schedule)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listInvoiceItems(invoiceId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_items")
    .select("id, description, qty, unit_price, line_total, medicine_id")
    .eq("invoice_id", invoiceId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listPayments(invoiceId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, method, reference_no, paid_at")
    .eq("invoice_id", invoiceId)
    .order("paid_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Prescriptions of this patient that are not dispensed yet (admin / receptionist only).
// Uses a database function because receptionists cannot read consultations (diagnosis is private).
export async function listPendingPrescriptions(patientId) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pending_prescriptions", { p_patient_id: patientId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// An existing, non-void invoice for an appointment (to avoid billing the same visit twice).
export async function findInvoiceForAppointment(appointmentId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id")
    .eq("appointment_id", appointmentId)
    .neq("status", "void")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createInvoice(row) {
  const supabase = await createClient();
  return supabase.from("invoices").insert(row).select("id").single();
}

export async function createInvoiceItem(row) {
  const supabase = await createClient();
  return supabase.from("invoice_items").insert(row).select("id").single();
}

// Only manual items can be removed. Medicine items were created by dispensing (the stock was already reduced).
export async function deleteManualInvoiceItem(id) {
  const supabase = await createClient();
  return supabase.from("invoice_items").delete().eq("id", id).is("medicine_id", null).select("id");
}

export async function createPayment(row) {
  const supabase = await createClient();
  return supabase.from("payments").insert(row).select("id").single();
}

// Transaction functions: each runs entirely inside the database (all-or-nothing).
export async function dispensePrescription(prescriptionId, invoiceId) {
  const supabase = await createClient();
  return supabase.rpc("dispense_prescription", { p_prescription_id: prescriptionId, p_invoice_id: invoiceId });
}

export async function voidInvoice(invoiceId) {
  const supabase = await createClient();
  return supabase.rpc("void_invoice", { p_invoice_id: invoiceId });
}
