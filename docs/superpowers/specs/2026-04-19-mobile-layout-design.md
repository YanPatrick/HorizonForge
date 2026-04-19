# Mobile Layout — HorizonForge Battle Screen

**Date:** 2026-04-19  
**Status:** Approved  
**Scope:** `public/battle.html` (PvP + vs-AI battle screen)

---

## Goal

Add a mobile-first layout for the existing battle screen without breaking any gameplay logic, WebSocket communication, or state management. The game currently works on desktop only; this spec adds a parallel mobile experience detected via CSS media queries and a JS media query match.

---

## Decisions Made

| Question | Decision |
|---|---|
| Unit placement on touch | Tap-to-select + tap-to-place with cell highlight (option C) |
| Bottom zone layout | Stack vertical + fixed FAB Battle button (option C) |
| Arena in portrait | Fields stacked vertically: enemy on top, player on bottom (option A) |
| Landscape orientation | Lock to portrait — show rotate overlay, hide game (option C) |
| Architecture | External `mobile.css` + `mobile.js`, `battle.html` gets 3 minimal additions (option C) |

---

## Architecture

### Files Changed

**`public/battle.html`** — 3 additions only:
1. `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` in `<head>` (currently absent)
2. `<link rel="stylesheet" href="/mobile.css">` in `<head>`
3. `<script src="/mobile.js" defer></script>` before `</body>`

No other changes to `battle.html`. All existing JS, socket.io, game state (`G`), drag handlers, and render logic remain untouched.

### New Files

- `public/mobile.css` — layout overrides via `@media (max-width: 480px) and (pointer: coarse)`
- `public/mobile.js` — mobile detection, highlight logic, FAB, rotate overlay

### Detection Strategy

Both files use `(max-width: 480px) and (pointer: coarse)`:
- `pointer: coarse` = real touch device; prevents accidental activation on resized desktop browsers
- CSS uses `@media` block
- JS uses `window.matchMedia(...)` and early-returns if not mobile

---

## Layout — Portrait (360px–480px)

```
┌────────────────────────────────┐
│  #hdr (compact)                │  scores + timer + banner (1 line)
├────────────────────────────────┤
│  #efield (enemy field 3×3)     │  full width, read-only
│  ── VS ──                      │  horizontal text separator
│  #pfield (player field 3×3)    │  full width, interactive
├────────────────────────────────┤
│  #bottom-zone (scroll-y)       │
│  ┌──────────────────────────┐  │
│  │ Barracks (scroll-x)      │  │  bench cards scroll horizontally
│  ├──────────────────────────┤  │
│  │ Recruitment (scroll-x)   │  │  shop cards scroll horizontally
│  └──────────────────────────┘  │
│                                │
│      [ ⚔ BATTLE! ] FAB        │  fixed, bottom-center
└────────────────────────────────┘
       safe-area-inset-bottom
```

### Zone-by-zone details

**`#hdr`**
- Same structure, reduced padding and font-size
- `#banner` collapses to one line with `text-overflow: ellipsis; overflow: hidden`

**Arena**
- `#arena-wrap` → `flex-direction: column`
- `#fields-row` → `flex-direction: column`
- `#vs` → horizontal separator (`── VS ──`), `flex-direction: row`, centered text
- Enemy field (`#efield`) renders on top, player field (`#pfield`) on bottom
- `--s: 0.85` → cells ~100×92px; 3 columns = ~316px (fits 360px with margin)
- `--s: 0.78` for screens ≤ 380px

**`#bottom-zone`**
- `flex-direction: column`
- `overflow-y: auto`
- `#center-col` → `display: none` (log hidden; FAB replaces Battle button)
- `#benchwrap`, `#shopwrap` → `width: 100%`

**Bench and Shop card rows**
- `#benchrow`, `#shoprow` → `display: flex; flex-wrap: nowrap; overflow-x: auto`
- Scrollbar hidden: `::-webkit-scrollbar { display: none }`
- Cards maintain their existing size (scaled by `--s`)

**FAB (Floating Action Button)**
- Injected by `mobile.js` as `<button id="mobile-fab">`
- `position: fixed; bottom: calc(env(safe-area-inset-bottom) + 16px); left: 50%; transform: translateX(-50%)`
- Calls `startBattle()` (global function in `battle.html`)
- State synced to `#bfight` via `MutationObserver` (disabled attr + text content)

**`#turnpanel`**
- `display: none` on mobile (turn order panel; secondary info)

---

## Layout — Landscape (blocked)

```css
@media (orientation: landscape) and (max-width: 900px) and (pointer: coarse) {
  #mobile-rotate-msg { display: flex; }
  #game, #duel-result { display: none !important; }
}
```

