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

// ── d20 combat system ─────────────────────────────────────────────────────────
// Iniciativa: início de cada round, todos os vivos rolam D20 + initiative (spd_offset).
//   Ordem de ataque: maior resultado age primeiro. Cada herói age uma vez por round.
//
// Ataque físico: D20 puro determina evento especial, depois cheque de evasão flat %.
//   Natural 20 → crítico (1.5× dano, ignora evasão e armadura)
//   Natural  1 → fumble (0 dano)
//   2–19      → cheque de evasão do defensor → acerto normal ou esquiva
//
// Ataque mágico (mage, archmage): sempre acerta, reduzido por WIS × 0.5 do defensor.

function roll(sides) { return Math.floor(Math.random() * sides) + 1; }

// Ataque físico — usa evasion flat % do defensor.
// Returns { hit, crit, evaded, damage, armorAbs }.
function resolvePhysicalAttack(attacker, defender, baseAtk) {
  const rawRoll = roll(20);

  // Natural 20 — crítico: 1.5× dano, ignora evasão e armadura
  if (rawRoll === 20) {
    return { hit: true, crit: true, evaded: false,
             damage: Math.floor(baseAtk * 1.5), armorAbs: 0 };
  }

  // Natural 1 — fumble: zero dano
  if (rawRoll === 1) {
    return { hit: false, crit: false, evaded: false, damage: 0, armorAbs: 0 };
  }

  // Cheque de evasão flat (baseado no DEX base do defensor, máx 5% sem itens)
  if (Math.random() < (defender.evasion || 0)) {
    return { hit: false, crit: false, evaded: true, damage: 0, armorAbs: 0 };
  }

  // Acerto normal — armadura reduz dano (mínimo 10% do ATK base)
  const armor    = defender.armor || 0;
  const danoFinal = Math.max(baseAtk - armor, baseAtk * 0.1);
  const armorAbs  = baseAtk - Math.floor(danoFinal);
  return { hit: true, crit: false, evaded: false,
           damage: Math.floor(danoFinal), armorAbs };
}

function resolveMagicAttack(defender, baseDamage) {
  // Magia sempre acerta; WIS do defensor absorve parte do dano
  const absorbed = (defender.wis || 0) * 0.5;
  return { damage: Math.max(0, baseDamage - absorbed) };
}

