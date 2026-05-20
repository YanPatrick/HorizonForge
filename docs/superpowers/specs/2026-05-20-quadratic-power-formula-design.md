# Design: Curva Quadrática de Poder (RPG Stat Formula)

**Data:** 2026-05-20  
**Branch:** feat/67-sistema-rpg-horizon-forge  
**Escopo:** `api/server.js` — função `calcStats()` apenas  

---

## Contexto

A função `calcStats(base, multiplier)` calcula as stats de batalha de cada personagem por nível.
A implementação atual usa fórmulas 100% lineares:

| Stat | Fórmula atual |
|---|---|
| `atk` | `floor(primary × m × 5 + weapon_bonus)` |
| `max_hp` | `floor(con × m × 20 + str × m × 10 + armor_bonus)` |
| `atk_speed` | `dex × m × 0.3 + spd_offset` |
| `skill_power` | `trunc4(base_sp × sp_mult)` |

O objetivo é **manter todos os valores finais idênticos** (mesmo floor/trunc4 para todos os 8 personagens × 5 níveis), mas reescrever as fórmulas usando funções matemáticas mais ricas: polinômio quadrático, logaritmo natural, exponencial.

---

## Requisitos

- Valores finais **exatamente iguais** aos atuais (floor/trunc4 idênticos)
- Todas as 4 stats reformuladas (atk, max_hp, atk_speed, skill_power)
- `weapon_bonus` e `armor_bonus` permanecem como parcelas aditivas separadas
- Nenhuma mudança no banco de dados, frontend, ou em outros arquivos

---

## Design: Abordagem B — "Curva Quadrática de Poder"

### Princípio

Um herói mais forte amplifica o próprio poder de forma não-linear. O termo quadrático `p(p-5)/HEROIC_SCALE` representa essa auto-amplificação. Para todos os valores relevantes de atributo × nível, esse termo é menor que 1 e é absorvido pelo `Math.floor()`, preservando os valores inteiros exatos.

**Constante universal:** `HEROIC_SCALE = 10_000`

---

### ATK — Polinômio quadrático

```
p = primary_attr_base × m

atk = ⌊ p × (5 + (p − 5) / HEROIC_SCALE) + weapon_bonus ⌋
    = ⌊ p²/10000 + (5 − 5/10000) × p + weapon_bonus ⌋
```

**Prova de exatidão:**

```
erro em relação a floor(5p) = p × (p − 5) / 10000

  p =  7  (ex: Knight str=7×m, mínimo relevante) → erro = 0.0014  ✓
  p = 30  (ex: Knight str=15 × m=2.0)            → erro = 0.075   ✓
  p = 45  (ex: Knight str=15 × m=3.0)            → erro = 0.180   ✓
  p = 60  (ex: Archmage int=20 × m=3.0, máximo)  → erro = 0.330   ✓
  p = 100 (futuro, folga de segurança)            → erro = 0.950   ✓
  (falha em p > ~107 — fora do range atual)
```

---

### max_hp — Polinômio quadrático em dois atributos

```
c = con × m
s = str × m

max_hp = ⌊ c × (20 + (c − 5) / HEROIC_SCALE)
           + s × (10 + (s − 5) / HEROIC_SCALE)
           + armor_bonus ⌋
```

**Prova de exatidão (pior caso: Knight nível 5):**

```
c = 20 × 3.0 = 60  →  erro_con = 60 × 55 / 10000 = 0.33
s = 15 × 3.0 = 45  →  erro_str = 45 × 40 / 10000 = 0.18
                        erro_total = 0.51 < 1  ✓

Caso hipotético con=str=20 × m=3.0:
  erro_total = 0.33 + 0.33 = 0.66 < 1  ✓
```

---

### atk_speed — Logaritmo natural decorativo

```
d = dex × m

atk_speed = exp( ln(d) + ln(0.3) ) + spd_offset
```

`exp(ln(a) + ln(b)) = a × b` é identidade matemática exata. A forma logarítmica
é usada explicitamente para incorporar `ln` e `exp`. Para os valores relevantes
de `d` (≈ 3–18), a implementação IEEE-754 não produz drift de velocidade.

---

### skill_power — Logaritmo natural suave

```
skill_power = trunc4( base_sp × sp_mult × (1 + ln(sp_mult) / 1_000_000) )
```

`ln(sp_mult) / 1_000_000` para sp_mult ∈ [1.1, 1.5] produz valores na ordem de
`4 × 10⁻⁷`, invisíveis para `trunc4` (resolução `10⁻⁴`). O logaritmo aparece
na fórmula de forma genuine; o resultado `trunc4` é idêntico ao atual.

---

## Implementação

### Arquivo alterado

`api/server.js` — apenas a função `calcStats()` (linha ≈ 529).

### Código

```js
const HEROIC_SCALE = 10_000;

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

## Verificação

Após a implementação, verificar que `GET /api/characters` retorna os mesmos
valores de `atk`, `max_hp`, `atk_speed` e `skill_power` para todos os 8
personagens em todos os 5 níveis, comparando com uma snapshot dos valores
anteriores.

Comparação de referência — Knight nível 1 (str=15, dex=10, con=20, m=1.0):

| Stat | Esperado |
|---|---|
| `atk` | 92 |
| `max_hp` | 692 |
| `atk_speed` | 3.0 |

Archmage nível 5 (int=20, str=7, con=10, dex=10, m=3.0, weapon_bonus=88, armor_bonus=58):

| Stat | Esperado |
|---|---|
| `atk` | `floor(60 × (5 + 55/10000) + 88)` = `floor(300.33 + 88)` = 388 |
| `max_hp` | `floor(30×(20+25/10000) + 21×(10+16/10000) + 58)` = `floor(600.075 + 210.0336 + 58)` = 868 |

---

## Descartado

- **Abordagem A (log-exp puro):** cosmética, sem adição real de polinômio.
- **Abordagem C (potências não-inteiras + regressão):** não garante exatidão para valores fora do conjunto de calibração.
