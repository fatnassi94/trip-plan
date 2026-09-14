"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
// Named imports only: maplibre-gl v6 ships ESM with no default export, and
// its own `Map` class is aliased on the way in so it doesn't shadow the
// built-in global `Map` this file also uses (for the marker registry below).
import {
  Map as MaplibreMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre v6 ships its tile-parsing code as a SEPARATE worker bundle and
// locates it via import.meta.url at runtime — a pattern that assumes an
// unbundled ESM environment. Under Next.js's webpack bundling that
// self-location resolves to the current PAGE's own URL instead, so the
// Worker MapLibre spins up tries to run the page's HTML as a script and
// is destroyed immediately. Tiles still fetch fine over the network
// (that's a plain main-thread fetch), but nothing ever parses them, so
// "load" never fires and no map draws — confirmed by tracing actual
// Worker creation, whose .url() was the page itself, not a worker script.
//
// Pointing webpack at the local file (`new URL(..., import.meta.url)`,
// its own asset-module pattern) gets the worker's OWN url right but
// doesn't fix the problem: that worker script has a further internal
// `import "./maplibre-gl-shared.mjs"` sibling file, and webpack's `new
// URL()` asset handling copies the target file verbatim without
// following or re-emitting what it imports — so the worker loads, then
// immediately fails to resolve its own dependency (confirmed: a 404 for
// maplibre-gl-shared.mjs right as the worker died). Replicating the
// package's internal file layout by hand in the webpack build is
// fragile and version-specific in exactly the way that breaks silently
// on the next `npm update`.
//
// Pointing at unpkg instead sidesteps the gap entirely: unpkg serves the
// package's real dist/ folder with its real relative paths intact, so
// the worker's sibling import resolves correctly with zero extra config.
// Pinned to the exact installed version below — the main thread (bundled
// from node_modules) and the worker (fetched from the CDN) must speak
// the same internal protocol. Keep this in sync with the "maplibre-gl"
// version in package.json; typecheck/build won't catch a drift here
// since it's just a string, so double-check this after any upgrade.
const MAPLIBRE_VERSION = "6.9.0";
setWorkerUrl(`https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl-worker.mjs`);

export interface RouteMapStop {
  key: string;
  lat: number;
  lng: number;
  label: number;
}

interface RouteMapProps {
  stops: RouteMapStop[];
  selectedKey?: string | null;
  onSelectStop?: (key: string) => void;
}

// Keyless by design, matching every other third-party call in this app
// (the OSM embed on the Day Detail activity card, the Gemini free tier):
// OpenFreeMap (https://openfreemap.org) is a vector-tile host built
// specifically for MapLibre GL JS with no API key, account, or usage cap
// — nothing new to add to .env.local.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "roamai-route";

type MarkerMap = Map<string, Marker>;

export function RouteMap({ stops, selectedKey, onSelectStop }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<MarkerMap>(new Map());
  // Read fresh on every marker click without re-running marker setup each
  // time the parent re-renders with a new onSelectStop closure.
  const onSelectRef = useRef(onSelectStop);
  onSelectRef.current = onSelectStop;
  // Holds a pending teardown scheduled by this effect's own cleanup — see
  // the long comment inside the init effect for why teardown is deferred
  // rather than run immediately.
  const teardownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Init once — re-creating the map on every prop change would flash and
  // re-fetch tiles for no reason. Marker/route updates are handled by the
  // effects below instead.
  //
  // React 18 Strict Mode runs this effect, its cleanup, and then this
  // effect again, all synchronously in one commit — a deliberate dev-only
  // stress test for effects that don't clean up correctly. For a
  // resource like a MapLibre instance, whose setup is asynchronous
  // (network fetch of style/tiles, then a Web Worker parses them), naively
  // tearing down on that first phantom cleanup and building a second
  // instance right after is unreliable in practice: a genuinely rebuilt
  // instance sometimes never fires "load" at all, and even when it does,
  // its markers can end up attached to a container that isn't reliably
  // live yet. Rather than patch each symptom, this effect makes Strict
  // Mode's phantom cycle a no-op: teardown is scheduled on a macrotask
  // instead of run inline, so the synchronous phantom-cleanup-then-remount
  // cancels its own teardown before it ever fires, and exactly one
  // MapLibre instance is created and lives untouched through the whole
  // cycle. A genuine unmount (no synchronous remount to cancel it) still
  // tears down normally, just one tick later than before — imperceptible.
  useEffect(() => {
    if (containerRef.current && mapRef.current) {
      // Strict Mode's remount: an instance from the phantom mount is
      // still alive because its teardown hasn't fired yet. Cancel that
      // teardown and reuse the existing instance instead of building a
      // second one.
      if (teardownRef.current) {
        clearTimeout(teardownRef.current);
        teardownRef.current = null;
      }
      return () => scheduleTeardown();
    }
    if (!containerRef.current || mapRef.current) return;

    const accent = resolveColor("--accent");
    const paper = resolveColor("--paper");

    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    // MapLibre reports a failed style/tile/source load through this event
    // rather than throwing — without a listener, a style that fails to
    // load silently means "load" never fires and nothing (markers, route
    // line) ever gets drawn, with no visible error anywhere.
    map.on("error", (e) => {
      console.error("RouteMap: MapLibre error", e.error?.message ?? e);
    });

    map.on("load", () => {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: routeGeoJSON(stops),
      });
      map.addLayer({
        id: ROUTE_SOURCE_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": accent, "line-width": 2.5, "line-dasharray": [0.2, 1.6] },
      });
      syncMarkers(map, stops, accent, paper, markersRef, onSelectRef, selectedKey ?? null);
      fitToStops(map, stops, reducedMotion);
    });

    return () => scheduleTeardown();

    // Reads the instance from mapRef, never from the `map` const above:
    // the reuse branch at the top of this effect returns before that
    // const is declared, so a closure over `map` there throws
    // "Cannot access 'map' before initialization" when teardown fires.
    function scheduleTeardown() {
      teardownRef.current = setTimeout(() => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current.clear();
        mapRef.current?.remove();
        mapRef.current = null;
        teardownRef.current = null;
      }, 0);
    }
    // Deliberately run-once: see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep markers + the connecting line in sync when the stop list itself
  // changes (never happens today — a trip's stops are fixed once
  // generated — but keeps this component correct if that changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const accent = resolveColor("--accent");
      const paper = resolveColor("--paper");
      syncMarkers(map, stops, accent, paper, markersRef, onSelectRef, selectedKey ?? null);
      const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(routeGeoJSON(stops));
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops]);

  // Selecting a stop from the list pans to it without re-fitting the
  // whole route — the two interactions feel different on purpose.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedKey) return;
    const stop = stops.find((s) => s.key === selectedKey);
    if (!stop) return;

    map.easeTo({
      center: [stop.lng, stop.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: reducedMotion ? 0 : 600,
    });
    markersRef.current.forEach((marker, key) => {
      marker.getElement().classList.toggle("roam-marker-active", key === selectedKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Map of every stop on this trip, connected in order"
    />
  );
}

function resolveColor(cssVar: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return `hsl(${value})`;
}

function routeGeoJSON(stops: RouteMapStop[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: stops.map((s) => [s.lng, s.lat]) },
  };
}

function fitToStops(map: MaplibreMap, stops: RouteMapStop[], reducedMotion: boolean) {
  if (stops.length === 0) return;
  if (stops.length === 1) {
    map.jumpTo({ center: [stops[0].lng, stops[0].lat], zoom: 13 });
    return;
  }
  const bounds = stops.reduce(
    (b, s) => b.extend([s.lng, s.lat]),
    new LngLatBounds([stops[0].lng, stops[0].lat], [stops[0].lng, stops[0].lat]),
  );
  map.fitBounds(bounds, { padding: 56, duration: reducedMotion ? 0 : 600 });
}

function syncMarkers(
  map: MaplibreMap,
  stops: RouteMapStop[],
  accent: string,
  paper: string,
  markersRef: MutableRefObject<MarkerMap>,
  onSelectRef: MutableRefObject<((key: string) => void) | undefined>,
  selectedKey: string | null,
) {
  const seen = new Set(stops.map((s) => s.key));
  markersRef.current.forEach((marker, key) => {
    if (!seen.has(key)) {
      marker.remove();
      markersRef.current.delete(key);
    }
  });

  for (const stop of stops) {
    let marker = markersRef.current.get(stop.key);
    if (!marker) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "roam-marker font-mono";
      el.setAttribute("aria-label", `Stop ${stop.label}`);
      el.textContent = String(stop.label);
      el.style.setProperty("--roam-marker-accent", accent);
      el.style.setProperty("--roam-marker-paper", paper);
      el.addEventListener("click", () => onSelectRef.current?.(stop.key));
      marker = new Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map);
      markersRef.current.set(stop.key, marker);
    } else {
      marker.setLngLat([stop.lng, stop.lat]);
    }
    marker.getElement().classList.toggle("roam-marker-active", stop.key === selectedKey);
  }
}
