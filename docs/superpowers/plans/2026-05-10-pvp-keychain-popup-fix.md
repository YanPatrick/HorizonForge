# PvP Keychain Popup Race Condition Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the race condition where the Hive Keychain popup appears 600ms after match found and is accidentally dismissed by a mid-click. The process remains fully automatic — user only needs to confirm in Keychain. The fix increases the delay, adds a visible countdown warning, and calls `window.focus()` before the popup opens.

**Architecture:** The auto-trigger (`setTimeout(sendKeychainTransfer, 600)`) is kept but its delay is increased to 2500ms. A "Keychain opening in Xs..." countdown replaces the generic payCountdown text during that window, warning the user not to click or switch tabs. `window.focus()` is called inside `sendKeychainTransfer()` to bring the tab to front just before the popup appears. The manual "Send Wager" button stays as a retry mechanism. The server payment window expands from 30s to 60s to give more buffer for the now-longer pre-popup delay.

**Tech Stack:** React (JSX), Socket.IO client, Hive Keychain browser extension, Node.js/Express backend.

---

## Root Cause

```
match found
  └─> setTimeout(sendKeychainTransfer, 600ms)   ← too fast
        └─> window.hive_keychain.requestTransfer(...)
              └─> Keychain popup appears
                    └─> user was mid-click → accidental dismiss
```

The 600ms delay gives no time for the user to read the screen or stop what they are doing. The fix: extend to 2500ms and show a visible countdown so the user knows the popup is imminent.

---

## Files

| File | Change |
|---|---|
| `client/src/pages/LobbyPage.jsx` | Increase delay 600ms→2500ms; add pre-popup countdown; add `window.focus()`; update status text |
| `api/server.js` | Extend payment timeout `30_000`→`60_000`; emit `timeLimitMs: 60_000` |

---

## Task 1: Extend the server payment window to 60 seconds

**Files:**
- Modify: `api/server.js` around line 1230 (`timeLimitMs` broadcast)
- Modify: `api/server.js` around line 1319 (`setTimeout` value)

- [ ] **Step 1: Update `timeLimitMs` broadcast**

Find (around line 1230):
```js
timeLimitMs: needsPayment ? 30_000 : 3 * 60 * 1000,
```

Change to:
```js
timeLimitMs: needsPayment ? 60_000 : 3 * 60 * 1000,
```

- [ ] **Step 2: Update the server setTimeout**

Find the closing `}, 30_000);` of `matchData.paymentTimer = setTimeout(async () => {` (around line 1319):
```js
    }, 30_000);
```

Change to:
```js
    }, 60_000);
```

- [ ] **Step 3: Verify no other hardcoded 30s payment references**

Run:
```
grep -n "30_000\|30000" api/server.js
```

Expected: no remaining occurrences related to the payment window (other non-payment uses of these numbers are fine).

- [ ] **Step 4: Commit**

```bash
git add api/server.js
git commit -m "fix: extend PvP payment window from 30s to 60s"
```

---

