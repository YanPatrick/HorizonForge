import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { createHmac, timingSafeEqual, randomBytes, randomUUID } from 'crypto';
import { createRequire } from 'module';
import { simulate } from '../shared/simulate.js';
import { Client as HiveClient, PrivateKey as HiveKey, Signature, cryptoUtils } from '@hiveio/dhive';

const _require = createRequire(import.meta.url);
const APP_VERSION = _require('../package.json').version;

// ── Hive configuration ────────────────────────────────────────────────────────
const HIVE_GAME_ACCOUNT = process.env.HIVE_GAME_ACCOUNT || '';
const HIVE_ACTIVE_KEY = process.env.HIVE_ACTIVE_KEY || '';
const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];
const PAYOUT_RATE_FALLBACK = { liquid: 0.80, stake: 0.90 }; // fallback if DB unavailable

// ── Auth token (HMAC-SHA256, no extra deps) ───────────────────────────────────
const AUTH_SECRET = process.env.AUTH_SECRET || (() => {
  const s = randomBytes(32).toString('hex');
  console.warn('[auth] AUTH_SECRET not set — ephemeral secret generated (sessions reset on restart)');
  return s;
})();
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function makeToken(username) {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${expires}`;
  const mac = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}:${mac}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const first = token.indexOf(':');
  const last = token.lastIndexOf(':');
  if (first === last) return null;                        // needs at least 2 colons
  const username = token.slice(0, first);
  const expiresStr = token.slice(first + 1, last);
  const mac = token.slice(last + 1);
  const expires = parseInt(expiresStr, 10);
  if (!username || isNaN(expires) || Date.now() > expires) return null;
  const payload = `${username}:${expires}`;
  const expected = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  try {
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch {
    return null;
  }
  return username;
}

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
 *
 * Strategy: scan the sender's recent account history for a matching transfer.
 * This uses condenser_api.get_account_history which is universally supported
 * by all Hive nodes (unlike get_transaction which requires an optional plugin).
 */
async function verifyHivePayment(_txId, from, wager, matchId, maxAttempts = 15) {
  const expectedPrefix = `battle_${matchId}_`;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Fetch last 50 ops from sender — enough to find a very recent transfer
      const history = await hiveRpc('condenser_api.get_account_history', [from, -1, 50]);
      if (!Array.isArray(history)) throw new Error('tx_not_found');

      // Walk history newest-first
      for (let i = history.length - 1; i >= 0; i--) {
        const [, entry] = history[i];
        const [opType, op] = entry.op;
        if (opType !== 'transfer') continue;
        if (op.to.toLowerCase() !== HIVE_GAME_ACCOUNT.toLowerCase()) continue;
        if (op.from.toLowerCase() !== from.toLowerCase()) continue;
        const sent = parseFloat(op.amount);
        if (Math.abs(sent - wager) > 0.001) continue;
        if (!op.memo.startsWith(expectedPrefix)) continue;
        const payoutPref = op.memo.slice(expectedPrefix.length);
        if (!['liquid', 'stake'].includes(payoutPref)) continue;
        // Found a valid matching transfer
        console.log(`✅ Payment verified via account history: ${from} → ${HIVE_GAME_ACCOUNT} | ${op.amount} | ${op.memo}`);
        return { payoutPref };
      }
      throw new Error('tx_not_found');
    } catch (err) {
      lastErr = err;
      if (err.message === 'tx_not_found') {
        await sleep(3000);
        continue;
      }
      throw err; // non-retriable
    }
  }
  throw new Error(`Payment verification timed out after 45s: ${lastErr?.message}`);
}

/**
 * Verify an on-chain transfer for a shop purchase.
 * Memo must be exactly `shop_{itemId}`.
 * Retries for up to 60s.
 */
async function verifyShopPayment(from, price, itemId, maxAttempts = 20) {
  const expectedMemo = `shop_${itemId}`;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const history = await hiveRpc('condenser_api.get_account_history', [from, -1, 50]);
      if (!Array.isArray(history)) throw new Error('tx_not_found');
      for (let i = history.length - 1; i >= 0; i--) {
        const [, entry] = history[i];
        const [opType, op] = entry.op;
        if (opType !== 'transfer') continue;
        if (op.to.toLowerCase() !== HIVE_GAME_ACCOUNT.toLowerCase()) continue;
        if (op.from.toLowerCase() !== from.toLowerCase()) continue;
        if (!op.amount.endsWith(' HIVE')) continue;
        const sent = parseFloat(op.amount);
        if (Math.abs(sent - price) > 0.001) continue;
        if (op.memo !== expectedMemo) continue;
        console.log(`✅ Shop payment verified: ${from} → ${HIVE_GAME_ACCOUNT} | ${op.amount} | ${op.memo}`);
        return true;
      }
      throw new Error('tx_not_found');
    } catch (err) {
      lastErr = err;
      if (err.message === 'tx_not_found') { await sleep(3000); continue; }
      throw err;
    }
  }
  throw new Error(`Shop payment timed out: ${lastErr?.message}`);
}

/**
 * Refund a wager back to a player (called on payment timeout or match cancellation).
 */
async function refundHiveWager(to, amount, matchId) {
  if (!HIVE_GAME_ACCOUNT || !HIVE_ACTIVE_KEY) {
    console.warn('[refund] Hive credentials not set — refund skipped');
    return { ok: false, error: 'Server not configured for HIVE payments' };
  }
  try {
    const key = HiveKey.fromString(HIVE_ACTIVE_KEY);
    await hiveClient().broadcast.transfer({
      from: HIVE_GAME_ACCOUNT,
      to,
      amount: `${parseFloat(amount).toFixed(3)} HIVE`,
      memo: `Horizon Forge refund — match ${matchId} cancelled`,
    }, key);
    console.log(`↩️  Refund sent: ${amount} HIVE → ${to} | match ${matchId}`);
    return { ok: true };
  } catch (err) {
    console.error(`[refund] Failed for ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send the prize to the winner.
 *
 * Payout rate is read from `horizon_forge_details` (keys
 *   `percent_payout_liquid`, `percent_payout_stake`) so the treasury cut can
 * be tuned without redeploys. If the keys are missing the fallback below
 * (PAYOUT_RATE_FALLBACK) is used.
 *
 *  - 'liquid' → standard HIVE transfer
 *  - 'stake'  → transfer_to_vesting / power-up
 *
 * Returns { ok, amount, payoutPref } or { ok: false, error }.
 */
async function sendHivePrize(winner, pot, payoutPref, matchId) {
  if (!HIVE_GAME_ACCOUNT || !HIVE_ACTIVE_KEY) {
    console.warn('[prize] Hive credentials not set — prize skipped');
    return { ok: false, error: 'Server not configured for HIVE payments' };
  }
  let rate = PAYOUT_RATE_FALLBACK[payoutPref] ?? 0.80;
  try {
    const cfgKey = payoutPref === 'stake' ? 'percent_payout_stake' : 'percent_payout_liquid';
    const [row] = await sql`SELECT value FROM horizon_forge_details WHERE key = ${cfgKey}`;
    if (row) rate = Number(row.value) / 100;
  } catch (e) {
    console.warn('[prize] Could not fetch payout rate from DB — using fallback:', rate);
  }
  const amount = (pot * rate).toFixed(3);
  try {
    const key = HiveKey.fromString(HIVE_ACTIVE_KEY);
    if (payoutPref === 'stake') {
      await hiveClient().broadcast.sendOperations(
        [['transfer_to_vesting', { from: HIVE_GAME_ACCOUNT, to: winner, amount: `${amount} HIVE` }]],
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
app.set('trust proxy', 1); // Railway/Heroku sit behind 1 reverse proxy
const httpServer = createServer(app);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Em produção define CLIENT_URL (ex: https://horizonforge.com).
// Em dev sem CLIENT_URL, permite as origens do Vite e do Express local.
const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});

// Security headers (defense in depth):
//   • X-Content-Type-Options: nosniff
//   • Strict-Transport-Security
//   • X-Frame-Options: SAMEORIGIN, X-DNS-Prefetch-Control, Referrer-Policy, etc.
// CSP is intentionally disabled — the app loads scripts dynamically (battle.js,
// bot-ai.js, simulate.js, socket.io) and would need a curated `script-src` /
// `connect-src` policy that allows the Hive RPC nodes and the Keychain bridge.
// Enabling it correctly is its own audit; better to ship the rest of helmet
// now than to ship a broken CSP that requires emergency disablement.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
// Em produção serve o build do React; em dev o Vite roda separado
const CLIENT_DIST = join(__dirname, '../public/dist');
const isDev = process.env.NODE_ENV !== 'production';

// Static file serving strategy:
//   • Vite-hashed assets (/assets/index-HASH.js): immutable, cached 1 year
//   • Everything else (HTML, CSS, JS without hash): never cached, no ETag, no Last-Modified
//     Disabling ETag + Last-Modified is critical — without them the server cannot
//     return 304 Not Modified, so every request always gets a fresh 200 response.
const noCacheOpts = {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },
};

if (!isDev) {
  // Assets do Vite (hashados → cache forte OK)
  app.use('/assets', express.static(join(CLIENT_DIST, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // React build (index.html → sem cache)
  app.use(express.static(CLIENT_DIST, noCacheOpts));
}

// ⚠️ NÃO servir public inteiro (evita HTML antigo)
// Em vez disso, só sirva o necessário:
app.use('/images', express.static(join(__dirname, '../public/images'), noCacheOpts));
app.use('/heroes', express.static(join(__dirname, '../public/heroes'), noCacheOpts));
// Shared (se necessário)
app.use('/shared', express.static(join(__dirname, '../shared'), noCacheOpts));
app.use('/js', express.static(join(__dirname, '../public/js'), noCacheOpts));
app.use('/css', express.static(join(__dirname, '../public/css'), noCacheOpts));
app.use('/mobile.js', express.static(join(__dirname, '../public/mobile.js'), noCacheOpts));
app.use('/mobile.css', express.static(join(__dirname, '../public/mobile.css'), noCacheOpts));
// Unique ID generated at every server boot — used by the client to detect
// a new deploy and force a hard reload instead of serving stale bfcache pages.
// The full version key combines the semantic version (from package.json, bumped
// manually per release) with a boot timestamp so that EITHER a version bump OR
// a new Railway deploy will trigger a client reload.
const BUILD_ID = Date.now().toString(36);
const VERSION_KEY = `${APP_VERSION}-${BUILD_ID}`;

app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ v: VERSION_KEY, app: APP_VERSION, hivePay: !!(HIVE_GAME_ACCOUNT && HIVE_ACTIVE_KEY) });
});

// ── DB connection ─────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL);

// ── Admin auth (also used by /api/migrate and /api/admin/*) ───────────────────
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

function requireAdmin(req, res) {
  if (!ADMIN_SECRET) { res.status(503).json({ error: 'Admin endpoint not configured (set ADMIN_SECRET)' }); return false; }
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}

// ── Server-side stat table & board materialization ───────────────────────────
// Critical security boundary: the client must NOT be trusted for unit stats.
// `submit_team` only accepts {cid, lv, id} per slot; the server reconstructs
// atk/maxHp/skillPower/etc. from the database before passing to simulate().
// Without this, any client could submit { atk: 999999, maxHp: 999999 } and
// auto-win every PvP match — including paid HIVE wagers.

const STAT_CACHE_TTL_MS = 10 * 60 * 1000; // refresh every 10 min
let _statsCache = null;
let _statsLoadedAt = 0;

async function loadStatsTable() {
  const rows = await sql`
    SELECT
      c.cid,
      c.name,
      c.icon,
      c.target_type,
      ls.level,
      FLOOR(cb.max_hp * ls.multiplier)::int   AS max_hp,
      FLOOR(cb.atk * ls.multiplier)::int      AS atk,
      cb.atk_speed::float                     AS atk_speed,
      cb.crit_chance::float                   AS crit_chance,
      cb.crit_rate::float                     AS crit_rate,
      cb.skill_power::float                   AS base_skill_power,
      ls.skill_power_multiplier::float        AS spm
    FROM characters c
    JOIN characters_base cb ON cb.character_id = c.id
    CROSS JOIN level_scale ls
    ORDER BY c.cid, ls.level
  `;
  // First pass: bucket by cid
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.cid)) {
      map.set(r.cid, {
        cid: r.cid,
        name: r.name,
        icon: r.icon,
        target_type: r.target_type,
        _baseSkillPower: r.base_skill_power,
        _spmByLevel: {},
        levels: {},
      });
    }
    const ch = map.get(r.cid);
    ch._spmByLevel[r.level] = r.spm;
    ch.levels[r.level] = {
      max_hp: r.max_hp,
      atk: r.atk,
      atk_speed: r.atk_speed,
      crit_chance: r.crit_chance,
      crit_rate: r.crit_rate,
      skill_power: null, // filled below
    };
  }
  // Second pass: same iterative skill_power formula used by /api/characters
  for (const ch of map.values()) {
    const sp = computeSkillPowerLevels(ch._baseSkillPower, ch._spmByLevel);
    for (let lv = 1; lv <= 5; lv++) {
      if (ch.levels[lv]) ch.levels[lv].skill_power = sp[lv];
    }
    delete ch._baseSkillPower;
    delete ch._spmByLevel;
  }
  return map;
}

