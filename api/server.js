import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { simulate } from '../shared/simulate.js';
import { Client as HiveClient, PrivateKey as HiveKey } from '@hiveio/dhive';

// ── Hive configuration ────────────────────────────────────────────────────────
const HIVE_GAME_ACCOUNT = process.env.HIVE_GAME_ACCOUNT || '';
const HIVE_ACTIVE_KEY   = process.env.HIVE_ACTIVE_KEY   || '';
const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];
const PAYOUT_RATE = { liquid: 0.90, stake: 0.95 };

// Lazy Hive client — only instantiated when credentials are present
let _hive = null;
function hiveClient() {
  if (!_hive) _hive = new HiveClient(HIVE_NODES);
  return _hive;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Generic Hive JSON-RPC call (read-only, no key needed).
 */
async function hiveRpc(method, params) {
  for (const node of HIVE_NODES) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'RPC error');
      return json.result;
    } catch (e) {
      console.warn(`[hiveRpc] ${node} failed: ${e.message}`);
    }
  }
  throw new Error('All Hive nodes failed');
}

/**
 * Verify an on-chain transfer:
 * - sender === from
 * - recipient === HIVE_GAME_ACCOUNT
 * - amount matches expected wager (±0.001 HIVE tolerance)
 * - memo matches pattern: battle_{matchId}_liquid OR battle_{matchId}_stake
 * Retries for up to ~36 s to allow for block confirmation.
 * Returns { payoutPref: 'liquid'|'stake' } on success, throws on failure.
 */
async function verifyHivePayment(txId, from, wager, matchId) {
  let lastErr;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const tx = await hiveRpc('condenser_api.get_transaction', [txId]);
      if (!tx || !tx.operations) throw new Error('tx_not_found');

      const [opType, op] = tx.operations.find(([t]) => t === 'transfer') || [];
      if (!opType) throw new Error('No transfer operation in tx');

      if (op.from.toLowerCase() !== from.toLowerCase())
        throw new Error(`Wrong sender: got ${op.from}`);
      if (op.to.toLowerCase() !== HIVE_GAME_ACCOUNT.toLowerCase())
        throw new Error(`Wrong recipient: expected ${HIVE_GAME_ACCOUNT}, got ${op.to}`);

      const sent = parseFloat(op.amount);
      if (Math.abs(sent - wager) > 0.001)
        throw new Error(`Wrong amount: expected ${wager}, got ${sent}`);

      // Memo: battle_{matchId}_liquid  or  battle_{matchId}_stake
      const expectedPrefix = `battle_${matchId}_`;
      if (!op.memo.startsWith(expectedPrefix))
        throw new Error(`Invalid memo: ${op.memo}`);

      const payoutPref = op.memo.slice(expectedPrefix.length);
      if (!['liquid', 'stake'].includes(payoutPref))
        throw new Error(`Unknown payout pref in memo: ${payoutPref}`);

      return { payoutPref };
    } catch (err) {
      lastErr = err;
      if (err.message === 'tx_not_found' || err.message.includes('unknown_hardfork')) {
        await sleep(3000);
        continue;
      }
      throw err; // non-retriable error
    }
  }
  throw new Error(`Payment verification timed out: ${lastErr?.message}`);
}

/**
 * Send the prize to the winner:
 *  - 'liquid' → standard HIVE transfer (90% of pot)
 *  - 'stake'  → transfer_to_vesting / power-up (95% of pot)
 * Returns { ok, amount, payoutPref } or { ok: false, error }.
 */
