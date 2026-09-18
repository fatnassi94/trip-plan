import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/travel-images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/travel-images")>()),
  getTravelImages: vi.fn(),
}));

import { GET as images } from "@/app/api/travel-images/route";
import { GET as featured } from "@/app/api/destinations/featured/route";
import { GET as search } from "@/app/api/destinations/search/route";
import { getTravelImages } from "@/lib/travel-images";
import { imageRateLimiter } from "@/lib/rate-limit";

const photo = {
  id: "a1",
  url: "https://images.unsplash.com/a1",
  thumbUrl: "https://images.unsplash.com/a1-small",
  alt: "a medina rooftop",
  provider: "unsplash" as const,
};

const get = (handler: (req: Request) => Promise<Response>, path: string) =>
  handler(new Request(`http://localhost${path}`));

beforeEach(() => {
  imageRateLimiter.reset();
  vi.mocked(getTravelImages).mockResolvedValue({ images: [photo], source: "unsplash", degraded: false });
});

describe("GET /api/travel-images", () => {
  it.each([
    ["a missing query", "/api/travel-images"],
    ["a one-character query", "/api/travel-images?query=a"],
    ["a count above the ceiling", "/api/travel-images?query=Tunis&count=99"],
    ["an unknown orientation", "/api/travel-images?query=Tunis&orientation=diagonal"],
  ])("rejects %s with 400", async (_label, path) => {
    const res = await get(images, path);
    expect(res.status).toBe(400);
    expect(getTravelImages).not.toHaveBeenCalled();
  });

  it("returns images with their source and a cache header", async () => {
    const res = await get(images, "/api/travel-images?query=Tunis%20medina&count=3");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ images: [photo], source: "unsplash", degraded: false });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
    expect(getTravelImages).toHaveBeenCalledWith("Tunis medina", { count: 3, orientation: undefined });
  });

  it("reports a degraded source rather than an error when the provider is unavailable", async () => {
    vi.mocked(getTravelImages).mockResolvedValue({
      images: [],
      source: "fallback",
      degraded: true,
      reason: "no UNSPLASH_ACCESS_KEY",
    });

    const res = await get(images, "/api/travel-images?query=Tunis");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ images: [], source: "fallback", degraded: true });
  });

  it("rate limits a caller hammering the endpoint", async () => {
    for (let i = 0; i < 60; i++) {
      expect((await get(images, "/api/travel-images?query=Tunis")).status).toBe(200);
    }
    const res = await get(images, "/api/travel-images?query=Tunis");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("GET /api/destinations/featured", () => {
  it("returns summaries, not whole catalog entries", async () => {
    const res = await get(featured, "/api/destinations/featured?count=3");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destinations).toHaveLength(3);
    expect(body.destinations[0]).toMatchObject({ slug: expect.any(String), dailyBudget: expect.any(String) });
    expect(body.destinations[0]).not.toHaveProperty("travelTips");
  });

  it("rejects a silly count", async () => {
    expect((await get(featured, "/api/destinations/featured?count=0")).status).toBe(400);
  });
});

describe("GET /api/destinations/search", () => {
  it("searches the local catalog with no third-party call", async () => {
    const res = await get(search, "/api/destinations/search?q=tokyo");
    const body = await res.json();

    expect(body.count).toBe(1);
    expect(body.destinations[0].slug).toBe("tokyo");
    expect(getTravelImages).not.toHaveBeenCalled();
  });

  it("applies mood, region and interest filters", async () => {
    const byMood = await (await get(search, "/api/destinations/search?mood=beaches-islands")).json();
    expect(byMood.destinations.every((d: { moods: string[] }) => d.moods.includes("beaches-islands"))).toBe(true);

    const byRegion = await (await get(search, "/api/destinations/search?region=North%20Africa")).json();
    expect(byRegion.count).toBe(3);

    const byInterest = await (await get(search, "/api/destinations/search?interests=food,history")).json();
    expect(byInterest.count).toBeGreaterThan(0);
  });

  it("returns an empty list rather than an error when nothing matches", async () => {
    const res = await get(search, "/api/destinations/search?q=atlantis");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ destinations: [], count: 0 });
  });

  it("rejects an unknown mood", async () => {
    expect((await get(search, "/api/destinations/search?mood=space")).status).toBe(400);
  });
});
