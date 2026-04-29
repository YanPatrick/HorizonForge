      (function () {
        /* ── Auth guard ──────────────── */
        function getSession() {
          try {
            return JSON.parse(sessionStorage.getItem("hf_session"));
          } catch {
            return null;
          }
        }
        const session = getSession();
        if (!session) {
          window.location.replace("/");
          return;
        }

        /* ── Show user info ──────────── */
        document.getElementById("nav-user").textContent =
          "@" + session.username;

        if (session.mode === "hive") {
          // Avatar from Hive images CDN
          const avatarEl = document.getElementById("nav-avatar");
          avatarEl.src = `https://images.hive.blog/u/${session.username}/avatar`;
          avatarEl.onerror = () => {
            avatarEl.src = "";
            avatarEl.style.display = "none";
          };
          fetchBalance(session.username);
        } else {
          // Guest: hide balance, show simple avatar placeholder
          document.getElementById("hive-bal").style.display = "none";
          const avatarEl = document.getElementById("nav-avatar");
          avatarEl.style.display = "none";
        }

        async function fetchBalance(user) {
          try {
            const r = await fetch("https://api.hive.blog", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "condenser_api.get_accounts",
                params: [[user]],
                id: 1,
              }),
            });
            const d = await r.json();
            if (d.result && d.result[0]) {
              document.getElementById("hive-bal-val").textContent =
                d.result[0].balance;
              return parseFloat(d.result[0].balance);
            }
          } catch {
            /* silent */
          }
          return null;
        }

        /* ── Logout ──────────────────── */
        window.doLogout = function () {
          sessionStorage.removeItem("hf_session");
          sessionStorage.removeItem("hf_battle_cfg");
          window.location.replace("/");
        };

        /* ── View system ─────────────── */
        window.showView = function showView(id) {
          document
            .querySelectorAll(".lv")
            .forEach((v) => v.classList.remove("active"));
          document.getElementById(id).classList.add("active");
          document
            .getElementById("nav-btn-home")
            .classList.toggle("active", id === "view-home");
          document
            .getElementById("nav-btn-grimoire")
            .classList.toggle("active", id === "view-grimoire");
          document
            .getElementById("nav-btn-formation")
            .classList.toggle("active", id === "view-formation");
          document
            .getElementById("nav-btn-settings")
            .classList.toggle("active", id === "view-settings");
          const navKey = id.slice("view-".length);
          document.querySelectorAll(".mbt-tab").forEach((t) => {
            t.classList.toggle("active", t.dataset.nav === navKey);
          });
        };

        /* ── Grimoire ────────────────── */
        const GR_LABELS = {
          0: "Basics",
          1: "Formation",
          2: "Gold & Recruit",
          3: "Battlefield",
          4: "Combos",
          5: "Fusion",
          6: "Strategies",
        };

        window.openGrimoire = function () {
          showView("view-grimoire");
        };
        window.closeGrimoire = function () {
          showView("view-home");
        };
        window.grNav = function (idx) {
          // Sidebar items (desktop)
          document
            .querySelectorAll("#view-grimoire .wiki-item[data-ch]")
            .forEach((t) =>
              t.classList.toggle("active", Number(t.dataset.ch) === idx),
            );
          // Chapter content
          document
            .querySelectorAll("#gr-wiki-content .gr-chapter")
            .forEach((c, i) => c.classList.toggle("active", i === idx));
          // Mobile bar label
          const lbl = document.getElementById("gr-mobile-label");
          if (lbl) lbl.textContent = GR_LABELS[idx] ?? "";
          // Overlay items active state
          document
            .querySelectorAll(".gr-tp-item[data-gr-ch]")
            .forEach((t) =>
              t.classList.toggle("active", Number(t.dataset.grCh) === idx),
            );
          document.getElementById("gr-wiki-content").scrollTop = 0;
        };
        window.grOpenTopics = function () {
          document.getElementById("gr-topics-overlay").classList.add("open");
        };
        window.grCloseTopics = function () {
          document.getElementById("gr-topics-overlay").classList.remove("open");
        };
        window.grNavMobile = function (idx) {
          grNav(idx);
          grCloseTopics();
        };
        // Keep grTab as alias for backward compat
        window.grTab = window.grNav;

        /* ── Heroes shared state ──────── */
        let _heroData = null;

        function _roleCategory(role) {
          if (!role) return "dps";
          const r = role.toLowerCase();
          if (r === "tank" || r === "paladin") return "tank";
          if (r === "support") return "support";
          return "dps";
        }

        /* ── Toast ───────────────────── */
        let toastTimer;
        window.toast = function (msg) {
          const el = document.getElementById("toast");
          el.textContent = msg;
          el.classList.add("show");
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
        };

        /* ── Prefs persistence helpers ── */
        function _prefKey(name) {
          return session?.username
            ? `hf_${name}_${session.username}`
            : `hf_${name}`;
        }
        function _loadPref(name, fallback) {
          const v = localStorage.getItem(_prefKey(name));
          return v !== null ? v : String(fallback);
        }
        function _savePref(name, val) {
          localStorage.setItem(_prefKey(name), String(val));
        }
        function _applyPills(containerId, dataAttr, savedVal) {
          document
            .getElementById(containerId)
            .querySelectorAll(".pill")
            .forEach((btn) => {
              btn.classList.toggle(
                "active",
                btn.dataset[dataAttr] === savedVal,
              );
            });
        }

        /* ── Fetch payout rates from DB ─ */
        (async function fetchPayoutRates() {
          try {
            const r = await fetch("/api/config");
            const { config } = await r.json();
            const liq = config.percent_payout_liquid;
            const stk = config.percent_payout_stake;
            if (liq != null)
              document.getElementById("pct-liquid").textContent =
                `${liq}% payout`;
            if (stk != null)
              document.getElementById("pct-stake").textContent =
                `${stk}% payout`;
          } catch {
            // fallback text stays as-is if request fails
          }
        })();

        /* ── HF Select — floating dropdown manager ───────────────────
           Works inside overflow:hidden containers by using position:fixed
           and getBoundingClientRect() to place the panel in viewport space.
        ─────────────────────────────────────────────────────────────── */
        (function () {
          const dd = document.createElement("div");
          dd.id = "hf-float-dd";
          document.body.appendChild(dd);
          let _activeTrigger = null;

          function _close() {
            if (_activeTrigger) {
              _activeTrigger.setAttribute("aria-expanded", "false");
              _activeTrigger
                .closest(".hf-select")
                ?.classList.remove("sel-open");
              _activeTrigger = null;
            }
            dd.classList.remove("dd-open");
          }

          window._hfSelectOpen = function (
            trigger,
            opts,
            currentVal,
            theme,
            onChange,
          ) {
            if (_activeTrigger === trigger) {
              _close();
              return;
            }
            _close();
            _activeTrigger = trigger;
            trigger.setAttribute("aria-expanded", "true");
            trigger.closest(".hf-select")?.classList.add("sel-open");

            dd.dataset.theme = theme || "";
            dd.innerHTML = "";

            opts.forEach(({ val, label }) => {
              const btn = document.createElement("button");
              btn.className =
                "hf-sel-opt" +
                (String(val) === String(currentVal) ? " active" : "");
              btn.type = "button";
              btn.textContent = label;
              btn.setAttribute("role", "option");
              btn.setAttribute(
                "aria-selected",
                String(val) === String(currentVal),
              );
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                trigger.querySelector(".hf-sel-value").textContent = label;
                onChange(val);
                _close();
              });
              btn.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  btn.click();
                }
                if (e.key === "Escape") {
                  _close();
                  trigger.focus();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  btn.nextElementSibling?.focus();
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  btn.previousElementSibling?.focus();
                }
              });
              dd.appendChild(btn);
            });

            /* Measure height before positioning */
            dd.style.cssText =
              "visibility:hidden;display:flex;flex-direction:column;";
            const ddH = dd.scrollHeight;
            const ddW = Math.max(trigger.offsetWidth, 120);
            dd.style.cssText = "";

            const r = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - r.bottom - 8;
            const top = spaceBelow >= ddH ? r.bottom + 4 : r.top - ddH - 4;
            let left = r.left;
            if (left + ddW > window.innerWidth - 8)
              left = window.innerWidth - ddW - 8;
            if (left < 8) left = 8;

            dd.style.cssText = `top:${top}px;left:${left}px;min-width:${ddW}px;`;
            dd.classList.add("dd-open");
          };

          document.addEventListener("click", _close);
          window.addEventListener("resize", _close);
          window.addEventListener("scroll", _close, true);
        })();

        /* ── Option definitions ─────────── */
        const FMT_OPTS = [
          { val: 3, label: "BO3" },
          { val: 5, label: "BO5" },
          { val: 7, label: "BO7" },
        ];
        const BET_OPTS = [
          { val: 0, label: "Free" },
          { val: 1, label: "1 HIVE" },
          { val: 5, label: "5 HIVE" },
          { val: 10, label: "10 HIVE" },
        ];

        function _setSelectLabel(id, opts, val) {
          const sel = document.getElementById(id);
          if (!sel) return;
          const match = opts.find((o) => String(o.val) === String(val));
          if (match)
            sel.querySelector(".hf-sel-value").textContent = match.label;
        }

        /* ── AI config state ─────────── */
        const aiCfg = { format: Number(_loadPref("ai_fmt", 5)) };
        _setSelectLabel("ai-fmt-select", FMT_OPTS, aiCfg.format);

        document
          .getElementById("ai-fmt-select")
          .querySelector(".hf-sel-trigger")
          .addEventListener("click", (e) => {
            e.stopPropagation();
            window._hfSelectOpen(
              e.currentTarget,
              FMT_OPTS,
              aiCfg.format,
              "ai",
              (val) => {
                aiCfg.format = Number(val);
                _savePref("ai_fmt", aiCfg.format);
              },
            );
          });

        /* ── Start AI Battle ─────────── */
        document
          .getElementById("btn-ai-battle")
          .addEventListener("click", async () => {
            const formationHeroIds = await _ensureActiveDeck();
            if (!formationHeroIds) {
              toast("⚠️ Nenhum deck selecionado. Monte uma formação primeiro!");
              return;
            }
            sessionStorage.setItem(
              "hf_battle_cfg",
              JSON.stringify({
                mode: "ai",
                format: aiCfg.format,
                formationHeroIds,
              }),
            );
            window.location.href = "/battle.html";
          });

        /* ── PvP state ───────────────── */
        const pvpCfg = {
          bet: Number(_loadPref("pvp_bet", 0)),
          fmt: Number(_loadPref("pvp_fmt", 5)),
        };
        _setSelectLabel("pvp-bet-select", BET_OPTS, pvpCfg.bet);
        _setSelectLabel("pvp-fmt-select", FMT_OPTS, pvpCfg.fmt);

        document
          .getElementById("pvp-bet-select")
          .querySelector(".hf-sel-trigger")
          .addEventListener("click", (e) => {
            e.stopPropagation();
            window._hfSelectOpen(
              e.currentTarget,
              BET_OPTS,
              pvpCfg.bet,
              "pvp",
              (val) => {
                pvpCfg.bet = Number(val);
                _savePref("pvp_bet", pvpCfg.bet);
              },
            );
          });

        document
          .getElementById("pvp-fmt-select")
          .querySelector(".hf-sel-trigger")
          .addEventListener("click", (e) => {
            e.stopPropagation();
            window._hfSelectOpen(
              e.currentTarget,
              FMT_OPTS,
              pvpCfg.fmt,
              "pvp",
              (val) => {
                pvpCfg.fmt = Number(val);
                _savePref("pvp_fmt", pvpCfg.fmt);
              },
            );
          });

        // Remove "Coming Soon" badge and enable button
        const pvpBtn = document.getElementById("btn-pvp-find");
        const soonBadge = pvpBtn.querySelector(".btn-soon-badge");
        if (soonBadge) soonBadge.remove();
        pvpBtn.removeAttribute("disabled");

        /* ── Socket.io ───────────────── */
        // Force WebSocket transport — avoids HTTP long-polling which causes
        // browser sluggishness while the socket is being established.
        const socket = io({ transports: ["websocket"], auth: { token: session.token } });

        // Pre-warm Keychain when user starts searching (not at page load).
        // Moved here so two browsers on the same machine don't warm up simultaneously.

        let _searchTimer = null;
        let _searchSec = 0;

        const SEARCH_PHRASES = [
          "FINDING OPPONENT",
          "SCANNING ARENA",
          "SEEKING CHALLENGER",
          "ENTERING QUEUE",
          "AWAITING DUEL",
        ];
        let _phraseIdx = 0;
        let _phraseTimer = null;

        function _startSearchUI() {
          // Pre-warm Keychain here (user action context) so connection to
          // Hive nodes is established before match_found fires.
          if (window.hive_keychain && pvpCfg.bet > 0) {
            window.hive_keychain.requestHandshake(() => {});
          }

          const overlay = document.getElementById("search-overlay");
          overlay.classList.remove("found");
          overlay.classList.add("open");

          // Config tag
          const betLabel = pvpCfg.bet === 0 ? "Free" : `${pvpCfg.bet} HIVE`;
          document.getElementById("search-config-tag").textContent =
            `${betLabel} · BO${pvpCfg.fmt}`;

          // Timer reset
          _searchSec = 0;
          document.getElementById("search-timer").textContent = "0:00";
          clearInterval(_searchTimer);
          _searchTimer = setInterval(() => {
            _searchSec++;
            const m = Math.floor(_searchSec / 60);
            const s = String(_searchSec % 60).padStart(2, "0");
            document.getElementById("search-timer").textContent = `${m}:${s}`;
          }, 1000);

          // Rotating phrases
          _phraseIdx = 0;
          document.getElementById("search-title").textContent =
            SEARCH_PHRASES[0];
          document.getElementById("search-sub").textContent =
            "Scanning the arena for challengers...";
          clearInterval(_phraseTimer);
          _phraseTimer = setInterval(() => {
            _phraseIdx = (_phraseIdx + 1) % SEARCH_PHRASES.length;
            document.getElementById("search-title").textContent =
              SEARCH_PHRASES[_phraseIdx];
          }, 2800);

          // Cancel button visible
          document.getElementById("btn-cancel-search").style.display = "";
        }

        function _stopSearchUI() {
          clearInterval(_searchTimer);
          clearInterval(_phraseTimer);
        }

        pvpBtn.addEventListener("click", async () => {
          if (session.mode !== "hive") {
            toast("PvP requires a Hive account. Log in with Hive to play! 🏆");
            return;
          }
          const heroIds = await _ensureActiveDeck();
          if (!heroIds) {
            toast("⚠️ Nenhum deck selecionado. Monte uma formação primeiro!");
            return;
          }
          if (pvpCfg.bet > 0) {
            const balance = await fetchBalance(session.username);
            if (balance === null) {
              toast(
                "⚠️ Não foi possível verificar seu saldo. Tente novamente.",
              );
              return;
            }
            if (balance < pvpCfg.bet) {
              toast(
                `⚠️ Saldo insuficiente! Você tem ${balance.toFixed(3)} HIVE, mas a aposta é de ${pvpCfg.bet} HIVE.`,
              );
              return;
            }
          }
          _startSearchUI();
          socket.emit("join_queue", {
            wager: pvpCfg.bet,
            format: pvpCfg.fmt,
          });
          socket._pvpFmt = pvpCfg.fmt;
        });

        socket.on("queue_update", (data) => {
          const el = document.getElementById("search-queue");
          if (el)
            el.textContent = `Players in queue: ${data.queueSize ?? data.count ?? "—"}`;
        });

        // ── active match data used across payment handlers ──
        let _matchData = null;
        let _payCountdownInterval = null;

        function _startPayCountdown(seconds) {
          _clearPayCountdown();
          const el = document.getElementById("pay-countdown");
          el.style.display = "block";
          let remaining = seconds;
          function _tick() {
            el.textContent = `⏳ Confirm in Keychain — ${remaining}s remaining`;
            el.classList.toggle("urgent", remaining <= 10);
            if (remaining <= 0) {
              _clearPayCountdown();
            }
            remaining--;
          }
          _tick();
          _payCountdownInterval = setInterval(_tick, 1000);
        }

        function _clearPayCountdown() {
          clearInterval(_payCountdownInterval);
          _payCountdownInterval = null;
          const el = document.getElementById("pay-countdown");
          if (el) {
            el.style.display = "none";
            el.classList.remove("urgent");
          }
        }

        function _saveAndRedirect() {
          if (!_matchData) return;
          // _ensureActiveDeck() was already called in the PvP click handler,
          // so _formations and _defaultFormSlot are up-to-date
          const f = _formations[_defaultFormSlot];
          const formationHeroIds = f?.hero_ids?.length ? f.hero_ids : null;
          sessionStorage.setItem(
            "hf_battle_cfg",
            JSON.stringify({
              mode: "pvp",
              matchId: _matchData.matchId,
              opponent: _matchData.opponent,
              isP1: _matchData.isP1,
              format: _matchData.format,
              wager: _matchData.wager,
              payoutPref: getPayoutPref(),
              formationHeroIds,
            }),
          );
          setTimeout(() => {
            window.location.href = "/battle.html";
          }, 800);
        }

        function _setPayStep(stepId, state) {
          // state: 'active' | 'done' | 'error' | '' (pending)
          const el = document.getElementById(stepId);
          if (!el) return;
          el.className = "pay-step" + (state ? " " + state : "");
          const icon = el.querySelector(".pay-step-icon");
          if (icon) {
            if (state === "done") icon.textContent = "✅";
            else if (state === "error") icon.textContent = "❌";
            else if (stepId === "pay-step-send") icon.textContent = "💸";
            else if (stepId === "pay-step-verify") icon.textContent = "🔍";
            else if (stepId === "pay-step-opponent") icon.textContent = "⏳";
          }
        }

        function _showPayError(msg) {
          document.getElementById("pay-error").style.display = "block";
          document.getElementById("pay-error").textContent = msg;
          document.getElementById("btn-retry-pay").style.display =
            "inline-block";
          document.getElementById("btn-cancel-search").style.display = "";
          document.getElementById("pay-status").textContent = "Payment failed";
        }

        window._sendKeychainTransfer = function _sendKeychainTransfer() {
          if (!_matchData) return;
          const { matchId, wager } = _matchData;
          const payoutPref = getPayoutPref();
          const memo = `battle_${matchId}_${payoutPref}`;
          const gameAccount = _matchData.gameAccount;

          if (!window.hive_keychain) {
            _showPayError(
              "Hive Keychain extension not found. Please install it and retry.",
            );
            _setPayStep("pay-step-send", "error");
            return;
          }

          _setPayStep("pay-step-send", "active");
          document.getElementById("pay-status").textContent =
            "Opening Keychain...";
          document.getElementById("pay-error").style.display = "none";
          document.getElementById("btn-retry-pay").style.display = "none";
          document.getElementById("btn-send-wager").style.display = "none";

          window.hive_keychain.requestTransfer(
            session.username,
            gameAccount,
            wager.toFixed(3),
            memo,
            "HIVE",
            (response) => {
              if (response.success) {
                _setPayStep("pay-step-send", "done");
                _setPayStep("pay-step-verify", "active");
                document.getElementById("pay-status").textContent =
                  "Verifying on blockchain...";
                const txId =
                  response.result?.id || response.result?.trx_id || "";
                socket.emit("wager_sent", { matchId, txId });
              } else {
                _setPayStep("pay-step-send", "error");
                const reason =
                  response.message ||
                  response.error ||
                  "Keychain request cancelled";
                _showPayError(reason);
              }
            },
          );
        };

        window._retryWager = function () {
          _setPayStep("pay-step-send", "");
          _setPayStep("pay-step-verify", "");
          _setPayStep("pay-step-opponent", "");
          document.getElementById("pay-error").style.display = "none";
          document.getElementById("btn-retry-pay").style.display = "none";
          document.getElementById("pay-status").textContent =
            `Wager: ${_matchData?.wager} HIVE`;
          document.getElementById("btn-send-wager").style.display =
            "inline-block";
        };

        socket.on("match_found", (data) => {
          _stopSearchUI();

          const opponent = data.opponents
            ? data.opponents[session.username] ||
              Object.values(data.opponents)[0]
            : data.opponent || "???";

          _matchData = {
            matchId: data.matchId,
            opponent,
            isP1: data.p1 === session.username,
            format: data.format || pvpCfg.fmt,
            wager: data.wager ?? pvpCfg.bet,
            gameAccount: data.gameAccount || "horizonforge",
          };

          const overlay = document.getElementById("search-overlay");
          document.getElementById("search-timer").style.display = "none";
          document.getElementById("search-queue").style.display = "none";
          document.getElementById("btn-cancel-search").style.display = "none";

          if (data.needsPayment) {
            // ── Paid match: show payment flow ──
            overlay.classList.add("paying");
            document.getElementById("search-title").innerHTML =
              `<span class="search-found-title">OPPONENT FOUND!</span>`;
            document.getElementById("search-sub").textContent =
              `vs. ${opponent} — send your wager to enter`;
            document.getElementById("pay-status").style.display = "block";
            document.getElementById("pay-status").textContent =
              `Wager: ${_matchData.wager} HIVE`;
            document.getElementById("pay-steps").style.display = "flex";
            _startPayCountdown(30);
            setTimeout(window._sendKeychainTransfer, 600);
          } else {
            // ── Free match: redirect immediately ──
            overlay.classList.add("found");
            document.getElementById("search-title").innerHTML =
              `<span class="search-found-title">OPPONENT FOUND!</span>`;
            document.getElementById("search-sub").textContent =
              `vs. ${opponent} — entering arena...`;
            _saveAndRedirect();
          }
        });

        socket.on("payment_verifying", () => {
          // server received txId, started on-chain check
          document.getElementById("pay-status").textContent =
            "Checking blockchain...";
          _setPayStep("pay-step-verify", "active");
        });

        socket.on("payment_accepted", () => {
          // my payment confirmed; now wait for opponent
          _setPayStep("pay-step-verify", "done");
          _setPayStep("pay-step-opponent", "active");
          document.getElementById("pay-status").textContent =
            "Wager confirmed! Waiting for opponent...";
        });

        socket.on("opponent_paid", () => {
          // opponent payment confirmed; almost there
          document.getElementById("pay-status").textContent =
            "Opponent paid! Starting match...";
        });

        socket.on("payments_confirmed", () => {
          // both payments verified → go to battle
          _clearPayCountdown();
          _setPayStep("pay-step-opponent", "done");
          document.getElementById("pay-status").textContent =
            "Both payments confirmed!";
          _saveAndRedirect();
        });

        socket.on("wager_failed", (data) => {
          const reason =
            data?.message || data?.reason || "Payment verification failed.";
          _setPayStep("pay-step-verify", "error");
          _showPayError(reason);
        });

        socket.on("wager_refunded", (data) => {
          _clearPayCountdown();
          cancelSearch();
          toast(`↩️ ${data.amount} HIVE refunded. ${data.reason || ""}`);
        });

        socket.on("match_cancelled", (data) => {
          _clearPayCountdown();
          const overlay = document.getElementById("search-overlay");
          if (overlay.classList.contains("paying")) {
            overlay.classList.remove("paying");
            overlay.classList.remove("open");
            document.getElementById("pay-status").style.display = "none";
            document.getElementById("pay-steps").style.display = "none";
            document.getElementById("pay-error").style.display = "none";
            document.getElementById("btn-retry-pay").style.display = "none";
            document.getElementById("btn-send-wager").style.display = "none";
            ["pay-step-send", "pay-step-verify", "pay-step-opponent"].forEach(
              (id) => _setPayStep(id, ""),
            );
            _matchData = null;
          }
        });

        socket.on("requeued", (data) => {
          // Opponent didn't confirm — we're back in the queue automatically
          _stopSearchUI();
          toast(
            "⚠️ Oponente não confirmou o pagamento. Buscando novo adversário...",
          );
          _startSearchUI();
          const el = document.getElementById("search-queue");
          if (el && data.queueSize != null)
            el.textContent = `Players in queue: ${data.queueSize}`;
        });

        socket.on("queued", (data) => {
          // Successfully entered queue — update queue size immediately
          const el = document.getElementById("search-queue");
          if (el) el.textContent = `Players in queue: ${data.queueSize ?? "—"}`;
        });

        socket.on("error", (data) => {
          _stopSearchUI();
          document.getElementById("search-overlay").classList.remove("open");
          document.getElementById("search-timer").style.display = "";
          document.getElementById("search-queue").style.display = "";
          toast(data.message || "Matchmaking error. Please try again.");
        });

        // Auto-rejoin queue on socket reconnect (handles freeze/brief disconnect).
        // If the overlay is still open (searching, not yet matched), re-emit join_queue
        // so the server has the correct socket reference. The server upserts the entry.
        socket.on("connect", () => {
          const overlay = document.getElementById("search-overlay");
          const isSearching =
            overlay.classList.contains("open") &&
            !overlay.classList.contains("found") &&
            !overlay.classList.contains("paying");
          if (isSearching && session.username) {
            socket.emit("join_queue", {
              wager: pvpCfg.bet,
              format: pvpCfg.fmt,
            });
            const el = document.getElementById("search-queue");
            if (el) el.textContent = "Reconnecting...";
          }
        });

        // Show a brief "Connection lost" hint if socket drops while searching
        socket.on("disconnect", () => {
          const overlay = document.getElementById("search-overlay");
          if (
            overlay.classList.contains("open") &&
            !overlay.classList.contains("found")
          ) {
            const el = document.getElementById("search-queue");
            if (el) el.textContent = "Connection lost — reconnecting...";
          }
        });

        /* ── Search overlay cancel ───── */
        window.cancelSearch = function () {
          _stopSearchUI();
          _clearPayCountdown();
          const overlay = document.getElementById("search-overlay");
          overlay.classList.remove("open", "found", "paying");
          document.getElementById("search-timer").style.display = "";
          document.getElementById("search-queue").style.display = "";
          // Reset payment UI
          document.getElementById("pay-status").style.display = "none";
          document.getElementById("pay-steps").style.display = "none";
          document.getElementById("pay-error").style.display = "none";
          document.getElementById("btn-retry-pay").style.display = "none";
          document.getElementById("btn-send-wager").style.display = "none";
          ["pay-step-send", "pay-step-verify", "pay-step-opponent"].forEach(
            (id) => _setPayStep(id, ""),
          );
          _matchData = null;
          socket.emit("leave_queue");
        };

        /* ── Settings ── */
        function _payoutKey() {
          return session?.username
            ? `hf_payout_${session.username}`
            : "hf_payout";
        }
        window.getPayoutPref = function () {
          return localStorage.getItem(_payoutKey()) || "liquid";
        };
        function _applyPayoutUI(val) {
          document.querySelectorAll(".stg-pill").forEach((p) => {
            p.classList.toggle("active", p.dataset.payout === val);
          });
        }
        window.selectPayout = function (val) {
          localStorage.setItem(_payoutKey(), val);
          _applyPayoutUI(val);
          const badge = document.getElementById("stg-saved");
          badge.classList.add("show");
          setTimeout(() => badge.classList.remove("show"), 2000);
        };
        window.openSettings = function () {
          _applyPayoutUI(getPayoutPref());
          showView("view-settings");
        };

        /* ── Formations ──────────────────────────────────────── */
        let _formations = [
          { slot: 1, name: "", hero_ids: [] },
          { slot: 2, name: "", hero_ids: [] },
          { slot: 3, name: "", hero_ids: [] },
        ];
        let _activeFormSlot = 0;
        let _defaultFormSlot = 0;
        let _formRoleFilter = "all";
        let _formHeroSearch = "";
        let _formationsLoaded = false;
        let _editingOpen = false;

        window.openFormation = async function () {
          if (!window._hfDetailEscBound) {
            window._hfDetailEscBound = true;
            document.addEventListener("keydown", function (e) {
              if (e.key === "Escape") closeHeroDetail();
            });
          }
          showView("view-formation");
          _editingOpen = false;
          const panel = document.getElementById("fv-slide-panel");
          if (panel) panel.classList.remove("open");
          const savedDefault = localStorage.getItem(
            _prefKey("default_form_slot"),
          );
          if (savedDefault !== null) _defaultFormSlot = Number(savedDefault);
          if (!_formationsLoaded && session.mode !== "guest") {
            await _loadFormations();
          } else if (session.mode === "guest" && !_formationsLoaded) {
            const raw = sessionStorage.getItem("hf_guest_formation");
            if (raw) {
              try {
                const saved = JSON.parse(raw);
                _formations[0].hero_ids = saved.hero_ids || [];
              } catch {
                /* silent */
              }
            }
            _formationsLoaded = true;
          }
          if (!_heroData) {
            try {
              const res = await fetch("/api/characters");
              const d = await res.json();
              if (d.ok) {
                const order = { tank: 0, dps: 1, support: 2 };
                _heroData = d.characters.sort(
                  (a, b) =>
                    (order[_roleCategory(a.role)] ?? 3) -
                    (order[_roleCategory(b.role)] ?? 3),
                );
              }
            } catch {
              /* silent */
            }
          }
          const ld = document.getElementById("form-heroes-loading");
          if (ld) ld.remove();
          _renderDeckCards();
          _renderSlideSlots();
          _renderFormHeroGrid();
        };

        async function _loadFormations() {
          try {
            const res = await fetch(
              `/api/formations?player=${encodeURIComponent(session.username)}`,
            );
            const d = await res.json();
            if (d.ok && Array.isArray(d.formations)) {
              _formations = [1, 2, 3].map((slot) => {
                const found = d.formations.find((f) => f.slot === slot);
                return found
                  ? {
                      slot,
                      name: found.name || "",
                      hero_ids: found.hero_ids || [],
                    }
                  : { slot, name: "", hero_ids: [] };
              });
              _formationsLoaded = true;
            }
          } catch {
            /* silent */
          }
        }

        window.openDeckSlot = function (idx) {
          _activeFormSlot = idx;
          _editingOpen = true;
          closeHeroDetail();
          document
            .getElementById("form-hero-grid")
            ?.classList.add("fhc-editing-mode");
          _renderDeckCards();
          _renderSlideSlots();
          _renderFormHeroGrid();
          const nameInput = document.getElementById("fv-slide-name");
          const f = _formations[idx];
          if (nameInput) nameInput.value = f.name || `format${idx + 1}`;
          const panel = document.getElementById("fv-slide-panel");
          if (panel) panel.classList.add("open");
        };

        window.closeDeckSlot = function () {
          _editingOpen = false;
          document
            .getElementById("form-hero-grid")
            ?.classList.remove("fhc-editing-mode");
          const panel = document.getElementById("fv-slide-panel");
          if (panel) panel.classList.remove("open");
          _renderDeckCards();
          _renderFormHeroGrid();
        };

        window.switchFormSlot = window.openDeckSlot;

        function _renderDeckCards() {
          [0, 1, 2].forEach((i) => {
            const tab = document.getElementById(`form-tab-${i}`);
            const starEl = document.getElementById(`form-tab-star-${i}`);
            const nameEl = document.getElementById(`form-tab-name-${i}`);
            const countEl = document.getElementById(`form-tab-count-${i}`);
            const iconsEl = document.getElementById(`form-tab-icons-${i}`);
            if (!tab) return;
            if (session.mode === "guest" && i !== 0) {
              tab.style.display = "none";
              return;
            }
            tab.style.display = "";
            tab.classList.toggle(
              "fdc-active",
              _editingOpen && i === _activeFormSlot,
            );
            const isDefault = i === _defaultFormSlot;
            if (starEl) {
              starEl.textContent = isDefault ? "★" : "☆";
              starEl.classList.toggle("starred", isDefault);
            }
            const f = _formations[i];
            const displayName = f.name || `format${i + 1}`;
            if (nameEl) nameEl.textContent = displayName;
            if (countEl) countEl.textContent = `${f.hero_ids.length}/8`;
            if (iconsEl) {
              const isFull = f.hero_ids.length === 8;
              iconsEl.innerHTML = `<div class="fv-deck-stack${isFull ? " full" : ""}"><div class="fds-card c3"></div><div class="fds-card c2"></div><div class="fds-card c1"></div></div>`;
            }
          });
        }

        window.setDefaultFormSlot = function (idx) {
          _defaultFormSlot = idx;
          localStorage.setItem(_prefKey("default_form_slot"), String(idx));
          _renderDeckCards();
          const name = _formations[idx].name || `format${idx + 1}`;
          toast(`✅ "${name}" is now your active deck!`);
        };

        async function _ensureActiveDeck() {
          if (session.mode !== "guest" && !_formationsLoaded) {
            await _loadFormations();
          }
          const saved = localStorage.getItem(_prefKey("default_form_slot"));
          if (saved !== null) _defaultFormSlot = Number(saved);
          const f = _formations[_defaultFormSlot];
          return f?.hero_ids?.length ? f.hero_ids : null;
        }

        function _renderSlideSlots() {
          const f = _formations[_activeFormSlot];
          const grid = document.getElementById("form-slots-grid");
          const countEl = document.getElementById("form-count");
          if (countEl) countEl.textContent = f.hero_ids.length;
          if (!grid) return;
          grid.innerHTML = "";
          for (let i = 0; i < 8; i++) {
            const cid = f.hero_ids[i];
            const cell = document.createElement("div");
            cell.className = "fv-slot-cell" + (cid ? " filled" : "");
            if (cid) {
              const hero = _heroData?.find((h) => h.cid === cid);
              if (hero?.url_portrait) {
                cell.classList.add("has-portrait");
                cell.style.setProperty("--portrait-url", `url('${hero.url_portrait}')`);
              } else {
                cell.textContent = hero?.icon || "?";
              }
              cell.title = (hero?.name || cid) + " — click to remove";
              cell.onclick = () => _removeFromFormation(cid);
            } else {
              const hint = document.createElement("span");
              hint.className = "fv-slot-empty-hint";
              hint.textContent = "+";
              cell.appendChild(hint);
            }
            grid.appendChild(cell);
          }
        }

        function _renderFormHeroGrid() {
          if (!_heroData) return;
          const f = _formations[_activeFormSlot];
          const q = _formHeroSearch.toLowerCase();
          const filtered = _heroData.filter((h) => {
            const matchRole =
              _formRoleFilter === "all" ||
              _roleCategory(h.role) === _formRoleFilter;
            const matchSearch = !q || h.name.toLowerCase().includes(q);
            return matchRole && matchSearch;
          });
          const grid = document.getElementById("form-hero-grid");
          grid.innerHTML = "";
          const isFull = f.hero_ids.length >= 8;
          filtered.forEach((h) => {
            const isSelected = f.hero_ids.includes(h.cid);
            const isAddable = _editingOpen && !isSelected && !isFull;
            const card = document.createElement("div");
            card.className =
              "form-hero-card" +
              (isSelected ? " fhc-selected" : "") +
              (isAddable ? " fhc-addable" : "") +
              (!isSelected && isFull && _editingOpen ? " fhc-disabled" : "");
            if (_editingOpen && (isSelected || !isFull)) {
              card.onclick = () => _toggleFormHero(h.cid);
            } else if (!_editingOpen) {
              card.onclick = () => openHeroDetail(h.cid);
            }
            card.innerHTML = `
              <button class="fhc-info-btn" aria-label="Hero info">i</button>
              <div class="form-hc-portrait${h.url_portrait ? " has-portrait" : ""}"${h.url_portrait ? ` style="--portrait-url:url('${h.url_portrait}')"` : ""}>
                ${!h.url_portrait ? `<div class="form-hc-ico">${h.icon}</div>` : ""}
              </div>
              <div class="form-hc-name">${h.name}</div>`;
            card
              .querySelector(".fhc-info-btn")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                openHeroDetail(h.cid);
              });
            grid.appendChild(card);
          });
          if (!filtered.length) {
            grid.innerHTML = '<div class="hh-empty">No heroes found</div>';
          }
        }

        function _buildDetailBodyHTML(h) {
          const cat = _roleCategory(h.role);
          const label =
            cat === "tank" ? "Tank" : cat === "support" ? "Support" : "DPS";
          const lv1 = h.levels[1] || {};
          const hp = lv1.max_hp ?? "—";
          const atk = lv1.atk ?? "—";
          const spd = lv1.atk_speed != null ? lv1.atk_speed.toFixed(1) : "—";
          const fmtSP = (v) =>
            v < 1
              ? `${Math.floor(v * 100)}%`
              : `×${(Math.floor(v * 100) / 100).toFixed(2)}`;
          const sp = lv1.skill_power != null ? fmtSP(lv1.skill_power) : "—";

          const levelKeys = Object.keys(h.levels || {})
            .map(Number)
            .sort((a, b) => a - b);
          const tableRows = levelKeys
            .map((lv) => {
              const s = h.levels[lv] || {};
              return `<tr>
                <td>${lv}</td>
                <td>${s.max_hp}</td>
                <td>${s.atk}</td>
                <td>${s.skill_power != null ? fmtSP(s.skill_power) : "—"}</td>
              </tr>`;
            })
            .join("");

          return `
            <div class="hf-detail-role-wrap">
              <span class="gr-hero-role role-${cat}">${label}</span>
            </div>
            <div class="hf-detail-section-label">Skill</div>
            <div class="hf-detail-skill-name">✦ ${h.skill?.name ?? "—"}</div>
            <div class="hf-detail-skill-desc">${h.skill?.description ?? ""}</div>
            <div class="hf-detail-section-label">Base Stats (Lv 1)</div>
            <div class="hf-detail-stats">
              <div class="hf-detail-stat">
                <span class="hf-stat-label">❤️ HP</span>
                <span class="hf-stat-value">${hp}</span>
              </div>
              <div class="hf-detail-stat">
                <span class="hf-stat-label">⚔️ ATK</span>
                <span class="hf-stat-value">${atk}</span>
              </div>
              <div class="hf-detail-stat">
                <span class="hf-stat-label">⚡ SPD</span>
                <span class="hf-stat-value">${spd}</span>
              </div>
              <div class="hf-detail-stat">
                <span class="hf-stat-label">✨ SP</span>
                <span class="hf-stat-value">${sp}</span>
              </div>
            </div>
            <button class="hf-detail-l2-btn" onclick="toggleHeroDetailL2(this)"><span class="hf-l2-label">View full stats</span><span class="hf-l2-chevron">▾</span></button>
            <div class="hf-detail-l2">
              <table class="hf-detail-l2-table">
                <thead>
                  <tr>
                    <th>Level</th><th>HP</th><th>ATK</th><th>Skill Power</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>`;
        }

        window.openHeroDetail = function (cid) {
          if (_editingOpen) return;
          if (!_heroData) return;
          const h = _heroData.find((x) => String(x.cid) === String(cid));
          if (!h) return;

          const body = _buildDetailBodyHTML(h);
          const isDesktop = window.innerWidth > 640;

          if (isDesktop) {
            document.getElementById("hf-drawer-ico").textContent = h.icon;
            document.getElementById("hf-drawer-name").textContent = h.name;
            document.getElementById("hf-drawer-body").innerHTML = body;
            const drawer = document.getElementById("hf-hero-drawer");
            drawer.classList.add("hf-open");
            drawer.setAttribute("aria-hidden", "false");
            document
              .getElementById("hf-hero-sheet")
              ?.setAttribute("aria-hidden", "true");
          } else {
            document.getElementById("hf-sheet-ico").textContent = h.icon;
            document.getElementById("hf-sheet-name").textContent = h.name;
            document.getElementById("hf-sheet-body").innerHTML = body;
            const sheet = document.getElementById("hf-hero-sheet");
            sheet.classList.add("hf-open");
            sheet.setAttribute("aria-hidden", "false");
            document
              .getElementById("hf-hero-drawer")
              ?.setAttribute("aria-hidden", "true");
          }
          document
            .getElementById("hf-detail-backdrop")
            .classList.add("hf-open");
        };

        window.closeHeroDetail = function () {
          const drawer = document.getElementById("hf-hero-drawer");
          const sheet = document.getElementById("hf-hero-sheet");
          const backdrop = document.getElementById("hf-detail-backdrop");
          if (drawer) {
            drawer.classList.remove("hf-open");
            drawer.setAttribute("aria-hidden", "true");
          }
          if (sheet) {
            sheet.classList.remove("hf-open");
            sheet.setAttribute("aria-hidden", "true");
          }
          if (backdrop) backdrop.classList.remove("hf-open");
        };

        window.toggleHeroDetailL2 = function (btn) {
          const l2 = btn.nextElementSibling;
          const chevron = btn.querySelector(".hf-l2-chevron");
          const isExpanded = l2.classList.contains("expanded");
          if (isExpanded) {
            l2.classList.remove("expanded");
            chevron.classList.remove("expanded");
            btn.querySelector(".hf-l2-label").textContent = "View full stats";
          } else {
            l2.classList.add("expanded");
            chevron.classList.add("expanded");
            btn.querySelector(".hf-l2-label").textContent = "Collapse";
          }
        };

        function _toggleFormHero(cid) {
          if (!_editingOpen) return;
          const f = _formations[_activeFormSlot];
          const idx = f.hero_ids.indexOf(cid);
          if (idx !== -1) {
            f.hero_ids.splice(idx, 1);
          } else {
            if (f.hero_ids.length >= 8) return;
            f.hero_ids.push(cid);
          }
          _renderSlideSlots();
          _renderDeckCards();
          _renderFormHeroGrid();
        }

        function _removeFromFormation(cid) {
          const f = _formations[_activeFormSlot];
          const idx = f.hero_ids.indexOf(cid);
          if (idx !== -1) f.hero_ids.splice(idx, 1);
          _renderSlideSlots();
          _renderDeckCards();
          _renderFormHeroGrid();
        }

        window.onFormNameInput = function () {
          _formations[_activeFormSlot].name =
            document.getElementById("fv-slide-name").value;
          const nameEl = document.getElementById(
            `form-tab-name-${_activeFormSlot}`,
          );
          if (nameEl)
            nameEl.textContent =
              _formations[_activeFormSlot].name ||
              `format${_activeFormSlot + 1}`;
        };

        window.saveDeck = async function () {
          if (session.mode === "guest") {
            const f = _formations[0];
            if (f.hero_ids.length !== 8) {
              toast(`⚠️ Select exactly 8 heroes (${f.hero_ids.length}/8).`);
              return;
            }
            sessionStorage.setItem(
              "hf_guest_formation",
              JSON.stringify({ hero_ids: f.hero_ids }),
            );
            toast("Deck ready! (session only — create an account to save)");
            closeDeckSlot();
            return;
          }
          const f = _formations[_activeFormSlot];
          if (f.hero_ids.length !== 8) {
            toast(`⚠️ Select exactly 8 heroes (${f.hero_ids.length}/8).`);
            return;
          }
          if (!f.name) {
            f.name = `format${_activeFormSlot + 1}`;
            const ni = document.getElementById("fv-slide-name");
            if (ni) ni.value = f.name;
          }
          const btn = document.getElementById("btn-save-form");
          if (btn) {
            btn.disabled = true;
            btn.textContent = "…";
          }
          try {
            const res = await fetch("/api/formations", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                player: session.username,
                slot: f.slot,
                name: f.name,
                hero_ids: f.hero_ids,
              }),
            });
            const d = await res.json();
            if (d.ok) {
              toast("Formation saved! ✅");
              closeDeckSlot();
            } else {
              toast("Error saving formation.");
            }
          } catch {
            toast("Error saving formation.");
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = "DONE";
          }
        };

        window.saveFormation = window.saveDeck;

        window.setFormRoleFilter = function (role) {
          _formRoleFilter = role;
          document
            .querySelectorAll(".fv-role-btn")
            .forEach((b) =>
              b.classList.toggle("active", b.dataset.frole === role),
            );
          _renderFormHeroGrid();
        };

        window.filterFormHeroes = function () {
          _formHeroSearch = document.getElementById("form-hero-search").value;
          _renderFormHeroGrid();
        };

        /* ── Format tooltip (fixed, escapes overflow:hidden) ── */
        (function () {
          const FMT_DATA = {
            3: {
              name: "Best of 3",
              desc: "A duel of up to 3 battles. Each battle you build and fight.",
              wins: 2,
            },
            5: {
              name: "Best of 5",
              desc: "A duel of up to 5 battles. More room to adapt your strategy.",
              wins: 3,
            },
            7: {
              name: "Best of 7",
              desc: "A full duel of up to 7 battles. The ultimate test of strategy.",
              wins: 4,
            },
          };

          const tip = document.createElement("div");
          tip.id = "fmt-tooltip";
          document.body.appendChild(tip);

          document.querySelectorAll(".fmt-wrap").forEach((wrap) => {
            const btn = wrap.querySelector("[data-fmt]");
            if (!btn) return;
            const d = FMT_DATA[parseInt(btn.dataset.fmt)];
            if (!d) return;

            wrap.addEventListener("mouseenter", () => {
              tip.innerHTML =
                `<span class="fmt-tip-name">${d.name}</span>` +
                `<span class="fmt-tip-desc">${d.desc}</span>` +
                `<span class="fmt-tip-win">First to win ${d.wins} battles wins</span>`;

              const r = btn.getBoundingClientRect();
              const TIP_W = 192;
              let left = r.left + r.width / 2 - TIP_W / 2;
              let top = r.bottom + 10;

              // keep inside viewport horizontally
              left = Math.max(8, Math.min(left, window.innerWidth - TIP_W - 8));
              // adjust arrow x to always point at button center
              const arrowLeft = r.left + r.width / 2 - left;
              tip.style.setProperty("--arrow-left", arrowLeft + "px");
              tip.style.left = left + "px";
              tip.style.top = top + "px";
              tip.classList.add("visible");
            });

            wrap.addEventListener("mouseleave", () =>
              tip.classList.remove("visible"),
            );
          });
        })();

        /* ── Description tooltip (info-trigger) ─────────────── */
        (function () {
          const tip = document.getElementById("desc-tooltip");
          let longPressTimer = null;
          let _activeTrigger = null;

          const TIPS = {
            ai: {
              theme: "ai",
              html: `
                <div class="tip-title">⚔️ Solo Battle</div>
                <div class="tip-body">Face the AI bot. No bets, no risk. Great for learning the game mechanics.</div>
                <div class="tip-section">🎯 Format — Best of N</div>
                <div class="tip-rows">
                  <div class="tip-row"><span class="tip-key">BO3</span><span>First to win 2 rounds</span></div>
                  <div class="tip-row"><span class="tip-key">BO5</span><span>First to win 3 rounds</span></div>
                  <div class="tip-row"><span class="tip-key">BO7</span><span>First to win 4 rounds</span></div>
                </div>`,
            },
            pvp: {
              theme: "pvp",
              html: `
                <div class="tip-title">🏆 PvP Arena</div>
                <div class="tip-body">Challenge real players online. The winner takes most of the pot.</div>
                <div class="tip-section">💰 Bet HIVE</div>
                <div class="tip-rows">
                  <div class="tip-row"><span class="tip-key">Free</span><span>Casual match</span></div>
                  <div class="tip-row"><span class="tip-key">1 / 5 / 10</span><span>Wager HIVE tokens</span></div>
                </div>
                <div class="tip-section">🎯 Format — Best of N</div>
                <div class="tip-rows">
                  <div class="tip-row"><span class="tip-key">BO3</span><span>First to win 2 rounds</span></div>
                  <div class="tip-row"><span class="tip-key">BO5</span><span>First to win 3 rounds</span></div>
                  <div class="tip-row"><span class="tip-key">BO7</span><span>First to win 4 rounds</span></div>
                </div>`,
            },
          };

          function showTip(trigger) {
            const id = trigger.dataset.tipId;
            const entry = TIPS[id];
            if (!entry) return;
            tip.innerHTML = entry.html;
            tip.dataset.theme = entry.theme;
            _activeTrigger = trigger;
            trigger.classList.add("tip-active");

            const tipW = 260;
            const margin = 8;
            tip.style.cssText = `visibility:hidden;display:block;width:${tipW}px;`;
            const tipH = tip.offsetHeight;
            tip.style.cssText = "";

            const rect = trigger.getBoundingClientRect();
            let left = rect.left + rect.width / 2 - tipW / 2;
            left = Math.max(
              margin,
              Math.min(left, window.innerWidth - tipW - margin),
            );
            let top = rect.top - tipH - 6;
            if (top < margin) top = rect.bottom + 6;

            tip.style.left = left + "px";
            tip.style.top = top + "px";
            tip.classList.add("visible");
          }

          function hideTip() {
            tip.classList.remove("visible");
            if (_activeTrigger) {
              _activeTrigger.classList.remove("tip-active");
              _activeTrigger = null;
            }
          }

          document.querySelectorAll(".info-trigger").forEach((trigger) => {
            trigger.addEventListener("mouseenter", () => showTip(trigger));
            trigger.addEventListener("mouseleave", hideTip);

            trigger.addEventListener(
              "touchstart",
              (e) => {
                e.preventDefault();
                longPressTimer = setTimeout(() => showTip(trigger), 500);
              },
              { passive: false },
            );
            trigger.addEventListener("touchend", () => {
              clearTimeout(longPressTimer);
              setTimeout(hideTip, 1800);
            });
            trigger.addEventListener("touchcancel", () => {
              clearTimeout(longPressTimer);
              hideTip();
            });

            trigger.addEventListener("click", (e) => {
              e.stopPropagation();
              tip.classList.contains("visible") && _activeTrigger === trigger
                ? hideTip()
                : showTip(trigger);
            });
          });

          document.addEventListener("click", hideTip);
        })();
      })();