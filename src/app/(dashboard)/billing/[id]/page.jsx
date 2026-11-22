import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import {
  getInvoice, listInvoiceItems, listPayments, listPendingPrescriptions,
} from "@/services/billing.service";
import {
  addInvoiceItemAction, removeInvoiceItemAction, recordPaymentAction, dispenseAction, voidInvoiceAction,
} from "@/actions/billing.actions";
import { INVOICE_LABEL, INVOICE_TONE, METHOD_LABEL, balanceOf, isOpen } from "@/lib/utils/billing";
import { fullName } from "@/lib/utils/patient";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import LinkButton from "@/components/ui/LinkButton";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import ItemForm from "@/components/billing/ItemForm";
import PaymentForm from "@/components/billing/PaymentForm";
import DispenseButton from "@/components/billing/DispenseButton";
import { ArrowLeft } from "lucide-react";

const FLASH = {
  created: "Invoice created.",
  item_removed: "Item removed.",
  dispensed: "Medicine dispensed. Stock was reduced and the item was added to the invoice.",
  voided: "Invoice voided.",
};

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children ?? "-"}</dd>
    </div>
  );
}

export default async function InvoiceDetailPage({ params, searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR]);
  const { id } = await params;
  const sp = await searchParams;

  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const canEdit = user.role !== ROLES.DOCTOR;
  const open = isOpen(invoice);
  const balance = balanceOf(invoice);

  const [items, payments, pending] = await Promise.all([
    listInvoiceItems(id),
    listPayments(id),
    canEdit && open ? listPendingPrescriptions(invoice.patient_id) : Promise.resolve([]),
  ]);

  const itemColumns = [
    { key: "description", header: "Description" },
    { key: "qty", header: "Qty" },
    { key: "unit_price", header: "Unit price", render: (i) => formatCurrency(i.unit_price) },
    { key: "line_total", header: "Total", render: (i) => formatCurrency(i.line_total) },
    ...(canEdit && open ? [{
      key: "actions", header: "Actions",
      render: (i) => i.medicine_id ? <span className="text-xs text-slate-400">Dispensed</span> : (
        <ConfirmDeleteButton
          small label="Remove"
          action={removeInvoiceItemAction.bind(null, id, i.id)}
          title="Remove this item?" message={`${i.description} will be removed from the invoice.`} confirmLabel="Yes, remove"
        />
      ),
    }] : []),
  ];

  const paymentColumns = [
    { key: "paid_at", header: "Date", render: (p) => formatDateTime(p.paid_at) },
    { key: "amount", header: "Amount", render: (p) => formatCurrency(p.amount) },
    { key: "method", header: "Method", render: (p) => METHOD_LABEL[p.method] },
    { key: "reference_no", header: "Reference", render: (p) => p.reference_no ?? "-" },
  ];

  const pendingColumns = [
    { key: "medicine_name", header: "Medicine" },
    { key: "dosage", header: "Dosage" },
    { key: "qty", header: "Qty" },
    { key: "stock_qty", header: "In stock", render: (r) => (r.stock_qty < r.qty ? <span className="text-red-600">{r.stock_qty} (not enough)</span> : r.stock_qty) },
    { key: "price", header: "Price", render: (r) => formatCurrency(Number(r.unit_price) * r.qty) },
    {
      key: "actions", header: "",
      render: (r) => (
        <DispenseButton
          action={dispenseAction.bind(null, id, r.prescription_id)}
          disabled={!r.is_active || r.stock_qty < r.qty}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={invoice.invoice_no}
        description={invoice.patients ? fullName(invoice.patients) : ""}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/billing" variant="secondary" icon={ArrowLeft}>Back to list</LinkButton>
            {user.role === ROLES.ADMIN && invoice.status !== "void" && Number(invoice.amount_paid) === 0 && (
              <ConfirmDeleteButton
                label="Void invoice"
                action={voidInvoiceAction.bind(null, id)}
                title="Void this invoice?"
                message="A void invoice is kept for the record but can no longer be changed or paid. This cannot be undone."
                confirmLabel="Yes, void it"
              />
            )}
          </div>
        }
      />
      <FlashMessage code={sp.msg} messages={FLASH} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Invoice">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Status"><Badge tone={INVOICE_TONE[invoice.status]}>{INVOICE_LABEL[invoice.status]}</Badge></Detail>
            <Detail label="Date">{formatDate(invoice.created_at)}</Detail>
            <Detail label="Total">{formatCurrency(invoice.total)}</Detail>
            <Detail label="Paid">{formatCurrency(invoice.amount_paid)}</Detail>
            <Detail label="Balance"><span className="font-semibold">{invoice.status === "void" ? "-" : formatCurrency(balance)}</span></Detail>
            <Detail label="Notes">{invoice.notes}</Detail>
          </dl>
        </Card>
        <Card title="Patient">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Name">
              {invoice.patients ? <Link href={`/patients/${invoice.patients.id}`} className="text-brand-700 hover:underline">{fullName(invoice.patients)}</Link> : null}
            </Detail>
            <Detail label="Patient No.">{invoice.patients?.patient_no}</Detail>
            <Detail label="Appointment">
              {invoice.appointments ? (
                <Link href={`/appointments/${invoice.appointments.id}`} className="text-brand-700 hover:underline">{formatDateTime(invoice.appointments.schedule)}</Link>
              ) : "None"}
            </Detail>
          </dl>
        </Card>
      </div>

      <Card title="Items" className="mt-4">
        <DataTable columns={itemColumns} rows={items} empty="No items yet." />
        {canEdit && open && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Add item</h3>
            <ItemForm action={addInvoiceItemAction.bind(null, id)} />
          </div>
        )}
      </Card>

      {canEdit && open && (
        <Card title="Prescribed medicines waiting to be dispensed" className="mt-4">
          {pending.length === 0 ? (
            <p className="text-sm text-slate-500">No pending prescriptions for this patient.</p>
          ) : (
            <>
              <DataTable columns={pendingColumns} rows={pending.map((r) => ({ ...r, id: r.prescription_id }))} />
              <p className="mt-2 text-xs text-slate-500">Dispensing reduces the stock, adds the medicine to this invoice and locks the prescription, all in one step.</p>
            </>
          )}
        </Card>
      )}

      <Card title="Payments" className="mt-4">
        <DataTable columns={paymentColumns} rows={payments} empty="No payments yet." />
        {canEdit && open && Number(invoice.total) > 0 && balance > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Record payment</h3>
            <PaymentForm action={recordPaymentAction.bind(null, id)} balance={formatCurrency(balance)} />
          </div>
        )}
        {canEdit && open && Number(invoice.total) === 0 && (
          <p className="mt-3 text-sm text-slate-500">Add at least one item before recording a payment.</p>
        )}
      </Card>
    </>
  );
}
