import Link from "next/link";
import Form from "next/form";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { listPatients, PATIENTS_PAGE_SIZE } from "@/services/patients.service";
import { deletePatientAction } from "@/actions/patients.actions";
import { calculateAge, capitalize, fullName } from "@/lib/utils/patient";
import { formatDate } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import LinkButton from "@/components/ui/LinkButton";
import Pagination from "@/components/ui/Pagination";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { Eye, Pencil, RotateCcw, UserPlus } from "lucide-react";

export const metadata = { title: "Patients | CareNova" };

const FLASH = { created: "Patient created.", updated: "Patient updated.", deleted: "Patient deleted." };

export default async function PatientsPage({ searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST]);
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const { data, count, outOfRange } = await listPatients({ q, page });
  if (outOfRange) redirect(q ? `/patients?q=${encodeURIComponent(q)}` : "/patients");

  const canEdit = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  const canDelete = user.role === ROLES.ADMIN;

  const columns = [
    { key: "patient_no", header: "Patient No." },
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <Link href={`/patients/${p.id}`} className="font-medium text-brand-700 hover:underline">
          {fullName(p)}
        </Link>
      ),
    },
    { key: "sex", header: "Sex", render: (p) => capitalize(p.sex) },
    { key: "age", header: "Age", render: (p) => calculateAge(p.birthdate) },
    { key: "contact_no", header: "Contact" },
    { key: "created_at", header: "Registered", render: (p) => formatDate(p.created_at) },
    {
      key: "actions",
      header: "Actions",
      render: (p) => (
        <div className="flex items-center gap-2">
          <LinkButton href={`/patients/${p.id}`} variant="secondary" small icon={Eye}>View</LinkButton>
          {canEdit && <LinkButton href={`/patients/${p.id}/edit`} variant="secondary" small icon={Pencil}>Edit</LinkButton>}
          {canDelete && (
            <ConfirmDeleteButton
              small
              action={deletePatientAction.bind(null, p.id)}
              title={`Delete ${fullName(p)}?`}
              message="This permanently deletes the patient record. It is not possible if the patient has appointments or invoices."
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Patients"
        description={user.role === ROLES.DOCTOR ? "Patients who have an appointment with you" : "Manage patient records"}
        action={canEdit ? <LinkButton href="/patients/new" icon={UserPlus}>Add patient</LinkButton> : null}
      />

      <FlashMessage code={sp.msg} messages={FLASH} />

      <Form action="/patients" className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or patient number"
          aria-label="Search patients"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Search</button>
        {q && <LinkButton href="/patients" variant="secondary" icon={RotateCcw}>Clear</LinkButton>}
      </Form>

      <DataTable columns={columns} rows={data} empty={q ? `No patients match "${q}".` : "No patients yet."} />
      <Pagination basePath="/patients" page={page} pageSize={PATIENTS_PAGE_SIZE} total={count} params={{ q }} />
    </>
  );
}
