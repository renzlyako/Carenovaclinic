import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants/roles";
import { clinicToday } from "@/lib/utils/datetime";
import { STATUS_LABEL } from "@/lib/utils/appointment";
import { INVOICE_LABEL, METHOD_LABEL, balanceOf } from "@/lib/utils/billing";
import { fullName } from "@/lib/utils/patient";

const ADMIN_AND_FRONT = [ROLES.ADMIN, ROLES.RECEPTIONIST];

async function read(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const money = (n) => Number(n ?? 0).toFixed(2);

// Each report: who may open it, its columns, and a function that returns plain rows.
// Rows hold raw values (used for the CSV); the page formats money in the table.
export const REPORTS = {
  daily_collection: {
    title: "Daily collection",
    description: "Payments received per day and payment method",
    roles: ADMIN_AND_FRONT,
    usesDates: true,
    moneyKeys: ["total"],
    columns: [
      { key: "day", header: "Date" },
      { key: "method", header: "Method" },
      { key: "payments", header: "No. of payments" },
      { key: "total", header: "Total (PHP)" },
    ],
    async run(supabase, { from, to }) {
      const rows = await read(
        supabase.from("v_daily_collection").select("*").gte("day", from).lte("day", to).order("day", { ascending: false }).limit(2000)
      );
      return rows.map((r) => ({ day: r.day, method: METHOD_LABEL[r.method] ?? r.method, payments: r.payments, total: money(r.total) }));
    },
  },
  outstanding_invoices: {
    title: "Outstanding balances",
    description: "Invoices that are unpaid or partially paid",
    roles: ADMIN_AND_FRONT,
    moneyKeys: ["total", "paid", "balance"],
    columns: [
      { key: "invoice_no", header: "Invoice No." },
      { key: "patient", header: "Patient" },
      { key: "date", header: "Date" },
      { key: "status", header: "Status" },
      { key: "total", header: "Total (PHP)" },
      { key: "paid", header: "Paid (PHP)" },
      { key: "balance", header: "Balance (PHP)" },
    ],
    async run(supabase) {
      const rows = await read(
        supabase
          .from("invoices")
          .select("invoice_no, status, total, amount_paid, created_at, patients(first_name, last_name)")
          .in("status", ["unpaid", "partial"])
          .gt("total", 0)
          .order("created_at")
          .limit(2000)
      );
      return rows.map((i) => ({
        invoice_no: i.invoice_no,
        patient: i.patients ? fullName(i.patients) : "-",
        date: String(i.created_at).slice(0, 10),
        status: INVOICE_LABEL[i.status],
        total: money(i.total),
        paid: money(i.amount_paid),
        balance: money(balanceOf(i)),
      }));
    },
  },
  patients_per_doctor: {
    title: "Patients per doctor",
    description: "Distinct patients and appointments for each doctor (cancelled appointments are not counted)",
    roles: ADMIN_AND_FRONT,
    columns: [
      { key: "doctor_name", header: "Doctor" },
      { key: "patients", header: "Patients" },
      { key: "appointments", header: "Appointments" },
    ],
    async run(supabase) {
      return read(supabase.from("v_patients_per_doctor").select("doctor_name, patients, appointments").order("doctor_name"));
    },
  },
  appointment_status: {
    title: "Appointments by status",
    description: "How many appointments are scheduled, completed, cancelled or no-show",
    roles: ADMIN_AND_FRONT,
    columns: [
      { key: "status", header: "Status" },
      { key: "total", header: "Appointments" },
    ],
    async run(supabase) {
      const rows = await read(supabase.from("v_appointment_status_counts").select("*"));
      return rows.map((r) => ({ status: STATUS_LABEL[r.status] ?? r.status, total: r.total }));
    },
  },
  top_diagnoses: {
    title: "Top diagnoses",
    description: "The 10 most common diagnoses (admin only, because consultations are confidential)",
    roles: [ROLES.ADMIN],
    columns: [
      { key: "diagnosis", header: "Diagnosis" },
      { key: "total", header: "Cases" },
    ],
    async run(supabase) {
      return read(supabase.from("v_top_diagnoses").select("diagnosis, total"));
    },
  },
  low_stock: {
    title: "Low-stock medicines",
    description: "Active medicines at or below their reorder level",
    roles: ADMIN_AND_FRONT,
    columns: [
      { key: "name", header: "Medicine" },
      { key: "stock_qty", header: "In stock" },
      { key: "reorder_level", header: "Reorder level" },
    ],
    async run(supabase) {
      return read(supabase.from("v_low_stock_medicines").select("name, stock_qty, reorder_level"));
    },
  },
};

export const reportsFor = (role) => Object.entries(REPORTS).filter(([, r]) => r.roles.includes(role)).map(([key, r]) => ({ key, ...r }));

// Defaults: from the first day of this month until today (clinic time).
export function resolveRange({ from, to }) {
  const today = clinicToday();
  return { from: from || `${today.slice(0, 8)}01`, to: to || today };
}

export async function runReport(type, { from = "", to = "" } = {}) {
  const def = REPORTS[type];
  const range = resolveRange({ from, to });
  const supabase = await createClient();
  const rows = await def.run(supabase, range);
  return { def, rows, range };
}
