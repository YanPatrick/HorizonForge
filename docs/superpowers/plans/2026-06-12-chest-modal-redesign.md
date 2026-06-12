# ChestResultModal Redesign + Inventory Sort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the post-chest-purchase modal with a Glow Reveal style + Scale Pop animation (with crit-hit/fail variants) and sort the inventory panel by rarity descending.

**Architecture:** Two independent changes — (1) a one-line sort added to `LobbyPage.jsx`; (2) `ChestResultModal` in `ShopView.jsx` is rewritten top-to-bottom with new `.cr-*` CSS classes in `shop.css`. The old `.chest-result-*` CSS block is removed and replaced entirely. Rarity-colored accents are passed as CSS custom properties from JSX so CSS animations can reference them.

**Tech Stack:** React (JSX), CSS keyframe animations, CSS custom properties (`--accent`, `--accent-40`, etc.)

---

## File Map

| File | Change |
|------|--------|
| `client/src/pages/LobbyPage.jsx` | Add `RARITY_ORDER` constant + `.sort()` on `unequipped` |
| `client/src/pages/ShopView.jsx` | Add `SLOT_ICONS_CHEST`, `hexToRgb` helper; rewrite `ChestResultModal` |
| `public/css/shop.css` | Remove old `.chest-result-*` block; add new `.cr-*` styles + all keyframes |

---

## Task 1: Inventory sort by rarity

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx` (near line 121, and near line 303)

- [ ] **Step 1.1 — Add `RARITY_ORDER` constant**

In `LobbyPage.jsx`, find the block with `RARITY_COLORS` (line ~121) and add the new constant directly below it:

```jsx
const RARITY_COLORS = {
  common: '#c0bdb5', uncommon: '#4caf50', rare: '#42a5f5',
  epic: '#ba68c8', legendary: '#ff2d9b', starter: '#6a6080',
}
const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4, starter: 5 }
```

- [ ] **Step 1.2 — Apply sort to `unequipped`**

Find (line ~303 inside `HeroDetail`):
```jsx
const unequipped = playerItems.filter(item => !item.equipped_on)
```
Replace with:
```jsx
const unequipped = playerItems
  .filter(item => !item.equipped_on)
  .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 6) - (RARITY_ORDER[b.rarity] ?? 6))
```

- [ ] **Step 1.3 — Verify in dev server**

Run `npm run dev` (port 5173). Open the lobby, select a hero with multiple unequipped items. Confirm legendary items appear first, then epic, rare, uncommon, common.

- [ ] **Step 1.4 — Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: sort inventory by rarity descending (legendary first)"
```

---

## Task 2: ChestResultModal — JSX rewrite

**Files:**
- Modify: `client/src/pages/ShopView.jsx` (the `ChestResultModal` function, currently lines ~382–447)

- [ ] **Step 2.1 — Add `SLOT_ICONS_CHEST` and `hexToRgb` before `ChestResultModal`**

Find `const CHEST_RESULT_RARITY_COLORS = {` (line ~375) and replace the entire block up to the start of `function ChestResultModal` with:

```jsx
const CHEST_RESULT_RARITY_COLORS = {
  common: '#c0bdb5', uncommon: '#4caf50', rare: '#42a5f5',
  epic: '#ba68c8', legendary: '#ff2d9b',
}

const SLOT_ICONS_CHEST = {
  amulet: '📿', helm: '⛑️', special: '✨', weapon: '⚔️',
  chest: '🛡️', offhand: '📜', belt: '🏷️', legs: '👖',
  gloves: '🧤', ring1: '💍', boots: '🥾', ring2: '💍',
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
```

- [ ] **Step 2.2 — Rewrite `ChestResultModal`**

Replace the entire `function ChestResultModal({ result, onClose }) { ... }` block with:

