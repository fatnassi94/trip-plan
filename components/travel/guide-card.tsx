import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { TravelImage } from "@/components/travel/travel-image";
import type { Guide } from "@/lib/destination-catalog";
import type { TravelImage as TravelImageData } from "@/lib/travel-images/types";

// A curated guide. Guides live on the destination they belong to for now
// (there is no /guides/[slug] reader yet), so the card links there and
// says so plainly rather than promising an article that doesn't exist.
export function GuideCard({
  guide,
  image,
  className = "",
}: {
  guide: Guide;
  image?: TravelImageData | null;
  className?: string;
}) {
  const primary = guide.destinationSlugs[0];

  return (
    <Link
      href={`/destinations/${primary}`}
      className={`group flex h-full flex-col overflow-hidden rounded-lg bg-surface shadow-card transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <TravelImage
        image={image}
        label={guide.title}
        sizes="(max-width: 640px) 90vw, 30vw"
        className="aspect-[16/10] w-full"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-deep/80 to-transparent"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-paper/15 px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-paper backdrop-blur-md">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          Guide
        </span>
      </TravelImage>

      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="font-display text-base font-bold text-accent">{guide.title}</span>
        <span className="text-sm leading-relaxed text-muted">{guide.summary}</span>
        <span className="mt-auto flex items-center gap-3 pt-2 font-display text-xs font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-warm" aria-hidden="true" />
            {guide.readingMinutes} min read
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{guide.destinationSlugs.join(", ").replace(/-/g, " ")}</span>
        </span>
      </span>
    </Link>
  );
}
