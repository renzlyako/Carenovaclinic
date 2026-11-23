import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { getAppointment, listDoctorOptions, listPatientOptions } from "@/services/appointments.service";
import { updateAppointmentAction } from "@/actions/appointments.actions";
import PageHeader from "@/components/ui/PageHeader";
import AppointmentForm from "@/components/appointments/AppointmentForm";

export const metadata = { title: "Edit appointment | CareNova" };

export default async function EditAppointmentPage({ params }) {
  await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST]);
  const { id } = await params;

  const appointment = await getAppointment(id);
  if (!appointment) notFound();

  const [patients, doctors] = await Promise.all([listPatientOptions(), listDoctorOptions()]);

  if (appointment.patients && !patients.some((p) => p.id === appointment.patient_id)) patients.unshift(appointment.patients);
  if (appointment.doctors && !doctors.some((d) => d.id === appointment.doctor_id)) doctors.unshift(appointment.doctors);

  return (
    <>
      <PageHeader title="Edit appointment" description="Change the time to reschedule" />
      <AppointmentForm
        action={updateAppointmentAction.bind(null, id)}
        appointment={appointment}
        patients={patients}
        doctors={doctors}
        showStatus
        submitLabel="Save changes"
        cancelHref={`/appointments/${id}`}
      />
    </>
  );
}
