# Graph Report - HorizonForge  (2026-05-08)

## Corpus Check
- 17 files · ~100,534 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 180 nodes · 347 edges · 7 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]

## God Nodes (most connected - your core abstractions)
1. `log()` - 22 edges
2. `render()` - 20 edges
3. `resolveBattleRound()` - 10 edges
4. `startBattle()` - 10 edges
5. `startGame()` - 10 edges
6. `nextBattle()` - 10 edges
7. `initGame()` - 9 edges
8. `genShop()` - 8 edges
9. `_addToBench()` - 8 edges
10. `endBattle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `initGame()` --calls--> `init()`  [INFERRED]
  public\js\battle.js → public\js\skill-tooltip.js
- `verifyHivePayment()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `refundHiveWager()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `sendHivePrize()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (32): applyBattleSpeed(), _bootBattle(), clearFieldPlacementHints(), closeMobileMenu(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), hideLoader() (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (32): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), broadcastTavern(), clearMatchTimers(), computeSkillPowerLevels() (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (20): adjacentSlots(), betweenIncome(), _cleanupBattleDOM(), clearAttackArrows(), _dispatchBanner(), endBattle(), FIELD_MAX(), hideTurnPanel() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (14): applyMerge(), BENCH_SLOTS(), distinctHeroes(), retBench(), START_GOLD(), upgradeUnit(), botApplyMerge(), botBuyPhase() (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (11): RequireAuth(), BattlePage(), fmtSP(), HeroDetail(), loadPref(), LobbyPage(), MobileHeroPage(), prefKey() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (12): _addToBench(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), _detectCombos(), genShop(), mkUnit() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.36
Nodes (8): showHeroInfo(), getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `showHeroInfo()` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `refundHiveWager()`) actually correct?**
  _`log()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._