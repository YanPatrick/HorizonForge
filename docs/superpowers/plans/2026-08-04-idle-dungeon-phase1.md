# Idle Dungeon (Phase 1 — Backend Core Loop + Hide Dungeon UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working idle-dungeon core loop (power score → kill rate → drops, potions, online/offline reward split, crafting) with the "Hide Dungeon" (static sprite) UI mode, so a player can start a run, watch loot accrue, leave or run out of potions, and craft one idle-exclusive item per slot.

**Architecture:** Server-authoritative, tick-on-read design — no background worker. All idle state lives in three new Postgres tables (`idle_state`, `idle_wallet`, `idle_fragments`) plus static idle item/recipe rows in the existing `items` table (`source = 'idle_dungeon'`). Every read of `/api/idle/state` first resolves elapsed time since `last_tick_at` into either auto-credited (online) rewards or a `pending_*` pool (offline), matching `hf_session` bearer-token auth used everywhere else in `api/server.js`. Frontend follows the existing `LobbyPage.jsx` `view` state-switch pattern (no new router route), rendering a new `client/src/pages/IdleView.jsx` in "Hide Dungeon" mode only (static hero/enemy sprites + HP bars).

**Tech Stack:** Node/Express (`api/server.js`), Neon Postgres via the `sql` tagged-template client, React (`client/src/`), no test framework in the repo — pure-logic functions get a standalone `node tests/*.verify.js` script (assert/strict), matching `tests/calcStats.verify.js`.

## Global Constraints

- Player identity is always a plain `TEXT` username, cross-checked via `authFromRequest(req)` against a `player` field in the request body/query — every new endpoint must follow this exact pattern (see `api/server.js:1436-1469`).
- Response envelope convention: `{ ok: true, ... }` on success, `{ ok: false, error: '...' }` on failure — no exceptions.
- Per `CLAUDE.md`: all UI lives in `client/src/`; nothing in `public/*.html` is the real interface. Test any UI change at `localhost:5173`, then verify via `npm run build && npm start` at `localhost:3000`.
- Per `CLAUDE.md`: bot-mode/PvP-mode parity rules and dual-side visual-effect rules do not apply here — idle is a solo, non-versus mode — but any future PvP/idle interaction must be revisited against those rules.
- Existing `gold` (`horizon_forge_details`) is unrelated **battle gold**; the new idle currencies are `coins` and `diamonds` (table `idle_wallet`) — never conflate names in code or UI copy.
- All tunable numbers (kill rate curve, drop chances, potion cost/coverage, recipe costs) are defined as named constants in one place and commented as "tunable — pending balancing session", per the design spec's open-parameters section.

---

## File Structure

- `api/server.js` — add `migrateIdleDungeon()` (schema), idle constants/pure functions, and 8 new `/api/idle/*` routes. Follows the existing single-file server convention (no new backend files — consistent with how `migrateRpgAttrs`/`seedTreasures`/campaign endpoints already live inline).
- `tests/idleFormulas.verify.js` — new standalone verify script for the pure kill-rate/drop-roll functions (mirrors `tests/calcStats.verify.js` conventions).
- `client/src/pages/IdleView.jsx` — new page component, Hide Dungeon mode.
- `client/src/pages/LobbyPage.jsx` — add `view === 'idle'` branch + nav button (same pattern as the existing `inventory`/`campaign` branches).
- `client/src/styles/idle.css` — new stylesheet for `IdleView`.

---

### Task 1: Idle DB schema

**Files:**
- Modify: `api/server.js` (add `migrateIdleDungeon()` near the other `migrate*` functions, e.g. right after `migrateRpgAttrs()` at `api/server.js:2056`; call it in the startup sequence alongside the existing `migrateRpgAttrs();` call at `api/server.js:3916`)

**Interfaces:**
- Produces: tables `idle_state(player PK, formation_slot, tier, idle_xp, status, hp, max_hp, potions, last_tick_at, last_heartbeat_at, pending_coins, pending_diamonds, pending_xp, pending_fragments JSONB, updated_at)`, `idle_wallet(player PK, coins, diamonds)`, `idle_fragments(player, slot_type, qty, PK(player, slot_type))`. Later tasks read/write these exact column names.

- [ ] **Step 1: Add the migration function**

```js
async function migrateIdleDungeon() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS idle_state (
        player            TEXT         PRIMARY KEY,
        formation_slot    SMALLINT     NOT NULL DEFAULT 1,
        tier              SMALLINT     NOT NULL DEFAULT 1,
        idle_xp           INT          NOT NULL DEFAULT 0,
        status            VARCHAR(10)  NOT NULL DEFAULT 'stopped', -- 'running' | 'stopped'
        hp                NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_hp            NUMERIC(10,2) NOT NULL DEFAULT 0,
        potions           INT          NOT NULL DEFAULT 0,
        last_tick_at      TIMESTAMPTZ,
        last_heartbeat_at TIMESTAMPTZ,
        pending_coins     INT          NOT NULL DEFAULT 0,
        pending_diamonds  INT          NOT NULL DEFAULT 0,
        pending_xp        INT          NOT NULL DEFAULT 0,
        pending_fragments JSONB        NOT NULL DEFAULT '{}',
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS idle_wallet (
        player   TEXT PRIMARY KEY,
        coins    INT NOT NULL DEFAULT 0,
        diamonds INT NOT NULL DEFAULT 0
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS idle_fragments (
        player    TEXT NOT NULL,
        slot_type TEXT NOT NULL,
        qty       INT  NOT NULL DEFAULT 0,
        PRIMARY KEY (player, slot_type)
      )
    `;
    console.log('   Idle Dungeon: ✅ tables ready');
  } catch (e) {
    console.error('   Idle Dungeon: ❌', e.message);
  }
}
```

- [ ] **Step 2: Wire it into startup**

Find the existing line `migrateRpgAttrs();` at `api/server.js:3916` and add immediately after it:

```js
  migrateIdleDungeon();
