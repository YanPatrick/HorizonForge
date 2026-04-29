      (function () {
        /* ── Session ────────────────────────────────── */
        function getSession() {
          try {
            return JSON.parse(sessionStorage.getItem("hf_session"));
          } catch {
            return null;
          }
        }
        if (getSession()) {
          window.location.replace("/lobby.html");
          return;
        }

        /* ── DOM ────────────────────────────────────── */
        const inputEl = document.getElementById("hive-user");
        const errEl = document.getElementById("err-msg");
        const kcWarn = document.getElementById("kc-warn");

        function setErr(m) {
          errEl.textContent = m;
        }
        function clrErr() {
          errEl.textContent = "";
        }

        /* ── Keychain login ─────────────────────────── */
        function doLogin() {
          clrErr();
          const raw = inputEl.value.trim();
          if (!raw) {
            setErr("Please enter your Hive username.");
            return;
          }
          const username = raw.toLowerCase();

          if (typeof window.hive_keychain === "undefined") {
            kcWarn.classList.add("show");
            setErr("Hive Keychain extension not found.");
            return;
          }
          kcWarn.classList.remove("show");

          const memo = `horizon-forge-login-${Date.now()}`;
          window.hive_keychain.requestSignBuffer(
            username,
            memo,
            "Posting",
            async (resp) => {
              if (!resp.success) {
                setErr(resp.message || "Login cancelled or failed.");
                return;
              }
              try {
                const r = await fetch("/api/auth/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username,
                    memo,
                    signature: resp.result,
                  }),
                });
                const data = await r.json();
                if (!r.ok || !data.token) {
                  setErr(data.error || "Server verification failed.");
                  return;
                }
                sessionStorage.setItem(
                  "hf_session",
                  JSON.stringify({
                    username,
                    mode: "hive",
                    ts: Date.now(),
                    token: data.token,
                  }),
                );
                window.location.href = "/lobby.html";
              } catch {
                setErr("Network error. Please try again.");
              }
            },
          );
        }

        document.getElementById("btn-kc").addEventListener("click", doLogin);
        inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") doLogin();
        });

        /* ── Guest login ────────────────────────────── */
        document.getElementById("btn-guest").addEventListener("click", () => {
          sessionStorage.setItem(
            "hf_session",
            JSON.stringify({
              username: "guest",
              mode: "guest",
              ts: Date.now(),
            }),
          );
          window.location.href = "/lobby.html";
        });
      })();