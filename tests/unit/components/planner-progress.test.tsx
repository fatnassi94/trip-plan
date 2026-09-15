// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlannerProgress } from "@/components/trip/planner-progress";

describe("PlannerProgress", () => {
  it("shows the title, step count, percentage and each step's state", () => {
    render(<PlannerProgress current={2} title="Discovering your travel DNA" />);

    expect(screen.getByRole("heading", { level: 1, name: "Discovering your travel DNA" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 4 · Travel DNA")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    const steps = within(screen.getByRole("navigation", { name: "Trip planning progress" })).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent("(completed)");
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).not.toHaveAttribute("aria-current");
  });

  it("links only completed steps that were given an href", () => {
    render(
      <PlannerProgress current={3} title="Building" hrefs={{ 1: "/create-trip?destination=Lisbon", 4: "/trip/x" }} />,
    );
    const links = within(screen.getByRole("navigation", { name: "Trip planning progress" })).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/create-trip?destination=Lisbon");
  });
});