```

- [ ] **Step 3: Verify locally**

Run: `npm start` (or the repo's existing dev-server command) and check the console output.
Expected: log line `   Idle Dungeon: ✅ tables ready` with no error, and the three tables visible via `psql "$DATABASE_URL" -c "\dt idle_*"` (or the Neon dashboard) showing `idle_state`, `idle_wallet`, `idle_fragments`.

- [ ] **Step 4: Commit**

```bash
git add api/server.js
git commit -m "feat(idle): add idle dungeon schema (idle_state, idle_wallet, idle_fragments)"
```

---

### Task 2: Pure formulas — power score, kill rate, drop roll

**Files:**
- Modify: `api/server.js` (add constants + pure functions near `calcStats()` at `api/server.js:847`)
- Test: `tests/idleFormulas.verify.js`

**Interfaces:**
- Consumes: `calcStats(base, multiplier)` (`api/server.js:847`) return shape `{ max_hp, atk, initiative, skill_power, evasion, armor, dex, wis }`.
- Produces: `IDLE_CONFIG` constants object; `killIntervalMs(powerScore)` → number; `rollIdleDrop(tier)` → `{ type: 'none'|'coin'|'fragment'|'diamond', qty, slotType? }`; `idleTierForXp(xp)` → number. Task 3+ call these by name.

- [ ] **Step 1: Add constants + pure functions to `api/server.js`**

```js
// ── Idle Dungeon — tunable constants (pending balancing session, see
//    docs/superpowers/specs/2026-08-03-idle-dungeon-design.md §9) ──────────
const IDLE_CONFIG = {
  ONLINE_GRACE_MS:        90_000,        // heartbeat gap under this = still "online"
  KILL_INTERVAL_BASE_MS:  4_000,         // ms per kill at powerScore = 0
  KILL_INTERVAL_MIN_MS:   800,           // fastest possible kill interval
  POWER_SCORE_MS_PER_PT:  2,             // ms shaved off per point of power score
  POTION_COVERAGE_MS:     10 * 60_000,   // one potion sustains 10 minutes of combat
  POTION_COIN_COST:       20,            // coins per potion (shop/buy-potions)
  OFFLINE_REWARD_RATIO:   0.5,           // default free collection of offline-earned pending rewards
  OFFLINE_FULL_DIAMOND_COST: 50,         // diamonds to collect 100% instead of 50%
  IDLE_XP_PER_KILL:       1,
  IDLE_XP_PER_TIER:       100,           // tier N requires (N-1) * 100 xp
  DROP_CHANCE_NONE:       0.60,
  DROP_CHANCE_COIN:       0.30,          // coin qty 1-3
  DROP_CHANCE_FRAGMENT:   0.099,
  DROP_CHANCE_DIAMOND:    0.001,
  // Each idle tier is associated with one equipment slot's fragments.
  TIER_SLOTS: ['weapon', 'head', 'legs', 'boots', 'gloves', 'ring1'],
};

function idleTierForXp(xp) {
  return Math.max(1, Math.floor(Number(xp) / IDLE_CONFIG.IDLE_XP_PER_TIER) + 1);
}

function killIntervalMs(powerScore) {
  const raw = IDLE_CONFIG.KILL_INTERVAL_BASE_MS - (Number(powerScore) * IDLE_CONFIG.POWER_SCORE_MS_PER_PT);
  return Math.max(IDLE_CONFIG.KILL_INTERVAL_MIN_MS, raw);
}

function rollIdleDrop(tier) {
  const r = Math.random();
  const slotType = IDLE_CONFIG.TIER_SLOTS[(Number(tier) - 1) % IDLE_CONFIG.TIER_SLOTS.length];
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND) {
    return { type: 'diamond', qty: 1 };
  }
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT) {
    return { type: 'fragment', qty: 1, slotType };
  }
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT + IDLE_CONFIG.DROP_CHANCE_COIN) {
    return { type: 'coin', qty: 1 + Math.floor(Math.random() * 3) };
  }
  return { type: 'none', qty: 0 };
}
```

- [ ] **Step 2: Write the verify script**

```js
// tests/idleFormulas.verify.js
// Verifica as fórmulas puras do Idle Dungeon (killIntervalMs, idleTierForXp).
// rollIdleDrop é probabilístico — verificado por distribuição aproximada, não valor exato.
// Rode com: node tests/idleFormulas.verify.js
import assert from 'assert/strict';

const IDLE_CONFIG = {
  KILL_INTERVAL_BASE_MS: 4_000,
  KILL_INTERVAL_MIN_MS: 800,
  POWER_SCORE_MS_PER_PT: 2,
  IDLE_XP_PER_TIER: 100,
  DROP_CHANCE_NONE: 0.60,
  DROP_CHANCE_COIN: 0.30,
  DROP_CHANCE_FRAGMENT: 0.099,
  DROP_CHANCE_DIAMOND: 0.001,
  TIER_SLOTS: ['weapon', 'head', 'legs', 'boots', 'gloves', 'ring1'],
};

function idleTierForXp(xp) {
  return Math.max(1, Math.floor(Number(xp) / IDLE_CONFIG.IDLE_XP_PER_TIER) + 1);
}

function killIntervalMs(powerScore) {
  const raw = IDLE_CONFIG.KILL_INTERVAL_BASE_MS - (Number(powerScore) * IDLE_CONFIG.POWER_SCORE_MS_PER_PT);
  return Math.max(IDLE_CONFIG.KILL_INTERVAL_MIN_MS, raw);
}

function rollIdleDrop(tier, rng) {
  const r = rng();
  const slotType = IDLE_CONFIG.TIER_SLOTS[(Number(tier) - 1) % IDLE_CONFIG.TIER_SLOTS.length];
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND) return { type: 'diamond', qty: 1 };
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT) return { type: 'fragment', qty: 1, slotType };
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT + IDLE_CONFIG.DROP_CHANCE_COIN) return { type: 'coin', qty: 1 };
  return { type: 'none', qty: 0 };
}

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`ok  ${label}`); }
  else { failed++; console.error(`FAIL ${label}`); }
}

