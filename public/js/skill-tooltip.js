// public/js/skill-tooltip.js — Horizon Forge skill tooltip module
//
// Self-contained tooltip + skill-description module. Loaded by BattlePage.jsx
// before /js/battle.js. battle.js calls into window.HFTooltip from bench /
// shop / field info-button event handlers.
//
// API:
//   HFTooltip.init({ getC })    one-time setup, called from initGame()
//   HFTooltip.show(anchor, html)         position + animate in
//   HFTooltip.showSticky(anchor, html)   show + dismiss-on-outside-tap
//   HFTooltip.hide()                     fade out
//   HFTooltip.heroInfoHtml(unit)         full hero card HTML (used on field cells)
//   HFTooltip.skillTooltipHtml(unit)     skill-only tooltip (used on shop/bench)
//   HFTooltip.skillTooltipText(unit)     plain-text variant (used by attribute hints)

(function () {
  "use strict";

  // ── Skill descriptions table (data) ─────────────────────────────────────
  const SKILL_DESCRIPTIONS = {
    iron_defense: {
      name: "Iron Defense",
      desc: "Reduces damage taken.",
      lore: "The weight of armor is nothing compared to the weight of duty.",
      format: (skillPower) => {
        const reduction = Math.floor(skillPower * 100);
        return `Reduces ${reduction}% of the damage received`;
      },
    },
    fireball: {
      name: "Fireball",
      desc: "Full damage to the target tile. Splash damage to tiles in a + shape around it.",
      lore: "Fire obeys no one; it only accepts invitations.",
      format: (skillPower, _level, atk) => {
        const splashDmg = Math.floor(atk * skillPower);
        return `Full damage: ${atk}. Splash damage: ${splashDmg} (${Math.floor(skillPower * 100)}%)`;
      },
    },
    precise_shot: {
      name: "Precise Shot",
      desc: "Increases the chance of landing a critical hit.",
      lore: "The wind blows, but my arrow chooses its own path.",
      format: (skillPower) => {
        const critChanceBonus = Math.floor(skillPower * 100);
        return `+${critChanceBonus}% critical chance`;
      },
    },
    healing: {
      name: "Healing",
      desc: "Heals the ally with lowest HP.",
      lore: "Life is a garden that blooms under the right hands.",
      format: (skillPower, _level, atk) => {
        const healAmount = Math.floor(atk * skillPower);
        return `Heals the most injured ally for ${healAmount} HP (${Math.floor(skillPower * 100)}% of ATK)`;
      },
    },
    sneak_strike: {
      name: "Sneak Strike",
      desc: "At battle start, performs a sneak attack on lowest-HP enemy.",
      lore: "Silence is the last thing my enemies hear.",
      format: (skillPower, _level, atk) => {
        const sneakDmg = Math.floor(atk * skillPower);
        return `Sneak attack damage: ${sneakDmg} (${Math.floor(skillPower * 100)}% of ATK)`;
      },
    },
    sacred_aura: {
      name: "Sacred Aura",
      desc: "At battle start, grants adjacent allies, max HP bonus. Buff persists even paladin dies.",
      lore: "My aura is the shield the gods lent to mortals.",
      format: (skillPower) => {
        return `Adjacent allies gain +${Math.floor(skillPower * 100)}% max HP bonus`;
      },
    },
    chain_lightning: {
      name: "Chain Lightning",
      desc: "Horizontal line attack. Full damage on first target. Subsequent targets receive reduced damage.",
      lore: "Lightning never strikes the same place twice... unless I want it to.",
      format: (skillPower, _level, atk) => {
        const dmg1 = atk;
        const dmg2 = Math.floor(atk * skillPower);
        const dmg3 = Math.floor((atk * skillPower) / 2);
        return `1º target: ${dmg1}<br>
                2º target: ${dmg2} (${Math.floor(skillPower * 100)}%)<br>
                3º target: ${dmg3} (${Math.floor(skillPower * 50)}%)`;
      },
    },
    fury: {
      name: "Fury",
      desc: "While HP is below 60%, gain bonus attack.",
      lore: "His fury is the echo of a thousand forgotten battles.",
      format: (skillPower) => {
        const atkBonus = Math.floor(skillPower * 100);
        return `When HP below 60%: +${atkBonus}% permanent ATK`;
      },
    },
  };

  // ── Dependencies ────────────────────────────────────────────────────────
  // `getC` returns the live character-data map (battle.js's `C`). Late
  // resolution because C is populated asynchronously by initGame.
  let _deps = null;
  function init(injected) { _deps = injected; }
  function getC() {
    if (!_deps) throw new Error("HFTooltip.init() must be called first");
    return _deps.getC();
  }

  // ── HTML builders ───────────────────────────────────────────────────────
  function skillTooltipText(unit) {
    const C = getC();
    const skillKey = C[unit.cid]?.abi?.key;
    if (!skillKey || !SKILL_DESCRIPTIONS[skillKey]) {
      return `${C[unit.cid]?.abi?.name || "Skill"}: No description`;
    }
    const skillInfo = SKILL_DESCRIPTIONS[skillKey];
    const skillPower = unit.skillPower || 0;
    const atk = unit.atk || 0;
    const maxHp = unit.maxHp || 0;
    const level = unit.lv || 1;
    const calculatedValue = skillInfo.format(skillPower, level, atk, maxHp);
    return `${skillInfo.name}\n${skillInfo.desc}\n\n${calculatedValue}`;
  }

  function skillTooltipHtml(unit) {
    const C = getC();
    const cc = C[unit.cid];
    const skillKey = cc?.abi?.key;
    const skillInfo = skillKey ? SKILL_DESCRIPTIONS[skillKey] : null;
    const icon = cc?.abi?.ico || "✨";
    const name = cc?.abi?.name || "Skill";
    if (!skillInfo) {
      return `<div class="stp-header"><span class="stp-icon">${icon}</span><span class="stp-name">${name}</span></div>`;
    }
    const skillPower = unit.skillPower || 0;
    const atk = unit.atk || 0;
    const maxHp = unit.maxHp || 0;
    const level = unit.lv || 1;
    const calculatedValue = skillInfo.format(skillPower, level, atk, maxHp);
    return `
            <div class="stp-header">
              <span class="stp-icon">${icon}</span>
              <span class="stp-name">${skillInfo.name}</span>
            </div>
            <div class="stp-divider"></div>
            <div class="stp-desc">${skillInfo.desc}</div>
            ${skillInfo.lore ? `
            <div class="stp-lore" style="
              font-style: italic; 
              opacity: 0.55; 
              font-size: 11px; 
              margin: 12px 0; 
              color: #fff; 
              line-height: 1.4;
              display: block;
              border-top: 1px solid rgba(255,255,255,0.1);
              padding-top: 10px;
              text-align: center;
            ">
              “${skillInfo.lore}”
            </div>` : ''}            <div class="stp-power">
              <span class="stp-power-label">Current Effect</span>
              <span class="stp-power-value">${calculatedValue}</span>
            </div>`;
  }

  function heroInfoHtml(u) {
    const C = getC();
    const cc = C[u.cid];
    const st = cc?.levels?.[u.lv];
    const skillKey = cc?.abi?.key;
    const skillInfo = skillKey ? SKILL_DESCRIPTIONS[skillKey] : null;
    const abiIco = cc?.abi?.ico || "✨";
    const abiName = cc?.abi?.name || "Skill";

    const gear    = window.HF_gear?.[u.cid]?.totals ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 };
    const hp      = (st?.max_hp ?? 0)    + gear.hp_bonus;
    const atk     = Math.floor(st?.atk ?? 0) + gear.atk_bonus;
    const spdRaw  = (st?.initiative ?? 0) + gear.spd_bonus;
    const spd     = Number(spdRaw).toFixed(2);

    let skillSection = "";
    if (skillInfo) {
      const sp = u.skillPower ?? 0;
      const av = u.atk ?? 0;
      const mhp = u.maxHp ?? u.hp ?? 0;
      const lv = u.lv || 1;
      const calc = skillInfo.format(sp, lv, av, mhp);
      skillSection = `<div class="stp-divider"></div>
        <div class="stp-header"><span class="stp-icon">${abiIco}</span><span class="stp-name">${abiName}</span></div>
        <div class="stp-desc">${skillInfo.desc}</div>
        ${skillInfo.lore ? `
        <div class="stp-lore" style="
          font-style: italic; 
          opacity: 0.55; 
          font-size: 11px; 
          margin: 12px 0; 
          color: #fff; 
          line-height: 1.4;
          display: block;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 10px;
          text-align: center;
        ">
          “${skillInfo.lore}”
        </div>` : ''}
        <div class="stp-power"><span class="stp-power-label">Effect</span><span class="stp-power-value">${calc}</span></div>`;
    } else {
      skillSection = `<div class="stp-divider"></div>
        <div class="stp-header"><span class="stp-icon">${abiIco}</span><span class="stp-name">${abiName}</span></div>`;
    }

    const heroClass = u.cid ? u.cid.charAt(0).toUpperCase() + u.cid.slice(1) : "";
    const roleLabel = [heroClass, cc?.role || ""].filter(Boolean).join(" · ");

    return `<div class="stp-hero-header">
      <span class="stp-hero-ico">${u.ico}</span>
      <div><div class="stp-hero-name">${cc?.name || ""}</div><div class="stp-hero-role">${roleLabel}</div></div>
    </div>
    <div class="stp-divider"></div>
    <div class="stp-stats">
      <div class="stp-stat"><span class="stp-stat-v">${hp}</span><span class="stp-stat-l">HP</span></div>
      <div class="stp-stat"><span class="stp-stat-v">${atk}</span><span class="stp-stat-l">ATK</span></div>
      <div class="stp-stat"><span class="stp-stat-v">${spd}</span><span class="stp-stat-l">SPD</span></div>
    </div>${skillSection}`;
  }

  // ── Tooltip element + lifecycle ─────────────────────────────────────────
  let _tipEl = null;
  let _hideTimer = null;

  function getTipEl() {
    if (!_tipEl) {
      _tipEl = document.createElement("div");
      _tipEl.className = "skill-tip";
      document.body.appendChild(_tipEl);
    }
    return _tipEl;
  }

  function show(anchor, html) {
    clearTimeout(_hideTimer);
    const tip = getTipEl();
    tip.innerHTML = html;
    tip.classList.remove("stp-visible");

    const tipW = 234;
    const rect = anchor.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    tip.style.left = left + "px";
    tip.style.top = "-9999px";

    requestAnimationFrame(() => {
      const tipH = tip.offsetHeight;
      let top = rect.top - tipH - 10;
      if (top < 8) top = rect.bottom + 10;
      tip.style.top = top + "px";
      requestAnimationFrame(() => tip.classList.add("stp-visible"));
    });
  }

  function showSticky(anchor, html) {
    show(anchor, html);
    setTimeout(() => {
      function dismiss(e) {
        const tip = getTipEl();
        if (!tip.contains(e.target)) {
          hide();
          document.removeEventListener("touchstart", dismiss);
          document.removeEventListener("click", dismiss);
        }
      }
      document.addEventListener("touchstart", dismiss, { passive: true });
      document.addEventListener("click", dismiss);
    }, 150);
  }

  function hide() {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => {
      if (_tipEl) _tipEl.classList.remove("stp-visible");
    }, 80);
  }

  // ── Public API ──────────────────────────────────────────────────────────
  window.HFTooltip = {
    init,
    show, showSticky, hide,
    heroInfoHtml, skillTooltipHtml, skillTooltipText,
  };
})();
