# i18n Language System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pt-BR / en-US language switching via a custom React Context, with a picker in the Settings screen and instant re-render on change.

**Architecture:** Two flat locale files (`en.js`, `pt-BR.js`) share identical keys. A `LanguageContext` Provider wraps the whole app and exposes a `useT()` hook. `battle.js` (non-React) reads `localStorage` directly at load time and has its own inline lookup object.

**Tech Stack:** React 18, Vite, plain JS — zero new npm dependencies.

---

## File Map

| Status | Path | Role |
|--------|------|------|
| CREATE | `client/src/locale/en.js` | All English UI strings (source of truth) |
| CREATE | `client/src/locale/pt-BR.js` | Portuguese equivalents (same keys) |
| CREATE | `client/src/context/LanguageContext.jsx` | Provider + `useT()` hook |
| MODIFY | `client/src/App.jsx` | Wrap router with `LanguageProvider` |
| MODIFY | `client/src/pages/CampaignView.jsx` | Replace 5 hardcoded strings |
| MODIFY | `client/src/pages/ShopView.jsx` | Replace CHEST_DROPS labels + wire `ChestTooltip` |
| MODIFY | `client/src/pages/LobbyPage.jsx` | Replace 12 strings + add language selector to `SettingsView` |
| MODIFY | `client/src/styles/lobby.css` | Add `.stg-lang-row` / `.stg-lang-btn` styles |
| MODIFY | `public/js/battle.js` | Inline `_STRINGS` + `t()` helper for battle UI text |

---

## Task 1 — Create locale files

**Files:**
- Create: `client/src/locale/en.js`
- Create: `client/src/locale/pt-BR.js`

- [ ] **Step 1: Create `client/src/locale/en.js`**

```js
export default {
  // Campaign
  'campaign.chapter1':       'Chapter 1',
  'campaign.loading':        'Loading...',
  'campaign.enemies':        'Enemies',
  'campaign.stageCompleted': '✅ Stage completed',
  'campaign.battleBtn':      '⚔️ Battle',

  // Gear / Inventory
  'gear.clickToRemove':  'Click to remove',
  'gear.removeFrom':     '↩ Remove from {name}',
  'gear.equipOn':        '✓ Equip on {name}',
  'gear.noItems':        'No items yet',
  'gear.allEquipped':    'All items are equipped',

  // Toast messages
  'toast.itemRemoved':    '↩️ Item removed — hero reverted to starting gear',
  'toast.couldNotRemove': 'Could not remove item',
  'toast.errorRemoving':  '⚠️ Error removing item',
  'toast.itemEquipped':   '✅ Item equipped!',
  'toast.couldNotEquip':  'Could not equip item',
  'toast.errorEquipping': '⚠️ Error equipping item',

  // Navigation
  'nav.settings': 'Settings',

  // Rarity labels (Shop chest tooltip)
  'rarity.common':    'Common',
  'rarity.uncommon':  'Uncommon',
  'rarity.rare':      'Rare',
  'rarity.epic':      'Epic',
  'rarity.legendary': 'Legendary',

  // Settings screen
  'settings.language': 'Language',
}
```

- [ ] **Step 2: Create `client/src/locale/pt-BR.js`**

```js
export default {
  // Campaign
  'campaign.chapter1':       'Capítulo 1',
  'campaign.loading':        'Carregando...',
  'campaign.enemies':        'Inimigos',
  'campaign.stageCompleted': '✅ Estágio concluído',
  'campaign.battleBtn':      '⚔️ Batalhar',

  // Gear / Inventory
  'gear.clickToRemove':  'Clique para remover',
  'gear.removeFrom':     '↩ Remover de {name}',
  'gear.equipOn':        '✓ Equipar em {name}',
  'gear.noItems':        'Sem itens ainda',
  'gear.allEquipped':    'Todos os itens estão equipados',

  // Toast messages
  'toast.itemRemoved':    '↩️ Item removido — herói voltou ao equipamento inicial',
  'toast.couldNotRemove': 'Não foi possível remover o item',
  'toast.errorRemoving':  '⚠️ Erro ao remover item',
  'toast.itemEquipped':   '✅ Item equipado!',
  'toast.couldNotEquip':  'Não foi possível equipar o item',
  'toast.errorEquipping': '⚠️ Erro ao equipar item',

  // Navigation
  'nav.settings': 'Config',

  // Rarity labels
  'rarity.common':    'Comum',
  'rarity.uncommon':  'Incomum',
  'rarity.rare':      'Raro',
  'rarity.epic':      'Épico',
  'rarity.legendary': 'Lendário',

  // Settings screen
  'settings.language': 'Idioma',
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/locale/en.js client/src/locale/pt-BR.js
git commit -m "feat: add i18n locale files (en + pt-BR)"
```