Overlay `#mobile-rotate-msg` injected by `mobile.js`:
- `position: fixed; inset: 0; z-index: 99999`
- Dark background, centered icon + "Please rotate to portrait" text
- CSS controls show/hide based on orientation media query

---

## Interactions

### Tap-to-select with cell highlight

The existing click-swap logic in `battle.html` uses `G.fieldSel` (private to battle.html script scope). `mobile.js` adds visual feedback on top without accessing `G` directly.

**State tracked in `mobile.js`:**
```
mSel: number | null   — index of currently selected pfield cell
```

**Selection flow:**
```
tap on .occ cell, mSel === null      → mSel = i, applyHighlight()
tap on any #pfield cell, mSel !== null → mSel = null, applyHighlight()
tap outside #pfield (bench, shop…)   → mSel = null, applyHighlight()
(battle.html handles the actual swap on click)
```

**`applyHighlight()` function:**
```
for each #pfield .cell:
  remove .m-selected, .m-valid-drop
  if mSel !== null:
    cell[mSel] → add .m-selected (gold border + glow)
    other cells → add .m-valid-drop (green tint)
```

**Render wrapping:**
```js
const _orig = window.render;
window.render = function(...a) {
  _orig(...a);
  applyHighlight(); // re-apply after every render cycle
};
```

`window.render` is accessible because `function render()` in battle.html is a non-module script declaration → lives on `window`.

### CSS classes (in `mobile.css`):
```css
.m-selected  { border: 2px solid #ffd700; box-shadow: 0 0 10px rgba(255,215,0,0.5); }
.m-valid-drop { background: rgba(100,200,100,0.2); border: 2px solid rgba(100,200,100,0.5); }
```

### Bench → field placement
`click` on `.bcard` already calls `buyCard()` in `battle.html`. No change needed.

### Shop → purchase
`click` on `.scard` already calls shop purchase handler. No change needed.

---

## Safe Areas (notch / home indicator)

```css
@media (max-width: 480px) and (pointer: coarse) {
  #game {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  #mobile-fab {
    bottom: calc(env(safe-area-inset-bottom) + 16px);
  }
}
```

---

## Scale Factor

| Screen width | `--s` value | Cell size (approx) | 3-col field width |
|---|---|---|---|
| 381px – 480px | 0.85 | 100 × 92px | ~316px |
| 360px – 380px | 0.78 | 92 × 84px | ~290px |

---

## What Stays Shared (Unchanged)

- All WebSocket / socket.io logic (`pvpInit`, `pvp.socket.on/emit`)
- Game state object `G` and all mutations
- `render()` internals — mobile.js only wraps it, not replaces
- All battle simulation (`startBattle`, `runBattle`, `simulate.js`)
- Drag-and-drop handlers (desktop still works, ignored on touch)
- Shop, bench, merge, sell, reroll logic
- Duel result screen (`#duel-result`) — already `position: fixed` overlay; mobile.css adds `width: 100%; max-width: 100vw; padding: env(safe-area-inset-top) 12px env(safe-area-inset-bottom)` so it fits without horizontal overflow
- `lobby.html` and `index.html` — out of scope

---

## Out of Scope (this spec)

- Touch-drag (swipe to reposition units) — can be added later to `mobile.js`
- Battle log drawer — center-col log hidden; future improvement
- Landscape support — blocked by design decision
- `lobby.html` mobile layout — separate spec
- Tablet layout (481px–1024px)
- Gamepad support

---

## Future Improvements

- **Touch-drag:** add `touchstart/touchmove/touchend` in `mobile.js` that mirrors drag events — zero changes to `battle.html`
- **Log drawer:** slide-up panel for battle log accessible via a small icon button
- **Tablet (481–1024px):** side-by-side fields at reduced `--s`, keeping desktop feel
- **Gamepad:** browser Gamepad API overlay on top of existing click handlers
- **`lobby.html` mobile:** separate spec, same architecture pattern

---

## Acceptance Criteria

- [ ] `battle.html` has `<meta viewport>`, `mobile.css` link, `mobile.js` script
- [ ] On a 360px touch device (portrait): fields stack vertically, FAB visible, bench/shop scroll horizontally
- [ ] Tapping an occupied cell highlights it + shows valid drop targets in green
- [ ] Tapping a destination completes the swap (battle.html handles it)
- [ ] FAB mirrors `#bfight` disabled state and text
- [ ] Landscape shows rotate overlay, hides game
- [ ] Desktop (pointer: fine, >480px) unaffected — zero visual change
- [ ] PvP socket connection and all game events work identically
- [ ] No JS errors on mobile or desktop
