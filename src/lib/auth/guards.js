import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) return null;
  return { ...profile, email: user.email };
});

export async function requireRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowedRoles.includes(user.role)) redirect("/unauthorized");
  return user;
}
