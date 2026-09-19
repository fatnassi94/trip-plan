"use client";

import { useEffect, useRef, useState } from "react";
import { useTypewriter } from "./use-typewriter";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Coffee,
  Compass,
  Landmark,
  Music,
  Pencil,
  ShoppingBag,
  Sparkles,
  Trees,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  BUDGET_TIERS,
  CROWDS,
  DISCOVERY_CHOICES,
  FOOD_PREFERENCES,
  LOCALNESS_CHOICES,
  PACES,
  QUESTIONS,
  TRAVELER_TYPES,
  WALKING,
  answerSummary,
  type Choice,
  type Question,
} from "@/lib/dna-questions";
import { AVOID_OPTIONS } from "@/lib/travel-dna";
import type {
  BudgetTier,
  CrowdTolerance,
  HardConstraints,
  Pace,
  TravelerProfile,
  WalkingTolerance,
} from "@/types/trip";

// The Travel DNA interview, one question at a time.
//
// The old screen put all seven sections on one page. Everything was
// answerable, which is exactly what made it feel like paperwork: a wall of
// controls you have to read before you can start. Here RoamAI asks, you
// tap, and the next question arrives — the answers you've given stay above
// as a transcript you can go back and change.
//
// The detail that makes it feel like a conversation rather than a wizard
// is the auto-advance on single-answer questions: tap once and the next
// question comes, with a short beat so you see your choice land. Questions
// that take several answers wait for "Next", because advancing on the
// first tap would be taking the answer out of your mouth.

const PERSONA_ICONS: Record<string, LucideIcon> = {
  Explorer: Compass,
  Foodie: UtensilsCrossed,
  "Culture lover": Landmark,
  Nature: Trees,
  Relaxed: Coffee,
  Photographer: Camera,
  Shopper: ShoppingBag,
  Nightlife: Music,
};

/** Long enough to see the choice register, short enough to feel instant. */
const ADVANCE_MS = 320;

export interface DnaChatProps {
  profile: TravelerProfile;
  /** Patch one field; the page owns the profile so a restore can replace it. */
  onChange: (patch: Partial<TravelerProfile>) => void;
  /** Rendered under the final question — the DNA card, save toggle, CTA. */
  finale: React.ReactNode;
  /** Jump straight to the end, e.g. when a saved Travel DNA was restored. */
  startAtEnd?: boolean;
}

