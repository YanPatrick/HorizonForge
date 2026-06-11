# User Dropdown + Revisar Compras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o badge `@username` da topnav em um dropdown com "Revisar Compras" (restaura itens comprados na blockchain HIVE) e "Exit", removendo o botão Exit standalone.

**Architecture:** Backend novo endpoint `POST /api/shop/review-purchases` varre as últimas 2000 ops HIVE do jogador, encontra transfers `shop_*` e faz upsert em `user_cosmetics`. Frontend: state `menuOpen` no LobbyPage, `useRef` + `mousedown` para fechar ao clicar fora, dropdown renderizado inline no badge.

**Tech Stack:** React (useState, useRef, useEffect), Express (api/server.js), Neon SQL, Hive JSON-RPC (`condenser_api.get_account_history`), CSS em `public/css/lobby.css`.

---

## Files

| Arquivo | Mudança |
|---|---|
| `api/server.js` | Novo endpoint `POST /api/shop/review-purchases` após linha 1836 |
| `public/css/lobby.css` | Adicionar estilos `.user-dropdown` e `.user-dropdown-item` após linha 229 |
| `client/src/pages/LobbyPage.jsx` | State `menuOpen`, ref `userMenuRef`, `handleReviewPurchases`, substituir nav JSX |

---

## Task 1: Backend — `POST /api/shop/review-purchases`

**Files:**
- Modify: `api/server.js` (inserir após linha 1836, depois do `});` de `verify-purchase`)

- [ ] **Step 1: Inserir o endpoint em `api/server.js` após a linha 1836**

Inserir este bloco entre o `});` do `verify-purchase` e o comentário `// ── GET /api/cosmetics/backgrounds/equipped`:

```js
// ── POST /api/shop/review-purchases ──────────────────────────────────────────
app.post('/api/shop/review-purchases', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    // Fetch up to 2000 ops in two pages of 1000 (newest first)
    const pages = [];
    const page1 = await hiveRpc('condenser_api.get_account_history', [username, -1, 1000]);
    if (Array.isArray(page1)) {
      pages.push(...page1);
      if (page1.length === 1000) {
        const minId = page1[0][0]; // lowest op_id in page1
        const page2 = await hiveRpc('condenser_api.get_account_history', [username, minId - 1, 1000]);
        if (Array.isArray(page2)) pages.push(...page2);
      }
    }

    // Collect unique item_ids from shop_* transfers to the game account
    const foundIds = new Set();
    for (const [, entry] of pages) {
      const [opType, op] = entry.op;
      if (opType !== 'transfer') continue;
      if (op.to.toLowerCase() !== HIVE_GAME_ACCOUNT.toLowerCase()) continue;
      if (op.from.toLowerCase() !== username.toLowerCase()) continue;
      if (!op.memo || !op.memo.startsWith('shop_')) continue;
      foundIds.add(op.memo.slice(5));
    }

    if (foundIds.size === 0) return res.json({ ok: true, restored: 0, items: [] });

    // Keep only ids that exist in the cosmetics catalog
    const ids = [...foundIds];
    const existing = await sql`SELECT id FROM cosmetics WHERE id = ANY(${ids})`;
    const validIds = existing.map(r => r.id);

    // Find which are not yet owned
    const owned = await sql`
      SELECT item_id FROM user_cosmetics WHERE player = ${username} AND item_id = ANY(${validIds})
    `;
    const ownedSet = new Set(owned.map(r => r.item_id));
    const toInsert = validIds.filter(id => !ownedSet.has(id));

    for (const item_id of toInsert) {
      await sql`
        INSERT INTO user_cosmetics (player, item_id) VALUES (${username}, ${item_id})
        ON CONFLICT DO NOTHING
      `;
    }

    console.log(`🔍 Review purchases: ${username} — ${toInsert.length} restored of ${validIds.length} found on-chain`);
    return res.json({ ok: true, restored: toInsert.length, items: toInsert });
  } catch (err) {
    console.error('[/api/shop/review-purchases]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Verificar manualmente o endpoint**

Com o servidor rodando (`npm start` ou `node api/server.js`), testar:

```bash
# Substitua <TOKEN> pelo token JWT de uma sessão logada
curl -s -X POST http://localhost:3000/api/shop/review-purchases \
  -H "Authorization: Bearer <TOKEN>" | node -e "process.stdin||(0);let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