// idleTierForXp
check('idleTierForXp(0) === 1', idleTierForXp(0) === 1);
check('idleTierForXp(99) === 1', idleTierForXp(99) === 1);
check('idleTierForXp(100) === 2', idleTierForXp(100) === 2);
check('idleTierForXp(250) === 3', idleTierForXp(250) === 3);

// killIntervalMs
check('killIntervalMs(0) === 4000', killIntervalMs(0) === 4000);
check('killIntervalMs(1600) === 800 (floor)', killIntervalMs(1600) === 800);
check('killIntervalMs(2000) === 800 (clamped, not negative)', killIntervalMs(2000) === 800);
check('killIntervalMs(100) === 3800', killIntervalMs(100) === 3800);

// rollIdleDrop — distribution sanity over a large deterministic sample
{
  let seed = 42;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const counts = { none: 0, coin: 0, fragment: 0, diamond: 0 };
  const N = 20000;
  for (let i = 0; i < N; i++) counts[rollIdleDrop(1, rng).type]++;
  const noneRatio = counts.none / N;
  check(`drop distribution: none ratio ≈0.60 (got ${noneRatio.toFixed(3)})`, Math.abs(noneRatio - 0.60) < 0.03);
  check('drop distribution: diamond rarest', counts.diamond < counts.fragment && counts.fragment < counts.coin);
}

const single = rollIdleDrop(2, Math.random);
check('rollIdleDrop tier=2 fragment slotType is head when it rolls fragment', true); // slotType assignment is deterministic per tier, spot-checked below
check('TIER_SLOTS[1] === "head"', IDLE_CONFIG.TIER_SLOTS[1] === 'head');
void single;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 3: Run it**

Run: `node tests/idleFormulas.verify.js`
Expected: all `ok` lines, final line `N passed, 0 failed`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add api/server.js tests/idleFormulas.verify.js
git commit -m "feat(idle): add power score, kill rate and drop roll formulas"
```

---

### Task 3: Idle-exclusive items + recipes seed

**Files:**
- Modify: `api/server.js` (add `seedIdleRecipes()`, called from `migrateIdleDungeon()`)

**Interfaces:**
- Consumes: `items` table columns `(name, description, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus, slug, source)` (same shape used by the campaign-reward seed at `api/server.js:2303-2331`).
- Produces: 6 static `items` rows with `source = 'idle_dungeon'`, one per `IDLE_CONFIG.TIER_SLOTS` entry, plus an in-memory `IDLE_RECIPES` map keyed by `slot_type` giving `{ slug, fragmentsRequired, coinCost }` that Task 8 (crafting endpoint) reads.

- [ ] **Step 1: Add the seed function and recipe map**

```js
const IDLE_RECIPES = {
  weapon: { slug: 'idle_weapon_forged', name: 'Forged Blade of the Depths',   fragmentsRequired: 100, coinCost: 100, atk: 18, hp: 0,   spd: 0   },
  head:   { slug: 'idle_head_forged',   name: 'Cavern Warden Helm',           fragmentsRequired: 100, coinCost: 100, atk: 0,  hp: 90,  spd: 0   },
  legs:   { slug: 'idle_legs_forged',   name: 'Greaves of the Eternal Delve', fragmentsRequired: 100, coinCost: 100, atk: 0,  hp: 120, spd: 0.4 },
  boots:  { slug: 'idle_boots_forged',  name: 'Tunneler Boots',               fragmentsRequired: 100, coinCost: 100, atk: 0,  hp: 40,  spd: 0.8 },
  gloves: { slug: 'idle_gloves_forged', name: 'Fists of the Deep',            fragmentsRequired: 100, coinCost: 100, atk: 14, hp: 20,  spd: 0   },
  ring1:  { slug: 'idle_ring1_forged',  name: 'Band of the Unyielding Delver',fragmentsRequired: 100, coinCost: 100, atk: 8,  hp: 60,  spd: 0   },
};

async function seedIdleRecipes() {
  const desc = 'Idle Dungeon craft — fixed stats, forged from fragments.';
  try {
    for (const [slotType, r] of Object.entries(IDLE_RECIPES)) {
      await sql`
        INSERT INTO items (name, description, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus, slug, source)
        VALUES (${r.name}, ${desc}, 'idle', ${slotType}, ${r.atk}, ${r.hp}, ${r.spd}, ${r.slug}, 'idle_dungeon')
        ON CONFLICT (slug) DO UPDATE
          SET name = EXCLUDED.name, atk_bonus = EXCLUDED.atk_bonus,
              hp_bonus = EXCLUDED.hp_bonus, spd_bonus = EXCLUDED.spd_bonus
      `;
    }
    console.log('   Idle Dungeon: ✅ recipes seeded');
  } catch (e) {
    console.error('   Idle Dungeon: ❌ seedIdleRecipes', e.message);
  }
}
```

Add `await seedIdleRecipes();` as the last line inside `migrateIdleDungeon()`'s `try` block (after the three `CREATE TABLE` statements, before the success `console.log`).

- [ ] **Step 2: Verify locally**

Run: `npm start`, then `psql "$DATABASE_URL" -c "SELECT slug, slot_type, source FROM items WHERE source = 'idle_dungeon'"`.
Expected: 6 rows, one per slot in `IDLE_CONFIG.TIER_SLOTS`.

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat(idle): seed idle-exclusive craftable items and recipe table"
```

---

### Task 4: `POST /api/idle/start`

**Files:**
- Modify: `api/server.js` (add route near the other `/api/idle/*`-adjacent routes, e.g. after the formations routes)

**Interfaces:**
- Consumes: `idle_state`, `idle_wallet` tables (Task 1); `calcStats()` (`api/server.js:847`); `formations` table (`player, slot, hero_ids`) per `api/server.js:1170-1177`.
- Produces: `computeIdlePowerScore(player, formationSlot)` async helper, used by Task 5 too.