async function getStatsTable() {
  if (!_statsCache || Date.now() - _statsLoadedAt > STAT_CACHE_TTL_MS) {
    _statsCache = await loadStatsTable();
    _statsLoadedAt = Date.now();
  }
  return _statsCache;
}

// Maximum units a player can deploy at once. Sourced from
// horizon_forge_details.qtd_max_heroes (5 by default), cached for the
// process lifetime — the value is set once at game install and rarely
// retuned. Falls back to 5 if the config row is missing.
let _maxUnitsCap = 5;
async function refreshMaxUnitsCap() {
  try {
    const [row] = await sql`SELECT value FROM horizon_forge_details WHERE key = 'qtd_max_heroes'`;
    if (row) _maxUnitsCap = Math.max(1, Math.min(9, Number(row.value) || 5));
  } catch (e) {
    console.warn('[refreshMaxUnitsCap] using fallback 5:', e.message);
  }
}

function validateClientBoard(board) {
  if (!Array.isArray(board) || board.length !== 9) throw new Error('Board must have 9 slots');
  const seenCids = new Set();
  const seenIds = new Set();
  let nonNull = 0;
  for (const u of board) {
    if (u === null) continue;
    if (!u || typeof u !== 'object') throw new Error('Slot must be unit object or null');
    if (typeof u.cid !== 'string' || u.cid.length === 0 || u.cid.length > 30) throw new Error('Invalid cid');
    if (!Number.isInteger(u.lv) || u.lv < 1 || u.lv > 5) throw new Error('lv must be integer 1..5');
    if (typeof u.id !== 'string' || u.id.length === 0 || u.id.length > 40) throw new Error('Invalid id');
    // One stack per cid — matches the bench/merge mechanic. Without this,
    // a cheater could submit 9× the same hero (the original "client trusts
    // stats" vuln at the count layer).
    if (seenCids.has(u.cid)) throw new Error(`Duplicate cid in board: ${u.cid}`);
    seenCids.add(u.cid);
    if (seenIds.has(u.id)) throw new Error(`Duplicate id in board: ${u.id}`);
    seenIds.add(u.id);
    nonNull++;
  }
  if (nonNull === 0) throw new Error('Board cannot be empty');
  if (nonNull > _maxUnitsCap) throw new Error(`Too many units (max ${_maxUnitsCap})`);
}

// Strip the client's submitted board down to the only fields we trust
// (cid, lv, id). Stats are looked up from the DB at resolve time.
function stripBoard(board) {
  return board.map(u => u ? { cid: u.cid, lv: u.lv, id: u.id } : null);
}

