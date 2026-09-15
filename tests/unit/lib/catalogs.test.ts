import { describe, expect, it } from "vitest";
import { searchDestinations } from "@/lib/destinations";
import { findPlan, PLANS } from "@/lib/plans";
import { buildMapLinks, formatPriceEstimate } from "@/lib/trip-links";
import { makeItem } from "@/tests/fixtures/trip";

describe("searchDestinations", () => {
  it("prefix-matches case-insensitively", () => {
    expect(searchDestinations("PAR")).toContain("Paris, France");
  });

  it("does not substring-match", () => {
    expect(searchDestinations("aris")).not.toContain("Paris, France");
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(searchDestinations("   ")).toEqual([]);
    expect(searchDestinations("s", 3)).toHaveLength(3);
  });
});

describe("plans", () => {
  it("finds plans by id and ignores unknown ids", () => {
    expect(findPlan("pro")?.name).toBe("Pro");
    expect(findPlan("platinum")).toBeUndefined();
    expect(findPlan(null)).toBeUndefined();
  });

  it("highlights exactly one plan", () => {
    expect(PLANS.filter((p) => p.highlight)).toHaveLength(1);
  });
});

describe("map links", () => {
  it("falls back to a name search when there are no coordinates", () => {
    const links = buildMapLinks(makeItem({ lat: undefined, lng: undefined, address: undefined }), "Lisbon");
    expect(links.googleSearchUrl).toContain(encodeURIComponent("Castelo de São Jorge, Lisbon"));
    expect(links).toMatchObject({ streetViewUrl: null, osmEmbedUrl: null, osmViewUrl: null });
  });

  it("builds street view and OSM links from coordinates", () => {
    const links = buildMapLinks(makeItem(), "Lisbon");
    expect(links.streetViewUrl).toContain("viewpoint=38.7139,-9.1335");
    expect(links.osmEmbedUrl).toContain("marker=38.7139,-9.1335");
    expect(links.googleSearchUrl).toContain(encodeURIComponent("R. de Santa Cruz do Castelo, Lisbon"));
  });
});

describe("formatPriceEstimate", () => {
  it.each([
    [1, "Free–€10 per person"],
    [2, "€10–30 per person"],
    [3, "€30–70 per person"],
    [4, "€70+ per person"],
    [undefined, "Price varies"],
  ] as const)("bands priceLevel %s", (priceLevel, label) => {
    expect(formatPriceEstimate({ priceLevel })).toBe(label);
  });

  it("says Free for a free tag but not for words containing 'free'", () => {
    expect(formatPriceEstimate({ priceLevel: 3, tags: ["free-entry"] })).toBe("Free");
    expect(formatPriceEstimate({ priceLevel: 3, tags: ["freedom-trail"] })).toBe("€30–70 per person");
  });
});
