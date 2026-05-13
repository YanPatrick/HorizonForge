# Shop — Subsistema 1: Infraestrutura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the shop system infrastructure: DB tables for cosmetics catalog and ownership, three API endpoints (catalog / owned / purchase), purchase payment flow via Hive Keychain, and the ShopView UI component in the lobby (PC sidebar layout + mobile list layout).

**Architecture:** Two new PostgreSQL tables (`cosmetics` catalog + `user_cosmetics` ownership) added to both `schema.sql` and `/api/migrate`. Three new endpoints in `server.js` follow the existing `authFromRequest` + `sql` tagged-template pattern. A new `ShopView` React component renders a `wiki-layout` sidebar on PC and a pill-filtered vertical list on mobile, using the same CSS classes as `GrimoireView`. A new `public/css/shop.css` provides shop-specific styles. `LobbyPage.jsx` gets a new `🛒 Shop` tab between Duel and Config.

**Tech Stack:** PostgreSQL/Neon, Express.js, React/JSX, Hive Keychain browser extension, Vite (`@styles` alias → `public/css/`).

---

## File Map

| File | Change |
|---|---|
| `db/schema.sql` | Add `cosmetics` + `user_cosmetics` tables + seed |
| `api/server.js` | Add `verifyShopPayment()` + 3 endpoints |
| `client/src/pages/ShopView.jsx` | New component (PC grid + mobile list) |
| `public/css/shop.css` | New CSS for shop UI |
| `client/src/pages/LobbyPage.jsx` | Import ShopView, add tab + view render |

---

## Task 1 — DB: tabelas cosmetics e user_cosmetics

**Files:**
- Modify: `db/schema.sql` (append at end)
- Modify: `api/server.js` (inside `POST /api/migrate` before `res.json({ ok: true })`)

- [ ] **Step 1.1 — Add tables to schema.sql**

In `db/schema.sql`, append the following block at the very end of the file (after the `formations` table):

```sql
-- ============================================================
-- Shop — cosmetics catalog + per-player ownership
-- ============================================================
CREATE TABLE IF NOT EXISTS cosmetics (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('background', 'skin')),
  name        TEXT NOT NULL,
  preview     TEXT NOT NULL,
  price_hive  NUMERIC(10,3) NOT NULL DEFAULT 0,
  hero_cid    TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  player        TEXT NOT NULL,
  item_id       TEXT NOT NULL REFERENCES cosmetics(id),
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player, item_id)
);

INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
  ('bg_desert', 'background', 'Deserto',  '/images/arena-desert.jpg', 0, NULL, 10),
  ('bg_forest', 'background', 'Floresta', '/images/arena-forest.jpg', 0, NULL, 20),
  ('bg_snow',   'background', 'Neve',     '/images/arena-snow.jpg',   0, NULL, 30)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 1.2 — Add tables to /api/migrate**

In `api/server.js`, find the `POST /api/migrate` handler. Locate the line `res.json({ ok: true, created: [...] })` or similar end of the try block. Before `res.json(...)`, insert:

```js
    await sql`
      CREATE TABLE IF NOT EXISTS cosmetics (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL CHECK (type IN ('background', 'skin')),
        name        TEXT NOT NULL,
        preview     TEXT NOT NULL,
        price_hive  NUMERIC(10,3) NOT NULL DEFAULT 0,
        hero_cid    TEXT,
        sort_order  INT NOT NULL DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_cosmetics (
        player        TEXT NOT NULL,
        item_id       TEXT NOT NULL REFERENCES cosmetics(id),
        purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (player, item_id)
      )
    `;

    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
        ('bg_desert', 'background', 'Deserto',  '/images/arena-desert.jpg', 0, NULL, 10),
        ('bg_forest', 'background', 'Floresta', '/images/arena-forest.jpg', 0, NULL, 20),
        ('bg_snow',   'background', 'Neve',     '/images/arena-snow.jpg',   0, NULL, 30)
      ON CONFLICT (id) DO NOTHING
    `;
```

- [ ] **Step 1.3 — Run migration**

With the server running (`npm start` or dev server), call migrate:

```bash
curl -X POST http://localhost:3000/api/migrate \
  -H "x-admin-secret: $ADMIN_SECRET"
```

