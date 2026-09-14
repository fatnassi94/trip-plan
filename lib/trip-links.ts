import type { ItineraryItem } from "@/types/trip";

// Map/street-view deep links and budget-estimate formatting for the Day
// Detail activity card. Plain functions, no React — same reasoning as
// lib/ai/scoring.ts: "why does this card show that link/price" should
// always be answerable by reading a pure function, not by inspecting a
// component's render output.
//
// Deliberately built entirely from keyless, public URL schemes:
//   - a Google Maps search/pano deep link (no API key required — this is
//     the same URL your browser produces for "Open in Google Maps")
//   - an OpenStreetMap embed + view link (OSM's export/embed endpoint
//     needs no key or account at all)
// This keeps the "free tier" ethos already established for the Gemini
// key, and avoids introducing a new secret/NEXT_PUBLIC_* var this
// project doesn't otherwise need — see api-security / ai-security.

export interface MapLinks {
  /** Always present: a Google Maps search for the venue. */
  googleSearchUrl: string;
  /** Present only when we have coordinates: a real Google Street View pano. */
  streetViewUrl: string | null;
  /** Present only when we have coordinates: a keyless OSM embed (iframe src). */
  osmEmbedUrl: string | null;
  /** Present only when we have coordinates: "open this spot" on openstreetmap.org. */
  osmViewUrl: string | null;
}

export function buildMapLinks(item: ItineraryItem, destination: string): MapLinks {
  const query = encodeURIComponent(item.address || `${item.name}, ${destination}`);
  const googleSearchUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  if (item.lat == null || item.lng == null) {
    return { googleSearchUrl, streetViewUrl: null, osmEmbedUrl: null, osmViewUrl: null };
  }

  const { lat, lng } = item;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  // A small bounding box around the point — tight enough to read as "this
  // exact spot" rather than the whole city.
  const delta = 0.006;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lng}&layer=mapnik`;
  const osmViewUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  return { googleSearchUrl, streetViewUrl, osmEmbedUrl, osmViewUrl };
}

/**
 * A human-readable cost estimate from the AI's 1-4 `priceLevel`. There's
 * no live pricing data behind this — it's the same coarse banding Google
 * Places/Maps uses (€ / €€ / €€€ / €€€€), spelled out as a range so it
 * reads as an estimate rather than a quoted price.
 */
export function formatPriceEstimate(item: Pick<ItineraryItem, "priceLevel" | "tags">): string {
  if (item.tags?.some((t) => /\bfree\b/i.test(t))) return "Free";

  switch (item.priceLevel) {
    case 1:
      return "Free–€10 per person";
    case 2:
      return "€10–30 per person";
    case 3:
      return "€30–70 per person";
    case 4:
      return "€70+ per person";
    default:
      return "Price varies";
  }
}
