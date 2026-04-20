# Hero Card Interaction System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `#view-formation` in `public/lobby.html` so hero cards have a hover glow, open a detail drawer (desktop) or bottom sheet (mobile) on click, and disable all detail interactions while the deck-editing slide panel is open.

**Architecture:** All changes live in `public/lobby.html` (CSS + HTML + JS). New CSS classes control two mutually-exclusive card states: _Normal_ (hover + detail click enabled) and _Deck Editing_ (`.fhc-editing-mode` on the grid, detail interactions suppressed). Two fixed-position panels—`.hf-hero-drawer` (right, desktop) and `.hf-hero-sheet` (bottom, mobile)—are populated by `openHeroDetail(cid)`, which looks up the hero in the existing `_heroData` array.

**Tech Stack:** Vanilla JS, CSS custom properties, existing `_heroData` / `_editingOpen` closure variables already in scope inside the formation IIFE.

---

## File Map

| File | What changes |
|---|---|
| `public/lobby.html` | CSS additions (cards, info btn, drawer, sheet, detail content), HTML additions (drawer + sheet + backdrop elements), JS modifications (`_renderFormHeroGrid`, `openDeckSlot`, `closeDeckSlot`) + new JS functions (`openHeroDetail`, `closeHeroDetail`, `toggleHeroDetailL2`) |

---

## Task 1: CSS — Card hover glow + editing-mode suppressor

**Files:**
- Modify: `public/lobby.html` — CSS block, after `.form-hero-card.fhc-disabled` rule (~line 2300)

- [ ] **Step 1: Upgrade the hover rule and add editing-mode CSS**

Find this existing block:
```css
.form-hero-card:hover:not(.fhc-disabled) {
  border-color: rgba(170, 128, 255, 0.45);
  background: rgba(140, 100, 255, 0.1);
  transform: translateY(-2px);
}
```

Replace it with:
```css
.form-hero-card:hover:not(.fhc-disabled) {
  border-color: rgba(170, 128, 255, 0.55);
  background: rgba(140, 100, 255, 0.12);
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 0 18px rgba(140, 100, 255, 0.28);
}

/* Deck-editing mode: suppress hover glow and detail interactions */
#form-hero-grid.fhc-editing-mode .form-hero-card:hover {
  transform: none;
  box-shadow: none;
  border-color: rgba(140, 100, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 2: Verify manually**

Open `public/lobby.html` in the browser, navigate to Formation view. Hover over a hero card — expect glow + slight lift + scale. No functional test file; manual check only.

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): upgrade card hover glow and add editing-mode suppressor"
```

---

## Task 2: CSS — Info button (`.fhc-info-btn`)

**Files:**
- Modify: `public/lobby.html` — CSS block, after the editing-mode block added in Task 1

- [ ] **Step 1: Add info button CSS**

Insert after the block added in Task 1:
```css
/* ── Info button on hero card ── */
.fhc-info-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(140, 100, 255, 0.18);
  border: 1px solid rgba(140, 100, 255, 0.38);
  color: rgba(180, 155, 255, 0.75);
  font-family: "Exo 2", sans-serif;
  font-size: 9px;
  font-weight: 700;
  font-style: normal;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  z-index: 1;
  line-height: 1;
  -webkit-tap-highlight-color: transparent;
}
.fhc-info-btn:hover {
  background: rgba(140, 100, 255, 0.35);
  color: rgba(210, 190, 255, 0.95);
}
/* Hide info button in deck-editing mode */
#form-hero-grid.fhc-editing-mode .fhc-info-btn {
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add info button CSS for hero cards"
```

---

## Task 3: CSS — Detail backdrop + Desktop drawer

**Files:**
- Modify: `public/lobby.html` — CSS block, before `</style>` tag

- [ ] **Step 1: Add backdrop + drawer CSS**

Find `</style>` and insert before it:
```css
/* ══════════════════════════════
   HERO DETAIL PANELS
══════════════════════════════ */

/* Shared backdrop */
.hf-detail-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 800;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.hf-detail-backdrop.hf-open {
  opacity: 1;
  pointer-events: auto;
}

/* Desktop right-side drawer */
.hf-hero-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
  background: rgba(8, 4, 24, 0.99);
  border-left: 1.5px solid rgba(140, 100, 255, 0.3);
  box-shadow: -12px 0 48px rgba(0, 0, 0, 0.65);
  z-index: 801;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.34, 1.06, 0.64, 1);
  overflow: hidden;
}
.hf-hero-drawer.hf-open {
  transform: translateX(0);
}

/* On mobile the drawer is never shown — bottom sheet takes over */
@media (max-width: 640px) {
  .hf-hero-drawer {
    display: none !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add hero detail backdrop and desktop drawer CSS"
```