Expected: `{ "ok": true, ... }` — no errors.

- [ ] **Step 1.4 — Verify tables exist**

Connect to Neon DB console and run:

```sql
SELECT id, name, price_hive FROM cosmetics ORDER BY sort_order;
```

Expected: 3 rows (bg_desert, bg_forest, bg_snow), all with `price_hive = 0.000`.

- [ ] **Step 1.5 — Commit**

```bash
git add db/schema.sql api/server.js
git commit -m "feat: add cosmetics and user_cosmetics tables to schema and migrate"
```

---

## Task 2 — API: GET /api/shop + GET /api/shop/owned + POST /api/shop/verify-purchase

**Files:**
- Modify: `api/server.js`

Add all three endpoints and the `verifyShopPayment` helper in one block, placed after the `/api/formations` endpoints (around line 893).

- [ ] **Step 2.1 — Add verifyShopPayment helper**

In `api/server.js`, after the `verifyHivePayment` function (around line 144, after the closing `}`), insert:

```js
/**
 * Verify an on-chain transfer for a shop purchase.
 * Memo must be exactly `shop_{itemId}`.
 * Retries for up to 60s.
 */
async function verifyShopPayment(from, price, itemId, maxAttempts = 20) {
  const expectedMemo = `shop_${itemId}`;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const history = await hiveRpc('condenser_api.get_account_history', [from, -1, 50]);
      if (!Array.isArray(history)) throw new Error('tx_not_found');
      for (let i = history.length - 1; i >= 0; i--) {
        const [, entry] = history[i];
        const [opType, op] = entry.op;
        if (opType !== 'transfer') continue;
        if (op.to.toLowerCase() !== HIVE_GAME_ACCOUNT.toLowerCase()) continue;
        if (op.from.toLowerCase() !== from.toLowerCase()) continue;
        const sent = parseFloat(op.amount);
        if (Math.abs(sent - price) > 0.001) continue;
        if (op.memo !== expectedMemo) continue;
        console.log(`✅ Shop payment verified: ${from} → ${HIVE_GAME_ACCOUNT} | ${op.amount} | ${op.memo}`);
        return true;
      }
      throw new Error('tx_not_found');
    } catch (err) {
      lastErr = err;
      if (err.message === 'tx_not_found') { await sleep(3000); continue; }
      throw err;
    }
  }
  throw new Error(`Shop payment timed out: ${lastErr?.message}`);
}
```

- [ ] **Step 2.2 — Add GET /api/shop**

After the `/api/formations` PUT endpoint (around line 893), insert:

```js
/**
 * GET /api/shop
 * Retorna catálogo de cosméticos. Público (sem auth).
 * Inclui gameAccount para o frontend usar no requestTransfer.
 */
app.get('/api/shop', async (_req, res) => {
  try {
    const items = await sql`
      SELECT id, type, name, preview,
             price_hive::float AS price_hive,
             hero_cid
      FROM cosmetics
      ORDER BY sort_order ASC
    `;
    res.json({ ok: true, items, gameAccount: HIVE_GAME_ACCOUNT });
  } catch (err) {
    console.error('[/api/shop GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2.3 — Add GET /api/shop/owned**

Immediately after the `/api/shop` GET endpoint, insert:

```js
/**
 * GET /api/shop/owned
 * Retorna array de item_ids possuídos pelo jogador autenticado.
 */
