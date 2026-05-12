# Shop Subsistemas 2 e 3 — Equip Backgrounds & Skins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jogadores podem equipar até 4 backgrounds (sorteio por partida) e uma skin por herói (override permanente de portrait), gerenciados direto no Shop.

**Architecture:** Dois novos pares de tabelas (user_equipped_backgrounds, user_equipped_skins) + 6 endpoints REST autenticados. BattlePage fetcha os equipados ao carregar scripts e expõe window.HF_* para battle.js, que aplica background aleatório e overrides de portrait antes de startGame/pvpInit. ShopView ganha botões Equip/Unequip, busca por texto e filtro de herói.

**Tech Stack:** Node/Express + postgres (sql tagged template), React + hooks, vanilla JS (battle.js)

---

## File Map

| Arquivo | O que muda |
|---|---|
| `api/server.js` | 2 novas tabelas em initDb, seed 8 skins, update login grant, 6 novos endpoints |
| `client/src/pages/ShopView.jsx` | Estado equip, botões Equip/Unequip, search input, hero pills |
| `client/src/pages/LobbyPage.jsx` | Passa `heroData` como prop para ShopView |
| `client/src/pages/BattlePage.jsx` | useEffect quando scriptsReady → fetch equipped → window.HF_* |
| `public/js/battle.js` | Apply background + skin portrait overrides em initGame |
| `public/css/shop.css` | Estilos para equip/unequip, search, hero pills, slot counter |

---

## Task 1: DB — Novas tabelas e seed de skins padrão

**Files:**
- Modify: `api/server.js:887-893` (após o bloco `user_cosmetics`)

- [ ] **Step 1: Adicionar as 2 tabelas novas e o seed de skins no initDb**

Localizar o bloco que termina com:
```js
    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
        ('bg_desert', 'background', 'Deserto',  '/images/arena-desert.jpg', 0, NULL, 10),
        ('bg_forest', 'background', 'Floresta', '/images/arena-forest.jpg', 0, NULL, 20),
        ('bg_snow',   'background', 'Neve',     '/images/arena-snow.jpg',   0, NULL, 30)
      ON CONFLICT (id) DO NOTHING
    `;