---

## Task 4: CSS — Mobile bottom sheet

**Files:**
- Modify: `public/lobby.html` — CSS block, after drawer CSS added in Task 3

- [ ] **Step 1: Add bottom sheet CSS**

Insert after the drawer block:
```css
/* Mobile bottom sheet */
.hf-hero-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 65vh;
  background: rgba(8, 4, 24, 0.99);
  border-top: 1.5px solid rgba(140, 100, 255, 0.3);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.65);
  z-index: 801;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.28s ease;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.hf-hero-sheet.hf-open {
  transform: translateY(0);
}
.hf-sheet-handle {
  width: 36px;
  height: 4px;
  background: rgba(140, 100, 255, 0.3);
  border-radius: 2px;
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* On desktop the sheet is never shown — drawer takes over */
@media (min-width: 641px) {
  .hf-hero-sheet {
    display: none !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add hero detail mobile bottom sheet CSS"
```

---

## Task 5: CSS — Detail panel inner content

**Files:**
- Modify: `public/lobby.html` — CSS block, after bottom sheet CSS added in Task 4

- [ ] **Step 1: Add detail content CSS**

Insert after the bottom sheet block:
```css
/* ── Shared inner content (used by both drawer and sheet) ── */
.hf-detail-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px 24px;
}
.hf-detail-scroll::-webkit-scrollbar {
  width: 4px;
}
.hf-detail-scroll::-webkit-scrollbar-thumb {
  background: rgba(140, 100, 255, 0.3);
  border-radius: 4px;
}

/* Close button row */
.hf-detail-close-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(140, 100, 255, 0.1);
}
.hf-detail-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(200, 190, 240, 0.7);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.hf-detail-close-btn:hover {
  background: rgba(140, 100, 255, 0.18);
  color: rgba(220, 210, 255, 0.95);
}

/* Hero header (icon + name) */
.hf-detail-hero-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hf-detail-ico {
  font-size: 36px;
  line-height: 1;
  flex-shrink: 0;
}
.hf-detail-hero-name {
  font-family: "Cinzel", serif;
  font-size: 16px;
  font-weight: 700;
  color: rgba(240, 230, 255, 0.95);
  letter-spacing: 0.5px;
}
.hf-detail-role-wrap {
  margin-top: 14px;
}

/* Skill section */
.hf-detail-section-label {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(140, 100, 255, 0.6);
  margin-bottom: 6px;
  margin-top: 16px;
}
.hf-detail-skill-name {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 210, 80, 0.9);
  margin-bottom: 4px;
}
.hf-detail-skill-desc {
  font-size: 12px;
  color: rgba(195, 180, 235, 0.65);
  line-height: 1.55;
}

/* Stats 2×2 grid */
.hf-detail-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}
.hf-detail-stat {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(140, 100, 255, 0.14);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hf-stat-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(140, 100, 255, 0.55);
}
.hf-stat-value {
  font-size: 15px;
  font-weight: 700;
  color: rgba(230, 220, 255, 0.92);
  font-family: "Exo 2", sans-serif;
}

/* Level 2 expand button */
.hf-detail-l2-btn {
  width: 100%;
  margin-top: 16px;
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(140, 100, 255, 0.08);
  border: 1px solid rgba(140, 100, 255, 0.22);
  color: rgba(180, 155, 255, 0.8);
  font-family: "Exo 2", sans-serif;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hf-detail-l2-btn:hover {
  background: rgba(140, 100, 255, 0.15);
  border-color: rgba(140, 100, 255, 0.4);
}
.hf-l2-chevron {
  font-size: 10px;
  transition: transform 0.2s ease;
}
.hf-l2-chevron.expanded {
  transform: rotate(180deg);
}

/* Level 2 stats table */
.hf-detail-l2 {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.25s ease;
}
.hf-detail-l2.expanded {
  max-height: 400px;
}
.hf-detail-l2-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-family: "Exo 2", sans-serif;
  font-size: 11px;
}
.hf-detail-l2-table th {
  text-align: left;
  padding: 4px 6px;
  color: rgba(140, 100, 255, 0.6);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border-bottom: 1px solid rgba(140, 100, 255, 0.14);
}
.hf-detail-l2-table td {
  padding: 5px 6px;
  color: rgba(210, 200, 240, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.hf-detail-l2-table tr:last-child td {
  border-bottom: none;
}
.hf-detail-l2-table td:first-child {
  color: rgba(140, 100, 255, 0.7);
  font-weight: 700;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add hero detail panel inner content CSS"
```

