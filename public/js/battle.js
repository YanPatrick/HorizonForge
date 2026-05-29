// ── RESPONSIVIDADE: atualiza --s com base na resolução real ──
const BASE_W = 1280; // resolução de referência (seu design base)
const BASE_H = 720;

function updateScale() {
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const vw = isTouch ? Math.min(window.innerWidth, 480) : window.innerWidth;
  const vh = window.innerHeight;

  // Escala limitada entre 0.6 e 1.5 para não ficar absurdo
  const scaleW = vw / BASE_W;
  const scaleH = vh / BASE_H;
  const scale = Math.min(scaleW, scaleH, 1.5);
  const finalScale = Math.max(scale, 0.6);

  document.documentElement.style.setProperty(
    "--s",
    finalScale.toFixed(4),
  );
}

// Dispara ao carregar e a cada resize. Guard against listener stacking
// across React remounts (each /lobby ↔ /battle round-trip re-evaluates
// this script): we skip re-attaching if a previous load already did.
updateScale();
if (!window.__hfScaleAttached) {
  window.addEventListener("resize", updateScale);
  window.__hfScaleAttached = true;
}

// ── Auth & battle config injected by lobby ──────────
(function () {
  const session = (function () {
    try {
      return JSON.parse(sessionStorage.getItem("hf_session"));
    } catch {
      return null;
    }
  })();
  if (!session) {
    window.location.replace("/");
    return;
  }
  window._HF_SESSION = session;
  window._HF_BATTLE_CFG = (function () {
    try {
      return JSON.parse(sessionStorage.getItem("hf_battle_cfg"));
    } catch {
      return null;
    }
  })();
  sessionStorage.removeItem("hf_battle_cfg"); // consume once
})();

// ═══════════════════════════════════════════════════
//  CONFIG & DATA
// ═══════════════════════════════════════════════════
const API_BASE =
  window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "";

let C = {}; // character map keyed by cid
let CK = []; // array of cid strings
let _deckPool = null; // cids restricted to active formation (null = all heroes)
const LS = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];
const BARRACKS_MAX = 5;

function BENCH_SLOTS() {
  return BARRACKS_MAX;
}
function FIELD_MAX() {
  return HF.qtd_max_heroes || 5;
}
function distinctHeroes() {
  return G.bench.length;
}
function canAddNewHero(cid) {
  if (
    G.bench.some((u) => u.cid === cid) ||
    G.board.some((u) => u && u.cid === cid)
  )
    return true;
  return G.bench.length < BENCH_SLOTS();
}

let HF = {
  initial_gold: 7,
  value_buy_card: 3,
  value_new_recruitment: 2,
  value_chance_combo3: 0.1,
  value_gold_combo3: 2,
  value_chance_combo2: 0.3,
  value_gold_combo2: 1,
  qtd_max_heroes: 5,
};
function START_GOLD() {
  return HF.initial_gold;
}

let battleSpeed = 2;
function getBattleSpeedMultiplier() {
  return battleSpeed === 1 ? 2 : 1;
}
function getBattleFrameDelay() {
  return Math.round(500 * getBattleSpeedMultiplier());
}
function getBattleFxDuration(baseMs) {
  return Math.round(baseMs * getBattleSpeedMultiplier());
}
function applyBattleSpeed() {
  document.documentElement.style.setProperty(
    "--battle-speed-mult",
    String(getBattleSpeedMultiplier()),
  );
  const label = battleSpeed === 1 ? "1x" : "2x";
  const fast = battleSpeed === 2;
  // Phase 2 of #16: dispatch into BattlePage instead of mutating DOM.
  window.setBattleSpeed?.({ label, fast });
  try {
    localStorage.setItem("hf_battle_speed", String(battleSpeed));
  } catch { }
}
function toggleBattleSpeed() {
  battleSpeed = battleSpeed === 1 ? 2 : 1;
  applyBattleSpeed();
}
(function initBattleSpeed() {
  try {
    const saved = Number(localStorage.getItem("hf_battle_speed"));
    if (saved === 1 || saved === 2) battleSpeed = saved;
  } catch { }
  applyBattleSpeed();
})();

// ═══════════════════════════════════════════════════
//  LOADING / BOOTSTRAP
// ═══════════════════════════════════════════════════
let _loadOverlay = null;
function showLoader() {
  _loadOverlay = document.createElement("div");
  _loadOverlay.style.cssText =
    "position:fixed;inset:0;background:#03020e;display:flex;align-items:center;justify-content:center;z-index:300;color:rgba(255,255,255,.55);font-size:14px;text-align:center";
  _loadOverlay.innerHTML = `<div><div style="font-size:36px;margin-bottom:12px">⚔️</div><div>Loading game data…</div></div>`;
  document.body.appendChild(_loadOverlay);
}
function hideLoader() {
  if (_loadOverlay) {
    _loadOverlay.remove();
    _loadOverlay = null;
  }
}

function validateGameState() {
  // Valida C (characters)
  if (!C || Object.keys(C).length === 0) {
    throw new Error("Characters not loaded");
  }
  // Valida bench
  G.bench.forEach((u) => {
    if (!u.cid || !C[u.cid]) throw new Error(`Invalid unit: ${u.cid}`);
    if (u.stack == null) u.stack = 1;
  });
  // Valida board
  G.board.forEach((u) => {
    if (u && (!u.cid || !C[u.cid]))
      throw new Error(`Invalid board unit: ${u.cid}`);
  });
}

async function initGame() {
  showLoader();
  try {
    const [charRes, cfgRes, scaleRes] = await Promise.all([
      fetch(`${API_BASE}/api/characters`),
      fetch(`${API_BASE}/api/config`),
      fetch(`${API_BASE}/api/level-scale`),
    ]);
    const [charData, cfgData, scaleData] = await Promise.all([
      charRes.json(),
      cfgRes.json(),
      scaleRes.json(),
    ]);
    // Build [0, m1, m2, m3, m4, m5] so index == level (level 0 unused)
    const levelMultipliers = [0];
    if (scaleData.ok) {
      for (const row of scaleData.levels) levelMultipliers[row.level] = Number(row.multiplier);
    }
    if (!charData.ok) throw new Error(charData.error);

    if (cfgData.ok && cfgData.config) {
      const cfg = cfgData.config;
      Object.keys(HF).forEach((k) => {
        if (cfg[k] != null) HF[k] = cfg[k];
      });
      console.log("✅ Config loaded from DB:", HF);
    }

    C = {};
    for (const char of charData.characters) {
      C[char.cid] = {
        id: char.cid,
        name: char.name,
        ico: char.icon,
        portrait: char.url_portrait || "",
        col: char.color_hex,
        bg: char.bg_gradient,
        role: char.role,
        tp: char.target_type,
        levels: char.levels,
        abi: {
          ico: skillIcon(char.skill.key),
          name: char.skill.name,
          desc: char.skill.description,
          lore: char.skill.lore,
          type: char.skill.type,
          key: char.skill.key,
        },
      };
    }
    CK = Object.keys(C);

    // Apply equipped skin portrait overrides (client-side, current player only).
    // Skins with empty preview (default skins) leave portrait unchanged.
    const _skinMap = window.HF_equipped_skins || {};
    for (const [cid, data] of Object.entries(_skinMap)) {
      if (C[cid] && data.preview) C[cid].portrait = data.preview;
    }

    // Inject deps into the bot module now that C/CK/HF are populated.
    // HFBot.* methods will throw if called before this point.
    if (window.HFBot && typeof window.HFBot.init === "function") {
      window.HFBot.init({
        get C() { return C; },
        get CK() { return CK; },
        mkUnit,
        upgradeUnit,
        randCid,
        START_GOLD,
        BENCH_SLOTS,
        getHF: () => HF,
        levelMultipliers,
      });
    } else {
      console.warn("[battle] HFBot module not loaded — AI mode unavailable");
    }

    // Inject deps into the tooltip module (Phase 4 of #16). Tooltip
    // builders read C lazily, so this just hands them the accessor.
    if (window.HFTooltip && typeof window.HFTooltip.init === "function") {
      window.HFTooltip.init({ getC: () => C });
    } else {
      console.warn("[battle] HFTooltip module not loaded — tooltips unavailable");
    }

    hideLoader();
    if (window._HF_BATTLE_CFG) {
      const _cfg = window._HF_BATTLE_CFG;
      window._HF_BATTLE_CFG = null;
      // Restrict shop pool to active formation if provided
      const _fids = _cfg.formationHeroIds;
      _deckPool =
        Array.isArray(_fids) && _fids.length ? [..._fids] : null;
      if (_cfg.mode === "pvp") {
        pvpInit(_cfg);
      } else {
        startGame(_cfg.format || 5);
      }
    } else {
      // No battle config — user landed here directly; send back to lobby
      window.location.replace("/lobby");
    }
  } catch (err) {
    console.error(err);
    hideLoader();
    // Show a minimal error overlay so the user knows what went wrong
    const ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;background:#03020e;display:flex;align-items:center;justify-content:center;z-index:300;color:#ff8888;font-size:13px;text-align:center;padding:24px";
    ov.innerHTML = `<div><div style="font-size:28px;margin-bottom:8px">⚠️</div><b>Could not connect to the server</b><br><br>${err.message}<br><br><a href="/lobby" style="color:#aa88ff">← Back to Lobby</a></div>`;
    document.body.appendChild(ov);
  }

  // ── Drag campo → barracas (setup único) ──
  const bw = document.getElementById("benchwrap");
  bw.addEventListener("dragenter", (e) => {
    if (G.fieldDrag !== null && G.phase === "shop") {
      e.preventDefault();
      bw.classList.add("bench-drop-over");
    }
  });
  bw.addEventListener("dragover", (e) => {
    if (G.fieldDrag !== null && G.phase === "shop") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  });
  bw.addEventListener("dragleave", (e) => {
    if (!bw.contains(e.relatedTarget))
      bw.classList.remove("bench-drop-over");
  });
  bw.addEventListener("drop", (e) => {
    bw.classList.remove("bench-drop-over");
    const fromSlot = e.dataTransfer.getData("fromSlot");
    if (fromSlot !== "" && G.phase === "shop") {
      e.preventDefault();
      retBench(parseInt(fromSlot));
    }
  });
}

function skillIcon(key) {
  const m = {
    iron_defense: "🛡️",
    fireball: "🔥",
    precise_shot: "🎯",
    healing: "💚",
    sneak_strike: "⚡",
    sacred_aura: "✨",
    chain_lightning: "⛓️",
    fury: "😡",
  };
  return m[key] || "✨";
}

// ═══════════════════════════════════════════════════
//  UNIT FACTORY
// ═══════════════════════════════════════════════════
let _uid = 0;
function mkUnit(cid, lv = 1) {
  const c = C[cid],
    st = c.levels[lv];
  return {
    cid,
    lv,
    id: "u" + ++_uid,
    name: c.name,
    ico: c.ico,
    role: c.role,
    tp: c.tp,
    maxHp: st.max_hp,
    hp: st.max_hp,
    atk: Math.floor(st.atk),
    initiative: st.initiative,
    evasion: st.evasion,
    critChance: st.crit_chance,
    critRate: st.crit_rate,
    skillPower: st.skill_power,
    dex: st.dex,
    wis: st.wis,
    armor: st.armor,
    stack: 1,
  };
}
function upgradeUnit(u) {
  const st = C[u.cid].levels[u.lv];
  u.maxHp = st.max_hp;
  u.hp = st.max_hp;
  u.atk = Math.floor(st.atk);
  u.initiative = st.initiative;
  u.evasion = st.evasion;
  u.critChance = st.crit_chance;
  u.critRate = st.crit_rate;
  u.skillPower = st.skill_power;
  u.dex = st.dex;
  u.wis = st.wis;
  u.armor = st.armor;
  u.id = "u" + ++_uid;
  return u;
}

// Player shop draws only from the active deck pool (formation), bot uses full CK
function playerRandCid() {
  const pool = _deckPool || CK;
  return pool[rnd(pool.length)];
}

// ═══════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════
document.body.style.backgroundSize = "cover";
document.body.style.backgroundPosition = "center center";

