import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { listBackupHistory } from "@/services/audit.service";
import { getRecordStats } from "@/services/monitoring.service";
import { formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import BackupPanel from "@/components/admin/BackupPanel";
import { Download } from "lucide-react";

export const metadata = { title: "Backup & Restore | CareNova" };

export default async function BackupPage() {
  await requireRole([ROLES.ADMIN]);
  const [history, stats] = await Promise.all([listBackupHistory(10), getRecordStats()]);

  return (
    <>
      <PageHeader title="Backup & Restore" description="Protect the clinic data against mistakes and failures" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Create a backup">
          <p className="text-sm text-slate-600">
            Downloads one JSON file with all clinic data: patients, appointments, consultations, medicines, prescriptions,
            invoices, items and payments (plus the list of accounts, for reference).
          </p>
          <p className="mt-2 text-sm text-slate-600">
            The file contains confidential patient information. Store it securely and never share it.
          </p>
          {}
          <a
            href="/api/admin/backup"
            className="mt-4 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <Download size={16} className="mr-2" aria-hidden="true" />
            Download backup
          </a>
        </Card>

        <Card title="Restore from a backup file">
          <BackupPanel />
        </Card>
      </div>

      <Card title="Record monitoring" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2 pr-4">Table</th><th className="py-2 pr-4">Records</th><th className="py-2">Last recorded change</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.map((s) => (
                <tr key={s.table}>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-700">{s.table}</td>
                  <td className="py-2 pr-4 text-slate-900">{s.count ?? "n/a"}</td>
                  <td className="py-2 text-slate-500">{s.lastChange ? formatDateTime(s.lastChange) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Backup history" className="mt-4">
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No backups have been made yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone={h.action === "RESTORE" ? "red" : "green"}>{h.action === "RESTORE" ? "Restore" : "Backup"}</Badge>
                  <span className="text-slate-700">{h.user_email ?? "system"}</span>
                </span>
                <span className="text-slate-500">{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          For a full database copy (including accounts), use the command-line scripts <code>scripts/backup.sh</code> and <code>scripts/restore.sh</code>.
        </p>
      </Card>
    </>
  );
}
