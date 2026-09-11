"use client";

import { useEffect, useRef, useState } from "react";

// Scroll-reveal wrapper. The animation itself lives in globals.css
// (`.roam-reveal`) so that the reduced-motion override can switch it off
// in one place; this component only decides *when* an element is visible.
//
// IntersectionObserver over a scroll listener on purpose: no layout
// thrash, and it stops observing as soon as an element has appeared.

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  /** Stagger, in milliseconds, for items revealed as a group. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // If the browser can't observe, show the content rather than hiding
    // it forever — never let a progressive enhancement remove content.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-visible={visible}
      style={{ transitionDelay: `${delay}ms` }}
      className={`roam-reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
