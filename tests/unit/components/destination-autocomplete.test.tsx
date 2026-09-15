// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DestinationAutocomplete } from "@/components/create-trip/destination-autocomplete";

function renderInForm() {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  const onSelect = vi.fn();
  render(
    <form onSubmit={onSubmit}>
      <DestinationAutocomplete name="destination" onSelect={onSelect} />
    </form>,
  );
  return { onSubmit, onSelect, input: screen.getByRole("combobox") };
}

describe("DestinationAutocomplete", () => {
  it("suggests prefix matches and picks one with the keyboard", async () => {
    const user = userEvent.setup();
    const { onSelect, onSubmit, input } = renderInForm();

    await user.type(input, "lis");
    expect(screen.getByRole("option", { name: "Lisbon, Portugal" })).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(input).toHaveValue("Lisbon, Portugal");
    expect(onSelect).toHaveBeenCalledWith("Lisbon, Portugal");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not submit a half-typed destination when Enter is pressed with the list open", async () => {
    const user = userEvent.setup();
    const { onSubmit, input } = renderInForm();

    await user.type(input, "zzz");
    expect(screen.getByText("No matching destinations")).toBeInTheDocument();
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the list on Escape", async () => {
    const user = userEvent.setup();
    const { input } = renderInForm();
    await user.type(input, "par");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
