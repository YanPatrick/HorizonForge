# Design: Shop — Subsistema 1: Infraestrutura

**Date:** 2026-05-11
**Scope:** `api/server.js`, `db/schema.sql`, `client/src/pages/LobbyPage.jsx`
**Status:** Aprovado para implementação

---

## Visão Geral

Implementar a infraestrutura base do sistema de shop: catálogo de cosméticos no banco de dados, endpoints de API para listagem/compra, fluxo de pagamento via HIVE Keychain, e a tela do shop no lobby (PC e mobile).

Este subsistema registra apenas **posse** de itens. O comportamento dos cosméticos em jogo (backgrounds sorteados por partida, skins equipadas nos heróis) é responsabilidade dos Subsistemas 2 e 3.

---

## Out of Scope

- Renderização de backgrounds na batalha (Subsistema 2)
- Seleção de 3–4 backgrounds favoritos por jogador (Subsistema 2)
- UI de equipe de skins no painel de herói (Subsistema 3)
- Renderização de skins na batalha (Subsistema 3)
- Admin panel para gerenciar catálogo
- Suporte a HBD (futuro, conforme demanda)
- Coleções/temporadas (estrutura preparada, mas não implementada)
- Reembolsos (explicitamente excluídos por TOS)

---

## Banco de Dados

### Tabela `cosmetics` — catálogo

```sql
CREATE TABLE cosmetics (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('background', 'skin')),
  name        TEXT NOT NULL,
  preview     TEXT NOT NULL,     -- URL relativa da imagem (ex: '/images/arena-desert.jpg')
  price_hive  NUMERIC NOT NULL,
  hero_cid    TEXT,              -- NULL para backgrounds; cid do herói para skins
  sort_order  INT DEFAULT 0
);
```

**Regras:**
- `hero_cid` é `NULL` para backgrounds, obrigatório para skins
- `preview` é sempre uma URL relativa de imagem (ex: `"/images/arena-desert.jpg"`)
- Backgrounds iniciais: os 3 arquivos existentes em `public/images/` (`arena-desert.jpg`, `arena-forest.jpg`, `arena-snow.jpg`)
- Novos backgrounds são adicionados inserindo a imagem em `public/images/` e rodando um INSERT SQL
- Catálogo gerenciado via INSERT SQL direto (sem admin panel)

### Tabela `user_cosmetics` — posse

```sql
CREATE TABLE user_cosmetics (
  player        TEXT NOT NULL,
  item_id       TEXT NOT NULL REFERENCES cosmetics(id),
  purchased_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (player, item_id)
);
```

**Regras:**
- `player` é o username Hive (lowercase)
- Inserção idempotente — ON CONFLICT DO NOTHING
- Sem soft delete — compra é permanente

### Seed inicial de cosméticos

Apenas os 3 backgrounds existentes em `public/images/`. Novos backgrounds serão inseridos manualmente via SQL conforme novas arenas forem criadas.

```sql
INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
  ('bg_desert', 'background', 'Deserto',  '/images/arena-desert.jpg', 5, NULL, 10),
  ('bg_forest', 'background', 'Floresta', '/images/arena-forest.jpg', 5, NULL, 20),
  ('bg_snow',   'background', 'Neve',     '/images/arena-snow.jpg',   5, NULL, 30)
ON CONFLICT DO NOTHING;
```

---

## API Endpoints

Todos os endpoints novos em `api/server.js`, seguindo o padrão `authFromRequest()` existente.

### `GET /api/shop`

Público (sem autenticação).

```
Response 200:
{
  "items": [
    {
      "id": "bg_oceano",
      "type": "background",
      "name": "Oceano Profundo",
      "preview": "linear-gradient(135deg, #0a1a3a, #1a3a6a)",
      "price_hive": 5,
      "hero_cid": null
    },
    ...
  ]
}
```

Itens ordenados por `sort_order ASC`.

### `GET /api/shop/owned`

Autenticado (Bearer token Hive).

```
Response 200:
{
  "owned": ["bg_oceano", "bg_inferno"]
}
```

Array de `item_id` que o jogador autenticado possui. Array vazio se não possui nenhum.

### `POST /api/shop/verify-purchase`

Autenticado (Bearer token Hive).

