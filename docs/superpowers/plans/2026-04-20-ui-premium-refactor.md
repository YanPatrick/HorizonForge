# UI Premium Refactor — Compact Auto-Battler Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `battle.html` visual presentation to a clean, compact premium auto-battler UI inspired by TFT/Clash Royale/Rumble Arcade — without touching any game logic.

**Architecture:** All changes are confined to `public/battle.html` (single-file app). CSS changes use `display:none` or property overrides to hide unwanted elements without removing them from the DOM (preserving all `data-*` attributes and JS hooks). The JS change is a single numeric constant sync in `renderShop`. No combat logic is touched.

**Tech Stack:** Vanilla CSS (custom properties, flex, grid), inline HTML, vanilla JS (one constant update)

---

## File Map

| File | What changes |
|------|-------------|
| `public/battle.html` | `:root` CSS vars (sizes), `.usts` hidden, `.uhb` thicker, arena fog reduced, `.csts` hidden, `.scard`/`.bcard` padding compacted, `.cportrait` height reduced, `renderShop` JS constant |

---

### Task 1: CSS custom properties — new compact dimensions

**Files:**
- Modify: `public/battle.html` — `:root` block at line ~25

The current values and what they become:

| Variable | Current | New |
|----------|---------|-----|
| `--card-w` | `106px` | `90px` |
| `--bcard-w` | `96px` | `82px` |
| `--bottom-h` | `220px` | `200px` |
| `--shop-w` | `590px` | `500px` |
| `--bench-w` | `590px` | `540px` |

`--shop-w` drives the absolute positioning container width for shop cards. `--card-w` and `--shop-w` MUST be kept in sync with JS constants in `renderShop` (done in Task 5).

- [ ] **Step 1: Update `:root` CSS variables**

Find this exact block (around line 25):
```css
        --bottom-h: calc(220px * var(--s));
        --bench-w: calc(590px * var(--s));
        --shop-w: calc(590px * var(--s));
        --card-w: calc(106px * var(--s));
        --card-gap: calc(6px * var(--s));
        --bcard-w: calc(96px * var(--s));
```

Replace with:
```css
        --bottom-h: calc(200px * var(--s));
        --bench-w: calc(540px * var(--s));
        --shop-w: calc(500px * var(--s));
        --card-w: calc(90px * var(--s));
        --card-gap: calc(6px * var(--s));
        --bcard-w: calc(82px * var(--s));
```

- [ ] **Step 2: Verify the grep output**

```bash
grep -n "\-\-card-w:\|\-\-bcard-w:\|\-\-shop-w:\|\-\-bottom-h:" public/battle.html | head -20
```

Expected: lines showing `90px`, `82px`, `500px`, `200px` in the `:root` block (and the mobile.css overrides if any — those are separate and fine).

- [ ] **Step 3: Commit**

```bash
git add public/battle.html
git commit -m "refactor(ui): compact CSS vars — card 90px, bcard 82px, shop 500px, bottom 200px"
```

---

### Task 2: Battlefield unit — hide stats, thicken HP bar, reduce arena fog

**Files:**
- Modify: `public/battle.html` — `.usts`, `.uhb`, `field::before` CSS sections

**What this does:**
- `.usts { display: none }` — hides the HP/ATK/SPD number row (the `[data-uhp]` and `[data-uatk]` elements remain in DOM so `updHp`/`updAtk` JS still work via null-safe querySelector).
- `.uhb` height bumped from `3px` to `5px` — more readable progress bar.
- `.uhf` gets a `background-color` transition for smoother colour state changes.
- `field::before` fog opacity reduced from `0.6` to `0.18` — removes the heavy "shadow overlay in the middle of the arena".

- [ ] **Step 1: Hide unit stats row**

Find:
```css
      .usts {
        display: flex;
        gap: calc(5px * var(--s));
        justify-content: center;
        margin-top: calc(2px * var(--s));
        width: 100%;
      }
```

Replace with:
```css
      .usts {
        display: none;
      }
```

- [ ] **Step 2: Thicken the HP bar**

Find:
```css
      .uhb {
        width: 100%;
        height: calc(3px * var(--s));
        background: rgba(0, 0, 0, 0.55);
        border-radius: 2px;
        margin-top: calc(2px * var(--s));
        overflow: hidden;
      }
```

Replace with:
```css
      .uhb {
        width: 90%;
        height: calc(5px * var(--s));
        background: rgba(0, 0, 0, 0.6);
        border-radius: 3px;
        margin-top: calc(3px * var(--s));
        overflow: hidden;
      }
```

- [ ] **Step 3: Add smooth colour transition to HP bar fill**

Find:
```css
      .uhf {
        height: 100%;
        border-radius: 2px;
        transition: width 0.35s;
      }
```

Replace with:
```css
      .uhf {
        height: 100%;
        border-radius: 3px;
        transition: width 0.4s ease, filter 0.4s ease;
      }
```

