# Battlefield ↔ Barracks Click-Swap + Mobile Touch Drag — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to click a field hero then click a bench card (and vice-versa) to swap them; add touch-drag gesture on mobile for field → barracks.

**Architecture:** All game logic lives inside `_bootBattle()` in `battle.js`. A new internal `swapFieldBench(fieldSlot, benchCid)` function performs the atomic swap. Two existing event-handler globals (`benchCardClick`, `fieldCellClick`) gain a new early-return branch that calls `swapFieldBench` when cross-selection is detected. `retBench` is exposed as `window.retBench` so `mobile.js` can call it from a touch-drag gesture. No new React state or new globals are needed beyond these.

**Tech Stack:** Vanilla JS (battle.js, mobile.js), React JSX (BattlePage.jsx), Vite dev server on port 5173.

---

## File Map

| File | Lines touched | What changes |
|---|---|---|
| `public/js/battle.js` | After line 753 | Add `swapFieldBench()` function |
| `public/js/battle.js` | Lines 2657–2661 | Modify `window.benchCardClick` |
| `public/js/battle.js` | Lines 2352–2355 | Modify `window.fieldCellClick` else-branch |
| `public/js/battle.js` | Before line 2687 | Expose `window.retBench = retBench` |
| `public/mobile.js` | After line 138 | Add touch-drag handler block |
| `client/src/pages/BattlePage.jsx` | Line 266 | Add `'retBench'` to `battleSide` cleanup array |

---

## Task 1 — Add `swapFieldBench` to battle.js

**Files:**
- Modify: `public/js/battle.js` (insert after line 753, before `function restoreFieldHp`)

- [ ] **Step 1.1 — Insert the function**

In `public/js/battle.js`, find this exact string (it is the line immediately after `retBench` closes):

```js
      function restoreFieldHp() {
```

Replace with:

```js
      function swapFieldBench(fieldSlot, benchCid) {
        if (G.phase !== "shop") return;
        const fieldUnit = G.board[fieldSlot];
        if (!fieldUnit) return;
        const bidx = G.bench.findIndex((b) => b.cid === benchCid);
        if (bidx < 0) return;
        const benchUnit = G.bench[bidx];
        G.board[fieldSlot] = { ...benchUnit };
        G.bench.splice(bidx, 1);
        const existingIdx = G.bench.findIndex((b) => b.cid === fieldUnit.cid);
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

      function restoreFieldHp() {
```

- [ ] **Step 1.2 — Verify the file parses**

```bash
node --input-type=module < /dev/null || node -e "require('fs').readFileSync('public/js/battle.js','utf8')"
```

Simpler check — start the dev server and confirm it loads without console errors:

```bash
npm run dev
```

Open `http://localhost:5173/battle` in the browser, open DevTools Console. Expected: no syntax errors from `battle.js`.

- [ ] **Step 1.3 — Commit**

```bash
git add public/js/battle.js
git commit -m "feat: add swapFieldBench helper to battle.js"
```

---

## Task 2 — Modify `window.benchCardClick`

**Files:**
- Modify: `public/js/battle.js` lines 2657–2661

- [ ] **Step 2.1 — Replace benchCardClick body**

Find this exact block (lines 2657–2661):

```js
      window.benchCardClick = function (cid) {
        if (G.phase !== "shop") return;
        G.bsel = G.bsel === cid ? null : cid;
        render();
      };
```

Replace with:

```js
      window.benchCardClick = function (cid) {
        if (G.phase !== "shop") return;
        if (G.fieldSel !== null) {
          swapFieldBench(G.fieldSel, cid);
          return;
        }
        G.bsel = G.bsel === cid ? null : cid;
        render();
      };
```

- [ ] **Step 2.2 — Verify in browser (field → bench click-swap)**

With dev server running at `http://localhost:5173/battle`:

1. Start a game (bot mode). Enter the shop phase.
2. Buy two different heroes so you have one on the field and one in the barracks.
3. Click the field hero → it should get a gold/highlighted border (`.field-sel` class).
4. Open the Barracks panel. Click the bench card.
5. Expected: the heroes swap positions — the bench card is now on the field, the field hero is now in the barracks. No console errors.

