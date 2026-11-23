"use client";
import { useActionState, useState } from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
import { ROLE_OPTIONS } from "@/lib/constants/roles-ui";
import { Save, X } from "lucide-react";


export default function UserForm({ action, mode = "create", user, lockRole = false, submitLabel = "Save" }) {
  const [state, formAction, pending] = useActionState(action, null);
  const value = (name) => state?.values?.[name] ?? (name === "specialization" || name === "license_no" ? user?.doctor?.[name] : user?.[name]) ?? "";
  const err = state?.fieldErrors ?? {};
  const [role, setRole] = useState(value("role") || "");

  return (
    <form action={formAction} className="max-w-2xl space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      {state?.error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Full name *" name="full_name" defaultValue={value("full_name")} error={err.full_name} maxLength={120} required />
        {mode === "create" ? (
          <Input label="Email *" name="email" type="email" autoComplete="off" defaultValue={value("email")} error={err.email} maxLength={254} required />
        ) : (
          <Input label="Email" value={user?.email ?? ""} readOnly disabled />
        )}
        {mode === "create" && (
          <Input
            label="Temporary password *" name="password" type="password" autoComplete="new-password"
            error={err.password} required
          />
        )}
        {lockRole ? (
          <>
            <Input label="Role" value={ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role} disabled readOnly />
            <input type="hidden" name="role" value={role} />
          </>
        ) : (
          <Select
            label="Role *" name="role" placeholder="Select..." options={ROLE_OPTIONS}
            value={role} onChange={(e) => setRole(e.target.value)} error={err.role} required
          />
        )}
      </div>
      {mode === "create" && (
        <p className="-mt-3 text-xs text-slate-500">
          At least 10 characters with an uppercase letter, a lowercase letter, a number and a special character.
        </p>
      )}

      {role === "doctor" && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-700">Doctor details</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Specialization *" name="specialization" defaultValue={value("specialization")} error={err.specialization} maxLength={120} />
            <Input label="License number *" name="license_no" defaultValue={value("license_no")} error={err.license_no} maxLength={60} />
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} icon={Save}>{pending ? "Saving..." : submitLabel}</Button>
        <LinkButton href="/admin/users" variant="secondary" icon={X}>Cancel</LinkButton>
      </div>
    </form>
  );
}
