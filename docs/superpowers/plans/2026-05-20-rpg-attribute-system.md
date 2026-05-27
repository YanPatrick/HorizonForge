# RPG Attribute System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate hero stats from hardcoded DB values to a derived RPG attribute system (STR/DEX/CON/INT/WIS/CHA) with d20-based combat resolution, preserving Level 1 balance parity via equipment offsets.

**Architecture:** Add 12 RPG columns to `characters_base`; compute HP/ATK/SPD/SP via `calcStats()` in `api/server.js`; expose `dex` and `wis` on materialized battle units; integrate `resolvePhysicalAttack` / `resolveMagicAttack` into `shared/simulate.js`; sync frontend `RPG_ATTRIBUTES` constant.

**Tech Stack:** PostgreSQL (ALTER TABLE … ADD COLUMN IF NOT EXISTS), Node.js/Express (`api/server.js`), shared battle engine (`shared/simulate.js`), React (`client/src/pages/LobbyPage.jsx`)

---

## File Map

| File | Change |
|---|---|
| `db/migrate_rpg_attrs.sql` | **Create** — ALTER TABLE + UPDATE seed for 8 heroes |
| `db/schema.sql` | **Modify** — Add new columns to `CREATE TABLE characters_base` |
| `api/server.js` | **Modify** — Add `calcStats()`, rewrite `loadStatsTable()`, rewrite `/api/characters`, update `materializeBoard()` |
| `shared/simulate.js` | **Modify** — Add d20 functions, integrate into main attack loop |
| `client/src/pages/LobbyPage.jsx` | **Modify** — Sync `RPG_ATTRIBUTES` constant with spec |

---

## Task 1: Create database migration file

**Files:**
- Create: `db/migrate_rpg_attrs.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- db/migrate_rpg_attrs.sql
-- Adds RPG attribute columns to characters_base.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.

ALTER TABLE characters_base
  ADD COLUMN IF NOT EXISTS str          SMALLINT     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS dex          SMALLINT     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS con          SMALLINT     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS int          SMALLINT     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS wis          SMALLINT     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cha          SMALLINT     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS primary_attr VARCHAR(8)   NOT NULL DEFAULT 'str',
  ADD COLUMN IF NOT EXISTS skill_attr   VARCHAR(8)   NOT NULL DEFAULT 'str',
  ADD COLUMN IF NOT EXISTS weapon_bonus SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS armor_bonus  SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spd_offset   NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sp_bonus     NUMERIC(6,3) NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Update `db/schema.sql` — replace the `characters_base` CREATE TABLE block (lines 50-59) with the new definition that includes all columns**

Replace:
```sql
CREATE TABLE IF NOT EXISTS characters_base (
  id              SERIAL       PRIMARY KEY,
  character_id    INT          NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
  max_hp          INT          NOT NULL,
  atk             NUMERIC(8,1) NOT NULL,
  atk_speed       NUMERIC(4,2) NOT NULL,
  crit_chance     NUMERIC(6,4) NOT NULL,
  crit_rate       NUMERIC(4,2) NOT NULL,
  skill_power     NUMERIC(8,4) NOT NULL
);
```

With:
```sql
CREATE TABLE IF NOT EXISTS characters_base (
  id              SERIAL       PRIMARY KEY,
  character_id    INT          NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
  max_hp          INT          NOT NULL,
  atk             NUMERIC(8,1) NOT NULL,
  atk_speed       NUMERIC(4,2) NOT NULL,
  crit_chance     NUMERIC(6,4) NOT NULL,
  crit_rate       NUMERIC(4,2) NOT NULL,
  skill_power     NUMERIC(8,4) NOT NULL,
  str             SMALLINT     NOT NULL DEFAULT 10,
  dex             SMALLINT     NOT NULL DEFAULT 10,
  con             SMALLINT     NOT NULL DEFAULT 10,
  int             SMALLINT     NOT NULL DEFAULT 10,
  wis             SMALLINT     NOT NULL DEFAULT 10,
  cha             SMALLINT     NOT NULL DEFAULT 10,
  primary_attr    VARCHAR(8)   NOT NULL DEFAULT 'str',
  skill_attr      VARCHAR(8)   NOT NULL DEFAULT 'str',
  weapon_bonus    SMALLINT     NOT NULL DEFAULT 0,
  armor_bonus     SMALLINT     NOT NULL DEFAULT 0,
  spd_offset      NUMERIC(5,2) NOT NULL DEFAULT 0,
  sp_bonus        NUMERIC(6,3) NOT NULL DEFAULT 0
);
```

Also update the comment block above the CREATE TABLE (lines 44-49) to reflect the new formula:

```sql
-- Characters base — um registro por personagem (valores base nível 1)
-- Stats de combate são calculados via calcStats():
--   max_hp      = (con * 20) + (str * 10) + armor_bonus   (× level multiplier)
--   atk         = (primary_attr * 5) + weapon_bonus        (× level multiplier)
--   atk_speed   = (dex * 0.3) + spd_offset                 (× level multiplier)
--   skill_power = (skill_attr / 2) + sp_bonus              (× level multiplier)
```

- [ ] **Step 3: Commit the empty migration + schema.sql update**

```bash
git add db/migrate_rpg_attrs.sql db/schema.sql
git commit -m "feat: add RPG attribute columns to characters_base schema"
```

---

## Task 2: Populate RPG attributes for all 8 heroes

**Files:**
- Modify: `db/migrate_rpg_attrs.sql` (append UPDATE statements)

- [ ] **Step 1: Append the UPDATE statements to the migration file**

```sql
-- Populate RPG attributes (Level 1 base values, before any multiplier)
UPDATE characters_base SET
  str=15, dex=10, con=20, int=7,  wis=10, cha=10,
  primary_attr='str', skill_attr='con',
  weapon_bonus=17, armor_bonus=142, spd_offset=0, sp_bonus=0
  WHERE character_id=(SELECT id FROM characters WHERE cid='knight');

