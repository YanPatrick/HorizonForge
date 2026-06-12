# Formation PC Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o menu Formation para viewport desktop (≥ 901px) com layout de duas colunas — deck selector à esquerda, Collection (carrossel) + Unit's Deck (8 slots) à direita — mantendo o layout mobile intacto.

**Architecture:** Novo hook `useDesktop()` detecta viewport; `FormationView` faz branch para `FormationViewPC` (novo componente no mesmo arquivo) ou mantém o JSX mobile atual. Todo estado de API/validação é reutilizado sem duplicação.

**Tech Stack:** React 18, CSS custom properties, `@media (min-width: 901px)`, `setInterval` para hold de setas.

---

## File Map

| Arquivo | O que muda |
|---|---|
| `client/src/locale/en.js` | +2 chaves: `formation.collection`, `formation.unitsDeck` |
| `client/src/locale/pt-BR.js` | +2 chaves (traduções PT) |
| `public/css/lobby.css` | +bloco `.fvpc-*` + override desktop de `#view-formation` |
| `client/src/pages/LobbyPage.jsx` | +`useDesktop` hook + branch no `FormationView` + `FormationViewPC` component |

---

## Task 1: Chaves de tradução

**Files:**
- Modify: `client/src/locale/en.js`
- Modify: `client/src/locale/pt-BR.js`

- [ ] **Step 1: Adicionar chaves em en.js**

Localizar o bloco `// formation` (linha ~97) e adicionar após `'formation.locked'`:

```js
  'formation.collection':       'COLLECTION',
  'formation.unitsDeck':        "UNIT'S DECK",
```

- [ ] **Step 2: Adicionar chaves em pt-BR.js**

Mesmo bloco, após `'formation.locked'`:

```js
  'formation.collection':       'COLEÇÃO',
  'formation.unitsDeck':        'DECK DA UNIDADE',
```

- [ ] **Step 3: Commit**

```bash
git add client/src/locale/en.js client/src/locale/pt-BR.js
git commit -m "feat: add formation PC locale keys"
```

---

## Task 2: CSS — Classes `.fvpc-*` e override desktop

**Files:**
- Modify: `public/css/lobby.css` (adicionar ao final do arquivo)

- [ ] **Step 1: Adicionar bloco CSS ao final de lobby.css**

