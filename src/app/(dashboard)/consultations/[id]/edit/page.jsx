import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { getConsultation } from "@/services/consultations.service";
import { updateConsultationAction } from "@/actions/consultations.actions";
import { fullName } from "@/lib/utils/patient";
import { formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import ConsultationForm from "@/components/consultations/ConsultationForm";

export const metadata = { title: "Edit consultation | CareNova" };

export default async function EditConsultationPage({ params }) {
  await requireRole([ROLES.DOCTOR]);
  const { id } = await params;
  const consultation = await getConsultation(id);
  if (!consultation) notFound();
  const a = consultation.appointments;

  return (
    <>
      <PageHeader
        title="Edit consultation"
        description={`${a?.patients ? fullName(a.patients) : "-"} · ${formatDateTime(a?.schedule)}`}
      />
      <ConsultationForm
        action={updateConsultationAction.bind(null, id)}
        consultation={consultation}
        submitLabel="Save changes"
        cancelHref={`/consultations/${id}`}
      />
    </>
  );
}
