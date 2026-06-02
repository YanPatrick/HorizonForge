# HorizonForge — Visual Rebrand Design Spec

**Date:** 2026-06-01  
**Branch:** `feat/visual-rebrand` (experiment)  
**Scope:** Login page + Lobby page only (Battle page = next iteration)  
**Approach:** Design system + layout refactor (Opção 2)

---

## 1. Goals

Transform the visual identity of HorizonForge from a functional-but-generic UI into a polished, professional fantasy auto-battler experience. The game logic, authentication flow, and all backend integrations remain completely untouched.

**Success criteria:**
- The site feels like a premium game product on first impression
- Login, lobby, and mobile navigation are visually cohesive
- Both PC and mobile experiences are polished
- No regressions in game functionality

---

## 2. Visual Direction: Epic Dark Fantasy

Inspired by Hearthstone / Teamfight Tactics. Key characteristics:

- **Base:** Near-black with purple radial atmospherics (`#060213`)
- **Typography:** Cinzel (display/titles) + Exo 2 (body/UI) — consistent across all pages
- **Accents:** Gold (`#ffd700`, `#ffb020`) and purple (`#7c35ff`, `#4b15cc`)
- **Surfaces:** Deep glassmorphism (`backdrop-filter: blur(28px)`)
- **Borders:** Luminous, low-opacity (`rgba(180,130,255,0.22)`)
- **Effects:** Subtle glows, shimmer animations, floating CSS particles

---

## 3. Design Tokens

**New file:** `public/css/tokens.css`

Imported **once** in `client/src/App.jsx` as `import '@styles/tokens.css'`. Because Vite bundles all CSS into the same document, the `:root` custom properties defined here are globally available to every CSS file (`index.css`, `lobby.css`, `components.css`, etc.) with no further imports needed.

```css
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Exo+2:wght@400;600;700;800;900&display=swap");

:root {
  /* Background & Surfaces */
  --hf-bg:          #060213;
  --hf-surface:     rgba(14, 9, 34, 0.95);
  --hf-surface-2:   rgba(22, 12, 52, 0.90);

  /* Borders */
  --hf-border:      rgba(180, 130, 255, 0.22);
  --hf-border-gold: rgba(220, 160, 30, 0.30);
  --hf-border-focus:rgba(190, 138, 255, 0.65);

  /* Accent colors */
  --hf-purple:      #7c35ff;
  --hf-purple-2:    #4b15cc;
  --hf-gold:        #ffd700;
  --hf-gold-2:      #ffb020;
  --hf-amber:       #b85a00;
  --hf-amber-2:     #7a3200;

  /* Text */
  --hf-text:        rgba(225, 215, 255, 0.88);
  --hf-text-muted:  rgba(170, 148, 225, 0.55);
  --hf-text-gold:   rgba(255, 220, 100, 0.90);

  /* Typography */
  --font-display:   'Cinzel', Georgia, serif;
  --font-body:      'Exo 2', Inter, 'Segoe UI', sans-serif;

  /* Effects */
  --hf-glass-blur:    blur(28px);
  --hf-glow-purple:   0 0 40px rgba(100, 40, 200, 0.20);
  --hf-glow-gold:     0 0 24px rgba(255, 180, 30, 0.55);
  --hf-shimmer-line:  linear-gradient(90deg, transparent, rgba(200,140,255,0.75), rgba(255,200,70,0.6), transparent);
}
```

**Font loading:** `tokens.css` owns the Google Fonts `@import`. All other CSS files drop their own font imports.

---

## 4. Login Page

**Files changed:** `client/src/styles/index.css`  
**JSX changed:** none (zero structural changes to `LoginPage.jsx`)

### Background
- Keep existing radial gradients
- Add floating CSS particles via **pure CSS only** — `.page::before` and `.page::after` use `box-shadow` to project multiple points of light from a single invisible element (no JSX changes)
- Particles: 2–4px circles via `box-shadow` spread, purple/gold colors, `opacity: 0.4–0.7`, staggered `@keyframes float` with `animation-delay`

### Card
- Font: logo title gets `font-family: var(--font-display)`, `letter-spacing: 4px`
- Shimmer top border: increase opacity from current `0.75/0.6` to `0.9/0.75`
- Glassmorphism: `backdrop-filter: var(--hf-glass-blur)`
- Border: `var(--hf-border)`
- Box-shadow: add `var(--hf-glow-purple)` as third shadow layer

### Buttons
- **Guest (primary):** keep gradient, add `var(--hf-glow-purple)` on hover, slow shimmer from 3.2s to 5s
- **Keychain (secondary):** border → `var(--hf-border)`, text color → `var(--hf-text-muted)`, hover border → `var(--hf-border-focus)`

### Typography
- All labels: `font-family: var(--font-body)`
- Logo subtitle: Exo 2, italic, `var(--hf-text-muted)`

---

## 5. Lobby Page

### 5a. Top Navigation

**File changed:** `public/css/lobby.css`  
**JSX changed:** none

- Background: `var(--hf-surface)` (was `rgba(6,3,20,0.82)`)
- Bottom border: `var(--hf-border)` (slightly more visible)
- `.nav-logo-name`: `font-family: var(--font-display)` — Cinzel for the logo
- `.nav-user-badge`: add subtle `var(--hf-border)` border, `var(--hf-surface-2)` background
- Balance badge: refined with Exo 2 font

### 5b. Lobby Home — Battle Mode Selection