```css
/* ══════════════════════════════
   FORMATION PC LAYOUT  (≥ 901px)
══════════════════════════════ */
@media (min-width: 901px) {
  /* Override do height:100vh mobile */
  #view-formation {
    height: 100%;
    padding-top: 0;
    overflow: hidden;
  }

  /* Root container */
  .fvpc-root {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* ── Coluna esquerda — Decks ── */
  .fvpc-col-decks {
    width: 190px;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.35);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-evenly;
    padding: 24px 14px;
  }

  .fvpc-deck-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
    transition: border-color 0.2s, background 0.2s;
  }
  .fvpc-deck-card:hover {
    border-color: rgba(212, 175, 55, 0.45);
    background: rgba(212, 175, 55, 0.05);
  }
  .fvpc-deck-card.active {
    border-color: rgba(212, 175, 55, 0.65);
    background: rgba(212, 175, 55, 0.09);
    box-shadow: 0 0 14px rgba(212, 175, 55, 0.12);
  }
  .fvpc-deck-card.full {
    border-color: rgba(80, 200, 90, 0.45);
  }
  .fvpc-deck-card.fvpc-deck-locked {
    cursor: default;
    opacity: 0.45;
  }

  .fvpc-deck-star {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 13px;
    color: rgba(255, 215, 0, 0.3);
    cursor: pointer;
    z-index: 1;
    background: none;
    border: none;
    padding: 0;
    line-height: 1;
    transition: color 0.15s;
  }
  .fvpc-deck-star:hover { color: rgba(255, 215, 0, 0.7); }
  .fvpc-deck-star.starred {
    color: #ffd700;
    text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  }

  /* Card stack visual */
  .fvpc-deck-stack {
    position: relative;
    width: 46px;
    height: 54px;
    flex-shrink: 0;
  }
  .fvpc-ds-card {
    position: absolute;
    width: 36px;
    height: 48px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }
  .fvpc-ds-card.c3 { left: 8px; top: 6px; }
  .fvpc-ds-card.c2 { left: 4px; top: 3px; opacity: 0.75; }
  .fvpc-ds-card.c1 { left: 0; top: 0; border-color: rgba(255, 255, 255, 0.15); }
  .fvpc-deck-card.active .fvpc-ds-card { border-color: rgba(212, 175, 55, 0.45); }
  .fvpc-deck-card.active .fvpc-ds-card.c1 { border-color: rgba(212, 175, 55, 0.8); }
  .fvpc-deck-card.full .fvpc-ds-card { border-color: rgba(80, 200, 90, 0.4); }
  .fvpc-deck-card.full .fvpc-ds-card.c1 { border-color: rgba(80, 200, 90, 0.7); }

  .fvpc-deck-name {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: rgba(200, 185, 165, 0.75);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .fvpc-deck-card.active .fvpc-deck-name { color: #d4af37; }

  .fvpc-lock-icon { font-size: 20px; }

  .fvpc-deck-count {
    font-size: 10px;
    color: rgba(140, 100, 255, 0.5);
  }
  .fvpc-deck-card.full .fvpc-deck-count { color: rgba(80, 200, 90, 0.8); }

  /* ── Coluna direita — Main ── */
  .fvpc-col-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 18px 22px;
    gap: 16px;
  }

  .fvpc-section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2.5px;
    color: #d4af37;
    text-transform: uppercase;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(212, 175, 55, 0.18);
    margin-bottom: 8px;
  }

  /* ── Collection ── */
  .fvpc-section-collection {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fvpc-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .fvpc-search {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 7px;
    color: #ccc;
    padding: 6px 12px;
    font-size: 11px;
    width: 160px;
    outline: none;
    transition: border-color 0.15s;
  }
  .fvpc-search:focus { border-color: rgba(212, 175, 55, 0.4); }
  .fvpc-search::placeholder { color: rgba(200, 185, 165, 0.28); }

  .fvpc-filter-btn {
    padding: 5px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 7px;
    color: rgba(200, 185, 165, 0.55);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .fvpc-filter-btn:hover {
    border-color: rgba(212, 175, 55, 0.35);
    color: rgba(200, 185, 165, 0.9);
  }
  .fvpc-filter-btn.active {
    background: rgba(212, 175, 55, 0.12);
    border-color: rgba(212, 175, 55, 0.5);
    color: #d4af37;
  }

  .fvpc-carousel-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .fvpc-arrow {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d4af37;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    font-size: 20px;
    line-height: 1;
    user-select: none;
    transition: background 0.15s, border-color 0.15s;
    padding: 0;
  }
  .fvpc-arrow:hover:not(:disabled) {
    background: rgba(212, 175, 55, 0.1);
    border-color: rgba(212, 175, 55, 0.5);
  }
  .fvpc-arrow:active:not(:disabled) { transform: scale(0.9); }
  .fvpc-arrow:disabled { opacity: 0.25; cursor: default; }

  .fvpc-hero-list {
    flex: 1;
    display: flex;
    gap: 14px;
    align-items: stretch;
    overflow: hidden;
    height: 100%;
  }

  .fvpc-loading,
  .fvpc-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(200, 185, 165, 0.28);
    font-size: 12px;
    font-style: italic;
  }

  /* Hero card — portrait grande (estilo shop) */
  .fvpc-hero-card {
    flex: 1;
    border-radius: 10px;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.07);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.03);
    transition: border-color 0.2s, transform 0.15s;
    min-width: 0;
  }
  .fvpc-hero-card:hover {
    border-color: rgba(212, 175, 55, 0.6);
    transform: translateY(-2px);
  }
  .fvpc-hero-card.in-deck {
    opacity: 0.38;
    filter: grayscale(40%);
  }
  .fvpc-hero-card.in-deck:hover {
    border-color: rgba(255, 80, 80, 0.6);
    opacity: 0.6;
    transform: translateY(-1px);
  }

  .fvpc-hero-portrait {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
  }
  .fvpc-hero-portrait.has-portrait {
    background-image: var(--portrait-url);
    background-size: cover;
    background-position: top center;
  }
  .fvpc-hero-icon { font-size: 2.8em; opacity: 0.55; }

  .fvpc-info-btn {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: #bbb;
    font-size: 11px;
    font-style: italic;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
    padding: 0;
    line-height: 1;
    transition: background 0.15s, border-color 0.15s;
  }
  .fvpc-info-btn:hover {
    background: rgba(212, 175, 55, 0.85);
    border-color: #d4af37;
    color: #000;
  }

  .fvpc-hero-footer {
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.28);
    flex-shrink: 0;
  }
  .fvpc-hero-name {
    font-size: 11px;
    font-weight: 600;
    color: rgba(220, 210, 195, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fvpc-hero-role {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
    color: rgba(180, 165, 145, 0.45);
  }
  .fvpc-hero-role.role-tank    { color: rgba(96, 144, 208, 0.8); }
  .fvpc-hero-role.role-dps     { color: rgba(192, 112, 80, 0.8); }
  .fvpc-hero-role.role-support { color: rgba(96, 176, 96, 0.8); }

  .fvpc-carousel-hint {
    font-size: 10px;
    color: rgba(200, 185, 165, 0.22);
    text-align: center;
    flex-shrink: 0;
  }

  /* ── Unit's Deck ── */
  .fvpc-section-deck {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .fvpc-deck-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .fvpc-deck-controls .fvpc-section-title {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .fvpc-deck-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .fvpc-deck-name-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(212, 175, 55, 0.3);
    color: #d4af37;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: 2px 4px;
    width: 100px;
    outline: none;
    transition: border-bottom-color 0.15s;
  }
  .fvpc-deck-name-input:focus { border-bottom-color: #d4af37; }

  .fvpc-deck-progress {
    font-size: 11px;
    color: rgba(200, 185, 165, 0.38);
    white-space: nowrap;
  }

  .fvpc-done-btn {
    padding: 6px 20px;
    background: linear-gradient(135deg, #1a8a2e, #15701f);
    border: 1px solid rgba(30, 180, 60, 0.3);
    border-radius: 7px;
    color: #7de08a;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.8px;
    white-space: nowrap;
    transition: background 0.15s, box-shadow 0.15s;
  }
  .fvpc-done-btn:hover {
    background: linear-gradient(135deg, #22a838, #1a8a2e);
    box-shadow: 0 3px 12px rgba(30, 180, 60, 0.28);
  }

  .fvpc-slot-row {
    display: flex;
    gap: 8px;
  }

  /* Slot — compacto, estilo battle card */
  .fvpc-slot {
    flex: 1;
    height: 100px;
    border-radius: 7px;
    border: 1.5px dashed rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.02);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    min-width: 0;
    transition: border-color 0.15s;
  }
  .fvpc-slot:not(.filled):hover { border-color: rgba(212, 175, 55, 0.28); }
  .fvpc-slot.filled {
    border-style: solid;
    border-color: rgba(255, 255, 255, 0.12);
    cursor: pointer;
  }
  .fvpc-slot.filled:hover { border-color: rgba(255, 80, 80, 0.55); }
  .fvpc-slot.filled:hover::after {
    content: "✕";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(200, 40, 40, 0.78);
    color: #fff;
    font-size: 10px;
    text-align: center;
    padding: 3px 0;
  }
  .fvpc-slot.has-portrait {
    background-image: var(--portrait-url);
    background-size: cover;
    background-position: top center;
  }
  .fvpc-slot-plus  { font-size: 20px; color: rgba(255, 255, 255, 0.09); }
  .fvpc-slot-icon  { font-size: 1.5em; }
}
```

