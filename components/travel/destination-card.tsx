import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";
import { TravelImage } from "@/components/travel/travel-image";
import type { DestinationSummary } from "@/lib/destination-summary";
import type { TravelImage as TravelImageData } from "@/lib/travel-images/types";

// An image-first destination card: photo, gradient scrim, name and
// country over it, and the practical numbers underneath.
export function DestinationCard({
  destination,
  image,
  priority = false,
  className = "",
}: {
  destination: DestinationSummary;
  image?: TravelImageData | null;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/destinations/${destination.slug}`}
      className={`group flex flex-col overflow-hidden rounded-lg bg-surface shadow-card transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <TravelImage
        image={image}
        label={`${destination.name}, ${destination.country}`}
        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
        priority={priority}
        className="aspect-[4/3] w-full"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-deep/85 via-deep/20 to-transparent"
        />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-paper">
          <span className="min-w-0">
            <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm-soft">
              {destination.country}
            </span>
            <span className="block truncate font-display text-xl font-bold">{destination.name}</span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/15 backdrop-blur-md transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
      </TravelImage>

      <span className="flex flex-1 flex-col gap-3 p-4">
        <span className="text-sm leading-relaxed text-muted">{destination.shortDescription}</span>
        <span className="mt-auto flex flex-wrap items-center gap-1.5">
          {destination.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-accent-soft/70 px-2.5 py-1 font-display text-[0.7rem] font-medium text-accent"
            >
              {tag}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-3 border-t border-border pt-3 font-display text-xs font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-warm" aria-hidden="true" />
            {destination.dailyBudget}
          </span>
          <span aria-hidden="true">·</span>
          <span>{destination.tripDurationSuggestion}</span>
        </span>
      </span>
    </Link>
  );
}
