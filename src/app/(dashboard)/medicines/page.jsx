import Form from "next/form";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { listMedicines, MEDICINES_PAGE_SIZE } from "@/services/medicines.service";
import { deleteMedicineAction } from "@/actions/medicines.actions";
import { formatCurrency } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import LinkButton from "@/components/ui/LinkButton";
import Pagination from "@/components/ui/Pagination";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { PackagePlus, Pencil, RotateCcw } from "lucide-react";

export const metadata = { title: "Medicines | CareNova" };

const FLASH = { created: "Medicine added.", updated: "Medicine updated.", deleted: "Medicine deleted." };
const FILTERS = [
  { value: "", label: "All medicines" },
  { value: "low", label: "Low stock" },
  { value: "inactive", label: "Inactive" },
];

export default async function MedicinesPage({ searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST]);
  const sp = await searchParams;
  const isAdmin = user.role === ROLES.ADMIN;

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const filter = FILTERS.some((f) => f.value === sp.filter) ? sp.filter : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const { data, count, outOfRange } = await listMedicines({ q, filter, page });
  if (outOfRange) {
    const p = new URLSearchParams({ ...(q && { q }), ...(filter && { filter }) });
    redirect(`/medicines${p.toString() ? `?${p}` : ""}`);
  }

  const columns = [
    { key: "name", header: "Name", render: (m) => <span className="font-medium text-slate-800">{m.name}</span> },
    { key: "description", header: "Description", render: (m) => m.description ?? "-" },
    {
      key: "stock", header: "Stock",
      render: (m) => (
        <span className="flex items-center gap-2">
          {m.stock_qty}
          {m.is_active && m.stock_qty <= m.reorder_level && <Badge tone="red">Low</Badge>}
        </span>
      ),
    },
    { key: "reorder_level", header: "Reorder level" },
    { key: "unit_price", header: "Price", render: (m) => formatCurrency(m.unit_price) },
    { key: "is_active", header: "Status", render: (m) => <Badge tone={m.is_active ? "green" : "gray"}>{m.is_active ? "Active" : "Inactive"}</Badge> },
    ...(isAdmin ? [{
      key: "actions", header: "Actions",
      render: (m) => (
        <div className="flex items-center gap-2">
          <LinkButton href={`/medicines/${m.id}/edit`} variant="secondary" small icon={Pencil}>Edit</LinkButton>
          <ConfirmDeleteButton
            small
            action={deleteMedicineAction.bind(null, m.id)}
            title={`Delete ${m.name}?`}
            message="This permanently deletes the medicine. It is not possible if it was prescribed or billed. Deactivate it instead."
          />
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Medicines"
        description={isAdmin ? "Manage the medicine inventory" : "Medicine inventory (read-only)"}
        action={isAdmin ? <LinkButton href="/medicines/new" icon={PackagePlus}>Add medicine</LinkButton> : null}
      />
      <FlashMessage code={sp.msg} messages={FLASH} />

      <Form action="/medicines" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Medicine name" maxLength={80}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <div className="w-48"><Select label="Show" name="filter" options={FILTERS} defaultValue={filter} /></div>
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
        <LinkButton href="/medicines" variant="secondary" icon={RotateCcw}>Reset</LinkButton>
      </Form>

      <DataTable columns={columns} rows={data} empty="No medicines found." />
      <Pagination basePath="/medicines" page={page} pageSize={MEDICINES_PAGE_SIZE} total={count} params={{ q, filter }} />
    </>
  );
}
