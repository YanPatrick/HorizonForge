# Hero Card Interaction System — Design Spec
**Date:** 2026-04-20  
**Scope:** Upgrade of `#view-formation` in `public/lobby.html`  
**Approach:** A — Right-Side Drawer (desktop) + Bottom Sheet (mobile)

---

## 1. Context

The formation view (`#view-formation`) is the screen where users build decks and select heroes before a battle. It already has:
- `fv-hero-frame` (top ~58%): search bar + filter buttons + hero card grid (`#form-hero-grid`)
- `fv-decks-area` (bottom ~42%): deck slot cards + `fv-slide-panel` (the deck editing panel that slides up)
- Existing hero card: `.form-hero-card` with emoji icon + name + role

The goal is to add hero detail access without disrupting the existing deck-building flow.

---

## 2. Card Design

**Visual (replaces current `.form-hero-card`):**
- Emoji icon, centered (~28px)
- Hero name below (11px, `font-weight: 600`)
- **No role badge on the card** — role lives exclusively in the detail panel
- 3-column grid (unchanged)

**States:**

| State | Visual | Interactions |
|---|---|---|
| Default | Subtle dark border | Hover glow + scale; click/tap → detail |
| Hovered | Border glow + `translateY(-2px)` + `scale(1.03)` | — |
| Selected (`fhc-selected`) | Green border + `✓` top-right | — |
| Addable (`fhc-addable`) | Purple border + `+` top-right | Click → add to deck |
| Disabled (`fhc-disabled`) | 35% opacity | `pointer-events: none` |

**Info button (`i`):**
- 16×16px circle, top-right corner of card
- Only visible in Normal state (hidden during deck editing)
- Desktop: same action as clicking the card (opens drawer)
- Mobile: primary trigger for the bottom sheet

---

## 3. State Machine

Two mutually exclusive states for the hero grid:

### Normal State (`.fv-slide-panel` closed)
- Hero cards: full hover + click interactions active
- Click / tap on card → opens detail panel (drawer on desktop, bottom sheet on mobile)
- Info button `i` visible on each card

### Deck Editing State (`.fv-slide-panel` open)
- Grid receives class `.fhc-editing-mode`
- Hero cards: `pointer-events: none` on the card body; `i` button hidden
- Cards show only `+` (addable) or `✓` (already in deck)
- No hover animations, no detail panel opens

**State transitions:**
- Deck slot clicked → slide panel opens → grid enters Deck Editing state
- Slide panel closed → grid returns to Normal state

---

## 4. Detail Panel Content

### Level 1 — Quick Info (always visible on open)

```
[hero emoji]  [Hero Name]              [✕]
──────────────────────────────────────────
[ROLE BADGE]

✦ Skill Name
  Short description (1–2 lines)

── Stats ───────────────────────────
❤️  HP   1200      ⚡ SPD  18
⚔️  ATK   85       💥 CRIT 12%

[ Ver stats completos ▾ ]
```

- Role badge uses existing `.role-tank` / `.role-dps` / `.role-support` classes
- Stats: HP, ATK, SPD, CRIT% at current/base level
- Data sourced from `simulate.js` hero definitions

### Level 2 — Full Stats (hidden by default)

Triggered by "Ver stats completos" button — expands inline via `max-height` transition (250ms ease).

```
Nível   HP      ATK    SPD    CRIT
─────────────────────────────────
  1     800      60     14     8%
  5    1200      85     18    12%
 10    1800     120     22    16%
 20    2800     185     28    22%

[ Recolher ▴ ]
```

- Full level progression table
- "Recolher" button collapses back to Level 1

---

## 5. Desktop Drawer

**Positioning:**
- `position: fixed; right: 0; top: 0; bottom: 0`
- Width: `340px`
- Z-index above formation content, below any existing overlays
- Does NOT shift the layout (formation grid remains at full width behind it)

**Backdrop:**
- Semi-transparent overlay behind drawer: `rgba(0, 0, 0, 0.4)`
- Click on backdrop → closes drawer

**Animation:**
- Open: `translateX(100%) → translateX(0)`, 250ms `cubic-bezier(0.34, 1.06, 0.64, 1)`
- Close: `translateX(0) → translateX(100%)`, 200ms ease-in

**Close triggers:**
- `[✕]` button inside panel
- Click outside (backdrop)
- `Escape` key

---

## 6. Mobile Bottom Sheet

**Positioning:**
- `position: fixed; bottom: 0; left: 0; right: 0`
- Height: `~65vh`
- Respects `safe-area-inset-bottom`
- Leaves hero grid partially visible behind (no full-screen takeover)

**Drag handle:**
- Visual indicator bar at top of sheet (decorative, not interactive drag)

**Animation:**
- Open: `translateY(100%) → translateY(0)`, 280ms ease
- Close: `translateY(0) → translateY(100%)`, 220ms ease-in

**Close triggers:**
- `[✕]` button
- Tap on visible area behind the sheet (backdrop)

---

## 7. Animations Summary

| Element | Property | Duration | Easing |
|---|---|---|---|
| Card hover | `transform: translateY(-2px) scale(1.03)` + border glow | 150ms | ease |
| Drawer open | `translateX(100%) → 0` | 250ms | `cubic-bezier(0.34, 1.06, 0.64, 1)` |
| Drawer close | `translateX(0) → 100%` | 200ms | ease-in |
| Bottom sheet open | `translateY(100%) → 0` | 280ms | ease |
| Bottom sheet close | `translateY(0) → 100%` | 220ms | ease-in |
| Stats expand | `max-height` | 250ms | ease |

---

## 8. Implementation Scope

**Files affected:**
- `public/lobby.html` — CSS + HTML structure + JS logic

**New CSS classes:**
- `.fhc-editing-mode` — applied to `#form-hero-grid` during deck editing; disables card interactions
- `.fhc-info-btn` — the `i` button on each card
- `.hf-hero-drawer` — desktop right-side panel (fixed)
- `.hf-hero-sheet` — mobile bottom sheet (fixed)
- `.hf-detail-backdrop` — overlay behind drawer/sheet
- `.hf-detail-l2` — Level 2 stats section (hidden by default)
- `.hf-detail-l2.expanded` — Level 2 visible state

**New JS behavior:**
- `openHeroDetail(heroId)` — detects viewport and opens drawer or sheet
- `closeHeroDetail()` — closes whichever is open
- `onSlidePanel(open)` — toggles `.fhc-editing-mode` on the grid when deck editing panel opens/closes
- Escape key listener for drawer
- Backdrop click listener

**Reuses existing:**
- Hero data already loaded for formation view
- `.role-tank`, `.role-dps`, `.role-support` badge classes
- `.fhc-selected`, `.fhc-addable`, `.fhc-disabled` card state classes
- Existing slide panel open/close JS (just needs to call `onSlidePanel()`)
