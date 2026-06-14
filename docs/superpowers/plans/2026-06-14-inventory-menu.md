# Inventory Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Duel" → "Play" and replace the "Campaign" nav tab with an "Inventory" screen that centralizes skin/background/gear management, removing equip actions from the Shop.

**Architecture:** New `InventoryView.jsx` component (Approach A from spec) wired into `LobbyPage.jsx` as a sibling to `ShopView`, `CampaignView`, etc. `equippedBgs` state and skin/bg equip handlers move from `ShopView` up to `LobbyPage`. Shop keeps only buy/claim actions.

**Tech Stack:** React 18, Vite, CSS (no component library). CSS alias `@styles` → `public/css/`. Styles live in `public/css/inventory.css`, imported as `import '@styles/inventory.css'`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `client/src/locale/en.js` | Modify | Add `nav.play`, `nav.inventory`, `inv.*` keys |
| `client/src/locale/pt-BR.js` | Modify | Same keys in Portuguese |
| `client/src/pages/LobbyPage.jsx` | Modify | Nav rename, lifted state/handlers, InventoryView render |
| `client/src/pages/ShopView.jsx` | Modify | Remove all equip/unequip logic and UI |
| `client/src/pages/InventoryView.jsx` | **Create** | Full inventory screen (gear + skins + bgs) |
| `public/css/inventory.css` | **Create** | All styles for InventoryView |

---

## Task 1: Add i18n keys

**Files:**
- Modify: `client/src/locale/en.js`
- Modify: `client/src/locale/pt-BR.js`

- [ ] **Step 1: Add keys to en.js**

In `client/src/locale/en.js`, replace the nav block (lines 39-45) with:

```js
  // ── Navigation tabs ───────────────────────────────────────
  'nav.settings':  'Settings',
  'nav.grimoire':  'Grimoire',
  'nav.formation': 'Formation',
  'nav.play':      'Play',
  'nav.inventory': 'Inventory',
  'nav.shop':      'Shop',

  // ── Inventory screen ──────────────────────────────────────
  'inv.tabGear':      'Gear',
  'inv.tabSkins':     'Skins',
  'inv.tabBgs':       'Backgrounds',
  'inv.sortRarity':   'Rarity',
  'inv.sortName':     'Name',
  'inv.sortStats':    'Total Stats',
  'inv.searchHero':   '🔍 Search hero…',
  'inv.noItems':      'No items in inventory',
  'inv.equipOn':      '✓ Equip on {name}',
  'inv.removeFrom':   '↩ Remove from {name}',
  'inv.allEquipped':  'All items are equipped',
  'inv.bgsEquipped':  '{n}/4 backgrounds equipped',
  'inv.minOneBg':     'At least 1 background must remain equipped.',
  'inv.minOneSkin':   'At least 1 skin must remain equipped for this hero.',
```

- [ ] **Step 2: Add keys to pt-BR.js**

In `client/src/locale/pt-BR.js`, replace the nav block (lines 39-45) with:

```js
  // ── Navigation tabs ───────────────────────────────────────
  'nav.settings':  'Config',
  'nav.grimoire':  'Grimório',
  'nav.formation': 'Formação',
  'nav.play':      'Play',
  'nav.inventory': 'Inventário',
  'nav.shop':      'Loja',

  // ── Inventory screen ──────────────────────────────────────
  'inv.tabGear':      'Equipamentos',
  'inv.tabSkins':     'Skins',
  'inv.tabBgs':       'Cenários',
  'inv.sortRarity':   'Raridade',
  'inv.sortName':     'Nome',
  'inv.sortStats':    'Total de Stats',
  'inv.searchHero':   '🔍 Buscar herói…',
  'inv.noItems':      'Nenhum item no inventário',
  'inv.equipOn':      '✓ Equipar em {name}',
  'inv.removeFrom':   '↩ Remover de {name}',
  'inv.allEquipped':  'Todos os itens estão equipados',
  'inv.bgsEquipped':  '{n}/4 cenários equipados',
  'inv.minOneBg':     'Ao menos 1 cenário deve permanecer equipado.',
  'inv.minOneSkin':   'Ao menos 1 skin deve permanecer equipada para este herói.',
```

- [ ] **Step 3: Commit**

```bash
git add client/src/locale/en.js client/src/locale/pt-BR.js
git commit -m "feat(i18n): add nav.play, nav.inventory and inv.* keys"
```

---

## Task 2: Rename nav tabs in LobbyPage

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Update `allowed` tabs array and initial state**

Find this line (around line 1097):
```js
const allowed = ['home', 'campaign', 'shop', 'formation', 'grimoire', 'settings']
```
Replace with:
```js
const allowed = ['home', 'inventory', 'shop', 'formation', 'grimoire', 'settings']
```

- [ ] **Step 2: Update top nav — "DUEL" tab**

Find this block in the top `<nav>` (around line 1739):
```jsx
<button type="button" className={`top-nav-tab${view === 'home' ? ' active' : ''}`} onClick={() => setView('home')}>
  <span className="tnt-ico">⚔️</span><span className="tnt-lbl">{t('nav.duel')}</span>
</button>
```
Replace with:
```jsx
<button type="button" className={`top-nav-tab${view === 'home' ? ' active' : ''}`} onClick={() => setView('home')}>
  <span className="tnt-ico">⚔️</span><span className="tnt-lbl">{t('nav.play')}</span>
</button>
```

- [ ] **Step 3: Update top nav — "CAMPAIGN" tab**

Find:
```jsx
<button type="button" className={`top-nav-tab${view === 'campaign' ? ' active' : ''}`} onClick={() => setView('campaign')}>
  <span className="tnt-ico">📜</span><span className="tnt-lbl">{t('nav.campaign')}</span>
</button>
```
Replace with:
```jsx
<button type="button" className={`top-nav-tab${view === 'inventory' ? ' active' : ''}`} onClick={() => setView('inventory')}>
  <span className="tnt-ico">🎒</span><span className="tnt-lbl">{t('nav.inventory')}</span>
</button>
```

- [ ] **Step 4: Update mobile bottom tabs — "DUEL"**

Find in `<nav className="mobile-bottom-tabs">` (around line 2014):
```jsx
<button type="button" className={navTabClass('home')} onClick={() => setView('home')}>
  <span className="mbt-ico">⚔️</span><span className="mbt-lbl">{t('nav.duel')}</span>
</button>
```
Replace with:
```jsx
<button type="button" className={navTabClass('home')} onClick={() => setView('home')}>
  <span className="mbt-ico">⚔️</span><span className="mbt-lbl">{t('nav.play')}</span>
</button>
```

- [ ] **Step 5: Update mobile bottom tabs — "CAMPAIGN"**

Find:
```jsx
<button type="button" className={navTabClass('campaign')} onClick={() => setView('campaign')}>
  <span className="mbt-ico">📜</span><span className="mbt-lbl">{t('nav.campaign')}</span>
</button>
```
Replace with:
```jsx
<button type="button" className={navTabClass('inventory')} onClick={() => setView('inventory')}>
  <span className="mbt-ico">🎒</span><span className="mbt-lbl">{t('nav.inventory')}</span>
</button>
```

- [ ] **Step 6: Verify build passes**

