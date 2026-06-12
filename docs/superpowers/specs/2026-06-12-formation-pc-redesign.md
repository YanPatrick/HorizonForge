# Formation PC Redesign — Spec
**Data:** 2026-06-12  
**Branch:** feat/mudanca-menu-formation  
**Arquivo principal:** `client/src/pages/LobbyPage.jsx`  
**CSS:** `public/css/lobby.css`

---

## Objetivo

Redesenhar o menu Formation para desktop (≥ 901px) mantendo o layout mobile atual intacto. O novo layout PC segue a estrutura de duas colunas já usada no menu Campaign: coluna escura à esquerda para seleção de deck, área de trabalho à direita dividida em Collection (cima) e Unit's Deck (baixo).

---

## Contexto do layout existente

No desktop, `tavern.css` aplica:

```css
@media (min-width: 901px) {
  .lobby-with-tavern { display: flex; flex-direction: row; }
  .lobby-with-tavern > .lv { flex: 1; }
}
```

O `TavernPanel` ocupa a sidebar esquerda fixa; o `FormationView` (`.lv.active`) recebe `flex: 1` automaticamente. O layout PC do Formation opera **dentro** desse espaço — sem precisar se preocupar com a taverna ou o topnav.

---

## Estratégia de responsividade

| Viewport | Layout |
|---|---|
| `< 901px` | FormationView mobile atual — sem alterações |
| `≥ 901px` | FormationViewPC — novo componente |

Detecção via hook `useDesktop()` dentro do próprio `FormationView`:

```js
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

`FormationView` chama `useDesktop()` e faz branch: se desktop → `<FormationViewPC {...props} />`; senão → JSX mobile existente.

---

## Layout PC — estrutura visual

```
┌─ FormationView (.lv.active, flex: 1, height: 100%) ──────────────────┐
│                                                                        │
│  ┌─ col-decks (190px, escuro) ─┐  ┌─ col-main (flex: 1) ───────────┐ │
│  │                              │  │                                 │ │
│  │  [deck-card  ★  FirstWay ]   │  │  COLLECTION                    │ │
│  │       8/8                    │  │  [search] [All][🛡️][⚔️][💚]    │ │
│  │                              │  │  ‹  [hero1][hero2][hero3][hero4] ›│ │
│  │  [deck-card    format2   ]   │  │  "Heróis 1–4 de N"             │ │
│  │       0/8                    │  │                                 │ │
│  │                              │  │  UNIT'S DECK  [nome] [8/8] [✓] │ │
│  │  [deck-card    format3   ]   │  │  [s1][s2][s3][s4][s5][s6][s7][s8]│ │
│  │       0/8                    │  └─────────────────────────────────┘ │
│  └──────────────────────────────┘                                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Componente: `FormationViewPC`

Novo componente no mesmo arquivo `LobbyPage.jsx`, abaixo do `FormationView` existente. Recebe exatamente as mesmas props que `FormationView`.

### Estado interno

| State | Tipo | Descrição |
|---|---|---|
| `editingSlot` | `number` | Deck selecionado. Auto-inicia em `defaultSlot` via `useEffect(()=>setEditingSlot(defaultSlot),[])` |
| `carouselOffset` | `number` | Índice do primeiro herói visível no carrossel. Reseta para 0 ao trocar de deck ou limpar filtros |
| `roleFilter` | `string` | `'all' \| 'tank' \| 'dps' \| 'support'`. Reseta ao trocar deck |
| `search` | `string` | Busca por nome. Reseta ao trocar deck |
| `slideNameVal` | `string` | Valor do input de nome do deck |
| `detailHero` | `hero \| null` | Herói a exibir no modal Info/Gear |
| `holdRef` | `useRef(null)` | ID do `setInterval` para scroll contínuo com hold nas setas |

### filteredHeroes

```js
const filteredHeroes = (heroData || []).filter(h => {
  const matchRole = roleFilter === 'all' || roleCategory(h.role) === roleFilter
  const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase())
  return matchRole && matchSearch
})
// heroData já vem ordenado por role (tank→dps→support) do fetch inicial
```

### Carrossel — 4 heróis visíveis, navegação circular

```js
// Heróis exibidos (com wrap circular):
const visibleHeroes = Array.from({ length: 4 }, (_, i) =>
  filteredHeroes[(carouselOffset + i) % filteredHeroes.length]
).filter(Boolean)

// Navegar:
function moveCarousel(dir) {
  const total = filteredHeroes.length
  if (total === 0) return
  setCarouselOffset(prev => (prev + dir + total) % total)
}

// Clique simples na seta: moveCarousel(+1) ou moveCarousel(-1)
// Hold na seta: onMouseDown → inicia interval (150ms), onMouseUp/onMouseLeave → clearInterval
```

### Interação — Adicionar/remover herói

