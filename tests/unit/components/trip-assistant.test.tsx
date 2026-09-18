// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TripAssistant } from "@/components/trip/trip-assistant";
import { replaceDay } from "@/lib/itinerary";
import { makeRainyDay, RAIN_CHANGES, RAIN_REPLY } from "@/tests/fixtures/assistant";
import { makeTrip } from "@/tests/fixtures/trip";

const TRIP_ID = "7d8f0f5e-2b1c-4c7e-9a51-3f0f6a2d9b10";
const trip = makeTrip();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** fetch stub answering the assistant and the save endpoint separately. */
function stubFetch({
  assistant = () =>
    json(200, {
      reply: RAIN_REPLY,
      day: makeRainyDay(),
      changes: RAIN_CHANGES,
      energy: { before: { score: 118, percent: 98, level: "heavy" }, after: { score: 76, percent: 63, level: "steady" } },
    }),
  save = () => json(200, { trip: replaceDay(trip, makeRainyDay()) }),
}: { assistant?: () => Response; save?: () => Response } = {}) {
  const fetchMock = vi.fn(async (url: string) => (url === "/api/trips/assistant" ? assistant() : save()));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof stubFetch>, call: number) =>
  JSON.parse((fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].body as string);

function renderAssistant(tripId = "local") {
  const onApplied = vi.fn();
  render(<TripAssistant tripId={tripId} trip={trip} dayNumber={1} onApplied={onApplied} />);
  const panel = screen.getByRole("region", { name: "RoamAI Assistant" });
  return { onApplied, panel, user: userEvent.setup() };
}

async function askAboutRain(user: ReturnType<typeof userEvent.setup>, panel: HTMLElement) {
  await user.type(within(panel).getByRole("textbox", { name: "Ask RoamAI to change Day 1" }), "It's raining{Enter}");
  await within(panel).findByText(RAIN_REPLY);
}

