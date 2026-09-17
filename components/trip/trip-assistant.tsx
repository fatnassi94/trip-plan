"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUp,
  BatteryLow,
  Check,
  Clock,
  CloudRain,
  Coffee,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { hasChanges, replaceDay, type DayChanges } from "@/lib/itinerary";
import type { Trip, TripDay } from "@/types/trip";

// 10 — AI Assistant, "Edit via ✨ Chat". The traveler asks for a change to
// the day they're looking at; app/api/trips/assistant answers with a
// validated revision of that one day and a diff. Nothing changes until
// they press Apply — for a saved trip that's PATCH /api/trips/[id], which
// re-validates the whole trip before writing; for a trip that only lives
// in this tab (demo mode) it's a local update.

const QUICK_PROMPTS = [
  { icon: CloudRain, label: "It's raining", message: "It's raining — swap outdoor stops for covered or indoor ones." },
  { icon: BatteryLow, label: "Lighten this day", message: "I'm tired. Lighten this day: fewer stops and a slower pace." },
  { icon: Users, label: "Less crowded", message: "Make this day less crowded — avoid the busiest tourist spots." },
  { icon: Coffee, label: "Add a coffee break", message: "Add a relaxed coffee break that fits between the existing stops." },
];

interface Proposal {
  day: TripDay;
  changes: DayChanges;
}

type AssistantReply = {
  id: number;
  role: "assistant";
  text: string;
  dayNumber: number;
  request: string;
  proposal: Proposal | null;
  status: "open" | "applying" | "applied" | "outdated";
  error?: string;
};

type Message =
  | { id: number; role: "user"; text: string }
  | AssistantReply
  | { id: number; role: "error"; text: string; dayNumber: number; request: string; anotherOption: boolean };

