import { createBrowserClient } from "@supabase/ssr";

// For Client Components (browser). Only the anon/publishable key is used here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
