/**
 * simulate.js — Horizon Forge deterministic battle simulation
 *
 * Pure function, zero DOM dependencies.
 * Runs identically on Node.js (server) and browser (via <script>).
 *
 * Usage — Node.js:
 *   import { simulate } from '../shared/simulate.js';
 *
 * Usage — browser:
 *   <script src="/shared/simulate.js"></script>
 *   window.HFSimulate.simulate(playerBoard, enemyBoard)
 *
 * NOTE: Math.random() is used for two tiebreakers (queue order, row-B targeting).
 * The server runs simulate() once and sends the full event log to both clients,
 * who replay the animation — the server result is always authoritative.
 */

"use strict";

// ── Grid helper ────────────────────────────────────────────────────────────────
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

// ── Core simulation ────────────────────────────────────────────────────────────
/**
 * @param {Array} pb  Player board — 9-slot array (null = empty)
 * @param {Array} eb  Enemy board  — 9-slot array (null = empty)
 * @returns {{ evs, winner, umap, stats }}
 *
 * Each unit must have: { id, cid, name, side?, lv, atk, spd, critChance,
 *   critRate, skillPower, maxHp, hp, tp (nearest|ranged|lowhp) }
 */
function simulate(pb, eb) {
  // Deep-clone boards and attach metadata
  const ps = pb
    .map((u, i) =>
      u ? { ...u, slot: i, side: "p", alive: true, enraged: false } : null,
    )
    .filter(Boolean);
  const es = eb
    .map((u, i) =>
      u ? { ...u, slot: i, side: "e", alive: true, enraged: false } : null,
    )
    .filter(Boolean);

  const evs = [];
  let tick = 0;
  let queue = [];

  const foes = (s) => (s === "p" ? es : ps).filter((u) => u.alive);
  const alliesOf = (s) => (s === "p" ? ps : es).filter((u) => u.alive);

  // ── Deal damage ─────────────────────────────────────────────────────────────
  function dealDmg(atk, tgt, d, isCrit = false) {
    let dmg = d;
    if (tgt.cid === "knight") dmg = Math.floor(dmg * (1 - tgt.skillPower));
    tgt.hp = Math.max(0, tgt.hp - dmg);
    if (tgt.hp <= 0) {
      tgt.alive = false;
      evs.push({
        type: "kill",
        uid: atk.id,
        tid: tgt.id,
        amt: dmg,
        isCrit,
        tick,
      });
    } else {
      evs.push({
        type: "atk",
        uid: atk.id,
        tid: tgt.id,
        amt: dmg,
        isCrit,
        tick,
      });
    }
  }

  // ── Start-of-battle abilities ────────────────────────────────────────────────
  // Applies Sacred Aura and Sneak Strike for one side.
  function applyBattleStart(units, foeSide) {
    // Sacred Aura (Paladin) — buff adjacent allies' max HP
    units
      .filter((u) => u.cid === "paladin")
      .forEach((u) => {
        const adj = adjacentSlots(u.slot);
        const bonusMap = {};
        units
          .filter((a) => a.id !== u.id && adj.includes(a.slot))
          .forEach((a) => {
            const b = Math.floor(a.maxHp * u.skillPower);
            a.maxHp += b;
            a.hp += b;
            bonusMap[a.id] = b;
          });
        evs.push({
          type: "ability",
          uid: u.id,
          abilName: "Sacred Aura",
          tick: -1,
          auraBonus: bonusMap,
        });
      });

    // Sneak Strike (Assassin) — instant hit on lowest-HP enemy at battle start
    units
      .filter((u) => u.cid === "assassin")
      .forEach((u) => {
        const targets = foeSide.filter((f) => f.alive);
        if (!targets.length) return;
        const t = [...targets].sort((a, b) => a.hp - b.hp)[0];
        const sneakDmg = Math.floor(u.atk * u.skillPower);

        evs.push({
          type: "ability",
          uid: u.id,
          targetId: t.id,
          abilName: "Sneak Strike",
          amount: sneakDmg,
          tick,
        });

        dealDmg(u, t, sneakDmg, false);
      });
  }

  // Apply for both sides (player first, then enemy — matters for cross-hits)
  applyBattleStart(ps, es);
  applyBattleStart(es, ps);

  // ── Target selection ─────────────────────────────────────────────────────────
  function pickTarget(unit) {
    const f = foes(unit.side);
    if (!f.length) return null;

    const isM = (u) => u.tp !== "ranged";
    const unitRow = Math.floor(unit.slot / 3);

    // Column priority: player attacks enemy col 0→2; enemy attacks player col 2→0
    const colCmp =
      unit.side === "p"
        ? (a, b) => (a.slot % 3) - (b.slot % 3) // ascending (col 0 = enemy front)
        : (a, b) => (b.slot % 3) - (a.slot % 3); // descending (col 2 = player front)

    const bestInRow = (row) => {
      const inRow = f.filter((e) => Math.floor(e.slot / 3) === row);
      if (!inRow.length) return null;
      return inRow.slice().sort((a, b) => {
        const cc = colCmp(a, b);
        if (cc !== 0) return cc;
        return isM(a) === isM(b) ? 0 : isM(a) ? -1 : 1;
      })[0];
    };

    if (unitRow === 0)
      return bestInRow(0) || bestInRow(1) || bestInRow(2) || null;
    if (unitRow === 2)
      return bestInRow(2) || bestInRow(1) || bestInRow(0) || null;
    // Row B: own row first; then A vs C is 50/50
    const t = bestInRow(1);
    if (t) return t;
    const tA = bestInRow(0),
      tC = bestInRow(2);
    if (tA && tC) return Math.random() < 0.5 ? tA : tC;
    return tA || tC || null;
  }

  // ── Turn queue ───────────────────────────────────────────────────────────────
  const isMelee = (u) => u.tp !== "ranged";

  function buildQueue() {
    // Fisher-Yates shuffle first so ties resolve with uniform probability:
    // 2 tied → 50/50, 3 tied → 33.3% each, 4 tied → 25% each.
    // Then a stable sort by speed keeps faster units ahead while preserving
    // the random order within each speed tier.
    const units = [...ps, ...es].filter((u) => u.alive);
    for (let i = units.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [units[i], units[j]] = [units[j], units[i]];
    }
    return units.sort((a, b) => b.spd - a.spd);
  }

  function emitQueue() {
    evs.push({
      type: "queue",
      order: queue.filter((u) => u.alive).map((u) => u.id),
      tick,
    });
  }

  // ── Main loop ────────────────────────────────────────────────────────────────
  let safety = 2000;
  while (safety-- > 0) {
    const pa = ps.filter((u) => u.alive),
      ea = es.filter((u) => u.alive);
    if (!pa.length || !ea.length) break;

    queue = queue.filter((u) => u.alive);
    if (!queue.length) {
      queue = buildQueue();
      if (!queue.length) break;
    }
    emitQueue();
    const unit = queue.shift();
    if (!unit.alive) continue;

    // Fury (Barbarian) — permanent ATK bonus when HP < 60%
    if (
      unit.cid === "barbarian" &&
      !unit.enraged &&
      unit.hp < unit.maxHp * 0.6
    ) {
      unit.enraged = true;
      unit.atk = Math.floor(unit.atk * (1 + unit.skillPower));
      evs.push({ type: "ability", uid: unit.id, abilName: "Fury", tick });
    }

    if (unit.cid === "healer") {
      // Healer — heal lowest-HP ally, then attack
      const al = alliesOf(unit.side).filter(
        (a) => a.id !== unit.id && a.alive && a.hp < a.maxHp,
      );
      if (al.length) {
        const target = [...al].sort(
          (a, b) => a.hp / a.maxHp - b.hp / b.maxHp,
        )[0];
        const h = Math.floor(unit.atk * unit.skillPower);
        target.hp = Math.min(target.maxHp, target.hp + h);
        evs.push({ type: "heal", uid: unit.id, tid: target.id, amt: h, tick });
        evs.push({
          type: "ability",
          uid: unit.id,
          abilName: "Healing",
          tick,
          silent: true,
        });
      }
      const et = pickTarget(unit);
      if (et && et.alive) dealDmg(unit, et, unit.atk);
    } else {
      const t = pickTarget(unit);
      if (t && t.alive) {
        let dmg = unit.atk,
          isCrit = false;

        // Precise Shot (Archer) — extra crit chance
        const effCC =
          unit.critChance + (unit.cid === "archer" ? unit.skillPower : 0);
        if (Math.random() < effCC) {
          isCrit = true;
          dmg = Math.floor(dmg * unit.critRate);
        }
        dealDmg(unit, t, dmg, isCrit);

        if (unit.cid === "archer" && isCrit) {
          evs.push({
            type: "ability",
            uid: unit.id,
            abilName: "Precise Shot",
            tick,
            silent: true,
          });
        }

        // Fireball (Mage) — splash to adjacent tiles (+shape)
        if (unit.cid === "mage") {
          const adj = adjacentSlots(t.slot);
          const splash = foes(unit.side).filter(
            (f) => f.id !== t.id && f.alive && adj.includes(f.slot),
          );
          if (splash.length) {
            splash.forEach((f) =>
              dealDmg(unit, f, Math.floor(unit.atk * unit.skillPower)),
            );
            evs.push({
              type: "ability",
              uid: unit.id,
              abilName: "Fireball",
              tick,
              silent: true,
            });
          }
        }

        // Chain Lightning (Archmage) — hits 2nd and 3rd unit in same row
        if (unit.cid === "archmage") {
          const targetRow = Math.floor(t.slot / 3);
          const primaryCol = t.slot % 3;
          const goDeeper =
            unit.side === "p"
              ? (f) => f.slot % 3 > primaryCol
              : (f) => f.slot % 3 < primaryCol;
          const chain = foes(unit.side)
            .filter(
              (f) =>
                f.id !== t.id &&
                f.alive &&
                Math.floor(f.slot / 3) === targetRow &&
                goDeeper(f),
            )
            .sort((a, b) =>
              unit.side === "p"
                ? (a.slot % 3) - (b.slot % 3)
                : (b.slot % 3) - (a.slot % 3),
            );
          if (chain.length > 0)
            dealDmg(unit, chain[0], Math.floor(unit.atk * unit.skillPower));
          if (chain.length > 1)
            dealDmg(
              unit,
              chain[1],
              Math.floor((unit.atk * unit.skillPower) / 2),
            );
        }
      }
    }

    if (unit.alive) queue.push(unit);
    tick++;
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  const pa = ps.filter((u) => u.alive),
    ea = es.filter((u) => u.alive);
  let winner;
  if (pa.length && !ea.length) winner = "p";
  else if (ea.length && !pa.length) winner = "e";
  else {
    const ph = pa.reduce((s, u) => s + u.hp, 0);
    const eh = ea.reduce((s, u) => s + u.hp, 0);
    winner = ph >= eh ? "p" : "e";
  }

  let dmgP = 0,
    dmgE = 0,
    killsP = 0,
    killsE = 0;
  evs
    .filter((e) => e.tick >= 0 && (e.type === "atk" || e.type === "kill"))
    .forEach((e) => {
      const u = [...ps, ...es].find((x) => x.id === e.uid);
      if (!u) return;
      if (u.side === "p") {
        dmgP += e.amt;
        if (e.type === "kill") killsP++;
      } else {
        dmgE += e.amt;
        if (e.type === "kill") killsE++;
      }
    });

  const umap = {};
  [...ps, ...es].forEach((u) => (umap[u.id] = u));

  return {
    evs,
    winner, // 'p' | 'e'
    umap,
    stats: { dmgP, dmgE, killsP, killsE, survP: pa.length, survE: ea.length },
  };
}

// ── Universal export ──────────────────────────────────────────────────────────
// Node.js ESM  → import { simulate } from '../shared/simulate.js'
// Browser      → <script type="module"> import { simulate } from '/shared/simulate.js'
//                OR loaded via /shared/simulate.js as module script
export { simulate, adjacentSlots };
