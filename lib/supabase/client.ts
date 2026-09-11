import { createBrowserClient } from "@supabase/ssr";

// Browser client — safe to use in Client Components. Only ever carries the
// anon key, which is meant to be public; row-level security in
// supabase/schema.sql is what actually protects data, not this key being
// secret. See the `supabase-security` skill before adding a table.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