app.get('/api/shop/owned', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const rows = await sql`
      SELECT item_id FROM user_cosmetics WHERE player = ${username}
    `;
    res.json({ ok: true, owned: rows.map(r => r.item_id) });
  } catch (err) {
    console.error('[/api/shop/owned GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2.4 — Add POST /api/shop/verify-purchase**

Immediately after `/api/shop/owned`, insert:

```js
/**
 * POST /api/shop/verify-purchase
 * Body: { item_id }
 * - price_hive = 0: concede imediatamente (sem verificação blockchain)
 * - price_hive > 0: verifica transferência Hive, depois concede
 * Idempotente: se jogador já possui o item, retorna { ok: true } sem erro.
 */
app.post('/api/shop/verify-purchase', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ ok: false, error: 'item_id required' });

  try {
    const [item] = await sql`SELECT id, price_hive FROM cosmetics WHERE id = ${item_id}`;
    if (!item) return res.status(400).json({ ok: false, error: 'Item not found' });

    const [existing] = await sql`
      SELECT 1 FROM user_cosmetics WHERE player = ${username} AND item_id = ${item_id}
    `;
    if (existing) return res.json({ ok: true });

    const price = parseFloat(item.price_hive);

    if (price === 0) {
      await sql`
        INSERT INTO user_cosmetics (player, item_id) VALUES (${username}, ${item_id})
        ON CONFLICT DO NOTHING
      `;
      console.log(`🎁 Free cosmetic granted: ${username} → ${item_id}`);
      return res.json({ ok: true });
    }

    try {
      await verifyShopPayment(username, price, item_id);
      await sql`
        INSERT INTO user_cosmetics (player, item_id) VALUES (${username}, ${item_id})
        ON CONFLICT DO NOTHING
      `;
      console.log(`💰 Shop purchase recorded: ${username} → ${item_id} (${price} HIVE)`);
      return res.json({ ok: true });
    } catch {
      return res.status(402).json({ ok: false, error: 'Payment not found or timed out' });
    }
  } catch (err) {
    console.error('[/api/shop/verify-purchase]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2.5 — Testar endpoints com curl**

```bash
# Catálogo (público)
curl http://localhost:3000/api/shop

# Esperado: { ok: true, items: [...3 items...], gameAccount: "..." }

# Itens possuídos (requer token — substitua TOKEN pelo token de login)
curl http://localhost:3000/api/shop/owned \
  -H "Authorization: Bearer TOKEN"

# Esperado: { ok: true, owned: [] }

# Claim item gratuito
curl -X POST http://localhost:3000/api/shop/verify-purchase \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_id":"bg_desert"}'

# Esperado: { ok: true }

# Verificar que o item foi concedido
curl http://localhost:3000/api/shop/owned \
  -H "Authorization: Bearer TOKEN"

# Esperado: { ok: true, owned: ["bg_desert"] }
```

- [ ] **Step 2.6 — Commit**

```bash
git add api/server.js
git commit -m "feat: add shop API endpoints (catalog, owned, verify-purchase)"
```

---

## Task 3 — ShopView component

**Files:**
- Create: `client/src/pages/ShopView.jsx`

- [ ] **Step 3.1 — Criar o arquivo ShopView.jsx**

Criar `client/src/pages/ShopView.jsx` com o conteúdo completo abaixo:

```jsx
import { useState, useEffect } from 'react'
import '@styles/shop.css'

const FILTERS = [
  { key: 'all',        label: 'Todos' },
  { key: 'background', label: '🌄 Backgrounds' },
  { key: 'skin',       label: '✨ Skins' },
  { key: 'owned',      label: '✓ Possuídos' },
]

export default function ShopView({ session, toast }) {
  const [catalog, setCatalog]       = useState([])
  const [owned, setOwned]           = useState(new Set())
  const [gameAccount, setGameAccount] = useState('')
  const [filter, setFilter]         = useState('all')
  const [modal, setModal]           = useState(null)
  const [claiming, setClaiming]     = useState(null)
  const [modalError, setModalError] = useState('')

  const isHive = session?.mode === 'hive'
  const token  = session?.token
  const username = session?.username

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(d => { setCatalog(d.items || []); setGameAccount(d.gameAccount || '') })
      .catch(() => {})

    if (isHive && token) {
      fetch('/api/shop/owned', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setOwned(new Set(d.owned || [])))
        .catch(() => {})
    }
  }, [isHive, token])

  const filtered = catalog.filter(item => {
    if (filter === 'owned')      return owned.has(item.id)
    if (filter === 'all')        return true
    return item.type === filter
  })

  async function claimFree(item) {
    setClaiming(item.id)
    try {
      const res = await fetch('/api/shop/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: item.id }),
      }).then(r => r.json())
      if (res.ok) {
        setOwned(prev => new Set([...prev, item.id]))
        toast?.(`${item.name} adquirido!`)
      } else {
        toast?.('Erro ao obter item.')
      }
    } catch {
      toast?.('Erro de rede.')
    } finally {
      setClaiming(null)
    }
  }

  function openModal(item) {
    setModal(item)
    setModalError('')
  }

  async function confirmBuy() {
    if (!modal) return
    if (!window.hive_keychain) {
      setModalError('Hive Keychain não encontrado.')
      return
    }
    setModalError('')
    window.hive_keychain.requestTransfer(
      username,
      gameAccount,
      modal.price_hive.toFixed(3),
      `shop_${modal.id}`,
      'HIVE',
      async (response) => {
        if (!response.success) {
          setModalError(response.error || 'Transferência cancelada.')
          return
        }
        setClaiming(modal.id)
        try {
          const res = await fetch('/api/shop/verify-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ item_id: modal.id }),
          }).then(r => r.json())
          if (res.ok) {
            setOwned(prev => new Set([...prev, modal.id]))
            toast?.(`${modal.name} adquirido!`)
            setModal(null)
          } else {
            setModalError('Pagamento não confirmado. Tente novamente.')
          }
        } catch {
          setModalError('Erro de rede ao verificar pagamento.')
        } finally {
          setClaiming(null)
        }
      }
    )
  }

  return (
    <div id="view-shop" className="lv active">
      <div className="wiki-layout">
        {/* PC sidebar */}
        <aside className="wiki-sidebar">
          <div className="wiki-category">Categoria</div>
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`wiki-item${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </aside>

        <div className="wiki-content shop-content">
          {/* Mobile pills (visíveis apenas em mobile via CSS) */}
          <div className="shop-mobile-filters">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`shop-pill${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* PC: grid de cards */}
          <div className="shop-grid">
            {filtered.map(item => (
              <ShopItemCard
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isHive={isHive}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
              />
            ))}
            {filtered.length === 0 && <div className="shop-empty">Nenhum item encontrado.</div>}
          </div>

          {/* Mobile: lista vertical */}
          <div className="shop-list">
            {filtered.map(item => (
              <ShopListRow
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isHive={isHive}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
              />
            ))}
            {filtered.length === 0 && <div className="shop-empty">Nenhum item encontrado.</div>}
          </div>
        </div>
      </div>

      {/* Modal de compra paga */}
      {modal && (
        <div className="shop-modal-overlay" onClick={() => !claiming && setModal(null)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <div
              className="shop-modal-preview"
              style={{ backgroundImage: `url(${modal.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div className="shop-modal-body">
              <div className="shop-modal-name">{modal.name}</div>
              <div className="shop-modal-price">{modal.price_hive.toFixed(3)} HIVE</div>
              <div className="shop-modal-tos">
                Este é um cosmético digital não transferível e sem valor de revenda. Compras são definitivas.
              </div>
              {modalError && <div className="shop-modal-error">{modalError}</div>}
              <div className="shop-modal-actions">
                <button
                  className="shop-btn-cancel"
                  onClick={() => setModal(null)}
                  disabled={!!claiming}
                >
                  Cancelar
                </button>
                <button
                  className="shop-btn-confirm"
                  onClick={confirmBuy}
                  disabled={!!claiming}
                >
                  {claiming ? '⌛ Verificando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShopItemCard({ item, isOwned, isHive, isClaiming, onBuy }) {
  const isFree = item.price_hive === 0
  const disabled = isOwned || isClaiming || !isHive
  return (
    <div className={`shop-card${isOwned ? ' shop-card-owned' : ''}`}>
      <div
        className="shop-card-preview"
        style={{ backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="shop-card-body">
        <div className="shop-card-name">{item.name}</div>
        {isOwned
          ? <div className="shop-card-owned-badge">✓ Possuído</div>
          : <div className="shop-card-price">{isFree ? 'Grátis' : `${item.price_hive} HIVE`}</div>
        }
        <button
          className={`shop-card-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={disabled}
          onClick={onBuy}
          title={!isHive ? 'Faça login com Hive Keychain para obter cosméticos.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? 'Possuído' : isFree ? 'Obter Grátis' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}

function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy }) {
  const isFree = item.price_hive === 0
  const disabled = isOwned || isClaiming || !isHive
  return (
    <div className={`shop-row${isOwned ? ' shop-row-owned' : ''}`}>
      <div
        className="shop-row-preview"
        style={{ backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="shop-row-info">
        <div className="shop-row-name">{item.name}</div>
        <div className="shop-row-type">{item.type === 'background' ? 'Background' : 'Skin'}</div>
      </div>
      <div className="shop-row-right">
        {isOwned
          ? <div className="shop-owned-text">✓ Possuído</div>
          : <div className="shop-row-price">{isFree ? 'Grátis' : `${item.price_hive} HIVE`}</div>
        }
        <button
          className={`shop-row-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={disabled}
          onClick={onBuy}
          title={!isHive ? 'Faça login com Hive Keychain para obter cosméticos.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? '✓' : isFree ? 'Obter' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2 — Verificar que o arquivo compila**

```bash
npm run dev
```

Abrir `http://localhost:5173`. Esperado: sem erros de compilação no terminal. O ShopView ainda não aparece na UI porque a integração com LobbyPage é Task 5.

- [ ] **Step 3.3 — Commit**

```bash
git add client/src/pages/ShopView.jsx
git commit -m "feat: add ShopView component (PC grid + mobile list)"
```

---

## Task 4 — CSS: public/css/shop.css

**Files:**
- Create: `public/css/shop.css`

- [ ] **Step 4.1 — Criar shop.css**

Criar `public/css/shop.css` com o conteúdo completo:

```css
/* ============================================================
   Shop — estilos do catálogo de cosméticos
   Importado por ShopView.jsx via @styles/shop.css
   ============================================================ */

/* ── Área de conteúdo ────────────────────────────────────── */
.shop-content {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow-y: auto;
}

/* ── PC: grid de cards (2 colunas) ──────────────────────── */
.shop-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 18px;
}

.shop-card {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.shop-card:hover {
  border-color: #3a3a6a;
}

.shop-card-owned {
  border-color: rgba(76, 175, 80, 0.35);
}

.shop-card-preview {
  width: 100%;
  height: 90px;
  background: #111128;
}

.shop-card-body {
  padding: 10px 12px;
}

.shop-card-name {
  font-size: 13px;
  font-weight: 600;
  color: #ddd;
  margin-bottom: 4px;
}

.shop-card-price {
  font-size: 12px;
  color: #c8a84b;
  font-weight: 600;
  margin-bottom: 6px;
}

.shop-card-owned-badge {
  font-size: 11px;
  color: #4caf50;
  margin-bottom: 6px;
}

.shop-card-btn {
  display: block;
  width: 100%;
  padding: 5px 0;
  border-radius: 5px;
  border: none;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.shop-card-btn.buy {
  background: #c8a84b;
  color: #0a0a14;
}

.shop-card-btn.free {
  background: #2a5a2a;
  color: #7fff7f;
  border: 1px solid #4caf5066;
}

.shop-card-btn.owned {
  background: transparent;
  color: #4caf50;
  border: 1px solid #4caf5033;
  cursor: default;
}

.shop-card-btn:disabled:not(.owned) {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Mensagem sem itens ──────────────────────────────────── */
.shop-empty {
  grid-column: 1 / -1;
  padding: 32px;
  text-align: center;
  color: #555;
  font-size: 13px;
}

/* ── Mobile: pills de categoria ──────────────────────────── */
.shop-mobile-filters {
  display: none;
  gap: 6px;
  padding: 10px 12px;
  overflow-x: auto;
  border-bottom: 1px solid #1e1e3a;
  background: #111128;
}

.shop-pill {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid #2a2a4a;
  background: transparent;
  color: #888;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.shop-pill.active {
  background: rgba(200, 168, 75, 0.15);
  border-color: #c8a84b;
  color: #c8a84b;
}

/* ── Mobile: lista vertical ──────────────────────────────── */
.shop-list {
  display: none;
  flex-direction: column;
}

.shop-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #1a1a2e;
  transition: background 0.1s;
}

.shop-row:active {
  background: #1a1a2e;
}

.shop-row-owned {
  background: rgba(76, 175, 80, 0.04);
}

.shop-row-preview {
  width: 42px;
  height: 42px;
  border-radius: 7px;
  background: #111128;
  flex-shrink: 0;
}

.shop-row-info {
  flex: 1;
  min-width: 0;
}

.shop-row-name {
  font-size: 13px;
  font-weight: 600;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shop-row-type {
  font-size: 10px;
  color: #555;
  margin-top: 1px;
}

.shop-row-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}

.shop-row-price {
  font-size: 11px;
  color: #c8a84b;
  font-weight: 600;
}

.shop-owned-text {
  font-size: 11px;
  color: #4caf50;
}

.shop-row-btn {
  padding: 3px 10px;
  border-radius: 5px;
  border: none;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.shop-row-btn.buy  { background: #c8a84b; color: #0a0a14; }
.shop-row-btn.free { background: #2a5a2a; color: #7fff7f; }
.shop-row-btn.owned { background: transparent; color: #4caf50; border: 1px solid #4caf5033; cursor: default; }
.shop-row-btn:disabled:not(.owned) { opacity: 0.45; cursor: not-allowed; }

/* ── Modal de compra ─────────────────────────────────────── */
.shop-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shop-modal {
  background: #111128;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  width: 320px;
  max-width: 92vw;
  overflow: hidden;
}

.shop-modal-preview {
  width: 100%;
  height: 120px;
  background: #0d0d1a;
}

.shop-modal-body {
  padding: 16px;
}

.shop-modal-name {
  font-size: 16px;
  font-weight: 700;
  color: #eee;
  margin-bottom: 4px;
}

.shop-modal-price {
  font-size: 14px;
  color: #c8a84b;
  font-weight: 600;
  margin-bottom: 10px;
}

.shop-modal-tos {
  font-size: 10px;
  color: #555;
  line-height: 1.5;
  margin-bottom: 12px;
  border-top: 1px solid #1e1e3a;
  padding-top: 10px;
}

.shop-modal-error {
  font-size: 11px;
  color: #ff6666;
  margin-bottom: 8px;
  background: rgba(255, 100, 100, 0.08);
  border: 1px solid rgba(255, 100, 100, 0.2);
  border-radius: 5px;
  padding: 6px 8px;
}

.shop-modal-actions {
  display: flex;
  gap: 8px;
}

.shop-btn-cancel {
  flex: 1;
  padding: 8px 0;
  border-radius: 6px;
  border: 1px solid #2a2a4a;
  background: transparent;
  color: #888;
  font-size: 13px;
  cursor: pointer;
}

.shop-btn-cancel:disabled { opacity: 0.45; cursor: not-allowed; }

.shop-btn-confirm {
  flex: 2;
  padding: 8px 0;
  border-radius: 6px;
  border: none;
  background: #c8a84b;
  color: #0a0a14;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.shop-btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Responsivo: mobile ──────────────────────────────────── */
@media (max-width: 700px) {
  .shop-grid { display: none; }
  .shop-list { display: flex; }
  .shop-mobile-filters { display: flex; }
}
```

- [ ] **Step 4.2 — Commit**

```bash
git add public/css/shop.css
git commit -m "feat: add shop.css with PC grid and mobile list styles"
```

---

## Task 5 — LobbyPage: integrar ShopView + tab de navegação

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 5.1 — Importar ShopView**

Na linha 9 de `client/src/pages/LobbyPage.jsx` (após os outros imports de componentes), adicionar:

```js
import ShopView from './ShopView'
```

- [ ] **Step 5.2 — Adicionar render do ShopView**

Encontre o bloco de renderização condicional de views (próximo de linha 1163):

```jsx
        {view === 'grimoire' && <GrimoireView />}
```

Logo após essa linha, adicionar:

```jsx
        {view === 'shop' && <ShopView session={session} toast={showToast} />}
```

- [ ] **Step 5.3 — Adicionar tab no mobile bottom nav**

Encontre o `<nav className="mobile-bottom-tabs">` (próximo de linha 1179). A estrutura atual é:

```jsx
        <nav className="mobile-bottom-tabs">
          <button type="button" className={navTabClass('grimoire')} onClick={() => setView('grimoire')}>
            <span className="mbt-ico">📖</span><span className="mbt-lbl">Grimoire</span>
          </button>
          <button type="button" className={navTabClass('formation')} onClick={() => setView('formation')}>
            <span className="mbt-ico">🏰</span><span className="mbt-lbl">Formation</span>
          </button>
          <button type="button" className={navTabClass('home')} onClick={() => setView('home')}>
            <span className="mbt-ico">⚔️</span><span className="mbt-lbl">Duel</span>
          </button>
          <button type="button" className={navTabClass('settings')} onClick={() => setView('settings')}>
            <span className="mbt-ico">⚙️</span><span className="mbt-lbl">Config</span>
          </button>
        </nav>
```

Substituir por (adiciona o tab Shop entre Duel e Config):

```jsx
        <nav className="mobile-bottom-tabs">
          <button type="button" className={navTabClass('grimoire')} onClick={() => setView('grimoire')}>
            <span className="mbt-ico">📖</span><span className="mbt-lbl">Grimoire</span>
          </button>
          <button type="button" className={navTabClass('formation')} onClick={() => setView('formation')}>
            <span className="mbt-ico">🏰</span><span className="mbt-lbl">Formation</span>
          </button>
          <button type="button" className={navTabClass('home')} onClick={() => setView('home')}>
            <span className="mbt-ico">⚔️</span><span className="mbt-lbl">Duel</span>
          </button>
          <button type="button" className={navTabClass('shop')} onClick={() => setView('shop')}>
            <span className="mbt-ico">🛒</span><span className="mbt-lbl">Shop</span>
          </button>
          <button type="button" className={navTabClass('settings')} onClick={() => setView('settings')}>
            <span className="mbt-ico">⚙️</span><span className="mbt-lbl">Config</span>
          </button>
        </nav>
```

- [ ] **Step 5.4 — Verificar no browser (PC)**

Com `npm run dev` rodando, abrir `http://localhost:5173`:

1. Fazer login com Hive Keychain.
2. Clicar na tab **🛒 Shop** na barra de navegação.
3. Esperado: ShopView aparece com sidebar esquerda (Todos / Backgrounds / Skins / Possuídos) e grid de 2 colunas com os 3 backgrounds (Deserto, Floresta, Neve).
4. Todos os itens mostram botão "Obter Grátis" (preço = 0).
5. Clicar em "Obter Grátis" em um item → botão mostra ⌛ brevemente → item muda para "Possuído" → toast aparece.
6. Clicar em "Possuídos" na sidebar → mostra apenas o item recém-obtido.

- [ ] **Step 5.5 — Verificar no browser (mobile)**

Abrir DevTools → Toggle device toolbar → selecionar iPhone 12 ou similar:

1. Navegar para Shop via tab na barra inferior.
2. Esperado: pills de categoria no topo (scroll horizontal), lista vertical de itens abaixo.
3. Sidebar da PC não deve aparecer.
4. Testar obter item grátis → funciona igual ao PC.

- [ ] **Step 5.6 — Verificar modo guest**

Sair do login (Exit) → Entrar como guest → Navegar para Shop:

1. Esperado: itens aparecem no catálogo.
2. Botões "Obter Grátis" aparecem desabilitados.
3. Hover no botão deve mostrar tooltip "Faça login com Hive Keychain para obter cosméticos."

- [ ] **Step 5.7 — Build de produção**

```bash
npm run build
npm start
```

Abrir `http://localhost:3000` e repetir os testes do Step 5.4. Esperado: funciona identicamente.

- [ ] **Step 5.8 — Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: add Shop tab to lobby and integrate ShopView"
```

---

## Checklist Final

Antes de considerar o Subsistema 1 concluído:

- [ ] Tabelas `cosmetics` e `user_cosmetics` existem no banco com 3 backgrounds seed
- [ ] `GET /api/shop` retorna os 3 itens + gameAccount
- [ ] `GET /api/shop/owned` retorna array vazio para jogador sem itens
- [ ] `POST /api/shop/verify-purchase` concede item gratuito sem Keychain
- [ ] Tab 🛒 Shop aparece entre Duel e Config (PC e mobile)
- [ ] PC: sidebar de categorias + grid de cards funcional
- [ ] Mobile: pills + lista vertical funcional
- [ ] Modo guest: botões desabilitados com tooltip
- [ ] `npm run build` sem erros
- [ ] Produção em `localhost:3000` funcional