let G = {
  format: 3,
  winsNeeded: 2,
  phase: "shop",
  duelNum: 1,
  battleNum: 1,
  duelScore: { p: 0, e: 0 },
  duelsWon: 0,
  duelsLost: 0,
  gold: 7,
  shop: [],
  shopCombo: null,
  shopCombos: [],
  bench: [],
  board: Array(9).fill(null),
  duelEnemy: Array(9).fill(null),
  enemy: Array(9).fill(null),
  bsel: null,
  fieldSel: null,
  fieldDrag: null,
  lastBattleResult: null,
  duelStats: {
    dmgP: 0,
    dmgE: 0,
    killsP: 0,
    killsE: 0,
    mergesP: 0,
    mergesE: 0,
    battles: [],
  },
  lastBoardSnap: [],
};

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function rnd(n) {
  return Math.floor(Math.random() * n);
}
function randCid() {
  return CK[rnd(CK.length)];
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function adjacentSlots(slot) {
  const col = slot % 3,
    row = Math.floor(slot / 3),
    adj = [];
  if (row > 0) adj.push(slot - 3);
  if (row < 2) adj.push(slot + 3);
  if (col > 0) adj.push(slot - 1);
  if (col < 2) adj.push(slot + 1);
  return adj;
}

// ═══════════════════════════════════════════════════
//  BENCH / ECONOMY
// ═══════════════════════════════════════════════════
function cardCost(cid) {
  return totalOwned(cid) > 0 ? 2 : HF.value_buy_card;
}
function totalOwned(cid) {
  return (
    (G.bench.some((u) => u.cid === cid) ? 1 : 0) +
    G.board.filter((u) => u && u.cid === cid).length
  );
}

function applyMerge(u) {
  while (u.stack >= 3 && u.lv < 5) {
    u.stack = u.stack - 3; // sobra exata após o merge
    u.lv++;
    upgradeUnit(u);
    G.duelStats.mergesP++;
  }
  u.stack = Math.min(u.stack, 3); // Sempre limita
  return u;
}

function _detectCombos() {
  const s = G.shop;
  const combos = [];
  const used = new Set();
  // Pass 1: adjacent triplets (combo 3)
  for (let i = 0; i <= 2; i++) {
    if (
      s[i] &&
      s[i + 1] &&
      s[i + 2] &&
      s[i].cid === s[i + 1].cid &&
      s[i].cid === s[i + 2].cid &&
      !used.has(i) &&
      !used.has(i + 1) &&
      !used.has(i + 2)
    ) {
      combos.push({
        type: 3,
        cids: [s[i].cid, s[i].cid, s[i].cid],
        idxs: [i, i + 1, i + 2],
        cost: HF.value_gold_combo3,
      });
      used.add(i);
      used.add(i + 1);
      used.add(i + 2);
    }
  }
  // Pass 2: adjacent pairs not already consumed by a triplet (combo 2)
  for (let i = 0; i <= 3; i++) {
    if (
      s[i] &&
      s[i + 1] &&
      s[i].cid === s[i + 1].cid &&
      !used.has(i) &&
      !used.has(i + 1)
    ) {
      combos.push({
        type: 2,
        cids: [s[i].cid, s[i].cid],
        idxs: [i, i + 1],
        cost: HF.value_gold_combo2,
      });
      used.add(i);
      used.add(i + 1);
    }
  }
  G.shopCombos = combos;
  G.shopCombo = combos.length > 0 ? combos[0] : null;
}

function genShop() {
  const slots = [];
  const r = Math.random();
  if (r < HF.value_chance_combo3) {
    const cid = playerRandCid();
    slots.push(
      mkUnit(cid, 1),
      mkUnit(cid, 1),
      mkUnit(cid, 1),
      mkUnit(playerRandCid(), 1),
      mkUnit(playerRandCid(), 1),
    );
  } else if (r < HF.value_chance_combo3 + HF.value_chance_combo2) {
    const pos = Math.floor(Math.random() * 4),
      cid = playerRandCid();
    for (let i = 0; i < 5; i++)
      slots.push(
        mkUnit(i === pos || i === pos + 1 ? cid : playerRandCid(), 1),
      );
  } else {
    for (let i = 0; i < 5; i++) slots.push(mkUnit(playerRandCid(), 1));
  }
  G.shop = slots;
  _detectCombos();
}

function rerollShop() {
  const cost = HF.value_new_recruitment;
  if (G.phase !== "shop" || G.gold < cost) {
    log(G.gold < cost ? `❌ Need ${cost}💰!` : "", "lk");
    return;
  }
  G.gold -= cost;
  genShop();
  render();
  log("🔄 New Recruitment! (−2💰)", "lr");
}

function showMergeBadge(el, lv) {
  const r = el.getBoundingClientRect();
  const badge = document.createElement("div");
  badge.className = "merge-badge";
  badge.textContent = `${LS[lv]} Level Up!`;
  badge.style.left = r.left + r.width / 2 + "px";
  badge.style.top = r.top + r.height / 2 + "px";
  document.body.appendChild(badge);
  badge.addEventListener("animationend", () => badge.remove(), {
    once: true,
  });
}

function _addToBench(card, cost, silent) {
  if (!canAddNewHero(card.cid)) {
    if (!silent)
      log("❌ Barracks full! Place a card on the field first.", "lk");
    return false;
  }
  const benchIdx = G.bench.findIndex((u) => u.cid === card.cid);
  const boardIdx = G.board.findIndex((u) => u && u.cid === card.cid);

  if (benchIdx >= 0) {
    const ex = G.bench[benchIdx];
    const prevLv = ex.lv;
    ex.stack = ex.stack + 1;
    applyMerge(ex);
    if (ex.lv > prevLv) {
      if (!silent)
        log(`✨ ${ex.name} evolved to ${LS[ex.lv]}! (Barracks)`, "ll");
      setTimeout(() => {
        document.querySelectorAll("#benchrow .bcard").forEach((bc) => {
          if (bc.dataset.cid === ex.cid) {
            bc.classList.add("just-merged");
            showMergeBadge(bc, ex.lv);
            setTimeout(() => bc.classList.remove("just-merged"), 700);
          }
        });
      }, 40);
    } else {
      if (!silent)
        log(
          `🔗 ${card.name} stacked! (${ex.stack}/3 → ${LS[ex.lv + 1] || "MAX"})${cost === 2 ? " −2💰" : " −3💰"}`,
          "ll",
        );
      setTimeout(() => {
        document.querySelectorAll("#benchrow .bcard").forEach((bc) => {
          if (bc.dataset.cid === ex.cid) {
            bc.classList.add("new-copy");
            setTimeout(() => bc.classList.remove("new-copy"), 500);
          }
        });
      }, 40);
    }
  } else if (boardIdx >= 0) {
    const ex = G.board[boardIdx];
    const prevLv = ex.lv;
    ex.stack = ex.stack + 1;
    applyMerge(ex);
    if (ex.lv > prevLv) {
      if (!silent)
        log(`⚡ ${ex.name} evolved to ${LS[ex.lv]} on the field!`, "ll");
      setTimeout(() => {
        const f = document.querySelector(
          `#pfield [data-cid="${ex.cid}"]`,
        );
        if (f) {
          f.classList.add("mg");
          showMergeBadge(f, ex.lv);
          setTimeout(() => f.classList.remove("mg"), 700);
        }
      }, 40);
    } else {
      if (!silent)
        log(
          `🔗 ${card.name} stacked on field! (${ex.stack}/3 → ${LS[ex.lv + 1] || "MAX"})${cost === 2 ? " −2💰" : " −3💰"}`,
          "ll",
        );
      setTimeout(() => {
        const f = document.querySelector(
          `#pfield [data-cid="${ex.cid}"]`,
        );
        if (f) {
          f.classList.add("new-copy");
          setTimeout(() => f.classList.remove("new-copy"), 500);
        }
      }, 40);
    }
    render();
  } else {
    const newUnit = mkUnit(card.cid, 1);
    newUnit.stack = 1;
    G.bench.push(newUnit);
    if (!G._newBenchCids) G._newBenchCids = new Set();
    G._newBenchCids.add(card.cid);
    if (!silent) log(`🛒 Recruited ${card.name} for ${cost}💰`, "ll");
  }
  return true;
}

function _slideShop(idx) {
  if (idx < 0 || idx >= 5) return; // Proteção
  for (let i = idx; i < 4; i++) G.shop[i] = G.shop[i + 1];
  G.shop[4] = mkUnit(playerRandCid(), 1);
  _detectCombos();
}

function buyCard(idx) {
  if (G.phase !== "shop") return;
  const card = G.shop[idx];
  if (!card) return;
  const cost = cardCost(card.cid);
  if (G.gold < cost) {
    log(`❌ Need ${cost}💰! You have ${G.gold}💰`, "lk");
    return;
  }
  const shopEl = document.querySelector(
    `#shoprow .scard[data-uid="${card.id}"]`,
  );
  if (shopEl) shopEl.classList.add("scard-buy-flash");
  if (!_addToBench(card, cost, false)) return;
  G.gold -= cost;
  _slideShop(idx);
  render();
}

function buyCombo(combo) {
  if (G.phase !== "shop") return;
  combo = combo || G.shopCombo;
  if (!combo) return;
  const cost = combo.cost;
  if (G.gold < cost) {
    log(`❌ Need ${cost}💰! You have ${G.gold}💰`, "lk");
    return;
  }
  const cid = combo.cids[0];
  if (!canAddNewHero(cid)) {
    log("❌ Barracks full!", "lk");
    return;
  }
  combo.idxs.forEach((ci) => {
    const el = document.querySelector(
      `#shoprow .scard[data-uid="${G.shop[ci]?.id}"]`,
    );
    if (el) el.classList.add("scard-buy-flash");
  });
  G.gold -= cost;
  for (let k = 0; k < combo.type; k++)
    _addToBench({ cid, ico: C[cid].ico, name: C[cid].name }, 0, k > 0);
  log(
    `⚡ COMBO ${combo.type}! ${C[cid].name} ×${combo.type} for ${cost}💰!`,
    "ll",
  );
  [...combo.idxs]
    .sort((a, b) => b - a)
    .forEach((i) => {
      for (let j = i; j < 4; j++) G.shop[j] = G.shop[j + 1];
      G.shop[4] = mkUnit(playerRandCid(), 1);
    });
  _detectCombos();
  render();
}

function betweenIncome() {
  return 1 + G.battleNum;
}

// ═══════════════════════════════════════════════════
//  BOARD MANAGEMENT
// ═══════════════════════════════════════════════════
function maxUnits() {
  return FIELD_MAX();
}

function placeUnit(i, cid = null) {
  if (G.phase !== "shop" || G.board[i]) return;
  if (G.board.filter(Boolean).length >= maxUnits()) {
    log(`❌ Field full! Max ${maxUnits()} heroes.`, "lk");
    return;
  }
  const selCid = cid || G.bsel;
  if (!selCid) return;
  const bidx = G.bench.findIndex((u) => u.cid === selCid);
  if (bidx < 0) {
    log("❌ Unit not found in barracks!", "lk");
    return;
  }
  G.board[i] = { ...G.bench[bidx] };
  G.bench.splice(bidx, 1);
  G.bsel = null;
  render();
}

function retBench(i) {
  if (G.phase !== "shop") return;
  const u = G.board[i];
  if (!u) return;
  G.board[i] = null;
  const existingIdx = G.bench.findIndex((b) => b.cid === u.cid);
  if (existingIdx >= 0) {
    const ex = G.bench[existingIdx];
    ex.stack = ex.stack + u.stack;
    applyMerge(ex);
  } else if (distinctHeroes() < BENCH_SLOTS()) {
    G.bench.push({ ...u });
  } else {
    G.board[i] = u;
    log("❌ Barracks full!", "lk");
  }
  render();
}

function swapFieldBench(fieldSlot, benchCid) {
  if (G.phase !== "shop") return;
  const fieldUnit = G.board[fieldSlot];
  if (!fieldUnit) return;
  const bidx = G.bench.findIndex((b) => b.cid === benchCid);
  if (bidx < 0) return;
  const benchUnit = G.bench[bidx];
  G.board[fieldSlot] = { ...benchUnit };
  // Splice before findIndex: if fieldUnit.cid === benchCid, the removed card
  // won't be found, so fieldUnit is pushed as a new entry (stack counts swap).
  G.bench.splice(bidx, 1);
  // No capacity guard needed: splice removes one, push adds one — bench size stays constant.
  const existingIdx = G.bench.findIndex((b) => b.cid === fieldUnit.cid);
  if (existingIdx >= 0) {
    G.bench[existingIdx].stack += fieldUnit.stack;
    applyMerge(G.bench[existingIdx]);
  } else {
    G.bench.push({ ...fieldUnit });
  }
  G.fieldSel = null;
  G.bsel = null;
  render();
}

function restoreFieldHp() {
  G.board.forEach((u) => {
    if (!u) return;
    const st = C[u.cid]?.levels[u.lv];
    if (st) u.hp = u.maxHp = st.max_hp;
  });
}

// ═══════════════════════════════════════════════════
//  BOT AI SYSTEM (extracted to /js/bot-ai.js)
// ═══════════════════════════════════════════════════
// The bot lives in its own module now (window.HFBot). HFBot.init()
// is called from initGame() once the API has populated C/CK/HF.


// ───────────────────────────────────────────────────
//  SIMULATION (shim → shared/simulate.js)
// ───────────────────────────────────────────────────
// The local copy of simulate() previously lived here (~370 lines)
// and was kept in sync by hand with shared/simulate.js. Bugs fixed
// in one copy frequently lagged the other, producing AI-vs-PvP
// parity drift. We now delegate to the same shared simulator the
// server uses — guaranteeing identical mechanics in both modes.
function simulate(pb, eb) {
  const res = window.HFSimulate.simulate(pb, eb);
  // Legacy: the local sim returned final unit snapshots in stats
  // for the duel-result UI. Derive them from umap to preserve the
  // shape (PvP already does this fallback in endBattle).
  const all = Object.values(res.umap);
  res.stats.boardSnap = all.filter(u => u.side === 'p');
  res.stats.enemySnap = all.filter(u => u.side === 'e');
  return res;
}


// ═══════════════════════════════════════════════════
//  PLAYBACK
// ═══════════════════════════════════════════════════
let btimer = null;
const ABILOG = {
  "Sacred Aura":
    "✨ {n}: Sacred Aura! Adjacent allies gained max HP bonus.",
  "Sneak Strike": "⚡ {n}: Sneak Strike! Targeting lowest HP enemy...",
  Fury: "😡 {n}: FURY! Attack permanently increased.",
  Fireball: "🔥 {n}: Fireball! Splash damage to adjacent targets.",
  Healing: "💚 {n}: Healing! Restoring the most wounded ally.",
  "Precise Shot": "🎯 {n}: Precise Shot! Critical hit landed.",
};

let _tpPrev = [];
function renderTurnPanel(order, umap, dHp) {
  const panel = document.getElementById("turnpanel"),
    list = document.getElementById("tp-list");
  if (!list) return;
  panel.classList.remove("hidden");
  const MAX = 10,
    newOrder = order.slice(0, MAX);
  const actedUid =
    _tpPrev.length && _tpPrev[0] !== newOrder[0] ? _tpPrev[0] : null;
  const prevSet = new Set(_tpPrev);
  _tpPrev = newOrder.slice();

  const build = () => {
    list.innerHTML = "";
    newOrder.forEach((uid, i) => {
      const u = umap[uid];
      if (!u) return;
      const isLastAndNew =
        i === newOrder.length - 1 &&
        (!prevSet.has(uid) || uid === actedUid);
      const div = document.createElement("div");
      div.className =
        "tp-entry tp-" +
        u.side +
        (i === 0 ? " tp-now" : "") +
        (isLastAndNew ? " tp-enter" : "");
      div.dataset.tpuid = uid;
      const stars = "★".repeat(u.lv || 1);
      const curHp =
        dHp && dHp[uid] !== undefined ? dHp[uid] : u.hp || u.maxHp;
      const hpPct =
        u.maxHp > 0
          ? Math.max(0, Math.round((curHp / u.maxHp) * 100))
          : 100;
      const hpCol =
        hpPct < 30 ? "#ff4444" : hpPct < 60 ? "#ffaa33" : "#44cc88";
      const hpFill = Math.max(0, Math.min(100, hpPct)); // Garante 0-100%
      div.innerHTML = `<span class="tp-ico">${u.ico}</span><span class="tp-info"><span class="tp-name">${u.name}</span><span class="tp-stars">${stars}</span><div class="tp-hp"><div class="tp-hp-fill" style="width:${hpPct}%;background:${hpCol}"></div></div></span>${i === 0 ? '<span class="tp-now-arrow">▶</span>' : ""}`;
      list.appendChild(div);
    });
  };

  if (actedUid) {
    const exitEl = list.querySelector('[data-tpuid="' + actedUid + '"]');
    const rotated = newOrder.includes(actedUid); // ainda vivo, só foi pro fim
    if (exitEl && !rotated) {
      // Herói morreu: anima saída (tp-exit) e reconstrói após 130 ms
      exitEl.classList.add("tp-exit");
      setTimeout(build, 130);
    } else {
      // Herói apenas rotacionou para o fim: rebuild imediato em sincronia
      // com o ataque — tp-enter na posição final cuida da animação de entrada
      build();
    }
  } else build();
}

function hideTurnPanel() {
  document.getElementById("turnpanel")?.classList.add("hidden");
  _tpPrev = [];
}

function clearFieldPlacementHints() {
  document
    .querySelectorAll("#pfield .cell.dr, #pfield .cell.dnd-over")
    .forEach((el) => el.classList.remove("dr", "dnd-over"));
  document
    .querySelectorAll("#pfield .unit.dragging, #benchrow .bcard.dragging")
    .forEach((el) => el.classList.remove("dragging"));
}

// ── Global phase timer (AI mode) ──────────────────────────────────────
let _aiTimerInterval = null;

function startPhaseTimer(ms) {
  if (window._PVP) return; // PvP uses server-driven timer inside pvpInit
  stopPhaseTimer();
  // Phase 2 of #16: timer state lives in BattlePage. Dispatch via the
  // setRoundTimer / hideRoundTimer shims registered there. Safe-call (?.)
  // makes this a no-op if BattlePage hasn't mounted yet — the interval
  // still ticks down so startBattle() fires on schedule.
  let remaining = Math.ceil(ms / 1000);
  function tick() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const txt = `⏱ ${m}:${String(s).padStart(2, "0")}`;
    window.setRoundTimer?.(txt, remaining <= 30);
    if (remaining <= 0) {
      stopPhaseTimer();
      window.setRoundTimer?.("⏱ 0:00", false);
      startBattle();
    }
  }
  tick();
  _aiTimerInterval = setInterval(() => {
    remaining--;
    tick();
  }, 1000);
}