// Build a simulator-ready board by joining the trusted (cid, lv, id) tuple
// with the authoritative stats from the database.
async function materializeBoard(board) {
  const stats = await getStatsTable();
  return board.map((u) => {
    if (!u) return null;
    const ch = stats.get(u.cid);
    if (!ch) throw new Error(`Unknown character cid: ${u.cid}`);
    const lvStats = ch.levels[u.lv];
    if (!lvStats) throw new Error(`No stats for ${u.cid} at level ${u.lv}`);
    return {
      id: u.id,
      cid: u.cid,
      lv: u.lv,
      name: ch.name,
      ico: ch.icon,
      tp: ch.target_type,
      atk: Math.floor(lvStats.atk),
      maxHp: lvStats.max_hp,
      hp: lvStats.max_hp,
      spd: lvStats.atk_speed,
      critChance: lvStats.crit_chance,
      critRate: lvStats.crit_rate,
      skillPower: lvStats.skill_power,
    };
  });
}

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
      const stepMult = spmByLevel[lv] / spmByLevel[lv - 1];
      const valorReal = prev * stepMult;
      const novo = Math.max(valorReal, prev + incMin);
      result[lv] = trunc4(novo);
      prev = result[lv];
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
        c.url_portrait,
        c.role,
        c.color_hex,
        c.bg_gradient,
        c.target_type,
        sk.skill_key,
        sk.name        AS skill_name,
        sk.description AS skill_desc,
        sk.lore,
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
          url_portrait: r.url_portrait || '',
          role: r.role,
          color_hex: r.color_hex,
          bg_gradient: r.bg_gradient,
          target_type: r.target_type,
          skill: {
            key: r.skill_key,
            name: r.skill_name,
            description: r.skill_desc,
            lore: r.lore,
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
 * Requer ADMIN_SECRET no header `x-admin-secret`.
 */
// Swallow only "already exists" errors during migrations:
//   42701 = duplicate_column, 42P07 = duplicate_table, 42710 = duplicate_object
// Anything else means the schema is in an unexpected state and should fail loud.
const BENIGN_MIGRATION_ERRORS = new Set(['42701', '42P07', '42710']);
async function safeMigrate(promise, label) {
  try {
    await promise;
  } catch (err) {
    if (err && BENIGN_MIGRATION_ERRORS.has(err.code)) return;
    console.error(`[migrate ${label}]`, err.code || '', err.message);
    throw err;
  }
}

app.post('/api/migrate', async (req, res) => {
  if (!requireAdmin(req, res)) return;
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
        lore         TEXT,
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
        format       INT         NOT NULL DEFAULT 5,
        status       TEXT        NOT NULL DEFAULT 'waiting',
        winner       TEXT,
        score_p1     INT         NOT NULL DEFAULT 0,
        score_p2     INT         NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at  TIMESTAMPTZ
      )
    `;

    // Migrate: add new columns to existing matches table
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS format    INT NOT NULL DEFAULT 5`, 'matches.format');
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_p1  INT NOT NULL DEFAULT 0`, 'matches.score_p1');
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_p2  INT NOT NULL DEFAULT 0`, 'matches.score_p2');
    // Persist active-match state so a server restart doesn't lose paid wagers.
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS battle_num   INT  NOT NULL DEFAULT 1`, 'matches.battle_num');
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS payments     JSONB NOT NULL DEFAULT '{}'::jsonb`, 'matches.payments');
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS payout_prefs JSONB NOT NULL DEFAULT '{}'::jsonb`, 'matches.payout_prefs');
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS merges       JSONB NOT NULL DEFAULT '{}'::jsonb`, 'matches.merges');
    // Tracks which players have been refunded — prevents double-refund if a
    // crash happens mid-cancellation and rehydrate then re-runs the refund loop.
    await safeMigrate(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS refunded     JSONB NOT NULL DEFAULT '{}'::jsonb`, 'matches.refunded');
    // Add lore column to skills 
    await safeMigrate(sql`ALTER TABLE skills ADD COLUMN IF NOT EXISTS lore TEXT`, 'skills.lore');
    await sql`
      UPDATE skills SET lore = v.lore
      FROM (VALUES
        ('iron_defense',    'The weight of armor is nothing compared to the weight of duty.'),
        ('fireball',        'Fire obeys no one; it only accepts invitations.'),
        ('precise_shot',    'The wind blows, but my arrow chooses its own path.'),
        ('healing',         'Life is a garden that blooms under the right hands.'),
        ('sneak_strike',    'Silence is the last thing my enemies hear.'),
        ('sacred_aura',     'My aura is the shield the gods lent to mortals.'),
        ('chain_lightning', 'Lightning never strikes the same place twice... unless I want it to.'),
        ('fury',            'His fury is the echo of a thousand forgotten battles.')
      ) AS v(skill_key, lore)
      WHERE skills.skill_key = v.skill_key AND skills.lore IS NULL
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
    await safeMigrate(
      sql`ALTER TABLE match_teams ADD COLUMN IF NOT EXISTS battle_num INT NOT NULL DEFAULT 1`,
      'match_teams.battle_num'
    );

    await safeMigrate(sql`
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
    `, 'match_teams_pkey');

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

    await sql`
      CREATE TABLE IF NOT EXISTS formations (
        player      TEXT NOT NULL,
        slot        INT  NOT NULL CHECK (slot BETWEEN 1 AND 3),
        name        TEXT NOT NULL DEFAULT '',
        hero_ids    JSONB NOT NULL DEFAULT '[]',
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (player, slot)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cosmetics (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL CHECK (type IN ('background', 'skin')),
        name        TEXT NOT NULL,
        preview     TEXT NOT NULL,
        price_hive  NUMERIC(10,3) NOT NULL DEFAULT 0,
        hero_cid    TEXT,
        sort_order  INT NOT NULL DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_cosmetics (
        player        TEXT NOT NULL,
        item_id       TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
        purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (player, item_id)
      )
    `;

    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
        ('bg_desert', 'background', 'Deserto',  '/images/arena-desert.jpg', 0, NULL, 10),
        ('bg_forest', 'background', 'Floresta', '/images/arena-forest.jpg', 0, NULL, 20),
        ('bg_snow',   'background', 'Neve',     '/images/arena-snow.jpg',   0, NULL, 30)
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, sort_order) VALUES
        ('skin_knight',    'skin', 'Knight',    '', 0, 'knight',    100),
        ('skin_mage',      'skin', 'Mage',      '', 0, 'mage',      110),
        ('skin_archer',    'skin', 'Archer',    '', 0, 'archer',    120),
        ('skin_healer',    'skin', 'Healer',    '', 0, 'healer',    130),
        ('skin_assassin',  'skin', 'Assassin',  '', 0, 'assassin',  140),
        ('skin_paladin',   'skin', 'Paladin',   '', 0, 'paladin',   150),
        ('skin_archmage',  'skin', 'Archmage',  '', 0, 'archmage',  160),
        ('skin_barbarian', 'skin', 'Barbarian', '', 0, 'barbarian', 170)
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_equipped_backgrounds (
        player   TEXT NOT NULL,
        item_id  TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
        PRIMARY KEY (player, item_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_equipped_skins (
        player    TEXT NOT NULL,
        hero_cid  TEXT NOT NULL,
        skin_id   TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
        PRIMARY KEY (player, hero_cid)
      )
    `;

    // Refresh cached config that's seeded by this migration (e.g. max-units cap).
    await refreshMaxUnitsCap();

    res.json({ ok: true, message: 'Migration complete.' });
  } catch (err) {
    console.error('[/api/migrate]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Helper: extrai e valida Bearer token do header Authorization
function authFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return verifyToken(token);
}

/**
 * GET /api/formations?player=X
 * Requer token do próprio jogador.
 */
app.get('/api/formations', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    const rows = await sql`SELECT slot, name, hero_ids FROM formations WHERE player = ${player} ORDER BY slot`;
    res.json({ ok: true, formations: rows });
  } catch (err) {
    console.error('[/api/formations GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PUT /api/formations
 * Body: { player, slot, name, hero_ids }
 * Requer token do próprio jogador.
 */
app.put('/api/formations', async (req, res) => {
  const { player, slot, name, hero_ids } = req.body;
  if (!player || !slot) return res.status(400).json({ ok: false, error: 'player and slot required' });
  if (slot < 1 || slot > 3) return res.status(400).json({ ok: false, error: 'slot must be 1-3' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await sql`
      INSERT INTO formations (player, slot, name, hero_ids, updated_at)
      VALUES (${player}, ${slot}, ${name ?? ''}, ${JSON.stringify(hero_ids ?? [])}, now())
      ON CONFLICT (player, slot) DO UPDATE
        SET name = EXCLUDED.name, hero_ids = EXCLUDED.hero_ids, updated_at = now()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/formations PUT]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/shop
 * Returns cosmetics catalog. Public (no auth required).
 * Includes gameAccount for the frontend to use in requestTransfer.
 */
app.get('/api/shop', async (_req, res) => {
  try {
    const items = await sql`
      SELECT id, type, name, preview,
             price_hive::float AS price_hive,
             hero_cid
      FROM cosmetics
      ORDER BY sort_order ASC
    `;
    res.json({ ok: true, items, gameAccount: HIVE_GAME_ACCOUNT });
  } catch (err) {
    console.error('[/api/shop GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/shop/owned
 * Returns array of item_ids owned by the authenticated player.
 */
app.get('/api/shop/owned', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const rows = await sql`
      SELECT item_id FROM user_cosmetics WHERE player = ${username}
    `;
    res.json({ ok: true, owned: rows.map(r => r.item_id) });
  } catch (err) {
    console.error('[/api/shop/owned GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/shop/verify-purchase
 * Body: { item_id }
 * - price_hive = 0: grant immediately (no blockchain verification)
 * - price_hive > 0: verify Hive transfer, then grant
 * Idempotent: if player already owns the item, returns { ok: true } without error.
 */
app.post('/api/shop/verify-purchase', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ ok: false, error: 'item_id required' });

  try {
    const [item] = await sql`SELECT id, price_hive FROM cosmetics WHERE id = ${item_id}`;
    if (!item) return res.status(400).json({ ok: false, error: 'Item not found' });

    const [existing] = await sql`
      SELECT 1 FROM user_cosmetics WHERE player = ${username} AND item_id = ${item_id}
    `;
    if (existing) return res.json({ ok: true });

    const price = parseFloat(item.price_hive);

    if (price === 0) {
      await sql`
        INSERT INTO user_cosmetics (player, item_id) VALUES (${username}, ${item_id})
        ON CONFLICT DO NOTHING
      `;
      console.log(`🎁 Free cosmetic granted: ${username} → ${item_id}`);
      return res.json({ ok: true });
    }

    try {
      await verifyShopPayment(username, price, item_id);
    } catch {
      return res.status(402).json({ ok: false, error: 'Payment not found or timed out' });
    }
    await sql`
      INSERT INTO user_cosmetics (player, item_id) VALUES (${username}, ${item_id})
      ON CONFLICT DO NOTHING
    `;
    console.log(`💰 Shop purchase recorded: ${username} → ${item_id} (${price} HIVE)`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[/api/shop/verify-purchase]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/auth/verify ─────────────────────────────────────────────────────
// ── Auth nonce store ──────────────────────────────────────────────────────────
// One-shot nonces issued by /api/auth/challenge and consumed by /api/auth/verify.
// Prevents replay attacks: a captured signature cannot be reused because the
// nonce is deleted server-side on first use.
const NONCE_TTL_MS = 5 * 60 * 1000;
const nonceStore = new Map(); // nonce → expiresAt
setInterval(() => {
  const now = Date.now();
  for (const [n, exp] of nonceStore) if (exp < now) nonceStore.delete(n);
}, 60_000);

// GET /api/auth/challenge — issues a one-shot nonce the client must embed in the memo.
const authChallengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many challenge requests. Please wait.' },
});
app.get('/api/auth/challenge', authChallengeLimiter, (_req, res) => {
  const nonce = randomUUID();
  nonceStore.set(nonce, Date.now() + NONCE_TTL_MS);
  res.json({ nonce });
});

// POST /api/auth/verify
// Body: { username, memo, signature }
// memo must be exactly `horizon-forge-login-{nonce}` where nonce was issued by /api/auth/challenge.
// Returns: { ok: true, token } on success, { error } on failure.
//
// Rate-limited because each call hits Hive RPC (`condenser_api.get_accounts`)
// — without this, an attacker could DoS our Hive node dependency for free.
const authVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 10,                     // 10 attempts per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a moment and try again.' },
});
app.post('/api/auth/verify', authVerifyLimiter, async (req, res) => {
  const { username, memo, signature } = req.body || {};
  if (!username || !memo || !signature) {
    return res.status(400).json({ error: 'Missing fields.' });
  }

  // Validate memo embeds a valid server-issued nonce (UUID v4 format)
  const memoMatch = /^horizon-forge-login-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(memo);
  if (!memoMatch) return res.status(400).json({ error: 'Invalid memo format.' });

  const nonce = memoMatch[1];
  const nonceExp = nonceStore.get(nonce);
  if (!nonceExp || Date.now() > nonceExp) {
    nonceStore.delete(nonce);
    return res.status(400).json({ error: 'Login request expired or invalid. Please try again.' });
  }
  nonceStore.delete(nonce); // one-shot: consume before any async work

  try {
    const accounts = await hiveRpc('condenser_api.get_accounts', [[username.toLowerCase()]]);
    if (!accounts?.length) return res.status(400).json({ error: 'Hive account not found.' });

    const postingKeys = accounts[0].posting.key_auths.map(([k]) => k);
    const msgHash = cryptoUtils.sha256(Buffer.from(memo));
    const recoveredKey = Signature.fromString(signature).recover(msgHash).toString();

    if (!postingKeys.includes(recoveredKey)) {
      return res.status(401).json({ error: 'Signature verification failed.' });
    }

    const user = username.toLowerCase();
    await sql`
      INSERT INTO user_cosmetics (player, item_id)
      SELECT ${user}, id FROM cosmetics WHERE price_hive = 0
      ON CONFLICT DO NOTHING
    `;
    res.json({ ok: true, token: makeToken(user) });
  } catch (err) {
    console.error('[auth/verify]', err.message);
    res.status(500).json({ error: 'Verification failed. Try again.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  MATCHMAKING — Socket.io
// ══════════════════════════════════════════════════════════════════════════════

// In-memory state (survives restarts only if single Railway instance)
// queue: Map<username, { socket, wager, wagerType, joinedAt }>
const matchQueue = new Map();
// activeMatches: Map<matchId, { p1, p2, wager, wagerType, teams:{}, status }>
const activeMatches = new Map();

// ── Taverna — presença em tempo real ─────────────────────────────────────────
// onlineUsers: Map<username, { status, detail }>
// status: 'taverna' | 'procurando' | 'batalha'
// detail: string opcional — ex: 'BO5 · rodada 2' para quem está em batalha
const onlineUsers = new Map();

function broadcastTavern() {
  const list = [...onlineUsers.entries()].map(([username, data]) => ({
    username,
    status: data.status,
    detail: data.detail || null,
  }));
  io.emit('tavern_update', list);
}

function setTavernStatus(username, status, detail = null) {
  if (!username) return;
  onlineUsers.set(username, { status, detail });
  broadcastTavern();
}

function removeTavernUser(username) {
  if (!username) return;
  if (!onlineUsers.has(username)) return;
  onlineUsers.delete(username);
  broadcastTavern();
}

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

// ── Match-state persistence ───────────────────────────────────────────────────
// activeMatches is in-memory; without these helpers a server restart would
// silently drop paid wagers (the refund timeout couldn't fire because the
// match wouldn't exist anymore). We snapshot mutable state to Postgres on
// every transition and rehydrate any non-terminal matches on boot.

// Cancel any pending timers a match may have left behind (round-forfeit
// timer, payment-timeout timer, disconnect-grace timer). Always called
// before activeMatches.delete to prevent leaked Node timers from firing
// on stale match data after the match has terminated.
function clearMatchTimers(m) {
  if (!m) return;
  if (m.forfeitTimer) { clearTimeout(m.forfeitTimer); m.forfeitTimer = null; }
  if (m.disconnectTimer) { clearTimeout(m.disconnectTimer); m.disconnectTimer = null; }
  if (m.paymentTimer) { clearTimeout(m.paymentTimer); m.paymentTimer = null; }
}

async function persistMatchState(m) {
  if (!m) return;
  try {
    await sql`
      UPDATE matches SET
        status       = ${m.status},
        score_p1     = ${m.scores[m.p1] ?? 0},
        score_p2     = ${m.scores[m.p2] ?? 0},
        battle_num   = ${m.battleNum ?? 1},
        payments     = ${JSON.stringify(m.payments || {})}::jsonb,
        payout_prefs = ${JSON.stringify(m.payoutPrefs || {})}::jsonb,
        merges       = ${JSON.stringify(m.merges || {})}::jsonb,
        refunded     = ${JSON.stringify(m.refunded || {})}::jsonb
      WHERE id = ${m.matchId}
    `;
  } catch (err) {
    console.error('[persistMatchState]', err.message);
  }
}

// Idempotent refund: skips if this player was already refunded for this match.
async function refundOnce(m, player) {
  if (!m) return { ok: false, error: 'no match' };
  m.refunded ||= {};
  if (m.refunded[player]) {
    console.log(`↩️  Skipping duplicate refund for ${player} (match ${m.matchId})`);
    return { ok: true, skipped: true };
  }
  const r = await refundHiveWager(player, m.wager, m.matchId);
  if (r.ok) {
    m.refunded[player] = true;
    await persistMatchState(m);
  }
  return r;
}

async function rehydrateMatches() {
  try {
    const rows = await sql`
      SELECT id, player1, player2, wager_hive, format, status,
             score_p1, score_p2, battle_num, payments, payout_prefs, merges, refunded,
             EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
        FROM matches
       WHERE status IN ('waiting_payments', 'waiting_teams', 'cancelling', 'resolving')
    `;
    for (const r of rows) {
      const wager = Number(r.wager_hive);
      const winsNeeded = Math.ceil(r.format / 2);
      const m = {
        matchId: r.id,
        p1: r.player1, p2: r.player2,
        s1: null, s2: null, // sockets reattach when players reconnect
        wager,
        format: r.format,
        winsNeeded,
        battleNum: r.battle_num || 1,
        scores: { [r.player1]: r.score_p1 || 0, [r.player2]: r.score_p2 || 0 },
        payments: Object.assign({ [r.player1]: false, [r.player2]: false }, r.payments || {}),
        payoutPrefs: Object.assign({ [r.player1]: 'liquid', [r.player2]: 'liquid' }, r.payout_prefs || {}),
        merges: Object.assign({ [r.player1]: 0, [r.player2]: 0 }, r.merges || {}),
        refunded: r.refunded || {},
        teams: {},
        status: r.status === 'resolving' ? 'waiting_teams' : r.status, // re-collect teams; old in-flight sim is lost
        createdAt: Number(r.created_ms),
      };
      activeMatches.set(m.matchId, m);
      // Re-arm timers based on rehydrated status
      if (m.status === 'waiting_payments' || m.status === 'cancelling') {
        // Force-cancel: the original 30s window has almost certainly expired,
        // and we have no sockets to ask for fresh keychain signatures. Refund
        // any player who already paid (idempotent — won't double-refund if a
        // previous cancellation pass already paid them out).
        m.status = 'cancelling';
        await persistMatchState(m);
        const paid = [m.p1, m.p2].filter(p => m.payments[p]);
        for (const player of paid) {
          await refundOnce(m, player);
          console.log(`↩️  Restart-refund: ${m.wager} HIVE → ${player} (match ${m.matchId})`);
        }
        await sql`UPDATE matches SET status='cancelled', resolved_at=now() WHERE id=${m.matchId}`
          .catch(err => console.error('[rehydrate cancel]', err.message));
        clearMatchTimers(m);
        activeMatches.delete(m.matchId);
      } else if (m.status === 'waiting_teams') {
        // Restart the round timer; players will reconnect via rejoin_match.
        armForfeitTimer(m.matchId, m.p1, m.p2, ROUND_TIME_MS);
      }
    }
    if (rows.length) console.log(`🔄 Rehydrated ${rows.length} active match(es) from DB`);
  } catch (err) {
    console.error('[rehydrateMatches]', err.message);
  }
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
      // Match on wager amount AND format — payout type is each player's own preference
      if (e1.wager === e2.wager && e1.format === e2.format) {
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
        `${u1}[wager=${e1.wager} fmt=${e1.format}] vs ${u2}[wager=${e2.wager} fmt=${e2.format}]`
      );
    }
    return;
  }

  const { u1, e1, u2, e2 } = matched;

  matchQueue.delete(u1);
  matchQueue.delete(u2);

  const matchId = makeMatchId();
  const fmt = e1.format || 5;
  const winsNeed = Math.ceil(fmt / 2);
  const needsPayment = e1.wager > 0 && !!HIVE_GAME_ACCOUNT;
  const initStatus = needsPayment ? 'waiting_payments' : 'waiting_teams';

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
    payments: { [u1]: false, [u2]: false },
    payoutPrefs: { [u1]: 'liquid', [u2]: 'liquid' },
    merges: { [u1]: 0, [u2]: 0 },
    refunded: {},
    teams: {},
    status: initStatus,
    createdAt: Date.now(),
  };
  activeMatches.set(matchId, matchData);

  sql`INSERT INTO matches (id, player1, player2, wager_hive, wager_type, format, status,
                            battle_num, payments, payout_prefs, merges)
      VALUES (${matchId}, ${u1}, ${u2}, ${e1.wager}, 'HIVE', ${fmt}, ${initStatus},
              1,
              ${JSON.stringify(matchData.payments)}::jsonb,
              ${JSON.stringify(matchData.payoutPrefs)}::jsonb,
              ${JSON.stringify(matchData.merges)}::jsonb)`
    .catch(err => console.error('[match DB insert]', err.message));

  e1.socket.join(matchId);
  e2.socket.join(matchId);

  // Atualiza status na Taverna para os dois jogadores
  const matchDetail = `BO${fmt} · round 1`;
  setTavernStatus(u1, 'battle', matchDetail);
  setTavernStatus(u2, 'battle', matchDetail);

  io.to(matchId).emit('match_found', {
    matchId,
    p1: u1, p2: u2,
    opponents: { [u1]: u2, [u2]: u1 },
    wager: e1.wager,
    format: fmt,
    needsPayment,
    gameAccount: HIVE_GAME_ACCOUNT,
    timeLimitMs: needsPayment ? 60_000 : 3 * 60 * 1000,
  });

  console.log(`⚔️  Match ${matchId} | ${u1} vs ${u2} | BO${fmt} | ${e1.wager} HIVE${needsPayment ? ' [payment required]' : ' [free]'}`);

  if (needsPayment) {
    // Payment timeout: 60s window. On expiry:
    // 1. Block new wager_sent (set status to 'cancelling')
    // 2. Wait 6s grace period for any in-progress blockchain verifications
    // 3. Final chain scan for unpaid players (3 attempts)
    // 4. Refund paid players; re-queue unpaid players to restart matchmaking
    matchData.paymentTimer = setTimeout(async () => {
      const m = activeMatches.get(matchId);
      if (!m || m.status !== 'waiting_payments') return;
      m.paymentTimer = null;
      m.status = 'cancelling';
      await persistMatchState(m);
      console.log(`⏰ Payment timeout for match ${matchId} — waiting 6s for in-progress verifications...`);

      // Grace period: let any ongoing verifyHivePayment finish
      await sleep(6000);

      // Final chain scan for players not yet registered
      for (const player of [u1, u2]) {
        if (m.payments[player]) continue;
        try {
          const r = await verifyHivePayment('', player, m.wager, matchId, 3);
          m.payments[player] = true;
          m.payoutPrefs[player] = r.payoutPref;
          console.log(`🔍 Late payment found on-chain for ${player} — will refund`);
        } catch {
          // genuinely didn't pay
        }
      }
      await persistMatchState(m);

      const paid = [u1, u2].filter(p => m.payments[p]);
      const unpaid = [u1, u2].filter(p => !m.payments[p]);
      clearMatchTimers(m);
      activeMatches.delete(matchId);
      // Mark cancelled in DB so rehydrate won't pick it up on next boot
      sql`UPDATE matches SET status='cancelled', resolved_at=now() WHERE id=${matchId}`
        .catch(err => console.error('[cancel update]', err.message));

      io.to(matchId).emit('match_cancelled', {
        reason: unpaid.length
          ? `Payment timeout — ${unpaid.join(', ')} did not confirm in time.${paid.length ? ' Refunding your wager...' : ''}`
          : 'Match cancelled. Refunding wagers...',
      });

      // Re-queue players who didn't pay — send them back to matchmaking
      for (const player of unpaid) {
        const sock = m.p1 === player ? m.s1 : m.s2;
        if (sock && sock.connected) {
          matchQueue.set(player, {
            socket: sock,
            wager: m.wager,
            wagerType: 'HIVE',
            format: m.format,
            joinedAt: Date.now(),
          });
          sock.emit('requeued', { queueSize: matchQueue.size });
          setTavernStatus(player, 'searching', `${m.wager > 0 ? m.wager + ' HIVE' : 'Free'} · BO${m.format}`);
        } else {
          // Socket offline — volta para taverna (será removido no disconnect)
          setTavernStatus(player, 'tavern');
        }
      }
      // Paid players que não reconectaram voltam para taverna
      for (const player of paid) {
        if (!onlineUsers.has(player) || onlineUsers.get(player)?.status === 'battle') {
          setTavernStatus(player, 'tavern');
        }
      }
      if (unpaid.length) {
        tryMatch();
        broadcastQueueSize();
      }

      // Refund players who already paid (idempotent against rehydrate-after-restart)
      for (const player of paid) {
        const r = await refundOnce(m, player);
        const sock = m.p1 === player ? m.s1 : m.s2;
        if (sock) {
          if (r.ok) sock.emit('wager_refunded', { amount: m.wager, reason: unpaid.length ? 'Opponent did not confirm payment in time.' : 'Match cancelled.' });
          else sock.emit('prize_error', { error: `Refund failed: ${r.error}. Contact support.` });
        }
      }
      console.log(`⏰ Match ${matchId} cancelled | paid: [${paid.join(', ')}] refunded | unpaid: [${unpaid.join(', ')}] requeued`);
    }, 60_000);
  } else {
    // No payment needed — arm team submission forfeit timer immediately
    armForfeitTimer(matchId, u1, u2, ROUND_TIME_MS);
  }

  broadcastQueueSize();
}

const ROUND_TIME_MS = 2 * 60 * 1000; // 2 minutes per round
// Grace window for a disconnected player to reconnect before the active
// round forfeits to their opponent. Long enough to cover a page refresh or a
// brief network blip; short enough that ragequits don't trap the opponent
// in the 2-minute round timer.
const DISCONNECT_GRACE_MS = 45 * 1000;

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
      clearMatchTimers(m);
      activeMatches.delete(matchId);
    } else {
      const forfeitWinner = [u1, u2].find(u => m.teams[u]);
      forfeitBattle(matchId, forfeitWinner);
    }
  }, ms);
}

// ── Resolve one battle round (called when both teams submitted) ───────────────
async function resolveBattleRound(matchId) {
  const m = activeMatches.get(matchId);
  if (!m || m.status !== 'waiting_teams') return;
  m.status = 'resolving';

  const p1Stripped = m.teams[m.p1];
  const p2Stripped = m.teams[m.p2];

  let result, roundWinner, p1Board, p2Board;
  try {
    // Reconstruct stat-bearing units from the database — never trust stats
    // sent by the client. The client only supplied (cid, lv, id) per slot.
    p1Board = await materializeBoard(p1Stripped);
    p2Board = await materializeBoard(p2Stripped);
    // p1 submits normally (front = col 2, simulation expects player front at col 2 ✓)
    // p2 builds on their own pfield (front = col 2) but simulation expects enemy front at col 0,
    // so we mirror p2's board before simulating.
    result = simulate(p1Board, mirrorBoard(p2Board));
    roundWinner = result.winner === 'p' ? m.p1 : m.p2;
  } catch (err) {
    console.error('[simulate]', err.message);
    io.to(matchId).emit('match_cancelled', { reason: 'Simulation error.' });
    clearMatchTimers(m);
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
    evs: result.evs,
    umap: result.umap,
    stats: result.stats,
    merges: { [m.p1]: m.merges[m.p1] || 0, [m.p2]: m.merges[m.p2] || 0 },
  };

  // Normalize stats to ensure numeric fields are always present
  {
    const s = roundPayload.stats || {};
    roundPayload.stats = {
      dmgP: Number(s.dmgP || 0),
      dmgE: Number(s.dmgE || 0),
      killsP: Number(s.killsP || 0),
      killsE: Number(s.killsE || 0),
      survP: Number(s.survP || 0),
      survE: Number(s.survE || 0),
    };
  }

  // Store so a reconnecting player can receive it via rejoin_match
  m.lastRoundResult = roundPayload;

  io.to(matchId).emit('round_result', roundPayload);

  if (seriesOver) {
    m.status = 'done';
    sql`UPDATE matches SET status='done', winner=${matchWinner},
            score_p1=${m.scores[m.p1]}, score_p2=${m.scores[m.p2]},
            resolved_at=now()
        WHERE id=${matchId}`
      .catch(err => console.error('[match update]', err.message));

    // ── Send prize if match had a real wager ──────────────────────────────────
    if (m.wager > 0 && HIVE_GAME_ACCOUNT) {
      const pot = m.wager * 2;
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
      }).catch(err => console.error('[sendHivePrize] Unexpected rejection:', err.message));
    }

    clearMatchTimers(m);
    activeMatches.delete(matchId);
    // Jogadores voltam para a taverna ao terminar a série
    setTavernStatus(m.p1, 'tavern');
    setTavernStatus(m.p2, 'tavern');
  } else {
    m.battleNum++;
    m.teams = {};
    m.status = 'waiting_teams';
    // Clear so a reconnecting player doesn't receive the previous battle's result
    // after the new battle has already started. The fresh round_result for the
    // new battle will be stored as soon as both teams are resolved.
    m.lastRoundResult = null;
    // Atualiza detalhe da rodada na Taverna
    const roundDetail = `BO${m.format} · round ${m.battleNum}`;
    setTavernStatus(m.p1, 'battle', roundDetail);
    setTavernStatus(m.p2, 'battle', roundDetail);
    // Snapshot battleNum/scores so a restart resumes mid-series correctly.
    persistMatchState(m);
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
    evs: [], umap: {}, stats: { dmgP: 0, dmgE: 0, killsP: 0, killsE: 0, survP: 0, survE: 0 },
    reason: 'forfeit',
  });
  if (seriesOver) {
    m.status = 'done';
    sql`UPDATE matches SET status='done', winner=${winner},
            score_p1=${m.scores[m.p1]}, score_p2=${m.scores[m.p2]},
            resolved_at=now()
        WHERE id=${matchId}`
      .catch(err => console.error('[forfeit match update]', err.message));
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
      }).catch(err => console.error('[sendHivePrize] Unexpected rejection:', err.message));
    }
    clearMatchTimers(m);
    activeMatches.delete(matchId);
    // Jogadores voltam para a taverna após forfeit
    setTavernStatus(m.p1, 'tavern');
    setTavernStatus(m.p2, 'tavern');
  } else {
    m.battleNum++;
    m.teams = {};
    m.status = 'waiting_teams';
    m.lastRoundResult = null;
    // Atualiza rodada na Taverna
    const roundDetail = `BO${m.format} · round ${m.battleNum}`;
    setTavernStatus(m.p1, 'battle', roundDetail);
    setTavernStatus(m.p2, 'battle', roundDetail);
    persistMatchState(m);
    // Reset the forfeit timer for the new round
    armForfeitTimer(matchId, m.p1, m.p2, ROUND_TIME_MS);
  }
}
// Sets socket.data.username from the verified token; guests remain null.
io.use((socket, next) => {
  socket.data.username = verifyToken(socket.handshake.auth?.token) || null;
  next();
});