async function sendHivePrize(winner, pot, payoutPref, matchId) {
  if (!HIVE_GAME_ACCOUNT || !HIVE_ACTIVE_KEY) {
    console.warn('[prize] Hive credentials not set — prize skipped');
    return { ok: false, error: 'Server not configured for HIVE payments' };
  }
  const rate   = PAYOUT_RATE[payoutPref] ?? 0.90;
  const amount = (pot * rate).toFixed(3);
  try {
    const key = HiveKey.fromString(HIVE_ACTIVE_KEY);
    if (payoutPref === 'stake') {
      await hiveClient().broadcast.transferToVesting(
        { from: HIVE_GAME_ACCOUNT, to: winner, amount: `${amount} HIVE` },
        key
      );
    } else {
      await hiveClient().broadcast.transfer(
        {
          from: HIVE_GAME_ACCOUNT,
          to: winner,
          amount: `${amount} HIVE`,
          memo: `Horizon Forge prize — match ${matchId}`,
        },
        key
      );
    }
    console.log(`💰 Prize sent: ${amount} HIVE (${payoutPref}) → ${winner} | match ${matchId}`);
    return { ok: true, amount, payoutPref };
  } catch (err) {
    console.error('[prize] Failed:', err.message);
    return { ok: false, error: err.message };
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));
app.use('/shared', express.static(join(__dirname, '../shared')));

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
// ── Skill-power iterative formula ────────────────────────────────────────────
// L1 = base_skill_power (raw DB value)
// Ln = max(prev × stepMult, prev + incMin)
//
// stepMult = spm[n] / spm[n-1]  — per-step ratio between consecutive levels
//   e.g. spm: 1.1 → 1.2 → 1.3 → 1.4 → 1.5
//        steps:   ×1.09   ×1.08   ×1.08   ×1.07  (gentle, not compounding)
//
// incMin = max(0.01, base × 0.15) — guarantees visible growth each level
// trunc4 applied at every step — floor to 4 decimal places, never rounds up
function trunc4(v) {
  return Math.trunc(v * 10000) / 10000;
}

