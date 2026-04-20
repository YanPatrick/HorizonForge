# Battle Mobile Phase 1 — Layout Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `--s: 0.50` scale hack with a true vertical mobile layout where the battlefield fills the screen, the bottom zone is compact, and the header is a single pill row.

**Architecture:** All changes are confined to `public/mobile.css`. The battlefield grid switches from fixed `calc(Xpx * var(--s))` cell sizes to `1fr` columns with `aspect-ratio: 1/1`, filling 100% width naturally. The bottom zone is capped at `45dvh` with internal scroll. No JS, no battle.html edits — zero combat logic risk.

**Tech Stack:** CSS (custom properties, grid, dvh units, aspect-ratio, safe-area-inset)

---

### Task 1: Remove scale hack and fix arena flex height

**Files:**
- Modify: `public/mobile.css` — remove `--s: 0.50`, reset `#arena-wrap` and `#fields-row` for true vertical fill

- [ ] **Step 1: Remove `--s: 0.50` override and add arena fill rules**

Replace the existing block at the top of the `@media (max-width: 480px) and (pointer: coarse)` section:

```css
/* REMOVE this: */
:root {
  --s: 0.50;
}
```

And replace with:

```css
:root {
  --s: 0.72;          /* mild scale-down only — cells still use px via --s */
  --cell-w: 1fr;      /* overridden below via grid approach */
  --cell-h: auto;
}
```

Then ensure these arena rules are present (update existing overrides):

```css
/* ── Arena: fill vertical space between header and bottom-zone ── */
#arena-wrap {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  flex-direction: column !important;
  overflow: hidden !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  padding: 0 !important;
}

#fields-row {
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0 !important;
  width: 100% !important;
  flex: 1 1 0 !important;
  min-height: 0 !important;
}
```

- [ ] **Step 2: Verify the file saved correctly**

```bash
grep -n "\-\-s:" public/mobile.css | head -10
```

Expected: only one line with `--s: 0.72` (not `0.50` or `0.44`).

- [ ] **Step 3: Commit**

```bash
git add public/mobile.css
git commit -m "refactor(mobile): replace --s scale hack with --s 0.72 + arena flex fill"
```

---

### Task 2: Make battlefield cells fill available width (1fr grid)

**Files:**
- Modify: `public/mobile.css` — override `.field`, `.fwrap`, `.cell` for percentage-based sizing

- [ ] **Step 1: Override field grid to use 1fr columns**

Add/replace these rules inside the `@media (max-width: 480px) and (pointer: coarse)` block:

```css
/* ── Field wrappers: fill available height equally ── */
.fwrap {
  width: 100% !important;
  flex: 1 1 0 !important;
  min-height: 0 !important;
  align-items: center !important;
}

/* ── Battlefield grid: 1fr columns, square cells ── */
.field {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  grid-template-rows: repeat(3, 1fr) !important;
  gap: 4px !important;
  padding: 6px !important;
  width: min(100%, calc(100dvh * 0.38)) !important;  /* keep roughly square */
  height: 100% !important;
  max-height: min(42dvw * 3 + 20px, 38dvh) !important;
  border-radius: 10px !important;
}

/* ── Cells: always square, fill column ── */
.cell {
  width: 100% !important;
  height: 100% !important;
  aspect-ratio: 1 / 1 !important;
  border-radius: 6px !important;
  min-width: 0 !important;
  min-height: 0 !important;
}

/* Drop-target orbs scale with cell size */
.cell.dr::after {
  width: 20px !important;
  height: 20px !important;
}
```

- [ ] **Step 2: Override hero cards inside cells to fill the cell**

Hero cards (`.hero-card` equiv = the div rendered by `renderCell`) need to not overflow:

```css
/* Cards on battlefield scale to cell */
.cell > div {
  max-width: 100% !important;
  max-height: 100% !important;
  overflow: hidden !important;
}
```

- [ ] **Step 3: Verify grep**

```bash
grep -n "grid-template-columns\|1fr\|aspect-ratio" public/mobile.css
```

