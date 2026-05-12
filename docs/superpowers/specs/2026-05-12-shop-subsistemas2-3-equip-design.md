# Design: Shop — Subsistemas 2 e 3: Equipar Backgrounds e Skins

**Date:** 2026-05-12
**Scope:** `api/server.js`, `client/src/pages/ShopView.jsx`, `public/js/battle.js`, `client/src/pages/BattlePage.jsx`
**Status:** Aprovado para implementação

---

## Visão Geral

Implementar o sistema de **equipar** cosméticos:

- **Subsistema 2 — Backgrounds:** jogador equipa até 4 backgrounds. A cada partida (bot e PvP), um é sorteado aleatoriamente entre os equipados e aplicado como arena. Cada um vê o próprio background (client-side only).
- **Subsistema 3 — Skins:** jogador equipa uma skin por herói. A skin substituiu o portrait do herói na batalha. Default skins são as 8 representações atuais (uma por classe), auto-concedidas no login.

Continuação direta do Subsistema 1 (infraestrutura de posse). Depende das tabelas `cosmetics` e `user_cosmetics` já existentes.

---

## Out of Scope

- Skins visíveis para o oponente em PvP (cada jogador vê apenas as próprias skins)
- Admin panel para gerenciar skins
- Animações de troca de skin
- Preview 3D / ampliado de skins
- Sistema de raridade ou temporadas

---

## Banco de Dados

### Tabela `user_equipped_backgrounds`

```sql
CREATE TABLE IF NOT EXISTS user_equipped_backgrounds (
  player   TEXT NOT NULL,
  item_id  TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  PRIMARY KEY (player, item_id)
);
```

- Máximo de 4 linhas por `player` — validado na API (não via constraint de DB)
- Só podem estar aqui itens que o jogador possui em `user_cosmetics`
- Sem ordem/slot — a seleção em batalha é aleatória sobre o conjunto inteiro

### Tabela `user_equipped_skins`

```sql
CREATE TABLE IF NOT EXISTS user_equipped_skins (
  player    TEXT NOT NULL,
  hero_cid  TEXT NOT NULL,
  skin_id   TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  PRIMARY KEY (player, hero_cid)
);
```

- Uma skin por herói por jogador (PRIMARY KEY garante)
- Upsert: equipar um herói que já tem skin simplesmente troca

### Seed: 8 skins padrão em `cosmetics`

```sql
INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
  ('skin_knight',    'skin', 'Knight',    '', 0, 'knight',    100),
  ('skin_mage',      'skin', 'Mage',      '', 0, 'mage',      110),
  ('skin_archer',    'skin', 'Archer',    '', 0, 'archer',    120),
  ('skin_healer',    'skin', 'Healer',    '', 0, 'healer',    130),
  ('skin_assassin',  'skin', 'Assassin',  '', 0, 'assassin',  140),
  ('skin_paladin',   'skin', 'Paladin',   '', 0, 'paladin',   150),
  ('skin_archmage',  'skin', 'Archmage',  '', 0, 'archmage',  160),
  ('skin_barbarian', 'skin', 'Barbarian', '', 0, 'barbarian', 170)
ON CONFLICT (id) DO NOTHING;
```

- `preview = ''` — ShopView usa portrait do heroData como fallback visual
- `price_hive = 0` — auto-concedidas no login junto com os 3 backgrounds

### Atualização do auto-grant no login (`POST /api/auth/verify`)

Além dos 3 backgrounds, inserir também as 8 skins padrão:

```sql
INSERT INTO user_cosmetics (player, item_id)
SELECT $user, id FROM cosmetics WHERE price_hive = 0
ON CONFLICT DO NOTHING
```

Trocar os dois INSERTs hardcoded por um único SELECT dinâmico que pega todos os itens gratuitos — assim qualquer futuro item gratuito adicionado ao catálogo também é concedido automaticamente.

---

## API Endpoints

