import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import {
  getConsultation, listPrescriptions, listMedicineOptions,
} from "@/services/consultations.service";
import {
  deleteConsultationAction, addPrescriptionAction, deletePrescriptionAction,
} from "@/actions/consultations.actions";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/utils/appointment";
import { fullName } from "@/lib/utils/patient";
import { formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import LinkButton from "@/components/ui/LinkButton";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import PrescriptionForm from "@/components/consultations/PrescriptionForm";
import { ArrowLeft, Pencil } from "lucide-react";

const FLASH = {
  created: "Consultation saved. You can now add prescriptions.",
  updated: "Consultation updated.",
  rx_removed: "Prescription removed.",
};

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{children || "-"}</dd>
    </div>
  );
}

export default async function ConsultationDetailPage({ params, searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.DOCTOR]);
  const { id } = await params;
  const sp = await searchParams;

  const consultation = await getConsultation(id);
  if (!consultation) notFound();

  const isDoctor = user.role === ROLES.DOCTOR;
  const [prescriptions, medicines] = await Promise.all([
    listPrescriptions(id),
    isDoctor ? listMedicineOptions() : Promise.resolve([]),
  ]);

  const a = consultation.appointments;
  const patient = a?.patients;

  const rxColumns = [
    { key: "medicine", header: "Medicine", render: (r) => r.medicines?.name ?? "-" },
    { key: "dosage", header: "Dosage", render: (r) => r.dosage },
    { key: "qty", header: "Qty", render: (r) => r.qty },
    {
      key: "status", header: "Status",
      render: (r) => <Badge tone={r.dispensed_at ? "green" : "yellow"}>{r.dispensed_at ? "Dispensed" : "Pending"}</Badge>,
    },
    ...(isDoctor ? [{
      key: "actions", header: "Actions",
      render: (r) => r.dispensed_at ? <span className="text-xs text-slate-400">Locked</span> : (
        <ConfirmDeleteButton
          small
          label="Remove"
          action={deletePrescriptionAction.bind(null, id, r.id)}
          title="Remove this prescription?"
          message={`${r.medicines?.name ?? "This medicine"} will be removed from the prescription list.`}
          confirmLabel="Yes, remove"
        />
      ),
    }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Consultation"
        description={`${patient ? fullName(patient) : "-"} · ${formatDateTime(a?.schedule)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/consultations" variant="secondary" icon={ArrowLeft}>Back to list</LinkButton>
            {isDoctor && <LinkButton href={`/consultations/${id}/edit`} icon={Pencil}>Edit</LinkButton>}
            {isDoctor && (
              <ConfirmDeleteButton
                action={deleteConsultationAction.bind(null, id)}
                title="Delete this consultation?"
                message="This permanently deletes the diagnosis and notes. It is not possible while prescriptions exist."
              />
            )}
          </div>
        }
      />
      <FlashMessage code={sp.msg} messages={FLASH} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Consultation">
          <dl className="space-y-4">
            <Detail label="Diagnosis">{consultation.diagnosis}</Detail>
            <Detail label="Clinical notes">{consultation.notes}</Detail>
            <Detail label="Last updated">{formatDateTime(consultation.updated_at)}</Detail>
          </dl>
        </Card>

        <Card title="Visit">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Patient">
              {patient ? <Link href={`/patients/${patient.id}`} className="text-brand-700 hover:underline">{fullName(patient)}</Link> : null}
            </Detail>
            <Detail label="Patient No.">{patient?.patient_no}</Detail>
            <Detail label="Doctor">{a?.doctors?.profiles?.full_name}</Detail>
            <Detail label="Appointment">
              {a ? (
                <Link href={`/appointments/${a.id}`} className="text-brand-700 hover:underline">
                  {formatDateTime(a.schedule)}
                </Link>
              ) : null}
              {a && <> <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge></>}
            </Detail>
          </dl>
        </Card>
      </div>

      <Card title="Prescriptions" className="mt-4">
        <DataTable columns={rxColumns} rows={prescriptions} empty="No prescriptions yet." />
        {isDoctor && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Add prescription</h3>
            <PrescriptionForm action={addPrescriptionAction.bind(null, id)} medicines={medicines} />
            <p className="mt-2 text-xs text-slate-500">Medicines are dispensed and billed by the front desk. Once dispensed, a prescription is locked.</p>
          </div>
        )}
      </Card>
    </>
  );
}
