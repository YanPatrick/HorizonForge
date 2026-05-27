// public/js/bot-ai.js — Horizon Forge AI opponent
//
// Self-contained bot module, exposed as window.HFBot. Loaded by BattlePage.jsx
// before /js/battle.js (load order matters — battle.js calls into HFBot).
//
// Dependencies (character data, unit factories, config) are injected via
// `HFBot.init(deps)` once battle.js has finished loading game data. Every
// method below assumes init has been called; calling earlier throws.
//
// API surface used by battle.js:
//   HFBot.init(deps)                   one-time setup, called from initGame()
//   HFBot.initDuel()                   reset BOT state at start of a new duel
//   HFBot.runTurn()                    do shop+buy+position for the upcoming round
//   HFBot.nextBattle(playerWon)        roll over BOT state between battles
//   HFBot.learnFromBattle(evs, umap)   update threat map from the round's events
//   HFBot.getBoard()                   return BOT's current 9-slot board
//
// Deps shape:
//   { C, CK, mkUnit, upgradeUnit, randCid, START_GOLD, BENCH_SLOTS, getHF }
// (getHF returns the live HF config object, since it's mutated after API load.)

(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  // difficulty: "easy" | "medium" | "hard"
  const BOT_DIFFICULTY = "hard";
  const BOT_CFG_TABLE = {
    easy:   { mergeWeight: 0.7,  adaptRate: 0.4, mistakeRate: 0.22, maxRerolls: 1 },
    medium: { mergeWeight: 0.88, adaptRate: 0.7, mistakeRate: 0.08, maxRerolls: 2 },
    hard:   { mergeWeight: 1.1,  adaptRate: 1.0, mistakeRate: 0.0,  maxRerolls: 4 },
  };
  const BOT_CFG = { label: "🤖 AI", ...BOT_CFG_TABLE[BOT_DIFFICULTY] };

  const FRONT_SLOTS = [2, 5, 8, 1, 4, 7],
        MID_SLOTS   = [1, 4, 7],
        BACK_SLOTS  = [0, 3, 6];

  const ROLE_SLOT = {
    Tank:     FRONT_SLOTS,
    Paladin:  FRONT_SLOTS,
    Assassin: MID_SLOTS,
    Support:  MID_SLOTS,
    Mage:     BACK_SLOTS,
    Archmage: BACK_SLOTS,
    Shooter:  BACK_SLOTS,
  };
  // Bot uses inverted columns: col 0 = closest to player (bot's front), col 2 = bot's back
  const BOT_ROLE_SLOT = {
    Tank:     BACK_SLOTS,
    Paladin:  BACK_SLOTS,
    Assassin: MID_SLOTS,
    Support:  MID_SLOTS,
    Mage:     FRONT_SLOTS,
    Archmage: FRONT_SLOTS,
    Shooter:  FRONT_SLOTS,
  };
  const UNIT_SCORE = {
    knight: 6, paladin: 7, barbarian: 6, healer: 8,
    assassin: 9, archer: 7, mage: 8, archmage: 10,
  };
  // ── State ─────────────────────────────────────────────────────────────────
  let BOT = makeInitialBOT();

  function makeInitialBOT() {
    return {
      gold: 7,
      bench: [],
      board: Array(9).fill(null),
      shop: [],
      lastResult: null,
      battleNum: 1,
      threatMap: {},
    };
  }

  // ── Dependencies ──────────────────────────────────────────────────────────
  let _deps = null;
  function deps() {
    if (!_deps) throw new Error("HFBot.init() must be called before any other HFBot method");
    return _deps;
  }
  function init(injected) {
    _deps = injected;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function botCardCost(cid) {
    return BOT.bench.some((u) => u.cid === cid) ||
           BOT.board.some((u) => u && u.cid === cid)
      ? 2
      : 3;
  }

  function botApplyMerge(u) {
    const before = u.lv;
    while ((u.stack || 1) >= 3 && u.lv < 5) {
      u.stack -= 2;
      u.lv++;
      deps().upgradeUnit(u);
      BOT.threatMap[u.cid] = (BOT.threatMap[u.cid] || 0) + 1;
    }
    return u.lv > before;
  }

  function botGenShop() {
    const { mkUnit, randCid } = deps();
    BOT.shop = Array.from({ length: 5 }, () => mkUnit(randCid(), 1));
  }

  function botScoreCard(cid) {
    const ownsExisting =
      BOT.bench.find((u) => u.cid === cid) ||
      BOT.board.find((u) => u && u.cid === cid);

    let score = (UNIT_SCORE[cid] || 5);

    const topThreats = Object.keys(BOT.threatMap)
      .sort((a, b) => BOT.threatMap[b] - BOT.threatMap[a])
      .slice(0, 2);

    if (topThreats.includes(cid)) score *= 1 + (BOT_CFG.adaptRate * 0.45);

    if (ownsExisting) {
      const stack = (ownsExisting.stack || 1);
      score *= 1 + ((stack / 3) * BOT_CFG.mergeWeight);
      // Bonus if we'd actually trigger a merge with this buy
      if (stack === 2) score *= 1 + (BOT_CFG.mergeWeight * 0.5);
      // Tier-up potential — higher current level = more valuable to keep stacking
      score *= (deps().levelMultipliers?.[ownsExisting.lv] || 1);
    }
    if (BOT_CFG.mistakeRate && Math.random() < BOT_CFG.mistakeRate) score *= 0.6;
    return score;
  }

  function botBuyPhase() {
    const REROLL_COST = deps().getHF().value_new_recruitment;
    const COLLECTION_MAX = deps().BENCH_SLOTS() * 2;

    function buyBest() {
      if (BOT.bench.length >= COLLECTION_MAX) return false;
      const candidates = BOT.shop
        .map((card, i) =>
          card
            ? {
                i,
                cid: card.cid,
                cost: botCardCost(card.cid),
                score: botScoreCard(card.cid),
              }
            : null
        )
        .filter((c) => c && BOT.gold >= c.cost)
        .sort((a, b) => b.score / b.cost - a.score / a.cost);
      if (!candidates.length) return false;
      const pick = candidates[0];
      BOT.gold -= pick.cost;
      BOT.shop[pick.i] = null;
      const existing = BOT.bench.find((u) => u.cid === pick.cid);
      if (existing) {
        existing.stack = (existing.stack || 1) + 1;
        botApplyMerge(existing);
      } else {
        const nu = deps().mkUnit(pick.cid, 1);
        nu.stack = 1;
        BOT.bench.push(nu);
      }
      return true;
    }

    let rerolls = 0;
    while (true) {
      while (buyBest()) { /* keep buying while affordable */ }
      // Reroll if we still have gold and haven't hit reroll cap
      if (
        rerolls >= BOT_CFG.maxRerolls ||
        BOT.gold < REROLL_COST + 2 ||
        BOT.bench.length >= COLLECTION_MAX
      ) break;
      const hasMerge = BOT.shop.some(
        (s) => s && BOT.bench.some((u) => u.cid === s.cid)
      );
      if (hasMerge) break; // good shop — don't reroll past existing stack
      BOT.gold -= REROLL_COST;
      rerolls++;
      botGenShop();
    }
  }

  function botPosition() {
    BOT.board = Array(9).fill(null);
    const { C } = deps();
    const pool = [...BOT.bench].sort(
      (a, b) => (UNIT_SCORE[b.cid] || 0) - (UNIT_SCORE[a.cid] || 0)
    );
    const used = new Set();
    pool.forEach((u) => {
      const role = C[u.cid]?.role || "Tank";
      const slots = BOT_ROLE_SLOT[role] || FRONT_SLOTS;
      for (const s of slots) {
        if (!BOT.board[s]) {
          BOT.board[s] = { ...u };
          used.add(u.cid);
          return;
        }
      }
      // Fallback: any open slot
      for (let s = 0; s < 9; s++) {
        if (!BOT.board[s]) {
          BOT.board[s] = { ...u };
          used.add(u.cid);
          return;
        }
      }
    });
    BOT.bench = BOT.bench.filter((u) => !used.has(u.cid));
  }

  function botNextBattle(playerWon) {
    BOT.lastResult = playerWon ? "loss" : "win";
    BOT.battleNum++;
    const inc = 5; // matches betweenIncome on player side
    BOT.gold += inc;
    BOT.board.forEach((u) => {
      if (!u) return;
      const ex = BOT.bench.find((b) => b.cid === u.cid);
      if (ex) {
        ex.stack = (ex.stack || 1) + 1;
        botApplyMerge(ex);
      } else if (BOT.bench.length < deps().BENCH_SLOTS()) BOT.bench.push({ ...u });
    });
    BOT.board = Array(9).fill(null);
  }

  function botLearnFromBattle(evs, umap) {
    evs
      .filter((e) => (e.type === "atk" || e.type === "kill") && e.amt)
      .forEach((ev) => {
        const attacker = umap[ev.uid];
        if (attacker && attacker.side === "e") {
          BOT.threatMap[attacker.cid] =
            (BOT.threatMap[attacker.cid] || 0) + ev.amt;
        }
      });
  }

  function botRunTurn() {
    botGenShop();
    botBuyPhase();
    botPosition();
  }

  function botInitDuel() {
    BOT = makeInitialBOT();
    BOT.gold = deps().START_GOLD();
    botRunTurn();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.HFBot = {
    init,
    initDuel: botInitDuel,
    runTurn: botRunTurn,
    nextBattle: botNextBattle,
    learnFromBattle: botLearnFromBattle,
    getBoard: () => BOT.board,
  };
})();
