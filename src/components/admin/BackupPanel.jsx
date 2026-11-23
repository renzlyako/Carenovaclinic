"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { RotateCcw } from "lucide-react";

const LABELS = {
  patients: "Patients", medicines: "Medicines", appointments: "Appointments", consultations: "Consultations",
  prescriptions: "Prescriptions", invoices: "Invoices", invoice_items: "Invoice items", payments: "Payments",
};

export default function BackupPanel() {
  const [file, setFile] = useState(null);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null); 

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!file || confirm !== "RESTORE") return;
    setPending(true);
    setResult(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("confirm", confirm);
      const res = await fetch("/api/admin/restore", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      setResult(res.ok ? { restored: json.restored } : { error: json.error ?? "The restore failed. No data was changed." });
      if (res.ok) { setFile(null); setConfirm(""); form.reset(); }
    } catch {
      setResult({ error: "Could not reach the server. No data was changed." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <strong>Warning:</strong> restoring replaces ALL current patients, appointments, consultations, medicines,
        invoices and payments with the content of the file. It runs as one transaction: if anything goes wrong,
        nothing is changed. User accounts and the audit trail are never touched. Download a fresh backup first.
      </div>

      <div>
        <label htmlFor="backup-file" className="mb-1 block text-sm font-medium text-slate-700">Backup file (.json)</label>
        <input
          id="backup-file" type="file" accept="application/json,.json" required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full max-w-md text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
        />
      </div>

      <div>
        <label htmlFor="restore-confirm" className="mb-1 block text-sm font-medium text-slate-700">Type RESTORE to confirm</label>
        <input
          id="restore-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off"
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <Button type="submit" variant="danger" icon={RotateCcw} disabled={pending || !file || confirm !== "RESTORE"}>
        {pending ? "Restoring..." : "Restore from file"}
      </Button>

      {result?.error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>}
      {result?.restored && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <p className="font-medium">Restore completed.</p>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {Object.entries(result.restored).map(([t, n]) => <li key={t}>{LABELS[t] ?? t}: {n}</li>)}
          </ul>
        </div>
      )}
    </form>
  );
}