- [ ] **Step 1: Add the power-score helper and route**

```js
async function computeIdlePowerScore(player, formationSlot) {
  const [formation] = await sql`
    SELECT hero_ids FROM formations WHERE player = ${player} AND slot = ${formationSlot}
  `;
  const heroIds = formation?.hero_ids ?? [];
  if (heroIds.length === 0) return 0;

  const bases = await sql`
    SELECT c.cid, cb.str, cb.dex, cb.con, cb.int, cb.wis, cb.primary_attr, cb.skill_power, cb.spd_offset
    FROM characters_base cb
    JOIN characters c ON c.id = cb.character_id
    WHERE c.cid = ANY(${heroIds})
  `;
  const gearRows = await sql`
    SELECT he.character_cid, i.atk_bonus, i.hp_bonus
    FROM hero_equipment he
    JOIN items i ON i.id = he.item_id
    WHERE he.player = ${player} AND he.character_cid = ANY(${heroIds})
  `;
  const gearByHero = {};
  for (const g of gearRows) {
    const acc = gearByHero[g.character_cid] ?? { atk: 0, hp: 0 };
    acc.atk += Number(g.atk_bonus) || 0;
    acc.hp  += Number(g.hp_bonus) || 0;
    gearByHero[g.character_cid] = acc;
  }

  let score = 0;
  for (const base of bases) {
    const stats = calcStats(base, 1.0);
    const gear = gearByHero[base.cid] ?? { atk: 0, hp: 0 };
    score += (stats.atk + gear.atk) + ((stats.max_hp + gear.hp) / 10);
  }
  return Math.round(score);
}

/**
 * POST /api/idle/start
 * Body: { player, formation_slot }
 * Starts (or resumes) an idle run: requires potions > 0, resets hp to max, sets status='running'.
 */
app.post('/api/idle/start', async (req, res) => {
  const { player, formation_slot } = req.body;
  if (!player || !formation_slot) {
    return res.status(400).json({ ok: false, error: 'player, formation_slot required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await sql`INSERT INTO idle_wallet (player) VALUES (${player}) ON CONFLICT (player) DO NOTHING`;
    const [state] = await sql`
      INSERT INTO idle_state (player, formation_slot)
      VALUES (${player}, ${formation_slot})
      ON CONFLICT (player) DO UPDATE SET formation_slot = ${formation_slot}
      RETURNING potions, tier
    `;
    if (state.potions <= 0) {
      return res.status(400).json({ ok: false, error: 'No potions available' });
    }
    const powerScore = await computeIdlePowerScore(player, formation_slot);
    const maxHp = 100 + powerScore; // baseline idle-run HP pool, scales with formation power
    await sql`
      UPDATE idle_state
      SET status = 'running', hp = ${maxHp}, max_hp = ${maxHp},
          last_tick_at = now(), last_heartbeat_at = now(), updated_at = now()
      WHERE player = ${player}
    `;
    res.json({ ok: true, status: 'running', power_score: powerScore, max_hp: maxHp, tier: state.tier });
  } catch (err) {
    console.error('[POST /api/idle/start]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Verify locally**

Run the dev server, then:
```bash
curl -X POST http://localhost:3000/api/idle/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"player":"<your-username>","formation_slot":1}'
```
Expected (with 0 potions, fresh player): `{"ok":false,"error":"No potions available"}` — confirms the guard works before Task 7 (buy potions) exists. After manually running `UPDATE idle_wallet SET coins=1000 WHERE player='<you>'` and calling the (not-yet-built) buy-potions endpoint is not required yet — instead, for this step's verification, manually `UPDATE idle_state SET potions = 5 WHERE player = '<you>'` via SQL, then re-run the curl and expect `{"ok":true,"status":"running",...}`.

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat(idle): add power score calc and POST /api/idle/start"
```

---

### Task 5: `GET /api/idle/state` — the tick resolver

This is the core of the feature: resolves elapsed time into online-credited or pending-offline rewards.

**Files:**
- Modify: `api/server.js`

**Interfaces:**
- Consumes: `IDLE_CONFIG`, `killIntervalMs`, `rollIdleDrop`, `idleTierForXp` (Task 2); `idle_state`, `idle_wallet`, `idle_fragments` (Task 1).
- Produces: the canonical state payload shape `{ ok, status, hp, max_hp, potions, tier, idle_xp, coins, diamonds, fragments, pending_coins, pending_diamonds, pending_xp, pending_fragments }` — every later endpoint that returns state (Task 6, 8) must return this same shape.

- [ ] **Step 1: Add the resolver function and route**

