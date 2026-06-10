# Equipment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a full equipment system — DB tables, gear API, PvP and bot battle integration, and Formation UI gear panel with real data from the database.

**Architecture:** Three new DB tables (`items`, `character_starter_loadout`, `hero_equipment`) hold the item catalog and per-player loadout. Starter gear is lazily initialized on first API call per player. Equipment bonuses (flat ATK/HP/SPD offsets) are applied server-side in `materializeBoard()` for PvP and client-side via `window.HF_gear` for bot mode.

**Tech Stack:** Node.js/Express, Neon serverless Postgres (`sql` tagged-template), React (LobbyPage.jsx), vanilla JS (battle.js/BattlePage.jsx)

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `db/migrate_equipment.sql` | 3 new tables + 24 seed items |
| Modify | `api/server.js` | `ensureStarterGear`, `getEquipmentBonuses`, 3 gear routes, updated `materializeBoard`, updated `resolveBattleRound` |
| Modify | `client/src/pages/BattlePage.jsx` | Fetch gear, set `window.HF_gear`, clean up on unmount |
| Modify | `public/js/battle.js` | Apply `window.HF_gear` to player board before bot simulate |
| Modify | `client/src/pages/LobbyPage.jsx` | Fetch gear state, update HeroDetail GEAR tab, StatsPanel, RPG sheet |

---

## Task 1: DB — Create tables and seed starter items

**Files:**
- Create: `db/migrate_equipment.sql`

- [ ] **Step 1: Write the migration file**

Create `db/migrate_equipment.sql` with the following content:

```sql
-- ============================================================
-- Equipment System Migration
-- Run: psql $DATABASE_URL -f db/migrate_equipment.sql
-- Idempotent — safe to re-run.
-- NOTE: Do NOT zero weapon_bonus here. That happens in Task 7
--       after all gear logic is verified end-to-end.
-- ============================================================

-- ── 1. Items catalog ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  description TEXT,
  rarity      VARCHAR(20)   NOT NULL DEFAULT 'common',
  slot_type   VARCHAR(20)   NOT NULL,
  atk_bonus   INT           NOT NULL DEFAULT 0,
  hp_bonus    INT           NOT NULL DEFAULT 0,
  spd_bonus   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  CHECK (rarity IN ('starter','common','rare','epic','legendary')),
  CHECK (slot_type IN ('amulet','helm','special','weapon','chest','offhand',
                       'belt','legs','gloves','ring1','boots','ring2'))
);

-- ── 2. Character starter loadout ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS character_starter_loadout (
  character_cid  VARCHAR(30)  NOT NULL REFERENCES characters(cid) ON DELETE CASCADE,
  slot_type      VARCHAR(20)  NOT NULL,
  item_id        INT          NOT NULL REFERENCES items(id),
  PRIMARY KEY (character_cid, slot_type)
);

-- ── 3. Hero equipment (per player) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hero_equipment (
  player          TEXT         NOT NULL,
  character_cid   VARCHAR(30)  NOT NULL REFERENCES characters(cid) ON DELETE CASCADE,
  slot_type       VARCHAR(20)  NOT NULL,
  item_id         INT          NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  equipped_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (player, character_cid, slot_type)
);

-- ── 4. Seed 24 starter items ─────────────────────────────────────────────────
INSERT INTO items (name, description, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus) VALUES
  ('Short Steel Sword',  'A well-balanced sword for disciplined fighters.',          'starter', 'weapon',   12,   0, 0),
  ('Plate Cuirass',      'Heavy armor forged for frontline protection.',             'starter', 'chest',     0, 250, 0),
  ('Tower Shield',       'An imposing shield that absorbs tremendous blows.',        'starter', 'offhand',   0, 122, 0),
  ('Silver Hammer',      'A blessed hammer that strikes with divine purpose.',       'starter', 'weapon',    8,   0, 0),
  ('Heavy Chainmail',    'Interlocked rings of hardened metal.',                     'starter', 'chest',     0, 300, 0),
  ('Seal of Devotion',   'A ring bearing the sigil of the holy order.',              'starter', 'ring1',     0, 107, 0),
  ('Hand Axe',           'A brutal one-handed axe favored by berserkers.',           'starter', 'weapon',    7,   0, 0),
  ('Bear Pelt',          'Thick fur that keeps the wearer warm and resilient.',      'starter', 'chest',     0, 250, 0),
  ('Horned Helm',        'A fearsome helmet carved from mountain beast horns.',      'starter', 'helm',      0, 100, 0),
  ('Willow Staff',       'A supple staff channeling volatile arcane energy.',        'starter', 'weapon',   50,   0, 0),
  ('Linen Tunic',        'Lightweight cloth enchanted to resist minor flames.',      'starter', 'chest',     0,  30, 0),
  ('Crystal Orb',        'A translucent orb that amplifies spellcasting.',           'starter', 'amulet',   10,  10, 0),
  ('Longbow',            'A tall recurve bow with exceptional range.',               'starter', 'weapon',   25,   0, 0),
  ('Leather Armor',      'Supple leather fitted to allow free movement.',            'starter', 'chest',     0, 100, 0),
  ('Precision Quiver',   'A quiver enchanted to guide arrows to their mark.',        'starter', 'special',   5,  60, 0),
  ('Serrated Dagger',    'A cruel blade designed to tear flesh on withdrawal.',      'starter', 'weapon',   18,   0, 0),
  ('Cloth Cape',         'A thin cape that blends into shadow.',                     'starter', 'chest',     0,  30, 0),
  ('Hidden Boot Knife',  'A concealed blade tucked into a reinforced boot.',         'starter', 'boots',     4,  23, 0),
  ('Runic Staff',        'Ancient runes carved into petrified elderwood.',           'starter', 'weapon',   60,   0, 0),
  ('Council Mantle',     'Formal robes woven from threads of pure mana.',            'starter', 'chest',     0,  50, 0),
  ('Ring of Infinity',   'A ring that feeds on ambient magical energy.',             'starter', 'ring1',    10,  27, 0),
  ('Staff of Rest',      'A heavy staff that slows the wielder but heals allies.',   'starter', 'weapon',  -40,   0, 0),
  ('Silk Vestments',     'Flowing silk robes blessed with restorative prayers.',     'starter', 'chest',     0,  20, 0),
  ('Blessed Rosary',     'Prayer beads humming with gentle healing energy.',         'starter', 'amulet',    2,   9, 0)
ON CONFLICT DO NOTHING;

-- ── 5. Seed character_starter_loadout ────────────────────────────────────────
INSERT INTO character_starter_loadout (character_cid, slot_type, item_id)
SELECT v.cid, i.slot_type, i.id
FROM (VALUES
  ('knight',    'Short Steel Sword'),
  ('knight',    'Plate Cuirass'),
  ('knight',    'Tower Shield'),
  ('paladin',   'Silver Hammer'),
  ('paladin',   'Heavy Chainmail'),
  ('paladin',   'Seal of Devotion'),
  ('barbarian', 'Hand Axe'),
  ('barbarian', 'Bear Pelt'),
  ('barbarian', 'Horned Helm'),
  ('mage',      'Willow Staff'),
  ('mage',      'Linen Tunic'),
  ('mage',      'Crystal Orb'),
  ('archer',    'Longbow'),
  ('archer',    'Leather Armor'),
  ('archer',    'Precision Quiver'),
  ('assassin',  'Serrated Dagger'),
  ('assassin',  'Cloth Cape'),
  ('assassin',  'Hidden Boot Knife'),
  ('archmage',  'Runic Staff'),
  ('archmage',  'Council Mantle'),
  ('archmage',  'Ring of Infinity'),
  ('healer',    'Staff of Rest'),
  ('healer',    'Silk Vestments'),
  ('healer',    'Blessed Rosary')
) AS v(cid, item_name)
JOIN items i ON i.name = v.item_name
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Run the migration**

```bash
psql $DATABASE_URL -f db/migrate_equipment.sql
```

Expected output: `CREATE TABLE` × 3, `INSERT 0 24`, `INSERT 0 24` (or `INSERT 0 0` if re-run).

- [ ] **Step 3: Verify tables and seed**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM items;"
# Expected: 24

psql $DATABASE_URL -c "SELECT COUNT(*) FROM character_starter_loadout;"
# Expected: 24

psql $DATABASE_URL -c "SELECT character_cid, slot_type, i.name FROM character_starter_loadout csl JOIN items i ON i.id = csl.item_id ORDER BY character_cid, slot_type;"
# Expected: 24 rows mapping each hero to their 3 starter items
```