Expected: lines showing `repeat(3, 1fr)` and `aspect-ratio: 1 / 1`.

- [ ] **Step 4: Commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): battlefield grid uses 1fr columns with square cells"
```

---

### Task 3: Compact header to single pill row

**Files:**
- Modify: `public/mobile.css` — make `#hdr` a single 48px horizontal row, hide verbose stats

- [ ] **Step 1: Override header layout**

```css
/* ── Header: single compact pill row ── */
#hdr {
  flex-direction: row !important;
  align-items: center !important;
  justify-content: space-between !important;
  max-width: 100% !important;
  padding: 0 12px !important;
  height: 44px !important;
  min-height: 44px !important;
  gap: 6px !important;
  flex-shrink: 0 !important;
  flex-wrap: nowrap !important;
  overflow: hidden !important;
}

/* Show both header rows as inline flex items */
.hdr-row-top,
.hdr-row-bottom {
  flex: 0 0 auto !important;
  flex-wrap: nowrap !important;
  gap: 5px !important;
  align-items: center !important;
  overflow: hidden !important;
}

/* Hide verbose stat badges — keep gold and round only */
.hstats {
  display: none !important;
}

/* Banner: single line */
#banner {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 130px !important;
  font-size: 10px !important;
}

/* Phase timer stays visible but smaller */
#phase-timer {
  font-size: 12px !important;
  padding: 3px 10px !important;
  min-width: 60px !important;
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "height: 44px\|flex-direction: row !important" public/mobile.css | head -10
```

Expected: lines showing the 44px header height.

- [ ] **Step 3: Commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): compact header to 44px single pill row"
```

---

### Task 4: Bottom zone max-height cap and card sizing

**Files:**
- Modify: `public/mobile.css` — cap `#bottom-zone` at `45dvh`, ensure shop/bench cards are usable size

- [ ] **Step 1: Override bottom-zone to be compact and capped**

```css
/* ── Bottom zone: compact, capped, no overflow crush ── */
#bottom-zone {
  flex-direction: column !important;
  height: auto !important;
  max-height: 44dvh !important;
  flex-shrink: 0 !important;
  overflow: hidden !important;
  gap: 4px !important;
  padding-bottom: calc(env(safe-area-inset-bottom) + 6px) !important;
}

/* Order: Battle button first, then shop, then barracks */
#center-col {
  order: 1 !important;
  width: 100% !important;
  max-width: none !important;
  flex: 0 0 auto !important;
  flex-direction: row !important;     /* btn and timer side by side */
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 4px 12px !important;
}

/* Battle button: prominent, touch-friendly */
.bbtn {
  flex: 1 1 auto !important;
  height: 44px !important;
  font-size: 14px !important;
  max-width: 200px !important;
}

/* Log: hidden on mobile (accessible via log overlay) */
#log {
  display: none !important;
}

#shopwrap {
  order: 2 !important;
  width: 100% !important;
  max-width: none !important;
  flex-shrink: 0 !important;
}

#benchwrap {
  order: 3 !important;
  width: 100% !important;
  max-width: none !important;
  flex-shrink: 1 !important;
  max-height: none !important;
  transition: none !important;
}
```

- [ ] **Step 2: Ensure shop/bench cards are a usable size (not too small)**

```css
/* Shop cards: 58px wide, hide low-priority elements */
.scard {
  position: static !important;
  left: auto !important;
  top: auto !important;
  flex-shrink: 0 !important;
  width: 58px !important;
  min-width: 58px !important;
  max-width: 58px !important;
  padding: 5px 4px 4px !important;
}

/* Bench cards: 54px wide */
.bcard {
  flex: 0 0 auto !important;
  width: 54px !important;
  min-width: 54px !important;
  max-width: 54px !important;
  padding: 5px 4px 4px !important;
}

/* Icons readable */
.scard .cico,
.bcard .cico {
  font-size: 22px !important;
  margin-top: 2px !important;
}

/* Name readable */
.scard .cnm,
.bcard .cnm {
  font-size: 7.5px !important;
  margin-top: 1px !important;
}

/* Hide non-essential elements */
.scard .crole,
.scard .cabi,
.scard .caction,
.bcard .crole,
.bcard .cabi,
.bcard .bsell-hint,
.bcard .bprog {
  display: none !important;
}

/* Stats: horizontal, hide speed */
.scard .csts {
  flex-direction: row !important;
  gap: 2px !important;
  padding: 1px 2px !important;
  margin-top: 2px !important;
}
.scard .csts .cst:nth-child(3) { display: none !important; }
.scard .cstv,
.bcard .cstv { font-size: 7px !important; }
.scard .cstl,
.bcard .cstl { font-size: 5px !important; }
```

