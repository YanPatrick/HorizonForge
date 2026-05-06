# Mobile Hero Detail — Slide Page Design

**Date:** 2026-05-06  
**Status:** Approved  
**Scope:** Formation page — mobile hero detail panel

---

## Problem

On the Formation page, tapping the info button (`i`) on a hero card on mobile causes the screen to darken (backdrop appears) but nothing else shows. The root cause is that `HeroDetail` in `LobbyPage.jsx` always renders `hf-hero-drawer` (the desktop right-panel). The `hf-hero-sheet` CSS class exists but is never rendered in the JSX, so mobile users see a backdrop with no panel.

---

## Solution: Slide Page (Option B)

On mobile, instead of a bottom sheet or a drawer, the hero detail opens as a full-screen page that slides in from the right — identical to the Rumble Arcade pattern. The formation grid slides out to the left simultaneously, giving a native-app navigation feel.

Desktop behavior is **unchanged**: the existing `hf-hero-drawer` right-side panel continues to work exactly as today.

---

## Architecture

### New component: `MobileHeroPage`

A new functional component added to `LobbyPage.jsx`, above `FormationView`.

```
MobileHeroPage({ hero, onClose })
  - Renders always (not conditionally) so exit animation works
  - className: "hf-mobile-hero-page" + " active" when hero !== null
  - Content: same as HeroDetail (role badge, skill, stats grid, "View full stats" table)
  - Back button: "← Voltar" at top-left, calls onClose
  - Uses same helpers: roleCategory(), fmtSP(), expanded state
```

### State

No new state. Reuses the existing `detailHero` state in `FormationView`:
- When user taps a hero card → `setDetailHero(h)` (unchanged)
- When back button tapped → `setDetailHero(null)` (unchanged)

### Conditional rendering in `FormationView`

```jsx
{/* Desktop only */}
{detailHero && <HeroDetail hero={detailHero} onClose={() => setDetailHero(null)} />}

{/* Mobile only — always mounted for exit animation */}
<MobileHeroPage hero={detailHero} onClose={() => setDetailHero(null)} />
```

`HeroDetail` continues to render on desktop. On mobile its CSS is `display:none`.

---

## CSS — new rules in `public/css/lobby.css`

All new rules are scoped to `@media (max-width: 640px)`.

```css
/* Hide desktop drawer on mobile */
@media (max-width: 640px) {
  .hf-hero-drawer,
  .hf-detail-backdrop { display: none !important; }
}

/* Mobile slide page */
.hf-mobile-hero-page {
  display: none; /* hidden on desktop */
}

@media (max-width: 640px) {
  .hf-mobile-hero-page {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: 0;
    z-index: 900;
    background: #0f1623;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.34, 1.06, 0.64, 1);
    overflow-y: auto;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .hf-mobile-hero-page.active {
    transform: translateX(0);
  }
}
```

### Internal layout classes (new)

| Class | Purpose |
|---|---|
| `.hf-mhp-header` | Top bar: back button + hero name |
| `.hf-mhp-back-btn` | "← Voltar" button, left-aligned |
| `.hf-mhp-portrait` | Hero portrait area, full width, ~160px tall |
| `.hf-mhp-body` | Scrollable content: role, skill, stats |
| `.hf-mhp-role-wrap` | Wraps the role badge |
| `.hf-mhp-section-label` | Section labels (same style as `.hf-detail-section-label`) |
| `.hf-mhp-skill-name` | Skill name (gold) |
| `.hf-mhp-skill-desc` | Skill description |
| `.hf-mhp-stats` | 2×2 stats grid |
| `.hf-mhp-stat` | Individual stat cell |

These mirror the existing `hf-detail-*` classes so visual language stays consistent.

---

## Files Changed

| File | Change |
|---|---|
| `client/src/pages/LobbyPage.jsx` | Add `MobileHeroPage` component; adjust `FormationView` render to mount it |
| `public/css/lobby.css` | Hide desktop drawer on mobile; add `.hf-mobile-hero-page` + layout classes; raise `.mobile-bottom-tabs` to `z-index: 1000` |

**No other files touched.** Battle page, PvP, GrimoireView, settings — all untouched.

---

## Constraints

- Bottom nav bar must remain visible above the hero detail page. `.mobile-bottom-tabs` currently has `z-index: 100` — it must be raised to `z-index: 1000` so it sits on top of the slide page (`z-index: 900`). This is a one-line CSS change in `lobby.css`.
- `MobileHeroPage` must always be mounted (not conditionally rendered) so the slide-out animation plays on close.
- Safe-area inset padding required at bottom for notched devices.
- The `HeroDetail` desktop component must not be rendered on mobile to avoid double backdrops.

---

## Out of Scope

- Swipe-back gesture (user confirmed: back button only)
- Any changes to desktop layout
- Any changes to battle, PvP, or other pages