```bash
cd c:/Fontes_Javascript/HorizonForge && npm run build
```
Expected: no errors. Open `http://localhost:5173/lobby` and confirm nav shows "PLAY" and "INVENTORY" labels with correct icons.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat(nav): rename Duel→Play and Campaign→Inventory tabs"
```

---

## Task 3: Lift equippedBgs + skin/bg handlers to LobbyPage

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Add `equippedBgs` state**

Find the existing state declarations block (around line 1107):
```js
const [equippedSkins, setEquippedSkins] = useState({})
```
Add directly below it:
```js
const [equippedBgs, setEquippedBgs] = useState([])
```

- [ ] **Step 2: Add useEffect to load equipped backgrounds**

Find the existing skin useEffect (around line 1391):
```js
/* ── load equipped skins ─────────────────────────────── */
useEffect(() => {
  if (!session?.token) return
  fetch('/api/cosmetics/skins/equipped', { headers: { Authorization: `Bearer ${session.token}` } })
    .then(r => r.json())
    .then(d => { if (d.ok) setEquippedSkins(d.equipped || {}) })
    .catch(() => {})
}, []) // eslint-disable-line
```
Add a new useEffect directly below it:
```js
/* ── load equipped backgrounds ───────────────────────── */
useEffect(() => {
  if (!session?.token) return
  fetch('/api/cosmetics/backgrounds/equipped', { headers: { Authorization: `Bearer ${session.token}` } })
    .then(r => r.json())
    .then(d => { if (d.ok) setEquippedBgs(d.equipped || []) })
    .catch(() => {})
}, []) // eslint-disable-line
```

- [ ] **Step 3: Add skin/bg equip handlers**

Find `/* ── equip item from inventory ───────────────────────── */` (around line 1446).
Add these four functions directly before it:

```js
/* ── equip / unequip skin ────────────────────────────── */
async function handleEquipSkin(skin_id) {
  try {
    const res = await fetch('/api/cosmetics/skins/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ skin_id }),
    }).then(r => r.json())
    if (res.ok) {
      const catalogRes = await fetch('/api/shop').then(r => r.json())
      const item = (catalogRes.items || []).find(i => i.id === skin_id)
      if (item?.hero_cid) {
        setEquippedSkins(prev => ({ ...prev, [item.hero_cid]: { skin_id, preview: item.preview || '' } }))
      }
    } else {
      showToast(res.error || t('toast.couldNotEquip'))
    }
  } catch { showToast(t('toast.errorEquipping')) }
}

async function handleUnequipSkin(skin_id) {
  const hero_cid = Object.keys(equippedSkins).find(k => equippedSkins[k].skin_id === skin_id)
  if (!hero_cid) return
  try {
    const res = await fetch('/api/cosmetics/skins/unequip', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ hero_cid }),
    }).then(r => r.json())
    if (res.ok) {
      setEquippedSkins(prev => { const next = { ...prev }; delete next[hero_cid]; return next })
    } else {
      showToast(res.error || t('toast.couldNotRemove'))
    }
  } catch { showToast(t('toast.errorRemoving')) }
}

/* ── equip / unequip background ─────────────────────── */
async function handleEquipBg(item_id) {
  try {
    const res = await fetch('/api/cosmetics/backgrounds/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ item_id }),
    }).then(r => r.json())
    if (res.ok) {
      const catalogRes = await fetch('/api/shop').then(r => r.json())
      const item = (catalogRes.items || []).find(i => i.id === item_id)
      setEquippedBgs(prev => [...prev, { id: item_id, preview: item?.preview || '' }])
    } else {
      showToast(res.error || t('toast.couldNotEquip'))
    }
  } catch { showToast(t('toast.errorEquipping')) }
}