- [ ] **Step 3: Verify**

```bash
grep -n "44dvh\|max-height: 44dvh\|width: 58px" public/mobile.css
```

Expected: lines showing the dvh cap and card widths.

- [ ] **Step 4: Commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): bottom zone capped at 44dvh, cards 58/54px, battle btn prominent"
```

---

### Task 5: VS divider polish and small-phone override cleanup

**Files:**
- Modify: `public/mobile.css` — VS divider as horizontal line, remove old 380px `--s: 0.44` override, clean up

- [ ] **Step 1: Refine VS divider**

```css
/* ── VS divider: horizontal line with badge ── */
#vs {
  width: 100% !important;
  height: 22px !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  order: 2 !important;
}

#vs::before {
  top: 50% !important;
  bottom: auto !important;
  left: 6% !important;
  right: 6% !important;
  width: auto !important;
  height: 1px !important;
  transform: none !important;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(255, 180, 60, 0.45) 20%,
    rgba(255, 200, 100, 0.65) 50%,
    rgba(255, 180, 60, 0.45) 80%,
    transparent 100%
  ) !important;
}

.vstxt {
  font-size: 9px !important;
  letter-spacing: 2px !important;
}

/* Field order: enemy top, VS middle, player bottom */
#fields-row > .fwrap:first-child { order: 3 !important; }
#vs                               { order: 2 !important; }
#fields-row > .fwrap:last-child   { order: 1 !important; }
```

- [ ] **Step 2: Replace broken 380px override**

Find and replace the old `@media (max-width: 380px) and (pointer: coarse)` block:

```css
/* Old block to remove: */
/* @media (max-width: 380px) and (pointer: coarse) {
  :root { --s: 0.44; }
} */
```

Replace with:

```css
/* Very small phones: tighter bottom padding only */
@media (max-width: 380px) and (pointer: coarse) {
  #bottom-zone {
    max-height: 46dvh !important;
  }
  .scard {
    width: 52px !important;
    min-width: 52px !important;
  }
  .bcard {
    width: 48px !important;
    min-width: 48px !important;
  }
}
```

- [ ] **Step 3: Hide turn panel (no space on mobile)**

```css
#turnpanel {
  display: none !important;
}
```

- [ ] **Step 4: Verify final structure**

```bash
grep -n "@media\|--s:" public/mobile.css
```

Expected output: two `@media` blocks (480px portrait, 380px portrait). `--s: 0.72` on line ~57. No `0.50` or `0.44`.

- [ ] **Step 5: Final commit**

```bash
git add public/mobile.css
git commit -m "feat(mobile): VS divider polish, remove --s 0.44 hack, clean small-phone override"
```

---

## Self-Review Checklist

- [x] Scale hack (`--s: 0.50`) fully removed from 480px block → Task 1
- [x] Scale hack (`--s: 0.44`) replaced in 380px block → Task 5  
- [x] Arena fills vertical space between header and bottom zone → Task 1
- [x] Battlefield grid uses 1fr, cells are square → Task 2
- [x] Header is 44px single row → Task 3
- [x] Bottom zone capped at 44dvh → Task 4
- [x] Battle button is touch-friendly 44px → Task 4
- [x] Cards are 58/54px (bigger than current 52/50px) → Task 4
- [x] VS divider is horizontal → Task 5
- [x] All changes are CSS-only, zero combat logic risk → architecture confirmed
