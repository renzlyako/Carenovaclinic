import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { createAppointmentAction } from "@/actions/appointments.actions";
import { listDoctorOptions, listPatientOptions } from "@/services/appointments.service";
import { clinicNowLocal } from "@/lib/utils/datetime";
import { UUID_REGEX } from "@/lib/utils/forms";
import PageHeader from "@/components/ui/PageHeader";
import AppointmentForm from "@/components/appointments/AppointmentForm";

export const metadata = { title: "Book appointment | CareNova" };

export default async function NewAppointmentPage({ searchParams }) {
  await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST]);
  const sp = await searchParams;

  const [patients, doctors] = await Promise.all([listPatientOptions(), listDoctorOptions()]);

  const defaultPatientId = typeof sp.patient === "string" && UUID_REGEX.test(sp.patient) ? sp.patient : "";

  return (
    <>
      <PageHeader title="Book appointment" description="Fields marked with * are required" />
      {doctors.length === 0 && (
        <div className="mb-4 max-w-3xl rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          There are no active doctors yet. An admin must create a doctor account first.
        </div>
      )}
      <AppointmentForm
        action={createAppointmentAction}
        patients={patients}
        doctors={doctors}
        defaultPatientId={defaultPatientId}
        minSchedule={clinicNowLocal()}
        submitLabel="Book appointment"
        cancelHref="/appointments"
      />
    </>
  );
}