## Task 2: Increase the auto-trigger delay and show a pre-popup countdown

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx` — `handleMatchFound` function (around line 781)

The goal: replace the 600ms silent trigger with a 2500ms delay that shows a visible "Keychain opening in 3... 2... 1..." countdown so the user knows the popup is coming and can stop clicking.

- [ ] **Step 1: Rewrite the `needsPayment` branch in `handleMatchFound`**

Find the current `if (data.needsPayment)` block (around line 792–809):

```js
  if (data.needsPayment) {
    let remaining = 30
    setSearch(s => ({
      ...s, found: false, paying: true,
      title: '<span class="search-found-title">OPPONENT FOUND!</span>',
      sub: `vs. ${opponent} — send your wager to enter`,
      payStatus: `Wager: ${matchDataRef.current.wager} HIVE`,
      payCountdown: { text: `⏳ Confirm in Keychain — ${remaining}s remaining`, urgent: false },
      showSendWager: true,
      paySteps: {},
    }))
    clearInterval(payCountdownRef.current)
    payCountdownRef.current = setInterval(() => {
      remaining--
      setSearch(s => ({ ...s, payCountdown: { text: `⏳ Confirm in Keychain — ${remaining}s remaining`, urgent: remaining <= 10 } }))
      if (remaining <= 0) clearInterval(payCountdownRef.current)
    }, 1000)
    setTimeout(sendKeychainTransfer, 600)
  } else {
```

Replace with:

```js
  if (data.needsPayment) {
    let remaining = Math.round((data.timeLimitMs ?? 60_000) / 1000)

    // Pre-popup countdown: warn user for 2.5s before Keychain opens automatically.
    // Without this warning, the 600ms auto-trigger fired while users were mid-click
    // (e.g. switching tabs), accidentally dismissing the popup.
    let prePopup = 3
    setSearch(s => ({
      ...s, found: false, paying: true,
      title: '<span class="search-found-title">OPPONENT FOUND!</span>',
      sub: `vs. ${opponent} — sending wager automatically`,
      payStatus: `Wager: ${matchDataRef.current.wager} HIVE — stay on this tab!`,
      payCountdown: { text: `⚡ Keychain opening in ${prePopup}s — don't click away!`, urgent: false },
      showSendWager: false,
      paySteps: {},
    }))

    // Count down 3→2→1 before the popup fires, then switch to the payment window countdown.
    const preTimer = setInterval(() => {
      prePopup--
      if (prePopup > 0) {
        setSearch(s => ({ ...s, payCountdown: { text: `⚡ Keychain opening in ${prePopup}s — don't click away!`, urgent: false } }))
      } else {
        clearInterval(preTimer)
      }
    }, 800)

    clearInterval(payCountdownRef.current)
    setTimeout(() => {
      sendKeychainTransfer()
      // After popup fires, switch to payment-window countdown.
      payCountdownRef.current = setInterval(() => {
        remaining--
        setSearch(s => ({ ...s, payCountdown: { text: `⏳ Confirm in Keychain — ${remaining}s remaining`, urgent: remaining <= 10 } }))
        if (remaining <= 0) clearInterval(payCountdownRef.current)
      }, 1000)
    }, 2500)
  } else {
```

- [ ] **Step 2: Verify the diff**

```
git diff client/src/pages/LobbyPage.jsx
```

Confirm:
- `setTimeout(sendKeychainTransfer, 600)` is gone.
- A new `preTimer` counts 3→2→1 at 800ms intervals.
- The main `setTimeout` fires at 2500ms and then starts the `payCountdownRef` interval.
- Initial `showSendWager` is `false` (button hidden until Keychain fires; appears as retry on error).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "fix: delay Keychain auto-trigger to 2.5s with pre-popup countdown warning"
```

---

## Task 3: Add `window.focus()` and update status text in `sendKeychainTransfer`

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx` — `sendKeychainTransfer` function (around line 834)

- [ ] **Step 1: Add `window.focus()` and update opening status text**

Find inside `sendKeychainTransfer`:
```js
setSearch(s => ({ ...s, payStatus: 'Opening Keychain...', showSendWager: false, paySteps: { ...s.paySteps, 'pay-step-send': 'active' } }))
window.hive_keychain.requestTransfer(username, md.gameAccount, md.wager.toFixed(3), memo, 'HIVE', (response) => {
```

Replace with:
```js
window.focus()
setSearch(s => ({ ...s, payStatus: 'Keychain open — confirm the transfer!', showSendWager: false, paySteps: { ...s.paySteps, 'pay-step-send': 'active' } }))
window.hive_keychain.requestTransfer(username, md.gameAccount, md.wager.toFixed(3), memo, 'HIVE', (response) => {
```

- [ ] **Step 2: Verify the diff**

```
git diff client/src/pages/LobbyPage.jsx
```

Confirm: `window.focus()` appears on the line immediately before `setSearch`, and status text is updated.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "fix: call window.focus() before Keychain popup opens in PvP wager flow"
```

---

## Task 4: Make the "Send Wager" button a clear retry (shown only on error)

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx` — `handleRetryWager` function (around line 857)

Currently, `handleRetryWager` resets state and shows `showSendWager: true`, which is correct behavior — but in Task 2 we now start with `showSendWager: false`. We need to confirm the retry path still works: on Keychain cancellation, the error handler sets `showRetry: true` and the retry button appears, and clicking it should show the wager button so the user can manually re-trigger.

- [ ] **Step 1: Verify the error branch in `sendKeychainTransfer`**

Find (around line 851–853):
```js
      } else {
        const reason = response.message || response.error || 'Keychain request cancelled'
        setSearch(s => ({ ...s, paySteps: { ...s.paySteps, 'pay-step-send': 'error' }, payError: reason, showRetry: true }))
      }
```

This is correct as-is — `showRetry: true` triggers the Retry button in `SearchOverlay`. No change needed.

- [ ] **Step 2: Verify `handleRetryWager` shows the wager button**

Find (around line 857–858):
```js
  function handleRetryWager() {
    setSearch(s => ({ ...s, paySteps: {}, payError: null, showRetry: false, payStatus: `Wager: ${matchDataRef.current?.wager} HIVE`, showSendWager: true }))
  }
```

This is correct — it sets `showSendWager: true` so the user gets the "Send Wager via Keychain" button to manually re-trigger. No change needed.

- [ ] **Step 3: Update the retry button label in `SearchOverlay` for clarity**

Find in `SearchOverlay` (around line 518):
```jsx
{showRetry && <button id="btn-retry-pay" onClick={onRetry}>Retry</button>}
```

Change to:
```jsx
{showRetry && <button id="btn-retry-pay" onClick={onRetry}>↩ Retry Keychain</button>}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "fix: improve retry button label for Keychain cancellation in PvP wager flow"
```

---

## Task 5: Build and test

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: exits 0 with no errors.

- [ ] **Step 2: Start prod server**

```bash
npm start
```

- [ ] **Step 3: Test golden path — wager PvP match**

Open two browser windows. Queue for a wager PvP match. When match is found:

1. Confirm the screen shows "Keychain opening in 3s — don't click away!" countdown.
2. Confirm the countdown ticks 3→2→1 over ~2.5 seconds.
3. Confirm after 2.5s the Keychain popup appears automatically (no button click needed).
4. Confirm in Keychain → confirm match proceeds to battle as before.
5. Confirm the payment countdown then shows "Confirm in Keychain — 57s remaining" (approximately, since 3s elapsed before the popup).

- [ ] **Step 4: Test retry path — accidentally dismiss Keychain**

Repeat the match and dismiss the Keychain popup when it appears:

1. Confirm an error message appears with "↩ Retry Keychain" button.
2. Click "↩ Retry Keychain" → confirm the "Send Wager via Keychain" button appears.
3. Click the button → Keychain popup opens manually → confirm in Keychain → match proceeds.

- [ ] **Step 5: Commit the built dist**

```bash
git add public/dist
git commit -m "build: rebuild dist after PvP Keychain popup fix"
```

---

## Self-Review

**Spec coverage:**
- ✅ Process remains fully automatic — user only confirms in Keychain (Task 2)
- ✅ Popup is now delayed 2.5s with a visible "don't click away" warning (Task 2)
- ✅ `window.focus()` brings tab to front just before popup appears (Task 3)
- ✅ Countdown driven from server `timeLimitMs` instead of hardcoded 30 (Task 2)
- ✅ Server timeout extended to 60s (Task 1)
- ✅ Retry path still works when popup is accidentally dismissed (Task 4)
- ✅ PvP parity unaffected — only the payment phase UX changed

**No placeholders:** All steps contain complete code or exact commands.

**Type consistency:** No new types introduced. `sendKeychainTransfer` signature unchanged.
