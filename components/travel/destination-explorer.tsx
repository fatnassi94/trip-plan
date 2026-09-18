"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { DestinationCard } from "@/components/travel/destination-card";
import type { DestinationSummary } from "@/lib/destination-summary";
import type { TravelImage } from "@/lib/travel-images/types";

// Search and filtering run entirely on the catalog the server already
// sent — no third-party call, no request per keystroke, and it keeps
// working with no API key. Photos were resolved server-side and travel
// with each destination.

export interface ExplorerEntry {
  destination: DestinationSummary;
  image: TravelImage | null;
}

interface Filters {
  q: string;
  mood: string;
  region: string;
  budget: string;
  maxNights: string;
  interest: string;
}

const EMPTY: Filters = { q: "", mood: "", region: "", budget: "", maxNights: "", interest: "" };

const BUDGETS = [
  { value: "budget", label: "Under €45/day" },
  { value: "comfort", label: "Under €100/day" },
  { value: "premium", label: "Any budget" },
];

const NIGHTS = [
  { value: "2", label: "Weekend (≤2 nights)" },
  { value: "4", label: "Short trip (≤4 nights)" },
  { value: "10", label: "Longer (≤10 nights)" },
];

export function DestinationExplorer({
  entries,
  moods,
  regions,
  interests,
  initial,
}: {
  entries: ExplorerEntry[];
  moods: { id: string; label: string }[];
  regions: string[];
  interests: string[];
  initial?: Partial<Filters>;
}) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, ...initial });

  const results = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return entries.filter(({ destination }) => {
      if (filters.mood && !destination.moods.includes(filters.mood)) return false;
      if (filters.region && destination.region !== filters.region) return false;
      if (filters.interest && !destination.tags.includes(filters.interest)) return false;
      if (filters.maxNights && destination.suggestedNights > Number(filters.maxNights)) return false;
      if (filters.budget === "budget" && !destination.dailyBudget.match(/€([1-3]?\d|4[0-5])\//)) {
        return false;
      }
      if (q) {
        const haystack = [
          destination.name,
          destination.country,
          destination.region,
          destination.shortDescription,
          ...destination.tags,
          ...destination.moods,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filters]);

  const active =
    Object.entries(filters).filter(([, value]) => value !== "").length > 0 ? filters : null;

  function update(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <div className="rounded-lg bg-surface p-4 shadow-card sm:p-5">
        <label className="flex items-center gap-2.5 rounded bg-accent-soft/60 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-warm" aria-hidden="true" />
          <span className="sr-only">Search destinations</span>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="Search by name, country, or what you want to do…"
            className="w-full bg-transparent font-display text-base font-semibold text-accent outline-none placeholder:font-normal placeholder:text-muted/70"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Filters
          </span>

          <FilterSelect label="Mood" value={filters.mood} onChange={(v) => update("mood", v)}>
            <option value="">Any mood</option>
            {moods.map((mood) => (
              <option key={mood.id} value={mood.id}>
                {mood.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Region" value={filters.region} onChange={(v) => update("region", v)}>
            <option value="">Anywhere</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Budget" value={filters.budget} onChange={(v) => update("budget", v)}>
            <option value="">Any budget</option>
            {BUDGETS.map((budget) => (
              <option key={budget.value} value={budget.value}>
                {budget.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Trip length" value={filters.maxNights} onChange={(v) => update("maxNights", v)}>
            <option value="">Any length</option>
            {NIGHTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Interest" value={filters.interest} onChange={(v) => update("interest", v)}>
            <option value="">Any interest</option>
            {interests.map((interest) => (
              <option key={interest} value={interest}>
                {interest}
              </option>
            ))}
          </FilterSelect>

          {active ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 font-display text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-paper"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-5 font-display text-sm font-semibold text-muted" role="status" aria-live="polite">
        {results.length} {results.length === 1 ? "destination" : "destinations"}
      </p>

      {results.length === 0 ? (
        <div className="mt-4 rounded-lg bg-surface p-8 text-center shadow-card">
          <p className="font-display text-base font-bold text-accent">Nothing matches those filters</p>
          <p className="mt-1 text-sm text-muted">
            Try widening the budget or trip length — the catalog is small while we grow it.
          </p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY)}
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-accent px-4 py-2.5 font-display text-sm font-semibold text-paper hover:bg-deep"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ destination, image }) => (
            <li key={destination.slug} className="h-full">
              <DestinationCard destination={destination} image={image} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded border px-3 py-2 font-display text-xs font-semibold outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10 ${
          value ? "border-accent bg-accent text-paper" : "border-border bg-surface text-accent"
        }`}
      >
        {children}
      </select>
    </label>
  );
}