- [ ] **Step 4: Commit**

```bash
git add db/migrate_equipment.sql
git commit -m "feat: add equipment DB migration (items, character_starter_loadout, hero_equipment tables + 24 starter items)"
```

---

## Task 2: API — ensureStarterGear helper + GET /api/gear

**Files:**
- Modify: `api/server.js` (add after the `// ── Routes ──` section, near the formations routes)

- [ ] **Step 1: Add `ensureStarterGear` helper to `api/server.js`**

Find the comment `// ── Routes ────────────────────────────────────────────────` in `api/server.js`. Just BEFORE that line, add:

```js
// ── Equipment helpers ──────────────────────────────────────────────────────

// Lazily inserts starter items into hero_equipment for any hero+slot
// not yet initialized for this player. Idempotent — safe to call multiple times.
async function ensureStarterGear(player) {
  await sql`
    INSERT INTO hero_equipment (player, character_cid, slot_type, item_id)
    SELECT ${player}, csl.character_cid, csl.slot_type, csl.item_id
    FROM character_starter_loadout csl
    WHERE NOT EXISTS (
      SELECT 1 FROM hero_equipment he
      WHERE he.player     = ${player}
        AND he.character_cid = csl.character_cid
        AND he.slot_type     = csl.slot_type
    )
    ON CONFLICT DO NOTHING
  `;
}

// Returns { [cid]: { atk_bonus, hp_bonus, spd_bonus } } for all heroes
// that have at least one item equipped.
async function getEquipmentBonuses(player) {
  await ensureStarterGear(player);
  const rows = await sql`
    SELECT he.character_cid,
           SUM(i.atk_bonus)::int          AS atk_bonus,
           SUM(i.hp_bonus)::int           AS hp_bonus,
           SUM(i.spd_bonus)::float        AS spd_bonus
    FROM hero_equipment he
    JOIN items i ON i.id = he.item_id
    WHERE he.player = ${player}
    GROUP BY he.character_cid
  `;
  const map = {};
  for (const r of rows) {
    map[r.character_cid] = {
      atk_bonus: Number(r.atk_bonus) || 0,
      hp_bonus:  Number(r.hp_bonus)  || 0,
      spd_bonus: Number(r.spd_bonus) || 0,
    };
  }
  return map;
}
```

- [ ] **Step 2: Add `GET /api/gear` route to `api/server.js`**

Find the `app.get('/api/formations'` route. Add the following route BEFORE it:

