"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Camera, ExternalLink, Map as MapIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TravelImage } from "@/components/travel/travel-image";
import { useStopPhotos } from "./use-stop-photos";
import type { MapLinks } from "@/lib/trip-links";
import type { ItineraryItem } from "@/types/trip";

// "Look at this place" without leaving RoamAI.
//
// This replaces what the activity card used to do: a small OpenStreetMap
// iframe plus two links that threw you into a new browser tab. Both views
// now live in a modal over the itinerary, so losing your place in the day
// is no longer the price of checking what a stop looks like.
//
// The map is the same MapLibre component the trip pages use, in `focus`
// mode. The second tab is photography of the stop, through the image
// provider that already powers discovery.
//
// It is NOT Street View. Google's Maps Embed API is the only supported way
// to frame a pano inside our own page, and getting a key for it requires a
// billing account — a wall this project won't put in front of someone
// cloning it. Real photographs of the place, free and already wired, beat
// a 360° button that nobody can turn on.

const RouteMap = dynamic(() => import("./route-map").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-accent-soft/50" />,
});

type StopTab = "map" | "photos";

interface StopDialogProps {
  item: ItineraryItem;
  /** The trip's destination — broadens the photo search when a stop has none. */
  destination: string;
  links: MapLinks;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which view to land on — the card has a button for each. */
  initialTab?: StopTab;
}

export function StopDialog({
  item,
  destination,
  links,
  open,
  onOpenChange,
  initialTab = "map",
}: StopDialogProps) {
  const [tab, setTab] = useState<StopTab>(initialTab);
  const hasCoords = item.lat != null && item.lng != null;

  // Every opening lands on whichever button was pressed, rather than
  // wherever the previous visit left off. This is React's "adjust state
  // during render" pattern rather than an effect: the dialog is
  // controlled, so Radix never calls onOpenChange for an open WE caused,
  // and keying off `open` catches re-opening on the same tab too.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab(initialTab);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} data-stop-dialog={tab}>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          {item.address ? <DialogDescription>{item.address}</DialogDescription> : null}
        </DialogHeader>

        <div
          role="tablist"
          aria-label="How to view this stop"
          className="flex shrink-0 gap-1 px-5 sm:px-6"
        >
          <TabButton
            id="map"
            active={tab === "map"}
            icon={MapIcon}
            onClick={() => setTab("map")}
          >
            Map
          </TabButton>
          <TabButton
            id="photos"
            active={tab === "photos"}
            icon={Camera}
            onClick={() => setTab("photos")}
          >
            Photos
          </TabButton>
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <div
            role="tabpanel"
            id="stop-panel-map"
            aria-labelledby="stop-tab-map"
            hidden={tab !== "map"}
            className="h-[52vh] w-full sm:h-[26rem]"
          >
            {/* Mounted only while visible: two MapLibre canvases fighting
                over one modal is wasted work and wasted tiles. */}
            {tab === "map" && hasCoords ? (
              <RouteMap
                focus
                stops={[{ key: item.name, lat: item.lat as number, lng: item.lng as number, label: 1 }]}
              />
            ) : tab === "map" ? (
              <EmptyPanel>We don&apos;t have exact coordinates for this stop yet.</EmptyPanel>
            ) : null}
          </div>

          <div
            role="tabpanel"
            id="stop-panel-photos"
            aria-labelledby="stop-tab-photos"
            hidden={tab !== "photos"}
            className="h-[52vh] w-full overflow-y-auto sm:h-[26rem]"
          >
            {tab === "photos" ? <PhotoPanel item={item} destination={destination} /> : null}
          </div>
        </div>

        {/* Kept on purpose: a traveler standing on the street wants
            turn-by-turn in the app that has their GPS, not our modal. */}
        <div className="shrink-0 border-t border-border px-5 py-3 sm:px-6">
          <a
            href={links.googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-accent transition-colors hover:text-warm"
          >
            Get directions in Google Maps
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhotoPanel({ item, destination }: { item: ItineraryItem; destination: string }) {
  const { images, status, broadened } = useStopPhotos(item.name, destination);

  if (status === "loading") {
    return (
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse rounded-md bg-accent-soft/60" />
        ))}
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <EmptyPanel>
        {status === "failed"
          ? "Couldn't load photography just now."
          : "No photography for this stop yet."}
      </EmptyPanel>
    );
  }

  return (
    <div className="p-3">
      {broadened ? (
        // Say whose photos these are. A picture of the city standing in
        // silently for a specific restaurant is a small lie.
        <p className="mb-2 px-1 text-xs text-muted">
          No photos of {item.name} yet — showing {destination}.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((image) => (
          <TravelImage
            key={image.url}
            image={image}
            label={item.name}
            sizes="(max-width: 640px) 45vw, 18vw"
            showCredit
            className="aspect-[4/3] w-full rounded-md"
          />
        ))}
      </div>
    </div>
  );
}

function TabButton({
  id,
  active,
  icon: Icon,
  onClick,
  children,
}: {
  id: StopTab;
  active: boolean;
  icon: typeof MapIcon;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`stop-tab-${id}`}
      aria-selected={active}
      aria-controls={`stop-panel-${id}`}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 font-display text-sm font-semibold transition-colors ${
        active
          ? "bg-accent-soft text-accent"
          : "text-muted hover:bg-accent-soft/50 hover:text-accent"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-accent-soft/30 p-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}