- [ ] **Step 2.3 — Commit**

```bash
git add public/js/battle.js
git commit -m "feat: benchCardClick swaps with selected field hero"
```

---

## Task 3 — Modify `window.fieldCellClick`

**Files:**
- Modify: `public/js/battle.js` lines 2352–2355

- [ ] **Step 3.1 — Replace the else-branch inside the occupied-slot check**

Find this exact block (lines 2352–2355, the final `else` inside `if (G.board[slot])`):

```js
          } else {
            G.fieldSel = slot;
            G.bsel = null;
          }
```

Replace with:

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

- [ ] **Step 3.2 — Verify in browser (bench → field click-swap)**

With dev server running at `http://localhost:5173/battle`:

1. Enter the shop phase with at least one hero on the field and one in the barracks.
2. Click a bench card → it gets highlighted (`.bsel` state, blue border).
3. Click an **occupied** field slot.
4. Expected: the heroes swap — bench card is now on that field slot, field hero goes to the barracks. No console errors.

- [ ] **Step 3.3 — Verify existing mechanics are not broken**

Check these scenarios all still work correctly:

| Scenario | Expected |
|---|---|
| Click empty field slot with bench selected | Hero placed from barracks to field (no swap) |
| Click field hero → click another field hero | Field-to-field swap (original behavior) |
| Click field hero → click empty field slot | Hero moves to empty slot |
| Click field hero → click same field hero | Deselects (fieldSel → null) |
| Drag field hero to barracks | Hero returns to barracks (drag-drop still works) |
| Drag bench card to field slot | Hero placed from barracks to field |

- [ ] **Step 3.4 — Commit**

```bash
git add public/js/battle.js
git commit -m "feat: fieldCellClick swaps with selected bench card on occupied slot"
```

---

## Task 4 — Expose `window.retBench` + BattlePage cleanup

**Files:**
- Modify: `public/js/battle.js` (before line 2687)
- Modify: `client/src/pages/BattlePage.jsx` (line 266)

- [ ] **Step 4.1 — Expose retBench as a global**

In `public/js/battle.js`, find this exact line:

```js
      window.benchInfoShow = function (cid, anchorEl) {
```

Insert one line before it:

```js
      window.retBench = retBench;
      window.benchInfoShow = function (cid, anchorEl) {
```

- [ ] **Step 4.2 — Add retBench to BattlePage.jsx cleanup**

In `client/src/pages/BattlePage.jsx`, find this exact line (line 266):

```js
        'benchCardClick', 'benchCardDragStart', 'benchCardDragEnd',
```

Replace with:

```js
        'benchCardClick', 'benchCardDragStart', 'benchCardDragEnd',
        'retBench',
```

- [ ] **Step 4.3 — Commit**

```bash
git add public/js/battle.js client/src/pages/BattlePage.jsx
git commit -m "feat: expose window.retBench for mobile.js touch drag"
```

---

## Task 5 — Add touch-drag field → barracks in mobile.js

**Files:**
- Modify: `public/mobile.js` (after the click listener, before closing `})()`)

- [ ] **Step 5.1 — Insert touch-drag handler block**

In `public/mobile.js`, find this exact block at the end of the file:

```js
  applyHighlight();
}, false);

})();
```

Replace with:

```js
  applyHighlight();
}, false);

// Touch drag: field → barracks
// Detects a drag gesture starting from a field unit. On touchmove, highlights
// #benchwrap when the finger is over it. On touchend over benchwrap, calls
// window.retBench to return the hero to barracks.
(function () {
  var _touchDragSlot = null;
  var bw = null;

  function getBenchWrap() {
    return bw || (bw = document.getElementById('benchwrap'));
  }

  function isTouchOverBenchwrap(touch) {
    var el = document.elementFromPoint(touch.clientX, touch.clientY);
    var bench = getBenchWrap();
    return bench && el && (el === bench || bench.contains(el));
  }

  document.addEventListener('touchstart', function (e) {
    var unit = e.target.closest('#pfield .cell.occ .unit');
    if (!unit) return;
    var cell = unit.closest('.cell');
    if (!cell) return;
    _touchDragSlot = parseInt(cell.getAttribute('data-i'), 10);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (_touchDragSlot === null) return;
    // Note: _fieldLpTimer is a local var inside battle.js's _bootBattle scope.
    // React's onTouchMove on the .unit element already calls window.fieldTouchMove()
    // which clears it — no action needed here.
    var touch = e.changedTouches[0];
    if (!touch) return;
    var bench = getBenchWrap();
    if (!bench) return;
    if (isTouchOverBenchwrap(touch)) {
      bench.classList.add('bench-touch-over');
    } else {
      bench.classList.remove('bench-touch-over');
    }
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (_touchDragSlot === null) return;
    var slot = _touchDragSlot;
    _touchDragSlot = null;
    var bench = getBenchWrap();
    if (bench) bench.classList.remove('bench-touch-over');
    var touch = e.changedTouches[0];
    if (!touch) return;
    if (isTouchOverBenchwrap(touch)) {
      window.retBench?.(slot);
    }
  }, { passive: true });

  document.addEventListener('touchcancel', function () {
    _touchDragSlot = null;
    var bench = getBenchWrap();
    if (bench) bench.classList.remove('bench-touch-over');
  }, { passive: true });
})();

})();
```

- [ ] **Step 5.2 — Add `.bench-touch-over` CSS rule**

In `public/css/battle.css`, find this exact block (around line 1642):

```css
      #benchwrap.bench-drop-over {
        box-shadow:
          0 0 0 2px rgba(136, 204, 255, 0.65),
          0 0 18px rgba(136, 204, 255, 0.18);
        background: rgba(136, 204, 255, 0.04);
        transition:
          box-shadow 0.15s,
          background 0.15s;
      }
```

Insert the following block immediately after it:

```css
      #benchwrap.bench-touch-over {
        box-shadow:
          0 0 0 2px rgba(136, 204, 255, 0.65),
          0 0 18px rgba(136, 204, 255, 0.18);
        background: rgba(136, 204, 255, 0.04);
        transition:
          box-shadow 0.15s,
          background 0.15s;
      }
```

- [ ] **Step 5.3 — Verify touch drag in browser (mobile emulation)**

With dev server running at `http://localhost:5173/battle`:

1. Open DevTools → Toggle device toolbar (Ctrl+Shift+M) → select a mobile preset (e.g. iPhone 12).
2. Enter the shop phase. Place a hero on the field.
3. Press and hold the field hero, then drag your finger toward the barracks panel area.
4. Expected: `#benchwrap` gets a visual highlight (`.bench-touch-over`) as the finger passes over it.
5. Lift finger while over the barracks.
6. Expected: hero disappears from the field and appears in the barracks. No console errors.

- [ ] **Step 5.4 — Verify long-press tooltip still works**

1. In mobile emulation, press and hold a field hero without moving.
2. Wait 500ms.
3. Expected: hero info tooltip appears (long-press behavior preserved). No accidental `retBench` call.

- [ ] **Step 5.5 — Commit**

```bash
git add public/mobile.js public/css/battle.css
git commit -m "feat: add touch drag gesture for field→barracks on mobile"
```

---

## Task 6 — Build and final verification

**Files:** No changes — verification only.

- [ ] **Step 6.1 — Run production build**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 6.2 — Test on production build**

```bash
npm start
```

Open `http://localhost:3000/battle`. Verify all scenarios from Task 3.3 still work on the production build.

- [ ] **Step 6.3 — Verify bot mode and PvP mode parity**

The swap mechanics only operate in the shop phase, which is identical in both modes. Confirm:
- Bot mode: click-swap field↔barracks works ✓
- PvP mode (or PvP simulation): shop phase click-swap also works, no regressions in combat ✓

- [ ] **Step 6.4 — Final commit (if any CSS changes were made)**

```bash
git add -p
git commit -m "chore: verify build after battlefield-barracks click-swap feature"
```