describe("TripAssistant", () => {
  it("fills the box from a quick request without sending it", async () => {
    const fetchMock = stubFetch();
    const { panel, user } = renderAssistant();
    await user.click(within(panel).getByRole("button", { name: "It's raining" }));
    expect(within(panel).getByRole("textbox")).toHaveValue(
      "It's raining — swap outdoor stops for covered or indoor ones.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the request and shows the reply with a readable diff", async () => {
    const fetchMock = stubFetch();
    const { panel, user } = renderAssistant();

    await askAboutRain(user, panel);

    expect(within(within(panel).getByRole("log")).getByText("It's raining")).toBeInTheDocument();
    const changes = within(panel).getByRole("list", { name: "Proposed changes" });
    expect(changes).toHaveTextContent("Add Museu Nacional do Azulejo");
    expect(changes).toHaveTextContent("Remove Taberna da Rua das Flores");
    expect(bodyOf(fetchMock, 0)).toEqual({ trip, day: 1, message: "It's raining", anotherOption: false });
  });

  it("shows how much lighter (or heavier) the day becomes", async () => {
    stubFetch();
    const { panel, user } = renderAssistant();
    await askAboutRain(user, panel);

    expect(within(panel).getByText(/Effort: Heavy day 118 → Steady day 76/)).toBeInTheDocument();
  });

  it("says nothing about effort when it doesn't change", async () => {
    stubFetch({
      assistant: () =>
        json(200, {
          reply: RAIN_REPLY,
          day: makeRainyDay(),
          changes: RAIN_CHANGES,
          energy: { before: { score: 90, percent: 75, level: "steady" }, after: { score: 90, percent: 75, level: "steady" } },
        }),
    });
    const { panel, user } = renderAssistant();
    await askAboutRain(user, panel);

    expect(within(panel).queryByText(/Effort:/)).not.toBeInTheDocument();
  });

  it("applies a tab-only trip's change locally", async () => {
    const fetchMock = stubFetch();
    const { panel, user, onApplied } = renderAssistant("local");
    await askAboutRain(user, panel);

    await user.click(within(panel).getByRole("button", { name: "Apply to Day 1" }));

    expect(onApplied).toHaveBeenCalledWith(replaceDay(trip, makeRainyDay()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(within(panel).getByText("Applied to Day 1")).toBeInTheDocument();
  });

  it("saves a saved trip's change through the trips API, sending only its id to the assistant", async () => {
    const saved = replaceDay(trip, makeRainyDay());
    const fetchMock = stubFetch({ save: () => json(200, { trip: saved }) });
    const { panel, user, onApplied } = renderAssistant(TRIP_ID);
    await askAboutRain(user, panel);

    expect(bodyOf(fetchMock, 0)).toEqual({ tripId: TRIP_ID, day: 1, message: "It's raining", anotherOption: false });

    await user.click(within(panel).getByRole("button", { name: "Apply to Day 1" }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(saved));
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/trips/${TRIP_ID}`);
    expect(bodyOf(fetchMock, 1)).toEqual({ day: makeRainyDay() });
  });

  it("keeps the suggestion open and says why when saving is refused", async () => {
    stubFetch({ save: () => json(422, { error: "These changes break the schedule rules." }) });
    const { panel, user, onApplied } = renderAssistant(TRIP_ID);
    await askAboutRain(user, panel);

    await user.click(within(panel).getByRole("button", { name: "Apply to Day 1" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent("break the schedule rules");
    expect(within(panel).getByRole("button", { name: "Apply to Day 1" })).toBeEnabled();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("asks for another option with the same request", async () => {
    const fetchMock = stubFetch();
    const { panel, user } = renderAssistant();
    await askAboutRain(user, panel);

    await user.click(within(panel).getByRole("button", { name: "Another option" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1)).toMatchObject({ message: "It's raining", anotherOption: true });
    expect(within(panel).getByText("Show me another option.")).toBeInTheDocument();
  });

  it("marks older suggestions for the same day outdated once one is applied", async () => {
    stubFetch();
    const { panel, user } = renderAssistant();
    await askAboutRain(user, panel);
    await user.click(within(panel).getByRole("button", { name: "Another option" }));
    await waitFor(() => expect(within(panel).getAllByRole("button", { name: "Apply to Day 1" })).toHaveLength(2));

    await user.click(within(panel).getAllByRole("button", { name: "Apply to Day 1" })[1]);

    expect(within(panel).getByText("Applied to Day 1")).toBeInTheDocument();
    expect(within(panel).getByText(/Outdated — Day 1 has changed/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Apply to Day 1" })).not.toBeInTheDocument();
  });

  it("shows the error with a retry when the assistant fails", async () => {
    let calls = 0;
    const fetchMock = stubFetch({
      assistant: () =>
        ++calls === 1
          ? json(502, { error: "The assistant couldn't come up with a change that fits your day." })
          : json(200, { reply: RAIN_REPLY, day: makeRainyDay(), changes: RAIN_CHANGES }),
    });
    const { panel, user } = renderAssistant();
    await user.type(within(panel).getByRole("textbox"), "It's raining{Enter}");

    await user.click(await within(panel).findByRole("button", { name: "Try again" }));

    expect(await within(panel).findByText(RAIN_REPLY)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doesn't offer Apply when the reply changes nothing", async () => {
    stubFetch({
      assistant: () =>
        json(200, {
          reply: "That's already a rain-proof day — I'd keep it as is.",
          day: trip.days[0],
          changes: { added: [], removed: [], retimed: [] },
        }),
    });
    const { panel, user } = renderAssistant();
    await user.type(within(panel).getByRole("textbox"), "It's raining{Enter}");

    await within(panel).findByText(/already a rain-proof day/);
    expect(within(panel).queryByRole("button", { name: "Apply to Day 1" })).not.toBeInTheDocument();
  });
});
