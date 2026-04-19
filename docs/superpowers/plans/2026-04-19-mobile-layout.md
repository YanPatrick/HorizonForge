# Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-first layout for `battle.html` via two new external files (`mobile.css`, `mobile.js`) and three minimal additions to `battle.html`, without touching any gameplay logic.

**Architecture:** `mobile.css` overrides layout with `@media (max-width: 480px) and (pointer: coarse)`. `mobile.js` injects two DOM elements (FAB, rotate overlay) and wraps `window.render` to add tap-select cell highlight. All WebSocket, game state, and battle logic in `battle.html` remain completely unchanged.

**Tech Stack:** Vanilla HTML/CSS/JS, Socket.io (already wired, untouched), Express static server (`npm run dev`)

---

## How to launch the game for testing

Start the server: `npm run dev`

Then in browser console at `http://localhost:3000`, inject the battle config and navigate:

```js
sessionStorage.setItem('hf_battle_cfg', JSON.stringify({ mode: 'ai', format: 3 }));
location.href = '/battle.html';
```

To simulate a mobile viewport in Chrome DevTools: `F12 → Toggle device toolbar → set width to 375, height to 812, device type "Mobile"`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `public/battle.html` | Modify — 3 lines only | Add viewport meta, CSS link, JS script tag |
| `public/mobile.css` | Create | All mobile layout overrides, highlight classes, FAB styles, overlay styles |
| `public/mobile.js` | Create | Mobile detection, rotate overlay injection, FAB injection + sync, tap-select highlight |

---

## Task 1: Add viewport meta + asset references to battle.html

**Files:**
- Modify: `public/battle.html` — lines 3–5 (inside `<head>`)
- Modify: `public/battle.html` — last lines (before `</body>`)

- [ ] **Step 1: Add viewport meta tag to `<head>`**

Find this line in `battle.html` (currently line 4):
```html
    <meta charset="UTF-8" />
```

Add directly after it:
```html
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- [ ] **Step 2: Add mobile.css link to `<head>`**

Find the existing `<style>` opening tag (line 6). Add before it:
```html
    <link rel="stylesheet" href="/mobile.css" />
```

- [ ] **Step 3: Add mobile.js script before `</body>`**

Find `</body>` (last few lines of the file). Add before it:
```html
    <script src="/mobile.js" defer></script>
```

- [ ] **Step 4: Verify desktop is unaffected**

Run `npm run dev`. Inject battle config in console and open `battle.html`. Desktop layout must look identical to before — no visual change. Check browser console for 404 errors on `mobile.css` and `mobile.js` (expected at this stage — files don't exist yet).

- [ ] **Step 5: Commit**

```bash
git add public/battle.html
git commit -m "feat(mobile): add viewport meta, mobile.css and mobile.js references"
```

---

## Task 2: Create mobile.css — file skeleton + landscape block

**Files:**
- Create: `public/mobile.css`

- [ ] **Step 1: Create `public/mobile.css` with the landscape block**

```css
/* ═══════════════════════════════════════════════════
   HORIZON FORGE — MOBILE LAYOUT OVERRIDES
   Applies only to: touch devices, max-width 480px
   Does NOT affect desktop (pointer: fine or >480px)
   ═══════════════════════════════════════════════════ */

/* ── Rotate overlay (landscape block) ── */
#mobile-rotate-msg {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #060310;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #dde2ff;
  font-family: "Exo 2", system-ui, sans-serif;
  text-align: center;
  padding: 32px;
}

#mobile-rotate-msg .mrm-icon {
  font-size: 48px;
  animation: mrm-spin 2s ease-in-out infinite;
}

#mobile-rotate-msg p {
  font-size: 16px;
  font-weight: 600;
  color: rgba(200, 185, 245, 0.9);
  max-width: 220px;
  line-height: 1.5;
}

@keyframes mrm-spin {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(90deg); }
}