- [ ] **Step 2: Verificar visualmente que não quebrou nada (antes de adicionar o componente)**

Abrir `http://localhost:5173/` — layout mobile (< 901px em devtools) e desktop devem estar iguais ao estado atual. O CSS novo ainda não é usado por nenhum elemento.

- [ ] **Step 3: Commit**

```bash
git add public/css/lobby.css
git commit -m "feat: add fvpc CSS classes for formation PC layout"
```

---

## Task 3: Hook `useDesktop` + branch no `FormationView`

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Adicionar `useDesktop` hook antes de `FormationView`**

Localizar a linha `/* ── FormationView ──` (linha ~422) e inserir o hook imediatamente antes:

```jsx
/* ── useDesktop ─────────────────────────────────────────── */
function useDesktop() {
  const [ok, setOk] = useState(() => window.innerWidth >= 901)
  useEffect(() => {
    const h = () => setOk(window.innerWidth >= 901)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return ok
}
```

- [ ] **Step 2: Adicionar branch no início de `FormationView`**

Localizar a função `FormationView` (linha ~423). Após a linha `const isGuest = session?.mode === 'guest'` e antes de qualquer JSX de retorno, adicionar:

```jsx
const isDesktop = useDesktop()
if (isDesktop) {
  return (
    <FormationViewPC
      session={session}
      formations={formations}
      setFormations={setFormations}
      defaultSlot={defaultSlot}
      setDefaultSlot={setDefaultSlot}
      heroData={heroData}
      toast={toast}
      equippedSkins={equippedSkins}
      playerGear={playerGear}
      playerItems={playerItems}
      onEquipItem={onEquipItem}
      onUnequipItem={onUnequipItem}
    />
  )
}
```

