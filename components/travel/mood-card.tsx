import Link from "next/link";
import { TravelImage } from "@/components/travel/travel-image";
import type { Mood } from "@/lib/destination-catalog";
import type { TravelImage as TravelImageData } from "@/lib/travel-images/types";

// A travel mood — the "what kind of trip are you after" entry point.
// Links into the explorer with that mood pre-applied.
export function MoodCard({
  mood,
  image,
  count,
}: {
  mood: Mood;
  image?: TravelImageData | null;
  count: number;
}) {
  return (
    <Link
      href={`/destinations?mood=${mood.id}`}
      className="group relative block overflow-hidden rounded-lg shadow-card transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <TravelImage
        image={image}
        label={mood.label}
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
        className="aspect-[5/4] w-full"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-deep/90 via-deep/35 to-transparent transition-opacity duration-300 group-hover:from-deep/95"
        />
        <span className="absolute inset-x-0 bottom-0 p-3 text-paper">
          <span className="block font-display text-sm font-bold leading-tight">{mood.label}</span>
          <span className="mt-0.5 block text-[0.7rem] text-accent-soft/90">{mood.blurb}</span>
          <span className="mt-1.5 inline-block rounded-full bg-paper/15 px-2 py-0.5 font-mono text-[0.6rem] font-bold backdrop-blur-md">
            {count} {count === 1 ? "place" : "places"}
          </span>
        </span>
      </TravelImage>
    </Link>
  );
}
