"use client";
import { useActionState } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
import { APPOINTMENT_STATUS } from "@/lib/constants/status";
import { STATUS_LABEL, patientLabel, doctorLabel } from "@/lib/utils/appointment";
import { isoToClinicLocal } from "@/lib/utils/datetime";
import { Save, X } from "lucide-react";

const STATUS_CHOICES = APPOINTMENT_STATUS.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

// Shared by "Book appointment" and "Edit appointment".
// `action` is a Server Action: (prevState, formData) => state
// `minSchedule` (clinic time, "YYYY-MM-DDTHH:mm") is only used when booking, to block past times.
export default function AppointmentForm({
  action,
  appointment,
  patients,
  doctors,
  defaultPatientId = "",
  minSchedule,
  showStatus = false,
  submitLabel = "Save",
  cancelHref = "/appointments",
}) {
  const [state, formAction, pending] = useActionState(action, null);

  const value = (name, fallback = "") => state?.values?.[name] ?? fallback;
  const err = state?.fieldErrors ?? {};

  const patientOptions = patients.map((p) => ({ value: p.id, label: patientLabel(p) }));
  const doctorOptions = doctors.map((d) => ({ value: d.id, label: doctorLabel(d) }));

  return (
    <form action={formAction} className="max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      {state?.error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Patient *"
          name="patient_id"
          placeholder="Select a patient..."
          options={patientOptions}
          defaultValue={value("patient_id", appointment?.patient_id ?? defaultPatientId)}
          error={err.patient_id}
          required
        />
        <Select
          label="Doctor *"
          name="doctor_id"
          placeholder="Select a doctor..."
          options={doctorOptions}
          defaultValue={value("doctor_id", appointment?.doctor_id ?? "")}
          error={err.doctor_id}
          required
        />
        <Input
          label="Date and time *"
          name="schedule"
          type="datetime-local"
          step="900"
          min={minSchedule}
          defaultValue={value("schedule", appointment ? isoToClinicLocal(appointment.schedule) : "")}
          error={err.schedule}
          required
        />
        {showStatus && (
          <Select
            label="Status *"
            name="status"
            options={STATUS_CHOICES}
            defaultValue={value("status", appointment?.status ?? "scheduled")}
            error={err.status}
            required
          />
        )}
      </div>

      <Input
        label="Reason for visit"
        name="reason"
        placeholder="e.g. Fever and cough"
        defaultValue={value("reason", appointment?.reason ?? "")}
        error={err.reason}
        maxLength={255}
      />

      <p className="text-xs text-slate-500">Times are in Philippine time (Asia/Manila).</p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} icon={Save}>{pending ? "Saving..." : submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary" icon={X}>Cancel</LinkButton>
      </div>
    </form>
  );
}
