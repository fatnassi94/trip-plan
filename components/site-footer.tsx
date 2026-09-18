import Link from "next/link";
import { Logo } from "@/components/brand/logo";

// Global footer. Links only to pages that exist — no Privacy/Terms links
// until those pages are written.
const LINKS = [
  { href: "/", label: "Explore" },
  { href: "/destinations", label: "Destinations" },
  { href: "/create-trip", label: "Trip planner" },
  { href: "/account", label: "My trips" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-accent-soft/50">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row lg:px-12">
        <div className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span>© {new Date().getFullYear()} RoamAI · Trips planned around how you travel.</span>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-5 font-display text-xs font-semibold">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-accent">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
