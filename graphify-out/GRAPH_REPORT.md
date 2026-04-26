# Graph Report - .  (2026-04-25)

## Corpus Check
- 18 files · ~99,837 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 223 nodes · 339 edges · 23 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Game Loop & Shop|Game Loop & Shop]]
- [[_COMMUNITY_Lobby & Matchmaking|Lobby & Matchmaking]]
- [[_COMMUNITY_Server API & Database|Server API & Database]]
- [[_COMMUNITY_Server Core Functions|Server Core Functions]]
- [[_COMMUNITY_Auth & Login|Auth & Login]]
- [[_COMMUNITY_Battle Simulation & Playback|Battle Simulation & Playback]]
- [[_COMMUNITY_Simulation Engine|Simulation Engine]]
- [[_COMMUNITY_PvP Session & State|PvP Session & State]]
- [[_COMMUNITY_Bot AI System|Bot AI System]]
- [[_COMMUNITY_Hero Portraits|Hero Portraits]]
- [[_COMMUNITY_Arena & Visual Assets|Arena & Visual Assets]]
- [[_COMMUNITY_Mobile UI Module|Mobile UI Module]]
- [[_COMMUNITY_Battle Speed & Header|Battle Speed & Header]]
- [[_COMMUNITY_Mobile Log Controls|Mobile Log Controls]]
- [[_COMMUNITY_Attack Arrow VFX|Attack Arrow VFX]]
- [[_COMMUNITY_Battle Log|Battle Log]]
- [[_COMMUNITY_Quit Modal|Quit Modal]]
- [[_COMMUNITY_Responsive Scale|Responsive Scale]]
- [[_COMMUNITY_Role Slot Config|Role Slot Config]]
- [[_COMMUNITY_Arena UI Container|Arena UI Container]]
- [[_COMMUNITY_How-To Overlay|How-To Overlay]]
- [[_COMMUNITY_Phase Timer UI|Phase Timer UI]]
- [[_COMMUNITY_Session Management|Session Management]]

## God Nodes (most connected - your core abstractions)
1. `Game State Object (G)` - 29 edges
2. `render()` - 15 edges
3. `simulate()` - 11 edges
4. `Character Map (C)` - 10 edges
5. `renderField()` - 9 edges
6. `tryMatch (Matchmaking pairing logic)` - 8 edges
7. `resolveBattleRound (Round resolution orchestrator)` - 8 edges
8. `Socket.IO Server (Real-time matchmaking)` - 8 edges
9. `Bot AI State Object (BOT)` - 8 edges
10. `activeMatches (In-memory active matches map)` - 7 edges

## Surprising Connections (you probably didn't know these)
- `evs (Battle event log array)` --semantically_similar_to--> `window.render patch (Mobile render hook)`  [INFERRED] [semantically similar]
  shared/simulate.js → public/mobile.js
- `resolveBattleRound()` --calls--> `simulate()`  [INFERRED]
  api\server.js → shared\simulate.js
- `simulate()` --references--> `resolveBattleRound (Round resolution orchestrator)`  [INFERRED]
  shared\simulate.js → api/server.js
- `computeSkillPowerLevels (Skill power level formula)` --calls--> `trunc4()`  [EXTRACTED]
  api/server.js → api\server.js
- `simulate()` --calls--> `adjacentSlots (Grid adjacency helper)`  [EXTRACTED]
  shared\simulate.js → shared/simulate.js

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

### Community 0 - "Game Loop & Shop"
Cohesion: 0.1
Nodes (38): Character Map (C), Game State Object (G), SKILL_DESCRIPTIONS (data), SkillTip (tooltip module), _addToBench(), _detectCombos(), applyMerge(), botBuyPhase() (+30 more)

### Community 1 - "Lobby & Matchmaking"
Cohesion: 0.07
Nodes (38): Battle Page (/battle.html), AI Format Selector (BO3/BO5/BO7), API: /api/characters, API: /api/config, API: /api/formations, API: api.hive.blog (condenser_api.get_accounts), AI Battle Banner Card, PvP Battle Banner Card (+30 more)

### Community 2 - "Server API & Database"
Cohesion: 0.13
Nodes (27): characters (DB table: character definitions), formations (DB table: saved player formations), horizon_forge_details (DB table: game config kv store), match_teams (DB table: submitted team boards), matches (DB table: PvP match records), activeMatches (In-memory active matches map), GET /api/characters (Character stats endpoint), GET /api/config (Game config endpoint) (+19 more)

### Community 3 - "Server Core Functions"
Cohesion: 0.2
Nodes (15): armForfeitTimer(), broadcastQueueSize(), computeSkillPowerLevels(), forfeitBattle(), hiveClient(), hiveRpc(), makeMatchId(), mirrorBoard() (+7 more)

### Community 4 - "Auth & Login"
Cohesion: 0.16
Nodes (17): Play as Guest Button, Enter with Hive Keychain Button, doLogin() Function, getSession() Function, Guest Login Handler, window.hive_keychain (Browser Extension API), Hive Username Input Field, Keychain Warning Div (+9 more)

### Community 5 - "Battle Simulation & Playback"
Cohesion: 0.16
Nodes (13): adjacentSlots(), botLearnFromBattle(), frame() (playback frame loop), playback(), previewTarget(), renderTurnPanel(), runPrepPhase(), setShopLocked() (+5 more)

