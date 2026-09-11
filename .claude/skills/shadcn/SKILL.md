---
name: shadcn
description: Use whenever a screen needs a new UI primitive (dialog, sheet, dropdown, tabs, toast, etc.) or when touching an existing one under components/ui/.
---

# shadcn/ui

`components/ui/button.tsx` and `components/ui/card.tsx` in this repo are
**hand-written placeholders**, built to unblock Sprint 1 before shadcn was
formally initialized. Treat them as scaffolding, not the standard.

## First time in this repo

Run this once, for real component generation going forward:

```bash
npx shadcn@latest init
```

Point it at `app/globals.css` for CSS variables (already has the
`--ink`/`--paper`/`--accent`/`--warm`/`--line`/`--muted` tokens defined —
map shadcn's expected variable names to these rather than letting it
overwrite the file with its own defaults) and `components/ui` as the
components directory (matches what already exists).

## Adding a component

```bash
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
```

This writes real, versioned component code into `components/ui/`. When
you need `button` or `card` again for real (rather than the placeholders),
run `npx shadcn@latest add button` and `add card` — let the CLI overwrite
the hand-written versions rather than hand-editing them further.

## Conventions already in place

- `lib/utils.ts` exports `cn()` (clsx + tailwind-merge) — every shadcn
  component expects this to exist at that exact path; don't rename it.
- `class-variance-authority` is already a dependency (used in
  `components/ui/button.tsx`) — shadcn components rely on the same
  pattern for variants.
- Don't hand-edit a generated component's internals beyond adding
  RoamAI-specific variants through `cva` — re-running `add` later will
  otherwise silently discard your changes. If you need custom behavior,
  wrap the shadcn component in a new file (e.g.
  `components/activity-card.tsx`) instead.
