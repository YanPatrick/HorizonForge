# Inventory Menu — Design Spec
**Date:** 2026-06-14  
**Branch:** feat/menu-inventario  
**Status:** Approved

---

## Overview

Restruturação do menu de navegação e criação de uma tela de Inventory centralizada para gerenciar skins, backgrounds e equipamentos de heróis. O Shop passa a ser exclusivamente para compras.

---

## 1. Mudanças de Navegação

### Menu "DUEL" → "PLAY"
- Ícone: mantém ⚔️
- View state: mantém `'home'`
- Label: `t('nav.duel')` substituído por `t('nav.play')` = `"PLAY"` (en) / `"PLAY"` (pt-BR)
- Afeta: top nav (desktop) + mobile bottom tabs

### Menu "CAMPAIGN" → "INVENTORY"
- Ícone: substituir 📜 por 🎒 (mochila — representa inventário)
- View state: `'campaign'` → `'inventory'`
- Label: nova key `t('nav.inventory')` = `"INVENTORY"` (en) / `"INVENTÁRIO"` (pt-BR)
- Afeta: top nav (desktop) + mobile bottom tabs + `allowed` tabs array no `useState` inicial
- **Campaign continua acessível** via o card "PLAY CAMPAIGN" na tela Play (home)

---

## 2. Novo Componente `InventoryView`

**Arquivo:** `client/src/pages/InventoryView.jsx`  
**Estilo:** `client/src/styles/inventory.css` (novo arquivo)

### Props

```js
InventoryView({
  session,          // objeto de sessão
  heroData,         // array de heróis
  playerGear,       // { [cid]: { slots: {}, totals: {} } }
  playerItems,      // array de itens do jogador
  equippedSkins,    // { [cid]: { skin_id, preview } }
  equippedBgs,      // [{ id, preview }]
  onEquipItem,      // (itemId, characterCid, slotType) => void
  onUnequipItem,    // (characterCid, slotType) => void
  onEquipSkin,      // (skin_id) => void
  onUnequipSkin,    // (skin_id) => void
  onEquipBg,        // (item_id) => void
  onUnequipBg,      // (item_id) => void
  toast,            // (msg) => void
})
```

### State interno

| State | Tipo | Default | Descrição |
|---|---|---|---|
| `activeTab` | `'gear'\|'skins'\|'backgrounds'` | `'gear'` | Aba ativa na sidebar |
| `selectedHero` | objeto herói | primeiro herói da lista | Herói com gear aberto |
| `heroSearch` | string | `''` | Busca por nome de herói |
| `roleFilter` | `'all'\|'tank'\|'dps'\|'support'` | `'all'` | Filtro de role |
| `carouselOffset` | number | `0` | Posição do carrossel |
| `sortBy` | `'rarity'\|'name'\|'total_stats'` | `'rarity'` | Ordenação do inventário |
| `equipPending` | item \| null | `null` | Item aguardando confirmação de equip |
| `unequipPending` | `{ slotKey, item }` \| null | `null` | Slot aguardando confirmação de unequip |

### Layout

```
┌─────────────┬────────────────────────────────────────────────┐
│  Sidebar    │  Conteúdo principal                            │
│             │                                                │
│  ⚔️ Gear   │  [🔍 Buscar herói...] [Todos][🛡️][⚔️][💚]   │
│  🎨 Skins  │  ┌──────────────────────────────────────────┐  │
│  🖼️  Bgs   │  │  Carrossel de heróis  ‹  [🧙][⚔️][🛡️][🏹]  ›  │
│             │  └──────────────────────────────────────────┘  │
│             │  ┌─────────────────┐ ┌──────────────────────┐  │
│             │  │  Slots 12-grid  │ │  Inventário + Sort   │  │
│             │  │  + mini-stats   │ │  (não equipados)     │  │
│             │  └─────────────────┘ └──────────────────────┘  │
└─────────────┴────────────────────────────────────────────────┘
```

### Aba Gear — detalhes

**Barra de busca + filtros:**
- Input de texto: filtra heróis por nome no carrossel
- Botões de role: `Todos | 🛡️ | ⚔️ | 💚` — mesma lógica de `roleCategory()` já usada em FormationView
- Filtros afetam quais heróis aparecem no carrossel

**Carrossel de heróis:**
- Exibe 4 heróis por vez (igual FormationViewPC)
- Navegação ‹ › com hold para scroll rápido
- Herói selecionado destacado com borda roxa
- Indicador `1–4 / 8` abaixo do carrossel

**Painel de slots:**
- Grid 3×4 com os 12 slots (mesma `SLOT_ORDER` já definida em LobbyPage)
- Slot equipado: borda colorida pela raridade + ícone do item + ponto colorido no canto
- Slot vazio: tracejado com label do slot (`HELM`, `CHEST`, etc.)
- Clicar em slot equipado: abre confirmação de unequip inline
- Mini-stats abaixo: `❤️ +XX HP  ⚔️ +XX ATK  ⚡ +X.XX SPD`

**Painel de inventário (itens não equipados):**
- Grid de itens filtrados por `!item.equipped_on`
- Sort: Raridade (default) / Nome / Total Stats (`Math.abs(atk) + Math.abs(hp) + Math.abs(spd*10)`)
- Borda colorida por raridade
- Clicar: seleciona item (highlight), segundo clique mostra confirm card inline com nome + stats + botão "Equipar em [HeroName]"
- Reutiliza `RARITY_COLORS` e `SLOT_ICONS` já definidos em LobbyPage

### Aba Skins