function stopPhaseTimer() {
  if (_aiTimerInterval) {
    clearInterval(_aiTimerInterval);
    _aiTimerInterval = null;
  }
  window.hideRoundTimer?.();
}

function updateFieldLabels() {
  // The legacy lbl-player / lbl-enemy field labels are intentionally
  // hidden — the duelbar at the top of the header already shows the
  // player and opponent identities. Phase 2 of #16: opp-name dispatch
  // moved to BattlePage; the old text-clear + parent-hide kept here as
  // a defensive no-op against any CSS that might try to show them.
  const lp = document.getElementById("lbl-player");
  const le = document.getElementById("lbl-enemy");
  if (lp) {
    lp.textContent = "";
    lp.parentElement.style.display = "none";
  }
  if (le) {
    le.textContent = "";
    le.parentElement.style.display = "none";
  }
  const pvp = window._PVP;
  const oppName = pvp?.opponent ? `@${pvp.opponent}` : "Enemy";
  window.setBattleOpp?.(oppName);
}

function setShopLocked(locked) {
  document
    .getElementById("shopwrap")
    ?.classList.toggle("shop-collapsed", locked);
  document
    .getElementById("benchwrap")
    ?.classList.toggle("shop-collapsed", locked);
}

function startBattle() {
  if (!G.board.filter(Boolean).length) {
    log(
      "❌ No fighters on field! Click a Barracks card to select it, then click an empty slot on your field.",
      "lk",
    );
    return;
  }
  stopPhaseTimer();
  if (window._PVP?.stopRoundTimer) window._PVP.stopRoundTimer();
  if (typeof setMobileStep === "function") setMobileStep(null);
  setShopLocked(true);
  G.bsel = null;
  G.fieldSel = null;
  G.fieldDrag = null;
  clearFieldPlacementHints();

  // ── PvP mode: submit team to server and wait ──────
  if (window._PVP) {
    const pvp = window._PVP;
    // Prefix unit IDs with side token to prevent collisions in server umap.
    // Both clients generate sequential IDs (u1, u2…) independently;
    // without a prefix, umap[u1] from p1 would overwrite umap[u1] from p2.
    const _pfx = pvp.isP1 ? "p1:" : "p2:";
    pvp._idPrefix = _pfx;
    const board = G.board.map((u) =>
      u ? { ...u, id: _pfx + u.id } : null,
    );
    // Also prefix bench so merges/combos keep consistent IDs
    G.bench = G.bench.map((u) => (u ? { ...u, id: _pfx + u.id } : null));
    // Update board in-place so DOM render matches submitted IDs
    G.board = G.board.map((u) => (u ? { ...u, id: _pfx + u.id } : null));
    pvp._idsPrefixed = true;
    const btn = document.getElementById("bfight");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Waiting for opponent...";
    }
    G.phase = "waiting";
    log("📤 Team submitted! Waiting for opponent...", "lr");
    _dispatchBanner(
      `⏳ Battle ${G.battleNum}/${G.format} — waiting for opponent`,
      "bbattle",
    );
    render();
    pvp.socket.emit("submit_team", {
      matchId: pvp.matchId,
      board,
      merges: G.duelStats.mergesP,
    });
    return;
  }

  // ── AI mode ───────────────────────────────────────
  G.phase = "battle";
  G.enemy = G.duelEnemy.map((u) => (u ? { ...u } : null));
  // No pre-apply pass: shared/simulate.js applies Sacred Aura on both
  // sides during simulation and emits the aura events the prep phase
  // animates (same code path PvP already exercises).
  log(`⚔️ Round ${G.battleNum}/${G.format} — Battle begins!`, "lr lsep");
  _dispatchBanner(
    `⚔️ Battle ${G.battleNum}/${G.format} in progress...`,
    "bbattle",
  );
  render();
  // Apply flat equipment bonuses to both player and bot units.
  // Bot units use the player's gear totals for their respective hero classes
  // so the bot's damage scales with player progression (same gear level).
  const _gear = window.HF_gear || {};
  if (!window.HF_gear || Object.keys(_gear).length === 0) {
    console.warn('[startBattle] window.HF_gear is empty — gear bonuses will not be applied. Check gear API fetch timing.');
  }
  const _applyGear = (u) => {
    if (!u) return;
    const base = C[u.cid]?.levels?.[u.lv];
    if (!base) {
      console.warn(`[startBattle] Missing level data for cid="${u.cid}" lv=${u.lv} — unit stats not updated.`);
      return;
    }
    const eq = _gear[u.cid]?.totals ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
    u.atk = Math.floor(base.atk) + eq.atk_bonus;
    u.maxHp = base.max_hp + eq.hp_bonus;
    u.hp = u.maxHp;
    u.initiative = (base.initiative || 0) + eq.spd_bonus;
  };
  G.board.forEach(_applyGear);
  G.enemy.forEach(_applyGear);
  const res = simulate(G.board, G.enemy);
  window.HFBot?.learnFromBattle(res.evs, res.umap);
  playback(res);
}

