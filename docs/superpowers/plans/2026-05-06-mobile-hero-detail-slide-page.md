# Mobile Hero Detail — Slide Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken mobile hero detail on the Formation page by replacing the never-rendered bottom-sheet with a full-screen slide-in page (grid slides left, detail enters from right).

**Architecture:** A new `MobileHeroPage` component is always mounted in `FormationView` and controlled by the existing `detailHero` state. On mobile (≤640px) it renders as a fixed full-screen page with a CSS slide animation; on desktop it is `display:none` and the existing `HeroDetail` drawer continues unchanged. The shared `fmtSP` helper is lifted to module scope so both components can use it.

**Tech Stack:** React (JSX), CSS (media queries + CSS custom properties), Vite dev server on `localhost:5173`

---

## File Map

| File | Change |
|---|---|
| `client/src/pages/LobbyPage.jsx` | Lift `fmtSP` to module scope; add `MobileHeroPage` component; update `FormationView` render |
| `public/css/lobby.css` | Hide `.hf-detail-backdrop` on mobile; raise `.mobile-bottom-tabs` z-index; add `.hf-mobile-hero-page` + layout classes |

---

## Task 1: Lift `fmtSP` to module scope

`fmtSP` is currently defined inside `HeroDetail`. `MobileHeroPage` needs the same function. Move it to module level so both components share it.

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx` (lines 19–35 area, near `roleCategory`)

- [ ] **Step 1: Open `LobbyPage.jsx` and find the `fmtSP` definition inside `HeroDetail`**

It currently sits at line ~43:
```js
const fmtSP = v => v < 1 ? `${Math.floor(v * 100)}%` : `×${(Math.floor(v * 100) / 100).toFixed(2)}`
```

- [ ] **Step 2: Move `fmtSP` to module scope — add it right after `roleCategory`**

In `LobbyPage.jsx`, after `roleCategory` (around line 25), add:
```js
function fmtSP(v) {
  return v < 1 ? `${Math.floor(v * 100)}%` : `×${(Math.floor(v * 100) / 100).toFixed(2)}`
}
```

- [ ] **Step 3: Remove the now-duplicate `const fmtSP` from inside `HeroDetail`**

Delete this line from inside the `HeroDetail` function body (around line 43):
```js
  const fmtSP = v => v < 1 ? `${Math.floor(v * 100)}%` : `×${(Math.floor(v * 100) / 100).toFixed(2)}`
```

- [ ] **Step 4: Start dev server and verify Formation page loads without errors**

```bash
npm run dev
```
Open `http://localhost:5173/formation` (or navigate to Formation tab). Click the `i` button on any hero on desktop — the drawer should open normally with stats showing. No console errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "refactor: lift fmtSP to module scope in LobbyPage"
```

---

## Task 2: CSS — fix backdrop on mobile and raise bottom-tabs z-index

Two small CSS fixes required before adding the slide page: hide the backdrop that currently darkens the screen on mobile, and raise the bottom nav above the new slide page.

**Files:**
- Modify: `public/css/lobby.css`

- [ ] **Step 1: Find `.hf-detail-backdrop` on mobile in `lobby.css`**

Search for `hf-detail-backdrop` in `lobby.css`. There is already this rule (around line 3246):
```css
.hf-detail-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 800;
  ...
}
```
And a separate mobile block at `@media (max-width: 640px)` around line 3282 that hides `.hf-hero-drawer`. Confirm that block does NOT yet hide `.hf-detail-backdrop`.

- [ ] **Step 2: Add `.hf-detail-backdrop` to the existing mobile hide rule**

Find this block in `lobby.css`:
```css
      /* On mobile the drawer is never shown — bottom sheet takes over */
      @media (max-width: 640px) {
        .hf-hero-drawer {
          display: none !important;
        }
      }
```

Replace it with:
```css
      /* On mobile the drawer and backdrop are hidden — slide page takes over */
      @media (max-width: 640px) {
        .hf-hero-drawer,
        .hf-detail-backdrop {
          display: none !important;
        }
      }
