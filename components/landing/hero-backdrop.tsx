import { AmbientVideo } from "./ambient-video";

// The hero's moving background, in four stacked layers:
//   1. drifting aurora blobs   — ambient motion, pure CSS, no asset weight
//   2. optional ambient video  — fades in only if public/hero.mp4 exists
//   3. a route drawing itself  — the product's own signature gesture
//   4. grain + vignette        — stops the gradient looking like a cheap
//                                SaaS mesh and blends into the page below
//
// A Server Component: none of this is interactive. Only <AmbientVideo>
// crosses into the client, and only to decide whether it can play.

export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 1 — aurora */}
      <div className="absolute inset-0">
        <div
          className="roam-blob-a absolute -left-[15%] -top-[20%] h-[70vh] w-[70vh] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--accent) / 0.55), transparent 70%)",
          }}
        />
        <div
          className="roam-blob-b absolute -right-[10%] top-[5%] h-[60vh] w-[60vh] rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--warm) / 0.45), transparent 70%)",
          }}
        />
        <div
          className="roam-blob-c absolute bottom-[-25%] left-[25%] h-[65vh] w-[65vh] rounded-full opacity-45 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--accent-soft) / 0.9), transparent 70%)",
          }}
        />
      </div>

      {/* 2 — optional video */}
      <AmbientVideo />

      {/* 3 — the route */}
      <svg
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-[0.28]"
      >
        <path
          d="M 80 560 C 260 470, 300 300, 470 280 S 720 360, 830 240 S 1050 150, 1140 110"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1200"
          className="roam-route"
        />
        {[
          { cx: 80, cy: 560, delay: "0.6s" },
          { cx: 470, cy: 280, delay: "1.6s" },
          { cx: 830, cy: 240, delay: "2.6s" },
          { cx: 1140, cy: 110, delay: "3.4s" },
        ].map((pin) => (
          <circle
            key={`${pin.cx}-${pin.cy}`}
            cx={pin.cx}
            cy={pin.cy}
            r="7"
            fill="hsl(var(--accent))"
            className="roam-pin"
            style={{ animationDelay: pin.delay }}
          />
        ))}
      </svg>

      {/* 4 — grain + vignette */}
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{
          background: "linear-gradient(to bottom, transparent, hsl(var(--paper)))",
        }}
      />
    </div>
  );
}
