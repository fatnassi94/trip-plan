"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// RoamAI typing its question out, the way a person in a chat does.
//
// Two beats, not one: a short pause with the three dots first — that is
// what reads as "someone is answering you" rather than "text appeared" —
// then the characters. Both are skippable, and both are off entirely under
// prefers-reduced-motion, where the whole point of the effect (implied
// delay) is exactly what some people need gone.

export type TypewriterPhase = "pausing" | "typing" | "done";

interface Options {
  /** False renders the text immediately — reduced motion, or a re-read. */
  enabled?: boolean;
  /** How long the "…" shows before the words start. */
  pauseMs?: number;
  /** Milliseconds per character. */
  charMs?: number;
  /** Never spend longer than this typing, however long the line is. */
  maxMs?: number;
}

export function useTypewriter(
  text: string,
  { enabled = true, pauseMs = 300, charMs = 14, maxMs = 700 }: Options = {},
) {
  const [phase, setPhase] = useState<TypewriterPhase>(enabled ? "pausing" : "done");
  const [count, setCount] = useState(enabled ? 0 : text.length);
  const countRef = useRef(count);
  countRef.current = count;

  // Each new question restarts the whole performance.
  useEffect(() => {
    if (!enabled) {
      setPhase("done");
      setCount(text.length);
      return;
    }
    setPhase("pausing");
    setCount(0);
    const timer = setTimeout(() => setPhase("typing"), pauseMs);
    return () => clearTimeout(timer);
  }, [text, enabled, pauseMs]);

  useEffect(() => {
    if (phase !== "typing") return;
    // Reveal more than one character a tick when the line is long, so a
    // wordy question doesn't out-stay its welcome.
    const step = Math.max(1, Math.ceil(text.length / (maxMs / charMs)));
    let shown = countRef.current;

    const id = setInterval(() => {
      shown += step;
      if (shown >= text.length) {
        setCount(text.length);
        setPhase("done");
        clearInterval(id);
      } else {
        setCount(shown);
      }
    }, charMs);

    return () => clearInterval(id);
    // countRef is deliberately read once at the start of a typing run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, text, charMs, maxMs]);

  /** Cut to the end — a tap anywhere on the thread calls this. */
  const skip = useCallback(() => {
    setCount(text.length);
    setPhase("done");
  }, [text]);

  return { typed: text.slice(0, count), phase, skip, done: phase === "done" };
}
