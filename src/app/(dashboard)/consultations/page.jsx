import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { listConsultations, listAwaitingConsultation, CONSULTATIONS_PAGE_SIZE } from "@/services/consultations.service";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/utils/appointment";
import { fullName } from "@/lib/utils/patient";
import { formatDateTime } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import LinkButton from "@/components/ui/LinkButton";
import Pagination from "@/components/ui/Pagination";
import FlashMessage from "@/components/ui/FlashMessage";
import { Eye, Stethoscope } from "lucide-react";

export const metadata = { title: "Consultations | CareNova" };

const FLASH = { deleted: "Consultation deleted." };

export default async function ConsultationsPage({ searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.DOCTOR]);
  const sp = await searchParams;
  const isDoctor = user.role === ROLES.DOCTOR;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const [{ data, count, outOfRange }, awaiting] = await Promise.all([
    listConsultations({ page }),
    isDoctor ? listAwaitingConsultation() : Promise.resolve([]),
  ]);
  if (outOfRange) redirect("/consultations");

  const columns = [
    {
      key: "date", header: "Visit date",
      render: (c) => (
        <Link href={`/consultations/${c.id}`} className="font-medium text-brand-700 hover:underline">
          {formatDateTime(c.appointments?.schedule)}
        </Link>
      ),
    },
    { key: "patient", header: "Patient", render: (c) => (c.appointments?.patients ? fullName(c.appointments.patients) : "-") },
    ...(isDoctor ? [] : [{ key: "doctor", header: "Doctor", render: (c) => c.appointments?.doctors?.profiles?.full_name ?? "-" }]),
    { key: "diagnosis", header: "Diagnosis", render: (c) => <span className="line-clamp-2 max-w-xs">{c.diagnosis}</span> },
    { key: "rx", header: "Prescriptions", render: (c) => c.prescriptions?.length ?? 0 },
    { key: "actions", header: "Actions", render: (c) => <LinkButton href={`/consultations/${c.id}`} variant="secondary" small icon={Eye}>View</LinkButton> },
  ];

  return (
    <>
      <PageHeader
        title="Consultations"
        description={isDoctor ? "Your consultation records" : "All consultation records (read-only)"}
      />
      <FlashMessage code={sp.msg} messages={FLASH} />

      {isDoctor && (
        <Card title="Waiting for a consultation record" className="mb-6">
          {awaiting.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing waiting. Appointments for today or earlier without a record will appear here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {awaiting.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{a.patients ? fullName(a.patients) : "-"}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(a.schedule)} <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      {a.reason ? ` · ${a.reason}` : ""}
                    </p>
                  </div>
                  <LinkButton href={`/consultations/new?appointment=${a.id}`} small icon={Stethoscope}>Start consultation</LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <DataTable columns={columns} rows={data} empty="No consultation records yet." />
      <Pagination basePath="/consultations" page={page} pageSize={CONSULTATIONS_PAGE_SIZE} total={count} />
    </>
  );
}