const MAGIC_ATTACKERS = new Set(['mage', 'archmage']);

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
 * Each unit must have: { id, cid, name, side?, lv, atk, initiative, critChance,
 *   critRate, skillPower, maxHp, hp, tp (nearest|ranged|lowhp), dex, wis, evasion,
 *   armor? (0 se não equipado — itens definem este valor) }
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

  const foes = (s) => (s === "p" ? es : ps).filter((u) => u.alive);
  const alliesOf = (s) => (s === "p" ? ps : es).filter((u) => u.alive);

  // ── Deal damage ─────────────────────────────────────────────────────────────
  // extra: { glancing, armorAbs } for physical attacks — forwarded to the event
  // so the playback layer can show distinct floating texts.
  function dealDmg(atk, tgt, d, isCrit = false, extra = {}) {
    let dmg = d;
    // Knight Iron Defense: skillPower% damage reduction. Clamp at 0 so a
    // future balance change with skillPower > 1 can't heal Knight on hit.
    if (tgt.cid === "knight") dmg = Math.floor(dmg * Math.max(0, 1 - tgt.skillPower));
    tgt.hp = Math.max(0, tgt.hp - dmg);
    if (tgt.hp <= 0) {
      tgt.alive = false;
      evs.push({
        type: "kill",
        uid: atk.id,
        tid: tgt.id,
        amt: dmg,
        isCrit,
        ...extra,
        tick,
      });
    } else {
      evs.push({
        type: "atk",
        uid: atk.id,
        tid: tgt.id,
        amt: dmg,
        isCrit,
        ...extra,
        tick,
      });
    }
  }

  // ── Start-of-battle abilities ────────────────────────────────────────────────
  // Sacred Aura (Paladin) — buff adjacent allies' max HP. Aura only touches
  // own-side units, so the order between sides doesn't matter for fairness.
  function applyAura(units) {
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
  }

  // Sneak Strike (Assassin) — instant hit on lowest-HP enemy at battle start.
  // Targets are picked simultaneously on the pre-strike state so neither side
  // gets the "kill the enemy assassin first" advantage in a mirror match;
  // damage is then applied in a randomized order.
  function applySneakStrikesFairly(sideA, sideB) {
    const strikes = [];
    const collect = (attackers, defenders) => {
      attackers
        .filter((u) => u.cid === "assassin")
        .forEach((u) => {
          const targets = defenders.filter((f) => f.alive);
          if (!targets.length) return;
          const t = [...targets].sort((a, b) => a.hp - b.hp)[0];
          const dmg = Math.floor(u.atk * u.skillPower);
          strikes.push({ u, t, dmg });
        });
    };
    collect(sideA, sideB);
    collect(sideB, sideA);
    // Fisher-Yates shuffle for fair resolution order
    for (let i = strikes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [strikes[i], strikes[j]] = [strikes[j], strikes[i]];
    }
    strikes.forEach(({ u, t, dmg }) => {
      evs.push({
        type: "ability",
        uid: u.id,
        targetId: t.id,
        abilName: "Sneak Strike",
        amount: dmg,
        tick,
      });
      dealDmg(u, t, dmg, false);
    });
  }

  applyAura(ps);
  applyAura(es);
  applySneakStrikesFairly(ps, es);

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

  // ── Iniciativa — fila por round ──────────────────────────────────────────────
  // Cada round: todos os vivos rolam D20 + initiative (spd_offset).
  // Maior resultado age primeiro. Após agir, espera o próximo round.
  // Empates: resolvidos pelo shuffle aleatório anterior ao sort.
  function buildInitiativeQueue() {
    const units = [...ps, ...es].filter((u) => u.alive);
    // Fisher-Yates shuffle para resolver empates de forma justa
    for (let i = units.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [units[i], units[j]] = [units[j], units[i]];
    }
    return units
      .map((u) => ({ unit: u, rolled: roll(20) + (u.initiative || 0) }))
      .sort((a, b) => b.rolled - a.rolled)
      .map((r) => r.unit);
  }

  // ── Main loop — round-based ───────────────────────────────────────────────────
  let round = 0;
  const MAX_ROUNDS = 500;

  while (round++ < MAX_ROUNDS) {
    const pa = ps.filter((u) => u.alive),
      ea = es.filter((u) => u.alive);
    if (!pa.length || !ea.length) break;

    // Rola iniciativa para este round
    const roundQueue = buildInitiativeQueue();

    for (let qi = 0; qi < roundQueue.length; qi++) {
      const unit = roundQueue[qi];
      if (!unit.alive) continue;

      // Se um lado foi eliminado durante este round, para imediatamente.
      // Sem este check, os heróis sobreviventes continuariam emitindo "queue"
      // events (sem atacar ninguém) → painel gira depois da batalha terminar.
      if (!ps.some((u) => u.alive) || !es.some((u) => u.alive)) break;

      // Fila circular: herói atual no topo, os que ainda não agiram neste round
      // em seguida, os que já agiram (vivos) atrás — lista sempre completa.
      // renderTurnPanel detecta _tpPrev[0] !== newOrder[0] → anima saída do
      // topo anterior e entrada do mesmo herói no final (tp-enter), sem sumir.
      // A lista só diminui quando um herói morre.
      const afterCurrent  = roundQueue.slice(qi + 1).filter((u) => u.alive).map((u) => u.id);
      const beforeCurrent = roundQueue.slice(0, qi).filter((u) => u.alive).map((u) => u.id);
      evs.push({ type: "queue", order: [unit.id, ...afterCurrent, ...beforeCurrent], tick });

      // Fury (Barbarian) — bônus de ATK permanente quando HP < 60%
      if (unit.cid === "barbarian" && !unit.enraged && unit.hp < unit.maxHp * 0.6) {
        unit.enraged = true;
        unit.atk = Math.floor(unit.atk * (1 + unit.skillPower));
        evs.push({ type: "ability", uid: unit.id, abilName: "Fury", tick });
      }

      if (unit.cid === "healer") {
        // Healer — cura aliado com menor HP%, depois ataca
        const al = alliesOf(unit.side).filter(
          (a) => a.id !== unit.id && a.alive && a.hp < a.maxHp,
        );
        if (al.length) {
          const target = [...al].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          const h = Math.floor(target.maxHp * unit.skillPower);
          target.hp = Math.min(target.maxHp, target.hp + h);
          evs.push({ type: "heal", uid: unit.id, tid: target.id, amt: h, tick });
          evs.push({ type: "ability", uid: unit.id, abilName: "Healing", tick, silent: true });
        }
        const et = pickTarget(unit);
        if (et && et.alive) {
          const res = resolvePhysicalAttack(unit, et, unit.atk);
          if (!res.hit && !res.evaded) evs.push({ type: "miss", uid: unit.id, tid: et.id, tick });
          if (res.evaded)              evs.push({ type: "evade", uid: unit.id, tid: et.id, tick });
          if (res.damage > 0) dealDmg(unit, et, res.damage, res.crit, { armorAbs: res.armorAbs || 0 });
        }
      } else {
        const t = pickTarget(unit);
        if (t && t.alive) {
          let isCrit = false;
          let finalDmg = 0;
          let physExtra = {};

          if (MAGIC_ATTACKERS.has(unit.cid)) {
            // Ataque mágico: sempre acerta, absorvido por WIS do defensor
            const res = resolveMagicAttack(t, unit.atk);
            finalDmg = Math.floor(res.damage);
          } else {
            // Ataque físico: D20, evasão flat %, armadura
            const res = resolvePhysicalAttack(unit, t, unit.atk);
            isCrit    = res.crit;
            finalDmg  = res.damage;
            physExtra = { armorAbs: res.armorAbs || 0 };

            if (!res.hit && !res.evaded) evs.push({ type: "miss",  uid: unit.id, tid: t.id, tick });
            if (res.evaded)              evs.push({ type: "evade", uid: unit.id, tid: t.id, tick });

            // Precise Shot (Archer) — chance de crítico bônus em acertos físicos
            if (unit.cid === "archer" && res.hit && !res.crit) {
              const effCC = unit.critChance + unit.skillPower;
              if (Math.random() < effCC) {
                isCrit   = true;
                finalDmg = Math.floor(unit.atk * unit.critRate);
              }
            }
          }

          if (finalDmg > 0) dealDmg(unit, t, finalDmg, isCrit, physExtra);

          if (unit.cid === "archer" && isCrit) {
            evs.push({ type: "ability", uid: unit.id, abilName: "Precise Shot", tick, silent: true });
          }

          // Fireball (Mage) — splash mágico em alvos adjacentes (+shape)
          if (unit.cid === "mage") {
            const adj = adjacentSlots(t.slot);
            const splash = foes(unit.side).filter(
              (f) => f.id !== t.id && f.alive && adj.includes(f.slot),
            );
            if (splash.length) {
              splash.forEach((f) => {
                const res = resolveMagicAttack(f, Math.floor(unit.atk * unit.skillPower));
                if (res.damage > 0) dealDmg(unit, f, Math.floor(res.damage), false);
              });
              evs.push({ type: "ability", uid: unit.id, abilName: "Fireball", tick, silent: true });
            }
          }

          // Chain Lightning (Archmage) — mágico, atinge 2º e 3º da mesma fileira
          if (unit.cid === "archmage") {
            const targetRow  = Math.floor(t.slot / 3);
            const primaryCol = t.slot % 3;
            const goDeeper   =
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
            if (chain.length > 0) {
              const r0 = resolveMagicAttack(chain[0], Math.floor(unit.atk * unit.skillPower));
              if (r0.damage > 0) dealDmg(unit, chain[0], Math.floor(r0.damage), false);
            }
            if (chain.length > 1) {
              const r1 = resolveMagicAttack(chain[1], Math.floor((unit.atk * unit.skillPower) / 2));
              if (r1.damage > 0) dealDmg(unit, chain[1], Math.floor(r1.damage), false);
            }
          }
        }
      }

      tick++;
    } // fim do for (roundQueue)
  } // fim do while (rounds)

  // ── Result ───────────────────────────────────────────────────────────────────
  const pa = ps.filter((u) => u.alive),
    ea = es.filter((u) => u.alive);
  let winner;
  if (pa.length && !ea.length) winner = "p";
  else if (ea.length && !pa.length) winner = "e";
  else {
    // Both sides survived (safety break or simultaneous wipe).
    // Fair tiebreaker: more survivors → more total HP → coin flip.
    // Previous logic defaulted to "p" on perfect tie, which gave p1 a free
    // win on every dead-equal stalemate in PvP.
    if (pa.length !== ea.length) {
      winner = pa.length > ea.length ? "p" : "e";
    } else {
      const ph = pa.reduce((s, u) => s + u.hp, 0);
      const eh = ea.reduce((s, u) => s + u.hp, 0);
      if (ph !== eh) winner = ph > eh ? "p" : "e";
      else winner = Math.random() < 0.5 ? "p" : "e";
    }
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
// Browser ESM  → import { simulate } from '/shared/simulate.js'
// Browser side-effect load (classic-script consumers like public/js/battle.js):
//   <script type="module" src="/shared/simulate.js"></script>
//   then read window.HFSimulate.simulate
export { simulate, adjacentSlots };

if (typeof window !== "undefined") {
  window.HFSimulate = { simulate, adjacentSlots };
}
