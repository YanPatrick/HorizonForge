# Idle Dungeon — Design Spec
**Date:** 2026-08-03
**Status:** Draft — pending balancing session

> **Update 2026-08-06:** Section 1 below ("power score a partir da formação")
> was superseded by a deliberate design pivot. The idle dungeon now runs a
> real event-driven combat simulation (`simulateIdleSegment` in `api/server.js`)
> against a **single fixed generic hero**, completely decoupled from the
> player's own formation/roster. See the updated §1 for the current model.

---

## Overview

Nova aba "Idle" onde o jogador manda sua formação para uma dungeon eterna (cave top-down estilo Diablo). Enquanto o jogador está online ou offline, a formação mata monstros que respawnam periodicamente, com chance de dropar `coins`, `fragmentos` (tipados por slot) e, raríssimamente, `diamantes`. Fragmentos + recipes (compradas com coins) craftam itens idle-exclusivos de stats fixos (diferente do loot randômico dos baús). Poções sustentam o HP do herói durante a run; sem poção e sem HP, a run termina e o herói volta pra tela inicial, com o farm acumulado até ali pendente de coleta.

O objetivo é dar um motivo pra abrir o jogo em sessões curtas e um sumidouro de progressão adicional (itens fixos, craft), sem competir com a economia de PvP/campanha nem inflacionar HIVE.

---

## 1. Mecânica principal — simulação de combate real (herói fixo)

**Superseded 2026-08-06.** O idle roda uma simulação de combate real e
orientada a eventos (`simulateIdleSegment` em `api/server.js`), não mais uma
extrapolação matemática de power score. Decisão deliberada do usuário: o
idle usa um **herói genérico fixo**, totalmente desacoplado da formação/
roster do jogador (não reaproveita nível/gear reais das outras telas).

- Herói fixo com stats base + crescimento por nível (`IDLE_HERO_BASE`,
  `IDLE_HERO_GROWTH_PER_LEVEL` — placeholders pendentes de balanceamento).
- Monstros fixos (`IDLE_MONSTERS`: `guerreiro`, `arqueiro`) com HP/ATK/DEF/
  intervalos de ataque e spawn próprios.
- A simulação avança evento a evento (spawn, ataque do herói, ataque de
  inimigo — o que ocorrer primeiro), creditando XP/loot a cada kill.
- **Auto-poção:** o jogador escolhe um limiar de HP% (`AUTO_POTION_OPTIONS`);
  abaixo dele, uma poção é consumida automaticamente durante o combate,
  restaurando HP fixo. Poções não sustentam mais "tempo de sessão" — são
  reativas ao dano real recebido.
- Cada kill sorteia, independentemente: nada / coin / fragmento (slot
  aleatório) / diamante (~0,1%, sem exibir a chance ao jogador).
- **Online:** múltiplos inimigos podem estar vivos simultaneamente
  (concorrência ilimitada) — o herói ataca sempre o inimigo na frente da
  fila. O servidor resolve a simulação real a cada poll, creditando direto
  na carteira.
- **Offline:** a simulação roda sequencial (1 inimigo por vez), limitada a
  `MAX_OFFLINE_CATCHUP_MS` (30 dias), e credita em `pending_*` até o jogador
  coletar.
- Se o herói morre (HP ≤ 0 e sem poções), a run para (`status = 'stopped'`)
  e o farm acumulado fica pendente de coleta, como antes.

## 2. Nível do herói idle (substituiu "andares/tiers")

**Superseded 2026-08-06** — não existem mais andares/tiers nem "nível de
idle" separado por XP acumulado em faixas fixas de 100. O que existe agora:

- O **herói fixo** tem seu próprio nível (`hero_level`/`hero_xp`), com curva
  geométrica de custo (`idleXpToNextLevel`: 100, 150, 225, 338... — cada
  nível custa 1.5x o anterior).
- Nível sobe automaticamente durante a simulação de combate (online e
  offline, sujeito ao mesmo corte de recompensa no caso offline).
- Nível mais alto = mais HP/ATK/DEF do herói fixo (`IDLE_HERO_GROWTH_PER_LEVEL`),
  não muda os monstros enfrentados — os monstros (`IDLE_MONSTERS`) têm
  stats fixos, não escalam com o andar (não há mais o conceito de andar).

## 3. Sessão, poções e saída

- O herói tem HP visível na run; toma dano ao longo do combate; poções restauram/sustentam esse HP.
- **Sair manualmente** ("Sair da dungeon") está sempre disponível — encerra a run sem penalidade, credita tudo que foi acumulado, e leva pro hub de vender loot / comprar poções antes de reentrar.
- **Ficar sem poção e sem HP** força o retorno automático à tela inicial — sem perda do que já foi farmado, mas fica pendente até o jogador voltar e coletar.
- Poções são o teto físico da duração de uma run, tanto online quanto offline: mesmo pagando diamante pelo 100% offline, sem poção suficiente pra cobrir o tempo, a run já teria encerrado antes.

