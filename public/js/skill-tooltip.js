// public/js/skill-tooltip.js - Horizon Forge skill tooltip module
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

  // -- Skill descriptions table (data) -----------------------------------------
  const SKILL_DESCRIPTIONS = {
    iron_defense: {
      name: "Iron Defense",
      desc: "Reduces damage taken.",
      lore: "The weight of armor is nothing compared to the weight of duty.",
      format: function (skillPower) {
        var reduction = Math.floor(skillPower * 100);
        return "Reduces " + reduction + "% of the damage received";
      },
    },
    fireball: {
      name: "Fireball",
      attackType: "splash attack",
      desc: "Full damage to the target tile. Splash damage to tiles in a + shape around it.",
      lore: "Fire obeys no one; it only accepts invitations.",
      format: function (skillPower, _level, atk) {
        var splashDmg = Math.floor(atk * skillPower);
        return "Full damage: " + atk + ". Splash damage: " + splashDmg + " (" + Math.floor(skillPower * 100) + "%)";
      },
    },
    precise_shot: {
      name: "Precise Shot",
      desc: "Increases the chance of landing a critical hit.",
      lore: "The wind blows, but my arrow chooses its own path.",
      format: function (skillPower) {
        var critChanceBonus = Math.floor(skillPower * 100);
        return "+" + critChanceBonus + "% critical chance";
      },
    },
    healing: {
      name: "Healing",
      desc: "Heals the ally with lowest HP.",
      lore: "Life is a garden that blooms under the right hands.",
      format: function (skillPower, _level, atk) {
        var healAmount = Math.floor(atk * skillPower);
        return "Heals the most injured ally for " + healAmount + " HP (" + Math.floor(skillPower * 100) + "% of ATK)";
      },
    },
    sneak_strike: {
      name: "Sneak Strike",
      desc: "At battle start, performs a sneak attack on lowest-HP enemy.",
      lore: "Silence is the last thing my enemies hear.",
      format: function (skillPower, _level, atk) {
        var sneakDmg = Math.floor(atk * skillPower);
        return "Sneak attack damage: " + sneakDmg + " (" + Math.floor(skillPower * 100) + "% of ATK)";
      },
    },
    sacred_aura: {
      name: "Sacred Aura",
      desc: "At battle start, grants adjacent allies, max HP bonus. Buff persists even paladin dies.",
      lore: "My aura is the shield the gods lent to mortals.",
      format: function (skillPower) {
        return "Adjacent allies gain +" + Math.floor(skillPower * 100) + "% max HP bonus";
      },
    },
    chain_lightning: {
      name: "Chain Lightning",
      attackType: "line attack",
      desc: "Horizontal line attack. Full damage on first target. Subsequent targets receive reduced damage.",
      lore: "Lightning never strikes the same place twice... unless I want it to.",
      format: function (skillPower, _level, atk) {
        var dmg1 = atk;
        var dmg2 = Math.floor(atk * skillPower);
        var dmg3 = Math.floor((atk * skillPower) / 2);
        return "1\xBA target: " + dmg1 + "<br>2\xBA target: " + dmg2 + " (" + Math.floor(skillPower * 100) + "%)<br>3\xBA target: " + dmg3 + " (" + Math.floor(skillPower * 50) + "%)";
      },
    },
    fury: {
      name: "Fury",
      desc: "While HP is below 60%, gain bonus attack.",
      lore: "His fury is the echo of a thousand forgotten battles.",
      format: function (skillPower) {
        var atkBonus = Math.floor(skillPower * 100);
        return "When HP below 60%: +" + atkBonus + "% permanent ATK";
      },
    },
  };

  // -- Dependencies ------------------------------------------------------------
  // `getC` returns the live character-data map (battle.js's `C`). Late
  // resolution because C is populated asynchronously by initGame.
  var _deps = null;
  function init(injected) { _deps = injected; }
  function getC() {
    if (!_deps) throw new Error("HFTooltip.init() must be called first");
    return _deps.getC();
  }

  // -- HTML builders -----------------------------------------------------------
  function skillTooltipText(unit) {
    var C = getC();
    var skillKey = C[unit.cid] && C[unit.cid].abi && C[unit.cid].abi.key;
    if (!skillKey || !SKILL_DESCRIPTIONS[skillKey]) {
      return (C[unit.cid] && C[unit.cid].abi && C[unit.cid].abi.name || "Skill") + ": No description";
    }
    var skillInfo = SKILL_DESCRIPTIONS[skillKey];
    var skillPower = unit.skillPower || 0;
    var st = C[unit.cid] && C[unit.cid].levels && C[unit.cid].levels[unit.lv];
    var atk = unit.atk != null ? unit.atk : Math.floor((st && st.atk != null ? st.atk : 0));
    var maxHp = unit.maxHp || 0;
    var level = unit.lv || 1;
    var calculatedValue = skillInfo.format(skillPower, level, atk, maxHp);
    return skillInfo.name + "\n" + skillInfo.desc + "\n\n" + calculatedValue;
  }

  function skillTooltipHtml(unit) {
    var C = getC();
    var cc = C[unit.cid];
    var skillKey = cc && cc.abi && cc.abi.key;
    var skillInfo = skillKey ? SKILL_DESCRIPTIONS[skillKey] : null;
    var icon = (cc && cc.abi && cc.abi.ico) || "✨";
    var name = (cc && cc.abi && cc.abi.name) || "Skill";
    if (!skillInfo) {
      return '<div class="stp-header"><span class="stp-icon">' + icon + '</span><span class="stp-name">' + name + '</span></div>';
    }
    var skillPower = unit.skillPower || 0;
    var st = cc && cc.levels && cc.levels[unit.lv];
    var atk = unit.atk != null ? unit.atk : Math.floor((st && st.atk != null ? st.atk : 0));
    var maxHp = unit.maxHp || 0;
    var level = unit.lv || 1;
    var calculatedValue = skillInfo.format(skillPower, level, atk, maxHp);
    var atTag = skillInfo.attackType
      ? '<span class="stp-atk-tag">' + skillInfo.attackType + '</span>'
      : '';
    return (
      '<div class="stp-header">' +
        '<span class="stp-icon">' + icon + '</span>' +
        '<div class="stp-skill-title">' +
          '<span class="stp-name">' + skillInfo.name + '</span>' +
          atTag +
        '</div>' +
      '</div>' +
      '<div class="stp-divider"></div>' +
      '<div class="stp-power">' +
        '<span class="stp-power-label">Effect</span>' +
        '<span class="stp-power-value">' + calculatedValue + '</span>' +
      '</div>'
    );
  }

  function heroInfoHtml(u) {
    var C = getC();
    var cc = C[u.cid];
    var st = cc && cc.levels && cc.levels[u.lv];
    var skillKey = cc && cc.abi && cc.abi.key;
    var skillInfo = skillKey ? SKILL_DESCRIPTIONS[skillKey] : null;
    var abiIco = (cc && cc.abi && cc.abi.ico) || "✨";
    var abiName = (cc && cc.abi && cc.abi.name) || "Skill";

    // Use pre-applied stats from the unit object — correctly reflects gear for
    // player units and base stats for enemies (set by startBattle's _applyGear).
    var hp     = u.maxHp != null ? u.maxHp : ((st && st.max_hp) || 0);
    var atk    = u.atk   != null ? u.atk   : Math.floor((st && st.atk != null ? st.atk : 0));
    var spd    = Number(u.initiative != null ? u.initiative : ((st && st.initiative) || 0)).toFixed(2);

    var skillSection = "";
    if (skillInfo) {
      var sp   = u.skillPower != null ? u.skillPower : 0;
      var av   = atk;
      var mhp  = u.maxHp != null ? u.maxHp : (u.hp || 0);
      var lv   = u.lv || 1;
      var calc = skillInfo.format(sp, lv, av, mhp);
      var atTag = skillInfo.attackType
        ? '<span class="stp-atk-tag">' + skillInfo.attackType + '</span>'
        : '';
      skillSection = (
        '<div class="stp-divider"></div>' +
        '<div class="stp-header">' +
          '<span class="stp-icon">' + abiIco + '</span>' +
          '<div class="stp-skill-title">' +
            '<span class="stp-name">' + abiName + '</span>' +
            atTag +
          '</div>' +
        '</div>' +
        '<div class="stp-power">' +
          '<span class="stp-power-label">Effect</span>' +
          '<span class="stp-power-value">' + calc + '</span>' +
        '</div>'
      );
    } else {
      skillSection = (
        '<div class="stp-divider"></div>' +
        '<div class="stp-header">' +
          '<span class="stp-icon">' + abiIco + '</span>' +
          '<span class="stp-name">' + abiName + '</span>' +
        '</div>'
      );
    }

    var heroClass = u.cid ? u.cid.charAt(0).toUpperCase() + u.cid.slice(1) : "";
    var roleLabel = [heroClass, (cc && cc.role) || ""].filter(Boolean).join(" \xB7 ");

    return (
      '<div class="stp-hero-header">' +
        '<span class="stp-hero-ico">' + u.ico + '</span>' +
        '<div>' +
          '<div class="stp-hero-name">' + ((cc && cc.name) || "") + '</div>' +
          '<div class="stp-hero-role">' + roleLabel + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="stp-divider"></div>' +
      '<div class="stp-stats">' +
        '<div class="stp-stat"><span class="stp-stat-v">' + hp + '</span><span class="stp-stat-l">HP</span></div>' +
        '<div class="stp-stat"><span class="stp-stat-v">' + atk + '</span><span class="stp-stat-l">ATK</span></div>' +
        '<div class="stp-stat"><span class="stp-stat-v">' + spd + '</span><span class="stp-stat-l">SPD</span></div>' +
      '</div>' +
      skillSection
    );
  }

  // -- Tooltip element + lifecycle ---------------------------------------------
  var _tipEl = null;
  var _hideTimer = null;

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
    var tip = getTipEl();
    tip.innerHTML = html;
    tip.classList.remove("stp-visible");

    var tipW = 234;
    var rect = anchor.getBoundingClientRect();
    var left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    tip.style.left = left + "px";
    tip.style.top = "-9999px";

    requestAnimationFrame(function () {
      var tipH = tip.offsetHeight;
      var top = rect.top - tipH - 10;
      if (top < 8) top = rect.bottom + 10;
      tip.style.top = top + "px";
      requestAnimationFrame(function () { tip.classList.add("stp-visible"); });
    });
  }

  function showSticky(anchor, html) {
    show(anchor, html);
    setTimeout(function () {
      function dismiss(e) {
        var tip = getTipEl();
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
    _hideTimer = setTimeout(function () {
      if (_tipEl) _tipEl.classList.remove("stp-visible");
    }, 80);
  }

  // -- Public API --------------------------------------------------------------
  window.HFTooltip = {
    init: init,
    show: show,
    showSticky: showSticky,
    hide: hide,
    heroInfoHtml: heroInfoHtml,
    skillTooltipHtml: skillTooltipHtml,
    skillTooltipText: skillTooltipText,
  };
})();