---

## Task 2 — Create LanguageContext

**Files:**
- Create: `client/src/context/LanguageContext.jsx`

- [ ] **Step 1: Create `client/src/context/LanguageContext.jsx`**

```jsx
import { createContext, useContext, useState } from 'react'
import en from '../locale/en'
import ptBR from '../locale/pt-BR'

const LOCALES = { en, 'pt-BR': ptBR }
const Ctx = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem('hf_lang') || 'en'
  )

  function changeLang(newLang) {
    localStorage.setItem('hf_lang', newLang)
    setLang(newLang)
  }

  function t(key, vars = {}) {
    const dict = LOCALES[lang] ?? LOCALES.en
    let str = dict[key] ?? LOCALES.en[key] ?? key
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v)
    }
    return str
  }

  return <Ctx.Provider value={{ lang, changeLang, t }}>{children}</Ctx.Provider>
}

export const useT = () => useContext(Ctx)
```

- [ ] **Step 2: Verify the file has no syntax errors**

Start the dev server if not running:
```bash
npm run dev
```
Expected: server starts on `http://localhost:5173` with no errors in the terminal.

- [ ] **Step 3: Commit**

```bash
git add client/src/context/LanguageContext.jsx
git commit -m "feat: add LanguageContext provider and useT hook"
```

---

## Task 3 — Wrap App.jsx with LanguageProvider

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Update `App.jsx`**

Replace the entire file content with:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import LobbyPage from './pages/LobbyPage'
import BattlePage from './pages/BattlePage'
import { getSession } from './lib/session'
import { LanguageProvider } from './context/LanguageContext'

