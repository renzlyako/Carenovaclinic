import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { createMedicineAction } from "@/actions/medicines.actions";
import PageHeader from "@/components/ui/PageHeader";
import MedicineForm from "@/components/medicines/MedicineForm";

export const metadata = { title: "New medicine | CareNova" };

export default async function NewMedicinePage() {
  await requireRole([ROLES.ADMIN]);
  return (
    <>
      <PageHeader title="New medicine" description="Fields marked with * are required" />
      <MedicineForm action={createMedicineAction} submitLabel="Add medicine" />
    </>
  );
}