function playback({ evs, winner, umap, stats }) {
  clearTimeout(btimer); // Adicione isto
  btimer = null;
  const dHp = {};
  Object.values(umap).forEach((u) => (dHp[u.id] = u.maxHp));
  const sneakHitEls = new Set();
  const tg = {};
  evs
    .filter((e) => e.tick >= 0)
    .forEach((e) => {
      (tg[e.tick] = tg[e.tick] || []).push(e);
    });
  const tks = Object.keys(tg)
    .map(Number)
    .sort((a, b) => a - b);
  let fi = 0;
  const initQ = evs.find((e) => e.type === "queue" && e.tick === 0);
  if (initQ) renderTurnPanel(initQ.order, umap, dHp);

  function gEl(u) {
    return document.querySelector(
      `#${u.side === "p" ? "p" : "e"}field [data-uid="${u.id}"]`,
    );
  }

  // Phase 4 VFX helpers
  function flashUnit(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), getBattleFxDuration(600));
  }

  function flashDamage(el) {
    if (!el) return;
    el.classList.remove("hit");
    void el.offsetWidth;
    el.classList.add("hit");

    clearTimeout(el._hitT);
    el._hitT = setTimeout(() => {
      el.classList.remove("hit");
    }, getBattleFxDuration(340));
  }

  function spawnFloat(el, text, type, yOffset = 0) {
    const r = el.getBoundingClientRect();
    const d = document.createElement("span");
    d.className = "dmg-float " + type;
    d.textContent = text;
    d.style.left = r.left + r.width * 0.5 - 12 + "px";
    d.style.top = r.top + r.height * 0.2 + yOffset + "px";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), getBattleFxDuration(950));
  }

  function auraFloat(el, text) {
    const r = el.getBoundingClientRect();
    const d = document.createElement("span");
    d.className = "dmg-float aura-buff";
    d.textContent = text;
    d.style.left = r.left + r.width * 0.5 + "px";
    d.style.top = r.top + r.height * 0.1 + "px";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), getBattleFxDuration(1350));
  }

  function getCenter(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    };
  }

  function spawnImpact(targetEl) {
    const p = getCenter(targetEl);
    const ring = document.createElement("span");
    ring.className = "impact-ring";
    ring.style.left = p.x + "px";
    ring.style.top = p.y + "px";
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), getBattleFxDuration(320));
  }

  function animateMeleeAttack(attackerEl, targetEl) {
    const a = getCenter(attackerEl);
    const t = getCenter(targetEl);
    const dx = t.x - a.x;
    const dy = t.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(28, dist * 0.18);

    const tx = (dx / dist) * reach;
    const ty = (dy / dist) * reach;

    attackerEl.animate(
      [
        { transform: "translate(0px, 0px) scale(1)" },
        {
          transform: `translate(${tx * 0.82}px, ${ty * 0.82}px) scale(1.06)`,
          offset: 0.3,
        },
        {
          transform: `translate(${tx}px, ${ty}px) scale(1.02)`,
          offset: 0.55,
        },
        { transform: "translate(0px, 0px) scale(1)" },
      ],
      {
        duration: getBattleFxDuration(260),
        easing: "cubic-bezier(0.18, 0.9, 0.22, 1)",
        fill: "none",
      },
    );
  }

  function spawnProjectile(attackerEl, targetEl) {
    const a = getCenter(attackerEl);
    const t = getCenter(targetEl);
    const dx = t.x - a.x;
    const dy = t.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const rot = Math.atan2(dy, dx) * (180 / Math.PI);

    const p = document.createElement("span");
    p.className = "projectile ranged";
    p.style.left = a.x + "px";
    p.style.top = a.y + "px";
    p.style.setProperty("--dx", `${dx}px`);
    p.style.setProperty("--dy", `${dy}px`);
    p.style.setProperty("--rot", `${rot}deg`);
    p.style.setProperty("--dist", `${dist}px`);
    document.body.appendChild(p);

    setTimeout(() => p.remove(), getBattleFxDuration(300));
  }

  function animateAttack(attackerEl, targetEl, attackerUnit) {
    if (!attackerEl || !targetEl || !attackerUnit) return;

    if (attackerUnit.tp === "ranged") {
      spawnProjectile(attackerEl, targetEl);
    } else {
      animateMeleeAttack(attackerEl, targetEl);
    }

    setTimeout(
      () => {
        spawnImpact(targetEl);
      },
      getBattleFxDuration(attackerUnit.tp === "ranged" ? 220 : 145),
    );
  }

  function spawnSneakSmoke(attackerEl, targetEl) {
    const a = getCenter(attackerEl);
    const t = getCenter(targetEl);

    const smoke = document.createElement("span");
    smoke.className = "sneak-smoke";
    smoke.style.left = a.x + "px";
    smoke.style.top = a.y + "px";
    smoke.style.setProperty("--dx", `${t.x - a.x}px`);
    smoke.style.setProperty("--dy", `${t.y - a.y}px`);
    document.body.appendChild(smoke);

    setTimeout(() => smoke.remove(), getBattleFxDuration(760));
  }

  function spawnSneakSlash(targetEl, rotDeg = -25, ox = 0, oy = 0) {
    const p = getCenter(targetEl);
    const slash = document.createElement("span");
    slash.className = "sneak-slash";
    slash.style.left = `${p.x + ox}px`;
    slash.style.top = `${p.y + oy}px`;
    slash.style.setProperty("--rot", `${rotDeg}deg`);
    document.body.appendChild(slash);

    setTimeout(() => slash.remove(), getBattleFxDuration(260));
  }

  function playSneakStrike(attackerEl, targetEl, amount, targetUnit) {
    if (!attackerEl || !targetEl) return;

    spawnSneakSlash(
      targetEl,
      -28 + Math.round(Math.random() * 10),
      -6 + Math.round(Math.random() * 8),
      -4 + Math.round(Math.random() * 8),
    );

    setTimeout(() => {
      spawnSneakSlash(
        targetEl,
        24 + Math.round(Math.random() * 12),
        6 - Math.round(Math.random() * 8),
        4 - Math.round(Math.random() * 8),
      );

      sneakHitEls.add(targetEl);

      // brilho próprio do Sneak Strike, sem usar o hit branco genérico
      targetEl.classList.remove("vfx-sneak-hit");
      void targetEl.offsetWidth;
      targetEl.classList.add("vfx-sneak-hit");

      spawnImpact(targetEl);
      spawnFloat(targetEl, "−" + amount, "sneak-crit");

      if (targetUnit && amount > 0) {
        dHp[targetUnit.id] = Math.max(0, dHp[targetUnit.id] - amount);
        updHp(targetUnit);
      }
    }, getBattleFxDuration(130));
  }

  function updHp(u, isHeal = false) {
    const el = gEl(u);
    if (!el) return;
    const b = el.querySelector(".uhf");
    if (!b) return;
    const cur = Math.max(0, dHp[u.id]);
    const r = cur / u.maxHp;
    b.style.width = `${r * 100}%`;
    b.className = "uhf " + (r < 0.3 ? "lo" : r < 0.6 ? "mid" : "hi");
    el.classList.toggle("low-hp", r < 0.3);
    const hpNum = el.querySelector("[data-uhp]");
    if (hpNum) {
      hpNum.textContent = Math.round(cur);
      const base = hpNum.className.replace(/\bhp-\w+/g, "").trim();
      const finalCls = r < 0.3 ? "hp-lo" : r < 0.6 ? "hp-mid" : "";
      if (isHeal) {
        // Fade to green, then fade to final colour
        hpNum.className = base + " hp-hi";
        clearTimeout(hpNum._healT);
        hpNum._healT = setTimeout(() => {
          hpNum.className = base + (finalCls ? " " + finalCls : "");
        }, 350);
      } else {
        hpNum.className = base + (finalCls ? " " + finalCls : "");
      }
    }
  }

  function updAtk(u) {
    const el = gEl(u);
    if (!el) return;
    const atkNum = el.querySelector("[data-uatk]");
    if (!atkNum) return;
    atkNum.textContent = u.atk;
    atkNum.classList.add("atk-fury");
  }

  function frame() {
    if (fi >= tks.length) {
      hideTurnPanel();
      endBattle(winner, stats);
      return;
    }
    const el = tg[tks[fi++]];
    const seen = new Set();
    let tickDelay = getBattleFrameDelay();
    el.forEach((ev) => {
      const u = umap[ev.uid],
        t = ev.tid && umap[ev.tid];
      if (ev.type === "round_start") {
        log(`— Cicle ${ev.round} —`, "lrnd");
      } else if (ev.type === "queue") {
        renderTurnPanel(ev.order, umap, dHp);
      } else if (
        ev.type === "ability" &&
        !ev.silent &&
        !seen.has(ev.uid + ev.abilName)
      ) {
        seen.add(ev.uid + ev.abilName);
        if (ev.abilName === "Fury" && u) updAtk(u);
        const eSkill = u && gEl(u);
        const target = ev.targetId ? umap[ev.targetId] : null;
        const eTarget = target ? gEl(target) : null;
        if (eSkill) flashUnit(eSkill, "vfx-skill");
        if (ev.abilName === "Sneak Strike" && eSkill && eTarget) {
          playSneakStrike(eSkill, eTarget, ev.amount || 0, target);
          tickDelay = Math.max(tickDelay, getBattleFxDuration(980));
        }
        log(
          (ABILOG[ev.abilName] || "✨ {n}: " + ev.abilName).replace(
            "{n}",
            u ? nameTag(u) : "?",
          ),
          "lab",
          true,
        );
      } else if (ev.type === "heal" && t) {
        dHp[t.id] = Math.min(t.maxHp, dHp[t.id] + ev.amt);
        updHp(t, true);
        const eHeal = gEl(t);
        if (eHeal) {
          flashUnit(eHeal, "vfx-heal");
          spawnFloat(eHeal, "+" + ev.amt, "heal");
        }
        log(
          `${uTag(u)} <span class="lheal">heals</span> ${uTag(t)} <span class="lheal">+${ev.amt} HP</span>`,
          "lab",
          true,
        );
      } else if (ev.type === "miss" && u && t) {
        const eMiss = gEl(t);
        if (eMiss) spawnFloat(eMiss, "MISS", "miss");
        log(
          `${uTag(u)} <span class="lmiss">miss</span> ${uTag(t)}`,
          "latk",
          true,
        );
      } else if (ev.type === "atk" && t) {
        const eAtk = gEl(u);
        const e2 = gEl(t);
        const isSneakFollowup =
          ev.sneakFollowup ||
          (e2 !== null && sneakHitEls.has(e2));
        if (e2) sneakHitEls.delete(e2);

        // If this atk is a Sneak Strike followup, stop here —
        // the Sneak animation already handled damage and VFX.
        if (isSneakFollowup) {
          return;
        }

        // Sneak Strike already decremented dHp + called updHp in playSneakStrike;
        // normal atks apply damage/animation as usual.
        dHp[t.id] = Math.max(0, dHp[t.id] - ev.amt);
        updHp(t);

        if (eAtk && e2) {
          animateAttack(eAtk, e2, u);
        }

        if (e2) {
          if (ev.isCrit) {
            flashDamage(e2);
            flashUnit(e2, "vfx-crit");
            spawnFloat(e2, "−" + ev.amt, "crit");
          } else if (ev.glancing) {
            flashDamage(e2);
            spawnFloat(e2, "〜" + ev.amt, "glancing");
          } else {
            flashDamage(e2);
            spawnFloat(e2, "−" + ev.amt, "dmg");
            if (ev.armorAbs > 0) {
              spawnFloat(e2, "🛡 " + ev.armorAbs, "armor", 16);
            }
          }
        }
        const who = uTag(u),
          whom = uTag(t);
        log(
          ev.isCrit
            ? `${who} → ${whom} &nbsp;${dmgTag(ev.amt, true)}`
            : ev.glancing
              ? `${who} → ${whom} &nbsp;<span class="lglancing">〜${ev.amt} (scratch)</span>`
              : `${who} → ${whom} &nbsp;<span class="ldmg">−${ev.amt}</span>`,
          "latk",
          true,
        );
      } else if (ev.type === "kill" && t) {
        dHp[t.id] = 0;
        updHp(t);
        const eAtk = gEl(u);
        const e2 = gEl(t);
        const killedBySneak =
          ev.sneakFollowup ||
          (e2 !== null && sneakHitEls.has(e2));
        if (e2) sneakHitEls.delete(e2);
        if (killedBySneak) {
          setTimeout(() => {
            const e3 = gEl(t);
            if (e3) e3.classList.add("dead");
          }, getBattleFxDuration(200));
          return;
        }

        if (eAtk && e2) animateAttack(eAtk, e2, u);
        if (e2) {
          if (ev.isCrit) {
            flashDamage(e2);
            flashUnit(e2, "vfx-crit");
            spawnFloat(e2, "−" + ev.amt, "crit");
          } else if (ev.glancing) {
            flashDamage(e2);
            spawnFloat(e2, "〜" + ev.amt, "glancing");
          } else {
            flashDamage(e2);
            spawnFloat(e2, "−" + ev.amt, "dmg");
            if (ev.armorAbs > 0) {
              spawnFloat(e2, "🛡 " + ev.armorAbs, "armor", 16);
            }
          }
        }
        setTimeout(() => {
          const e3 = gEl(t);
          if (e3) e3.classList.add("dead");
        }, getBattleFxDuration(200));
        log(
          `${uTag(u)} <span class="lkill">killed</span> ${uTag(t)} &nbsp;<span class="ldmg">−${ev.amt}</span> 💀`,
          "lkill",
          true,
        );
      }
    });
    btimer = setTimeout(frame, tickDelay);
  }

  // ── Preparation phase: buffs → abilities, then combat ──────────────
  function runPrepPhase(onDone) {
    const prepEvs = [
      ...evs.filter((e) => e.type === "ability" && e.tick === -1),
      ...evs.filter(
        (e) =>
          e.type === "ability" &&
          e.tick === 0 &&
          e.abilName === "Sneak Strike",
      ),
    ];
    prepEvs.forEach((ev) => {
      ev.silent = true;
    });

    if (!prepEvs.length) {
      onDone();
      return;
    }

    let i = 0;
    function nextAction() {
      if (i >= prepEvs.length) {
        setTimeout(onDone, getBattleFxDuration(260));
        return;
      }
      const ev = prepEvs[i++];
      const u = umap[ev.uid];
      const uEl = u && gEl(u);

      log(
        (ABILOG[ev.abilName] || "✨ {n}: " + ev.abilName).replace(
          "{n}",
          u ? nameTag(u) : "?",
        ),
        "lab",
        true,
      );

      if (ev.abilName === "Sacred Aura" && u && uEl) {
        flashUnit(uEl, "vfx-skill");
        const adj = adjacentSlots(u.slot);
        Object.values(umap)
          .filter((a) => a.side === u.side && adj.includes(a.slot))
          .forEach((a) => {
            const aEl = gEl(a);
            if (!aEl) return;
            flashUnit(aEl, "vfx-heal");
            const bonus = ev.auraBonus && ev.auraBonus[a.id];
            if (bonus) auraFloat(aEl, "+" + bonus + " MAX HP");
          });
      } else if (ev.abilName === "Sneak Strike") {
        const followup = evs.find(
          (e) =>
            (e.type === "atk" || e.type === "kill") &&
            e.uid === ev.uid &&
            e.tid === ev.targetId &&
            e.tick === ev.tick,
        );
        if (followup) followup.sneakFollowup = true;
        const t = umap[ev.targetId];
        const tEl = t && gEl(t);
        if (uEl) flashUnit(uEl, "vfx-skill");
        if (uEl && tEl) playSneakStrike(uEl, tEl, ev.amount || 0, t);
      }

      setTimeout(nextAction, getBattleFxDuration(480));
    }
    nextAction();
  }

  runPrepPhase(() => frame());
}

