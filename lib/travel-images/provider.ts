import type { ImageSearchOptions, TravelImageResult } from "./types";
import { curatedProvider } from "./fallback";
import { hasUnsplashKey, unsplashProvider } from "./unsplash";

// One place decides where a destination photo comes from:
//
//   1. Unsplash        when UNSPLASH_ACCESS_KEY is set and the call works
//   2. curated URLs    from data/destinations.json (ops-supplied, licensed)
//   3. nothing         → the UI draws its own gradient placeholder
//
// TRAVEL_IMAGES_MODE overrides the chain: "curated" skips Unsplash,
// "off" skips both (used by the e2e suite so browser tests never depend
// on a third party). Anything else, or unset, means "auto".
//
// Results are memoised per process on top of Next's own fetch cache, so a
// page rendering eight cards for the same destination spends one request.

export type TravelImagesMode = "auto" | "curated" | "off";

const MEMO_TTL_MS = 10 * 60 * 1000;
const MEMO_MAX_ENTRIES = 500;

interface MemoEntry {
  at: number;
  result: TravelImageResult;
}

const memo = new Map<string, MemoEntry>();

export function travelImagesMode(): TravelImagesMode {
  const mode = process.env.TRAVEL_IMAGES_MODE;
  return mode === "curated" || mode === "off" ? mode : "auto";
}

/** Test seam: forget everything cached in this process. */
export function clearTravelImageCache(): void {
  memo.clear();
}

function cacheKey(query: string, options: ImageSearchOptions): string {
  return `${travelImagesMode()}|${query.trim().toLowerCase()}|${options.count ?? 6}|${options.orientation ?? "landscape"}`;
}

const EMPTY = (reason: string): TravelImageResult => ({
  images: [],
  source: "fallback",
  degraded: true,
  reason,
});

export async function getTravelImages(
  query: string,
  options: ImageSearchOptions = {},
): Promise<TravelImageResult> {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY("empty query");

  const key = cacheKey(trimmed, options);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.result;

  const result = await resolve(trimmed, options);

  // Only successful lookups are worth remembering: a failed Unsplash call
  // shouldn't pin the app to the fallback for ten minutes.
  if (result.images.length > 0) {
    if (memo.size >= MEMO_MAX_ENTRIES) memo.clear();
    memo.set(key, { at: Date.now(), result });
  }
  return result;
}

async function resolve(query: string, options: ImageSearchOptions): Promise<TravelImageResult> {
  const mode = travelImagesMode();
  if (mode === "off") return EMPTY("TRAVEL_IMAGES_MODE=off");

  if (mode === "auto" && hasUnsplashKey()) {
    try {
      const images = await unsplashProvider.searchDestinationImages(query, options);
      if (images.length > 0) return { images, source: "unsplash", degraded: false };
    } catch (err) {
      // Never surface a provider error to a traveler — fall through.
      console.error("Unsplash image lookup failed", err);
    }
  }

  const curated = await curatedProvider.searchDestinationImages(query, options);
  if (curated.length > 0) {
    return {
      images: curated,
      source: "curated",
      degraded: true,
      reason: hasUnsplashKey() ? "Unsplash unavailable" : "no UNSPLASH_ACCESS_KEY",
    };
  }

  return EMPTY(hasUnsplashKey() ? "no images found" : "no UNSPLASH_ACCESS_KEY, no curated images");
}

/** The single image a hero or card needs, or null for the placeholder. */
export async function getTravelImage(
  query: string,
  options: ImageSearchOptions = {},
): Promise<TravelImageResult> {
  const result = await getTravelImages(query, { ...options, count: options.count ?? 1 });
  return { ...result, images: result.images.slice(0, 1) };
}
