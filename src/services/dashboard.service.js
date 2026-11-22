import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants/roles";
import { clinicToday } from "@/lib/utils/datetime";
import { fillDays, fillMonths } from "@/lib/utils/charts";
import { STATUS_LABEL } from "@/lib/utils/appointment";

// All numbers come from SQL views (security_invoker = true), so Row Level Security applies:
// a doctor only gets figures about their own appointments.
async function read(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getDashboardData(role) {
  const supabase = await createClient();
  const frontDesk = role === ROLES.ADMIN || role === ROLES.RECEPTIONIST;
  const today = clinicToday();

  const [kpis, perDay, status, revenue, diagnoses, lowStock] = await Promise.all([
    read(supabase.from("v_dashboard_kpis").select("*").single()),
    read(supabase.from("v_appointments_per_day").select("*")),
    read(supabase.from("v_appointment_status_counts").select("*")),
    frontDesk ? read(supabase.from("v_revenue_monthly").select("*")) : Promise.resolve([]),
    role === ROLES.RECEPTIONIST ? Promise.resolve([]) : read(supabase.from("v_top_diagnoses").select("*").limit(5)),
    read(supabase.from("v_low_stock_medicines").select("*").limit(8)),
  ]);

  return {
    kpis: {
      appointmentsToday: kpis.appointments_today,
      totalPatients: kpis.total_patients,
      revenueThisMonth: Number(kpis.revenue_this_month),
      unpaidInvoices: kpis.unpaid_invoices,
      lowStockMedicines: kpis.low_stock_medicines,
    },
    appointmentsPerDay: fillDays(perDay, today),
    appointmentStatus: status.map((s) => ({ label: STATUS_LABEL[s.status] ?? s.status, value: s.total })),
    revenueMonthly: fillMonths(revenue, today),
    topDiagnoses: diagnoses.map((d) => ({ label: d.diagnosis, value: d.total })),
    lowStock,
  };
}