/* Show overlay + hide game in landscape on touch devices */
@media (orientation: landscape) and (max-width: 900px) and (pointer: coarse) {
  #mobile-rotate-msg { display: flex; }
  #game, #duel-result, #quit-overlay { display: none !important; }
}
```

- [ ] **Step 2: Verify rotate overlay works**

With the server running, open `battle.html`, inject the battle config, start the game. In DevTools, switch orientation to landscape (or rotate a real device). The game must hide and the rotate message must appear. Switch back to portrait — game reappears.

- [ ] **Step 3: Commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): mobile.css skeleton with landscape rotate block"
```

---

## Task 3: Create mobile.js — detection + rotate overlay injection

**Files:**
- Create: `public/mobile.js`

- [ ] **Step 1: Create `public/mobile.js`**

```js
(function () {
  /* ─── Mobile detection ──────────────────────────────────────
     Matches same condition as mobile.css media queries.
     pointer: coarse = real touch device.
     Early-return on desktop so zero JS runs there.
  ─────────────────────────────────────────────────────────── */
  var MQ = window.matchMedia('(max-width: 480px) and (pointer: coarse)');
  if (!MQ.matches) return;

  /* ─── Rotate overlay ───────────────────────────────────────
     The CSS shows/hides it based on orientation media query.
     We just inject the DOM element here.
  ─────────────────────────────────────────────────────────── */
  var overlay = document.createElement('div');
  overlay.id = 'mobile-rotate-msg';
  overlay.innerHTML =
    '<div class="mrm-icon">📱</div>' +
    '<p>Rotate your device to portrait to play</p>';
  document.body.appendChild(overlay);

})();
```

- [ ] **Step 2: Verify no JS errors on desktop or mobile viewport**

Open `battle.html` on desktop (DevTools in responsive mode with pointer set to "fine" or normal desktop). Console must be clean. Switch to mobile viewport (375px, pointer: coarse) — console must also be clean. The rotate overlay element must exist in the DOM on mobile viewport (`document.getElementById('mobile-rotate-msg')` returns the element).

- [ ] **Step 3: Commit**

```bash
git add public/mobile.js
git commit -m "feat(mobile): mobile.js detection + rotate overlay DOM injection"
```

---

## Task 4: mobile.css — Scale factor + arena vertical stack

**Files:**
- Modify: `public/mobile.css` — append to existing file

- [ ] **Step 1: Append scale + arena layout rules to `mobile.css`**

```css
/* ── Portrait mobile layout (360–480px touch) ── */
@media (max-width: 480px) and (pointer: coarse) {

  /* Scale factor: shrinks all calc(Xpx * var(--s)) dimensions */
  :root {
    --s: 0.85;
  }

  /* Tighter scale for very small phones */
  @media (max-width: 380px) {
    :root { --s: 0.78; }
  }

  /* ── Arena: stack fields vertically ── */
  #arena-wrap {
    flex-direction: column;
    overflow: hidden;
  }

  #fields-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    width: 100%;
  }

  /* Each field wrapper takes full width */
  .fwrap {
    width: 100%;
  }

  /* VS separator: horizontal line instead of vertical */
  #vs {
    width: 100%;
    height: 28px;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }

  /* Hide the vertical line pseudo-element, add horizontal one */
  #vs::before {
    top: 50%;
    bottom: auto;
    left: 8%;
    right: 8%;
    width: auto;
    height: 1px;
    transform: none;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(255, 180, 60, 0.55) 25%,
      rgba(255, 200, 100, 0.75) 50%,
      rgba(255, 180, 60, 0.55) 75%,
      transparent 100%
    );
  }

  /* Hide turn order panel (secondary info, no space on mobile) */
  #turnpanel {
    display: none !important;
  }
}
```

- [ ] **Step 2: Verify arena layout on mobile viewport**

Set DevTools to 375×812, pointer: coarse. Inject config, open battle. The enemy field must appear on top and the player field below it. The VS separator must be a horizontal line with the "VS" badge centered on it. Both fields must be full width and not overflow horizontally.