function computeSkillPowerLevels(baseSkillPower, spmByLevel) {
  const incMin = Math.max(0.01, baseSkillPower * 0.15);
  const result = {};
  let prev = baseSkillPower; // L1 = raw base
  for (let lv = 1; lv <= 5; lv++) {
    if (lv === 1) {
      result[lv] = trunc4(prev);
    } else {
      // Relative per-step multiplier — avoids exponential compounding
      const stepMult  = spmByLevel[lv] / spmByLevel[lv - 1];
      const valorReal = prev * stepMult;
      const novo      = Math.max(valorReal, prev + incMin);
      result[lv]      = trunc4(novo);
      prev            = result[lv];
    }
  }
  return result;
}

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
        FLOOR(cb.max_hp * ls.multiplier)::int   AS max_hp,
        FLOOR(cb.atk * ls.multiplier)::int       AS atk,
        cb.atk_speed::float,
        cb.crit_chance::float,
        cb.crit_rate::float,
        cb.skill_power::float                    AS base_skill_power,
        ls.skill_power_multiplier::float
      FROM characters c
      JOIN characters_base cb ON cb.character_id = c.id
      JOIN skills          sk ON sk.character_id = c.id
      CROSS JOIN level_scale ls
      ORDER BY c.id, ls.level
    `;

    // ── First pass: collect base stats and spm per level ──────────────────
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
          _baseSkillPower: r.base_skill_power,
          _spmByLevel: {},
          levels: {},
        };
      }
      map[r.cid]._spmByLevel[r.level] = r.skill_power_multiplier;
      map[r.cid].levels[r.level] = {
        max_hp: r.max_hp,
        atk: r.atk,
        atk_speed: r.atk_speed,
        crit_chance: r.crit_chance,
        crit_rate: r.crit_rate,
        skill_power: null, // filled below
      };
    }

    // ── Second pass: compute iterative skill_power per level ──────────────
    for (const char of Object.values(map)) {
      const spLevels = computeSkillPowerLevels(char._baseSkillPower, char._spmByLevel);
      for (let lv = 1; lv <= 5; lv++) {
        if (char.levels[lv]) char.levels[lv].skill_power = spLevels[lv];
      }
      delete char._baseSkillPower;
      delete char._spmByLevel;
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

    // ── Phase 2: PvP tables ───────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS matches (
        id           TEXT        PRIMARY KEY,
        player1      TEXT        NOT NULL,
        player2      TEXT,
        wager_hive   NUMERIC(10,3) NOT NULL DEFAULT 0,
        wager_type   TEXT        NOT NULL DEFAULT 'HIVE',
        status       TEXT        NOT NULL DEFAULT 'waiting',
        winner       TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at  TIMESTAMPTZ
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS match_teams (
        match_id      TEXT        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        player        TEXT        NOT NULL,
        battle_num    INT         NOT NULL DEFAULT 1,
        team_json     JSONB       NOT NULL,
        submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (match_id, player, battle_num)
      )
    `;

    // Migrate existing match_teams table: add battle_num column and fix PK if needed
    await sql`
      ALTER TABLE match_teams ADD COLUMN IF NOT EXISTS battle_num INT NOT NULL DEFAULT 1
    `.catch(() => {/* column already exists */});

    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'match_teams_pkey'
            AND conrelid = 'match_teams'::regclass
            AND array_length(conkey, 1) = 2
        ) THEN
          ALTER TABLE match_teams DROP CONSTRAINT match_teams_pkey;
          ALTER TABLE match_teams ADD PRIMARY KEY (match_id, player, battle_num);
        END IF;
      END $$
    `.catch(() => {/* already migrated */});

    await sql`
      CREATE TABLE IF NOT EXISTS match_transactions (
        tx_id        TEXT        PRIMARY KEY,
        match_id     TEXT        REFERENCES matches(id),
        player       TEXT        NOT NULL,
        amount       NUMERIC(10,3) NOT NULL,
        direction    TEXT        NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
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

// ══════════════════════════════════════════════════════════════════════════════
//  MATCHMAKING — Socket.io
// ══════════════════════════════════════════════════════════════════════════════

// In-memory state (survives restarts only if single Railway instance)
// queue: Map<username, { socket, wager, wagerType, joinedAt }>
const matchQueue   = new Map();
// activeMatches: Map<matchId, { p1, p2, wager, wagerType, teams:{}, status }>
const activeMatches = new Map();

function makeMatchId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Notify queue size to all waiting players
function broadcastQueueSize() {
  for (const [, entry] of matchQueue) {
    entry.socket.emit('queue_update', { position: 1, queueSize: matchQueue.size });
  }
}

// Mirror a board's columns (col 0 ↔ col 2) so p2's "front" (col 2 in pfield)
// becomes col 0 for the simulation (which expects enemy front at col 0).
function mirrorBoard(board) {
  if (!board) return board;
  const result = Array(9).fill(null);
  board.forEach((u, i) => {
    if (!u) return;
    result[Math.floor(i / 3) * 3 + (2 - (i % 3))] = u;
  });
  return result;
}

// ── Match pairing ─────────────────────────────────────────────────────────────
function tryMatch() {
  if (matchQueue.size < 2) return;

  // Find the first two compatible players (not necessarily entries 0 and 1)
  const entries = [...matchQueue.entries()];
  let matched = null;
  outer: for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [u1, e1] = entries[i];
      const [u2, e2] = entries[j];
      // Only match on wager amount — payout type is each player's own preference
      if (e1.wager === e2.wager) {
        matched = { u1, e1, u2, e2 };
        break outer;
      }
    }
  }
  if (!matched) {
    // Log the comparison so we can diagnose mismatches
    if (entries.length >= 2) {
      const [[u1, e1], [u2, e2]] = entries;
      console.log(
        `⚠️  tryMatch: no compatible pair found. ` +
        `${u1}[wager=${e1.wager}] vs ${u2}[wager=${e2.wager}]`
      );
    }
    return;
  }

  const { u1, e1, u2, e2 } = matched;

  matchQueue.delete(u1);
  matchQueue.delete(u2);

  const matchId    = makeMatchId();
  const fmt        = e1.format || 5;
  const winsNeed   = fmt === 10 ? 6 : Math.ceil(fmt / 2);
  const needsPayment = e1.wager > 0 && !!HIVE_GAME_ACCOUNT;
  const initStatus   = needsPayment ? 'waiting_payments' : 'waiting_teams';

  const matchData = {
    matchId,
    p1: u1, p2: u2,
    s1: e1.socket, s2: e2.socket,
    wager: e1.wager,
    format: fmt,
    winsNeeded: winsNeed,
    battleNum: 1,
    scores: { [u1]: 0, [u2]: 0 },
    // Payment tracking (populated by wager_sent handler)
    payments:    { [u1]: false, [u2]: false },
    payoutPrefs: { [u1]: 'liquid', [u2]: 'liquid' },
    teams: {},
    status: initStatus,
    createdAt: Date.now(),
  };
  activeMatches.set(matchId, matchData);

  sql`INSERT INTO matches (id, player1, player2, wager_hive, wager_type, status)
      VALUES (${matchId}, ${u1}, ${u2}, ${e1.wager}, 'HIVE', ${initStatus})`
    .catch(err => console.error('[match DB insert]', err.message));

  e1.socket.join(matchId);
  e2.socket.join(matchId);

  io.to(matchId).emit('match_found', {
    matchId,
    p1: u1, p2: u2,
    opponents: { [u1]: u2, [u2]: u1 },
    wager: e1.wager,
    format: fmt,
    needsPayment,
    gameAccount: HIVE_GAME_ACCOUNT,
    timeLimitMs: needsPayment ? 120_000 : 3 * 60 * 1000,
  });

  console.log(`⚔️  Match ${matchId} | ${u1} vs ${u2} | BO${fmt} | ${e1.wager} HIVE${needsPayment ? ' [payment required]' : ' [free]'}`);

  if (needsPayment) {
    // Payment timeout: 2 min to confirm both wagers
    setTimeout(() => {
      const m = activeMatches.get(matchId);
      if (!m || m.status !== 'waiting_payments') return;
      const unpaid = [u1, u2].filter(p => !m.payments[p]);
      io.to(matchId).emit('match_cancelled', {
        reason: `Payment timeout — ${unpaid.join(', ')} did not confirm wager in time.`,
        refundNeeded: [u1, u2].filter(p => m.payments[p]), // paid players need refund
      });
      activeMatches.delete(matchId);
      console.log(`⏰ Payment timeout for match ${matchId} — unpaid: ${unpaid.join(', ')}`);
    }, 120_000);
  } else {
    // No payment needed — arm team submission forfeit timer immediately
    armForfeitTimer(matchId, u1, u2, ROUND_TIME_MS);
  }

  broadcastQueueSize();
}