- [ ] **Step 4: Reduce arena fog overlay (PHASE 2 block)**

Find this rule inside the `/* PHASE 2 — BATTLEFIELD VISUAL DEPTH */` section:
```css
      /* Atmospheric fog anchored to the bottom of each field */
      .field::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: inherit;
        background: radial-gradient(
          ellipse 92% 40% at 50% 100%,
          rgba(16, 8, 52, 0.6) 0%,
          transparent 70%
```

Replace the `rgba(16, 8, 52, 0.6)` with `rgba(16, 8, 52, 0.18)`:
```css
      /* Atmospheric fog anchored to the bottom of each field */
      .field::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: inherit;
        background: radial-gradient(
          ellipse 92% 40% at 50% 100%,
          rgba(16, 8, 52, 0.18) 0%,
          transparent 70%
```

- [ ] **Step 5: Verify**

```bash
grep -n "display: none\|height: calc(5px\|rgba(16, 8, 52" public/battle.html | head -15
```

Expected: `.usts { display: none; }`, the `5px` HP bar height, and `0.18` for the fog opacity.

- [ ] **Step 6: Commit**

```bash
git add public/battle.html
git commit -m "refactor(ui): hide unit stats, thicker HP bar, lighter arena fog"
```

---

### Task 3: Shop card — hide stats, compact portrait, tighter padding

**Files:**
- Modify: `public/battle.html` — `.csts`, `.cportrait`, `.scard`, `.cico` CSS

**What this does:**
- `.csts { display: none }` — removes HP/ATK/SPD block from shop cards.
- `.cportrait` height reduced `52px → 44px` — shorter portrait zone makes card more compact.
- `.cportrait .cico` reduced `34px → 28px` — icon scales down to match.
- `.scard` top/bottom padding reduced.

- [ ] **Step 1: Hide shop stats block**

Find:
```css
      .csts {
        display: flex;
        gap: calc(5px * var(--s));
        margin-top: calc(3px * var(--s));
        background: rgba(0, 0, 0, 0.25);
        border-radius: calc(6px * var(--s));
        padding: calc(2px * var(--s)) calc(5px * var(--s));
        width: 100%;
        justify-content: space-around;
      }
```

Replace with:
```css
      .csts {
        display: none;
      }
```

- [ ] **Step 2: Compact portrait height**

Find (inside PHASE 3 section):
```css
      .cportrait {
        width: 100%;
        height: calc(52px * var(--s));
        border-radius: calc(8px * var(--s));
```

Replace with:
```css
      .cportrait {
        width: 100%;
        height: calc(44px * var(--s));
        border-radius: calc(8px * var(--s));
```

- [ ] **Step 3: Scale down portrait icon**

Find (inside PHASE 3 section):
```css
      /* Icon inside portrait zone — centered, larger, grounded shadow */
      .cportrait .cico {
        margin-top: 0 !important;
        font-size: calc(34px * var(--s)) !important;
```

Replace with:
```css
      /* Icon inside portrait zone — centered, larger, grounded shadow */
      .cportrait .cico {
        margin-top: 0 !important;
        font-size: calc(28px * var(--s)) !important;
```

- [ ] **Step 4: Tighten scard padding**

Find:
```css
      .scard {
        width: var(--card-w);
        min-width: var(--card-w);
        max-width: var(--card-w);
        border-radius: calc(12px * var(--s));
        border: 2px solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: calc(8px * var(--s)) calc(7px * var(--s)) calc(6px * var(--s));
        gap: calc(2px * var(--s));
```

Replace with:
```css
      .scard {
        width: var(--card-w);
        min-width: var(--card-w);
        max-width: var(--card-w);
        border-radius: calc(10px * var(--s));
        border: 2px solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: calc(6px * var(--s)) calc(5px * var(--s)) calc(5px * var(--s));
        gap: calc(2px * var(--s));
```

- [ ] **Step 5: Verify**

```bash
grep -n "display: none\|height: calc(44px\|font-size: calc(28px" public/battle.html | head -10
```

Expected: `.csts { display: none; }`, portrait height `44px`, icon `28px`.

- [ ] **Step 6: Commit**

```bash
git add public/battle.html
git commit -m "refactor(ui): shop card — hide stats, compact portrait 44px, tighter padding"
```

---

### Task 4: Barracks — compact card sizing and padding

**Files:**
- Modify: `public/battle.html` — `.bcard`, `.cportrait` (bench context) CSS

**What this does:**
- `.bcard` padding reduced from `6px/5px` to `5px/4px`.
- `.bcard` border-radius reduced slightly.
- `.bsell-hint` height reduced to match.
- `.cnm` font-size reduced `10px → 9px` for tighter name row.
- `.crole` stays as-is.

- [ ] **Step 1: Tighten bcard padding and radius**

