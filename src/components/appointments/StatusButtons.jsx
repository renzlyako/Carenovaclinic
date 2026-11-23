"use client";
import { useActionState } from "react";
import Button from "@/components/ui/Button";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { CircleCheck } from "lucide-react";

function CompleteButton({ action }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <Button type="submit" disabled={pending} icon={CircleCheck}>{pending ? "Saving..." : "Mark as completed"}</Button>
      {state?.error && <p className="mt-1 max-w-xs text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export default function StatusButtons({ actions }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <CompleteButton action={actions.completed} />
      <ConfirmDeleteButton
        action={actions.no_show}
        label="Mark as no-show"
        variant="secondary"
        title="Mark as no-show?"
        message="Use this when the patient did not come to the appointment."
        confirmLabel="Yes, mark as no-show"
      />
      <ConfirmDeleteButton
        action={actions.cancelled}
        label="Cancel appointment"
        title="Cancel this appointment?"
        message="The time slot becomes available again."
        confirmLabel="Yes, cancel it"
      />
    </div>
  );
}