function endBattle(w, stats) {
  G.phase = "result";
  clearTimeout(btimer);
  hideTurnPanel();
  render();
  // (debug logs removed)
  // Defensive: ensure incoming stats are numeric (PvP server may omit keys)
  G.duelStats.dmgP += Number(stats?.dmgP || 0);
  G.duelStats.dmgE += Number(stats?.dmgE || 0);
  G.duelStats.killsP += Number(stats?.killsP || 0);
  G.duelStats.killsE += Number(stats?.killsE || 0);
  G.duelStats.battles.push({ winner: w });
  // (debug logs removed)
  // In PvP mode boardSnap/enemySnap aren't sent from server — keep the snap set from umap
  G.lastBoardSnap = stats.boardSnap || G.lastBoardSnap;
  if (!window._PVP) G.lastEnemySnap = stats.enemySnap || G.lastEnemySnap;

  if (w === "p") {
    // In PvP mode score was already set by round_result handler
    if (!window._PVP) G.duelScore.p++;
    G.lastBattleResult = "win";
    log(`🏆 Battle ${G.battleNum} won!`, "lr");
  } else {
    if (!window._PVP) G.duelScore.e++;
    G.lastBattleResult = "loss";
    log(`💔 Battle ${G.battleNum} lost!`, "lk");
  }

  const over =
    G.duelScore.p >= G.winsNeeded ||
    G.duelScore.e >= G.winsNeeded ||
    G.battleNum >= G.format;
  document.getElementById("bfight").style.display = "none";
  const nb = document.createElement("button");
  nb.id = "bnext";

  if (over) {
    const pw = G.duelScore.p > G.duelScore.e;
    if (pw) {
      G.duelsWon++;
      _dispatchBanner(`🏆 DUEL WON! ${G.duelScore.p}–${G.duelScore.e}`, "bwin");
    } else {
      G.duelsLost++;
      _dispatchBanner(
        `💔 DUEL LOST! ${G.duelScore.p}–${G.duelScore.e}`,
        "blose",
      );
    }
    log(
      `${pw ? "🏆" : "💔"} Duel ${G.duelNum} over! You ${G.duelScore.p} × ${G.duelScore.e}`,
      "lr",
    );
    setTimeout(() => _dispatchDuelResult(pw), 500);
    nb.className = "btn gnbtn";
    if (window._PVP) {
      nb.textContent = "🏠 Back to Lobby";
      nb.onclick = () => {
        if (window._PVP.socket) {
          window._PVP.socket.emit('concede');
          window._PVP.socket.disconnect();
        }
        window.location.href = "/lobby";
      };
    } else {
      nb.textContent = "🌟 Next Duel";
      nb.onclick = nextDuel;
    }
  } else {
    const inc = betweenIncome();
    const sc = `${G.duelScore.p}–${G.duelScore.e}`;
    _dispatchBanner(
      `⚔️ Battle ${G.battleNum}/${G.format}: ${sc}. ${w === "p" ? "Victory!" : "Defeat!"}`,
      w === "p" ? "bwin" : "blose",
    );
    nb.className = "btn nbtn";
    nb.textContent = `▶ Battle ${G.battleNum + 1} (+${inc}💰)`;
    nb.onclick = nextBattle;
  }
  document.getElementById("ctrl").appendChild(nb);
  // Auto-advance: trigger the next action immediately.
  // Only auto-click when this button advances to the next *battle* (not when
  // the duel result overlay is shown and the button is "Next Duel" / "Back to Lobby").
  if (nb.onclick === nextBattle) {
    // Hide the button during the short delay so it doesn't flash briefly
    nb.style.visibility = "hidden";
    // Small delay to avoid immediate UI jump — makes transition smoother
    setTimeout(() => {
      try {
        nb.click();
      } catch (e) {
        // fallback: call the handler directly if click fails
        if (typeof nb.onclick === "function") nb.onclick();
      }
    }, 350);
  }
  updateHdr();
  renderDuelBar();
}

// ═══════════════════════════════════════════════════
//  DUEL RESULT OVERLAY
// ═══════════════════════════════════════════════════
// Phase 4 of #16: duel-result overlay is React-rendered. Build a
// pure render shape (stats, team summaries, win/loss flag) and
// dispatch via window.showDuelResult. The PvP "submitting..." 3s
// mock is now a useEffect in BattlePage. The Next/Back-to-Lobby
// button delegates to window.duelResultNext below.
function _dispatchDuelResult(pw) {
  const isPvP = !!window._PVP;
  const summarizeUnits = (arr) =>
    (arr || []).filter(Boolean).map((u) => ({
      ico: u.ico,
      levelLabel: LS[u.lv],
      shortName: (u.name || "").slice(0, 4),
      alive: u.hp > 0,
    }));
  window.showDuelResult?.({
    pw,
    scoreP: G.duelScore.p,
    scoreE: G.duelScore.e,
    battles: G.duelStats.battles.map((b) => ({ winner: b.winner })),
    dmgP: G.duelStats.dmgP,
    dmgE: G.duelStats.dmgE,
    killsP: G.duelStats.killsP,
    killsE: G.duelStats.killsE,
    mergesP: G.duelStats.mergesP,
    mergesE: isPvP ? G.duelStats.mergesE : "—",
    teamP: summarizeUnits(G.lastBoardSnap),
    // PvP: final state from umap. AI: fallback to initial enemy board.
    teamE: summarizeUnits(G.lastEnemySnap || G.duelEnemy),
    isPvP,
    wager: isPvP ? (window._PVP.wager || 0) : 0,
  });
}

// Next-duel button click: PvP returns to lobby; AI proceeds to next duel.
window.duelResultNext = function () {
  if (window._PVP) {
    if (window._PVP.socket) {
      window._PVP.socket.emit('concede');
      window._PVP.socket.disconnect();
    }
    window.location.href = "/lobby";
  } else {
    nextDuel();
  }
};

// ═══════════════════════════════════════════════════
//  GAME FLOW
// ═══════════════════════════════════════════════════
// Quit-modal state lives in BattlePage.jsx (Phase 1 of #16). The
// window.openQuitModal / closeQuitModal / confirmQuit shims registered
// there are now the single source of truth — nothing here.

// ═══════════════════════════════════════════════════
//  PvP MODE
// ═══════════════════════════════════════════════════

// Mirror board columns (col 0 ↔ col 2) for efield display.
// Both players build with col 2 = front (closest to VS on pfield).
// efield expects col 0 = front (closest to VS on efield).
// Mirroring converts between the two perspectives.
function mirrorBoard(board) {
  if (!board) return Array(9).fill(null);
  const result = Array(9).fill(null);
  board.forEach((u, i) => {
    if (!u) return;
    result[Math.floor(i / 3) * 3 + (2 - (i % 3))] = { ...u };
  });
  return result;
}

// Flip simulate result so local player is always 'p' side
function pvpFlipResult({ evs, umap, stats }) {
  const flippedUmap = {};
  Object.entries(umap).forEach(([id, u]) => {
    flippedUmap[id] = { ...u, side: u.side === "p" ? "e" : "p" };
  });
  return {
    evs, // evs reference umap ids — sides resolved via umap
    umap: flippedUmap,
    stats: {
      dmgP: stats.dmgE,
      dmgE: stats.dmgP,
      killsP: stats.killsE,
      killsE: stats.killsP,
      survP: stats.survE,
      survE: stats.survP,
    },
  };
}

function pvpInit(cfg) {
  const pvp = {
    matchId: cfg.matchId,
    opponent: cfg.opponent,
    isP1: cfg.isP1,
    format: cfg.format || 5,
    wager: cfg.wager,
    wagerType: cfg.wagerType,
    socket: null,
  };
  window._PVP = pvp;

  // Start the game immediately (no bot)
  startGame(pvp.format, true /* pvpMode */);

  // Connect socket and rejoin match
  const base =
    window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000"
      : "";
  pvp.socket = io(base, {
    transports: ["websocket"],
    auth: window._HF_SESSION?.mode === 'guest'
      ? { guestName: window._HF_SESSION.username }
      : { token: window._HF_SESSION?.token },
  });

  pvp.socket.on("connect", () => {
    pvp.socket.emit("rejoin_match", { matchId: pvp.matchId });
  });

  pvp.socket.on("rejoin_error", (data) => {
    showToastBattle(data.message || "Match not found. Redirecting...");
    setTimeout(() => {
      window.location.href = "/lobby";
    }, 2500);
  });

  // Sync state from server after reconnect — ensures battleNum and scores
  // are correct even if the player missed one or more events.
  pvp.socket.on("rejoin_ok", (data) => {
    const isP1 = pvp.isP1;
    G.battleNum = data.battleNum;
    G.duelScore = {
      p: isP1 ? data.scores[data.p1] : data.scores[data.p2],
      e: isP1 ? data.scores[data.p2] : data.scores[data.p1],
    };
    updateHdr();
    renderDuelBar();
    log(`🔄 Reconnected — Battle ${data.battleNum}/${G.format}`, "lk");
  });

  // ── Round countdown timer ──────────────────────────────────────────────
  let _roundTimerInterval = null;

  function startRoundTimer(ms) {
    stopRoundTimer();
    // Phase 2 of #16: dispatch through the BattlePage shims. See
    // startPhaseTimer above for the same pattern.
    let remaining = Math.ceil(ms / 1000);
    function tick() {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const txt = `⏱ ${m}:${String(s).padStart(2, "0")}`;
      window.setRoundTimer?.(txt, remaining <= 30);
      if (remaining <= 0) {
        stopRoundTimer();
        window.setRoundTimer?.("⏱ 0:00", false);
      }
    }
    tick();
    _roundTimerInterval = setInterval(() => {
      remaining--;
      tick();
    }, 1000);
  }

  function stopRoundTimer() {
    if (_roundTimerInterval) {
      clearInterval(_roundTimerInterval);
      _roundTimerInterval = null;
    }
    window.hideRoundTimer?.();
  }

  // Expose so other functions can start/stop the countdown
  pvp.stopRoundTimer = stopRoundTimer;
  pvp.startRoundTimer = startRoundTimer;

  pvp.socket.on("round_timer", (data) => {
    // Server emits round_timer immediately after round_result (for the next
    // round). If the battle animation is still playing, defer the timer so
    // it only appears once the recruitment/shop phase actually begins.
    if (G.phase === "shop") {
      startRoundTimer(data.ms);
    } else {
      pvp._pendingTimerMs = data.ms;
    }
  });

  pvp.socket.on("opponent_ready", () => {
    showToastBattle("Opponent submitted their team!");
  });

  pvp.socket.on("opponent_disconnected", (data) => {
    showToastBattle(`${data.username} disconnected. Waiting...`);
  });

  pvp.socket.on("match_cancelled", (data) => {
    showToastBattle(data.reason || "Match cancelled.");
    setTimeout(() => {
      window.location.href = "/lobby";
    }, 3000);
  });

  pvp.socket.on("round_result", (data) => {
    // Determine local perspective
    const isP1 = pvp.isP1;
    const myBoard = isP1 ? data.p1Board : data.p2Board;
    const enemyBoard = isP1 ? data.p2Board : data.p1Board;

    // Mirror the enemy board for efield display:
    // opponent built with col 2 as front (pfield), efield needs col 0 as front.
    G.enemy = mirrorBoard(enemyBoard);
    G.duelEnemy = mirrorBoard(enemyBoard);

    // Build result from local perspective
    let result = { evs: data.evs, umap: data.umap, stats: data.stats };
    if (!isP1) result = pvpFlipResult(result);

    const localWon = data.roundWinner === window._HF_SESSION.username;
    result.winner = localWon ? "p" : "e";

    // Sync battle number and score from server — source of truth for
    // seriesOver detection in endBattle(), and for reconnection correctness.
    G.battleNum = data.battleNum;
    G.duelScore = {
      p: isP1 ? data.scores[data.p1] : data.scores[data.p2],
      e: isP1 ? data.scores[data.p2] : data.scores[data.p1],
    };

    // Snapshot final armies from umap for the result screen.
    // After pvpFlipResult, side='p' = local player, side='e' = opponent.
    const umapUnits = Object.values(result.umap);
    G.lastBoardSnap = umapUnits.filter((u) => u.side === "p");
    G.lastEnemySnap = umapUnits.filter((u) => u.side === "e");

    // Accumulate opponent's merges (server relays them from the opponent's submit_team)
    const opponentName = isP1 ? data.p2 : data.p1;
    if (data.merges && data.merges[opponentName] !== undefined) {
      G.duelStats.mergesE = data.merges[opponentName];
    }

    // Re-enable fight button (hidden while waiting)
    const fb = document.getElementById("bfight");
    if (fb) {
      fb.disabled = false;
      fb.textContent = "START BATTLE";
    }

    G.phase = "battle";
    stopRoundTimer(); // battle started — hide countdown
    render();

    log(`⚔️ Round ${G.battleNum}/${G.format} — Battle begins!`, "lr lsep");
    // Abilities at tick=-1 (Sacred Aura, Sneak Strike, etc.) are logged
    // by playback() → runPrepPhase() below — logging them here too would
    // produce duplicate log entries in PvP mode.

    _dispatchBanner(
      `⚔️ Battle ${data.battleNum}/${G.format} in progress...`,
      "bbattle",
    );
    playback(result);
  });

  pvp.socket.on("prize_sent", (data) => {
    const amount = data.amount
      ? `${parseFloat(data.amount).toFixed(3)} HIVE`
      : "prize";
    const kind = data.type === "stake" ? "Hive Power" : "Liquid HIVE";
    showToastBattle(`🏆 Prize sent! ${amount} as ${kind}.`);
    log(`🏆 Prize: ${amount} (${kind}) → ${data.to}`, "lk");
  });

  pvp.socket.on("prize_error", (data) => {
    showToastBattle(
      `⚠️ Prize delivery failed: ${data.error || "unknown error"}. Contact support.`,
    );
    log(`⚠️ Prize error: ${data.error || "unknown"}`, "lr");
  });

  pvp.socket.on("error", (data) => {
    showToastBattle(data.message || "PvP error.");
  });
}

