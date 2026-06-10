# Graph Report - HorizonForge  (2026-05-28)

## Corpus Check
- 21 files · ~261,898 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 208 nodes · 391 edges · 15 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.8)
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
1. `log()` - 26 edges
2. `render()` - 21 edges
3. `resolveBattleRound()` - 11 edges
4. `startBattle()` - 10 edges
5. `startGame()` - 10 edges
6. `nextBattle()` - 10 edges
7. `initGame()` - 9 edges
8. `genShop()` - 8 edges
9. `_addToBench()` - 8 edges
10. `endBattle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ensureDefaultCosmetics()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `resolveBattleRound()` --calls--> `simulate()`  [INFERRED]
  api\server.js → shared\simulate.js
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `BENCH_SLOTS()` --calls--> `botBuyPhase()`  [INFERRED]
  public\js\battle.js → public\js\bot-ai.js
- `START_GOLD()` --calls--> `botInitDuel()`  [INFERRED]
  public\js\battle.js → public\js\bot-ai.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (34): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), broadcastTavern(), calcStats(), clearMatchTimers() (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (15): applyBattleSpeed(), closeMobileMenu(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), openMobileMenu(), randCid(), rnd() (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (11): RequireAuth(), BattlePage(), fmtSP(), HeroDetail(), loadPref(), LobbyPage(), MobileHeroPage(), prefKey() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.27
Nodes (9): botApplyMerge(), botBuyPhase(), botGenShop(), botInitDuel(), botPosition(), botRunTurn(), botScoreCard(), deps() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.24
Nodes (12): _addToBench(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), _detectCombos(), genShop(), mkUnit() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (11): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), START_GOLD(), startGame() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (10): betweenIncome(), _cleanupBattleDOM(), endBattle(), hideTurnPanel(), nextBattle(), nextDuel(), renderDuelBar(), restoreFieldHp() (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.36
Nodes (8): showHeroInfo(), getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

### Community 8 - "Community 8"
Cohesion: 0.28
Nodes (9): adjacentSlots(), clearAttackArrows(), FIELD_MAX(), maxUnits(), placeUnit(), render(), renderBench(), renderField() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (8): clearFieldPlacementHints(), _dispatchBanner(), playback(), renderTurnPanel(), simulate(), startBattle(), startPhaseTimer(), stopPhaseTimer()

### Community 10 - "Community 10"
Cohesion: 0.43
Nodes (5): getItemEquipState(), ShopItemCard(), ShopListRow(), ShopView(), sortItems()

### Community 11 - "Community 11"
Cohesion: 0.4
Nodes (2): getBenchWrap(), isTouchOverBenchwrap()

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (6): applyMerge(), BENCH_SLOTS(), distinctHeroes(), retBench(), swapFieldBench(), upgradeUnit()

### Community 13 - "Community 13"
Cohesion: 0.6
Nodes (5): adjacentSlots(), resolveMagicAttack(), resolvePhysicalAttack(), roll(), simulate()

### Community 14 - "Community 14"
Cohesion: 0.83
Nodes (3): calcStatsNew(), calcStatsOld(), trunc4()

## Knowledge Gaps
- **Thin community `Community 11`** (6 nodes): `applyHighlight()`, `getBenchWrap()`, `injectLogBtn()`, `isTouchOverBenchwrap()`, `setupLog()`, `mobile.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 12`, `Community 14`?**
  _High betweenness centrality (0.263) - this node is a cross-community bridge._
- **Why does `resolveBattleRound()` connect `Community 0` to `Community 13`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `showHeroInfo()` connect `Community 7` to `Community 1`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `verifyShopPayment()`) actually correct?**
  _`log()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._