export function TripAssistant({
  tripId,
  trip,
  dayNumber,
  onApplied,
  className = "",
}: {
  /** "local" for a trip that only lives in this tab. */
  tripId: string;
  trip: Trip;
  dayNumber: number;
  onApplied: (trip: Trip) => void;
  className?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const baseId = useId();
  const day = trip.days.find((d) => d.day === dayNumber);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  function add(message: Message) {
    setMessages((prev) => [...prev, message]);
  }

  async function ask(request: string, targetDay: number, anotherOption = false) {
    const text = request.trim();
    if (pending || !text) return;

    setPending(true);
    add({ id: nextId.current++, role: "user", text: anotherOption ? "Show me another option." : text });
    if (!anotherOption) setDraft("");

    try {
      const res = await fetch("/api/trips/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(tripId === "local" ? { trip } : { tripId }),
          day: targetDay,
          message: text,
          anotherOption,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.day) {
        throw new Error(payload?.error ?? "The assistant couldn't answer. Try again.");
      }

      const changes = payload.changes as DayChanges;
      add({
        id: nextId.current++,
        role: "assistant",
        text: payload.reply as string,
        dayNumber: targetDay,
        request: text,
        proposal: hasChanges(changes) ? { day: payload.day as TripDay, changes } : null,
        status: "open",
      });
    } catch (err) {
      add({
        id: nextId.current++,
        role: "error",
        text: err instanceof Error ? err.message : "Something went wrong.",
        dayNumber: targetDay,
        request: text,
        anotherOption,
      });
    } finally {
      setPending(false);
    }
  }

  function updateReply(id: number, patch: Partial<AssistantReply>) {
    setMessages((prev) => prev.map((m) => (m.id === id && m.role === "assistant" ? { ...m, ...patch } : m)));
  }

  async function apply(reply: AssistantReply) {
    if (!reply.proposal || reply.status !== "open") return;
    updateReply(reply.id, { status: "applying", error: undefined });

    try {
      let nextTrip: Trip;
      if (tripId === "local") {
        nextTrip = replaceDay(trip, reply.proposal.day);
      } else {
        const res = await fetch(`/api/trips/${tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day: reply.proposal.day }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.trip) throw new Error(payload?.error ?? "Couldn't save these changes.");
        nextTrip = payload.trip as Trip;
      }

      onApplied(nextTrip);
      // Any other open proposal for this day was made against the old
      // version of it — applying one would silently undo this change.
      setMessages((prev) =>
        prev.map((m) => {
          if (m.role !== "assistant") return m;
          if (m.id === reply.id) return { ...m, status: "applied" };
          if (m.dayNumber === reply.dayNumber && m.status === "open") return { ...m, status: "outdated" };
          return m;
        }),
      );
    } catch (err) {
      updateReply(reply.id, {
        status: "open",
        error: err instanceof Error ? err.message : "Couldn't save these changes.",
      });
    }
  }

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface shadow-lift ${className}`}
    >
      <span aria-hidden="true" className="h-1 w-full shrink-0 bg-gradient-to-r from-accent via-warm to-sunset" />

      <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-deep text-sunset shadow-card">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={`${baseId}-title`} className="font-display text-base font-bold text-accent">
              RoamAI Assistant
            </h2>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" aria-hidden="true" />
              Editing Day {dayNumber}
              {day ? ` · ${day.title}` : ""}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-accent">
          {pending ? "Thinking" : "Ready"}
        </span>
      </header>

      <div role="group" aria-label="Quick requests" className="flex shrink-0 flex-wrap gap-1.5 px-5 pb-3">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            disabled={pending}
            onClick={() => {
              setDraft(prompt.message);
              inputRef.current?.focus();
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft/60 px-3 py-1.5 font-display text-xs font-semibold text-ink transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <prompt.icon className="h-3.5 w-3.5 text-warm" aria-hidden="true" />
            {prompt.label}
          </button>
        ))}
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with RoamAI"
        className="max-h-[380px] min-h-[150px] flex-1 space-y-3 overflow-y-auto border-t border-border bg-accent-soft/20 px-5 py-4 lg:max-h-none"
      >
        {messages.length === 0 ? (
          <AssistantBubble>
            <p className="text-sm text-ink">
              Ask me to change Day {dayNumber} — plan around rain, slow the pace, dodge crowds. I&apos;ll show
              you exactly what changes before anything is saved.
            </p>
          </AssistantBubble>
        ) : null}

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="roam-rise flex justify-end">
                <p className="max-w-[85%] rounded-lg rounded-tr-sm bg-accent px-3.5 py-2.5 text-sm text-paper shadow-card">
                  {message.text}
                </p>
              </div>
            );
          }

          if (message.role === "error") {
            return (
              <AssistantBubble key={message.id} tone="warm">
                <p className="text-sm text-warm">{message.text}</p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => ask(message.request, message.dayNumber, message.anotherOption)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 font-display text-xs font-semibold text-accent shadow-card hover:bg-accent-soft disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Try again
                </button>
              </AssistantBubble>
            );
          }

          return (
            <AssistantBubble key={message.id}>
              <p className="text-sm text-ink">{message.text}</p>
              {message.proposal ? (
                <>
                  <ChangeList changes={message.proposal.changes} />
                  {message.error ? (
                    <p role="alert" className="mt-2 text-xs text-warm">
                      {message.error}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {message.status === "applied" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-deep px-3 py-1.5 font-display text-xs font-semibold text-sage">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        Applied to Day {message.dayNumber}
                      </span>
                    ) : message.status === "outdated" ? (
                      <span className="text-xs text-muted">
                        Outdated — Day {message.dayNumber} has changed since this suggestion.
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => apply(message)}
                          disabled={message.status === "applying" || pending}
                          className="inline-flex items-center gap-1.5 rounded bg-sunset px-3.5 py-2 font-display text-xs font-semibold text-deep shadow-card transition-transform hover:bg-warm hover:text-paper active:scale-[0.98] disabled:opacity-60"
                        >
                          {message.status === "applying" ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              Applying…
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                              Apply to Day {message.dayNumber}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => ask(message.request, message.dayNumber, true)}
                          disabled={message.status === "applying" || pending}
                          className="inline-flex items-center gap-1.5 rounded bg-accent-soft px-3 py-2 font-display text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-paper disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Another option
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </AssistantBubble>
          );
        })}

        {pending ? (
          <AssistantBubble>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-sunset" aria-hidden="true" />
              Rethinking Day {dayNumber}…
            </p>
          </AssistantBubble>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft, dayNumber);
        }}
        className="shrink-0 border-t border-border p-3"
      >
        <label htmlFor={`${baseId}-input`} className="sr-only">
          Ask RoamAI to change Day {dayNumber}
        </label>
        <div className="flex items-end gap-2 rounded-md bg-accent-soft/50 p-1.5 focus-within:ring-4 focus-within:ring-accent/10">
          <textarea
            id={`${baseId}-input`}
            ref={inputRef}
            rows={2}
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(draft, dayNumber);
              }
            }}
            placeholder={`Ask for a change to Day ${dayNumber}…`}
            className="max-h-28 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted/70"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={pending || !draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent text-paper transition-colors hover:bg-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[0.7rem] text-muted">Nothing changes until you apply it.</p>
      </form>
    </section>
  );
}

function AssistantBubble({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warm";
}) {
  return (
    <div className="roam-rise flex items-start gap-2.5">
      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-deep text-sunset">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
      </span>
      <div
        className={`min-w-0 flex-1 rounded-lg rounded-tl-sm p-3.5 shadow-card ${
          tone === "warm" ? "bg-warm-soft" : "bg-surface"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ChangeList({ changes }: { changes: DayChanges }) {
  return (
    <ul aria-label="Proposed changes" className="mt-2.5 space-y-1.5 rounded bg-accent-soft/40 p-2.5 text-xs">
      {changes.added.map((name) => (
        <li key={`added-${name}`} className="flex items-start gap-1.5 text-ink">
          <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={3} aria-hidden="true" />
          <span>Add {name}</span>
        </li>
      ))}
      {changes.removed.map((name) => (
        <li key={`removed-${name}`} className="flex items-start gap-1.5 text-muted">
          <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" strokeWidth={3} aria-hidden="true" />
          <span>Remove {name}</span>
        </li>
      ))}
      {changes.retimed.map((change) => (
        <li key={`retimed-${change.name}`} className="flex items-start gap-1.5 text-ink">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            {change.name}: {change.from} → {change.to}
          </span>
        </li>
      ))}
    </ul>
  );
}