// Small in-battle toast (log line fallback)
function showToastBattle(msg) {
  log(`ℹ️ ${msg}`, "lk");
}

function startGame(fmt, pvpMode = false) {
  // Apply random background from player's equipped pool (client-side only).
  (function applyArenaBackground() {
    const pool = window.HF_equipped_backgrounds || [];
    const guestArenas = [
      { preview: '/images/arenas/arena-desert.jpg' },
      { preview: '/images/arenas/arena-florest.jpg' },
      { preview: '/images/arenas/arena-snow.jpg' },
    ];
    const list = pool.length > 0 ? pool : guestArenas;
    const pick = list[Math.floor(Math.random() * list.length)];
    const el = document.getElementById('arena-wrap');
    if (pick.preview) {
      document.body.style.backgroundImage = `url('${pick.preview}')`;
    }
  })();

  // Reset completo do estado para garantir partida limpa
  G.format = fmt;
  G.winsNeeded = Math.ceil(fmt / 2);
  G.phase = "shop";
  G.duelNum = 1;
  G.battleNum = 1;
  G.duelScore = { p: 0, e: 0 };
  G.duelsWon = 0;
  G.duelsLost = 0;
  G.gold = START_GOLD();
  G.shop = [];
  G.shopCombo = null;
  G.shopCombos = [];
  G.bench = [];
  G.board = Array(9).fill(null);
  G.duelEnemy = Array(9).fill(null);
  G.enemy = Array(9).fill(null);
  G.bsel = null;
  G.fieldSel = null;
  G.fieldDrag = null;
  G.lastBattleResult = null;
  G.duelStats = {
    dmgP: 0,
    dmgE: 0,
    killsP: 0,
    killsE: 0,
    mergesP: 0,
    mergesE: 0,
    battles: [],
  };
  G.lastBoardSnap = [];
  G.lastEnemySnap = null;
  document.getElementById("game").style.display = "flex";
  window.setBattleFmt?.(`BO${fmt}`);
  document.getElementById("log").innerHTML = "";
  if (!pvpMode) {
    window.HFBot.initDuel(_deckPool);
    validateGameState();
    G.duelEnemy = window.HFBot.getBoard().map((u) => (u ? { ...u } : null));
  }
  genShop();
  render();
  updateFieldLabels();
  startPhaseTimer(120000);
  const logEl = document.getElementById("log");
  for (let i = 0; i < 5; i++) {
    const d = document.createElement("div");
    d.className = "le";
    d.innerHTML = "&nbsp;";
    logEl.appendChild(d);
  }
  if (pvpMode) {
    const pvp = window._PVP;
    const opp = pvp?.opponent || "Opponent";
    log(
      `⚔️ PvP BO${fmt} | vs @${opp} | Win ${G.winsNeeded} battles. You have ${START_GOLD()}💰.`,
      "lr",
    );
    log(
      `ℹ️ Build your army, then click START BATTLE to submit your team.`,
      "lk",
    );
  } else {
    log(
      `⚔️ Format BO${fmt} | AI Opponent | Win ${G.winsNeeded} battles. You have ${START_GOLD()}💰.`,
      "lr",
    );
  }
  if (_deckPool) {
    log(
      `🛡️ Deck active — recruitment shows only your formation heroes.`,
      "lk",
    );
  }
}

// Removes all battle.js DOM mutations (dead class, HP bar) before React
// re-renders the shop phase. Without this, React skips DOM updates because
// its fiber thinks props haven't changed (e.g. className still 'unit l1')
// even though battle.js set el.classList.add('dead') / el.style.width='20%'.
function _cleanupBattleDOM() {
  document.querySelectorAll('#pfield .unit, #efield .unit').forEach(el => {
    el.classList.remove('dead', 'low-hp', 'hit', 'vfx-crit', 'mg');
    const uhf = el.querySelector('.uhf');
    if (uhf) { uhf.style.width = '100%'; uhf.className = 'uhf hi'; }
  });
}

function nextBattle() {
  setShopLocked(false);
  G.battleNum++;
  restoreFieldHp();
  _cleanupBattleDOM();
  const inc = betweenIncome();
  G.gold += inc;
  G.phase = "shop";
  G.bsel = null;
  G.fieldSel = null;
  G.fieldDrag = null;
  genShop();
  if (!window._PVP) {
    window.HFBot.nextBattle(G.lastBattleResult === "win" ? "loss" : "win");
    window.HFBot.runTurn();
    G.duelEnemy = window.HFBot.getBoard().map((u) => (u ? { ...u } : null));
  } else {
    // Hide opponent's board during shop phase — only revealed when battle starts.
    G.duelEnemy = Array(9).fill(null);
    // Strip the round's ID prefix from board and bench so the next
    // round starts with clean IDs and re-prefixes correctly on submit.
    const pfx = window._PVP._idPrefix || "";
    if (window._PVP._idsPrefixed && pfx) {
      G.board = G.board.map((u) =>
        u
          ? {
            ...u,
            id: u.id.startsWith(pfx) ? u.id.slice(pfx.length) : u.id,
          }
          : null,
      );
      G.bench = G.bench.map((u) =>
        u
          ? {
            ...u,
            id: u.id.startsWith(pfx) ? u.id.slice(pfx.length) : u.id,
          }
          : null,
      );
      window._PVP._idsPrefixed = false;
    }
    // Start the recruitment timer that was deferred while battle animation played.
    if (window._PVP._pendingTimerMs && window._PVP.startRoundTimer) {
      window._PVP.startRoundTimer(window._PVP._pendingTimerMs);
      window._PVP._pendingTimerMs = null;
    }
  }
  document.getElementById("bnext")?.remove();
  document.getElementById("bfight").style.display = "";
  log("— 🛒 Shop Phase —", "lrnd lsep");
  render();
  updateHdr();
  startPhaseTimer(120000);
  if (window._PVP) {
    const pvp = window._PVP;
    log(
      `🔄 Battle ${G.battleNum}/${G.format} | Score: ${G.duelScore.p}–${G.duelScore.e} | +${inc}💰 | Build and submit your team!`,
      "lr",
    );
    log(
      `ℹ️ vs ${pvp.opponent} — place your heroes and click START BATTLE.`,
      "lk",
    );
  } else {
    log(
      `🔄 Battle ${G.battleNum}/${G.format} | Score: ${G.duelScore.p}–${G.duelScore.e} | +${inc}💰 | AI opponent upgraded!`,
      "lr",
    );
  }
}

function nextDuel() {
  setShopLocked(false);
  window.closeDuelResult?.();
  G.duelNum++;
  G.battleNum = 1;
  G.duelScore = { p: 0, e: 0 };
  G.gold = START_GOLD();
  G.bench = [];
  G.board = Array(9).fill(null);
  G.lastBattleResult = null;
  G.bsel = null;
  G.fieldSel = null;
  G.fieldDrag = null;
  G.phase = "shop";
  G.duelStats = {
    dmgP: 0,
    dmgE: 0,
    killsP: 0,
    killsE: 0,
    mergesP: 0,
    mergesE: 0,
    battles: [],
  };
  window.HFBot.initDuel(_deckPool);
  G.duelEnemy = window.HFBot.getBoard().map((u) => (u ? { ...u } : null));
  G.enemy = Array(9).fill(null);
  genShop();
  document.getElementById("bnext")?.remove();
  document.getElementById("bfight").style.display = "";
  _cleanupBattleDOM();
  render();
  updateHdr();
  log(
    `🌟 Duel ${G.duelNum}! New AI opponent with 7💰. Analyze and build!`,
    "lr lsep",
  );
}

// ═══════════════════════════════════════════════════
//  LOG & UI HELPERS
// ═══════════════════════════════════════════════════
function log(msg, cls = "", html = false) {
  const l = document.getElementById("log"),
    d = document.createElement("div");
  d.className = `le ${cls}`;
  if (html) d.innerHTML = msg;
  else d.textContent = msg;
  l.appendChild(d);
  l.scrollTop = l.scrollHeight;
}
function uTag(u) {
  const side = u.side === "p" ? "lside-p" : "lside-e";
  return `<span class="${side}">${u.ico || ""} ${u.name}</span>`;
}
function nameTag(u) {
  const side = u.side === "p" ? "lside-p" : "lside-e";
  return `<span class="${side}">${u.name}</span>`;
}
function dmgTag(amt, isCrit) {
  return isCrit
    ? `<span class="lcrit">💥 ${amt} CRIT</span>`
    : `<span class="ldmg">${amt}</span>`;
}
// How-to-play modal state lives in BattlePage.jsx (Phase 1 of #16).
// window.openHowTo / closeHowTo shims registered there drive the React
// state. The click-outside-to-close handler is on the JSX onClick.

// ═══════════════════════════════════════════════════
//  RENDER SYSTEM
// ═══════════════════════════════════════════════════
function _dispatchBanner(t, c) {
  // Phase 2 of #16: dispatch into BattlePage. Helper kept so existing
  // call sites (~30 of them) don't need to change.
  window.setBanner?.(t, c);
}

function renderDuelBar() {
  // Build score-dot arrays of 'w' (won), 'l' (lost), 'e' (empty/pending)
  // and dispatch in one shot. BattlePage renders the four dot containers
  // (#dots-p, #dots-e, #mobile-dots-p, #mobile-dots-e) from this state.
  const battles = G.duelStats.battles; // [{winner:"p"|"e"}, ...]
  const p = [], e = [];
  for (let i = 0; i < G.format; i++) {
    if (i < battles.length) {
      const w = battles[i].winner;
      p.push(w === "p" ? "w" : "l");
      e.push(w === "e" ? "w" : "l");
    } else {
      p.push("e");
      e.push("e");
    }
  }
  window.setBattleScoreDots?.({ p, e });
}

// ═══════════════════════════════════════════════════
//  TARGET PREVIEW (mirrors pickTarget logic, outside simulate)
// ── Attack arrow helpers ───────────────────────────
let _activeHoverCell = null;

function drawAttackArrow(srcEl, tgtEl, type) {
  const svg = document.getElementById("attack-svg");
  if (!svg || !srcEl || !tgtEl) return;
  const sR = (
    srcEl.querySelector(".unit") || srcEl
  ).getBoundingClientRect();
  const tR = (
    tgtEl.querySelector(".unit") || tgtEl
  ).getBoundingClientRect();

  let x1, y1, x2, y2, mx, my;

  if (window.mobileVertical) {
    // Vertical layout: anchor top/bottom based on whether target is above or below
    const toTop = tR.top < sR.top;
    x1 = sR.left + sR.width * 0.5;
    x2 = tR.left + tR.width * 0.5;
    y1 = toTop ? sR.top + 3 : sR.bottom - 3;
    y2 = toTop ? tR.bottom - 3 : tR.top + 3;
    // Arc curves sideways
    mx = (x1 + x2) / 2 + Math.abs(y2 - y1) * 0.15;
    my = (y1 + y2) / 2;
  } else {
    // Horizontal layout: anchor left/right based on whether target is to the right
    const toRight = tR.left >= sR.left;
    x1 = toRight ? sR.right - 3 : sR.left + 3;
    x2 = toRight ? tR.left + 3 : tR.right - 3;
    y1 = sR.top + sR.height * 0.5;
    y2 = tR.top + tR.height * 0.5;
    // Arc curves up a little
    mx = (x1 + x2) / 2;
    my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.2;
  }

  const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;

  // Layer 1: blurred glow trail
  const glow = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  glow.setAttribute("d", d);
  glow.setAttribute("class", `atk-arrow atk-glow-${type}`);
  glow.setAttribute("filter", "url(#arr-blur)");
  svg.appendChild(glow);

  // Layer 2: animated flow line with arrowhead
  const flow = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  flow.setAttribute("d", d);
  flow.setAttribute("class", `atk-arrow atk-flow-${type}`);
  flow.setAttribute("marker-end", `url(#arr-${type})`);
  svg.appendChild(flow);

  // Layer 3: origin dot
  const dot = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  dot.setAttribute("cx", String(x1));
  dot.setAttribute("cy", String(y1));
  dot.setAttribute("r", "3.5");
  dot.setAttribute("class", `atk-arrow atk-dot-${type}`);
  svg.appendChild(dot);

  // Trigger fade-in via rAF so class changes are picked up
  requestAnimationFrame(() => {
    glow.classList.add("arr-enter");
    flow.classList.add("arr-enter");
    dot.classList.add("arr-enter");
  });
}