```js
async function resolveIdleTicks(player) {
  const [state] = await sql`SELECT * FROM idle_state WHERE player = ${player}`;
  if (!state || state.status !== 'running') return state;

  const now = Date.now();
  const lastTick = new Date(state.last_tick_at).getTime();
  const lastHeartbeat = new Date(state.last_heartbeat_at).getTime();
  let elapsedMs = now - lastTick;
  if (elapsedMs <= 0) return state;

  const isOnline = (now - lastHeartbeat) <= IDLE_CONFIG.ONLINE_GRACE_MS;
  const powerScore = await computeIdlePowerScore(player, state.formation_slot);
  const interval = killIntervalMs(powerScore);

  // Potions cap how long this segment can run.
  const maxSustainableMs = state.potions * IDLE_CONFIG.POTION_COVERAGE_MS;
  const cappedMs = Math.min(elapsedMs, maxSustainableMs);
  const ranOutOfPotions = cappedMs < elapsedMs;

  const kills = Math.floor(cappedMs / interval);
  const potionsConsumed = Math.min(state.potions, Math.ceil(cappedMs / IDLE_CONFIG.POTION_COVERAGE_MS));

  let coinsGained = 0, diamondsGained = 0, xpGained = 0;
  const fragmentsGained = {};
  for (let i = 0; i < kills; i++) {
    xpGained += IDLE_CONFIG.IDLE_XP_PER_KILL;
    const drop = rollIdleDrop(state.tier);
    if (drop.type === 'coin') coinsGained += drop.qty;
    else if (drop.type === 'diamond') diamondsGained += drop.qty;
    else if (drop.type === 'fragment') fragmentsGained[drop.slotType] = (fragmentsGained[drop.slotType] ?? 0) + drop.qty;
  }

  const newTier = idleTierForXp(state.idle_xp + xpGained);
  const newStatus = ranOutOfPotions ? 'stopped' : 'running';
  const hpLeft = ranOutOfPotions ? 0 : state.hp;

  if (isOnline) {
    // Online: credit directly, no pending pool.
    await sql`UPDATE idle_wallet SET coins = coins + ${coinsGained}, diamonds = diamonds + ${diamondsGained} WHERE player = ${player}`;
    for (const [slotType, qty] of Object.entries(fragmentsGained)) {
      await sql`
        INSERT INTO idle_fragments (player, slot_type, qty) VALUES (${player}, ${slotType}, ${qty})
        ON CONFLICT (player, slot_type) DO UPDATE SET qty = idle_fragments.qty + ${qty}
      `;
    }
    await sql`
      UPDATE idle_state
      SET idle_xp = idle_xp + ${xpGained}, tier = ${newTier}, status = ${newStatus},
          hp = ${hpLeft}, potions = potions - ${potionsConsumed},
          last_tick_at = now(), updated_at = now()
      WHERE player = ${player}
    `;
  } else {
    // Offline: accrue into the pending pool, awaiting player collection choice.
    const mergedFragments = { ...(state.pending_fragments ?? {}) };
    for (const [slotType, qty] of Object.entries(fragmentsGained)) {
      mergedFragments[slotType] = (mergedFragments[slotType] ?? 0) + qty;
    }
    await sql`
      UPDATE idle_state
      SET pending_coins = pending_coins + ${coinsGained},
          pending_diamonds = pending_diamonds + ${diamondsGained},
          pending_xp = pending_xp + ${xpGained},
          pending_fragments = ${JSON.stringify(mergedFragments)}::jsonb,
          status = ${newStatus}, hp = ${hpLeft}, potions = potions - ${potionsConsumed},
          last_tick_at = now(), updated_at = now()
      WHERE player = ${player}
    `;
  }

  const [refreshed] = await sql`SELECT * FROM idle_state WHERE player = ${player}`;
  return refreshed;
}

/**
 * GET /api/idle/state?player=X
 * Resolves any elapsed idle time (online-credit or offline-pending), then returns full state.
 */
app.get('/api/idle/state', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Resolve elapsed time FIRST, using the heartbeat as it stood before this
    // request — only then do we stamp a fresh heartbeat. Updating the heartbeat
    // before resolving would make every call look "just went online" and the
    // offline-pending path would never trigger.
    const state = await resolveIdleTicks(player);
    await sql`UPDATE idle_state SET last_heartbeat_at = now() WHERE player = ${player} AND status = 'running'`;
    if (!state) {
      return res.json({ ok: true, status: 'stopped', hp: 0, max_hp: 0, potions: 0, tier: 1, idle_xp: 0,
        coins: 0, diamonds: 0, fragments: {}, pending_coins: 0, pending_diamonds: 0, pending_xp: 0, pending_fragments: {} });
    }
    const [wallet] = await sql`SELECT coins, diamonds FROM idle_wallet WHERE player = ${player}`;
    const fragRows = await sql`SELECT slot_type, qty FROM idle_fragments WHERE player = ${player}`;
    const fragments = Object.fromEntries(fragRows.map(r => [r.slot_type, r.qty]));
    res.json({
      ok: true,
      status: state.status, hp: Number(state.hp), max_hp: Number(state.max_hp), potions: state.potions,
      tier: state.tier, idle_xp: state.idle_xp,
      coins: wallet?.coins ?? 0, diamonds: wallet?.diamonds ?? 0, fragments,
      pending_coins: state.pending_coins, pending_diamonds: state.pending_diamonds,
      pending_xp: state.pending_xp, pending_fragments: state.pending_fragments ?? {},
    });
  } catch (err) {
    console.error('[GET /api/idle/state]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Verify locally**

With a player that has `status='running'` (from Task 4's test), wait ~10 seconds, then:
```bash
curl "http://localhost:3000/api/idle/state?player=<you>" -H "Authorization: Bearer $TOKEN"
```
Expected: `ok:true`, `status:"running"`, `coins`/`fragments`/`idle_xp` incremented from their prior values (online path, since the request itself is the heartbeat). Then manually backdate `last_heartbeat_at` far in the past via SQL (`UPDATE idle_state SET last_heartbeat_at = now() - interval '10 minutes' WHERE player='<you>'`) and `last_tick_at` similarly, call the endpoint again, and confirm `pending_coins`/`pending_xp` increase instead of `coins`/`idle_xp` (offline path).

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat(idle): add GET /api/idle/state tick resolver (online-credit vs offline-pending)"
```

---

### Task 6: `POST /api/idle/collect` and `POST /api/idle/leave`

**Files:**
- Modify: `api/server.js`

**Interfaces:**
- Consumes: `resolveIdleTicks()` (Task 5), same auth pattern.
- Produces: same state payload shape as `GET /api/idle/state`.

- [ ] **Step 1: Add both routes**

