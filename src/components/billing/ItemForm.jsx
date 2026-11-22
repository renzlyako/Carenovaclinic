"use client";
import { useActionState, useEffect, useRef } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Plus } from "lucide-react";

export default function ItemForm({ action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef(null);
  const err = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state?.error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.success}</div>}
      <div className="grid gap-3 md:grid-cols-[3fr_1fr_1.5fr_auto] md:items-start">
        <Input label="Description *" name="description" placeholder="Lab test, procedure..." maxLength={150} defaultValue={state?.values?.description ?? ""} error={err.description} required />
        <Input label="Qty *" name="qty" type="number" min={1} max={1000} step={1} defaultValue={state?.values?.qty ?? 1} error={err.qty} required />
        <Input label="Unit price (PHP) *" name="unit_price" type="number" min={0} step="0.01" defaultValue={state?.values?.unit_price ?? ""} error={err.unit_price} required />
        <div className="md:pt-6"><Button type="submit" disabled={pending} icon={Plus}>{pending ? "Adding..." : "Add"}</Button></div>
      </div>
    </form>
  );
}
