// The RoamAI compass mark: two open arcs, a diamond needle, and a sunset
// dot at its center. Drawn as SVG so it stays sharp at any size and needs
// no image asset.
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <path
        d="M20.5 31.5 A8.5 8.5 0 1 1 20.5 16.5"
        stroke="hsl(var(--accent))"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M27.5 16.5 A8.5 8.5 0 1 1 27.5 31.5"
        stroke="hsl(var(--accent))"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M12.5 35.5 L20 21 L35.5 12.5 L28 27 Z"
        fill="hsl(var(--paper))"
        stroke="hsl(var(--accent))"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="2.8" fill="hsl(var(--sunset))" />
    </svg>
  );
}