function RequireAuth({ children }) {
  return getSession() ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
          <Route path="/battle" element={<RequireAuth><BattlePage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173`. The login page should load normally with no console errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: wrap app with LanguageProvider"
```

---

## Task 4 — Migrate CampaignView.jsx

**Files:**
- Modify: `client/src/pages/CampaignView.jsx`

- [ ] **Step 1: Add `useT` import at the top of the file**

Find:
```js
import { useState, useEffect } from 'react'
```
Replace with:
```js
import { useState, useEffect } from 'react'
import { useT } from '../context/LanguageContext'
```

- [ ] **Step 2: Destructure `t` inside the component function**

Find:
```js
export default function CampaignView({ session, formations, defaultSlot, toast }) {
  const navigate = useNavigate()
  const [stages, setStages] = useState([])
```
Replace with:
```js
export default function CampaignView({ session, formations, defaultSlot, toast }) {
  const { t } = useT()
  const navigate = useNavigate()
  const [stages, setStages] = useState([])
```

- [ ] **Step 3: Replace the 5 hardcoded strings**

Find:
```jsx
          <div className="campaign-chapter-title">Chapter 1</div>
          {loading ? (
            <div className="campaign-loading">Loading...</div>
```
Replace with:
```jsx
          <div className="campaign-chapter-title">{t('campaign.chapter1')}</div>
          {loading ? (
            <div className="campaign-loading">{t('campaign.loading')}</div>
```

---

Find:
```jsx
            <div className="campaign-detail-enemies-label">Enemies</div>
```
Replace with:
```jsx
            <div className="campaign-detail-enemies-label">{t('campaign.enemies')}</div>
```

---

Find:
```jsx
              <div className="campaign-detail-done">✅ Stage completed</div>
            ) : (
              <button
                className="campaign-battle-btn"
                type="button"
                onClick={() => startStage(selectedStage)}
              >
                ⚔️ Battle
              </button>
```
Replace with:
```jsx
              <div className="campaign-detail-done">{t('campaign.stageCompleted')}</div>
            ) : (
              <button
                className="campaign-battle-btn"
                type="button"
                onClick={() => startStage(selectedStage)}
              >
                {t('campaign.battleBtn')}
              </button>
```

- [ ] **Step 4: Verify in browser**

Go to `http://localhost:5173/lobby?tab=campaign`. Open DevTools console and run:
```js
localStorage.setItem('hf_lang', 'pt-BR'); location.reload()
```
Expected: chapter title shows "Capítulo 1", loading text shows "Carregando...", enemies label shows "Inimigos".

Reset with:
```js
localStorage.setItem('hf_lang', 'en'); location.reload()
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/CampaignView.jsx
git commit -m "feat: migrate CampaignView to i18n"
```

---

## Task 5 — Migrate ShopView.jsx (rarity labels)

**Files:**
- Modify: `client/src/pages/ShopView.jsx`

- [ ] **Step 1: Add `useT` import**

Find:
```js
import { useState, useEffect, useCallback } from 'react'
```
Replace with:
```js
import { useState, useEffect, useCallback } from 'react'
import { useT } from '../context/LanguageContext'
```

- [ ] **Step 2: Change `CHEST_DROPS` to use keys instead of labels**

Find:
```js
const CHEST_DROPS = [
  { label: 'Common',    pct: '40%', cls: 'r-comum' },
  { label: 'Uncommon',  pct: '30%', cls: 'r-incomum' },
  { label: 'Rare',      pct: '20%', cls: 'r-raro' },
  { label: 'Epic',      pct: '8%',  cls: 'r-epico' },
  { label: 'Legendary', pct: '2%',  cls: 'r-lendario' },
]
```
Replace with:
```js
const CHEST_DROPS = [
  { key: 'common',    pct: '40%', cls: 'r-comum' },
  { key: 'uncommon',  pct: '30%', cls: 'r-incomum' },
  { key: 'rare',      pct: '20%', cls: 'r-raro' },
  { key: 'epic',      pct: '8%',  cls: 'r-epico' },
  { key: 'legendary', pct: '2%',  cls: 'r-lendario' },
]
```

- [ ] **Step 3: Wire `useT` into `ChestTooltip` and use `t()`**

Find:
```jsx
function ChestTooltip({ x, y }) {
  const showBelow = y < TOOLTIP_H + TOOLTIP_GAP + 16
```
Replace with:
```jsx
function ChestTooltip({ x, y }) {
  const { t } = useT()
  const showBelow = y < TOOLTIP_H + TOOLTIP_GAP + 16
```

---

Find:
```jsx
      {CHEST_DROPS.map(d => (
        <div key={d.label} className="chest-tooltip-row">
          <span className={d.cls}>{d.label}</span>
          <span>{d.pct}</span>
        </div>
      ))}
```
Replace with:
```jsx
      {CHEST_DROPS.map(d => (
        <div key={d.key} className="chest-tooltip-row">
          <span className={d.cls}>{t(`rarity.${d.key}`)}</span>
          <span>{d.pct}</span>
        </div>
      ))}
```

- [ ] **Step 4: Verify in browser**

Go to `http://localhost:5173/lobby?tab=shop`, hover over a Treasure card to see the drop rates tooltip.  
Switch to `pt-BR` via DevTools (`localStorage.setItem('hf_lang','pt-BR'); location.reload()`) and hover again.  
Expected: rarity labels show "Comum", "Incomum", "Raro", "Épico", "Lendário".

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ShopView.jsx
git commit -m "feat: migrate ShopView rarity labels to i18n"
```

---

## Task 6 — Migrate LobbyPage.jsx (gear, toasts, nav tab)

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Add `useT` import**

Find (near the top of the file):
```js
import TutorialOverlay from '../components/TutorialOverlay'
```
Replace with:
```js
import TutorialOverlay from '../components/TutorialOverlay'
import { useT } from '../context/LanguageContext'
```

- [ ] **Step 2: Destructure `t` inside `HeroDetail`**

`HeroDetail` uses gear strings. Find:
```js
function HeroDetail({ hero, onClose, playerGear = null, playerItems = [], onEquipItem = null, onUnequipItem = null }) {
  const [expanded, setExpanded] = useState(false)
```
Replace with:
```js
function HeroDetail({ hero, onClose, playerGear = null, playerItems = [], onEquipItem = null, onUnequipItem = null }) {
  const { t } = useT()
  const [expanded, setExpanded] = useState(false)
```

- [ ] **Step 3: Replace gear tooltip hint**

Find:
```jsx
                          {canUnequip && <div className="gst-hint">Click to remove</div>}
```
Replace with:
```jsx
                          {canUnequip && <div className="gst-hint">{t('gear.clickToRemove')}</div>}
```

- [ ] **Step 4: Replace unequip button text**

Find:
```jsx
                    >↩ Remove from {hero.name}</button>
```
Replace with:
```jsx
                    >{t('gear.removeFrom', { name: hero.name })}</button>
```

- [ ] **Step 5: Replace inventory empty states**

Find:
```jsx
                      {playerItems.length === 0 ? 'No items yet' : 'All items are equipped'}
```
Replace with:
```jsx
                      {playerItems.length === 0 ? t('gear.noItems') : t('gear.allEquipped')}
```

- [ ] **Step 6: Replace equip button text**

Find:
```jsx
                      >✓ Equip on {hero.name}</button>
```
Replace with:
```jsx
                      >{t('gear.equipOn', { name: hero.name })}</button>
```

- [ ] **Step 7: Destructure `t` inside `LobbyPage` (main component) for toasts**

Find:
```js
export default function LobbyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
```
Replace with:
```js
export default function LobbyPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
```

- [ ] **Step 8: Replace toast strings in `handleUnequipItem`**

Find:
```js
        showToast('↩️ Item removed — hero reverted to starting gear')
      } else {
        showToast('⚠️ ' + (d.error || 'Could not remove item'))
      }
    } catch {
      showToast('⚠️ Error removing item')
```
Replace with:
```js
        showToast(t('toast.itemRemoved'))
      } else {
        showToast('⚠️ ' + (d.error || t('toast.couldNotRemove')))
      }
    } catch {
      showToast(t('toast.errorRemoving'))
```

- [ ] **Step 9: Replace toast strings in `handleEquipItem`**

Find:
```js
        showToast('✅ Item equipped!')
      } else {
        showToast('⚠️ ' + (d.error || 'Could not equip item'))
      }
    } catch {
      showToast('⚠️ Error equipping item')
```
Replace with:
```js
        showToast(t('toast.itemEquipped'))
      } else {
        showToast('⚠️ ' + (d.error || t('toast.couldNotEquip')))
      }
    } catch {
      showToast(t('toast.errorEquipping'))
```

- [ ] **Step 10: Replace nav tab label**

Find:
```jsx
            <span className="mbt-ico">⚙️</span><span className="mbt-lbl">Settings</span>
```
Replace with:
```jsx
            <span className="mbt-ico">⚙️</span><span className="mbt-lbl">{t('nav.settings')}</span>
```

- [ ] **Step 11: Add language selector to `SettingsView`**

`SettingsView` is a separate function inside `LobbyPage.jsx`. Find:
```js
function SettingsView({ session, payoutPct }) {
  const username = session?.username
```
Replace with:
```js
function SettingsView({ session, payoutPct }) {
  const { lang, changeLang, t } = useT()
  const username = session?.username
```

---

Then find the About section and the save row that closes the settings:
```jsx
          <div className="stg-section">
            <div className="stg-section-title">About</div>
```
Insert a new section **before** the About section:
```jsx
          <div className="stg-section">
            <div className="stg-section-title">{t('settings.language')}</div>
            <div className="stg-lang-row">
              {[['en', '🇺🇸 English'], ['pt-BR', '🇧🇷 Português (BR)']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={`stg-lang-btn${lang === val ? ' active' : ''}`}
                  onClick={() => changeLang(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="stg-section">
            <div className="stg-section-title">About</div>
```

- [ ] **Step 12: Verify in browser**

Go to `http://localhost:5173/lobby?tab=settings`.  
Expected: a new "Language" section appears with two buttons: "🇺🇸 English" and "🇧🇷 Português (BR)".  
Click "Português (BR)" — the button gets the active style, and if you navigate to Campaign the text is in Portuguese instantly (no reload needed).

- [ ] **Step 13: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: migrate LobbyPage to i18n, add language selector in Settings"
```

---

## Task 7 — Add CSS for language buttons

**Files:**
- Modify: `client/src/styles/lobby.css`

- [ ] **Step 1: Append styles to `client/src/styles/lobby.css`**

Add at the end of the file:

```css
/* ── Language selector (Settings) ── */
.stg-lang-row {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.stg-lang-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.stg-lang-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.stg-lang-btn.active {
  background: rgba(140, 90, 255, 0.2);
  border-color: rgba(140, 90, 255, 0.5);
  color: #c8a8ff;
  font-weight: 600;
}
```

- [ ] **Step 2: Verify in browser**

Go to `http://localhost:5173/lobby?tab=settings`.  
Expected: the two language buttons are side-by-side, styled consistently with the rest of Settings. The active language has a purple highlight. Clicking the other language instantly highlights it.

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/lobby.css
git commit -m "feat: add CSS for language selector buttons"
```

---

## Task 8 — Migrate battle.js

**Files:**
- Modify: `public/js/battle.js`

- [ ] **Step 1: Find all user-visible string literals in battle.js**

Run this in the project root to get a list:
```bash
grep -n '"[A-Z][^"]*"' public/js/battle.js | grep -v "^.*\/\/" | head -60
```
Review the output and identify strings shown directly in the game UI (not internal log message keys or CSS class names).

- [ ] **Step 2: Add the `_lang` variable and `_STRINGS` lookup at the top of `battle.js`**

Find the very first line of `battle.js` (the `// ── RESPONSIVIDADE` comment) and insert before it:

```js
// ── i18n ─────────────────────────────────────────────────
const _lang = localStorage.getItem('hf_lang') || 'en'
const _STRINGS = {
  en: {
    'battle.waitingOpponent': '📤 Team submitted! Waiting for opponent...',
    'battle.roundBegins':     '⚔️ Round {n}/{total} — Battle begins!',
    'battle.backToLobby':     '🏠 Back to Lobby',
    'battle.connectError':    'Could not connect to the server',
    'battle.backToLobbyLink': '← Back to Lobby',
  },
  'pt-BR': {
    'battle.waitingOpponent': '📤 Time enviado! Aguardando oponente...',
    'battle.roundBegins':     '⚔️ Round {n}/{total} — Batalha começa!',
    'battle.backToLobby':     '🏠 Voltar ao Lobby',
    'battle.connectError':    'Não foi possível conectar ao servidor',
    'battle.backToLobbyLink': '← Voltar ao Lobby',
  },
}
function t(key, vars = {}) {
  const dict = _STRINGS[_lang] ?? _STRINGS.en
  let str = dict[key] ?? _STRINGS.en[key] ?? key
  for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v)
  return str
}
// ─────────────────────────────────────────────────────────
```

- [ ] **Step 3: Replace the connection error overlay string**

Find (around line 285):
```js
    ov.innerHTML = `<div><div style="font-size:28px;margin-bottom:8px">⚠️</div><b>Could not connect to the server</b><br><br>${err.message}<br><br><a href="/lobby" style="color:#aa88ff">← Back to Lobby</a></div>`;
```
Replace with:
```js
    ov.innerHTML = `<div><div style="font-size:28px;margin-bottom:8px">⚠️</div><b>${t('battle.connectError')}</b><br><br>${err.message}<br><br><a href="/lobby" style="color:#aa88ff">${t('battle.backToLobbyLink')}</a></div>`;
```

- [ ] **Step 4: Replace the "Team submitted" log message**

Find (around line 1024):
```js
    log("📤 Team submitted! Waiting for opponent...", "lr");
```
Replace with:
```js
    log(t('battle.waitingOpponent'), "lr");
```

- [ ] **Step 5: Replace the round start log message**

Find (around line 1044):
```js
  log(`⚔️ Round ${G.battleNum}/${G.format} — Battle begins!`, "lr lsep");
```
Replace with:
```js
  log(t('battle.roundBegins', { n: G.battleNum, total: G.format }), "lr lsep");
```

- [ ] **Step 6: Replace the "Back to Lobby" button text**

Find (around line 1636):
```js
      nb.textContent = "🏠 Back to Lobby";
```
Replace with:
```js
      nb.textContent = t('battle.backToLobby');
```

- [ ] **Step 7: Verify in browser**

Start a Solo Battle at `http://localhost:5173/battle`.  
Set `pt-BR` in localStorage before starting: `localStorage.setItem('hf_lang','pt-BR')` then start a battle.  
Expected: the round-start log message shows "Batalha começa!", the back button shows "Voltar ao Lobby".

- [ ] **Step 8: Commit**

```bash
git add public/js/battle.js
git commit -m "feat: add i18n support to battle.js"
```

---

## Task 9 — Build and smoke test

- [ ] **Step 1: Run the production build**

```bash
npm run build
```
Expected: no errors, `public/dist/` is updated.

- [ ] **Step 2: Start the production server**

```bash
npm start
```

- [ ] **Step 3: Full smoke test at `http://localhost:3000`**

1. Log in (or use Guest).
2. Go to **Settings** → change language to "🇧🇷 Português (BR)".
3. Verify: nav tab reads "Config", Campaign shows "Capítulo 1" / "Carregando..." / "Inimigos" / "⚔️ Batalhar".
4. Open Shop → hover Treasure card → tooltip shows "Comum / Incomum / Raro / Épico / Lendário".
5. Go to Formation, open a hero, open Gear tab — tooltip hint and buttons are in Portuguese.
6. Start a Solo Battle — round log and back button are in Portuguese.
7. Switch back to English in Settings — everything reverts instantly (Campaign/Shop/Formation re-render; Battle requires a new session).

- [ ] **Step 4: Commit translations pass (if any cleanup needed)**

```bash
git add -A
git commit -m "build: rebuild dist after i18n implementation"
```
