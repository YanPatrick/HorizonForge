-- ============================================================
-- HORIZON FORGE — Database Schema
-- Project: horizon_forge (Neon Console)
-- ============================================================

-- --------------------------------------------------------
-- Level scale multipliers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS level_scale (
  level        SMALLINT PRIMARY KEY,          -- 1 to 5
  multiplier   NUMERIC(4,2) NOT NULL,         -- 1.0, 1.3, 1.6, 1.9, 2.2
  label        VARCHAR(20) NOT NULL           -- ★, ★★, ★★★, ★★★★, ★★★★★
);

-- --------------------------------------------------------
-- Characters base data (level 1 values only)
-- The game derives all other levels via level_scale
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS characters (
  id              SERIAL PRIMARY KEY,
  cid             VARCHAR(30) UNIQUE NOT NULL,  -- internal key: 'knight', 'mage', etc.
  name            VARCHAR(50) NOT NULL,
  icon            VARCHAR(10) NOT NULL,         -- emoji
  role            VARCHAR(30) NOT NULL,         -- Tank, Mage, etc.
  color_hex       VARCHAR(7)  NOT NULL,         -- card border color
  bg_gradient     TEXT        NOT NULL,         -- CSS gradient string
  target_type     VARCHAR(10) NOT NULL          -- 'nearest' | 'lowhp' | 'ranged'
);

-- --------------------------------------------------------
-- Character stats per level (all 5 levels pre-calculated)
-- Allows per-level overrides if needed without changing code
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS character_stats (
  id              SERIAL PRIMARY KEY,
  character_id    INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  level           SMALLINT NOT NULL REFERENCES level_scale(level),
  max_hp          INT     NOT NULL,
  atk             NUMERIC(8,1) NOT NULL,
  atk_speed       NUMERIC(4,2) NOT NULL,       -- attacks per tick unit
  crit_chance     NUMERIC(6,4) NOT NULL,        -- e.g. 0.005 = 0.5%
  crit_rate       NUMERIC(4,2) NOT NULL,        -- e.g. 1.5 = 1.5x multiplier
  skill_power     NUMERIC(8,4) NOT NULL,        -- raw value; meaning depends on skill_type
  UNIQUE(character_id, level)
);

-- --------------------------------------------------------
-- Skills — one row per character
-- skill_power is read from character_stats at runtime
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
  id              SERIAL PRIMARY KEY,
  character_id    INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
  skill_key       VARCHAR(40)  NOT NULL,        -- e.g. 'iron_defense'
  name            VARCHAR(60)  NOT NULL,
  description     TEXT         NOT NULL,
  skill_type      VARCHAR(30)  NOT NULL         -- 'passive' | 'atk_modifier' | 'skill'
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Level scale
INSERT INTO level_scale (level, multiplier, label) VALUES
  (1, 1.0, '★'),
  (2, 1.3, '★★'),
  (3, 1.6, '★★★'),
  (4, 1.9, '★★★★'),
  (5, 2.2, '★★★★★')
ON CONFLICT (level) DO UPDATE SET
  multiplier = EXCLUDED.multiplier,
  label      = EXCLUDED.label;

-- Characters
INSERT INTO characters (cid, name, icon, role, color_hex, bg_gradient, target_type) VALUES
  ('knight',    'Knight',    '⚔️',  'Tank',     '#6a7a8a', 'linear-gradient(155deg,#1a2535,#2d3f50)', 'nearest'),
  ('mage',      'Mage',      '🔮',  'Mage',     '#9a7aff', 'linear-gradient(155deg,#150830,#321566)', 'ranged'),
  ('archer',    'Archer',    '🏹',  'Shooter',  '#6acc6a', 'linear-gradient(155deg,#0a200a,#1a4020)', 'ranged'),
  ('healer',    'Healer',    '💚',  'Support',  '#ff99cc', 'linear-gradient(155deg,#28091a,#4a1530)', 'lowhp'),
  ('assassin',  'Assassin',  '🗡️',  'Assassin', '#cc77ff', 'linear-gradient(155deg,#180928,#2e0d4a)', 'lowhp'),
  ('paladin',   'Paladin',   '🛡️',  'Paladin',  '#ffcc44', 'linear-gradient(155deg,#221500,#3e2900)', 'nearest'),
  ('archmage',  'Archmage',  '🌟',  'Archmage', '#ffee44', 'linear-gradient(155deg,#1e1600,#3a2c00)', 'ranged'),
  ('barbarian', 'Barbarian', '🪓',  'Tank',     '#ee5522', 'linear-gradient(155deg,#1e0800,#3a1400)', 'nearest')
