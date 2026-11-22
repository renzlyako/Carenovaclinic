"use client";
import { useActionState } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
import { SEX_OPTIONS } from "@/lib/constants/status";
import { capitalize } from "@/lib/utils/patient";
import { Save, X } from "lucide-react";

const SEX_CHOICES = SEX_OPTIONS.map((s) => ({ value: s, label: capitalize(s) }));

// Shared by "New patient" and "Edit patient".
// `action` is a Server Action: (prevState, formData) => state
// On validation errors the action returns { fieldErrors, values } so the user's input is kept.
export default function PatientForm({ action, patient, submitLabel = "Save", cancelHref = "/patients" }) {
  const [state, formAction, pending] = useActionState(action, null);

  const value = (name) => state?.values?.[name] ?? patient?.[name] ?? "";
  const err = state?.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      {state?.error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-700">Personal information</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="First name *" name="first_name" defaultValue={value("first_name")} error={err.first_name} maxLength={80} required />
          <Input label="Last name *" name="last_name" defaultValue={value("last_name")} error={err.last_name} maxLength={80} required />
          <Input label="Birthdate *" name="birthdate" type="date" min="1900-01-01" max={today} defaultValue={value("birthdate")} error={err.birthdate} required />
          <Select label="Sex *" name="sex" placeholder="Select..." options={SEX_CHOICES} defaultValue={value("sex")} error={err.sex} required />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-700">Contact</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Contact number *" name="contact_no" type="tel" placeholder="09171234567" defaultValue={value("contact_no")} error={err.contact_no} required />
          <Input label="Address" name="address" defaultValue={value("address")} error={err.address} maxLength={255} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-700">Emergency contact (optional)</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Name" name="emergency_contact_name" defaultValue={value("emergency_contact_name")} error={err.emergency_contact_name} maxLength={120} />
          <Input label="Contact number" name="emergency_contact_no" type="tel" defaultValue={value("emergency_contact_no")} error={err.emergency_contact_no} />
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} icon={Save}>{pending ? "Saving..." : submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary" icon={X}>Cancel</LinkButton>
      </div>
    </form>
  );
}
