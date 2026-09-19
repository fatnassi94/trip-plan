// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ActivityCard } from "@/components/trip/activity-card";
import { makeItem } from "@/tests/fixtures/trip";

describe("ActivityCard", () => {
  it("always shows the time, type, price and the reason it was chosen", () => {
    const item = makeItem();
    render(<ActivityCard item={item} destination="Lisbon" />);

    expect(screen.getByRole("heading", { name: "Castelo de São Jorge" })).toBeInTheDocument();
    expect(screen.getByText("09:30–11:00")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("€10–30 per person")).toBeInTheDocument();
    expect(screen.getByTitle("Estimated effort for this stop")).toHaveTextContent(/Easy|Moderate|Demanding/);
    expect(screen.getByText("Why RoamAI chose this for you")).toBeInTheDocument();
    expect(screen.getByText(item.reason)).toBeInTheDocument();
  });

  it("reveals suggestions and the two in-app views behind More details", async () => {
    render(<ActivityCard item={makeItem()} destination="Lisbon" />);
    const toggle = screen.getByRole("button", { name: "More details" });
    expect(screen.queryByText("Arrive before 10:00")).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Arrive before 10:00")).toBeInTheDocument();
    // Map and 360° are buttons now, not links: they open a dialog over the
    // itinerary instead of throwing the traveler into a new tab.
    expect(screen.getByRole("button", { name: "View on map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photos" })).toBeInTheDocument();
    // Directions stay external on purpose — that's the traveler's GPS app.
    expect(screen.getByRole("link", { name: /Directions/ })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps"),
    );
  });

  it("opens the stop dialog on the tab that was clicked", async () => {
    render(<ActivityCard item={makeItem()} destination="Lisbon" />);
    await userEvent.click(screen.getByRole("button", { name: "More details" }));

    await userEvent.click(screen.getByRole("button", { name: "Photos" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Photos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(dialog).getByRole("heading", { name: "Castelo de São Jorge" })).toBeInTheDocument();
  });

  it("closes the dialog without collapsing the card", async () => {
    render(<ActivityCard item={makeItem()} destination="Lisbon" />);
    await userEvent.click(screen.getByRole("button", { name: "More details" }));
    await userEvent.click(screen.getByRole("button", { name: "View on map" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The day is still where the traveler left it.
    expect(screen.getByText("Arrive before 10:00")).toBeInTheDocument();
  });

  it("labels meals and says so when a stop has no coordinates", async () => {
    render(<ActivityCard item={makeItem({ type: "meal", lat: undefined, lng: undefined })} destination="Lisbon" />);
    expect(screen.getByText("Meal")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More details" }));
    await userEvent.click(screen.getByRole("button", { name: "View on map" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/don't have exact coordinates/i)).toBeInTheDocument();
  });
});
