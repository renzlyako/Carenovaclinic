"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators/auth";
import { logAuditEvent } from "@/lib/audit/log";

export async function loginAction(prevState, formData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAuditEvent({ userEmail: parsed.data.email, action: "LOGIN_FAILED" });
    return { error: "Incorrect email or password." };
  }

  await logAuditEvent({ userId: data.user.id, userEmail: data.user.email, action: "LOGIN" });
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await logAuditEvent({ userId: user.id, userEmail: user.email, action: "LOGOUT" });
  await supabase.auth.signOut();
  redirect("/login");
}