- [ ] **Step 3: Commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): scale factor + arena vertical stack in portrait"
```

---

## Task 5: mobile.css — Bottom zone vertical stack + bench/shop scroll

**Files:**
- Modify: `public/mobile.css` — append inside the existing `@media (max-width: 480px) and (pointer: coarse)` block

- [ ] **Step 1: Append bottom zone rules inside the portrait media block**

Append these rules **inside** the `@media (max-width: 480px) and (pointer: coarse)` block (before its closing `}`):

```css
  /* ── Bottom zone: vertical stack ── */
  #bottom-zone {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    /* Leave room at bottom for FAB (64px button + 16px gap + safe-area) */
    padding-bottom: calc(env(safe-area-inset-bottom) + 80px);
    gap: 8px;
  }

  /* Hide the center column (Battle btn lives in FAB, log is hidden) */
  #center-col {
    display: none;
  }

  /* Barracks and Shop: full width */
  #benchwrap,
  #shopwrap {
    width: 100%;
    min-width: 0;
  }

  /* Bench and Shop card rows: horizontal scroll */
  #benchrow,
  #shoprow {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    gap: calc(var(--bcard-gap));
    padding-bottom: 4px; /* prevent shadow clip */
  }

  /* Hide scrollbars — content still scrolls via touch */
  #benchrow::-webkit-scrollbar,
  #shoprow::-webkit-scrollbar {
    display: none;
  }
```

- [ ] **Step 2: Verify bottom zone layout**

In mobile viewport: bottom zone must stack vertically (Barracks on top, Recruitment below). Both card rows must scroll horizontally via touch swipe (or mouse drag in DevTools touch mode). No horizontal overflow on the page body. The phase-timer (inside center-col) should be invisible.

- [ ] **Step 3: Commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): bottom zone vertical stack + bench/shop horizontal scroll"
```

---

## Task 6: mobile.css — Header compact + duel-result + FAB + safe areas

**Files:**
- Modify: `public/mobile.css` — append inside the portrait media block

- [ ] **Step 1: Append header, duel-result, FAB and safe-area rules inside the portrait media block**

```css
  /* ── Header: compact ── */
  #hdr {
    padding: 6px 10px;
    gap: 3px;
    max-width: 100%;
  }

  #hdr .hdr-row-bottom {
    gap: 4px;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  /* Banner: one line, ellipsis if too long */
  #banner {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
    font-size: 11px;
  }

  /* ── Safe areas for game container ── */
  #game {
    padding-top: env(safe-area-inset-top);
    /* bottom padding handled by #bottom-zone padding-bottom */
  }

  /* ── Duel result screen: full width, safe areas ── */
  #duel-result {
    width: 100%;
    max-width: 100vw;
    box-sizing: border-box;
    overflow-y: auto;
  }

  #dr-box {
    width: calc(100vw - 24px);
    margin: 0 auto;
    padding-top: calc(env(safe-area-inset-top) + 16px);
    padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
    max-height: 100dvh;
    overflow-y: auto;
  }

  /* ── FAB Battle button ── */
  #mobile-fab {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom) + 16px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    min-width: 160px;
    height: 48px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
    border-radius: 24px;
    /* Inherits .btn .bbtn styles from battle.html */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 16px rgba(120, 60, 255, 0.3);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  #mobile-fab:disabled {
    opacity: 0.45;
    cursor: default;
  }
```

- [ ] **Step 2: Verify header and safe areas**

In mobile viewport: header must be compact (single row if possible, banner truncated with `…`). At bottom of page, FAB area CSS exists (element not yet injected — Task 7 adds it). Duel result must not overflow horizontally after a battle.