**File changed:** `public/css/lobby.css` (significant section rewrite)  
**JSX changed:** `client/src/pages/LobbyPage.jsx` — the `#view-home` section only

**Layout:** Two stacked horizontal cards replace the current 2-column grid.

**Card structure (each):**
```
┌──────────────────────────────────────────────┐
│ [Image panel 80px wide] │ [Content panel]     │
│   image + gradient      │  Badge | Title      │
│   overlay + glow        │  Description        │
│                         │  Format pills | CTA │
└──────────────────────────────────────────────┘
```

**Solo card (purple theme):**
- Image: `image_bot.jpeg` with `linear-gradient(135deg, rgba(80,30,160,0.7), rgba(40,10,100,0.85))` overlay
- Badge: "SOLO" — purple border + background
- Title: "Solo Battle" in Cinzel
- Description: "Enfrente uma IA · Escolha o formato"
- Format pills: BO3 / BO5 / BO7 inline (reuses existing state/handlers)
- CTA: `▶ INICIAR` — purple gradient button with glow

**PvP card (amber/gold theme):**
- Image: `image_pvp.jpeg` with `linear-gradient(135deg, rgba(120,60,0,0.7), rgba(80,30,0,0.85))` overlay
- Badge: "PVP" — amber border + background
- Title: "PvP Match" in Cinzel
- Description: "Desafie jogadores reais · Aposte HIVE"
- Format + wager pills inline (reuses existing state/handlers)
- CTA: `🔍 BUSCAR OPONENTE` — amber gradient button

**Guest Free PvP card:** gets same horizontal treatment with neutral theme.

**Both cards:** `border-radius: 14px`, `var(--hf-border)` border, glassmorphism surface, hover lifts `translateY(-2px)` with shadow increase.

### 5c. Bottom Navigation — SVG Icons

**Dependency:** `lucide-react` (npm install)  
**File changed:** `client/src/pages/LobbyPage.jsx` — `<nav className="mobile-bottom-tabs">` only  
**CSS changed:** `public/css/lobby.css` — `.mobile-bottom-tabs` and `.mbt-tab` rules

**Icon mapping:**

| Tab | Current | Lucide component | Size |
|-----|---------|-----------------|------|
| Grimório | 📖 | `<BookOpen />` | 20px |
| Formação | 🏰 | `<Shield />` | 20px |
| Duelo | ⚔️ | `<Swords />` | 20px |
| Loja | 🛒 | `<ShoppingBag />` | 20px |
| Config | ⚙️ | `<Settings />` | 20px |

**Active tab treatment:**
- Pill background: `var(--hf-surface-2)` with `var(--hf-border)` border
- Top indicator line: 2px, `linear-gradient(90deg, transparent, var(--hf-purple), transparent)`
- Icon: `color: rgba(200,160,255,0.95)` + `filter: drop-shadow(0 0 5px rgba(180,100,255,0.7))`
- Label: Exo 2, `font-weight: 700`, brighter

**Inactive tabs:** icon + label at `opacity: 0.45`, no border/background

### 5d. Other Lobby Views

**Files changed:** `public/css/lobby.css`, `public/css/components.css`  
**JSX changed:** none

Apply tokens globally to shared components. No layout changes:
- Section titles: `font-family: var(--font-display)`, Cinzel
- Card surfaces: `var(--hf-surface)`, `var(--hf-border)`
- Buttons (`.btn-action`, `.btn-start`, `.btn-find`): aligned to token palette
- Form inputs: `var(--hf-border)`, focus ring `var(--hf-border-focus)`
- Drawers / modals (hero detail, search overlay): glassmorphism unified

---

## 6. Dependencies

| Package | Why | Size |
|---------|-----|------|
| `lucide-react` | SVG icon library for bottom nav | ~20kb tree-shaken |

Fonts (Cinzel + Exo 2) are already loaded via Google Fonts in `battle.css` — we move the `@import` to `tokens.css` so it's shared.

---

## 7. Out of Scope

- `BattlePage.jsx` and `public/css/battle.css` — not touched
- Game logic, WebSocket, matchmaking, authentication
- Backend / API
- New illustrations or AI-generated art (use existing `image_bot.jpeg`, `image_pvp.jpeg`)
- Grimoire, Formation, Shop, Settings — layout unchanged (only token inheritance)

---

## 8. File Change Summary

| File | Type of change |
|------|---------------|
| `public/css/tokens.css` | **NEW** — design token source |
| `client/src/App.jsx` | Add `import '@styles/tokens.css'` (one line) |
| `client/src/styles/index.css` | Rewrite using tokens (zero JSX changes) |
| `public/css/lobby.css` | Major CSS rewrite (nav, home cards, bottom nav) |
| `public/css/components.css` | Token inheritance pass |
| `client/src/pages/LobbyPage.jsx` | Two targeted sections: home view JSX + bottom nav icons |
| `package.json` | Add `lucide-react` |

---

## 9. Testing Checklist

- [ ] Login page renders correctly on desktop (1280px+)
- [ ] Login page renders correctly on mobile (375px)
- [ ] Guest login flow works end-to-end
- [ ] Hive Keychain login flow works end-to-end
- [ ] Lobby home loads, Solo battle starts
- [ ] Lobby home loads, PvP matchmaking starts
- [ ] Bottom nav tabs switch views correctly
- [ ] All 5 lobby views load without visual breaks
- [ ] Mobile: bottom nav icons visible and active state correct
- [ ] `npm run build` succeeds with zero errors
- [ ] Production build tested at `localhost:3000`
