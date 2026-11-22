import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Get the logged-in user + profile (role). Returns null if there is none.
// cache(): the layout and the page of the same request share one lookup instead of asking Supabase twice.
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

// Use in Server Components / Server Actions. This is the second layer of security
// (first the middleware, third the RLS in the database).
export async function requireRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowedRoles.includes(user.role)) redirect("/unauthorized");
  return user;
}
