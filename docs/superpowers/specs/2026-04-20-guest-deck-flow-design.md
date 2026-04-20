# Guest Deck Flow — Design Spec
**Date:** 2026-04-20  
**Status:** Approved

## Problem

Guests (`session.mode === "guest"`) cannot configure a deck because `saveDeck` blocks them with a toast and returns early. Without a saved deck, `_ensureActiveDeck()` returns `null` and the guest cannot start any match, even against the bot.

## Goal

Allow a guest to build and use a deck within their session, with no server persistence. The deck survives page refresh (via `sessionStorage`) but disappears when the tab or browser is closed.

## Scope

- Guests configure **one deck only** (slot 0). Slots 1 and 2 are hidden.
- No API calls for guests at any point in the formation flow.
- No changes to the Hive user flow.

---

## Design

### 1. Storage

- **Key:** `hf_guest_formation` (no username suffix — guest is anonymous)
- **Value:** `{ hero_ids: string[] }` — a single flat object, no slot array
- **Scope:** `sessionStorage` — survives F5, disappears on tab/browser close

### 2. Saving (`saveDeck`)

Replace the current guest early-return block:

```js
// BEFORE
if (session.mode === "guest") {
  toast("Formations require a Hive account. 🏆");
  return;
}
```

With:

```js
// AFTER
if (session.mode === "guest") {
  const f = _formations[0];
  if (f.hero_ids.length !== 8) {
    toast(`⚠️ Select exactly 8 heroes (${f.hero_ids.length}/8).`);
    return;
  }
  sessionStorage.setItem("hf_guest_formation", JSON.stringify({ hero_ids: f.hero_ids }));
  toast("Deck pronto! (sessão apenas — crie uma conta para salvar 🏆)");
  closeDeckSlot();
  return;
}
```

### 3. Loading (`openFormation`)

After the existing `if (!_formationsLoaded && session.mode !== "guest")` block, add:

```js
if (session.mode === "guest" && !_formationsLoaded) {
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

`_formationsLoaded` acts as a "loaded once" flag — same pattern already used for Hive users.

### 4. Default slot

`_defaultFormSlot` is always `0` for guests. No localStorage write needed. `_ensureActiveDeck()` already reads `_formations[_defaultFormSlot]`, so it works without modification.

### 5. Visual — hide slots 1 and 2 for guests

In `_renderDeckCards()`, when rendering each deck card tab (indices 0–2), hide tabs 1 and 2 for guests:

```js
// Inside the [0,1,2].forEach loop in _renderDeckCards():
if (session.mode === "guest" && i !== 0) {
  tab.style.display = "none";
  return;
} else {
  tab.style.display = "";
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `public/lobby.html` | `saveDeck` guest block, `openFormation` guest load, `_renderDeckCards` slot visibility |

## Out of Scope

- Guest deck sharing or export
- Migrating guest deck to a Hive account after login
- Slots 2 and 3 for guests (intentionally excluded for simplicity)
