"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { MapPinOff, RotateCcw } from "lucide-react";
// Named imports only: maplibre-gl v6 ships ESM with no default export, and
// its own `Map` class is aliased on the way in so it doesn't shadow the
// built-in global `Map` this file also uses (for the marker registry below).
import {
  Map as MaplibreMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  getVersion,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL, maplibreWorkerUrl } from "@/lib/map-config";

// MapLibre parses tiles and GeoJSON in a Web Worker loaded from a separate
// file. Its default lookup (import.meta.url) resolves to the page itself
// under Next.js's bundling, so the URL has to be set explicitly — and it
// has to be SAME-ORIGIN. For a cross-origin URL (this used to point at
// unpkg), MapLibre 6.9 wraps the script in a blob: URL and revokes that
// blob in a `finally` right after `new Worker()`, before the browser has
// fetched it. The worker died with net::ERR_FILE_NOT_FOUND, "load" never
// fired, and no pins or route line were ever drawn.
//
// scripts/vendor-maplibre.mjs copies the worker (and the shared chunk it
// imports) into public/ for the installed version on every install, dev
// and build; the version in the path comes from getVersion(), so the main
// thread and the worker can never drift apart. Guarded for SSR, although
// this module is only ever loaded in the browser (next/dynamic, ssr:false).
if (typeof window !== "undefined") {
  setWorkerUrl(maplibreWorkerUrl(getVersion(), window.location.origin));
}

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
  /** How long to wait for the first render before showing the fallback. */
  loadTimeoutMs?: number;
  /**
   * "One place, up close" instead of "the whole day": tilts the camera and
   * zooms in. What the stop dialog uses.
   */
  focus?: boolean;
}

type MapStatus = "loading" | "ready" | "failed";

const ROUTE_SOURCE_ID = "roamai-route";
const ROUTE_CASING_ID = "roamai-route-casing";

/**
 * Pre-computed dash patterns, stepped through on a timer. MapLibre has no
 * animatable dash-offset, so the classic trick is to cycle the dasharray
 * itself; each frame shifts the gap a little further along the line, which
 * reads as the route flowing toward the next stop.
 */
const DASH_FRAMES: [number, number][] = [
  [0, 4],
  [0.5, 3.5],
  [1, 3],
  [1.5, 2.5],
  [2, 2],
  [2.5, 1.5],
  [3, 1],
  [3.5, 0.5],
];

type MarkerMap = Map<string, Marker>;

/**
 * A live route map: numbered pins for each stop, joined in order. Shows a
 * loading state, and a fallback with "Try again" if the map can't load —
 * retrying re-mounts a fresh MapLibre instance.
 */
export function RouteMap(props: RouteMapProps) {
  const [attempt, setAttempt] = useState(0);
  return <RouteMapCanvas key={attempt} {...props} onRetry={() => setAttempt((a) => a + 1)} />;
}

