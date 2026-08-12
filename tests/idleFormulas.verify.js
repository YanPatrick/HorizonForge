// tests/idleFormulas.verify.js
// Verifica as fórmulas puras do Idle Dungeon (hero level curve, damage, drop table).
// rollIdleDrop é probabilístico — verificado por distribuição aproximada, não valor exato.
// Rode com: node tests/idleFormulas.verify.js
import assert from 'assert/strict';

const IDLE_CONFIG = {
  DROP_CHANCE_NONE: 0.30,
  DROP_CHANCE_COIN: 0.60,
  DROP_CHANCE_FRAGMENT: 0.099,
  DROP_CHANCE_DIAMOND: 0.001,
  TIER_SLOTS: ['weapon', 'helm', 'legs', 'boots', 'gloves', 'ring1'],
};

const IDLE_HERO_BASE = { maxHp: 140, atk: 14, def: 7 };
const IDLE_HERO_GROWTH_PER_LEVEL = { hp: 10, atk: 2, def: 1 };
const IDLE_HERO_ATTACK_MS = 1600;
const IDLE_XP_BASE = 100;
const IDLE_XP_GROWTH = 1.5;

function idleHeroStatsForLevel(level, gearBonus = { atk: 0, hp: 0, dps: 0 }) {
  const extra = Math.max(1, Number(level) || 1) - 1;
  return {
    maxHp: IDLE_HERO_BASE.maxHp + extra * IDLE_HERO_GROWTH_PER_LEVEL.hp + gearBonus.hp,
    atk:   IDLE_HERO_BASE.atk + extra * IDLE_HERO_GROWTH_PER_LEVEL.atk + gearBonus.atk,
    def:   IDLE_HERO_BASE.def + extra * IDLE_HERO_GROWTH_PER_LEVEL.def,
    attackMs: Math.max(400, IDLE_HERO_ATTACK_MS - gearBonus.dps * 20),
  };
}

const IDLE_RECIPES = {
  weapon: { coinCost: 100, atk: 18, hp: 0, dps: 0 },
  boots:  { coinCost: 100, atk: 0,  hp: 40, dps: 8 },
};
const IDLE_ITEM_MAX_PLUS = 10;
const IDLE_ITEM_GROWTH_PER_PLUS = 0.15;

function idleItemStatsAtPlus(slotType, plusLevel) {
  const base = IDLE_RECIPES[slotType];
  const mult = 1 + Number(plusLevel) * IDLE_ITEM_GROWTH_PER_PLUS;
  return { atk: Math.round(base.atk * mult), hp: Math.round(base.hp * mult), dps: Math.round(base.dps * mult) };
}

function idleItemSellPrice(slotType, plusLevel) {
  const base = IDLE_RECIPES[slotType];
  return Math.round(base.coinCost * (1.5 + Number(plusLevel) * 0.5));
}

function idleXpToNextLevel(level) {
  return Math.ceil(IDLE_XP_BASE * Math.pow(IDLE_XP_GROWTH, Math.max(1, Number(level) || 1) - 1));
}

function idleDamage(atk, def) {
  return Math.max(1, Math.round(atk - def));
}

function rollIdleDrop(rng) {
  const r = rng();
  const slotType = IDLE_CONFIG.TIER_SLOTS[Math.floor(rng() * IDLE_CONFIG.TIER_SLOTS.length)];
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND) return { type: 'diamond', qty: 1 };
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT) return { type: 'fragment', qty: 1, slotType };
  if (r < IDLE_CONFIG.DROP_CHANCE_DIAMOND + IDLE_CONFIG.DROP_CHANCE_FRAGMENT + IDLE_CONFIG.DROP_CHANCE_COIN) return { type: 'coin', qty: 1 };
  return { type: 'none', qty: 0 };
}

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`ok  ${label}`); }
  else { failed++; console.error(`FAIL ${label}`); }
}

// idleHeroStatsForLevel
check('idleHeroStatsForLevel(1) === base (+40% pass, 2026-08-07)', idleHeroStatsForLevel(1).maxHp === 140 && idleHeroStatsForLevel(1).atk === 14 && idleHeroStatsForLevel(1).def === 7);
check('idleHeroStatsForLevel(3) grows linearly', idleHeroStatsForLevel(3).maxHp === 160 && idleHeroStatsForLevel(3).atk === 18 && idleHeroStatsForLevel(3).def === 9);
check('idleHeroStatsForLevel default attackMs === 1600', idleHeroStatsForLevel(1).attackMs === 1600);

// gear bonus — atk/hp add flat, dps shortens attack interval (floored at 400ms)
check('gearBonus adds atk/hp', idleHeroStatsForLevel(1, { atk: 20, hp: 90, dps: 0 }).atk === 34 && idleHeroStatsForLevel(1, { atk: 20, hp: 90, dps: 0 }).maxHp === 230);
check('gearBonus dps shortens attackMs by 20ms/point', idleHeroStatsForLevel(1, { atk: 0, hp: 0, dps: 8 }).attackMs === 1600 - 8 * 20);
check('gearBonus dps floors attackMs at 400ms', idleHeroStatsForLevel(1, { atk: 0, hp: 0, dps: 999 }).attackMs === 400);

// item evolution — +15% stats per plus level, sell price always above craft cost
check('idleItemStatsAtPlus(weapon, 0) === base atk 18', idleItemStatsAtPlus('weapon', 0).atk === 18);
check('idleItemStatsAtPlus(weapon, 1) === +15%', idleItemStatsAtPlus('weapon', 1).atk === Math.round(18 * 1.15));
check('idleItemStatsAtPlus(boots, 10) dps scales', idleItemStatsAtPlus('boots', 10).dps === Math.round(8 * 2.5));
check('idleItemSellPrice(weapon, 0) === 150 > craft cost 100', idleItemSellPrice('weapon', 0) === 150 && idleItemSellPrice('weapon', 0) > IDLE_RECIPES.weapon.coinCost);
check('idleItemSellPrice increases with plus level', idleItemSellPrice('weapon', 5) > idleItemSellPrice('weapon', 0));

// idleXpToNextLevel — geometric curve, each level costs 1.5x the previous
check('idleXpToNextLevel(1) === 100', idleXpToNextLevel(1) === 100);
check('idleXpToNextLevel(2) === 150', idleXpToNextLevel(2) === 150);
check('idleXpToNextLevel(3) === 225', idleXpToNextLevel(3) === 225);

// idleDamage — never drops below 1 even when def >= atk
check('idleDamage(10, 5) === 5', idleDamage(10, 5) === 5);
check('idleDamage(10, 15) === 1 (floored at 1, never 0 or negative)', idleDamage(10, 15) === 1);

// rollIdleDrop — distribution sanity over a large deterministic sample
{
  let seed = 42;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const counts = { none: 0, coin: 0, fragment: 0, diamond: 0 };
  const N = 20000;
  for (let i = 0; i < N; i++) counts[rollIdleDrop(rng).type]++;
  const noneRatio = counts.none / N;
  check(`drop distribution: none ratio ≈0.30 (got ${noneRatio.toFixed(3)})`, Math.abs(noneRatio - 0.30) < 0.03);
  check('drop distribution: diamond rarest', counts.diamond < counts.fragment && counts.fragment < counts.coin);
}

check('TIER_SLOTS[1] === "helm"', IDLE_CONFIG.TIER_SLOTS[1] === 'helm');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
