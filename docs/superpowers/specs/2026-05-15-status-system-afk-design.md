# Status System & AFK — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Overview

Expand the tavern player status system from 3 to 4 statuses, update the color palette, add automatic AFK detection after 2 minutes of inactivity, and allow the player to manually toggle between Disponível and Ausente by clicking their own badge in the tavern.

---

## 1. Status & Colors

| Status | Value | Color | Hex | When |
|--------|-------|-------|-----|------|
| Disponível | `tavern` | Green | `#22c55e` | In tavern, active |
| Buscando | `searching` | Orange | `#f97316` | In matchmaking queue |
| Em batalha | `battle` | Red | `#ef4444` | In active match |
| Ausente | `afk` | Yellow | `#eab308` | AFK (auto after 2min) or manual |

The `searching` color changes from amber to a more saturated orange to visually distinguish it from the yellow AFK badge.

---

## 2. Server (`api/server.js`)

### Changes

**Accept `afk` status** — `setTavernStatus` already works generically; no enum validation exists. The `afk` value flows through `broadcastTavern` without modification.

**New socket event `set_status`:**

```js
socket.on('set_status', ({ status }) => {
  const current = onlineUsers.get(username)?.status
  if (current === 'searching' || current === 'battle') return
  if (status !== 'tavern' && status !== 'afk') return
  setTavernStatus(username, status)
})
```

The server ignores the event if the player is in `searching` or `battle`, preventing race conditions from out-of-order events.

No other server changes required.

---

## 3. Client-Side AFK Timer (`LobbyPage.jsx`)

### State / Refs

```js
const isManualAfk = useRef(false)   // true = player set absent manually
const afkTimer = useRef(null)
const AFK_DELAY = 2 * 60 * 1000    // 120 000ms
```

### Activity listeners

Mounted only when `myStatus` is `'tavern'` or `'afk'`. Not active during `'searching'` or `'battle'`.

Events tracked: `mousemove`, `keydown`, `mousedown`, `touchstart`

### Logic

```
onActivity():
  clearTimeout(afkTimer.current)
  afkTimer.current = setTimeout(onTimerExpire, AFK_DELAY)
  if (myStatus === 'afk' && isManualAfk.current === false):
    socket.emit('set_status', { status: 'tavern' })

onTimerExpire():
  if (myStatus === 'tavern'):
    socket.emit('set_status', { status: 'afk' })
    // isManualAfk remains false — this was automatic
```

### Manual control

When player clicks **Ausente** in the mini-menu:
- `isManualAfk.current = true`
- `socket.emit('set_status', { status: 'afk' })`
- Activity does NOT revert status

When player clicks **Disponível** in the mini-menu:
- `isManualAfk.current = false`
- `socket.emit('set_status', { status: 'tavern' })`
- AFK timer restarts normally

---

## 4. UI

### CSS (`public/css/tavern.css`)

New classes following existing naming pattern:

```css
.tv-avatar-afk { background-color: #eab308; }
.tv-badge-afk  { background-color: #eab308; color: #000; }
```

Update existing:
```css
.tv-avatar-searching { background-color: #f97316; }
.tv-badge-searching  { background-color: #f97316; }
```

### TavernPanel.jsx

Add `afk` case to badge and avatar rendering. No logic changes — purely display.

### Mini-menu (LobbyPage.jsx)

A small popover rendered inline, shown only on the logged-in player's own tavern entry. Triggered by clicking the player's own status badge.

```
┌──────────────┐
│ ● Disponível │  ← green dot, checkmark if current
│ ◐ Ausente    │  ← yellow dot, checkmark if current
└──────────────┘
```

- Closes on click outside (mousedown listener)
- `TavernPanel` receives an optional `onStatusClick` prop; only passed for the logged-in player's entry
- Mini-menu state lives in `LobbyPage.jsx` to keep socket logic co-located

---

## Files to Change

| File | Change |
|------|--------|
| `api/server.js` | Add `set_status` socket event handler |
| `client/src/pages/LobbyPage.jsx` | AFK timer logic, `isManualAfk` ref, mini-menu, `onStatusClick` prop |
| `client/src/pages/TavernPanel.jsx` | Add `afk` badge/avatar rendering, accept `onStatusClick` prop |
| `public/css/tavern.css` | Add `.tv-avatar-afk`, `.tv-badge-afk`; update searching colors |

---

## Out of Scope

- AFK during `searching` or `battle` — no change to those flows
- Server-side AFK enforcement — client-driven only
- Push notifications or warnings before AFK kicks in
