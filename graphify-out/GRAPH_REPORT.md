# Graph Report - HorizonForge  (2026-05-05)

## Corpus Check
- 14 files · ~91,907 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 178 nodes · 327 edges · 15 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.81)
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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `log()` - 22 edges
2. `render()` - 20 edges
3. `startGame()` - 10 edges
4. `resolveBattleRound()` - 9 edges
5. `initGame()` - 9 edges
6. `startBattle()` - 9 edges
7. `nextBattle()` - 9 edges
8. `genShop()` - 8 edges
9. `_addToBench()` - 8 edges
10. `endBattle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  api\server.js → public\js\battle.js
- `botBuyPhase()` --calls--> `BENCH_SLOTS()`  [INFERRED]
  public\js\bot-ai.js → public\js\battle.js
- `botInitDuel()` --calls--> `START_GOLD()`  [INFERRED]
  public\js\bot-ai.js → public\js\battle.js
- `initGame()` --calls--> `init()`  [INFERRED]
  public\js\battle.js → public\js\bot-ai.js
- `botApplyMerge()` --calls--> `upgradeUnit()`  [INFERRED]
  public\js\bot-ai.js → public\js\battle.js

## Hyperedges (group relationships)
- **Hive Payment Verification and Prize Pipeline** — server_verifyHivePayment, server_refundHiveWager, server_sendHivePrize, server_hiveRpc, server_hiveClient [EXTRACTED 0.95]
- **Match Lifecycle: Queue → Pair → Pay → Battle → Prize** — server_matchQueue, server_tryMatch, server_activeMatches, server_armForfeitTimer, server_resolveBattleRound, server_forfeitBattle, server_socketio [EXTRACTED 0.95]
- **Battle Simulation Core (simulate.js)** — simulate_simulate, simulate_dealDmg, simulate_applyBattleStart, simulate_pickTarget, simulate_buildQueue, simulate_adjacentSlots, simulate_evs, simulate_umap [EXTRACTED 1.00]
- **Mobile UX Enhancements Layer** — mobile_mobileVertical, mobile_applyHighlight, mobile_setupLog, mobile_injectLogBtn, mobile_renderPatch [EXTRACTED 0.90]
- **NeonDB Schema (all tables)** — db_matches, db_match_teams, db_characters, db_formations, db_horizon_forge_details [EXTRACTED 1.00]
- **Round Resolution: simulate + mirror + scores + prize** — server_resolveBattleRound, server_mirrorBoard, simulate_simulate, server_sendHivePrize, server_armForfeitTimer [EXTRACTED 0.95]
- **Battle Simulation Engine** — battle_simulate, battle_playback, battle_frame_fn, battle_runPrepPhase, battle_endBattle [EXTRACTED 0.95]
- **Bot AI System** — battle_BOT, battle_botRunTurn, battle_botBuyPhase, battle_botPosition, battle_botScoreCard, battle_botLearnFromBattle, battle_botInitDuel, battle_botNextBattle, battle_BOT_CFG, battle_BOT_CFG_TABLE, battle_UNIT_SCORE, battle_BOT_ROLE_SLOT [EXTRACTED 0.95]
- **Shop & Economy System** — battle_genShop, battle_rerollShop, battle_buyCard, battle_buyCombo, battle__addToBench, battle__detectCombos, battle_applyMerge, battle_cardCost, battle_betweenIncome, battle_G [EXTRACTED 0.95]
- **PvP Mode System** — battle_pvpInit, battle_pvpFlipResult, battle_mirrorBoard, battle_pvp_socket [EXTRACTED 0.95]
- **Render System** — battle_render, battle_renderField, battle_renderShop, battle_renderBench, battle_renderDuelBar, battle_renderTurnPanel, battle_updateHdr, battle_setBanner [EXTRACTED 0.95]
- **Skill Tooltip System** — battle_SkillTip, battle_generateHeroInfoHtml, battle_generateSkillTooltipHtml, battle_SKILL_DESCRIPTIONS [EXTRACTED 0.92]
- **Game Flow Control** — battle_startGame, battle_startBattle, battle_endBattle, battle_nextBattle, battle_nextDuel, battle_showDuelResult [EXTRACTED 0.95]
- **Unit Factory & Merging** — battle_mkUnit, battle_upgradeUnit, battle_applyMerge, battle_C [EXTRACTED 0.92]
- **Arena UI Components** — battle_ui_pfield, battle_ui_efield, battle_ui_turnpanel, battle_ui_arena, battle_ui_attack_svg [EXTRACTED 0.90]
- **Bottom Zone UI Components** — battle_ui_barracks, battle_ui_shop, battle_ui_log, battle_ui_phase_timer [EXTRACTED 0.90]
- **Combat VFX & Animation** — battle_frame_fn, battle_runPrepPhase, battle_drawAttackArrow, battle_clearAttackArrows [INFERRED 0.85]
- **Core Game State** — battle_G, battle_BOT, battle_HF, battle_C [EXTRACTED 0.95]
- **Horizon Forge Hero Portrait Set - Shared Visual Style** —  [EXTRACTED 1.00]
- **Arcane / Magic User Character Cluster** —  [EXTRACTED 1.00]
- **Heavy Armored Warrior Character Cluster** —  [EXTRACTED 1.00]
- **Female Light Armor Character Cluster** —  [EXTRACTED 0.90]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (28): log(), showToastBattle(), armForfeitTimer(), authFromRequest(), broadcastQueueSize(), computeSkillPowerLevels(), forfeitBattle(), getStatsTable() (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (8): adjacentSlots(), enterFS(), onFirstTouch(), openMobileMenu(), playback(), renderField(), renderTurnPanel(), toggleMobileMenu()

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (22): betweenIncome(), clearAttackArrows(), endBattle(), FIELD_MAX(), hideTurnPanel(), maxUnits(), nextBattle(), nextDuel() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.29
Nodes (8): botApplyMerge(), botBuyPhase(), botGenShop(), botInitDuel(), botPosition(), botRunTurn(), deps(), makeInitialBOT()

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (7): getSession(), HeroDetail(), loadPref(), LobbyPage(), prefKey(), roleCategory(), savePref()

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (11): _bootBattle(), hideLoader(), initGame(), pvpInit(), showLoader(), skillIcon(), START_GOLD(), startGame() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.28
Nodes (9): _addToBench(), applyMerge(), BENCH_SLOTS(), buyCombo(), canAddNewHero(), _detectCombos(), distinctHeroes(), retBench() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (8): genShop(), mkUnit(), playerRandCid(), randCid(), rerollShop(), rnd(), shuffle(), _slideShop()

### Community 8 - "Community 8"
Cohesion: 0.43
Nodes (8): Archer Hero Portrait, Archmage Hero Portrait, Assassin Hero Portrait, Barbarian Hero Portrait, Healer Hero Portrait, Knight Hero Portrait, Mage Hero Portrait, Paladin Hero Portrait

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (5): applyBattleSpeed(), getBattleFrameDelay(), getBattleFxDuration(), getBattleSpeedMultiplier(), toggleBattleSpeed()

### Community 10 - "Community 10"
Cohesion: 0.7
Nodes (5): Desert Arena Background, Forest Arena Background, Snow Arena Background, Hive Logo, Horizon Forge Arena Background Collection

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (2): getSession(), RequireAuth()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (2): injectLogBtn(), setupLog()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (3): buyCard(), cardCost(), totalOwned()

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (1): Payout Preference Setting (liquid/stake)

## Knowledge Gaps
- **2 isolated node(s):** `Payout Preference Setting (liquid/stake)`, `Hive Logo`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 11`** (4 nodes): `App()`, `getSession()`, `RequireAuth()`, `App.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (4 nodes): `applyHighlight()`, `injectLogBtn()`, `setupLog()`, `mobile.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `Payout Preference Setting (liquid/stake)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 0` to `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 7`, `Community 15`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Why does `initGame()` connect `Community 5` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `refundHiveWager()`) actually correct?**
  _`log()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `log()`) actually correct?**
  _`resolveBattleRound()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Payout Preference Setting (liquid/stake)`, `Hive Logo` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._