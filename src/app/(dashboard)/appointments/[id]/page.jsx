import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { getAppointment } from "@/services/appointments.service";
import { deleteAppointmentAction, setAppointmentStatusAction } from "@/actions/appointments.actions";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/utils/appointment";
import { fullName } from "@/lib/utils/patient";
import { formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LinkButton from "@/components/ui/LinkButton";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import StatusButtons from "@/components/appointments/StatusButtons";
import { ArrowLeft, Eye, FilePlus, Pencil, Stethoscope } from "lucide-react";

const FLASH = {
  created: "Appointment booked.",
  updated: "Appointment updated.",
  completed: "Appointment marked as completed.",
  cancelled: "Appointment cancelled.",
  no_show: "Appointment marked as no-show.",
};

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children ?? "-"}</dd>
    </div>
  );
}

export default async function AppointmentDetailPage({ params, searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST]);
  const { id } = await params;
  const sp = await searchParams;

  const appointment = await getAppointment(id);
  if (!appointment) notFound();

  const canManage = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  const canDelete = user.role === ROLES.ADMIN;
  const isScheduled = appointment.status === "scheduled";
  const patient = appointment.patients;
  const doctor = appointment.doctors;
  // consultations(id) is a one-to-one embed: an object, an array, or null depending on the client version.
  const consultation = Array.isArray(appointment.consultations) ? appointment.consultations[0] : appointment.consultations;
  const canStartConsultation = user.role === ROLES.DOCTOR && !consultation && (isScheduled || appointment.status === "completed");
  const canViewConsultation = Boolean(consultation) && (user.role === ROLES.DOCTOR || user.role === ROLES.ADMIN);

  const statusActions = {
    completed: setAppointmentStatusAction.bind(null, id, "completed"),
    no_show: setAppointmentStatusAction.bind(null, id, "no_show"),
    cancelled: setAppointmentStatusAction.bind(null, id, "cancelled"),
  };

  return (
    <>
      <PageHeader
        title="Appointment"
        description={formatDateTime(appointment.schedule)}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/appointments" variant="secondary" icon={ArrowLeft}>Back to list</LinkButton>
            {canStartConsultation && <LinkButton href={`/consultations/new?appointment=${id}`} icon={Stethoscope}>Start consultation</LinkButton>}
            {canViewConsultation && <LinkButton href={`/consultations/${consultation.id}`} icon={Eye}>View consultation</LinkButton>}
            {canManage && appointment.status === "completed" && <LinkButton href={`/billing/new?appointment=${id}`} icon={FilePlus}>Create invoice</LinkButton>}
            {canManage && <LinkButton href={`/appointments/${id}/edit`} icon={Pencil}>Edit / Reschedule</LinkButton>}
            {canDelete && (
              <ConfirmDeleteButton
                action={deleteAppointmentAction.bind(null, id)}
                title="Delete this appointment?"
                message="This permanently deletes the appointment. Use Cancel instead if you want to keep a record of it."
              />
            )}
          </div>
        }
      />

      <FlashMessage code={sp.msg} messages={FLASH} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Appointment">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Date & time">{formatDateTime(appointment.schedule)}</Detail>
            <Detail label="Status"><Badge tone={STATUS_TONE[appointment.status]}>{STATUS_LABEL[appointment.status]}</Badge></Detail>
            <Detail label="Doctor">{doctor?.profiles?.full_name}</Detail>
            <Detail label="Specialization">{doctor?.specialization}</Detail>
            <div className="sm:col-span-2"><Detail label="Reason for visit">{appointment.reason}</Detail></div>
          </dl>
        </Card>

        <Card title="Patient">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Name">
              {patient ? <Link href={`/patients/${patient.id}`} className="text-brand-700 hover:underline">{fullName(patient)}</Link> : null}
            </Detail>
            <Detail label="Patient No.">{patient?.patient_no}</Detail>
            <Detail label="Contact number">{patient?.contact_no}</Detail>
          </dl>
        </Card>
      </div>

      {isScheduled && (
        <Card title="Update status" className="mt-4">
          <StatusButtons actions={statusActions} />
        </Card>
      )}
    </>
  );
}
