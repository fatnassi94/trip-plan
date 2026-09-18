import destinationsData from "@/data/destinations.json";
import guidesData from "@/data/guides.json";

// The destination catalog: mock JSON today, shaped like the API that will
// replace it. Everything reads through these helpers, so swapping the two
// imports for fetch calls later touches no page.
//
// Separate from lib/destinations.ts, which is the flat "City, Country"
// list the create-trip autocomplete filters — that one stays as it is.

export type MoodId =
  | "beaches-islands"
  | "food-culture"
  | "historic-cities"
  | "nature-hiking"
  | "nightlife"
  | "budget-escapes"
  | "luxury-relaxation";

export type BudgetTierKey = "budget" | "comfort" | "premium";

export interface DailyBudget {
  currency: string;
  budget: number;
  comfort: number;
  premium: number;
}

export interface NamedNote {
  name: string;
  note: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  stops: string[];
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string;
  cityOrRegion: string;
  latitude: number;
  longitude: number;
  shortDescription: string;
  whyGo: string;
  tags: string[];
  moods: MoodId[];
  bestFor: string[];
  bestTimeToVisit: string;
  estimatedDailyBudget: DailyBudget;
  tripDurationSuggestion: string;
  heroImageQuery: string;
  galleryImageQueries: string[];
  curatedImages?: { url: string; thumbUrl?: string; alt: string; credit?: string; creditUrl?: string }[];
  neighborhoods: NamedNote[];
  thingsToDo: string[];
  localFood: NamedNote[];
  travelTips: string[];
  sampleItinerary: ItineraryDay[];
  related: string[];
}

export interface Guide {
  id: string;
  slug: string;
  title: string;
  summary: string;
  readingMinutes: number;
  destinationSlugs: string[];
  imageQuery: string;
  highlights: string[];
}

export interface Mood {
  id: MoodId;
  label: string;
  blurb: string;
  imageQuery: string;
}

const DESTINATIONS = destinationsData as Destination[];
const GUIDES = guidesData as Guide[];

export const MOODS: Mood[] = [
  { id: "beaches-islands", label: "Beaches & islands", blurb: "Swim, then eat by the water", imageQuery: "mediterranean beach turquoise water" },
  { id: "food-culture", label: "Food & local culture", blurb: "Markets, counters, kitchens", imageQuery: "street food market stall evening" },
  { id: "historic-cities", label: "Historic cities", blurb: "Old stones, short walks", imageQuery: "historic old town narrow street" },
  { id: "nature-hiking", label: "Nature & hiking", blurb: "Trails, ridges, quiet air", imageQuery: "mountain hiking trail morning" },
  { id: "nightlife", label: "Nightlife", blurb: "Late bars and live rooms", imageQuery: "city nightlife neon street" },
  { id: "budget-escapes", label: "Budget escapes", blurb: "Big trips, small spend", imageQuery: "backpacker city street colorful" },
  { id: "luxury-relaxation", label: "Luxury & relaxation", blurb: "Slow mornings, good sheets", imageQuery: "luxury terrace pool sunset" },
];

export function allDestinations(): Destination[] {
  return DESTINATIONS;
}

export function allGuides(): Guide[] {
  return GUIDES;
}

export function destinationBySlug(slug: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.slug === slug);
}

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function featuredDestinations(count = 6): Destination[] {
  return DESTINATIONS.slice(0, count);
}

export function destinationsByMood(mood: MoodId): Destination[] {
  return DESTINATIONS.filter((d) => d.moods.includes(mood));
}

export function moodById(id: string): Mood | undefined {
  return MOODS.find((m) => m.id === id);
}

export function relatedDestinations(slug: string, count = 3): Destination[] {
  const destination = destinationBySlug(slug);
  if (!destination) return [];
  const related = destination.related
    .map((s) => destinationBySlug(s))
    .filter((d): d is Destination => Boolean(d));
  // Top up from the rest of the catalog so the row is never half empty.
  const filler = DESTINATIONS.filter(
    (d) => d.slug !== slug && !related.some((r) => r.slug === d.slug),
  );
  return [...related, ...filler].slice(0, count);
}

export interface DestinationFilters {
  q?: string;
  mood?: MoodId;
  region?: string;
  /** Matches destinations whose comfort-tier day rate fits the tier. */
  budget?: BudgetTierKey;
  /** Maximum suggested nights, read from tripDurationSuggestion. */
  maxNights?: number;
  interests?: string[];
}

/** Upper day-rate (EUR) a destination may cost to count as this tier. */
const BUDGET_CEILING: Record<BudgetTierKey, number> = { budget: 45, comfort: 100, premium: Infinity };

/** The first number in "3–5 days" / "7–10 days across two bases". */
export function suggestedNights(destination: Destination): number {
  const match = /(\d+)/.exec(destination.tripDurationSuggestion);
  return match ? Number(match[1]) : 3;
}

export function searchDestinationCatalog(filters: DestinationFilters = {}): Destination[] {
  const q = filters.q?.trim().toLowerCase();
  const interests = filters.interests?.map((i) => i.toLowerCase()) ?? [];

  return DESTINATIONS.filter((destination) => {
    if (filters.mood && !destination.moods.includes(filters.mood)) return false;
    if (filters.region && destination.region !== filters.region) return false;

    if (filters.budget) {
      const rate =
        filters.budget === "budget"
          ? destination.estimatedDailyBudget.budget
          : destination.estimatedDailyBudget.comfort;
      if (rate > BUDGET_CEILING[filters.budget]) return false;
    }

    if (filters.maxNights && suggestedNights(destination) > filters.maxNights) return false;

    if (interests.length > 0) {
      const haystack = [...destination.tags, ...destination.bestFor].map((t) => t.toLowerCase());
      if (!interests.some((interest) => haystack.some((t) => t.includes(interest)))) return false;
    }

    if (q) {
      const haystack = [
        destination.name,
        destination.country,
        destination.region,
        destination.cityOrRegion,
        destination.shortDescription,
        ...destination.tags,
        ...destination.bestFor,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function allRegions(): string[] {
  return [...new Set(DESTINATIONS.map((d) => d.region))].sort();
}

export function allInterests(): string[] {
  return [...new Set(DESTINATIONS.flatMap((d) => d.tags))].sort();
}

/** "€70/day" — the headline number a card shows. */
export function formatDailyBudget(destination: Destination, tier: BudgetTierKey = "comfort"): string {
  const symbol = destination.estimatedDailyBudget.currency === "EUR" ? "€" : "";
  return `${symbol}${destination.estimatedDailyBudget[tier]}/day`;
}
