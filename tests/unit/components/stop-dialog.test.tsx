// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StopDialog } from "@/components/trip/stop-dialog";
import { buildMapLinks } from "@/lib/trip-links";
import { makeItem } from "@/tests/fixtures/trip";

// The map itself is exercised by route-map.test.tsx and the e2e suite;
// here it would only drag a WebGL-less MapLibre into jsdom.
vi.mock("@/components/trip/route-map", () => ({
  RouteMap: ({ focus }: { focus?: boolean }) => (
    <div data-testid="route-map" data-focus={focus ? "true" : "false"} />
  ),
}));

const item = makeItem({ lat: 38.7139, lng: -9.1334 });
const photo = (id: string) => ({
  url: `https://images.unsplash.com/${id}`,
  alt: `photo ${id}`,
  authorName: "A Photographer",
  authorUrl: "https://unsplash.com/@x",
  source: "unsplash" as const,
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Queues one response per /api/travel-images call, in order. */
function queuePhotos(...batches: ReturnType<typeof photo>[][]) {
  for (const images of batches) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ images }) });
  }
}

function open(overrides: Partial<Parameters<typeof StopDialog>[0]> = {}) {
  render(
    <StopDialog
      item={item}
      destination="Lisbon, Portugal"
      links={buildMapLinks(item, "Lisbon, Portugal")}
      open
      onOpenChange={() => {}}
      {...overrides}
    />,
  );
  return { user: userEvent.setup(), dialog: () => screen.getByRole("dialog") };
}

describe("StopDialog", () => {
  it("opens on the map, focused on the one stop", async () => {
    const { dialog } = open();
    expect(within(dialog()).getByRole("heading", { name: item.name })).toBeInTheDocument();
    expect(within(dialog()).getByRole("tab", { name: "Map" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByTestId("route-map")).toHaveAttribute("data-focus", "true");
  });

  it("shows photographs of the stop on the Photos tab", async () => {
    queuePhotos([photo("a"), photo("b")]);
    const { user, dialog } = open();

    await user.click(within(dialog()).getByRole("tab", { name: "Photos" }));

    expect(await within(dialog()).findByAltText("photo a")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toContain(
      encodeURIComponent(`${item.name}, Lisbon, Portugal`),
    );
    // Unsplash requires credit wherever a photo is shown.
    expect(within(dialog()).getAllByText(/A Photographer/).length).toBeGreaterThan(0);
  });

  it("falls back to the city's photos, and says that it did", async () => {
    queuePhotos([], [photo("city")]);
    const { user, dialog } = open();

    await user.click(within(dialog()).getByRole("tab", { name: "Photos" }));

    expect(await within(dialog()).findByAltText("photo city")).toBeInTheDocument();
    // The substitution is stated, not slipped past the traveler.
    expect(
      within(dialog()).getByText(/No photos of .* yet — showing Lisbon, Portugal/),
    ).toBeInTheDocument();
  });

  it("says so plainly when there is no photography at all", async () => {
    queuePhotos([], []);
    const { user, dialog } = open();

    await user.click(within(dialog()).getByRole("tab", { name: "Photos" }));

    expect(await within(dialog()).findByText(/No photography for this stop yet/)).toBeInTheDocument();
  });

  it("does not blame the traveler when the image service fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { user, dialog } = open();

    await user.click(within(dialog()).getByRole("tab", { name: "Photos" }));

    expect(await within(dialog()).findByText(/Couldn't load photography/)).toBeInTheDocument();
  });

  it("asks for photos only once the tab is actually opened", () => {
    open();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps directions pointed at the traveler's own maps app", () => {
    const { dialog } = open();
    const directions = within(dialog()).getByRole("link", { name: /Get directions/ });
    expect(directions).toHaveAttribute("target", "_blank");
    expect(directions).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("lands on Photos when that's the button that opened it", () => {
    queuePhotos([photo("a")]);
    const { dialog } = open({ initialTab: "photos" });
    expect(within(dialog()).getByRole("tab", { name: "Photos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    const { user } = open({ onOpenChange });
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
