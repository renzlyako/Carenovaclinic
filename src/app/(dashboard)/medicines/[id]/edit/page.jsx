import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { getMedicine } from "@/services/medicines.service";
import { updateMedicineAction } from "@/actions/medicines.actions";
import PageHeader from "@/components/ui/PageHeader";
import MedicineForm from "@/components/medicines/MedicineForm";

export const metadata = { title: "Edit medicine | CareNova" };

export default async function EditMedicinePage({ params }) {
  await requireRole([ROLES.ADMIN]);
  const { id } = await params;
  const medicine = await getMedicine(id);
  if (!medicine) notFound();

  return (
    <>
      <PageHeader title="Edit medicine" description={medicine.name} />
      <MedicineForm action={updateMedicineAction.bind(null, id)} medicine={medicine} submitLabel="Save changes" showActive />
    </>
  );
}