UPDATE characters_base SET
  str=13, dex=10, con=19, int=10, wis=10, cha=10,
  primary_attr='str', skill_attr='cha',
  weapon_bonus=23, armor_bonus=137, spd_offset=0, sp_bonus=0
  WHERE character_id=(SELECT id FROM characters WHERE cid='paladin');

UPDATE characters_base SET
  str=20, dex=12, con=15, int=5,  wis=8,  cha=12,
  primary_attr='str', skill_attr='str',
  weapon_bonus=0,  armor_bonus=130, spd_offset=0, sp_bonus=0
  WHERE character_id=(SELECT id FROM characters WHERE cid='barbarian');

UPDATE characters_base SET
  str=14, dex=18, con=10, int=10, wis=10, cha=10,
  primary_attr='dex', skill_attr='dex',
  weapon_bonus=42, armor_bonus=13,  spd_offset=0, sp_bonus=0
  WHERE character_id=(SELECT id FROM characters WHERE cid='assassin');

UPDATE characters_base SET
  str=12, dex=17, con=10, int=10, wis=11, cha=12,
  primary_attr='dex', skill_attr='dex',
  weapon_bonus=60, armor_bonus=60,  spd_offset=-1.0, sp_bonus=0
  WHERE character_id=(SELECT id FROM characters WHERE cid='archer');

UPDATE characters_base SET
  str=8,  dex=10, con=10, int=20, wis=14, cha=10,
  primary_attr='int', skill_attr='int',
  weapon_bonus=70, armor_bonus=30,  spd_offset=-2.1, sp_bonus=0
  WHERE character_id=(SELECT id FROM characters WHERE cid='mage');

UPDATE characters_base SET
  str=7,  dex=10, con=10, int=20, wis=15, cha=10,
  primary_attr='int', skill_attr='int',
  weapon_bonus=88, armor_bonus=58,  spd_offset=-2.1, sp_bonus=0
  WHERE character_id=(SELECT id FROM characters WHERE cid='archmage');

UPDATE characters_base SET
  str=8,  dex=10, con=8,  int=18, wis=10, cha=18,
  primary_attr='wis', skill_attr='wis',
  weapon_bonus=2,  armor_bonus=39,  spd_offset=-1.0, sp_bonus=1.25
  WHERE character_id=(SELECT id FROM characters WHERE cid='healer');
