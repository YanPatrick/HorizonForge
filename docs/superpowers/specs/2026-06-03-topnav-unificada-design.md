# Spec: Topnav Unificada — Redesign Desktop

**Data:** 2026-06-03  
**Escopo:** Desktop only (≥768px). Mobile (< 768px) sem alteração.

---

## Objetivo

Mover a barra de navegação inferior (GRIMOIRE, FORMATION, DUEL, SHOP, CONFIG) para o topo da tela no desktop, unificando-a com o header existente em uma única barra coesa e elegante.

---

## Decisões de Design

| Aspecto | Decisão |
|---|---|
| Estrutura | Topnav unificada — uma barra só |
| Esquerda | Logo wordmark: `⚔ HORIZONFORGE` em dourado |
| Centro | 5 tabs de navegação |
| Direita | User info existente (balance, badge, exit) |
| Tab ativo | Underline dourado (2px, `#ffd700`) |
| Breakpoint | `768px` — abaixo disso, comportamento atual intacto |

---

## Aparência

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚔ HORIZONFORGE  │  📖 GRIMOIRE  🏰 FORMATION  ⚔️ DUEL  🛒 SHOP  ⚙️ CONFIG  │  💰 1.250  👤 Yan  ✕  │
│                  │                          ‾‾‾‾                           │                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ↑ underline dourado no tab ativo
```

---

## Arquivos a Alterar

### 1. `client/src/pages/LobbyPage.jsx`

**Dentro do elemento `<topnav>`**, adicionar dois novos elementos:

**Logo (antes do `nav-right` existente):**
```jsx
<div className="topnav-logo">⚔ HORIZONFORGE</div>
```

**Tabs de navegação (entre logo e nav-right):**
```jsx
<nav className="topnav-tabs">
  <button type="button" className={topnavTabClass('grimoire')} onClick={() => setView('grimoire')}>
    <span className="tnav-ico">📖</span><span className="tnav-lbl">Grimoire</span>
  </button>
  <button type="button" className={topnavTabClass('formation')} onClick={() => setView('formation')}>
    <span className="tnav-ico">🏰</span><span className="tnav-lbl">Formation</span>
  </button>
  <button type="button" className={topnavTabClass('home')} onClick={() => setView('home')}>
    <span className="tnav-ico">⚔️</span><span className="tnav-lbl">Duel</span>
  </button>
  <button type="button" className={topnavTabClass('shop')} onClick={() => setView('shop')}>
    <span className="tnav-ico">🛒</span><span className="tnav-lbl">Shop</span>
  </button>
  <button type="button" className={topnavTabClass('settings')} onClick={() => setView('settings')}>
    <span className="tnav-ico">⚙️</span><span className="tnav-lbl">Config</span>
  </button>
</nav>
```

**Nova função helper** (junto com `navTabClass`):
```js
function topnavTabClass(tab) {
  return `tnav-tab${view === tab ? ' active' : ''}`;
}
```

O `<topnav>` passa a ter layout: `logo | tabs | nav-right` com `justify-content: space-between`.

### 2. `public/css/lobby.css`

#### Estilos da topnav unificada

```css
/* Logo — visível apenas no desktop */
.topnav-logo {
  display: none;
  color: #ffd700;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.35);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Tabs container — visível apenas no desktop */
.topnav-tabs {
  display: none;
  align-items: stretch;
  height: 100%;
  gap: 0;
}

/* Botão de tab */
.tnav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: rgba(190, 170, 240, 0.45);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tnav-tab:hover {
  color: rgba(210, 190, 255, 0.7);
}

.tnav-tab.active {
  color: #ffd700;
  border-bottom-color: #ffd700;
}

.tnav-tab.active .tnav-ico {
  filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5));
}

.tnav-ico {
  font-size: 15px;
  line-height: 1;
}

.tnav-lbl {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
}
```

#### Breakpoints

```css
/* Desktop: topnav unificada ativa, bottom nav escondido */
@media (min-width: 768px) {
  topnav {
    justify-content: space-between;
  }

  .topnav-logo {
    display: flex;
    align-items: center;
  }

  .topnav-tabs {
    display: flex;
  }

  .mobile-bottom-tabs {
    display: none !important;
  }

  .lobby-wrap {
    bottom: 0; /* remove o espaço reservado para o bottom nav */
  }
}
```

---

## Comportamento por Viewport

| Viewport | Logo | Tabs no topo | Bottom nav | lobby-wrap bottom |
|---|---|---|---|---|
| ≥ 768px (desktop) | visível | visível | oculto | 0px |
| < 768px (mobile) | oculto | oculto | visível (intacto) | 60px |

---

## Invariantes

- A lógica de `view` state em `LobbyPage.jsx` **não muda** — os dois navs (topnav-tabs e mobile-bottom-tabs) usam o mesmo state e se mantêm sincronizados.
- O `.mobile-bottom-tabs` e seus estilos existentes **não são removidos** do código, apenas ocultados via CSS no desktop.
- O `nav-right` existente (chest-pill, hive-bal, nav-user-badge, btn-exit) permanece sem alteração no JSX.
- Nenhuma alteração em arquivos de batalha, mobile, ou outras páginas.

---

## Critérios de Conclusão

- [ ] JSX correto alterado (`client/src/pages/LobbyPage.jsx`)
- [ ] CSS adicionado em `public/css/lobby.css`
- [ ] Visível em `localhost:5173` no desktop (≥768px)
- [ ] Bottom nav continua funcionando em mobile (<768px)
- [ ] `npm run build` executado com sucesso
- [ ] Testado em `localhost:3000` via `npm start`
