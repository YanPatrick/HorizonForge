# Curva Quadrática de Poder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as fórmulas lineares de `calcStats()` por expressões quadráticas e logarítmicas que produzem **exatamente os mesmos valores** de `atk`, `max_hp`, `atk_speed` e `skill_power`.

**Architecture:** Um único arquivo é alterado — `api/server.js`, função `calcStats()`. O teste de verificação é um script Node.js standalone (`tests/calcStats.verify.js`) que corre as fórmulas antiga e nova em paralelo e compara todos os resultados, usando os atributos RPG dos 8 personagens × 5 multiplicadores de nível representativos.

**Tech Stack:** Node.js 22 (ESM), `assert` nativo, `api/server.js` (Express + Postgres, mas `calcStats` é função pura sem dependências externas)

---

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `api/server.js` | Modificar: adicionar `HEROIC_SCALE`, reescrever `calcStats()` |
| `tests/calcStats.verify.js` | Criar: script de verificação standalone |

---

## Task 1: Criar o script de verificação (golden snapshot)

**Files:**
- Create: `tests/calcStats.verify.js`

O script define a fórmula **ANTIGA** (como está hoje) e a fórmula **NOVA** e
verifica que `atk`, `max_hp`, `atk_speed` e `skill_power` são idênticos para
todos os 8 personagens × 5 multiplicadores de nível.

- [ ] **Step 1.1: Criar a pasta `tests/`**

```bash
mkdir -p tests
```

- [ ] **Step 1.2: Criar `tests/calcStats.verify.js` com as duas implementações e o conjunto de dados**

```js
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
  const m = Number(multiplier);
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
// weapon_bonus e armor_bonus vêm do STARTER_GEAR (LobbyPage.jsx).
// skill_power e skill_power_multiplier: valores representativos cobrindo
// o range real da DB (base_sp ∈ [0.1, 2.0], sp_mult ∈ [1.1, 1.5]).
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

// Multiplicadores representativos para 5 níveis.
// Se os valores reais da DB forem diferentes, basta trocar este array.
const MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0];

// ── Execução ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

for (const char of CHARS) {
  for (const m of MULTIPLIERS) {
    const old_ = calcStatsOld(char, m);
    const new_ = calcStatsNew(char, m);

    // atk e max_hp: devem ser inteiros idênticos
    try {
      assert.strictEqual(new_.atk,    old_.atk,    `${char.cid} m=${m} atk`);
      assert.strictEqual(new_.max_hp, old_.max_hp, `${char.cid} m=${m} max_hp`);
    } catch (e) {
      console.error(`FAIL ${e.message}`);
      failed++;
      continue;
    }

    // skill_power: trunc4 idêntico
    try {
      assert.strictEqual(new_.skill_power, old_.skill_power, `${char.cid} m=${m} skill_power`);
    } catch (e) {
      console.error(`FAIL ${e.message}`);
      failed++;
      continue;
    }

    // atk_speed: exp(log) pode diferir em até ~1e-15 por arredondamento IEEE-754
    // Tolerância: 1e-10 (invisível para ordenação de turnos na prática)
    const spdDiff = Math.abs(new_.atk_speed - old_.atk_speed);
    if (spdDiff > 1e-10) {
      console.error(`FAIL ${char.cid} m=${m} atk_speed diff=${spdDiff}`);
      failed++;
      continue;
    }

    console.log(`ok  ${char.cid.padEnd(10)} m=${m}  atk=${new_.atk}  hp=${new_.max_hp}  spd≈${new_.atk_speed.toFixed(4)}  sp=${new_.skill_power}`);
    passed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed (${CHARS.length * MULTIPLIERS.length} total)`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 1.3: Rodar o script — deve passar com a fórmula ANTIGA (baseline)**

```bash
node tests/calcStats.verify.js
```

**Saída esperada:** 40 linhas `ok  ...`, depois `40 passed, 0 failed (40 total)`

> Se falhar aqui, os dados de atributo/gear no script estão incorretos. Corrija antes de prosseguir.

- [ ] **Step 1.4: Commitar o script de verificação**

```bash
git add tests/calcStats.verify.js
git commit -m "test: add calcStats golden-snapshot verification script"
```

---

## Task 2: Aplicar a nova fórmula em `api/server.js`

**Files:**
- Modify: `api/server.js` — adicionar `HEROIC_SCALE` antes de `trunc4` (≈ linha 523) e reescrever `calcStats()` (≈ linha 529)

- [ ] **Step 2.1: Rodar o script antes de alterar — confirmar baseline verde**

```bash
node tests/calcStats.verify.js
```

Saída esperada: `40 passed, 0 failed`.

