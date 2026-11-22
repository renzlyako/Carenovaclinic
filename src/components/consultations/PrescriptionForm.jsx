"use client";
import { useActionState, useEffect, useRef } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { Plus } from "lucide-react";

// Add-prescription form. `medicines` = [{ id, name, stock_qty }]
export default function PrescriptionForm({ action, medicines }) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef(null);
  const err = state?.fieldErrors ?? {};

  // Clear the form after a successful save.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const options = medicines.map((m) => ({ value: m.id, label: `${m.name} (stock: ${m.stock_qty})` }));

  if (medicines.length === 0) {
    return <p className="text-sm text-slate-500">There are no active medicines yet. An admin needs to add medicines first.</p>;
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state?.error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      {state?.success && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.success}</div>
      )}
      <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto] md:items-start">
        <Select label="Medicine *" name="medicine_id" placeholder="Select..." options={options} defaultValue={state?.values?.medicine_id ?? ""} error={err.medicine_id} required />
        <Input label="Dosage *" name="dosage" placeholder="1 tablet every 6 hours" maxLength={150} defaultValue={state?.values?.dosage ?? ""} error={err.dosage} required />
        <Input label="Qty *" name="qty" type="number" min={1} max={1000} step={1} defaultValue={state?.values?.qty ?? ""} error={err.qty} required />
        <div className="md:pt-6">
          <Button type="submit" disabled={pending} icon={Plus}>{pending ? "Adding..." : "Add"}</Button>
        </div>
      </div>
    </form>
  );
}