ON CONFLICT (cid) DO UPDATE SET
  name        = EXCLUDED.name,
  icon        = EXCLUDED.icon,
  role        = EXCLUDED.role,
  color_hex   = EXCLUDED.color_hex,
  bg_gradient = EXCLUDED.bg_gradient,
  target_type = EXCLUDED.target_type;

-- Character stats (all 5 levels)
-- Knight
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 620  WHEN 2 THEN 806  WHEN 3 THEN 992  WHEN 4 THEN 1178 WHEN 5 THEN 1364 END,
  CASE ls.level WHEN 1 THEN 80   WHEN 2 THEN 104  WHEN 3 THEN 128  WHEN 4 THEN 152  WHEN 5 THEN 176  END,
  1.00, 0.005, 1.5,
  CASE ls.level WHEN 1 THEN 0.06 WHEN 2 THEN 0.07 WHEN 3 THEN 0.08 WHEN 4 THEN 0.09 WHEN 5 THEN 0.10 END
FROM characters c, level_scale ls WHERE c.cid = 'knight'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Mage
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 260  WHEN 2 THEN 338  WHEN 3 THEN 416  WHEN 4 THEN 494  WHEN 5 THEN 572  END,
  CASE ls.level WHEN 1 THEN 170  WHEN 2 THEN 221  WHEN 3 THEN 272  WHEN 4 THEN 323  WHEN 5 THEN 374  END,
  0.70, 0.005, 1.5,
  CASE ls.level WHEN 1 THEN 0.20 WHEN 2 THEN 0.25 WHEN 3 THEN 0.30 WHEN 4 THEN 0.35 WHEN 5 THEN 0.40 END
FROM characters c, level_scale ls WHERE c.cid = 'mage'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Archer
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 360  WHEN 2 THEN 468  WHEN 3 THEN 576  WHEN 4 THEN 684  WHEN 5 THEN 792  END,
  CASE ls.level WHEN 1 THEN 120  WHEN 2 THEN 156  WHEN 3 THEN 192  WHEN 4 THEN 228  WHEN 5 THEN 264  END,
  1.30, 0.005, 1.5,
  -- skill_power for archer = bonus added to crit_chance (0.003 = +0.3%) and crit_rate (+0.3x)
  CASE ls.level WHEN 1 THEN 0.30 WHEN 2 THEN 0.60 WHEN 3 THEN 0.90 WHEN 4 THEN 1.20 WHEN 5 THEN 1.50 END
FROM characters c, level_scale ls WHERE c.cid = 'archer'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Healer
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 310  WHEN 2 THEN 403  WHEN 3 THEN 496  WHEN 4 THEN 589  WHEN 5 THEN 682  END,
  CASE ls.level WHEN 1 THEN 52   WHEN 2 THEN 67.6 WHEN 3 THEN 83.2 WHEN 4 THEN 98.8 WHEN 5 THEN 114.4 END,
  0.90, 0.005, 1.5,
  -- skill_power = heal multiplier (atk * skill_power = heal amount)
  CASE ls.level WHEN 1 THEN 1.40 WHEN 2 THEN 1.60 WHEN 3 THEN 1.80 WHEN 4 THEN 2.00 WHEN 5 THEN 2.20 END
FROM characters c, level_scale ls WHERE c.cid = 'healer'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Assassin
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 280  WHEN 2 THEN 364  WHEN 3 THEN 448  WHEN 4 THEN 532  WHEN 5 THEN 616  END,
  CASE ls.level WHEN 1 THEN 160  WHEN 2 THEN 208  WHEN 3 THEN 256  WHEN 4 THEN 304  WHEN 5 THEN 352  END,
  1.50, 0.005, 1.5,
  -- skill_power = sneak strike damage multiplier
  CASE ls.level WHEN 1 THEN 1.10 WHEN 2 THEN 1.20 WHEN 3 THEN 1.30 WHEN 4 THEN 1.40 WHEN 5 THEN 1.50 END
