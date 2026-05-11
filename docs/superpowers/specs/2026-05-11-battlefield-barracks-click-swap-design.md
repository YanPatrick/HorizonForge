# Design: Battlefield ↔ Barracks Click-Swap + Mobile Touch Drag

**Date:** 2026-05-11  
**Branch:** feat/45-implementar-click-troca-battlefield  
**Scope:** `public/js/battle.js`, `public/mobile.js`, `client/src/pages/BattlePage.jsx`

---

## Problem

Players can already:
- Drag a field hero to the barracks (field → bench via HTML5 drag)
- Click a bench card then click an empty field slot (bench → field via click)
- Click two field heroes to swap their positions (field ↔ field via click)

But they **cannot**:
- Click a field hero then click a bench card to swap them
- Click a bench card then click an occupied field slot to swap them
- Drag a field hero to the barracks via touch on mobile

---

## Out of Scope

- Bench → bench reordering
- Enemy field interactions
- Any changes to shop, merge, or combat logic
- Visual drag ghost on mobile (simple gesture only)

---

## Architecture

All game state lives in `G` inside `_bootBattle()` in `battle.js`. The React layer (`BattlePage.jsx`) delegates every click/drag event back to `window.*` callbacks registered by `battle.js`. `mobile.js` wraps `window.render` and attaches document-level touch listeners.

The two selection flags involved:
- `G.fieldSel` — index (0–8) of the selected player field slot, or `null`
- `G.bsel` — `cid` string of the selected bench card, or `null`

---

## Changes

### 1. `battle.js` — new `swapFieldBench(fieldSlot, benchCid)`

Internal function, defined alongside `retBench` and `placeUnit`:

```js
function swapFieldBench(fieldSlot, benchCid) {
  if (G.phase !== 'shop') return;
  const fieldUnit = G.board[fieldSlot];
  if (!fieldUnit) return;
  const bidx = G.bench.findIndex(b => b.cid === benchCid);
  if (bidx < 0) return;

  const benchUnit = G.bench[bidx];

  // Place bench unit onto field
  G.board[fieldSlot] = { ...benchUnit };

  // Remove bench unit from bench
  G.bench.splice(bidx, 1);

  // Return field unit to bench (merge if same cid already exists)
  const existingIdx = G.bench.findIndex(b => b.cid === fieldUnit.cid);
  if (existingIdx >= 0) {
    G.bench[existingIdx].stack += fieldUnit.stack;
    applyMerge(G.bench[existingIdx]);
  } else {
    G.bench.push({ ...fieldUnit });
  }

  G.fieldSel = null;
  G.bsel = null;
  render();
}
```

**Why atomic:** The swap is 1:1 — bench count never changes, so the "bench full" check is never triggered. `applyMerge` handles auto-level-up if stacking causes a merge.

### 2. `battle.js` — modify `window.benchCardClick`

```js
window.benchCardClick = function (cid) {
  if (G.phase !== 'shop') return;
  if (G.fieldSel !== null) {
    swapFieldBench(G.fieldSel, cid);
    return;
  }
  G.bsel = G.bsel === cid ? null : cid;
  render();
};
```

Flow: field hero selected → user clicks bench card → swap executes.

### 3. `battle.js` — modify `window.fieldCellClick`

Within the `if (G.board[slot])` branch, in the final `else` (no `fieldSel` active):

```js
} else {
  if (G.bsel !== null) {
    swapFieldBench(slot, G.bsel);
    return;
  }
  G.fieldSel = slot;
  G.bsel = null;
}
```

Flow: bench card selected → user clicks an occupied field slot → swap executes.

### 4. `battle.js` — expose `window.retBench`

After the `retBench` function definition, add:

```js
window.retBench = retBench;
```

So `mobile.js` can call it without depending on internal scope.

Add `'retBench'` to the `battleSide` cleanup array in `BattlePage.jsx`'s `useEffect`.

### 5. `mobile.js` — touch drag field → barracks (touch devices only)

New block inside the `if (!isTouch) return` guard, after the existing click listener.

**State:** `_touchDragSlot = null` — the field slot index being dragged, or `null`.

**Gesture lifecycle:**

| Event | Action |
|---|---|
| `touchstart` on `.unit` inside `#pfield` | Record `_touchDragSlot` from `data-i` of parent `.cell`. Do NOT cancel `_fieldLpTimer` (long-press tooltip can still coexist if user holds still). |
| `touchmove` | Cancel `_fieldLpTimer` (it's a drag, not a long-press). Check `elementFromPoint` at touch coords — if it's inside `#benchwrap`, add `.bench-touch-over` to `#benchwrap`. Remove otherwise. |
| `touchend` | Remove `.bench-touch-over`. If `_touchDragSlot !== null` and `elementFromPoint` (using `changedTouches[0]`, since `touches[0]` is empty on touchend) is inside `#benchwrap`, call `window.retBench?.(_touchDragSlot)`. Clear `_touchDragSlot`. |
| `touchcancel` | Same cleanup as `touchend` without the retBench call. |

**CSS:** `.bench-touch-over` — same visual as `.bench-drop-over` (already defined in `battle.css`). No new CSS needed.

**Coexistence with long-press tooltip:** `touchmove` cancels `_fieldLpTimer`, so if the user actually drags, the tooltip never fires. If the user holds still, the tooltip fires at 500ms as before and `_touchDragSlot` is cleared on touchend (no drag action).

---

## Visual Feedback (click-to-swap, both PC and mobile)

No new CSS needed. The existing `.field-sel` class (applied via React state `field.fieldSel`) already highlights the selected field hero. When a field hero is selected, `dropMode` is already `true`, which gives empty cells the `.dr` (drop target) class.

For the barracks side: when `G.fieldSel !== null`, the bench cards are already rendered with `bench.active = true` — they are clickable and show hover state naturally.

---

## Invariants Preserved

- `G.phase !== 'shop'` guard on every handler — no swap during battle phase
- `applyMerge` called on merge — auto-level-up still works
- `G.fieldSel` and `G.bsel` always cleared after a swap — no stale selection
- `_suppressFieldClickUntil` on drag end — touch/click collision already handled
- Bot and PvP modes unaffected — all changes are shop-phase UI only

---

## Files Changed

| File | Change |
|---|---|
| `public/js/battle.js` | Add `swapFieldBench()`, modify `benchCardClick`, modify `fieldCellClick`, expose `window.retBench` |
| `public/mobile.js` | Add touch drag gesture handler |
| `client/src/pages/BattlePage.jsx` | Add `'retBench'` to `battleSide` cleanup array |
