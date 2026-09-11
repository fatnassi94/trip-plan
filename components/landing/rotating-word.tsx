"use client";

import { useEffect, useState } from "react";

// Cycles a single word inside the headline — "Your trip to Kyoto." →
// "Your trip to Lisbon." It's the one piece of the hero that says
// *travel* without a stock photo of a beach.
//
// The longest word is rendered invisibly underneath so the headline never
// reflows as the word changes; a rotating word that shoves the rest of
// the sentence around on every tick reads as a bug, not a flourish.

export function RotatingWord({
  words,
  suffix = "",
  intervalMs = 2400,
  className = "",
}: {
  words: string[];
  /** Punctuation that must hug the word — it sits inside the sized cell so
   *  it never drifts away from the end of the shorter words. */
  suffix?: string;
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimate(false);
      return;
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");

  return (
    <span className={`relative inline-grid align-bottom ${className}`}>
      {/* Reserves the width of the widest word. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {longest}
        {suffix}
      </span>
      <span
        key={animate ? index : "static"}
        className={`col-start-1 row-start-1 justify-self-start ${
          animate ? "roam-rise" : ""
        }`}
        style={{ animationDuration: "0.5s" }}
      >
        <span className="text-accent">{words[index]}</span>
        {suffix}
      </span>
    </span>
  );
}
