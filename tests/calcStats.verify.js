// tests/calcStats.verify.js
// Verificação de paridade: fórmula antiga vs. nova.
// Rode com:  node tests/calcStats.verify.js
import assert from 'assert/strict';

// ── Helpers ──────────────────────────────────────────────────────────────────
function trunc4(v) { return Math.trunc(v * 10000) / 10000; }

// ── Fórmula ANTIGA (referência — deve permanecer intocada aqui) ───────────
function calcStatsOld(base, multiplier) {
  const m = Number(multiplier);
  const str = Number(base.str) * m;
  const dex = Number(base.dex) * m;
  const con = Number(base.con) * m;
  const int = Number(base.int) * m;
  const wis = Number(base.wis) * m;
  const cha = Number(base.cha) * m;
  const attrMap = { str, dex, con, int, wis, cha };
  const primaryVal = attrMap[base.primary_attr];
  return {
    atk:         Math.floor((primaryVal * 5) + Number(base.weapon_bonus)),
    max_hp:      Math.floor((con * 20) + (str * 10) + Number(base.armor_bonus)),
    atk_speed:   (dex * 0.3) + Number(base.spd_offset),
    skill_power: trunc4(Number(base.skill_power) * Number(base.skill_power_multiplier)),
  };
}

// ── Fórmula NOVA (a ser implementada em server.js) ────────────────────────
const HEROIC_SCALE = 10_000;

function calcStatsNew(base, multiplier) {
  const m   = Number(multiplier);
  const str = Number(base.str) * m;
  const dex = Number(base.dex) * m;
  const con = Number(base.con) * m;
  const int = Number(base.int) * m;
  const wis = Number(base.wis) * m;
  const cha = Number(base.cha) * m;
  const attrMap = { str, dex, con, int, wis, cha };
  const p = attrMap[base.primary_attr];
  if (p === undefined)
    throw new Error(`calcStats: invalid primary_attr="${base.primary_attr}"`);
  return {
    atk: Math.floor(
      p * (5 + (p - 5) / HEROIC_SCALE) + Number(base.weapon_bonus)
    ),
    max_hp: Math.floor(
      con * (20 + (con - 5) / HEROIC_SCALE) +
      str * (10 + (str - 5) / HEROIC_SCALE) +
      Number(base.armor_bonus)
    ),
    atk_speed:
      Math.exp(Math.log(dex) + Math.log(0.3)) + Number(base.spd_offset),
    skill_power: trunc4(
      Number(base.skill_power) *
      Number(base.skill_power_multiplier) *
      (1 + Math.log(Number(base.skill_power_multiplier)) / 1_000_000)
    ),
  };
}

// ── Dataset: atributos RPG dos 8 personagens ─────────────────────────────
const CHARS = [
  { cid:'knight',    str:15,dex:10,con:20,int: 7,wis:10,cha:10, primary_attr:'str', weapon_bonus:17,  armor_bonus:142, spd_offset:  0, skill_power:0.30, skill_power_multiplier:1.1 },
  { cid:'paladin',   str:13,dex:10,con:19,int:10,wis:10,cha:10, primary_attr:'str', weapon_bonus:23,  armor_bonus:137, spd_offset:  0, skill_power:0.20, skill_power_multiplier:1.2 },
  { cid:'barbarian', str:20,dex:12,con:15,int: 5,wis: 8,cha:12, primary_attr:'str', weapon_bonus: 0,  armor_bonus:130, spd_offset:  0, skill_power:0.40, skill_power_multiplier:1.1 },
  { cid:'assassin',  str:14,dex:18,con:10,int:10,wis:10,cha:10, primary_attr:'dex', weapon_bonus:42,  armor_bonus: 13, spd_offset:  0, skill_power:0.30, skill_power_multiplier:1.3 },
  { cid:'archer',    str:12,dex:17,con:10,int:10,wis:11,cha:12, primary_attr:'dex', weapon_bonus:20,  armor_bonus: 60, spd_offset:-1.0, skill_power:0.20, skill_power_multiplier:1.2 },
  { cid:'mage',      str: 8,dex:10,con:10,int:20,wis:14,cha:10, primary_attr:'int', weapon_bonus:70,  armor_bonus: 30, spd_offset:-2.1, skill_power:0.50, skill_power_multiplier:1.4 },
  { cid:'archmage',  str: 7,dex:10,con:10,int:20,wis:15,cha:10, primary_attr:'int', weapon_bonus:88,  armor_bonus: 58, spd_offset:-2.1, skill_power:0.60, skill_power_multiplier:1.5 },
  { cid:'healer',    str: 8,dex:10,con: 8,int:18,wis:10,cha:18, primary_attr:'wis', weapon_bonus: 2,  armor_bonus: 39, spd_offset:-1.0, skill_power:1.25, skill_power_multiplier:1.1 },
];

const MULTIPLIERS = [1.0, 1.15, 1.30, 1.45, 1.60];

// ── Execução ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

for (const char of CHARS) {
  for (const m of MULTIPLIERS) {
    const old_ = calcStatsOld(char, m);
    const new_ = calcStatsNew(char, m);

    let ok = true;

    try {
      assert.strictEqual(new_.atk,    old_.atk,    `${char.cid} m=${m} atk`);
      assert.strictEqual(new_.max_hp, old_.max_hp, `${char.cid} m=${m} max_hp`);
    } catch (e) {
      console.error(`FAIL ${e.message}`);
      ok = false;
    }

    try {
      assert.strictEqual(new_.skill_power, old_.skill_power, `${char.cid} m=${m} skill_power`);
    } catch (e) {
      console.error(`FAIL ${e.message}`);
      ok = false;
    }

    const spdDiff = Math.abs(new_.atk_speed - old_.atk_speed);
    if (spdDiff > 1e-10) {
      console.error(`FAIL ${char.cid} m=${m} atk_speed diff=${spdDiff}`);
      ok = false;
    }

    if (ok) {
      console.log(`ok  ${char.cid.padEnd(10)} m=${String(m).padEnd(4)}  atk=${new_.atk}  hp=${new_.max_hp}  spd≈${new_.atk_speed.toFixed(4)}  sp=${new_.skill_power}`);
      passed++;
    } else {
      failed++;
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed (${CHARS.length * MULTIPLIERS.length} total)`);
if (failed > 0) process.exit(1);
