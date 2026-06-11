# i18n Language System — Design Spec
**Date:** 2026-06-11  
**Scope:** pt-BR / en-US support via Custom React Context (no external dependencies)  
**Storage:** localStorage (`hf_lang`)  
**Switch UX:** Instantaneous (React state re-render, no page refresh)

---

## Goals

- Allow the user to switch between **English (en)** and **Português BR (pt-BR)** from the Settings screen.
- All visible UI strings update immediately on language change.
- Zero new npm dependencies.
- Incremental migration: components can be migrated one at a time without breaking anything.
- Fallback to English for any key not yet translated.

## Out of Scope

- Server-side rendering / SEO locale routing.
- More than 2 languages at launch.
- Pluralization rules (not needed for current string set).
- Backend persistence of language preference (localStorage is sufficient).

---

## File Structure

```
client/src/
  locale/
    en.js            ← all English strings (source of truth)
    pt-BR.js         ← Portuguese translations (same keys)
  context/
    LanguageContext.jsx   ← Provider + useT() hook
```

---

## Locale Files

Both files export a flat object keyed by dot-separated string IDs.  
Interpolation uses `{varName}` placeholders.

```js
// locale/en.js  (all current strings already in English after the translation pass)
export default {
  // Campaign
  'campaign.chapter1':       'Chapter 1',
  'campaign.loading':        'Loading...',
  'campaign.enemies':        'Enemies',
  'campaign.stageCompleted': '✅ Stage completed',
  'campaign.battleBtn':      '⚔️ Battle',

  // Gear / Inventory
  'gear.clickToRemove':      'Click to remove',
  'gear.removeFrom':         '↩ Remove from {name}',
  'gear.equipOn':            '✓ Equip on {name}',
  'gear.noItems':            'No items yet',
  'gear.allEquipped':        'All items are equipped',

  // Toast messages
  'toast.itemRemoved':       '↩️ Item removed — hero reverted to starting gear',
  'toast.couldNotRemove':    'Could not remove item',
  'toast.errorRemoving':     '⚠️ Error removing item',
  'toast.itemEquipped':      '✅ Item equipped!',
  'toast.couldNotEquip':     'Could not equip item',
  'toast.errorEquipping':    '⚠️ Error equipping item',

  // Navigation
  'nav.settings':            'Settings',

  // Rarity labels (Shop chest tooltip)
  'rarity.common':           'Common',
  'rarity.uncommon':         'Uncommon',
  'rarity.rare':             'Rare',
  'rarity.epic':             'Epic',
  'rarity.legendary':        'Legendary',
}
```

```js
// locale/pt-BR.js  (same keys, Portuguese values)
export default {
  'campaign.chapter1':       'Capítulo 1',
  'campaign.loading':        'Carregando...',
  'campaign.enemies':        'Inimigos',
  'campaign.stageCompleted': '✅ Estágio concluído',
  'campaign.battleBtn':      '⚔️ Batalhar',

  'gear.clickToRemove':      'Clique para remover',
  'gear.removeFrom':         '↩ Remover de {name}',
  'gear.equipOn':            '✓ Equipar em {name}',
  'gear.noItems':            'Sem itens ainda',
  'gear.allEquipped':        'Todos os itens estão equipados',

  'toast.itemRemoved':       '↩️ Item removido — herói voltou ao equipamento inicial',
  'toast.couldNotRemove':    'Não foi possível remover o item',
  'toast.errorRemoving':     '⚠️ Erro ao remover item',
  'toast.itemEquipped':      '✅ Item equipado!',
  'toast.couldNotEquip':     'Não foi possível equipar o item',
  'toast.errorEquipping':    '⚠️ Erro ao equipar item',

  'nav.settings':            'Config',

  'rarity.common':           'Comum',
  'rarity.uncommon':         'Incomum',
  'rarity.rare':             'Raro',
  'rarity.epic':             'Épico',
  'rarity.legendary':        'Lendário',
}
```

**Fallback rule:** if a key is missing in the active locale, `t()` returns the English value. If missing there too, returns the raw key string. New strings are safe to add in `en.js` before `pt-BR.js` is updated.

---

## LanguageContext

```jsx
// context/LanguageContext.jsx
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

**API exposed by context:**
- `t(key)` — returns translated string for current language
- `t(key, { name: 'Aria' })` — with variable interpolation
- `lang` — current language code (`'en'` or `'pt-BR'`)
- `changeLang(code)` — updates language, persists to localStorage, triggers re-render

---

## App.jsx Integration

Wrap the router with `LanguageProvider`:

```jsx
import { LanguageProvider } from './context/LanguageContext'

function App() {
  return (
    <LanguageProvider>
      <Router>...</Router>
    </LanguageProvider>
  )
}
```

---

## Settings UI

A new **Language** section is added to `SettingsView` in `LobbyPage.jsx`:

```jsx
const { lang, changeLang } = useT()

<div className="stg-section">
  <div className="stg-section-title">Language</div>
  <div className="stg-lang-row">
    {[['en', '🇺🇸 English'], ['pt-BR', '🇧🇷 Português (BR)']].map(([val, label]) => (
      <button
        key={val}
        className={`stg-lang-btn${lang === val ? ' active' : ''}`}
        onClick={() => changeLang(val)}
      >
        {label}
      </button>
    ))}
  </div>
</div>
```

Two CSS classes needed: `.stg-lang-row` (flex row) and `.stg-lang-btn` / `.stg-lang-btn.active`.  
Switch is instant — no page reload required.

---

## battle.js (Non-React)

`battle.js` is loaded once per battle session and runs outside the React tree. It reads the language preference at load time:

```js
// near the top of battle.js
const _lang = localStorage.getItem('hf_lang') || 'en'
const _STRINGS = {
  en:    { /* battle-specific strings */ },
  'pt-BR': { /* Portuguese equivalents */ },
}
function t(key) {
  return (_STRINGS[_lang]?.[key]) ?? (_STRINGS.en[key]) ?? key
}
```

Since the language cannot change mid-battle (the page would need to navigate away to Settings first), this one-time read is sufficient.

---

## Migration Strategy

Migration is incremental — components are converted one at a time:

1. **New file created:** `LanguageContext.jsx` + locale files  
2. **App.jsx:** wrap with `LanguageProvider`  
3. **Component by component:** replace hardcoded strings with `t('key')`  
4. **battle.js:** add its own inline `_STRINGS` object and `t()` helper

Components not yet migrated continue to show hardcoded English strings (already cleaned up in the translation pass on 2026-06-11). There is no regression risk during incremental migration.

---

## Components to migrate

| File | Strings to wire up |
|------|-------------------|
| `CampaignView.jsx` | 5 strings |
| `LobbyPage.jsx` | 12 strings (gear, toasts, nav tab) |
| `ShopView.jsx` | 5 rarity labels |
| `SettingsView` (inside LobbyPage) | new language selector section |
| `battle.js` | battle-specific strings (to be inventoried during implementation) |

---

## CSS additions needed

`.stg-lang-row`, `.stg-lang-btn`, `.stg-lang-btn.active` — small additions to `lobby.css` or `components.css`.