const ROUND_TIME_MS = 2 * 60 * 1000; // 2 minutes per round

function armForfeitTimer(matchId, u1, u2, ms) {
  const m = activeMatches.get(matchId);
  if (!m) return;
  // Cancel any previously running timer for this match
  if (m.forfeitTimer) clearTimeout(m.forfeitTimer);
  // Notify clients so they can show a countdown
  io.to(matchId).emit('round_timer', { ms });
  m.forfeitTimer = setTimeout(() => {
    const m = activeMatches.get(matchId);
    if (!m || m.status !== 'waiting_teams') return;
    const missing = [u1, u2].filter(u => !m.teams[u]);
    if (missing.length === 2) {
      io.to(matchId).emit('match_cancelled', { reason: 'No teams submitted in time.' });
      activeMatches.delete(matchId);
    } else {
      const forfeitWinner = [u1, u2].find(u => m.teams[u]);
      forfeitBattle(matchId, forfeitWinner);
    }
  }, ms);
}

// ── Resolve one battle round (called when both teams submitted) ───────────────
function resolveBattleRound(matchId) {
  const m = activeMatches.get(matchId);
  if (!m || m.status !== 'waiting_teams') return;
  m.status = 'resolving';

  const p1Board = m.teams[m.p1];
  const p2Board = m.teams[m.p2];

  let result, roundWinner;
  try {
    // p1 submits normally (front = col 2, simulation expects player front at col 2 ✓)
    // p2 builds on their own pfield (front = col 2) but simulation expects enemy front at col 0,
    // so we mirror p2's board before simulating.
    result = simulate(p1Board, mirrorBoard(p2Board));
    roundWinner = result.winner === 'p' ? m.p1 : m.p2;
  } catch (err) {
    console.error('[simulate]', err.message);
    io.to(matchId).emit('match_cancelled', { reason: 'Simulation error.' });
    activeMatches.delete(matchId);
    return;
  }

  m.scores[roundWinner]++;
  const seriesOver =
    m.scores[m.p1] >= m.winsNeeded ||
    m.scores[m.p2] >= m.winsNeeded ||
    m.battleNum >= m.format;
  const matchWinner = seriesOver
    ? (m.scores[m.p1] >= m.winsNeeded ? m.p1 : m.p2)
    : null;

  console.log(
    `⚔️  Round ${m.battleNum} | ${roundWinner} wins | ` +
    `${m.p1}:${m.scores[m.p1]} ${m.p2}:${m.scores[m.p2]}` +
    (seriesOver ? ` | Series over → ${matchWinner}` : '')
  );

  const roundPayload = {
    matchId,
    battleNum: m.battleNum,
    p1: m.p1, p2: m.p2,
    p1Board, p2Board,
    roundWinner,
    scores: { [m.p1]: m.scores[m.p1], [m.p2]: m.scores[m.p2] },
    seriesOver,
    matchWinner,
    evs:   result.evs,
    umap:  result.umap,
    stats: result.stats,
  };

  // Store so a reconnecting player can receive it via rejoin_match
  m.lastRoundResult = roundPayload;

  io.to(matchId).emit('round_result', roundPayload);

  if (seriesOver) {
    sql`UPDATE matches SET status='done', winner=${matchWinner}, resolved_at=now()
        WHERE id=${matchId}`
      .catch(err => console.error('[match update]', err.message));

    // ── Send prize if match had a real wager ──────────────────────────────────
    if (m.wager > 0 && HIVE_GAME_ACCOUNT) {
      const pot        = m.wager * 2;
      const payoutPref = m.payoutPrefs[matchWinner] || 'liquid';
      sendHivePrize(matchWinner, pot, payoutPref, matchId).then(result => {
        if (result.ok) {
          io.to(matchId).emit('prize_sent', {
            to: matchWinner,
            amount: result.amount,
            type: result.payoutPref,
          });
        } else {
          io.to(matchId).emit('prize_error', {
            message: 'Prize transfer failed — contact support.',
            error: result.error,
          });
        }
      });
    }

    activeMatches.delete(matchId);
  } else {
    m.battleNum++;
    m.teams = {};
    m.status = 'waiting_teams';
    // Clear so a reconnecting player doesn't receive the previous battle's result
    // after the new battle has already started. The fresh round_result for the
    // new battle will be stored as soon as both teams are resolved.
    m.lastRoundResult = null;
    // Reset the forfeit timer for the new round
    armForfeitTimer(matchId, m.p1, m.p2, ROUND_TIME_MS);
  }
}

