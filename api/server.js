import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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
 * Returns all characters with their stats per level and skill.
 * Shape expected by the game engine:
 * {
 *   cid, name, icon, role, color_hex, bg_gradient, target_type,
 *   skill: { skill_key, name, description, skill_type },
 *   levels: { 1: { max_hp, atk, atk_speed, crit_chance, crit_rate, skill_power }, ... }
 * }
 */
app.get('/api/characters', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT
        c.cid, c.name, c.icon, c.role, c.color_hex, c.bg_gradient, c.target_type,
        sk.skill_key, sk.name AS skill_name, sk.description AS skill_desc, sk.skill_type,
        cs.level, cs.max_hp, cs.atk::float AS atk, cs.atk_speed::float,
        cs.crit_chance::float, cs.crit_rate::float, cs.skill_power::float
      FROM characters c
      JOIN skills sk        ON sk.character_id = c.id
      JOIN character_stats cs ON cs.character_id = c.id
      ORDER BY c.id, cs.level
    `;

    // Group into character objects
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
 * Returns the 5 level multipliers and labels.
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
 * POST /api/migrate
 * Runs schema.sql against the database (idempotent — safe to re-run).
 * Call once during setup or after schema changes.
 */
app.post('/api/migrate', async (_req, res) => {
  try {
    // TABELAS
    await sql`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        cid TEXT UNIQUE,
        name TEXT,
        icon TEXT,
        role TEXT,
        color_hex TEXT,
        bg_gradient TEXT,
        target_type TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS skills (
        id SERIAL PRIMARY KEY,
        character_id INT REFERENCES characters(id),
        skill_key TEXT,
        name TEXT,
        description TEXT,
        skill_type TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS character_stats (
        id SERIAL PRIMARY KEY,
        character_id INT REFERENCES characters(id),
        level INT,
        max_hp INT,
        atk REAL,
        atk_speed REAL,
        crit_chance REAL,
        crit_rate REAL,
        skill_power REAL,
        UNIQUE(character_id, level)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS level_scale (
        level INT PRIMARY KEY,
        label TEXT,
        multiplier REAL
      )
    `;

    // horizon_forge_details: global game config
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
        ('value_gold_combo2',     '1')
      ON CONFLICT (key) DO NOTHING
    `;

    res.json({ ok: true, message: 'Migration REAL complete.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚔️  Horizon Forge API running on http://localhost:${PORT}`);
  console.log(`   DB: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL not set'}`);
});