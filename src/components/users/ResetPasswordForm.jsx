"use client";
import { useActionState, useRef, useEffect } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { KeyRound } from "lucide-react";

export default function ResetPasswordForm({ action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);
  useEffect(() => { if (state?.success) ref.current?.reset(); }, [state]);

  return (
    <form ref={ref} action={formAction} className="max-w-md space-y-3">
      {state?.error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.success}</div>}
      <Input label="New password" name="password" type="password" autoComplete="new-password" error={state?.fieldErrors?.password} required />
      <p className="text-xs text-slate-500">At least 10 characters with an uppercase letter, a lowercase letter, a number and a special character.</p>
      <Button type="submit" disabled={pending} icon={KeyRound}>{pending ? "Saving..." : "Reset password"}</Button>
    </form>
  );
}
