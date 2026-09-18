import "server-only";
import type { ImageSearchOptions, TravelImage, TravelImageProvider } from "./types";

// Unsplash, the first real provider. Server-only: UNSPLASH_ACCESS_KEY is
// never exposed to the browser (no NEXT_PUBLIC_ prefix, and this module
// can't be imported from a Client Component).
//
// Results are cached by Next's fetch cache for a day — destination photos
// don't change hour to hour, and the free tier is rate limited (50
// requests/hour), so repeat visits must not spend a request each.

const ENDPOINT = "https://api.unsplash.com/search/photos";
const CACHE_SECONDS = 60 * 60 * 24;

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
  color: string | null;
  urls: { regular: string; small: string };
  user: { name: string; links: { html: string } };
}

export function hasUnsplashKey(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

export const unsplashProvider: TravelImageProvider = {
  name: "unsplash",

  async searchDestinationImages(query: string, options: ImageSearchOptions = {}) {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) throw new Error("UNSPLASH_ACCESS_KEY is not set");

    const url = new URL(ENDPOINT);
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(Math.min(Math.max(options.count ?? 6, 1), 24)));
    url.searchParams.set("orientation", options.orientation ?? "landscape");
    url.searchParams.set("content_filter", "high");

    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) {
      throw new Error(`Unsplash responded ${res.status}`);
    }

    const payload = (await res.json()) as { results?: UnsplashPhoto[] };
    return (payload.results ?? []).map((photo) => toTravelImage(photo, query));
  },
};

function toTravelImage(photo: UnsplashPhoto, query: string): TravelImage {
  return {
    id: photo.id,
    url: photo.urls.regular,
    thumbUrl: photo.urls.small,
    // Unsplash alt text is often missing; the query is a better fallback
    // than an empty string for a screen reader.
    alt: photo.alt_description?.trim() || photo.description?.trim() || `${query} travel photograph`,
    authorName: photo.user?.name,
    authorUrl: photo.user?.links?.html,
    color: photo.color ?? undefined,
    provider: "unsplash",
  };
}