```

- [ ] **Step 2: Run the migration against the database**

```bash
psql $DATABASE_URL -f db/migrate_rpg_attrs.sql
```

Expected: Each UPDATE should report `UPDATE 1`. Any `UPDATE 0` means the `cid` was not found — check the `characters` table.

- [ ] **Step 3: Spot-check Knight values directly in the DB**

```sql
SELECT cb.str, cb.dex, cb.con, cb.weapon_bonus, cb.armor_bonus, cb.primary_attr, cb.skill_attr
FROM characters_base cb
JOIN characters c ON c.id = cb.character_id
WHERE c.cid = 'knight';
```

Expected: `str=15, dex=10, con=20, weapon_bonus=17, armor_bonus=142, primary_attr=str, skill_attr=con`

- [ ] **Step 4: Commit**

```bash
git add db/migrate_rpg_attrs.sql
git commit -m "feat: populate RPG attributes for all 8 heroes"
```

---

## Task 3: Add calcStats() to server.js

**Files:**
- Modify: `api/server.js` — add function before `loadStatsTable` (around line 363)

The `trunc4` helper already exists at line 529. `calcStats` must be defined BEFORE `loadStatsTable` calls it.

- [ ] **Step 1: Read the file around lines 355-365 to find the exact insertion point**

Look for: `async function loadStatsTable()` — insert `calcStats` immediately before it.

- [ ] **Step 2: Insert `calcStats` before `loadStatsTable`**

```javascript
function calcStats(base, multiplier) {
  const m = Number(multiplier);
  const str = Number(base.str) * m;
  const dex = Number(base.dex) * m;
  const con = Number(base.con) * m;
  const int = Number(base.int) * m;
  const wis = Number(base.wis) * m;
  const cha = Number(base.cha) * m;
  const attrMap = { str, dex, con, int, wis, cha };
  const primaryVal = attrMap[base.primary_attr];
  const skillVal   = attrMap[base.skill_attr];
  return {
    max_hp:      Math.floor((con * 20) + (str * 10) + Number(base.armor_bonus)),
    atk:         Math.floor((primaryVal * 5) + Number(base.weapon_bonus)),
    atk_speed:   (dex * 0.3) + Number(base.spd_offset),
    skill_power: trunc4((skillVal / 2) + Number(base.sp_bonus)),
    dex_scaled:  dex,
    wis_scaled:  wis,
  };
}
```

> **Note on crit_chance / crit_rate:** These fields remain in the DB and are still fetched. The d20 system (Task 7) handles crits via Natural 20 on the die, but Archer's Precise Shot still uses `critRate` as the damage multiplier on bonus crits.

- [ ] **Step 3: Verify by adding a temporary log (remove after verification)**

After the function, temporarily add:
```javascript
// TEMP: verify calcStats L1 — remove after checking
console.log('[calcStats verify]', calcStats(
  { str:15, dex:10, con:20, int:7, wis:10, cha:10,
    primary_attr:'str', skill_attr:'con',
    weapon_bonus:17, armor_bonus:142, spd_offset:0, sp_bonus:0 }, 1.0
));
// Expected: { max_hp: 692, atk: 92, atk_speed: 3, skill_power: 10, dex_scaled: 10, wis_scaled: 10 }
```

Run the server briefly: `node api/server.js` and check the log. Then remove the temp line.

- [ ] **Step 4: Commit**

```bash
git add api/server.js
git commit -m "feat: add calcStats() RPG attribute formula to server"
```

---

## Task 4: Rewrite loadStatsTable() to use calcStats

**Files:**
- Modify: `api/server.js` lines 363-418

Replace the entire `loadStatsTable` function. The new version fetches raw RPG attrs from the DB and calls `calcStats` in JS instead of computing in SQL.

- [ ] **Step 1: Replace `loadStatsTable` with the new version**

Remove the old function (lines 363-418) and replace with:

```javascript
async function loadStatsTable() {
  const rows = await sql`
    SELECT
      c.cid,
      c.name,
      c.icon,
      c.target_type,
      ls.level,
      ls.multiplier::float,
      cb.crit_chance::float,
      cb.crit_rate::float,
      cb.str, cb.dex, cb.con, cb.int, cb.wis, cb.cha,
      cb.primary_attr,
      cb.skill_attr,
      cb.weapon_bonus,
      cb.armor_bonus,
      cb.spd_offset::float,
      cb.sp_bonus::float
    FROM characters c
    JOIN characters_base cb ON cb.character_id = c.id
    CROSS JOIN level_scale ls
    ORDER BY c.cid, ls.level
  `;
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.cid)) {
      map.set(r.cid, {
        cid: r.cid,
        name: r.name,
        icon: r.icon,
        target_type: r.target_type,
        levels: {},
      });
    }
    const st = calcStats(r, r.multiplier);
    map.get(r.cid).levels[r.level] = {
      max_hp:      st.max_hp,
      atk:         st.atk,
      atk_speed:   st.atk_speed,
      crit_chance: r.crit_chance,
      crit_rate:   r.crit_rate,
      skill_power: st.skill_power,
      dex:         st.dex_scaled,
      wis:         st.wis_scaled,
    };
  }
  return map;
}
```

> `computeSkillPowerLevels` is no longer called by `loadStatsTable`. The function remains in the file (still used by `/api/characters` during the transition). It will be removed in Task 5.

- [ ] **Step 2: Invalidate the stats cache to force a reload**

The cache TTL is 10 minutes (`STAT_CACHE_TTL_MS`). After deploying, either restart the server or temporarily set `_statsLoadedAt = 0` to bust it. In dev, just restart.

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat: rewrite loadStatsTable to derive stats from RPG attributes"
```