FROM characters c, level_scale ls WHERE c.cid = 'assassin'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Paladin
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 560  WHEN 2 THEN 728  WHEN 3 THEN 896  WHEN 4 THEN 1064 WHEN 5 THEN 1232 END,
  CASE ls.level WHEN 1 THEN 85   WHEN 2 THEN 110.5 WHEN 3 THEN 136 WHEN 4 THEN 161.5 WHEN 5 THEN 187 END,
  0.90, 0.005, 1.5,
  -- skill_power = % HP bonus for adjacent allies
  CASE ls.level WHEN 1 THEN 0.11 WHEN 2 THEN 0.12 WHEN 3 THEN 0.13 WHEN 4 THEN 0.14 WHEN 5 THEN 0.15 END
FROM characters c, level_scale ls WHERE c.cid = 'paladin'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Archmage
-- skill_power stored as two values encoded: first chain % and second chain %
-- Level 1: 10% and 5%, L2: 20% and 10%, L3: 30% and 15%, L4: 40% and 20%, L5: 50% and 25%
-- We store the first chain factor; second = first/2
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 230  WHEN 2 THEN 299  WHEN 3 THEN 368  WHEN 4 THEN 437  WHEN 5 THEN 506  END,
  CASE ls.level WHEN 1 THEN 180  WHEN 2 THEN 234  WHEN 3 THEN 288  WHEN 4 THEN 342  WHEN 5 THEN 396  END,
  0.75, 0.005, 1.5,
  CASE ls.level WHEN 1 THEN 0.10 WHEN 2 THEN 0.20 WHEN 3 THEN 0.30 WHEN 4 THEN 0.40 WHEN 5 THEN 0.50 END
FROM characters c, level_scale ls WHERE c.cid = 'archmage'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Barbarian
INSERT INTO character_stats (character_id, level, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, ls.level,
  CASE ls.level WHEN 1 THEN 720  WHEN 2 THEN 936  WHEN 3 THEN 1152 WHEN 4 THEN 1368 WHEN 5 THEN 1584 END,
  CASE ls.level WHEN 1 THEN 95   WHEN 2 THEN 123.5 WHEN 3 THEN 152 WHEN 4 THEN 180.5 WHEN 5 THEN 209 END,
  1.10, 0.005, 1.5,
  -- skill_power = atk bonus % when HP < 60%
  CASE ls.level WHEN 1 THEN 0.15 WHEN 2 THEN 0.20 WHEN 3 THEN 0.25 WHEN 4 THEN 0.30 WHEN 5 THEN 0.35 END
FROM characters c, level_scale ls WHERE c.cid = 'barbarian'
ON CONFLICT (character_id, level) DO UPDATE SET
  max_hp=EXCLUDED.max_hp, atk=EXCLUDED.atk, atk_speed=EXCLUDED.atk_speed,
  crit_chance=EXCLUDED.crit_chance, crit_rate=EXCLUDED.crit_rate, skill_power=EXCLUDED.skill_power;

-- Skills
INSERT INTO skills (character_id, skill_key, name, description, skill_type)
SELECT c.id, v.skill_key, v.name, v.description, v.skill_type
FROM characters c
JOIN (VALUES
  ('knight',    'iron_defense',    'Iron Defense',    'Reduces X% (skill_power) of damage taken. Scales with level.', 'passive'),
  ('mage',      'fireball',        'Fireball',        'Primary target takes full damage. Adjacent targets (+ shape) take skill_power % of that damage.', 'atk_modifier'),
  ('archer',    'precise_shot',    'Precise Shot',    'Adds skill_power bonus to crit chance (%) and crit rate (x). Scales per level.', 'passive'),
  ('healer',    'healing',         'Healing',         'Heals the ally with lowest HP: heal = atk × skill_power. Then attacks nearest enemy.', 'skill'),
  ('assassin',  'sneak_strike',    'Sneak Strike',    'At battle start, performs one sneak attack on lowest-HP enemy for atk × skill_power damage.', 'skill'),
  ('paladin',   'sacred_aura',     'Sacred Aura',     'At battle start, grants adjacent allies (+ shape) a max HP bonus of skill_power %. Buff persists even if paladin dies.', 'skill'),
  ('archmage',  'chain_lightning', 'Chain Lightning', 'Attack hits primary target for 100%. Next enemy in line takes skill_power %, third takes skill_power/2 %.', 'atk_modifier'),
  ('barbarian', 'fury',            'Fury',            'When HP drops below 60%, permanently gain skill_power % bonus attack for the rest of the battle.', 'skill')
) AS v(cid, skill_key, name, description, skill_type) ON c.cid = v.cid
ON CONFLICT (character_id) DO UPDATE SET
  skill_key   = EXCLUDED.skill_key,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  skill_type  = EXCLUDED.skill_type;
