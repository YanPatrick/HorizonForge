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