Atenção: `FormationViewPC` ainda não existe — o branch é adicionado agora, o componente vem na Task 4. **Não testar até a Task 4 estar concluída.**

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: add useDesktop hook and PC branch in FormationView"
```

---

## Task 4: Componente `FormationViewPC`

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Adicionar `FormationViewPC` imediatamente antes de `FormationView`**

Inserir o bloco completo entre o `useDesktop` hook e a função `FormationView`:

```jsx
/* ── FormationViewPC — desktop layout ──────────────────── */
function FormationViewPC({ session, formations, setFormations, defaultSlot, setDefaultSlot, heroData, toast, equippedSkins = {}, playerGear = null, playerItems = [], onEquipItem = null, onUnequipItem = null }) {
  const { t } = useT()
  const [editingSlot, setEditingSlot] = useState(defaultSlot ?? 0)
  const [carouselOffset, setCarouselOffset] = useState(0)
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [slideNameVal, setSlideNameVal] = useState(
    () => formations[defaultSlot ?? 0]?.name || `format${(defaultSlot ?? 0) + 1}`
  )
  const [detailHero, setDetailHero] = useState(null)
  const holdRef = useRef(null)

  const isGuest = session?.mode === 'guest'
  const activeForm = formations[editingSlot]
  const skinUrl = (h) => (h && equippedSkins[h.cid]?.preview) || h?.url_portrait || null

  useEffect(() => () => clearInterval(holdRef.current), [])

  const filteredHeroes = (heroData || []).filter(h => {
    const matchRole = roleFilter === 'all' || roleCategory(h.role) === roleFilter
    const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  const total = filteredHeroes.length
  const visibleHeroes = total === 0
    ? []
    : Array.from({ length: Math.min(4, total) }, (_, i) => filteredHeroes[(carouselOffset + i) % total])

  function moveCarousel(dir) {
    if (total === 0) return
    setCarouselOffset(prev => (prev + dir + total) % total)
  }

  function startHold(dir) {
    holdRef.current = setInterval(() => moveCarousel(dir), 150)
  }

  function stopHold() {
    clearInterval(holdRef.current)
    holdRef.current = null
  }

  function selectDeck(i) {
    setEditingSlot(i)
    setCarouselOffset(0)
    setSearch('')
    setRoleFilter('all')
    setSlideNameVal(formations[i]?.name || `format${i + 1}`)
  }

  function toggleHero(cid) {
    const f = formations[editingSlot]
    if (f.hero_ids.includes(cid)) {
      setFormations(prev => prev.map((fm, i) =>
        i === editingSlot ? { ...fm, hero_ids: fm.hero_ids.filter(x => x !== cid) } : fm
      ))
    } else if (f.hero_ids.length < 8) {
      setFormations(prev => prev.map((fm, i) =>
        i === editingSlot ? { ...fm, hero_ids: [...fm.hero_ids, cid] } : fm
      ))
    }
  }

  function removeFromSlot(cid) {
    setFormations(prev => prev.map((f, i) =>
      i === editingSlot ? { ...f, hero_ids: f.hero_ids.filter(x => x !== cid) } : f
    ))
  }

  function setDefaultAndToast(idx) {
    setDefaultSlot(idx)
    savePref('default_form_slot', session?.username, idx)
    const name = formations[idx].name || `format${idx + 1}`
    toast(t('toast.formationSetActive', { name }))
  }

  async function saveDeck() {
    const f = formations[editingSlot]
    if (f.hero_ids.length < 8) { toast(t('toast.formationNeedHeroes')); return }
    if (isGuest) {
      localStorage.setItem('hf_guest_formation', JSON.stringify({ slot: 1, hero_ids: f.hero_ids, name: f.name }))
      toast(t('toast.formationSaved'))
      return
    }
    try {
      const res = await fetch('/api/formations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.token}` },
        body: JSON.stringify({ player: session.username, slot: editingSlot + 1, name: f.name || `format${editingSlot + 1}`, hero_ids: f.hero_ids }),
      })
      const d = await res.json()
      if (d.ok) toast(t('toast.formationSaved'))
      else toast(t('toast.formationSaveError'))
    } catch { toast(t('toast.formationNetworkError')) }
  }

  return (
    <div className="fvpc-root">
      {detailHero && (
        <HeroDetail
          hero={detailHero}
          onClose={() => setDetailHero(null)}
          playerGear={playerGear}
          playerItems={playerItems}
          onEquipItem={onEquipItem}
          onUnequipItem={onUnequipItem}
        />
      )}

      {/* ── Coluna esquerda — Seleção de deck ── */}
      <div className="fvpc-col-decks">
        {formations.map((f, i) => {
          if (isGuest && i !== 0) return (
            <div key={i} className="fvpc-deck-card fvpc-deck-locked">
              <span className="fvpc-lock-icon">🔒</span>
              <div className="fvpc-deck-name" style={{ opacity: 0.4 }}>{t('formation.locked', { n: i + 1 })}</div>
            </div>
          )
          const isDefault = i === defaultSlot
          const isFull = f.hero_ids.length === 8
          return (
            <div
              key={i}
              className={`fvpc-deck-card${editingSlot === i ? ' active' : ''}${isFull ? ' full' : ''}`}
              onClick={() => selectDeck(i)}
            >
              <span
                className={`fvpc-deck-star${isDefault ? ' starred' : ''}`}
                onClick={e => { e.stopPropagation(); setDefaultAndToast(i) }}
              >{isDefault ? '★' : '☆'}</span>
              <div className="fvpc-deck-stack">
                <div className="fvpc-ds-card c3" />
                <div className="fvpc-ds-card c2" />
                <div className="fvpc-ds-card c1" />
              </div>
              <div className="fvpc-deck-name">{f.name || `format${i + 1}`}</div>
              <div className="fvpc-deck-count">{f.hero_ids.length}/8</div>
            </div>
          )
        })}
      </div>

      {/* ── Coluna direita ── */}
      <div className="fvpc-col-main">

        {/* COLLECTION */}
        <div className="fvpc-section-collection">
          <div className="fvpc-section-title">{t('formation.collection')}</div>

          <div className="fvpc-filter-bar">
            <input
              className="fvpc-search"
              type="text"
              placeholder={t('formation.searchPlaceholder')}
              value={search}
              onChange={e => { setSearch(e.target.value); setCarouselOffset(0) }}
            />
            {[['all', t('formation.filterAll')], ['tank', '🛡️'], ['dps', '⚔️'], ['support', '💚']].map(([r, label]) => (
              <button
                key={r}
                type="button"
                className={`fvpc-filter-btn${roleFilter === r ? ' active' : ''}`}
                onClick={() => { setRoleFilter(r); setCarouselOffset(0) }}
              >{label}</button>
            ))}
          </div>

          <div className="fvpc-carousel-wrap">
            <button
              type="button"
              className="fvpc-arrow"
              disabled={total === 0}
              onClick={() => moveCarousel(-1)}
              onMouseDown={() => startHold(-1)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
            >‹</button>

            <div className="fvpc-hero-list">
              {!heroData && <div className="fvpc-loading">{t('formation.loading')}</div>}
              {heroData && total === 0 && <div className="fvpc-empty">{t('formation.noHeroesFound')}</div>}
              {visibleHeroes.map(h => {
                const inDeck = activeForm?.hero_ids.includes(h.cid) ?? false
                const url = skinUrl(h)
                return (
                  <div
                    key={h.cid}
                    className={`fvpc-hero-card${inDeck ? ' in-deck' : ''}`}
                    onClick={() => toggleHero(h.cid)}
                  >
                    <div
                      className={`fvpc-hero-portrait${url ? ' has-portrait' : ''}`}
                      style={url ? { '--portrait-url': `url('${url}')` } : {}}
                    >
                      {!url && <div className="fvpc-hero-icon">{h.icon}</div>}
                      <button
                        type="button"
                        className="fvpc-info-btn"
                        aria-label="Hero info"
                        onClick={e => { e.stopPropagation(); setDetailHero(h) }}
                      >i</button>
                    </div>
                    <div className="fvpc-hero-footer">
                      <div className="fvpc-hero-name">{h.name}</div>
                      <div className={`fvpc-hero-role role-${roleCategory(h.role)}`}>
                        {roleCategory(h.role) === 'tank'
                          ? t('role.tank')
                          : roleCategory(h.role) === 'support'
                            ? t('role.support')
                            : t('role.dps')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              className="fvpc-arrow"
              disabled={total === 0}
              onClick={() => moveCarousel(1)}
              onMouseDown={() => startHold(1)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
            >›</button>
          </div>

          {total > 0 && (
            <div className="fvpc-carousel-hint">
              {carouselOffset + 1}–{Math.min(carouselOffset + Math.min(4, total), total)} / {total}
            </div>
          )}
        </div>

        {/* UNIT'S DECK */}
        <div className="fvpc-section-deck">
          <div className="fvpc-deck-controls">
            <div className="fvpc-section-title">{t('formation.unitsDeck')}</div>
            <div className="fvpc-deck-actions">
              <input
                className="fvpc-deck-name-input"
                type="text"
                maxLength={10}
                value={slideNameVal}
                onChange={e => {
                  setSlideNameVal(e.target.value)
                  setFormations(prev => prev.map((f, i) =>
                    i === editingSlot ? { ...f, name: e.target.value } : f
                  ))
                }}
              />
              <span className="fvpc-deck-progress">{activeForm?.hero_ids.length ?? 0}/8</span>
              <button type="button" className="fvpc-done-btn" onClick={saveDeck}>
                {t('formation.done')}
              </button>
            </div>
          </div>

          <div className="fvpc-slot-row">
            {Array.from({ length: 8 }, (_, i) => {
              const cid = activeForm?.hero_ids[i]
              const hero = heroData?.find(h => h.cid === cid)
              const url = skinUrl(hero)
              return (
                <div
                  key={i}
                  className={`fvpc-slot${cid ? ' filled' : ''}${url ? ' has-portrait' : ''}`}
                  style={url ? { '--portrait-url': `url('${url}')` } : {}}
                  title={cid ? `${hero?.name || cid}` : ''}
                  onClick={() => cid && removeFromSlot(cid)}
                >
                  {cid && !url && <span className="fvpc-slot-icon">{hero?.icon || '?'}</span>}
                  {!cid && <span className="fvpc-slot-plus">+</span>}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar no browser — desktop (≥ 901px)**

Abrir `http://localhost:5173/` → aba Formation com viewport ≥ 901px.

Verificar:
- Coluna esquerda escura com 3 deck cards distribuídos verticalmente
- Área direita com "COLLECTION" no topo e "UNIT'S DECK" no fundo
- Heróis carregam no carrossel (4 visíveis)
- Setas funcionam (clique move 1, hold move continuamente)
- Filtro e busca funcionam e resetam ao trocar deck
- Clicar num herói disponível adiciona ao deck (entra no slot, herói fica escurecido)
- Clicar num herói escurecido remove do deck
- Botão `i` abre o modal de Info/Gear sem adicionar/remover
- Clicar num slot preenchido remove o herói
- Botão DONE salva (checa toast de sucesso ou erro de 8 heróis)
- Estrela define deck padrão

- [ ] **Step 3: Verificar no browser — mobile (< 901px)**

Redimensionar para < 901px (ou usar devtools). Layout mobile original deve estar 100% intacto, sem nenhuma regressão.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: add FormationViewPC desktop layout with carousel and 8-slot deck"
```

---

## Task 5: Build de produção e verificação final

**Files:** nenhum arquivo alterado

- [ ] **Step 1: Executar build**

```bash
npm run build
```

Esperado: saída sem erros, arquivos gerados em `public/dist/`.

- [ ] **Step 2: Iniciar servidor de produção**

```bash
npm start
```

- [ ] **Step 3: Verificar em produção**

Abrir `http://localhost:3000/` → Formation, repetir os mesmos checks da Task 4 Step 2.

- [ ] **Step 4: Commit final (se houver ajustes de build)**

```bash
git add -A
git commit -m "fix: production build adjustments for formation PC layout"
```

---

## Self-Review

**Spec coverage:**
- ✅ `useDesktop()` hook com resize listener → Task 3
- ✅ Branch em `FormationView` → Task 3
- ✅ `FormationViewPC` com todas as props idênticas → Task 4
- ✅ Coluna esquerda: 3 deck cards, estrela, stack visual, full/active states → Task 4
- ✅ Collection: search + filtros + carrossel circular 4 heróis → Task 4
- ✅ Seta hold (setInterval 150ms, clearInterval onMouseUp/onMouseLeave) → Task 4
- ✅ Reset de carrossel + filtros ao trocar deck → Task 4 (`selectDeck`)
- ✅ Hero card: inDeck escurecido, botão `i` stopPropagation → Task 4
- ✅ Unit's Deck: 8 slots + portrait + "✕" no hover + `has-portrait` → Task 4
- ✅ Deck name input + DONE button + saveDeck idêntico ao mobile → Task 4
- ✅ Guest lock em slots 2 e 3 → Task 4
- ✅ Locale keys `formation.collection` + `formation.unitsDeck` → Task 1
- ✅ Override `#view-formation` no desktop (remove `height:100vh; padding-top:58px`) → Task 2
- ✅ Build + verificação produção → Task 5
- ✅ Layout mobile intacto (zero alterações no JSX mobile) → verificação Task 4 Step 3

**Placeholder scan:** nenhum TBD/TODO. Todo código está completo.

**Type consistency:** `formations[i].hero_ids`, `h.cid`, `roleCategory(h.role)`, `skinUrl(h)`, `savePref` — todos consistentes com o código existente no arquivo.