### Community 6 - "Simulation Engine"
Cohesion: 0.19
Nodes (12): applyHighlight (Touch cell highlight renderer), mobileVertical (Layout orientation flag), window.render patch (Mobile render hook), adjacentSlots (Grid adjacency helper), adjacentSlots(), applyBattleStart (Start-of-battle ability applicator), buildQueue (Turn order construction), dealDmg (Damage application with kill detection) (+4 more)

### Community 7 - "PvP Session & State"
Cohesion: 0.18
Nodes (6): Game Config Object (HF), cardCost(), initGame(), pvpInit(), PvP Socket.io Connection, Session (_HF_SESSION)

### Community 8 - "Bot AI System"
Cohesion: 0.32
Nodes (8): Bot AI State Object (BOT), BOT_CFG (difficulty config), BOT_CFG_TABLE, BOT_ROLE_SLOT (bot positioning), UNIT_SCORE (bot valuation), botNextBattle(), botPosition(), botScoreCard()

### Community 9 - "Hero Portraits"
Cohesion: 0.43
Nodes (8): Archer Hero Portrait, Archmage Hero Portrait, Assassin Hero Portrait, Barbarian Hero Portrait, Healer Hero Portrait, Knight Hero Portrait, Mage Hero Portrait, Paladin Hero Portrait

### Community 10 - "Arena & Visual Assets"
Cohesion: 0.7
Nodes (5): Desert Arena Background, Forest Arena Background, Snow Arena Background, Hive Logo, Horizon Forge Arena Background Collection

### Community 11 - "Mobile UI Module"
Cohesion: 0.5
Nodes (0): 

### Community 12 - "Battle Speed & Header"
Cohesion: 0.67
Nodes (2): applyBattleSpeed(), UI: Header (#hdr)

### Community 13 - "Mobile Log Controls"
Cohesion: 1.0
Nodes (2): injectLogBtn (Log toggle button injector), setupLog (Battle log DOM injection for mobile)

### Community 14 - "Attack Arrow VFX"
Cohesion: 1.0
Nodes (2): drawAttackArrow(), UI: Attack Arrow SVG (#attack-svg)

### Community 15 - "Battle Log"
Cohesion: 1.0
Nodes (1): UI: Battle Log (#log)

### Community 16 - "Quit Modal"
Cohesion: 1.0
Nodes (1): UI: Quit Modal (#quit-overlay)

### Community 17 - "Responsive Scale"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Role Slot Config"
Cohesion: 1.0
Nodes (1): ROLE_SLOT (player positioning)

### Community 19 - "Arena UI Container"
Cohesion: 1.0
Nodes (1): UI: Arena (#arena-wrap)

### Community 20 - "How-To Overlay"
Cohesion: 1.0
Nodes (1): UI: How To Play (#howto)

### Community 21 - "Phase Timer UI"
Cohesion: 1.0
Nodes (1): UI: Phase Timer (#phase-timer)

### Community 22 - "Session Management"
Cohesion: 1.0
Nodes (1): getSession() in lobby.html

## Knowledge Gaps
- **41 isolated node(s):** `hiveRpc (Hive JSON-RPC caller)`, `mirrorBoard (Board column mirror for P2)`, `runDailyCleanup (Daily DB cleanup job)`, `requireAdmin (Admin route guard)`, `GET /api/config (Game config endpoint)` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Mobile Log Controls`** (2 nodes): `injectLogBtn (Log toggle button injector)`, `setupLog (Battle log DOM injection for mobile)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Attack Arrow VFX`** (2 nodes): `drawAttackArrow()`, `UI: Attack Arrow SVG (#attack-svg)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Battle Log`** (2 nodes): `log()`, `UI: Battle Log (#log)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Quit Modal`** (2 nodes): `openQuitModal()`, `UI: Quit Modal (#quit-overlay)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Responsive Scale`** (1 nodes): `updateScale()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Role Slot Config`** (1 nodes): `ROLE_SLOT (player positioning)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Arena UI Container`** (1 nodes): `UI: Arena (#arena-wrap)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `How-To Overlay`** (1 nodes): `UI: How To Play (#howto)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Phase Timer UI`** (1 nodes): `UI: Phase Timer (#phase-timer)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Session Management`** (1 nodes): `getSession() in lobby.html`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Game State Object (G)` connect `Game Loop & Shop` to `Bot AI System`, `Battle Simulation & Playback`, `PvP Session & State`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `simulate()` connect `Simulation Engine` to `Server API & Database`, `Server Core Functions`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `resolveBattleRound (Round resolution orchestrator)` connect `Server API & Database` to `Simulation Engine`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `Game State Object (G)` (e.g. with `simulate()` and `renderTurnPanel()`) actually correct?**
  _`Game State Object (G)` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `simulate()` (e.g. with `resolveBattleRound()` and `resolveBattleRound (Round resolution orchestrator)`) actually correct?**
  _`simulate()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `hiveRpc (Hive JSON-RPC caller)`, `mirrorBoard (Board column mirror for P2)`, `runDailyCleanup (Daily DB cleanup job)` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Loop & Shop` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._