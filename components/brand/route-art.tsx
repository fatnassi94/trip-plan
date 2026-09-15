// The brand's recurring flourish: a sunset route drawing itself between
// three pins. Decorative only (aria-hidden) and animated purely through
// the .roam-route / .roam-pin classes in globals.css, so reduced-motion
// users get the finished drawing with no movement. Sized by its parent.
const PINS: [number, number][] = [
  [24, 158],
  [196, 108],
  [372, 58],
];

export function RouteArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M-20 120 C 70 60, 140 200, 230 150 S 360 90, 430 130"
        stroke="hsl(var(--paper) / 0.14)"
        strokeWidth="1.5"
        strokeDasharray="3 7"
      />
      <path
        className="roam-route"
        d="M24 158 C 84 96, 136 170, 196 108 S 300 34, 372 58"
        stroke="hsl(var(--sunset))"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {PINS.map(([cx, cy], i) => (
        <circle
          key={`${cx}-${cy}`}
          className="roam-pin"
          style={{ animationDelay: `${0.5 + i * 1.1}s` }}
          cx={cx}
          cy={cy}
          r="5.5"
          fill="hsl(var(--paper))"
          stroke="hsl(var(--sunset))"
          strokeWidth="2.5"
        />
      ))}
    </svg>
  );
}
