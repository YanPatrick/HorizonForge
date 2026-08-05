import { useEffect, useRef, useState } from 'react'
import '../styles/idle.css'

const POLL_MS = 5000

// Dev-only reset button — visible only for this account. Not a security
// boundary (the endpoint only ever resets the caller's own progress), just
// keeps a "zero everything" button off real players' screens.
const DEV_RESET_USERS = ['vempromundo']

// Mirrors IDLE_CONFIG's drop table in api/server.js — COSMETIC ONLY. The
// client rolls its own fake drop each local "kill" purely to drive the
// floating-text animation at the right rhythm; it never touches real
// coins/xp/fragments. The server (polled every POLL_MS) is still the only
// source of truth for the actual ledger shown in the stats bar.
const COSMETIC_DROP_CHANCE_DIAMOND = 0.001
const COSMETIC_DROP_CHANCE_FRAGMENT = 0.099
const COSMETIC_DROP_CHANCE_COIN = 0.30

function rollCosmeticDrop() {
  const r = Math.random()
  if (r < COSMETIC_DROP_CHANCE_DIAMOND) return { text: '+1 💎', cls: 'diamond' }
  if (r < COSMETIC_DROP_CHANCE_DIAMOND + COSMETIC_DROP_CHANCE_FRAGMENT) return { text: '+1 🧩', cls: 'fragment' }
  if (r < COSMETIC_DROP_CHANCE_DIAMOND + COSMETIC_DROP_CHANCE_FRAGMENT + COSMETIC_DROP_CHANCE_COIN) {
    return { text: `+${1 + Math.floor(Math.random() * 3)} 🪙`, cls: 'coin' }
  }
  return null // "nothing" drops — no floating text for those
}

async function idleFetch(path, session, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (session?.token) headers.Authorization = `Bearer ${session.token}`
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  return res.json()
}

