import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { getPatient } from "@/services/patients.service";
import { updatePatientAction } from "@/actions/patients.actions";
import { fullName } from "@/lib/utils/patient";
import PageHeader from "@/components/ui/PageHeader";
import PatientForm from "@/components/patients/PatientForm";

export const metadata = { title: "Edit patient | CareNova" };

export default async function EditPatientPage({ params }) {
  await requireRole([ROLES.ADMIN, ROLES.RECEPTIONIST]);
  const { id } = await params;

  const patient = await getPatient(id);
  if (!patient) notFound();

  return (
    <>
      <PageHeader title={`Edit ${fullName(patient)}`} description={`Patient No. ${patient.patient_no}`} />
      <PatientForm
        action={updatePatientAction.bind(null, id)}
        patient={patient}
        submitLabel="Save changes"
        cancelHref={`/patients/${id}`}
      />
    </>
  );
}
