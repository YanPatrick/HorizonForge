# Graph Report - HorizonForge  (2026-05-06)

## Corpus Check
- 16 files · ~98,751 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 174 nodes · 335 edges · 13 communities detected
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
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `log()` - 22 edges
2. `render()` - 20 edges
3. `startGame()` - 10 edges
4. `nextBattle()` - 10 edges
5. `resolveBattleRound()` - 9 edges
6. `initGame()` - 9 edges
7. `startBattle()` - 9 edges
8. `genShop()` - 8 edges
9. `_addToBench()` - 8 edges
10. `endBattle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `resolveBattleRound()` --calls--> `simulate()`  [INFERRED]
  api\server.js → shared\simulate.js
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `BENCH_SLOTS()` --calls--> `botBuyPhase()`  [INFERRED]
  public\js\battle.js → public\js\bot-ai.js
- `initGame()` --calls--> `init()`  [INFERRED]
  public\js\battle.js → public\js\skill-tooltip.js
- `verifyHivePayment()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (27): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), clearMatchTimers(), computeSkillPowerLevels(), forfeitBattle() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (11): RequireAuth(), BattlePage(), fmtSP(), HeroDetail(), loadPref(), LobbyPage(), MobileHeroPage(), prefKey() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (5): applyBattleSpeed(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), toggleBattleSpeed()

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (11): applyMerge(), START_GOLD(), upgradeUnit(), botApplyMerge(), botBuyPhase(), botGenShop(), botInitDuel(), botPosition() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (10): betweenIncome(), _cleanupBattleDOM(), endBattle(), hideTurnPanel(), nextBattle(), nextDuel(), renderDuelBar(), restoreFieldHp() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (10): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), startGame(), updateFieldLabels() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.36
Nodes (8): showHeroInfo(), getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (9): adjacentSlots(), clearAttackArrows(), FIELD_MAX(), maxUnits(), placeUnit(), render(), renderBench(), renderField() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (9): _addToBench(), BENCH_SLOTS(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), distinctHeroes(), retBench() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.28
Nodes (9): _detectCombos(), genShop(), mkUnit(), playerRandCid(), randCid(), rerollShop(), rnd(), shuffle() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (7): _dispatchBanner(), playback(), renderTurnPanel(), simulate(), startBattle(), startPhaseTimer(), stopPhaseTimer()

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (7): closeMobileMenu(), openMobileMenu(), setMobileStep(), _setMobileView(), _syncLogToMobile(), toggleMobileMenu(), togglePanel()

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (2): adjacentSlots(), simulate()

## Knowledge Gaps
- **Thin community `Community 13`** (3 nodes): `simulate.js`, `adjacentSlots()`, `simulate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 2`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.256) - this node is a cross-community bridge._
- **Why does `resolveBattleRound()` connect `Community 0` to `Community 13`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `showHeroInfo()` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `refundHiveWager()`) actually correct?**
  _`log()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._