```
Body:
{ "item_id": "bg_oceano" }

Response 200 (sucesso):
{ "ok": true }

Response 400 (item não encontrado):
{ "error": "Item not found" }

Response 402 (pagamento não confirmado após timeout):
{ "error": "Payment not found" }

Response 409 (já possui):
{ "ok": true }   -- idempotente, não é erro
```

**Lógica interna:**
1. Valida token e extrai `username`
2. Busca item em `cosmetics` — se não existe, 400
3. Se `user_cosmetics` já tem `(username, item_id)`, retorna `{ ok: true }` imediatamente
4. Faz poll na Hive blockchain (mesmo padrão de `verifyHivePayment`):
   - Remetente: `username`
   - Destinatário: `HIVE_GAME_ACCOUNT`
   - Valor: `price_hive` (tolerância ±0.001)
   - Memo: `shop_{item_id}`
   - Janela: últimos 60s
   - Timeout total: 60s com retry a cada 3s
5. Se encontrado: `INSERT INTO user_cosmetics ON CONFLICT DO NOTHING`, retorna `{ ok: true }`
6. Se timeout: retorna 402

---

## Fluxo de Compra (UX)

```
Jogador clica "Comprar"
        │
        ▼
Modal de confirmação:
  - Nome do item
  - Preview (gradient/imagem)
  - Preço em HIVE
  - Aviso: "Este é um cosmético digital não transferível e
    sem valor de revenda. Compras são definitivas."
  - [Cancelar] [Confirmar]
        │
        ▼ Confirmar
window.hive_keychain.requestTransfer(
  username,
  HIVE_GAME_ACCOUNT,
  price_hive.toFixed(3),
  "shop_{item_id}",
  "HIVE"
)
        │
        ▼ Keychain aprovado
Loading state (spinner, botão desabilitado)
POST /api/shop/verify-purchase { item_id }
        │
   ┌────┴────┐
   ▼         ▼
Sucesso    Falha (402/timeout)
Modal       Modal mostra erro
fecha       "Tentar novamente"
Toast OK
```

**Guest mode:** botão "Comprar" desabilitado com tooltip: *"Faça login com Hive Keychain para comprar cosméticos."*

---

## Interface — PC (ShopView)

Layout: sidebar de categorias à esquerda + grid de itens à direita.
Consistente com o padrão do Grimoire (lista esquerda → conteúdo direita).

**Sidebar:**
- Categorias: Todos | Backgrounds | Skins
- Filtro extra: Possuídos (mostra apenas itens que o jogador já tem)

**Grid de itens (2 colunas):**
Cada card contém:
- Preview: `div` com `background: preview` (gradient ou imagem) — altura fixa 80px
- Nome do item
- Preço (ex: `5 HIVE`) ou badge `✓ Possuído` (verde) se já possui
- Botão `Comprar` (dourado) ou `Possuído` (cinza desabilitado)

**Sem botão "Equipar" no shop.** Equipar é responsabilidade dos Subsistemas 2 e 3.

**Posição no menu:** tab `🛒 Shop` após `⚔️ Duel`, antes de `⚙️ Config` em `LobbyPage.jsx`.

---

## Interface — Mobile (ShopView)

Layout: lista vertical com pills de categoria no topo.

**Categoria pills:** scroll horizontal — `Todos | 🌄 Backgrounds | ✨ Skins`

**Lista de itens:** cada linha contém:
- Preview pequeno (36×36px, border-radius)
- Nome + tipo em texto
- Preço ou status `✓ Possuído` à direita
- Botão `Comprar` ou badge possuído à direita

**Posição no menu mobile:** mesmo ponto que no PC — entre Duel e Config na navegação mobile existente.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `db/schema.sql` | Adicionar tabelas `cosmetics`, `user_cosmetics` + seed |
| `api/server.js` | Adicionar 3 endpoints: `GET /api/shop`, `GET /api/shop/owned`, `POST /api/shop/verify-purchase` |
| `client/src/pages/LobbyPage.jsx` | Nova tab `🛒 Shop` + componente `ShopView` inline |

---

## Invariantes

- Jogadores guest não podem comprar (validado no frontend e no backend via auth)
- Compra é idempotente — verificar posse antes de registrar no DB
- Preço verificado na blockchain com tolerância ±0.001 HIVE
- Memo format: `shop_{item_id}` — sem espaços, sem caracteres especiais
- `user_cosmetics` não tem DELETE — posse é permanente
- Shop não afeta stats ou mecânicas de jogo — puramente cosmético
