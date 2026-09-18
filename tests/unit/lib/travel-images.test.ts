import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A catalog with one destination that has curated images and one without,
// so the fallback tier can be tested without touching the real data file.
vi.mock("@/data/destinations.json", () => ({
  default: [
    {
      slug: "tunis",
      name: "Tunis",
      country: "Tunisia",
      heroImageQuery: "Tunis medina rooftops Tunisia",
      galleryImageQueries: ["Tunis medina alley doors"],
      curatedImages: [
        { url: "https://cdn.example/tunis-1.jpg", alt: "Rooftops over the Tunis medina", credit: "Ops library" },
        { url: "https://cdn.example/tunis-2.jpg", thumbUrl: "https://cdn.example/tunis-2-small.jpg", alt: "A blue medina door" },
      ],
    },
    {
      slug: "rome",
      name: "Rome",
      country: "Italy",
      heroImageQuery: "Rome rooftops dome sunset",
      galleryImageQueries: [],
      curatedImages: [],
    },
  ],
}));

import { clearTravelImageCache, getTravelImage, getTravelImages } from "@/lib/travel-images";

const unsplashPhoto = (id: string) => ({
  id,
  alt_description: "a sunlit medina rooftop",
  description: null,
  color: "#c08a4a",
  urls: { regular: `https://images.unsplash.com/${id}-regular`, small: `https://images.unsplash.com/${id}-small` },
  user: { name: "Amal B.", links: { html: "https://unsplash.com/@amal" } },
});

function stubUnsplash(response: { ok: boolean; results?: unknown[]; status?: number }) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => ({ results: response.results ?? [] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearTravelImageCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("TRAVEL_IMAGES_MODE", "auto");
  vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
});

afterEach(() => {
  clearTravelImageCache();
});

describe("getTravelImages", () => {
  it("returns nothing for an empty query, without calling a provider", async () => {
    const fetchMock = stubUnsplash({ ok: true });
    const result = await getTravelImages("   ");
    expect(result).toMatchObject({ images: [], source: "fallback", degraded: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Unsplash when a key is set, mapping credit and alt text", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    stubUnsplash({ ok: true, results: [unsplashPhoto("a1"), unsplashPhoto("a2")] });

    const result = await getTravelImages("Tunis medina rooftops Tunisia", { count: 2 });

    expect(result.source).toBe("unsplash");
    expect(result.degraded).toBe(false);
    expect(result.images[0]).toMatchObject({
      url: "https://images.unsplash.com/a1-regular",
      thumbUrl: "https://images.unsplash.com/a1-small",
      alt: "a sunlit medina rooftop",
      authorName: "Amal B.",
      authorUrl: "https://unsplash.com/@amal",
      provider: "unsplash",
    });
  });

  it("sends the key as a header and never in the query string", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "secret-key");
    const fetchMock = stubUnsplash({ ok: true, results: [unsplashPhoto("a1")] });

    await getTravelImages("Rome rooftops dome sunset", { count: 30, orientation: "portrait" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).not.toContain("secret-key");
    expect((init.headers as Record<string, string>).Authorization).toBe("Client-ID secret-key");
    // count is clamped to the provider's ceiling (the API route caps lower)
    expect(url.searchParams.get("per_page")).toBe("24");
    expect(url.searchParams.get("orientation")).toBe("portrait");
  });

  it("falls back to curated images when Unsplash fails, without surfacing the error", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    stubUnsplash({ ok: false, status: 503 });

    const result = await getTravelImages("Tunis medina rooftops Tunisia");

    expect(result.source).toBe("curated");
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe("Unsplash unavailable");
    expect(result.images.map((i) => i.url)).toEqual([
      "https://cdn.example/tunis-1.jpg",
      "https://cdn.example/tunis-2.jpg",
    ]);
    expect(result.images[1].thumbUrl).toBe("https://cdn.example/tunis-2-small.jpg");
  });

  it("uses curated images when there is no API key at all", async () => {
    const fetchMock = stubUnsplash({ ok: true, results: [unsplashPhoto("a1")] });
    const result = await getTravelImages("Tunis medina rooftops Tunisia");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.source).toBe("curated");
    expect(result.reason).toBe("no UNSPLASH_ACCESS_KEY");
  });

  it("returns an empty result — for the gradient placeholder — when nothing is available", async () => {
    stubUnsplash({ ok: true });
    const result = await getTravelImages("Rome rooftops dome sunset");
    expect(result).toMatchObject({ images: [], source: "fallback", degraded: true });
  });

  it("skips every provider when TRAVEL_IMAGES_MODE=off", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    vi.stubEnv("TRAVEL_IMAGES_MODE", "off");
    const fetchMock = stubUnsplash({ ok: true, results: [unsplashPhoto("a1")] });

    const result = await getTravelImages("Tunis medina rooftops Tunisia");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ images: [], reason: "TRAVEL_IMAGES_MODE=off" });
  });

  it("skips Unsplash when TRAVEL_IMAGES_MODE=curated", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    vi.stubEnv("TRAVEL_IMAGES_MODE", "curated");
    const fetchMock = stubUnsplash({ ok: true, results: [unsplashPhoto("a1")] });

    const result = await getTravelImages("Tunis medina rooftops Tunisia");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.source).toBe("curated");
  });

  it("serves a repeat lookup from cache instead of calling the provider twice", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    const fetchMock = stubUnsplash({ ok: true, results: [unsplashPhoto("a1")] });

    await getTravelImages("Tunis medina rooftops Tunisia", { count: 4 });
    await getTravelImages("tunis medina rooftops tunisia", { count: 4 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getTravelImage", () => {
  it("narrows the result to a single photo", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    stubUnsplash({ ok: true, results: [unsplashPhoto("a1"), unsplashPhoto("a2")] });

    const result = await getTravelImage("Tunis medina rooftops Tunisia");
    expect(result.images).toHaveLength(1);
  });
});
