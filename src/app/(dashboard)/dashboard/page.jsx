import { CalendarCheck, Users, Banknote, Receipt, Pill, Package } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { getDashboardData } from "@/services/dashboard.service";
import { formatCurrency } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LinkButton from "@/components/ui/LinkButton";
import KpiCard from "@/components/dashboard/KpiCard";
import LineChartCard from "@/components/charts/LineChartCard";
import BarChartCard from "@/components/charts/BarChartCard";
import PieChartCard from "@/components/charts/PieChartCard";

export const metadata = { title: "Dashboard | CareNova" };

export default async function DashboardPage() {
  const user = await requireRole(Object.values(ROLES));
  const d = await getDashboardData(user.role);
  const frontDesk = user.role !== ROLES.DOCTOR;
  const isDoctor = user.role === ROLES.DOCTOR;
  const { kpis } = d;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={isDoctor ? "Overview of your appointments and patients" : "Overview of clinic operations"}
      />

      <div className={`grid gap-4 sm:grid-cols-2 ${frontDesk ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}>
        <KpiCard label="Appointments today" value={kpis.appointmentsToday} icon={CalendarCheck} tone="brand" />
        <KpiCard label={isDoctor ? "My patients" : "Total patients"} value={kpis.totalPatients} icon={Users} tone="blue" />
        {frontDesk && <KpiCard label="Revenue this month" value={formatCurrency(kpis.revenueThisMonth)} icon={Banknote} tone="violet" />}
        {frontDesk && <KpiCard label="Unpaid invoices" value={kpis.unpaidInvoices} icon={Receipt} tone="amber" />}
        <KpiCard label="Low-stock medicines" value={kpis.lowStockMedicines} icon={Pill} tone={kpis.lowStockMedicines > 0 ? "red" : "brand"} hintTone={kpis.lowStockMedicines > 0 ? "bad" : undefined} hint={kpis.lowStockMedicines > 0 ? "Needs restocking" : "Stock levels are fine"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LineChartCard title="Appointments per day (last 7 and next 7 days)" data={d.appointmentsPerDay} />
        <PieChartCard title="Appointments by status" data={d.appointmentStatus} />
        {frontDesk && <BarChartCard title="Revenue per month (last 6 months)" data={d.revenueMonthly} prefix="₱" />}
        {user.role !== ROLES.RECEPTIONIST && (
          <BarChartCard title="Top diagnoses" data={d.topDiagnoses} horizontal />
        )}
      </div>

      <Card title="Low-stock medicines" className="mt-6" action={<LinkButton href="/medicines?filter=low" variant="secondary" small icon={Package}>View all</LinkButton>}>
        {d.lowStock.length === 0 ? (
          <p className="text-sm text-slate-500">All medicines are above their reorder level.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.lowStock.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-800">{m.name}</span>
                <span className="flex items-center gap-2 text-slate-600">
                  {m.stock_qty} left (reorder at {m.reorder_level}) <Badge tone="red">Low</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
