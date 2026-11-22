import Link from "next/link";
import Form from "next/form";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { INVOICE_STATUS } from "@/lib/constants/status";
import { listInvoices, INVOICES_PAGE_SIZE } from "@/services/billing.service";
import { INVOICE_LABEL, INVOICE_TONE, balanceOf } from "@/lib/utils/billing";
import { fullName } from "@/lib/utils/patient";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import LinkButton from "@/components/ui/LinkButton";
import Pagination from "@/components/ui/Pagination";
import { Eye, FilePlus, RotateCcw } from "lucide-react";

export const metadata = { title: "Billing | CareNova" };

export default async function BillingPage({ searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR]);
  const sp = await searchParams;
  const canEdit = user.role !== ROLES.DOCTOR;

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 30) : "";
  const status = INVOICE_STATUS.includes(sp.status) ? sp.status : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const { data, count, outOfRange } = await listInvoices({ q, status, page });
  if (outOfRange) {
    const p = new URLSearchParams({ ...(q && { q }), ...(status && { status }) });
    redirect(`/billing${p.toString() ? `?${p}` : ""}`);
  }

  const columns = [
    {
      key: "invoice_no", header: "Invoice No.",
      render: (i) => <Link href={`/billing/${i.id}`} className="font-medium text-brand-700 hover:underline">{i.invoice_no}</Link>,
    },
    { key: "patient", header: "Patient", render: (i) => (i.patients ? fullName(i.patients) : "-") },
    { key: "created_at", header: "Date", render: (i) => formatDate(i.created_at) },
    { key: "total", header: "Total", render: (i) => formatCurrency(i.total) },
    { key: "paid", header: "Paid", render: (i) => formatCurrency(i.amount_paid) },
    { key: "balance", header: "Balance", render: (i) => (i.status === "void" ? "-" : formatCurrency(balanceOf(i))) },
    { key: "status", header: "Status", render: (i) => <Badge tone={INVOICE_TONE[i.status]}>{INVOICE_LABEL[i.status]}</Badge> },
    { key: "actions", header: "Actions", render: (i) => <LinkButton href={`/billing/${i.id}`} variant="secondary" small icon={Eye}>View</LinkButton> },
  ];

  return (
    <>
      <PageHeader
        title="Billing"
        description={canEdit ? "Invoices and payments" : "Invoices of your patients (read-only)"}
        action={canEdit ? <LinkButton href="/billing/new" icon={FilePlus}>New invoice</LinkButton> : null}
      />
      <Form action="/billing" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">Invoice number</label>
          <input id="q" name="q" defaultValue={q} placeholder="INV-000001" maxLength={30}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <div className="w-48">
          <Select label="Status" name="status" placeholder="All statuses" defaultValue={status}
            options={INVOICE_STATUS.map((s) => ({ value: s, label: INVOICE_LABEL[s] }))} />
        </div>
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
        <LinkButton href="/billing" variant="secondary" icon={RotateCcw}>Reset</LinkButton>
      </Form>

      <DataTable columns={columns} rows={data} empty="No invoices found." />
      <Pagination basePath="/billing" page={page} pageSize={INVOICES_PAGE_SIZE} total={count} params={{ q, status }} />
    </>
  );
}
