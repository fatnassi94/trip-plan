// The shape every image source returns, so the rest of the app never
// knows (or cares) which provider answered.

export type TravelImageProviderName = "unsplash" | "curated" | "fallback";

export interface TravelImage {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  /** Present when the provider's terms require attribution (Unsplash). */
  authorName?: string;
  authorUrl?: string;
  /** Average colour of the photo — used as the blur/placeholder ground. */
  color?: string;
  provider: TravelImageProviderName;
}

export interface ImageSearchOptions {
  count?: number;
  orientation?: "landscape" | "portrait" | "squarish";
}

export interface TravelImageProvider {
  name: TravelImageProviderName;
  searchDestinationImages(query: string, options?: ImageSearchOptions): Promise<TravelImage[]>;
}

/** What getTravelImages() answers with: images plus where they came from. */
export interface TravelImageResult {
  images: TravelImage[];
  source: TravelImageProviderName;
  /** True when the preferred provider couldn't answer (no key, error, off). */
  degraded: boolean;
  /** Developer-facing reason for the degrade; never shown to travelers. */
  reason?: string;
}
