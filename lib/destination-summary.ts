import { formatDailyBudget, suggestedNights, type Destination } from "@/lib/destination-catalog";

// The slice of a destination that cards, search results and API responses
// need. Defined once so no page invents its own shape — and so the API
// never ships the whole catalog entry (guides, itineraries, tips) to a
// browser that only draws a card.

export interface DestinationSummary {
  slug: string;
  name: string;
  country: string;
  region: string;
  shortDescription: string;
  tags: string[];
  moods: string[];
  heroImageQuery: string;
  dailyBudget: string;
  suggestedNights: number;
  tripDurationSuggestion: string;
}

export function toDestinationSummary(destination: Destination): DestinationSummary {
  return {
    slug: destination.slug,
    name: destination.name,
    country: destination.country,
    region: destination.region,
    shortDescription: destination.shortDescription,
    tags: destination.tags,
    moods: destination.moods,
    heroImageQuery: destination.heroImageQuery,
    dailyBudget: formatDailyBudget(destination),
    suggestedNights: suggestedNights(destination),
    tripDurationSuggestion: destination.tripDurationSuggestion,
  };
}
