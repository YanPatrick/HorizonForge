# Graph Report - HorizonForge  (2026-04-26)

## Corpus Check
- 3 files · ~100,203 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 39 nodes · 58 edges · 10 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.82)
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

## God Nodes (most connected - your core abstractions)
1. `resolveBattleRound()` - 6 edges
2. `sendHivePrize()` - 4 edges
3. `tryMatch()` - 4 edges
4. `armForfeitTimer()` - 4 edges
5. `forfeitBattle()` - 4 edges
6. `Paladin Hero Portrait` - 4 edges
7. `hiveClient()` - 3 edges
8. `verifyHivePayment()` - 3 edges
9. `simulate()` - 3 edges
10. `Archer Hero Portrait` - 3 edges

## Surprising Connections (you probably didn't know these)
- `simulate()` --references--> `resolveBattleRound()`  [INFERRED]
  shared\simulate.js → api\server.js
- `Archmage Hero Portrait` --conceptually_related_to--> `Mage Hero Portrait`  [INFERRED]
  public/heroes/archmage.webp → public/heroes/mage.webp
- `Archmage Hero Portrait` --conceptually_related_to--> `Paladin Hero Portrait`  [INFERRED]
  public/heroes/archmage.webp → public/heroes/paladin.webp
- `Assassin Hero Portrait` --conceptually_related_to--> `Barbarian Hero Portrait`  [INFERRED]
  public/heroes/assassin.webp → public/heroes/barbarian.webp
- `Barbarian Hero Portrait` --conceptually_related_to--> `Knight Hero Portrait`  [INFERRED]
  public/heroes/barbarian.webp → public/heroes/knight.webp

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
Cohesion: 0.43
Nodes (8): Archer Hero Portrait, Archmage Hero Portrait, Assassin Hero Portrait, Barbarian Hero Portrait, Healer Hero Portrait, Knight Hero Portrait, Mage Hero Portrait, Paladin Hero Portrait

### Community 1 - "Community 1"
Cohesion: 0.5
Nodes (2): hiveClient(), refundHiveWager()

### Community 2 - "Community 2"
Cohesion: 0.6
Nodes (5): armForfeitTimer(), forfeitBattle(), mirrorBoard(), resolveBattleRound(), sendHivePrize()

### Community 3 - "Community 3"
Cohesion: 0.7
Nodes (5): Desert Arena Background, Forest Arena Background, Snow Arena Background, Hive Logo, Horizon Forge Arena Background Collection

### Community 4 - "Community 4"
Cohesion: 0.67
Nodes (2): injectLogBtn(), setupLog()

### Community 5 - "Community 5"
Cohesion: 0.67
Nodes (3): broadcastQueueSize(), makeMatchId(), tryMatch()

### Community 6 - "Community 6"
Cohesion: 0.67
Nodes (3): hiveRpc(), sleep(), verifyHivePayment()

### Community 7 - "Community 7"
Cohesion: 1.0
Nodes (2): adjacentSlots(), simulate()

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (2): computeSkillPowerLevels(), trunc4()

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (1): Payout Preference Setting (liquid/stake)

## Knowledge Gaps
- **2 isolated node(s):** `Payout Preference Setting (liquid/stake)`, `Hive Logo`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 1`** (5 nodes): `server.js`, `hiveClient()`, `refundHiveWager()`, `requireAdmin()`, `runDailyCleanup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (4 nodes): `applyHighlight()`, `injectLogBtn()`, `setupLog()`, `mobile.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (3 nodes): `simulate.js`, `adjacentSlots()`, `simulate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (2 nodes): `computeSkillPowerLevels()`, `trunc4()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (1 nodes): `Payout Preference Setting (liquid/stake)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolveBattleRound()` connect `Community 2` to `Community 1`, `Community 7`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `simulate()` connect `Community 7` to `Community 2`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `resolveBattleRound()` (e.g. with `simulate()` and `forfeitBattle()`) actually correct?**
  _`resolveBattleRound()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Payout Preference Setting (liquid/stake)`, `Hive Logo` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._