Todos autenticados via `authFromRequest(req)`.

### Backgrounds

#### `GET /api/cosmetics/backgrounds/equipped`
```
Response 200:
{ "equipped": ["bg_desert", "bg_forest"] }
```
Array pode ser vazio. Máximo 4 itens.

#### `POST /api/cosmetics/backgrounds/equip`
```
Body: { "item_id": "bg_desert" }

Response 200: { "ok": true }
Response 400: { "error": "Item not found" }           — item não existe no catálogo
Response 403: { "error": "Item not owned" }           — jogador não possui o item
Response 409: { "error": "Max 4 backgrounds equipped" } — slots cheios
```
Lógica:
1. Verifica se item existe em `cosmetics` com `type='background'`
2. Verifica posse em `user_cosmetics`
3. Conta linhas atuais em `user_equipped_backgrounds` para o player — se ≥ 4, retorna 409
4. `INSERT ... ON CONFLICT DO NOTHING`

#### `DELETE /api/cosmetics/backgrounds/unequip`
```
Body: { "item_id": "bg_desert" }

Response 200: { "ok": true }
```
`DELETE FROM user_equipped_backgrounds WHERE player=$user AND item_id=$item_id`
Idempotente — se não estava equipado, retorna ok sem erro.

---

### Skins

#### `GET /api/cosmetics/skins/equipped`
```
Response 200:
{ "equipped": { "knight": "skin_knight", "mage": "skin_mage" } }
```
Mapa `hero_cid → skin_id`. Pode ser objeto vazio.

#### `POST /api/cosmetics/skins/equip`
```
Body: { "skin_id": "skin_knight" }

Response 200: { "ok": true }
Response 400: { "error": "Item not found" }
Response 403: { "error": "Item not owned" }
```
Lógica:
1. Verifica se item existe em `cosmetics` com `type='skin'`, extrai `hero_cid`
2. Verifica posse em `user_cosmetics`
3. `INSERT INTO user_equipped_skins ... ON CONFLICT (player, hero_cid) DO UPDATE SET skin_id = EXCLUDED.skin_id`

#### `DELETE /api/cosmetics/skins/unequip`
```
Body: { "hero_cid": "knight" }

Response 200: { "ok": true }
```
`DELETE FROM user_equipped_skins WHERE player=$user AND hero_cid=$hero_cid`
Idempotente.

---

## Interface — ShopView

### Filtro (upgrade)

Adicionar acima do grid/lista:
- **Input de busca** (text, placeholder "Search...") — filtra por `item.name` e `item.hero_cid` (case-insensitive)
- Quando categoria = Skins: pills de herói aparecem (`All Heroes | Knight | Mage | ...`) para filtrar por `hero_cid`

Filtros são cumulativos: categoria + busca + herói.

### Prop heroData

`ShopView` precisa de `heroData` para renderizar previews de skins padrão (`preview=''`). LobbyPage deve passar `heroData` como prop:

```jsx
{view === 'shop' && <ShopView session={session} toast={toast} heroData={heroData} />}
```

`heroData` já existe no estado de LobbyPage — apenas passar como prop, sem fetch adicional.

### Estado adicional no ShopView

```js
const [equippedBgs, setEquippedBgs] = useState([])      // array de item_id
const [equippedSkins, setEquippedSkins] = useState({})   // { hero_cid: skin_id }
const [search, setSearch] = useState('')
const [heroFilter, setHeroFilter] = useState('all')
```

`equippedBgs` e `equippedSkins` são buscados ao montar o componente (se logado) via GET dos dois endpoints novos.

### Card de Background (quando possuído)

- **Não equipado + slots < 4:** botão **"Equip"** (verde)
- **Não equipado + slots = 4:** botão desabilitado com tooltip "4/4 slots used"
- **Equipado:** badge **"✓ Equipped"** (dourado) + botão **"Remove"** (cinza)
- Contador `X/4` visível no topo da seção de backgrounds

