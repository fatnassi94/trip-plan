// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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

  it("reveals suggestions and map links behind More details", async () => {
    render(<ActivityCard item={makeItem()} destination="Lisbon" />);
    const toggle = screen.getByRole("button", { name: "More details" });
    expect(screen.queryByText("Arrive before 10:00")).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Arrive before 10:00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps"),
    );
    expect(screen.getByRole("link", { name: /360° street view/ })).toHaveAttribute("target", "_blank");
  });

  it("labels meals and explains when a stop has no street view", async () => {
    render(<ActivityCard item={makeItem({ type: "meal", lat: undefined, lng: undefined })} destination="Lisbon" />);
    expect(screen.getByText("Meal")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More details" }));
    expect(screen.getByText("360° view unavailable for this stop")).toBeInTheDocument();
  });
});
