import "server-only";
import { createClient } from "@supabase/supabase-js";

// ⚠️ SERVER ONLY. Uses the service_role key, so it bypasses RLS.
// Use ONLY for admin features (user management, backup, writing audit events).
// Never import this in any Client Component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