- [ ] **Step 3: Commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): compact header, duel-result, FAB and safe-area styles"
```

---

## Task 7: mobile.js — FAB injection + MutationObserver sync

**Files:**
- Modify: `public/mobile.js` — append inside the IIFE, after the rotate overlay block

- [ ] **Step 1: Append FAB injection code inside the IIFE in `mobile.js`**

Append this **inside** the `(function() { ... })()` block, after the rotate overlay section:

```js
  /* ─── FAB Battle button ────────────────────────────────────
     Mirrors the hidden #bfight button (inside #center-col).
     MutationObserver keeps disabled state and text in sync.
  ─────────────────────────────────────────────────────────── */
  var fab = document.createElement('button');
  fab.id = 'mobile-fab';
  fab.className = 'btn bbtn'; // reuse battle.html button styles
  fab.textContent = 'Battle!';
  fab.setAttribute('type', 'button');
  fab.addEventListener('click', function () {
    if (typeof startBattle === 'function') startBattle();
  });
  document.body.appendChild(fab);

  // Sync FAB state once #bfight is available (render() creates it)
  function syncFab() {
    var bfight = document.getElementById('bfight');
    if (!bfight) return;

    // Initial sync
    fab.disabled = bfight.disabled;
    fab.textContent = bfight.textContent || 'Battle!';

    // Keep in sync as battle.html updates #bfight
    new MutationObserver(function () {
      fab.disabled = bfight.disabled;
      fab.textContent = bfight.textContent || 'Battle!';
    }).observe(bfight, { attributes: true, childList: true, subtree: true });
  }

  // #bfight exists in HTML but render() may update its state on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFab);
  } else {
    syncFab();
  }
```

- [ ] **Step 2: Verify FAB appears and syncs correctly**

In mobile viewport, start a game (AI mode). The FAB must appear fixed at the bottom center. During the shop phase, the FAB must show "Battle!" and be enabled. Click it — it must call `startBattle()`. After the battle starts (combat phase), the FAB must mirror the disabled state of `#bfight`.

- [ ] **Step 3: Verify desktop is unaffected**

Switch DevTools to desktop viewport (>480px or pointer: fine). The FAB must not appear (mobile.js early-returns, never creates the element). `document.getElementById('mobile-fab')` must return `null`.

- [ ] **Step 4: Commit**

```bash
git add public/mobile.js
git commit -m "feat(mobile): FAB Battle button injection with MutationObserver sync"
```

---

## Task 8: mobile.js — Tap-select cell highlight + render wrap

**Files:**
- Modify: `public/mobile.js` — append inside the IIFE, after the FAB block

- [ ] **Step 1: Append highlight logic inside the IIFE**

```js
  /* ─── Tap-select cell highlight ────────────────────────────
     battle.html handles the actual swap via G.fieldSel.
     mobile.js tracks selection independently (mSel) and adds
     CSS classes for visual feedback after each render() call.

     Classes added to #pfield .cell elements:
       .m-selected   — gold border on the selected cell
       .m-valid-drop — green tint on valid destination cells

     window.render is global (function declaration in non-module
     <script>) — safe to wrap after defer load.
  ─────────────────────────────────────────────────────────── */
  var mSel = null; // index (data-i) of selected pfield cell, or null

  function applyHighlight() {
    var cells = document.querySelectorAll('#pfield .cell');
    cells.forEach(function (cell) {
      cell.classList.remove('m-selected', 'm-valid-drop');
    });
    if (mSel === null) return;
    cells.forEach(function (cell) {
      var idx = parseInt(cell.getAttribute('data-i'), 10);
      if (idx === mSel) {
        cell.classList.add('m-selected');
      } else {
        cell.classList.add('m-valid-drop');
      }
    });
  }

  // Wrap window.render to re-apply highlights after every render cycle
  var _origRender = window.render;
  if (typeof _origRender === 'function') {
    window.render = function () {
      _origRender.apply(this, arguments);
      applyHighlight();
    };
  }

  // Event delegation: track selection on pfield clicks
  document.addEventListener('click', function (e) {
    var cell = e.target.closest('#pfield .cell');

    if (!cell) {
      // Clicked outside pfield — clear selection
      if (mSel !== null) {
        mSel = null;
        applyHighlight();
      }
      return;
    }

    var idx = parseInt(cell.getAttribute('data-i'), 10);

    if (mSel === null) {
      // Select occupied cell only
      if (cell.classList.contains('occ')) {
        mSel = idx;
      }
    } else {
      // Any second click on pfield = swap completed or cancelled by battle.html
      mSel = null;
    }
    // applyHighlight() will run via the wrapped render() that battle.html calls
    // after its own click handler. Call it here too for instant feedback.
    applyHighlight();
  }, false);
```

