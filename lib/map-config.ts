// Map settings shared by components/trip/route-map.tsx and its tests.

/**
 * Keyless vector tiles (https://openfreemap.org) — no API key or account.
 * NEXT_PUBLIC_MAP_STYLE_URL overrides it; the e2e suite points it at a
 * blank local style so map tests don't depend on the internet.
 */
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

/** Where scripts/vendor-maplibre.mjs puts the worker, under public/. */
export const MAPLIBRE_VENDOR_PATH = "/vendor/maplibre-gl";

/** Absolute, same-origin URL of the MapLibre worker for `version`. */
export function maplibreWorkerUrl(version: string, origin: string): string {
  return new URL(`${MAPLIBRE_VENDOR_PATH}/${version}/maplibre-gl-worker.mjs`, origin).href;
}
