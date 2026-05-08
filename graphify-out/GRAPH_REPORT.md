# Graph Report - C:\Fontes_Javascript\HorizonForge  (2026-05-06)

## Corpus Check
- 16 files · ~113,187 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 175 nodes · 338 edges · 15 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `log()` - 22 edges
2. `render()` - 20 edges
3. `startBattle()` - 10 edges
4. `startGame()` - 10 edges
5. `nextBattle()` - 10 edges
6. `resolveBattleRound()` - 9 edges
7. `initGame()` - 9 edges
8. `genShop()` - 8 edges
9. `_addToBench()` - 8 edges
10. `endBattle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `resolveBattleRound()` --calls--> `simulate()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\shared\simulate.js
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `initGame()` --calls--> `init()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\public\js\battle.js → C:\Fontes_Javascript\HorizonForge\public\js\skill-tooltip.js
- `verifyHivePayment()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `refundHiveWager()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (29): _addToBench(), applyBattleSpeed(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), closeMobileMenu(), _detectCombos() (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (27): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), clearMatchTimers(), computeSkillPowerLevels(), forfeitBattle() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (25): adjacentSlots(), betweenIncome(), _cleanupBattleDOM(), clearAttackArrows(), clearFieldPlacementHints(), _dispatchBanner(), endBattle(), FIELD_MAX() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (14): applyMerge(), BENCH_SLOTS(), distinctHeroes(), retBench(), START_GOLD(), upgradeUnit(), botApplyMerge(), botBuyPhase() (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (11): RequireAuth(), BattlePage(), fmtSP(), HeroDetail(), loadPref(), LobbyPage(), MobileHeroPage(), prefKey() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (10): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), startGame(), updateFieldLabels() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.36
Nodes (8): showHeroInfo(), getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (0): 

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (2): adjacentSlots(), simulate()

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 9`** (2 nodes): `GrimoireView.jsx`, `GrimoireView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `LoginPage.jsx`, `LoginPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `release.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.255) - this node is a cross-community bridge._
- **Why does `resolveBattleRound()` connect `Community 1` to `Community 8`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `showHeroInfo()` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `refundHiveWager()`) actually correct?**
  _`log()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._