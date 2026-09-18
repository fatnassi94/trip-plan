import { describe, expect, it } from "vitest";
import {
  MOODS,
  allDestinations,
  allGuides,
  allInterests,
  allRegions,
  destinationBySlug,
  destinationsByMood,
  featuredDestinations,
  formatDailyBudget,
  relatedDestinations,
  searchDestinationCatalog,
  suggestedNights,
} from "@/lib/destination-catalog";
import { toDestinationSummary } from "@/lib/destination-summary";

const MOOD_IDS = new Set(MOODS.map((m) => m.id));

describe("catalog data", () => {
  it("ships the demo destinations with unique slugs", () => {
    const destinations = allDestinations();
    expect(destinations.length).toBeGreaterThanOrEqual(8);
    expect(new Set(destinations.map((d) => d.slug)).size).toBe(destinations.length);
    expect(destinations.map((d) => d.slug)).toEqual(
      expect.arrayContaining(["tunis", "sidi-bou-said", "paris", "rome", "istanbul", "tokyo", "marrakech", "bali"]),
    );
  });

  it("gives every destination the fields the pages render", () => {
    for (const destination of allDestinations()) {
      expect(destination.name, destination.slug).toBeTruthy();
      expect(destination.country).toBeTruthy();
      expect(destination.shortDescription.length).toBeGreaterThan(20);
      expect(destination.whyGo.length).toBeGreaterThan(40);
      expect(destination.heroImageQuery).toBeTruthy();
      expect(destination.galleryImageQueries.length).toBeGreaterThanOrEqual(1);
      expect(destination.thingsToDo.length).toBeGreaterThanOrEqual(3);
      expect(destination.localFood.length).toBeGreaterThanOrEqual(3);
      expect(destination.travelTips.length).toBeGreaterThanOrEqual(3);
      expect(destination.sampleItinerary.length).toBeGreaterThanOrEqual(1);
      expect(Math.abs(destination.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(destination.longitude)).toBeLessThanOrEqual(180);
      expect(destination.moods.every((m) => MOOD_IDS.has(m))).toBe(true);
    }
  });

  it("only points `related` at destinations that exist", () => {
    for (const destination of allDestinations()) {
      for (const slug of destination.related) {
        expect(destinationBySlug(slug), `${destination.slug} → ${slug}`).toBeDefined();
      }
    }
  });

  it("ships guides that point at real destinations", () => {
    const guides = allGuides();
    expect(guides.length).toBeGreaterThanOrEqual(4);
    for (const guide of guides) {
      expect(guide.destinationSlugs.length).toBeGreaterThan(0);
      expect(guide.readingMinutes).toBeGreaterThan(0);
      for (const slug of guide.destinationSlugs) {
        expect(destinationBySlug(slug), `${guide.slug} → ${slug}`).toBeDefined();
      }
    }
  });

  it("ships no hard-coded remote image URLs by default", () => {
    for (const destination of allDestinations()) {
      expect(destination.curatedImages ?? []).toEqual([]);
    }
  });
});

describe("lookups", () => {
  it("finds a destination by slug, and nothing for an unknown one", () => {
    expect(destinationBySlug("tunis")?.name).toBe("Tunis");
    expect(destinationBySlug("atlantis")).toBeUndefined();
  });

  it("limits the featured set", () => {
    expect(featuredDestinations(3)).toHaveLength(3);
  });

  it("groups destinations by mood", () => {
    const beaches = destinationsByMood("beaches-islands");
    expect(beaches.length).toBeGreaterThan(0);
    expect(beaches.every((d) => d.moods.includes("beaches-islands"))).toBe(true);
  });

  it("fills a related row even when a destination lists fewer than asked", () => {
    const related = relatedDestinations("tunis", 3);
    expect(related).toHaveLength(3);
    expect(related.some((d) => d.slug === "tunis")).toBe(false);
  });
});

describe("search and filters", () => {
  it("matches name, country and what you want to do", () => {
    expect(searchDestinationCatalog({ q: "tunis" }).map((d) => d.slug)).toContain("tunis");
    expect(searchDestinationCatalog({ q: "japan" }).map((d) => d.slug)).toEqual(["tokyo"]);
    expect(searchDestinationCatalog({ q: "mosaics" }).map((d) => d.slug)).toEqual(["tunis"]);
  });

  it("filters by mood, region, budget and trip length", () => {
    expect(searchDestinationCatalog({ mood: "nature-hiking" }).every((d) => d.moods.includes("nature-hiking"))).toBe(true);
    expect(searchDestinationCatalog({ region: "North Africa" }).map((d) => d.slug)).toEqual([
      "tunis",
      "sidi-bou-said",
      "marrakech",
    ]);
    expect(searchDestinationCatalog({ budget: "budget" }).every((d) => d.estimatedDailyBudget.budget <= 45)).toBe(true);
    expect(searchDestinationCatalog({ maxNights: 2 }).every((d) => suggestedNights(d) <= 2)).toBe(true);
  });

  it("combines filters and returns nothing when they conflict", () => {
    expect(searchDestinationCatalog({ region: "East Asia", budget: "budget" })).toEqual([]);
  });

  it("matches interests against tags and what a place is good for", () => {
    const foodie = searchDestinationCatalog({ interests: ["food"] });
    expect(foodie.length).toBeGreaterThan(0);
    expect(foodie.every((d) => [...d.tags, ...d.bestFor].join(" ").toLowerCase().includes("food"))).toBe(true);
  });

  it("returns everything with no filters", () => {
    expect(searchDestinationCatalog()).toHaveLength(allDestinations().length);
  });
});

describe("presentation helpers", () => {
  it("reads the first number out of a duration phrase", () => {
    expect(suggestedNights(destinationBySlug("paris")!)).toBe(3);
    expect(suggestedNights(destinationBySlug("bali")!)).toBe(7);
  });

  it("formats a daily budget", () => {
    expect(formatDailyBudget(destinationBySlug("tunis")!)).toBe("€70/day");
    expect(formatDailyBudget(destinationBySlug("tunis")!, "budget")).toBe("€35/day");
  });

  it("lists regions and interests for the filter menus", () => {
    expect(allRegions()).toContain("North Africa");
    expect(allInterests().length).toBeGreaterThan(5);
    expect(allRegions()).toEqual([...allRegions()].sort());
  });

  it("summarises a destination without leaking the whole entry", () => {
    const summary = toDestinationSummary(destinationBySlug("tokyo")!);
    expect(summary).toMatchObject({ slug: "tokyo", name: "Tokyo", country: "Japan", suggestedNights: 4 });
    expect(summary).not.toHaveProperty("travelTips");
    expect(summary).not.toHaveProperty("sampleItinerary");
  });
});
