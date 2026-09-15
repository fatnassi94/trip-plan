import type { ItineraryItem, Trip, TripRequest } from "@/types/trip";

// Shared test data. A valid, business-rule-passing trip that unit tests
// mutate into broken variants and e2e tests feed to the UI in place of a
// real AI response.

export function makeItem(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    type: "activity",
    name: "Castelo de São Jorge",
    start: "09:30",
    durationMinutes: 90,
    priceLevel: 2,
    tags: ["views"],
    lat: 38.7139,
    lng: -9.1335,
    address: "R. de Santa Cruz do Castelo, Lisbon",
    suggestions: ["Arrive before 10:00", "Walk the upper terrace"],
    reason:
      "You picked Photographer with a relaxed pace — the castle walls catch soft morning light before the tour groups arrive.",
    ...overrides,
  };
}

export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    destination: "Lisbon, Portugal",
    startDate: "2026-10-12",
    endDate: "2026-10-13",
    travelers: 2,
    days: [
      {
        day: 1,
        title: "Alfama & Miradouros",
        items: [
          makeItem(),
          makeItem({
            type: "meal",
            name: "Taberna da Rua das Flores",
            start: "12:30",
            durationMinutes: 75,
            lat: 38.7107,
            lng: -9.1432,
            address: "R. das Flores 103, Lisbon",
            tags: ["local-food"],
            reason: "Foodie on a comfort budget: small-plate Portuguese cooking a short tram ride from the castle.",
          }),
          makeItem({
            name: "Miradouro de Santa Luzia",
            start: "16:30",
            durationMinutes: 60,
            lat: 38.7118,
            lng: -9.1303,
            address: undefined,
            reason: "Low walking tolerance — this viewpoint is downhill from lunch and faces west for golden hour.",
          }),
        ],
      },
      {
        day: 2,
        title: "Belém by the River",
        items: [
          makeItem({
            name: "Mosteiro dos Jerónimos",
            start: "10:00",
            lat: 38.6979,
            lng: -9.2068,
            reason: "Culture lover: Manueline architecture, booked early to skip the midday queue you wanted to avoid.",
          }),
        ],
      },
    ],
    ...overrides,
  };
}

export function makeTripRequest(overrides: Partial<TripRequest> = {}): TripRequest {
  return {
    destination: "Lisbon, Portugal",
    startDate: "2026-10-12",
    endDate: "2026-10-13",
    travelers: 2,
    profile: {
      travelerTypes: ["Foodie", "Photographer"],
      budgetTier: "comfort",
      pace: "relaxed",
      walkingTolerance: "low",
      foodPreferences: ["local"],
      dislikes: ["crowds"],
    },
    ...overrides,
  };
}
