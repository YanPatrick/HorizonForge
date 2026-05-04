## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

---

## Diretrizes de Desenvolvimento — HorizonForge

### 1. Regra obrigatória — Fonte real da interface

Este projeto usa **Vite + React**. A interface que roda em desenvolvimento e em produção vem exclusivamente dos arquivos React em:

```
client/src/
```

Os arquivos em `public/` (ex: `public/battle.html`, `public/lobby.html`, `public/mobile.js`, `public/mobile.css`) existem apenas como referência ou legado. **Eles não são a fonte principal da interface.**

### Regra obrigatória

> Toda alteração visual, estrutural ou funcional de tela deve ser aplicada nos arquivos `.jsx` dentro de `client/src/`.

Se uma mudança for encontrada ou feita em um arquivo `.html` de `public/`, ela **deve obrigatoriamente ser portada** para o `.jsx` correspondente antes de considerar a tarefa concluída.

| Arquivo legado alterado | Arquivo JSX correspondente |
|---|---|
| `public/battle.html` | `client/src/pages/BattlePage.jsx` |
| `public/lobby.html` | Componente React correspondente em `client/src/` |

---

## Portas de desenvolvimento e produção

| Porta | Propósito |
|---|---|
| `localhost:5173` | Frontend Vite/React (desenvolvimento) |
| `localhost:3000` | API/backend Express |

- **Para testar visual e UI:** `http://localhost:5173/battle`
- **Para testar comportamento de produção após build:** `http://localhost:3000/battle`

### URLs a não usar

```
localhost:3000/battle.html
localhost:3000/lobby.html
localhost:3000/index.html
```

Essas URLs podem carregar arquivos legados e causar diagnósticos incorretos.

---

## Fluxo de build para produção

Após validar localmente em `localhost:5173`, executar:

```bash
npm run build
```

O build gera os arquivos finais em:

```
public/dist/
```

Somente os arquivos em `public/dist/` representam a versão React pronta para produção. Para testar:

```bash
npm run build
npm start
# Acessar: http://localhost:3000/battle
```

---

## Checklist obrigatório — antes de encerrar qualquer tarefa

- [ ] O arquivo `.jsx` correto foi alterado
- [ ] A alteração está visível em `localhost:5173`
- [ ] `npm run build` foi executado com sucesso
- [ ] A versão final foi testada em `localhost:3000` via `npm start`

**Nunca considerar uma tarefa concluída se apenas o arquivo `.html` legado foi alterado.**

---

## Como converter HTML legado para JSX

Ao portar estrutura de `public/*.html` para componentes React, aplicar as seguintes conversões:

| HTML | JSX |
|---|---|
| `class="..."` | `className="..."` |
| `onclick="funcao()"` | `onClick={() => window.funcao?.()}` |
| `style="color: red"` | `style={{ color: 'red' }}` |
| `<!-- comentário -->` | `{/* comentário */}` |

Tags devem estar corretamente fechadas. Evitar scripts inline dentro do JSX.

**Exemplo:**

```html
<!-- HTML legado -->
<button data-step="menu" onclick="toggleMobileMenu()">
  ⚙️<span>Menu</span>
</button>
```

```jsx
{/* JSX correto */}
<button type="button" data-step="menu" onClick={() => window.toggleMobileMenu?.()}>
  ⚙️<span>Menu</span>
</button>
```

---

## Investigação de bugs visuais

Se algo aparece em `public/battle.html` mas não aparece em `/battle` no navegador:

**Verificar imediatamente o componente React em `client/src/`.**

A primeira hipótese deve sempre ser:

> A alteração foi feita no arquivo legado, mas não foi portada para o JSX.

**Nunca assumir problema de cache antes de confirmar que o JSX correto foi alterado.**

### 2. Paridade entre Modo Bot e Modo PvP

O jogo tem dois modos de batalha:
- **Modo Bot** — jogador vs. bot fixo
- **Modo PvP** — jogador vs. jogador real

As mecânicas do campo de batalha são **idênticas** nos dois modos. A única diferença é a origem das decisões do oponente (bot vs. jogador humano).

**Regra obrigatória:** Toda alteração de mecânica, regra, visual, animação ou lógica de batalha deve ser aplicada **simultaneamente nos dois modos**. Nunca implementar algo apenas no modo bot sem replicar para o PvP, e vice-versa. Ao final de cada implementação, verificar explicitamente se ambos os modos foram cobertos.

### 3. Efeitos Visuais em Ambos os Lados do Campo

Floating texts, animações, brilhos, partículas e qualquer efeito visual relacionado a ações de batalha (habilidades, dano, cura, buffs, debuffs, etc.) devem aparecer **nos dois lados do campo** — tanto para o jogador logado quanto para o oponente (bot ou PvP).

**Regra obrigatória:** Nunca aplicar efeitos visuais apenas ao lado do jogador local. Ao implementar qualquer efeito, sempre verificar se ele é renderizado corretamente também para o campo do oponente. Exemplo de bug a evitar: habilidade do Paladino que concede HP máximo exibe floating text apenas no lado do jogador, mas não no lado do oponente quando o oponente usa a habilidade.
