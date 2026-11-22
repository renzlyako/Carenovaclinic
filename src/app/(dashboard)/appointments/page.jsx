import Link from "next/link";
import Form from "next/form";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { APPOINTMENT_STATUS } from "@/lib/constants/status";
import { listAppointments, listDoctorOptions, APPOINTMENTS_PAGE_SIZE } from "@/services/appointments.service";
import { deleteAppointmentAction } from "@/actions/appointments.actions";
import { STATUS_LABEL, STATUS_TONE, doctorLabel } from "@/lib/utils/appointment";
import { fullName } from "@/lib/utils/patient";
import { formatDateTime } from "@/lib/utils/format";
import { UUID_REGEX } from "@/lib/utils/forms";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import LinkButton from "@/components/ui/LinkButton";
import Pagination from "@/components/ui/Pagination";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { CalendarPlus, Eye, Pencil, RotateCcw } from "lucide-react";

export const metadata = { title: "Appointments | CareNova" };

const FLASH = { deleted: "Appointment deleted." };
const WHEN = [
  { value: "upcoming", label: "Today and upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

export default async function AppointmentsPage({ searchParams }) {
  const user = await requireRole([ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST]);
  const sp = await searchParams;

  const when = WHEN.some((w) => w.value === sp.when) ? sp.when : "upcoming";
  const status = APPOINTMENT_STATUS.includes(sp.status) ? sp.status : "";
  const doctorId = typeof sp.doctor === "string" && UUID_REGEX.test(sp.doctor) ? sp.doctor : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const isDoctor = user.role === ROLES.DOCTOR;
  const canManage = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  const canDelete = user.role === ROLES.ADMIN;

  const [{ data, count, outOfRange }, doctors] = await Promise.all([
    listAppointments({ when, status, doctorId, page }),
    isDoctor ? Promise.resolve([]) : listDoctorOptions(),
  ]);

  if (outOfRange) {
    const sp2 = new URLSearchParams({ when, ...(status && { status }), ...(doctorId && { doctor: doctorId }) });
    redirect(`/appointments?${sp2.toString()}`);
  }

  const columns = [
    {
      key: "schedule",
      header: "Date & time",
      render: (a) => (
        <Link href={`/appointments/${a.id}`} className="font-medium text-brand-700 hover:underline">
          {formatDateTime(a.schedule)}
        </Link>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      render: (a) =>
        a.patients ? (
          <Link href={`/patients/${a.patients.id}`} className="hover:underline">{fullName(a.patients)}</Link>
        ) : "-",
    },
    { key: "doctor", header: "Doctor", render: (a) => a.doctors?.profiles?.full_name ?? "-" },
    { key: "reason", header: "Reason", render: (a) => <span className="line-clamp-2 max-w-xs">{a.reason ?? "-"}</span> },
    { key: "status", header: "Status", render: (a) => <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge> },
    {
      key: "actions",
      header: "Actions",
      render: (a) => (
        <div className="flex items-center gap-2">
          <LinkButton href={`/appointments/${a.id}`} variant="secondary" small icon={Eye}>View</LinkButton>
          {canManage && <LinkButton href={`/appointments/${a.id}/edit`} variant="secondary" small icon={Pencil}>Edit</LinkButton>}
          {canDelete && (
            <ConfirmDeleteButton
              small
              action={deleteAppointmentAction.bind(null, a.id)}
              title="Delete this appointment?"
              message="This permanently deletes the appointment. Use Cancel instead if you want to keep a record of it."
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Appointments"
        description={isDoctor ? "Your appointments" : "Book and manage appointments"}
        action={canManage ? <LinkButton href="/appointments/new" icon={CalendarPlus}>Book appointment</LinkButton> : null}
      />

      <FlashMessage code={sp.msg} messages={FLASH} />

      <Form action="/appointments" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48"><Select label="Show" name="when" options={WHEN} defaultValue={when} /></div>
        <div className="w-44">
          <Select
            label="Status"
            name="status"
            placeholder="All statuses"
            options={APPOINTMENT_STATUS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            defaultValue={status}
          />
        </div>
        {!isDoctor && (
          <div className="w-56">
            <Select
              label="Doctor"
              name="doctor"
              placeholder="All doctors"
              options={doctors.map((d) => ({ value: d.id, label: doctorLabel(d) }))}
              defaultValue={doctorId}
            />
          </div>
        )}
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
        <LinkButton href="/appointments" variant="secondary" icon={RotateCcw}>Reset</LinkButton>
      </Form>

      <DataTable columns={columns} rows={data} empty="No appointments found." />
      <Pagination
        basePath="/appointments"
        page={page}
        pageSize={APPOINTMENTS_PAGE_SIZE}
        total={count}
        params={{ when, status, doctor: doctorId }}
      />
    </>
  );
}
