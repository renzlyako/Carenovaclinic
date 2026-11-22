import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { UUID_REGEX } from "@/lib/utils/forms";
import { getAppointment } from "@/services/appointments.service";
import { getConsultationByAppointment } from "@/services/consultations.service";
import { createConsultationAction } from "@/actions/consultations.actions";
import { fullName } from "@/lib/utils/patient";
import { formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import LinkButton from "@/components/ui/LinkButton";
import ConsultationForm from "@/components/consultations/ConsultationForm";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New consultation | CareNova" };

function Problem({ children }) {
  return (
    <>
      <PageHeader title="New consultation" />
      <Card><p className="text-sm text-slate-600">{children}</p>
        <div className="mt-3"><LinkButton href="/consultations" variant="secondary" icon={ArrowLeft}>Back to consultations</LinkButton></div>
      </Card>
    </>
  );
}

export default async function NewConsultationPage({ searchParams }) {
  await requireRole([ROLES.DOCTOR]);
  const sp = await searchParams;
  const appointmentId = typeof sp.appointment === "string" ? sp.appointment : "";

  if (!UUID_REGEX.test(appointmentId)) return <Problem>Select an appointment first. Use “Start consultation” from your list.</Problem>;

  const appointment = await getAppointment(appointmentId); // RLS: only the doctor's own appointments
  if (!appointment) return <Problem>Appointment not found, or it is not assigned to you.</Problem>;
  if (appointment.status === "cancelled" || appointment.status === "no_show") {
    return <Problem>This appointment was cancelled or marked as no-show, so it has no consultation.</Problem>;
  }

  const existing = await getConsultationByAppointment(appointmentId);
  if (existing) redirect(`/consultations/${existing.id}`);

  return (
    <>
      <PageHeader
        title="New consultation"
        description={`${appointment.patients ? fullName(appointment.patients) : "-"} · ${formatDateTime(appointment.schedule)}`}
      />
      {appointment.reason && (
        <p className="mb-4 max-w-3xl rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">Reason for visit:</span> {appointment.reason}
        </p>
      )}
      <ConsultationForm
        action={createConsultationAction.bind(null, appointmentId)}
        submitLabel="Save consultation"
        cancelHref="/consultations"
      />
      <p className="mt-3 text-xs text-slate-500">After saving you can add prescriptions. The appointment is marked as completed automatically.</p>
    </>
  );
}