- [ ] **Step 2: Verify tap-select highlight works**

In mobile viewport (game in shop phase): tap an occupied cell in the player field. It must immediately get a gold border. All other cells must get a green tint. Tap any other cell — the highlight must clear (and the swap happens if valid). Tap the same cell again — highlight clears (deselect).

- [ ] **Step 3: Verify highlight clears after battle starts**

Click FAB to start the battle. During combat (phase = "battle"), tapping cells must not leave stale highlights — the render() cycle must clear them correctly since mSel resets to null on any second pfield click.

- [ ] **Step 4: Verify desktop unaffected**

On desktop viewport: `window.render` wrap happens only if mobile.js runs, which early-returns for non-mobile. Desktop drag-and-drop must work exactly as before.

- [ ] **Step 5: Commit**

```bash
git add public/mobile.js
git commit -m "feat(mobile): tap-select cell highlight with render() wrap"
```

---

## Task 9: Full integration smoke test

**Files:** none changed — verification only

- [ ] **Step 1: Full AI game on mobile viewport**

Set DevTools to 375×812, touch enabled. Inject config and open `battle.html`. Play a full AI game:
1. Shop phase: buy 2 cards, place them on the field via tap-select
2. Verify bench scrolls horizontally when full
3. Verify shop scrolls horizontally
4. Tap FAB → battle must start
5. Watch combat animation
6. Duel result screen must appear without horizontal overflow
7. Click "Next Duel" — must proceed to next round

- [ ] **Step 2: Full desktop game (regression check)**

Switch DevTools back to desktop (1280px, no device simulation). Inject config, play a full game. Drag-and-drop units must work. No visual changes from pre-mobile baseline. No JS errors in console.

- [ ] **Step 3: Safe area check (iPhone simulation)**

In DevTools, select "iPhone 14 Pro" preset (has notch). Verify `#hdr` isn't clipped by notch. Verify FAB is above the home indicator bar.

- [ ] **Step 4: Landscape block check**

On mobile viewport, rotate to landscape (DevTools orientation toggle). Rotate overlay must appear. Game must be hidden. Rotate back to portrait — game reappears without needing a page reload.

- [ ] **Step 5: Final commit if any fixes applied**

```bash
git add public/mobile.css public/mobile.js public/battle.html
git commit -m "fix(mobile): integration fixes from smoke test"
```

---

## Self-Review Checklist

Spec coverage vs tasks:

| Spec requirement | Task |
|---|---|
| viewport meta tag | Task 1 |
| mobile.css + mobile.js referenced in battle.html | Task 1 |
| Landscape rotate overlay (CSS) | Task 2 |
| Landscape rotate overlay (DOM) | Task 3 |
| Mobile detection (pointer: coarse) | Task 3 |
| `--s` scale factor 0.85 / 0.78 | Task 4 |
| Arena fields stacked vertically | Task 4 |
| VS → horizontal separator | Task 4 |
| turnpanel hidden | Task 4 |
| Bottom zone vertical stack | Task 5 |
| center-col hidden | Task 5 |
| bench + shop horizontal scroll | Task 5 |
| Header compact | Task 6 |
| Banner ellipsis | Task 6 |
| Safe areas (notch / home indicator) | Task 6 |
| Duel result safe areas | Task 6 |
| FAB CSS styles | Task 6 |
| FAB DOM injection | Task 7 |
| FAB → startBattle() | Task 7 |
| FAB MutationObserver sync | Task 7 |
| Tap-select mSel tracking | Task 8 |
| .m-selected + .m-valid-drop classes | Task 8 |
| window.render wrap | Task 8 |
| Click outside pfield resets mSel | Task 8 |
| Desktop unaffected | Tasks 3, 7, 8, 9 |
| PvP socket unaffected | Task 9 (smoke test) |
