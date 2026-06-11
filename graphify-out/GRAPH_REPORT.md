# Graph Report - HorizonForge  (2026-06-11)

## Corpus Check
- 22 files · ~326,199 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 229 nodes · 432 edges · 14 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `log()` - 32 edges
2. `render()` - 21 edges
3. `resolveBattleRound()` - 11 edges
4. `startBattle()` - 10 edges
5. `startGame()` - 10 edges
6. `nextBattle()` - 10 edges
7. `initGame()` - 9 edges
8. `deps()` - 9 edges
9. `_generateChestItem()` - 8 edges
10. `genShop()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `restoreSpeedOffsets()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `migrateRpgAttrs()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `seedTreasures()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `fixupPrecisionQuiver()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `migrateCampaign()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (48): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), broadcastTavern(), calcStats(), clearMatchTimers() (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (16): applyBattleSpeed(), closeMobileMenu(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), openMobileMenu(), playerRandCid(), randCid() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (11): RequireAuth(), BattlePage(), fmtSP(), HeroDetail(), loadPref(), LobbyPage(), MobileHeroPage(), prefKey() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (12): mkUnit(), botApplyMerge(), botBuyPhase(), botGenShop(), botInitCampaign(), botInitDuel(), botNextCampaignBattle(), botPosition() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (14): _addToBench(), applyMerge(), BENCH_SLOTS(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), _detectCombos() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.21
Nodes (13): betweenIncome(), _cleanupBattleDOM(), endBattle(), genShop(), hideTurnPanel(), nextBattle(), nextDuel(), renderDuelBar() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (5): getItemEquipState(), ShopItemCard(), ShopListRow(), ShopView(), sortItems()

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (10): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), startGame(), updateFieldLabels() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.36
Nodes (8): showHeroInfo(), getC(), getTipEl(), heroInfoHtml(), show(), showSticky(), skillTooltipHtml(), skillTooltipText()

### Community 9 - "Community 9"
Cohesion: 0.28
Nodes (9): adjacentSlots(), clearAttackArrows(), FIELD_MAX(), maxUnits(), placeUnit(), render(), renderBench(), renderField() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (8): clearFieldPlacementHints(), _dispatchBanner(), playback(), renderTurnPanel(), simulate(), startBattle(), startPhaseTimer(), stopPhaseTimer()

### Community 11 - "Community 11"
Cohesion: 0.4
Nodes (2): getBenchWrap(), isTouchOverBenchwrap()

### Community 12 - "Community 12"
Cohesion: 0.6
Nodes (5): adjacentSlots(), resolveMagicAttack(), resolvePhysicalAttack(), roll(), simulate()

### Community 13 - "Community 13"
Cohesion: 0.83
Nodes (3): calcStatsNew(), calcStatsOld(), trunc4()

## Knowledge Gaps
- **Thin community `Community 11`** (6 nodes): `applyHighlight()`, `getBenchWrap()`, `injectLogBtn()`, `isTouchOverBenchwrap()`, `setupLog()`, `mobile.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 1`, `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 10`, `Community 13`?**
  _High betweenness centrality (0.285) - this node is a cross-community bridge._
- **Why does `resolveBattleRound()` connect `Community 0` to `Community 12`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `showHeroInfo()` connect `Community 8` to `Community 1`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `verifyShopPayment()`) actually correct?**
  _`log()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._