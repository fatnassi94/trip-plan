"use client";

import { useId, useState } from "react";
import { ChevronDown, ExternalLink, MapPin, Navigation, Video } from "lucide-react";
import { buildMapLinks, formatPriceEstimate } from "@/lib/trip-links";
import type { ItineraryItem } from "@/types/trip";

interface ActivityCardProps {
  item: ItineraryItem;
  /** Needed to build a map query when the AI didn't return an address. */
  destination: string;
}

// The Day Detail card. Two tiers of information on purpose (see
// frontend-design's "keep it clean, not overloaded"):
//   - always visible: time, type, estimated budget, tags, and the
//     required "why I chose this" line
//   - behind "More details": address, concrete suggestions, and the
//     map/360° view — heavier content that not every reader wants open
export function ActivityCard({ item, destination }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const end = addMinutes(item.start, item.durationMinutes);
  const price = formatPriceEstimate(item);
  const links = buildMapLinks(item, destination);
  const suggestions = item.suggestions?.filter(Boolean) ?? [];

  return (
    <article className="rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-medium">{item.name}</h2>
        <span className="font-mono text-xs tabular-nums text-muted">
          {item.start} – {end}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-mono uppercase tracking-wide">{item.type}</span>
        <span aria-hidden="true">·</span>
        <span className="font-medium text-ink/70">{price}</span>
        {item.tags?.map((tag) => (
          <span key={tag} className="rounded-full bg-accent-soft px-2 py-1 text-accent">
            {tag}
          </span>
        ))}
      </div>

      {/* The line that makes the AI feel like it knows you. Required on
          every item — see types/trip.ts and the travel-domain skill.
          Always visible, never gated behind the details toggle. */}
      <p className="mt-4 rounded-md bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent">
        <span className="font-medium">Why I chose this for you — </span>
        {item.reason}
      </p>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((e) => !e)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {expanded ? "Show less" : "More details"}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div id={detailsId} className="mt-4 flex flex-col gap-5 border-t border-border pt-4">
          <div className="flex items-start gap-2 text-sm text-ink/80">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{item.address || "Exact address not provided — use the map search below."}</span>
          </div>

          {suggestions.length > 0 ? (
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted">
                What to do here
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink/80">
                {suggestions.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="text-accent" aria-hidden="true">
                      ·
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted">
              Location & map
            </h3>

            {links.osmEmbedUrl ? (
              <div className="mt-2 overflow-hidden rounded-md border border-border">
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
                <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted">
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
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function addMinutes(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
