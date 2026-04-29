# Graph Report - C:\Fontes_Javascript\HorizonForge  (2026-04-28)

## Corpus Check
- 14 files · ~106,810 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 194 nodes · 342 edges · 20 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.81)
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
1. `log()` - 20 edges
2. `render()` - 20 edges
3. `startGame()` - 11 edges
4. `nextBattle()` - 11 edges
5. `startBattle()` - 10 edges
6. `initGame()` - 8 edges
7. `genShop()` - 8 edges
8. `_addToBench()` - 8 edges
9. `endBattle()` - 8 edges
10. `nextDuel()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `resolveBattleRound()` --references--> `simulate()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\shared\simulate.js
- `runDailyCleanup()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `verifyHivePayment()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `refundHiveWager()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js
- `sendHivePrize()` --calls--> `log()`  [INFERRED]
  C:\Fontes_Javascript\HorizonForge\api\server.js → C:\Fontes_Javascript\HorizonForge\public\js\battle.js

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
Cohesion: 0.06
Nodes (23): applyBattleSpeed(), applyMerge(), BENCH_SLOTS(), botApplyMerge(), botBuyPhase(), botGenShop(), botPosition(), botRunTurn() (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (14): _buildDetailBodyHTML(), _clearPayCountdown(), _ensureActiveDeck(), _loadFormations(), _loadPref(), _prefKey(), _removeFromFormation(), _renderDeckCards() (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (24): adjacentSlots(), betweenIncome(), botLearnFromBattle(), botNextBattle(), clearAttackArrows(), endBattle(), FIELD_MAX(), hideTurnPanel() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.19
Nodes (19): log(), rerollShop(), showToastBattle(), armForfeitTimer(), broadcastQueueSize(), computeSkillPowerLevels(), forfeitBattle(), hiveClient() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.21
Nodes (12): _bootBattle(), botInitDuel(), hideLoader(), initGame(), nextDuel(), pvpInit(), showLoader(), skillIcon() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (7): getSession(), HeroDetail(), loadPref(), LobbyPage(), prefKey(), roleCategory(), savePref()

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (11): _addToBench(), buyCard(), buyCombo(), canAddNewHero(), cardCost(), _detectCombos(), genShop(), mkUnit() (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.43
Nodes (8): Archer Hero Portrait, Archmage Hero Portrait, Assassin Hero Portrait, Barbarian Hero Portrait, Healer Hero Portrait, Knight Hero Portrait, Mage Hero Portrait, Paladin Hero Portrait

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (3): clrErr(), doLogin(), setErr()

### Community 9 - "Community 9"
Cohesion: 0.7
Nodes (5): Desert Arena Background, Forest Arena Background, Snow Arena Background, Hive Logo, Horizon Forge Arena Background Collection

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (2): getSession(), RequireAuth()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (2): injectLogBtn(), setupLog()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (0): 

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
Nodes (1): Payout Preference Setting (liquid/stake)

## Knowledge Gaps
- **2 isolated node(s):** `Payout Preference Setting (liquid/stake)`, `Hive Logo`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (2 nodes): `GrimoireView.jsx`, `GrimoireView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `Payout Preference Setting (liquid/stake)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 3` to `Community 0`, `Community 2`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `resolveBattleRound()` connect `Community 3` to `Community 14`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `log()` (e.g. with `verifyHivePayment()` and `refundHiveWager()`) actually correct?**
  _`log()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Payout Preference Setting (liquid/stake)`, `Hive Logo` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._