```js
/**
 * GET /api/gear?player=X
 * Returns equipped gear (all slots, all heroes) for the given player.
 * Lazily initializes starter items on first call.
 * Response: { ok, gear: { [cid]: { slots: { [slot_type]: itemObj }, totals: { atk_bonus, hp_bonus, spd_bonus } } } }
 */
app.get('/api/gear', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await ensureStarterGear(player);
    const rows = await sql`
      SELECT he.character_cid, he.slot_type,
             i.id, i.name, i.description, i.rarity,
             i.atk_bonus, i.hp_bonus, i.spd_bonus
      FROM hero_equipment he
      JOIN items i ON i.id = he.item_id
      WHERE he.player = ${player}
      ORDER BY he.character_cid, he.slot_type
    `;
    const gear = {};
    for (const r of rows) {
      if (!gear[r.character_cid]) {
        gear[r.character_cid] = {
          slots: {},
          totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 },
        };
      }
      gear[r.character_cid].slots[r.slot_type] = {
        id:          r.id,
        name:        r.name,
        description: r.description,
        rarity:      r.rarity,
        slot_type:   r.slot_type,
        atk_bonus:   Number(r.atk_bonus),
        hp_bonus:    Number(r.hp_bonus),
        spd_bonus:   Number(r.spd_bonus),
      };
      gear[r.character_cid].totals.atk_bonus += Number(r.atk_bonus);
      gear[r.character_cid].totals.hp_bonus  += Number(r.hp_bonus);
      gear[r.character_cid].totals.spd_bonus += Number(r.spd_bonus);
    }
    res.json({ ok: true, gear });
  } catch (err) {
    console.error('[GET /api/gear]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 3: Start the server and verify the endpoint**

```bash
npm start
```

In a separate terminal (replace `TOKEN` with a real Bearer token from a logged-in session and `USER` with that user's username):

```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/gear?player=USER"
```

Expected: JSON with `ok: true` and `gear` object containing 8 heroes, each with `slots` (3 items) and `totals` (summed bonuses). Check that knight's totals include `atk_bonus: 12`, `hp_bonus: 372`.

- [ ] **Step 4: Commit**

```bash
git add api/server.js
git commit -m "feat: add ensureStarterGear, getEquipmentBonuses helpers and GET /api/gear endpoint"
```

---

## Task 3: API — PUT /api/gear/equip and POST /api/gear/unequip

**Files:**
- Modify: `api/server.js` (add after `GET /api/gear`)

- [ ] **Step 1: Add `PUT /api/gear/equip` route**

Immediately after the `GET /api/gear` route, add:

```js
/**
 * PUT /api/gear/equip
 * Body: { player, character_cid, slot_type, item_id }
 * Equips an item into a hero's slot (insert or replace).
 */