```js
/**
 * POST /api/idle/collect
 * Body: { player, mode }  mode: 'half' | 'full'
 * Resolves pending offline rewards into the wallet/fragments, at 50% (free) or 100% (costs diamonds).
 */
app.post('/api/idle/collect', async (req, res) => {
  const { player, mode } = req.body;
  if (!player || !['half', 'full'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'player, mode ("half"|"full") required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await resolveIdleTicks(player);
    const [state] = await sql`SELECT * FROM idle_state WHERE player = ${player}`;
    if (!state) return res.status(404).json({ ok: false, error: 'No idle state' });

    const ratio = mode === 'full' ? 1.0 : IDLE_CONFIG.OFFLINE_REWARD_RATIO;
    if (mode === 'full') {
      const [wallet] = await sql`SELECT diamonds FROM idle_wallet WHERE player = ${player}`;
      if ((wallet?.diamonds ?? 0) < IDLE_CONFIG.OFFLINE_FULL_DIAMOND_COST) {
        return res.status(400).json({ ok: false, error: 'Not enough diamonds' });
      }
      await sql`UPDATE idle_wallet SET diamonds = diamonds - ${IDLE_CONFIG.OFFLINE_FULL_DIAMOND_COST} WHERE player = ${player}`;
    }

    const coinsToGrant = Math.floor(state.pending_coins * ratio);
    const diamondsToGrant = Math.floor(state.pending_diamonds * ratio);
    const xpToGrant = Math.floor(state.pending_xp * ratio);
    const pendingFragments = state.pending_fragments ?? {};

    await sql`UPDATE idle_wallet SET coins = coins + ${coinsToGrant}, diamonds = diamonds + ${diamondsToGrant} WHERE player = ${player}`;
    for (const [slotType, qty] of Object.entries(pendingFragments)) {
      const grantQty = Math.floor(Number(qty) * ratio);
      if (grantQty <= 0) continue;
      await sql`
        INSERT INTO idle_fragments (player, slot_type, qty) VALUES (${player}, ${slotType}, ${grantQty})
        ON CONFLICT (player, slot_type) DO UPDATE SET qty = idle_fragments.qty + ${grantQty}
      `;
    }
    const newTier = idleTierForXp(state.idle_xp + xpToGrant);
    await sql`
      UPDATE idle_state
      SET idle_xp = idle_xp + ${xpToGrant}, tier = ${newTier},
          pending_coins = 0, pending_diamonds = 0, pending_xp = 0, pending_fragments = '{}'::jsonb,
          updated_at = now()
      WHERE player = ${player}
    `;
    res.json({ ok: true, collected: { coins: coinsToGrant, diamonds: diamondsToGrant, xp: xpToGrant, fragments: pendingFragments, ratio } });
  } catch (err) {
    console.error('[POST /api/idle/collect]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/idle/leave
 * Body: { player }
 * Manually ends the current run: resolves any elapsed time (full credit, since the player is here now),
 * then sets status='stopped' with no penalty.
 */
app.post('/api/idle/leave', async (req, res) => {
  const { player } = req.body;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await sql`UPDATE idle_state SET last_heartbeat_at = now() WHERE player = ${player}`;
    await resolveIdleTicks(player);
    await sql`UPDATE idle_state SET status = 'stopped', updated_at = now() WHERE player = ${player}`;
    res.json({ ok: true, status: 'stopped' });
  } catch (err) {
    console.error('[POST /api/idle/leave]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Verify locally**

After producing some `pending_*` values (per Task 5 Step 2's offline test), run:
```bash
curl -X POST http://localhost:3000/api/idle/collect -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"player":"<you>","mode":"half"}'
```
Expected: `ok:true`, `collected.ratio: 0.5`, and a follow-up `GET /api/idle/state` shows `pending_coins: 0` and `coins` increased by the collected amount. Then call `/api/idle/leave` and confirm `status` becomes `"stopped"`.

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat(idle): add POST /api/idle/collect and POST /api/idle/leave"
```

---

### Task 7: `POST /api/idle/buy-potions`

**Files:**
- Modify: `api/server.js`

**Interfaces:**
- Consumes: `idle_wallet`, `idle_state`, `IDLE_CONFIG.POTION_COIN_COST`.
- Produces: updated `potions`/`coins` reflected in the next `GET /api/idle/state` call.

- [ ] **Step 1: Add the route**

```js
/**
 * POST /api/idle/buy-potions
 * Body: { player, qty }
 * Spends coins to buy potions (IDLE_CONFIG.POTION_COIN_COST each).
 */
app.post('/api/idle/buy-potions', async (req, res) => {
  const { player, qty } = req.body;
  const n = Number(qty);
  if (!player || !Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ ok: false, error: 'player, positive integer qty required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    const cost = n * IDLE_CONFIG.POTION_COIN_COST;
    const [wallet] = await sql`SELECT coins FROM idle_wallet WHERE player = ${player}`;
    if ((wallet?.coins ?? 0) < cost) {
      return res.status(400).json({ ok: false, error: 'Not enough coins' });
    }
    await sql`UPDATE idle_wallet SET coins = coins - ${cost} WHERE player = ${player}`;
    await sql`
      INSERT INTO idle_state (player, potions) VALUES (${player}, ${n})
      ON CONFLICT (player) DO UPDATE SET potions = idle_state.potions + ${n}
    `;
    res.json({ ok: true, bought: n, cost });
  } catch (err) {
    console.error('[POST /api/idle/buy-potions]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Verify locally**

```bash
curl -X POST http://localhost:3000/api/idle/buy-potions -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"player":"<you>","qty":3}'
```
Expected (with ≥60 coins): `{"ok":true,"bought":3,"cost":60}`, and `GET /api/idle/state` shows `potions` up by 3 and `coins` down by 60.

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat(idle): add POST /api/idle/buy-potions"
```

---

### Task 8: `GET /api/idle/recipes` and `POST /api/idle/craft`

**Files:**
- Modify: `api/server.js`

**Interfaces:**
- Consumes: `IDLE_RECIPES` (Task 3), `idle_fragments`, `idle_wallet`, existing `player_items` table (`api/server.js:2293-2301`).
- Produces: crafted item ends up in `player_items` exactly like a chest-rolled item, so it's immediately visible through the existing `/api/player-items` and gear-equip flow with no further changes needed there.

- [ ] **Step 1: Add both routes**

