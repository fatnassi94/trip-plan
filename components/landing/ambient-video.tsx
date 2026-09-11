"use client";

import { useEffect, useRef, useState } from "react";

// Optional cinematic layer for the hero.
//
// Drop a short, silent, looping clip at `public/hero.mp4` (and optionally
// `public/hero.webm`) and it fades in behind the headline. Ship nothing
// and the animated gradient in <HeroBackdrop> carries the screen on its
// own — that's why this component starts hidden and only reveals itself
// once the browser confirms it has enough data to play.
//
// Rules it has to respect:
//   - muted + playsInline, or mobile browsers refuse to autoplay at all
//   - never autoplay for a traveler who asked for reduced motion
//   - a missing file is a normal outcome, not an error state to show

export function AmbientVideo({
  src = "/hero.mp4",
  webmSrc = "/hero.webm",
}: {
  src?: string;
  webmSrc?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"pending" | "playing" | "absent">("pending");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setState("absent");
      return;
    }

    const video = ref.current;
    if (!video) return;

    // Some browsers resolve autoplay as a rejected promise rather than an
    // error event. Treat both as "no video", never as a broken page.
    void video.play().catch(() => setState("absent"));
  }, []);

  if (state === "absent") return null;

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      onCanPlay={() => setState("playing")}
      onError={() => setState("absent")}
      className={`roam-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
        state === "playing" ? "opacity-40 dark:opacity-30" : "opacity-0"
      }`}
    >
      <source src={webmSrc} type="video/webm" />
      <source src={src} type="video/mp4" />
    </video>
  );
}
