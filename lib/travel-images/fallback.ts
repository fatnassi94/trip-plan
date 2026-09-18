import destinations from "@/data/destinations.json";
import type { ImageSearchOptions, TravelImage, TravelImageProvider } from "./types";

// Tier 2: curated image URLs carried by the destination catalog itself
// (data/destinations.json → `curatedImages`). Shipped empty on purpose —
// we don't hotlink photographs we have no licence for. Fill a
// destination's `curatedImages` with URLs you're allowed to serve and the
// app uses them whenever Unsplash is unavailable.
//
// When a destination has none, this provider returns nothing and the UI
// falls through to its designed gradient placeholder (tier 3), which is
// honest: no photo rather than the wrong photo.

interface CuratedEntry {
  slug: string;
  name: string;
  country: string;
  heroImageQuery: string;
  galleryImageQueries: string[];
  curatedImages?: { url: string; thumbUrl?: string; alt: string; credit?: string; creditUrl?: string }[];
}

const CATALOG = destinations as CuratedEntry[];

/** Matches a free-text query back to a catalog entry, loosely. */
function findEntry(query: string): CuratedEntry | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return CATALOG.find((entry) => {
    if (q.includes(entry.name.toLowerCase())) return true;
    if (entry.heroImageQuery.toLowerCase() === q) return true;
    return entry.galleryImageQueries.some((g) => g.toLowerCase() === q);
  });
}

export const curatedProvider: TravelImageProvider = {
  name: "curated",

  async searchDestinationImages(query: string, options: ImageSearchOptions = {}) {
    const entry = findEntry(query);
    const curated = entry?.curatedImages ?? [];
    const count = options.count ?? 6;

    return curated.slice(0, count).map<TravelImage>((image, index) => ({
      id: `${entry?.slug ?? "curated"}-${index}`,
      url: image.url,
      thumbUrl: image.thumbUrl ?? image.url,
      alt: image.alt,
      authorName: image.credit,
      authorUrl: image.creditUrl,
      provider: "curated",
    }));
  },
};
