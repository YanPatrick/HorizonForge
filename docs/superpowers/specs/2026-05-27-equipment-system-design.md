# Equipment System — Design Spec
**Date:** 2026-05-27  
**Branch:** equip-moment  
**Status:** Approved — ready for implementation planning

---

## Overview

Implement a full equipment system for HorizonForge. Each hero can equip up to 12 items across named slots. Equipment applies flat ATK/HP/SPD bonuses (positive or negative) to heroes both in the Formation display and in actual battle simulation.

---

## Scope

**In scope:**
- DB tables: `items`, `character_starter_loadout`, `hero_equipment`
- Seed 24 starter items (3 per hero × 8 heroes)
- Lazy initialization of starter gear per player on first gear request
- API: GET gear, equip, unequip
- Update `/api/characters?player=X` to include equipment bonuses in stats
- Battle integration: `buildUnits()` applies equipment bonuses before simulation
- Formation UI: GEAR tab shows real items, allows equip/swap/unequip
- `StatsPanel` shows real computed stats from equipped items
- RPG Sheet simplified: only 6 attributes (STR, DEX, CON, INT, WIS, CHA), no modifiers, no WEAPON_BONUS, no INITIATIVE
- Fix NaN bug in Speed display (use `initiative` instead of `atk_speed`)

**Out of scope (future):**
- Item inventory management (coming soon)
- Item requirements and penalties
- Item trading/selling
- Procedural item generation (Motor of Chaos)
- Chest system

---

## Database

### New Tables

#### `items` — global item catalog
```sql
CREATE TABLE items (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  description TEXT,
  rarity      VARCHAR(20)   NOT NULL DEFAULT 'common',
  slot_type   VARCHAR(20)   NOT NULL,
  atk_bonus   INT           NOT NULL DEFAULT 0,
  hp_bonus    INT           NOT NULL DEFAULT 0,
  spd_bonus   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  CHECK (rarity IN ('starter', 'common', 'rare', 'epic', 'legendary')),
  CHECK (slot_type IN ('amulet','helm','special','weapon','chest','offhand','belt','legs','gloves','ring1','boots','ring2'))
);
```

#### `character_starter_loadout` — default items per hero per slot
```sql
CREATE TABLE character_starter_loadout (
  character_cid  VARCHAR(30)  NOT NULL REFERENCES characters(cid) ON DELETE CASCADE,
  slot_type      VARCHAR(20)  NOT NULL,
  item_id        INT          NOT NULL REFERENCES items(id),
  PRIMARY KEY (character_cid, slot_type)
);
```
Serves two purposes: (1) source of truth for default gear, (2) used by lazy init.

#### `hero_equipment` — currently equipped item per player+hero+slot
```sql
CREATE TABLE hero_equipment (
  player          TEXT         NOT NULL,
  character_cid   VARCHAR(30)  NOT NULL REFERENCES characters(cid) ON DELETE CASCADE,
  slot_type       VARCHAR(20)  NOT NULL,
  item_id         INT          NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  equipped_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (player, character_cid, slot_type)
);
```

### Migration to Existing Tables

Zero out `weapon_bonus` for all heroes in `characters_base` — ATK bonus now comes entirely from equipped items:
```sql
UPDATE characters_base SET weapon_bonus = 0;
```
The column is kept (no breaking change to `calcStats()`). Future cleanup can remove it.

### Slot Types (English identifiers used throughout DB and API)

| Display (PT) | slot_type |
|---|---|
| AMULETO | amulet |
| ELMO | helm |
| ESPECIAL | special |
| ARMA | weapon |
| PEITORAL | chest |
| OFF-HAND | offhand |
| CINTO | belt |
| CALÇAS | legs |
| LUVAS | gloves |
| ANEL 1 | ring1 |
| BOTAS | boots |
| ANEL 2 | ring2 |

### Starter Items Seed Data

24 items with `rarity = 'starter'`:

| Hero | Name | slot_type | atk_bonus | hp_bonus | spd_bonus |
|---|---|---|---|---|---|
| knight | Short Steel Sword | weapon | +12 | 0 | 0 |
| knight | Plate Cuirass | chest | 0 | +250 | 0 |
| knight | Tower Shield | offhand | 0 | +122 | 0 |
| paladin | Silver Hammer | weapon | +8 | 0 | 0 |
| paladin | Heavy Chainmail | chest | 0 | +300 | 0 |
| paladin | Seal of Devotion | ring1 | 0 | +107 | 0 |
| barbarian | Hand Axe | weapon | +7 | 0 | 0 |
| barbarian | Bear Pelt | chest | 0 | +250 | 0 |
| barbarian | Horned Helm | helm | 0 | +100 | 0 |
| mage | Willow Staff | weapon | +50 | 0 | 0 |
| mage | Linen Tunic | chest | 0 | +30 | 0 |
| mage | Crystal Orb | amulet | +10 | +10 | 0 |
| archer | Longbow | weapon | +25 | 0 | 0 |
| archer | Leather Armor | chest | 0 | +100 | 0 |
| archer | Precision Quiver | special | +5 | +60 | 0 |
| assassin | Serrated Dagger | weapon | +18 | 0 | 0 |
| assassin | Cloth Cape | chest | 0 | +30 | 0 |
| assassin | Hidden Boot Knife | boots | +4 | +23 | 0 |
| archmage | Runic Staff | weapon | +60 | 0 | 0 |
| archmage | Council Mantle | chest | 0 | +50 | 0 |
| archmage | Ring of Infinity | ring1 | +10 | +27 | 0 |
| healer | Staff of Rest | weapon | -40 | 0 | 0 |
| healer | Silk Vestments | chest | 0 | +20 | 0 |
| healer | Blessed Rosary | amulet | +2 | +9 | 0 |

`character_starter_loadout` is seeded from the table above (character_cid → slot_type → item_id).

---

## Stat Formulas (with equipment)

Equipment bonuses are **flat offsets** — not scaled by hero level:

```
ATK(level)  = floor(primary_attr × 5 × m) + atk_bonus_total
HP(level)   = floor(con × 20 × m)         + hp_bonus_total
Initiative  = spd_offset                   + spd_bonus_total
```

Where `*_bonus_total` = `SUM` of all equipped items' respective bonus columns for that hero. Computed at query time, never stored.

`calcStats()` itself is **not modified**. Equipment is applied on top of its return value.

---

## API

### `GET /api/gear?player=X`
Returns gear for all 8 heroes for the given player.

**Lazy init:** For each hero, for each slot in `character_starter_loadout` where no `hero_equipment` row exists for this player+hero+slot → `INSERT` the starter item. This runs once per hero per player.

**Response:**
```json
{
  "ok": true,
  "gear": {
    "knight": {
      "slots": {
        "weapon": { "id": 1, "name": "Short Steel Sword", "rarity": "starter", "atk_bonus": 12, "hp_bonus": 0, "spd_bonus": 0 },
        "chest":  { "id": 2, "name": "Plate Cuirass", "rarity": "starter", "atk_bonus": 0, "hp_bonus": 250, "spd_bonus": 0 },
        ...
      },
      "totals": { "atk_bonus": 134, "hp_bonus": 372, "spd_bonus": 0 }
    },
    ...
  }
}
```

Empty slots are omitted from `slots` (key not present in the object).

---

### `PUT /api/gear/equip`
Body: `{ player, character_cid, slot_type, item_id }`

- Validates item exists in `items`
- *(Future: validates player owns item in inventory)*
- `INSERT INTO hero_equipment ... ON CONFLICT DO UPDATE SET item_id = $item_id, equipped_at = now()`
- Returns `{ ok: true, slot: { ... item data ... } }`

---

### `POST /api/gear/unequip`
Body: `{ player, character_cid, slot_type }`

Unequip logic:
1. Check if `character_starter_loadout` has a row for `(character_cid, slot_type)`
2. **If starter exists for this slot:**
   - If current item IS the starter → `403` "Cannot unequip a starter item"
   - If current item is NOT the starter → revert: `UPDATE hero_equipment SET item_id = starter_item_id`
3. **If no starter for this slot:** → `DELETE` the row (slot becomes empty)