---

## Task 6: HTML — Backdrop + drawer + sheet elements

**Files:**
- Modify: `public/lobby.html` — HTML body, before `</body>` closing tag

- [ ] **Step 1: Add the three panel elements**

Find `</body>` and insert immediately before it:
```html
<!-- ── Hero Detail Backdrop ── -->
<div class="hf-detail-backdrop" id="hf-detail-backdrop" onclick="closeHeroDetail()"></div>

<!-- ── Hero Detail Drawer (desktop right-side) ── -->
<div class="hf-hero-drawer" id="hf-hero-drawer" role="dialog" aria-modal="true" aria-label="Hero Details">
  <div class="hf-detail-close-row">
    <div class="hf-detail-hero-header" id="hf-drawer-header">
      <span class="hf-detail-ico" id="hf-drawer-ico"></span>
      <span class="hf-detail-hero-name" id="hf-drawer-name"></span>
    </div>
    <button class="hf-detail-close-btn" onclick="closeHeroDetail()" aria-label="Close">✕</button>
  </div>
  <div class="hf-detail-scroll" id="hf-drawer-body"></div>
</div>

<!-- ── Hero Detail Sheet (mobile bottom) ── -->
<div class="hf-hero-sheet" id="hf-hero-sheet" role="dialog" aria-modal="true" aria-label="Hero Details">
  <div class="hf-sheet-handle"></div>
  <div class="hf-detail-close-row">
    <div class="hf-detail-hero-header" id="hf-sheet-header">
      <span class="hf-detail-ico" id="hf-sheet-ico"></span>
      <span class="hf-detail-hero-name" id="hf-sheet-name"></span>
    </div>
    <button class="hf-detail-close-btn" onclick="closeHeroDetail()" aria-label="Close">✕</button>
  </div>
  <div class="hf-detail-scroll" id="hf-sheet-body"></div>
</div>
```

- [ ] **Step 2: Verify HTML parses correctly**

Open `public/lobby.html` in browser (no console errors, no visible change yet).

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add hero detail drawer and bottom sheet HTML elements"
```

---

## Task 7: JS — Update `_renderFormHeroGrid` (remove role badge, add info btn, add detail click)

**Files:**
- Modify: `public/lobby.html` — `_renderFormHeroGrid` function (~line 5653)

- [ ] **Step 1: Replace the card.innerHTML and click logic**

Find the existing block inside `_renderFormHeroGrid`:
```javascript
            if (_editingOpen && (isSelected || !isFull)) {
              card.onclick = () => _toggleFormHero(h.cid);
            }
            const cat = _roleCategory(h.role);
            const label =
              cat === "tank" ? "Tank" : cat === "support" ? "Support" : "DPS";
            card.innerHTML = `<div class="form-hc-ico">${h.icon}</div>
              <div class="form-hc-name">${h.name}</div>
              <div class="form-hc-role role-${cat}">${label}</div>`;
            grid.appendChild(card);
```

Replace it with:
```javascript
            if (_editingOpen && (isSelected || !isFull)) {
              card.onclick = () => _toggleFormHero(h.cid);
            } else if (!_editingOpen) {
              card.onclick = () => openHeroDetail(h.cid);
            }
            card.innerHTML = `
              <button class="fhc-info-btn" onclick="event.stopPropagation(); openHeroDetail('${h.cid}')" aria-label="Hero info">i</button>
              <div class="form-hc-ico">${h.icon}</div>
              <div class="form-hc-name">${h.name}</div>`;
            grid.appendChild(card);
```

- [ ] **Step 2: Verify in browser**

Navigate to Formation view. Cards should show icon + name (no role badge). A small `i` circle appears in the top-right corner of each card.

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): update hero card to show icon+name only, add info button and detail click"
```

---

## Task 8: JS — `openHeroDetail`, `closeHeroDetail`, `_populateDetailPanel`

**Files:**
- Modify: `public/lobby.html` — inside the formation IIFE, after `_renderFormHeroGrid` function definition

- [ ] **Step 1: Add the three functions**

Find `function _toggleFormHero(cid)` and insert the following block immediately before it:

```javascript
        function _buildDetailBodyHTML(h) {
          const cat = _roleCategory(h.role);
          const label =
            cat === "tank" ? "Tank" : cat === "support" ? "Support" : "DPS";
          const lv1 = h.levels[1] || {};
          const hp = lv1.max_hp ?? "—";
          const atk = lv1.atk ?? "—";
          const spd = lv1.atk_speed != null ? lv1.atk_speed.toFixed(1) : "—";
          const crit =
            lv1.crit_chance != null
              ? (lv1.crit_chance * 100).toFixed(0) + "%"
              : "—";

          const levelKeys = Object.keys(h.levels || {})
            .map(Number)
            .sort((a, b) => a - b);
          const tableRows = levelKeys
            .map((lv) => {
              const s = h.levels[lv];
              return `<tr>
                <td>${lv}</td>
                <td>${s.max_hp}</td>
                <td>${s.atk}</td>
                <td>${s.atk_speed != null ? s.atk_speed.toFixed(1) : "—"}</td>
                <td>${s.crit_chance != null ? (s.crit_chance * 100).toFixed(0) + "%" : "—"}</td>
              </tr>`;
            })
            .join("");

          return `
            <div class="hf-detail-role-wrap">
              <span class="gr-hero-role role-${cat}">${label}</span>
            </div>
            <div class="hf-detail-section-label">Skill</div>
            <div class="hf-detail-skill-name">✦ ${h.skill?.name ?? "—"}</div>
            <div class="hf-detail-skill-desc">${h.skill?.description ?? ""}</div>
            <div class="hf-detail-section-label">Base Stats (Lv 1)</div>
            <div class="hf-detail-stats">
              <div class="hf-detail-stat">
                <span class="hf-stat-label">❤️ HP</span>
                <span class="hf-stat-value">${hp}</span>
              </div>
              <div class="hf-detail-stat">
                <span class="hf-stat-label">⚔️ ATK</span>
                <span class="hf-stat-value">${atk}</span>
              </div>
              <div class="hf-detail-stat">
                <span class="hf-stat-label">⚡ SPD</span>
                <span class="hf-stat-value">${spd}</span>
              </div>
              <div class="hf-detail-stat">
                <span class="hf-stat-label">💥 CRIT</span>
                <span class="hf-stat-value">${crit}</span>
              </div>
            </div>
            <button class="hf-detail-l2-btn" onclick="toggleHeroDetailL2(this)">
              Ver stats completos
              <span class="hf-l2-chevron">▾</span>
            </button>
            <div class="hf-detail-l2">
              <table class="hf-detail-l2-table">
                <thead>
                  <tr>
                    <th>Nível</th><th>HP</th><th>ATK</th><th>SPD</th><th>CRIT</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>`;
        }

        window.openHeroDetail = function (cid) {
          if (_editingOpen) return;
          if (!_heroData) return;
          const h = _heroData.find((x) => x.cid === cid);
          if (!h) return;

          const body = _buildDetailBodyHTML(h);
          const isDesktop = window.innerWidth > 640;

          if (isDesktop) {
            document.getElementById("hf-drawer-ico").textContent = h.icon;
            document.getElementById("hf-drawer-name").textContent = h.name;
            document.getElementById("hf-drawer-body").innerHTML = body;
            document.getElementById("hf-hero-drawer").classList.add("hf-open");
          } else {
            document.getElementById("hf-sheet-ico").textContent = h.icon;
            document.getElementById("hf-sheet-name").textContent = h.name;
            document.getElementById("hf-sheet-body").innerHTML = body;
            document.getElementById("hf-hero-sheet").classList.add("hf-open");
          }
          document
            .getElementById("hf-detail-backdrop")
            .classList.add("hf-open");
        };

        window.closeHeroDetail = function () {
          document
            .getElementById("hf-hero-drawer")
            ?.classList.remove("hf-open");
          document
            .getElementById("hf-hero-sheet")
            ?.classList.remove("hf-open");
          document
            .getElementById("hf-detail-backdrop")
            ?.classList.remove("hf-open");
        };
```

- [ ] **Step 2: Verify in browser**