- Grid de skins que o jogador possui (`catalog.filter(owned)`)
- Cada card: preview da skin + nome + herói + badge OWNED + botão Equip/Unequip
- Sem preço, sem botão de compra
- Dados: InventoryView faz seu próprio `fetch('/api/shop')` para o catálogo + `fetch('/api/shop/owned')` para os ids possuídos + lê `equippedSkins` das props (já carregado no LobbyPage)
- Reutiliza visual de `ShopItemCard` com prop `hidePrice={true}`

### Aba Backgrounds

- Grid de backgrounds que o jogador possui
- Cada card: preview + nome + badge OWNED + botão Equip/Remove
- Mantém regra: mínimo 1 equipado, máximo 4
- Barra de dots indicando slots usados (já existe no ShopView — reutilizar)
- Dados: mesmo `fetch('/api/shop')` + `/api/shop/owned` acima + lê `equippedBgs` das props (carregado no LobbyPage)

### Comportamento Mobile (responsivo)

- Sidebar vira pills horizontais no topo (padrão `shop-mobile-filters`)
- Carrossel mostra 2 heróis por vez (em vez de 4)
- Painel de slots e painel de inventário empilham verticalmente (flex-direction: column)
- Um único componente — CSS media query `@media (max-width: 900px)`

---

## 3. Mudanças no ShopView

**Remover toda lógica de equip/unequip:**

- Funções removidas: `equipBackground`, `unequipBackground`, `equipSkin`, `unequipSkin`
- State removido: `equippedBgs`, `equippedSkins`, `equipping`
- Props removidas de `ShopItemCard` e `ShopListRow`: `onEquip`, `onUnequip`, `equippedBgs`, `equippedBgIds`, `equippedSkins`, `equipping`

**Comportamento do card/row após mudança:**
- Item owned → mostra apenas badge `OWNED` (sem botão de ação)
- Item owned + treasure → mantém botão de compra (treasure é consumível, pode comprar novamente)
- `getItemEquipState` → removida (não mais necessária no Shop)

**O que permanece:**
- Lógica de compra (`confirmBuy`, `claimFree`, `openModal`)
- `ChestResultModal`
- Filtros, busca, sort
- `equippedBgIds` removido (não precisa mais carregar no Shop)

---

## 4. Mudanças no LobbyPage

### Novo state

```js
const [equippedBgs, setEquippedBgs] = useState([])  // sobe do ShopView
```

### Novo useEffect — carregar backgrounds equipados

```js
useEffect(() => {
  if (!session?.token) return
  fetch('/api/cosmetics/backgrounds/equipped', {
    headers: { Authorization: `Bearer ${session.token}` }
  })
    .then(r => r.json())
    .then(d => { if (d.ok) setEquippedBgs(d.equipped || []) })
    .catch(() => {})
}, [])
```

### Novas funções

```js
async function handleEquipSkin(skin_id) { ... }    // lógica vinda do ShopView
async function handleUnequipSkin(skin_id) { ... }  // lógica vinda do ShopView
async function handleEquipBg(item_id) { ... }      // lógica vinda do ShopView
async function handleUnequipBg(item_id) { ... }    // lógica vinda do ShopView
```

### Renderização

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

### Nav (top + mobile)

```jsx
// DUEL → PLAY
<button onClick={() => setView('home')}>
  <span className="tnt-ico">⚔️</span>
  <span className="tnt-lbl">{t('nav.play')}</span>
</button>

// CAMPAIGN → INVENTORY
<button onClick={() => setView('inventory')}>
  <span className="tnt-ico">🎒</span>
  <span className="tnt-lbl">{t('nav.inventory')}</span>
</button>
```

---

## 5. Mudanças de i18n

**`client/src/locale/en.js` e `client/src/locale/pt-BR.js`:**

| Key | en | pt-BR |
|---|---|---|
| `nav.play` | `"PLAY"` | `"PLAY"` |
| `nav.inventory` | `"INVENTORY"` | `"INVENTÁRIO"` |
| `inv.tabGear` | `"Gear"` | `"Equipamentos"` |
| `inv.tabSkins` | `"Skins"` | `"Skins"` |
| `inv.tabBgs` | `"Backgrounds"` | `"Cenários"` |
| `inv.sortRarity` | `"Rarity"` | `"Raridade"` |
| `inv.sortName` | `"Name"` | `"Nome"` |
| `inv.sortStats` | `"Total Stats"` | `"Total de Stats"` |
| `inv.searchHero` | `"Search hero..."` | `"Buscar herói..."` |
| `inv.noItems` | `"No items in inventory"` | `"Nenhum item no inventário"` |
| `inv.equipOn` | `"Equip on {name}"` | `"Equipar em {name}"` |
| `inv.removeFrom` | `"Remove from {name}"` | `"Remover de {name}"` |
| `inv.miniStats` | `"Equipment bonuses"` | `"Bônus de equipamento"` |

---

## 6. Arquivos Afetados

| Arquivo | Tipo de mudança |
|---|---|
| `client/src/pages/InventoryView.jsx` | **Novo** |
| `client/src/styles/inventory.css` | **Novo** |
| `client/src/pages/LobbyPage.jsx` | Modificado — nav, state, funções, renderização |
| `client/src/pages/ShopView.jsx` | Modificado — remover equip/unequip |
| `client/src/locale/en.js` | Modificado — novas keys |
| `client/src/locale/pt-BR.js` | Modificado — novas keys |

---

## 7. Fora de Escopo

- Ranked mode (futuro)
- Preview ao vivo da skin no herói (futuro)
- Comparação de itens lado a lado (futuro)
- Drag and drop para equipar itens (futuro)
