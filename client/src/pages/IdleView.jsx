import { useEffect, useRef, useState } from 'react'
import '../styles/idle.css'

const POLL_MS = 15000

async function idleFetch(path, session, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (session?.token) headers.Authorization = `Bearer ${session.token}`
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  return res.json()
}

export default function IdleView({ session, formations, toast }) {
  const username = session?.username
  const isGuest = session?.mode === 'guest'
  const [state, setState] = useState(null)
  const [recipes, setRecipes] = useState({})
  const [selectedSlot, setSelectedSlot] = useState(1)
  const pollRef = useRef(null)

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

  return (
    <div className="idle-view">
      <h2>Idle Dungeon — Tier {state.tier}</h2>

      <div className="idle-view__hero-card">
        <div className="idle-view__sprite idle-view__sprite--hero">🧙</div>
        <div className="idle-view__hpbar">
          <div className="idle-view__hpbar-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span>{Math.round(state.hp)} / {Math.round(state.max_hp)} HP</span>
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
        {state.status === 'running' ? (
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
    </div>
  )
}
