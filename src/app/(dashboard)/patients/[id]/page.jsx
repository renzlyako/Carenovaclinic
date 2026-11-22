import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { getPatient, getPatientAppointments } from "@/services/patients.service";
import { deletePatientAction } from "@/actions/patients.actions";
import { calculateAge, capitalize, formatDateOnly, fullName } from "@/lib/utils/patient";
import { formatDateTime } from "@/lib/utils/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/utils/appointment";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import LinkButton from "@/components/ui/LinkButton";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { ArrowLeft, CalendarPlus, Pencil } from "lucide-react";

const FLASH = { created: "Patient created.", updated: "Patient updated." };

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      {/* Show "-" only when there is no value (0 is a valid value, e.g. a newborn's age) */}
      <dd className="mt-0.5 text-sm text-slate-800">{children === null || children === undefined || children === "" ? "-" : children}</dd>
    </div>
  );
}

export default async function PatientDetailPage({ params, searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST]);
  const { id } = await params;
  const sp = await searchParams;

  const patient = await getPatient(id);
  if (!patient) notFound();
  const appointments = await getPatientAppointments(id);

  const canEdit = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  const canDelete = user.role === ROLES.ADMIN;
  const age = calculateAge(patient.birthdate);

  const columns = [
    {
      key: "schedule",
      header: "Date & time",
      render: (a) => (
        <Link href={`/appointments/${a.id}`} className="font-medium text-brand-700 hover:underline">
          {formatDateTime(a.schedule)}
        </Link>
      ),
    },
    { key: "doctor", header: "Doctor", render: (a) => a.doctors?.profiles?.full_name ?? "-" },
    { key: "reason", header: "Reason", render: (a) => a.reason ?? "-" },
    {
      key: "status",
      header: "Status",
      render: (a) => <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title={fullName(patient)}
        description={`Patient No. ${patient.patient_no}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/patients" variant="secondary" icon={ArrowLeft}>Back to list</LinkButton>
            {canEdit && <LinkButton href={`/appointments/new?patient=${patient.id}`} icon={CalendarPlus}>Book appointment</LinkButton>}
            {canEdit && <LinkButton href={`/patients/${patient.id}/edit`} variant="secondary" icon={Pencil}>Edit</LinkButton>}
            {canDelete && (
              <ConfirmDeleteButton
                action={deletePatientAction.bind(null, patient.id)}
                title={`Delete ${fullName(patient)}?`}
                message="This permanently deletes the patient record. It is not possible if the patient has appointments or invoices."
              />
            )}
          </div>
        }
      />

      <FlashMessage code={sp.msg} messages={FLASH} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Personal information">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="First name">{patient.first_name}</Detail>
            <Detail label="Last name">{patient.last_name}</Detail>
            <Detail label="Birthdate">{formatDateOnly(patient.birthdate)}</Detail>
            <Detail label="Age">{age === 0 ? "Under 1 year" : age === null ? null : `${age} years`}</Detail>
            <Detail label="Sex">{capitalize(patient.sex)}</Detail>
          </dl>
        </Card>

        <Card title="Contact">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Contact number">{patient.contact_no}</Detail>
            <Detail label="Address">{patient.address}</Detail>
            <Detail label="Emergency contact">{patient.emergency_contact_name}</Detail>
            <Detail label="Emergency number">{patient.emergency_contact_no}</Detail>
          </dl>
        </Card>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-600">Appointment history</h2>
      <DataTable columns={columns} rows={appointments} empty="No appointments yet." />
    </>
  );
}
