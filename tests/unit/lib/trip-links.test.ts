import { describe, expect, it } from "vitest";
import { buildMapLinks } from "@/lib/trip-links";
import { makeItem } from "@/tests/fixtures/trip";

// Every link here is keyless on purpose: nothing in this file may put a
// paid account, or a card, between a fresh clone and a working app. The
// Maps Embed URL that briefly lived here failed that test and came out.

describe("buildMapLinks", () => {
  it("builds keyless Google and OpenStreetMap links from coordinates", () => {
    const links = buildMapLinks(makeItem({ lat: 38.7139, lng: -9.1334 }), "Lisbon");

    expect(links.googleSearchUrl).toContain("google.com/maps/search");
    expect(links.streetViewUrl).toContain("viewpoint=38.7139,-9.1334");
    expect(links.osmEmbedUrl).toContain("openstreetmap.org/export/embed.html");
    expect(links.osmViewUrl).toContain("mlat=38.7139");
  });

  it("carries no API key in any URL it produces", () => {
    const links = buildMapLinks(makeItem({ lat: 1, lng: 2 }), "Lisbon");
    for (const url of Object.values(links)) {
      if (url) expect(url).not.toMatch(/[?&]key=/);
    }
  });

  it("falls back to a name search when the AI gave no coordinates", () => {
    const links = buildMapLinks(makeItem({ lat: undefined, lng: undefined }), "Lisbon");

    expect(links.streetViewUrl).toBeNull();
    expect(links.osmEmbedUrl).toBeNull();
    expect(links.googleSearchUrl).toContain("google.com/maps/search");
  });

  it("searches the address when there is one, and the name plus city otherwise", () => {
    const withAddress = buildMapLinks(makeItem({ address: "R. de Santa Cruz 1" }), "Lisbon");
    expect(withAddress.googleSearchUrl).toContain(encodeURIComponent("R. de Santa Cruz 1"));

    const withoutAddress = buildMapLinks(makeItem({ address: undefined }), "Lisbon");
    expect(withoutAddress.googleSearchUrl).toContain(encodeURIComponent("Lisbon"));
  });
});
