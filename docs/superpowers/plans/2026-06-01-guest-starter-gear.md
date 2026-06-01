# Guest Starter Gear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guests always play with the fixed starter loadout — they cannot equip or unequip items, and no player-specific gear rows are created for them.

**Architecture:** The `GET /api/gear` endpoint now checks for a Bearer token first. If none is present (guest), it reads the universal `character_starter_loadout` table and returns those bonuses without touching `hero_equipment`. The `PUT /api/gear/equip` and `POST /api/gear/unequip` endpoints already return 401 for unauthenticated requests, blocking guests by default. The client-side guest branch in `BattlePage.jsx` already sends no auth header, so it will receive the starter gear transparently after this server change.

**Tech Stack:** Node.js/Express, PostgreSQL (via `sql` tagged template), React/Vite

---

### Task 1: Modify `GET /api/gear` to serve starter gear for guests

**Files:**
- Modify: `api/server.js:996-1041` (GET /api/gear route)

- [x] **Step 1: Add guest branch before the authenticated user check**

  In `api/server.js`, after `const authedUser = authFromRequest(req);`, insert a block that handles `!authedUser`:

  ```javascript
  // Guests (no token): return the universal starter loadout read-only, no writes to hero_equipment
  if (!authedUser) {
    try {
      const rows = await sql`
        SELECT csl.character_cid, csl.slot_type,
               i.id, i.name, i.description, i.rarity,
               i.atk_bonus, i.hp_bonus, i.spd_bonus
        FROM character_starter_loadout csl
        JOIN items i ON i.id = csl.item_id
        ORDER BY csl.character_cid, csl.slot_type
      `;
      const gear = {};
      for (const r of rows) {
        if (!gear[r.character_cid]) {
          gear[r.character_cid] = { slots: {}, totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 } };
        }
        gear[r.character_cid].slots[r.slot_type] = {
          id:          r.id,
          name:        r.name,
          description: r.description,
          rarity:      r.rarity,
          slot_type:   r.slot_type,
          atk_bonus:   Number(r.atk_bonus),
          hp_bonus:    Number(r.hp_bonus),
          spd_bonus:   Number(r.spd_bonus),
        };
        gear[r.character_cid].totals.atk_bonus += Number(r.atk_bonus);
        gear[r.character_cid].totals.hp_bonus  += Number(r.hp_bonus);
        gear[r.character_cid].totals.spd_bonus += Number(r.spd_bonus);
      }
      return res.json({ ok: true, gear });
    } catch (err) {
      console.error('[GET /api/gear guest]', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
  ```

  Change the subsequent auth check from:
  ```javascript
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
  ```
  to:
  ```javascript
  if (authedUser.toLowerCase() !== player.toLowerCase()) {
  ```

- [x] **Step 2: Commit**

  ```bash
  git add api/server.js
  git commit -m "feat: guests receive starter gear from GET /api/gear without auth"
  ```

---

### Task 2: Verify equip/unequip already block guests (no code change needed)

**Files:**
- Read: `api/server.js:1086-1094` (PUT /api/gear/equip)
- Read: `api/server.js:1124-1131` (POST /api/gear/unequip)

- [x] **Step 1: Confirm existing 401 guard**

  Both endpoints start with:
  ```javascript
  const authedUser = authFromRequest(req);
  if (!authedUser || authedUser.toLowerCase() !== player.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  ```
  `!authedUser` is `true` for guests (no token) → returns 401. No change needed.

---

### Task 3: Verify BattlePage.jsx guest branch (no code change needed)

**Files:**
- Read: `client/src/pages/BattlePage.jsx:478-488`

- [x] **Step 1: Confirm guest fetch sends no Authorization header**

  ```javascript
  const gearRes = await fetch(`/api/gear?player=${encodeURIComponent(sess.username)}`).then(r => r.json())
  window.HF_gear = gearRes.ok ? gearRes.gear : {}
  ```

  No `Authorization` header → server treats as guest → returns starter gear → `window.HF_gear` is populated correctly. No change needed.

---

### Notes

- Guests cannot join PvP queue (`join_queue` handler blocks them at `socket.data.isGuest`), so `resolveBattleRound` never runs for a guest player. No change needed there.
- The starter gear returned to guests is character-based (same for all guests), not player-specific. The `player` query param is accepted but ignored for unauthenticated requests.
- No rows are written to `hero_equipment` for guests — their progress is ephemeral by design.
