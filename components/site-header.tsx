"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";

// Global navigation from the design system. "Live Companion" is left out
// on purpose: that screen doesn't exist yet, and a nav link to nothing
// would be the first broken promise a traveler meets.
const NAV = [
  { href: "/", label: "Explore", match: (p: string) => p === "/" },
  {
    href: "/create-trip",
    label: "Trip Planner",
    match: (p: string) =>
      p.startsWith("/create-trip") || p.startsWith("/trip") || p.startsWith("/unlock"),
  },
  { href: "/profile", label: "Travel DNA", match: (p: string) => p.startsWith("/profile") },
  { href: "/account", label: "My Trips", match: (p: string) => p.startsWith("/account") },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 lg:px-12">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-semibold tracking-tight text-accent">
            RoamAI
          </span>
          <span className="hidden rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted sm:inline">
            Beta
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-1 rounded-md bg-accent-soft/60 p-1 lg:flex"
        >
          <NavLinks pathname={pathname} />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/create-trip"
            className="inline-flex items-center gap-1.5 rounded bg-accent px-4 py-2 font-display text-sm font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Sparkles className="h-4 w-4 text-sunset" aria-hidden="true" />
            New Trip
          </Link>
          <Link
            href="/account"
            aria-label="My account"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent transition-colors hover:bg-accent hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Below lg the pill nav doesn't fit beside the actions, so it drops
          to its own scrollable row instead of disappearing — phones need
          a way to reach My Trips too. Only one of the two navs is ever
          displayed, so screen readers meet a single "Main" landmark. */}
      <nav aria-label="Main" className="border-t border-border/60 lg:hidden">
        <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-3 py-1.5">
          <NavLinks pathname={pathname} />
        </div>
      </nav>
    </header>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded px-3.5 py-1.5 font-display text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              active
                ? "bg-surface font-semibold text-accent shadow-card"
                : "text-muted hover:bg-surface/70 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
