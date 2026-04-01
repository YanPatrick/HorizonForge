import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// ── DB connection ─────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL);

// ── Routes ────────────────────────────────────────────────

/**
 * GET /api/characters
 * Stats calculados dinamicamente: characters_base × level_scale
 *
 * Fórmula por nível:
 *   max_hp      = base.max_hp      * ls.multiplier
 *   atk         = base.atk         * ls.multiplier
 *   atk_speed   = base.atk_speed   (fixo)
 *   crit_chance = base.crit_chance  (fixo)
 *   crit_rate   = base.crit_rate    (fixo)
 *   skill_power = base.skill_power  * ls.skill_power_multiplier
 *
 * Retorno (mesmo contrato do frontend):
 * { cid, name, icon, role, color_hex, bg_gradient, target_type,
 *   skill: { key, name, description, type },
 *   levels: { 1: {...}, 2: {...}, 3: {...}, 4: {...}, 5: {...} } }
 */
app.get('/api/characters', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT
        c.cid,
        c.name,
        c.icon,
        c.role,
        c.color_hex,
        c.bg_gradient,
        c.target_type,
        sk.skill_key,
        sk.name        AS skill_name,
        sk.description AS skill_desc,
        sk.skill_type,
        ls.level,
        ROUND(cb.max_hp * ls.multiplier)::int                          AS max_hp,
        ROUND((cb.atk * ls.multiplier)::numeric, 1)::float             AS atk,
        cb.atk_speed::float,
        cb.crit_chance::float,
        cb.crit_rate::float,
        ROUND((cb.skill_power * ls.skill_power_multiplier)::numeric, 4)::float AS skill_power
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
          cid: r.cid,
          name: r.name,
          icon: r.icon,
          role: r.role,
          color_hex: r.color_hex,
          bg_gradient: r.bg_gradient,
          target_type: r.target_type,
          skill: {
            key: r.skill_key,
            name: r.skill_name,
            description: r.skill_desc,
            type: r.skill_type,
          },
          levels: {},
        };
      }
      map[r.cid].levels[r.level] = {
        max_hp: r.max_hp,
        atk: r.atk,
        atk_speed: r.atk_speed,
        crit_chance: r.crit_chance,
        crit_rate: r.crit_rate,
        skill_power: r.skill_power,
      };
    }

    res.json({ ok: true, characters: Object.values(map) });
  } catch (err) {
    console.error('[/api/characters]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/level-scale
 */
app.get('/api/level-scale', async (_req, res) => {
  try {
    const rows = await sql`SELECT * FROM level_scale ORDER BY level`;
    res.json({ ok: true, levels: rows });
  } catch (err) {
    console.error('[/api/level-scale]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/config
 * Retorna horizon_forge_details como objeto { key: parsedValue }.
 * Sempre lê do banco — nunca cache.
 */
app.get('/api/config', async (_req, res) => {
  try {
    const rows = await sql`SELECT key, value FROM horizon_forge_details`;
    const config = {};
    for (const r of rows) {
      // Converte para número se possível, caso contrário mantém string
      const num = Number(r.value);
      config[r.key] = isNaN(num) ? r.value : num;
    }
    res.json({ ok: true, config });
  } catch (err) {
    console.error('[/api/config]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/migrate
 * Cria as tabelas se não existirem. Seguro para re-executar.
 */
app.post('/api/migrate', async (_req, res) => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS characters (
        id          SERIAL PRIMARY KEY,
        cid         TEXT UNIQUE NOT NULL,
        name        TEXT NOT NULL,
        icon        TEXT NOT NULL,
        role        TEXT NOT NULL,
        color_hex   TEXT NOT NULL,
        bg_gradient TEXT NOT NULL,
        target_type TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS characters_base (
        id           SERIAL PRIMARY KEY,
        character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
        max_hp       INT          NOT NULL,
        atk          NUMERIC(8,1) NOT NULL,
        atk_speed    NUMERIC(4,2) NOT NULL,
        crit_chance  NUMERIC(6,4) NOT NULL,
        crit_rate    NUMERIC(4,2) NOT NULL,
        skill_power  NUMERIC(8,4) NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS level_scale (
        level                  INT PRIMARY KEY,
        label                  TEXT         NOT NULL,
        multiplier             NUMERIC(4,2) NOT NULL,
        skill_power_multiplier NUMERIC(4,2) NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS skills (
        id           SERIAL PRIMARY KEY,
        character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
        skill_key    TEXT NOT NULL,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL,
        skill_type   TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS horizon_forge_details (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    await sql`
      INSERT INTO horizon_forge_details (key, value) VALUES
        ('initial_gold',          '7'),
        ('value_buy_card',        '3'),
        ('value_new_recruitment', '2'),
        ('value_sell_card',       '1'),
        ('value_chance_combo3',   '0.10'),
        ('value_gold_combo3',     '2'),
        ('value_chance_combo2',   '0.30'),
        ('value_gold_combo2',     '1'),
        ('qtd_max_heroes',        '5')
      ON CONFLICT (key) DO NOTHING
    `;

    res.json({ ok: true, message: 'Migration complete.' });
  } catch (err) {
    console.error('[/api/migrate]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve index.html for qualquer rota não-API
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚔️  Horizon Forge API running on http://localhost:${PORT}`);
  console.log(`   DB: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL not set'}`);
});