```

Resposta esperada (sem itens a restaurar):
```json
{ "ok": true, "restored": 0, "items": [] }
```

Sem token:
```json
{ "ok": false, "error": "Unauthorized" }
```

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat: add POST /api/shop/review-purchases endpoint"
```

---

## Task 2: CSS — Estilos do dropdown

**Files:**
- Modify: `public/css/lobby.css` (inserir após linha 229, depois do `.btn-exit:hover`)

- [ ] **Step 1: Inserir estilos do dropdown em `public/css/lobby.css` após o bloco `.btn-exit:hover` (linha 229)**

```css
      /* ── User dropdown menu ── */
      .nav-user-badge {
        position: relative;
        cursor: pointer;
        user-select: none;
      }
      .nav-user-chevron {
        font-size: 9px;
        color: rgba(160, 140, 210, 0.6);
        margin-left: 2px;
        transition: transform 0.15s;
      }
      .user-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        background: #1a1535;
        border: 1px solid rgba(130, 100, 220, 0.35);
        border-radius: 8px;
        min-width: 175px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        z-index: 200;
      }
      .user-dropdown-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: none;
        border: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        width: 100%;
        text-align: left;
        font-size: 12px;
        font-family: Inter, Segoe UI, Arial, sans-serif;
        font-weight: 500;
        color: rgba(200, 185, 245, 0.88);
        cursor: pointer;
        transition: background 0.12s;
      }
      .user-dropdown-item:last-child {
        border-bottom: none;
      }
      .user-dropdown-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .user-dropdown-item.danger {
        color: rgba(255, 110, 110, 0.9);
      }
      .user-dropdown-item.danger:hover {
        background: rgba(220, 40, 40, 0.12);
      }
```

- [ ] **Step 2: Commit**

```bash
git add public/css/lobby.css
git commit -m "feat: add user-dropdown CSS styles to lobby.css"
```

---

## Task 3: Frontend — Dropdown no LobbyPage.jsx

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Adicionar state `menuOpen` após a linha 769 (após `pvpFmtOpen`)**

Localizar:
```js
  const [pvpFmtOpen, setPvpFmtOpen] = useState(false)
```

Adicionar logo abaixo:
```js
  const [menuOpen, setMenuOpen] = useState(false)
```

- [ ] **Step 2: Adicionar ref `userMenuRef` após `toastTimerRef` (linha 787)**

Localizar:
```js
  const toastTimerRef = useRef(null)
```

Adicionar logo abaixo:
```js
  const userMenuRef = useRef(null)
```

- [ ] **Step 3: Adicionar `useEffect` para fechar o menu ao clicar fora**

Localizar o bloco `/* ── toast ── */` (em torno de linha 817). Inserir **antes** dele:

```js
  /* ── user menu close-on-outside-click ───────────────────── */
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])
```

- [ ] **Step 4: Adicionar `handleReviewPurchases` próximo a `doLogout` (em torno de linha 1328)**

Localizar:
```js
  function doLogout() {
```

Inserir **antes** dele:

```js
  /* ── review blockchain purchases ────────────────────────── */
  async function handleReviewPurchases() {
    setMenuOpen(false)
    clearTimeout(toastTimerRef.current)
    setToastMsg('⏳ Varrendo blockchain…')
    try {
      const res = await fetch('/api/shop/review-purchases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      })
      const data = await res.json()
      if (data.ok && data.restored > 0) {
        showToast(`✅ ${data.restored} item(s) restaurado(s)!`)
      } else if (data.ok) {
        showToast('ℹ️ Tudo já estava sincronizado')
      } else {
        showToast('❌ Erro ao revisar compras')
      }
    } catch {
      showToast('❌ Erro ao revisar compras')
    }
  }
```