async function handleUnequipBg(item_id) {
  if (equippedBgs.length <= 1) { showToast(t('inv.minOneBg')); return }
  try {
    const res = await fetch('/api/cosmetics/backgrounds/unequip', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ item_id }),
    }).then(r => r.json())
    if (res.ok) {
      setEquippedBgs(prev => prev.filter(b => b.id !== item_id))
    } else {
      showToast(res.error || t('toast.couldNotRemove'))
    }
  } catch { showToast(t('toast.errorRemoving')) }
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat(lobby): lift equippedBgs state and skin/bg handlers from ShopView"
```

---

## Task 4: Strip equip/unequip from ShopView

**Files:**
- Modify: `client/src/pages/ShopView.jsx`

- [ ] **Step 1: Remove equip-related state and functions**

In `ShopView` component, remove these state declarations:
```js
const [equippedBgs, setEquippedBgs] = useState([])
const [equippedSkins, setEquippedSkins] = useState({})
const [equipping, setEquipping] = useState(null)
```

Remove the `equippedBgIds` computed value:
```js
const equippedBgIds = new Set(equippedBgs.map(b => b.id))
```

Remove these four functions entirely: `equipBackground`, `unequipBackground`, `equipSkin`, `unequipSkin`.

- [ ] **Step 2: Simplify the owned-items useEffect**

Find the useEffect that loads owned items (around line 71). Replace the entire block:
```js
if (isHive && token) {
  const h = { Authorization: `Bearer ${token}` }
  fetch('/api/shop/owned', { headers: h })
    .then(r => r.json())
    .then(async d => {
      setOwned(new Set(d.owned || []))
      const [bgs, skins] = await Promise.all([
        fetch('/api/cosmetics/backgrounds/equipped', { headers: h }).then(r => r.json()),
        fetch('/api/cosmetics/skins/equipped', { headers: h }).then(r => r.json()),
      ])
      setEquippedBgs(bgs.equipped || [])
      setEquippedSkins(skins.equipped || {})
    })
    .catch(() => { })
}
```
With:
```js
if (isHive && token) {
  fetch('/api/shop/owned', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then(d => { setOwned(new Set(d.owned || [])) })
    .catch(() => { })
}
```

- [ ] **Step 3: Remove equip props from sharedCardProps**

Find:
```js
const sharedCardProps = { isHive, heroData, equippedBgs, equippedBgIds, equippedSkins, equipping }
```
Replace with:
```js
const sharedCardProps = { isHive, heroData }
```

- [ ] **Step 4: Remove equip props from ShopItemCard and ShopListRow usages**

In both `<ShopItemCard ... />` and `<ShopListRow ... />` within the grid/list renders, remove the `onEquip`, `onUnequip`, and `{...sharedCardProps}` spread — replace with explicit props only:
```jsx
<ShopItemCard
  key={item.id}
  item={item}
  isOwned={owned.has(item.id)}
  isClaiming={claiming === item.id}
  onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
  isHive={isHive}
  heroData={heroData}
/>
```
And:
```jsx
<ShopListRow
  key={item.id}
  item={item}
  isOwned={owned.has(item.id)}
  isClaiming={claiming === item.id}
  onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
  isHive={isHive}
  heroData={heroData}
/>
```

- [ ] **Step 5: Simplify ShopItemCard — remove equip/unequip UI**

Find the `ShopItemCard` function. Replace its entire props signature and actions section:

```jsx
function ShopItemCard({ item, isOwned, isHive, isClaiming, onBuy, heroData }) {
  const { t } = useT()
  const isFree = item.price_hive === 0
  const bgSize = item.type === 'treasure' ? 'contain' : 'cover'
  const previewStyle = { backgroundImage: `url(${item.preview})`, backgroundSize: bgSize, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }

  return (
    <div className={`shop-card${isOwned ? ' shop-card-owned' : ''}`}>
      {item.type === 'skin' && !item.preview
        ? <SkinPreview item={item} heroData={heroData} className="shop-card-preview" />
        : item.type === 'treasure'
          ? <TreasurePreview previewStyle={previewStyle} showDropRates={item.id !== 'chaos_chest'} />
          : <div className="shop-card-preview" style={previewStyle} />
      }
      <div className="shop-card-body">
        <div className="shop-card-name">{item.name}</div>
        {item.type === 'skin' && item.hero_cid && (
          <div className="shop-card-hero">{item.hero_cid.charAt(0).toUpperCase() + item.hero_cid.slice(1)}</div>
        )}
        {item.type === 'skin' && item.description && (
          <div className="shop-card-desc">{item.description}</div>
        )}
        <div className="shop-card-actions">
          {item.type === 'treasure'
            ? <button
                className="shop-card-btn buy"
                disabled={isClaiming || !isHive}
                onClick={onBuy}
                title={!isHive ? 'Log in with Hive Keychain to purchase.' : undefined}
              >
                {isClaiming ? '⌛' : `${item.price_hive.toFixed(3)} HIVE`}
              </button>
            : isOwned
              ? <div className="shop-card-owned-badge">{t('shop.owned')}</div>
              : <button
                  className={`shop-card-btn${isFree ? ' free' : ' buy'}`}
                  disabled={isClaiming || !isHive}
                  onClick={onBuy}
                  title={!isHive ? 'Log in with Hive Keychain to purchase.' : undefined}
                >
                  {isClaiming ? '⌛' : isFree ? t('shop.getFree') : `${item.price_hive.toFixed(3)} HIVE`}
                </button>
          }
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Simplify ShopListRow — remove equip/unequip UI**

Replace the entire `ShopListRow` function:

```jsx
function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy, heroData }) {
  const { t } = useT()
  const isFree = item.price_hive === 0

  return (
    <div className={`shop-row${isOwned ? ' shop-row-owned' : ''}`}>
      {item.type === 'skin' && !item.preview
        ? <SkinPreview item={item} heroData={heroData} className="shop-row-preview" />
        : <div className="shop-row-preview" style={{ backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      }
      <div className="shop-row-info">
        <div className="shop-row-name">{item.name}</div>
        <div className="shop-row-type">
          {item.type === 'background' ? t('shop.typeBackground') : item.type === 'treasure' ? t('shop.typeTreasure') : `${t('shop.typeSkin')} · ${item.hero_cid || ''}`}
        </div>
      </div>
      <div className="shop-row-right">
        {isOwned
          ? <div className="shop-row-state">{t('shop.owned')}</div>
          : item.type !== 'treasure' && <div className="shop-row-price">{isFree ? t('shop.free') : `${item.price_hive.toFixed(3)} HIVE`}</div>
        }
        {item.type === 'treasure'
          ? <button
              className="shop-row-btn buy"
              disabled={isClaiming || !isHive}
              onClick={onBuy}
              title={!isHive ? 'Log in with Hive Keychain to purchase.' : undefined}
            >
              {isClaiming ? '⌛' : `${item.price_hive.toFixed(3)} HIVE`}
            </button>
          : !isOwned
            ? <button
                className={`shop-row-btn${isFree ? ' free' : ' buy'}`}
                disabled={isClaiming || !isHive}
                onClick={onBuy}
                title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
              >
                {isClaiming ? '⌛' : isFree ? t('shop.getFree') : t('shop.buy')}
              </button>
            : null
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Remove unused functions — `getItemEquipState`, `SkinPreview` already used in new code — keep it. Delete only `getItemEquipState`.**

Find and delete:
```js
function getItemEquipState(item, equippedBgIds, equippedSkins) {
  if (item.type === 'background') return equippedBgIds.has(item.id)
  if (item.type === 'skin') return equippedSkins[item.hero_cid]?.skin_id === item.id
  return false
}
```

- [ ] **Step 8: Remove background slot-dots bar from shop (it now belongs in Inventory)**

In the `filter === 'background'` block inside ShopView's render, find and remove the slot-dots bar:
```jsx
{filter === 'background' && (
  <div className="shop-slot-counter-bar">
    <div className="shop-slot-dots">
      {[0, 1, 2, 3].map(i => (
        <span key={i} className={`shop-slot-dot${i < equippedBgs.length ? ' filled' : ''}`} />
      ))}
    </div>
    <span className="shop-slot-label">{t('shop.bgsEquipped', { n: equippedBgs.length })}</span>
    <label className="shop-owned-toggle">
      <input type="checkbox" checked={showOwned} onChange={e => setShowOwned(e.target.checked)} />
      {t('shop.showOwned')}
    </label>
  </div>
)}
```
Replace with just the owned toggle (keep it for filtering convenience):
```jsx
{filter === 'background' && (
  <div className="shop-slot-counter-bar">
    <label className="shop-owned-toggle">
      <input type="checkbox" checked={showOwned} onChange={e => setShowOwned(e.target.checked)} />
      {t('shop.showOwned')}
    </label>
  </div>
)}
```

- [ ] **Step 9: Build and verify Shop works**

```bash
npm run build
```
Expected: no errors. Open Shop at `http://localhost:5173/lobby?tab=shop` — owned skins/backgrounds show only "OWNED" badge, no equip buttons. Buy flow still works.

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/ShopView.jsx
git commit -m "feat(shop): remove equip/unequip — shop is buy-only now"
```

---

## Task 5: Create InventoryView skeleton with sidebar tabs

**Files:**
- Create: `client/src/pages/InventoryView.jsx`
- Create: `public/css/inventory.css`

- [ ] **Step 1: Create the CSS file**

Create `public/css/inventory.css`:

```css
/* ── InventoryView root ──────────────────────────────────── */
#view-inventory {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.inv-layout {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 0;
}

/* ── Sidebar ─────────────────────────────────────────────── */
.inv-sidebar {
  width: 130px;
  flex-shrink: 0;
  background: #16152a;
  border-right: 1px solid #2a2850;
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.inv-sidebar-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #5a5080;
  padding: 0 6px;
  margin-bottom: 4px;
}

.inv-tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #7a70a0;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  width: 100%;
}

.inv-tab-btn:hover { background: #1e1c38; color: #c0b8e8; }
.inv-tab-btn.active { background: #7c4fff; color: #fff; font-weight: 600; }

.inv-tab-ico { font-size: 15px; }

/* ── Main content area ───────────────────────────────────── */
.inv-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Filter bar (search + role buttons) ─────────────────── */
.inv-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #16152a;
  border: 1px solid #2a2850;
  border-radius: 9px;
  padding: 8px 12px;
}

.inv-search {
  flex: 1;
  background: #1e1c38;
  border: 1px solid #3a3860;
  border-radius: 6px;
  padding: 5px 10px;
  color: #c0b8e8;
  font-size: 12px;
  outline: none;
}

.inv-search::placeholder { color: #5a5080; }
.inv-search:focus { border-color: #7c4fff; }

.inv-role-btn {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #3a3860;
  background: #1e1c38;
  color: #7a70a0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.inv-role-btn:hover { border-color: #7c4fff; color: #c0b8e8; }
.inv-role-btn.active { background: #7c4fff; border-color: #7c4fff; color: #fff; }

/* ── Hero carousel ───────────────────────────────────────── */
.inv-carousel-wrap {
  background: #16152a;
  border: 1px solid #2a2850;
  border-radius: 9px;
  padding: 12px;
}

.inv-carousel-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #5a5080;
  margin-bottom: 10px;
}

.inv-carousel-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inv-carousel-arrow {
  background: transparent;
  border: 1px solid #3a3860;
  border-radius: 6px;
  color: #7a70a0;
  font-size: 18px;
  padding: 2px 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.inv-carousel-arrow:hover:not(:disabled) { border-color: #7c4fff; color: #c0b8e8; }
.inv-carousel-arrow:disabled { opacity: 0.3; cursor: default; }

.inv-hero-list {
  display: flex;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.inv-hero-card {
  background: #1e1c38;
  border: 1px solid #2a2850;
  border-radius: 9px;
  padding: 8px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 70px;
}

.inv-hero-card:hover { border-color: #7c4fff55; }
.inv-hero-card.selected { border-color: #a08fff; background: linear-gradient(180deg, #2a1a5e, #1e1c38); }

.inv-hero-icon { font-size: 24px; margin-bottom: 4px; }
.inv-hero-name { font-size: 9px; color: #a08fff; font-weight: 600; }
.inv-hero-role { font-size: 8px; margin-top: 2px; }
.inv-hero-role.role-tank    { color: #42a5f5; }
.inv-hero-role.role-dps     { color: #ef5350; }
.inv-hero-role.role-support { color: #4caf50; }

.inv-carousel-hint {
  font-size: 9px;
  color: #5a5080;
  text-align: center;
  margin-top: 6px;
}

/* ── Gear panels row ─────────────────────────────────────── */
.inv-panels-row {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

/* ── Slots panel ─────────────────────────────────────────── */
.inv-slots-panel {
  background: #16152a;
  border: 1px solid #2a2850;
  border-radius: 9px;
  padding: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inv-panel-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #7a70a0;
}

.inv-slots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.inv-slot {
  background: #1e1c38;
  border: 1px dashed #3a3860;
  border-radius: 7px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  position: relative;
  cursor: default;
  transition: all 0.15s;
}

.inv-slot.equipped {
  border-style: solid;
  cursor: pointer;
}

.inv-slot.equipped:hover { opacity: 0.85; }
.inv-slot.unequip-pending { border-color: #ef5350 !important; background: #ef535022; }

/* Rarity dot */
.inv-slot-dot {
  position: absolute;
  bottom: 3px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* Slot tooltip on hover */
.inv-slot-tip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #0d0d1a;
  border: 1px solid #3a3860;
  border-radius: 7px;
  padding: 7px 10px;
  font-size: 10px;
  color: #c0b8e8;
  white-space: nowrap;
  z-index: 50;
  pointer-events: none;
  min-width: 110px;
  text-align: left;
}

.inv-slot:hover .inv-slot-tip { display: block; }
.inv-slot-tip-name { font-weight: 600; margin-bottom: 3px; }
.inv-slot-tip-stat { font-size: 9px; color: #4cff91; }
.inv-slot-tip-neg  { font-size: 9px; color: #ff5c5c; }
.inv-slot-tip-hint { font-size: 9px; color: #ef5350; margin-top: 4px; }

/* Mini stats */
.inv-mini-stats {
  background: #0d0d1a;
  border-radius: 6px;
  padding: 7px 10px;
  display: flex;
  gap: 14px;
}

.inv-mini-stat { font-size: 10px; }
.inv-mini-stat.pos { color: #4cff91; }
.inv-mini-stat.zero { color: #5a5080; }

/* Unequip confirm */
.inv-unequip-confirm {
  background: #1e1c38;
  border: 1px solid #ef535055;
  border-radius: 7px;
  padding: 8px 10px;
}

.inv-confirm-name { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.inv-confirm-stats { font-size: 10px; color: #c0b8e8; margin-bottom: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
.inv-confirm-actions { display: flex; gap: 6px; }

.inv-btn-remove {
  flex: 1;
  padding: 6px;
  background: #ef535022;
  border: 1px solid #ef535066;
  border-radius: 6px;
  color: #ef5350;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.inv-btn-remove:hover { background: #ef535044; }

.inv-btn-cancel {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #3a3860;
  border-radius: 6px;
  color: #7a70a0;
  font-size: 11px;
  cursor: pointer;
}

/* ── Inventory panel (unequipped items) ──────────────────── */
.inv-items-panel {
  background: #16152a;
  border: 1px solid #2a2850;
  border-radius: 9px;
  padding: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inv-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.inv-sort-select {
  background: #1e1c38;
  border: 1px solid #3a3860;
  border-radius: 6px;
  padding: 3px 7px;
  color: #7a70a0;
  font-size: 10px;
  outline: none;
  cursor: pointer;
}

.inv-items-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  overflow-y: auto;
}

.inv-item-slot {
  background: #1e1c38;
  border-radius: 7px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}

.inv-item-slot:hover { opacity: 0.85; }
.inv-item-slot.selected { outline: 2px solid #a08fff; outline-offset: 1px; }

.inv-item-rarity-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 0 0 7px 7px;
}

.inv-equip-confirm {
  background: #1e1c38;
  border: 1px solid #7c4fff55;
  border-radius: 7px;
  padding: 8px 10px;
}

.inv-equip-confirm-name { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.inv-equip-confirm-stats { font-size: 10px; color: #c0b8e8; margin-bottom: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
.inv-equip-confirm-actions { display: flex; gap: 6px; }

.inv-btn-equip {
  flex: 1;
  padding: 6px;
  background: #7c4fff22;
  border: 1px solid #7c4fff66;
  border-radius: 6px;
  color: #a08fff;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.inv-btn-equip:hover { background: #7c4fff44; }

.inv-empty {
  font-size: 11px;
  color: #5a5080;
  font-style: italic;
  text-align: center;
  padding: 20px 0;
}

/* ── Skins / Backgrounds grid ────────────────────────────── */
.inv-cosmetics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.inv-cosm-card {
  background: #16152a;
  border: 1px solid #2a2850;
  border-radius: 9px;
  overflow: hidden;
}

.inv-cosm-card.equipped-card { border-color: #7c4fff66; }

.inv-cosm-preview {
  height: 110px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.inv-cosm-body {
  padding: 8px 10px;
}

.inv-cosm-name { font-size: 11px; color: #c0b8e8; font-weight: 600; margin-bottom: 2px; }
.inv-cosm-hero { font-size: 9px; color: #7a70a0; margin-bottom: 6px; }

.inv-cosm-actions { display: flex; gap: 6px; }

.inv-cosm-btn {
  flex: 1;
  padding: 5px;
  border-radius: 6px;
  font-size: 10px;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.15s;
}

.inv-cosm-btn.equip {
  background: #7c4fff22;
  border-color: #7c4fff66;
  color: #a08fff;
}

.inv-cosm-btn.equip:hover { background: #7c4fff44; }

.inv-cosm-btn.unequip {
  background: #ef535022;
  border-color: #ef535066;
  color: #ef8080;
}

.inv-cosm-btn.unequip:hover { background: #ef535044; }

/* Bg slot dots */
.inv-bg-dots-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.inv-bg-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2a2850;
  border: 1px solid #3a3860;
  transition: background 0.2s;
}

.inv-bg-dot.filled { background: #7c4fff; border-color: #a08fff; }

/* ── Mobile responsive ───────────────────────────────────── */
@media (max-width: 900px) {
  .inv-layout { flex-direction: column; }

  .inv-sidebar {
    width: 100%;
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid #2a2850;
    padding: 8px 12px;
    gap: 6px;
    overflow-x: auto;
  }

  .inv-sidebar-label { display: none; }

  .inv-tab-btn {
    flex-shrink: 0;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
  }

  .inv-tab-btn .inv-tab-ico { font-size: 13px; }

  .inv-main { padding: 10px; }

  .inv-panels-row { flex-direction: column; }

  .inv-hero-list { justify-content: flex-start; }

  .inv-hero-card { min-width: 60px; }

  .inv-carousel-arrow { padding: 2px 7px; font-size: 15px; }

  .inv-cosmetics-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
}
```

- [ ] **Step 2: Create InventoryView.jsx skeleton**

Create `client/src/pages/InventoryView.jsx`:

```jsx
import { useState } from 'react'
import '@styles/inventory.css'
import { useT } from '../context/LanguageContext'

const RARITY_COLORS = {
  common: '#c0bdb5', uncommon: '#4caf50', rare: '#42a5f5',
  epic: '#ba68c8', legendary: '#ff2d9b', starter: '#6a6080',
}

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4, starter: 5 }

const SLOT_ORDER = ['amulet','helm','special','weapon','chest','offhand','belt','legs','gloves','ring1','boots','ring2']

const SLOT_LABELS = {
  amulet: 'AMULET', helm: 'HELMET', special: 'SPECIAL', weapon: 'WEAPON',
  chest: 'CHEST', offhand: 'OFF-HAND', belt: 'BELT', legs: 'LEGS',
  gloves: 'GLOVES', ring1: 'RING 1', boots: 'BOOTS', ring2: 'RING 2',
}

const SLOT_ICONS = {
  amulet: '📿', helm: '⛑️', special: '✨', weapon: '⚔️',
  chest: '🛡️', offhand: '📜', belt: '🏷️', legs: '👖',
  gloves: '🧤', ring1: '💍', boots: '🥾', ring2: '💍',
}

function roleCategory(role) {
  if (!role) return 'dps'
  const r = role.toLowerCase()
  if (r === 'tank' || r === 'paladin') return 'tank'
  if (r === 'support') return 'support'
  return 'dps'
}

export default function InventoryView({
  session, heroData, playerGear, playerItems,
  equippedSkins, equippedBgs,
  onEquipItem, onUnequipItem,
  onEquipSkin, onUnequipSkin,
  onEquipBg, onUnequipBg,
  toast,
}) {
  const { t } = useT()
  const [activeTab, setActiveTab] = useState('gear')

  const TABS = [
    { key: 'gear',        icon: '⚔️', label: t('inv.tabGear') },
    { key: 'skins',       icon: '🎨', label: t('inv.tabSkins') },
    { key: 'backgrounds', icon: '🖼️', label: t('inv.tabBgs') },
  ]

  return (
    <div id="view-inventory" className="lv active">
      <div className="inv-layout">
        {/* Sidebar */}
        <aside className="inv-sidebar">
          <div className="inv-sidebar-label">Category</div>
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`inv-tab-btn${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="inv-tab-ico">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Main content */}
        <div className="inv-main">
          {activeTab === 'gear' && <p style={{ color: '#5a5080' }}>Gear tab — coming in next task</p>}
          {activeTab === 'skins' && <p style={{ color: '#5a5080' }}>Skins tab — coming in next task</p>}
          {activeTab === 'backgrounds' && <p style={{ color: '#5a5080' }}>Backgrounds tab — coming in next task</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire InventoryView into LobbyPage (skeleton)**

In `client/src/pages/LobbyPage.jsx`:

Add import at the top (with other view imports):
```js
import InventoryView from './InventoryView'
```

Find the `{view === 'campaign' && ...}` render block (around line 1988) and add after it:
```jsx
{view === 'inventory' && (
  <InventoryView
    session={session}
    heroData={heroData}
    playerGear={playerGear}
    playerItems={playerItems}
    equippedSkins={equippedSkins}
    equippedBgs={equippedBgs}
    onEquipItem={handleEquipItem}
    onUnequipItem={handleUnequipItem}
    onEquipSkin={handleEquipSkin}
    onUnequipSkin={handleUnequipSkin}
    onEquipBg={handleEquipBg}
    onUnequipBg={handleUnequipBg}
    toast={showToast}
  />
)}
```

- [ ] **Step 4: Build and verify skeleton renders**

```bash
npm run build
```
Open `http://localhost:5173/lobby` — click Inventory tab (🎒). Should show sidebar with 3 tabs, placeholder text per tab. No console errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/InventoryView.jsx public/css/inventory.css client/src/pages/LobbyPage.jsx
git commit -m "feat(inventory): add InventoryView skeleton with sidebar tabs and CSS"
```

---

## Task 6: Gear tab — hero carousel with search and role filter

**Files:**
- Modify: `client/src/pages/InventoryView.jsx`

- [ ] **Step 1: Add carousel state and logic to InventoryView**

In `InventoryView`, add these state declarations after `activeTab`:

```js
const [selectedHero, setSelectedHero] = useState(null)
const [heroSearch, setHeroSearch] = useState('')
const [roleFilter, setRoleFilter] = useState('all')
const [carouselOffset, setCarouselOffset] = useState(0)
```

Add the filtered heroes computation and carousel helpers before the `return`:

```js
const filteredHeroes = (heroData || []).filter(h => {
  const matchRole = roleFilter === 'all' || roleCategory(h.role) === roleFilter
  const matchSearch = !heroSearch || h.name.toLowerCase().includes(heroSearch.toLowerCase())
  return matchRole && matchSearch
})

const VISIBLE = 4
const total = filteredHeroes.length
const visibleHeroes = total === 0
  ? []
  : Array.from({ length: Math.min(VISIBLE, total) }, (_, i) => filteredHeroes[(carouselOffset + i) % total])

function moveCarousel(dir) {
  if (total === 0) return
  setCarouselOffset(prev => (prev + dir + total) % total)
}

const currentHero = selectedHero ?? filteredHeroes[0] ?? null
```

- [ ] **Step 2: Replace placeholder in Gear tab with filter bar + carousel**

Replace `{activeTab === 'gear' && <p ...>}` with:

```jsx
{activeTab === 'gear' && (
  <>
    {/* Filter bar */}
    <div className="inv-filter-bar">
      <input
        className="inv-search"
        type="text"
        placeholder={t('inv.searchHero')}
        value={heroSearch}
        onChange={e => { setHeroSearch(e.target.value); setCarouselOffset(0) }}
      />
      {[
        ['all', t('formation.filterAll')],
        ['tank',    '🛡️'],
        ['dps',     '⚔️'],
        ['support', '💚'],
      ].map(([role, label]) => (
        <button
          key={role}
          type="button"
          className={`inv-role-btn${roleFilter === role ? ' active' : ''}`}
          onClick={() => { setRoleFilter(role); setCarouselOffset(0) }}
        >
          {label}
        </button>
      ))}
    </div>

    {/* Hero carousel */}
    <div className="inv-carousel-wrap">
      <div className="inv-carousel-label">
        {t('formation.collection')} ({total})
      </div>
      <div className="inv-carousel-row">
        <button
          type="button"
          className="inv-carousel-arrow"
          disabled={total <= VISIBLE}
          onClick={() => moveCarousel(-1)}
        >‹</button>

        <div className="inv-hero-list">
          {!heroData && <div className="inv-empty">{t('formation.loading')}</div>}
          {heroData && total === 0 && <div className="inv-empty">{t('formation.noHeroesFound')}</div>}
          {visibleHeroes.map(h => {
            const skinUrl = equippedSkins?.[h.cid]?.preview || h.url_portrait || null
            const isSelected = currentHero?.cid === h.cid
            const cat = roleCategory(h.role)
            return (
              <div
                key={h.cid}
                className={`inv-hero-card${isSelected ? ' selected' : ''}`}
                onClick={() => setSelectedHero(h)}
              >
                {skinUrl
                  ? <div className="inv-hero-icon" style={{ width: 40, height: 40, borderRadius: 6, backgroundImage: `url('${skinUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center', margin: '0 auto 4px' }} />
                  : <div className="inv-hero-icon">{h.icon}</div>
                }
                <div className="inv-hero-name">{h.name}</div>
                <div className={`inv-hero-role role-${cat}`}>
                  {cat === 'tank' ? t('role.tank') : cat === 'support' ? t('role.support') : t('role.dps')}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className="inv-carousel-arrow"
          disabled={total <= VISIBLE}
          onClick={() => moveCarousel(1)}
        >›</button>
      </div>
      {total > VISIBLE && (
        <div className="inv-carousel-hint">
          {carouselOffset + 1}–{Math.min(carouselOffset + VISIBLE, total)} / {total}
        </div>
      )}
    </div>

    {/* Gear panels placeholder */}
    <div className="inv-panels-row">
      <p style={{ color: '#5a5080' }}>Slots + inventory panels — next task</p>
    </div>
  </>
)}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Open Inventory → Gear tab. Search bar and role filter buttons appear. Hero carousel shows 4 heroes, clicking one highlights it. ‹ › arrows navigate.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/InventoryView.jsx
git commit -m "feat(inventory): add hero carousel with search and role filter to Gear tab"
```

---

## Task 7: Gear tab — slots panel + mini-stats + unequip confirm

**Files:**
- Modify: `client/src/pages/InventoryView.jsx`

- [ ] **Step 1: Add unequip state**

Add after the carousel state:
```js
const [unequipPending, setUnequipPending] = useState(null)
```

- [ ] **Step 2: Add GearSlotsPanel component inside InventoryView.jsx (before the export)**

```jsx
function GearSlotsPanel({ hero, playerGear, onUnequipItem, unequipPending, setUnequipPending, t }) {
  if (!hero) return null
  const heroGear = playerGear?.[hero.cid] ?? { slots: {}, totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 } }
  const { atk_bonus, hp_bonus, spd_bonus } = heroGear.totals

  return (
    <div className="inv-slots-panel">
      <div className="inv-panel-title">
        {hero.icon} {hero.name} — {SLOT_LABELS['helm'] && 'Gear'}
      </div>

      {/* 12-slot grid */}
      <div className="inv-slots-grid">
        {SLOT_ORDER.map(slotKey => {
          const item = heroGear.slots[slotKey]
          const isStarter = item?.rarity === 'starter'
          const canUnequip = item && !isStarter && onUnequipItem
          const isPending = unequipPending?.slotKey === slotKey
          const rarityColor = item ? (RARITY_COLORS[item.rarity] || '#888') : null

          return (
            <div
              key={slotKey}
              className={[
                'inv-slot',
                item ? 'equipped' : '',
                isPending ? 'unequip-pending' : '',
              ].filter(Boolean).join(' ')}
              style={item ? { borderColor: rarityColor + '99' } : undefined}
              onClick={canUnequip ? () => setUnequipPending(isPending ? null : { slotKey, item }) : undefined}
              title={!item ? SLOT_LABELS[slotKey] : undefined}
            >
              <span>{item ? (SLOT_ICONS[slotKey] || '?') : <span style={{ fontSize: 9, color: '#3a3860' }}>{SLOT_LABELS[slotKey]}</span>}</span>
              {item && <span className="inv-slot-dot" style={{ background: rarityColor }} />}
              {item && (
                <div className="inv-slot-tip">
                  <div className="inv-slot-tip-name" style={{ color: rarityColor }}>{item.name}</div>
                  {item.atk_bonus !== 0 && <div className={item.atk_bonus > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{item.atk_bonus > 0 ? '+' : ''}{item.atk_bonus} ATK</div>}
                  {item.hp_bonus  !== 0 && <div className={item.hp_bonus  > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{item.hp_bonus  > 0 ? '+' : ''}{item.hp_bonus} HP</div>}
                  {Number(item.spd_bonus) !== 0 && <div className={Number(item.spd_bonus) > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{Number(item.spd_bonus) > 0 ? '+' : ''}{Number(item.spd_bonus).toFixed(2)} SPD</div>}
                  {canUnequip && <div className="inv-slot-tip-hint">Click to remove</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unequip confirm */}
      {unequipPending && (
        <div className="inv-unequip-confirm">
          <div className="inv-confirm-name" style={{ color: RARITY_COLORS[unequipPending.item.rarity] || '#ccc' }}>
            {unequipPending.item.name}
          </div>
          <div className="inv-confirm-stats">
            {unequipPending.item.atk_bonus !== 0 && <span>{unequipPending.item.atk_bonus > 0 ? '+' : ''}{unequipPending.item.atk_bonus} ATK</span>}
            {unequipPending.item.hp_bonus  !== 0 && <span>{unequipPending.item.hp_bonus  > 0 ? '+' : ''}{unequipPending.item.hp_bonus} HP</span>}
            {Number(unequipPending.item.spd_bonus) !== 0 && <span>{Number(unequipPending.item.spd_bonus) > 0 ? '+' : ''}{Number(unequipPending.item.spd_bonus).toFixed(2)} SPD</span>}
          </div>
          <div className="inv-confirm-actions">
            <button
              type="button"
              className="inv-btn-remove"
              onClick={() => { onUnequipItem(hero.cid, unequipPending.slotKey); setUnequipPending(null) }}
            >
              {t('inv.removeFrom', { name: hero.name })}
            </button>
            <button type="button" className="inv-btn-cancel" onClick={() => setUnequipPending(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Mini-stats */}
      <div className="inv-mini-stats">
        <span className={`inv-mini-stat ${hp_bonus  !== 0 ? 'pos' : 'zero'}`}>❤️ {hp_bonus  > 0 ? '+' : ''}{hp_bonus} HP</span>
        <span className={`inv-mini-stat ${atk_bonus !== 0 ? 'pos' : 'zero'}`}>⚔️ {atk_bonus > 0 ? '+' : ''}{atk_bonus} ATK</span>
        <span className={`inv-mini-stat ${Number(spd_bonus) !== 0 ? 'pos' : 'zero'}`}>⚡ {Number(spd_bonus) > 0 ? '+' : ''}{Number(spd_bonus).toFixed(2)} SPD</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace gear panels placeholder with actual panels row**

Replace `<div className="inv-panels-row"><p ...>...</p></div>` with:

```jsx
<div className="inv-panels-row">
  <GearSlotsPanel
    hero={currentHero}
    playerGear={playerGear}
    onUnequipItem={onUnequipItem}
    unequipPending={unequipPending}
    setUnequipPending={setUnequipPending}
    t={t}
  />
  {/* Inventory list placeholder */}
  <div className="inv-items-panel">
    <p style={{ color: '#5a5080', fontSize: 11 }}>Items list — next task</p>
  </div>
</div>
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```
Open Inventory → Gear tab. Select a hero. Slots panel shows equipped items with rarity dots and tooltips. Hover a slot shows tooltip. Click equipped (non-starter) slot shows unequip confirm card. Mini-stats row shows bonuses.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/InventoryView.jsx
git commit -m "feat(inventory): add gear slots panel, rarity dots, tooltips and mini-stats"
```

---

## Task 8: Gear tab — inventory list with sort and equip confirm

**Files:**
- Modify: `client/src/pages/InventoryView.jsx`

- [ ] **Step 1: Add sort state and equip-pending state**

Add after `unequipPending`:
```js
const [sortBy, setSortBy] = useState('rarity')
const [equipPending, setEquipPending] = useState(null)
```

- [ ] **Step 2: Add sort helper function (inside InventoryView, before return)**

```js
function sortItems(items, by) {
  const copy = [...items]
  if (by === 'rarity') return copy.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 6) - (RARITY_ORDER[b.rarity] ?? 6))
  if (by === 'name')   return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (by === 'total_stats') return copy.sort((a, b) => {
    const score = i => Math.abs(i.atk_bonus || 0) + Math.abs(i.hp_bonus || 0) + Math.abs(Number(i.spd_bonus) || 0) * 10
    return score(b) - score(a)
  })
  return copy
}

const unequippedItems = sortItems(
  (playerItems || []).filter(i => !i.equipped_on),
  sortBy,
)
```

- [ ] **Step 3: Add InventoryItemsPanel component (before export)**

```jsx
function InventoryItemsPanel({ hero, items, sortBy, setSortBy, equipPending, setEquipPending, onEquipItem, t }) {
  const SORT_OPTS = [
    { value: 'rarity',      label: t('inv.sortRarity') },
    { value: 'name',        label: t('inv.sortName') },
    { value: 'total_stats', label: t('inv.sortStats') },
  ]

  return (
    <div className="inv-items-panel">
      <div className="inv-panel-header">
        <div className="inv-panel-title">
          {t('hero.inventory')} ({items.length})
        </div>
        <select
          className="inv-sort-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          {SORT_OPTS.map(o => <option key={o.value} value={o.value}>↕ {o.label}</option>)}
        </select>
      </div>

      {items.length === 0
        ? <div className="inv-empty">{t('inv.noItems')}</div>
        : (
          <div className="inv-items-grid">
            {items.map(item => {
              const isPending = equipPending?.id === item.id
              const color = RARITY_COLORS[item.rarity] || '#888'
              return (
                <div
                  key={item.id}
                  className={`inv-item-slot${isPending ? ' selected' : ''}`}
                  style={{ border: `1px solid ${color}55` }}
                  title={`${item.name} (${item.slot_type})`}
                  onClick={() => setEquipPending(isPending ? null : item)}
                >
                  <span>{SLOT_ICONS[item.slot_type] || '📦'}</span>
                  <span className="inv-item-rarity-bar" style={{ background: color }} />
                </div>
              )
            })}
          </div>
        )
      }

      {equipPending && hero && onEquipItem && (
        <div className="inv-equip-confirm">
          <div className="inv-equip-confirm-name" style={{ color: RARITY_COLORS[equipPending.rarity] || '#ccc' }}>
            {equipPending.name}
          </div>
          <div className="inv-equip-confirm-stats">
            {equipPending.atk_bonus !== 0 && <span>{equipPending.atk_bonus > 0 ? '+' : ''}{equipPending.atk_bonus} ATK</span>}
            {equipPending.hp_bonus  !== 0 && <span>{equipPending.hp_bonus  > 0 ? '+' : ''}{equipPending.hp_bonus} HP</span>}
            {Number(equipPending.spd_bonus) !== 0 && <span>{Number(equipPending.spd_bonus) > 0 ? '+' : ''}{Number(equipPending.spd_bonus).toFixed(2)} SPD</span>}
          </div>
          <div className="inv-equip-confirm-actions">
            <button
              type="button"
              className="inv-btn-equip"
              onClick={() => { onEquipItem(equipPending.id, hero.cid, equipPending.slot_type); setEquipPending(null) }}
            >
              {t('inv.equipOn', { name: hero.name })}
            </button>
            <button type="button" className="inv-btn-cancel" onClick={() => setEquipPending(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Replace inventory placeholder in panels row**

In the `<div className="inv-panels-row">`, replace the placeholder `<div>` with:

```jsx
<InventoryItemsPanel
  hero={currentHero}
  items={unequippedItems}
  sortBy={sortBy}
  setSortBy={setSortBy}
  equipPending={equipPending}
  setEquipPending={setEquipPending}
  onEquipItem={onEquipItem}
  t={t}
/>
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```
Open Inventory → Gear tab. Select a hero. Right panel shows unequipped items sorted by rarity (color-coded borders). Sort dropdown changes order. Click item → confirm card appears with name, stats, and "Equip on [Hero]" button. Click confirm → item equips, panels refresh.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/InventoryView.jsx
git commit -m "feat(inventory): add unequipped items list with sort and equip confirm"
```

---

## Task 9: Skins tab

**Files:**
- Modify: `client/src/pages/InventoryView.jsx`

- [ ] **Step 1: Add catalog state and fetch**

Add state at top of `InventoryView`:
```js
const [catalog, setCatalog] = useState([])
const [ownedIds, setOwnedIds] = useState(new Set())
const [cosmeticsLoading, setCosmeticsLoading] = useState(true)
```

Add a useEffect after the existing state (at component level, not inside another hook):
```js
import { useState, useEffect } from 'react'
```
(Update the import at the top of the file.)

```js
useEffect(() => {
  if (!session?.token) { setCosmeticsLoading(false); return }
  Promise.all([
    fetch('/api/shop').then(r => r.json()),
    fetch('/api/shop/owned', { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
  ]).then(([cat, owned]) => {
    setCatalog(cat.items || [])
    setOwnedIds(new Set(owned.owned || []))
  }).catch(() => {}).finally(() => setCosmeticsLoading(false))
}, [session?.token]) // eslint-disable-line
```

- [ ] **Step 2: Build SkinsTab component (before export)**

```jsx
function SkinsTab({ catalog, ownedIds, equippedSkins, heroData, onEquipSkin, onUnequipSkin, t }) {
  const ownedSkins = catalog.filter(i => i.type === 'skin' && ownedIds.has(i.id))

  if (ownedSkins.length === 0) {
    return <div className="inv-empty" style={{ marginTop: 40 }}>{t('inv.noItems')}</div>
  }

  return (
    <div className="inv-cosmetics-grid">
      {ownedSkins.map(item => {
        const isEquipped = equippedSkins?.[item.hero_cid]?.skin_id === item.id
        const hero = heroData?.find(h => h.cid === item.hero_cid)
        const previewStyle = item.preview
          ? { backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: hero?.bg_gradient || '#1a1a2e' }

        return (
          <div key={item.id} className={`inv-cosm-card${isEquipped ? ' equipped-card' : ''}`}>
            <div className="inv-cosm-preview" style={previewStyle}>
              {!item.preview && <span>{hero?.icon || '✨'}</span>}
            </div>
            <div className="inv-cosm-body">
              <div className="inv-cosm-name">{item.name}</div>
              {item.hero_cid && (
                <div className="inv-cosm-hero">
                  {item.hero_cid.charAt(0).toUpperCase() + item.hero_cid.slice(1)}
                </div>
              )}
              <div className="inv-cosm-actions">
                {isEquipped
                  ? <button type="button" className="inv-cosm-btn unequip" onClick={() => onUnequipSkin?.(item.id)}>
                      {t('shop.unequip')}
                    </button>
                  : <button type="button" className="inv-cosm-btn equip" onClick={() => onEquipSkin?.(item.id)}>
                      {t('shop.equip')}
                    </button>
                }
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Replace skins placeholder in InventoryView return**

Replace `{activeTab === 'skins' && <p ...>}` with:

```jsx
{activeTab === 'skins' && (
  cosmeticsLoading
    ? <div className="inv-empty">{t('campaign.loading')}</div>
    : <SkinsTab
        catalog={catalog}
        ownedIds={ownedIds}
        equippedSkins={equippedSkins}
        heroData={heroData}
        onEquipSkin={onEquipSkin}
        onUnequipSkin={onUnequipSkin}
        t={t}
      />
)}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```
Open Inventory → Skins tab. Owned skins appear as cards with preview and Equip/Unequip button. Clicking Equip updates the equipped skin. Equipped cards have purple border.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/InventoryView.jsx
git commit -m "feat(inventory): add Skins tab with equip/unequip"
```

---

## Task 10: Backgrounds tab

**Files:**
- Modify: `client/src/pages/InventoryView.jsx`

- [ ] **Step 1: Build BackgroundsTab component (before export)**

```jsx
function BackgroundsTab({ catalog, ownedIds, equippedBgs, onEquipBg, onUnequipBg, t }) {
  const ownedBgs = catalog.filter(i => i.type === 'background' && ownedIds.has(i.id))
  const equippedBgIds = new Set((equippedBgs || []).map(b => b.id))

  if (ownedBgs.length === 0) {
    return <div className="inv-empty" style={{ marginTop: 40 }}>{t('inv.noItems')}</div>
  }

  return (
    <>
      {/* Slot dots */}
      <div className="inv-bg-dots-bar">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={`inv-bg-dot${i < (equippedBgs?.length ?? 0) ? ' filled' : ''}`} />
        ))}
        <span style={{ fontSize: 10, color: '#7a70a0', marginLeft: 6 }}>
          {t('inv.bgsEquipped', { n: equippedBgs?.length ?? 0 })}
        </span>
      </div>

      <div className="inv-cosmetics-grid">
        {ownedBgs.map(item => {
          const isEquipped = equippedBgIds.has(item.id)
          const previewStyle = item.preview
            ? { backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: '#1a1a2e' }

          return (
            <div key={item.id} className={`inv-cosm-card${isEquipped ? ' equipped-card' : ''}`}>
              <div className="inv-cosm-preview" style={previewStyle} />
              <div className="inv-cosm-body">
                <div className="inv-cosm-name">{item.name}</div>
                <div className="inv-cosm-actions">
                  {isEquipped
                    ? <button
                        type="button"
                        className="inv-cosm-btn unequip"
                        disabled={(equippedBgs?.length ?? 0) <= 1}
                        onClick={() => onUnequipBg?.(item.id)}
                        title={(equippedBgs?.length ?? 0) <= 1 ? t('inv.minOneBg') : undefined}
                      >
                        {t('shop.remove')}
                      </button>
                    : <button
                        type="button"
                        className="inv-cosm-btn equip"
                        disabled={(equippedBgs?.length ?? 0) >= 4}
                        onClick={() => onEquipBg?.(item.id)}
                        title={(equippedBgs?.length ?? 0) >= 4 ? '4/4 slots used' : undefined}
                      >
                        {t('shop.equip')}
                      </button>
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Replace backgrounds placeholder**

Replace `{activeTab === 'backgrounds' && <p ...>}` with:

```jsx
{activeTab === 'backgrounds' && (
  cosmeticsLoading
    ? <div className="inv-empty">{t('campaign.loading')}</div>
    : <BackgroundsTab
        catalog={catalog}
        ownedIds={ownedIds}
        equippedBgs={equippedBgs}
        onEquipBg={onEquipBg}
        onUnequipBg={onUnequipBg}
        t={t}
      />
)}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Open Inventory → Backgrounds tab. Owned backgrounds show as cards with slot-dots bar. Equip adds to slots (max 4). Remove button disabled when only 1 equipped. Slot dots update in real time.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/InventoryView.jsx
git commit -m "feat(inventory): add Backgrounds tab with slot-dots and equip/unequip"
```

---

## Task 11: Production build and full smoke test

**Files:** none modified — verification only.

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: no errors, no warnings about missing imports.

- [ ] **Step 2: Start production server**

```bash
npm start
```

- [ ] **Step 3: Smoke test checklist at `http://localhost:3000`**

- [ ] Nav shows ⚔️ PLAY (not DUEL), 🎒 INVENTORY (not CAMPAIGN) on desktop and mobile
- [ ] Clicking PLAY opens the home/battle screen with AI, PvP, and Campaign cards
- [ ] Campaign card "PLAY CAMPAIGN" still navigates to the campaign view
- [ ] Clicking INVENTORY opens the inventory screen with sidebar tabs
- [ ] **Gear tab:** search by hero name filters carousel; role filter works; selecting hero shows slots and inventory; equip/unequip items works; mini-stats update after equip
- [ ] **Skins tab:** owned skins appear; Equip/Unequip works; equipped card shows purple border
- [ ] **Backgrounds tab:** owned backgrounds appear; slot-dots bar updates; max 4 enforced; min 1 enforced
- [ ] **Shop:** owned items show only OWNED badge (no equip button); buy/claim flow still works; chest result modal still works
- [ ] Mobile (resize to <900px): sidebar becomes horizontal pills; carousel shows 2 heroes; panels stack vertically

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: Inventory menu complete — Play/Inventory nav, gear/skins/bgs management, shop buy-only"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| "DUEL" → "PLAY" (same icon) | Task 2 |
| "CAMPAIGN" → "INVENTORY" (🎒 icon) | Task 2 |
| Campaign still accessible from Play screen | Not changed — Campaign card in home view untouched ✅ |
| New `InventoryView.jsx` component | Task 5 |
| Tabs: Gear / Skins / Backgrounds | Task 5 |
| Search + role filter for heroes | Task 6 |
| Hero carousel (4 visible, ‹ ›, 1–N/total) | Task 6 |
| 12-slot gear grid with rarity dots + tooltips | Task 7 |
| Mini-stats (HP/ATK/SPD bonuses) | Task 7 |
| Unequip confirm card inline | Task 7 |
| Inventory list with sort by rarity/name/total_stats | Task 8 |
| Equip confirm card inline | Task 8 |
| Skins tab — grid + equip/unequip | Task 9 |
| Backgrounds tab — grid + slot-dots + equip/unequip | Task 10 |
| Shop becomes buy-only | Task 4 |
| `equippedBgs` lifted to LobbyPage | Task 3 |
| Skin/bg handlers in LobbyPage | Task 3 |
| Mobile responsive (pills + stacked panels) | Task 5 CSS |
| i18n keys (en + pt-BR) | Task 1 |
| `public/css/inventory.css` | Task 5 |
