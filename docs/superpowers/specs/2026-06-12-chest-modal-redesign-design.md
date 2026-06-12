# Design Spec — ChestResultModal Redesign + Inventory Sort

**Date:** 2026-06-12
**Status:** Approved

---

## Scope

Two changes in this spec:

1. **Inventory sort by rarity** — items in the INVENTORY panel of HeroDetail now sort from highest to lowest rarity before rendering.
2. **ChestResultModal visual redesign** — the modal that appears after buying a chest is redesigned with a Glow Reveal style, Scale Pop animation, dynamic rarity coloring, and special crit/fail states.

---

## 1. Inventory Sort

**File:** `client/src/pages/LobbyPage.jsx`

### Change

The `unequipped` array (filtered from `playerItems`) is sorted by rarity before rendering into `.inv-grid`.

**Rarity order (descending):**

```
legendary (0) → epic (1) → rare (2) → uncommon (3) → common (4) → starter (5)
```

### Implementation

Add a `RARITY_ORDER` map and apply `.sort()` on `unequipped` before the `.map()` render call. Items with unknown rarity go to the end.

---

## 2. ChestResultModal Redesign

**Files changed:**
- `client/src/pages/ShopView.jsx` — component logic and structure
- `public/css/shop.css` — all new styles for the redesigned modal

### 2.1 Visual Style — Glow Reveal

The modal uses the rarity color as its primary accent throughout:

- **Top bar:** 3px gradient line `transparent → rarityColor → transparent`
- **Border:** `1px solid` at 40% opacity of rarity color
- **Box shadow:** outer glow using rarity color at ~20% opacity
- **Glow ring:** centered circular element (72px diameter) with:
  - Radial gradient fill using rarity color at 40% opacity
  - Border at 60% opacity of rarity color
  - Box shadow glow at 45% opacity
  - Slot emoji centered inside (mapped from `slot_type`)
- **Item name:** rendered in full rarity color
- **Badge:** pill with chest name (e.g. "✦ VETERAN CHEST") using rarity color border + background tint

**Slot emoji map:**
```
chest → 🛡️   weapon → ⚔️   ring → 💍   boots → 👟
gloves → 🧤   amulet → 📿   helmet → ⛑️   (default) → ✦
```

### 2.2 Animation — Scale Pop

CSS-only via `@keyframes`. Applied via a class added on mount.

**Modal entrance:**
```css
@keyframes chestModalPop {
  0%   { transform: scale(0.75); opacity: 0; }
  70%  { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1); }
}
/* duration: 0.4s, easing: cubic-bezier(0.34, 1.56, 0.64, 1) */
```

**Glow ring:**
```css
@keyframes chestRingPulse {
  0%   { transform: scale(0.8); opacity: 0; box-shadow: 0 0 0 transparent; }
  50%  { transform: scale(1.12); opacity: 1; box-shadow: 0 0 28px <rarityColor>; }
  100% { transform: scale(1); box-shadow: 0 0 20px <rarityColor at 45%>; }
}
/* delay: 0.3s, duration: 0.6s */
```

**Content cascade (fadeUp):**
```css
@keyframes chestFadeUp {
  from { transform: translateY(10px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
```

Cascade delays:
| Element      | Delay  |
|-------------|--------|
| Item name   | 0.55s  |
| Meta row    | 0.60s  |
| Stats       | 0.65s  |
| Requirement | 0.72s  |
| Added text  | 0.76s  |
| Close btn   | 0.80s  |

### 2.3 Critical States

The `d20_roll` value drives two variant states that override the rarity color scheme.

#### Critical Hit — D20 = 20

- **Accent color:** `#ffd700` (gold)
- **Modal border + glow:** gold
- **Glow ring:** gold with more intense box-shadow (`0 0 32px rgba(255,215,0,0.7)`)
- **Scale overshoot:** increased to `1.08` (vs. `1.04` normal)
- **Header text:** `⚡ CRITICAL HIT · D20 = 20` in gold, rendered above item name
- **Shimmer pass:** after the pop settles (~0.8s), an absolutely-positioned overlay `div` with `pointer-events:none` and a `linear-gradient(90deg, transparent, rgba(255,215,0,0.25), transparent)` animates from `translateX(-100%)` to `translateX(200%)` over 0.6s, creating a single gold sweep across the modal

#### Critical Fail — D20 = 1

- **Accent color:** `#ff4444` (red)
- **Modal border + glow:** red/crimson
- **Glow ring:** red glow, darker radial gradient
- **Animation modifier:** the normal `chestModalPop` is replaced by `chestShake` — a combined entrance that shakes horizontally while scaling in (the shake IS the entrance, not a preceding step):
  ```css
  @keyframes chestShake {
    0%   { transform: translateX(0)    scale(0.75); opacity: 0; }
    20%  { transform: translateX(-6px) scale(0.78); opacity: 0.6; }
    40%  { transform: translateX(6px)  scale(0.82); opacity: 0.8; }
    60%  { transform: translateX(-4px) scale(0.85); opacity: 0.9; }
    80%  { transform: translateX(2px)  scale(0.92); opacity: 1; }
    100% { transform: translateX(0)    scale(1);    opacity: 1; }
  }
  /* duration: 0.55s, easing: ease-out */
  ```
- **Header text:** `💀 CRITICAL FAIL · D20 = 1` in red
- **Flavor text** (if present, from Chaos Chest crit fail) rendered in italic at bottom

### 2.4 State Logic in JSX

```
isCritHit  = item.d20_roll === 20  → accentColor = '#ffd700'
isCritFail = item.d20_roll === 1   → accentColor = '#ff4444'
default                            → accentColor = CHEST_RESULT_RARITY_COLORS[item.rarity]
```

All color-dependent styles are passed as inline `style` props on the modal wrapper, so a single `accentColor` variable drives border, glow ring, bar, and name color.

### 2.5 What Does NOT Change

- Stats display (ATK/HP/SPD with positive/negative coloring)
- Requirements display
- Flavor text display (Chaos Chest crit fail)
- "Item added to your inventory" / "Cursed item" text logic
- `onClose` behavior (click overlay or button)
- i18n strings (`t('shop.requires')`, `t('shop.itemAdded')`, etc.)

---

## Files Modified

| File | Change |
|------|--------|
| `client/src/pages/LobbyPage.jsx` | Add `RARITY_ORDER` map + `.sort()` on `unequipped` |
| `client/src/pages/ShopView.jsx` | Rewrite `ChestResultModal` component + add slot emoji map + accent color logic |
| `public/css/shop.css` | Replace `.chest-result-*` rules with new Glow Reveal styles + keyframe animations |
