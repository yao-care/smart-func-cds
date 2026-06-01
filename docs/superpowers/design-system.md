# Smart Func — Design System

> **Spec:** `docs/superpowers/specs/2026-05-16-design-system-spec.md` (full reference)

## Quick reference for component authors

### 7 color tokens

```css
var(--bg)        /* page background — warm ivory */
var(--surface)   /* card / modal / sticky header */
var(--text)      /* primary type — warm dark brown */
var(--line)      /* decorative divider only (1.8:1 vs bg) */
var(--accent)    /* brand CTA + normal status — eucalyptus green */
var(--warn)      /* advisory + warning — amber-brown */
var(--danger)    /* critical / error — warm red */
```

### Derived via color-mix (do not create new tokens)

| Need | Use |
|---|---|
| Hover (CTA) | `color-mix(in srgb, var(--accent) 85%, black)` |
| Hover (row) | `color-mix(in srgb, var(--accent) 4%, var(--bg))` |
| Selected row | `color-mix(in srgb, var(--accent) 10%, var(--bg))` |
| Chip / accent badge bg | `color-mix(in srgb, var(--accent) 12%, var(--bg))` |
| Warn badge bg | `color-mix(in srgb, var(--warn) 12%, var(--bg))` |
| Danger badge bg | `color-mix(in srgb, var(--danger) 14%, var(--bg))` |
| Card / Input border | `color-mix(in srgb, var(--line), var(--text) 33%)` |
| Text muted | `color-mix(in srgb, var(--text), var(--bg) 30%)` |
| Focus ring (global) | `color-mix(in srgb, var(--accent) 65%, transparent)` |
| Inverse text (on accent fill) | `white` |

### Three rules

1. **Semantic-named.** Component asks "I need brand color", not "I need green".
2. **Single-context.** `--warn` only in alert / badge / form-error contexts.
3. **Borrow equals misuse.** Find no fit? Extend the pattern library — never borrow.

### 19 component patterns

See spec section "Component CSS Pattern Library" for full code. Quick index:

| # | Pattern | Use for |
|---|---|---|
| 1 | Button (primary / secondary / ghost / danger) | Actions |
| 2 | Card / Surface | Container with elevation |
| 3 | Input / Form field | Text inputs |
| 4 | Selected / Active (state class) | Chosen item in list |
| 5 | Hover surface (non-CTA) | Row hover |
| 6 | Status badge (normal / warn / danger) | Inline status |
| 7 | Text variants (muted / subtle / inverse) | Type hierarchy |
| 8 | Disabled | Disabled controls |
| 9 | Modal backdrop | Modal overlay |
| 10 | Alert / inline notice | Page-level notice |
| 11 | Tab (active = underline) | Page section nav |
| 12 | Focus ring (global) | `:focus-visible` |
| 13 | Toast notification | Floating feedback |
| 14 | Tooltip / popover | Hover hint |
| 15 | Progress bar | Determinate progress |
| 16 | Table (header / stripe / hover) | Data tables |
| 17 | Link | Inline navigation |
| 18 | Native form accent | Checkbox / radio / range |
| 19 | Stepper | Multi-step wizard |

### PR checklist (5 rules)

1. **No hardcoded color anywhere.** All `var(--bg|surface|text|line|accent|warn|danger)` or `color-mix(...)`.
2. **`--warn` / `--danger` only in alert / badge / validation contexts.** Selected/hover/focus → `color-mix(var(--accent), ...)`.
3. **No new top-level color or typography tokens.** Extend pattern library if needed.
4. **Disabled uses Pattern #8 only.** No `opacity:`.
5. **Tabs use Pattern #11 underline; selected/current uses Pattern #4 fill.** Don't mix.

Rules 1, 2, 3, 4 (font-weight), 5 (tabs vs selected) — partially CI-enforced via `tests/design-system.test.ts`. Reviewer-enforced for the rest.

### Adding a new pattern

When no pattern fits:
1. Open a spec amendment (`docs/superpowers/specs/2026-05-16-design-system-spec.md`)
2. Add the pattern under "Component CSS Pattern Library" with use case + rationale
3. If new color-mix percentages, add row to rationale table
4. Implement components against the new pattern

Do **not** invent inline — that's how the 9 audit findings happened.
