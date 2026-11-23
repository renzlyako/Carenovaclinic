import Link from "next/link";
import Form from "next/form";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { reportQuerySchema } from "@/lib/validators/report";
import { REPORTS, reportsFor, runReport, resolveRange } from "@/services/reports.service";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import Input from "@/components/ui/Input";
import LinkButton from "@/components/ui/LinkButton";
import { CalendarDays } from "lucide-react";

export const metadata = { title: "Reports | CareNova" };

export default async function ReportsPage({ searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST]);
  const sp = await searchParams;
  const available = reportsFor(user.role);

  const type = available.some((r) => r.key === sp.type) ? sp.type : available[0].key;
  const def = REPORTS[type];
  const parsed = reportQuerySchema.safeParse({
    type,
    from: typeof sp.from === "string" ? sp.from : "",
    to: typeof sp.to === "string" ? sp.to : "",
  });
  const dateError = parsed.success ? null : parsed.error.issues[0].message;
  const { from, to } = resolveRange(parsed.success ? parsed.data : {});

  const { rows } = dateError ? { rows: [] } : await runReport(type, { from, to });

  const columns = def.columns.map((c) => ({
    key: c.key,
    header: c.header.replace(" (PHP)", ""),
    render: (r) => (def.moneyKeys?.includes(c.key) ? formatCurrency(r[c.key]) : r[c.key]),
  }));

  const total = def.moneyKeys?.includes("total") && type === "daily_collection"
    ? rows.reduce((s, r) => s + Number(r.total), 0)
    : null;

  const exportQuery = new URLSearchParams({ type, format: "csv", ...(def.usesDates && { from, to }) });

  return (
    <>
      <PageHeader title="Reports" description={def.description} />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Report types">
        {available.map((r) => (
          <Link
            key={r.key}
            href={`/reports?type=${r.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              r.key === type ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {r.title}
          </Link>
        ))}
      </nav>

      <Card title={def.title}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          {def.usesDates ? (
            <Form action="/reports" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="type" value={type} />
              <Input label="From" name="from" type="date" defaultValue={from} />
              <Input label="To" name="to" type="date" defaultValue={to} />
              <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
              <LinkButton href={`/reports?type=${type}`} variant="secondary" icon={CalendarDays}>This month</LinkButton>
            </Form>
          ) : <span />}
          {}
          <a
            href={`/api/reports?${exportQuery.toString()}`}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </a>
        </div>

        {dateError && <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dateError}</p>}

        <DataTable columns={columns} rows={rows} empty="No data for this report." />
        {total !== null && rows.length > 0 && (
          <p className="mt-3 text-right text-sm font-semibold text-slate-800">Total collected: {formatCurrency(total)}</p>
        )}
      </Card>
    </>
  );
}
