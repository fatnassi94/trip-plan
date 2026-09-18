"use client";

import { useState } from "react";
import Image from "next/image";
import { Compass } from "lucide-react";
import type { TravelImage as TravelImageData } from "@/lib/travel-images/types";

// One image component for the whole discovery experience.
//
// It always renders *something*: a photo when the provider found one, a
// skeleton while that photo loads, and a designed gradient with the
// destination's initials when there is no photo or the URL breaks. The
// caller sets the box (aspect ratio or height) so nothing shifts when the
// image arrives.

interface TravelImageProps {
  image?: TravelImageData | null;
  /** Destination or section name — the placeholder's initials, and the
   * alt text when there's no photo to describe. */
  label: string;
  /** next/image `sizes`, so the browser downloads the right width. */
  sizes: string;
  priority?: boolean;
  /** Box classes: an aspect ratio or a height, plus any rounding. */
  className?: string;
  /** Unsplash asks for author credit wherever a photo is shown large. */
  showCredit?: boolean;
  /** Full-bleed backdrops (the heroes) want a clean gradient behind their
   * own text, not a monogram floating mid-headline. */
  plainPlaceholder?: boolean;
  children?: React.ReactNode;
}

/** Stable per label, so a destination keeps the same placeholder colours. */
const GRADIENTS = [
  "from-deep via-accent to-warm",
  "from-accent via-deep to-sunset",
  "from-warm via-accent to-deep",
  "from-deep via-warm to-accent",
  "from-accent via-sunset to-deep",
];

function gradientFor(label: string): string {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return GRADIENTS[hash % GRADIENTS.length];
}

function initials(label: string): string {
  return label
    .split(/[\s,]+/)
    // Skip "&", "of", punctuation-only words: "Beaches & islands" → "BI".
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function TravelImage({
  image,
  label,
  sizes,
  priority = false,
  className = "",
  showCredit = false,
  plainPlaceholder = false,
  children,
}: TravelImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const usePhoto = Boolean(image?.url) && !broken;

  return (
    <div
      data-image-state={usePhoto ? (loaded ? "photo" : "loading") : "placeholder"}
      className={`relative isolate overflow-hidden bg-gradient-to-br ${gradientFor(label)} ${className}`}
    >
      {usePhoto && image ? (
        <>
          <Image
            src={image.url}
            alt={image.alt || `${label} travel photograph`}
            fill
            sizes={sizes}
            priority={priority}
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
            className={`object-cover transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
          {!loaded ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-accent-soft via-surface to-accent-soft"
            />
          ) : null}
        </>
      ) : (
        !plainPlaceholder ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-paper/90"
          >
            <Compass className="h-6 w-6 opacity-80" />
            <span className="font-display text-lg font-bold tracking-widest opacity-90">
              {initials(label)}
            </span>
          </span>
        ) : null
      )}

      {/* Photo-free boxes still need an accessible name for the region. */}
      {!usePhoto ? <span className="sr-only">{label}</span> : null}

      {children}

      {showCredit && usePhoto && image?.authorName ? (
        <span className="absolute bottom-1.5 right-2 z-10 rounded bg-deep/55 px-1.5 py-0.5 text-[0.6rem] text-paper/90 backdrop-blur-sm">
          Photo:{" "}
          {image.authorUrl ? (
            <a
              href={image.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {image.authorName}
            </a>
          ) : (
            image.authorName
          )}
          {" / Unsplash"}
        </span>
      ) : null}
    </div>
  );
}
