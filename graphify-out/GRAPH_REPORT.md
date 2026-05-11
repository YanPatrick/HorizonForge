# Graph Report - HorizonForge  (2026-05-11)

## Corpus Check
- 17 files · ~103,285 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 181 nodes · 348 edges · 11 communities detected
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
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

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
Cohesion: 0.1
Nodes (32): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), broadcastTavern(), clearMatchTimers(), computeSkillPowerLevels() (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (11): RequireAuth(), BattlePage(), fmtSP(), HeroDetail(), loadPref(), LobbyPage(), MobileHeroPage(), prefKey() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (14): applyMerge(), BENCH_SLOTS(), distinctHeroes(), retBench(), START_GOLD(), upgradeUnit(), botApplyMerge(), botBuyPhase() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (19): adjacentSlots(), betweenIncome(), _cleanupBattleDOM(), clearAttackArrows(), endBattle(), FIELD_MAX(), hideTurnPanel(), maxUnits() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (3): randCid(), rnd(), shuffle()

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (12): _addToBench(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), _detectCombos(), genShop(), mkUnit() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (10): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), startGame(), updateFieldLabels() (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.36
Nodes (8): showHeroInfo(), getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (8): clearFieldPlacementHints(), _dispatchBanner(), playback(), renderTurnPanel(), simulate(), startBattle(), startPhaseTimer(), stopPhaseTimer()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (7): closeMobileMenu(), openMobileMenu(), setMobileStep(), _setMobileView(), _syncLogToMobile(), toggleMobileMenu(), togglePanel()

### Community 10 - "Community 10"
Cohesion: 0.4
Nodes (5): applyBattleSpeed(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), toggleBattleSpeed()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`?**
  _High betweenness centrality (0.258) - this node is a cross-community bridge._
- **Why does `showHeroInfo()` connect `Community 7` to `Community 4`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `refundHiveWager()`) actually correct?**
  _`log()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._