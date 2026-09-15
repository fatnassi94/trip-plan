// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BudgetSelector, type BudgetOption } from "@/components/profile/budget-selector";

type Tier = "budget" | "comfort" | "premium";
const OPTIONS: BudgetOption<Tier>[] = [
  { value: "budget", label: "Budget", hint: "€", description: "Street food and public transport." },
  { value: "comfort", label: "Comfort", hint: "€€", description: "A mix of local spots and highlights." },
  { value: "premium", label: "Premium", hint: "€€€", description: "Fine dining and private transport." },
];

describe("BudgetSelector", () => {
  it("announces and describes the selected tier", () => {
    render(<BudgetSelector options={OPTIONS} value="comfort" onChange={() => {}} />);
    expect(screen.getByRole("slider", { name: "Budget" })).toHaveAttribute("aria-valuetext", "Comfort (€€)");
    expect(screen.getByText("A mix of local spots and highlights.")).toBeVisible();
  });

  it("reports the tier at the slider's new position", () => {
    const onChange = vi.fn();
    render(<BudgetSelector options={OPTIONS} value="comfort" onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith("premium");
  });

  it("jumps to a tier when its label is clicked, keeping focus on the slider", async () => {
    const onChange = vi.fn();
    render(<BudgetSelector options={OPTIONS} value="comfort" onChange={onChange} />);
    await userEvent.click(screen.getByText("€", { exact: true }).closest("button")!);
    expect(onChange).toHaveBeenCalledWith("budget");
    expect(screen.getByRole("slider")).toHaveFocus();
  });
});
