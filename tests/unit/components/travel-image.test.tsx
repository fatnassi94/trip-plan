// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TravelImage } from "@/components/travel/travel-image";
import type { TravelImage as TravelImageData } from "@/lib/travel-images/types";

const photo: TravelImageData = {
  id: "a1",
  url: "https://images.unsplash.com/photo-1",
  thumbUrl: "https://images.unsplash.com/photo-1-small",
  alt: "Rooftops over the Tunis medina at sunset",
  authorName: "Amal B.",
  authorUrl: "https://unsplash.com/@amal",
  provider: "unsplash",
};

const box = () => document.querySelector("[data-image-state]") as HTMLElement;

describe("TravelImage", () => {
  it("draws a designed placeholder with initials when there is no photo", () => {
    render(<TravelImage label="Sidi Bou Said, Tunisia" sizes="100vw" className="aspect-video" />);

    expect(box()).toHaveAttribute("data-image-state", "placeholder");
    expect(screen.getByText("SB")).toBeInTheDocument();
    // The box still has an accessible name for the surrounding link.
    expect(screen.getByText("Sidi Bou Said, Tunisia")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a skeleton until the photo loads, then the photo", async () => {
    render(<TravelImage image={photo} label="Tunis, Tunisia" sizes="100vw" />);

    const image = screen.getByRole("img", { name: photo.alt });
    expect(box()).toHaveAttribute("data-image-state", "loading");
    expect(image).toHaveClass("opacity-0");

    // next/image decodes before forwarding onLoad, so this settles a tick later.
    fireEvent.load(image);

    await waitFor(() => expect(box()).toHaveAttribute("data-image-state", "photo"));
    expect(image).toHaveClass("opacity-100");
  });

  it("falls back to the placeholder when the image URL breaks", async () => {
    render(<TravelImage image={photo} label="Tunis, Tunisia" sizes="100vw" />);

    fireEvent.error(screen.getByRole("img"));

    await waitFor(() => expect(box()).toHaveAttribute("data-image-state", "placeholder"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("TT")).toBeInTheDocument();
  });

  it("credits the photographer only when asked and only for a real photo", async () => {
    const { rerender } = render(<TravelImage image={photo} label="Tunis" sizes="100vw" />);
    expect(screen.queryByRole("link", { name: "Amal B." })).not.toBeInTheDocument();

    rerender(<TravelImage image={photo} label="Tunis" sizes="100vw" showCredit />);
    fireEvent.load(screen.getByRole("img"));
    expect(await screen.findByRole("link", { name: "Amal B." })).toHaveAttribute("href", photo.authorUrl);

    rerender(<TravelImage label="Tunis" sizes="100vw" showCredit />);
    expect(screen.queryByRole("link", { name: "Amal B." })).not.toBeInTheDocument();
  });

  it("uses the label for alt text when the provider gave none", () => {
    render(<TravelImage image={{ ...photo, alt: "" }} label="Rome, Italy" sizes="100vw" />);
    expect(screen.getByRole("img", { name: "Rome, Italy travel photograph" })).toBeInTheDocument();
  });

  it("builds initials from words, skipping ampersands", () => {
    render(<TravelImage label="Beaches & islands" sizes="100vw" />);
    expect(screen.getByText("BI")).toBeInTheDocument();
  });

  it("can render a clean gradient with no monogram, for full-bleed heroes", () => {
    render(<TravelImage label="Tunis, Tunisia" sizes="100vw" plainPlaceholder />);
    expect(box()).toHaveAttribute("data-image-state", "placeholder");
    expect(screen.queryByText("TT")).not.toBeInTheDocument();
    expect(screen.getByText("Tunis, Tunisia")).toBeInTheDocument();
  });

  it("keeps the same placeholder colours for the same label", () => {
    const { unmount } = render(<TravelImage label="Tokyo, Japan" sizes="100vw" />);
    const first = box().className;
    unmount();
    render(<TravelImage label="Tokyo, Japan" sizes="100vw" />);
    expect(box().className).toBe(first);
  });
});
