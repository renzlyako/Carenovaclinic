import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { createPatientAction } from "@/actions/patients.actions";
import PageHeader from "@/components/ui/PageHeader";
import PatientForm from "@/components/patients/PatientForm";

export const metadata = { title: "New patient | CareNova" };

export default async function NewPatientPage() {
  await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST]);

  return (
    <>
      <PageHeader title="New patient" description="Fields marked with * are required" />
      <PatientForm action={createPatientAction} submitLabel="Create patient" cancelHref="/patients" />
    </>
  );
}
