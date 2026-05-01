      // ── RESPONSIVIDADE: atualiza --s com base na resolução real ──
      const BASE_W = 1280; // resolução de referência (seu design base)
      const BASE_H = 720;

      function updateScale() {
        const isTouch = window.matchMedia("(pointer: coarse)").matches;
        const vw = isTouch ? Math.min(window.innerWidth, 480) : window.innerWidth;
        const vh = window.innerHeight;

        // Escala limitada entre 0.6 e 1.5 para não ficar absurdo
        const scaleW = vw / BASE_W;
        const scaleH = vh / BASE_H;
        const scale = Math.min(scaleW, scaleH, 1.5);
        const finalScale = Math.max(scale, 0.6);

        document.documentElement.style.setProperty(
          "--s",
          finalScale.toFixed(4),
        );
      }

      // Dispara ao carregar e a cada resize
      updateScale();
      window.addEventListener("resize", updateScale);

      // ── Auth & battle config injected by lobby ──────────
      (function () {
        const session = (function () {
          try {
            return JSON.parse(sessionStorage.getItem("hf_session"));
          } catch {
            return null;
          }
        })();
        if (!session) {
          window.location.replace("/");
          return;
        }
        window._HF_SESSION = session;
        window._HF_BATTLE_CFG = (function () {
          try {
            return JSON.parse(sessionStorage.getItem("hf_battle_cfg"));
          } catch {
            return null;
          }
        })();
        sessionStorage.removeItem("hf_battle_cfg"); // consume once
      })();

      // ═══════════════════════════════════════════════════
      //  CONFIG & DATA
      // ═══════════════════════════════════════════════════
      const API_BASE =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
          ? "http://localhost:3000"
          : "";

      let C = {}; // character map keyed by cid
      let CK = []; // array of cid strings
      let _deckPool = null; // cids restricted to active formation (null = all heroes)
      const LS = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];
      const BARRACKS_MAX = 5;

      function BENCH_SLOTS() {
        return BARRACKS_MAX;
      }
      function FIELD_MAX() {
        return HF.qtd_max_heroes || 5;
      }
      function distinctHeroes() {
        return G.bench.length;
      }
      function canAddNewHero(cid) {
        if (
          G.bench.some((u) => u.cid === cid) ||
          G.board.some((u) => u && u.cid === cid)
        )
          return true;
        return G.bench.length < BENCH_SLOTS();
      }

      let HF = {
        initial_gold: 7,
        value_buy_card: 3,
        value_new_recruitment: 2,
        value_chance_combo3: 0.1,
        value_gold_combo3: 2,
        value_chance_combo2: 0.3,
        value_gold_combo2: 1,
        qtd_max_heroes: 5,
      };
      function START_GOLD() {
        return HF.initial_gold;
      }

      let battleSpeed = 2;
      function getBattleSpeedMultiplier() {
        return battleSpeed === 1 ? 2 : 1;
      }
      function getBattleFrameDelay() {
        return Math.round(500 * getBattleSpeedMultiplier());
      }
      function getBattleFxDuration(baseMs) {
        return Math.round(baseMs * getBattleSpeedMultiplier());
      }
      function applyBattleSpeed() {
        document.documentElement.style.setProperty(
          "--battle-speed-mult",
          String(getBattleSpeedMultiplier()),
        );
        const btn = document.getElementById("battle-speed-toggle");
        if (btn) {
          btn.textContent = battleSpeed === 1 ? "1x" : "2x";
          btn.classList.toggle("is-fast", battleSpeed === 2);
        }
        try {
          localStorage.setItem("hf_battle_speed", String(battleSpeed));
        } catch {}
      }
      function toggleBattleSpeed() {
        battleSpeed = battleSpeed === 1 ? 2 : 1;
        applyBattleSpeed();
      }
      (function initBattleSpeed() {
        try {
          const saved = Number(localStorage.getItem("hf_battle_speed"));
          if (saved === 1 || saved === 2) battleSpeed = saved;
        } catch {}
        applyBattleSpeed();
      })();

      // ═══════════════════════════════════════════════════
      //  LOADING / BOOTSTRAP
      // ═══════════════════════════════════════════════════
      let _loadOverlay = null;
      function showLoader() {
        _loadOverlay = document.createElement("div");
        _loadOverlay.style.cssText =
          "position:fixed;inset:0;background:#03020e;display:flex;align-items:center;justify-content:center;z-index:300;color:rgba(255,255,255,.55);font-size:14px;text-align:center";
        _loadOverlay.innerHTML = `<div><div style="font-size:36px;margin-bottom:12px">⚔️</div><div>Loading game data…</div></div>`;
        document.body.appendChild(_loadOverlay);
      }
      function hideLoader() {
        if (_loadOverlay) {
          _loadOverlay.remove();
          _loadOverlay = null;
        }
      }

      function validateGameState() {
        // Valida C (characters)
        if (!C || Object.keys(C).length === 0) {
          throw new Error("Characters not loaded");
        }
        // Valida bench
        G.bench.forEach((u) => {
          if (!u.cid || !C[u.cid]) throw new Error(`Invalid unit: ${u.cid}`);
          if (u.stack == null) u.stack = 1;
        });
        // Valida board
        G.board.forEach((u) => {
          if (u && (!u.cid || !C[u.cid]))
            throw new Error(`Invalid board unit: ${u.cid}`);
        });
      }

      async function initGame() {
        showLoader();
        try {
          const [charRes, cfgRes] = await Promise.all([
            fetch(`${API_BASE}/api/characters`),
            fetch(`${API_BASE}/api/config`),
          ]);
          const [charData, cfgData] = await Promise.all([
            charRes.json(),
            cfgRes.json(),
          ]);
          if (!charData.ok) throw new Error(charData.error);

          if (cfgData.ok && cfgData.config) {
            const cfg = cfgData.config;
            Object.keys(HF).forEach((k) => {
              if (cfg[k] != null) HF[k] = cfg[k];
            });
            console.log("✅ Config loaded from DB:", HF);
          }

          C = {};
          for (const char of charData.characters) {
            C[char.cid] = {
              id: char.cid,
              name: char.name,
              ico: char.icon,
              portrait: char.url_portrait || "",
              col: char.color_hex,
              bg: char.bg_gradient,
              role: char.role,
              tp: char.target_type,
              levels: char.levels,
              abi: {
                ico: skillIcon(char.skill.key),
                name: char.skill.name,
                desc: char.skill.description,
                type: char.skill.type,
                key: char.skill.key,
              },
            };
          }
          CK = Object.keys(C);
          hideLoader();
          if (window._HF_BATTLE_CFG) {
            const _cfg = window._HF_BATTLE_CFG;
            window._HF_BATTLE_CFG = null;
            // Restrict shop pool to active formation if provided
            const _fids = _cfg.formationHeroIds;
            _deckPool =
              Array.isArray(_fids) && _fids.length ? [..._fids] : null;
            if (_cfg.mode === "pvp") {
              pvpInit(_cfg);
            } else {
              startGame(_cfg.format || 5);
            }
          } else {
            // No battle config — user landed here directly; send back to lobby
            window.location.replace("/lobby");
          }
        } catch (err) {
          console.error(err);
          hideLoader();
          // Show a minimal error overlay so the user knows what went wrong
          const ov = document.createElement("div");
          ov.style.cssText =
            "position:fixed;inset:0;background:#03020e;display:flex;align-items:center;justify-content:center;z-index:300;color:#ff8888;font-size:13px;text-align:center;padding:24px";
          ov.innerHTML = `<div><div style="font-size:28px;margin-bottom:8px">⚠️</div><b>Could not connect to the server</b><br><br>${err.message}<br><br><a href="/lobby" style="color:#aa88ff">← Back to Lobby</a></div>`;
          document.body.appendChild(ov);
        }

        // ── Drag campo → barracas (setup único) ──
        const bw = document.getElementById("benchwrap");
        bw.addEventListener("dragenter", (e) => {
          if (G.fieldDrag !== null && G.phase === "shop") {
            e.preventDefault();
            bw.classList.add("bench-drop-over");
          }
        });
        bw.addEventListener("dragover", (e) => {
          if (G.fieldDrag !== null && G.phase === "shop") {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        });
        bw.addEventListener("dragleave", (e) => {
          if (!bw.contains(e.relatedTarget))
            bw.classList.remove("bench-drop-over");
        });
        bw.addEventListener("drop", (e) => {
          bw.classList.remove("bench-drop-over");
          const fromSlot = e.dataTransfer.getData("fromSlot");
          if (fromSlot !== "" && G.phase === "shop") {
            e.preventDefault();
            retBench(parseInt(fromSlot));
          }
        });
      }

      function skillIcon(key) {
        const m = {
          iron_defense: "🛡️",
          fireball: "🔥",
          precise_shot: "🎯",
          healing: "💚",
          sneak_strike: "⚡",
          sacred_aura: "✨",
          chain_lightning: "⛓️",
          fury: "😡",
        };
        return m[key] || "✨";
      }

      // ═══════════════════════════════════════════════════
      //  UNIT FACTORY
      // ═══════════════════════════════════════════════════
      let _uid = 0;
      function mkUnit(cid, lv = 1) {
        const c = C[cid],
          st = c.levels[lv];
        return {
          cid,
          lv,
          id: "u" + ++_uid,
          name: c.name,
          ico: c.ico,
          role: c.role,
          tp: c.tp,
          maxHp: st.max_hp,
          hp: st.max_hp,
          atk: Math.floor(st.atk),
          spd: st.atk_speed,
          critChance: st.crit_chance,
          critRate: st.crit_rate,
          skillPower: st.skill_power,
          stack: 1,
        };
      }
      function upgradeUnit(u) {
        const st = C[u.cid].levels[u.lv];
        u.maxHp = st.max_hp;
        u.hp = st.max_hp;
        u.atk = Math.floor(st.atk);
        u.spd = st.atk_speed;
        u.critChance = st.crit_chance;
        u.critRate = st.crit_rate;
        u.skillPower = st.skill_power;
        u.id = "u" + ++_uid;
        return u;
      }

      // Player shop draws only from the active deck pool (formation), bot uses full CK
      function playerRandCid() {
        const pool = _deckPool || CK;
        return pool[rnd(pool.length)];
      }

      // ═══════════════════════════════════════════════════
      //  GAME STATE
      // ═══════════════════════════════════════════════════
      const ARENAS = ["arena-forest", "arena-desert", "arena-snow"];
      //const ARENAS = ["arena-forest", "arena-desert"];
      const _arena = ARENAS[Math.floor(Math.random() * ARENAS.length)];
      document.body.style.backgroundImage = `url('/images/${_arena}.jpg')`;

      // ❌ Antes — estica e distorce a imagem
      //document.body.style.backgroundSize = "100% 100%";

      // ✅ Depois — mantém proporção e preenche a tela
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center center";

      let G = {
        format: 3,
        winsNeeded: 2,
        phase: "shop",
        duelNum: 1,
        battleNum: 1,
        duelScore: { p: 0, e: 0 },
        duelsWon: 0,
        duelsLost: 0,
        gold: 7,
        shop: [],
        shopCombo: null,
        shopCombos: [],
        bench: [],
        board: Array(9).fill(null),
        duelEnemy: Array(9).fill(null),
        enemy: Array(9).fill(null),
        bsel: null,
        fieldSel: null,
        fieldDrag: null,
        lastBattleResult: null,
        duelStats: {
          dmgP: 0,
          dmgE: 0,
          killsP: 0,
          killsE: 0,
          mergesP: 0,
          mergesE: 0,
          battles: [],
        },
        lastBoardSnap: [],
      };

      // ═══════════════════════════════════════════════════
      //  HELPERS
      // ═══════════════════════════════════════════════════
      function rnd(n) {
        return Math.floor(Math.random() * n);
      }
      function randCid() {
        return CK[rnd(CK.length)];
      }
      function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
          const j = rnd(i + 1);
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
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

      // ═══════════════════════════════════════════════════
      //  BENCH / ECONOMY
      // ═══════════════════════════════════════════════════
      function cardCost(cid) {
        return totalOwned(cid) > 0 ? 2 : HF.value_buy_card;
      }
      function totalOwned(cid) {
        return (
          (G.bench.some((u) => u.cid === cid) ? 1 : 0) +
          G.board.filter((u) => u && u.cid === cid).length
        );
      }

      function applyMerge(u) {
        while (u.stack >= 3 && u.lv < 5) {
          u.stack = u.stack - 3; // sobra exata após o merge
          u.lv++;
          upgradeUnit(u);
          G.duelStats.mergesP++;
        }
        u.stack = Math.min(u.stack, 3); // Sempre limita
        return u;
      }

      function _detectCombos() {
        const s = G.shop;
        const combos = [];
        const used = new Set();
        // Pass 1: adjacent triplets (combo 3)
        for (let i = 0; i <= 2; i++) {
          if (
            s[i] &&
            s[i + 1] &&
            s[i + 2] &&
            s[i].cid === s[i + 1].cid &&
            s[i].cid === s[i + 2].cid &&
            !used.has(i) &&
            !used.has(i + 1) &&
            !used.has(i + 2)
          ) {
            combos.push({
              type: 3,
              cids: [s[i].cid, s[i].cid, s[i].cid],
              idxs: [i, i + 1, i + 2],
              cost: HF.value_gold_combo3,
            });
            used.add(i);
            used.add(i + 1);
            used.add(i + 2);
          }
        }
        // Pass 2: adjacent pairs not already consumed by a triplet (combo 2)
        for (let i = 0; i <= 3; i++) {
          if (
            s[i] &&
            s[i + 1] &&
            s[i].cid === s[i + 1].cid &&
            !used.has(i) &&
            !used.has(i + 1)
          ) {
            combos.push({
              type: 2,
              cids: [s[i].cid, s[i].cid],
              idxs: [i, i + 1],
              cost: HF.value_gold_combo2,
            });
            used.add(i);
            used.add(i + 1);
          }
        }
        G.shopCombos = combos;
        G.shopCombo = combos.length > 0 ? combos[0] : null;
      }

      function genShop() {
        const slots = [];
        const r = Math.random();
        if (r < HF.value_chance_combo3) {
          const cid = playerRandCid();
          slots.push(
            mkUnit(cid, 1),
            mkUnit(cid, 1),
            mkUnit(cid, 1),
            mkUnit(playerRandCid(), 1),
            mkUnit(playerRandCid(), 1),
          );
        } else if (r < HF.value_chance_combo3 + HF.value_chance_combo2) {
          const pos = Math.floor(Math.random() * 4),
            cid = playerRandCid();
          for (let i = 0; i < 5; i++)
            slots.push(
              mkUnit(i === pos || i === pos + 1 ? cid : playerRandCid(), 1),
            );
        } else {
          for (let i = 0; i < 5; i++) slots.push(mkUnit(playerRandCid(), 1));
        }
        G.shop = slots;
        _detectCombos();
      }

      function rerollShop() {
        const cost = HF.value_new_recruitment;
        if (G.phase !== "shop" || G.gold < cost) {
          log(G.gold < cost ? `❌ Need ${cost}💰!` : "", "lk");
          return;
        }
        G.gold -= cost;
        genShop();
        render();
        log("🔄 New Recruitment! (−2💰)", "lr");
      }

      function showMergeBadge(el, lv) {
        const r = el.getBoundingClientRect();
        const badge = document.createElement("div");
        badge.className = "merge-badge";
        badge.textContent = `${LS[lv]} Level Up!`;
        badge.style.left = r.left + r.width / 2 + "px";
        badge.style.top = r.top + r.height / 2 + "px";
        document.body.appendChild(badge);
        badge.addEventListener("animationend", () => badge.remove(), {
          once: true,
        });
      }

      function _addToBench(card, cost, silent) {
        if (!canAddNewHero(card.cid)) {
          if (!silent)
            log("❌ Barracks full! Place a card on the field first.", "lk");
          return false;
        }
        const benchIdx = G.bench.findIndex((u) => u.cid === card.cid);
        const boardIdx = G.board.findIndex((u) => u && u.cid === card.cid);

        if (benchIdx >= 0) {
          const ex = G.bench[benchIdx];
          const prevLv = ex.lv;
          ex.stack = ex.stack + 1;
          applyMerge(ex);
          if (ex.lv > prevLv) {
            if (!silent)
              log(`✨ ${ex.name} evolved to ${LS[ex.lv]}! (Barracks)`, "ll");
            setTimeout(() => {
              document.querySelectorAll("#benchrow .bcard").forEach((bc) => {
                if (bc.dataset.cid === ex.cid) {
                  bc.classList.add("just-merged");
                  showMergeBadge(bc, ex.lv);
                  setTimeout(() => bc.classList.remove("just-merged"), 700);
                }
              });
            }, 40);
          } else {
            if (!silent)
              log(
                `🔗 ${card.name} stacked! (${ex.stack}/3 → ${LS[ex.lv + 1] || "MAX"})${cost === 2 ? " −2💰" : " −3💰"}`,
                "ll",
              );
            setTimeout(() => {
              document.querySelectorAll("#benchrow .bcard").forEach((bc) => {
                if (bc.dataset.cid === ex.cid) {
                  bc.classList.add("new-copy");
                  setTimeout(() => bc.classList.remove("new-copy"), 500);
                }
              });
            }, 40);
          }
        } else if (boardIdx >= 0) {
          const ex = G.board[boardIdx];
          const prevLv = ex.lv;
          ex.stack = ex.stack + 1;
          applyMerge(ex);
          if (ex.lv > prevLv) {
            if (!silent)
              log(`⚡ ${ex.name} evolved to ${LS[ex.lv]} on the field!`, "ll");
            setTimeout(() => {
              const f = document.querySelector(
                `#pfield [data-cid="${ex.cid}"]`,
              );
              if (f) {
                f.classList.add("mg");
                showMergeBadge(f, ex.lv);
                setTimeout(() => f.classList.remove("mg"), 700);
              }
            }, 40);
          } else {
            if (!silent)
              log(
                `🔗 ${card.name} stacked on field! (${ex.stack}/3 → ${LS[ex.lv + 1] || "MAX"})${cost === 2 ? " −2💰" : " −3💰"}`,
                "ll",
              );
            setTimeout(() => {
              const f = document.querySelector(
                `#pfield [data-cid="${ex.cid}"]`,
              );
              if (f) {
                f.classList.add("new-copy");
                setTimeout(() => f.classList.remove("new-copy"), 500);
              }
            }, 40);
          }
          render();
        } else {
          const newUnit = mkUnit(card.cid, 1);
          newUnit.stack = 1;
          G.bench.push(newUnit);
          if (!G._newBenchCids) G._newBenchCids = new Set();
          G._newBenchCids.add(card.cid);
          if (!silent) log(`🛒 Recruited ${card.name} for ${cost}💰`, "ll");
        }
        return true;
      }

      function _slideShop(idx) {
        if (idx < 0 || idx >= 5) return; // Proteção
        for (let i = idx; i < 4; i++) G.shop[i] = G.shop[i + 1];
        G.shop[4] = mkUnit(playerRandCid(), 1);
        _detectCombos();
      }

      function buyCard(idx) {
        if (G.phase !== "shop") return;
        const card = G.shop[idx];
        if (!card) return;
        const cost = cardCost(card.cid);
        if (G.gold < cost) {
          log(`❌ Need ${cost}💰! You have ${G.gold}💰`, "lk");
          return;
        }
        const shopEl = document.querySelector(
          `#shoprow .scard[data-uid="${card.id}"]`,
        );
        if (shopEl) shopEl.classList.add("scard-buy-flash");
        if (!_addToBench(card, cost, false)) return;
        G.gold -= cost;
        _slideShop(idx);
        render();
      }

      function buyCombo(combo) {
        if (G.phase !== "shop") return;
        combo = combo || G.shopCombo;
        if (!combo) return;
        const cost = combo.cost;
        if (G.gold < cost) {
          log(`❌ Need ${cost}💰! You have ${G.gold}💰`, "lk");
          return;
        }
        const cid = combo.cids[0];
        if (!canAddNewHero(cid)) {
          log("❌ Barracks full!", "lk");
          return;
        }
        combo.idxs.forEach((ci) => {
          const el = document.querySelector(
            `#shoprow .scard[data-uid="${G.shop[ci]?.id}"]`,
          );
          if (el) el.classList.add("scard-buy-flash");
        });
        G.gold -= cost;
        for (let k = 0; k < combo.type; k++)
          _addToBench({ cid, ico: C[cid].ico, name: C[cid].name }, 0, k > 0);
        log(
          `⚡ COMBO ${combo.type}! ${C[cid].name} ×${combo.type} for ${cost}💰!`,
          "ll",
        );
        [...combo.idxs]
          .sort((a, b) => b - a)
          .forEach((i) => {
            for (let j = i; j < 4; j++) G.shop[j] = G.shop[j + 1];
            G.shop[4] = mkUnit(playerRandCid(), 1);
          });
        _detectCombos();
        render();
      }

      function betweenIncome() {
        return 1 + G.battleNum;
      }

      // ═══════════════════════════════════════════════════
      //  BOARD MANAGEMENT
      // ═══════════════════════════════════════════════════
      function maxUnits() {
        return FIELD_MAX();
      }

      function placeUnit(i, cid = null) {
        if (G.phase !== "shop" || G.board[i]) return;
        if (G.board.filter(Boolean).length >= maxUnits()) {
          log(`❌ Field full! Max ${maxUnits()} heroes.`, "lk");
          return;
        }
        const selCid = cid || G.bsel;
        if (!selCid) return;
        const bidx = G.bench.findIndex((u) => u.cid === selCid);
        if (bidx < 0) {
          log("❌ Unit not found in barracks!", "lk");
          return;
        }
        G.board[i] = { ...G.bench[bidx] };
        G.bench.splice(bidx, 1);
        G.bsel = null;
        render();
      }

      function retBench(i) {
        if (G.phase !== "shop") return;
        const u = G.board[i];
        if (!u) return;
        G.board[i] = null;
        const existingIdx = G.bench.findIndex((b) => b.cid === u.cid);
        if (existingIdx >= 0) {
          const ex = G.bench[existingIdx];
          ex.stack = ex.stack + u.stack;
          applyMerge(ex);
        } else if (distinctHeroes() < BENCH_SLOTS()) {
          G.bench.push({ ...u });
        } else {
          G.board[i] = u;
          log("❌ Barracks full!", "lk");
        }
        render();
      }

      function restoreFieldHp() {
        G.board.forEach((u) => {
          if (!u) return;
          const st = C[u.cid]?.levels[u.lv];
          if (st) u.hp = u.maxHp = st.max_hp;
        });
      }

      // ═══════════════════════════════════════════════════
      //  BOT AI SYSTEM
      // ═══════════════════════════════════════════════════
      // difficulty: "easy" | "medium" | "hard"
      const BOT_DIFFICULTY = "hard";
      const BOT_CFG_TABLE = {
        easy: {
          mergeWeight: 0.7,
          adaptRate: 0.4,
          mistakeRate: 0.22,
          maxRerolls: 1,
        },
        medium: {
          mergeWeight: 0.88,
          adaptRate: 0.7,
          mistakeRate: 0.08,
          maxRerolls: 2,
        },
        hard: {
          mergeWeight: 1.1,
          adaptRate: 1.0,
          mistakeRate: 0.0,
          maxRerolls: 4,
        },
      };
      const BOT_CFG = { label: "🤖 AI", ...BOT_CFG_TABLE[BOT_DIFFICULTY] };
      const FRONT_SLOTS = [2, 5, 8, 1, 4, 7],
        MID_SLOTS = [1, 4, 7],
        BACK_SLOTS = [0, 3, 6];
      const ROLE_SLOT = {
        Tank: FRONT_SLOTS,
        Paladin: FRONT_SLOTS,
        Assassin: MID_SLOTS,
        Support: MID_SLOTS,
        Mage: BACK_SLOTS,
        Archmage: BACK_SLOTS,
        Shooter: BACK_SLOTS,
      };
      // Bot uses inverted columns: col 0 = closest to player (bot's front), col 2 = bot's back
      const BOT_ROLE_SLOT = {
        Tank: BACK_SLOTS,
        Paladin: BACK_SLOTS,
        Assassin: MID_SLOTS,
        Support: MID_SLOTS,
        Mage: FRONT_SLOTS,
        Archmage: FRONT_SLOTS,
        Shooter: FRONT_SLOTS,
      };
      const UNIT_SCORE = {
        knight: 6,
        paladin: 7,
        barbarian: 6,
        healer: 8,
        assassin: 9,
        archer: 7,
        mage: 8,
        archmage: 10,
      };
      const LM = [0, 1.0, 1.3, 1.6, 1.9, 2.2];

      let BOT = {
        gold: 7,
        bench: [],
        board: Array(9).fill(null),
        shop: [],
        lastResult: null,
        battleNum: 1,
        threatMap: {},
      };

      function botCardCost(cid) {
        return BOT.bench.some((u) => u.cid === cid) ||
          BOT.board.some((u) => u && u.cid === cid)
          ? 2
          : 3;
      }
      function botApplyMerge(u) {
        while (u.stack >= 3 && u.lv < 5) {
          u.stack = u.stack - 3;
          u.lv++;
          upgradeUnit(u);
        }
        if (u.stack > 3) u.stack = 3;
        return u;
      }
      function botGenShop() {
        BOT.shop = Array.from({ length: 5 }, () => mkUnit(randCid(), 1));
      }

      function botScoreCard(cid) {
        let score = UNIT_SCORE[cid] || 5;
        const owned =
          BOT.bench.find((u) => u.cid === cid) ||
          BOT.board.find((u) => u && u.cid === cid);
        if (owned) {
          score += BOT_CFG.mergeWeight * 8;
          if (owned.stack === 2) score += 7;
        }
        if (Math.random() < BOT_CFG.mistakeRate) score += rnd(6) - 3;
        const topThreats = Object.keys(BOT.threatMap)
          .sort((a, b) => BOT.threatMap[b] - BOT.threatMap[a])
          .slice(0, 2);
        topThreats.forEach((threat) => {
          const w = BOT_CFG.adaptRate;
          if (threat === "assassin" && (cid === "knight" || cid === "paladin"))
            score += w * 5;
          if (
            threat === "archmage" &&
            (cid === "knight" || cid === "barbarian")
          )
            score += w * 4;
          if (threat === "mage" && cid === "assassin") score += w * 4;
          if (threat === "archer" && (cid === "knight" || cid === "healer"))
            score += w * 3;
          if (threat === "barbarian" && cid === "assassin") score += w * 3;
          if (threat === "healer" && cid === "archmage") score += w * 4;
        });
        return score;
      }

      function botBuyPhase() {
        const REROLL_COST = HF.value_new_recruitment;
        // Bot collection cap: double the player bench — lets it accumulate units across rounds
        // without hitting a hard wall. botPosition always picks the best N for the board.
        const COLLECTION_MAX = BENCH_SLOTS() * 2;

        function buyBest() {
          if (BOT.bench.length >= COLLECTION_MAX) return false;
          const candidates = BOT.shop
            .map((card, i) =>
              card
                ? {
                    i,
                    cid: card.cid,
                    cost: botCardCost(card.cid),
                    score: botScoreCard(card.cid),
                  }
                : null,
            )
            .filter((c) => c && BOT.gold >= c.cost)
            .sort((a, b) => b.score - a.score);
          if (!candidates.length) return false;

          const pick = candidates[0];
          BOT.gold -= pick.cost;
          BOT.shop[pick.i] = null;
          const existing = BOT.bench.find((u) => u.cid === pick.cid);
          if (existing) {
            existing.stack++;
            botApplyMerge(existing);
          } else {
            const nu = mkUnit(pick.cid, 1);
            nu.stack = 1;
            BOT.bench.push(nu);
          }
          return true;
        }

        // 1. Buy everything affordable from current shop
        while (buyBest()) {}

        // 2. Reroll if we still have room and gold — but not if there are merge targets waiting
        let rerolls = 0;
        while (
          rerolls < BOT_CFG.maxRerolls &&
          BOT.gold >= REROLL_COST + 2 &&
          BOT.bench.length < COLLECTION_MAX
        ) {
          const hasMerge = BOT.shop.some(
            (s) => s && BOT.bench.some((u) => u.cid === s.cid),
          );
          if (hasMerge) break; // finish buying merge targets first
          BOT.gold -= REROLL_COST;
          botGenShop();
          rerolls++;
          while (buyBest()) {}
        }
      }

      function botPosition() {
        BOT.board = Array(9).fill(null);
        const maxSlots = Math.min(3 + G.duelNum, 9);
        const pool = [...BOT.bench].sort(
          (a, b) =>
            (UNIT_SCORE[b.cid] || 5) * LM[b.lv] -
            (UNIT_SCORE[a.cid] || 5) * LM[a.lv],
        );
        const used = new Set();
        const place = (u, preferred) => {
          for (const s of preferred) {
            if (!BOT.board[s]) {
              BOT.board[s] = { ...u };
              used.add(u.cid);
              return true;
            }
          }
          for (let s = 0; s < 9; s++) {
            if (!BOT.board[s]) {
              BOT.board[s] = { ...u };
              used.add(u.cid);
              return true;
            }
          }
          return false;
        };
        let placed = 0;
        for (const u of pool) {
          if (placed >= maxSlots) break;
          if (place(u, BOT_ROLE_SLOT[C[u.cid].role] || MID_SLOTS)) placed++;
        }
        BOT.bench = BOT.bench.filter((u) => !used.has(u.cid));
      }

      function botNextBattle(playerWon) {
        BOT.lastResult = playerWon ? "loss" : "win";
        BOT.battleNum++;
        const inc = 1 + G.battleNum; // same formula as player, no win bonus
        BOT.gold += inc;
        BOT.board.forEach((u) => {
          if (!u) return;
          const ex = BOT.bench.find((b) => b.cid === u.cid);
          if (ex) {
            ex.stack = ex.stack + u.stack;
            botApplyMerge(ex);
          } else if (BOT.bench.length < BENCH_SLOTS()) BOT.bench.push({ ...u });
        });
        BOT.board = Array(9).fill(null);
      }

      function botLearnFromBattle(evs, umap) {
        evs
          .filter((e) => e.type === "atk" || e.type === "kill")
          .forEach((ev) => {
            const attacker = umap[ev.uid];
            if (!attacker || attacker.side !== "p") return;
            BOT.threatMap[attacker.cid] =
              (BOT.threatMap[attacker.cid] || 0) + ev.amt;
          });
      }

      function botRunTurn() {
        botGenShop();
        botBuyPhase();
        botPosition();
      }

      function botInitDuel() {
        BOT.gold = START_GOLD();
        BOT.bench = [];
        BOT.board = Array(9).fill(null);
        BOT.shop = [];
        BOT.lastResult = null;
        BOT.battleNum = 1;
        BOT.threatMap = {};
        botRunTurn();
      }

      // ═══════════════════════════════════════════════════
      //  SIMULATION
      // ═══════════════════════════════════════════════════
      function simulate(pb, eb) {
        const ps = pb
          .map((u, i) =>
            u
              ? { ...u, slot: i, side: "p", alive: true, enraged: false }
              : null,
          )
          .filter(Boolean);
        const es = eb
          .map((u, i) =>
            u
              ? { ...u, slot: i, side: "e", alive: true, enraged: false }
              : null,
          )
          .filter(Boolean);
        const evs = [];
        let tick = 0;
        const foes = (s) =>
          s === "p" ? es.filter((u) => u.alive) : ps.filter((u) => u.alive);
        const alliesOf = (s) =>
          s === "p" ? ps.filter((u) => u.alive) : es.filter((u) => u.alive);

        function dealDmg(atk, tgt, d, isCrit = false) {
          let dmg = d;
          if (tgt.cid === "knight")
            dmg = Math.floor(dmg * (1 - tgt.skillPower));
          tgt.hp = Math.max(0, tgt.hp - dmg);
          if (tgt.hp <= 0) {
            tgt.alive = false;
            evs.push({
              type: "kill",
              uid: atk.id,
              tid: tgt.id,
              amt: dmg,
              isCrit,
              tick,
            });
          } else
            evs.push({
              type: "atk",
              uid: atk.id,
              tid: tgt.id,
              amt: dmg,
              isCrit,
              tick,
            });
        }

        function applyStart(units) {
          units.forEach((u) => {
            if (u.cid !== "paladin") return;
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

        // Player Sacred Aura was already applied to G.board before simulate() was called;
        // the ps copies inherit those boosted values, so we skip applyStart(ps) here.
        applyStart(es);

        function applySneak(units, foeSide) {
          units
            .filter((u) => u.cid === "assassin")
            .forEach((u) => {
              const targets = foeSide.filter((f) => f.alive);
              if (!targets.length) return;

              const t = [...targets].sort((a, b) => a.hp - b.hp)[0];
              const sneakDmg = Math.floor(u.atk * u.skillPower);

              evs.push({
                type: "ability",
                uid: u.id,
                targetId: t.id,
                abilName: "Sneak Strike",
                amount: sneakDmg,
                tick,
              });

              dealDmg(u, t, sneakDmg, false);
            });
        }

        applySneak(ps, es);
        applySneak(es, ps);

        function pickTarget(unit) {
          const f = foes(unit.side);
          if (!f.length) return null;

          const isM = (u) => u.tp !== "ranged";
          const unitRow = Math.floor(unit.slot / 3);

          // "Front" of the target side depends on the attacker:
          //   Player (side "p") attacks enemy: enemy col 0 is closest → ascending
          //   Enemy  (side "e") attacks player: player col 2 is closest → descending
          const colCmp =
            unit.side === "p"
              ? (a, b) => (a.slot % 3) - (b.slot % 3) // col 0 first (enemy front)
              : (a, b) => (b.slot % 3) - (a.slot % 3); // col 2 first (player front)

          const bestInRow = (row) => {
            const units = f.filter((e) => Math.floor(e.slot / 3) === row);
            if (!units.length) return null;
            return units.slice().sort((a, b) => {
              const cc = colCmp(a, b);
              if (cc !== 0) return cc;
              return isM(a) === isM(b) ? 0 : isM(a) ? -1 : 1;
            })[0];
          };

          // Ordem de busca: linha própria → linhas adjacentes por proximidade.
          // No mobile vertical (player embaixo, inimigo em cima) as linhas são espelhadas:
          // pfield row 0 = frente do player (topo, perto do VS) ↔ efield row 2 = frente inimiga.
          // Por isso invertemos o índice de busca com (2 - unitRow) quando mobileVertical.
          const searchRow = window.mobileVertical ? 2 - unitRow : unitRow;
          if (searchRow === 0) {
            return bestInRow(0) || bestInRow(1) || bestInRow(2) || null;
          }
          if (searchRow === 2) {
            return bestInRow(2) || bestInRow(1) || bestInRow(0) || null;
          }
          // Linha B: própria primeiro, depois A e C aleatório
          const t = bestInRow(1);
          if (t) return t;
          const tA = bestInRow(0),
            tC = bestInRow(2);
          if (tA && tC) return Math.random() < 0.5 ? tA : tC;
          return tA || tC || null;
        }

        const isMelee = (u) => u.tp !== "ranged";
        function buildQueue() {
          return [...ps, ...es]
            .filter((u) => u.alive)
            .sort((a, b) => {
              if (Math.abs(b.spd - a.spd) > 0.001) return b.spd - a.spd;
              if (isMelee(a) !== isMelee(b)) return isMelee(a) ? -1 : 1;
              if (b.lv !== a.lv) return b.lv - a.lv;
              return Math.random() - 0.5;
            });
        }
        let queue = buildQueue();

        function emitQueue() {
          evs.push({
            type: "queue",
            order: queue.filter((u) => u.alive).map((u) => u.id),
            tick,
          });
        }
        emitQueue();

        let safety = 2000;
        while (safety-- > 0) {
          const pa = ps.filter((u) => u.alive),
            ea = es.filter((u) => u.alive);
          if (!pa.length || !ea.length) break;
          queue = queue.filter((u) => u.alive);
          if (!queue.length) {
            queue = buildQueue();
            if (!queue.length) break;
          }
          emitQueue();
          const unit = queue.shift();
          if (!unit.alive) continue;

          if (
            unit.cid === "barbarian" &&
            !unit.enraged &&
            unit.hp < unit.maxHp * 0.6
          ) {
            unit.enraged = true;
            unit.atk = Math.floor(unit.atk * (1 + unit.skillPower));
            evs.push({ type: "ability", uid: unit.id, abilName: "Fury", tick });
          }

          if (unit.cid === "healer") {
            const al = alliesOf(unit.side).filter(
              (a) => a.id !== unit.id && a.alive && a.hp < a.maxHp,
            );
            if (al.length) {
              const target = [...al].sort(
                (a, b) => a.hp / a.maxHp - b.hp / b.maxHp,
              )[0];
              const h = Math.floor(unit.atk * unit.skillPower);
              target.hp = Math.min(target.maxHp, target.hp + h);
              evs.push({
                type: "heal",
                uid: unit.id,
                tid: target.id,
                amt: h,
                tick,
              });
              evs.push({
                type: "ability",
                uid: unit.id,
                abilName: "Healing",
                tick,
                silent: true,
              });
            }
            const et = pickTarget(unit);
            if (et && et.alive) dealDmg(unit, et, unit.atk);
          } else {
            const t = pickTarget(unit);

            if (t && t.alive) {
              let dmg = unit.atk,
                isCrit = false;

              const effCC =
                unit.critChance + (unit.cid === "archer" ? unit.skillPower : 0);
              const effCR = unit.critRate;

              if (Math.random() < effCC) {
                isCrit = true;
                dmg = Math.floor(dmg * effCR);
              }

              dealDmg(unit, t, dmg, isCrit);
              if (unit.cid === "archer" && isCrit) {
                evs.push({
                  type: "ability",
                  uid: unit.id,
                  abilName: "Precise Shot",
                  tick,
                  silent: true,
                });
              }
              if (unit.cid === "mage") {
                const adj = adjacentSlots(t.slot);
                const splash = foes(unit.side).filter(
                  (f) => f.id !== t.id && f.alive && adj.includes(f.slot),
                );
                if (splash.length) {
                  splash.forEach((f) =>
                    dealDmg(unit, f, Math.floor(unit.atk * unit.skillPower)),
                  );
                  evs.push({
                    type: "ability",
                    uid: unit.id,
                    abilName: "Fireball",
                    tick,
                    silent: true,
                  });
                }
              }
              if (unit.cid === "archmage") {
                // Chain goes deeper into the TARGET's territory.
                // Player (side "p") → higher col (col 0→1→2 into enemy back)
                // Enemy  (side "e") → lower  col (col 2→1→0 into player back)
                const targetRow = Math.floor(t.slot / 3);
                const primaryCol = t.slot % 3;
                const goDeeper =
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
                  .sort(
                    (a, b) =>
                      unit.side === "p"
                        ? (a.slot % 3) - (b.slot % 3) // ascending: next col toward back
                        : (b.slot % 3) - (a.slot % 3), // descending: next col toward back
                  );
                if (chain.length > 0)
                  dealDmg(
                    unit,
                    chain[0],
                    Math.floor(unit.atk * unit.skillPower),
                  );
                if (chain.length > 1)
                  dealDmg(
                    unit,
                    chain[1],
                    Math.floor((unit.atk * unit.skillPower) / 2),
                  );
              }
            }
          }
          if (unit.alive) queue.push(unit);
          tick++;
        }

        const pa = ps.filter((u) => u.alive),
          ea = es.filter((u) => u.alive);
        let winner;
        if (pa.length && !ea.length) winner = "p";
        else if (ea.length && !pa.length) winner = "e";
        else {
          const ph = pa.reduce((s, u) => s + u.hp, 0),
            eh = ea.reduce((s, u) => s + u.hp, 0);
          winner = ph >= eh ? "p" : "e";
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
          winner,
          umap,
          stats: {
            dmgP,
            dmgE,
            killsP,
            killsE,
            survP: pa.length,
            survE: ea.length,
            boardSnap: [...ps],
            enemySnap: [...es],
          },
        };
      }

      // ═══════════════════════════════════════════════════
      //  PLAYBACK
      // ═══════════════════════════════════════════════════
      let btimer = null;
      const ABILOG = {
        "Sacred Aura":
          "✨ {n}: Sacred Aura! Adjacent allies gained max HP bonus.",
        "Sneak Strike": "⚡ {n}: Sneak Strike! Targeting lowest HP enemy...",
        Fury: "😡 {n}: FURY! Attack permanently increased.",
        Fireball: "🔥 {n}: Fireball! Splash damage to adjacent targets.",
        Healing: "💚 {n}: Healing! Restoring the most wounded ally.",
        "Precise Shot": "🎯 {n}: Precise Shot! Critical hit landed.",
      };

      let _tpPrev = [];
      function renderTurnPanel(order, umap, dHp) {
        const panel = document.getElementById("turnpanel"),
          list = document.getElementById("tp-list");
        if (!list) return;
        panel.classList.remove("hidden");
        const MAX = 10,
          newOrder = order.slice(0, MAX);
        const actedUid =
          _tpPrev.length && _tpPrev[0] !== newOrder[0] ? _tpPrev[0] : null;
        const prevSet = new Set(_tpPrev);
        _tpPrev = newOrder.slice();

        const build = () => {
          list.innerHTML = "";
          newOrder.forEach((uid, i) => {
            const u = umap[uid];
            if (!u) return;
            const isLastAndNew =
              i === newOrder.length - 1 &&
              (!prevSet.has(uid) || uid === actedUid);
            const div = document.createElement("div");
            div.className =
              "tp-entry tp-" +
              u.side +
              (i === 0 ? " tp-now" : "") +
              (isLastAndNew ? " tp-enter" : "");
            div.dataset.tpuid = uid;
            const stars = "★".repeat(u.lv || 1);
            const curHp =
              dHp && dHp[uid] !== undefined ? dHp[uid] : u.hp || u.maxHp;
            const hpPct =
              u.maxHp > 0
                ? Math.max(0, Math.round((curHp / u.maxHp) * 100))
                : 100;
            const hpCol =
              hpPct < 30 ? "#ff4444" : hpPct < 60 ? "#ffaa33" : "#44cc88";
            const hpFill = Math.max(0, Math.min(100, hpPct)); // Garante 0-100%
            div.innerHTML = `<span class="tp-ico">${u.ico}</span><span class="tp-info"><span class="tp-name">${u.name}</span><span class="tp-stars">${stars}</span><div class="tp-hp"><div class="tp-hp-fill" style="width:${hpPct}%;background:${hpCol}"></div></div></span>${i === 0 ? '<span class="tp-now-arrow">▶</span>' : ""}`;
            list.appendChild(div);
          });
        };

        if (actedUid) {
          const exitEl = list.querySelector('[data-tpuid="' + actedUid + '"]');
          if (exitEl) {
            exitEl.classList.add("tp-exit");
            setTimeout(build, 130);
          } else build();
        } else build();
      }

      function hideTurnPanel() {
        document.getElementById("turnpanel")?.classList.add("hidden");
        _tpPrev = [];
      }

      // ── Global phase timer (AI mode) ──────────────────────────────────────
      let _aiTimerInterval = null;

      function startPhaseTimer(ms) {
        if (window._PVP) return; // PvP uses server-driven timer inside pvpInit
        stopPhaseTimer();
        const el = document.getElementById("phase-timer");
        if (!el) return;
        el.style.display = "block";
        let remaining = Math.ceil(ms / 1000);
        function tick() {
          const m = Math.floor(remaining / 60);
          const s = remaining % 60;
          el.textContent = `⏱ ${m}:${String(s).padStart(2, "0")}`;
          el.classList.toggle("timer-urgent", remaining <= 30);
          if (remaining <= 0) {
            stopPhaseTimer();
            el.textContent = "⏱ 0:00";
            startBattle();
          }
        }
        tick();
        _aiTimerInterval = setInterval(() => {
          remaining--;
          tick();
        }, 1000);
      }

      function stopPhaseTimer() {
        if (_aiTimerInterval) {
          clearInterval(_aiTimerInterval);
          _aiTimerInterval = null;
        }
        const el = document.getElementById("phase-timer");
        if (el) {
          el.style.display = "none";
          el.classList.remove("timer-urgent");
        }
      }

      function updateFieldLabels() {
        const user = window._HF_SESSION?.username || "";
        const pvp = window._PVP;
        const lp = document.getElementById("lbl-player");
        const le = document.getElementById("lbl-enemy");
        const lse = document.getElementById("lbl-score-enemy");
        if (lp) {
          lp.textContent = "";
          lp.parentElement.style.display = "none";
        }
        if (le) {
          le.textContent = "";
          le.parentElement.style.display = "none";
        }
        if (lse) lse.textContent = pvp?.opponent ? `@${pvp.opponent}` : "Enemy";
      }

      function setShopLocked(locked) {
        document
          .getElementById("shopwrap")
          ?.classList.toggle("shop-collapsed", locked);
        document
          .getElementById("benchwrap")
          ?.classList.toggle("shop-collapsed", locked);
      }

      function startBattle() {
        if (!G.board.filter(Boolean).length) {
          log(
            "❌ No fighters on field! Click a Barracks card to select it, then click an empty slot on your field.",
            "lk",
          );
          return;
        }
        stopPhaseTimer();
        if (window._PVP?.stopRoundTimer) window._PVP.stopRoundTimer();
        setShopLocked(true);

        // ── PvP mode: submit team to server and wait ──────
        if (window._PVP) {
          const pvp = window._PVP;
          // Prefix unit IDs with side token to prevent collisions in server umap.
          // Both clients generate sequential IDs (u1, u2…) independently;
          // without a prefix, umap[u1] from p1 would overwrite umap[u1] from p2.
          const _pfx = pvp.isP1 ? "p1:" : "p2:";
          pvp._idPrefix = _pfx;
          const board = G.board.map((u) =>
            u ? { ...u, id: _pfx + u.id } : null,
          );
          // Also prefix bench so merges/combos keep consistent IDs
          G.bench = G.bench.map((u) => (u ? { ...u, id: _pfx + u.id } : null));
          // Update board in-place so DOM render matches submitted IDs
          G.board = G.board.map((u) => (u ? { ...u, id: _pfx + u.id } : null));
          pvp._idsPrefixed = true;
          const btn = document.getElementById("bfight");
          if (btn) {
            btn.disabled = true;
            btn.textContent = "⏳ Waiting for opponent...";
          }
          G.phase = "waiting";
          log("📤 Team submitted! Waiting for opponent...", "lr");
          setBanner(
            `⏳ Battle ${G.battleNum}/${G.format} — waiting for opponent`,
            "bbattle",
          );
          pvp.socket.emit("submit_team", {
            matchId: pvp.matchId,
            board,
            merges: G.duelStats.mergesP,
          });
          return;
        }

        // ── AI mode ───────────────────────────────────────
        G.phase = "battle";
        G.enemy = G.duelEnemy.map((u) => (u ? { ...u } : null));
        G.fieldSel = null;
        G.fieldDrag = null;

        // Apply Sacred Aura bonus to G.board units before render/simulate
        // so the displayed HP and simulation base both use the boosted value.
        // (simulate's applyStart only runs for enemy side now — no double-apply)
        const _auraData = new Map(); // paladin_id → { ally_id: bonus }
        for (let s = 0; s < 9; s++) {
          const pal = G.board[s];
          if (!pal || pal.cid !== "paladin") continue;
          const bonusMap = {};
          adjacentSlots(s).forEach((as) => {
            const ally = G.board[as];
            if (ally && ally.cid !== "paladin") {
              const bonus = Math.floor(ally.maxHp * pal.skillPower);
              ally.maxHp += bonus;
              ally.hp += bonus;
              bonusMap[ally.id] = bonus;
            }
          });
          _auraData.set(pal.id, bonusMap);
        }

        document.getElementById("log").innerHTML = "";
        log("⚔️ Battle begins!", "lr");
        setBanner(
          `⚔️ Battle ${G.battleNum}/${G.format} in progress...`,
          "bbattle",
        );
        render();
        const res = simulate(G.board, G.enemy);
        botLearnFromBattle(res.evs, res.umap);
        // Inject player-side Sacred Aura events so the prep phase can animate them
        // (simulate only adds enemy-side Sacred Aura; player side was pre-applied)
        _auraData.forEach((bonusMap, pid) => {
          res.evs.unshift({
            type: "ability",
            uid: pid,
            abilName: "Sacred Aura",
            tick: -1,
            auraBonus: bonusMap,
          });
        });
        playback(res);
      }

      function playback({ evs, winner, umap, stats }) {
        clearTimeout(btimer); // Adicione isto
        btimer = null;
        const dHp = {};
        Object.values(umap).forEach((u) => (dHp[u.id] = u.maxHp));
        const sneakHitEls = new Set();
        const tg = {};
        evs
          .filter((e) => e.tick >= 0)
          .forEach((e) => {
            (tg[e.tick] = tg[e.tick] || []).push(e);
          });
        const tks = Object.keys(tg)
          .map(Number)
          .sort((a, b) => a - b);
        let fi = 0;
        const initQ = evs.find((e) => e.type === "queue" && e.tick === 0);
        if (initQ) renderTurnPanel(initQ.order, umap, dHp);

        function gEl(u) {
          return document.querySelector(
            `#${u.side === "p" ? "p" : "e"}field [data-uid="${u.id}"]`,
          );
        }

        // Phase 4 VFX helpers
        function flashUnit(el, cls) {
          el.classList.remove(cls);
          void el.offsetWidth;
          el.classList.add(cls);
          setTimeout(() => el.classList.remove(cls), getBattleFxDuration(600));
        }

        function flashDamage(el) {
          if (!el) return;
          el.classList.remove("hit");
          void el.offsetWidth;
          el.classList.add("hit");

          clearTimeout(el._hitT);
          el._hitT = setTimeout(() => {
            el.classList.remove("hit");
          }, getBattleFxDuration(340));
        }

        function spawnFloat(el, text, type) {
          const r = el.getBoundingClientRect();
          const d = document.createElement("span");
          d.className = "dmg-float " + type;
          d.textContent = text;
          d.style.left = r.left + r.width * 0.5 - 12 + "px";
          d.style.top = r.top + r.height * 0.2 + "px";
          document.body.appendChild(d);
          setTimeout(() => d.remove(), getBattleFxDuration(950));
        }

        function auraFloat(el, text) {
          const r = el.getBoundingClientRect();
          const d = document.createElement("span");
          d.className = "dmg-float aura-buff";
          d.textContent = text;
          d.style.left = r.left + r.width * 0.5 + "px";
          d.style.top = r.top + r.height * 0.1 + "px";
          document.body.appendChild(d);
          setTimeout(() => d.remove(), getBattleFxDuration(1350));
        }

        function getCenter(el) {
          const r = el.getBoundingClientRect();
          return {
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          };
        }

        function spawnImpact(targetEl) {
          const p = getCenter(targetEl);
          const ring = document.createElement("span");
          ring.className = "impact-ring";
          ring.style.left = p.x + "px";
          ring.style.top = p.y + "px";
          document.body.appendChild(ring);
          setTimeout(() => ring.remove(), getBattleFxDuration(320));
        }

        function animateMeleeAttack(attackerEl, targetEl) {
          const a = getCenter(attackerEl);
          const t = getCenter(targetEl);
          const dx = t.x - a.x;
          const dy = t.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const reach = Math.min(28, dist * 0.18);

          const tx = (dx / dist) * reach;
          const ty = (dy / dist) * reach;

          attackerEl.animate(
            [
              { transform: "translate(0px, 0px) scale(1)" },
              {
                transform: `translate(${tx * 0.82}px, ${ty * 0.82}px) scale(1.06)`,
                offset: 0.3,
              },
              {
                transform: `translate(${tx}px, ${ty}px) scale(1.02)`,
                offset: 0.55,
              },
              { transform: "translate(0px, 0px) scale(1)" },
            ],
            {
              duration: getBattleFxDuration(260),
              easing: "cubic-bezier(0.18, 0.9, 0.22, 1)",
              fill: "none",
            },
          );
        }

        function spawnProjectile(attackerEl, targetEl) {
          const a = getCenter(attackerEl);
          const t = getCenter(targetEl);
          const dx = t.x - a.x;
          const dy = t.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const rot = Math.atan2(dy, dx) * (180 / Math.PI);

          const p = document.createElement("span");
          p.className = "projectile ranged";
          p.style.left = a.x + "px";
          p.style.top = a.y + "px";
          p.style.setProperty("--dx", `${dx}px`);
          p.style.setProperty("--dy", `${dy}px`);
          p.style.setProperty("--rot", `${rot}deg`);
          p.style.setProperty("--dist", `${dist}px`);
          document.body.appendChild(p);

          setTimeout(() => p.remove(), getBattleFxDuration(300));
        }

        function animateAttack(attackerEl, targetEl, attackerUnit) {
          if (!attackerEl || !targetEl || !attackerUnit) return;

          if (attackerUnit.tp === "ranged") {
            spawnProjectile(attackerEl, targetEl);
          } else {
            animateMeleeAttack(attackerEl, targetEl);
          }

          setTimeout(
            () => {
              spawnImpact(targetEl);
            },
            getBattleFxDuration(attackerUnit.tp === "ranged" ? 220 : 145),
          );
        }

        function spawnSneakSmoke(attackerEl, targetEl) {
          const a = getCenter(attackerEl);
          const t = getCenter(targetEl);

          const smoke = document.createElement("span");
          smoke.className = "sneak-smoke";
          smoke.style.left = a.x + "px";
          smoke.style.top = a.y + "px";
          smoke.style.setProperty("--dx", `${t.x - a.x}px`);
          smoke.style.setProperty("--dy", `${t.y - a.y}px`);
          document.body.appendChild(smoke);

          setTimeout(() => smoke.remove(), getBattleFxDuration(760));
        }

        function spawnSneakSlash(targetEl, rotDeg = -25, ox = 0, oy = 0) {
          const p = getCenter(targetEl);
          const slash = document.createElement("span");
          slash.className = "sneak-slash";
          slash.style.left = `${p.x + ox}px`;
          slash.style.top = `${p.y + oy}px`;
          slash.style.setProperty("--rot", `${rotDeg}deg`);
          document.body.appendChild(slash);

          setTimeout(() => slash.remove(), getBattleFxDuration(260));
        }

        function playSneakStrike(attackerEl, targetEl, amount, targetUnit) {
          if (!attackerEl || !targetEl) return;

          spawnSneakSlash(
            targetEl,
            -28 + Math.round(Math.random() * 10),
            -6 + Math.round(Math.random() * 8),
            -4 + Math.round(Math.random() * 8),
          );

          setTimeout(() => {
            spawnSneakSlash(
              targetEl,
              24 + Math.round(Math.random() * 12),
              6 - Math.round(Math.random() * 8),
              4 - Math.round(Math.random() * 8),
            );

            sneakHitEls.add(targetEl);

            // brilho próprio do Sneak Strike, sem usar o hit branco genérico
            targetEl.classList.remove("vfx-sneak-hit");
            void targetEl.offsetWidth;
            targetEl.classList.add("vfx-sneak-hit");

            spawnImpact(targetEl);
            spawnFloat(targetEl, "−" + amount, "sneak-crit");

            if (targetUnit && amount > 0) {
              dHp[targetUnit.id] = Math.max(0, dHp[targetUnit.id] - amount);
              updHp(targetUnit);
            }
          }, getBattleFxDuration(130));
        }

        function updHp(u, isHeal = false) {
          const el = gEl(u);
          if (!el) return;
          const b = el.querySelector(".uhf");
          if (!b) return;
          const cur = Math.max(0, dHp[u.id]);
          const r = cur / u.maxHp;
          b.style.width = `${r * 100}%`;
          b.className = "uhf " + (r < 0.3 ? "lo" : r < 0.6 ? "mid" : "hi");
          el.classList.toggle("low-hp", r < 0.3);
          const hpNum = el.querySelector("[data-uhp]");
          if (hpNum) {
            hpNum.textContent = Math.round(cur);
            const base = hpNum.className.replace(/\bhp-\w+/g, "").trim();
            const finalCls = r < 0.3 ? "hp-lo" : r < 0.6 ? "hp-mid" : "";
            if (isHeal) {
              // Fade to green, then fade to final colour
              hpNum.className = base + " hp-hi";
              clearTimeout(hpNum._healT);
              hpNum._healT = setTimeout(() => {
                hpNum.className = base + (finalCls ? " " + finalCls : "");
              }, 350);
            } else {
              hpNum.className = base + (finalCls ? " " + finalCls : "");
            }
          }
        }

        function updAtk(u) {
          const el = gEl(u);
          if (!el) return;
          const atkNum = el.querySelector("[data-uatk]");
          if (!atkNum) return;
          atkNum.textContent = u.atk;
          atkNum.classList.add("atk-fury");
        }

        function frame() {
          if (fi >= tks.length) {
            hideTurnPanel();
            endBattle(winner, stats);
            return;
          }
          const el = tg[tks[fi++]];
          const seen = new Set();
          let tickDelay = getBattleFrameDelay();
          el.forEach((ev) => {
            const u = umap[ev.uid],
              t = ev.tid && umap[ev.tid];
            if (ev.type === "queue") {
              renderTurnPanel(ev.order, umap, dHp);
            } else if (
              ev.type === "ability" &&
              !ev.silent &&
              !seen.has(ev.uid + ev.abilName)
            ) {
              seen.add(ev.uid + ev.abilName);
              if (ev.abilName === "Fury" && u) updAtk(u);
              const eSkill = u && gEl(u);
              const target = ev.targetId ? umap[ev.targetId] : null;
              const eTarget = target ? gEl(target) : null;
              if (eSkill) flashUnit(eSkill, "vfx-skill");
              if (ev.abilName === "Sneak Strike" && eSkill && eTarget) {
                playSneakStrike(eSkill, eTarget, ev.amount || 0, target);
                tickDelay = Math.max(tickDelay, getBattleFxDuration(980));
              }
              log(
                (ABILOG[ev.abilName] || "✨ {n}: " + ev.abilName).replace(
                  "{n}",
                  u ? nameTag(u) : "?",
                ),
                "lab",
                true,
              );
            } else if (ev.type === "heal" && t) {
              dHp[t.id] = Math.min(t.maxHp, dHp[t.id] + ev.amt);
              updHp(t, true);
              const eHeal = gEl(t);
              if (eHeal) {
                flashUnit(eHeal, "vfx-heal");
                spawnFloat(eHeal, "+" + ev.amt, "heal");
              }
              log(
                `${uTag(u)} <span class="lheal">heals</span> ${uTag(t)} <span class="lheal">+${ev.amt} HP</span>`,
                "lab",
                true,
              );
            } else if (ev.type === "atk" && t) {
              const eAtk = gEl(u);
              const e2 = gEl(t);
              const isSneakFollowup =
                ev.sneakFollowup ||
                (e2 !== null && sneakHitEls.has(e2));
              if (e2) sneakHitEls.delete(e2);

              // If this atk is a Sneak Strike followup, stop here —
              // the Sneak animation already handled damage and VFX.
              if (isSneakFollowup) {
                return;
              }

              // Sneak Strike already decremented dHp + called updHp in playSneakStrike;
              // normal atks apply damage/animation as usual.
              dHp[t.id] = Math.max(0, dHp[t.id] - ev.amt);
              updHp(t);

              if (eAtk && e2) {
                animateAttack(eAtk, e2, u);
              }

              if (e2) {
                if (ev.isCrit) {
                  flashDamage(e2);
                  flashUnit(e2, "vfx-crit");
                  spawnFloat(e2, "−" + ev.amt, "crit");
                } else {
                  flashDamage(e2);
                  spawnFloat(e2, "−" + ev.amt, "dmg");
                }
              }
              const who = uTag(u),
                whom = uTag(t);
              log(
                ev.isCrit
                  ? `${who} → ${whom} &nbsp;${dmgTag(ev.amt, true)}`
                  : `${who} → ${whom} &nbsp;<span class="ldmg">−${ev.amt}</span>`,
                "latk",
                true,
              );
            } else if (ev.type === "kill" && t) {
              dHp[t.id] = 0;
              updHp(t);
              const eAtk = gEl(u);
              const e2 = gEl(t);
              const killedBySneak =
                ev.sneakFollowup ||
                (e2 !== null && sneakHitEls.has(e2));
              if (e2) sneakHitEls.delete(e2);
              if (killedBySneak) {
                setTimeout(() => {
                  const e3 = gEl(t);
                  if (e3) e3.classList.add("dead");
                }, getBattleFxDuration(200));
                return;
              }

              if (eAtk && e2) animateAttack(eAtk, e2, u);
              if (e2) {
                if (ev.isCrit) {
                  flashDamage(e2);
                  flashUnit(e2, "vfx-crit");
                  spawnFloat(e2, "−" + ev.amt, "crit");
                } else {
                  flashDamage(e2);
                  spawnFloat(e2, "−" + ev.amt, "dmg");
                }
              }
              setTimeout(() => {
                const e3 = gEl(t);
                if (e3) e3.classList.add("dead");
              }, getBattleFxDuration(200));
              log(
                `${uTag(u)} <span class="lkill">killed</span> ${uTag(t)} &nbsp;<span class="ldmg">−${ev.amt}</span> 💀`,
                "lkill",
                true,
              );
            }
          });
          btimer = setTimeout(frame, tickDelay);
        }

        // ── Preparation phase: buffs → abilities, then combat ──────────────
        function runPrepPhase(onDone) {
          const prepEvs = [
            ...evs.filter((e) => e.type === "ability" && e.tick === -1),
            ...evs.filter(
              (e) =>
                e.type === "ability" &&
                e.tick === 0 &&
                e.abilName === "Sneak Strike",
            ),
          ];
          prepEvs.forEach((ev) => {
            ev.silent = true;
          });

          if (!prepEvs.length) {
            onDone();
            return;
          }

          let i = 0;
          function nextAction() {
            if (i >= prepEvs.length) {
              setTimeout(onDone, getBattleFxDuration(260));
              return;
            }
            const ev = prepEvs[i++];
            const u = umap[ev.uid];
            const uEl = u && gEl(u);

            log(
              (ABILOG[ev.abilName] || "✨ {n}: " + ev.abilName).replace(
                "{n}",
                u ? nameTag(u) : "?",
              ),
              "lab",
              true,
            );

            if (ev.abilName === "Sacred Aura" && u && uEl) {
              flashUnit(uEl, "vfx-skill");
              const adj = adjacentSlots(u.slot);
              Object.values(umap)
                .filter((a) => a.side === u.side && adj.includes(a.slot))
                .forEach((a) => {
                  const aEl = gEl(a);
                  if (!aEl) return;
                  flashUnit(aEl, "vfx-heal");
                  const bonus = ev.auraBonus && ev.auraBonus[a.id];
                  if (bonus) auraFloat(aEl, "+" + bonus + " MAX HP");
                });
            } else if (ev.abilName === "Sneak Strike") {
              const followup = evs.find(
                (e) =>
                  (e.type === "atk" || e.type === "kill") &&
                  e.uid === ev.uid &&
                  e.tid === ev.targetId &&
                  e.tick === ev.tick,
              );
              if (followup) followup.sneakFollowup = true;
              const t = umap[ev.targetId];
              const tEl = t && gEl(t);
              if (uEl) flashUnit(uEl, "vfx-skill");
              if (uEl && tEl) playSneakStrike(uEl, tEl, ev.amount || 0, t);
            }

            setTimeout(nextAction, getBattleFxDuration(480));
          }
          nextAction();
        }

        runPrepPhase(() => frame());
      }

      function endBattle(w, stats) {
        G.phase = "result";
        clearTimeout(btimer);
        hideTurnPanel();
        render();
          // (debug logs removed)
        // Defensive: ensure incoming stats are numeric (PvP server may omit keys)
        G.duelStats.dmgP += Number(stats?.dmgP || 0);
        G.duelStats.dmgE += Number(stats?.dmgE || 0);
        G.duelStats.killsP += Number(stats?.killsP || 0);
        G.duelStats.killsE += Number(stats?.killsE || 0);
        G.duelStats.battles.push({ winner: w });
        // (debug logs removed)
        // In PvP mode boardSnap/enemySnap aren't sent from server — keep the snap set from umap
        G.lastBoardSnap = stats.boardSnap || G.lastBoardSnap;
        if (!window._PVP) G.lastEnemySnap = stats.enemySnap || G.lastEnemySnap;

        if (w === "p") {
          // In PvP mode score was already set by round_result handler
          if (!window._PVP) G.duelScore.p++;
          G.lastBattleResult = "win";
          log(`🏆 Battle ${G.battleNum} won!`, "lr");
        } else {
          if (!window._PVP) G.duelScore.e++;
          G.lastBattleResult = "loss";
          log(`💔 Battle ${G.battleNum} lost!`, "lk");
        }

        const over =
          G.duelScore.p >= G.winsNeeded ||
          G.duelScore.e >= G.winsNeeded ||
          G.battleNum >= G.format;
        document.getElementById("bfight").style.display = "none";
        const nb = document.createElement("button");
        nb.id = "bnext";

        if (over) {
          const pw = G.duelScore.p > G.duelScore.e;
          if (pw) {
            G.duelsWon++;
            setBanner(`🏆 DUEL WON! ${G.duelScore.p}–${G.duelScore.e}`, "bwin");
          } else {
            G.duelsLost++;
            setBanner(
              `💔 DUEL LOST! ${G.duelScore.p}–${G.duelScore.e}`,
              "blose",
            );
          }
          log(
            `${pw ? "🏆" : "💔"} Duel ${G.duelNum} over! You ${G.duelScore.p} × ${G.duelScore.e}`,
            "lr",
          );
          setTimeout(() => showDuelResult(pw), 500);
          nb.className = "btn gnbtn";
          if (window._PVP) {
            nb.textContent = "🏠 Back to Lobby";
            nb.onclick = () => {
              if (window._PVP.socket) window._PVP.socket.disconnect();
              window.location.href = "/lobby";
            };
          } else {
            nb.textContent = "🌟 Next Duel";
            nb.onclick = nextDuel;
          }
        } else {
          const inc = betweenIncome();
          const sc = `${G.duelScore.p}–${G.duelScore.e}`;
          setBanner(
            `⚔️ Battle ${G.battleNum}/${G.format}: ${sc}. ${w === "p" ? "Victory!" : "Defeat!"}`,
            w === "p" ? "bwin" : "blose",
          );
          nb.className = "btn nbtn";
          nb.textContent = `▶ Battle ${G.battleNum + 1} (+${inc}💰)`;
          nb.onclick = nextBattle;
        }
        document.getElementById("ctrl").appendChild(nb);
        // Auto-advance: trigger the next action immediately.
        // Only auto-click when this button advances to the next *battle* (not when
        // the duel result overlay is shown and the button is "Next Duel" / "Back to Lobby").
        if (nb.onclick === nextBattle) {
          // Hide the button during the short delay so it doesn't flash briefly
          nb.style.visibility = "hidden";
          // Small delay to avoid immediate UI jump — makes transition smoother
          setTimeout(() => {
            try {
              nb.click();
            } catch (e) {
              // fallback: call the handler directly if click fails
              if (typeof nb.onclick === "function") nb.onclick();
            }
          }, 350);
        }
        updateHdr();
        renderDuelBar();
      }

      // ═══════════════════════════════════════════════════
      //  DUEL RESULT OVERLAY
      // ═══════════════════════════════════════════════════
      function showDuelResult(pw) {
        document.getElementById("dr-title").textContent = pw
          ? "🏆 DUEL WON!"
          : "💔 DUEL LOST!";
        document.getElementById("dr-title").className =
          "dr-title " + (pw ? "win" : "loss");
        const sc = G.duelScore;
        document.getElementById("dr-score").innerHTML =
          `<span style="color:#88ff88">${sc.p}</span> – <span style="color:#ff8888">${sc.e}</span>`;
        const bb = document.getElementById("dr-battles");
        bb.innerHTML = "";
        G.duelStats.battles.forEach((b, i) => {
          const d = document.createElement("div");
          d.className = `dr-bat ${b.winner === "p" ? "w" : "l"}`;
          d.textContent = `B${i + 1} ${b.winner === "p" ? "✓" : "✗"}`;
          bb.appendChild(d);
        });
        document.getElementById("drs-dmgP").textContent =
          G.duelStats.dmgP.toLocaleString();
        document.getElementById("drs-dmgE").textContent =
          G.duelStats.dmgE.toLocaleString();
        document.getElementById("drs-killsP").textContent = G.duelStats.killsP;
        document.getElementById("drs-killsE").textContent = G.duelStats.killsE;
        document.getElementById("drs-merges").textContent = G.duelStats.mergesP;
        const mergesEEl = document.getElementById("drs-mergesE");
        if (window._PVP) {
          mergesEEl.textContent = G.duelStats.mergesE;
        } else {
          mergesEEl.textContent = "—"; // AI doesn't merge
        }

        function renderTeam(el, units) {
          el.innerHTML = "";
          units.filter(Boolean).forEach((u) => {
            const alive = u.hp > 0;
            const d = document.createElement("div");
            d.className = `dr-unit ${alive ? "alive" : "dead"}`;
            d.innerHTML = `<span>${u.ico}</span><span style="font-size:7px;color:${alive ? "#88ff88" : "#ff8888"}">${LS[u.lv]}</span><span class="dr-unit-lbl">${u.name.slice(0, 4)}</span>`;
            el.appendChild(d);
          });
          if (!units.filter(Boolean).length)
            el.innerHTML =
              '<span style="font-size:11px;color:rgba(255,255,255,.25)">—</span>';
        }
        renderTeam(document.getElementById("drt-p"), G.lastBoardSnap);
        // In PvP use final-state enemy units from umap; fallback to initial board for AI
        renderTeam(
          document.getElementById("drt-e"),
          G.lastEnemySnap || G.duelEnemy,
        );

        const subEl = document.getElementById("dr-submitting");
        if (window._PVP) {
          document.getElementById("dr-next-btn").textContent =
            "🏠 Back to Lobby";
          document.getElementById("dr-next-btn").onclick = () => {
            if (window._PVP.socket) window._PVP.socket.disconnect();
            window.location.href = "/lobby";
          };

          // Show "Submitting results..." banner (prep for Etapa 3 HIVE transfer)
          const pvp = window._PVP;
          subEl.classList.add("visible");
          subEl.classList.remove("done");
          document.getElementById("dr-spin").className = "dr-submit-spinner";
          document.getElementById("dr-submit-text").textContent =
            "Submitting results...";
          const wagerLabel =
            pvp.wager > 0
              ? `${pvp.wager} HIVE will be transferred to the winner`
              : "Friendly match — no wager to process";
          document.getElementById("dr-submit-sub").textContent = wagerLabel;
          // Mock: after 3s mark as done (real call happens in Etapa 3)
          setTimeout(() => {
            subEl.classList.add("done");
            document.getElementById("dr-spin").className =
              "dr-submit-spinner done";
            document.getElementById("dr-spin").textContent = "✓";
            document.getElementById("dr-submit-text").textContent =
              "Results submitted!";
            document.getElementById("dr-submit-sub").textContent =
              pvp.wager > 0
                ? "Transfer complete. Check your Hive wallet."
                : "Match recorded.";
          }, 3000);
        } else {
          subEl.classList.remove("visible");
          document.getElementById("dr-next-btn").onclick = nextDuel;
        }
        document.getElementById("duel-result").classList.add("open");
      }

      // ═══════════════════════════════════════════════════
      //  GAME FLOW
      // ═══════════════════════════════════════════════════
      function openQuitModal() {
        document.getElementById("quit-overlay").classList.add("open");
      }

      function closeQuitModal() {
        document.getElementById("quit-overlay").classList.remove("open");
      }

      function confirmQuit() {
        closeQuitModal();
        if (window._PVP && window._PVP.socket) {
          window._PVP.socket.disconnect();
        }
        window.location.href = "/lobby";
      }

      // ═══════════════════════════════════════════════════
      //  PvP MODE
      // ═══════════════════════════════════════════════════

      // Mirror board columns (col 0 ↔ col 2) for efield display.
      // Both players build with col 2 = front (closest to VS on pfield).
      // efield expects col 0 = front (closest to VS on efield).
      // Mirroring converts between the two perspectives.
      function mirrorBoard(board) {
        if (!board) return Array(9).fill(null);
        const result = Array(9).fill(null);
        board.forEach((u, i) => {
          if (!u) return;
          result[Math.floor(i / 3) * 3 + (2 - (i % 3))] = { ...u };
        });
        return result;
      }

      // Flip simulate result so local player is always 'p' side
      function pvpFlipResult({ evs, umap, stats }) {
        const flippedUmap = {};
        Object.entries(umap).forEach(([id, u]) => {
          flippedUmap[id] = { ...u, side: u.side === "p" ? "e" : "p" };
        });
        return {
          evs, // evs reference umap ids — sides resolved via umap
          umap: flippedUmap,
          stats: {
            dmgP: stats.dmgE,
            dmgE: stats.dmgP,
            killsP: stats.killsE,
            killsE: stats.killsP,
            survP: stats.survE,
            survE: stats.survP,
          },
        };
      }

      function pvpInit(cfg) {
        const pvp = {
          matchId: cfg.matchId,
          opponent: cfg.opponent,
          isP1: cfg.isP1,
          format: cfg.format || 5,
          wager: cfg.wager,
          wagerType: cfg.wagerType,
          socket: null,
        };
        window._PVP = pvp;

        // Start the game immediately (no bot)
        startGame(pvp.format, true /* pvpMode */);

        // Connect socket and rejoin match
        const base =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "";
        pvp.socket = io(base, {
          transports: ["websocket"],
          auth: { token: window._HF_SESSION?.token },
        });

        pvp.socket.on("connect", () => {
          pvp.socket.emit("rejoin_match", { matchId: pvp.matchId });
        });

        pvp.socket.on("rejoin_error", (data) => {
          showToastBattle(data.message || "Match not found. Redirecting...");
          setTimeout(() => {
            window.location.href = "/lobby";
          }, 2500);
        });

        // Sync state from server after reconnect — ensures battleNum and scores
        // are correct even if the player missed one or more events.
        pvp.socket.on("rejoin_ok", (data) => {
          const isP1 = pvp.isP1;
          G.battleNum = data.battleNum;
          G.duelScore = {
            p: isP1 ? data.scores[data.p1] : data.scores[data.p2],
            e: isP1 ? data.scores[data.p2] : data.scores[data.p1],
          };
          updateHdr();
          renderDuelBar();
          log(`🔄 Reconnected — Battle ${data.battleNum}/${G.format}`, "lk");
        });

        // ── Round countdown timer ──────────────────────────────────────────────
        let _roundTimerInterval = null;

        function startRoundTimer(ms) {
          stopRoundTimer();
          const el = document.getElementById("phase-timer");
          if (!el) return;
          el.style.display = "block";
          let remaining = Math.ceil(ms / 1000);
          function tick() {
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            el.textContent = `⏱ ${m}:${String(s).padStart(2, "0")}`;
            el.classList.toggle("timer-urgent", remaining <= 30);
            if (remaining <= 0) {
              stopRoundTimer();
              el.textContent = "⏱ 0:00";
            }
          }
          tick();
          _roundTimerInterval = setInterval(() => {
            remaining--;
            tick();
          }, 1000);
        }

        function stopRoundTimer() {
          if (_roundTimerInterval) {
            clearInterval(_roundTimerInterval);
            _roundTimerInterval = null;
          }
          const el = document.getElementById("phase-timer");
          if (el) {
            el.style.display = "none";
            el.classList.remove("timer-urgent");
          }
        }

        // Expose so other functions can start/stop the countdown
        pvp.stopRoundTimer  = stopRoundTimer;
        pvp.startRoundTimer = startRoundTimer;

        pvp.socket.on("round_timer", (data) => {
          // Server emits round_timer immediately after round_result (for the next
          // round). If the battle animation is still playing, defer the timer so
          // it only appears once the recruitment/shop phase actually begins.
          if (G.phase === "shop") {
            startRoundTimer(data.ms);
          } else {
            pvp._pendingTimerMs = data.ms;
          }
        });

        pvp.socket.on("opponent_ready", () => {
          showToastBattle("Opponent submitted their team!");
        });

        pvp.socket.on("opponent_disconnected", (data) => {
          showToastBattle(`${data.username} disconnected. Waiting...`);
        });

        pvp.socket.on("match_cancelled", (data) => {
          showToastBattle(data.reason || "Match cancelled.");
          setTimeout(() => {
            window.location.href = "/lobby";
          }, 3000);
        });

        pvp.socket.on("round_result", (data) => {
          // Determine local perspective
          const isP1 = pvp.isP1;
          const myBoard = isP1 ? data.p1Board : data.p2Board;
          const enemyBoard = isP1 ? data.p2Board : data.p1Board;

          // Mirror the enemy board for efield display:
          // opponent built with col 2 as front (pfield), efield needs col 0 as front.
          G.enemy = mirrorBoard(enemyBoard);
          G.duelEnemy = mirrorBoard(enemyBoard);

          // Build result from local perspective
          let result = { evs: data.evs, umap: data.umap, stats: data.stats };
          if (!isP1) result = pvpFlipResult(result);

          const localWon = data.roundWinner === window._HF_SESSION.username;
          result.winner = localWon ? "p" : "e";

          // Sync battle number and score from server — source of truth for
          // seriesOver detection in endBattle(), and for reconnection correctness.
          G.battleNum = data.battleNum;
          G.duelScore = {
            p: isP1 ? data.scores[data.p1] : data.scores[data.p2],
            e: isP1 ? data.scores[data.p2] : data.scores[data.p1],
          };

          // Snapshot final armies from umap for the result screen.
          // After pvpFlipResult, side='p' = local player, side='e' = opponent.
          const umapUnits = Object.values(result.umap);
          G.lastBoardSnap = umapUnits.filter((u) => u.side === "p");
          G.lastEnemySnap = umapUnits.filter((u) => u.side === "e");

          // Accumulate opponent's merges (server relays them from the opponent's submit_team)
          const opponentName = isP1 ? data.p2 : data.p1;
          if (data.merges && data.merges[opponentName] !== undefined) {
            G.duelStats.mergesE = data.merges[opponentName];
          }

          // Re-enable fight button (hidden while waiting)
          const fb = document.getElementById("bfight");
          if (fb) {
            fb.disabled = false;
            fb.textContent = "START BATTLE";
          }

          G.phase = "battle";
          stopRoundTimer(); // battle started — hide countdown
          render();

          // Log start-of-battle abilities
          log("⚔️ Battle begins!", "lr");
          result.evs
            .filter(
              (e) =>
                e.type === "ability" &&
                e.tick === -1 &&
                e.abilName !== "Chain Lightning",
            )
            .forEach((e) => {
              const u = result.umap[e.uid];
              log(
                (ABILOG[e.abilName] || "✨ {n}: " + e.abilName).replace(
                  "{n}",
                  u ? nameTag(u) : "?",
                ),
                "lab",
                true,
              );
            });

          setBanner(
            `⚔️ Battle ${data.battleNum}/${G.format} in progress...`,
            "bbattle",
          );
          playback(result);
        });

        pvp.socket.on("prize_sent", (data) => {
          const amount = data.amount
            ? `${parseFloat(data.amount).toFixed(3)} HIVE`
            : "prize";
          const kind = data.type === "stake" ? "Hive Power" : "Liquid HIVE";
          showToastBattle(`🏆 Prize sent! ${amount} as ${kind}.`);
          log(`🏆 Prize: ${amount} (${kind}) → ${data.to}`, "lk");
        });

        pvp.socket.on("prize_error", (data) => {
          showToastBattle(
            `⚠️ Prize delivery failed: ${data.error || "unknown error"}. Contact support.`,
          );
          log(`⚠️ Prize error: ${data.error || "unknown"}`, "lr");
        });

        pvp.socket.on("error", (data) => {
          showToastBattle(data.message || "PvP error.");
        });
      }

      // Small in-battle toast (log line fallback)
      function showToastBattle(msg) {
        log(`ℹ️ ${msg}`, "lk");
      }

      function startGame(fmt, pvpMode = false) {
        // Reset completo do estado para garantir partida limpa
        G.format = fmt;
        G.winsNeeded = fmt === 10 ? 6 : Math.ceil(fmt / 2);
        G.phase = "shop";
        G.duelNum = 1;
        G.battleNum = 1;
        G.duelScore = { p: 0, e: 0 };
        G.duelsWon = 0;
        G.duelsLost = 0;
        G.gold = START_GOLD();
        G.shop = [];
        G.shopCombo = null;
        G.shopCombos = [];
        G.bench = [];
        G.board = Array(9).fill(null);
        G.duelEnemy = Array(9).fill(null);
        G.enemy = Array(9).fill(null);
        G.bsel = null;
        G.fieldSel = null;
        G.fieldDrag = null;
        G.lastBattleResult = null;
        G.duelStats = {
          dmgP: 0,
          dmgE: 0,
          killsP: 0,
          killsE: 0,
          mergesP: 0,
          mergesE: 0,
          battles: [],
        };
        G.lastBoardSnap = [];
        G.lastEnemySnap = null;
        document.getElementById("game").style.display = "flex";
        document.getElementById("h-fmt").textContent = `BO${fmt}`;
        document.getElementById("log").innerHTML = "";
        if (!pvpMode) {
          botInitDuel();
          validateGameState();
          G.duelEnemy = BOT.board.map((u) => (u ? { ...u } : null));
        }
        genShop();
        render();
        updateFieldLabels();
        startPhaseTimer(120000);
        const logEl = document.getElementById("log");
        for (let i = 0; i < 5; i++) {
          const d = document.createElement("div");
          d.className = "le";
          d.innerHTML = "&nbsp;";
          logEl.appendChild(d);
        }
        if (pvpMode) {
          const pvp = window._PVP;
          const opp = pvp?.opponent || "Opponent";
          log(
            `⚔️ PvP BO${fmt} | vs @${opp} | Win ${G.winsNeeded} battles. You have ${START_GOLD()}💰.`,
            "lr",
          );
          log(
            `ℹ️ Build your army, then click START BATTLE to submit your team.`,
            "lk",
          );
        } else {
          log(
            `⚔️ Format BO${fmt} | AI Opponent | Win ${G.winsNeeded} battles. You have ${START_GOLD()}💰.`,
            "lr",
          );
        }
        if (_deckPool) {
          log(
            `🛡️ Deck active — recruitment shows only your formation heroes.`,
            "lk",
          );
        }
      }

      function nextBattle() {
        setShopLocked(false);
        G.battleNum++;
        restoreFieldHp();
        const inc = betweenIncome();
        G.gold += inc;
        G.phase = "shop";
        G.bsel = null;
        G.fieldSel = null;
        G.fieldDrag = null;
        genShop();
        if (!window._PVP) {
          botNextBattle(G.lastBattleResult === "win" ? "loss" : "win");
          botRunTurn();
          G.duelEnemy = BOT.board.map((u) => (u ? { ...u } : null));
        } else {
          // Hide opponent's board during shop phase — only revealed when battle starts.
          G.duelEnemy = Array(9).fill(null);
          // Strip the round's ID prefix from board and bench so the next
          // round starts with clean IDs and re-prefixes correctly on submit.
          const pfx = window._PVP._idPrefix || "";
          if (window._PVP._idsPrefixed && pfx) {
            G.board = G.board.map((u) =>
              u
                ? {
                    ...u,
                    id: u.id.startsWith(pfx) ? u.id.slice(pfx.length) : u.id,
                  }
                : null,
            );
            G.bench = G.bench.map((u) =>
              u
                ? {
                    ...u,
                    id: u.id.startsWith(pfx) ? u.id.slice(pfx.length) : u.id,
                  }
                : null,
            );
            window._PVP._idsPrefixed = false;
          }
          // Start the recruitment timer that was deferred while battle animation played.
          if (window._PVP._pendingTimerMs && window._PVP.startRoundTimer) {
            window._PVP.startRoundTimer(window._PVP._pendingTimerMs);
            window._PVP._pendingTimerMs = null;
          }
        }
        document.getElementById("bnext")?.remove();
        document.getElementById("bfight").style.display = "";
        const _logEl = document.getElementById("log");
        _logEl.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          const d = document.createElement("div");
          d.className = "le";
          d.innerHTML = "&nbsp;";
          _logEl.appendChild(d);
        }
        render();
        updateHdr();
        startPhaseTimer(120000);
        if (window._PVP) {
          const pvp = window._PVP;
          log(
            `🔄 Battle ${G.battleNum}/${G.format} | Score: ${G.duelScore.p}–${G.duelScore.e} | +${inc}💰 | Build and submit your team!`,
            "lr",
          );
          log(
            `ℹ️ vs ${pvp.opponent} — place your heroes and click START BATTLE.`,
            "lk",
          );
        } else {
          log(
            `🔄 Battle ${G.battleNum}/${G.format} | Score: ${G.duelScore.p}–${G.duelScore.e} | +${inc}💰 | AI opponent upgraded!`,
            "lr",
          );
        }
      }

      function nextDuel() {
        setShopLocked(false);
        document.getElementById("duel-result").classList.remove("open");
        G.duelNum++;
        G.battleNum = 1;
        G.duelScore = { p: 0, e: 0 };
        G.gold = START_GOLD();
        G.bench = [];
        G.board = Array(9).fill(null);
        G.lastBattleResult = null;
        G.bsel = null;
        G.fieldSel = null;
        G.fieldDrag = null;
        G.phase = "shop";
        G.duelStats = {
          dmgP: 0,
          dmgE: 0,
          killsP: 0,
          killsE: 0,
          mergesP: 0,
          mergesE: 0,
          battles: [],
        };
        botInitDuel();
        G.duelEnemy = BOT.board.map((u) => (u ? { ...u } : null));
        G.enemy = Array(9).fill(null);
        genShop();
        document.getElementById("bnext")?.remove();
        document.getElementById("bfight").style.display = "";
        const _logEl = document.getElementById("log");
        _logEl.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          const d = document.createElement("div");
          d.className = "le";
          d.innerHTML = "&nbsp;";
          _logEl.appendChild(d);
        }
        render();
        updateHdr();
        log(
          `🌟 Duel ${G.duelNum}! New AI opponent with 7💰. Analyze and build!`,
          "lr",
        );
      }

      // ═══════════════════════════════════════════════════
      //  LOG & UI HELPERS
      // ═══════════════════════════════════════════════════
      function log(msg, cls = "", html = false) {
        const l = document.getElementById("log"),
          d = document.createElement("div");
        d.className = `le ${cls}`;
        if (html) d.innerHTML = msg;
        else d.textContent = msg;
        l.appendChild(d);
        l.scrollTop = l.scrollHeight;
      }
      function uTag(u) {
        const side = u.side === "p" ? "lside-p" : "lside-e";
        return `<span class="${side}">${u.ico || ""} ${u.name}</span>`;
      }
      function nameTag(u) {
        const side = u.side === "p" ? "lside-p" : "lside-e";
        return `<span class="${side}">${u.name}</span>`;
      }
      function dmgTag(amt, isCrit) {
        return isCrit
          ? `<span class="lcrit">💥 ${amt} CRIT</span>`
          : `<span class="ldmg">${amt}</span>`;
      }
      function openHowTo() {
        document.getElementById("howto").classList.add("open");
      }
      function closeHowTo() {
        document.getElementById("howto").classList.remove("open");
      }
      document.getElementById("howto").addEventListener("click", (e) => {
        if (e.target === document.getElementById("howto")) closeHowTo();
      });

      // ═══════════════════════════════════════════════════
      //  RENDER SYSTEM
      // ═══════════════════════════════════════════════════
      function setBanner(t, c) {
        const b = document.getElementById("banner");
        b.textContent = t;
        b.className = c;
      }

      function renderDuelBar() {
        const dp = document.getElementById("dots-p"),
          de = document.getElementById("dots-e");
        dp.innerHTML = "";
        de.innerHTML = "";
        const battles = G.duelStats.battles; // [{winner:"p"|"e"}, ...]
        for (let i = 0; i < G.format; i++) {
          const pd = document.createElement("div"),
            ed = document.createElement("div");
          if (i < battles.length) {
            const w = battles[i].winner;
            pd.className = `dot ${w === "p" ? "dot-w" : "dot-l"}`;
            ed.className = `dot ${w === "e" ? "dot-w" : "dot-l"}`;
          } else {
            pd.className = "dot dot-e";
            ed.className = "dot dot-e";
          }
          dp.appendChild(pd);
          de.appendChild(ed);
        }
      }

      // ═══════════════════════════════════════════════════
      //  TARGET PREVIEW (mirrors pickTarget logic, outside simulate)
      // ── Attack arrow helpers ───────────────────────────
      let _activeHoverCell = null;

      function drawAttackArrow(srcEl, tgtEl, type) {
        const svg = document.getElementById("attack-svg");
        if (!svg || !srcEl || !tgtEl) return;
        const sR = (
          srcEl.querySelector(".unit") || srcEl
        ).getBoundingClientRect();
        const tR = (
          tgtEl.querySelector(".unit") || tgtEl
        ).getBoundingClientRect();

        let x1, y1, x2, y2, mx, my;

        if (window.mobileVertical) {
          // Vertical layout: anchor top/bottom based on whether target is above or below
          const toTop = tR.top < sR.top;
          x1 = sR.left + sR.width * 0.5;
          x2 = tR.left + tR.width * 0.5;
          y1 = toTop ? sR.top + 3 : sR.bottom - 3;
          y2 = toTop ? tR.bottom - 3 : tR.top + 3;
          // Arc curves sideways
          mx = (x1 + x2) / 2 + Math.abs(y2 - y1) * 0.15;
          my = (y1 + y2) / 2;
        } else {
          // Horizontal layout: anchor left/right based on whether target is to the right
          const toRight = tR.left >= sR.left;
          x1 = toRight ? sR.right - 3 : sR.left + 3;
          x2 = toRight ? tR.left + 3 : tR.right - 3;
          y1 = sR.top + sR.height * 0.5;
          y2 = tR.top + tR.height * 0.5;
          // Arc curves up a little
          mx = (x1 + x2) / 2;
          my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.2;
        }

        const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;

        // Layer 1: blurred glow trail
        const glow = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        glow.setAttribute("d", d);
        glow.setAttribute("class", `atk-arrow atk-glow-${type}`);
        glow.setAttribute("filter", "url(#arr-blur)");
        svg.appendChild(glow);

        // Layer 2: animated flow line with arrowhead
        const flow = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        flow.setAttribute("d", d);
        flow.setAttribute("class", `atk-arrow atk-flow-${type}`);
        flow.setAttribute("marker-end", `url(#arr-${type})`);
        svg.appendChild(flow);

        // Layer 3: origin dot
        const dot = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        dot.setAttribute("cx", String(x1));
        dot.setAttribute("cy", String(y1));
        dot.setAttribute("r", "3.5");
        dot.setAttribute("class", `atk-arrow atk-dot-${type}`);
        svg.appendChild(dot);

        // Trigger fade-in via rAF so class changes are picked up
        requestAnimationFrame(() => {
          glow.classList.add("arr-enter");
          flow.classList.add("arr-enter");
          dot.classList.add("arr-enter");
        });
      }

      function clearAttackArrows() {
        const svg = document.getElementById("attack-svg");
        if (svg) svg.querySelectorAll(".atk-arrow").forEach((e) => e.remove());
      }

      // ═══════════════════════════════════════════════════
      function previewTarget(playerUnit, enemyBoard) {
        const isM = (u) => u.tp !== "ranged";
        const enemies = enemyBoard
          .map((u, i) => (u ? { ...u, slot: i } : null))
          .filter(Boolean);
        if (!enemies.length) return null;

        const unitRow = Math.floor(playerUnit.slot / 3);

        const bestInRow = (row) => {
          const units = enemies.filter((e) => Math.floor(e.slot / 3) === row);
          if (!units.length) return null;
          return units.slice().sort((a, b) => {
            const colA = a.slot % 3,
              colB = b.slot % 3;
            if (colA !== colB) return colA - colB;
            return isM(a) === isM(b) ? 0 : isM(a) ? -1 : 1;
          })[0];
        };

        if (unitRow === 0) {
          return bestInRow(0) || bestInRow(1) || bestInRow(2) || null;
        }
        if (unitRow === 2) {
          return bestInRow(2) || bestInRow(1) || bestInRow(0) || null;
        }
        const t = bestInRow(1);
        if (t) return t;
        const tA = bestInRow(0),
          tC = bestInRow(2);
        if (tA && tC) return Math.random() < 0.5 ? tA : tC;
        return tA || tC || null;
      }

      function renderField(fid, board, isP) {
        const f = document.getElementById(fid);
        f.innerHTML = "";

        // Compute Sacred Aura HP bonus for adjacent allies when Paladin is on player field
        const auraBonus = {};
        if (isP && G.phase === "shop") {
          for (let s = 0; s < 9; s++) {
            const pal = board[s];
            if (pal && pal.cid === "paladin") {
              adjacentSlots(s).forEach((as) => {
                const ally = board[as];
                if (ally && ally.cid !== "paladin") {
                  const bonus = Math.floor(ally.maxHp * pal.skillPower);
                  auraBonus[as] = (auraBonus[as] || 0) + bonus;
                }
              });
            }
          }
        }

        for (let i = 0; i < 9; i++) {
          const cell = document.createElement("div");
          cell.className = "cell";
          cell.dataset.i = i;
          const u = board[i];
          if (u) {
            cell.classList.add("occ");
            const cc = C[u.cid];
            const el = document.createElement("div");
            el.className = `unit l${u.lv}`;
            el.dataset.uid = u.id;
            el.dataset.cid = u.cid;

            if (!cc) {
              console.warn(`Invalid cid: ${u.cid}`);
              return;
            } // Proteção

            el.style.background = cc.bg;

            el.title = "";

            const dotColor =
              u.lv === 1
                ? cc.col
                : u.lv === 2
                  ? "#4488ff"
                  : u.lv === 3
                    ? "#aa44ff"
                    : "#ffaa00";
            let uDotsHtml =
              '<div class="uprog" style="color:' + dotColor + '">';
            for (let d = 0; d < 3; d++)
              uDotsHtml += `<div class="uprog-dot ${u.lv >= 5 || d < u.stack ? "filled" : "empty"}" style="border-color:${dotColor}"></div>`;
            uDotsHtml += "</div>";
            const hpBonus = auraBonus[i] || 0;
            const hpDisplay = hpBonus > 0 ? u.hp + hpBonus : u.hp;
            const hpClass = hpBonus > 0 ? "ustv-aura" : "ustv";
            el.innerHTML = `<div class="ulvl">${LS[u.lv]}</div><div class="hf-info-btn" title="">i</div><div class="cportrait${cc.portrait ? " has-portrait" : ""}"${cc.portrait ? ` style="--portrait-url: url('${cc.portrait}')"` : ""}><div class="cico">${u.ico}</div></div><div class="uhb"><div class="uhf hi" style="width:100%"></div></div>${uDotsHtml}`;

            el.addEventListener("dragstart", () => SkillTip.hide());
            const infoBtn = el.querySelector(".hf-info-btn");
            if (infoBtn) {
              infoBtn.addEventListener("mouseenter", () =>
                SkillTip.show(infoBtn, generateHeroInfoHtml(u)),
              );
              infoBtn.addEventListener("mouseleave", () => SkillTip.hide());
              infoBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                SkillTip.show(infoBtn, generateHeroInfoHtml(u));
              });
            }

            if (isP && G.phase === "shop") {
              el.draggable = true;
              el.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("fromSlot", String(i));
                e.dataTransfer.effectAllowed = "move";
                G.fieldDrag = i;
                clearAttackArrows();
                setTimeout(() => {
                  el.classList.add("dragging");
                  document
                    .querySelectorAll("#pfield .cell:not(.occ)")
                    .forEach((c) => c.classList.add("dr"));
                }, 0);
              });
              el.addEventListener("dragend", () => {
                el.classList.remove("dragging");
                G.fieldDrag = null;
                render();
              });
              cell.addEventListener("click", (e) => {
                if (G.fieldSel === i) {
                  G.fieldSel = null;
                } else if (G.fieldSel !== null) {
                  const tmp = G.board[G.fieldSel];
                  G.board[G.fieldSel] = G.board[i];
                  G.board[i] = tmp;
                  G.fieldSel = null;
                } else {
                  G.fieldSel = i;
                  G.bsel = null;
                }
                render();
              });
            }
            // ── Hover: preview do alvo ──
            if (isP && u) {
              const unitWithSlot = { ...u, slot: i };
              cell.addEventListener("mouseenter", () => {
                _activeHoverCell = cell;
                const enemyBoard = G.phase === "battle" ? G.enemy : G.duelEnemy;
                if (!enemyBoard) return;
                const efieldEl = document.getElementById("efield");
                const pfieldEl = document.getElementById("pfield");

                // ── Primary attack target (red outline) ──
                const target = previewTarget(unitWithSlot, enemyBoard);
                if (target) {
                  const tgtCellEl = efieldEl?.querySelector(
                    `[data-i="${target.slot}"]`,
                  );
                  tgtCellEl?.classList.add("target-preview");

                  // Mage Fireball: adjacent enemies in + shape (orange outline)
                  if (unitWithSlot.cid === "mage") {
                    const adj = adjacentSlots(target.slot);
                    enemyBoard.forEach((eu, ei) => {
                      if (eu && ei !== target.slot && adj.includes(ei)) {
                        efieldEl
                          ?.querySelector(`[data-i="${ei}"]`)
                          ?.classList.add("target-preview-splash");
                      }
                    });
                  }

                  // Archmage Chain Lightning: same row, deeper cols (orange outline)
                  if (unitWithSlot.cid === "archmage") {
                    const tRow = Math.floor(target.slot / 3);
                    const pCol = target.slot % 3;
                    const chain = [];
                    enemyBoard.forEach((eu, ei) => {
                      if (
                        eu &&
                        ei !== target.slot &&
                        Math.floor(ei / 3) === tRow &&
                        ei % 3 > pCol
                      )
                        chain.push(ei);
                    });
                    chain
                      .sort((a, b) => (a % 3) - (b % 3))
                      .slice(0, 2)
                      .forEach((ei) => {
                        efieldEl
                          ?.querySelector(`[data-i="${ei}"]`)
                          ?.classList.add("target-preview-splash");
                      });
                  }
                }

                // ── Paladin Sacred Aura: adjacent allies (green outline) ──
                if (unitWithSlot.cid === "paladin") {
                  const adj = adjacentSlots(unitWithSlot.slot);
                  G.board.forEach((pu, pi) => {
                    if (pu && pi !== unitWithSlot.slot && adj.includes(pi))
                      pfieldEl
                        ?.querySelector(`[data-i="${pi}"]`)
                        ?.classList.add("target-preview-ally");
                  });
                }
              });
              cell.addEventListener("mouseleave", () => {
                if (_activeHoverCell !== cell) return;
                _activeHoverCell = null;
                document
                  .querySelectorAll(".target-preview")
                  .forEach((el) => el.classList.remove("target-preview"));
                document
                  .querySelectorAll(".target-preview-splash")
                  .forEach((el) =>
                    el.classList.remove("target-preview-splash"),
                  );
                document
                  .querySelectorAll(".target-preview-ally")
                  .forEach((el) => el.classList.remove("target-preview-ally"));
              });
            }

            cell.appendChild(el);
          } else {
            if (
              isP &&
              G.phase === "shop" &&
              (G.bsel !== null || G.fieldSel !== null)
            )
              cell.classList.add("dr");
            if (isP && G.phase === "shop") {
              cell.addEventListener("click", () => {
                if (G.fieldSel !== null) {
                  G.board[i] = G.board[G.fieldSel];
                  G.board[G.fieldSel] = null;
                  G.fieldSel = null;
                  render();
                } else placeUnit(i);
              });
              cell.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              });
              cell.addEventListener("dragenter", (e) => {
                e.preventDefault();
                cell.classList.add("dnd-over");
              });
              cell.addEventListener("dragleave", () =>
                cell.classList.remove("dnd-over"),
              );
              cell.addEventListener("drop", (e) => {
                e.preventDefault();
                cell.classList.remove("dnd-over");
                const fromSlot = e.dataTransfer.getData("fromSlot"),
                  benchCid = e.dataTransfer.getData("benchCid");
                if (fromSlot !== "") {
                  G.board[i] = G.board[parseInt(fromSlot)];
                  G.board[parseInt(fromSlot)] = null;
                  G.fieldDrag = null;
                  render();
                } else if (benchCid) placeUnit(i, benchCid);
              });
            }
          }
          // Drop on occupied slot: swap
          if (isP && G.phase === "shop" && u) {
            cell.addEventListener("dragover", (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            });
            cell.addEventListener("dragenter", (e) => {
              e.preventDefault();
              cell.classList.add("dnd-over");
            });
            cell.addEventListener("dragleave", () =>
              cell.classList.remove("dnd-over"),
            );
            cell.addEventListener("drop", (e) => {
              e.preventDefault();
              cell.classList.remove("dnd-over");
              const fromSlot = e.dataTransfer.getData("fromSlot");
              if (fromSlot !== "" && fromSlot !== String(i)) {
                const src = parseInt(fromSlot);
                const tmp = G.board[src];
                G.board[src] = G.board[i];
                G.board[i] = tmp;
                G.fieldDrag = null;
                render();
              }
            });
          }
          if (isP && G.fieldSel === i) cell.classList.add("field-sel");
          f.appendChild(cell);
        }
      }

      // ── Shop Rendering (animated with absolute positioning) ──
      const SHOP_SLOTS = 5;
      function _shopSlotLeft(slotIdx, cardW, gap, containerW) {
        const totalW = SHOP_SLOTS * cardW + (SHOP_SLOTS - 1) * gap;
        const startX = (containerW - totalW) / 2;
        return Math.round(startX + slotIdx * (cardW + gap));
      }

      // ═══════════════════════════════════════════════════
      //  SKILL DESCRIPTIONS & TOOLTIP SYSTEM
      // ═══════════════════════════════════════════════════

      const SKILL_DESCRIPTIONS = {
        iron_defense: {
          name: "Iron Defense",
          desc: "Reduces damage taken.",
          format: (skillPower, level) => {
            const reduction = Math.floor(skillPower * 100);
            return `Reduces ${reduction}% of the damage received`;
          },
        },
        fireball: {
          name: "Fireball",
          desc: "Full damage to the target tile. Splash damage to tiles in a + shape around it.",
          format: (skillPower, level, atk) => {
            const splashDmg = Math.floor(atk * skillPower);
            return `Full damage: ${atk}. Splash damage: ${splashDmg} (${Math.floor(skillPower * 100)}%)`;
          },
        },
        precise_shot: {
          name: "Precise Shot",
          desc: "Increases the chance of landing a critical hit.",
          format: (skillPower, level) => {
            const critChanceBonus = Math.floor(skillPower * 100);
            return `+${critChanceBonus}% critical chance`;
          },
        },
        healing: {
          name: "Healing",
          desc: "Heals the ally with lowest HP.",
          format: (skillPower, level, atk) => {
            const healAmount = Math.floor(atk * skillPower);
            return `Heals the most injured ally for ${healAmount} HP (${Math.floor(skillPower * 100)}% of ATK)`;
          },
        },
        sneak_strike: {
          name: "Sneak Strike",
          desc: "At battle start, performs a sneak attack on lowest-HP enemy.",
          format: (skillPower, level, atk) => {
            const sneakDmg = Math.floor(atk * skillPower);
            return `Sneak attack damage: ${sneakDmg} (${Math.floor(skillPower * 100)}% of ATK)`;
          },
        },
        sacred_aura: {
          name: "Sacred Aura",
          desc: "At battle start, grants adjacent allies, max HP bonus. Buff persists even paladin dies.",
          format: (skillPower, level) => {
            return `Adjacent allies gain +${Math.floor(skillPower * 100)}% max HP bonus`;
          },
        },
        chain_lightning: {
          name: "Chain Lightning",
          desc: "Horizontal line attack. Full damage on first target. Subsequent targets receive reduced damage.",
          format: (skillPower, level, atk) => {
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
          desc: "When HP drops below 60%, permanently gain bonus attack for the rest of the battle.",
          format: (skillPower, level) => {
            const atkBonus = Math.floor(skillPower * 100);
            return `When HP below 60%: +${atkBonus}% permanent ATK`;
          },
        },
      };

      // Função para gerar o tooltip
      function generateSkillTooltip(unit) {
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

        // ✅ Retorna APENAS TEXTO, não HTML
        return `${skillInfo.name}\n${skillInfo.desc}\n\n${calculatedValue}`;
      }

      // ── Skill Tooltip Rico ──────────────────────────────────
      function generateSkillTooltipHtml(unit) {
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
                <div class="stp-power">
                  <span class="stp-power-label">Current Effect</span>
                  <span class="stp-power-value">${calculatedValue}</span>
                </div>`;
      }

      function generateHeroInfoHtml(u) {
        const cc = C[u.cid];
        const st = cc?.levels?.[u.lv];
        const skillKey = cc?.abi?.key;
        const skillInfo = skillKey ? SKILL_DESCRIPTIONS[skillKey] : null;
        const abiIco = cc?.abi?.ico || "✨";
        const abiName = cc?.abi?.name || "Skill";

        const hp = st?.max_hp ?? "—";
        const atk = st?.atk ?? "—";
        const spd =
          st?.atk_speed != null ? Number(st.atk_speed).toFixed(2) : "—";

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
            <div class="stp-power"><span class="stp-power-label">Effect</span><span class="stp-power-value">${calc}</span></div>`;
        } else {
          skillSection = `<div class="stp-divider"></div>
            <div class="stp-header"><span class="stp-icon">${abiIco}</span><span class="stp-name">${abiName}</span></div>`;
        }

        const heroClass = u.cid
          ? u.cid.charAt(0).toUpperCase() + u.cid.slice(1)
          : "";
        const roleLabel = [heroClass, cc.role || ""]
          .filter(Boolean)
          .join(" · ");

        return `<div class="stp-hero-header">
          <span class="stp-hero-ico">${u.ico}</span>
          <div><div class="stp-hero-name">${cc.name}</div><div class="stp-hero-role">${roleLabel}</div></div>
        </div>
        <div class="stp-divider"></div>
        <div class="stp-stats">
          <div class="stp-stat"><span class="stp-stat-v">${hp}</span><span class="stp-stat-l">HP</span></div>
          <div class="stp-stat"><span class="stp-stat-v">${atk}</span><span class="stp-stat-l">ATK</span></div>
          <div class="stp-stat"><span class="stp-stat-v">${spd}</span><span class="stp-stat-l">SPD</span></div>
        </div>${skillSection}`;
      }

      const SkillTip = (() => {
        let el = null;
        let hideTimer = null;

        function getEl() {
          if (!el) {
            el = document.createElement("div");
            el.className = "skill-tip";
            document.body.appendChild(el);
          }
          return el;
        }

        function show(anchor, html) {
          clearTimeout(hideTimer);
          const tip = getEl();
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

        function hide() {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(() => {
            if (el) el.classList.remove("stp-visible");
          }, 80);
        }

        return { show, hide };
      })();

      function renderShop() {
        const row = document.getElementById("shoprow"),
          active = G.phase === "shop";
        const combos = G.shopCombos || (G.shopCombo ? [G.shopCombo] : []);
        // Map each shop index → its combo object
        const comboByIdx = {};
        combos.forEach((c) => c.idxs.forEach((i) => (comboByIdx[i] = c)));
        const combo = G.shopCombo; // kept for legacy references below
        const s =
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--s"),
          ) || 1;
        const cardW = Math.round(90 * s),
          gap = Math.round(6 * s);
        const shopWrapInner = Math.round(500 * s) - Math.round(8 * s) * 2;
        const contW = shopWrapInner;

        const domById = {};
        row
          .querySelectorAll(".scard[data-uid]")
          .forEach((el) => (domById[el.dataset.uid] = el));
        const keepIds = new Set(G.shop.filter(Boolean).map((u) => u.id));
        Object.keys(domById).forEach((uid) => {
          if (!keepIds.has(uid)) {
            const el = domById[uid];
            el.style.transition = "transform .22s ease-in,opacity .2s ease-in";
            el.style.transform = "translateY(-24px) scale(.82)";
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
            setTimeout(() => el.remove(), 240);
          }
        });

        G.shop.forEach((u, i) => {
          if (!u) return;
          const targetLeft = _shopSlotLeft(i, cardW, gap, contW);
          const cc = C[u.cid];
          if (!cc) {
            console.warn(`Invalid character ID: ${u.cid}`);
            return;
          }

          const isOwned =
            G.bench.find((b) => b.cid === u.cid) ||
            G.board.find((b) => b && b.cid === u.cid);
          const isAtMax = !!(isOwned && isOwned.lv >= 5);
          const cost = isOwned ? 2 : HF.value_buy_card;
          const cardCombo = comboByIdx[i] || null;
          const isCombo = !!cardCombo;
          const canBuy =
            !isAtMax && G.gold >= (isCombo ? cardCombo.cost : cost) && active;
          const cntLabel = isAtMax
            ? "🏆 MAX"
            : isOwned
              ? `🔗${isOwned.stack}/3`
              : "★";
          const actionLbl = canBuy
            ? isCombo
              ? `⚡ Combo ×${cardCombo.type} for ${cardCombo.cost}💰`
              : isOwned
                ? `▶ Stack ${cost}💰`
                : `▶ Recruit ${cost}💰`
            : isAtMax
              ? "Nível Máximo"
              : "";
          const priceLbl = isAtMax
            ? "MAX"
            : isCombo
              ? `${cardCombo.cost}💰`
              : `${cost}💰`;
          const priceClass = isAtMax
            ? "pmax"
            : isOwned
              ? "pcombo"
              : isCombo
                ? "pcombo"
                : "pnew";

          const inner = `<div class="sprice ${priceClass}">${priceLbl}</div><div class="scnt ${isAtMax ? "cmax" : isOwned ? "ccombo" : "cnew"}">${cntLabel}</div><div class="cportrait ${cc.portrait ? "has-portrait" : ""}"${cc.portrait ? ` style="--portrait-url: url('${cc.portrait}')"` : ""}><div class="cico">${u.ico}</div></div><div class="hf-info-btn" title="">i</div><div class="caction">${actionLbl}</div>`;

          let el = domById[u.id];
          const isNew = !el;
          if (isNew) {
            el = document.createElement("div");
            el.dataset.uid = u.id;
            el.style.left = `${contW + cardW}px`;
            el.style.opacity = "0";
            el.style.transition = "none";
            row.appendChild(el);
            el.offsetWidth;
          }
          el.className = `scard${isCombo ? " combo-card" : ""}${isAtMax ? " maxed" : canBuy ? " buyable" : " broke"}${isNew ? " scard-new" : ""}`;
          if (isNew) el.style.animationDelay = i * 55 + "ms";
          el.innerHTML = inner;
          el.style.background = cc.bg;
          el.style.borderColor = isCombo ? "#44ff88" : cc.col;
          el.onclick = canBuy
            ? isCombo
              ? () => buyCombo(cardCombo)
              : () => buyCard(i)
            : null;
          el.onmouseenter = isCombo
            ? () => {
                cardCombo.idxs.forEach((ci) => {
                  row
                    .querySelector(`.scard[data-uid="${G.shop[ci]?.id}"]`)
                    ?.classList.add("combo-lift");
                });
              }
            : null;
          el.onmouseleave = isCombo
            ? (e) => {
                // Check if moving into another card of the SAME combo
                const relUid =
                  e.relatedTarget?.closest?.("[data-uid]")?.dataset?.uid;
                const stayingInCombo =
                  relUid &&
                  cardCombo.idxs.some((ci) => G.shop[ci]?.id === relUid);
                if (!stayingInCombo)
                  cardCombo.idxs.forEach((ci) => {
                    row
                      .querySelector(`.scard[data-uid="${G.shop[ci]?.id}"]`)
                      ?.classList.remove("combo-lift");
                  });
              }
            : null;

          requestAnimationFrame(() => {
            el.style.transition =
              "left .38s cubic-bezier(.22,.68,0,1.2),opacity .26s ease,transform .18s ease,filter .18s ease,box-shadow .18s ease";
            el.style.left = `${targetLeft}px`;
            el.style.opacity = "1";
          });

          const shopInfoBtn = el.querySelector(".hf-info-btn");
          if (shopInfoBtn) {
            shopInfoBtn.addEventListener("mouseenter", () =>
              SkillTip.show(shopInfoBtn, generateHeroInfoHtml(u)),
            );
            shopInfoBtn.addEventListener("mouseleave", () => SkillTip.hide());
            shopInfoBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              SkillTip.show(shopInfoBtn, generateHeroInfoHtml(u));
            });
          }
        });
        document.getElementById("breroll").disabled =
          G.gold < HF.value_new_recruitment || !active;
      }

      function renderBench() {
        const row = document.getElementById("benchrow");
        row.innerHTML = "";
        const active = G.phase === "shop";
        if (!G.bench.length) {
          const m = document.createElement("div");
          m.className = "bench-msg";
          m.textContent = "Barracks empty — buy heroes from Recruitment →";
          row.appendChild(m);
        } else {
          G.bench.forEach((u, bi) => {
            const cc = C[u.cid],
              isSel = G.bsel === u.cid;
            const isNewRecruit = G._newBenchCids && G._newBenchCids.has(u.cid);
            if (isNewRecruit) G._newBenchCids.delete(u.cid);
            const card = document.createElement("div");
            card.className = `bcard${isSel ? " bsel" : ""}${isNewRecruit ? " bcard-enter" : ""}`;
            if (isNewRecruit) card.style.animationDelay = bi * 40 + "ms";
            card.dataset.cid = u.cid;
            card.style.cssText = `background:${cc.bg};border-color:${isSel ? "#88ccff" : cc.col}`;
            const dotColor =
              u.lv === 1
                ? cc.col
                : u.lv === 2
                  ? "#4488ff"
                  : u.lv === 3
                    ? "#aa44ff"
                    : "#ffaa00";
            const nextLbl = u.lv < 5 ? ` → ${LS[u.lv + 1]}` : "(MAX)";
            let dotsHtml = `<div class="bprog" style="color:${dotColor}">`;
            for (let d = 0; d < 3; d++)
              dotsHtml += `<div class="bprog-dot ${d < u.stack ? "filled" : "empty"}" style="border-color:${dotColor}"></div>`;
            dotsHtml += `</div>`;

            card.innerHTML = `<div class="blvl">${LS[u.lv]}</div><div class="hf-info-btn" title="">i</div><div class="cportrait ${cc.portrait ? "has-portrait" : ""}"${cc.portrait ? ` style="--portrait-url: url('${cc.portrait}')"` : ""}><div class="cico">${u.ico}</div></div>${dotsHtml}`;

            if (active) {
              card.addEventListener("click", () => {
                G.bsel = G.bsel === u.cid ? null : u.cid;
                render();
              });
              card.draggable = true;
              card.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("benchCid", u.cid);
                e.dataTransfer.effectAllowed = "move";
                G.bsel = u.cid;
                setTimeout(() => {
                  card.classList.add("dragging");
                  document
                    .querySelectorAll("#pfield .cell:not(.occ)")
                    .forEach((c) => c.classList.add("dr"));
                }, 0);
              });
              card.addEventListener("dragend", () => {
                card.classList.remove("dragging");
                G.bsel = null;
                render();
              });
            }

            // ✅ ADICIONAR ISTO FORA do if(active), DEPOIS de appendChild
            row.appendChild(card);

            const benchInfoBtn = card.querySelector(".hf-info-btn");
            if (benchInfoBtn) {
              benchInfoBtn.addEventListener("mouseenter", () =>
                SkillTip.show(benchInfoBtn, generateHeroInfoHtml(u)),
              );
              benchInfoBtn.addEventListener("mouseleave", () =>
                SkillTip.hide(),
              );
              benchInfoBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                SkillTip.show(benchInfoBtn, generateHeroInfoHtml(u));
              });
            }
          });
          for (let i = G.bench.length; i < BARRACKS_MAX; i++) {
            const ph = document.createElement("div");
            ph.className = "bcard-empty";
            row.appendChild(ph);
          }
        }
        const bc = document.getElementById("bcount");
        if (bc) bc.textContent = `${G.bench.length}/${BARRACKS_MAX}`;
        const bw = document.getElementById("benchwrap");
        if (bw) bw.classList.toggle("expanded", G.bench.length > 0);
      }

      // ✅ FUNÇÃO AUXILIAR para escapar HTML no tooltip
      function escapeHtml(text) {
        const map = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
      }

      function updateHdr() {
        document.getElementById("h-gold").textContent = `💰 ${G.gold}`;
      }

      function render() {
        clearAttackArrows();
        renderField("pfield", G.board, true);
        renderField(
          "efield",
          G.phase === "battle" ? G.enemy : G.duelEnemy,
          false,
        );
        renderShop();
        renderBench();
        updateHdr();
        renderDuelBar();
        document.getElementById("bfight").disabled = G.phase !== "shop";
        const n = G.board.filter(Boolean).length,
          mx = maxUnits();
        const acEl = document.getElementById("army-count");
        if (acEl) acEl.textContent = `${n}/${mx}`;
        if (G.phase === "shop") {
          const selUnit = G.bsel ? G.bench.find((u) => u.cid === G.bsel) : null;
          const hint = selUnit
            ? `${selUnit.name} selected — click a field slot or drag to place`
            : G.bench.length
              ? "Click a Barracks card to select, then click a field slot"
              : "Buy heroes from Recruitment, then place them on your field";
          setBanner(hint, "bshop");
        }
        // ── Mobile sync (runs every render regardless of call site) ──
        const mbb = document.getElementById("mobile-battle-btn");
        if (mbb) mbb.disabled = G.phase !== "shop";
        if (typeof window._mobilePhaseSync === "function") window._mobilePhaseSync(G.phase);
      }

      window.render = render;

      // ── Boot ──
      function _bootBattle() {
        initGame(); // async: auto-start happens inside after data loads
        // Show username badge in header
        const uEl = document.getElementById("h-user");
        if (uEl) {
          uEl.textContent = window._HF_SESSION?.username
            ? "@" + window._HF_SESSION.username
            : "@you";
        }
      }
      // If loaded dynamically after DOM is ready (React SPA), fire immediately
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _bootBattle);
      } else {
        _bootBattle();
      }

      // ── Mobile phase navigation ──
      let _mobileStep = null;

      function setMobileStep(step) {
        if (step === _mobileStep) step = null;
        _mobileStep = step;
        document.getElementById("shopwrap")?.classList.remove("mobile-open");
        document.getElementById("benchwrap")?.classList.remove("mobile-open");
        document.getElementById("mobile-log-overlay")?.classList.remove("open");
        if (step === "recruit") document.getElementById("shopwrap")?.classList.add("mobile-open");
        else if (step === "barracks") document.getElementById("benchwrap")?.classList.add("mobile-open");
        document.querySelectorAll(".mobile-actions button[data-step]").forEach((btn) => {
          btn.classList.toggle("ms-active", btn.dataset.step === step);
        });
      }
      window.setMobileStep = setMobileStep;

      function togglePanel(type) {
        if (type !== "log") return;
        document.getElementById("mobile-log-overlay")?.classList.toggle("open");
      }
      window.togglePanel = togglePanel;

      // Comportamentos mobile: auto-open, auto-advance
      // _mobilePhaseSync é chamado dentro de render() a cada frame — sem wrapper frágil
      (function () {
        let _lastPhase = null;
        window._mobilePhaseSync = function (phase) {
          // Só executa em viewports mobile (checagem em tempo de execução para suportar
          // troca de modo no DevTools sem recarregar a página)
          if (!window.matchMedia("(max-width: 768px)").matches &&
              !window.matchMedia("(pointer: coarse)").matches) return;

          // Transição para combat: fecha painéis
          if (phase === "combat" && _lastPhase !== "combat") {
            document.getElementById("shopwrap")?.classList.remove("mobile-open");
            document.getElementById("benchwrap")?.classList.remove("mobile-open");
          }
          // Transição para shop (nova rodada): sempre abre recruit.
          // Zera _mobileStep antes de chamar setMobileStep para evitar que o
          // comportamento de toggle feche o painel caso já estivesse em "recruit".
          if (phase === "shop" && _lastPhase !== "shop") {
            _mobileStep = null;
            setMobileStep("recruit");
          }
          // Auto-avança para barracks quando não tem mais ação de compra possível.
          // Usa cardCost(c.cid) porque mkUnit() não popula c.cost nos cards da loja.
          if (phase === "shop" && _mobileStep === "recruit") {
            const gold = G.gold;
            const shop = G.shop ?? [];
            const canBuy = shop.some((c) => {
              if (!c) return false;
              const cost = c.cost != null ? c.cost : cardCost(c.cid);
              return cost <= gold;
            });
            const canReroll = gold >= HF.value_new_recruitment;
            if (!canBuy && !canReroll) setMobileStep("barracks");
          }
          _lastPhase = phase;
        };
      })();