// ── Socket.io event handlers ───────────────────────────────────────────────────
io.on('connection', socket => {
  // Identity is fixed at connection time — never trust client-sent usernames.
  let connectedUser = socket.data.username;

  // Registra usuário autenticado na Taverna ao conectar
  if (connectedUser) {
    // Se já estava em batalha (reconexão), preserva o status existente
    if (!onlineUsers.has(connectedUser)) {
      setTavernStatus(connectedUser, 'tavern');
    }
    // Envia a lista atual apenas para este socket recém-conectado
    socket.emit('tavern_update', [...onlineUsers.entries()].map(([u, d]) => ({
      username: u, status: d.status, detail: d.detail || null,
    })));
    console.log(`🍺 ${connectedUser} entered the tavern (${onlineUsers.size} online)`);
  }

  // Player joins matchmaking queue
  // Valores permitidos — espelham BET_OPTS e FMT_OPTS do cliente
  const VALID_WAGERS = [0, 1, 5, 10];
  const VALID_FORMATS = [3, 5, 7];

  socket.on('join_queue', ({ wager, wagerType, format }) => {
    if (!connectedUser) {
      socket.emit('error', { message: 'Authentication required to join queue.' });
      return;
    }
    if (!VALID_WAGERS.includes(wager)) {
      socket.emit('error', { message: 'Invalid wager amount.' });
      return;
    }
    if (format !== undefined && !VALID_FORMATS.includes(format)) {
      socket.emit('error', { message: 'Invalid match format.' });
      return;
    }
    if (wagerType !== undefined && wagerType !== 'HIVE') {
      socket.emit('error', { message: 'Invalid wager type.' });
      return;
    }

    // If this player already has an active match (reconnected before redirecting),
    // resend match_found so the client can redirect correctly.
    for (const [, m] of activeMatches) {
      if (m.p1 === connectedUser || m.p2 === connectedUser) {
        if (m.p1 === connectedUser) m.s1 = socket; else m.s2 = socket;
        socket.join(m.matchId);
        // They came back via the lobby — cancel any pending forfeit timer.
        if (m.disconnectTimer) {
          clearTimeout(m.disconnectTimer);
          m.disconnectTimer = null;
          socket.to(m.matchId).emit('opponent_reconnected', { username: connectedUser });
        }
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
        console.log(`📨 Resent match_found to ${connectedUser} (reconnected on lobby)`);
        return;
      }
    }

    // Upsert: if player has a stale entry (e.g. reconnect after F5), replace it
    if (matchQueue.has(connectedUser)) {
      console.log(`🔄 ${connectedUser} already in queue — replacing stale entry`);
      matchQueue.delete(connectedUser);
    }
    matchQueue.set(connectedUser, {
      socket, wager,
      wagerType: wagerType || 'HIVE',
      format: format || 5,
      joinedAt: Date.now(),
    });
    socket.emit('queued', { queueSize: matchQueue.size });
    console.log(`🔍 ${connectedUser} joined queue | ${wager} ${wagerType} BO${format} | size: ${matchQueue.size}`);
    setTavernStatus(connectedUser, 'searching', `${wager > 0 ? wager + ' HIVE' : 'Free'} · BO${format || 5}`);
    tryMatch();
    broadcastQueueSize();
  });

  // Rejoin after page redirect (battle.html connects with saved matchId)
  socket.on('rejoin_match', ({ matchId }) => {
    if (!connectedUser) { socket.emit('rejoin_error', { message: 'Authentication required.' }); return; }
    const m = activeMatches.get(matchId);
    if (!m) { socket.emit('rejoin_error', { message: 'Match not found or already finished.' }); return; }
    if (m.p1 !== connectedUser && m.p2 !== connectedUser) {
      socket.emit('rejoin_error', { message: 'You are not part of this match.' }); return;
    }
    if (m.p1 === connectedUser) m.s1 = socket;
    else m.s2 = socket;
    socket.join(matchId);
    // Cancel any pending forfeit-on-disconnect timer — they came back in time.
    if (m.disconnectTimer) {
      clearTimeout(m.disconnectTimer);
      m.disconnectTimer = null;
      socket.to(matchId).emit('opponent_reconnected', { username: connectedUser });
    }
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
      console.log(`📨 Resent round_result to ${connectedUser} (missed while offline)`);
    }
    console.log(`🔄 ${connectedUser} rejoined match ${matchId}`);
  });

  // Player submits their team for the current round
  socket.on('submit_team', ({ matchId, board, merges }) => {
    const m = activeMatches.get(matchId);
    if (!m) { socket.emit('error', { message: 'Match not found.' }); return; }
    if (m.status !== 'waiting_teams') { socket.emit('error', { message: 'Not accepting teams right now.' }); return; }
    if (!connectedUser) { socket.emit('error', { message: 'Not authenticated.' }); return; }
    if (connectedUser !== m.p1 && connectedUser !== m.p2) {
      socket.emit('error', { message: 'You are not in this match.' }); return;
    }
    try {
      validateClientBoard(board);
    } catch (err) {
      socket.emit('error', { message: `Invalid board: ${err.message}` });
      return;
    }
    if (m.teams[connectedUser]) {
      socket.emit('error', { message: 'Team already submitted.' }); return;
    }

    // Store only the trusted fields. atk/maxHp/skillPower/etc. are looked up
    // from the DB at resolve time — never trust the client's stat values.
    const stripped = stripBoard(board);
    m.teams[connectedUser] = stripped;
    if (typeof merges === 'number') m.merges[connectedUser] = merges;

    sql`INSERT INTO match_teams (match_id, player, battle_num, team_json)
        VALUES (${matchId}, ${connectedUser}, ${m.battleNum}, ${JSON.stringify(stripped)})`
      .catch(err => console.error('[team DB insert]', err.message));

    socket.emit('team_submitted', { matchId });
    console.log(`📋 ${connectedUser} submitted team for match ${matchId} round ${m.battleNum}`);

    if (m.teams[m.p1] && m.teams[m.p2]) {
      // resolveBattleRound is async; rejection is caught by the global
      // unhandledRejection handler — internal try/catch covers the sim path.
      resolveBattleRound(matchId).catch(err =>
        console.error('[resolveBattleRound]', err.message)
      );
    } else {
      socket.to(matchId).emit('opponent_ready', { matchId });
    }
  });

  // Leave matchmaking queue
  socket.on('leave_queue', () => {
    if (connectedUser) {
      matchQueue.delete(connectedUser);
      console.log(`🚪 ${connectedUser} left queue`);
      setTavernStatus(connectedUser, 'tavern');
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

      // Re-fetch match — it may have been deleted or changed to 'cancelling' while
      // we were waiting for blockchain confirmation (up to 45s).
      const mNow = activeMatches.get(matchId);
      if (!mNow || mNow.status === 'cancelling') {
        // Match was cancelled during verification — the timeout handler will refund
        console.log(`⚠️  Payment verified for ${connectedUser} but match ${matchId} already cancelling — timeout will refund`);
        // Update payments on the original object so the timeout refund loop sees it
        m.payments[connectedUser] = true;
        m.payoutPrefs[connectedUser] = payoutPref;
        await persistMatchState(m);
        return;
      }

      mNow.payments[connectedUser] = true;
      mNow.payoutPrefs[connectedUser] = payoutPref;
      console.log(`✅ Payment confirmed: ${connectedUser} | pref: ${payoutPref}`);
      // Persist immediately so a crash before payments_confirmed still preserves
      // the paid state — rehydrate will refund this player on next boot.
      await persistMatchState(mNow);

      // Notify opponent
      socket.to(matchId).emit('opponent_paid', { username: connectedUser });

      // Check if both players have now paid
      if (mNow.payments[mNow.p1] && mNow.payments[mNow.p2]) {
        mNow.status = 'waiting_teams';
        await persistMatchState(mNow);
        io.to(matchId).emit('payments_confirmed', { matchId });
        console.log(`✅ Both players paid for match ${matchId} — starting match`);
        armForfeitTimer(matchId, mNow.p1, mNow.p2, ROUND_TIME_MS);
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
      removeTavernUser(connectedUser);
      console.log(`🍺 ${connectedUser} left the tavern (${onlineUsers.size} online)`);
      // Auto-forfeit if disconnected during an active match and the player
      // doesn't reconnect within the grace window. Without this, a ragequit
      // forces the opponent to wait out the full 2-minute round timer.
      for (const [, m] of activeMatches) {
        if (m.p1 !== connectedUser && m.p2 !== connectedUser) continue;
        socket.to(m.matchId).emit('opponent_disconnected', {
          username: connectedUser,
          graceMs: DISCONNECT_GRACE_MS,
        });
        if (m.disconnectTimer) clearTimeout(m.disconnectTimer);
        m.disconnectTimer = setTimeout(() => {
          const cur = activeMatches.get(m.matchId);
          if (!cur) return;
          cur.disconnectTimer = null;
          // Did they come back? Their socket reference would have been
          // updated in rejoin_match or join_queue.
          const sock = cur.p1 === connectedUser ? cur.s1 : cur.s2;
          if (sock && sock.connected) return;
          // Only forfeit when the match is mid-play. In waiting_payments we
          // already have the payment timeout doing the right thing; in
          // resolving/done the match is already terminal.
          if (cur.status !== 'waiting_teams') return;
          // The disconnected player already submitted their team — don't
          // punish them for losing connectivity at the exact wrong moment.
          // If both teams happen to be in by now, resolve the round; if
          // only the disconnected player's team is in, wait — the round
          // forfeit timer (armForfeitTimer) will eventually award the
          // round to whoever submitted in time.
          if (cur.teams[connectedUser]) {
            if (cur.teams[cur.p1] && cur.teams[cur.p2]) {
              resolveBattleRound(cur.matchId).catch(err =>
                console.error('[resolveBattleRound from disconnect]', err.message)
              );
            }
            return;
          }
          const winner = cur.p1 === connectedUser ? cur.p2 : cur.p1;
          console.log(`🚪 ${connectedUser} did not reconnect within ${DISCONNECT_GRACE_MS}ms — forfeiting round to ${winner}`);
          forfeitBattle(cur.matchId, winner);
        }, DISCONNECT_GRACE_MS);
        break;
      }
    }
  });
});

