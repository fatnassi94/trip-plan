import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAuthConfigured } from "./config";

// This file now exports TWO clients at two different trust levels — see
// `supabase-security`. Don't reach for the service-role one out of
// convenience; anything that can be scoped by the requesting user's own
// session should use createSessionClient() instead (least privilege, see
// `database-security`).

/** True only when BOTH the project URL and the service-role key are set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// Service-role client — bypasses RLS entirely. Use only for the specific
// writes that genuinely need to (saving an AI-generated trip before we
// know its owner isn't one of those — see app/api/trips/generate/route.ts,
// which now stamps user_id itself before this insert runs).
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

// Session-aware client — reads the requesting user's own session from
// cookies (via @supabase/ssr) and respects RLS as that user, exactly as
// `auth-security` requires: "don't try to pass a user ID from the client
// and trust it." Use this in Server Components / Route Handlers whenever
// a request should act as "whoever is logged in", not as an admin.
//
// The `setAll` below can be called mid-render from a Server Component,
// where Next's cookies() is read-only and throws on .set(). That's safe
// to swallow here: middleware.ts (lib/supabase/middleware.ts) refreshes
// the session cookie on every request regardless, so a skipped write here
// just means "wait for the next request" rather than a lost session.
export function createSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isAuthConfigured() || !url || !anonKey) {
    throw new Error(
      "Supabase session client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — check isAuthConfigured() first.",
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component render — see comment above.
        }
      },
    },
  });
}