### Card de Skin (quando possuída)

- **Não equipada:** botão **"Equip"**
- **Equipada:** badge **"✓ Equipped"** (dourado) + botão **"Unequip"** (cinza)
- Preview do card: se `item.preview` não vazio, usa como `background-image`; se vazio, usa `bg_gradient` do herói correspondente (do heroData) com o ícone do herói centralizado

### Guest mode
Botões Equip/Unequip desabilitados com tooltip "Login to equip cosmetics."

---

## Batalha — Background (client-side)

### Passagem de dados para battle.js

`LobbyPage` já busca `owned` e itens do shop ao montar. Adicionar fetch de `equippedBgs` (GET `/api/cosmetics/backgrounds/equipped`) — apenas se sessão Hive (não guest).

Os `window.HF_*` devem ser definidos **imediatamente antes** da chamada a `startGame()` (bot) ou ao emitir o evento de início de PvP, garantindo que os dados estejam disponíveis quando `initGame`/`pvpInit` rodar.

Ao iniciar batalha (bot e PvP), expor no `window`:
```js
window.HF_equipped_backgrounds = [
  { id: 'bg_desert', preview: '/images/arena-desert.jpg' },
  { id: 'bg_forest', preview: '/images/arena-forest.jpg' }
]
```

### Aplicação em battle.js

Em `initGame()` (bot) e `pvpInit()` (PvP), logo após a arena ser montada:

```js
function applyRandomBackground() {
  const pool = window.HF_equipped_backgrounds || [];
  const list = pool.length > 0 ? pool : [{ preview: '/images/arena-desert.jpg' }];
  const pick = list[Math.floor(Math.random() * list.length)];
  const arenaEl = document.getElementById('arena-wrap');
  if (arenaEl) arenaEl.style.backgroundImage = `url('${pick.preview}')`;
}
```

Regra CLAUDE.md: função deve ser chamada nos dois modos (bot `startGame` / PvP `pvpInit`).

---

## Batalha — Skins (client-side)

### Passagem de dados para battle.js

Ao iniciar batalha, expor no `window`:
```js
window.HF_equipped_skins = {
  knight: '/images/skins/knight_dark.jpg',  // skin custom com preview
  mage: ''                                   // skin default, sem override
}
```

### Aplicação em battle.js

Em `initGame()` / `pvpInit()`, após carregar `C` (mapa de heróis):

```js
const skins = window.HF_equipped_skins || {};
Object.entries(skins).forEach(([cid, previewUrl]) => {
  if (C[cid] && previewUrl) C[cid].portrait = previewUrl;
});
```

Skins padrão (`preview=''`) não sobrescrevem nada — herói usa portrait original do banco.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `api/server.js` | 2 novas tabelas (init), seed skins, update auto-grant login, 6 novos endpoints |
| `client/src/pages/ShopView.jsx` | Estado equippedBgs/Skins, botões Equip/Unequip, filtro de busca, hero pills |
| `client/src/pages/LobbyPage.jsx` | Fetch equippedBgs + shop items ao montar; expor `window.HF_equipped_backgrounds` e `window.HF_equipped_skins` antes de iniciar batalha |
| `public/js/battle.js` | `applyRandomBackground()` em `initGame` e `pvpInit`; override portraits com skins |

---

## Invariantes

- Máximo 4 backgrounds equipados por jogador — validado na API, não no DB
- Só pode equipar itens que o jogador possui (`user_cosmetics`)
- Uma skin por herói — upsert garante atomicidade
- Background é sorteado client-side — sem sincronização entre jogadores
- Skins são aplicadas client-side — oponente não vê skins do adversário
- Se nenhum background equipado → fallback para `/images/arena-desert.jpg`
- Skins padrão (`preview=''`) não alteram a renderização (herói usa portrait original)
- Auto-grant no login migrado para query dinâmica: `SELECT id FROM cosmetics WHERE price_hive = 0`
