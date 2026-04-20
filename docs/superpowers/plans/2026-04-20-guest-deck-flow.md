# Guest Deck Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow guests to build and use a deck within their session, persisted in `sessionStorage`, without any server API calls.

**Architecture:** Three targeted edits inside `public/lobby.html` — guest load on `openFormation`, guest save on `saveDeck`, and slot visibility in `_renderDeckCards`. No new files. No changes to the Hive user path.

**Tech Stack:** Vanilla JS, sessionStorage, single-file frontend (`public/lobby.html`)

---

### Task 1: Hide deck slots 1 and 2 for guests in `_renderDeckCards`

**Files:**
- Modify: `public/lobby.html` — function `_renderDeckCards` (~line 5384)

- [ ] **Step 1: Add guest slot visibility at the top of the forEach loop**

Find this block inside `_renderDeckCards`:

```js
function _renderDeckCards() {
  [0, 1, 2].forEach((i) => {
    const tab = document.getElementById(`form-tab-${i}`);
    const starEl = document.getElementById(`form-tab-star-${i}`);
    const nameEl = document.getElementById(`form-tab-name-${i}`);
    const countEl = document.getElementById(`form-tab-count-${i}`);
    const iconsEl = document.getElementById(`form-tab-icons-${i}`);
    if (!tab) return;
    tab.classList.toggle(
      "fdc-active",
      _editingOpen && i === _activeFormSlot,
    );
```

Replace with:

```js
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
```

- [ ] **Step 2: Verify visually**

Open the lobby as guest. Navigate to Formation. Confirm only one deck card is visible.

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(guest): hide deck slots 1 and 2 for guest users"
```

---

### Task 2: Load guest deck from sessionStorage in `openFormation`

**Files:**
- Modify: `public/lobby.html` — function `openFormation` (~line 5304)

- [ ] **Step 1: Add guest load block after the existing formations load condition**

Find this exact block in `openFormation`:

```js
if (!_formationsLoaded && session.mode !== "guest") {
  await _loadFormations();
}
```

Replace with:

```js
if (!_formationsLoaded && session.mode !== "guest") {
  await _loadFormations();
} else if (session.mode === "guest" && !_formationsLoaded) {
  const raw = sessionStorage.getItem("hf_guest_formation");
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      _formations[0].hero_ids = saved.hero_ids || [];
    } catch { /* silent */ }
  }
  _formationsLoaded = true;
}
```

- [ ] **Step 2: Verify visually**

1. Open lobby as guest, go to Formation, add 8 heroes, click DONE (will fail until Task 3 — that's expected).
2. After Task 3 is done, F5 the page and re-open Formation: the deck should still have the 8 heroes.

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(guest): load deck from sessionStorage on openFormation"
```

---

### Task 3: Save guest deck to sessionStorage in `saveDeck`

**Files:**
- Modify: `public/lobby.html` — function `saveDeck` (~line 5678)

- [ ] **Step 1: Replace the guest early-return block**

Find this exact block at the top of `saveDeck`:

```js
window.saveDeck = async function () {
  if (session.mode === "guest") {
    toast("Formations require a Hive account. 🏆");
    return;
  }
```

Replace with:

```js
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
    toast("Deck pronto! (sessão apenas — crie uma conta para salvar 🏆)");
    closeDeckSlot();
    return;
  }
```

- [ ] **Step 2: Verify the full guest flow end-to-end**

1. Open lobby as guest.
2. Go to Formation — only slot 1 visible.
3. Click the deck card to open the slide panel.
4. Add exactly 8 heroes.
5. Click DONE → toast "Deck pronto! (sessão apenas — crie uma conta para salvar 🏆)" appears and panel closes.
6. Press F5 → go back to Formation → deck still has the 8 heroes.
7. Go to Duel tab → click Play vs Bot → match should start (no "nenhum deck" warning).

- [ ] **Step 3: Commit**

```bash
git add public/lobby.html
git commit -m "feat(guest): save deck to sessionStorage, allow bot match without Hive account"
```