export function DnaChat({ profile, onChange, finale, startAtEnd = false }: DnaChatProps) {
  // QUESTIONS.length means "past the last question" — the finale.
  const [step, setStep] = useState(startAtEnd ? QUESTIONS.length : 0);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const reducedMotion = usePrefersReducedMotion();

  const active = reviewing ?? step;
  const question = QUESTIONS[active] as Question | undefined;

  // A saved profile arriving after mount should move the traveler to the
  // end, but never yank them out of a question they already started.
  useEffect(() => {
    if (startAtEnd) setStep(QUESTIONS.length);
  }, [startAtEnd]);

  // Move focus to the new question so a screen reader and a keyboard both
  // land where the eye does. Not on first paint — that would steal focus
  // from the page heading before anyone has interacted.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [active]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  function go(next: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (reviewing !== null) {
      // Editing an earlier answer returns you to where you were, rather
      // than making you walk the rest of the interview again.
      setReviewing(null);
      return;
    }
    setStep(next);
  }

  function answerSingle(patch: Partial<TravelerProfile>) {
    onChange(patch);
    const target = active + 1;
    if (reducedMotion) {
      go(target);
      return;
    }
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => go(target), ADVANCE_MS);
  }

  const answered = QUESTIONS.slice(0, step);
  const still = !reducedMotion && reviewing === null;
  const { typed, phase, skip, done } = useTypewriter(question?.prompt ?? "", { enabled: still });

  // Follow the conversation down as it grows, the way a messaging app
  // does. Guarded: jsdom has no scrollIntoView, and a smooth scroll on a
  // page someone is reading is worse than none.
  useEffect(() => {
    if (reducedMotion || reviewing !== null) return;
    try {
      endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    } catch {
      /* not implemented in the test environment */
    }
  }, [active, done, reducedMotion, reviewing]);

  return (
    <div
      className="flex flex-col gap-4"
      // A tap anywhere cuts the typing short for anyone who reads faster
      // than RoamAI types.
      onClickCapture={() => {
        if (phase !== "done") skip();
      }}
    >
      {/* ── What has been said so far ──────────────────────────────── */}
      {answered.map((q, index) => (
        <div key={q.id} className="flex flex-col gap-2">
          <BotBubble>{q.prompt}</BotBubble>
          <UserBubble
            answer={answerSummary(q, profile)}
            prompt={q.prompt}
            editing={reviewing === index}
            onEdit={() => setReviewing(index)}
          />
        </div>
      ))}

      {/* ── The question on the table ──────────────────────────────── */}
      {question ? (
        <div data-dna-card={question.id} className="flex flex-col gap-2">
          <BotBubble
            meta={
              <>
                RoamAI
                <span className="roam-pulse h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
                <span className="ml-auto tabular-nums text-muted">
                  {active + 1} of {QUESTIONS.length}
                </span>
              </>
            }
          >
            {phase === "pausing" ? (
              <TypingDots />
            ) : (
              <p
                id={`dna-q-${question.id}`}
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-lg font-bold tracking-tight text-accent outline-none sm:text-xl"
              >
                {/* The animated copy is decorative; the real sentence is
                    always present in full for a screen reader. */}
                <span aria-hidden="true">{typed}</span>
                {!done ? (
                  <span
                    aria-hidden="true"
                    className="roam-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-accent"
                  />
                ) : null}
                <span className="sr-only">{question.prompt}</span>
              </p>
            )}
            {done && question.aside ? (
              <p className="roam-rise mt-1.5 text-sm leading-relaxed text-muted">{question.aside}</p>
            ) : null}
          </BotBubble>

          {/* The answer area is the chat's composer: it arrives once the
              question has finished being asked. */}
          {done ? (
            <div className="roam-rise ml-11 rounded-2xl rounded-tr-sm bg-surface p-4 shadow-card">
              <QuestionBody
                question={question}
                profile={profile}
                onChange={onChange}
                onAnswerSingle={answerSingle}
              />
              <Controls
                question={question}
                profile={profile}
                index={active}
                reviewing={reviewing !== null}
                onBack={() =>
                  reviewing !== null ? setReviewing(null) : setStep(Math.max(0, active - 1))
                }
                onNext={() => go(active + 1)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        finale
      )}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}

/** RoamAI's side of the conversation: avatar, then a bubble on the left. */
function BotBubble({ children, meta }: { children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-deep text-sunset shadow-card">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 max-w-[92%] rounded-2xl rounded-tl-sm bg-surface px-4 py-3 shadow-card">
        {meta ? (
          <p className="mb-1 flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm">
            {meta}
          </p>
        ) : null}
        {typeof children === "string" ? (
          <p className="text-sm leading-relaxed text-ink">{children}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** The traveler's side: a bubble on the right you can tap to change. */
function UserBubble({
  answer,
  prompt,
  editing,
  onEdit,
}: {
  answer: string;
  prompt: string;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Change your answer to “${prompt}”`}
        className={`group inline-flex max-w-[85%] items-center gap-2 rounded-2xl rounded-br-sm px-4 py-2.5 text-left font-display text-sm font-semibold shadow-card transition-colors ${
          editing ? "bg-warm text-paper" : "bg-accent text-paper hover:bg-deep"
        }`}
      >
        <span className="truncate">{answer}</span>
        <Pencil
          className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="RoamAI is typing" role="status">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="roam-typing-dot h-1.5 w-1.5 rounded-full bg-accent"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

function QuestionBody({
  question,
  profile,
  onChange,
  onAnswerSingle,
}: {
  question: Question;
  profile: TravelerProfile;
  onChange: (patch: Partial<TravelerProfile>) => void;
  onAnswerSingle: (patch: Partial<TravelerProfile>) => void;
}) {
  switch (question.id) {
    case "personas":
      return (
        <ChoiceGrid
          label="Traveler types"
          choices={TRAVELER_TYPES}
          selected={profile.travelerTypes}
          multi
          icons={PERSONA_ICONS}
          onToggle={(value) =>
            onChange({
              travelerTypes: profile.travelerTypes.includes(value)
                ? profile.travelerTypes.filter((v) => v !== value)
                : [...profile.travelerTypes, value],
            })
          }
        />
      );
    case "budget":
      return (
        <ChoiceGrid
          label="Budget"
          choices={BUDGET_TIERS}
          selected={[profile.budgetTier]}
          onToggle={(value) => onAnswerSingle({ budgetTier: value as BudgetTier })}
        />
      );
    case "pace":
      return (
        <ChoiceGrid
          label="Daily pace"
          choices={PACES}
          selected={[profile.pace]}
          onToggle={(value) => onAnswerSingle({ pace: value as Pace })}
        />
      );
    case "walking":
      return (
        <ChoiceGrid
          label="Walking"
          choices={WALKING}
          selected={[profile.walkingTolerance]}
          onToggle={(value) => onAnswerSingle({ walkingTolerance: value as WalkingTolerance })}
        />
      );
    case "crowds":
      return (
        <ChoiceGrid
          label="Crowds"
          choices={CROWDS}
          selected={[profile.crowdTolerance ?? "medium"]}
          onToggle={(value) => onAnswerSingle({ crowdTolerance: value as CrowdTolerance })}
        />
      );
    case "localness":
      return (
        <ChoiceGrid
          label="Tourist or local"
          choices={LOCALNESS_CHOICES}
          selected={[String(profile.localness ?? 3)]}
          onToggle={(value) => onAnswerSingle({ localness: Number(value) })}
        />
      );
    case "discovery":
      return (
        <ChoiceGrid
          label="Famous or hidden"
          choices={DISCOVERY_CHOICES}
          selected={[String(profile.discovery ?? 3)]}
          onToggle={(value) => onAnswerSingle({ discovery: Number(value) })}
        />
      );
    case "food":
      return (
        <ChoiceGrid
          label="Food preferences"
          choices={FOOD_PREFERENCES}
          selected={profile.foodPreferences.map(
            (f) => FOOD_PREFERENCES.find((c) => c.value.toLowerCase() === f)?.value ?? f,
          )}
          multi
          onToggle={(value) => {
            const current = profile.foodPreferences;
            const key = value.toLowerCase();
            onChange({
              foodPreferences: current.includes(key)
                ? current.filter((v) => v !== key)
                : [...current, key],
            });
          }}
        />
      );
    case "dislikes":
      return (
        <input
          value={profile.dislikes.join(", ")}
          onChange={(e) =>
            onChange({
              dislikes: e.target.value
                .split(",")
                .map((d) => d.trim())
                .filter(Boolean),
            })
          }
          aria-label="Things you'd rather skip, separated by commas"
          placeholder={"placeholder" in question ? question.placeholder : ""}
          maxLength={300}
          className="w-full rounded border border-border bg-paper px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
      );
    case "rules":
      return <RulesPanel profile={profile} onChange={onChange} />;
  }
}

function Controls({
  question,
  profile,
  index,
  reviewing,
  onBack,
  onNext,
}: {
  question: Question;
  profile: TravelerProfile;
  index: number;
  reviewing: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  // Single-answer questions advance themselves, so they need no Next —
  // only a way back.
  const needsNext = question.kind !== "single";
  const enough =
    question.kind !== "multi" ||
    question.minimum === 0 ||
    (question.id === "personas" && profile.travelerTypes.length >= question.minimum);
  const nextLabel = question.optional && !dirty(question, profile) ? "Skip" : "Next";

  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={index === 0 && !reviewing}
        className="inline-flex items-center gap-1.5 rounded px-3 py-2 font-display text-sm font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:invisible"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      {needsNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!enough}
          className="inline-flex items-center gap-2 rounded bg-accent px-5 py-2.5 font-display text-sm font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reviewing ? "Done" : nextLabel}
          <ArrowRight className="h-4 w-4 text-sunset" aria-hidden="true" />
        </button>
      ) : reviewing ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded bg-accent px-5 py-2.5 font-display text-sm font-semibold text-paper shadow-card"
        >
          Done
        </button>
      ) : (
        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-muted">
          Pick one to continue
        </span>
      )}
    </div>
  );
}

/** Has this optional question actually been answered? Decides Skip vs Next. */
function dirty(question: Question, profile: TravelerProfile): boolean {
  if (question.id === "food") return profile.foodPreferences.length > 0;
  if (question.id === "dislikes") return profile.dislikes.length > 0;
  if (question.id === "rules") {
    const c = profile.constraints ?? {};
    return Object.values(c).some((v) => v !== undefined && (!Array.isArray(v) || v.length > 0));
  }
  return true;
}

function AnsweredTurn({
  question,
  answer,
  onEdit,
  editing,
}: {
  question: Question;
  answer: string;
  onEdit: () => void;
  editing: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">{question.prompt}</p>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Change your answer to “${question.prompt}”`}
        className={`group inline-flex max-w-full items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-left font-display text-sm font-semibold transition-colors sm:self-auto ${
          editing ? "bg-warm text-paper" : "bg-accent text-paper hover:bg-deep"
        }`}
      >
        <span className="truncate">{answer}</span>
        <Pencil
          className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function ChoiceGrid({
  label,
  choices,
  selected,
  multi = false,
  icons,
  onToggle,
}: {
  label: string;
  choices: readonly Choice[];
  selected: string[];
  multi?: boolean;
  icons?: Record<string, LucideIcon>;
  onToggle: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-2 sm:grid-cols-2">
      {choices.map((choice) => {
        const on = selected.includes(choice.value);
        const Icon = icons?.[choice.value];
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(choice.value)}
            className={`flex items-start gap-3 rounded-md border p-3 text-left transition-all duration-200 active:scale-[0.99] ${
              on
                ? "border-accent bg-accent-soft shadow-card"
                : "border-border bg-paper hover:border-accent/40 hover:bg-accent-soft/40"
            }`}
          >
            {Icon ? (
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-accent" : "text-muted"}`}
                aria-hidden="true"
              />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-semibold text-accent">
                {choice.label}
              </span>
              {choice.hint ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{choice.hint}</span>
              ) : null}
            </span>
            {on ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            ) : multi ? (
              <span
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-border"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

const NO_LIMIT = { value: "", label: "No limit" };
const START_OPTIONS = [NO_LIMIT, ...["07:00", "08:00", "09:00", "10:00", "11:00"].map((t) => ({ value: t, label: `Not before ${t}` }))];
const END_OPTIONS = [NO_LIMIT, ...["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"].map((t) => ({ value: t, label: `Done by ${t}` }))];
const WALK_OPTIONS = [NO_LIMIT, ...[3, 5, 8, 12].map((km) => ({ value: String(km), label: `Up to ${km} km` }))];
const STOP_OPTIONS = [NO_LIMIT, ...[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Up to ${n} stops` }))];
const DURATION_OPTIONS = [
  NO_LIMIT,
  { value: "60", label: "Up to 1h" },
  { value: "90", label: "Up to 1h 30m" },
  { value: "120", label: "Up to 2h" },
  { value: "180", label: "Up to 3h" },
];

function RulesPanel({
  profile,
  onChange,
}: {
  profile: TravelerProfile;
  onChange: (patch: Partial<TravelerProfile>) => void;
}) {
  const constraints = profile.constraints ?? {};

  const setRule = <K extends keyof HardConstraints>(key: K, value: HardConstraints[K]) =>
    onChange({ constraints: { ...constraints, [key]: value } });

  const toggleAvoid = (tag: string) => {
    const current = constraints.avoidTags ?? [];
    onChange({
      constraints: {
        ...constraints,
        avoidTags: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      },
    });
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RuleSelect
          label="Earliest start"
          value={constraints.earliestStart ?? ""}
          options={START_OPTIONS}
          onChange={(v) => setRule("earliestStart", v || undefined)}
        />
        <RuleSelect
          label="Latest finish"
          value={constraints.latestEnd ?? ""}
          options={END_OPTIONS}
          onChange={(v) => setRule("latestEnd", v || undefined)}
        />
        <RuleSelect
          label="Max walking per day"
          value={constraints.maxWalkingKmPerDay ? String(constraints.maxWalkingKmPerDay) : ""}
          options={WALK_OPTIONS}
          onChange={(v) => setRule("maxWalkingKmPerDay", v ? Number(v) : undefined)}
        />
        <RuleSelect
          label="Max stops per day"
          value={constraints.maxStopsPerDay ? String(constraints.maxStopsPerDay) : ""}
          options={STOP_OPTIONS}
          onChange={(v) => setRule("maxStopsPerDay", v ? Number(v) : undefined)}
        />
        <RuleSelect
          label="Longest single stop"
          value={constraints.maxActivityMinutes ? String(constraints.maxActivityMinutes) : ""}
          options={DURATION_OPTIONS}
          onChange={(v) => setRule("maxActivityMinutes", v ? Number(v) : undefined)}
        />
      </div>
      <div role="group" aria-label="Never include" className="mt-4">
        <p className="font-display text-sm font-semibold text-ink">Never include</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVOID_OPTIONS.map((option) => {
            const on = constraints.avoidTags?.includes(option.tag) ?? false;
            return (
              <button
                key={option.tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleAvoid(option.tag)}
                className={`rounded-full px-3.5 py-1.5 font-display text-sm font-semibold transition-colors ${
                  on ? "bg-accent text-paper" : "bg-accent-soft/60 text-accent hover:bg-accent-soft"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RuleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-border bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Read once on mount rather than during render: the typing effect, the
 * auto-advance beat and the auto-scroll all key off it, and they must all
 * agree for a whole question.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}
