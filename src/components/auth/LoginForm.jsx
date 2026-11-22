"use client";
import { useActionState } from "react";
import { loginAction } from "@/actions/auth.actions";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { LogIn } from "lucide-react";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      {state?.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending} icon={LogIn}>
        {pending ? "Logging in..." : "Login"}
      </Button>
    </form>
  );
}
