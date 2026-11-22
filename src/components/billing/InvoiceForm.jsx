"use client";
import { useActionState } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
import { FilePlus } from "lucide-react";

// New invoice. When the invoice is created from an appointment, the patient is fixed (`lockedPatient`).
export default function InvoiceForm({ action, patients, lockedPatient, appointmentId = "" }) {
  const [state, formAction, pending] = useActionState(action, null);
  const err = state?.fieldErrors ?? {};
  const patientOptions = patients.map((p) => ({ value: p.id, label: `${p.last_name}, ${p.first_name} (${p.patient_no})` }));

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      {state?.error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      <input type="hidden" name="appointment_id" value={appointmentId} />

      {lockedPatient ? (
        <>
          <input type="hidden" name="patient_id" value={lockedPatient.id} />
          <Input label="Patient" value={`${lockedPatient.first_name} ${lockedPatient.last_name} (${lockedPatient.patient_no})`} disabled readOnly />
        </>
      ) : (
        <Select label="Patient *" name="patient_id" placeholder="Select..." options={patientOptions} defaultValue={state?.values?.patient_id ?? ""} error={err.patient_id} required />
      )}

      <Input
        label="Consultation fee (PHP)" name="consultation_fee" type="number" min={0} step="0.01"
        placeholder="Leave empty if none" defaultValue={state?.values?.consultation_fee ?? ""} error={err.consultation_fee}
      />
      <Input label="Notes" name="notes" maxLength={255} defaultValue={state?.values?.notes ?? ""} error={err.notes} />

      <p className="text-xs text-slate-500">After creating the invoice you can add items, dispense prescribed medicines and record payments.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} icon={FilePlus}>{pending ? "Creating..." : "Create invoice"}</Button>
        <LinkButton href="/billing" variant="secondary">Cancel</LinkButton>
      </div>
    </form>
  );
}
