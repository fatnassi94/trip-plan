// Canonical shapes for a generated trip. The AI never writes prose into the
// database — it returns JSON matching this shape (validated against
// lib/ai/schema.ts before anything touches Supabase). See section "Data &
// Trust" in the project plan: an itinerary you can edit has to be an
// itinerary you can parse.

export type BudgetTier = "budget" | "comfort" | "premium";
export type Pace = "relaxed" | "balanced" | "packed";
export type WalkingTolerance = "low" | "medium" | "high";

export interface TravelerProfile {
  travelerTypes: string[]; // e.g. ["Explorer", "Foodie"]
  budgetTier: BudgetTier;
  pace: Pace;
  walkingTolerance: WalkingTolerance;
  foodPreferences: string[]; // e.g. ["local", "vegetarian"]
  dislikes: string[]; // free text: "crowds", "seafood", ...
}

export interface TripRequest {
  destination: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  travelers: number;
  profile: TravelerProfile;
}

export type ItemType = "activity" | "meal" | "transit";

export interface ItineraryItem {
  type: ItemType;
  name: string;
  placeId?: string;
  start: string; // "HH:MM", 24h
  durationMinutes: number;
  priceLevel?: 1 | 2 | 3 | 4;
  tags?: string[];
  lat?: number;
  lng?: number;
  /** Street address or, failing that, a neighborhood — shown on the
   * Activity Card and used to build its map links (lib/trip-links.ts). */
  address?: string;
  /** 2-4 short, concrete things to do/see/eat at this stop — the "what
   * to do here" list on the Activity Card. Optional so older cached
   * trips generated before this field existed still render cleanly. */
  suggestions?: string[];
  /** "Why I chose this for you" — required on every item. This line is
   * what the Activity Card renders; never leave it generic. */
  reason: string;
}

export interface TripDay {
  day: number; // 1-indexed
  title: string; // e.g. "Classic Paris"
  items: ItineraryItem[];
}

export interface Trip {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  days: TripDay[];
}

/**
 * What a traveler without an active plan is allowed to see: enough to know
 * the trip is real and worth paying for (where, how long, what each day is
 * called) and nothing they could actually travel on — no times, places,
 * addresses or "why I chose this" lines.
 *
 * The full itinerary stays server-side until app/api/trips/claim hands it
 * over. Returning the whole thing and hiding it in the UI would put the
 * entire product in the browser's network tab.
 */
export interface TripPreview {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  dayCount: number;
  totalStops: number;
  dayTitles: string[];
}