```js
function toggleHero(cid) {
  const f = formations[editingSlot]
  if (f.hero_ids.includes(cid)) {
    // remove
    setFormations(prev => prev.map((fm, i) =>
      i === editingSlot ? { ...fm, hero_ids: fm.hero_ids.filter(x => x !== cid) } : fm
    ))
  } else if (f.hero_ids.length < 8) {
    // adiciona ao próximo slot vazio (append)
    setFormations(prev => prev.map((fm, i) =>
      i === editingSlot ? { ...fm, hero_ids: [...fm.hero_ids, cid] } : fm
    ))
  } else {
    toast(t('toast.formationNeedHeroes')) // deck cheio
  }
}
```

**Click no hero card (Collection):** `toggleHero(h.cid)` — exceto se clicar no botão `i`  
**Click no botão `i`:** `e.stopPropagation()` → `setDetailHero(h)`  
**Click no slot preenchido (Unit's Deck):** remove herói daquele slot

### Estado visual dos hero cards

| Estado | Visual |
|---|---|
| Disponível | Cor normal, hover com borda dourada |
| No deck atual | `opacity: 0.4`, `filter: grayscale(40%)`, hover com borda vermelha + tooltip "Clique para remover" |
| Deck de outro slot | Não escurecido (pertence a outro deck, não ao atual) |

### Troca de deck

Ao clicar num deck card:
1. `setEditingSlot(i)`
2. `setCarouselOffset(0)`
3. `setSearch('')`
4. `setRoleFilter('all')`
5. `setSlideNameVal(formations[i].name || \`format${i + 1}\`)`

### saveDeck

Reutiliza a mesma lógica já existente no `FormationView` mobile: validação de 8 heróis, guest salva em localStorage, usuário Hive chama `PUT /api/formations`. Sem alterações na lógica de negócio.

### HeroDetail

Reutiliza o componente `HeroDetail` existente — ele já renderiza como overlay/drawer e funciona em desktop.

---

## CSS — novas classes

Novas classes com prefixo `.fvpc-` adicionadas em `public/css/lobby.css`, **dentro do bloco `@media (min-width: 901px)`** existente.

### Classes principais

```
.fvpc-root         — container flex row que ocupa 100% do .lv
.fvpc-col-decks    — coluna esquerda (190px, dark bg, flex col, justify: space-evenly)
.fvpc-deck-card    — card de deck individual
.fvpc-deck-card.active  — deck selecionado (borda dourada)
.fvpc-deck-card.full    — deck com 8/8 heróis (borda verde)
.fvpc-col-main     — área direita (flex: 1, flex col, padding, gap)
.fvpc-section-title     — título de seção (COLLECTION / UNIT'S DECK)
.fvpc-filter-bar   — linha de filtros
.fvpc-carousel-wrap     — wrapper com setas + lista
.fvpc-arrow        — botão de seta (círculo, hover dourado)
.fvpc-hero-list    — container flex dos 4 hero cards
.fvpc-hero-card    — card individual do herói (portrait grande, estilo shop)
.fvpc-hero-card.in-deck — escurecido/acinzentado
.fvpc-info-btn     — botão "i" no canto superior direito do card
.fvpc-slot-row     — linha dos 8 slots
.fvpc-slot         — slot individual (compacto, estilo battle card)
.fvpc-slot.filled  — slot com herói
.fvpc-deck-controls     — linha com nome + progresso + DONE button
```

---

## Validações preservadas

- Mínimo de 8 heróis para salvar o deck (toast se tentar salvar incompleto)
- Slot 2 e 3 bloqueados para guests (ícone de cadeado, abre `GuestConversionModal`)
- Estrela de deck padrão (`defaultSlot`) mantida
- Input de nome do deck (máx 10 chars)

---

## O que NÃO muda

- Todos os endpoints de API (`/api/formations`, `/api/gear`, `/api/player-items`)
- Componente `HeroDetail` (Info/Gear) — zero alterações
- Layout mobile do `FormationView` — zero alterações
- Estados globais no `LobbyPage` (`formations`, `setFormations`, `defaultSlot`, etc.)
- Validação de guest e lógica de `saveDeck`

---

## Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `client/src/pages/LobbyPage.jsx` | Adicionar `useDesktop()` hook; branch no `FormationView`; novo `FormationViewPC` component |
| `public/css/lobby.css` | Novas classes `.fvpc-*` dentro do bloco desktop existente |

---

## Checklist pré-entrega (CLAUDE.md)

- [ ] Arquivo `.jsx` correto alterado (LobbyPage.jsx)
- [ ] Alteração visível em `localhost:5173/` → aba Formation em tela ≥ 901px
- [ ] Layout mobile em tela < 901px inalterado
- [ ] `npm run build` executado com sucesso
- [ ] Versão final testada em `localhost:3000`
