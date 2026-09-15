"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient, isAuthConfigured } from "@/lib/supabase/client";

interface AuthFormProps {
  /** Called once a real session cookie exists — after a successful login,
   * or after signup (which creates the account server-side already
   * confirmed and then signs in). Never called on a failed attempt. */
  onAuthenticated: () => void | Promise<void>;
}

const INPUT_CLASS =
  "rounded border border-border bg-surface px-3.5 py-3 text-sm outline-none transition-shadow focus:border-accent focus:ring-4 focus:ring-accent/10";

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!isAuthConfigured()) {
    return (
      <p className="rounded-md border border-warm bg-warm-soft px-4 py-3 text-sm text-warm">
        Sign-in isn&apos;t configured for this deployment yet — add{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to .env.local (see
        .env.example) to enable it.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return; // no double-submit

    setStatus("submitting");
    setError(null);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        // Server-side account creation (app/api/auth/signup/route.ts) so
        // no confirmation email is sent — Supabase's built-in mailer is
        // rate limited to a few per hour and was blocking signup entirely.
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          if (res.status === 409) setMode("login");
          throw new Error(payload?.error ?? "Could not create your account");
        }
      }

      // Both paths end here: the account now exists and is confirmed, so
      // signing in is what actually establishes the session cookie that
      // every subsequent server call authenticates against.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      setStatus("idle");
      await onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div>
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
        {mode === "signup" ? "New to RoamAI" : "Welcome back"}
      </p>
      <h2 className="mt-1 font-display text-xl font-bold text-accent">
        {mode === "signup" ? "Create your account" : "Log in to your account"}
      </h2>

      <div
        role="tablist"
        aria-label="Sign up or log in"
        className="mt-5 grid grid-cols-2 gap-1 rounded-md bg-accent-soft p-1"
      >
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded px-3 py-2 font-display text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              mode === m ? "bg-surface font-semibold text-accent shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            {m === "signup" ? "Create account" : "Log in"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 font-display text-sm font-semibold text-ink">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${INPUT_CLASS} font-sans font-normal`}
          />
        </label>
        <label className="flex flex-col gap-1.5 font-display text-sm font-semibold text-ink">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${INPUT_CLASS} font-sans font-normal`}
          />
          {mode === "signup" ? (
            <span className="font-sans text-xs font-normal text-muted">At least 8 characters.</span>
          ) : null}
        </label>

        {error ? (
          <p role="alert" className="rounded-md border border-warm bg-warm-soft px-3 py-2 text-xs text-warm">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3 font-display font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Please wait…
            </>
          ) : mode === "signup" ? (
            "Create account"
          ) : (
            "Log in"
          )}
        </button>
      </form>
    </div>
  );
}
