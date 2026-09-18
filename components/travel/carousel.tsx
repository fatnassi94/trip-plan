"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// A scroll-snap row with arrow buttons on wider screens. The row itself
// is a plain scroll container, so touch, trackpad and keyboard scrolling
// all work with no JavaScript; the buttons are an enhancement and are
// hidden from screen readers, which move through the links directly.
export function Carousel({
  label,
  children,
  itemClassName = "w-[78vw] max-w-[22rem] sm:w-[20rem]",
}: {
  label: string;
  children: React.ReactNode;
  itemClassName?: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  const items = Array.isArray(children) ? children : [children];

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        aria-label={label}
        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 lg:-mx-2 lg:px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, index) => (
          <li key={index} className={`shrink-0 snap-start ${itemClassName}`}>
            {child}
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="pointer-events-none hidden lg:block">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => scrollBy(-1)}
          className="pointer-events-auto absolute -left-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-accent shadow-lift transition-colors hover:bg-accent hover:text-paper"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => scrollBy(1)}
          className="pointer-events-auto absolute -right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-accent shadow-lift transition-colors hover:bg-accent hover:text-paper"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