```

- [ ] **Step 3: Raise `.mobile-bottom-tabs` z-index from 100 to 1000**

Find this rule in `lobby.css` (around line 2524):
```css
      .mobile-bottom-tabs {
        display: flex !important;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(6, 3, 20, 0.97);
        border-top: 1px solid rgba(180, 130, 255, 0.14);
        backdrop-filter: blur(18px);
        z-index: 100;
```

Change `z-index: 100` to `z-index: 1000`.

- [ ] **Step 4: Verify the current bug is gone**

With the dev server still running (or `npm run dev`), open `http://localhost:5173` on a mobile viewport (DevTools → toggle device toolbar, pick any phone). Navigate to Formation. Tap the `i` button on a hero — the screen should no longer darken. Nothing shows yet (MobileHeroPage not added yet). Desktop viewport: drawer still works normally.

- [ ] **Step 5: Commit**

```bash
git add public/css/lobby.css
git commit -m "fix: hide hero detail backdrop on mobile, raise bottom-tabs z-index"
```

---

## Task 3: Add `MobileHeroPage` component to `LobbyPage.jsx`

New component inserted in `LobbyPage.jsx` between `HeroDetail` (line ~92) and `FormationView` (line ~95). It reuses all existing `hf-detail-*` CSS classes for content so visual language stays consistent.

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Insert `MobileHeroPage` after `HeroDetail` (after line 92) and before `FormationView`**

Add this entire block in `LobbyPage.jsx` between `HeroDetail` and `FormationView`:

```jsx
/* ── MobileHeroPage — slide-in detail for mobile ───────── */
function MobileHeroPage({ hero, onClose }) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => { if (!hero) setExpanded(false) }, [hero])

  const cat = hero ? roleCategory(hero.role) : ''
  const label = cat === 'tank' ? 'Tank' : cat === 'support' ? 'Support' : 'DPS'
  const lv1 = hero?.levels?.[1] || {}
  const levelKeys = Object.keys(hero?.levels || {}).map(Number).sort((a, b) => a - b)

  return (
    <div className={`hf-mobile-hero-page${hero ? ' active' : ''}`}>
      <div className="hf-mhp-header">
        <button className="hf-mhp-back-btn" onClick={onClose}>← Back</button>
        <span className="hf-mhp-title">{hero?.name ?? ''}</span>
      </div>
      {hero && (
        <div className="hf-mhp-body">
          <div
            className={`hf-mhp-portrait${hero.url_portrait ? ' has-portrait' : ''}`}
            style={hero.url_portrait ? { '--portrait-url': `url('${hero.url_portrait}')` } : {}}
          >
            {!hero.url_portrait && <div className="hf-mhp-ico">{hero.icon}</div>}
          </div>
          <div className="hf-mhp-content">
            <div className="hf-detail-role-wrap">
              <span className={`gr-hero-role role-${cat}`}>{label}</span>
            </div>
            <div className="hf-detail-section-label">Skill</div>
            <div className="hf-detail-skill-name">✦ {hero.skill?.name ?? '—'}</div>
            <div className="hf-detail-skill-desc">{hero.skill?.description ?? ''}</div>
            <div className="hf-detail-section-label">Base Stats (Lv 1)</div>
            <div className="hf-detail-stats">
              <div className="hf-detail-stat"><span className="hf-stat-label">❤️ HP</span><span className="hf-stat-value">{lv1.max_hp ?? '—'}</span></div>
              <div className="hf-detail-stat"><span className="hf-stat-label">⚔️ ATK</span><span className="hf-stat-value">{lv1.atk ?? '—'}</span></div>
              <div className="hf-detail-stat"><span className="hf-stat-label">⚡ SPD</span><span className="hf-stat-value">{lv1.atk_speed != null ? lv1.atk_speed.toFixed(1) : '—'}</span></div>
              <div className="hf-detail-stat"><span className="hf-stat-label">✨ SP</span><span className="hf-stat-value">{lv1.skill_power != null ? fmtSP(lv1.skill_power) : '—'}</span></div>
            </div>
            <button className="hf-detail-l2-btn" onClick={() => setExpanded(x => !x)}>
              <span className="hf-l2-label">{expanded ? 'Collapse' : 'View full stats'}</span>
              <span className={`hf-l2-chevron${expanded ? ' expanded' : ''}`}>▾</span>
            </button>
            {expanded && (
              <div className="hf-detail-l2 expanded">
                <table className="hf-detail-l2-table">
                  <thead><tr><th>Level</th><th>HP</th><th>ATK</th><th>Skill Power</th></tr></thead>
                  <tbody>
                    {levelKeys.map(lv => {
                      const s = hero.levels[lv] || {}
                      return <tr key={lv}><td>{lv}</td><td>{s.max_hp}</td><td>{s.atk}</td><td>{s.skill_power != null ? fmtSP(s.skill_power) : '—'}</td></tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles without errors**

The dev server (Vite) hot-reloads. Check the terminal for any JSX/syntax errors. The Formation page should still load and the desktop drawer should still work.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: add MobileHeroPage slide-in component"
```

---

## Task 4: Mount `MobileHeroPage` in `FormationView`

Wire the new component into `FormationView` so it is always mounted (needed for exit animation) and controlled by the existing `detailHero` state.

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx` (inside `FormationView`, around line 168)

- [ ] **Step 1: Find the `HeroDetail` render inside `FormationView`**

Around line 168 in the `FormationView` return:
```jsx
    <div id="view-formation" className="lv active">
      {detailHero && <HeroDetail hero={detailHero} onClose={() => setDetailHero(null)} />}
```

- [ ] **Step 2: Add `MobileHeroPage` directly after `HeroDetail`**

Replace:
```jsx
    <div id="view-formation" className="lv active">
      {detailHero && <HeroDetail hero={detailHero} onClose={() => setDetailHero(null)} />}
```

With:
```jsx
    <div id="view-formation" className="lv active">
      {detailHero && <HeroDetail hero={detailHero} onClose={() => setDetailHero(null)} />}
      <MobileHeroPage hero={detailHero} onClose={() => setDetailHero(null)} />
```

Note: `MobileHeroPage` is NOT wrapped in `{detailHero && ...}` — it must always be mounted so the slide-out transition plays when closing.

- [ ] **Step 3: Verify no regressions on desktop**

With dev server running, open `http://localhost:5173` on desktop viewport. Navigate to Formation. Click `i` on a hero — drawer opens from the right as before. No console errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: mount MobileHeroPage in FormationView"
```

---

## Task 5: CSS — add `.hf-mobile-hero-page` slide animation and layout

Add all CSS for the new mobile component. Rules are scoped inside `@media (max-width: 640px)` except the base `display:none` which hides it on desktop.

**Files:**
- Modify: `public/css/lobby.css`

- [ ] **Step 1: Find the end of the HERO DETAIL PANELS section**

Search for `hf-hero-sheet` in `lobby.css`. The sheet block ends around line 3309. Add the new rules immediately after the closing brace of `.hf-hero-sheet.hf-open { ... }`.

- [ ] **Step 2: Add the complete CSS block after `.hf-hero-sheet.hf-open`**

```css
      /* ── Mobile slide-page hero detail ── */
      .hf-mobile-hero-page {
        display: none;
      }

      @media (max-width: 640px) {
        .hf-mobile-hero-page {
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: calc(60px + env(safe-area-inset-bottom, 0px));
          z-index: 900;
          background: rgba(8, 4, 24, 0.99);
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.34, 1.06, 0.64, 1);
          overflow: hidden;
        }
        .hf-mobile-hero-page.active {
          transform: translateX(0);
        }
        .hf-mhp-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(140, 100, 255, 0.2);
          background: rgba(8, 4, 24, 0.99);
          flex-shrink: 0;
        }
        .hf-mhp-back-btn {
          background: none;
          border: none;
          color: #818cf8;
          font-size: 14px;
          cursor: pointer;
          padding: 4px 0;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .hf-mhp-title {
          color: #e5e7eb;
          font-size: 16px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hf-mhp-body {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .hf-mhp-portrait {
          width: 100%;
          height: 160px;
          flex-shrink: 0;
          background-color: rgba(100, 80, 160, 0.15);
          background-image: var(--portrait-url, none);
          background-size: cover;
          background-position: center top;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hf-mhp-ico {
          font-size: 56px;
          line-height: 1;
        }
        .hf-mhp-content {
          padding: 16px;
          flex: 1;
        }
      }
```

- [ ] **Step 3: Verify the slide animation on mobile viewport**

With dev server running, open `http://localhost:5173` in DevTools with a mobile viewport (e.g. iPhone 12, 390px wide). Navigate to Formation. Tap the `i` button on any hero:
- The detail page slides in from the right (0.3s animation)
- Hero portrait fills top area
- Role badge, skill name/description, 4 stats are visible
- "View full stats" button is visible and tappable
- Bottom nav stays visible below the slide page
- Tap "← Back" — page slides back out to the right

- [ ] **Step 4: Verify desktop is unchanged**

Switch DevTools back to desktop viewport (≥641px). Click `i` on a hero — right-side drawer slides in, backdrop appears, close with ✕. No visual regressions.

- [ ] **Step 5: Commit**

```bash
git add public/css/lobby.css
git commit -m "feat: add hf-mobile-hero-page CSS slide animation and layout"
```

---

## Task 6: Build and production verification

**Files:** none new — build output in `public/dist/`

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: build completes with no errors. Output written to `public/dist/`.

- [ ] **Step 2: Start production server**

```bash
npm start
```

- [ ] **Step 3: Verify on production URL**

Open `http://localhost:3000` on a mobile viewport. Navigate to Formation. Repeat the same tap-hero test from Task 5 Step 3. Confirm identical behavior to dev server.

- [ ] **Step 4: Final commit**

```bash
git add public/dist
git commit -m "build: production build with mobile hero detail slide page"
```

---

## Checklist against spec

- [x] Desktop drawer unchanged — `HeroDetail` still renders on desktop, hidden on mobile via CSS
- [x] Backdrop fixed — `.hf-detail-backdrop` hidden on mobile, no more "screen darkens but nothing shows"
- [x] Slide animation — `translateX(100%) → translateX(0)` with `cubic-bezier(0.34, 1.06, 0.64, 1)`
- [x] Back button — "← Back", no swipe gesture
- [x] Bottom nav visible — `z-index: 1000` on `.mobile-bottom-tabs`, slide page at `900`
- [x] Safe-area — `bottom: calc(60px + env(safe-area-inset-bottom, 0px))`
- [x] All stats shown — HP, ATK, SPD, SP + "View full stats" table
- [x] Always mounted — `MobileHeroPage` not conditionally rendered, exit animation works
- [x] Only 2 files touched — `LobbyPage.jsx` and `lobby.css`
