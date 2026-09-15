"use client";

import { useId, useState } from "react";
import {
  ChevronDown,
  Compass,
  ExternalLink,
  MapPin,
  Navigation,
  Sparkles,
  UtensilsCrossed,
  Video,
} from "lucide-react";
import { buildMapLinks, formatPriceEstimate } from "@/lib/trip-links";
import { addMinutes, dayPart, formatDuration } from "@/lib/itinerary";
import type { ItemType, ItineraryItem } from "@/types/trip";

interface ActivityCardProps {
  item: ItineraryItem;
  /** Needed to build a map query when the AI didn't return an address. */
  destination: string;
}

const TYPE_STYLE: Record<ItemType, { label: string; icon: typeof Compass; className: string }> = {
  activity: { label: "Activity", icon: Compass, className: "bg-accent-soft text-accent" },
  meal: { label: "Meal", icon: UtensilsCrossed, className: "bg-warm-soft text-warm" },
  transit: { label: "Transit", icon: Navigation, className: "bg-sage/20 text-accent" },
};

// The Activity Card. Two tiers of information on purpose (see
// frontend-design's "keep it clean, not overloaded"):
//   - always visible: day part and time, type, estimated budget, tags,
//     and the required "why I chose this" line
//   - behind "More details": concrete suggestions and the map/360° view —
//     heavier content that not every reader wants open
export function ActivityCard({ item, destination }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const end = addMinutes(item.start, item.durationMinutes);
  const price = formatPriceEstimate(item);
  const links = buildMapLinks(item, destination);
  const suggestions = item.suggestions?.filter(Boolean) ?? [];
  const type = TYPE_STYLE[item.type] ?? TYPE_STYLE.activity;

  return (
    <article className="group rounded-lg bg-surface p-5 shadow-card transition-shadow duration-300 hover:shadow-lift">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent">
            {dayPart(item.start)} · <span className="tabular-nums">{item.start}–{end}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-bold ${type.className}`}
          >
            <type.icon className="h-3 w-3" aria-hidden="true" />
            {type.label}
          </span>
        </div>
        <span className="font-display text-xs font-semibold text-muted">
          {formatDuration(item.durationMinutes)} · <span className="text-warm">{price}</span>
        </span>
      </div>

      <h2 className="mt-3 font-display text-lg font-bold tracking-tight text-accent">{item.name}</h2>
      {item.address ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {item.address}
        </p>
      ) : null}

      {/* The line that makes the AI feel like it knows you. Required on
          every item — see types/trip.ts and the travel-domain skill.
          Always visible, never gated behind the details toggle. */}
      <div className="mt-4 rounded border-l-[3px] border-sunset bg-gradient-to-br from-accent-soft/60 to-warm-soft/30 px-4 py-3">
        <p className="flex items-center gap-1.5 font-display text-xs font-bold text-accent">
          <Sparkles className="h-3.5 w-3.5 text-sunset" aria-hidden="true" />
          Why RoamAI chose this for you
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{item.reason}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {item.tags?.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-accent-soft/60 px-2.5 py-1 font-display text-[0.7rem] font-medium text-ink"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}

        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1 rounded font-display text-sm font-semibold text-accent transition-colors hover:text-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {expanded ? "Show less" : "More details"}
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded ? (
        <div id={detailsId} className="roam-rise mt-4 flex flex-col gap-5 border-t border-border pt-4">
          {!item.address ? (
            <p className="flex items-start gap-2 text-sm text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Exact address not provided — use the map search below.
            </p>
          ) : null}

          {suggestions.length > 0 ? (
            <div>
              <h3 className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                What to do here
              </h3>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-ink">
                {suggestions.map((s) => (
                  <li key={s} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sunset" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Location & map
            </h3>

            {links.osmEmbedUrl ? (
              <div className="mt-2 overflow-hidden rounded-md shadow-card">
                <iframe
                  title={`Map showing ${item.name}`}
                  src={links.osmEmbedUrl}
                  loading="lazy"
                  className="h-48 w-full sm:h-56"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <MapLinkButton href={links.googleSearchUrl} icon={ExternalLink}>
                Open in Google Maps
              </MapLinkButton>
              {links.osmViewUrl ? (
                <MapLinkButton href={links.osmViewUrl} icon={MapPin}>
                  Open in OpenStreetMap
                </MapLinkButton>
              ) : null}
              {links.streetViewUrl ? (
                <MapLinkButton href={links.streetViewUrl} icon={Video}>
                  360° street view
                </MapLinkButton>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded bg-accent-soft/40 px-3 py-2 text-xs text-muted">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  360° view unavailable for this stop
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function MapLinkButton({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Navigation;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded bg-accent-soft/60 px-3 py-2 font-display text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