## 4. Coleta de recompensa offline

- Ao voltar, o jogador vê a recompensa pendente calculada pela extrapolação (item 1).
- **Coleta padrão: 50%** da recompensa estimada (incentivo a ficar online).
- **Coleta 100%**: paga um custo em diamantes (exemplo de referência: ~50 diamantes — valor final pendente de balanceamento).

## 5. Moedas e recursos novos

| Recurso | Papel | Fonte | Sink |
|---|---|---|---|
| `coins` | Soft currency do idle | Drop de kills | Compra de recipes, poções |
| Fragmentos (tipados por slot: espada, capacete, bota, cajado, arco, etc.) | Material de craft | Drop de kills, por zona/andar | Craft de item (consome + recipe) |
| Poções | Sustentam HP do herói em run | Compra com coins (valor a definir) | Consumidas continuamente durante a run |
| Diamantes | Moeda "premium F2P" | (a) Compra direta com HIVE, (b) drop raríssimo no idle (~0,1%, oculto) | Desbloqueio de 100% offline, compras específicas, (fase 2) market P2P por HIVE |

**Nota de nomenclatura:** o `gold` existente hoje (`horizon_forge_details`: `initial_gold`, `value_gold_combo2/3`) é interno à mecânica de recrutamento/combo ("Horizon Forge") e não é uma carteira do jogador — deve ser explicitamente tratado/documentado no código como **battle gold**, sem relação com `coins`.

## 6. Crafting

- Fragmentos são tipados por slot de equipamento, reaproveitando o `slot_type` já existente em `items`/`hero_equipment` (`weapon`, `belt`, `gloves`, `legs`, `ring1`, `ring2`, `head`, `boots`, `special`, etc.).
- Craft = quantidade de fragmentos do slot (ex: 100 fragmentos de espada) + **recipe** comprada com coins, entregues ao "ferreiro" → gera o item idle-exclusivo daquele slot.
- Itens idle têm **stats fixos e pré-definidos** (contraste deliberado com o loot randômico de baú) — cada recipe sempre produz o mesmo item.

## 7. Prevenção de quebra de economia

1. Corte de 50% na coleta offline por padrão (incentivo a jogar ativamente).
2. Poções limitam fisicamente a duração de qualquer run, online ou offline — não dá pra comprar duração ilimitada só com diamante.
3. Diamante → HIVE só existe via **market entre jogadores** (fase 2); o sistema nunca minta HIVE a partir de diamante farmado. HIVE → diamante é compra direta (sentido único, controlado).
4. Itens idle são determinísticos (craft = resultado fixo), não competem com o pool de loot randômico dos baús nem inflacionam raridade.
5. Chance de drop de diamante é intencionalmente baixíssima e não exibida — evita que o idle vire rota principal de diamante/HIVE.

## 8. UI — dois modos de visualização

Puramente cosméticos; a economia por trás é idêntica.

- **Modo animado:** herói percorre um mapa 2D top-down (cave) em loop — chega no fim, volta pro início. Inimigos aparecem/morrem no caminho, loot flutua na tela.
- **Modo "Hide Dungeon"**: sem mapa — imagem fixa do herói + imagem fixa do inimigo atual, que some ao morrer e é substituída pelo próximo. Barra de vida visível só para herói e inimigo atual (não para o time inteiro).

Conforme `CLAUDE.md`, a implementação real da UI deve estar em `client/src/` (JSX), nunca só em `public/*.html`.

## 9. Parâmetros pendentes de balanceamento

Marcados explicitamente como "a definir" — não devem bloquear o design, mas precisam de uma sessão de balanceamento dedicada antes do lançamento:

- Preço de diamante (compra via HIVE)
- Custo exato de recipe (em coins) por item/slot
- Custo em diamantes pra desbloquear 100% offline (referência: ~50)
- Taxa de drop de coin/fragmento por kill, por andar
- Taxa de drop de diamante (referência: ~0,1%)
- Duração/HP restaurado por poção, custo da poção
- Curva de power score → taxa de kills/min por andar
- Curva de XP de idle → andar

---

## Fora de escopo (v1)

- Market P2P diamante ↔ HIVE (mencionado como visão futura, não faz parte da primeira entrega).
- Simulação round a round real do idle (mantém-se matemática/estimativa).
- Progressão de andar dentro de uma única run (andar é function do nível de idle, não de kills acumulados na sessão atual).
