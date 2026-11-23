"use client";
import { useActionState } from "react";
import Button from "@/components/ui/Button";

export default function DispenseButton({ action, disabled = false }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="text-right">
      <Button type="submit" disabled={pending || disabled} className="px-3 py-1 text-xs">{pending ? "Dispensing..." : "Dispense"}</Button>
      {state?.error && <p className="mt-1 max-w-xs text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
