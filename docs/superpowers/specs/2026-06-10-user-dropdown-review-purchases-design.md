# Design: User Dropdown Menu + Revisar Compras

**Date:** 2026-06-10  
**Status:** Approved

---

## Problem

1. O botão "Exit" está solto na navbar sem contexto de conta.
2. Usuários que perderam o vínculo entre compras na blockchain HIVE e o banco de dados não têm como restaurar o acesso aos itens (backgrounds, skins) sem abrir suporte manual — pois já pagaram e não podem comprar de novo.

---

## Solution Overview

- O badge `@username` na topnav vira um menu dropdown clicável (estilo minimalista escuro, consistente com a UI atual).
- O botão "Exit" standalone é removido e migrado para dentro do dropdown.
- O dropdown ganha a opção "Revisar Compras" que varre as últimas 2000 operações HIVE do jogador, encontra transferências de compra e restaura os vínculos ausentes no banco.

---

## Frontend — LobbyPage.jsx

### Dropdown trigger

- `.nav-user-badge` passa a ter `onClick={() => setMenuOpen(o => !o)}` e `style={{ cursor: 'pointer', position: 'relative' }}`.
- Estado local: `const [menuOpen, setMenuOpen] = useState(false)`.
- `useEffect` fecha o menu ao clicar fora (`mousedown` no `document`, cleanup no unmount).
- Chevron `▼` adicionado após o `@username`.

### Dropdown panel

```
┌─────────────────────────┐
│ 🔍 Revisar Compras      │
│─────────────────────────│
│ 🚪 Exit                 │
└─────────────────────────┘
```

- `position: absolute`, alinhado à direita do badge, `zIndex: 200`.
- Fundo `#1a1535`, borda `1px solid #3a2d6e`, `border-radius: 8px`, `box-shadow` escuro.
- Cada item: `padding: 10px 14px`, `display: flex`, `gap: 8px`, hover com `background: rgba(255,255,255,0.05)`.
- "Exit" com `color: #ff7777`.

### Ação "Revisar Compras"

1. Fecha o dropdown.
2. Exibe toast neutro: `"⏳ Varrendo blockchain…"` (duração 15 s para cobrir tempo da API).
3. Chama `POST /api/shop/review-purchases` com `Authorization: Bearer <token>`.
4. Substitui o toast pelo resultado:
   - Sucesso com itens restaurados → `"✅ {n} iten(s) restaurado(s)!"` (verde, 5 s).
   - Sucesso sem novidades → `"ℹ️ Tudo já estava sincronizado"` (neutro, 4 s).
   - Erro de rede/servidor → `"❌ Erro ao revisar compras"` (vermelho, 5 s).
5. Usa a função `showToast` já existente no LobbyPage.

### Remoção do botão Exit

- O `<button className="btn-exit">Exit</button>` é removido do JSX.
- A função `doLogout` permanece, chamada pelo item do dropdown.

---

## Backend — api/server.js

### Novo endpoint: `POST /api/shop/review-purchases`

**Auth:** JWT obrigatório (`authFromRequest`). Retorna 401 se ausente.

**Lógica:**

1. Busca histórico HIVE do jogador em até 2 páginas de 1000 ops (`condenser_api.get_account_history`):
   - Página 1: `[username, -1, 1000]`
   - Se a página 1 retornar 1000 ops, busca a página 2 usando o menor `op_id` da página 1 como cursor: `[username, minOpId - 1, 1000]`
2. Filtra operações do tipo `transfer` onde:
   - `op.to === HIVE_GAME_ACCOUNT` (case-insensitive)
   - `op.from === username` (case-insensitive)
   - `op.memo` começa com `shop_`
3. Extrai `item_id` de cada memo (`memo.slice(5)` após `"shop_"`).
4. De-duplica a lista de `item_id`s encontrados.
5. Para cada `item_id`:
   - Verifica que existe em `cosmetics` (ignora os que não existem).
   - Executa `INSERT INTO user_cosmetics (player, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`.
6. Retorna `{ ok: true, restored: <count_de_novos_inseridos>, items: [<ids_restaurados>] }`.

**Erro:** Se a chamada HIVE falhar, retorna `500` com `{ ok: false, error: "..." }`.

**Idempotente:** Pode ser chamado múltiplas vezes sem efeitos colaterais (ON CONFLICT DO NOTHING).

---

## Out of Scope

- Não verifica `user_equipped_backgrounds` / `user_equipped_skins` — apenas garante o vínculo em `user_cosmetics`.
- Não lida com compras de itens que foram removidos do catálogo (não existem mais em `cosmetics`).
- Não autentica guests (o botão fica oculto para `session.mode !== 'hive'`).

---

## Files Affected

| Arquivo | Mudança |
|---|---|
| `client/src/pages/LobbyPage.jsx` | Dropdown no badge, remove btn-exit, adiciona lógica de revisar |
| `api/server.js` | Novo endpoint `POST /api/shop/review-purchases` |
