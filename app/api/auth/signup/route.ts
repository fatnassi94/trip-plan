import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

// Creates the account server-side, already confirmed, so Supabase never
// sends a confirmation email.
//
// Why not the ordinary client-side supabase.auth.signUp()? Because it
// triggers a confirmation email on every attempt, and Supabase's built-in
// email sender is rate limited to a handful per hour on the default
// (no custom SMTP) setup — the very first real signup on this project hit
// "email rate limit exceeded" and could not create an account at all.
// Creating the user with the admin API and `email_confirm: true` sends no
// mail, so there is no rate limit to hit and no inbox round-trip before a
// traveler can see the trip they just paid for.
//
// The tradeoff, stated plainly: email addresses are no longer verified.
// That's the right call for this app today (nothing is emailed to users,
// and the account exists to hold a plan and a trip history) but it must
// change before anything is sent to those addresses or before a password
// reset flow exists. To go back to verified email, delete this route,
// point AuthForm at supabase.auth.signUp() again, and configure a custom
// SMTP provider in the Supabase dashboard to lift the rate limit.

const BodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72), // 72 = bcrypt's own input ceiling
});

export async function POST(req: Request) {
  if (!isAuthConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Sign-up isn't configured for this deployment." },
      { status: 503 },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and a password of at least 8 characters." },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  // Service-role client: creating a user is precisely the kind of write
  // that has to bypass RLS, and `auth.admin` exists only on this client.
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // Supabase reports an existing address as a 422/"already been registered".
    // Surface that as its own status so the form can point at the log-in tab
    // instead of showing a generic failure.
    const alreadyExists =
      error.status === 422 || /already|exists|registered/i.test(error.message);
    if (alreadyExists) {
      return NextResponse.json(
        { error: "An account with this email already exists — log in instead." },
        { status: 409 },
      );
    }
    console.error("Sign-up failed", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: data.user?.id ?? null });
}
