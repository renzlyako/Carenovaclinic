"use client";
import { useActionState } from "react";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
import { Save, X } from "lucide-react";

export default function ConsultationForm({ action, consultation, submitLabel = "Save", cancelHref }) {
  const [state, formAction, pending] = useActionState(action, null);
  const value = (name) => state?.values?.[name] ?? consultation?.[name] ?? "";
  const err = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      {state?.error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      <Textarea label="Diagnosis *" name="diagnosis" rows={3} maxLength={500} defaultValue={value("diagnosis")} error={err.diagnosis} required />
      <Textarea label="Clinical notes" name="notes" rows={6} maxLength={3000} defaultValue={value("notes")} error={err.notes} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} icon={Save}>{pending ? "Saving..." : submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary" icon={X}>Cancel</LinkButton>
      </div>
    </form>
  );
}
