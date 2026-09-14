import { createBrowserClient } from "@supabase/ssr";
import { isAuthConfigured } from "./config";

// Browser client — safe to use in Client Components. Only ever carries the
// anon key, which is meant to be public; row-level security in
// supabase/schema.sql is what actually protects data, not this key being
// secret. See the `supabase-security` skill before adding a table.
//
// Used for Auth (sign up / log in — see components/auth/auth-form.tsx)
// as well as any RLS-scoped read a Client Component wants to do directly.
export function createClient() {
  if (!isAuthConfigured()) {
    throw new Error(
      "Supabase auth requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — check isAuthConfigured() before calling createClient().",
    );
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export { isAuthConfigured };