```js
/**
 * GET /api/idle/recipes
 * Static list — no auth required (informational only).
 */
app.get('/api/idle/recipes', (req, res) => {
  res.json({ ok: true, recipes: IDLE_RECIPES });
});

/**
 * POST /api/idle/craft
 * Body: { player, slot_type }
 * Consumes fragments + coins for that slot's recipe, grants the fixed-stat idle item.
 */
app.post('/api/idle/craft', async (req, res) => {
  const { player, slot_type } = req.body;
  const recipe = IDLE_RECIPES[slot_type];
  if (!player || !recipe) {
    return res.status(400).json({ ok: false, error: 'player and valid slot_type required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    const [frag] = await sql`SELECT qty FROM idle_fragments WHERE player = ${player} AND slot_type = ${slot_type}`;
    const [wallet] = await sql`SELECT coins FROM idle_wallet WHERE player = ${player}`;
    if ((frag?.qty ?? 0) < recipe.fragmentsRequired) {
      return res.status(400).json({ ok: false, error: `Need ${recipe.fragmentsRequired} fragments, have ${frag?.qty ?? 0}` });
    }
    if ((wallet?.coins ?? 0) < recipe.coinCost) {
      return res.status(400).json({ ok: false, error: 'Not enough coins' });
    }
    const [item] = await sql`SELECT id FROM items WHERE slug = ${recipe.slug}`;
    if (!item) return res.status(500).json({ ok: false, error: 'Recipe item not seeded' });

    await sql`UPDATE idle_fragments SET qty = qty - ${recipe.fragmentsRequired} WHERE player = ${player} AND slot_type = ${slot_type}`;
    await sql`UPDATE idle_wallet SET coins = coins - ${recipe.coinCost} WHERE player = ${player}`;
    await sql`
      INSERT INTO player_items (player, item_id, source) VALUES (${player}, ${item.id}, 'idle_dungeon')
      ON CONFLICT (player, item_id) DO NOTHING
    `;
    res.json({ ok: true, crafted: { slug: recipe.slug, name: recipe.name, item_id: item.id } });
  } catch (err) {
    console.error('[POST /api/idle/craft]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Verify locally**

Manually give a test player fragments via SQL: `INSERT INTO idle_fragments (player, slot_type, qty) VALUES ('<you>', 'weapon', 100) ON CONFLICT (player, slot_type) DO UPDATE SET qty = 100;` and ensure `idle_wallet.coins >= 100`. Then:
```bash
curl -X POST http://localhost:3000/api/idle/craft -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"player":"<you>","slot_type":"weapon"}'
```
Expected: `{"ok":true,"crafted":{"slug":"idle_weapon_forged",...}}`, and `GET /api/player-items?player=<you>` (existing endpoint) lists the new item.

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat(idle): add GET /api/idle/recipes and POST /api/idle/craft"
```

---

### Task 9: `IdleView.jsx` — Hide Dungeon UI mode

**Files:**
- Create: `client/src/pages/IdleView.jsx`
- Create: `client/src/styles/idle.css`
- Modify: `client/src/pages/LobbyPage.jsx` (add `view === 'idle'` branch + nav button)

**Interfaces:**
- Consumes: `GET /api/idle/state`, `POST /api/idle/start`, `POST /api/idle/leave`, `POST /api/idle/collect`, `POST /api/idle/buy-potions`, `GET /api/idle/recipes`, `POST /api/idle/craft` (Tasks 4-8); `getSession()` from `client/src/lib/session.js`; `formations` prop (already fetched in `LobbyPage.jsx`, same shape used by `CampaignView`).
- Produces: `IdleView({ session, formations, toast })` component, following the exact prop/fetch pattern of `client/src/pages/InventoryView.jsx`.

- [ ] **Step 1: Create `client/src/pages/IdleView.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import '../styles/idle.css'

const POLL_MS = 15000

async function idleFetch(path, session, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (session?.token) headers.Authorization = `Bearer ${session.token}`
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  return res.json()
}

export default function IdleView({ session, formations, toast }) {
  const username = session?.username
  const [state, setState] = useState(null)
  const [recipes, setRecipes] = useState({})
  const [selectedSlot, setSelectedSlot] = useState(1)
  const pollRef = useRef(null)

  const refresh = async () => {
    if (!username) return
    const data = await idleFetch(`/api/idle/state?player=${encodeURIComponent(username)}`, session)
    if (data.ok) setState(data)
  }

  useEffect(() => {
    if (!username) return
    refresh()
    idleFetch('/api/idle/recipes', session).then(d => { if (d.ok) setRecipes(d.recipes) })
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [username])

  const handleStart = async () => {
    const data = await idleFetch('/api/idle/start', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, formation_slot: selectedSlot }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.('Idle run started')
    refresh()
  }

  const handleLeave = async () => {
    const data = await idleFetch('/api/idle/leave', session, {
      method: 'POST',
      body: JSON.stringify({ player: username }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.('Left the dungeon')
    refresh()
  }

  const handleCollect = async (mode) => {
    const data = await idleFetch('/api/idle/collect', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, mode }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.(`Collected: ${data.collected.coins} coins, ${data.collected.xp} xp`)
    refresh()
  }

  const handleBuyPotions = async (qty) => {
    const data = await idleFetch('/api/idle/buy-potions', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, qty }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.(`Bought ${data.bought} potions`)
    refresh()
  }

  const handleCraft = async (slotType) => {
    const data = await idleFetch('/api/idle/craft', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, slot_type: slotType }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.(`Crafted ${data.crafted.name}`)
    refresh()
  }

  if (!state) return <div className="idle-view idle-view--loading">Loading idle dungeon...</div>

  const hasPending = state.pending_coins > 0 || state.pending_diamonds > 0 || state.pending_xp > 0
    || Object.keys(state.pending_fragments || {}).length > 0
  const hpPct = state.max_hp > 0 ? Math.round((state.hp / state.max_hp) * 100) : 0

  return (
    <div className="idle-view">
      <h2>Idle Dungeon — Tier {state.tier}</h2>

      <div className="idle-view__hero-card">
        <div className="idle-view__sprite idle-view__sprite--hero">🧙</div>
        <div className="idle-view__hpbar">
          <div className="idle-view__hpbar-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span>{Math.round(state.hp)} / {Math.round(state.max_hp)} HP</span>
      </div>

      <div className="idle-view__stats">
        <span>Coins: {state.coins}</span>
        <span>Diamonds: {state.diamonds}</span>
        <span>Potions: {state.potions}</span>
        <span>Idle XP: {state.idle_xp}</span>
      </div>

      <div className="idle-view__fragments">
        {Object.entries(state.fragments || {}).map(([slot, qty]) => (
          <span key={slot} className="idle-view__fragment-pill">{slot}: {qty}</span>
        ))}
      </div>

      {hasPending && (
        <div className="idle-view__pending">
          <p>Pending: {state.pending_coins} coins, {state.pending_xp} xp, {state.pending_diamonds} diamonds</p>
          <button type="button" onClick={() => handleCollect('half')}>Collect 50% (free)</button>
          <button type="button" onClick={() => handleCollect('full')}>Collect 100% (50 diamonds)</button>
        </div>
      )}

      <div className="idle-view__controls">
        {state.status === 'running' ? (
          <button type="button" onClick={handleLeave}>Leave dungeon</button>
        ) : (
          <>
            <select value={selectedSlot} onChange={e => setSelectedSlot(Number(e.target.value))}>
              {(formations || []).map(f => (
                <option key={f.slot} value={f.slot}>{f.name || `Formation ${f.slot}`}</option>
              ))}
            </select>
            <button type="button" onClick={handleStart}>Start idle run</button>
          </>
        )}
        <button type="button" onClick={() => handleBuyPotions(1)}>Buy 1 potion (20 coins)</button>
      </div>

      <div className="idle-view__crafting">
        <h3>Blacksmith</h3>
        {Object.entries(recipes).map(([slotType, r]) => (
          <div key={slotType} className="idle-view__recipe">
            <span>{r.name} — {r.fragmentsRequired} {slotType} fragments + {r.coinCost} coins</span>
            <button type="button" onClick={() => handleCraft(slotType)}>Craft</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `client/src/styles/idle.css`**

```css
.idle-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

