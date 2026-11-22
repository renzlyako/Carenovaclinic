"use client";
import { useActionState, useEffect, useRef } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { PAYMENT_METHODS } from "@/lib/constants/status";
import { METHOD_LABEL } from "@/lib/utils/billing";
import { Banknote } from "lucide-react";

const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }));

export default function PaymentForm({ action, balance }) {
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
      <div className="grid gap-3 md:grid-cols-[1.5fr_1.5fr_2fr_auto] md:items-start">
        <Input label={`Amount (PHP) * (balance: ${balance})`} name="amount" type="number" min={0.01} step="0.01" defaultValue={state?.values?.amount ?? ""} error={err.amount} required />
        <Select label="Method *" name="method" placeholder="Select..." options={METHOD_OPTIONS} defaultValue={state?.values?.method ?? ""} error={err.method} required />
        <Input label="Reference no." name="reference_no" placeholder="Optional (GCash ref, card slip...)" maxLength={60} defaultValue={state?.values?.reference_no ?? ""} error={err.reference_no} />
        <div className="md:pt-6"><Button type="submit" disabled={pending} icon={Banknote}>{pending ? "Saving..." : "Record"}</Button></div>
      </div>
      <p className="text-xs text-slate-500">Payments are permanent records. They cannot be edited or deleted afterwards.</p>
    </form>
  );
}