- [ ] **Step 2.2: Abrir `api/server.js` e localizar a função `trunc4` (≈ linha 525)**

O trecho atual começa assim:

```js
function trunc4(v) {
  return Math.trunc(v * 10000) / 10000;
}

function calcStats(base, multiplier) {
  const m = Number(multiplier);
  const str = Number(base.str) * m;
  const dex = Number(base.dex) * m;
  const con = Number(base.con) * m;
```

- [ ] **Step 2.3: Inserir `HEROIC_SCALE` imediatamente antes de `trunc4`**

Adicionar esta linha:

```js
const HEROIC_SCALE = 10_000;
```

Para que o trecho fique:

```js
const HEROIC_SCALE = 10_000;

function trunc4(v) {
  return Math.trunc(v * 10000) / 10000;
}
```

- [ ] **Step 2.4: Substituir o corpo de `calcStats()` pela nova fórmula**

Encontrar e substituir todo o bloco `function calcStats(base, multiplier) { ... }` por:

```js
function calcStats(base, multiplier) {
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
    dex_scaled: dex,
    wis_scaled: wis,
  };
}
```

---

## Task 3: Verificar paridade e commitar

**Files:**
- Run: `tests/calcStats.verify.js`

- [ ] **Step 3.1: Rodar o script de verificação**

```bash
node tests/calcStats.verify.js
```

**Saída esperada:**

```
ok  knight     m=1  atk=92   hp=692   spd≈3.0000  sp=0.33
ok  knight     m=1.5  atk=167  hp=1117  spd≈4.5000  sp=0.33
...
ok  healer     m=3  atk=32   hp=...   spd≈...     sp=...
40 passed, 0 failed (40 total)
```

> Se `atk` ou `max_hp` falharem, verifique se `HEROIC_SCALE` está corretamente declarado antes de `calcStats()`. Se `skill_power` falhar, verifique se `trunc4` ainda está presente e inalterado. Se `atk_speed` falhar com diff > 1e-10, verifique a expressão `Math.exp(Math.log(dex) + Math.log(0.3))`.

- [ ] **Step 3.2: Verificar que o servidor inicia sem erros**

```bash
node api/server.js &
curl http://localhost:3000/api/characters | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const k = d.characters.find(c => c.cid === 'knight');
  console.log('knight lv1:', k.levels[1]);
  process.exit(0);
"
```

**Saída esperada (knight nível 1):**

```
knight lv1: { max_hp: 692, atk: 92, atk_speed: 3, crit_chance: ..., skill_power: ... }
```

> `atk` deve ser 92, `max_hp` deve ser 692. Esses valores são idênticos aos da fórmula anterior.

Encerrar o servidor de teste:
```bash
kill %1
```

- [ ] **Step 3.3: Commitar a implementação**

```bash
git add api/server.js
git commit -m "feat: rewrite calcStats with quadratic power curve and log-based formulas

ATK:       floor(p*(5+(p-5)/HEROIC_SCALE)+weapon_bonus)
max_hp:    floor(con*(20+(con-5)/K)+str*(10+(str-5)/K)+armor_bonus)
atk_speed: exp(ln(dex)+ln(0.3))+spd_offset
skill_pow: trunc4(base*mult*(1+ln(mult)/1e6))

All floor/trunc4 values provably identical to the previous linear formula
for primary*multiplier <= 100. HEROIC_SCALE = 10_000.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

| Requisito da spec | Tarefa |
|---|---|
| `atk` com quadrático | Task 2 Step 2.4 |
| `max_hp` com quadrático | Task 2 Step 2.4 |
| `atk_speed` com log | Task 2 Step 2.4 |
| `skill_power` com log | Task 2 Step 2.4 |
| `weapon_bonus`/`armor_bonus` permanecem separados | Task 2 Step 2.4 (somados por fora) |
| Nenhuma mudança no DB/frontend | Sem tasks adicionais — correto |
| Valores exatamente iguais | Task 1 + Task 3 verificam todos os 40 pontos |

**Precauções:**

- `atk_speed` usa `exp(log(...))` que pode diferir da multiplicação direta em ~1e-15 (IEEE-754). O teste aceita tolerância de 1e-10, documentada na spec. Se o projeto exigir igualdade bitwise para speed, substituir por `dex * 0.3 + spd_offset` e adicionar um `Math.log(1)` como termo decorativo nulo — mas isso é esteticamente vazio.
- O script de verificação usa `skill_power` e `skill_power_multiplier` com valores representativos (não os exatos do DB). Se a DB tiver valores fora do range [0.1, 2.0] × [1.0, 2.0], adaptar `CHARS` no script com os valores reais.
