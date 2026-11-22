import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { UUID_REGEX } from "@/lib/utils/forms";
import { getAppointment, listPatientOptions } from "@/services/appointments.service";
import { findInvoiceForAppointment } from "@/services/billing.service";
import { createInvoiceAction } from "@/actions/billing.actions";
import PageHeader from "@/components/ui/PageHeader";
import InvoiceForm from "@/components/billing/InvoiceForm";

export const metadata = { title: "New invoice | CareNova" };

export default async function NewInvoicePage({ searchParams }) {
  await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST]);
  const sp = await searchParams;
  const appointmentId = typeof sp.appointment === "string" && UUID_REGEX.test(sp.appointment) ? sp.appointment : "";

  let lockedPatient = null;
  let patients = [];
  if (appointmentId) {
    const appointment = await getAppointment(appointmentId);
    if (appointment) {
      const existing = await findInvoiceForAppointment(appointmentId);
      if (existing) redirect(`/billing/${existing.id}`);
      lockedPatient = appointment.patients;
    }
  }
  if (!lockedPatient) patients = await listPatientOptions();

  return (
    <>
      <PageHeader title="New invoice" description="Fields marked with * are required" />
      <InvoiceForm
        action={createInvoiceAction}
        patients={patients}
        lockedPatient={lockedPatient}
        appointmentId={lockedPatient ? appointmentId : ""}
      />
    </>
  );
}
