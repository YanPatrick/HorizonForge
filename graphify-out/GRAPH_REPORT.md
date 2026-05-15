# Graph Report - C:\Fontes_Javascript\HorizonForge  (2026-05-14)

## Corpus Check
- 18 files · ~174,014 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 193 nodes · 369 edges · 22 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `log()` - 24 edges
2. `render()` - 21 edges
3. `resolveBattleRound()` - 10 edges
4. `startBattle()` - 10 edges
5. `startGame()` - 10 edges
6. `nextBattle()` - 10 edges
7. `initGame()` - 9 edges
8. `genShop()` - 8 edges
9. `_addToBench()` - 8 edges
10. `endBattle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ensureDefaultCosmetics()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `resolveBattleRound()` --calls--> `simulate()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\shared\simulate.js
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `BENCH_SLOTS()` --calls--> `botBuyPhase()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\public\js\battle.js → C:\Fontes_Javascript\HorizonForge\public\js\bot-ai.js
- `START_GOLD()` --calls--> `botInitDuel()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\public\js\battle.js → C:\Fontes_Javascript\HorizonForge\public\js\bot-ai.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (32): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), broadcastTavern(), clearMatchTimers(), computeSkillPowerLevels() (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (10): closeMobileMenu(), openMobileMenu(), randCid(), rnd(), setMobileStep(), _setMobileView(), shuffle(), _syncLogToMobile() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (11): RequireAuth(), BattlePage(), fmtSP(), HeroDetail(), loadPref(), LobbyPage(), MobileHeroPage(), prefKey() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (14): adjacentSlots(), clearAttackArrows(), _dispatchBanner(), endBattle(), FIELD_MAX(), hideTurnPanel(), maxUnits(), placeUnit() (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.26
Nodes (8): botApplyMerge(), botBuyPhase(), botGenShop(), botInitDuel(), botPosition(), botRunTurn(), deps(), makeInitialBOT()

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (12): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), startGame(), startPhaseTimer() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (12): _addToBench(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), _detectCombos(), genShop(), mkUnit() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.36
Nodes (8): showHeroInfo(), getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

### Community 8 - "Community 8"
Cohesion: 0.43
Nodes (5): getItemEquipState(), ShopItemCard(), ShopListRow(), ShopView(), sortItems()

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (7): betweenIncome(), _cleanupBattleDOM(), nextBattle(), nextDuel(), restoreFieldHp(), setShopLocked(), START_GOLD()

### Community 10 - "Community 10"
Cohesion: 0.4
Nodes (2): getBenchWrap(), isTouchOverBenchwrap()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (6): applyMerge(), BENCH_SLOTS(), distinctHeroes(), retBench(), swapFieldBench(), upgradeUnit()

### Community 12 - "Community 12"
Cohesion: 0.4
Nodes (5): applyBattleSpeed(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), toggleBattleSpeed()

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (5): clearFieldPlacementHints(), playback(), renderTurnPanel(), simulate(), startBattle()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (2): adjacentSlots(), simulate()

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 15`** (2 nodes): `GrimoireView.jsx`, `GrimoireView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `LoginPage.jsx`, `LoginPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `TavernPanel.jsx`, `TavernPanel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `release.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 1`, `Community 3`, `Community 5`, `Community 6`, `Community 9`, `Community 11`, `Community 13`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `resolveBattleRound()` connect `Community 0` to `Community 14`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `showHeroInfo()` connect `Community 7` to `Community 1`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `verifyShopPayment()`) actually correct?**
  _`log()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._