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
