"use client";
import { useState, useActionState } from "react";
import Button from "@/components/ui/Button";

// Reusable button with a confirmation dialog (used for delete, cancel, no-show...).
// `action` is a Server Action with the signature (prevState, formData) => state,
// for example: deletePatientAction.bind(null, patient.id)
// If the action returns { error }, the message is shown inside the dialog.
export default function ConfirmDeleteButton({
  action,
  label = "Delete",
  title = "Delete this record?",
  message = "This action cannot be undone.",
  confirmLabel = "Yes, delete",
  pendingLabel = "Please wait...",
  variant = "danger", // style of the button that opens the dialog: "danger" | "secondary"
  small = false,
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={small ? "px-2 py-1 text-xs" : undefined}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-800">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
            {state?.error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
            <form action={formAction} className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Back</Button>
              <Button type="submit" variant="danger" disabled={pending}>{pending ? pendingLabel : confirmLabel}</Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
