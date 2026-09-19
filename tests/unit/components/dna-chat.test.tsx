// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DnaChat } from "@/components/profile/dna-chat";
import { QUESTIONS } from "@/lib/dna-questions";
import type { TravelerProfile } from "@/types/trip";

const BASE: TravelerProfile = {
  travelerTypes: [],
  budgetTier: "comfort",
  pace: "balanced",
  walkingTolerance: "medium",
  foodPreferences: [],
  dislikes: [],
  localness: 3,
  discovery: 3,
  crowdTolerance: "medium",
  constraints: {},
};

/** The page owns the profile, so the harness does too. */
function Harness({ startAtEnd = false }: { startAtEnd?: boolean }) {
  const [profile, setProfile] = useState<TravelerProfile>(BASE);
  return (
    <DnaChat
      profile={profile}
      onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
      startAtEnd={startAtEnd}
      finale={<p>That&apos;s your Travel DNA.</p>}
    />
  );
}

const prompt = (id: string) => QUESTIONS.find((q) => q.id === id)!.prompt;

/**
 * Which question is being asked right now. The transcript repeats every
 * prompt it has already collected, so matching on prompt text alone would
 * find answered questions too; the live card is the one carrying the id.
 */
const currentQuestion = () =>
  document.querySelector("[id^='dna-q-']")?.id.replace("dna-q-", "") ?? null;

/** jsdom has no matchMedia; the component reads it for reduced motion. */
function stubMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  // These tests are about what the interview asks and remembers, not how
  // the text arrives — so run them the way someone with reduced motion
  // sees it, where every question is simply there. The typing itself has
  // its own tests at the bottom of this file.
  stubMotion(true);
});

describe("DnaChat", () => {
  it("asks one question at a time, starting with traveler types", () => {
    render(<Harness />);
    expect(currentQuestion()).toBe("personas");
    // The rest of the interview is not on screen yet — that was the point.
    expect(document.getElementById("dna-q-budget")).toBeNull();
    expect(document.getElementById("dna-q-rules")).toBeNull();
  });

  it("waits for Next on a question that takes several answers", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const next = screen.getByRole("button", { name: /Next/ });
    expect(next).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Foodie/ }));
    expect(next).toBeEnabled();
    // Still here: picking one persona must not snatch the question away.
    expect(currentQuestion()).toBe("personas");

    await user.click(next);
    expect(currentQuestion()).toBe("budget");
  });

  it("advances by itself once a single-answer question is answered", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Foodie/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));

    await user.click(screen.getByRole("button", { name: /^Premium/ }));

    // This is what makes it read as a conversation rather than a form.
    await waitFor(() => expect(currentQuestion()).toBe("pace"));
  });

  it("keeps answered questions above as a transcript you can change", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Foodie/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));

    const answer = screen.getByRole("button", { name: /Change your answer/ });
    expect(answer).toHaveTextContent("Foodie");

    await user.click(answer);
    // Back on that question, with the choice still made.
    expect(screen.getByRole("button", { name: /^Foodie/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("returns to where you were after editing an earlier answer", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Foodie/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(currentQuestion()).toBe("budget");

    await user.click(screen.getByRole("button", { name: /Change your answer/ }));
    await user.click(screen.getByRole("button", { name: /^Explorer/ }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    // Not marched through the interview again.
    expect(currentQuestion()).toBe("budget");
  });

  it("offers Skip on an optional question and Next once it's answered", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Foodie/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));

    // Walk the single-answer run. Only one question is ever on screen, and
    // transcript pills are named "Change your answer…", so these labels
    // can't collide with an earlier answer.
    for (const label of ["Comfort", "Balanced", "A fair bit", "Some is fine", "Balanced", "Mix of both"]) {
      await user.click(await screen.findByRole("button", { name: new RegExp(`^${label}`) }));
    }

    await waitFor(() => expect(currentQuestion()).toBe("food"));
    expect(screen.getByRole("button", { name: /Skip/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Local" }));
    expect(screen.getByRole("button", { name: /Next/ })).toBeInTheDocument();
  });

  it("goes straight to the end when a saved Travel DNA was restored", () => {
    render(<Harness startAtEnd />);
    expect(screen.getByText("That's your Travel DNA.")).toBeInTheDocument();
    void prompt;
    // No question is being asked — every answer is in the transcript, which
    // is why the prompts are still on the page.
    expect(currentQuestion()).toBeNull();
    expect(screen.queryByRole("button", { name: /^Foodie/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Change your answer/ })).toHaveLength(
      QUESTIONS.length,
    );
  });

  it("lets a traveler walk back through the interview", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Foodie/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));

    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(currentQuestion()).toBe("personas");
  });

  it("shows how far along the interview is", () => {
    render(<Harness />);
    expect(screen.getByText(`1 of ${QUESTIONS.length}`)).toBeInTheDocument();
  });

  it("still collects the hard rules the generator enforces", async () => {
    const user = userEvent.setup();
    render(<Harness startAtEnd />);
    // Reach the rules question from the transcript rather than replaying.
    const edits = screen.getAllByRole("button", { name: /Change your answer/ });
    await user.click(edits[edits.length - 1]);

    expect(screen.getByLabelText("Earliest start")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Never include" })).getByRole("button", { name: "Museums" })).toBeInTheDocument();
  });
  describe("with animation on", () => {
    beforeEach(() => stubMotion(false));

    it("types the question out, and only then offers the answers", async () => {
      render(<Harness />);

      // The three dots first — "RoamAI is answering you".
      expect(screen.getByRole("status", { name: /typing/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Foodie/ })).not.toBeInTheDocument();

      expect(await screen.findByRole("button", { name: /^Foodie/ }, { timeout: 3000 })).toBeVisible();
    });

    it("keeps the whole question readable to a screen reader while it types", async () => {
      render(<Harness />);
      // Once the words start: the visible copy is aria-hidden and partial,
      // so the full sentence has to be somewhere a screen reader reaches.
      await waitFor(() => expect(currentQuestion()).toBe("personas"));
      const full = screen.getByText(prompt("personas"), { selector: ".sr-only" });
      expect(full).toBeInTheDocument();
      expect(full.closest("[aria-hidden='true']")).toBeNull();
    });

    it("cuts the typing short when the traveler taps", async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness />);

      await waitFor(() => expect(currentQuestion()).toBe("personas"));
      await user.click(container.firstChild as Element);

      expect(await screen.findByRole("button", { name: /^Foodie/ })).toBeVisible();
    });
  });
});
