// Whether Supabase Auth can actually be used — i.e. the two PUBLIC env
// vars a browser client needs are both set. Deliberately its own file
// with no "use client"/"server-only" marker: both lib/supabase/client.ts
// (browser) and lib/supabase/server.ts (server-only) need this same
// check, and it only reads NEXT_PUBLIC_* vars, which are safe to read in
// either environment.
//
// This is a DIFFERENT question from `isSupabaseConfigured()` in
// lib/supabase/server.ts, which checks the SERVICE ROLE key — a project
// can have persistence configured without auth, or vice versa.
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