function clearAttackArrows() {
  const svg = document.getElementById("attack-svg");
  if (svg) svg.querySelectorAll(".atk-arrow").forEach((e) => e.remove());
}

// ═══════════════════════════════════════════════════
function previewTarget(playerUnit, enemyBoard) {
  const isM = (u) => u.tp !== "ranged";
  const enemies = enemyBoard
    .map((u, i) => (u ? { ...u, slot: i } : null))
    .filter(Boolean);
  if (!enemies.length) return null;

  const unitRow = Math.floor(playerUnit.slot / 3);

  const bestInRow = (row) => {
    const units = enemies.filter((e) => Math.floor(e.slot / 3) === row);
    if (!units.length) return null;
    return units.slice().sort((a, b) => {
      const colA = a.slot % 3,
        colB = b.slot % 3;
      if (colA !== colB) return colA - colB;
      return isM(a) === isM(b) ? 0 : isM(a) ? -1 : 1;
    })[0];
  };

  if (unitRow === 0) {
    return bestInRow(0) || bestInRow(1) || bestInRow(2) || null;
  }
  if (unitRow === 2) {
    return bestInRow(2) || bestInRow(1) || bestInRow(0) || null;
  }
  const t = bestInRow(1);
  if (t) return t;
  const tA = bestInRow(0),
    tC = bestInRow(2);
  if (tA && tC) return Math.random() < 0.5 ? tA : tC;
  return tA || tC || null;
}

// Phase 3 of #16, third slice (final panel): both fields render from
// React state. battle.js builds a per-side render shape (uid, lv,
// stack, ico, bg, dotColor, levelLabel, portraitUrl + Sacred Aura
// HP bonus for the player side) and dispatches via setFieldState.
// Click/drag/drop/hover events delegate back via window.fieldCell*
// and window.fieldInfo* shims defined below.
//
// Transient visual feedback stays imperative on the React-rendered
// DOM: target-preview/target-preview-splash/target-preview-ally
// classes for hover, dnd-over for drag, .dragging on dragstart.
// Battle playback (HP bar widths, kill animations) also continues
// to mutate the React-rendered DOM directly between renders —
// safe because the data-uid/data-cid attributes are stable.
function renderField(fid, board, isP) {
  // Sacred Aura HP bonus for adjacent allies (player side, shop phase)
  const auraBonus = {};
  if (isP && G.phase === "shop") {
    for (let s = 0; s < 9; s++) {
      const pal = board[s];
      if (pal && pal.cid === "paladin") {
        adjacentSlots(s).forEach((as) => {
          const ally = board[as];
          if (ally && ally.cid !== "paladin") {
            const bonus = Math.floor(ally.maxHp * pal.skillPower);
            auraBonus[as] = (auraBonus[as] || 0) + bonus;
          }
        });
      }
    }
  }
  const cells = board.map((u, i) => {
    if (!u) return null;
    const cc = C[u.cid];
    if (!cc) {
      console.warn(`Invalid cid: ${u.cid}`);
      return null;
    }
    const dotColor =
      u.lv === 1 ? cc.col :
        u.lv === 2 ? "#4488ff" :
          u.lv === 3 ? "#aa44ff" : "#ffaa00";
    return {
      uid: u.id,
      cid: u.cid,
      lv: u.lv,
      stack: u.stack,
      ico: u.ico,
      bg: cc.bg,
      portraitUrl: cc.portrait || null,
      dotColor,
      levelLabel: LS[u.lv],
      hpBonus: auraBonus[i] || 0,
    };
  });
  // Dispatch only the changed side. Render() calls renderField twice;
  // the second call merges its update into the first.
  const interactive = isP && G.phase === "shop";
  const hasRoomForBench = G.board.filter(Boolean).length < maxUnits();
  const dropMode = isP && (
    G.fieldSel !== null ||
    G.fieldDrag !== null ||
    (G.bsel !== null && hasRoomForBench)
  );
  if (isP) {
    window.setFieldState?.({
      p: cells,
      interactive,
      fieldSel: G.fieldSel,
      dropMode,
    });
  } else {
    window.setFieldState?.({ e: cells });
  }
}

// ── Field cell event handlers (delegated from BattlePage's JSX) ──────
window.fieldCellClick = function (side, slot) {
  if (side !== "p" || G.phase !== "shop") return;
  if (G._suppressFieldClickUntil && Date.now() < G._suppressFieldClickUntil) return;
  if (G.board[slot]) {
    // Click on occupied: select/deselect/swap field units.
    if (G.fieldSel === slot) {
      G.fieldSel = null;
    } else if (G.fieldSel !== null) {
      const tmp = G.board[G.fieldSel];
      G.board[G.fieldSel] = G.board[slot];
      G.board[slot] = tmp;
      G.fieldSel = null;
    } else {
      if (G.bsel !== null) {
        swapFieldBench(slot, G.bsel);
        return;
      }
      G.fieldSel = slot;
      G.bsel = null;
    }
  } else {
    // Click on empty: move selected field unit, or place selected Barracks unit.
    if (G.fieldSel !== null) {
      G.board[slot] = G.board[G.fieldSel];
      G.board[G.fieldSel] = null;
      G.fieldSel = null;
    } else {
      placeUnit(slot);
    }
  }
  render();
};

window.fieldCellDragStart = function (side, slot, ev) {
  if (side !== "p" || G.phase !== "shop") return;
  window.HFTooltip?.hide();
  ev.dataTransfer.setData("fromSlot", String(slot));
  ev.dataTransfer.effectAllowed = "move";
  G.bsel = null;
  G.fieldSel = null;
  G.fieldDrag = slot;
  clearAttackArrows();
  // Defer the .dragging class so the ghost-image snapshot doesn't include it.
  setTimeout(() => {
    if (G.phase !== "shop" || G.fieldDrag !== slot) return;
    const el = document.querySelector(`#pfield [data-i="${slot}"] .unit`);
    if (el) el.classList.add("dragging");
    document
      .querySelectorAll("#pfield .cell:not(.occ)")
      .forEach((c) => c.classList.add("dr"));
    document
      .querySelector(`#pfield .cell[data-i="${slot}"]`)
      ?.classList.add("dr");
  }, 0);
};

window.fieldCellDragEnd = function (side, slot) {
  const el = document.querySelector(`#pfield [data-i="${slot}"] .unit`);
  if (el) el.classList.remove("dragging");
  G.fieldDrag = null;
  G._suppressFieldClickUntil = Date.now() + 200;
  clearFieldPlacementHints();
  render();
};

window.fieldCellDrop = function (side, slot, ev) {
  if (side !== "p" || G.phase !== "shop") return;
  const fromSlot = ev.dataTransfer.getData("fromSlot");
  const benchCid = ev.dataTransfer.getData("benchCid");
  if (fromSlot !== "") {
    const src = parseInt(fromSlot);
    if (src === slot) {
      G.fieldDrag = null;
      clearFieldPlacementHints();
      render();
      return; // dropped on self — no-op
    }
    if (G.board[slot]) {
      // Swap with occupied target
      const tmp = G.board[src];
      G.board[src] = G.board[slot];
      G.board[slot] = tmp;
    } else {
      // Move into empty cell
      G.board[slot] = G.board[src];
      G.board[src] = null;
    }
    G.fieldDrag = null;
    render();
  } else if (benchCid) {
    placeUnit(slot, benchCid);
    G.bsel = null;
    clearFieldPlacementHints();
    render();
  }
};

// Hover preview: red outline on attack target, orange splash for AOE
// skills (Mage Fireball, Archmage Chain Lightning), green outline on
// adjacent allies for Paladin Sacred Aura. Pure imperative classList
// toggling on the React-rendered cells via data-i lookups.
window.fieldCellMouseEnter = function (side, slot) {
  if (side !== "p") return;
  const u = G.board[slot];
  if (!u) return;
  const enemyBoard = G.phase === "battle" ? G.enemy : G.duelEnemy;
  if (!enemyBoard) return;
  const efieldEl = document.getElementById("efield");
  const pfieldEl = document.getElementById("pfield");
  const unitWithSlot = { ...u, slot };
  const target = previewTarget(unitWithSlot, enemyBoard);
  if (target) {
    efieldEl?.querySelector(`[data-i="${target.slot}"]`)?.classList.add("target-preview");
    if (unitWithSlot.cid === "mage") {
      const adj = adjacentSlots(target.slot);
      enemyBoard.forEach((eu, ei) => {
        if (eu && ei !== target.slot && adj.includes(ei)) {
          efieldEl?.querySelector(`[data-i="${ei}"]`)?.classList.add("target-preview-splash");
        }
      });
    }
    if (unitWithSlot.cid === "archmage") {
      const tRow = Math.floor(target.slot / 3);
      const pCol = target.slot % 3;
      const chain = [];
      enemyBoard.forEach((eu, ei) => {
        if (eu && ei !== target.slot && Math.floor(ei / 3) === tRow && ei % 3 > pCol) chain.push(ei);
      });
      chain.sort((a, b) => (a % 3) - (b % 3)).slice(0, 2).forEach((ei) => {
        efieldEl?.querySelector(`[data-i="${ei}"]`)?.classList.add("target-preview-splash");
      });
    }
  }
  if (unitWithSlot.cid === "paladin") {
    const adj = adjacentSlots(slot);
    G.board.forEach((pu, pi) => {
      if (pu && pi !== slot && adj.includes(pi)) {
        pfieldEl?.querySelector(`[data-i="${pi}"]`)?.classList.add("target-preview-ally");
      }
    });
  }
};

window.fieldCellMouseLeave = function () {
  document.querySelectorAll(".target-preview")
    .forEach((el) => el.classList.remove("target-preview"));
  document.querySelectorAll(".target-preview-splash")
    .forEach((el) => el.classList.remove("target-preview-splash"));
  document.querySelectorAll(".target-preview-ally")
    .forEach((el) => el.classList.remove("target-preview-ally"));
};

window.fieldInfoShow = function (side, slot, anchorEl) {
  const board = side === "p" ? G.board : (G.phase === "battle" ? G.enemy : G.duelEnemy);
  const u = board?.[slot];
  if (u && anchorEl) showHeroInfo(anchorEl, u);
};
window.fieldInfoHide = function () { window.HFTooltip?.hide(); };

// Long-press on a field cell shows a sticky tooltip (mobile).
let _fieldLpTimer = null;
window.fieldTouchStart = function (side, slot, anchorEl) {
  const board = side === "p" ? G.board : (G.phase === "battle" ? G.enemy : G.duelEnemy);
  const u = board?.[slot];
  if (!u || !anchorEl) return;
  clearTimeout(_fieldLpTimer);
  _fieldLpTimer = setTimeout(() => {
    window.HFTooltip?.showSticky(anchorEl, window.HFTooltip.heroInfoHtml(u));
  }, 500);
};
window.fieldTouchEnd = function () { clearTimeout(_fieldLpTimer); };
window.fieldTouchMove = function () { clearTimeout(_fieldLpTimer); };

// ── Shop Rendering (animated with absolute positioning) ──
const SHOP_SLOTS = 5;
function _shopSlotLeft(slotIdx, cardW, gap, containerW) {
  const totalW = SHOP_SLOTS * cardW + (SHOP_SLOTS - 1) * gap;
  const startX = (containerW - totalW) / 2;
  return Math.round(startX + slotIdx * (cardW + gap));
}

// ═══════════════════════════════════════════════════
//  SKILL TOOLTIP (extracted to /js/skill-tooltip.js)
// ═══════════════════════════════════════════════════
// The tooltip module lives in its own file now (window.HFTooltip).
// HFTooltip.init({ getC: () => C }) is called from initGame() once
// C/CK have been populated. Call sites in this file use the public
// API: HFTooltip.show / showSticky / hide / heroInfoHtml /
// skillTooltipHtml / skillTooltipText.