app.put('/api/gear/equip', async (req, res) => {
  const { player, character_cid, slot_type, item_id } = req.body;
  if (!player || !character_cid || !slot_type || !item_id) {
    return res.status(400).json({ ok: false, error: 'player, character_cid, slot_type, item_id required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Verify item exists
    const [item] = await sql`SELECT id, name, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus FROM items WHERE id = ${item_id}`;
    if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });

    await sql`
      INSERT INTO hero_equipment (player, character_cid, slot_type, item_id)
      VALUES (${player}, ${character_cid}, ${slot_type}, ${item_id})
      ON CONFLICT (player, character_cid, slot_type)
      DO UPDATE SET item_id = ${item_id}, equipped_at = now()
    `;
    res.json({ ok: true, slot: { ...item, slot_type } });
  } catch (err) {
    console.error('[PUT /api/gear/equip]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 2: Add `POST /api/gear/unequip` route**

Immediately after `PUT /api/gear/equip`, add:

```js
/**
 * POST /api/gear/unequip
 * Body: { player, character_cid, slot_type }
 * - If this slot has a starter item in character_starter_loadout:
 *     - Current item IS starter → 403 (cannot unequip starter)
 *     - Current item is NOT starter → revert to starter item
 * - If slot has no starter → delete the row (slot becomes empty)
 */
app.post('/api/gear/unequip', async (req, res) => {
  const { player, character_cid, slot_type } = req.body;
  if (!player || !character_cid || !slot_type) {
    return res.status(400).json({ ok: false, error: 'player, character_cid, slot_type required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Check current equipped item
    const [current] = await sql`
      SELECT he.item_id, i.rarity
      FROM hero_equipment he
      JOIN items i ON i.id = he.item_id
      WHERE he.player = ${player} AND he.character_cid = ${character_cid} AND he.slot_type = ${slot_type}
    `;
    if (!current) return res.status(404).json({ ok: false, error: 'No item equipped in this slot' });

    // Check if this slot has a starter default
    const [starter] = await sql`
      SELECT item_id FROM character_starter_loadout
      WHERE character_cid = ${character_cid} AND slot_type = ${slot_type}
    `;

    if (starter) {
      if (current.item_id === starter.item_id) {
        return res.status(403).json({ ok: false, error: 'Cannot unequip a starter item' });
      }
      // Revert to starter
      await sql`
        UPDATE hero_equipment
        SET item_id = ${starter.item_id}, equipped_at = now()
        WHERE player = ${player} AND character_cid = ${character_cid} AND slot_type = ${slot_type}
      `;
      const [starterItem] = await sql`SELECT id, name, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus FROM items WHERE id = ${starter.item_id}`;
      return res.json({ ok: true, slot: starterItem });
    }

    // No starter for this slot — empty it
    await sql`
      DELETE FROM hero_equipment
      WHERE player = ${player} AND character_cid = ${character_cid} AND slot_type = ${slot_type}
    `;
    res.json({ ok: true, slot: null });
  } catch (err) {
    console.error('[POST /api/gear/unequip]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

- [ ] **Step 3: Verify equip endpoint with curl**

```bash
# Get the starter weapon item_id for knight (from the items table — typically id=1)
# Then try replacing it with itself (should succeed):
curl -X PUT http://localhost:3000/api/gear/equip \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"player":"USER","character_cid":"knight","slot_type":"weapon","item_id":1}'
# Expected: { ok: true, slot: { id:1, name:"Short Steel Sword", ... } }
```

- [ ] **Step 4: Verify unequip endpoint with curl**

```bash
# Trying to unequip a starter should fail:
curl -X POST http://localhost:3000/api/gear/unequip \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"player":"USER","character_cid":"knight","slot_type":"weapon"}'
# Expected: { ok: false, error: "Cannot unequip a starter item" }

# Trying to unequip an empty non-starter slot:
curl -X POST http://localhost:3000/api/gear/unequip \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"player":"USER","character_cid":"knight","slot_type":"belt"}'
# Expected: { ok: false, error: "No item equipped in this slot" }
```

- [ ] **Step 5: Commit**

```bash
git add api/server.js
git commit -m "feat: add PUT /api/gear/equip and POST /api/gear/unequip endpoints"
```

---

## Task 4: API — Update materializeBoard() and resolveBattleRound() for PvP equipment

**Files:**
- Modify: `api/server.js`

- [ ] **Step 1: Update `materializeBoard` signature and body**

Find the function `async function materializeBoard(board)` in `api/server.js`. Replace it entirely with:

```js
// Build a simulator-ready board by joining the trusted (cid, lv, id) tuple
// with authoritative stats from the database, then applying flat equipment bonuses.
async function materializeBoard(board, gearTotals = {}) {
  const stats = await getStatsTable();
  return board.map((u) => {
    if (!u) return null;
    const ch = stats.get(u.cid);
    if (!ch) throw new Error(`Unknown character cid: ${u.cid}`);
    const lvStats = ch.levels[u.lv];
    if (!lvStats) throw new Error(`No stats for ${u.cid} at level ${u.lv}`);
    const eq = gearTotals[u.cid] ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
    const maxHp = lvStats.max_hp + eq.hp_bonus;
    return {
      id:         u.id,
      cid:        u.cid,
      lv:         u.lv,
      name:       ch.name,
      ico:        ch.icon,
      tp:         ch.target_type,
      atk:        Math.floor(lvStats.atk) + eq.atk_bonus,
      maxHp,
      hp:         maxHp,
      initiative: lvStats.initiative + eq.spd_bonus,
      critChance: lvStats.crit_chance,
      critRate:   lvStats.crit_rate,
      skillPower: lvStats.skill_power,
      evasion:    lvStats.evasion,
      dex:        lvStats.dex,
      wis:        lvStats.wis,
    };
  });
}
```

- [ ] **Step 2: Update `resolveBattleRound` to fetch gear before materializing boards**

Find inside `resolveBattleRound` the lines:

```js
    p1Board = await materializeBoard(p1Stripped);
    p2Board = await materializeBoard(p2Stripped);
```

Replace them with:

```js
    // Fetch equipment bonuses for both players in parallel (triggers lazy init).
    const [p1Gear, p2Gear] = await Promise.all([
      getEquipmentBonuses(m.p1),
      getEquipmentBonuses(m.p2),
    ]);
    p1Board = await materializeBoard(p1Stripped, p1Gear);
    p2Board = await materializeBoard(p2Stripped, p2Gear);
```

- [ ] **Step 3: Verify PvP battle applies equipment**

Start a PvP match (two browser tabs). Verify in the battle log that the knight's ATK is `floor(16×5×1.0) + 12 = 92` (base 80 from STR formula + 12 from Short Steel Sword). Before this task, it was `80 + 12 = 92` too (from old `weapon_bonus=12`). After Task 7 zeros `weapon_bonus`, the math stays the same — so equipment is correctly providing what `weapon_bonus` used to. Log the ATK value in a console.log temporarily if needed:

```js
// Temporarily add after materializeBoard calls to verify:
console.log('[gear-check] p1 knight ATK:', p1Board.find(u => u?.cid === 'knight')?.atk);
```

- [ ] **Step 4: Commit**

```bash
git add api/server.js
git commit -m "feat: apply equipment bonuses in materializeBoard() for PvP battles"
```

---

## Task 5: Bot mode — fetch gear in BattlePage.jsx, apply in battle.js

**Files:**
- Modify: `client/src/pages/BattlePage.jsx`
- Modify: `public/js/battle.js`

- [ ] **Step 1: Fetch gear in BattlePage.jsx alongside cosmetics**

In `BattlePage.jsx`, find the block that fetches cosmetics (around line 461–477):

```js
        if (sess?.mode === 'hive' && sess?.token) {
          const headers = { Authorization: `Bearer ${sess.token}` }
          try {
            const [bgs, skins] = await Promise.all([
              fetch('/api/cosmetics/backgrounds/equipped', { headers }).then(r => r.json()),
              fetch('/api/cosmetics/skins/equipped', { headers }).then(r => r.json()),
            ])
            window.HF_equipped_backgrounds = bgs.equipped || []
            window.HF_equipped_skins = skins.equipped || {}
          } catch {
            window.HF_equipped_backgrounds = []
            window.HF_equipped_skins = {}
          }
        } else {
          window.HF_equipped_backgrounds = []
          window.HF_equipped_skins = {}
        }
```

Replace it with:

```js
        if (sess?.mode === 'hive' && sess?.token) {
          const headers = { Authorization: `Bearer ${sess.token}` }
          try {
            const [bgs, skins, gearRes] = await Promise.all([
              fetch('/api/cosmetics/backgrounds/equipped', { headers }).then(r => r.json()),
              fetch('/api/cosmetics/skins/equipped', { headers }).then(r => r.json()),
              fetch(`/api/gear?player=${encodeURIComponent(sess.username)}`, { headers }).then(r => r.json()),
            ])
            window.HF_equipped_backgrounds = bgs.equipped || []
            window.HF_equipped_skins = skins.equipped || {}
            window.HF_gear = gearRes.ok ? gearRes.gear : {}
          } catch {
            window.HF_equipped_backgrounds = []
            window.HF_equipped_skins = {}
            window.HF_gear = {}
          }
        } else {
          window.HF_equipped_backgrounds = []
          window.HF_equipped_skins = {}
          window.HF_gear = {}
        }
```

- [ ] **Step 2: Clean up window.HF_gear on unmount in BattlePage.jsx**

Find the cleanup block in BattlePage.jsx that contains:
```js
      delete window.HF_equipped_backgrounds
      delete window.HF_equipped_skins
```

Add `delete window.HF_gear` on the next line:

```js
      delete window.HF_equipped_backgrounds
      delete window.HF_equipped_skins
      delete window.HF_gear
```

- [ ] **Step 3: Apply gear to player board before bot simulate in battle.js**

In `public/js/battle.js`, find the line:
```js
        const res = simulate(G.board, G.enemy);
```

Replace it with:

```js
        // Apply flat equipment bonuses to player units before simulation.
        // Bot units (G.enemy) do not receive gear — they use base stats.
        const _gear = window.HF_gear || {};
        G.board.forEach((u) => {
          if (!u) return;
          const eq = _gear[u.cid]?.totals;
          if (!eq) return;
          const base = C[u.cid]?.levels?.[u.lv];
          if (!base) return;
          u.atk    = Math.floor(base.atk) + (eq.atk_bonus || 0);
          u.maxHp  = base.max_hp          + (eq.hp_bonus  || 0);
          u.hp     = u.maxHp;
          u.spd    = (base.atk_speed || 0) + (eq.spd_bonus || 0);
        });
        const res = simulate(G.board, G.enemy);
```

- [ ] **Step 4: Also apply gear in upgradeUnit to keep stats consistent during merges**

In `public/js/battle.js`, find the function `function upgradeUnit(u)`:

```js
      function upgradeUnit(u) {
        const st = C[u.cid].levels[u.lv];
        u.maxHp = st.max_hp;
        u.hp = st.max_hp;
        u.atk = Math.floor(st.atk);
        u.spd = st.atk_speed;
        u.critChance = st.crit_chance;
        u.critRate = st.crit_rate;
        u.skillPower = st.skill_power;
        u.dex = st.dex;
        u.wis = st.wis;
        u.armor = st.armor;
        u.id = "u" + ++_uid;
```

The `upgradeUnit` function updates unit stats on merge. Gear will be re-applied when the round starts (before simulate), so `upgradeUnit` does not need to change — it correctly resets to base stats and the pre-simulate block re-applies gear. No change needed here.

- [ ] **Step 5: Build and verify bot mode**

```bash
npm run build
npm start
```

Open `http://localhost:3000` (or `http://localhost:5173` for Vite dev). Start a Solo battle. Open browser console and check that the knight's ATK is what you expect (base `floor(STR×5×level_multiplier) + weapon_bonus_current + 12_from_sword`). After Task 7 zeros `weapon_bonus`, the ATK will settle to the correct value.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/BattlePage.jsx public/js/battle.js
git commit -m "feat: load HF_gear in BattlePage, apply equipment bonuses to player board before bot simulate"
```

---

## Task 6: LobbyPage.jsx — fetch gear, GEAR tab, StatsPanel, RPG sheet

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Add playerGear state and fetch in LobbyPage**

In `LobbyPage.jsx`, find the block of `useState` declarations (around the `const [equippedSkins, setEquippedSkins]` line). Add the new state after it:

```js
const [playerGear, setPlayerGear] = useState(null)
```

Find the `useEffect` that loads equipped skins:
```js
  useEffect(() => {
    if (!session?.token) return
    fetch('/api/cosmetics/skins/equipped', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(d => { if (d.ok) setEquippedSkins(d.equipped || {}) })
      .catch(() => {})
  }, []) // eslint-disable-line
```

Add a new `useEffect` for gear immediately after it:

```js
  useEffect(() => {
    if (!session?.token || !session?.username) return
    fetch(`/api/gear?player=${encodeURIComponent(session.username)}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setPlayerGear(d.gear) })
      .catch(() => {})
  }, []) // eslint-disable-line
```

- [ ] **Step 2: Pass playerGear through FormationView to HeroDetail**

Find `FormationView({ session, formations, setFormations, defaultSlot, setDefaultSlot, heroData, toast, equippedSkins = {} })` and add `playerGear = null` to its props:

```js
function FormationView({ session, formations, setFormations, defaultSlot, setDefaultSlot, heroData, toast, equippedSkins = {}, playerGear = null }) {
```

Find where `<HeroDetail hero={detailHero} onClose={...} />` is rendered and pass `playerGear`:

```jsx
{detailHero && <HeroDetail hero={detailHero} onClose={() => setDetailHero(null)} playerGear={playerGear} />}
```

Find where `<FormationView ... />` is rendered in `LobbyPage` and add `playerGear={playerGear}`:

```jsx
          <FormationView
            session={session} formations={formations} setFormations={setFormations}
            defaultSlot={defaultSlot} setDefaultSlot={setDefaultSlot}
            heroData={heroData} toast={showToast} equippedSkins={equippedSkins}
            playerGear={playerGear}
          />
```

- [ ] **Step 3: Update StatsPanel to use real gear totals and fix NaN Speed**

Replace the entire `StatsPanel` component:

```jsx
function StatsPanel({ hero, lv1, playerGear }) {
  const totals = playerGear?.[hero.cid]?.totals ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 }
  const atk     = (lv1?.atk ?? 0) + totals.atk_bonus
  const hp      = (lv1?.max_hp ?? 0) + totals.hp_bonus
  const spd     = (lv1?.initiative ?? 0) + totals.spd_bonus
  const attrs   = hero.attrs || {}
  const evasion = Math.max(0, Math.floor(((attrs.dex ?? 10) - 10) / 2))

  return (
    <div className="stats-panel">
      <div className="stat-row"><span>Attack:</span> <span className="stat-val">{atk}</span></div>
      <div className="stat-row"><span>Speed:</span>  <span className="stat-val">{spd % 1 === 0 ? spd : spd.toFixed(2)}</span></div>
      <div className="stat-row"><span>Armor:</span>  <span className="stat-val">0</span></div>
      <div className="stat-row"><span>Evasion:</span><span className="stat-val">{evasion}%</span></div>
    </div>
  )
}
```

- [ ] **Step 4: Update HeroDetail to use new StatsPanel and show real gear slots**

Replace the entire `HeroDetail` component with:

```jsx
const SLOT_LABELS = {
  amulet: 'AMULET', helm: 'HELM', special: 'SPECIAL', weapon: 'WEAPON',
  chest: 'CHEST', offhand: 'OFF-HAND', belt: 'BELT', legs: 'LEGS',
  gloves: 'GLOVES', ring1: 'RING 1', boots: 'BOOTS', ring2: 'RING 2',
}
const SLOT_ICONS = {
  amulet: '📿', helm: '🪖', special: '✨', weapon: '⚔️',
  chest: '🛡️', offhand: '📜', belt: '🏷️', legs: '👖',
  gloves: '🧤', ring1: '💍', boots: '🥾', ring2: '💍',
}
const SLOT_ORDER = ['amulet','helm','special','weapon','chest','offhand','belt','legs','gloves','ring1','boots','ring2']

function HeroDetail({ hero, onClose, playerGear = null }) {
  const [expanded, setExpanded] = useState(false)
  const [rpgExpanded, setRpgExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('stats')
  const [hoveredItem, setHoveredInfo] = useState(null)

  if (!hero) return null

  const cat = roleCategory(hero.role)
  const label = cat === 'tank' ? 'Tank' : cat === 'support' ? 'Support' : 'DPS'
  const lv1 = hero.levels?.[1] || {}
  const levelKeys = Object.keys(hero.levels || {}).map(Number).sort((a, b) => a - b)
  const attrs = hero.attrs || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const heroGear = playerGear?.[hero.cid] ?? { slots: {}, totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 } }

  function rarityColor(rarity) {
    if (rarity === 'starter') return '#888'
    if (rarity === 'common')  return '#aaa'
    if (rarity === 'rare')    return '#4af'
    if (rarity === 'epic')    return '#c8f'
    if (rarity === 'legendary') return '#fa0'
    return '#aaa'
  }

  function bonusText(item) {
    const parts = []
    if (item.atk_bonus !== 0) parts.push(`${item.atk_bonus > 0 ? '+' : ''}${item.atk_bonus} ATK`)
    if (item.hp_bonus  !== 0) parts.push(`${item.hp_bonus  > 0 ? '+' : ''}${item.hp_bonus} HP`)
    if (item.spd_bonus !== 0) parts.push(`${item.spd_bonus > 0 ? '+' : ''}${Number(item.spd_bonus).toFixed(2)} SPD`)
    return parts.join(' / ') || 'No bonus'
  }

  return (
    <>
      <div className="hf-detail-backdrop hf-open" onClick={onClose} />
      <div className="hf-hero-drawer hf-open" role="dialog" aria-modal="true">

        <div className="hf-detail-close-row">
          <div className="hf-detail-hero-header">
            <span className="hf-detail-ico">{hero.icon}</span>
            <span className="hf-detail-hero-name">{hero.name}</span>
          </div>
          <button type="button" className="hf-detail-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="hf-detail-tabs">
          <button className={`hf-tab-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>INFO</button>
          <button className={`hf-tab-item ${activeTab === 'gear'  ? 'active' : ''}`} onClick={() => setActiveTab('gear')}>GEAR</button>
        </div>

        <div className="detail-slider-viewport">
          <div className={`detail-slider-track view-${activeTab}`}>

            {/* ── INFO PANEL ── */}
            <div className="detail-slide stats-pane hf-detail-scroll">
              <div className="hf-detail-role-wrap">
                <span className={`gr-hero-role role-${cat}`}>{label}</span>
              </div>
              <div className="hf-detail-section-label">Skill</div>
              <div className="hf-detail-skill-name">✦ {hero.skill?.name ?? '—'}</div>
              <div className="hf-detail-skill-desc">{hero.skill?.description ?? ''}</div>
              {hero.skill?.lore && (
                <div className="hf-detail-skill-lore" style={{
                  fontStyle: 'italic', opacity: 0.55, fontSize: '0.88em',
                  marginTop: '15px', marginBottom: '20px', color: '#fff',
                  lineHeight: '1.6', paddingTop: '12px',
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  textAlign: 'center', width: '100%', display: 'block'
                }}>
                  "{hero.skill.lore}"
                </div>
              )}

              <div className="hf-detail-section-label">Base Stats (Lv 1)</div>
              <div className="hf-detail-stats">
                <div className="hf-detail-stat"><span className="hf-stat-label">❤️ HP</span><span className="hf-stat-value">{lv1.max_hp ?? '—'}</span></div>
                <div className="hf-detail-stat"><span className="hf-stat-label">⚔️ ATK</span><span className="hf-stat-value">{lv1.atk ?? '—'}</span></div>
                <div className="hf-detail-stat"><span className="hf-stat-label">⚡ SPD</span><span className="hf-stat-value">{lv1.initiative != null ? lv1.initiative.toFixed(2) : '—'}</span></div>
                <div className="hf-detail-stat"><span className="hf-stat-label">✨ SP</span><span className="hf-stat-value">{lv1.skill_power != null ? fmtSP(lv1.skill_power) : '—'}</span></div>
              </div>

              <button type="button" className="hf-detail-l2-btn" style={{ marginTop: '15px' }} onClick={() => setExpanded(!expanded)}>
                <span className="hf-l2-label">{expanded ? 'Collapse' : 'View full stats'}</span>
                <span className={`hf-l2-chevron${expanded ? ' expanded' : ''}`}>▾</span>
              </button>
              {expanded && (
                <div className="hf-detail-l2 expanded">
                  <table className="hf-detail-l2-table">
                    <thead><tr><th>Level</th><th>HP</th><th>ATK</th><th>SP</th></tr></thead>
                    <tbody>
                      {levelKeys.map(lv => {
                        const s = hero.levels[lv] || {}
                        return <tr key={lv}><td>{lv}</td><td>{s.max_hp}</td><td>{s.atk}</td><td>{s.skill_power != null ? fmtSP(s.skill_power) : '—'}</td></tr>
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <button type="button" className="hf-detail-l2-btn rpg-btn-style" onClick={() => setRpgExpanded(!rpgExpanded)}>
                <span className="hf-l2-label">{rpgExpanded ? 'Hide RPG Sheet' : 'View RPG Sheet'}</span>
                <span className={`hf-l2-chevron${rpgExpanded ? ' expanded' : ''}`}>▾</span>
              </button>
              {rpgExpanded && (
                <div className="rpg-sheet-container animate-fade-in">
                  <div className="rpg-grid">
                    {['str','dex','con','int','wis','cha'].map(key => (
                      <div key={key} className="rpg-stat-box">
                        <span className="rpg-stat-name">{key.toUpperCase()}</span>
                        <span className="rpg-stat-value">{Math.round(attrs[key] ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="rpg-note">Attributes used for item requirements and penalties.</p>
                </div>
              )}
            </div>

            {/* ── GEAR PANEL ── */}
            <div className="detail-slide gear-pane hf-detail-scroll">
              <div className="gear-container">
                {SLOT_ORDER.map((slotKey) => {
                  const item = heroGear.slots[slotKey]
                  return (
                    <div
                      key={slotKey}
                      className={`gear-slot ${slotKey}`}
                      data-label={SLOT_LABELS[slotKey]}
                      onMouseEnter={() => setHoveredInfo(item ? item.name : null)}
                      onMouseLeave={() => setHoveredInfo(null)}
                      onClick={() => setHoveredInfo(item ? item.name : null)}
                    >
                      {item ? (
                        <span style={{ fontSize: '1.4em' }}>{SLOT_ICONS[slotKey]}</span>
                      ) : (
                        <span style={{ fontSize: '1.4em', opacity: 0.3 }}>{SLOT_ICONS[slotKey]}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Item tooltip */}
              <div className={`gear-item-tooltip ${hoveredItem ? 'show' : ''}`}>
                {(() => {
                  if (!hoveredItem) return 'Hover over a slot'
                  const slotKey = SLOT_ORDER.find(s => heroGear.slots[s]?.name === hoveredItem)
                  const item = slotKey ? heroGear.slots[slotKey] : null
                  if (!item) return hoveredItem
                  return (
                    <>
                      <div style={{ fontWeight: 700, color: rarityColor(item.rarity) }}>{item.name}</div>
                      <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: 2 }}>{bonusText(item)}</div>
                      {item.rarity === 'starter' && (
                        <div style={{ fontSize: '0.8em', opacity: 0.5, marginTop: 4 }}>🔒 Starter item — cannot be removed</div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Stats with equipment */}
              <StatsPanel hero={hero} lv1={lv1} playerGear={playerGear} />

              <div className="inventory-preview">
                <p style={{ fontSize: '10px', opacity: 0.5, marginBottom: '10px' }}>INVENTORY (COMING SOON)</p>
                <div className="inv-grid">
                  {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="inv-slot"></div>)}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Remove the old STARTER_GEAR constant**

Find and delete the entire `const STARTER_GEAR = { ... }` block at the top of `LobbyPage.jsx` (it is no longer used — real gear comes from `playerGear`).

- [ ] **Step 6: Start dev server and verify UI**

```bash
cd client && npm run dev
```

Open `http://localhost:5173`. Go to Formation. Click the info button on any hero. Check:
- INFO tab: Speed shows a number (not NaN), RPG sheet shows only 6 attributes without modifiers
- GEAR tab: Shows real item icons in the 3 starter slots, empty for the rest
- Hover over a filled slot → shows item name, bonus, "🔒 Starter item" note
- StatsPanel Attack = base ATK + item atk_bonus_total

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: GEAR tab shows real equipped items, StatsPanel uses gear totals, RPG sheet simplified to 6 attrs"
```

---

## Task 7: Zero weapon_bonus and verify end-to-end

**Files:**
- Modify: `db/schema.sql` (add the UPDATE to the seed section as a note for future re-runs)
- Run: one SQL command against the live DB

- [ ] **Step 1: Understand the current ATK math**

Before zeroing `weapon_bonus`, verify the current ATK values are correct with equipment:

For **Knight** at level 1:
- `calcStats`: `floor(16 × 5 × 1.0) + weapon_bonus(12)` = `80 + 12 = 92`
- Equipment adds: `+12 (Short Steel Sword)` → displayed ATK would be `92 + 12 = 104` ← DOUBLE-COUNTED

After zeroing `weapon_bonus`:
- `calcStats`: `floor(16 × 5 × 1.0) + 0` = `80`
- Equipment adds: `+12` → final ATK = `92` ✓ (matches the original intended value)

This confirms zeroing is correct and expected.

- [ ] **Step 2: Zero weapon_bonus for all heroes**

```bash
psql $DATABASE_URL -c "UPDATE characters_base SET weapon_bonus = 0;"
```

Expected: `UPDATE 8`

- [ ] **Step 3: Force stat cache refresh**

The server caches stats for 10 minutes (`STAT_CACHE_TTL_MS`). Restart the server to clear it:

```bash
npm start
```

- [ ] **Step 4: Verify ATK values in Formation UI**

Open `http://localhost:3000`. Go to Formation → click a hero → GEAR tab → check Attack in StatsPanel.

Expected ATK values at level 1 (after zeroing weapon_bonus + equipment applied):
| Hero | Formula | Expected ATK |
|------|---------|-------------|
| Knight    | `floor(16×5×1.0) + 0 + 12` = 80 + 12 | **92** |
| Paladin   | `floor(14×5×1.0) + 0 + 8`  = 70 + 8  | **78** |
| Barbarian | `floor(18×5×1.0) + 0 + 7`  = 90 + 7  | **97** |
| Assassin  | `floor(20×5×1.0) + 0 + 18` = 100 + 18| **118** |
| Archer    | `floor(18×5×1.0) + 0 + 25` = 90 + 25 | **115** |
| Mage      | `floor(18×5×1.0) + 0 + 50` = 90 + 50 | **140** |
| Archmage  | `floor(20×5×1.0) + 0 + 60` = 100 + 60| **160** |
| Healer    | `floor(20×5×1.0) + 0 - 40` = 100 - 40| **60**  |

(Primary attr: knight=STR16, paladin=STR14, barbarian=STR18, assassin=DEX20, archer=DEX18, mage=INT18, archmage=INT20, healer=WIS20)

- [ ] **Step 5: Verify bot battle with correct ATK**

Start a Solo battle with the Knight. In the battle log, confirm the knight hits for damage consistent with ATK ≈ 92 at level 1.

- [ ] **Step 6: Update schema.sql to document the zeroed weapon_bonus**

In `db/schema.sql`, find the comment above `weapon_bonus`:
```sql
  weapon_bonus    SMALLINT     NOT NULL DEFAULT 0,
```

Update the inline comment next to it:
```sql
  weapon_bonus    SMALLINT     NOT NULL DEFAULT 0,   -- always 0; ATK bonus comes from hero_equipment
```

- [ ] **Step 7: Build production and final verify**

```bash
npm run build
npm start
```

Open `http://localhost:3000/battle` (bot mode). Verify ATK values and gear display.

- [ ] **Step 8: Commit**

```bash
git add db/schema.sql
git commit -m "feat: zero weapon_bonus — ATK bonus now comes from hero_equipment items"
```

---

## Self-Review Checklist

- [x] `items` table created with all 12 slot_type variants and 5 rarity tiers
- [x] `character_starter_loadout` seeded with 24 items (3 per hero × 8 heroes)
- [x] `hero_equipment` lazy-initialized on first `GET /api/gear` call
- [x] `GET /api/gear` returns slots + totals, authenticated only
- [x] `PUT /api/gear/equip` replaces any slot, validates item exists
- [x] `POST /api/gear/unequip` blocks starter removal, reverts to starter if slot has default
- [x] `materializeBoard(board, gearTotals)` applies flat ATK/HP/SPD bonuses for PvP
- [x] `resolveBattleRound` fetches gear for both players before materializing boards
- [x] `BattlePage.jsx` fetches gear and sets `window.HF_gear`, cleans up on unmount
- [x] `battle.js` applies `window.HF_gear` to player board before every bot simulate call
- [x] `StatsPanel` uses `lv1.initiative` (not `atk_speed`) — fixes NaN Speed bug
- [x] `HeroDetail` GEAR tab shows real items from `playerGear`, renders lock for starters
- [x] RPG sheet shows only 6 attrs (STR/DEX/CON/INT/WIS/CHA), no modifiers, no WEAPON_BONUS/INITIATIVE
- [x] `STARTER_GEAR` constant removed from LobbyPage.jsx
- [x] `weapon_bonus` zeroed in Task 7 (after all gear logic verified)
- [x] Bot mode and PvP mode both apply equipment (parity rule satisfied)
