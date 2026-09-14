"use client";

import { useState } from "react";
import { createClient, isAuthConfigured } from "@/lib/supabase/client";

// Ends the session and sends the traveler back to the auth screen.
//
// Deliberately a FULL page navigation rather than router.push/refresh.
// Logging out from /unlock exposed why: push("/unlock") is a no-op when
// you're already on /unlock, and refresh() only re-runs Server
// Components — so the client-side state machine kept its resolved
// "plans" phase and went on showing pricing to a signed-out visitor. A
// hard navigation is the only thing that reliably re-resolves auth
// everywhere at once: client state, Server Component cache, and any
// in-memory Supabase session are all discarded together. Logout is
// exactly the moment to prefer certainty over a soft transition.
export function LogoutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  if (!isAuthConfigured()) return null;

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Even if the network call fails the local session is cleared, and
      // the reload below re-resolves auth from scratch either way.
    }
    window.location.assign("/unlock");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className={`text-sm text-muted underline underline-offset-4 transition-colors hover:text-accent disabled:opacity-50 ${className}`}
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
