# Idle Dungeon — Design Spec
**Date:** 2026-08-03
**Status:** Draft — pending balancing session

---

## Overview

Nova aba "Idle" onde o jogador manda sua formação para uma dungeon eterna (cave top-down estilo Diablo). Enquanto o jogador está online ou offline, a formação mata monstros que respawnam periodicamente, com chance de dropar `coins`, `fragmentos` (tipados por slot) e, raríssimamente, `diamantes`. Fragmentos + recipes (compradas com coins) craftam itens idle-exclusivos de stats fixos (diferente do loot randômico dos baús). Poções sustentam o HP do herói durante a run; sem poção e sem HP, a run termina e o herói volta pra tela inicial, com o farm acumulado até ali pendente de coleta.

O objetivo é dar um motivo pra abrir o jogo em sessões curtas e um sumidouro de progressão adicional (itens fixos, craft), sem competir com a economia de PvP/campanha nem inflacionar HIVE.

---

## 1. Mecânica principal — matemática, não simulação

O idle **não roda o motor de batalha** (`shared/simulate.js`) round a round. Em vez disso:

- Um **power score** é calculado a partir do nível + gear da formação usada no idle (reaproveita o sistema de nível/gear existente).
- Esse power score vs. a dificuldade do andar atual determina uma **taxa de kills/min**.
- Cada kill sorteia, independentemente: nada / coin / fragmento (do slot correspondente ao andar/zona) / diamante (~0,1%, sem exibir a chance ao jogador).
- **Online:** o cliente recebe a taxa do servidor e roda uma animação local no ritmo certo (kill → loot flutuante), sincronizando o saldo real com o servidor periodicamente. O servidor nunca precisa manter um tick contínuo por jogador.
- **Offline:** ao retornar, o servidor usa a taxa de kill dos últimos ~5 minutos online do jogador, extrapola pelo tempo que ficou fora, e resolve tudo de uma vez (sem replay round a round).

## 2. Nível de idle e andares (tiers)

- Existe um **nível de idle** próprio, separado do nível de herói (campanha/PvP/bot já têm seu próprio contexto de nível). O jogador confere esse nível ao entrar na aba.
- XP de idle é ganho pelos kills (online e offline, ambos sujeitos ao mesmo corte de recompensa).
- O andar/tier atual da dungeon é gatilhado por esse nível de idle — jogadores mais ativos avançam mais rápido; quem fica offline por muito tempo permanece no mesmo andar até voltar a jogar.
- Andares mais altos = monstros mais fortes, melhor taxa/qualidade de drop.

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