Find:
```css
      .bcard {
        flex: 1 1 0;
        min-width: 0;
        max-width: var(--bcard-w);
        border-radius: calc(12px * var(--s));
        border: 2px solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: calc(6px * var(--s)) calc(5px * var(--s)) calc(5px * var(--s));
        gap: calc(2px * var(--s));
        position: relative;
        cursor: pointer;
        transition: all 0.22s;
        overflow: visible;
      }
```

Replace with:
```css
      .bcard {
        flex: 1 1 0;
        min-width: 0;
        max-width: var(--bcard-w);
        border-radius: calc(10px * var(--s));
        border: 2px solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: calc(5px * var(--s)) calc(4px * var(--s)) calc(4px * var(--s));
        gap: calc(2px * var(--s));
        position: relative;
        cursor: pointer;
        transition: all 0.22s;
        overflow: visible;
      }
```

- [ ] **Step 2: Reduce card name font size for tighter layout**

Find:
```css
      .cnm {
        font-size: calc(10px * var(--s));
        font-weight: 800;
        text-align: center;
        letter-spacing: 0.3px;
        margin-top: calc(2px * var(--s));
      }
```

Replace with:
```css
      .cnm {
        font-size: calc(9px * var(--s));
        font-weight: 800;
        text-align: center;
        letter-spacing: 0.2px;
        margin-top: calc(1px * var(--s));
      }
```

- [ ] **Step 3: Verify**

```bash
grep -n "border-radius: calc(10px\|font-size: calc(9px" public/battle.html | head -10
```

Expected: `10px` radius on `.bcard` and `.scard`, `9px` on `.cnm`.

- [ ] **Step 4: Commit**

```bash
git add public/battle.html
git commit -m "refactor(ui): barracks card — compact padding, smaller name, tighter radius"
```

---

### Task 5: JS sync — renderShop card width constant

**Files:**
- Modify: `public/battle.html` — `renderShop` function (inside the `<script>` block)

**Why:** The `renderShop` function computes shop card positions using **hardcoded pixel constants** (`106 * s` for card width, `590 * s` for container width). These must match the CSS custom properties updated in Task 1. A mismatch causes cards to be mispositioned.

Math check: `5 cards × 90px + 4 gaps × 6px = 474px total`. Container inner = `500px - 14px padding = 486px`. `startX = (486 - 474) / 2 = 6px` — centered with 6px each side. ✓

- [ ] **Step 1: Update card width constant in renderShop**

Find:
```js
        const cardW = Math.round(106 * s),
          gap = Math.round(6 * s);
        const shopWrapInner = Math.round(590 * s) - Math.round(7 * s) * 2;
```

Replace with:
```js
        const cardW = Math.round(90 * s),
          gap = Math.round(6 * s);
        const shopWrapInner = Math.round(500 * s) - Math.round(7 * s) * 2;
```

- [ ] **Step 2: Verify**

```bash
grep -n "cardW = Math.round\|shopWrapInner" public/battle.html
```

Expected output:
```
NNNN:        const cardW = Math.round(90 * s),
NNNN:        const shopWrapInner = Math.round(500 * s) - Math.round(7 * s) * 2;
```

- [ ] **Step 3: Commit**

```bash
git add public/battle.html
git commit -m "fix(ui): sync renderShop JS constants with new CSS card-w 90px / shop-w 500px"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Remove large shadow overlay in middle of arena → Task 2 Step 4 (field::before opacity 0.6 → 0.18)
- [x] Hero cards: keep portrait/icon, name/class, evolution markers, skill name → hidden by CSS only, DOM untouched
- [x] HP bar: horizontal, smooth animation, green/yellow/red states → Tasks 2 Steps 2–3 (existing bar enhanced)
- [x] Contact shadow under units → already in Phase 2 CSS (`.cell.occ::after` anchor aura) — no change needed
- [x] No HP/ATK/SPD numbers on battlefield → Task 2 Step 1 (`.usts { display:none }`)
- [x] Shop: remove HP/ATK/SPD → Task 3 Step 1 (`.csts { display:none }`)
- [x] Shop: keep portrait, name, skill, class → untouched
- [x] Shop: smaller, more compact → Tasks 3 + 5 (`--card-w 90px`, reduced padding)
- [x] Barracks: keep structure, reduce size, more compact → Task 4
- [x] Responsiveness: CSS vars scale with `--s`, mobile.css overrides still apply on top
- [x] No game logic touched → all changes are CSS `display:none` or property tweaks + one JS layout constant

**Placeholder scan:** None found — every step has exact find/replace code.

**Type consistency:** No new functions or types introduced. All existing class names and data attributes preserved.

**Risk notes:**
- `updHp` uses `el.querySelector("[data-uhp]")` — the element still exists in DOM (inside hidden `.usts`), querySelector will still find it, but the element is not visible. The HP bar (`.uhf`) still animates visibly. `updAtk` similarly safe.
- `auraBonus` / `hpClass` logic in `renderCell` still runs but its output goes to a hidden span — zero risk.
- Mobile CSS overrides in `mobile.css` use `!important` on card widths — they will override the new CSS vars on mobile as before. No conflict.