// ── Forfeit one round ─────────────────────────────────────────────────────────
function forfeitBattle(matchId, winner) {
  const m = activeMatches.get(matchId);
  if (!m) return;
  m.scores[winner]++;
  const seriesOver =
    m.scores[m.p1] >= m.winsNeeded ||
    m.scores[m.p2] >= m.winsNeeded ||
    m.battleNum >= m.format;
  io.to(matchId).emit('round_result', {
    matchId,
    battleNum: m.battleNum,
    p1: m.p1, p2: m.p2,
    p1Board: null, p2Board: null,
    roundWinner: winner,
    scores: { [m.p1]: m.scores[m.p1], [m.p2]: m.scores[m.p2] },
    seriesOver,
    matchWinner: seriesOver ? winner : null,
    evs: [], umap: {}, stats: {},
    reason: 'forfeit',
  });
  if (seriesOver) {
    // Send prize to forfeit winner if match had a wager
    if (m.wager > 0 && HIVE_GAME_ACCOUNT) {
      const pot = m.wager * 2;
      const payoutPref = m.payoutPrefs[winner] || 'liquid';
      sendHivePrize(winner, pot, payoutPref, matchId).then(result => {
        if (result.ok) {
          io.to(matchId).emit('prize_sent', { to: winner, amount: result.amount, type: result.payoutPref });
        } else {
          io.to(matchId).emit('prize_error', { error: result.error });
        }
      });
    }
    activeMatches.delete(matchId);
  } else {
    m.battleNum++;
    m.teams = {};
    m.status = 'waiting_teams';
    m.lastRoundResult = null;
    // Reset the forfeit timer for the new round
    armForfeitTimer(matchId, m.p1, m.p2, ROUND_TIME_MS);
  }
}