Navigate to Formation view. Click a hero card → drawer slides in from right on desktop, sheet slides up from bottom on mobile. Clicking outside (backdrop) closes it.

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add openHeroDetail, closeHeroDetail, and detail body builder"
```

---

## Task 9: JS — `toggleHeroDetailL2` (expand/collapse Level 2)

**Files:**
- Modify: `public/lobby.html` — inside the formation IIFE, after `closeHeroDetail`

- [ ] **Step 1: Add toggle function**

Insert immediately after the `window.closeHeroDetail` block:
```javascript
        window.toggleHeroDetailL2 = function (btn) {
          const l2 = btn.nextElementSibling;
          const chevron = btn.querySelector(".hf-l2-chevron");
          const isExpanded = l2.classList.contains("expanded");
          if (isExpanded) {
            l2.classList.remove("expanded");
            chevron.classList.remove("expanded");
            btn.firstChild.textContent = "Ver stats completos ";
          } else {
            l2.classList.add("expanded");
            chevron.classList.add("expanded");
            btn.firstChild.textContent = "Recolher ";
          }
        };
```

- [ ] **Step 2: Verify in browser**

Open a hero detail panel. Click "Ver stats completos" → table expands with level progression data. Click "Recolher" → table collapses.

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add Level 2 stats expand/collapse toggle"
```

---

## Task 10: JS — Wire `openDeckSlot`/`closeDeckSlot` to grid editing mode

**Files:**
- Modify: `public/lobby.html` — `openDeckSlot` and `closeDeckSlot` functions

- [ ] **Step 1: Add `.fhc-editing-mode` toggle and `closeHeroDetail` call**

Find `window.openDeckSlot = function (idx) {` and add two lines after `_editingOpen = true;`:
```javascript
        window.openDeckSlot = function (idx) {
          _activeFormSlot = idx;
          _editingOpen = true;
          closeHeroDetail();                                              // ← add
          document.getElementById("form-hero-grid")                     // ← add
            ?.classList.add("fhc-editing-mode");                        // ← add
          _renderDeckCards();
          _renderSlideSlots();
          // ... rest unchanged
```

Find `window.closeDeckSlot = function () {` and add one line after `_editingOpen = false;`:
```javascript
        window.closeDeckSlot = function () {
          _editingOpen = false;
          document.getElementById("form-hero-grid")                     // ← add
            ?.classList.remove("fhc-editing-mode");                     // ← add
          const panel = document.getElementById("fv-slide-panel");
          // ... rest unchanged
```

- [ ] **Step 2: Verify in browser**

1. Formation view loads → hover hero cards shows glow, click opens detail.
2. Click a deck slot → slide panel opens, hero card hovers do nothing, info buttons disappear.
3. Close deck slot → hover + detail interactions return.

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): wire deck editing state to fhc-editing-mode and close detail on open"
```

---

## Task 11: JS — Escape key listener for drawer

**Files:**
- Modify: `public/lobby.html` — inside the formation IIFE, after Task 10 additions

- [ ] **Step 1: Add Escape key listener**

Find `window.openFormation = async function () {` and add the following one-time listener setup immediately inside the function, before the early-return guards:
```javascript
        // Set up Escape key close — registered once
        if (!window._hfDetailEscBound) {
          window._hfDetailEscBound = true;
          document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeHeroDetail();
          });
        }
```

Place this block at the top of `window.openFormation`, right after the opening brace:
```javascript
        window.openFormation = async function () {
          if (!window._hfDetailEscBound) {
            window._hfDetailEscBound = true;
            document.addEventListener("keydown", function (e) {
              if (e.key === "Escape") closeHeroDetail();
            });
          }
          showView("view-formation");
          // ... rest unchanged
```

- [ ] **Step 2: Verify in browser**

Open hero detail drawer on desktop → press Escape → drawer closes.

- [ ] **Step 3: Final end-to-end test checklist**

- [ ] Hero cards show icon + name only (no role badge on card)
- [ ] Hovering a card in normal mode shows glow + scale
- [ ] Clicking card (desktop, normal mode) → drawer slides from right
- [ ] Tapping card (mobile, normal mode) → sheet slides from bottom
- [ ] Info button click opens same panel (event.stopPropagation prevents double-fire)
- [ ] Detail panel shows: role badge, skill name + description, 4 base stats
- [ ] "Ver stats completos" expands level table; "Recolher" collapses it
- [ ] Clicking backdrop closes panel
- [ ] Pressing Escape (desktop) closes panel
- [ ] Opening a deck slot: hover suppressed, info buttons gone
- [ ] Closing deck slot: interactions restore

- [ ] **Step 4: Commit**

```bash
git add public/lobby.html
git commit -m "feat(formation): add Escape key listener to close hero detail panel"
```
