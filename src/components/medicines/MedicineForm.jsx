"use client";
import { useActionState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
import { Save, X } from "lucide-react";

export default function MedicineForm({ action, medicine, submitLabel = "Save", showActive = false }) {
  const [state, formAction, pending] = useActionState(action, null);
  const value = (name, fallback = "") => state?.values?.[name] ?? medicine?.[name] ?? fallback;
  const err = state?.fieldErrors ?? {};
  const active = state?.values ? state.values.is_active === "on" : (medicine?.is_active ?? true);

  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      {state?.error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Medicine name *" name="name" maxLength={120} defaultValue={value("name")} error={err.name} required />
        <Input label="Description" name="description" maxLength={255} defaultValue={value("description")} error={err.description} />
        <Input label="Stock quantity *" name="stock_qty" type="number" min={0} step={1} defaultValue={value("stock_qty", 0)} error={err.stock_qty} required />
        <Input label="Reorder level *" name="reorder_level" type="number" min={0} step={1} defaultValue={value("reorder_level", 10)} error={err.reorder_level} required />
        <Input label="Unit price (PHP) *" name="unit_price" type="number" min={0} step="0.01" defaultValue={value("unit_price")} error={err.unit_price} required />
      </div>
      {showActive && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_active" defaultChecked={active} className="h-4 w-4 rounded border-slate-300" />
          Active (can be prescribed and dispensed)
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} icon={Save}>{pending ? "Saving..." : submitLabel}</Button>
        <LinkButton href="/medicines" variant="secondary" icon={X}>Cancel</LinkButton>
      </div>
    </form>
  );
}