// ── Match history API ──────────────────────────────────────────────────────────
// Returns last 20 completed matches for a given player (Hive ID).
app.get('/api/matches', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ error: 'player is required' });
  try {
    const rows = await sql`
      SELECT id, player1, player2, format, wager_hive, winner,
             score_p1, score_p2, created_at, resolved_at
        FROM matches
       WHERE (player1 = ${player} OR player2 = ${player})
         AND status = 'done'
       ORDER BY resolved_at DESC
       LIMIT 20
    `;
    res.json({ matches: rows });
  } catch (err) {
    console.error('[/api/matches]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Daily cleanup: remove match_teams older than 30 days ──────────────────────
// Keeps the matches table (lightweight) forever for history.
// Only purges the heavy team_json blobs that are no longer needed.
async function runDailyCleanup() {
  try {
    const result = await sql`
      DELETE FROM match_teams
       WHERE submitted_at < now() - INTERVAL '30 days'
    `;
    console.log(`🧹 Cleanup: removed ${result.count ?? '?'} old match_teams rows`);
  } catch (err) {
    console.error('[cleanup]', err.message);
  }
}
// Run once at startup then every 24 hours
runDailyCleanup();
setInterval(runDailyCleanup, 24 * 60 * 60 * 1000);

// ── Admin: manual prize / refund (protected by ADMIN_SECRET env var) ──────────
// Usage: POST /api/admin/send-prize  { to, amount, type: 'liquid'|'stake', matchId }
//        POST /api/admin/send-refund { to, amount, matchId }
// Header: x-admin-secret: <ADMIN_SECRET>
// (ADMIN_SECRET and requireAdmin are declared above, near the DB init block.)

app.post('/api/admin/send-prize', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { to, amount, type = 'liquid', matchId = 'manual' } = req.body;
  if (!to || !amount) return res.status(400).json({ error: 'to and amount are required' });
  try {
    const key = HiveKey.fromString(HIVE_ACTIVE_KEY);
    const amt = `${parseFloat(amount).toFixed(3)} HIVE`;
    if (type === 'stake') {
      await hiveClient().broadcast.sendOperations(
        [['transfer_to_vesting', { from: HIVE_GAME_ACCOUNT, to, amount: amt }]], key);
    } else {
      await hiveClient().broadcast.transfer(
        { from: HIVE_GAME_ACCOUNT, to, amount: amt, memo: `Horizon Forge manual prize — match ${matchId}` }, key);
    }
    console.log(`🛠️  Admin prize: ${amt} (${type}) → ${to}`);
    res.json({ ok: true, to, amount: amt, type });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/send-refund', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { to, amount, matchId = 'manual' } = req.body;
  if (!to || !amount) return res.status(400).json({ error: 'to and amount are required' });
  const r = await refundHiveWager(to, amount, matchId);
  if (r.ok) res.json({ ok: true, to, amount });
  else res.status(500).json({ ok: false, error: r.error });
});

// Prevent unhandled rejections from crashing the server (Node 15+).
// Log and continue — individual request handlers already return error responses.
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled rejection — server kept alive:', reason);
});