// ── Socket.io event handlers ───────────────────────────────────────────────────
io.on('connection', socket => {
  let connectedUser = null;

  // Player joins matchmaking queue
  socket.on('join_queue', ({ username, wager, wagerType, format }) => {
    if (!username || typeof wager !== 'number' || wager < 0) {
      socket.emit('error', { message: 'Invalid queue parameters.' });
      return;
    }

    // If this player already has an active match (reconnected before redirecting),
    // resend match_found so the client can redirect correctly.
    for (const [, m] of activeMatches) {
      if (m.p1 === username || m.p2 === username) {
        connectedUser = username;
        if (m.p1 === username) m.s1 = socket; else m.s2 = socket;
        socket.join(m.matchId);
        const reconNeedsPayment = m.wager > 0 && !!HIVE_GAME_ACCOUNT && m.status === 'waiting_payments';
        socket.emit('match_found', {
          matchId: m.matchId,
          p1: m.p1, p2: m.p2,
          opponents: { [m.p1]: m.p2, [m.p2]: m.p1 },
          wager: m.wager,
          format: m.format,
          needsPayment: reconNeedsPayment,
          gameAccount: reconNeedsPayment ? HIVE_GAME_ACCOUNT : undefined,
          timeLimitMs: reconNeedsPayment ? 120_000 : 3 * 60 * 1000,
        });
        console.log(`📨 Resent match_found to ${username} (reconnected on lobby)`);
        return;
      }
    }

    // Upsert: if player has a stale entry (e.g. reconnect after F5), replace it
    if (matchQueue.has(username)) {
      console.log(`🔄 ${username} already in queue — replacing stale entry`);
      matchQueue.delete(username);
    }
    connectedUser = username;
    matchQueue.set(username, {
      socket, wager,
      wagerType: wagerType || 'HIVE',
      format: format || 5,
      joinedAt: Date.now(),
    });
    socket.emit('queued', { queueSize: matchQueue.size });
    console.log(`🔍 ${username} joined queue | ${wager} ${wagerType} BO${format} | size: ${matchQueue.size}`);
    tryMatch();
    broadcastQueueSize();
  });

  // Rejoin after page redirect (battle.html connects with saved matchId)
  socket.on('rejoin_match', ({ matchId, username }) => {
    const m = activeMatches.get(matchId);
    if (!m) { socket.emit('rejoin_error', { message: 'Match not found or already finished.' }); return; }
    if (m.p1 !== username && m.p2 !== username) {
      socket.emit('rejoin_error', { message: 'You are not part of this match.' }); return;
    }
    connectedUser = username;
    if (m.p1 === username) m.s1 = socket;
    else m.s2 = socket;
    socket.join(matchId);
    socket.emit('rejoin_ok', {
      matchId,
      p1: m.p1, p2: m.p2,
      format: m.format,
      battleNum: m.battleNum,
      scores: { [m.p1]: m.scores[m.p1], [m.p2]: m.scores[m.p2] },
    });
    // If this player missed a round_result while disconnected, resend it
    if (m.lastRoundResult) {
      socket.emit('round_result', m.lastRoundResult);
      console.log(`📨 Resent round_result to ${username} (missed while offline)`);
    }
    console.log(`🔄 ${username} rejoined match ${matchId}`);
  });

  // Player submits their team for the current round
  socket.on('submit_team', ({ matchId, board }) => {
    const m = activeMatches.get(matchId);
    if (!m) { socket.emit('error', { message: 'Match not found.' }); return; }
    if (m.status !== 'waiting_teams') { socket.emit('error', { message: 'Not accepting teams right now.' }); return; }
    if (!connectedUser) { socket.emit('error', { message: 'Not authenticated.' }); return; }
    if (connectedUser !== m.p1 && connectedUser !== m.p2) {
      socket.emit('error', { message: 'You are not in this match.' }); return;
    }
    if (!Array.isArray(board) || board.length !== 9) {
      socket.emit('error', { message: 'Invalid board format.' }); return;
    }
    if (m.teams[connectedUser]) {
      socket.emit('error', { message: 'Team already submitted.' }); return;
    }

    m.teams[connectedUser] = board;

    sql`INSERT INTO match_teams (match_id, player, battle_num, team_json)
        VALUES (${matchId}, ${connectedUser}, ${m.battleNum}, ${JSON.stringify(board)})`
      .catch(err => console.error('[team DB insert]', err.message));

    socket.emit('team_submitted', { matchId });
    console.log(`📋 ${connectedUser} submitted team for match ${matchId} round ${m.battleNum}`);

    if (m.teams[m.p1] && m.teams[m.p2]) {
      resolveBattleRound(matchId);
    } else {
      socket.to(matchId).emit('opponent_ready', { matchId });
    }
  });

  // Leave matchmaking queue
  socket.on('leave_queue', () => {
    if (connectedUser) {
      matchQueue.delete(connectedUser);
      console.log(`🚪 ${connectedUser} left queue`);
      broadcastQueueSize();
    }
  });

  // ── Player confirms HIVE wager was sent ────────────────────────────────────
  // Emitted after Keychain broadcasts the transfer on the client.
  // Server verifies the transaction on-chain, records the payout preference,
  // and emits payments_confirmed once both players have paid.
  socket.on('wager_sent', async ({ matchId, txId }) => {
    const m = activeMatches.get(matchId);
    if (!m) { socket.emit('wager_failed', { message: 'Match not found.' }); return; }
    if (m.status !== 'waiting_payments') { socket.emit('wager_failed', { message: 'Match not in payment phase.' }); return; }
    if (!connectedUser) { socket.emit('wager_failed', { message: 'Not authenticated.' }); return; }
    if (connectedUser !== m.p1 && connectedUser !== m.p2) {
      socket.emit('wager_failed', { message: 'You are not in this match.' }); return;
    }
    if (m.payments[connectedUser]) { socket.emit('wager_failed', { message: 'Already paid.' }); return; }

    console.log(`💳 Verifying payment from ${connectedUser} for match ${matchId} | txId: ${txId}`);
    socket.emit('payment_verifying', { message: 'Verifying transaction on blockchain...' });

    try {
      const { payoutPref } = await verifyHivePayment(txId, connectedUser, m.wager, matchId);
      m.payments[connectedUser]    = true;
      m.payoutPrefs[connectedUser] = payoutPref;
      console.log(`✅ Payment confirmed: ${connectedUser} | pref: ${payoutPref}`);

      // Notify opponent
      socket.to(matchId).emit('opponent_paid', { username: connectedUser });

      // Check if both players have now paid
      if (m.payments[m.p1] && m.payments[m.p2]) {
        m.status = 'waiting_teams';
        io.to(matchId).emit('payments_confirmed', { matchId });
        console.log(`✅ Both players paid for match ${matchId} — starting match`);
        // Arm the team submission forfeit timer now that payments are confirmed
        armForfeitTimer(matchId, m.p1, m.p2, ROUND_TIME_MS);
      } else {
        socket.emit('payment_accepted', { message: 'Wager confirmed! Waiting for opponent...' });
      }
    } catch (err) {
      console.error(`[wager_sent] Verification failed for ${connectedUser}:`, err.message);
      socket.emit('wager_failed', { message: `Payment verification failed: ${err.message}` });
    }
  });

  socket.on('disconnect', () => {
    if (connectedUser) {
      matchQueue.delete(connectedUser);
      broadcastQueueSize();
      // Notify opponent if in active match
      for (const [, m] of activeMatches) {
        if (m.p1 === connectedUser || m.p2 === connectedUser) {
          socket.to(m.matchId).emit('opponent_disconnected', { username: connectedUser });
          break;
        }
      }
    }
  });
});

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`⚔️  Horizon Forge running on http://localhost:${PORT}`);
  console.log(`   DB:      ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL not set'}`);
  console.log(`   Sockets: ✅ Socket.io ready`);
  console.log(`   Phase 2: ✅ Matchmaking active`);
});