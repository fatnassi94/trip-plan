---
name: web-design-guidelines
description: Use when touching layout, spacing, typography, responsiveness, or accessibility on any page — the baseline every screen must meet regardless of which feature it belongs to.
---

# Web Design Guidelines

The house rules for craft, independent of any one screen's content.

## Spacing & layout

- 8px base unit for spacing (padding, gaps, margins) — Tailwind's default
  scale already aligns to this (`p-2` = 8px, `p-4` = 16px, etc.), so stick
  to the scale rather than arbitrary values (`p-[13px]`).
- Lay out sibling elements with flex/grid `gap`, not individual margins —
  margins on adjacent elements silently collapse or double.
- Design mobile-first. Every golden-path screen (`/`, `/create-trip`,
  `/profile`, `/trip/[id]`, day detail) must work at a 375px viewport
  before it's called done — this is meant to become a PWA (project plan
  §39), and most travel usage is on a phone.

## Typography

- Headings use `font-display` (Fraunces); body text uses `font-sans`
  (Sora); labels, timestamps, and data use `font-mono` (IBM Plex Mono).
  Don't mix a fourth family in.
- Keep body copy readable: max-width around 65 characters
  (`max-w-xl`/`max-w-2xl` on paragraph containers), and add
  `text-balance` (`text-wrap: balance` via the `text-balance` utility) to
  multi-line headings.

## States every screen needs

Loading, empty, error, and success states are not optional extras — a
page isn't done until all four exist. Trip generation specifically needs
its own in-progress state (the "AI Thinking" trace) distinct from a
generic spinner.

## Accessibility

- Every interactive element needs a visible focus state (buttons already
  get one from `components/ui/button.tsx`'s `focus-visible:outline`
  classes — don't strip it).
- Form inputs need associated `<label>` text (see `/create-trip` and
  `/profile` for the pattern: wrap input in `<label>` with visible text,
  not just a placeholder).
- Color is never the only signal — a "why this" tag or status needs text,
  not just a colored dot.
- Respect `prefers-reduced-motion` for any animation added beyond what's
  here now.

## Before shipping

Run `npm run lint` and `npm run typecheck`. Check the page at a phone,
tablet, and desktop width. If a chart or map is involved, colors must
still read correctly in both light and dark — RoamAI supports both via
the `prefers-color-scheme` block in `app/globals.css`.