```jsx
function ChestResultModal({ result, onClose }) {
  const { t } = useT()
  const { chestName, item } = result
  const isCritHit   = item.d20_roll === 20
  const isCritFail  = item.d20_roll === 1
  const hasNegative = item.atk_bonus < 0 || item.hp_bonus < 0 || item.spd_bonus < 0

  const accentColor = isCritHit  ? '#ffd700'
    : isCritFail ? '#ff4444'
    : (CHEST_RESULT_RARITY_COLORS[item.rarity] || '#ccc')

  const rgb = hexToRgb(accentColor)

  const modalClass = [
    'chest-result-modal',
    isCritHit  ? 'crit-hit'  : '',
    isCritFail ? 'crit-fail' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="shop-modal-overlay" onClick={onClose}>
      <div
        className={modalClass}
        onClick={e => e.stopPropagation()}
        style={{
          '--accent':    accentColor,
          '--accent-20': `rgba(${rgb},0.2)`,
          '--accent-40': `rgba(${rgb},0.4)`,
          border:     `1px solid rgba(${rgb},0.4)`,
          boxShadow:  `0 0 32px rgba(${rgb},0.2), 0 8px 32px rgba(0,0,0,0.6)`,
        }}
      >
        {isCritHit && <div className="cr-shimmer" />}
        <div className="cr-bar" />
        <div className="cr-inner">
          <div className="cr-badge">✦ {chestName.toUpperCase()}</div>

          {isCritHit  && <div className="cr-crit cr-crit--hit">⚡ CRITICAL HIT · D20 = 20</div>}
          {isCritFail && <div className="cr-crit cr-crit--fail">💀 CRITICAL FAIL · D20 = 1</div>}
          {!isCritHit && !isCritFail && (
            <div className="cr-d20">🎲 D20 = <strong>{item.d20_roll}</strong></div>
          )}

          <div
            className="cr-ring"
            style={{
              background: `radial-gradient(circle, rgba(${rgb},0.4) 0%, transparent 70%)`,
              border:     `2px solid rgba(${rgb},0.6)`,
              boxShadow:  isCritHit
                ? `0 0 32px rgba(${rgb},0.7)`
                : `0 0 20px rgba(${rgb},0.45)`,
            }}
          >
            <span className="cr-ring-icon">
              {SLOT_ICONS_CHEST[item.slot_type] || '✦'}
            </span>
          </div>

          <div className="cr-name" style={{ color: accentColor }}>{item.name}</div>
          <div className="cr-meta">
            <span className="cr-slot">{item.slot_type}</span>
            <span className="cr-dot">·</span>
            <span className="cr-rarity" style={{ color: accentColor }}>{item.rarity}</span>
          </div>

          <div className="cr-stats">
            {item.atk_bonus !== 0 && (
              <div className={`cr-stat${item.atk_bonus < 0 ? ' cr-stat--neg' : ''}`}>
                {item.atk_bonus > 0 ? '+' : ''}{item.atk_bonus} ATK
              </div>
            )}
            {item.hp_bonus !== 0 && (
              <div className={`cr-stat${item.hp_bonus < 0 ? ' cr-stat--neg' : ''}`}>
                {item.hp_bonus > 0 ? '+' : ''}{item.hp_bonus} HP
              </div>
            )}
            {item.spd_bonus !== 0 && (
              <div className={`cr-stat${item.spd_bonus < 0 ? ' cr-stat--neg' : ''}`}>
                {item.spd_bonus > 0 ? '+' : ''}{Number(item.spd_bonus).toFixed(2)} SPD
              </div>
            )}
          </div>

          {item.req_attr && item.req_value && (
            <div className="cr-req">
              {t('shop.requires', { attr: ATTR_LABELS[item.req_attr] || item.req_attr, value: item.req_value })}
            </div>
          )}

          {item.flavor_text && <div className="cr-flavor">"{item.flavor_text}"</div>}

          {!hasNegative && !item.flavor_text && (
            <div className="cr-acquired">{t('shop.itemAdded')}</div>
          )}
          {hasNegative && !item.flavor_text && (
            <div className="cr-acquired">{t('shop.cursedItemAdded')}</div>
          )}

          <button className="cr-close" onClick={onClose}>{t('shop.close')}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.3 — Commit JSX changes**

```bash
git add client/src/pages/ShopView.jsx
git commit -m "feat: rewrite ChestResultModal with Glow Reveal layout and crit states"
```

---

## Task 3: Replace old CSS with new Glow Reveal styles

**Files:**
- Modify: `public/css/shop.css` (remove lines ~714–805, the entire `/* ── Chest result modal ── */` block)

- [ ] **Step 3.1 — Delete old `.chest-result-*` CSS block**

In `public/css/shop.css`, remove the entire section that starts with:
```css
/* ── Chest result modal ──────────────────────────────────── */
.chest-result-modal {
  max-width: 320px;
  text-align: center;
}
```
...and ends with (inclusive):
```css
.chest-result-acquired {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.35);
  margin-top: 6px;
}
```
This is approximately lines 714–805. Delete the whole block — every `.chest-result-*` rule goes away.

- [ ] **Step 3.2 — Add new `.cr-*` base styles at the same location**

Insert the following block where the old one was removed:

```css
/* ── Chest Result Modal — Glow Reveal ───────────────────── */
.chest-result-modal {
  position: relative;
  width: 320px;
  max-width: 92vw;
  background: #0e0b1a;
  border-radius: 16px;
  overflow: hidden;
  text-align: center;
  animation: crModalPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
}
.chest-result-modal.crit-hit {
  animation: crModalPopCrit 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
}
.chest-result-modal.crit-fail {
  animation: crShake 0.55s ease-out both;
}