export default function IdleView({ session, formations, toast, onItemCrafted }) {
  const username = session?.username
  const isGuest = session?.mode === 'guest'
  const [state, setState] = useState(null)
  const [recipes, setRecipes] = useState({})
  const [selectedSlot, setSelectedSlot] = useState(1)
  const [enemyHpPct, setEnemyHpPct] = useState(100)
  const [enemyDead, setEnemyDead] = useState(false)
  const [floats, setFloats] = useState([])
  const pollRef = useRef(null)
  const cycleRef = useRef(null)
  const cycleStartRef = useRef(0)
  const floatIdRef = useRef(0)

  const refresh = async () => {
    if (!username) return
    const data = await idleFetch(`/api/idle/state?player=${encodeURIComponent(username)}`, session)
    if (data.ok) setState(data)
  }

  useEffect(() => {
    if (!username) return
    refresh()
    idleFetch('/api/idle/recipes', session).then(d => { if (d.ok) setRecipes(d.recipes) })
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [username])

  // Local cosmetic combat loop — purely visual, paced by the server-reported
  // kill_interval_ms. Runs independently of the real polling above.
  useEffect(() => {
    clearInterval(cycleRef.current)
    if (state?.status !== 'running' || !state.kill_interval_ms) {
      setEnemyHpPct(100)
      setEnemyDead(false)
      return
    }
    const interval = state.kill_interval_ms
    cycleStartRef.current = Date.now()
    cycleRef.current = setInterval(() => {
      const elapsed = Date.now() - cycleStartRef.current
      if (elapsed >= interval) {
        // "Kill" — brief death flash, floating loot, then respawn.
        setEnemyDead(true)
        setEnemyHpPct(0)
        const drop = rollCosmeticDrop()
        if (drop) {
          const id = ++floatIdRef.current
          setFloats(prev => [...prev, { id, ...drop }])
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1400)
        }
        setTimeout(() => {
          setEnemyDead(false)
          cycleStartRef.current = Date.now()
        }, 250)
      } else {
        setEnemyHpPct(Math.max(0, 100 - (elapsed / interval) * 100))
      }
    }, 80)
    return () => clearInterval(cycleRef.current)
  }, [state?.status, state?.kill_interval_ms])

  const handleStart = async () => {
    const data = await idleFetch('/api/idle/start', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, formation_slot: selectedSlot }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.('Idle run started')
    refresh()
  }

  const handleLeave = async () => {
    const data = await idleFetch('/api/idle/leave', session, {
      method: 'POST',
      body: JSON.stringify({ player: username }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.('Left the dungeon')
    refresh()
  }

  const handleCollect = async (mode) => {
    const data = await idleFetch('/api/idle/collect', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, mode }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.(`Collected: ${data.collected.coins} coins, ${data.collected.xp} xp`)
    refresh()
  }

  const handleBuyPotions = async (qty) => {
    const data = await idleFetch('/api/idle/buy-potions', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, qty }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.(`Bought ${data.bought} potions`)
    refresh()
  }

  const handleCraft = async (slotType) => {
    const data = await idleFetch('/api/idle/craft', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, slot_type: slotType }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.(`Crafted ${data.crafted.name}`)
    refresh()
    onItemCrafted?.()
  }

  const handleDevReset = async () => {
    const data = await idleFetch('/api/idle/dev-reset', session, {
      method: 'POST',
      body: JSON.stringify({ player: username }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.('Idle progress reset')
    refresh()
  }

  if (!username || isGuest) {
    return (
      <div className="idle-view idle-view--gate">
        <h2>Idle Dungeon</h2>
        <p>You need an account to run the Idle Dungeon — guest sessions can't save idle progress.</p>
      </div>
    )
  }

  if (!state) return <div className="idle-view idle-view--loading">Loading idle dungeon...</div>

  const hasPending = state.pending_coins > 0 || state.pending_diamonds > 0 || state.pending_xp > 0
    || Object.keys(state.pending_fragments || {}).length > 0
  const hpPct = state.max_hp > 0 ? Math.round((state.hp / state.max_hp) * 100) : 0
  const isRunning = state.status === 'running'

  return (
    <div className="idle-view">
      <h2>Idle Dungeon — Tier {state.tier}</h2>

      <div className="idle-view__arena">
        <div className="idle-view__hero-card">
          <div className="idle-view__sprite idle-view__sprite--hero">🧙</div>
          <div className="idle-view__hpbar">
            <div className="idle-view__hpbar-fill" style={{ width: `${hpPct}%` }} />
          </div>
          <span>{Math.round(state.hp)} / {Math.round(state.max_hp)} HP</span>
        </div>

        {isRunning && (
          <div className="idle-view__enemy-card">
            <div className="idle-view__loot-layer">
              {floats.map(f => (
                <span key={f.id} className={`idle-view__float idle-view__float--${f.cls}`}>{f.text}</span>
              ))}
            </div>
            <div className={`idle-view__sprite idle-view__sprite--enemy${enemyDead ? ' is-dead' : ''}`}>👹</div>
            <div className="idle-view__hpbar idle-view__hpbar--enemy">
              <div className="idle-view__hpbar-fill idle-view__hpbar-fill--enemy" style={{ width: `${enemyHpPct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="idle-view__stats">
        <span>Coins: {state.coins}</span>
        <span>Diamonds: {state.diamonds}</span>
        <span>Potions: {state.potions}</span>
        <span>Idle XP: {state.idle_xp}</span>
      </div>

      <div className="idle-view__fragments">
        {Object.entries(state.fragments || {}).map(([slot, qty]) => (
          <span key={slot} className="idle-view__fragment-pill">{slot}: {qty}</span>
        ))}
      </div>

      {hasPending && (
        <div className="idle-view__pending">
          <p>Pending: {state.pending_coins} coins, {state.pending_xp} xp, {state.pending_diamonds} diamonds</p>
          <button type="button" onClick={() => handleCollect('half')}>Collect 50% (free)</button>
          <button type="button" onClick={() => handleCollect('full')}>Collect 100% (50 diamonds)</button>
        </div>
      )}

      <div className="idle-view__controls">
        {isRunning ? (
          <button type="button" onClick={handleLeave}>Leave dungeon</button>
        ) : (
          <>
            <select value={selectedSlot} onChange={e => setSelectedSlot(Number(e.target.value))}>
              {(formations || []).map(f => (
                <option key={f.slot} value={f.slot}>{f.name || `Formation ${f.slot}`}</option>
              ))}
            </select>
            <button type="button" onClick={handleStart}>Start idle run</button>
          </>
        )}
        <button type="button" onClick={() => handleBuyPotions(1)}>Buy 1 potion (20 coins)</button>
      </div>

      <div className="idle-view__crafting">
        <h3>Blacksmith</h3>
        {Object.entries(recipes).map(([slotType, r]) => (
          <div key={slotType} className="idle-view__recipe">
            <span>{r.name} — {r.fragmentsRequired} {slotType} fragments + {r.coinCost} coins</span>
            <button type="button" onClick={() => handleCraft(slotType)}>Craft</button>
          </div>
        ))}
      </div>

      {DEV_RESET_USERS.includes(username) && (
        <button type="button" className="idle-view__dev-reset" onClick={handleDevReset}>
          🧪 Dev: Reset potions/coins/fragments
        </button>
      )}
    </div>
  )
}