Returns `{ ok: true, slot: null | { ...starter item } }`.

---

### `GET /api/characters` — unchanged

No player-specific variant. The existing global endpoint remains as-is. The frontend computes final display stats by combining base stats (`heroData` from `/api/characters`) with gear totals (`playerGear` from `/api/gear`) locally — no additional server round-trip needed.

---

## Battle Integration

In `server.js`, the `buildUnits()` / unit-construction function:

1. Accepts `playerGear` map as additional parameter: `{ [cid]: { atk_bonus, hp_bonus, spd_bonus } }`
2. After `calcStats()` call, apply flat offsets:

```js
const eq = playerGear?.[cid] ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 }
unit.atk       = Math.floor(calcStats(base, m).atk) + eq.atk_bonus
unit.maxHp     = calcStats(base, m).max_hp + eq.hp_bonus
unit.hp        = unit.maxHp  // full HP at battle start
unit.initiative = calcStats(base, m).initiative + eq.spd_bonus
```

3. `playerGear` is fetched once per player per battle start via the gear query (reuses the same DB call as lazy init).
4. Both Bot mode (`startGame()`) and PvP mode (`startBattle()`) must receive and apply equipment — parity rule applies.

---

## Frontend (LobbyPage.jsx)

### State additions to `LobbyPage`
```js
const [playerGear, setPlayerGear] = useState(null)  // { [cid]: { slots, totals } }
```
Loaded on mount (authenticated players only):
```js
fetch(`/api/gear?player=${username}`, { headers: { Authorization: ... } })
  .then(r => r.json())
  .then(d => { if (d.ok) setPlayerGear(d.gear) })
```

`playerGear` passed as prop through `FormationView` → `HeroDetail`.

---

### `HeroDetail` — GEAR tab

Each of the 12 slots renders based on gear data:

| State | Display |
|---|---|
| Equipped starter | Item name + bonuses chip + 🔒 lock icon |
| Equipped non-starter | Item name + bonuses chip + Remove button |
| Empty | Dark slot + "Empty" label |

**Slot click behavior:**
- Starter slot → tooltip with name, stats, "Locked — cannot be removed"
- Non-starter slot → details + Remove button
- Empty slot → "Empty slot" (future: open inventory)

---

### `StatsPanel` (fix + update)

```js
// Fix NaN: use initiative, not atk_speed (which doesn't exist in levels response)
const totals = playerGear?.[hero.cid]?.totals ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 }

const stats = {
  atk:     (lv1.atk ?? 0)        + totals.atk_bonus,
  spd:     (lv1.initiative ?? 0) + totals.spd_bonus,   // fixes NaN
  hp:      (lv1.max_hp ?? 0)     + totals.hp_bonus,
  armor:   0,                                            // future: from items
  evasion: Math.max(0, Math.floor((attrs.dex - 10) / 2))
}
```

---

### RPG Sheet (simplification)

Show only the 6 base attributes — no modifiers in parentheses, no WEAPON_BONUS, no INITIATIVE:

```jsx
{['str','dex','con','int','wis','cha'].map(key => (
  <div className="rpg-stat-box">
    <span className="rpg-stat-name">{key.toUpperCase()}</span>
    <span className="rpg-stat-value">{Math.round(attrs[key])}</span>
  </div>
))}
```

---

## Constraints and Rules

- **Parity:** Equipment must be applied in both Bot mode and PvP mode battle builds.
- **Starter lock:** API enforces that starter items cannot be deleted from `hero_equipment` unless replaced.
- **No inventory gate (phase 1):** Any item that exists in `items` can be equipped via the API without ownership check. Ownership check is a future gate.
- **No visual effects scope change:** No new battle animations are added as part of this system.
- **English everywhere:** All DB identifiers, API field names, and item names are in English.

---

## Known Gaps (post-phase)

- Inventory system for non-starter items (shown as "Coming Soon" in UI)
- Item requirements and penalties (attribute thresholds)
- Item trading, selling, and pricing
- Equipment bonuses not shown in the level scaling table (INFO tab) — intentional, the table shows base stats only
