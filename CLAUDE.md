## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

---

## Diretrizes de Desenvolvimento — HorizonForge

### 1. Build para Produção (Vite + React → /dist)

Este projeto usa Vite + React. Os arquivos em `src/` são o ambiente de desenvolvimento; a pasta `/dist` é o que vai para produção.

**Regra obrigatória:** Toda vez que uma alteração for concluída e validada em localhost, executar o build imediatamente antes de considerar a tarefa finalizada:

```bash
npm run build
```

Isso garante que os arquivos em `/dist` reflitam todas as mudanças. Nunca encerrar uma tarefa sem confirmar que o build foi feito. Se o usuário mencionar que algo funciona em localhost mas não em produção, a primeira hipótese a investigar é se o build foi executado após as últimas alterações.

### 2. Paridade entre Modo Bot e Modo PvP

O jogo tem dois modos de batalha:
- **Modo Bot** — jogador vs. bot fixo
- **Modo PvP** — jogador vs. jogador real

As mecânicas do campo de batalha são **idênticas** nos dois modos. A única diferença é a origem das decisões do oponente (bot vs. jogador humano).

**Regra obrigatória:** Toda alteração de mecânica, regra, visual, animação ou lógica de batalha deve ser aplicada **simultaneamente nos dois modos**. Nunca implementar algo apenas no modo bot sem replicar para o PvP, e vice-versa. Ao final de cada implementação, verificar explicitamente se ambos os modos foram cobertos.

### 3. Efeitos Visuais em Ambos os Lados do Campo

Floating texts, animações, brilhos, partículas e qualquer efeito visual relacionado a ações de batalha (habilidades, dano, cura, buffs, debuffs, etc.) devem aparecer **nos dois lados do campo** — tanto para o jogador logado quanto para o oponente (bot ou PvP).

**Regra obrigatória:** Nunca aplicar efeitos visuais apenas ao lado do jogador local. Ao implementar qualquer efeito, sempre verificar se ele é renderizado corretamente também para o campo do oponente. Exemplo de bug a evitar: habilidade do Paladino que concede HP máximo exibe floating text apenas no lado do jogador, mas não no lado do oponente quando o oponente usa a habilidade.