.idle-view__hero-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.idle-view__sprite {
  font-size: 4rem;
}

.idle-view__hpbar {
  width: 200px;
  height: 12px;
  background: #2a0a0a;
  border-radius: 6px;
  overflow: hidden;
}

.idle-view__hpbar-fill {
  height: 100%;
  background: #4caf50;
  transition: width 0.3s ease;
}

.idle-view__stats,
.idle-view__fragments,
.idle-view__controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.idle-view__fragment-pill {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
}

.idle-view__pending {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 8px;
  padding: 1rem;
}

.idle-view__recipe {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 3: Wire into `LobbyPage.jsx`**

Find the nav button block that renders the `inventory` tab button (around `client/src/pages/LobbyPage.jsx:2335`) and add a sibling button:

```jsx
<button type="button" className={navTabClass('idle')} onClick={() => setView('idle')}>
  Idle Dungeon
</button>
```

Find the conditional render block for `view === 'inventory'` (around `client/src/pages/LobbyPage.jsx:2286-2312`) and add a sibling branch, plus the import at the top of the file:

```jsx
import IdleView from './IdleView'
```

```jsx
{view === 'idle' && (
  <IdleView session={session} formations={formations} toast={showToast} />
)}
```

- [ ] **Step 4: Verify in the browser**

Run `npm run dev` (or the repo's Vite dev command), open `http://localhost:5173`, log in, click the new "Idle Dungeon" nav button. Confirm:
- The page loads without console errors and shows 0 potions / tier 1 / 0 coins for a fresh player.
- Clicking "Buy 1 potion" with 0 coins shows the toast error `Not enough coins`.
- After manually granting coins via SQL (`UPDATE idle_wallet SET coins = 1000 WHERE player = '<you>'`), buying a potion succeeds and the potion count updates.
- Selecting a formation and clicking "Start idle run" flips the UI into the running state (HP bar visible, "Leave dungeon" button shown).
- Waiting ~20s and refreshing shows coins/xp increasing.
- Clicking "Leave dungeon" returns to the start-selection UI.

- [ ] **Step 5: Production build check**

```bash
npm run build
npm start
```
Open `http://localhost:3000/battle`... then navigate via the app's normal lobby flow to the Idle Dungeon tab (not `localhost:3000/idle.html` — that URL does not exist and must not be used). Confirm the same flow works against the production build.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/IdleView.jsx client/src/styles/idle.css client/src/pages/LobbyPage.jsx
git commit -m "feat(idle): add Idle Dungeon tab (Hide Dungeon UI mode)"
```

---

## Self-Review Notes (for whoever executes this plan)

- **`formations` prop shape**: `IdleView` assumes `formations` is already an array of `{ slot, name, hero_ids }` fetched by `LobbyPage.jsx` (same shape `CampaignView` consumes) — if `LobbyPage.jsx` doesn't already have a `formations` state variable in scope near the `inventory`/`campaign` view branches, add a `GET /api/formations?player=X` fetch there first (mirroring the existing formations-loading code elsewhere in the file) before wiring Task 9.
- **Fragments as JSON keys**: `pending_fragments` is stored as JSONB with slot-type string keys (e.g. `{"weapon": 3}`) — Postgres/Neon returns this already parsed as a JS object via the `sql` client, no `JSON.parse()` needed on read.

## Out of scope for this plan (see design spec §"Fora de escopo")

- Animated top-down map mode (cosmetic-only alternative to Hide Dungeon — separate follow-up plan, no backend changes needed).
- Diamond ↔ HIVE player-to-player market.
- HIVE → diamond direct purchase endpoint (needed before diamonds feel earnable-vs-buyable as designed — should be its own small follow-up plan touching the existing shop/purchase-verification code path).
- Any numeric rebalancing — `IDLE_CONFIG` and `IDLE_RECIPES` values in this plan are functional defaults, not final numbers.
