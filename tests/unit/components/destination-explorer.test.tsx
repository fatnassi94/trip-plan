// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DestinationExplorer, type ExplorerEntry } from "@/components/travel/destination-explorer";
import { allDestinations, MOODS, allInterests, allRegions } from "@/lib/destination-catalog";
import { toDestinationSummary } from "@/lib/destination-summary";

const entries: ExplorerEntry[] = allDestinations().map((destination) => ({
  destination: toDestinationSummary(destination),
  image: null,
}));

function renderExplorer(initial?: Record<string, string>) {
  render(
    <DestinationExplorer
      entries={entries}
      moods={MOODS.map((m) => ({ id: m.id, label: m.label }))}
      regions={allRegions()}
      interests={allInterests()}
      initial={initial}
    />,
  );
  return { user: userEvent.setup(), list: () => screen.queryAllByRole("listitem") };
}

describe("DestinationExplorer", () => {
  it("lists every destination and counts them", () => {
    const { list } = renderExplorer();
    expect(list()).toHaveLength(entries.length);
    expect(screen.getByRole("status")).toHaveTextContent(`${entries.length} destinations`);
  });

  it("filters as you type, across name, country and tags", async () => {
    const { user, list } = renderExplorer();

    await user.type(screen.getByRole("searchbox"), "japan");

    expect(list()).toHaveLength(1);
    expect(within(list()[0]).getByText("Tokyo")).toBeInTheDocument();
  });

  it("filters by mood and by region, and combines the two", async () => {
    const { user, list } = renderExplorer();

    await user.selectOptions(screen.getByLabelText("Region"), "North Africa");
    expect(list()).toHaveLength(3);

    await user.selectOptions(screen.getByLabelText("Mood"), "beaches-islands");
    expect(list()).toHaveLength(1);
    expect(within(list()[0]).getByText("Sidi Bou Said")).toBeInTheDocument();
  });

  it("filters by trip length", async () => {
    const { user, list } = renderExplorer();
    await user.selectOptions(screen.getByLabelText("Trip length"), "2");
    expect(list().length).toBeGreaterThan(0);
    expect(list().length).toBeLessThan(entries.length);
  });

  it("starts from the filters the page was opened with", () => {
    const { list } = renderExplorer({ mood: "nature-hiking" });
    expect(list()).toHaveLength(entries.filter((e) => e.destination.moods.includes("nature-hiking")).length);
  });

  it("explains an empty result and resets in one click", async () => {
    const { user, list } = renderExplorer();

    await user.type(screen.getByRole("searchbox"), "atlantis");
    expect(list()).toHaveLength(0);
    expect(screen.getByText("Nothing matches those filters")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));

    expect(list()).toHaveLength(entries.length);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("links each result to its destination page", () => {
    renderExplorer({ q: "tunis" });
    // "Tunis" also appears in Sidi Bou Said's description, so match the href.
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/destinations/tunis");
  });
});
