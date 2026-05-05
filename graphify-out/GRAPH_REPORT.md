# Graph Report - HorizonForge  (2026-05-05)

## Corpus Check
- 16 files · ~95,185 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 169 nodes · 321 edges · 12 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `log()` - 22 edges
2. `render()` - 20 edges
3. `startGame()` - 10 edges
4. `nextBattle()` - 10 edges
5. `initGame()` - 9 edges
6. `startBattle()` - 9 edges
7. `resolveBattleRound()` - 8 edges
8. `genShop()` - 8 edges
9. `_addToBench()` - 8 edges
10. `endBattle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `resolveBattleRound()` --calls--> `simulate()`  [INFERRED]
  api\server.js → shared\simulate.js
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `initGame()` --calls--> `init()`  [INFERRED]
  public\js\battle.js → public\js\skill-tooltip.js
- `verifyHivePayment()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `refundHiveWager()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (26): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), computeSkillPowerLevels(), forfeitBattle(), getStatsTable() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (7): applyBattleSpeed(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), playback(), renderTurnPanel(), toggleBattleSpeed()

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (14): applyMerge(), BENCH_SLOTS(), distinctHeroes(), retBench(), START_GOLD(), upgradeUnit(), botApplyMerge(), botBuyPhase() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (9): RequireAuth(), BattlePage(), HeroDetail(), loadPref(), LobbyPage(), prefKey(), roleCategory(), savePref() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (15): _addToBench(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), _detectCombos(), genShop(), mkUnit() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (11): betweenIncome(), _cleanupBattleDOM(), nextBattle(), nextDuel(), restoreFieldHp(), setShopLocked(), simulate(), startBattle() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (11): clearAttackArrows(), _dispatchBanner(), endBattle(), FIELD_MAX(), hideTurnPanel(), maxUnits(), placeUnit(), render() (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (10): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), startGame(), updateFieldLabels() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.36
Nodes (7): getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (7): closeMobileMenu(), openMobileMenu(), setMobileStep(), _setMobileView(), _syncLogToMobile(), toggleMobileMenu(), togglePanel()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): adjacentSlots(), simulate()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (2): adjacentSlots(), renderField()

## Knowledge Gaps
- **Thin community `Community 11`** (3 nodes): `simulate.js`, `adjacentSlots()`, `simulate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `adjacentSlots()`, `renderField()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.257) - this node is a cross-community bridge._
- **Why does `initGame()` connect `Community 7` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `init()` connect `Community 7` to `Community 8`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `refundHiveWager()`) actually correct?**
  _`log()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._