---

## Task 5: Rewrite /api/characters to use calcStats

**Files:**
- Modify: `api/server.js` lines 552-635

The endpoint currently computes stats in SQL and uses `computeSkillPowerLevels`. Replace with the same `calcStats` approach. Also add raw `attrs` to the response (used by the frontend RPG sheet).

- [ ] **Step 1: Replace the `/api/characters` handler**

Remove lines 552-635 and replace with:

```javascript
app.get('/api/characters', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT
        c.cid, c.name, c.icon, c.url_portrait, c.role,
        c.color_hex, c.bg_gradient, c.target_type,
        sk.skill_key, sk.name AS skill_name,
        sk.description AS skill_desc, sk.lore, sk.skill_type,
        ls.level, ls.multiplier::float,
        cb.crit_chance::float, cb.crit_rate::float,
        cb.str, cb.dex, cb.con, cb.int, cb.wis, cb.cha,
        cb.primary_attr, cb.skill_attr,
        cb.weapon_bonus, cb.armor_bonus,
        cb.spd_offset::float, cb.sp_bonus::float
      FROM characters c
      JOIN characters_base cb ON cb.character_id = c.id
      JOIN skills          sk ON sk.character_id = c.id
      CROSS JOIN level_scale ls
      ORDER BY c.id, ls.level
    `;
    const map = {};
    for (const r of rows) {
      if (!map[r.cid]) {
        map[r.cid] = {
          cid: r.cid, name: r.name, icon: r.icon,
          url_portrait: r.url_portrait || '',
          role: r.role, color_hex: r.color_hex,
          bg_gradient: r.bg_gradient, target_type: r.target_type,
          skill: {
            key: r.skill_key, name: r.skill_name,
            description: r.skill_desc, lore: r.lore, type: r.skill_type,
          },
          attrs: {
            str: Number(r.str), dex: Number(r.dex), con: Number(r.con),
            int: Number(r.int), wis: Number(r.wis), cha: Number(r.cha),
            primary: r.primary_attr, skill: r.skill_attr,
          },
          levels: {},
        };
      }
      const st = calcStats(r, r.multiplier);
      map[r.cid].levels[r.level] = {
        max_hp:      st.max_hp,
        atk:         st.atk,
        atk_speed:   st.atk_speed,
        crit_chance: r.crit_chance,
        crit_rate:   r.crit_rate,
        skill_power: st.skill_power,
      };
    }
    res.json({ ok: true, characters: Object.values(map) });
  } catch (err) {
    console.error('[/api/characters]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Remove or comment out `computeSkillPowerLevels` and `trunc4` if no longer needed**

Search for any remaining callers of `computeSkillPowerLevels`. If none remain, remove the function. `trunc4` is still used by `calcStats`, keep it.

- [ ] **Step 3: Test the endpoint — call it and verify Level 1 Knight stats**

```bash
curl http://localhost:3000/api/characters | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  const j=JSON.parse(d);
  const k=j.characters.find(c=>c.cid==='knight');
  console.log('Knight L1:', k.levels[1]);
  console.log('Knight attrs:', k.attrs);
"
```

Expected `knight.levels[1]`:
```json
{ "max_hp": 692, "atk": 92, "atk_speed": 3, "skill_power": 10 }
```

Expected `knight.attrs`:
```json
{ "str": 15, "dex": 10, "con": 20, "int": 7, "wis": 10, "cha": 10, "primary": "str", "skill": "con" }
```

- [ ] **Step 4: Verify all 5 checklist heroes**

| Hero | L1 HP | L1 ATK | L1 SPD |
|---|---|---|---|
| Knight | 692 | 92 | 3.0 |
| Barbarian | 630 | 100 | 3.6 |
| Assassin | 363 | 132 | 5.4 |
| Mage | 310 | 170 | 0.9 |
| Healer | 279 | 52 | 2.0 |

- [ ] **Step 5: Commit**

```bash
git add api/server.js
git commit -m "feat: rewrite /api/characters to use calcStats, expose raw RPG attrs"
```

---

## Task 6: Update materializeBoard() to expose dex and wis

**Files:**
- Modify: `api/server.js` lines 474-498

The simulator needs `dex` (for d20 to-hit rolls) and `wis` (for magic damage absorption) on each unit. These come from `lvStats.dex` and `lvStats.wis` which were added to the stats table in Task 4.

- [ ] **Step 1: Replace the return object in `materializeBoard`**

Find the `return { id: u.id, cid: u.cid, ...` block inside `materializeBoard` and add `dex` and `wis`:

```javascript
return {
  id: u.id,
  cid: u.cid,
  lv: u.lv,
  name: ch.name,
  ico: ch.icon,
  tp: ch.target_type,
  atk: Math.floor(lvStats.atk),
  maxHp: lvStats.max_hp,
  hp: lvStats.max_hp,
  spd: lvStats.atk_speed,
  critChance: lvStats.crit_chance,
  critRate: lvStats.crit_rate,
  skillPower: lvStats.skill_power,
  dex: lvStats.dex,
  wis: lvStats.wis,
};
```

- [ ] **Step 2: Commit**

```bash
git add api/server.js
git commit -m "feat: expose dex and wis on materialized battle units for d20 system"
```

---

## Task 7: Add d20 combat functions to simulate.js

**Files:**
- Modify: `shared/simulate.js` — insert after line 19 (`"use strict";`), before `function adjacentSlots`

- [ ] **Step 1: Update the JSDoc comment on `simulate()` (line ~39) to include `dex` and `wis`**

Change:
```javascript
 * Each unit must have: { id, cid, name, side?, lv, atk, spd, critChance,
 *   critRate, skillPower, maxHp, hp, tp (nearest|ranged|lowhp) }
```
To:
```javascript
 * Each unit must have: { id, cid, name, side?, lv, atk, spd, critChance,
 *   critRate, skillPower, maxHp, hp, tp (nearest|ranged|lowhp), dex, wis }
```

- [ ] **Step 2: Insert the d20 functions after `"use strict";` and before `function adjacentSlots`**

```javascript
// ── d20 combat system ─────────────────────────────────────────────────────────
// Physical attack: d20 + DEX modifier vs defender's d20 + DEX modifier.
// High DEX lowers crit threshold and grants fumble immunity (roll+mod can't reach 1).
// Magic attack: no evasion roll; reduced by defender WIS × 0.5.

function roll(sides) { return Math.floor(Math.random() * sides) + 1; }
function getModifier(attrValue) { return Math.floor((attrValue - 10) / 2); }

// concentrationBonus: miss-streak bonus (+2 per miss, resets on hit).
// Returns { hit, crit, damage, newConcentration }.
function resolvePhysicalAttack(attacker, defender, baseAtk, concentrationBonus = 0) {
  const rawRoll    = roll(20);
  const rollPlusDex = rawRoll + getModifier(attacker.dex);
  const attackRoll  = rollPlusDex + concentrationBonus;
  const defenseRoll = roll(20) + getModifier(defender.dex);

  // Natural 20 equivalent: rollPlusDex hits exactly 20 (or above via high DEX)
  if (rollPlusDex >= 20) {
    return { hit: true, crit: true, damage: baseAtk * 2, newConcentration: 0 };
  }
  // Fumble: rollPlusDex === 1 (only possible when DEX mod ≤ 0)
  if (rollPlusDex <= 1) {
    return { hit: false, crit: false, damage: 0, newConcentration: concentrationBonus + 2 };
  }
  // Hit
  if (attackRoll > defenseRoll) {
    return { hit: true, crit: false, damage: baseAtk, newConcentration: 0 };
  }
  // Evasion — Glancing Blow (25% damage, miss streak continues)
  return {
    hit: false, crit: false,
    damage: Math.floor(baseAtk * 0.25),
    newConcentration: concentrationBonus + 2,
  };
}

function resolveMagicAttack(defender, baseDamage) {
  const absorbed = defender.wis * 0.5;
  return { damage: Math.max(0, baseDamage - absorbed) };
}
```

> **Crit threshold note:** `rollPlusDex >= 20` means:
> - Knight (DEX=10, mod=0): only on natural 20 → ~5% crit
> - Barbarian (DEX=12*m, mod=1): natural 19+ → ~10% crit
> - Assassin (DEX=18*m, mod=4): natural 16+ → ~25% crit
> - High-level heroes crit more as DEX scales with `multiplier`.

- [ ] **Step 3: Add the magic-attacker set constant after the d20 functions**

```javascript
const MAGIC_ATTACKERS = new Set(['mage', 'archmage']);
```

- [ ] **Step 4: Commit**

```bash
git add shared/simulate.js
git commit -m "feat: add d20 combat functions (resolvePhysicalAttack, resolveMagicAttack) to simulate.js"
```

---

## Task 8: Integrate d20 into the simulate.js battle loop

**Files:**
- Modify: `shared/simulate.js`

This task has 5 sub-parts touching different sections of the `simulate()` function.

- [ ] **Step 8a: Add concentration tracking Map after boards are cloned**

Find the line `const evs = [];` (around line 55) and insert before it:

```javascript
// Tracks missed-attack streak per unit for concentration bonus (+2 per miss)
const concentration = new Map();
```

- [ ] **Step 8b: Replace the main attack block with d20 resolution**

This is the `} else {` branch starting around line 269 (the non-Healer attack path). Replace from `} else {` through `if (unit.cid === "archer" && isCrit) {` block to the closing of the Mage Fireball / Archmage Chain Lightning section (around line 344).

Find and replace this block:

```javascript
    } else {
      const t = pickTarget(unit);
      if (t && t.alive) {
        let dmg = unit.atk,
          isCrit = false;

        // Precise Shot (Archer) — extra crit chance
        const effCC =
          unit.critChance + (unit.cid === "archer" ? unit.skillPower : 0);
        if (Math.random() < effCC) {
          isCrit = true;
          dmg = Math.floor(dmg * unit.critRate);
        }
        dealDmg(unit, t, dmg, isCrit);

        if (unit.cid === "archer" && isCrit) {
          evs.push({
            type: "ability",
            uid: unit.id,
            abilName: "Precise Shot",
            tick,
            silent: true,
          });
        }

        // Fireball (Mage) — splash to adjacent tiles (+shape)
        if (unit.cid === "mage") {
          const adj = adjacentSlots(t.slot);
          const splash = foes(unit.side).filter(
            (f) => f.id !== t.id && f.alive && adj.includes(f.slot),
          );
          if (splash.length) {
            splash.forEach((f) =>
              dealDmg(unit, f, Math.floor(unit.atk * unit.skillPower)),
            );
            evs.push({
              type: "ability",
              uid: unit.id,
              abilName: "Fireball",
              tick,
              silent: true,
            });
          }
        }

        // Chain Lightning (Archmage) — hits 2nd and 3rd unit in same row
        if (unit.cid === "archmage") {
          const targetRow = Math.floor(t.slot / 3);
          const primaryCol = t.slot % 3;
          const goDeeper =
            unit.side === "p"
              ? (f) => f.slot % 3 > primaryCol
              : (f) => f.slot % 3 < primaryCol;
          const chain = foes(unit.side)
            .filter(
              (f) =>
                f.id !== t.id &&
                f.alive &&
                Math.floor(f.slot / 3) === targetRow &&
                goDeeper(f),
            )
            .sort((a, b) =>
              unit.side === "p"
                ? (a.slot % 3) - (b.slot % 3)
                : (b.slot % 3) - (a.slot % 3),
            );
          if (chain.length > 0)
            dealDmg(unit, chain[0], Math.floor(unit.atk * unit.skillPower));
          if (chain.length > 1)
            dealDmg(
              unit,
              chain[1],
              Math.floor((unit.atk * unit.skillPower) / 2),
            );
        }
      }
    }
```

With:

```javascript
    } else {
      const t = pickTarget(unit);
      if (t && t.alive) {
        let isCrit = false;
        let finalDmg = 0;

        if (MAGIC_ATTACKERS.has(unit.cid)) {
          // Magic attack: no evasion, reduced by defender WIS
          const res = resolveMagicAttack(t, unit.atk);
          finalDmg = Math.floor(res.damage);
        } else {
          // Physical attack: d20 to-hit vs defender DEX
          const cb = concentration.get(unit.id) || 0;
          const res = resolvePhysicalAttack(unit, t, unit.atk, cb);
          concentration.set(unit.id, res.newConcentration);
          isCrit = res.crit;
          finalDmg = res.damage;

          // Precise Shot (Archer) — bonus crit chance on physical hits
          if (unit.cid === "archer" && res.hit && !res.crit) {
            const effCC = unit.critChance + unit.skillPower;
            if (Math.random() < effCC) {
              isCrit = true;
              finalDmg = Math.floor(unit.atk * unit.critRate);
            }
          }
        }

        if (finalDmg > 0) dealDmg(unit, t, finalDmg, isCrit);

        if (unit.cid === "archer" && isCrit) {
          evs.push({
            type: "ability",
            uid: unit.id,
            abilName: "Precise Shot",
            tick,
            silent: true,
          });
        }

        // Fireball (Mage) — magic splash to adjacent tiles (+shape)
        if (unit.cid === "mage") {
          const adj = adjacentSlots(t.slot);
          const splash = foes(unit.side).filter(
            (f) => f.id !== t.id && f.alive && adj.includes(f.slot),
          );
          if (splash.length) {
            splash.forEach((f) => {
              const res = resolveMagicAttack(f, Math.floor(unit.atk * unit.skillPower));
              if (res.damage > 0) dealDmg(unit, f, Math.floor(res.damage), false);
            });
            evs.push({
              type: "ability",
              uid: unit.id,
              abilName: "Fireball",
              tick,
              silent: true,
            });
          }
        }

        // Chain Lightning (Archmage) — magic hits 2nd and 3rd in same row
        if (unit.cid === "archmage") {
          const targetRow = Math.floor(t.slot / 3);
          const primaryCol = t.slot % 3;
          const goDeeper =
            unit.side === "p"
              ? (f) => f.slot % 3 > primaryCol
              : (f) => f.slot % 3 < primaryCol;
          const chain = foes(unit.side)
            .filter(
              (f) =>
                f.id !== t.id &&
                f.alive &&
                Math.floor(f.slot / 3) === targetRow &&
                goDeeper(f),
            )
            .sort((a, b) =>
              unit.side === "p"
                ? (a.slot % 3) - (b.slot % 3)
                : (b.slot % 3) - (a.slot % 3),
            );
          if (chain.length > 0) {
            const r0 = resolveMagicAttack(chain[0], Math.floor(unit.atk * unit.skillPower));
            if (r0.damage > 0) dealDmg(unit, chain[0], Math.floor(r0.damage), false);
          }
          if (chain.length > 1) {
            const r1 = resolveMagicAttack(chain[1], Math.floor((unit.atk * unit.skillPower) / 2));
            if (r1.damage > 0) dealDmg(unit, chain[1], Math.floor(r1.damage), false);
          }
        }
      }
    }
```

- [ ] **Step 8c: Update Healer's attack to use d20**

Find the Healer attack block (around line 268):
```javascript
      const et = pickTarget(unit);
      if (et && et.alive) dealDmg(unit, et, unit.atk);
```

Replace with:
```javascript
      const et = pickTarget(unit);
      if (et && et.alive) {
        const cb = concentration.get(unit.id) || 0;
        const res = resolvePhysicalAttack(unit, et, unit.atk, cb);
        concentration.set(unit.id, res.newConcentration);
        if (res.damage > 0) dealDmg(unit, et, res.damage, res.crit);
      }
```

- [ ] **Step 8d: Run a quick smoke test in Node.js**

Create a temp file `test_simulate.mjs` in the project root:

```javascript
import { simulate } from './shared/simulate.js';

const knight = {
  id: 'k1', cid: 'knight', name: 'Knight', lv: 1,
  atk: 92, maxHp: 692, hp: 692, spd: 3.0,
  critChance: 0.005, critRate: 1.5, skillPower: 10,
  tp: 'nearest', dex: 10, wis: 10,
};
const mage = {
  id: 'm1', cid: 'mage', name: 'Mage', lv: 1,
  atk: 170, maxHp: 310, hp: 310, spd: 0.9,
  critChance: 0.005, critRate: 1.5, skillPower: 10,
  tp: 'ranged', dex: 10, wis: 14,
};

const pb = [knight, null, null, null, null, null, null, null, null];
const eb = [mage,   null, null, null, null, null, null, null, null];

const { winner, stats } = simulate(pb, eb);
console.log('Winner:', winner, '| Stats:', stats);
// Should complete without errors and print a winner.
```

Run: `node test_simulate.mjs`
Expected: No errors, prints `Winner: p` or `Winner: e` with stats.

Then delete the temp file.

- [ ] **Step 8e: Commit**

```bash
git add shared/simulate.js
git commit -m "feat: integrate d20 combat (resolvePhysicalAttack/resolveMagicAttack) into battle loop"
```

---

## Task 9: Sync RPG_ATTRIBUTES in frontend

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx` lines 47-56

The only discrepancy between the current frontend constant and the spec is **Archer** (`dex:20→17, wis:10→11, cha:10→12`). All other heroes already match.

- [ ] **Step 1: Update the `RPG_ATTRIBUTES` constant**

Replace the current constant with:

```javascript
const RPG_ATTRIBUTES = {
  knight:    { str: 15, dex: 10, con: 20, int:  7, wis: 10, cha: 10, primary: 'str', skill: 'con' },
  paladin:   { str: 13, dex: 10, con: 19, int: 10, wis: 10, cha: 10, primary: 'str', skill: 'cha' },
  barbarian: { str: 20, dex: 12, con: 15, int:  5, wis:  8, cha: 12, primary: 'str', skill: 'str' },
  assassin:  { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10, primary: 'dex', skill: 'dex' },
  archer:    { str: 12, dex: 17, con: 10, int: 10, wis: 11, cha: 12, primary: 'dex', skill: 'dex' },
  mage:      { str:  8, dex: 10, con: 10, int: 20, wis: 14, cha: 10, primary: 'int', skill: 'int' },
  archmage:  { str:  7, dex: 10, con: 10, int: 20, wis: 15, cha: 10, primary: 'int', skill: 'int' },
  healer:    { str:  8, dex: 10, con:  8, int: 18, wis: 10, cha: 18, primary: 'wis', skill: 'wis' },
};
```

> Optionally, if the frontend now receives `character.attrs` from the API (added in Task 5), the `RPG_ATTRIBUTES` constant can be removed and replaced with data from the API. That refactor is optional — the constant still works fine as a local fallback.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "fix: sync frontend RPG_ATTRIBUTES with spec (Archer dex 20→17)"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Build and start the server**

```bash
npm run build && npm start
```

- [ ] **Step 2: Verify /api/characters stats match the checklist**

```bash
curl http://localhost:3000/api/characters | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  const j=JSON.parse(d);
  const check = [
    ['knight',    692, 92,  3.0],
    ['barbarian', 630, 100, 3.6],
    ['assassin',  363, 132, 5.4],
    ['mage',      310, 170, 0.9],
    ['healer',    279, 52,  2.0],
  ];
  check.forEach(([cid, hp, atk, spd]) => {
    const c = j.characters.find(x => x.cid === cid);
    const l = c.levels[1];
    const ok = l.max_hp===hp && l.atk===atk && Math.abs(l.atk_speed-spd)<0.01;
    console.log(ok?'PASS':'FAIL', cid, l.max_hp, l.atk, l.atk_speed.toFixed(1));
  });
"
```

All lines should print `PASS`.

- [ ] **Step 3: Open `http://localhost:3000/battle` and run a battle in both Bot mode and PvP mode**

Confirm:
- Battle completes without JS errors in console
- Damage numbers appear on screen
- No hero is invincible (Knight should still take damage from magic attacks, just less from WIS-absorbing mages)

- [ ] **Step 4: Commit any final fixes, then open a PR**

```bash
git add -A
git commit -m "chore: RPG attribute system — final integration"
```

---

## Notes & Known Balance Changes

| Topic | Detail |
|---|---|
| **atk_speed now scales** | Old: fixed value per hero. New: `dex * 0.3 + offset` scales with level multiplier. All heroes get faster at higher levels. Relative order is preserved. |
| **skill_power magnitude change** | Old values were in 0.06–1.40 range. New values are 3–10 range (e.g. Knight CON=20 → SP=10). Skills that use `skillPower` as a fraction (Knight iron_defense, Barbarian fury) will need to be re-tuned if this produces extreme results. |
| **Archer discrepancy fixed** | Frontend had `dex:20`; spec says `dex:17`. Fixed in Task 9. |
| **Magic vs Physical** | Mage and Archmage use `resolveMagicAttack` (WIS-absorbed, no evasion). All others use `resolvePhysicalAttack` (d20 to-hit). |
| **Healer primary=WIS** | WIS=10 at L1 → ATK = (10×5)+2 = 52. Matches expected checklist value. |
| **critChance/critRate** | Still fetched from DB and used by Archer's Precise Shot bonus. Unused for other heroes (d20 handles crits via Natural 20). |