/* Top 3px rarity gradient bar */
.cr-bar {
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}

/* Gold shimmer overlay — crit hit only */
.cr-shimmer {
  position: absolute;
  top: 0; left: 0;
  width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,215,0,0.18), transparent);
  pointer-events: none;
  z-index: 2;
  animation: crShimmerSweep 0.6s 0.85s ease-in-out both;
}

.cr-inner {
  padding: 20px 20px 18px;
}

/* Chest name badge */
.cr-badge {
  display: inline-block;
  background: var(--accent-20);
  border: 1px solid var(--accent-40);
  border-radius: 20px;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.1em;
  padding: 3px 10px;
  margin-bottom: 10px;
  text-transform: uppercase;
  animation: crFadeUp 0.25s 0.05s both;
}

/* D20 roll (normal state) */
.cr-d20 {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.35);
  margin-bottom: 14px;
  animation: crFadeUp 0.25s 0.1s both;
}
.cr-d20 strong {
  color: #fff;
  font-size: 1.1rem;
  margin-left: 2px;
}

/* Crit labels */
.cr-crit {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  margin-bottom: 14px;
  animation: crFadeUp 0.25s 0.1s both;
}
.cr-crit--hit  { color: #ffd700; }
.cr-crit--fail { color: #ff4444; }

/* Glow ring */
.cr-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  animation: crRingPulse 0.6s 0.3s both;
}
.cr-ring-icon {
  font-size: 28px;
  line-height: 1;
}

/* Item name */
.cr-name {
  font-size: 0.95rem;
  font-weight: 800;
  margin-bottom: 5px;
  animation: crFadeUp 0.25s 0.55s both;
}

/* Slot · Rarity meta row */
.cr-meta {
  display: flex;
  gap: 6px;
  justify-content: center;
  font-size: 0.68rem;
  text-transform: capitalize;
  margin-bottom: 12px;
  animation: crFadeUp 0.25s 0.60s both;
}
.cr-slot { color: rgba(255,255,255,0.35); }
.cr-dot  { color: rgba(255,255,255,0.2); }
.cr-rarity { font-weight: 700; }

/* Stat pills */
.cr-stats {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
  animation: crFadeUp 0.25s 0.65s both;
}
.cr-stat {
  background: rgba(168,230,160,0.10);
  border: 1px solid rgba(168,230,160,0.25);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #a8e6a0;
}
.cr-stat--neg {
  background: rgba(255,100,100,0.08);
  border-color: rgba(255,100,100,0.25);
  color: #ff8a8a;
}

/* Requirement */
.cr-req {
  font-size: 0.7rem;
  color: #f0c060;
  margin-bottom: 8px;
  animation: crFadeUp 0.25s 0.72s both;
}

/* Flavor text (Chaos Chest crit fail) */
.cr-flavor {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.35);
  font-style: italic;
  margin-bottom: 8px;
  animation: crFadeUp 0.25s 0.72s both;
}