// Phase 3 of #16, second slice: shop is React-rendered.
// Build a render shape (each card's targetLeft, all visual flags) and
// dispatch via window.setShopState. BattlePage owns the DOM and CSS
// transitions on `left` / `border-color` etc. handle the slide
// animation between renders. Card events delegate via the
// window.shopCard* / window.shopInfo* shims defined below.
//
// Two minor UX changes vs the previous imperative version:
//  (1) Bought cards disappear instantly instead of fading up + scaling
//      out (240ms transform/opacity transition is dropped).
//  (2) New cards appear in place rather than sliding in from offscreen.
// Other cards STILL slide smoothly when their `left` value changes
// (CSS transition on `left` is set as part of the inline style).
function renderShop() {
  const active = G.phase === "shop";
  const combos = G.shopCombos || (G.shopCombo ? [G.shopCombo] : []);
  const comboByIdx = {};
  combos.forEach((c) => c.idxs.forEach((i) => (comboByIdx[i] = c)));

  const s =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--s"),
    ) || 1;
  const cardW = Math.round(90 * s);
  const gap = Math.round(6 * s);
  const shopWrapInner = Math.round(500 * s) - Math.round(8 * s) * 2;
  const contW = shopWrapInner;

  const cards = [];
  G.shop.forEach((u, i) => {
    if (!u) return;
    const cc = C[u.cid];
    if (!cc) {
      console.warn(`Invalid character ID: ${u.cid}`);
      return;
    }
    const isOwned =
      G.bench.find((b) => b.cid === u.cid) ||
      G.board.find((b) => b && b.cid === u.cid);
    const isAtMax = !!(isOwned && isOwned.lv >= 5);
    const cost = isOwned ? 2 : HF.value_buy_card;
    const cardCombo = comboByIdx[i] || null;
    const isCombo = !!cardCombo;
    const canBuy =
      !isAtMax && G.gold >= (isCombo ? cardCombo.cost : cost) && active;
    cards.push({
      uid: u.id,
      slotIdx: i,
      cid: u.cid,
      ico: u.ico,
      bg: cc.bg,
      borderCol: isCombo ? "#44ff88" : cc.col,
      portraitUrl: cc.portrait || null,
      isCombo, isAtMax, canBuy,
      // Stable per-render key shared by all cards in the same combo —
      // BattlePage uses it to apply combo-lift on hover.
      comboKey: isCombo ? `combo-${cardCombo.idxs.join("-")}` : null,
      countLabel: isAtMax ? "🏆 MAX" : isOwned ? `🔗${isOwned.stack}/3` : "★",
      countClass: isAtMax ? "cmax" : isOwned ? "ccombo" : "cnew",
      priceLabel: isAtMax ? "MAX" : isCombo ? `${cardCombo.cost}💰` : `${cost}💰`,
      priceClass: isAtMax ? "pmax" : isOwned ? "pcombo" : isCombo ? "pcombo" : "pnew",
      actionLabel: canBuy
        ? isCombo
          ? `⚡ Combo ×${cardCombo.type} for ${cardCombo.cost}💰`
          : isOwned ? `▶ Stack ${cost}💰` : `▶ Recruit ${cost}💰`
        : isAtMax ? "Max Level" : "",
      targetLeft: _shopSlotLeft(i, cardW, gap, contW),
    });
  });

  window.setShopState?.({
    active,
    gold: G.gold,
    rerollDisabled: G.gold < HF.value_new_recruitment || !active,
    cards,
  });
}

// ── Shop card event handlers (called from BattlePage's JSX) ──────────
window.shopCardClick = function (slotIdx) {
  if (G.phase !== "shop") return;
  const combos = G.shopCombos || (G.shopCombo ? [G.shopCombo] : []);
  const combo = combos.find((c) => c.idxs.includes(slotIdx));
  if (combo) buyCombo(combo);
  else buyCard(slotIdx);
};
window.shopInfoShow = function (uid, anchorEl) {
  const u = G.shop.find((x) => x && x.id === uid);
  if (u && anchorEl) showHeroInfo(anchorEl, u);
};
window.shopInfoHide = function () { window.HFTooltip?.hide(); };

// Phase 3 of #16, first slice: bench is React-rendered.
// Build a pure render shape and dispatch — BattlePage owns the DOM.
// Card events delegate back via window.benchCard* / window.benchInfo*
// shims defined below.
function renderBench() {
  const active = G.phase === "shop";
  const cards = G.bench.map((u) => {
    const cc = C[u.cid];
    const isSel = G.bsel === u.cid;
    const isNewRecruit = !!(G._newBenchCids && G._newBenchCids.has(u.cid));
    if (isNewRecruit) G._newBenchCids.delete(u.cid);
    const dotColor =
      u.lv === 1 ? cc.col :
        u.lv === 2 ? "#4488ff" :
          u.lv === 3 ? "#aa44ff" : "#ffaa00";
    return {
      cid: u.cid,
      lv: u.lv,
      stack: u.stack,
      isSel, isNewRecruit,
      bg: cc.bg,
      borderCol: cc.col,
      portraitUrl: cc.portrait || null,
      ico: u.ico,
      dotColor,
      levelLabel: LS[u.lv],
    };
  });
  window.setBenchState?.({
    active,
    count: G.bench.length,
    max: BARRACKS_MAX,
    emptyMessage: G.bench.length ? null : "Barracks empty — buy heroes from Recruitment →",
    cards,
  });
}

// ── Bench card event handlers (called from BattlePage's JSX) ─────────
window.benchCardClick = function (cid) {
  if (G.phase !== "shop") return;
  if (G.fieldSel !== null) {
    swapFieldBench(G.fieldSel, cid);
    return;
  }
  G.bsel = G.bsel === cid ? null : cid;
  render();
};
window.benchCardDragStart = function (cid, ev) {
  if (G.phase !== "shop") return;
  ev.dataTransfer.setData("benchCid", cid);
  ev.dataTransfer.effectAllowed = "move";
  G.bsel = cid;
  // Match the original behaviour: defer the .dragging class so the
  // ghost image snapshot (taken synchronously) doesn't include it.
  setTimeout(() => {
    if (G.phase !== "shop" || G.bsel !== cid) return;
    const card = document.querySelector(`#benchrow .bcard[data-cid="${cid}"]`);
    if (card) card.classList.add("dragging");
    if (G.board.filter(Boolean).length < maxUnits()) {
      document
        .querySelectorAll("#pfield .cell:not(.occ)")
        .forEach((c) => c.classList.add("dr"));
    }
  }, 0);
};
window.benchCardDragEnd = function (cid) {
  const card = document.querySelector(`#benchrow .bcard[data-cid="${cid}"]`);
  if (card) card.classList.remove("dragging");
  G.bsel = null;
  clearFieldPlacementHints();
  render();
};
window.retBench = retBench;
window.benchInfoShow = function (cid, anchorEl) {
  const u = G.bench.find((x) => x && x.cid === cid);
  if (u && anchorEl) showHeroInfo(anchorEl, u);
};
window.benchInfoHide = function () { window.HFTooltip?.hide(); };

function showHeroInfo(anchorEl, unit) {
  const html = window.HFTooltip?.heroInfoHtml?.(unit);
  if (!html) return;
  const sticky = window.matchMedia?.("(pointer: coarse)")?.matches;
  if (sticky && typeof window.HFTooltip?.showSticky === "function") {
    window.HFTooltip.showSticky(anchorEl, html);
    return;
  }
  window.HFTooltip?.show(anchorEl, html);
}

// ✅ FUNÇÃO AUXILIAR para escapar HTML no tooltip
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// updateHdr() refreshes the gold display only — used by call sites that
// mutate G.gold without otherwise re-rendering the shop (e.g. endBattle
// grants between-battle income before the next render() runs).
// setShopState merges, so this doesn't disturb the card list or other
// shop fields.
function updateHdr() { window.setShopState?.({ gold: G.gold }); }

function render() {
  clearAttackArrows();
  renderField("pfield", G.board, true);
  renderField(
    "efield",
    G.phase === "battle" ? G.enemy : G.duelEnemy,
    false,
  );
  renderShop();
  renderBench();
  updateHdr();
  renderDuelBar();
  document.getElementById("bfight").disabled = G.phase !== "shop";
  const n = G.board.filter(Boolean).length,
    mx = maxUnits();
  window.setBattleArmyCount?.(`${n}/${mx}`);
  if (G.phase === "shop") {
    const selUnit = G.bsel ? G.bench.find((u) => u.cid === G.bsel) : null;
    const hint = selUnit
      ? `${selUnit.name} selected — click a field slot or drag to place`
      : G.bench.length
        ? "Click a Barracks card to select, then click a field slot"
        : "Buy heroes from Recruitment, then place them on your field";
    _dispatchBanner(hint, "bshop");
  }
  // ── Mobile sync (runs every render regardless of call site) ──
  const mbb = document.getElementById("mobile-battle-btn");
  if (mbb) mbb.disabled = G.phase !== "shop";
  if (typeof window._mobilePhaseSync === "function") window._mobilePhaseSync(G.phase);
}

window.render = render;

// ── Boot ──
function _bootBattle() {
  initGame(); // async: auto-start happens inside after data loads
  // The header username badge (#h-user) is populated by BattlePage from
  // the React session state — no longer set imperatively here.
}
// If loaded dynamically after DOM is ready (React SPA), fire immediately
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _bootBattle);
} else {
  _bootBattle();
}

// ── Mobile phase navigation ──
// Phase 4 of #16: mobile panel visibility is React-driven. This module
// keeps a `_mobileView` mirror of the React state for callers that need
// to read it (e.g. _mobilePhaseSync below). All panel-visibility class
// toggling on shopwrap/benchwrap/overlays/nav-buttons is gone — JSX
// computes those classes from the same state value.
let _mobileView = null;
// Backwards-compat alias for old code that read `_mobileStep`.
let _mobileStep = null;

function _setMobileView(next) {
  _mobileView = next;
  _mobileStep = next === "recruit" || next === "barracks" ? next : null;
  window.setMobileView?.(next);
}

function setMobileStep(step) {
  // Toggle: clicking the active step closes it.
  const next = step === _mobileView ? null : step;
  _setMobileView(next);
}
window.setMobileStep = setMobileStep;

// Copy entries from #log into #mobile-log-entries when the mobile log
// panel opens. The log itself is still imperatively populated by
// battle.js's log() function — this is a one-shot snapshot per open.
function _syncLogToMobile() {
  const src = document.getElementById("log");
  const dest = document.getElementById("mobile-log-entries");
  if (!src || !dest) return;
  dest.innerHTML = "";
  Array.from(src.children).forEach((el) => {
    if (el.innerHTML.trim() === "&nbsp;" || el.innerHTML.trim() === "") return;
    dest.appendChild(el.cloneNode(true));
  });
  requestAnimationFrame(() => { dest.scrollTop = dest.scrollHeight; });
}

function togglePanel(type) {
  if (type !== "log") return;
  const next = _mobileView === "log" ? null : "log";
  if (next === "log") _syncLogToMobile();
  _setMobileView(next);
}
window.togglePanel = togglePanel;

function toggleMobileMenu() {
  const next = _mobileView === "menu" ? null : "menu";
  if (next === "menu") {
    // Update the fullscreen button label based on current FS state.
    window.setFullscreenBtnText?.(
      document.fullscreenElement || document.webkitFullscreenElement
        ? "Exit Fullscreen"
        : "Enter Fullscreen"
    );
  }
  _setMobileView(next);
}
function openMobileMenu() {
  if (_mobileView !== "menu") toggleMobileMenu();
}
function closeMobileMenu() {
  if (_mobileView === "menu") _setMobileView(null);
}
// window.openHowTo is registered by BattlePage.jsx (Phase 1 of #16);
// the local openHowTo definition that used to live here was a
// duplicate of the one earlier in this file and has been removed.
window.toggleMobileMenu = toggleMobileMenu;
window.openMobileMenu = openMobileMenu;
window.closeMobileMenu = closeMobileMenu;

// ── Fullscreen ───────────────────────────────────────────────
// Migrated to BattlePage.jsx (Phase 4 of #16). The banner visibility,
// localStorage preference, and first-touch auto-enter behaviour all
// live in the React component now. window.toggleFullscreen /
// acceptFullscreen / declineFullscreen are still registered there
// for code that calls them (notably the mobile menu's FS button).

// Comportamentos mobile: auto-open, auto-advance
// _mobilePhaseSync é chamado dentro de render() a cada frame — sem wrapper frágil
(function () {
  let _lastPhase = null;
  window._mobilePhaseSync = function (phase) {
    // Só executa em viewports mobile (checagem em tempo de execução para suportar
    // troca de modo no DevTools sem recarregar a página)
    if (!window.matchMedia("(max-width: 768px)").matches &&
      !window.matchMedia("(pointer: coarse)").matches) return;

    // Transição para combat: fecha painéis (close any open mobile panel)
    if (phase === "combat" && _lastPhase !== "combat") {
      if (_mobileView === "recruit" || _mobileView === "barracks") {
        _setMobileView(null);
      }
    }
    // Transição para shop (nova rodada): sempre abre recruit.
    // Force open by clearing first so setMobileStep's toggle doesn't
    // close it if it happened to already be "recruit".
    if (phase === "shop" && _lastPhase !== "shop") {
      _setMobileView(null);
      setMobileStep("recruit");
    }
    // Auto-avança para barracks quando não tem mais ação de compra possível.
    if (phase === "shop" && _mobileView === "recruit") {
      const gold = G.gold;
      const shop = G.shop ?? [];
      const canBuy = shop.some((c) => {
        if (!c) return false;
        const cost = c.cost != null ? c.cost : cardCost(c.cid);
        return cost <= gold;
      });
      const canReroll = gold > HF.value_new_recruitment;
      if (!canBuy && !canReroll) setMobileStep("barracks");
    }
    _lastPhase = phase;
  };
})();
