-- ============================================================
-- HORIZON FORGE — Database Schema (v2)
-- Tabelas: level_scale · characters · characters_base · skills
-- character_stats foi REMOVIDA — stats são calculados em runtime:
--   max_hp / atk   = base × level_scale.multiplier
--   atk_speed / crit_chance / crit_rate = fixos (sem escala)
--   skill_power    = base × level_scale.skill_power_multiplier
-- ============================================================

-- --------------------------------------------------------
-- Level scale multipliers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS level_scale (
  level                   SMALLINT     PRIMARY KEY,
  multiplier              NUMERIC(4,2) NOT NULL,      -- escala hp e atk (1.0 → 2.2)
  label                   VARCHAR(20)  NOT NULL,      -- ★ … ★★★★★
  skill_power_multiplier  NUMERIC(4,2) NOT NULL       -- escala skill_power (1.1 → 1.5)
);

-- --------------------------------------------------------
-- Characters — identidade visual e comportamento
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS characters (
  id              SERIAL       PRIMARY KEY,
  cid             VARCHAR(30)  UNIQUE NOT NULL,
  name            VARCHAR(50)  NOT NULL,
  icon            VARCHAR(10)  NOT NULL,
  role            VARCHAR(30)  NOT NULL,
  color_hex       VARCHAR(7)   NOT NULL,
  bg_gradient     TEXT         NOT NULL,
  target_type     VARCHAR(10)  NOT NULL
);

-- --------------------------------------------------------
-- Characters base — um registro por personagem (valores nível 1)
-- max_hp / atk     → multiplicar por level_scale.multiplier
-- atk_speed / crit → fixos
-- skill_power      → multiplicar por level_scale.skill_power_multiplier
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- Skills — uma habilidade por personagem
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
  id              SERIAL       PRIMARY KEY,
  character_id    INT          NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
  skill_key       VARCHAR(40)  NOT NULL,
  name            VARCHAR(60)  NOT NULL,
  description     TEXT         NOT NULL,
  skill_type      VARCHAR(30)  NOT NULL
);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO level_scale (level, multiplier, label, skill_power_multiplier) VALUES
  (1, 1.0, '★',     1.1),
  (2, 1.3, '★★',    1.2),
  (3, 1.6, '★★★',   1.3),
  (4, 1.9, '★★★★',  1.4),
  (5, 2.2, '★★★★★', 1.5)
ON CONFLICT (level) DO UPDATE SET
  multiplier              = EXCLUDED.multiplier,
  label                   = EXCLUDED.label,
  skill_power_multiplier  = EXCLUDED.skill_power_multiplier;

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

INSERT INTO characters_base (character_id, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, v.max_hp, v.atk, v.atk_speed, v.crit_chance, v.crit_rate, v.skill_power
FROM characters c
JOIN (VALUES
  ('knight',    620,  80.0, 1.00, 0.0050, 1.5, 0.0600),
  ('mage',      260, 170.0, 0.70, 0.0050, 1.5, 0.2000),
  ('archer',    360, 120.0, 1.30, 0.0050, 1.5, 0.3000),
  ('healer',    310,  52.0, 0.90, 0.0050, 1.5, 1.4000),
  ('assassin',  280, 160.0, 1.50, 0.0050, 1.5, 1.1000),
  ('paladin',   560,  85.0, 0.90, 0.0050, 1.5, 0.1100),
  ('archmage',  230, 180.0, 0.75, 0.0050, 1.5, 0.1000),
  ('barbarian', 720,  95.0, 1.10, 0.0050, 1.5, 0.1500)
) AS v(cid, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power) ON c.cid = v.cid
ON CONFLICT (character_id) DO UPDATE SET
  max_hp      = EXCLUDED.max_hp,
  atk         = EXCLUDED.atk,
  atk_speed   = EXCLUDED.atk_speed,
  crit_chance = EXCLUDED.crit_chance,
  crit_rate   = EXCLUDED.crit_rate,
  skill_power = EXCLUDED.skill_power;

INSERT INTO skills (character_id, skill_key, name, description, skill_type)
SELECT c.id, v.skill_key, v.name, v.description, v.skill_type
FROM characters c
JOIN (VALUES
  ('knight',    'iron_defense',    'Iron Defense',    'Reduces skill_power% of damage taken each hit. Scales with level.',                                                                           'passive'),
  ('mage',      'fireball',        'Fireball',        'Primary target takes full damage. Adjacent targets (+ shape) take skill_power% of that damage. Scales with level.',                         'atk_modifier'),
  ('archer',    'precise_shot',    'Precise Shot',    'Adds skill_power bonus to crit_chance and crit_rate. Scales with level.',                                                                     'passive'),
  ('healer',    'healing',         'Healing',         'Heals the ally with lowest HP: heal = atk x skill_power. Then attacks nearest enemy. Scales with level.',                                    'skill'),
  ('assassin',  'sneak_strike',    'Sneak Strike',    'At battle start, performs one sneak attack on lowest-HP enemy for atk x skill_power damage. Scales with level.',                             'skill'),
  ('paladin',   'sacred_aura',     'Sacred Aura',     'At battle start, grants adjacent allies a max HP bonus of skill_power%. Buff persists even if Paladin dies. Scales with level.',             'skill'),
  ('archmage',  'chain_lightning', 'Chain Lightning', 'Attack hits primary for 100%. Next enemy takes skill_power%, third takes skill_power/2%. Scales with level.',                                'atk_modifier'),
  ('barbarian', 'fury',            'Fury',            'When HP drops below 60%, permanently gain skill_power% bonus attack for the rest of the battle. Scales with level.',                         'skill')
) AS v(cid, skill_key, name, description, skill_type) ON c.cid = v.cid
ON CONFLICT (character_id) DO UPDATE SET
  skill_key   = EXCLUDED.skill_key,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  skill_type  = EXCLUDED.skill_type;