/* "Item added to inventory" */
.cr-acquired {
  font-size: 0.68rem;
  color: rgba(255,255,255,0.25);
  margin-bottom: 10px;
  animation: crFadeUp 0.25s 0.76s both;
}

/* Close button */
.cr-close {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 7px 24px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.15s;
  animation: crFadeUp 0.25s 0.80s both;
}
.cr-close:hover {
  background: rgba(255,255,255,0.13);
}

/* ── Keyframes ─────────────────────────────────────────── */

/* Normal modal entrance: spring pop */
@keyframes crModalPop {
  0%   { transform: scale(0.75); opacity: 0; }
  70%  { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}

/* Crit hit entrance: bigger overshoot */
@keyframes crModalPopCrit {
  0%   { transform: scale(0.75); opacity: 0; }
  70%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}

/* Crit fail entrance: horizontal shake while scaling in */
@keyframes crShake {
  0%   { transform: translateX(0)    scale(0.75); opacity: 0; }
  20%  { transform: translateX(-6px) scale(0.78); opacity: 0.6; }
  40%  { transform: translateX(6px)  scale(0.82); opacity: 0.8; }
  60%  { transform: translateX(-4px) scale(0.85); opacity: 0.9; }
  80%  { transform: translateX(2px)  scale(0.92); opacity: 1; }
  100% { transform: translateX(0)    scale(1);    opacity: 1; }
}

/* Glow ring pulse on enter */
@keyframes crRingPulse {
  0%   { transform: scale(0.8);  opacity: 0; }
  50%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}

/* Content cascade (shared by all animated children) */
@keyframes crFadeUp {
  from { transform: translateY(10px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

/* Gold shimmer sweep — crit hit overlay */
@keyframes crShimmerSweep {
  from { transform: translateX(-100%); }
  to   { transform: translateX(250%);  }
}
```

- [ ] **Step 3.3 — Verify in dev server**

Open `http://localhost:5173/shop`. Buy a Veteran Chest. Confirm:
- Modal appears with spring pop animation
- Top bar glows in item's rarity color
- Glow ring shows correct slot emoji and pulses in
- Item name and rarity label are colored by rarity
- Stats, req, and close button fade up in cascade
- Clicking overlay or Close button dismisses modal

- [ ] **Step 3.4 — Commit CSS**

```bash
git add public/css/shop.css
git commit -m "feat: add Glow Reveal CSS + keyframe animations for ChestResultModal"
```

---

## Task 4: Verify crit states and build for production

- [ ] **Step 4.1 — Force-test crit hit (D20 = 20)**

In `api/server.js`, find `_generateChestItem` (line ~1427) and temporarily hardcode the D20:

```js
// TEMP — remove after test
const d20 = 20
```

Open shop, buy any chest. Confirm:
- Modal border/glow is gold (`#ffd700`)
- "⚡ CRITICAL HIT · D20 = 20" label appears in gold
- Modal pop overshoots more than normal
- Gold shimmer sweeps across modal at ~0.85s
- Ring glow is brighter than normal items

Revert the hardcode after confirming.

- [ ] **Step 4.2 — Force-test crit fail (D20 = 1)**

Hardcode `const d20 = 1`, buy a chest. Confirm:
- Modal border/glow is red (`#ff4444`)
- "💀 CRITICAL FAIL · D20 = 1" label in red
- Modal entrance shakes horizontally while scaling in
- If it's a Chaos Chest, flavor text appears in italic at bottom

Revert after confirming.

- [ ] **Step 4.3 — Production build**

```bash
npm run build
```

Expected: build completes with no errors. Output in `public/dist/`.

- [ ] **Step 4.4 — Verify production build**

```bash
npm start
```

Open `http://localhost:3000/shop`. Repeat the chest purchase test. Confirm modal looks and animates identically to the dev build.

- [ ] **Step 4.5 — Final commit**

```bash
git add public/dist
git commit -m "build: production build after ChestResultModal redesign + inventory sort"
```
