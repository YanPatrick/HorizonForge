// Shared session helper.
//
// `getSession()` returns the active session blob from sessionStorage, or null
// if there isn't one OR the Hive token has expired. Previously each page
// component had its own copy that only checked truthiness, which meant a
// stale token blob would let a user past the auth gate — they'd land in the
// lobby, every API call would 401, and they'd be stuck on a broken page
// instead of being bounced to the login screen.
//
// Token format (from api/server.js#makeToken): `username:expires_ms:hmac`.
// We only need to read the expiry — the server still re-verifies the HMAC
// on every authenticated API call, so this client check is a UX optimization,
// not a security boundary.

export function getSession() {
  try {
    // Hive sessions live in sessionStorage (intentional — token must not survive tab close).
    // Guest sessions live in localStorage so progress persists across browser restarts.
    let raw = sessionStorage.getItem('hf_session');
    if (!raw) {
      raw = localStorage.getItem('hf_session');
      // Restore to sessionStorage so legacy battle.js (which reads only sessionStorage) finds it.
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s?.mode === 'guest') sessionStorage.setItem('hf_session', raw);
        } catch { /* ok */ }
      }
    }
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s) return null;
    // Guest sessions have no token and don't expire client-side.
    if (s.mode === 'guest') return s;
    // Hive sessions: parse the expiry out of the token without verifying it.
    const parts = (s.token || '').split(':');
    if (parts.length !== 3) return null;
    const expires = parseInt(parts[1], 10);
    if (!Number.isFinite(expires) || Date.now() >= expires) {
      // Stale — drop it so the user gets a clean login flow next time.
      sessionStorage.removeItem('hf_session');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}