```

Substituir por:
```js
    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
        ('bg_desert', 'background', 'Deserto',  '/images/arena-desert.jpg', 0, NULL, 10),
        ('bg_forest', 'background', 'Floresta', '/images/arena-forest.jpg', 0, NULL, 20),
        ('bg_snow',   'background', 'Neve',     '/images/arena-snow.jpg',   0, NULL, 30)
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
        ('skin_knight',    'skin', 'Knight',    '', 0, 'knight',    100),
        ('skin_mage',      'skin', 'Mage',      '', 0, 'mage',      110),
        ('skin_archer',    'skin', 'Archer',    '', 0, 'archer',    120),
        ('skin_healer',    'skin', 'Healer',    '', 0, 'healer',    130),
        ('skin_assassin',  'skin', 'Assassin',  '', 0, 'assassin',  140),
        ('skin_paladin',   'skin', 'Paladin',   '', 0, 'paladin',   150),
        ('skin_archmage',  'skin', 'Archmage',  '', 0, 'archmage',  160),
        ('skin_barbarian', 'skin', 'Barbarian', '', 0, 'barbarian', 170)
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_equipped_backgrounds (
        player   TEXT NOT NULL,
        item_id  TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
        PRIMARY KEY (player, item_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_equipped_skins (
        player    TEXT NOT NULL,
        hero_cid  TEXT NOT NULL,
        skin_id   TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
        PRIMARY KEY (player, hero_cid)
      )
    `;
```

- [ ] **Step 2: Rodar a migration para aplicar as tabelas**

```bash
curl -X POST http://localhost:3000/api/migrate
```
Expected: `{"ok":true,"message":"Migration complete."}`

- [ ] **Step 3: Verificar as tabelas no DB**

```bash
curl http://localhost:3000/api/shop
```
Expected: response inclui 8 itens `type: "skin"` além dos 3 backgrounds.

- [ ] **Step 4: Commit**

```bash
git add api/server.js
git commit -m "feat: add user_equipped_backgrounds/skins tables and seed default skins"
```

---

## Task 2: Login — auto-grant dinâmico (inclui skins padrão)

**Files:**
- Modify: `api/server.js:1119-1128` (endpoint `/api/auth/verify`, linha após validação da assinatura)

- [ ] **Step 1: Trocar INSERT hardcoded por query dinâmica**

Localizar:
```js
    const user = username.toLowerCase();
    await sql`
      INSERT INTO user_cosmetics (player, item_id)
      VALUES
        (${user}, 'bg_desert'),
        (${user}, 'bg_forest'),
        (${user}, 'bg_snow')
      ON CONFLICT DO NOTHING
    `;
    res.json({ ok: true, token: makeToken(user) });
```

Substituir por:
```js
    const user = username.toLowerCase();
    await sql`
      INSERT INTO user_cosmetics (player, item_id)
      SELECT ${user}, id FROM cosmetics WHERE price_hive = 0
      ON CONFLICT DO NOTHING
    `;
    res.json({ ok: true, token: makeToken(user) });
```

- [ ] **Step 2: Verificar — fazer login e checar owned**

Após login com Hive Keychain, chamar:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/shop/owned
```
Expected: `owned` contém `bg_desert`, `bg_forest`, `bg_snow`, `skin_knight`, `skin_mage`, `skin_archer`, `skin_healer`, `skin_assassin`, `skin_paladin`, `skin_archmage`, `skin_barbarian` (11 itens).

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat: auto-grant all free cosmetics on login (dynamic query)"
```

---

## Task 3: API — Endpoints de backgrounds equipados

**Files:**
- Modify: `api/server.js` (adicionar após `POST /api/shop/verify-purchase`, antes do bloco de auth)

- [ ] **Step 1: Adicionar os 3 endpoints de backgrounds**

Inserir após a linha `}); // fim do verify-purchase` (aproximadamente linha 1047):

```js
// ── GET /api/cosmetics/backgrounds/equipped ───────────────────────────────────
app.get('/api/cosmetics/backgrounds/equipped', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const rows = await sql`
      SELECT ub.item_id AS id, c.preview
      FROM user_equipped_backgrounds ub
      JOIN cosmetics c ON c.id = ub.item_id
      WHERE ub.player = ${username}
    `;
    res.json({ ok: true, equipped: rows.map(r => ({ id: r.id, preview: r.preview })) });
  } catch (err) {
    console.error('[/api/cosmetics/backgrounds/equipped GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/cosmetics/backgrounds/equip ────────────────────────────────────
app.post('/api/cosmetics/backgrounds/equip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ ok: false, error: 'item_id required' });
  try {
    const [item] = await sql`SELECT id FROM cosmetics WHERE id = ${item_id} AND type = 'background'`;
    if (!item) return res.status(400).json({ ok: false, error: 'Item not found' });

    const [owned] = await sql`SELECT 1 FROM user_cosmetics WHERE player = ${username} AND item_id = ${item_id}`;
    if (!owned) return res.status(403).json({ ok: false, error: 'Item not owned' });

    const [count] = await sql`SELECT COUNT(*)::int AS n FROM user_equipped_backgrounds WHERE player = ${username}`;
    if (count.n >= 4) return res.status(409).json({ ok: false, error: 'Max 4 backgrounds equipped' });

    await sql`INSERT INTO user_equipped_backgrounds (player, item_id) VALUES (${username}, ${item_id}) ON CONFLICT DO NOTHING`;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/backgrounds/equip POST]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/cosmetics/backgrounds/unequip ────────────────────────────────
app.delete('/api/cosmetics/backgrounds/unequip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ ok: false, error: 'item_id required' });
  try {
    await sql`DELETE FROM user_equipped_backgrounds WHERE player = ${username} AND item_id = ${item_id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/backgrounds/unequip DELETE]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Testar os endpoints manualmente**

```bash
# Equipar bg_desert (substitua <token> pelo token do login)
curl -X POST http://localhost:3000/api/cosmetics/backgrounds/equip \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"item_id":"bg_desert"}'
# Expected: {"ok":true}

# Listar equipados
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/cosmetics/backgrounds/equipped
# Expected: {"ok":true,"equipped":[{"id":"bg_desert","preview":"/images/arena-desert.jpg"}]}

# Desequipar
curl -X DELETE http://localhost:3000/api/cosmetics/backgrounds/unequip \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"item_id":"bg_desert"}'
# Expected: {"ok":true}
```

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat: add background equip/unequip/list endpoints"
```

---

## Task 4: API — Endpoints de skins equipadas

**Files:**
- Modify: `api/server.js` (adicionar após os 3 endpoints de backgrounds da Task 3)

- [ ] **Step 1: Adicionar os 3 endpoints de skins**

```js
// ── GET /api/cosmetics/skins/equipped ────────────────────────────────────────
app.get('/api/cosmetics/skins/equipped', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const rows = await sql`
      SELECT us.hero_cid, us.skin_id, c.preview
      FROM user_equipped_skins us
      JOIN cosmetics c ON c.id = us.skin_id
      WHERE us.player = ${username}
    `;
    const equipped = {};
    for (const r of rows) equipped[r.hero_cid] = { skin_id: r.skin_id, preview: r.preview };
    res.json({ ok: true, equipped });
  } catch (err) {
    console.error('[/api/cosmetics/skins/equipped GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/cosmetics/skins/equip ──────────────────────────────────────────
app.post('/api/cosmetics/skins/equip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { skin_id } = req.body || {};
  if (!skin_id) return res.status(400).json({ ok: false, error: 'skin_id required' });
  try {
    const [item] = await sql`SELECT id, hero_cid FROM cosmetics WHERE id = ${skin_id} AND type = 'skin'`;
    if (!item) return res.status(400).json({ ok: false, error: 'Item not found' });

    const [owned] = await sql`SELECT 1 FROM user_cosmetics WHERE player = ${username} AND item_id = ${skin_id}`;
    if (!owned) return res.status(403).json({ ok: false, error: 'Item not owned' });

    await sql`
      INSERT INTO user_equipped_skins (player, hero_cid, skin_id)
      VALUES (${username}, ${item.hero_cid}, ${skin_id})
      ON CONFLICT (player, hero_cid) DO UPDATE SET skin_id = EXCLUDED.skin_id
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/skins/equip POST]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/cosmetics/skins/unequip ──────────────────────────────────────
app.delete('/api/cosmetics/skins/unequip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { hero_cid } = req.body || {};
  if (!hero_cid) return res.status(400).json({ ok: false, error: 'hero_cid required' });
  try {
    await sql`DELETE FROM user_equipped_skins WHERE player = ${username} AND hero_cid = ${hero_cid}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/skins/unequip DELETE]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Testar os endpoints**

```bash
# Equipar skin_knight
curl -X POST http://localhost:3000/api/cosmetics/skins/equip \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"skin_id":"skin_knight"}'
# Expected: {"ok":true}

# Listar skins equipadas
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/cosmetics/skins/equipped
# Expected: {"ok":true,"equipped":{"knight":{"skin_id":"skin_knight","preview":""}}}

# Desequipar
curl -X DELETE http://localhost:3000/api/cosmetics/skins/unequip \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"hero_cid":"knight"}'
# Expected: {"ok":true}
```

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat: add skin equip/unequip/list endpoints"
```

---

## Task 5: BattlePage — Fetch equipped cosmetics e window.HF_*

**Files:**
- Modify: `client/src/pages/BattlePage.jsx`

- [ ] **Step 1: Adicionar useEffect para fetch dos equipados quando scripts carregam**

Localizar no BattlePage.jsx:
```js
  const ready = cssReady && scriptsReady
```

Inserir o seguinte useEffect ANTES dessa linha:

```js
  useEffect(() => {
    if (!scriptsReady) return
    const sess = getSession()
    if (sess?.mode !== 'hive' || !sess?.token) {
      window.HF_equipped_backgrounds = []
      window.HF_equipped_skins = {}
      return
    }
    const headers = { Authorization: `Bearer ${sess.token}` }
    Promise.all([
      fetch('/api/cosmetics/backgrounds/equipped', { headers }).then(r => r.json()),
      fetch('/api/cosmetics/skins/equipped', { headers }).then(r => r.json()),
    ]).then(([bgs, skins]) => {
      window.HF_equipped_backgrounds = bgs.equipped || []
      window.HF_equipped_skins = skins.equipped || {}
    }).catch(() => {
      window.HF_equipped_backgrounds = []
      window.HF_equipped_skins = {}
    })
  }, [scriptsReady])
```

- [ ] **Step 2: Garantir cleanup no unmount**

Localizar o array `reactSide` no cleanup do useEffect de scripts:
```js
      const reactSide = [
        ...
        'startBattle', 'rerollShop', 'toggleBattleSpeed',
        'render',
      ]
```

Adicionar os dois globals no cleanup após o loop `for (const name of reactSide) delete window[name]`:

```js
      delete window.HF_equipped_backgrounds
      delete window.HF_equipped_skins
```

- [ ] **Step 3: Verificar no navegador**

Abrir `http://localhost:5173/battle` com sessão Hive logada.
No console do navegador após os scripts carregarem:
```js
window.HF_equipped_backgrounds  // deve retornar array (vazio se nada equipado)
window.HF_equipped_skins        // deve retornar objeto
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/BattlePage.jsx
git commit -m "feat: fetch equipped cosmetics on battle page load, expose via window.HF_*"
```

---

## Task 6: battle.js — Aplicar background e skins

**Files:**
- Modify: `public/js/battle.js:215` (após `CK = Object.keys(C)`)
- Modify: `public/js/battle.js:1898` (início de `startGame`)

**Nota de arquitetura:** `startGame` é chamado uma vez por match (de `initGame` quando `_HF_BATTLE_CFG` está definido, e de `pvpInit`). `startBattle` não chama `startGame` — resolve apenas cada rodada individual. O background deve ser aplicado em `startGame` para cobrir bot e PvP.

- [ ] **Step 1: Adicionar override de skins após construir C**

Localizar em `initGame()`:
```js
          CK = Object.keys(C);

          // Inject deps into the bot module now that C/CK/HF are populated.
```

Inserir entre `CK = Object.keys(C);` e o comentário seguinte:

```js
          // Apply equipped skin portrait overrides (client-side, current player only).
          // Skins with empty preview (default skins) leave portrait unchanged.
          const _skinMap = window.HF_equipped_skins || {};
          for (const [cid, data] of Object.entries(_skinMap)) {
            if (C[cid] && data.preview) C[cid].portrait = data.preview;
          }
```

- [ ] **Step 2: Aplicar background no início de `startGame`**

Localizar:
```js
      function startGame(fmt, pvpMode = false) {
        // Reset completo do estado para garantir partida limpa
        G.format = fmt;
```

Substituir por:
```js
      function startGame(fmt, pvpMode = false) {
        // Apply random background from player's equipped pool (client-side only).
        (function applyArenaBackground() {
          const pool = window.HF_equipped_backgrounds || [];
          const list = pool.length > 0 ? pool : [{ preview: '/images/arena-desert.jpg' }];
          const pick = list[Math.floor(Math.random() * list.length)];
          const el = document.getElementById('arena-wrap');
          if (el && pick.preview) el.style.backgroundImage = `url('${pick.preview}')`;
        })();

        // Reset completo do estado para garantir partida limpa
        G.format = fmt;
```

- [ ] **Step 3: Verificar em modo bot**

Acessar `http://localhost:5173/battle`.
1. Equipar `bg_forest` via Shop (Task 8 ainda não feita — usar curl: `curl -X POST http://localhost:3000/api/cosmetics/backgrounds/equip -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"item_id":"bg_forest"}'`)
2. Recarregar a página de batalha e iniciar uma partida
3. Arena deve mostrar `arena-forest.jpg` como background

- [ ] **Step 4: Verificar em modo PvP**

Iniciar uma partida PvP.
Arena do lado local deve mostrar o background equipado, independente do oponente.

- [ ] **Step 5: Commit**

```bash
git add public/js/battle.js
git commit -m "feat: apply equipped background (random) and skin portrait overrides in battle"
```

---

## Task 7: LobbyPage — Passar heroData para ShopView

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx:1166`

- [ ] **Step 1: Adicionar prop heroData no ShopView**

Localizar:
```jsx
        {view === 'shop' && <ShopView session={session} toast={showToast} />}
```

Substituir por:
```jsx
        {view === 'shop' && <ShopView session={session} toast={showToast} heroData={heroData} />}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: pass heroData to ShopView for skin preview fallback"
```

---

## Task 8: ShopView — Equip/Unequip UI, busca e filtro de herói

**Files:**
- Modify: `client/src/pages/ShopView.jsx`
- Modify: `public/css/shop.css`

- [ ] **Step 1: Reescrever ShopView.jsx com os novos estados e lógica**

Substituir o conteúdo inteiro de `client/src/pages/ShopView.jsx` por:

```jsx
import { useState, useEffect } from 'react'
import '@styles/shop.css'

const FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'background', label: '🌄 Backgrounds' },
  { key: 'skin',       label: '✨ Skins' },
  { key: 'owned',      label: '✓ Owned' },
]

export default function ShopView({ session, toast, heroData }) {
  const [catalog, setCatalog]           = useState([])
  const [owned, setOwned]               = useState(new Set())
  const [equippedBgs, setEquippedBgs]   = useState([])   // [{ id, preview }]
  const [equippedSkins, setEquippedSkins] = useState({}) // { hero_cid: { skin_id, preview } }
  const [gameAccount, setGameAccount]   = useState('')
  const [filter, setFilter]             = useState('all')
  const [heroFilter, setHeroFilter]     = useState('all')
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [claiming, setClaiming]         = useState(null)
  const [equipping, setEquipping]       = useState(null)
  const [modalError, setModalError]     = useState('')

  const isHive   = session?.mode === 'hive'
  const token    = session?.token
  const username = session?.username

  const equippedBgIds   = new Set(equippedBgs.map(b => b.id))
  const equippedSkinMap = equippedSkins // { hero_cid: { skin_id, preview } }

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(d => { setCatalog(d.items || []); setGameAccount(d.gameAccount || '') })
      .catch(() => {})

    if (isHive && token) {
      const h = { Authorization: `Bearer ${token}` }
      fetch('/api/shop/owned', { headers: h })
        .then(r => r.json()).then(d => setOwned(new Set(d.owned || []))).catch(() => {})
      fetch('/api/cosmetics/backgrounds/equipped', { headers: h })
        .then(r => r.json()).then(d => setEquippedBgs(d.equipped || [])).catch(() => {})
      fetch('/api/cosmetics/skins/equipped', { headers: h })
        .then(r => r.json()).then(d => setEquippedSkins(d.equipped || {})).catch(() => {})
    }
  }, [isHive, token])

  // Unique hero_cids that have at least one skin in the catalog
  const skinHeroes = [...new Set(catalog.filter(i => i.type === 'skin' && i.hero_cid).map(i => i.hero_cid))]

  const filtered = catalog.filter(item => {
    if (filter === 'owned' && !owned.has(item.id)) return false
    if (filter !== 'all' && filter !== 'owned' && item.type !== filter) return false
    if (filter === 'skin' && heroFilter !== 'all' && item.hero_cid !== heroFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!item.name.toLowerCase().includes(q) && !(item.hero_cid || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  async function claimFree(item) {
    if (!isHive || !token) return
    setClaiming(item.id)
    try {
      const res = await fetch('/api/shop/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: item.id }),
      }).then(r => r.json())
      if (res.ok) {
        setOwned(prev => new Set([...prev, item.id]))
        toast?.(`${item.name} acquired!`)
      } else {
        toast?.('Failed to claim item.')
      }
    } catch { toast?.('Network error.') }
    finally { setClaiming(null) }
  }

  async function equipBackground(item_id) {
    if (!isHive || !token) return
    setEquipping(item_id)
    try {
      const res = await fetch('/api/cosmetics/backgrounds/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id }),
      }).then(r => r.json())
      if (res.ok) {
        const item = catalog.find(i => i.id === item_id)
        setEquippedBgs(prev => [...prev, { id: item_id, preview: item?.preview || '' }])
      } else {
        toast?.(res.error || 'Failed to equip.')
      }
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  async function unequipBackground(item_id) {
    if (!isHive || !token) return
    setEquipping(item_id)
    try {
      await fetch('/api/cosmetics/backgrounds/unequip', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id }),
      })
      setEquippedBgs(prev => prev.filter(b => b.id !== item_id))
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  async function equipSkin(skin_id) {
    if (!isHive || !token) return
    setEquipping(skin_id)
    try {
      const res = await fetch('/api/cosmetics/skins/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skin_id }),
      }).then(r => r.json())
      if (res.ok) {
        const item = catalog.find(i => i.id === skin_id)
        setEquippedSkins(prev => ({ ...prev, [item.hero_cid]: { skin_id, preview: item?.preview || '' } }))
      } else {
        toast?.(res.error || 'Failed to equip skin.')
      }
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  async function unequipSkin(skin_id) {
    if (!isHive || !token) return
    setEquipping(skin_id)
    try {
      const item = catalog.find(i => i.id === skin_id)
      await fetch('/api/cosmetics/skins/unequip', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hero_cid: item?.hero_cid }),
      })
      setEquippedSkins(prev => {
        const next = { ...prev }
        if (item?.hero_cid) delete next[item.hero_cid]
        return next
      })
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  function openModal(item) { setModal(item); setModalError('') }

  async function confirmBuy() {
    if (!modal || claiming) return
    if (!window.hive_keychain) { setModalError('Hive Keychain not found.'); return }
    setModalError('')
    setClaiming(modal.id)
    window.hive_keychain.requestTransfer(
      username, gameAccount, modal.price_hive.toFixed(3), `shop_${modal.id}`, 'HIVE',
      async (response) => {
        if (!response.success) {
          setClaiming(null)
          setModalError(response.error || 'Transfer cancelled.')
          return
        }
        try {
          const res = await fetch('/api/shop/verify-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ item_id: modal.id }),
          }).then(r => r.json())
          if (res.ok) {
            setOwned(prev => new Set([...prev, modal.id]))
            toast?.(`${modal.name} acquired!`)
            setModal(null)
          } else {
            setModalError('Payment not confirmed. Please try again.')
          }
        } catch { setModalError('Network error while verifying payment.') }
        finally { setClaiming(null) }
      }
    )
  }

  const sharedCardProps = { isHive, heroData, equippedBgs, equippedBgIds, equippedSkinMap, equipping }

  return (
    <div id="view-shop" className="lv active">
      <div className="wiki-layout">
        {/* PC sidebar */}
        <aside className="wiki-sidebar">
          <div className="wiki-category">Category</div>
          {FILTERS.map(f => (
            <button key={f.key} className={`wiki-item${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
          {filter === 'background' && (
            <div className="shop-slot-counter">{equippedBgs.length}/4 slots</div>
          )}
        </aside>

        <div className="wiki-content shop-content">
          {/* Mobile pills */}
          <div className="shop-mobile-filters">
            {FILTERS.map(f => (
              <button key={f.key} className={`shop-pill${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="shop-search-wrap">
            <input
              className="shop-search"
              type="text"
              placeholder="Search by name or hero..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Hero filter pills (skins only) */}
          {filter === 'skin' && skinHeroes.length > 0 && (
            <div className="shop-hero-pills">
              <button className={`shop-hero-pill${heroFilter === 'all' ? ' active' : ''}`} onClick={() => setHeroFilter('all')}>All</button>
              {skinHeroes.map(cid => (
                <button key={cid} className={`shop-hero-pill${heroFilter === cid ? ' active' : ''}`} onClick={() => setHeroFilter(cid)}>
                  {cid.charAt(0).toUpperCase() + cid.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Mobile slot counter for backgrounds */}
          {filter === 'background' && (
            <div className="shop-slot-counter-mobile">{equippedBgs.length}/4 slots equipped</div>
          )}

          {/* PC: card grid */}
          <div className="shop-grid">
            {filtered.map(item => (
              <ShopItemCard
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
                onEquip={() => item.type === 'background' ? equipBackground(item.id) : equipSkin(item.id)}
                onUnequip={() => item.type === 'background' ? unequipBackground(item.id) : unequipSkin(item.id)}
                {...sharedCardProps}
              />
            ))}
            {filtered.length === 0 && <div className="shop-empty">No items found.</div>}
          </div>

          {/* Mobile: vertical list */}
          <div className="shop-list">
            {filtered.map(item => (
              <ShopListRow
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
                onEquip={() => item.type === 'background' ? equipBackground(item.id) : equipSkin(item.id)}
                onUnequip={() => item.type === 'background' ? unequipBackground(item.id) : unequipSkin(item.id)}
                {...sharedCardProps}
              />
            ))}
            {filtered.length === 0 && <div className="shop-empty">No items found.</div>}
          </div>
        </div>
      </div>

      {/* Purchase modal */}
      {modal && (
        <div className="shop-modal-overlay" onClick={() => !claiming && setModal(null)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-modal-preview" style={{ backgroundImage: `url(${modal.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="shop-modal-body">
              <div className="shop-modal-name">{modal.name}</div>
              <div className="shop-modal-price">{modal.price_hive.toFixed(3)} HIVE</div>
              <div className="shop-modal-tos">This is a non-transferable digital cosmetic with no resale value. Purchases are final.</div>
              {modalError && <div className="shop-modal-error">{modalError}</div>}
              <div className="shop-modal-actions">
                <button className="shop-btn-cancel" onClick={() => setModal(null)} disabled={!!claiming}>Cancel</button>
                <button className="shop-btn-confirm" onClick={confirmBuy} disabled={!!claiming}>{claiming ? '⌛ Verifying...' : 'Confirm'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getItemEquipState(item, equippedBgIds, equippedSkinMap) {
  if (item.type === 'background') return equippedBgIds.has(item.id)
  if (item.type === 'skin') return equippedSkinMap[item.hero_cid]?.skin_id === item.id
  return false
}

function SkinPreview({ item, heroData, className, style }) {
  if (item.preview) {
    return <div className={className} style={{ ...style, backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
  }
  const hero = heroData?.find(h => h.cid === item.hero_cid)
  return (
    <div className={className} style={{ ...style, background: hero?.bg_gradient || '#1a1a2e' }}>
      <span className="shop-preview-ico">{hero?.icon || '✨'}</span>
    </div>
  )
}

function ShopItemCard({ item, isOwned, isHive, isClaiming, onBuy, onEquip, onUnequip, heroData, equippedBgs, equippedBgIds, equippedSkinMap, equipping }) {
  const isFree      = item.price_hive === 0
  const buyDisabled = isOwned || isClaiming || !isHive
  const isEquipped  = getItemEquipState(item, equippedBgIds, equippedSkinMap)
  const canEquip    = item.type !== 'background' || equippedBgs.length < 4
  const isEquipping = equipping === item.id
  const previewStyle = { backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }

  return (
    <div className={`shop-card${isOwned ? ' shop-card-owned' : ''}${isEquipped ? ' shop-card-equipped' : ''}`}>
      {item.type === 'skin' && !item.preview
        ? <SkinPreview item={item} heroData={heroData} className="shop-card-preview" />
        : <div className="shop-card-preview" style={previewStyle} />
      }
      <div className="shop-card-body">
        <div className="shop-card-name">{item.name}</div>
        {item.type === 'skin' && item.hero_cid && (
          <div className="shop-card-hero">{item.hero_cid.charAt(0).toUpperCase() + item.hero_cid.slice(1)}</div>
        )}
        <button
          className={`shop-card-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={buyDisabled}
          onClick={onBuy}
          title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? '✓ Owned' : isFree ? 'Get Free' : `${item.price_hive.toFixed(3)} HIVE`}
        </button>
        {isOwned && isHive && (
          isEquipped
            ? <button className="shop-card-btn unequip" disabled={isEquipping} onClick={onUnequip}>
                {isEquipping ? '⌛' : '✓ Equipped'}
              </button>
            : <button
                className={`shop-card-btn equip`}
                disabled={isEquipping || !canEquip}
                onClick={onEquip}
                title={!canEquip ? '4/4 background slots used' : undefined}
              >
                {isEquipping ? '⌛' : 'Equip'}
              </button>
        )}
      </div>
    </div>
  )
}

function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy, onEquip, onUnequip, heroData, equippedBgs, equippedBgIds, equippedSkinMap, equipping }) {
  const isFree      = item.price_hive === 0
  const buyDisabled = isOwned || isClaiming || !isHive
  const isEquipped  = getItemEquipState(item, equippedBgIds, equippedSkinMap)
  const canEquip    = item.type !== 'background' || equippedBgs.length < 4
  const isEquipping = equipping === item.id

  return (
    <div className={`shop-row${isOwned ? ' shop-row-owned' : ''}${isEquipped ? ' shop-row-equipped' : ''}`}>
      {item.type === 'skin' && !item.preview
        ? <SkinPreview item={item} heroData={heroData} className="shop-row-preview" />
        : <div className="shop-row-preview" style={{ backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      }
      <div className="shop-row-info">
        <div className="shop-row-name">{item.name}</div>
        <div className="shop-row-type">{item.type === 'background' ? 'Background' : `Skin · ${item.hero_cid || ''}`}</div>
      </div>
      <div className="shop-row-right">
        {isOwned
          ? <div className="shop-owned-text">✓ Owned</div>
          : <div className="shop-row-price">{isFree ? 'Free' : `${item.price_hive} HIVE`}</div>
        }
        <button
          className={`shop-row-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={buyDisabled}
          onClick={onBuy}
          title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? '✓' : isFree ? 'Get Free' : 'Buy'}
        </button>
        {isOwned && isHive && (
          isEquipped
            ? <button className="shop-row-btn unequip" disabled={isEquipping} onClick={onUnequip}>
                {isEquipping ? '⌛' : 'Remove'}
              </button>
            : <button
                className="shop-row-btn equip"
                disabled={isEquipping || !canEquip}
                onClick={onEquip}
                title={!canEquip ? '4/4 slots used' : undefined}
              >
                {isEquipping ? '⌛' : 'Equip'}
              </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar estilos no shop.css**

Adicionar ao final de `public/css/shop.css`:

```css
/* ── Equip / Unequip buttons ─────────────────────────────── */
.shop-card-btn.equip  { background: #1a4a2a; color: #7fff7f; border: 1px solid #2a7a4a; margin-top: 4px; }
.shop-card-btn.unequip { background: transparent; color: #c8a84b; border: 1px solid #c8a84b55; margin-top: 4px; cursor: pointer; }
.shop-card-btn.equip:disabled { opacity: 0.35; cursor: not-allowed; }

.shop-row-btn.equip  { background: #1a4a2a; color: #7fff7f; border: 1px solid #2a7a4a; margin-left: 4px; }
.shop-row-btn.unequip { background: transparent; color: #c8a84b; border: 1px solid #c8a84b55; margin-left: 4px; }
.shop-row-btn.equip:disabled { opacity: 0.35; cursor: not-allowed; }

/* Highlight equipped cards */
.shop-card-equipped { border-color: #c8a84b88; box-shadow: 0 0 8px #c8a84b33; }
.shop-row-equipped  { border-left: 2px solid #c8a84b; }

/* ── Search bar ──────────────────────────────────────────── */
.shop-search-wrap { padding: 8px 0 4px; }
.shop-search {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: #e8e0d0;
  font-size: 0.85rem;
  outline: none;
  box-sizing: border-box;
}
.shop-search::placeholder { color: rgba(255,255,255,0.3); }
.shop-search:focus { border-color: rgba(200,168,75,0.4); }

/* ── Hero filter pills ───────────────────────────────────── */
.shop-hero-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 0 10px;
}
.shop-hero-pill {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.6);
  font-size: 0.78rem;
  cursor: pointer;
}
.shop-hero-pill.active {
  background: rgba(200,168,75,0.15);
  border-color: #c8a84b;
  color: #c8a84b;
}

/* ── Slot counter ────────────────────────────────────────── */
.shop-slot-counter {
  margin-top: 12px;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.45);
  border-top: 1px solid rgba(255,255,255,0.08);
}
.shop-slot-counter-mobile {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.45);
  padding: 4px 0 8px;
}

/* ── Skin preview icon overlay ───────────────────────────── */
.shop-preview-ico {
  font-size: 1.6rem;
  line-height: 1;
}
.shop-card-preview, .shop-row-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Hero label em cards de skin ─────────────────────────── */
.shop-card-hero {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.4);
  margin-bottom: 4px;
}
```

- [ ] **Step 3: Verificar o Shop no navegador**

Abrir `http://localhost:5173` → fazer login → Shop.

Verificar:
1. Skins aparecem na lista com ícone do herói como preview (para skins sem portrait)
2. Filtro de categoria funciona (Backgrounds / Skins / Owned)
3. Search filtra por nome e por hero_cid
4. Pills de herói aparecem quando categoria = Skins
5. Cards/rows owned têm botão "Equip"
6. Clicar Equip em background → botão muda para "✓ Equipped" + botão "Remove"
7. Contador X/4 slots aparece no sidebar (PC) e acima da lista (mobile) quando categoria = Backgrounds
8. Tentar equipar 5 backgrounds → 5º fica desabilitado com title "4/4 background slots used"

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ShopView.jsx public/css/shop.css
git commit -m "feat: equip/unequip UI, search filter, and hero pills in ShopView"
```

---

## Task 9: Build e smoke test final

**Files:** nenhum (validação)

- [ ] **Step 1: Build de produção**

```bash
npm run build
```
Expected: sem erros.

- [ ] **Step 2: Iniciar servidor de produção**

```bash
npm start
```

- [ ] **Step 3: Smoke test em produção (`http://localhost:3000`)**

1. Login com Hive Keychain
2. Shop → verificar que owned tem 11 itens (3 bg + 8 skins)
3. Equipar `bg_forest` → ✓ Equipped aparece
4. Iniciar batalha modo bot → arena deve mostrar `arena-forest.jpg`
5. Equipar `bg_desert` também → iniciar várias batalhas → confirmar que as duas arenas aparecem aleatoriamente
6. Equipar `skin_knight` → iniciar batalha → portrait do Knight deve permanecer padrão (preview vazio, sem alteração visual)

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: shop subsistemas 2 e 3 — equip backgrounds and skins complete"
```
