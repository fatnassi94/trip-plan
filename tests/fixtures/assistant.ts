import type { TripDay } from "@/types/trip";
import { makeItem, makeTrip } from "./trip";

// A realistic assistant answer to "It's raining" for day 1 of makeTrip():
// keeps the castle, drops the open-air lunch terrace and viewpoint, adds a
// covered museum.
export const RAIN_REPLY =
  "Rain plan: I kept the castle for the morning and swapped the open-air viewpoint for the covered tile museum.";

export function makeRainyDay(): TripDay {
  const day = makeTrip().days[0];
  return {
    ...day,
    items: [
      day.items[0],
      makeItem({
        name: "Museu Nacional do Azulejo",
        start: "14:00",
        durationMinutes: 120,
        lat: 38.7249,
        lng: -9.1136,
        address: "R. da Madre de Deus 4, Lisbon",
        tags: ["indoor", "art"],
        suggestions: ["See the 23m Lisbon panorama", "Coffee in the tiled cloister café"],
        reason: "It's raining — an indoor museum matches your culture interest and keeps you dry all afternoon.",
      }),
    ],
  };
}

export const RAIN_CHANGES = {
  added: ["Museu Nacional do Azulejo"],
  removed: ["Taberna da Rua das Flores", "Miradouro de Santa Luzia"],
  retimed: [],
};