- [ ] **Step 5: Substituir o bloco `<nav className="topnav">` no render (linhas 1342–1364)**

Localizar e substituir este bloco inteiro:

```jsx
      <nav className="topnav">
        <div className="nav-right">
           {/* TEASER DO BAÚ — NOVA IMPLEMENTAÇÃO */}
          <div className="nav-chest-pill" title="Fight for a chance to open a new chest!">
            <span className="nav-chest-ico">🎁</span>
            <span className="nav-chest-status">0 %</span>
            <div className="nav-chest-glow"></div>
          </div>

          {session?.mode === 'hive' && balance != null && (
            <div className="hive-bal">
              <img src="/images/hive-logo.png" width="14" height="12" style={{ display: 'inline-block', verticalAlign: 'middle', imageRendering: 'crisp-edges' }} alt="HIVE" />
              <span>{balance}</span>
            </div>
          )}
          <div className="nav-user-badge">
            {session?.mode === 'hive' && !avatarError && (
              <img className="nav-avatar" src={`https://images.hive.blog/u/${username}/avatar`} alt="avatar" onError={() => setAvatarError(true)} />
            )}
            <span>@{username}</span>
          </div>
          <button className="btn-exit" onClick={doLogout}>Exit</button>
        </div>
      </nav>
```

Por:

```jsx
      <nav className="topnav">
        <div className="nav-right">
          {/* TEASER DO BAÚ — NOVA IMPLEMENTAÇÃO */}
          <div className="nav-chest-pill" title="Fight for a chance to open a new chest!">
            <span className="nav-chest-ico">🎁</span>
            <span className="nav-chest-status">0 %</span>
            <div className="nav-chest-glow"></div>
          </div>

          {session?.mode === 'hive' && balance != null && (
            <div className="hive-bal">
              <img src="/images/hive-logo.png" width="14" height="12" style={{ display: 'inline-block', verticalAlign: 'middle', imageRendering: 'crisp-edges' }} alt="HIVE" />
              <span>{balance}</span>
            </div>
          )}

          <div className="nav-user-badge" ref={userMenuRef} onClick={() => setMenuOpen(o => !o)}>
            {session?.mode === 'hive' && !avatarError && (
              <img className="nav-avatar" src={`https://images.hive.blog/u/${username}/avatar`} alt="avatar" onError={() => setAvatarError(true)} />
            )}
            <span>@{username}</span>
            <span className="nav-user-chevron">▼</span>
            {menuOpen && (
              <div className="user-dropdown" onClick={e => e.stopPropagation()}>
                {session?.mode === 'hive' && (
                  <button className="user-dropdown-item" onClick={handleReviewPurchases}>
                    🔍 Revisar Compras
                  </button>
                )}
                <button className="user-dropdown-item danger" onClick={doLogout}>
                  🚪 Exit
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
```

- [ ] **Step 6: Verificar visualmente em `http://localhost:5173`**

1. O badge `@username` mostra um `▼` e é clicável.
2. Clicar no badge abre o dropdown com "🔍 Revisar Compras" e "🚪 Exit".
3. Clicar fora do dropdown fecha-o.
4. "🚪 Exit" faz logout normalmente.
5. "🔍 Revisar Compras" mostra "⏳ Varrendo blockchain…" e depois o resultado.
6. Usuário guest não vê "Revisar Compras" (só "Exit").

- [ ] **Step 7: Build de produção**

```bash
npm run build
```

Resultado esperado: `public/dist/` atualizado, sem erros.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: user dropdown menu with Revisar Compras and Exit"
```
