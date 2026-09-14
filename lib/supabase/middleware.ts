import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthConfigured } from "./config";

// Required by @supabase/ssr for Next.js App Router: Server Components
// can read cookies but can't write them, so the auth token has to be
// refreshed somewhere that CAN write — middleware, on every request. Skip
// this and sessions silently expire even while a user is actively using
// the app. See middleware.ts at the project root, which just calls this.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  if (!isAuthConfigured()) {
    // No Supabase project wired up for auth yet — nothing to refresh.
    // Let every request through unchanged rather than erroring on every
    // page load (see .env.example: the app still runs without this).
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // The actual refresh — discarding the result is intentional, this call
  // is for its cookie-writing side effect (see setAll above), not the
  // returned user. Never gate a route here; that belongs in the route
  // itself (see app/account/page.tsx, app/api/trips/generate/route.ts).
  await supabase.auth.getUser();

  return response;
}
