-- ============================================================
-- HORIZON FORGE — Database Schema (v3)
--
-- Static tables seeded by this file:
--   level_scale · characters · characters_base · skills · horizon_forge_details
--
-- Runtime/PvP tables created by POST /api/migrate:
--   matches · match_teams · match_transactions · formations
--
-- character_stats foi REMOVIDA — stats são calculados em runtime:
--   max_hp / atk   = base × level_scale.multiplier
--   atk_speed / crit_chance / crit_rate = fixos (sem escala)
--   skill_power    = (scaled_skill_attr / 2 / 100) + sp_bonus
--
-- Running this file on a fresh DB gives you the seed data and the static
-- tables; you ALSO need to hit POST /api/migrate (with x-admin-secret) to
-- create the PvP/match/formation tables. Both paths are idempotent.
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
-- Characters base — um registro por personagem (valores base nível 1)
-- Stats de combate são calculados via calcStats():
--   max_hp      = (con × 20) × m          (apenas CON — itens adicionam HP)
--   atk         = (primary_attr × 5) × m + weapon_bonus
--   initiative  = spd_offset              (bônus fixo somado ao D20 por round)
--   skill_power = base.skill_power × m    (valor base definido por herói)
--   evasion     = max(0, floor((DEX_base − 10) / 2)) %  (máx 5% sem itens)
--   armor       = 0 por padrão            (vem de item equipado)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS characters_base (
  id              SERIAL       PRIMARY KEY,
  character_id    INT          NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
  max_hp          INT          NOT NULL DEFAULT 0,   -- legado, não usado — calculado via calcStats
  atk             NUMERIC(8,1) NOT NULL DEFAULT 0,   -- legado, não usado — calculado via calcStats
  atk_speed       NUMERIC(4,2) NOT NULL DEFAULT 0,   -- legado, não usado — substituído por spd_offset
  crit_chance     NUMERIC(6,4) NOT NULL DEFAULT 0.005,
  crit_rate       NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  skill_power     NUMERIC(8,4) NOT NULL DEFAULT 0,   -- valor base da habilidade (escala com m)
  str             SMALLINT     NOT NULL DEFAULT 10,
  dex             SMALLINT     NOT NULL DEFAULT 10,
  con             SMALLINT     NOT NULL DEFAULT 10,
  int             SMALLINT     NOT NULL DEFAULT 10,
  wis             SMALLINT     NOT NULL DEFAULT 10,
  cha             SMALLINT     NOT NULL DEFAULT 10,  -- reservado para uso futuro
  primary_attr    VARCHAR(8)   NOT NULL DEFAULT 'str',
  weapon_bonus    SMALLINT     NOT NULL DEFAULT 0,
  spd_offset      NUMERIC(5,2) NOT NULL DEFAULT 0    -- bônus de iniciativa (D20 + spd_offset)
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
  lore          TEXT,           
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

-- max_hp / atk / atk_speed: colunas legadas — valores não usados, calcStats recalcula tudo
-- skill_power: valor base da habilidade (× m por nível). Ver comentário em characters_base.
INSERT INTO characters_base (character_id, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power)
SELECT c.id, v.max_hp, v.atk, v.atk_speed, v.crit_chance, v.crit_rate, v.skill_power
FROM characters c
JOIN (VALUES
  --            cid          hp   atk  spd   cc      cr    skill_power (base × m por nível)
  ('knight',    0,    0.0, 0.00, 0.0050, 1.5, 0.08),  -- Iron Defense: -8% dano recebido/hit
  ('mage',      0,    0.0, 0.00, 0.0050, 1.5, 0.35),  -- Fireball: splash = ATK × 35%
  ('archer',    0,    0.0, 0.00, 0.0050, 1.5, 0.10),  -- Precise Shot: +10% crit chance
  ('healer',    0,    0.0, 0.00, 0.0050, 1.5, 0.60),  -- Healing: cura ATK × 60% (≈ 67 HP L1)
  ('assassin',  0,    0.0, 0.00, 0.0050, 1.5, 0.70),  -- Sneak Strike: ATK × 70% burst
  ('paladin',   0,    0.0, 0.00, 0.0050, 1.5, 0.12),  -- Sacred Aura: +12% maxHP adjacentes
  ('archmage',  0,    0.0, 0.00, 0.0050, 1.5, 0.30),  -- Chain Lightning: 2°=ATK×30%, 3°=15%
  ('barbarian', 0,    0.0, 0.00, 0.0050, 1.5, 0.20)   -- Fury: +20% ATK ao enraivecer
) AS v(cid, max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power) ON c.cid = v.cid
ON CONFLICT (character_id) DO UPDATE SET
  crit_chance = EXCLUDED.crit_chance,
  crit_rate   = EXCLUDED.crit_rate,
  skill_power = EXCLUDED.skill_power;

-- ── Atributos RPG — spec v2.0 ─────────────────────────────────────────────────
-- Idempotente: safe to re-run; popula/redefine os atributos de todos os heróis.
-- max_hp/atk/atk_speed calculados via calcStats() — os campos no banco são legado.
-- Evasão derivada de DEX: max(0, floor((DEX-10)/2))% — máx 5% sem itens.
-- Armadura: sempre 0 da ficha (itens equipam armadura). weapon_bonus = arma base.
UPDATE characters_base cb SET
  str          = v.str,
  dex          = v.dex,
  con          = v.con,
  "int"        = v.int_val,
  wis          = v.wis,
  cha          = v.cha,
  primary_attr = v.primary_attr,
  weapon_bonus = v.weapon_bonus,
  spd_offset   = v.spd_offset
FROM characters c
JOIN (VALUES
  --            cid        str dex con int wis cha  prim   wpn  spd_offset
  ('knight',    16, 10, 16, 10, 10, 10, 'str',  12,  0.00),
  ('paladin',   14, 10, 14, 10, 14, 10, 'str',  18,  0.00),
  ('barbarian', 18, 12, 16,  8, 10,  8, 'str',   7,  0.00),
  ('assassin',   8, 20, 10, 16, 10,  8, 'dex',  70,  0.00),
  ('archer',    10, 18, 14, 10, 10, 10, 'dex',  30, -1.00),
  ('mage',       8, 10,  8, 18, 14, 14, 'int',  12, -2.10),
  ('archmage',   8, 10, 10, 20, 16,  8, 'int',  40, -2.10),
  ('healer',     8, 10, 10, 14, 20, 10, 'wis',  12, -1.00)
) AS v(cid, str, dex, con, int_val, wis, cha, primary_attr, weapon_bonus, spd_offset)
  ON c.cid = v.cid
WHERE cb.character_id = c.id;

INSERT INTO skills (character_id, skill_key, name, description, lore, skill_type)
SELECT c.id, v.skill_key, v.name, v.description, v.lore, v.skill_type
FROM characters c
JOIN (VALUES
  ('knight',    'iron_defense',    'Iron Defense',    'Reduces skill_power% of damage taken each hit. Scales with level.',  'The weight of armor is nothing compared to the weight of duty.',                                                       'Passive'),
  ('mage',      'fireball',        'Fireball',        'Primary target takes full damage. Adjacent targets (+ shape) take skill_power% of that damage. Scales with level.', 'Fire obeys no one; it only accepts invitations.',                       'ATK Modifier'),
  ('archer',    'precise_shot',    'Precise Shot',    'Adds skill_power as a bonus to crit_chance. Scales with level.',    'The wind blows, but my arrow chooses its own path.',                                                                    'Passive'),
  ('healer',    'healing',         'Healing',         'Heals the ally with lowest HP: heal = atk x skill_power. Then attacks nearest enemy. Scales with level.',    'Life is a garden that blooms under the right hands.',                          'Skill'),
  ('assassin',  'sneak_strike',    'Sneak Strike',    'At battle start, performs one sneak attack on lowest-HP enemy for atk x skill_power damage. Scales with level.',    'Silence is the last thing my enemies hear.',                            'Skill'),
  ('paladin',   'sacred_aura',     'Sacred Aura',     'At battle start, grants adjacent allies a max HP bonus of skill_power%. Buff persists even if Paladin dies. Scales with level.',   'My aura is the shield the gods lent to mortals.',        'Skill'),
  ('archmage',  'chain_lightning', 'Chain Lightning', 'Attack hits primary for 100%. Next enemy takes skill_power%, third takes skill_power/2%. Scales with level.',       'Lightning never strikes the same place twice... unless I want it to.',  'ATK Modifier'),
  ('barbarian', 'fury',            'Fury',            'While HP is below 60%, gain skill_power% bonus attack. Scales with level.',           'His fury is the echo of a thousand forgotten battles.',                                               'Skill')
) AS v(cid, skill_key, name, description, lore, skill_type) ON c.cid = v.cid
ON CONFLICT (character_id) DO UPDATE SET
  skill_key   = EXCLUDED.skill_key,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  lore        = EXCLUDED.lore,
  skill_type  = EXCLUDED.skill_type;
-- ============================================================
-- Game config (key/value table read by /api/config)
-- Seeded with default tuning values; safe to UPDATE at runtime.
-- ============================================================
CREATE TABLE IF NOT EXISTS horizon_forge_details (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO horizon_forge_details (key, value) VALUES
  ('initial_gold',           '7'),
  ('value_buy_card',         '3'),
  ('value_new_recruitment',  '2'),
  ('value_sell_card',        '1'),
  ('value_chance_combo3',    '0.10'),
  ('value_gold_combo3',      '2'),
  ('value_chance_combo2',    '0.30'),
  ('value_gold_combo2',      '1'),
  ('qtd_max_heroes',         '5'),
  -- Prize payout %: matches PAYOUT_RATE_FALLBACK in api/server.js.
  -- Adjust live in DB to retune treasury cut without a redeploy.
  ('percent_payout_liquid',  '80'),
  ('percent_payout_stake',   '90')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- PvP matches (matchmaking + payment + state persistence)
-- /api/migrate runs the same CREATE TABLE + ALTER TABLE chain;
-- both produce the same final shape.
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id            TEXT          PRIMARY KEY,
  player1       TEXT          NOT NULL,
  player2       TEXT,
  wager_hive    NUMERIC(10,3) NOT NULL DEFAULT 0,
  wager_type    TEXT          NOT NULL DEFAULT 'HIVE',
  format        INT           NOT NULL DEFAULT 5,
  status        TEXT          NOT NULL DEFAULT 'waiting',
  winner        TEXT,
  score_p1      INT           NOT NULL DEFAULT 0,
  score_p2      INT           NOT NULL DEFAULT 0,
  battle_num    INT           NOT NULL DEFAULT 1,
  -- JSONB blobs persisted on every state transition so a server crash
  -- doesn't lose paid wagers — see persistMatchState/rehydrateMatches.
  payments      JSONB         NOT NULL DEFAULT '{}'::jsonb,
  payout_prefs  JSONB         NOT NULL DEFAULT '{}'::jsonb,
  merges        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  -- Tracks which players have been refunded — guards refundOnce against
  -- a double-refund if a crash falls mid-cancellation and rehydrate
  -- re-runs the refund loop on next boot.
  refunded      JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_teams (
  match_id      TEXT          NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player        TEXT          NOT NULL,
  battle_num    INT           NOT NULL DEFAULT 1,
  team_json     JSONB         NOT NULL,
  submitted_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player, battle_num)
);

CREATE TABLE IF NOT EXISTS match_transactions (
  tx_id        TEXT          PRIMARY KEY,
  match_id     TEXT          REFERENCES matches(id),
  player       TEXT          NOT NULL,
  amount       NUMERIC(10,3) NOT NULL,
  direction    TEXT          NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- Saved hero formations (per player, up to 3 slots)
-- ============================================================
CREATE TABLE IF NOT EXISTS formations (
  player      TEXT NOT NULL,
  slot        INT  NOT NULL CHECK (slot BETWEEN 1 AND 3),
  name        TEXT NOT NULL DEFAULT '',
  hero_ids    JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player, slot)
);

-- ============================================================
-- Shop — cosmetics catalog + per-player ownership
-- ============================================================
CREATE TABLE IF NOT EXISTS cosmetics (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('background', 'skin')),
  name        TEXT NOT NULL,
  preview     TEXT NOT NULL,
  price_hive  NUMERIC(10,3) NOT NULL DEFAULT 0,
  hero_cid    TEXT
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  player        TEXT NOT NULL,
  item_id       TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player, item_id)
);

INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid) VALUES
  ('bg_desert', 'background', 'Deserto',  '/images/arenas/arena-desert.jpg', 0, NULL),
  ('bg_forest', 'background', 'Floresta', '/images/arenas/arena-florest.jpg', 0, NULL),
  ('bg_snow',   'background', 'Neve',     '/images/arenas/arena-snow.jpg',   0, NULL)
ON CONFLICT (id) DO NOTHING;
