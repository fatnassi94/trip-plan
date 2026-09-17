// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A scriptable stand-in for maplibre-gl: jsdom has no WebGL, and these
// tests are about what RouteMap does with the map's events, not about
// MapLibre itself (tests/e2e/map.spec.ts runs the real thing).
const fake = vi.hoisted(() => {
  type Handler = (payload?: unknown) => void;
  const maps: FakeMap[] = [];
  const workerUrls: string[] = [];

  class FakeMap {
    handlers = new Map<string, Handler[]>();
    styleLoaded = false;
    removed = false;
    calls: { method: string; args: unknown[] }[] = [];
    constructor(public options: { container: HTMLElement; style: string }) {
      maps.push(this);
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }
    once(event: string, handler: Handler) {
      return this.on(event, handler);
    }
    emit(event: string, payload?: unknown) {
      if (event === "load") this.styleLoaded = true;
      (this.handlers.get(event) ?? []).forEach((handler) => handler(payload));
    }
    isStyleLoaded() {
      return this.styleLoaded;
    }
    getZoom() {
      return 12;
    }
    getSource() {
      return { setData: () => {} };
    }
    remove() {
      this.removed = true;
    }
  }
  for (const method of ["addControl", "addSource", "addLayer", "fitBounds", "jumpTo", "easeTo"]) {
    (FakeMap.prototype as unknown as Record<string, unknown>)[method] = function (this: FakeMap, ...args: unknown[]) {
      this.calls.push({ method, args });
    };
  }

  class FakeMarker {
    element: HTMLElement;
    constructor({ element }: { element: HTMLElement }) {
      this.element = element;
    }
    setLngLat() {
      return this;
    }
    addTo(map: FakeMap) {
      map.options.container.appendChild(this.element);
      return this;
    }
    getElement() {
      return this.element;
    }
    remove() {
      this.element.remove();
    }
  }

  class FakeBounds {
    extend() {
      return this;
    }
  }

  return { maps, workerUrls, FakeMap, FakeMarker, FakeBounds };
});

vi.mock("maplibre-gl", () => ({
  Map: fake.FakeMap,
  Marker: fake.FakeMarker,
  NavigationControl: class {},
  LngLatBounds: fake.FakeBounds,
  getVersion: () => "6.9.0",
  setWorkerUrl: (url: string) => fake.workerUrls.push(url),
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import { RouteMap, type RouteMapStop } from "@/components/trip/route-map";
import { DEFAULT_MAP_STYLE_URL } from "@/lib/map-config";

const STOPS: RouteMapStop[] = [
  { key: "1-0", lat: 38.7139, lng: -9.1335, label: 1 },
  { key: "1-1", lat: 38.7107, lng: -9.1432, label: 2 },
];

const latestMap = () => fake.maps[fake.maps.length - 1];
const mapState = () => document.querySelector("[data-map-state]")!;
const emit = (event: string, payload?: unknown) => act(() => latestMap().emit(event, payload));

beforeEach(() => {
  fake.maps.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RouteMap", () => {
  it("loads MapLibre's worker from this site, for the installed version", () => {
    expect(fake.workerUrls).toEqual([`${window.location.origin}/vendor/maplibre-gl/6.9.0/maplibre-gl-worker.mjs`]);
  });

  it("shows a loading state, then numbered pins and the route once the map loads", () => {
    render(<RouteMap stops={STOPS} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading map…");
    expect(latestMap().options.style).toBe(DEFAULT_MAP_STYLE_URL);

    emit("load");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mapState()).toHaveAttribute("data-map-state", "ready");
    expect(screen.getAllByRole("button", { name: /^Stop \d$/ }).map((b) => b.textContent)).toEqual(["1", "2"]);
    expect(latestMap().calls.map((c) => c.method)).toEqual(
      expect.arrayContaining(["addSource", "addLayer", "fitBounds"]),
    );
  });

  it("only reports the route as drawn once the worker has processed it", () => {
    render(<RouteMap stops={STOPS} />);
    emit("load");
    expect(mapState()).toHaveAttribute("data-route", "pending");

    emit("sourcedata", { sourceId: "some-other-source", isSourceLoaded: true });
    expect(mapState()).toHaveAttribute("data-route", "pending");

    emit("sourcedata", { sourceId: "roamai-route", isSourceLoaded: true });
    expect(mapState()).toHaveAttribute("data-route", "drawn");
  });

  it("reports pin clicks and highlights the selected stop", async () => {
    const onSelectStop = vi.fn();
    const { rerender } = render(<RouteMap stops={STOPS} onSelectStop={onSelectStop} />);
    emit("load");

    await userEvent.click(screen.getByRole("button", { name: "Stop 2" }));
    expect(onSelectStop).toHaveBeenCalledWith("1-1");

    rerender(<RouteMap stops={STOPS} onSelectStop={onSelectStop} selectedKey="1-1" />);
    expect(screen.getByRole("button", { name: "Stop 2" })).toHaveClass("roam-marker-active");
    expect(screen.getByRole("button", { name: "Stop 1" })).not.toHaveClass("roam-marker-active");
    expect(latestMap().calls.some((c) => c.method === "easeTo")).toBe(true);
  });

  it("shows a fallback when the map fails before loading, and Try again starts a fresh map", async () => {
    render(<RouteMap stops={STOPS} />);
    emit("error", { error: new Error("Failed to fetch style") });

    expect(screen.getByRole("alert")).toHaveTextContent("The map couldn't load");
    expect(mapState()).toHaveAttribute("data-map-state", "failed");

    const first = latestMap();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(fake.maps).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Loading map…");
    await vi.waitFor(() => expect(first.removed).toBe(true));
  });

  it("falls back when the map never finishes loading (e.g. a dead worker)", () => {
    vi.useFakeTimers();
    render(<RouteMap stops={STOPS} loadTimeoutMs={5000} />);

    act(() => vi.advanceTimersByTime(4999));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("alert")).toHaveTextContent("The map couldn't load");
  });

  it("keeps a working map on screen when a tile fails after loading", () => {
    vi.useFakeTimers();
    render(<RouteMap stops={STOPS} loadTimeoutMs={5000} />);
    emit("load");
    emit("error", { error: new Error("Tile 404") });
    act(() => vi.advanceTimersByTime(10_000));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mapState()).toHaveAttribute("data-map-state", "ready");
  });
});