// Catch-all: em produção serve o React, em dev deixa o Vite cuidar
app.get('*', (_req, res) => {
  if (!isDev) {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  } else {
    res.sendFile(join(__dirname, '../public/index.html'));
  }
});

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`⚔️  Horizon Forge running on http://localhost:${PORT}`);
  console.log(`   DB:        ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL not set'}`);
  console.log(`   Sockets:   ✅ Socket.io ready`);
  console.log(`   HIVE acct: ${HIVE_GAME_ACCOUNT ? `✅ ${HIVE_GAME_ACCOUNT}` : '❌ HIVE_GAME_ACCOUNT not set'}`);
  console.log(`   HIVE key:  ${HIVE_ACTIVE_KEY ? '✅ Set' : '❌ HIVE_ACTIVE_KEY not set'}`);
  console.log(`   Admin:     ${ADMIN_SECRET ? '✅ Protected' : '⚠️  ADMIN_SECRET not set (endpoint disabled)'}`);
  // Load the max-units cap from horizon_forge_details before accepting any
  // submit_team. Falls back to 5 if the table or row is missing.
  refreshMaxUnitsCap();
  // Rehydrate any matches that were active at the time of the previous shutdown.
  // Refunds get processed automatically for paid players whose match can no
  // longer be resumed (e.g. payment phase that timed out across the restart).
  rehydrateMatches();
});
