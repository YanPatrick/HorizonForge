# Graph Report - C:\Fontes_Javascript\HorizonForge  (2026-06-14)

## Corpus Check
- 25 files · ~1,007,243 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 238 nodes · 483 edges · 20 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `log()` - 32 edges
2. `t()` - 24 edges
3. `useT()` - 21 edges
4. `render()` - 21 edges
5. `resolveBattleRound()` - 11 edges
6. `startBattle()` - 11 edges
7. `initGame()` - 10 edges
8. `startGame()` - 10 edges
9. `nextBattle()` - 10 edges
10. `endBattle()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `restoreSpeedOffsets()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `migrateRpgAttrs()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `seedTreasures()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `fixupPrecisionQuiver()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `migrateCampaign()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (48): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), broadcastTavern(), calcStats(), clearMatchTimers() (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (33): RequireAuth(), t(), BattlePage(), CampaignView(), GrimoireView(), GuestConversionModal(), useT(), fmtSP() (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (15): applyBattleSpeed(), closeMobileMenu(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), openMobileMenu(), randCid(), rnd() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (12): mkUnit(), botApplyMerge(), botBuyPhase(), botGenShop(), botInitCampaign(), botInitDuel(), botNextCampaignBattle(), botPosition() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (14): _bootBattle(), hideLoader(), initGame(), showHeroInfo(), showLoader(), skillIcon(), getC(), getTipEl() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (11): betweenIncome(), _cleanupBattleDOM(), endBattle(), hideTurnPanel(), nextBattle(), nextDuel(), renderDuelBar(), restoreFieldHp() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.28
Nodes (9): adjacentSlots(), clearAttackArrows(), FIELD_MAX(), maxUnits(), placeUnit(), render(), renderBench(), renderField() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.28
Nodes (9): _addToBench(), applyMerge(), BENCH_SLOTS(), buyCombo(), canAddNewHero(), distinctHeroes(), retBench(), swapFieldBench() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (8): buyCard(), cardCost(), _detectCombos(), genShop(), playerRandCid(), rerollShop(), _slideShop(), totalOwned()

### Community 9 - "Community 9"
Cohesion: 0.6
Nodes (5): adjacentSlots(), resolveMagicAttack(), resolvePhysicalAttack(), roll(), simulate()

### Community 10 - "Community 10"
Cohesion: 0.4
Nodes (2): getBenchWrap(), isTouchOverBenchwrap()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (6): pvpInit(), startGame(), startPhaseTimer(), stopPhaseTimer(), updateFieldLabels(), validateGameState()

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (6): clearFieldPlacementHints(), _dispatchBanner(), playback(), renderTurnPanel(), simulate(), startBattle()

### Community 13 - "Community 13"
Cohesion: 0.83
Nodes (3): calcStatsNew(), calcStatsOld(), trunc4()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

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

## Knowledge Gaps
- **Thin community `Community 14`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `en.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `pt-BR.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `release.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 11`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.379) - this node is a cross-community bridge._
- **Why does `t()` connect `Community 1` to `Community 2`, `Community 5`, `Community 4`, `Community 12`?**
  _High betweenness centrality (0.328) - this node is a cross-community bridge._
- **Why does `resolveBattleRound()` connect `Community 0` to `Community 9`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `verifyShopPayment()`) actually correct?**
  _`log()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `t()` (e.g. with `GuestConversionModal()` and `TutorialOverlay()`) actually correct?**
  _`t()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `useT()` (e.g. with `GuestConversionModal()` and `TutorialOverlay()`) actually correct?**
  _`useT()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._