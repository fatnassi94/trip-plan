import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Service-role client — SERVER ONLY. `server-only` above makes any
// accidental client-side import fail the build instead of leaking the key
// to the browser. Use this in API routes for writes that must bypass RLS
// (e.g. saving an AI-generated trip); everything user-facing should still
// go through the browser client + RLS policies. See `api-security`.

/** True only when BOTH the project URL and the service-role key are set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false },
  });
}
