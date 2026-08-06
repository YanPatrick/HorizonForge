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
app.use('/enemies', express.static(join(__dirname, '../public/enemies'), noCacheOpts));
app.use('/scenes', express.static(join(__dirname, '../public/scenes'), noCacheOpts));
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
      ls.multiplier::float,
      cb.crit_chance::float,
      cb.crit_rate::float,
      cb.str, cb.dex, cb.con, cb.int, cb.wis, cb.cha,
      cb.primary_attr,
      cb.weapon_bonus,
      cb.skill_power::float,
      cb.spd_offset::float
    FROM characters c
    JOIN characters_base cb ON cb.character_id = c.id
    CROSS JOIN level_scale ls
    ORDER BY c.cid, ls.level
  `;
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.cid)) {
      map.set(r.cid, {
        cid: r.cid,
        name: r.name,
        icon: r.icon,
        target_type: r.target_type,
        levels: {},
      });
    }
    const st = calcStats(r, r.multiplier);
    map.get(r.cid).levels[r.level] = {
      max_hp:      st.max_hp,
      atk:         st.atk,
      initiative:  st.initiative,
      crit_chance: r.crit_chance,
      crit_rate:   r.crit_rate,
      skill_power: st.skill_power,
      evasion:     st.evasion,
      armor:       st.armor,
      dex:         st.dex,
      wis:         st.wis,
    };
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

// ── Campaign: Enemy definitions (non-hero units) ──────────────────────────────
const CAMPAIGN_ENEMIES = {
  goblinscavenger: {
    cid: 'goblinscavenger', name: 'Goblin Scavenger', icon: '👺',
    portrait: '/enemies/goblinscavenger.png',
    role: 'DPS', target_type: 'nearest',
    hp: 100, atk: 20, spd: 1.0,
  },
  goblinshaman: {
    cid: 'goblinshaman', name: 'Goblin Shaman', icon: '🧙',
    portrait: '/enemies/goblinshaman.png',
    role: 'DPS', target_type: 'nearest',
    hp: 50, atk: 30, spd: 1.0,
  },
  goblinberserker: {
    cid: 'goblinberserker', name: 'Goblin Berserker', icon: '💢',
    portrait: '/enemies/goblinberserker.png',
    role: 'DPS', target_type: 'nearest',
    hp: 150, atk: 80, spd: 1.0,
  },
  goblintrapper: {
    cid: 'goblintrapper', name: 'Goblin Trapper', icon: '🕸️',
    portrait: '/enemies/goblintrapper.png',
    role: 'DPS', target_type: 'nearest',
    hp: 40, atk: 20, spd: 3.0,
  },
  goblinoverseer: {
    cid: 'goblinoverseer', name: 'Goblin Overseer', icon: '👁️',
    portrait: '/enemies/goblinoverseer.png',
    role: 'DPS', target_type: 'nearest',
    hp: 200, atk: 50, spd: 1.0,
  },
  goblinalchemist: {
    cid: 'goblinalchemist', name: 'Goblin Alchemist', icon: '⚗️',
    portrait: '/enemies/goblinalchemist.png',
    role: 'DPS', target_type: 'nearest',
    hp: 80, atk: 50, spd: 2.0,
  },
  goblinoverlord: {
    cid: 'goblinoverlord', name: 'Goblin Overlord', icon: '👑',
    portrait: '/enemies/goblinoverlord.png',
    role: 'DPS', target_type: 'nearest',
    hp: 150, atk: 100, spd: 1.0,
  },
  goblinassassin: {
    cid: 'goblinassassin', name: 'Goblin Assassin', icon: '🥷',
    portrait: '/enemies/goblinassassin.png',
    role: 'DPS', target_type: 'nearest',
    hp: 338, atk: 117, spd: 4.0,
  },
};

// ── Campaign: Chapter 1 stage definitions ─────────────────────────────────────
const CAMPAIGN_STAGES = [
  {
    stage: 1, name: 'Os Portões do Bastião', name_en: 'The Gates of the Bastion', format: 3,
    lore_pre: [
      { scene: '/scenes/1/1/C1S1.jpg', speaker: null, portrait: null,
        text: 'Para entrar no torneio da Forja, todo comandante deve provar seu valor nos Portões do Bastião.',
        text_en: 'To enter the Forge tournament, every commander must prove their worth at the Gates of the Bastion.' },
      { scene: '/scenes/1/1/C1S1.jpg', speaker: 'Guarda do Bastião', speaker_en: 'Bastion Guard', portrait: null,
        text: '"Mais um querendo entrar pra Forja? Olha pro tamanho dele... vai voltar pra casa chorando antes do pôr do sol."',
        text_en: '"Another one wanting into the Forge? Look at the size of him... he\'ll be crying home before sundown."' },
      { scene: '/scenes/1/1/C1S1.jpg', speaker: null, portrait: null,
        text: 'Você não respondeu. Apenas avançou.',
        text_en: 'You didn\'t answer. You just walked forward.' },
    ],
    lore_pre_en: null,
    lore_post: [
      { scene: '/scenes/1/1/C1S1.jpg', speaker: null, portrait: null,
        text: 'As portas se abrem. Os guardas, ainda atordoados, acenam em silêncio.',
        text_en: 'The gates open. The guards, still stunned, nod in silence.' },
      { scene: '/scenes/1/1/C1S1.jpg', speaker: 'Guarda do Bastião', speaker_en: 'Bastion Guard', portrait: null,
        text: '"...Avise os outros. Tem um nome novo circulando pelos corredores."',
        text_en: '"...Tell the others. There\'s a new name making the rounds in the halls."' },
      { scene: '/scenes/1/1/C1S1.jpg', speaker: null, portrait: null,
        text: 'Dentro do Bastião, sua jornada apenas começou.',
        text_en: 'Inside the Bastion, your journey has only just begun.' },
    ],
    lore_post_en: null,
    enemies: [{ cid: 'knight', level: 1 }, { cid: 'paladin', level: 1 }],
    reward_slug: 'campaign_ch1_s1',
  },
  {
    stage: 2, name: 'A Emboscada da Floresta Cinzenta', name_en: 'The Grey Forest Ambush', format: 3,
    lore_pre: [
      { scene: '/scenes/1/2/C1S2.jpg', speaker: null, portrait: null,
        text: 'O caminho para a arena passa pela Floresta Cinzenta. Dizem que mercenários contratados por rivais eliminam competidores promissores aqui.',
        text_en: 'The path to the arena passes through the Grey Forest. They say mercenaries hired by rivals eliminate promising competitors here.' },
      { scene: '/scenes/1/2/C1S2.jpg', speaker: null, portrait: null,
        text: 'Você sentiu os olhos no escuro antes de vê-los.',
        text_en: 'You felt eyes in the dark before you saw them.' },
      { scene: '/scenes/1/2/C1S2.jpg', speaker: 'Mercenário oculto', speaker_en: 'Hidden Mercenary', portrait: null,
        text: '"Alguém pagou bem pra você nunca chegar à arena. Nada pessoal."',
        text_en: '"Someone paid well for you to never reach the arena. Nothing personal."' },
    ],
    lore_pre_en: null,
    lore_post: [
      { scene: '/scenes/1/2/C1S2.jpg', speaker: null, portrait: null,
        text: 'Os mercenários fogem entre as árvores.',
        text_en: 'The mercenaries flee into the trees.' },
      { scene: '/scenes/1/2/C1S2.jpg', speaker: 'Mercenário oculto', speaker_en: 'Hidden Mercenary', portrait: null,
        text: '"Isso não foi o que prometeram pagar pra fazer!"',
        text_en: '"This isn\'t what they promised to pay us for!"' },
      { scene: '/scenes/1/2/C1S2.jpg', speaker: null, portrait: null,
        text: 'Quem os contratou ainda é um mistério — mas o recado está claro: você já é ameaça suficiente para ser caçado.',
        text_en: 'Who hired them remains a mystery — but the message is clear: you\'re already enough of a threat to be hunted.' },
    ],
    lore_post_en: null,
    enemies: [{ cid: 'archer', level: 1 }, { cid: 'assassin', level: 1 }],
    reward_slug: 'campaign_ch1_s2',
  },
  {
    stage: 3, name: 'O Templo dos Guardiões', name_en: 'The Temple of the Guardians', format: 5,
    lore_pre: [
      { scene: '/scenes/1/3/C1S3.jpg', speaker: null, portrait: null,
        text: 'No coração do território central ergue-se o Templo dos Guardiões — uma ordem antiga que julga a dignidade de quem aspira ao poder.',
        text_en: 'At the heart of central territory stands the Temple of the Guardians — an ancient order that judges the worthiness of those who aspire to power.' },
      { scene: '/scenes/1/3/C1S3.jpg', speaker: 'Guardião Sênior', speaker_en: 'Senior Guardian', portrait: null,
        text: '"Eles não atacam por malícia. Atacam por dever. Prove que merece passar."',
        text_en: '"They do not attack out of malice. They attack out of duty. Prove that you deserve passage."' },
    ],
    lore_pre_en: null,
    lore_post: [
      { scene: '/scenes/1/3/C1S3.jpg', speaker: 'Guardião Sênior', speaker_en: 'Senior Guardian', portrait: null,
        text: '"Você passou pelo teste da resistência. Mas o poder real está além deste templo."',
        text_en: '"You passed the test of endurance. But true power lies beyond this temple."' },
      { scene: '/scenes/1/3/C1S3.jpg', speaker: null, portrait: null,
        text: 'Uma insígnia dourada é colocada em sua mão.',
        text_en: 'A golden insignia is placed in your hand.' },
    ],
    lore_post_en: null,
    enemies: [{ cid: 'paladin', level: 2 }, { cid: 'barbarian', level: 1 }, { cid: 'healer', level: 1 }],
    reward_slug: 'campaign_ch1_s3',
  },
  {
    stage: 4, name: 'A Torre de Cristal', name_en: 'The Crystal Tower', format: 5,
    lore_pre: [
      { scene: '/scenes/1/4/C1S4.jpg', speaker: null, portrait: null,
        text: 'A Torre de Cristal flutua sobre o lago a leste — lar dos Magos do Conselho. Eles raramente descem para lutar.',
        text_en: 'The Crystal Tower floats above the lake to the east — home of the Council Mages. They rarely descend to fight.' },
      { scene: '/scenes/1/4/C1S4.jpg', speaker: 'Archmago', speaker_en: 'Archmage', portrait: null,
        text: '"Hoje é diferente. Hoje, descemos."',
        text_en: '"Today is different. Today, we descend."' },
    ],
    lore_pre_en: null,
    lore_post: [
      { scene: '/scenes/1/4/C1S4.jpg', speaker: 'Archmago', speaker_en: 'Archmage', portrait: null,
        text: '"Impressionante. Há décadas não víamos um comandante como você."',
        text_en: '"Impressive. We haven\'t seen a commander like you in decades."' },
      { scene: '/scenes/1/4/C1S4.jpg', speaker: 'Archmago', speaker_en: 'Archmage', portrait: null,
        text: '"O Conselho vai querer conhecê-lo... ou silenciá-lo."',
        text_en: '"The Council will want to meet you... or silence you."' },
    ],
    lore_post_en: null,
    enemies: [{ cid: 'mage', level: 2 }, { cid: 'archmage', level: 2 }, { cid: 'barbarian', level: 2 }],
    reward_slug: 'campaign_ch1_s4',
  },
  {
    stage: 5, name: 'O Trono do Conselho', name_en: "The Council's Throne", format: 7,
    lore_pre: [
      { scene: '/scenes/1/5/C1S5.jpg', speaker: null, portrait: null,
        text: 'Quatro membros do Grande Conselho aguardam no salão dourado. Não como árbitros — como adversários.',
        text_en: 'Four members of the Grand Council await in the golden hall. Not as arbiters — as adversaries.' },
      { scene: '/scenes/1/5/C1S5.jpg', speaker: 'A Voz do Conselho', speaker_en: 'The Voice of the Council', portrait: null,
        text: '"Você subiu longe demais", declara a Voz do Conselho. "Esta batalha decide se você entra para a história... ou desaparece dela."',
        text_en: '"You\'ve climbed too far," the Voice of the Council declares. "This battle decides whether you enter history... or vanish from it."' },
    ],
    lore_pre_en: null,
    lore_post: [
      {
        scene: '/scenes/1/5/C1S5.jpg',
        speaker: null, portrait: null,
        text: 'Silêncio no salão dourado. Até o barulho distante das forjas cessou.',
        text_en: 'Silence in the golden hall. Even the distant sound of the forges fell quiet.',
      },
      {
        scene: '/scenes/1/5/C1S5.jpg',
        speaker: 'A Voz do Conselho', speaker_en: 'The Voice of the Council', portrait: null,
        text: '"Você subiu longe demais para ser ignorado... e longe demais para ser eliminado sem consequências."',
        text_en: '"You have climbed too far to be ignored... and too far to be eliminated without consequences."',
      },
      {
        scene: '/scenes/1/5/C1S5.jpg',
        speaker: null, portrait: null,
        text: 'O Conselho, pela primeira vez em gerações, se levanta e inclina a cabeça.',
        text_en: 'The Council, for the first time in generations, rises and bows their heads.',
      },
      {
        scene: '/scenes/1/5/C1S5.jpg',
        speaker: 'A Voz do Conselho', speaker_en: 'The Voice of the Council', portrait: null,
        text: '"Bem-vindo à Forja, Comandante. Seu nome será gravado no Grimório do Bastião."',
        text_en: '"Welcome to the Forge, Commander. Your name will be inscribed in the Bastion\'s Grimoire."',
      },
      {
        scene: '/scenes/1/5/C1S5.jpg',
        speaker: null, portrait: null,
        text: 'O Capítulo 1 termina — mas o verdadeiro jogo mal começou.',
        text_en: 'Chapter 1 ends — but the true game has barely begun.',
      },
    ],
    lore_post_en: null,
    enemies: [{ cid: 'knight', level: 3 }, { cid: 'paladin', level: 2 }, { cid: 'archer', level: 2 }, { cid: 'mage', level: 2 }],
    reward_slug: 'campaign_ch1_s5',
  },
];

// ── Campaign: Chapter 2 stage definitions ─────────────────────────────────────
const CAMPAIGN_STAGES_CH2 = [
  {
    stage: 1, name: 'A Floresta dos Goblins', name_en: 'The Goblin Forest', format: 3,
    lore_pre:    'Ao adentrar o território do Capítulo 2, o caminho é bloqueado por goblins famintos. Pequenos, mas perigosos em grupo.',
    lore_pre_en: 'As you enter Chapter 2 territory, the path is blocked by hungry goblins. Small, but dangerous in numbers.',
    lore_post:    'Os goblins dispersam entre as árvores. O caminho está livre — por enquanto.',
    lore_post_en: 'The goblins scatter into the trees. The path is clear — for now.',
    enemies: [{ cid: 'goblinscavenger', enemy: true }, { cid: 'goblinscavenger', enemy: true }],
    reward_slug: null,
  },
  {
    stage: 2, name: 'A Armadilha do Caçador', name_en: "The Hunter's Trap", format: 3,
    lore_pre:    'Um Trapper goblin espalhou redes por todo o caminho. Ao seu lado, um Shaman murmura encantamentos sombrios. Algo sobre eles sugere que a morte aqui não é permanente.',
    lore_pre_en: 'A goblin Trapper has spread nets across the path. Beside him, a Shaman mutters dark chants. Something about them suggests death here is not permanent.',
    lore_post:    'As redes se dissolvem. O Shaman cai pela segunda vez, e desta vez não se levanta. Avante.',
    lore_post_en: 'The nets dissolve. The Shaman falls a second time, and this time does not rise. Forward.',
    enemies: [{ cid: 'goblintrapper', enemy: true }, { cid: 'goblinshaman', enemy: true }],
    reward_slug: null,
  },
  {
    stage: 3, name: 'A Fúria do Berserk', name_en: 'The Berserker Frenzy', format: 5,
    lore_pre:    'Dois Berserkers goblins bloqueiam a passagem, feridas abertas e olhos injetados de sangue. Quanto mais você os fere, mais perigosos se tornam.',
    lore_pre_en: 'Two goblin Berserkers block the passage, open wounds and bloodshot eyes. The more you hurt them, the more dangerous they become.',
    lore_post:    'Os Berserkers tombam, exaustos demais para continuar. A raiva os consumiu junto com a derrota.',
    lore_post_en: 'The Berserkers fall, too exhausted to continue. Their rage consumed them along with their defeat.',
    enemies: [{ cid: 'goblinberserker', enemy: true }, { cid: 'goblinberserker', enemy: true }],
    reward_slug: null,
  },
  {
    stage: 4, name: 'O Acampamento Venenoso', name_en: 'The Poisoned Camp', format: 5,
    lore_pre:    'O Alquimista goblin preparou seu veneno antes mesmo de você chegar. O chão ao seu redor borbulha com substâncias corrosivas. Um Scavenger e um Overseer guardam o perímetro.',
    lore_pre_en: 'The goblin Alchemist prepared his poison before you even arrived. The ground around him bubbles with corrosive substances. A Scavenger and an Overseer guard the perimeter.',
    lore_post:    'O veneno se dissipa com a derrota do Alquimista. O Overseer recuou — pela última vez.',
    lore_post_en: "The poison fades with the Alchemist's defeat. The Overseer retreated — for the last time.",
    enemies: [{ cid: 'goblinalchemist', enemy: true }, { cid: 'goblinoverseer', enemy: true }, { cid: 'goblinscavenger', enemy: true }],
    reward_slug: null,
  },
  {
    stage: 5, name: 'O Senhor dos Goblins', name_en: 'The Goblin Overlord', format: 7,
    lore_pre:    'No centro do acampamento, o Overlord goblin aguarda entronizado em uma pilha de sucata. Ao seu redor: um Shaman, um Trapper e um Berserker. Mas algo diferente patrulha sua direita — um assassino humano surpreendido dormindo por batedores goblins. O Alquimista enfiou uma poção goela abaixo. Agora ele obedece. Os olhos vazios, os reflexos intactos. Ele não escolheu estar aqui.',
    lore_pre_en: "At the center of the camp, the goblin Overlord waits enthroned on a pile of scrap. Around him: a Shaman, a Trapper, and a Berserker. But something different patrols his right — a human assassin ambushed in his sleep by goblin scouts. The Alchemist poured a potion down his throat. Now he obeys. Eyes vacant, reflexes intact. He didn't choose to be here.",
    lore_post: [
      {
        speaker: null, portrait: null,
        text: 'O Overlord cai de seu trono improvisado. O impacto ecoa por toda a floresta.',
        text_en: 'The Overlord falls from his makeshift throne. The impact echoes through the entire forest.',
      },
      {
        speaker: 'Goblin Overlord', speaker_en: 'Goblin Overlord', speaker_side: 'right', portrait: '/enemies/goblinoverlord.png',
        text: '"Grrk... impossível... nenhum humano jamais chegou tão longe..."',
        text_en: '"Grrk... impossible... no human has ever made it this far..."',
      },
      {
        speaker: null, portrait: null,
        text: 'Os goblins remanescentes fogem para as sombras da floresta. O Capítulo 2 chegou ao fim — mas algo maior aguarda além das árvores.',
        text_en: 'The remaining goblins flee into the forest shadows. Chapter 2 has ended — but something greater awaits beyond the trees.',
      },
    ],
    lore_post_en: null,
    enemies: [{ cid: 'goblinoverlord', enemy: true }, { cid: 'goblinshaman', enemy: true }, { cid: 'goblintrapper', enemy: true }, { cid: 'goblinberserker', enemy: true }, { cid: 'goblinassassin', enemy: true }],
    reward_slug: null,
  },
];

const CAMPAIGN_CHAPTERS = { 1: CAMPAIGN_STAGES, 2: CAMPAIGN_STAGES_CH2 };

// playable: false = chapter is visible but battles are locked (rewards not defined yet)
const CAMPAIGN_CHAPTER_META = {
  1: { playable: true },
  2: { playable: false },
};

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

// Build a simulator-ready board: joins (cid, lv, id) with DB stats and applies
// flat equipment bonuses from hero_equipment for the given player.
async function materializeBoard(board, gearTotals = {}) {
  const stats = await getStatsTable();
  return board.map((u) => {
    if (!u) return null;
    const ch = stats.get(u.cid);
    if (!ch) throw new Error(`Unknown character cid: ${u.cid}`);
    const lvStats = ch.levels[u.lv];
    if (!lvStats) throw new Error(`No stats for ${u.cid} at level ${u.lv}`);
    const eq = gearTotals[u.cid] ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
    const maxHp = lvStats.max_hp + eq.hp_bonus;
    return {
      id:         u.id,
      cid:        u.cid,
      lv:         u.lv,
      name:       ch.name,
      ico:        ch.icon,
      tp:         ch.target_type,
      atk:        Math.floor(lvStats.atk) + eq.atk_bonus,
      maxHp,
      hp:         maxHp,
      initiative: lvStats.initiative + eq.spd_bonus,   // bônus D20 de iniciativa por round
      critChance: lvStats.crit_chance,
      critRate:   lvStats.crit_rate,
      skillPower: lvStats.skill_power,
      evasion:    lvStats.evasion,      // % flat de evasão (máx 5% base)
      armor:      lvStats.armor ?? 0,  // armadura base (sempre 0 — vem de item equipado)
      dex:        lvStats.dex,          // DEX escalado — usado para absorção futura
      wis:        lvStats.wis,          // WIS escalado — absorve dano mágico
    };
  });
}

// ── Equipment helpers ──────────────────────────────────────────────────────

// Lazily inserts starter items into hero_equipment for any hero+slot
// not yet initialized for this player. Idempotent — safe to call multiple times.
async function ensureStarterGear(player) {
  await sql`
    INSERT INTO hero_equipment (player, character_cid, slot_type, item_id)
    SELECT ${player}, csl.character_cid, csl.slot_type, csl.item_id
    FROM character_starter_loadout csl
    WHERE NOT EXISTS (
      SELECT 1 FROM hero_equipment he
      WHERE he.player     = ${player}
        AND he.character_cid = csl.character_cid
        AND he.slot_type     = csl.slot_type
    )
    ON CONFLICT DO NOTHING
  `;
}

// Returns { [cid]: { atk_bonus, hp_bonus, spd_bonus } } for all heroes
// that have at least one item equipped for the given player.
async function getEquipmentBonuses(player) {
  await ensureStarterGear(player);
  const rows = await sql`
    SELECT he.character_cid,
           SUM(i.atk_bonus)::int          AS atk_bonus,
           SUM(i.hp_bonus)::int           AS hp_bonus,
           SUM(i.spd_bonus)::float        AS spd_bonus
    FROM hero_equipment he
    JOIN items i ON i.id = he.item_id
    WHERE he.player = ${player}
    GROUP BY he.character_cid
  `;
  const map = {};
  for (const r of rows) {
    map[r.character_cid] = {
      atk_bonus: Number(r.atk_bonus) || 0,
      hp_bonus:  Number(r.hp_bonus)  || 0,
      spd_bonus: Number(r.spd_bonus) || 0,
    };
  }
  return map;
}

// ── Routes ────────────────────────────────────────────────

/**
 * GET /api/characters
 * Stats calculados dinamicamente: characters_base × level_scale
 *
 * Fórmula por nível (calcStats):
 *   max_hp      = con × 20 × m                        (apenas CON — itens adicionam HP)
 *   atk         = primary_attr × 5 × m + weapon_bonus
 *   initiative  = spd_offset                          (bônus fixo somado ao D20 por round)
 *   skill_power = base.skill_power × m                (valor base definido por herói)
 *   evasion     = max(0, floor((DEX_base − 10) / 2)) %  (máx 5% sem itens)
 *   armor       = 0 por padrão                        (vem de item equipado)
 *
 * Retorno (mesmo contrato do frontend):
 * { cid, name, icon, role, color_hex, bg_gradient, target_type,
 *   skill: { key, name, description, type },
 *   levels: { 1: {...}, 2: {...}, 3: {...}, 4: {...}, 5: {...} } }
 */
function trunc4(v) {
  return Math.trunc(v * 10000) / 10000;
}

function calcStats(base, multiplier) {
  const m   = Number(multiplier);
  const str = Number(base.str) * m;
  const dex = Number(base.dex) * m;
  const con = Number(base.con) * m;
  const int = Number(base.int) * m;
  const wis = Number(base.wis) * m;
  // cha: reservado para uso futuro
  const attrMap = { str, dex, con, int, wis };
  const p = attrMap[base.primary_attr];
  if (p === undefined)
    throw new Error(`calcStats: invalid primary_attr="${base.primary_attr}"`);

  // Evasion: bônus de DEX base (sem multiplicador de nível) → max 5% sem itens
  const evasionMod = Math.max(0, Math.floor((Number(base.dex) - 10) / 2));

  return {
    // HP: apenas CON × 20 × m  (itens adicionam HP separadamente)
    max_hp: Math.floor(con * 20),

    // ATK: atributo primário × 5 × m  (bônus vem exclusivamente dos itens equipados)
    atk: Math.floor(p * 5),

    // Bônus de iniciativa — somado ao D20 no início de cada round
    initiative: Number(base.spd_offset),

    // Skill power: valor base × m  (definido por herói em characters_base.skill_power)
    skill_power: trunc4(Number(base.skill_power) * m),

    // Evasão: 1% por ponto de modificador de DEX, mínimo 0%
    evasion: evasionMod / 100,

    // Armadura: sempre 0 da ficha do herói — vem de item equipado
    armor: 0,

    dex: dex,
    wis: wis,
  };
}

// ── Idle Dungeon — tunable constants (pending balancing session, see
//    docs/superpowers/specs/2026-08-03-idle-dungeon-design.md §9) ──────────
// Design pivot (2026-08-06): idle combat no longer derives a power score from
// the player's own formation/gear. It now runs a real event-driven combat
// simulation (simulateIdleSegment) against a single fixed generic hero,
// completely decoupled from the player's roster. Confirmed deliberately by
// the user over the original formation-based power-score spec.
const IDLE_CONFIG = {
  ONLINE_GRACE_MS:        90_000,        // heartbeat gap under this = still "online"
  POTION_COIN_COST:       10,            // coins per potion (shop/buy-potions)
  POTION_HEAL_HP:         20,            // HP restored by one auto-potion trigger
  OFFLINE_REWARD_RATIO:   0.5,           // default free collection of offline-earned pending rewards
  OFFLINE_FULL_DIAMOND_COST: 50,         // diamonds to collect 100% instead of 50%
  DROP_CHANCE_NONE:       0.30,
  DROP_CHANCE_COIN:       0.60,          // coin qty 1-5
  DROP_CHANCE_FRAGMENT:   0.099,
  DROP_CHANCE_DIAMOND:    0.001,
  // Fragment drops pick a random equipment slot rather than being tied to a tier.
  TIER_SLOTS: ['weapon', 'helm', 'legs', 'boots', 'gloves', 'ring1'],
  AUTO_POTION_OPTIONS: [90, 75, 50],     // HP% threshold options for the auto-potion trigger
  MAX_OFFLINE_CATCHUP_MS: 30 * 24 * 60 * 60 * 1000, // cap offline simulation to 30 days
};

// Placeholder pending balancing — see docs/superpowers/specs/2026-08-03-idle-dungeon-design.md §9.
const IDLE_HERO_BASE = { maxHp: 100, atk: 10, def: 5 };
const IDLE_HERO_GROWTH_PER_LEVEL = { hp: 10, atk: 2, def: 1 };
const IDLE_HERO_ATTACK_MS = 1600;
const IDLE_HERO_MISS_CHANCE = 0.03;
const IDLE_XP_BASE = 100;
const IDLE_XP_GROWTH = 1.5;

const IDLE_MONSTERS = {
  guerreiro: { hp: 20, atk: 10, def: 5, attackMs: 2000, spawnMs: 5000, xp: 1 },
  arqueiro:  { hp: 10, atk: 15, def: 3, attackMs: 2000, spawnMs: 8000, xp: 2 },
};

function idleHeroStatsForLevel(level) {
  const extra = Math.max(1, Number(level) || 1) - 1;
  return {
    maxHp: IDLE_HERO_BASE.maxHp + extra * IDLE_HERO_GROWTH_PER_LEVEL.hp,
    atk:   IDLE_HERO_BASE.atk + extra * IDLE_HERO_GROWTH_PER_LEVEL.atk,
    def:   IDLE_HERO_BASE.def + extra * IDLE_HERO_GROWTH_PER_LEVEL.def,
  };
}

function idleXpToNextLevel(level) {
  return Math.ceil(IDLE_XP_BASE * Math.pow(IDLE_XP_GROWTH, Math.max(1, Number(level) || 1) - 1));
}

function idleDamage(atk, def) {
  return Math.max(1, Math.round(atk - def));
}

function rollIdleDrop() {
  const r = Math.random();
  const slotType = IDLE_CONFIG.TIER_SLOTS[Math.floor(Math.random() * IDLE_CONFIG.TIER_SLOTS.length)];
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND) {
    return { type: 'diamond', qty: 1 };
  }
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT) {
    return { type: 'fragment', qty: 1, slotType };
  }
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT + IDLE_CONFIG.DROP_CHANCE_COIN) {
    return { type: 'coin', qty: 1 + Math.floor(Math.random() * 5) };
  }
  return { type: 'none', qty: 0 };
}

/**
 * Event-driven idle combat simulation, shared by the online and offline
 * resolution paths. Advances hero/enemy timers event-by-event (next spawn,
 * next hero attack, next enemy attack — whichever is soonest) until either
 * `elapsedMs` is exhausted or the hero dies with no potions left to save them.
 *
 * `sequential: true` (offline catch-up) caps concurrent enemies at 1, so a
 * long offline gap resolves as one-enemy-at-a-time instead of spawning an
 * unbounded backlog. Online play allows unlimited concurrent enemies, since
 * spawns/attacks are paced against real wall-clock time between polls.
 */
function simulateIdleSegment(input, elapsedMs, { sequential = false } = {}) {
  let heroLevel = input.heroLevel;
  let heroXp = input.heroXp;
  let heroHp = input.heroHp;
  let heroStats = idleHeroStatsForLevel(heroLevel);
  let potions = input.potions;
  const autoPotionPct = input.autoPotionPct;
  let enemies = (input.enemies || []).map(e => ({ ...e }));
  let nextGuerreiroMs = input.nextGuerreiroMs;
  let nextArqueiroMs = input.nextArqueiroMs;
  let nextHeroAttackMs = input.nextHeroAttackMs;
  let nextEnemyId = input.nextEnemyId ?? 1;
  const maxConcurrentEnemies = sequential ? 1 : Infinity;

  let coinsGained = 0, diamondsGained = 0, potionsUsed = 0, xpGained = 0, kills = 0;
  const fragmentsGained = {};
  let died = false;
  let timeUsed = 0;

  while (timeUsed < elapsedMs && heroHp > 0) {
    const candidates = [
      { type: 'spawn_guerreiro', t: nextGuerreiroMs },
      { type: 'spawn_arqueiro', t: nextArqueiroMs },
    ];
    if (enemies.length > 0) candidates.push({ type: 'hero_attack', t: nextHeroAttackMs });
    for (const e of enemies) candidates.push({ type: 'enemy_attack', id: e.id, t: e.nextAttackMs });
    candidates.sort((a, b) => a.t - b.t);
    const next = candidates[0];
    if (timeUsed + next.t > elapsedMs) break;

    timeUsed += next.t;
    nextGuerreiroMs -= next.t;
    nextArqueiroMs -= next.t;
    if (enemies.length > 0) nextHeroAttackMs -= next.t;
    for (const e of enemies) e.nextAttackMs -= next.t;

    if (next.type === 'spawn_guerreiro' || next.type === 'spawn_arqueiro') {
      const kind = next.type === 'spawn_guerreiro' ? 'guerreiro' : 'arqueiro';
      const def = IDLE_MONSTERS[kind];
      if (enemies.length < maxConcurrentEnemies) {
        if (enemies.length === 0) nextHeroAttackMs = IDLE_HERO_ATTACK_MS;
        enemies.push({ id: nextEnemyId++, kind, hp: def.hp, nextAttackMs: def.attackMs });
      }
      if (kind === 'guerreiro') nextGuerreiroMs = def.spawnMs;
      else nextArqueiroMs = def.spawnMs;
    } else if (next.type === 'hero_attack') {
      const target = enemies[0];
      if (target) {
        const monsterDef = IDLE_MONSTERS[target.kind];
        if (Math.random() >= IDLE_HERO_MISS_CHANCE) {
          target.hp -= idleDamage(heroStats.atk, monsterDef.def);
        }
        if (target.hp <= 0) {
          enemies.shift();
          kills += 1;
          heroXp += monsterDef.xp;
          xpGained += monsterDef.xp;
          while (heroXp >= idleXpToNextLevel(heroLevel)) {
            heroXp -= idleXpToNextLevel(heroLevel);
            heroLevel += 1;
            heroStats = idleHeroStatsForLevel(heroLevel);
          }
          const drop = rollIdleDrop();
          if (drop.type === 'coin') coinsGained += drop.qty;
          else if (drop.type === 'diamond') diamondsGained += drop.qty;
          else if (drop.type === 'fragment') fragmentsGained[drop.slotType] = (fragmentsGained[drop.slotType] ?? 0) + drop.qty;
        }
      }
      nextHeroAttackMs = IDLE_HERO_ATTACK_MS;
    } else if (next.type === 'enemy_attack') {
      const attacker = enemies.find(e => e.id === next.id);
      if (attacker) {
        const monsterDef = IDLE_MONSTERS[attacker.kind];
        heroHp -= idleDamage(monsterDef.atk, heroStats.def);
        attacker.nextAttackMs = monsterDef.attackMs;
        if (heroHp > 0 && heroHp <= heroStats.maxHp * (autoPotionPct / 100) && potions > 0) {
          potions -= 1;
          potionsUsed += 1;
          heroHp = Math.min(heroStats.maxHp, heroHp + IDLE_CONFIG.POTION_HEAL_HP);
        }
        if (heroHp <= 0) { died = true; }
      }
    }
  }

  const remainder = elapsedMs - timeUsed;
  nextGuerreiroMs -= remainder;
  nextArqueiroMs -= remainder;
  if (enemies.length > 0) nextHeroAttackMs -= remainder;
  for (const e of enemies) e.nextAttackMs -= remainder;

  return {
    heroLevel, heroXp, heroHp: Math.max(0, heroHp), heroMaxHp: heroStats.maxHp,
    potions, enemies, nextGuerreiroMs, nextArqueiroMs, nextHeroAttackMs, nextEnemyId,
    coinsGained, diamondsGained, fragmentsGained, xpGained, kills, potionsUsed, died,
  };
}

app.get('/api/characters', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT
        c.cid, c.name, c.icon, c.url_portrait, c.role,
        c.color_hex, c.bg_gradient, c.target_type,
        sk.skill_key, sk.name AS skill_name,
        sk.description AS skill_desc, sk.lore, sk.skill_type,
        ls.level, ls.multiplier::float,
        cb.crit_chance::float, cb.crit_rate::float,
        cb.str, cb.dex, cb.con, cb.int, cb.wis, cb.cha,
        cb.primary_attr,
        cb.weapon_bonus,
        cb.skill_power::float,
        cb.spd_offset::float
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
          cid: r.cid, name: r.name, icon: r.icon,
          url_portrait: r.url_portrait || '',
          role: r.role, color_hex: r.color_hex,
          bg_gradient: r.bg_gradient, target_type: r.target_type,
          skill: {
            key: r.skill_key, name: r.skill_name,
            description: r.skill_desc, lore: r.lore, type: r.skill_type,
          },
          attrs: {
            str: Number(r.str), dex: Number(r.dex), con: Number(r.con),
            int: Number(r.int), wis: Number(r.wis), cha: Number(r.cha),
            primary:      r.primary_attr,
            weapon_bonus: Number(r.weapon_bonus),
            initiative:   Number(r.spd_offset),
          },
          levels: {},
        };
      }
      const st = calcStats(r, r.multiplier);
      map[r.cid].levels[r.level] = {
        max_hp:      st.max_hp,
        atk:         st.atk,
        initiative:  st.initiative,
        crit_chance: r.crit_chance,
        crit_rate:   r.crit_rate,
        skill_power: st.skill_power,
        evasion:     st.evasion,
        armor:       st.armor,
        dex:         st.dex,
        wis:         st.wis,
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
        type        TEXT NOT NULL CHECK (type IN ('background', 'skin', 'treasure')),
        name        TEXT NOT NULL,
        preview     TEXT NOT NULL,
        price_hive  NUMERIC(10,3) NOT NULL DEFAULT 0,
        hero_cid    TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    // Update type constraint to allow 'treasure'. Try dropping the auto-generated name first.
    try { await sql`ALTER TABLE cosmetics DROP CONSTRAINT IF EXISTS cosmetics_type_check`; } catch {}
    try {
      await sql`ALTER TABLE cosmetics ADD CONSTRAINT cosmetics_type_check CHECK (type IN ('background', 'skin', 'treasure'))`;
    } catch (e) {
      if (!String(e?.message).toLowerCase().includes('already exists')) {
        console.error('[migrate] type constraint:', e.message);
      }
    }
    await sql`ALTER TABLE cosmetics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
    await sql`ALTER TABLE cosmetics DROP COLUMN IF EXISTS sort_order`;
    await sql`ALTER TABLE cosmetics ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE cosmetics ADD COLUMN IF NOT EXISTS locked_caption TEXT`;
    await sql`
      UPDATE cosmetics
      SET preview = REPLACE(preview, '/heroes/', '/heroes/shop/')
      WHERE type = 'skin'
        AND preview LIKE '/heroes/%'
        AND preview NOT LIKE '/heroes/shop/%'
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
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid) VALUES
        ('bg_desert', 'background', 'Deserto',  '/images/arenas/arena-desert.jpg', 0, NULL),
        ('bg_forest', 'background', 'Floresta', '/images/arenas/arena-florest.jpg', 0, NULL),
        ('bg_snow',   'background', 'Neve',     '/images/arenas/arena-snow.jpg',   0, NULL)
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid) VALUES
        ('skin_knight',    'skin', 'Knight',    '/heroes/shop/knight.webp',    0, 'knight'),
        ('skin_mage',      'skin', 'Mage',      '/heroes/shop/mage.webp',      0, 'mage'),
        ('skin_archer',    'skin', 'Archer',    '/heroes/shop/archer.webp',    0, 'archer'),
        ('skin_healer',    'skin', 'Healer',    '/heroes/shop/healer.webp',    0, 'healer'),
        ('skin_assassin',  'skin', 'Assassin',  '/heroes/shop/assassin.webp',  0, 'assassin'),
        ('skin_paladin',   'skin', 'Paladin',   '/heroes/shop/paladin.webp',   0, 'paladin'),
        ('skin_archmage',  'skin', 'Archmage',  '/heroes/shop/archmage.webp',  0, 'archmage'),
        ('skin_barbarian', 'skin', 'Barbarian', '/heroes/shop/barbarian.webp', 0, 'barbarian')
      ON CONFLICT (id) DO UPDATE SET preview = EXCLUDED.preview
    `;

    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive, hero_cid, locked, locked_caption) VALUES
        ('skin_druid_mystery', 'skin', '???', '/heroes/shop/silhueta.png', 99.000, NULL, true, 'shop.lockedCaptionDruid')
      ON CONFLICT (id) DO UPDATE SET preview = EXCLUDED.preview, locked = EXCLUDED.locked, locked_caption = EXCLUDED.locked_caption
    `;

    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive) VALUES
        ('treasure_chest', 'treasure', 'Veteran Chest', '/images/treasures/chest.png', 2.000)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price_hive = EXCLUDED.price_hive, type = EXCLUDED.type, preview = EXCLUDED.preview
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

    await sql`
      CREATE TABLE IF NOT EXISTS player_init (
        player         TEXT        PRIMARY KEY,
        initialized_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
 * GET /api/gear?player=X
 * Returns equipped gear (all slots, all heroes) for the given player.
 * Lazily initializes starter items on first call.
 * Response: { ok, gear: { [cid]: { slots: { [slot_type]: itemObj }, totals: { atk_bonus, hp_bonus, spd_bonus } } } }
 */
app.get('/api/chest-meter', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  try {
    const [row] = await sql`SELECT chest_meter, pending_chests_queue FROM player_init WHERE player = ${player}`;
    const meter   = row ? Number(row.chest_meter) : 0;
    const queue   = Array.isArray(row?.pending_chests_queue) ? row.pending_chests_queue : [];
    const pct     = Math.min(100, Math.round((meter / 2.0) * 100));
    res.json({ ok: true, meter, pct, pending: queue.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const CHEST_DISPLAY_NAMES = { veteran: 'Veteran Chest', basic: 'Basic Chest', chaos: 'Chaos Chest' };
const CHEST_TYPE_MAP      = { veteran: 'treasure_chest', basic: 'basic_chest', chaos: 'chaos_chest' };

app.post('/api/chest-meter/open', async (req, res) => {
  const authedUser = authFromRequest(req);
  if (!authedUser) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const [row] = await sql`SELECT pending_chests_queue FROM player_init WHERE player = ${authedUser}`;
    const queue = Array.isArray(row?.pending_chests_queue) ? row.pending_chests_queue : [];
    if (queue.length < 1) return res.status(400).json({ ok: false, error: 'No pending chests' });
    const chestKey  = queue[0];
    const newQueue  = queue.slice(1);
    const chestType = CHEST_TYPE_MAP[chestKey] || 'treasure_chest';
    const chestName = CHEST_DISPLAY_NAMES[chestKey] || 'Veteran Chest';
    await sql`UPDATE player_init SET pending_chests_queue = ${JSON.stringify(newQueue)} WHERE player = ${authedUser}`;
    const item = await openChest(authedUser, chestType, 'pvp');
    res.json({ ok: true, item, chestName, pending: newQueue.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/gear', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);

  // Guests (no token): return the universal starter loadout read-only, no writes to hero_equipment
  if (!authedUser) {
    try {
      const rows = await sql`
        SELECT csl.character_cid, csl.slot_type,
               i.id, i.name, i.description, i.rarity,
               i.atk_bonus, i.hp_bonus, i.spd_bonus
        FROM character_starter_loadout csl
        JOIN items i ON i.id = csl.item_id
        ORDER BY csl.character_cid, csl.slot_type
      `;
      const gear = {};
      for (const r of rows) {
        if (!gear[r.character_cid]) {
          gear[r.character_cid] = { slots: {}, totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 } };
        }
        gear[r.character_cid].slots[r.slot_type] = {
          id:          r.id,
          name:        r.name,
          description: r.description,
          rarity:      r.rarity,
          slot_type:   r.slot_type,
          atk_bonus:   Number(r.atk_bonus),
          hp_bonus:    Number(r.hp_bonus),
          spd_bonus:   Number(r.spd_bonus),
          req_attr:    null,
          req_value:   null,
          req_attr2:   null,
          req_value2:  null,
        };
        gear[r.character_cid].totals.atk_bonus += Number(r.atk_bonus);
        gear[r.character_cid].totals.hp_bonus  += Number(r.hp_bonus);
        gear[r.character_cid].totals.spd_bonus += Number(r.spd_bonus);
      }
      return res.json({ ok: true, gear });
    } catch (err) {
      console.error('[GET /api/gear guest]', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await ensureStarterGear(player);
    const rows = await sql`
      SELECT he.character_cid, he.slot_type,
             i.id, i.name, i.description, i.rarity,
             i.atk_bonus, i.hp_bonus, i.spd_bonus,
             i.req_attr, i.req_value, i.req_attr2, i.req_value2
      FROM hero_equipment he
      JOIN items i ON i.id = he.item_id
      WHERE he.player = ${player}
      ORDER BY he.character_cid, he.slot_type
    `;
    const gear = {};
    for (const r of rows) {
      if (!gear[r.character_cid]) {
        gear[r.character_cid] = {
          slots: {},
          totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 },
        };
      }
      gear[r.character_cid].slots[r.slot_type] = {
        id:          r.id,
        name:        r.name,
        description: r.description,
        rarity:      r.rarity,
        slot_type:   r.slot_type,
        atk_bonus:   Number(r.atk_bonus),
        hp_bonus:    Number(r.hp_bonus),
        spd_bonus:   Number(r.spd_bonus),
        req_attr:    r.req_attr  || null,
        req_value:   r.req_value  ? Number(r.req_value)  : null,
        req_attr2:   r.req_attr2 || null,
        req_value2:  r.req_value2 ? Number(r.req_value2) : null,
      };
      gear[r.character_cid].totals.atk_bonus += Number(r.atk_bonus);
      gear[r.character_cid].totals.hp_bonus  += Number(r.hp_bonus);
      gear[r.character_cid].totals.spd_bonus += Number(r.spd_bonus);
    }
    res.json({ ok: true, gear });
  } catch (err) {
    console.error('[GET /api/gear]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PUT /api/gear/equip
 * Body: { player, character_cid, slot_type, item_id }
 * Equips an item into a hero's slot (insert or replace).
 */
app.put('/api/gear/equip', async (req, res) => {
  const { player, character_cid, slot_type, item_id } = req.body;
  if (!player || !character_cid || !slot_type || !item_id) {
    return res.status(400).json({ ok: false, error: 'player, character_cid, slot_type, item_id required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Verify item exists
    const [item] = await sql`SELECT id, name, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus FROM items WHERE id = ${item_id}`;
    if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });
    if (item.slot_type !== slot_type) {
      return res.status(400).json({ ok: false, error: `Item does not fit slot '${slot_type}' (item slot: '${item.slot_type}')` });
    }

    // Remove item from any other hero before equipping (communal inventory: one item = one hero)
    await sql`
      DELETE FROM hero_equipment
      WHERE player = ${player} AND item_id = ${item_id} AND character_cid != ${character_cid}
    `;
    await sql`
      INSERT INTO hero_equipment (player, character_cid, slot_type, item_id)
      VALUES (${player}, ${character_cid}, ${slot_type}, ${item_id})
      ON CONFLICT (player, character_cid, slot_type)
      DO UPDATE SET item_id = ${item_id}, equipped_at = now()
    `;
    res.json({ ok: true, slot: { ...item, slot_type } });
  } catch (err) {
    console.error('[PUT /api/gear/equip]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/player-items?player=X
 * Returns all items in the player's communal inventory with equip status.
 */
app.get('/api/player-items', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    const rows = await sql`
      SELECT
        i.id, i.name, i.description, i.rarity, i.slot_type, i.slug,
        COALESCE(i.atk_bonus, 0) AS atk_bonus,
        COALESCE(i.hp_bonus, 0)  AS hp_bonus,
        COALESCE(i.spd_bonus, 0) AS spd_bonus,
        COALESCE(i.source, 'normal') AS source,
        he.character_cid AS equipped_on
      FROM player_items pi
      JOIN items i ON i.id = pi.item_id
      LEFT JOIN LATERAL (
        SELECT character_cid FROM hero_equipment
        WHERE item_id = i.id AND player = ${player}
        LIMIT 1
      ) he ON true
      WHERE pi.player = ${player}
      ORDER BY pi.acquired_at DESC
    `;
    res.json({ ok: true, items: rows.map(r => ({
      id:          Number(r.id),
      name:        r.name,
      description: r.description,
      rarity:      r.rarity,
      slot_type:   r.slot_type,
      slug:        r.slug,
      atk_bonus:   Number(r.atk_bonus),
      hp_bonus:    Number(r.hp_bonus),
      spd_bonus:   Number(r.spd_bonus),
      source:      r.source,
      equipped_on: r.equipped_on || null,
      sell_price:  r.source === 'idle_dungeon' ? (IDLE_RECIPE_BY_SLUG[r.slug]?.sellPrice ?? null) : null,
    })) });
  } catch (err) {
    console.error('[GET /api/player-items]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/gear/unequip
 * Body: { player, character_cid, slot_type }
 * - If this slot has a starter item in character_starter_loadout:
 *     - Current item IS starter → 403 (cannot unequip starter)
 *     - Current item is NOT starter → revert to starter item
 * - If slot has no starter → delete the row (slot becomes empty)
 */
app.post('/api/gear/unequip', async (req, res) => {
  const { player, character_cid, slot_type } = req.body;
  if (!player || !character_cid || !slot_type) {
    return res.status(400).json({ ok: false, error: 'player, character_cid, slot_type required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Check current equipped item
    const [current] = await sql`
      SELECT he.item_id, i.rarity
      FROM hero_equipment he
      JOIN items i ON i.id = he.item_id
      WHERE he.player = ${player} AND he.character_cid = ${character_cid} AND he.slot_type = ${slot_type}
    `;
    if (!current) return res.status(404).json({ ok: false, error: 'No item equipped in this slot' });

    // Check if this slot has a starter default
    const [starter] = await sql`
      SELECT item_id FROM character_starter_loadout
      WHERE character_cid = ${character_cid} AND slot_type = ${slot_type}
    `;

    if (starter) {
      if (Number(current.item_id) === Number(starter.item_id)) {
        return res.status(403).json({ ok: false, error: 'Cannot unequip a starter item' });
      }
      // Revert to starter
      await sql`
        UPDATE hero_equipment
        SET item_id = ${starter.item_id}, equipped_at = now()
        WHERE player = ${player} AND character_cid = ${character_cid} AND slot_type = ${slot_type}
      `;
      const [starterItem] = await sql`SELECT id, name, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus FROM items WHERE id = ${starter.item_id}`;
      return res.json({ ok: true, slot: starterItem });
    }

    // No starter for this slot — empty it
    await sql`
      DELETE FROM hero_equipment
      WHERE player = ${player} AND character_cid = ${character_cid} AND slot_type = ${slot_type}
    `;
    res.json({ ok: true, slot: null });
  } catch (err) {
    console.error('[POST /api/gear/unequip]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Motor of Chaos ────────────────────────────────────────────────────────────
// Both chests use the same stat scaling and req_count table.
// Veteran Chest: fixed moderate req values per rarity (curated, predictable).
// Chaos Chest:   req values scale inversely with D20 (harder on low rolls).
// D20 = 1 (critical fail): stats random between neg floor and rarity floor.
//   Flavor text only on Chaos Chest.

const CHEST_RARITY_ROLL = [
  { rarity: 'common',    max: 40  },
  { rarity: 'uncommon',  max: 70  },
  { rarity: 'rare',      max: 90  },
  { rarity: 'epic',      max: 98  },
  { rarity: 'legendary', max: 100 },
];

// [floor, ceiling] per rarity. D20 roll scales linearly between them.
// SPD teto: common=1, uncommon=2, rare=3, epic=4, legendary=5 (one unit per tier).
// req_count: 0=common, 1=uncommon/rare, 2=epic/legendary.
const CHEST_STAT_CFG = {
  common:    { count: 1, req_count: 0, atk: [3,10],  hp: [30,80],   spd: [0,1],   neg: { atk:-5,  hp:-30,  spd:-0.5 } },
  uncommon:  { count: 1, req_count: 1, atk: [8,18],  hp: [60,150],  spd: [1,2],   neg: { atk:-8,  hp:-50,  spd:-1.0 } },
  rare:      { count: 2, req_count: 1, atk: [15,28], hp: [130,250], spd: [2,3],   neg: { atk:-12, hp:-80,  spd:-1.5 } },
  epic:      { count: 2, req_count: 2, atk: [25,38], hp: [240,380], spd: [3,4],   neg: { atk:-18, hp:-120, spd:-2.0 } },
  legendary: { count: 3, req_count: 2, atk: [35,50], hp: [360,550], spd: [4,5],   neg: { atk:-25, hp:-180, spd:-2.5 } },
};

// Veteran Chest: fixed moderate requirement values per rarity.
const VETERAN_REQ_VALUE = { uncommon: 10, rare: 13, epic: 16, legendary: 20 };

const CHEST_PREFIXES   = ['Ancient','Cursed','Divine','Shadow','Burning','Frozen','Runed','Spectral','Wicked','Sacred'];
const CHEST_SUFFIXES   = ['of Ruin','of the Fallen','of Chaos','of Dawn','of Shadows','of the Void','of Eternity','of Power'];
const CHEST_SLOT_WORDS = {
  amulet:'Amulet', helm:'Helm', chest:'Cuirass',
  offhand:'Shield', belt:'Belt', legs:'Greaves', gloves:'Gauntlets',
  ring1:'Ring', ring2:'Ring', boots:'Boots', special:'Relic',
};
const WEAPON_TYPES = ['Blade', 'Axe', 'Shortsword', 'Dagger', 'Bow', 'Staff', 'Mace', 'Spear'];
const CHAOS_FLAVOR_TEXTS = [
  'Forjada às 3 da manhã por um ferreiro bêbado.',
  'Pertenceu a três generais diferentes. Todos pediram demissão.',
  'O próprio dragão recusou usar esta peça.',
  'Encontrada no lixo. Duas vezes.',
  'A lâmina sussurra insultos durante a batalha.',
  'Certificada como inútil por três guildas diferentes.',
  'Rejeitada até pelo mercado de usados.',
  'Foi usada por um goblin por 12 anos antes de ser lavada.',
  'Amaldiçoada levemente. Talvez.',
  'O ferreiro se desculpou ao entregá-la.',
];
const CHAOS_ATTR_POOL = ['str','dex','con','int','wis','cha'];

function _rollRarity(table = CHEST_RARITY_ROLL) {
  const r = Math.random() * 100;
  return { rarity: table.find(x => r < x.max).rarity, rarityRoll: parseFloat(r.toFixed(2)) };
}

// Rolls a single stat value scaled by D20 (rolls 2-20).
// stat = floor + (d20/20) * (ceiling - floor)
function _scaleByD20(min, max, d20) {
  return min + (d20 / 20) * (max - min);
}

// Veteran Chest: D20=2-20 linear scaling, no requirements.
function _rollVeteranStats(rarity, d20) {
  const cfg  = CHEST_STAT_CFG[rarity];
  const keys = ['atk','hp','spd'].sort(() => Math.random() - 0.5).slice(0, cfg.count);
  const out  = { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
  for (const k of keys) {
    const [mn, mx] = cfg[k];
    const raw = _scaleByD20(mn, mx, d20);
    if (k === 'spd') out.spd_bonus = parseFloat(Math.min(raw, mx).toFixed(2));
    else if (k === 'atk') out.atk_bonus = Math.min(Math.round(raw), mx);
    else out.hp_bonus = Math.min(Math.round(raw), mx);
  }
  return out;
}

// Chaos Chest D20=1: each stat independently random between neg floor and rarity floor.
function _rollCriticalFail(rarity) {
  const cfg  = CHEST_STAT_CFG[rarity];
  const keys = ['atk','hp','spd'].sort(() => Math.random() - 0.5).slice(0, cfg.count);
  const out  = { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
  for (const k of keys) {
    const negFloor = cfg.neg[k];
    const posMax   = cfg[k][0]; // rarity floor = teto do D20=1
    const raw      = negFloor + Math.random() * (posMax - negFloor);
    if (k === 'spd') out.spd_bonus = parseFloat(raw.toFixed(2));
    else if (k === 'atk') out.atk_bonus = Math.round(raw);
    else out.hp_bonus = Math.round(raw);
  }
  return out;
}

// Returns requirement fields for both chest types based on rarity req_count.
// Veteran: fixed moderate values. Chaos: inversely D20-scaled (harder on low rolls).
function _pickReqs(rarity, d20, chestType) {
  const reqCount = CHEST_STAT_CFG[rarity].req_count;
  if (reqCount === 0) return { reqAttr: null, reqValue: null, reqAttr2: null, reqValue2: null };

  const attrs   = [...CHAOS_ATTR_POOL].sort(() => Math.random() - 0.5);
  const reqAttr  = attrs[0];
  const reqAttr2 = reqCount >= 2 ? attrs[1] : null;

  let reqValue, reqValue2 = null;
  if (chestType === 'chaos_chest') {
    reqValue  = Math.round(20 - (d20 / 20) * 10);
    if (reqCount >= 2) reqValue2 = Math.round(20 - (d20 / 20) * 10);
  } else {
    reqValue  = VETERAN_REQ_VALUE[rarity] || 12;
    if (reqCount >= 2) reqValue2 = reqValue;
  }

  return { reqAttr, reqValue, reqAttr2, reqValue2 };
}

function _rollName(slot) {
  const p        = CHEST_PREFIXES[Math.floor(Math.random() * CHEST_PREFIXES.length)];
  const s        = CHEST_SUFFIXES[Math.floor(Math.random() * CHEST_SUFFIXES.length)];
  const slotWord = slot === 'weapon'
    ? WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)]
    : (CHEST_SLOT_WORDS[slot] || 'Item');
  return `${p} ${slotWord} ${s}`;
}

function _randomSlot() {
  const slots = Object.keys(CHEST_SLOT_WORDS);
  return slots[Math.floor(Math.random() * slots.length)];
}

// Returns { item_data, d20, flavor_text } ready to INSERT into items table.
function _generateChestItem(chestType) {
  const rarityTable = chestType === 'basic_chest' ? BASIC_CHEST_RARITY_ROLL : CHEST_RARITY_ROLL;
  const { rarity, rarityRoll } = _rollRarity(rarityTable);
  const slot    = _randomSlot();
  const name    = _rollName(slot);
  const d20     = Math.floor(Math.random() * 20) + 1;
  const desc    = chestType === 'chaos_chest' ? 'Motor of Chaos — Chaos Chest' : 'Motor of Chaos — Veteran Chest';

  let stats, flavorText = null;

  if (d20 === 1) {
    stats = _rollCriticalFail(rarity);
    if (chestType === 'chaos_chest') {
      const hasNegative = stats.atk_bonus < 0 || stats.hp_bonus < 0 || stats.spd_bonus < 0;
      if (hasNegative) {
        flavorText = CHAOS_FLAVOR_TEXTS[Math.floor(Math.random() * CHAOS_FLAVOR_TEXTS.length)];
      }
    }
  } else {
    stats = _rollVeteranStats(rarity, d20);
  }

  const { reqAttr, reqValue, reqAttr2, reqValue2 } = _pickReqs(rarity, d20, chestType);

  return { name, desc, rarity, rarityRoll, slot, d20, stats, reqAttr, reqValue, reqAttr2, reqValue2, flavorText };
}

/**
 * POST /api/chest/open
 * Body: { chest_type: 'treasure_chest' | 'chaos_chest' }
 * Verifies the player has paid (via verify-purchase flow) and opens a chest,
 * rolling an item and adding it to player_items.
 * Called internally from verify-purchase — not a public standalone endpoint.
 */
const CHEST_TYPE_LABEL = { treasure_chest: 'veteran', chaos_chest: 'chaos', basic_chest: 'basic' };

async function openChest(username, chestType, origin = 'shop') {
  const typeLabel  = CHEST_TYPE_LABEL[chestType] || 'veteran';
  const itemSource = `chest_${typeLabel}_${origin}`;
  const { name, desc, rarity, rarityRoll, slot, d20, stats, reqAttr, reqValue, reqAttr2, reqValue2, flavorText } = _generateChestItem(chestType);
  const [item] = await sql`
    INSERT INTO items (name, description, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus,
                       source, d20_roll, rarity_roll, req_attr, req_value, req_attr2, req_value2, flavor_text)
    VALUES (${name}, ${desc}, ${rarity}, ${slot},
            ${stats.atk_bonus}, ${stats.hp_bonus}, ${stats.spd_bonus},
            ${itemSource}, ${d20}, ${rarityRoll}, ${reqAttr}, ${reqValue}, ${reqAttr2}, ${reqValue2}, ${flavorText})
    RETURNING *
  `;
  await sql`
    INSERT INTO player_items (player, item_id, source)
    VALUES (${username}, ${item.id}, ${itemSource})
    ON CONFLICT DO NOTHING
  `;
  const reqLog = [reqAttr && `${reqAttr}>=${reqValue}`, reqAttr2 && `${reqAttr2}>=${reqValue2}`].filter(Boolean).join(' ');
  console.log(`🎲 Chest opened: ${username} → "${name}" (${rarity}) D20=${d20} atk${stats.atk_bonus>=0?'+':''}${stats.atk_bonus} hp${stats.hp_bonus>=0?'+':''}${stats.hp_bonus} spd${stats.spd_bonus>=0?'+':''}${stats.spd_bonus}${reqLog ? ` req:${reqLog}` : ''}`);
  return {
    id:          Number(item.id),
    name:        item.name,
    rarity:      item.rarity,
    slot_type:   item.slot_type,
    atk_bonus:   Number(item.atk_bonus),
    hp_bonus:    Number(item.hp_bonus),
    spd_bonus:   Number(item.spd_bonus),
    d20_roll:    d20,
    req_attr:    reqAttr,
    req_value:   reqValue,
    req_attr2:   reqAttr2,
    req_value2:  reqValue2,
    flavor_text: flavorText,
  };
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
 * POST /api/idle/start
 * Body: { player }
 * Starts (or resumes) an idle run: requires potions > 0, resets hp to the
 * fixed hero's current max, sets status='running'. No longer tied to any
 * formation — the idle hero is a fixed generic hero, decoupled from the
 * player's own roster (confirmed design pivot, see IDLE_CONFIG comment above).
 */
app.post('/api/idle/start', async (req, res) => {
  const { player } = req.body;
  if (!player) {
    return res.status(400).json({ ok: false, error: 'player required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await sql`INSERT INTO idle_wallet (player) VALUES (${player}) ON CONFLICT (player) DO NOTHING`;
    const [state] = await sql`
      INSERT INTO idle_state (player) VALUES (${player})
      ON CONFLICT (player) DO NOTHING
      RETURNING potions, hero_level
    `;
    const row = state ?? (await sql`SELECT potions, hero_level FROM idle_state WHERE player = ${player}`)[0];
    if (row.potions <= 0) {
      return res.status(400).json({ ok: false, error: 'No potions available' });
    }
    const heroStats = idleHeroStatsForLevel(row.hero_level);
    await sql`
      UPDATE idle_state
      SET status = 'running', hp = ${heroStats.maxHp}, max_hp = ${heroStats.maxHp},
          enemies = '[]'::jsonb, next_enemy_id = 1,
          next_guerreiro_ms = ${IDLE_MONSTERS.guerreiro.spawnMs}, next_arqueiro_ms = ${IDLE_MONSTERS.arqueiro.spawnMs},
          next_hero_attack_ms = ${IDLE_HERO_ATTACK_MS},
          last_tick_at = now(), last_heartbeat_at = now(), updated_at = now()
      WHERE player = ${player}
    `;
    res.json({ ok: true, status: 'running', max_hp: heroStats.maxHp, hero_level: row.hero_level });
  } catch (err) {
    console.error('[POST /api/idle/start]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function resolveIdleTicks(player) {
  const [state] = await sql`SELECT * FROM idle_state WHERE player = ${player}`;
  if (!state || state.status !== 'running') return state;

  const now = Date.now();
  const lastTick = new Date(state.last_tick_at).getTime();
  const lastHeartbeat = new Date(state.last_heartbeat_at).getTime();
  let elapsedMs = now - lastTick;
  if (elapsedMs <= 0) return state;

  const isOnline = (now - lastHeartbeat) <= IDLE_CONFIG.ONLINE_GRACE_MS;
  // Offline gaps run sequentially (one enemy at a time) and are capped so a
  // player who was away for months doesn't trigger an unbounded simulation.
  if (!isOnline) elapsedMs = Math.min(elapsedMs, IDLE_CONFIG.MAX_OFFLINE_CATCHUP_MS);

  const result = simulateIdleSegment({
    heroLevel: state.hero_level,
    heroXp: state.hero_xp,
    heroHp: Number(state.hp),
    potions: state.potions,
    autoPotionPct: state.auto_potion_pct,
    enemies: state.enemies ?? [],
    nextGuerreiroMs: state.next_guerreiro_ms,
    nextArqueiroMs: state.next_arqueiro_ms,
    nextHeroAttackMs: state.next_hero_attack_ms,
    nextEnemyId: state.next_enemy_id,
  }, elapsedMs, { sequential: !isOnline });

  const newStatus = result.died ? 'stopped' : 'running';
  // Clear leftover enemies on death so a 'stopped' state never shows stale
  // enemy cards until the next /api/idle/start resets the arena.
  const enemiesJson = JSON.stringify(result.died ? [] : result.enemies);

  // Atomically claim this tick window before crediting anything: the WHERE
  // clause only matches if resolve_version hasn't moved since we read it
  // above (an integer counter, not last_tick_at — TIMESTAMPTZ round-trips
  // through the JS driver at millisecond precision while Postgres stores
  // microseconds, so a timestamp-equality guard silently never matches).
  // A concurrent resolveIdleTicks call for the same player (e.g. overlapping
  // polls) that loses this race gets 0 rows back and must not credit the
  // window a second time — this is what stops duplicate coins/xp/fragments.
  let claimed;
  if (isOnline) {
    [claimed] = await sql`
      UPDATE idle_state
      SET hero_level = ${result.heroLevel}, hero_xp = ${result.heroXp}, status = ${newStatus},
          hp = ${result.heroHp}, max_hp = ${result.heroMaxHp}, potions = ${result.potions},
          enemies = ${enemiesJson}::jsonb, next_enemy_id = ${result.nextEnemyId},
          next_guerreiro_ms = ${result.nextGuerreiroMs}, next_arqueiro_ms = ${result.nextArqueiroMs},
          next_hero_attack_ms = ${result.nextHeroAttackMs},
          last_tick_at = now(), resolve_version = resolve_version + 1, updated_at = now()
      WHERE player = ${player} AND resolve_version = ${state.resolve_version}
      RETURNING *
    `;
  } else {
    const mergedFragments = { ...(state.pending_fragments ?? {}) };
    for (const [slotType, qty] of Object.entries(result.fragmentsGained)) {
      mergedFragments[slotType] = (mergedFragments[slotType] ?? 0) + qty;
    }
    [claimed] = await sql`
      UPDATE idle_state
      SET pending_coins = pending_coins + ${result.coinsGained},
          pending_diamonds = pending_diamonds + ${result.diamondsGained},
          pending_xp = pending_xp + ${result.xpGained},
          pending_fragments = ${JSON.stringify(mergedFragments)}::jsonb,
          hero_level = ${result.heroLevel}, hero_xp = ${result.heroXp}, status = ${newStatus},
          hp = ${result.heroHp}, max_hp = ${result.heroMaxHp}, potions = ${result.potions},
          enemies = ${enemiesJson}::jsonb, next_enemy_id = ${result.nextEnemyId},
          next_guerreiro_ms = ${result.nextGuerreiroMs}, next_arqueiro_ms = ${result.nextArqueiroMs},
          next_hero_attack_ms = ${result.nextHeroAttackMs},
          last_tick_at = now(), resolve_version = resolve_version + 1, updated_at = now()
      WHERE player = ${player} AND resolve_version = ${state.resolve_version}
      RETURNING *
    `;
  }

  if (!claimed) {
    // Lost the race — another call already resolved this exact window.
    const [refreshed] = await sql`SELECT * FROM idle_state WHERE player = ${player}`;
    return refreshed;
  }

  if (isOnline) {
    await sql`UPDATE idle_wallet SET coins = coins + ${result.coinsGained}, diamonds = diamonds + ${result.diamondsGained} WHERE player = ${player}`;
    for (const [slotType, qty] of Object.entries(result.fragmentsGained)) {
      await sql`
        INSERT INTO idle_fragments (player, slot_type, qty) VALUES (${player}, ${slotType}, ${qty})
        ON CONFLICT (player, slot_type) DO UPDATE SET qty = idle_fragments.qty + ${qty}
      `;
    }
  }

  return claimed;
}

/**
 * GET /api/idle/state?player=X
 * Resolves any elapsed idle time (online-credit or offline-pending), then returns full state.
 */
app.get('/api/idle/state', async (req, res) => {
  const { player } = req.query;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Resolve elapsed time FIRST, using the heartbeat as it stood before this
    // request — only then do we stamp a fresh heartbeat. Updating the heartbeat
    // before resolving would make every call look "just went online" and the
    // offline-pending path would never trigger.
    const state = await resolveIdleTicks(player);
    await sql`UPDATE idle_state SET last_heartbeat_at = now() WHERE player = ${player} AND status = 'running'`;
    if (!state) {
      return res.json({ ok: true, status: 'stopped', hp: 0, max_hp: 0, potions: 0, hero_level: 1, hero_xp: 0,
        xp_to_next_level: idleXpToNextLevel(1), auto_potion_pct: IDLE_CONFIG.AUTO_POTION_OPTIONS[2], enemies: [],
        coins: 0, diamonds: 0, fragments: {}, pending_coins: 0, pending_diamonds: 0, pending_xp: 0, pending_fragments: {} });
    }
    const [wallet] = await sql`SELECT coins, diamonds FROM idle_wallet WHERE player = ${player}`;
    const fragRows = await sql`SELECT slot_type, qty FROM idle_fragments WHERE player = ${player}`;
    const fragments = Object.fromEntries(fragRows.map(r => [r.slot_type, r.qty]));
    res.json({
      ok: true,
      status: state.status, hp: Number(state.hp), max_hp: Number(state.max_hp), potions: state.potions,
      hero_level: state.hero_level, hero_xp: state.hero_xp, xp_to_next_level: idleXpToNextLevel(state.hero_level),
      auto_potion_pct: state.auto_potion_pct, enemies: state.enemies ?? [],
      coins: wallet?.coins ?? 0, diamonds: wallet?.diamonds ?? 0, fragments,
      pending_coins: state.pending_coins, pending_diamonds: state.pending_diamonds,
      pending_xp: state.pending_xp, pending_fragments: state.pending_fragments ?? {},
    });
  } catch (err) {
    console.error('[GET /api/idle/state]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/idle/collect
 * Body: { player, mode }  mode: 'half' | 'full'
 * Resolves pending offline rewards into the wallet/fragments, at 50% (free) or 100% (costs diamonds).
 */
app.post('/api/idle/collect', async (req, res) => {
  const { player, mode } = req.body;
  if (!player || !['half', 'full'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'player, mode ("half"|"full") required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await resolveIdleTicks(player);
    const ratio = mode === 'full' ? 1.0 : IDLE_CONFIG.OFFLINE_REWARD_RATIO;

    if (mode === 'full') {
      // Deduct with the balance check embedded in the WHERE clause — avoids a
      // separate SELECT-then-UPDATE that a concurrent request could race
      // (checking the balance and spending it must be one atomic statement).
      const [charged] = await sql`
        UPDATE idle_wallet
        SET diamonds = diamonds - ${IDLE_CONFIG.OFFLINE_FULL_DIAMOND_COST}
        WHERE player = ${player} AND diamonds >= ${IDLE_CONFIG.OFFLINE_FULL_DIAMOND_COST}
        RETURNING diamonds
      `;
      if (!charged) {
        return res.status(400).json({ ok: false, error: 'Not enough diamonds' });
      }
    }

    // Atomically zero the pending pool and read back what it held *before*
    // zeroing. RETURNING alone reflects the row's post-UPDATE state, so a
    // plain "SET pending_coins = 0 ... RETURNING pending_coins" always
    // returns 0 — the CTE below locks and captures the old values first, in
    // the same statement, before the UPDATE clears them. A concurrent
    // /collect call that loses this race matches zero rows (nothing left
    // pending) and must grant nothing — this is what stops the same pending
    // pool from being paid out twice.
    const [claimed] = await sql`
      WITH old AS (
        SELECT pending_coins, pending_diamonds, pending_xp, pending_fragments, hero_level, hero_xp
        FROM idle_state
        WHERE player = ${player}
          AND (pending_coins > 0 OR pending_diamonds > 0 OR pending_xp > 0 OR pending_fragments <> '{}'::jsonb)
        FOR UPDATE
      )
      UPDATE idle_state
      SET pending_coins = 0, pending_diamonds = 0, pending_xp = 0, pending_fragments = '{}'::jsonb,
          updated_at = now()
      FROM old
      WHERE idle_state.player = ${player}
      RETURNING old.pending_coins, old.pending_diamonds, old.pending_xp, old.pending_fragments, old.hero_level, old.hero_xp
    `;

    if (!claimed) {
      if (mode === 'full') {
        // Refund — we charged diamonds above but there was nothing left to collect.
        await sql`UPDATE idle_wallet SET diamonds = diamonds + ${IDLE_CONFIG.OFFLINE_FULL_DIAMOND_COST} WHERE player = ${player}`;
      }
      return res.json({ ok: true, collected: { coins: 0, diamonds: 0, xp: 0, fragments: {}, ratio } });
    }

    const coinsToGrant = Math.floor(claimed.pending_coins * ratio);
    const diamondsToGrant = Math.floor(claimed.pending_diamonds * ratio);
    const xpToGrant = Math.floor(claimed.pending_xp * ratio);
    const pendingFragments = claimed.pending_fragments ?? {};
    const grantedFragments = {};

    await sql`UPDATE idle_wallet SET coins = coins + ${coinsToGrant}, diamonds = diamonds + ${diamondsToGrant} WHERE player = ${player}`;
    for (const [slotType, qty] of Object.entries(pendingFragments)) {
      const grantQty = Math.floor(Number(qty) * ratio);
      if (grantQty <= 0) continue;
      grantedFragments[slotType] = grantQty;
      await sql`
        INSERT INTO idle_fragments (player, slot_type, qty) VALUES (${player}, ${slotType}, ${grantQty})
        ON CONFLICT (player, slot_type) DO UPDATE SET qty = idle_fragments.qty + ${grantQty}
      `;
    }
    let newLevel = claimed.hero_level;
    let newXp = claimed.hero_xp + xpToGrant;
    while (newXp >= idleXpToNextLevel(newLevel)) {
      newXp -= idleXpToNextLevel(newLevel);
      newLevel += 1;
    }
    await sql`
      UPDATE idle_state SET hero_level = ${newLevel}, hero_xp = ${newXp}, updated_at = now()
      WHERE player = ${player}
    `;
    res.json({ ok: true, collected: { coins: coinsToGrant, diamonds: diamondsToGrant, xp: xpToGrant, fragments: grantedFragments, ratio } });
  } catch (err) {
    console.error('[POST /api/idle/collect]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/idle/leave
 * Body: { player }
 * Manually ends the current run: resolves any elapsed time (full credit, since the player is here now),
 * then sets status='stopped' with no penalty.
 */
app.post('/api/idle/leave', async (req, res) => {
  const { player } = req.body;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await sql`UPDATE idle_state SET last_heartbeat_at = now() WHERE player = ${player}`;
    await resolveIdleTicks(player);
    await sql`UPDATE idle_state SET status = 'stopped', updated_at = now() WHERE player = ${player}`;
    res.json({ ok: true, status: 'stopped' });
  } catch (err) {
    console.error('[POST /api/idle/leave]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/idle/buy-potions
 * Body: { player, qty }
 * Spends coins to buy potions (IDLE_CONFIG.POTION_COIN_COST each).
 */
app.post('/api/idle/buy-potions', async (req, res) => {
  const { player, qty } = req.body;
  const n = Number(qty);
  if (!player || !Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ ok: false, error: 'player, positive integer qty required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    const cost = n * IDLE_CONFIG.POTION_COIN_COST;
    // Balance check embedded in the WHERE clause — a plain SELECT-then-UPDATE
    // would let two concurrent buy calls both pass the check before either
    // deducts, letting a player buy more potions than their coins cover.
    const [charged] = await sql`
      UPDATE idle_wallet SET coins = coins - ${cost}
      WHERE player = ${player} AND coins >= ${cost}
      RETURNING coins
    `;
    if (!charged) {
      return res.status(400).json({ ok: false, error: 'Not enough coins' });
    }
    await sql`
      INSERT INTO idle_state (player, potions) VALUES (${player}, ${n})
      ON CONFLICT (player) DO UPDATE SET potions = idle_state.potions + ${n}
    `;
    res.json({ ok: true, bought: n, cost });
  } catch (err) {
    console.error('[POST /api/idle/buy-potions]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/idle/set-auto-potion
 * Body: { player, pct }
 * Sets the HP% threshold below which combat auto-consumes a potion.
 */
app.post('/api/idle/set-auto-potion', async (req, res) => {
  const { player, pct } = req.body;
  const n = Number(pct);
  if (!player || !IDLE_CONFIG.AUTO_POTION_OPTIONS.includes(n)) {
    return res.status(400).json({ ok: false, error: `player, pct required (one of ${IDLE_CONFIG.AUTO_POTION_OPTIONS.join(', ')})` });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await sql`
      INSERT INTO idle_state (player, auto_potion_pct) VALUES (${player}, ${n})
      ON CONFLICT (player) DO UPDATE SET auto_potion_pct = ${n}, updated_at = now()
    `;
    res.json({ ok: true, auto_potion_pct: n });
  } catch (err) {
    console.error('[POST /api/idle/set-auto-potion]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/idle/recipes
 * Static list — no auth required (informational only).
 */
app.get('/api/idle/recipes', (req, res) => {
  res.json({ ok: true, recipes: IDLE_RECIPES });
});

/**
 * POST /api/idle/craft
 * Body: { player, slot_type }
 * Consumes fragments + coins for that slot's recipe, grants the fixed-stat idle item.
 */
app.post('/api/idle/craft', async (req, res) => {
  const { player, slot_type } = req.body;
  const recipe = IDLE_RECIPES[slot_type];
  if (!player || !recipe) {
    return res.status(400).json({ ok: false, error: 'player and valid slot_type required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Both deductions embed their balance check in the WHERE clause (same
    // pattern as buy-potions) — a SELECT-then-UPDATE would let concurrent
    // craft calls both pass the check before either deducts. Coins are
    // charged first and refunded if the fragment deduction then fails, so
    // a player is never left having paid for a craft that didn't happen.
    const [coinsCharged] = await sql`
      UPDATE idle_wallet SET coins = coins - ${recipe.coinCost}
      WHERE player = ${player} AND coins >= ${recipe.coinCost}
      RETURNING coins
    `;
    if (!coinsCharged) {
      return res.status(400).json({ ok: false, error: 'Not enough coins' });
    }
    const [fragCharged] = await sql`
      UPDATE idle_fragments SET qty = qty - ${recipe.fragmentsRequired}
      WHERE player = ${player} AND slot_type = ${slot_type} AND qty >= ${recipe.fragmentsRequired}
      RETURNING qty
    `;
    if (!fragCharged) {
      await sql`UPDATE idle_wallet SET coins = coins + ${recipe.coinCost} WHERE player = ${player}`;
      return res.status(400).json({ ok: false, error: `Not enough ${slot_type} fragments` });
    }
    const [item] = await sql`SELECT id FROM items WHERE slug = ${recipe.slug}`;
    if (!item) {
      // Recipe item wasn't seeded — refund both charges before failing.
      await sql`UPDATE idle_wallet SET coins = coins + ${recipe.coinCost} WHERE player = ${player}`;
      await sql`
        INSERT INTO idle_fragments (player, slot_type, qty) VALUES (${player}, ${slot_type}, ${recipe.fragmentsRequired})
        ON CONFLICT (player, slot_type) DO UPDATE SET qty = idle_fragments.qty + ${recipe.fragmentsRequired}
      `;
      return res.status(500).json({ ok: false, error: 'Recipe item not seeded' });
    }
    await sql`
      INSERT INTO player_items (player, item_id, source) VALUES (${player}, ${item.id}, 'idle_dungeon')
      ON CONFLICT (player, item_id) DO NOTHING
    `;
    res.json({ ok: true, crafted: { slug: recipe.slug, name: recipe.name, item_id: item.id } });
  } catch (err) {
    console.error('[POST /api/idle/craft]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/market/sell
 * Body: { player, item_ids: number[] }
 * Sells owned idle-dungeon items for coins. Only source='idle_dungeon' items are
 * sellable, and only if not currently equipped on a hero.
 */
app.post('/api/market/sell', async (req, res) => {
  const { player, item_ids } = req.body;
  if (!player || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ ok: false, error: 'player and non-empty item_ids required' });
  }
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    // Eligibility (source, not-equipped) is checked inside the DELETE itself
    // and only the rows it actually removes come back via RETURNING — pricing
    // is computed strictly from that result, not from a prior SELECT, so a
    // concurrent sell of the same item_id can't be credited twice: whichever
    // request's DELETE loses the race finds the row already gone.
    const deleted = await sql`
      DELETE FROM player_items pi
      USING items i
      WHERE pi.item_id = i.id
        AND pi.player = ${player}
        AND pi.item_id = ANY(${item_ids})
        AND i.source = 'idle_dungeon'
        AND NOT EXISTS (
          SELECT 1 FROM hero_equipment he WHERE he.item_id = i.id AND he.player = ${player}
        )
      RETURNING pi.item_id, i.slug
    `;

    const sold = [];
    let totalCoins = 0;
    for (const row of deleted) {
      const price = IDLE_RECIPE_BY_SLUG[row.slug]?.sellPrice;
      if (!price) continue;
      sold.push({ item_id: Number(row.item_id), coins: price });
      totalCoins += price;
    }
    if (sold.length === 0) {
      return res.status(400).json({ ok: false, error: 'No sellable idle items in the given ids (must be idle_dungeon-sourced, unequipped, and priced)' });
    }
    await sql`
      INSERT INTO idle_wallet (player, coins) VALUES (${player}, ${totalCoins})
      ON CONFLICT (player) DO UPDATE SET coins = idle_wallet.coins + ${totalCoins}
    `;
    const [wallet] = await sql`SELECT coins FROM idle_wallet WHERE player = ${player}`;
    res.json({ ok: true, sold, total_coins: totalCoins, new_balance: wallet.coins });
  } catch (err) {
    console.error('[POST /api/market/sell]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/idle/dev-reset
 * Body: { player }
 * Dev/testing utility — zeroes the caller's own idle progress (potions,
 * coins, diamonds, fragments, tier/xp, pending rewards). Only ever affects
 * the authenticated caller's own account (same auth cross-check as every
 * other /api/idle/* route), so there's no cross-player risk in leaving this
 * reachable — it's gated in the UI to a specific dev account, not by a
 * server-side secret.
 */
app.post('/api/idle/dev-reset', async (req, res) => {
  const { player } = req.body;
  if (!player) return res.status(400).json({ ok: false, error: 'player required' });
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await sql`
      UPDATE idle_state
      SET status = 'stopped', hero_level = 1, hero_xp = 0, hp = 0, max_hp = 0,
          potions = 0, enemies = '[]'::jsonb, next_enemy_id = 1,
          next_guerreiro_ms = ${IDLE_MONSTERS.guerreiro.spawnMs}, next_arqueiro_ms = ${IDLE_MONSTERS.arqueiro.spawnMs},
          next_hero_attack_ms = ${IDLE_HERO_ATTACK_MS},
          pending_coins = 0, pending_diamonds = 0, pending_xp = 0, pending_fragments = '{}'::jsonb,
          updated_at = now()
      WHERE player = ${player}
    `;
    await sql`UPDATE idle_wallet SET coins = 0, diamonds = 0 WHERE player = ${player}`;
    await sql`DELETE FROM idle_fragments WHERE player = ${player}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/idle/dev-reset]', err.message);
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
             hero_cid, locked, locked_caption,
             EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
      FROM cosmetics
      ORDER BY created_at ASC
    `;
    res.json({ ok: true, items, gameAccount: HIVE_GAME_ACCOUNT });
  } catch (err) {
    console.error('[/api/shop GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const DEFAULT_BG_IDS = ['bg_desert', 'bg_florest', 'bg_snow'];
const DEFAULT_SKIN_IDS = ['skin_archer', 'skin_archmage', 'skin_assassin', 'skin_barbarian', 'skin_healer', 'skin_knight', 'skin_mage', 'skin_paladin'];

/**
 * GET /api/campaign?player=X
 * Returns the 5 campaign stages with the player's completed stages.
 */
app.get('/api/campaign', async (req, res) => {
  const { player, chapter: chapterParam } = req.query;
  const chapter = Number(chapterParam) || 1;
  const chapterStages = CAMPAIGN_CHAPTERS[chapter] || [];
  try {
    const completed = player
      ? (await sql`SELECT stage FROM campaign_progress WHERE player = ${player} AND chapter = ${chapter}`).map(r => r.stage)
      : [];
    const chapterMeta = CAMPAIGN_CHAPTER_META[chapter] || { playable: true };
    const stages = chapterStages.map(s => ({
      stage: s.stage, name: s.name, name_en: s.name_en, format: s.format,
      lore_pre: s.lore_pre, lore_pre_en: s.lore_pre_en,
      lore_post: s.lore_post, lore_post_en: s.lore_post_en,
      enemies: s.enemies, reward_slug: s.reward_slug,
      completed: completed.includes(s.stage),
      // In preview chapters, all stages are selectable so players can read lore/enemies
      unlocked: !chapterMeta.playable ? true : (s.stage === 1 || completed.includes(s.stage - 1)),
    }));
    const enemyDefs = {};
    for (const s of chapterStages) {
      for (const e of s.enemies) {
        if (e.enemy && CAMPAIGN_ENEMIES[e.cid]) enemyDefs[e.cid] = CAMPAIGN_ENEMIES[e.cid];
      }
    }
    res.json({ ok: true, stages, completed, enemyDefs, playable: chapterMeta.playable });
  } catch (err) {
    console.error('[/api/campaign GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/campaign/leaderboard
 * Returns the furthest campaign progress per player, sorted best first.
 */
app.get('/api/campaign/leaderboard', async (req, res) => {
  try {
    const rows = await sql`
      SELECT DISTINCT ON (player) player, chapter, stage
      FROM campaign_progress
      ORDER BY player, chapter DESC, stage DESC
      LIMIT 30
    `;
    const sorted = [...rows].sort((a, b) =>
      b.chapter !== a.chapter ? b.chapter - a.chapter : b.stage - a.stage
    );
    res.json({ ok: true, leaderboard: sorted.map((r, i) => ({ rank: i + 1, player: r.player, chapter: r.chapter, stage: r.stage })) });
  } catch (err) {
    console.error('[/api/campaign/leaderboard]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/campaign/complete
 * Body: { stage }
 * Marks stage as completed and grants campaign reward item to player_items.
 */
app.post('/api/campaign/complete', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const stage   = Number(req.body?.stage);
  const chapter = Number(req.body?.chapter) || 1;
  if (!stage || stage < 1) return res.status(400).json({ ok: false, error: 'Invalid stage' });

  const chapterStages = CAMPAIGN_CHAPTERS[chapter];
  if (!chapterStages) return res.status(400).json({ ok: false, error: 'Invalid chapter' });
  const stageDef = chapterStages.find(s => s.stage === stage);
  if (!stageDef) return res.status(400).json({ ok: false, error: 'Stage not found' });

  try {
    const [existing] = await sql`
      SELECT 1 FROM campaign_progress WHERE player = ${username} AND chapter = ${chapter} AND stage = ${stage}
    `;

    // Only look up reward if this chapter/stage has one defined
    let rewardItem = null;
    if (stageDef.reward_slug) {
      [rewardItem] = await sql`SELECT id, name, rarity, slug, slot_type, atk_bonus, hp_bonus, spd_bonus FROM items WHERE slug = ${stageDef.reward_slug}`;
    }

    if (!existing) {
      if (stage > 1) {
        const [prev] = await sql`
          SELECT 1 FROM campaign_progress WHERE player = ${username} AND chapter = ${chapter} AND stage = ${stage - 1}
        `;
        if (!prev) return res.status(403).json({ ok: false, error: 'Previous stage not completed' });
      }
      await sql`
        INSERT INTO campaign_progress (player, chapter, stage) VALUES (${username}, ${chapter}, ${stage})
        ON CONFLICT DO NOTHING
      `;
      if (rewardItem) {
        await sql`
          INSERT INTO player_items (player, item_id, source) VALUES (${username}, ${rewardItem.id}, 'campaign')
          ON CONFLICT DO NOTHING
        `;
      }
      console.log(`🏆 Campaign: ${username} completed Chapter ${chapter} Stage ${stage}`);
    }

    const reward = rewardItem ? {
      id:        Number(rewardItem.id),
      name:      rewardItem.name,
      rarity:    rewardItem.rarity,
      slot_type: rewardItem.slot_type,
      atk_bonus: Number(rewardItem.atk_bonus) || 0,
      hp_bonus:  Number(rewardItem.hp_bonus)  || 0,
      spd_bonus: Number(rewardItem.spd_bonus) || 0,
    } : null;
    res.json({ ok: true, reward });
  } catch (err) {
    console.error('[/api/campaign/complete POST]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function restoreSpeedOffsets() {
  // Canonical spd_offset values (initiative bonus added to D20 each round).
  // Only runs if archer is not yet at the expected value — prevents overwriting on every restart.
  try {
    const rows = await sql`
      SELECT cb.spd_offset FROM characters_base cb
      JOIN characters c ON c.id = cb.character_id
      WHERE c.cid = 'archer' LIMIT 1
    `;
    if (Number(rows[0]?.spd_offset) === 4) {
      console.log('   Speed offsets: ✅ ok');
      return;
    }
    const speeds = [
      { cid: 'knight',    spd: 1.0 },
      { cid: 'paladin',   spd: 1.0 },
      { cid: 'barbarian', spd: 1.5 },
      { cid: 'mage',      spd: 2.0 },
      { cid: 'archer',    spd: 4.0 },
      { cid: 'assassin',  spd: 4.0 },
      { cid: 'archmage',  spd: 1.0 },
      { cid: 'healer',    spd: 1.0 },
    ];
    for (const { cid, spd } of speeds) {
      await sql`UPDATE characters_base SET spd_offset=${spd} WHERE character_id=(SELECT id FROM characters WHERE cid=${cid})`;
    }
    console.log('   Speed offsets: ✅ restored');
  } catch (e) {
    console.warn('   Speed offsets: ⚠️', e.message);
  }
}

async function migrateRpgAttrs() {
  // 1. Add columns — always safe (idempotent)
  const cols = [
    `ADD COLUMN IF NOT EXISTS str          SMALLINT     NOT NULL DEFAULT 10`,
    `ADD COLUMN IF NOT EXISTS dex          SMALLINT     NOT NULL DEFAULT 10`,
    `ADD COLUMN IF NOT EXISTS con          SMALLINT     NOT NULL DEFAULT 10`,
    `ADD COLUMN IF NOT EXISTS int          SMALLINT     NOT NULL DEFAULT 10`,
    `ADD COLUMN IF NOT EXISTS wis          SMALLINT     NOT NULL DEFAULT 10`,
    `ADD COLUMN IF NOT EXISTS cha          SMALLINT     NOT NULL DEFAULT 10`,
    `ADD COLUMN IF NOT EXISTS primary_attr VARCHAR(8)   NOT NULL DEFAULT 'str'`,
    `ADD COLUMN IF NOT EXISTS skill_attr   VARCHAR(8)   NOT NULL DEFAULT 'str'`,
    `ADD COLUMN IF NOT EXISTS weapon_bonus SMALLINT     NOT NULL DEFAULT 0`,
    `ADD COLUMN IF NOT EXISTS armor_bonus  SMALLINT     NOT NULL DEFAULT 0`,
    `ADD COLUMN IF NOT EXISTS spd_offset   NUMERIC(5,2) NOT NULL DEFAULT 0`,
    `ADD COLUMN IF NOT EXISTS sp_bonus     NUMERIC(6,3) NOT NULL DEFAULT 0`,
  ];
  for (const col of cols) {
    try { await sql(`ALTER TABLE characters_base ${col}`); } catch {}
  }

  // 2. Only populate values on first-time setup (str still at default 10 for knight)
  try {
    const rows = await sql`
      SELECT cb.str, cb.con, cb.weapon_bonus FROM characters_base cb
      JOIN characters c ON c.id = cb.character_id
      WHERE c.cid = 'knight' LIMIT 1
    `;
    if (rows[0]?.str === 16 && rows[0]?.con === 16 && Number(rows[0]?.weapon_bonus) === 0) {
      // Already at correct values — just clean up any leftover dev-test items
      await sql`DELETE FROM hero_equipment WHERE item_id IN (SELECT id FROM items WHERE description = '[DEV-TEST] Motor of Chaos')`;
      await sql`DELETE FROM items WHERE description = '[DEV-TEST] Motor of Chaos'`;
      console.log('   RPG attrs: ✅ columns ok');
      return;
    }
  } catch {}

  // 3. Populate/update all RPG attribute values
  const updates = [
    { cid: 'knight',    vals: `str=16,dex=10,con=16,int=10,wis=10,cha=10, primary_attr='str',skill_attr='con', weapon_bonus=0,armor_bonus=142,spd_offset=1.0,sp_bonus=0`    },
    { cid: 'paladin',   vals: `str=16,dex=10,con=14,int=10,wis=12,cha=10, primary_attr='str',skill_attr='cha', weapon_bonus=0,armor_bonus=137,spd_offset=1.0,sp_bonus=0`    },
    { cid: 'barbarian', vals: `str=18,dex=11,con=13,int=10,wis=10,cha=10, primary_attr='str',skill_attr='str', weapon_bonus=0,armor_bonus=130,spd_offset=1.5,sp_bonus=0`    },
    { cid: 'assassin',  vals: `str=11,dex=18,con=13,int=10,wis=10,cha=10, primary_attr='dex',skill_attr='dex', weapon_bonus=0,armor_bonus=13, spd_offset=4.0,sp_bonus=0`    },
    { cid: 'archer',    vals: `str=10,dex=18,con=10,int=10,wis=10,cha=14, primary_attr='dex',skill_attr='dex', weapon_bonus=0,armor_bonus=60, spd_offset=4.0,sp_bonus=0`    },
    { cid: 'mage',      vals: `str=10,dex=12,con=12,int=18,wis=10,cha=10, primary_attr='int',skill_attr='int', weapon_bonus=0,armor_bonus=30, spd_offset=2.0,sp_bonus=0`    },
    { cid: 'archmage',  vals: `str=10,dex=10,con=10,int=18,wis=12,cha=12, primary_attr='int',skill_attr='int', weapon_bonus=0,armor_bonus=58, spd_offset=1.0,sp_bonus=0`    },
    { cid: 'healer',    vals: `str=10,dex=10,con=12,int=12,wis=18,cha=10, primary_attr='wis',skill_attr='wis', weapon_bonus=0,armor_bonus=39, spd_offset=1.0,sp_bonus=1.25` },
  ];
  for (const { cid, vals } of updates) {
    try { await sql(`UPDATE characters_base SET ${vals} WHERE character_id=(SELECT id FROM characters WHERE cid='${cid}')`); } catch {}
  }
  console.log('   RPG attrs: ✅ migrated');
}

const IDLE_RECIPES = {
  weapon: { slug: 'idle_weapon_forged', name: 'Forged Blade of the Depths',   fragmentsRequired: 100, coinCost: 100, sellPrice: 40, atk: 18, hp: 0,   spd: 0   },
  helm:   { slug: 'idle_helm_forged',   name: 'Cavern Warden Helm',           fragmentsRequired: 100, coinCost: 100, sellPrice: 40, atk: 0,  hp: 90,  spd: 0   },
  legs:   { slug: 'idle_legs_forged',   name: 'Greaves of the Eternal Delve', fragmentsRequired: 100, coinCost: 100, sellPrice: 40, atk: 0,  hp: 120, spd: 0.4 },
  boots:  { slug: 'idle_boots_forged',  name: 'Tunneler Boots',               fragmentsRequired: 100, coinCost: 100, sellPrice: 40, atk: 0,  hp: 40,  spd: 0.8 },
  gloves: { slug: 'idle_gloves_forged', name: 'Fists of the Deep',            fragmentsRequired: 100, coinCost: 100, sellPrice: 40, atk: 14, hp: 20,  spd: 0   },
  ring1:  { slug: 'idle_ring1_forged',  name: 'Band of the Unyielding Delver',fragmentsRequired: 100, coinCost: 100, sellPrice: 40, atk: 8,  hp: 60,  spd: 0   },
};

// Reverse lookup used by the Market sell endpoint to price an idle item by
// its items.slug without a second recipe table in Postgres.
const IDLE_RECIPE_BY_SLUG = Object.fromEntries(Object.values(IDLE_RECIPES).map(r => [r.slug, r]));

async function seedIdleRecipes() {
  const desc = 'Idle Dungeon craft — fixed stats, forged from fragments.';
  // 'rarity' is constrained to starter/common/uncommon/rare/epic/legendary (items_rarity_check) —
  // 'rare' is a placeholder tier for idle-crafted gear, tunable later.
  try {
    for (const [slotType, r] of Object.entries(IDLE_RECIPES)) {
      await sql`
        INSERT INTO items (name, description, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus, slug, source)
        VALUES (${r.name}, ${desc}, 'rare', ${slotType}, ${r.atk}, ${r.hp}, ${r.spd}, ${r.slug}, 'idle_dungeon')
        ON CONFLICT (slug) DO UPDATE
          SET name = EXCLUDED.name, atk_bonus = EXCLUDED.atk_bonus,
              hp_bonus = EXCLUDED.hp_bonus, spd_bonus = EXCLUDED.spd_bonus
      `;
    }
    console.log('   Idle Dungeon: ✅ recipes seeded');
  } catch (e) {
    console.error('   Idle Dungeon: ❌ seedIdleRecipes', e.message);
  }
}

async function migrateIdleDungeon() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS idle_state (
        player            TEXT         PRIMARY KEY,
        formation_slot    SMALLINT     NOT NULL DEFAULT 1,
        tier              SMALLINT     NOT NULL DEFAULT 1,
        idle_xp           INT          NOT NULL DEFAULT 0,
        status            VARCHAR(10)  NOT NULL DEFAULT 'stopped', -- 'running' | 'stopped'
        hp                NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_hp            NUMERIC(10,2) NOT NULL DEFAULT 0,
        potions           INT          NOT NULL DEFAULT 0,
        last_tick_at      TIMESTAMPTZ,
        last_heartbeat_at TIMESTAMPTZ,
        pending_coins     INT          NOT NULL DEFAULT 0,
        pending_diamonds  INT          NOT NULL DEFAULT 0,
        pending_xp        INT          NOT NULL DEFAULT 0,
        pending_fragments JSONB        NOT NULL DEFAULT '{}',
        resolve_version   INT          NOT NULL DEFAULT 0,
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `;
    // idle_state may already exist from an earlier deploy without this column —
    // integer optimistic-lock counter used by resolveIdleTicks() instead of
    // comparing last_tick_at, since TIMESTAMPTZ round-trips through the JS
    // driver at millisecond precision while Postgres stores microseconds,
    // so a timestamp-equality guard would never match.
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS resolve_version INT NOT NULL DEFAULT 0`; } catch {}
    // Tracks ms consumed of the potion currently "in progress" so short,
    // frequent resolves (e.g. a 15s frontend poll) don't each round up to a
    // whole potion — only potion_ms_used crossing POTION_COVERAGE_MS spends
    // a whole potion from the integer `potions` count.
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS potion_ms_used INT NOT NULL DEFAULT 0`; } catch {}
    // Tracks leftover ms toward the next kill so short, frequent resolves
    // don't each floor-discard the sub-interval remainder (e.g. a 15s poll
    // against a 4s kill interval would otherwise lose ~3s of progress per
    // poll instead of carrying it into the next resolve).
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS kill_ms_remainder INT NOT NULL DEFAULT 0`; } catch {}
    // Fixed-generic-hero combat rewrite (2026-08-06): hero_level/hero_xp
    // replace the old idle_xp/tier pair; enemies + the next_*_ms timers hold
    // the live combat-simulation state between resolves (see simulateIdleSegment).
    // formation_slot/tier/idle_xp/potion_ms_used/kill_ms_remainder become
    // unused legacy columns, left in place rather than dropped.
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS hero_level SMALLINT NOT NULL DEFAULT 1`; } catch {}
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS hero_xp INT NOT NULL DEFAULT 0`; } catch {}
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS auto_potion_pct SMALLINT NOT NULL DEFAULT 50`; } catch {}
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS enemies JSONB NOT NULL DEFAULT '[]'`; } catch {}
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS next_enemy_id INT NOT NULL DEFAULT 1`; } catch {}
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS next_guerreiro_ms INT NOT NULL DEFAULT 5000`; } catch {}
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS next_arqueiro_ms INT NOT NULL DEFAULT 8000`; } catch {}
    try { await sql`ALTER TABLE idle_state ADD COLUMN IF NOT EXISTS next_hero_attack_ms INT NOT NULL DEFAULT 1600`; } catch {}
    await sql`
      CREATE TABLE IF NOT EXISTS idle_wallet (
        player   TEXT PRIMARY KEY,
        coins    INT NOT NULL DEFAULT 0,
        diamonds INT NOT NULL DEFAULT 0
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS idle_fragments (
        player    TEXT NOT NULL,
        slot_type TEXT NOT NULL,
        qty       INT  NOT NULL DEFAULT 0,
        PRIMARY KEY (player, slot_type)
      )
    `;
    console.log('   Idle Dungeon: ✅ tables ready');
    await seedIdleRecipes();
  } catch (e) {
    console.error('   Idle Dungeon: ❌', e.message);
  }
}

async function seedTreasures() {
  try {
    // pg_get_constraintdef normalizes IN(...) to = ANY(ARRAY[...]), so search by 'background'
    const checks = await sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'cosmetics'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%background%'
    `;
    for (const { conname } of checks) {
      await sql(`ALTER TABLE cosmetics DROP CONSTRAINT IF EXISTS "${conname}"`);
    }
    try {
      await sql(`ALTER TABLE cosmetics ADD CONSTRAINT cosmetics_type_check CHECK (type IN ('background', 'skin', 'treasure'))`);
    } catch (e) {
      if (!String(e?.message).toLowerCase().includes('already exists')) throw e;
    }
  } catch (e) {
    console.warn('   Treasures: ⚠️  constraint update skipped:', e.message);
  }
  try {
    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive)
      VALUES ('treasure_chest', 'treasure', 'Veteran Chest', '/images/treasures/chest.png', 2.000)
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, price_hive = EXCLUDED.price_hive, type = EXCLUDED.type, preview = EXCLUDED.preview
    `;
    await sql`
      INSERT INTO cosmetics (id, type, name, preview, price_hive)
      VALUES ('chaos_chest', 'treasure', 'Chaos Chest', '/images/treasures/chaos-chest.png', 10.000)
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, price_hive = EXCLUDED.price_hive, type = EXCLUDED.type, preview = EXCLUDED.preview
    `;
    console.log('   Treasures: ✅ seeded');
  } catch (e) {
    console.error('   Treasures: ❌', e.message);
  }
}

async function fixupPrecisionQuiver() {
  try {
    const [item] = await sql`
      UPDATE items SET slot_type = 'offhand'
      WHERE name = 'Precision Quiver' AND slot_type = 'special'
      RETURNING id
    `;
    if (!item) return; // already corrected or not found
    await sql`
      UPDATE character_starter_loadout
      SET slot_type = 'offhand'
      WHERE character_cid = 'archer' AND slot_type = 'special' AND item_id = ${item.id}
    `;
    await sql`
      UPDATE hero_equipment
      SET slot_type = 'offhand'
      WHERE character_cid = 'archer' AND slot_type = 'special' AND item_id = ${item.id}
    `;
    console.log('   Fixup: ✅ Precision Quiver moved from special → offhand');
  } catch (e) {
    console.warn('   Fixup Precision Quiver: ⚠️', e.message);
  }
}

async function migrateChestMeter() {
  try {
    await sql`ALTER TABLE player_init ADD COLUMN IF NOT EXISTS chest_meter            NUMERIC(10,3) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE player_init ADD COLUMN IF NOT EXISTS pending_chests_queue   JSONB         NOT NULL DEFAULT '[]'`;
    await sql`ALTER TABLE player_init ADD COLUMN IF NOT EXISTS last_basic_chest_at    DATE`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS rarity_roll NUMERIC(5,2)`;
    console.log('   chest_meter columns: ✅');
  } catch (e) {
    console.error('   chest_meter migration: ❌', e.message);
  }
}

// ── Basic Chest drop (Free PvP) ───────────────────────────────────────────────
// NOT ACTIVE YET — call tryBasicChestDrop(username) after a Free PvP win
// when the rarity % have been confirmed. Rarity table to be filled by owner.
const BASIC_CHEST_RARITY_ROLL = [
  { rarity: 'common',    max: 55  },
  { rarity: 'uncommon',  max: 85  },
  { rarity: 'rare',      max: 95  },
  { rarity: 'epic',      max: 99  },
  { rarity: 'legendary', max: 100 },
];

async function tryBasicChestDrop(username) {
  if (BASIC_CHEST_RARITY_ROLL.length === 0) return; // not active yet
  if (Math.random() > 0.01) return;                  // 1% chance
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await sql`SELECT last_basic_chest_at, pending_chests_queue FROM player_init WHERE player = ${username}`;
    if (row?.last_basic_chest_at?.toISOString?.()?.slice(0, 10) === today) return; // daily limit
    const queue = Array.isArray(row?.pending_chests_queue) ? [...row.pending_chests_queue, 'basic'] : ['basic'];
    await sql`
      INSERT INTO player_init (player, pending_chests_queue, last_basic_chest_at)
      VALUES (${username}, ${JSON.stringify(queue)}, ${today})
      ON CONFLICT (player) DO UPDATE
        SET pending_chests_queue = ${JSON.stringify(queue)},
            last_basic_chest_at  = ${today}
    `;
    console.log(`📦 Basic Chest dropped for ${username} (pending: ${queue.length})`);
    const socketId = [...(io.sockets.sockets || new Map()).values()]
      .find(s => s.data?.username === username)?.id;
    if (socketId) {
      io.to(socketId).emit('chest_meter_update', { player: username, pending: queue.length });
    }
  } catch (e) {
    console.error('[tryBasicChestDrop]', e.message);
  }
}

// Adds the arena fee to the winner's chest meter.
// liquid → +20% of wager; stake → +10%.
// Each time meter crosses 2.0 HIVE, increments pending_chests (player opens manually).
async function addToChestMeter(username, wager, payoutPref) {
  try {
    const fee = wager * (payoutPref === 'liquid' ? 0.20 : 0.10);
    await sql`
      INSERT INTO player_init (player, chest_meter)
      VALUES (${username}, ${fee})
      ON CONFLICT (player) DO UPDATE
        SET chest_meter = player_init.chest_meter + ${fee}
    `;
    const [row] = await sql`SELECT chest_meter, pending_chests_queue FROM player_init WHERE player = ${username}`;
    let meter = Number(row.chest_meter);
    let queue = Array.isArray(row.pending_chests_queue) ? row.pending_chests_queue : [];
    let earned = 0;
    while (meter >= 2.0) {
      meter -= 2.0;
      queue.push('veteran');
      earned += 1;
    }
    if (earned > 0) {
      await sql`UPDATE player_init SET chest_meter = ${meter}, pending_chests_queue = ${JSON.stringify(queue)} WHERE player = ${username}`;
      console.log(`🎁 Chest Meter: ${earned} Veteran Chest(s) queued for ${username} (pending: ${queue.length})`);
    }
    return { meter, pending: queue.length };
  } catch (e) {
    console.error('[addToChestMeter]', e.message);
  }
}

async function migrateSkillDescriptions() {
  try {
    await sql`
      UPDATE skills SET description = 'Heals the ally with lowest HP: heal = target maxHP x skill_power. Then attacks nearest enemy. Scales with level.'
      WHERE skill_key = 'healing'
        AND description LIKE '%heal = atk x skill_power%'
    `;
    await sql`
      UPDATE skills SET description = 'Heals the ally with lowest HP: heal = ATK + 10% of target maxHP. Then attacks nearest enemy. Scales with level.'
      WHERE skill_key = 'healing'
        AND description LIKE '%heal = target maxHP x skill_power%'
    `;
    console.log('   Skill descriptions: ✅ ok');
  } catch (e) {
    console.warn('   Skill descriptions: ⚠️', e.message);
  }
}

async function migrateSkillPower() {
  try {
    const rows = await sql`
      SELECT cb.skill_power::float FROM characters_base cb
      JOIN characters c ON c.id = cb.character_id
      WHERE c.cid = 'assassin' LIMIT 1
    `;
    if (Number(rows[0]?.skill_power) === 0.70) {
      console.log('   Skill power: ✅ ok');
      return;
    }
    const vals = [
      { cid: 'knight',    sp: 0.08 },
      { cid: 'paladin',   sp: 0.12 },
      { cid: 'barbarian', sp: 0.20 },
      { cid: 'assassin',  sp: 0.70 },
      { cid: 'archer',    sp: 0.10 },
      { cid: 'mage',      sp: 0.35 },
      { cid: 'archmage',  sp: 0.30 },
      { cid: 'healer',    sp: 0.60 },
    ];
    for (const { cid, sp } of vals) {
      await sql`UPDATE characters_base SET skill_power = ${sp} WHERE character_id = (SELECT id FROM characters WHERE cid = ${cid})`;
    }
    console.log('   Skill power: ✅ migrated');
  } catch (e) {
    console.warn('   Skill power: ⚠️', e.message);
  }
}

async function migrateLevelScale() {
  try {
    const rows = await sql`SELECT multiplier::float FROM level_scale WHERE level = 2 LIMIT 1`;
    if (Number(rows[0]?.multiplier) === 1.15) {
      console.log('   Level scale: ✅ linear ok');
      return;
    }
    await sql`UPDATE level_scale SET multiplier=1.00, skill_power_multiplier=1.00 WHERE level=1`;
    await sql`UPDATE level_scale SET multiplier=1.15, skill_power_multiplier=1.15 WHERE level=2`;
    await sql`UPDATE level_scale SET multiplier=1.30, skill_power_multiplier=1.30 WHERE level=3`;
    await sql`UPDATE level_scale SET multiplier=1.45, skill_power_multiplier=1.45 WHERE level=4`;
    await sql`UPDATE level_scale SET multiplier=1.60, skill_power_multiplier=1.60 WHERE level=5`;
    console.log('   Level scale: ✅ updated to linear (+15%/level)');
  } catch (e) {
    console.warn('   Level scale: ⚠️', e.message);
  }
}

async function migrateCampaign() {
  try {
    // Add slug + source columns to items (idempotent)
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS slug TEXT`); } catch {}
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'normal'`); } catch {}
    try { await sql(`CREATE UNIQUE INDEX IF NOT EXISTS items_slug_uidx ON items(slug)`); } catch {}
    // Chaos Chest columns
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS d20_roll    SMALLINT`); } catch {}
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS req_attr    VARCHAR(20)`); } catch {}
    try { await sql(`ALTER TABLE items ALTER COLUMN req_attr TYPE VARCHAR(20)`); } catch {}
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS req_value   SMALLINT`); } catch {}
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS req_attr2   VARCHAR(20)`); } catch {}
    try { await sql(`ALTER TABLE items ALTER COLUMN req_attr2 TYPE VARCHAR(20)`); } catch {}
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS req_value2  SMALLINT`); } catch {}
    try { await sql(`ALTER TABLE items ADD COLUMN IF NOT EXISTS flavor_text TEXT`); } catch {}

    await sql`
      CREATE TABLE IF NOT EXISTS campaign_progress (
        player       TEXT     NOT NULL,
        chapter      SMALLINT NOT NULL DEFAULT 1,
        stage        SMALLINT NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (player, chapter, stage)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS player_items (
        id          SERIAL PRIMARY KEY,
        player      TEXT NOT NULL,
        item_id     INT  NOT NULL,
        source      VARCHAR(20) NOT NULL DEFAULT 'normal',
        acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (player, item_id)
      )
    `;

    // Campaign reward items — one per stage, progressively rarer.
    // Slots chosen to complement the starter loadout (none of these exist as starters).
    // SPD values nerfed intentionally: uncommon=0.3, rare=0.8, legendary=1.0.
    const desc    = 'Campaign item — cannot be traded.';
    const rewards = [
      { slug: 'campaign_ch1_s1', name: "Bastion's Belt",             rarity: 'common',    slot_type: 'belt',    atk: 0,  hp: 55,  spd: 0,   req_attr: null,           req_value: null, req_attr2: null,  req_value2: null },
      { slug: 'campaign_ch1_s2', name: 'Forest Gauntlets',           rarity: 'uncommon',  slot_type: 'gloves',  atk: 10, hp: 0,   spd: 0.3, req_attr: 'primary_attr',  req_value: 10,   req_attr2: null,  req_value2: null },
      { slug: 'campaign_ch1_s3', name: "Guardians' Greaves",         rarity: 'rare',      slot_type: 'legs',    atk: 0,  hp: 160, spd: 0.8, req_attr: 'con',            req_value: 14,   req_attr2: null,  req_value2: null },
      { slug: 'campaign_ch1_s4', name: 'Crystal Tower Ring',         rarity: 'epic',      slot_type: 'ring2',   atk: 22, hp: 210, spd: 0,   req_attr: 'primary_attr',  req_value: 16,   req_attr2: 'con', req_value2: 16   },
      { slug: 'campaign_ch1_s5', name: 'Relic of the Great Council', rarity: 'legendary', slot_type: 'special', atk: 32, hp: 330, spd: 1.0, req_attr: 'primary_attr',  req_value: 20,   req_attr2: 'con', req_value2: 20   },
    ];
    for (const r of rewards) {
      await sql`
        INSERT INTO items (name, description, rarity, slot_type, atk_bonus, hp_bonus, spd_bonus, slug, source, req_attr, req_value, req_attr2, req_value2)
        VALUES (${r.name}, ${desc}, ${r.rarity}, ${r.slot_type}, ${r.atk}, ${r.hp}, ${r.spd}, ${r.slug}, 'campaign',
                ${r.req_attr}, ${r.req_value}, ${r.req_attr2}, ${r.req_value2})
        ON CONFLICT (slug) DO UPDATE
          SET name       = EXCLUDED.name,
              rarity     = EXCLUDED.rarity,
              slot_type  = EXCLUDED.slot_type,
              atk_bonus  = EXCLUDED.atk_bonus,
              hp_bonus   = EXCLUDED.hp_bonus,
              spd_bonus  = EXCLUDED.spd_bonus,
              req_attr   = EXCLUDED.req_attr,
              req_value  = EXCLUDED.req_value,
              req_attr2  = EXCLUDED.req_attr2,
              req_value2 = EXCLUDED.req_value2
      `;
    }
    console.log('   Campaign: ✅ tables and items ready');
  } catch (e) {
    console.warn('   Campaign: ⚠️', e.message);
  }
}

async function ensureDefaultCosmetics(username) {
  // Fast-path: se o jogador já foi inicializado, não faz nada.
  // Isso garante que a inicialização rode apenas uma vez por jogador.
  const [initRow] = await sql`SELECT 1 FROM player_init WHERE player = ${username}`;
  if (initRow) return;

  const allDefaults = [...DEFAULT_BG_IDS, ...DEFAULT_SKIN_IDS];

  const [ownedRows, equippedBgRows, equippedSkinRows, totalEquippedBg] = await Promise.all([
    sql`SELECT item_id FROM user_cosmetics WHERE player = ${username} AND item_id = ANY(${allDefaults})`,
    sql`SELECT item_id FROM user_equipped_backgrounds WHERE player = ${username} AND item_id = ANY(${DEFAULT_BG_IDS})`,
    sql`SELECT skin_id FROM user_equipped_skins WHERE player = ${username} AND skin_id = ANY(${DEFAULT_SKIN_IDS})`,
    sql`SELECT COUNT(*)::int as count FROM user_equipped_backgrounds WHERE player = ${username}`,
  ]);

  const ownedSet = new Set(ownedRows.map(r => r.item_id));
  const equippedBgSet = new Set(equippedBgRows.map(r => r.item_id));
  const equippedSkSet = new Set(equippedSkinRows.map(r => r.skin_id));

  const missingOwnership = allDefaults.filter(id => !ownedSet.has(id));
  const missingBgEquip = DEFAULT_BG_IDS.filter(id => !equippedBgSet.has(id));
  const missingSkinEquip = DEFAULT_SKIN_IDS.filter(id => !equippedSkSet.has(id));

  // Grant missing ownership
  for (const id of missingOwnership) {
    await sql`INSERT INTO user_cosmetics (player, item_id) VALUES (${username}, ${id}) ON CONFLICT DO NOTHING`;
  }

  // Equipa arenas padrão somente se o jogador ainda não tem nenhuma equipada.
  // Respeita seleção já feita pelo jogador.
  const userHasAnyEquippedBg = (totalEquippedBg[0]?.count ?? 0) > 0;
  if (!userHasAnyEquippedBg) {
    for (const id of missingBgEquip) {
      await sql`INSERT INTO user_equipped_backgrounds (player, item_id) VALUES (${username}, ${id}) ON CONFLICT DO NOTHING`;
    }
  }

  // Equipa skins padrão para cada herói que ainda não tem skin equipada
  if (missingSkinEquip.length > 0) {
    const skinRows = await sql`
      SELECT id, hero_cid FROM cosmetics
      WHERE id = ANY(${missingSkinEquip}) AND type = 'skin' AND hero_cid IS NOT NULL
    `;
    for (const skin of skinRows) {
      await sql`
        INSERT INTO user_equipped_skins (player, hero_cid, skin_id)
        VALUES (${username}, ${skin.hero_cid}, ${skin.id})
        ON CONFLICT (player, hero_cid) DO NOTHING
      `;
    }
  }

  // Marca o jogador como inicializado — essa função não roda mais para ele.
  await sql`INSERT INTO player_init (player) VALUES (${username}) ON CONFLICT DO NOTHING`;
  console.log(`🎮 Default cosmetics initialized for: ${username}`);
}

/**
 * GET /api/shop/owned
 * Returns array of item_ids owned by the authenticated player.
 * Grants and equips default cosmetics on first call if not yet initialized.
 */
app.get('/api/shop/owned', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    await ensureDefaultCosmetics(username);
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
    const [cosmetic] = await sql`SELECT id, type, price_hive FROM cosmetics WHERE id = ${item_id}`;
    if (!cosmetic) return res.status(400).json({ ok: false, error: 'Item not found' });

    const price = parseFloat(cosmetic.price_hive);

    // ── Treasure chests: consumable — verify payment then roll an item ──────
    if (cosmetic.type === 'treasure') {
      if (price > 0) {
        try {
          await verifyShopPayment(username, price, item_id);
        } catch {
          return res.status(402).json({ ok: false, error: 'Payment not found or timed out' });
        }
      }
      const rolledItem = await openChest(username, item_id, 'shop');
      console.log(`💰 Chest purchased: ${username} → ${item_id} (${price} HIVE)`);
      return res.json({ ok: true, item: rolledItem });
    }

    // ── Cosmetics: idempotent ownership grant ────────────────────────────────
    const [existing] = await sql`
      SELECT 1 FROM user_cosmetics WHERE player = ${username} AND item_id = ${item_id}
    `;
    if (existing) return res.json({ ok: true });

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

// ── POST /api/shop/review-purchases ──────────────────────────────────────────
// Rate-limited to avoid abuse. Scans full account history via paginated Hive RPC.
const reviewPurchasesLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 2,                      // 2 requests per IP per minute (full scan can be slow)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many review-purchases requests. Please wait a moment and try again.' },
});
// Items that were renamed after sale — maps old blockchain memo ID → current catalog ID
const COSMETIC_ID_ALIASES = {
  'skin_archer_determination': 'skin_kaelen_determination',
};

app.post('/api/shop/review-purchases', reviewPurchasesLimiter, async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    if (!HIVE_GAME_ACCOUNT) return res.status(503).json({ ok: false, error: 'Shop not configured' });

    // Scan the game account's history (much smaller than a player's full HIVE history).
    // Filter incoming transfers where the sender is the requesting player.
    const allOps = [];
    let cursor = -1;
    while (true) {
      const page = await hiveRpc('condenser_api.get_account_history', [HIVE_GAME_ACCOUNT, cursor, 1000]);
      if (!Array.isArray(page) || page.length === 0) break;
      allOps.push(...page);
      if (page.length < 1000) break;
      cursor = page[0][0] - 1;
      if (cursor < 0) break;
    }

    // Collect unique item_ids from shop_* transfers sent by this player
    const foundIds = new Set();
    for (const [, entry] of allOps) {
      const [opType, op] = entry.op;
      if (opType !== 'transfer') continue;
      if (op.to.toLowerCase() !== HIVE_GAME_ACCOUNT.toLowerCase()) continue;
      if (op.from.toLowerCase() !== username.toLowerCase()) continue;
      if (!op.memo || !op.memo.startsWith('shop_')) continue;
      if (!op.amount.endsWith(' HIVE')) continue;
      const rawId = op.memo.slice(5);
      if (!/^[\w-]{1,64}$/.test(rawId)) continue;
      foundIds.add(COSMETIC_ID_ALIASES[rawId] ?? rawId);
    }

    const foundOnChain = [...foundIds];

    if (foundIds.size === 0) {
      console.log(`🔍 Review purchases: ${username} — 0 shop transfers found in ${allOps.length} ops scanned (game account history)`);
      return res.json({ ok: true, restored: 0, items: [], debug: { opsScanned: allOps.length, foundOnChain: [], notInCatalog: [], alreadyOwned: [] } });
    }

    // Keep only ids that exist in the cosmetics catalog
    const existing = await sql`SELECT id FROM cosmetics WHERE id = ANY(${foundOnChain})`;
    const validIds = existing.map(r => r.id);
    const notInCatalog = foundOnChain.filter(id => !validIds.includes(id));

    // Find which are not yet owned
    const owned = await sql`
      SELECT item_id FROM user_cosmetics WHERE player = ${username} AND item_id = ANY(${validIds})
    `;
    const ownedSet = new Set(owned.map(r => r.item_id));
    const alreadyOwned = validIds.filter(id => ownedSet.has(id));
    const toInsert = validIds.filter(id => !ownedSet.has(id));

    for (const item_id of toInsert) {
      await sql`
        INSERT INTO user_cosmetics (player, item_id) VALUES (${username}, ${item_id})
        ON CONFLICT DO NOTHING
      `;
    }

    console.log(`🔍 Review purchases: ${username} — ${allOps.length} game-account ops scanned | found on-chain: [${foundOnChain}] | not in catalog: [${notInCatalog}] | already owned: [${alreadyOwned}] | restored: [${toInsert}]`);
    return res.json({ ok: true, restored: toInsert.length, items: toInsert, debug: { opsScanned: allOps.length, foundOnChain, notInCatalog, alreadyOwned } });
  } catch (err) {
    console.error('[/api/shop/review-purchases]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/cosmetics/backgrounds/equipped ───────────────────────────────────
app.get('/api/cosmetics/backgrounds/equipped', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const rows = await sql`
      SELECT ub.item_id AS id, c.preview
      FROM user_equipped_backgrounds ub
      JOIN cosmetics c ON c.id = ub.item_id
      WHERE ub.player = ${username}
    `;
    res.json({ ok: true, equipped: rows.map(r => ({ id: r.id, preview: r.preview })) });
  } catch (err) {
    console.error('[/api/cosmetics/backgrounds/equipped GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/cosmetics/backgrounds/equip ────────────────────────────────────
app.post('/api/cosmetics/backgrounds/equip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ ok: false, error: 'item_id required' });
  try {
    const [item] = await sql`SELECT id FROM cosmetics WHERE id = ${item_id} AND type = 'background'`;
    if (!item) return res.status(400).json({ ok: false, error: 'Item not found' });

    const [owned] = await sql`SELECT 1 FROM user_cosmetics WHERE player = ${username} AND item_id = ${item_id}`;
    if (!owned) return res.status(403).json({ ok: false, error: 'Item not owned' });

    const rows = await sql`
      INSERT INTO user_equipped_backgrounds (player, item_id)
      SELECT ${username}, ${item_id}
      WHERE (SELECT COUNT(*) FROM user_equipped_backgrounds WHERE player = ${username}) < 4
      ON CONFLICT DO NOTHING
      RETURNING item_id
    `;
    if (rows.length === 0) {
      // Could be: already equipped (idempotent OK) or cap reached (409)
      const [already] = await sql`SELECT 1 FROM user_equipped_backgrounds WHERE player = ${username} AND item_id = ${item_id}`;
      if (!already) return res.status(409).json({ ok: false, error: 'Max 4 backgrounds equipped' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/backgrounds/equip POST]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/cosmetics/backgrounds/unequip ────────────────────────────────
app.delete('/api/cosmetics/backgrounds/unequip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ ok: false, error: 'item_id required' });
  try {
    await sql`DELETE FROM user_equipped_backgrounds WHERE player = ${username} AND item_id = ${item_id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/backgrounds/unequip DELETE]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/cosmetics/skins/equipped ────────────────────────────────────────
app.get('/api/cosmetics/skins/equipped', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const rows = await sql`
      SELECT us.hero_cid, us.skin_id, c.preview
      FROM user_equipped_skins us
      JOIN cosmetics c ON c.id = us.skin_id
      WHERE us.player = ${username}
    `;
    const equipped = {};
    for (const r of rows) equipped[r.hero_cid] = { skin_id: r.skin_id, preview: r.preview };
    res.json({ ok: true, equipped });
  } catch (err) {
    console.error('[/api/cosmetics/skins/equipped GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/cosmetics/skins/equip ──────────────────────────────────────────
app.post('/api/cosmetics/skins/equip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { skin_id } = req.body || {};
  if (!skin_id) return res.status(400).json({ ok: false, error: 'skin_id required' });
  try {
    const [item] = await sql`SELECT id, hero_cid FROM cosmetics WHERE id = ${skin_id} AND type = 'skin'`;
    if (!item) return res.status(400).json({ ok: false, error: 'Item not found' });

    const [owned] = await sql`SELECT 1 FROM user_cosmetics WHERE player = ${username} AND item_id = ${skin_id}`;
    if (!owned) return res.status(403).json({ ok: false, error: 'Item not owned' });

    await sql`
      INSERT INTO user_equipped_skins (player, hero_cid, skin_id)
      VALUES (${username}, ${item.hero_cid}, ${skin_id})
      ON CONFLICT (player, hero_cid) DO UPDATE SET skin_id = EXCLUDED.skin_id
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/skins/equip POST]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/cosmetics/skins/unequip ──────────────────────────────────────
app.delete('/api/cosmetics/skins/unequip', async (req, res) => {
  const username = authFromRequest(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { hero_cid } = req.body || {};
  if (!hero_cid) return res.status(400).json({ ok: false, error: 'hero_cid required' });
  try {
    await sql`DELETE FROM user_equipped_skins WHERE player = ${username} AND hero_cid = ${hero_cid}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/cosmetics/skins/unequip DELETE]', err.message);
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
    // Garante arenas e skins equipadas na primeira entrada (ou na primeira após v1.5.0).
    // Idempotente: player_init impede que rode mais de uma vez por jogador.
    await ensureDefaultCosmetics(user);
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
const chatRateLimit = new Map(); // username -> timestamp of last sent message

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

// ── Match creation (shared by tryMatch and accept_challenge) ──────────────────
function startMatchBetween(u1, s1, u2, s2, wager, format) {
  const matchId = makeMatchId();
  const fmt = format || 5;
  const winsNeed = Math.ceil(fmt / 2);
  const needsPayment = wager > 0 && !!HIVE_GAME_ACCOUNT;
  const initStatus = needsPayment ? 'waiting_payments' : 'waiting_teams';

  const matchData = {
    matchId,
    p1: u1, p2: u2,
    s1, s2,
    wager,
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
      VALUES (${matchId}, ${u1}, ${u2}, ${wager}, 'HIVE', ${fmt}, ${initStatus},
              1,
              ${JSON.stringify(matchData.payments)}::jsonb,
              ${JSON.stringify(matchData.payoutPrefs)}::jsonb,
              ${JSON.stringify(matchData.merges)}::jsonb)`
    .catch(err => console.error('[match DB insert]', err.message));

  s1.join(matchId);
  s2.join(matchId);

  // Atualiza status na Taverna para os dois jogadores
  const matchDetail = `BO${fmt} · round 1`;
  setTavernStatus(u1, 'battle', matchDetail);
  setTavernStatus(u2, 'battle', matchDetail);

  io.to(matchId).emit('match_found', {
    matchId,
    p1: u1, p2: u2,
    opponents: { [u1]: u2, [u2]: u1 },
    wager,
    format: fmt,
    needsPayment,
    gameAccount: HIVE_GAME_ACCOUNT,
    timeLimitMs: needsPayment ? 60_000 : 3 * 60 * 1000,
  });

  console.log(`⚔️  Match ${matchId} | ${u1} vs ${u2} | BO${fmt} | ${wager} HIVE${needsPayment ? ' [payment required]' : ' [free]'}`);

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
      if (e1.wager === e2.wager && e1.format === e2.format) {
        matched = { u1, e1, u2, e2 };
        break outer;
      }
    }
  }
  if (!matched) {
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
  io.emit('challenge_removed', { id: u1 });
  io.emit('challenge_removed', { id: u2 });
  startMatchBetween(u1, e1.socket, u2, e2.socket, e1.wager, e1.format);
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
    const [p1Gear, p2Gear] = await Promise.all([
      getEquipmentBonuses(m.p1),
      getEquipmentBonuses(m.p2),
    ]);
    p1Board = await materializeBoard(p1Stripped, p1Gear);
    p2Board = await materializeBoard(p2Stripped, p2Gear);
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

    // ── Basic Chest drop on Free PvP win ─────────────────────────────────────
    if (m.wager === 0) {
      tryBasicChestDrop(matchWinner).catch(err => console.error('[tryBasicChestDrop]', err.message));
    }

    // ── Send prize if match had a real wager ──────────────────────────────────
    if (m.wager > 0 && HIVE_GAME_ACCOUNT) {
      const pot = m.wager * 2;
      const payoutPref = m.payoutPrefs[matchWinner] || 'liquid';
      sendHivePrize(matchWinner, pot, payoutPref, matchId).then(async result => {
        if (result.ok) {
          io.to(matchId).emit('prize_sent', {
            to: matchWinner,
            amount: result.amount,
            type: result.payoutPref,
          });
          const meterResult = await addToChestMeter(matchWinner, m.wager, payoutPref);
          if (meterResult) {
            const pct = Math.min(100, Math.round((meterResult.meter / 2.0) * 100));
            io.to(matchId).emit('chest_meter_update', { player: matchWinner, meter: meterResult.meter, pct, pending: meterResult.pending });
          }
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
      sendHivePrize(winner, pot, payoutPref, matchId).then(async result => {
        if (result.ok) {
          io.to(matchId).emit('prize_sent', { to: winner, amount: result.amount, type: result.payoutPref });
          const result = await addToChestMeter(winner, m.wager, payoutPref);
          if (result) {
            const pct = Math.min(100, Math.round((result.meter / 2.0) * 100));
            io.to(matchId).emit('chest_meter_update', { player: winner, meter: result.meter, pct, pending: result.pending });
          }
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
// Sets socket.data.username from the verified token.
// Guest sockets can identify via guestName for free (no-wager) matches.
io.use((socket, next) => {
  socket.data.username = verifyToken(socket.handshake.auth?.token) || null;
  if (!socket.data.username && socket.handshake.auth?.guestName) {
    socket.data.username = String(socket.handshake.auth.guestName).trim().slice(0, 40) || null;
    socket.data.isGuest = true;
  }
  next();
});

// ── Socket.io event handlers ───────────────────────────────────────────────────
io.on('connection', socket => {
  // Identity is fixed at connection time — never trust client-sent usernames.
  let connectedUser = socket.data.username;

  // Registra usuário autenticado na Taverna ao conectar (guests não aparecem na taverna)
  if (connectedUser && !socket.data.isGuest) {
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
    if (!connectedUser || socket.data.isGuest) {
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
    // Broadcast open challenge to all other connected players
    socket.broadcast.emit('open_challenge', {
      id: connectedUser,
      username: connectedUser,
      wager,
      format: format || 5,
    });
    tryMatch();
    broadcastQueueSize();
  });

  // ── Free (no-wager) guest match — create room ─────────────────────────────
  socket.on('create_free_match', ({ format } = {}) => {
    if (!connectedUser) { socket.emit('free_match_error', { message: 'No username. Reconnect and try again.' }); return; }
    const fmt = VALID_FORMATS.includes(format) ? format : 5;
    const code = Array.from({ length: 6 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
    const matchId = `free_${code}`;
    const matchData = {
      matchId, p1: connectedUser, p2: null, s1: socket, s2: null,
      wager: 0, format: fmt, winsNeeded: Math.ceil(fmt / 2),
      status: 'waiting_player2',
      scores: { [connectedUser]: 0 }, merges: { [connectedUser]: 0 },
      payments: {}, payoutPrefs: {}, teams: {}, refunded: {},
      createdAt: Date.now(),
    };
    activeMatches.set(matchId, matchData);
    socket.join(matchId);
    sql`INSERT INTO matches (id, player1, wager_hive, wager_type, format, status, battle_num, payments, payout_prefs, merges)
        VALUES (${matchId}, ${connectedUser}, 0, 'FREE', ${fmt}, 'waiting_player2', 1, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`
      .catch(err => console.error('[free match insert]', err.message));
    socket.emit('free_match_created', { code });
    console.log(`🎮 Free room ${code} created by ${connectedUser}`);
  });

  // ── Free (no-wager) guest match — join room ───────────────────────────────
  socket.on('join_free_match', ({ code } = {}) => {
    if (!connectedUser) { socket.emit('free_match_error', { message: 'No username. Reconnect and try again.' }); return; }
    if (!code) { socket.emit('free_match_error', { message: 'Room code required.' }); return; }
    const matchId = `free_${String(code).toUpperCase().trim()}`;
    const m = activeMatches.get(matchId);
    if (!m) { socket.emit('free_match_error', { message: 'Room not found. Check the code and try again.' }); return; }
    if (m.status !== 'waiting_player2') { socket.emit('free_match_error', { message: 'Room is already full or in progress.' }); return; }
    if (m.p1 === connectedUser) { socket.emit('free_match_error', { message: 'You created this room — share the code with a friend!' }); return; }
    m.p2 = connectedUser;
    m.s2 = socket;
    m.status = 'waiting_teams';
    m.scores[connectedUser] = 0;
    m.merges[connectedUser] = 0;
    socket.join(matchId);
    sql`UPDATE matches SET player2=${connectedUser}, status='waiting_teams' WHERE id=${matchId}`
      .catch(err => console.error('[free match join]', err.message));
    const payload = {
      matchId, p1: m.p1, p2: connectedUser,
      opponents: { [m.p1]: connectedUser, [connectedUser]: m.p1 },
      wager: 0, format: m.format, needsPayment: false,
      timeLimitMs: 3 * 60 * 1000,
    };
    io.to(matchId).emit('match_found', payload);
    armForfeitTimer(matchId, m.p1, connectedUser, ROUND_TIME_MS);
    console.log(`⚔️  Free match ${code} | ${m.p1} vs ${connectedUser} | BO${m.format}`);
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

  // Player deliberately concedes (clicks "Concede" / "Back to Lobby" mid-match).
  // Unlike a socket disconnect (which starts a 45-second grace timer), a concede
  // ends the series immediately so the opponent isn't held hostage and the
  // conceeding player can freely search a new match without being reconnected here.
  socket.on('concede', () => {
    if (!connectedUser) return;
    for (const [, m] of activeMatches) {
      if (m.p1 !== connectedUser && m.p2 !== connectedUser) continue;
      const winner = m.p1 === connectedUser ? m.p2 : m.p1;
      if (m.disconnectTimer) {
        clearTimeout(m.disconnectTimer);
        m.disconnectTimer = null;
      }
      // Bring winner's score to one win away from series end so the next
      // forfeitBattle call terminates the whole series, not just one round.
      m.scores[winner] = Math.max(m.scores[winner], m.winsNeeded - 1);
      forfeitBattle(m.matchId, winner);
      console.log(`🏳️ ${connectedUser} conceded match ${m.matchId} — series awarded to ${winner}`);
      break;
    }
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
      io.emit('challenge_removed', { id: connectedUser });
      broadcastQueueSize();
    }
  });

  socket.on('accept_challenge', ({ challenger }) => {
    if (!connectedUser || socket.data.isGuest) {
      socket.emit('challenge_expired', { challenger, reason: 'auth' });
      return;
    }
    if (connectedUser === challenger) return;

    // Reject if already in an active match
    for (const [, m] of activeMatches) {
      if (m.p1 === connectedUser || m.p2 === connectedUser) {
        socket.emit('challenge_expired', { challenger, reason: 'in_match' });
        return;
      }
    }

    const entry = matchQueue.get(challenger);
    if (!entry) {
      socket.emit('challenge_expired', { challenger });
      return;
    }

    // Remove accepter from queue if present
    if (matchQueue.has(connectedUser)) {
      matchQueue.delete(connectedUser);
      io.emit('challenge_removed', { id: connectedUser });
    }

    // Remove challenger from queue and start match
    matchQueue.delete(challenger);
    io.emit('challenge_removed', { id: challenger });

    console.log(`🤝 ${connectedUser} accepted challenge from ${challenger}`);
    startMatchBetween(challenger, entry.socket, connectedUser, socket, entry.wager, entry.format);
  });

  // Manual / AFK status change — ignored during searching or battle
  socket.on('set_status', ({ status }) => {
    if (!connectedUser) return;
    const current = onlineUsers.get(connectedUser)?.status;
    if (current === 'searching' || current === 'battle') return;
    if (status !== 'tavern' && status !== 'afk') return;
    setTavernStatus(connectedUser, status);
  });

  socket.on('chat_message', ({ text }) => {
    if (!connectedUser) return;
    const status = onlineUsers.get(connectedUser)?.status;
    if (status !== 'tavern' && status !== 'afk') return;
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim().slice(0, 200);
    if (!trimmed) return;
    const now = Date.now();
    if (now - (chatRateLimit.get(connectedUser) ?? 0) < 1000) return;
    chatRateLimit.set(connectedUser, now);
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    io.emit('chat_message', { username: connectedUser, text: trimmed, time });
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
    if (connectedUser && !socket.data.isGuest) {
      matchQueue.delete(connectedUser);
      chatRateLimit.delete(connectedUser);
      broadcastQueueSize();
      removeTavernUser(connectedUser);
      console.log(`🍺 ${connectedUser} left the tavern (${onlineUsers.size} online)`);
    }
    if (connectedUser) {
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
// Garante que a tabela player_init existe antes de qualquer login acontecer
sql`
  CREATE TABLE IF NOT EXISTS player_init (
    player         TEXT        PRIMARY KEY,
    initialized_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`.catch(err => console.error('[startup] player_init table:', err.message));

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
  migrateRpgAttrs();
  migrateIdleDungeon();
  restoreSpeedOffsets();
  migrateLevelScale();
  migrateSkillPower();
  migrateSkillDescriptions();
  seedTreasures();
  migrateCampaign();
  migrateChestMeter();
  fixupPrecisionQuiver();
  // Rehydrate any matches that were active at the time of the previous shutdown.
  // Refunds get processed automatically for paid players whose match can no
  // longer be resumed (e.g. payment phase that timed out across the restart).
  rehydrateMatches();
});
