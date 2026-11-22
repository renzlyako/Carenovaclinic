import Form from "next/form";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { AUDIT_ACTIONS, AUDIT_TABLES, ACTION_TONE } from "@/lib/constants/audit";
import { auditQuerySchema } from "@/lib/validators/audit";
import { listAuditLogs, AUDIT_PAGE_SIZE } from "@/services/audit.service";
import { changedFields, displayValue, shortId } from "@/lib/utils/audit";
import { formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import LinkButton from "@/components/ui/LinkButton";
import Pagination from "@/components/ui/Pagination";
import { RotateCcw } from "lucide-react";

export const metadata = { title: "Audit Logs | CareNova" };

function DataBlock({ title, data }) {
  if (!data) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-2 text-xs text-slate-700">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function Details({ log }) {
  const changes = log.action === "UPDATE" ? changedFields(log.old_data, log.new_data) : [];
  const hasData = log.old_data || log.new_data || log.details;
  if (!hasData) return <span className="text-slate-400">-</span>;

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-brand-700 hover:underline">
        {log.action === "UPDATE" && changes.length > 0 ? `${changes.length} field${changes.length > 1 ? "s" : ""} changed` : "View"}
      </summary>
      <div className="mt-2 space-y-3 rounded-md border border-slate-200 bg-white p-3">
        {changes.length > 0 && (
          <ul className="space-y-1 text-xs">
            {changes.map((c) => (
              <li key={c.key}>
                <span className="font-medium text-slate-700">{c.key}:</span>{" "}
                <span className="text-red-700 line-through">{displayValue(c.from)}</span> →{" "}
                <span className="text-green-700">{displayValue(c.to)}</span>
              </li>
            ))}
          </ul>
        )}
        {log.action !== "UPDATE" && <DataBlock title={log.action === "DELETE" ? "Deleted record" : "Record"} data={log.new_data ?? log.old_data} />}
        {log.action === "UPDATE" && <DataBlock title="Full new record" data={log.new_data} />}
        <DataBlock title="Details" data={log.details} />
      </div>
    </details>
  );
}

export default async function AuditLogsPage({ searchParams }) {
  await requireRole([ROLES.ADMIN]);
  const sp = await searchParams;
  const str = (k) => (typeof sp[k] === "string" ? sp[k] : "");

  const parsed = auditQuerySchema.safeParse({ user: str("user"), action: str("action"), table: str("table"), from: str("from"), to: str("to") });
  const filterError = parsed.success ? null : parsed.error.issues[0].message;
  const f = parsed.success ? parsed.data : { user: "", action: "", table: "", from: "", to: "" };
  const page = Math.max(1, parseInt(str("page") || "1", 10) || 1);

  const { data, count, outOfRange } = filterError ? { data: [], count: 0, outOfRange: false } : await listAuditLogs({ ...f, page });
  if (outOfRange) {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    redirect(`/admin/audit-logs${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Who did what, and when. This trail is append-only: entries cannot be edited or deleted, not even by an admin."
      />

      <Form action="/admin/audit-logs" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <Input label="User email" name="user" placeholder="Search by email" maxLength={100} defaultValue={f.user} />
        <Select label="Action" name="action" placeholder="All actions" options={AUDIT_ACTIONS.map((a) => ({ value: a, label: a }))} defaultValue={f.action} />
        <Select label="Table" name="table" placeholder="All tables" options={AUDIT_TABLES.map((t) => ({ value: t, label: t }))} defaultValue={f.table} />
        <Input label="From" name="from" type="date" defaultValue={f.from} />
        <Input label="To" name="to" type="date" defaultValue={f.to} />
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <LinkButton href="/admin/audit-logs" variant="secondary" icon={RotateCcw}>Reset</LinkButton>
        </div>
      </Form>

      {filterError && <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{filterError}</p>}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Table</th>
                <th className="px-3 py-2 font-medium">Record</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No log entries found.</td></tr>
              ) : data.map((log) => (
                <tr key={log.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(log.created_at)}</td>
                  <td className="px-3 py-2">{log.user_email ?? <span className="text-slate-400">system</span>}</td>
                  <td className="px-3 py-2"><Badge tone={ACTION_TONE[log.action] ?? "gray"}>{log.action}</Badge></td>
                  <td className="px-3 py-2">{log.table_name ?? "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs" title={log.record_id ?? ""}>{shortId(log.record_id)}</td>
                  <td className="px-3 py-2"><Details log={log} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination basePath="/admin/audit-logs" page={page} pageSize={AUDIT_PAGE_SIZE} total={count} params={f} />
    </>
  );
}