function RouteMapCanvas({
  stops,
  selectedKey,
  onSelectStop,
  loadTimeoutMs = 20_000,
  focus = false,
  onRetry,
}: RouteMapProps & { onRetry: () => void }) {
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
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<MapStatus>("loading");
  // True only once the worker has actually processed the route line — the
  // honest signal that the whole map pipeline works, not just the style.
  const [routeDrawn, setRouteDrawn] = useState(false);

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
    let loaded = false;

    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    // A worker that never starts produces no error event at all — the map
    // just never loads — so a timeout is the only way to notice it.
    loadTimeoutRef.current = setTimeout(() => {
      if (!loaded) setStatus("failed");
    }, loadTimeoutMs);

    // MapLibre reports failed style/tile/source loads through this event
    // rather than throwing. Only a failure before the first render (e.g.
    // the style itself) means "no map"; a stray tile error afterwards
    // leaves a perfectly usable map on screen.
    map.on("error", (e) => {
      console.error("RouteMap: MapLibre error", e.error?.message ?? e);
      if (!loaded && !map.isStyleLoaded()) setStatus("failed");
    });

    map.on("sourcedata", (e) => {
      if (e.sourceId === ROUTE_SOURCE_ID && e.isSourceLoaded) setRouteDrawn(true);
    });

    map.on("load", () => {
      loaded = true;
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: routeGeoJSON(stops),
      });
      // Two layers, not one: a soft wide casing underneath so the route
      // reads against busy tiles, and the dashed line on top that moves.
      map.addLayer({
        id: ROUTE_CASING_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": accent, "line-width": 7, "line-opacity": 0.14, "line-blur": 3 },
      });
      map.addLayer({
        id: ROUTE_SOURCE_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": accent, "line-width": 2.5, "line-dasharray": DASH_FRAMES[0] },
      });
      syncMarkers(map, stops, accent, paper, markersRef, onSelectRef, selectedKey ?? null);
      fitToStops(map, stops, reducedMotion, focus);
      if (!reducedMotion) {
        dropMarkersIn(markersRef);
        dashTimerRef.current = startDashFlow(map);
      }
      setStatus("ready");
    });

    return () => scheduleTeardown();

    // Reads the instance from mapRef, never from the `map` const above:
    // the reuse branch at the top of this effect returns before that
    // const is declared, so a closure over `map` there throws
    // "Cannot access 'map' before initialization" when teardown fires.
    function scheduleTeardown() {
      teardownRef.current = setTimeout(() => {
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        if (dashTimerRef.current) clearInterval(dashTimerRef.current);
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
  // changes (the trip pages re-mount this component when a day changes,
  // but this keeps it correct if a caller updates stops in place).
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

    if (reducedMotion) {
      map.jumpTo({ center: [stop.lng, stop.lat], zoom: Math.max(map.getZoom(), 14) });
    } else {
      // flyTo arcs out and back down rather than sliding flat across the
      // city — the movement itself tells you the two stops are apart.
      map.flyTo({
        center: [stop.lng, stop.lat],
        zoom: Math.max(map.getZoom(), 15),
        pitch: 45,
        curve: 1.42,
        speed: 0.9,
        essential: true,
      });
    }
    markersRef.current.forEach((marker, key) => {
      marker.getElement().classList.toggle("roam-marker-active", key === selectedKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  return (
    <div
      className="relative h-full w-full"
      data-map-state={status}
      data-route={routeDrawn ? "drawn" : "pending"}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Map of every stop on this trip, connected in order"
      />

      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent-soft/40">
          <span
            role="status"
            className="rounded-full bg-surface px-3 py-1.5 font-display text-xs font-semibold text-muted shadow-card"
          >
            Loading map…
          </span>
        </div>
      ) : null}

      {status === "failed" ? (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-6 text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warm-soft text-warm">
            <MapPinOff className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="font-display text-sm font-semibold text-accent">The map couldn&apos;t load</p>
          <p className="max-w-xs text-xs text-muted">
            Your stops are still listed in order, and each one opens in Google Maps from its card.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 inline-flex items-center gap-1.5 rounded bg-accent px-3.5 py-2 font-display text-xs font-semibold text-paper shadow-card transition-colors hover:bg-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}
    </div>
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

function fitToStops(
  map: MaplibreMap,
  stops: RouteMapStop[],
  reducedMotion: boolean,
  focus = false,
) {
  if (stops.length === 0) return;
  if (stops.length === 1) {
    const [only] = stops;
    // Focus mode is "stand here and look around", so it opens tilted and
    // close; the overview stays flat and wide.
    map.jumpTo({
      center: [only.lng, only.lat],
      zoom: focus ? 16.5 : 13,
      pitch: focus && !reducedMotion ? 55 : 0,
    });
    return;
  }
  const bounds = stops.reduce(
    (b, s) => b.extend([s.lng, s.lat]),
    new LngLatBounds([stops[0].lng, stops[0].lat], [stops[0].lng, stops[0].lat]),
  );
  map.fitBounds(bounds, { padding: 56, duration: reducedMotion ? 0 : 600 });
}

/**
 * Pins arrive one after another instead of all at once. Purely additive:
 * the class only drives a CSS keyframe, so a marker that never gets it
 * (reduced motion) still sits exactly where it should.
 */
function dropMarkersIn(markersRef: MutableRefObject<MarkerMap>) {
  let index = 0;
  markersRef.current.forEach((marker) => {
    const el = marker.getElement();
    el.style.setProperty("--roam-marker-delay", `${index * 70}ms`);
    el.classList.add("roam-marker-drop");
    index += 1;
  });
}

/** Steps the dashed route through DASH_FRAMES so it flows onward. */
function startDashFlow(map: MaplibreMap): ReturnType<typeof setInterval> {
  let frame = 0;
  return setInterval(() => {
    frame = (frame + 1) % DASH_FRAMES.length;
    try {
      // The layer is gone the moment the map is torn down mid-interval,
      // and a style reload can briefly invalidate it too. The next tick
      // picks it back up — never worth breaking the map over.
      if (!map.getLayer(ROUTE_SOURCE_ID)) return;
      map.setPaintProperty(ROUTE_SOURCE_ID, "line-dasharray", DASH_FRAMES[frame]);
    } catch {
      /* ignored on purpose — see above */
    }
  }, 90);
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
