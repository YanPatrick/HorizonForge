import { useEffect, useRef, useState } from 'react'
import '../styles/idle.css'

const POLL_MS = 2000

// Dev-only reset button — visible only for this account. Not a security
// boundary (the endpoint only ever resets the caller's own progress), just
// keeps a "zero everything" button off real players' screens.
const DEV_RESET_USERS = ['vempromundo']

// Mirrors IDLE_MONSTERS in api/server.js — used only to size each enemy
// card's HP bar against its max HP; the real numbers always come from the
// server.
const MONSTER_INFO = {
  guerreiro: { icon: '🗡️', maxHp: 20 },
  arqueiro: { icon: '🏹', maxHp: 10 },
}

const AUTO_POTION_OPTIONS = [90, 75, 50]
const SLOT_ICONS = { weapon: '⚔️', helm: '⛑️', legs: '🥾', boots: '👢', gloves: '🧤', ring1: '💍' }

async function idleFetch(path, session, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (session?.token) headers.Authorization = `Bearer ${session.token}`
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  return res.json()
}

export default function IdleView({ session, toast, onItemCrafted }) {
  const username = session?.username
  const isGuest = session?.mode === 'guest'
  const [state, setState] = useState(null)
  const [recipes, setRecipes] = useState({})
  const [inventory, setInventory] = useState([])
  const [floats, setFloats] = useState([])
  const pollRef = useRef(null)
  const prevRef = useRef(null)
  const floatIdRef = useRef(0)

  const pushFloat = (text, cls) => {
    const id = ++floatIdRef.current
    setFloats(prev => [...prev, { id, text, cls }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1400)
  }

  const refresh = async () => {
    if (!username) return
    const data = await idleFetch(`/api/idle/state?player=${encodeURIComponent(username)}`, session)
    if (!data.ok) return
    const prev = prevRef.current
    if (prev) {
      const coinDelta = (data.coins ?? 0) - (prev.coins ?? 0)
      if (coinDelta > 0) pushFloat(`+${coinDelta} 🪙`, 'coin')
      const diamondDelta = (data.diamonds ?? 0) - (prev.diamonds ?? 0)
      if (diamondDelta > 0) pushFloat(`+${diamondDelta} 💎`, 'diamond')
      const prevFrag = prev.fragments || {}
      for (const [slot, qty] of Object.entries(data.fragments || {})) {
        const delta = qty - (prevFrag[slot] ?? 0)
        if (delta > 0) pushFloat(`+${delta} 🧩`, 'fragment')
      }
      if ((data.hero_level ?? 1) > (prev.hero_level ?? 1)) {
        pushFloat(`Level ${data.hero_level}!`, 'levelup')
      }
    }
    prevRef.current = data
    setState(data)
  }

  const refreshItems = async () => {
    if (!username) return
    const data = await idleFetch(`/api/idle/items?player=${encodeURIComponent(username)}`, session)
    if (data.ok) setInventory(data.inventory)
  }

  useEffect(() => {
    if (!username) return
    refresh()
    refreshItems()
    idleFetch('/api/idle/recipes', session).then(d => { if (d.ok) setRecipes(d.recipes) })
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [username])

  const handleStart = async () => {
    const data = await idleFetch('/api/idle/start', session, {
      method: 'POST',
      body: JSON.stringify({ player: username }),
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
    refreshItems()
    onItemCrafted?.()
  }

  const handleMerge = async (slotType, plusLevel) => {
    const data = await idleFetch('/api/idle/merge', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, slot_type: slotType, plus_level: plusLevel }),
    })
    if (!data.ok) return toast?.(data.error)
    toast?.(`Merged into ${slotType} +${data.merged.new_plus_level}`)
    refreshItems()
  }

  const handleEquip = async (slotType, plusLevel) => {
    const data = await idleFetch('/api/idle/equip', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, slot_type: slotType, plus_level: plusLevel }),
    })
    if (!data.ok) return toast?.(data.error)
    refresh()
    refreshItems()
  }

  const handleUnequip = async (slotType) => {
    const data = await idleFetch('/api/idle/equip', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, slot_type: slotType, plus_level: null }),
    })
    if (!data.ok) return toast?.(data.error)
    refresh()
    refreshItems()
  }

  const handleSetAutoPotion = async (pct) => {
    const data = await idleFetch('/api/idle/set-auto-potion', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, pct }),
    })
    if (!data.ok) return toast?.(data.error)
    refresh()
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
  const xpPct = state.xp_to_next_level > 0 ? Math.round((state.hero_xp / state.xp_to_next_level) * 100) : 0
  const isRunning = state.status === 'running'
  const enemies = state.enemies || []

  return (
    <div className="idle-view">
      <h2>Idle Dungeon — Hero Level {state.hero_level}</h2>

      <div className="idle-view__loot-layer">
        {floats.map(f => (
          <span key={f.id} className={`idle-view__float idle-view__float--${f.cls}`}>{f.text}</span>
        ))}
      </div>

      <div className="idle-view__arena">
        <div className="idle-view__hero-card">
          <div className="idle-view__sprite idle-view__sprite--hero">🧙</div>
          <div className="idle-view__hpbar">
            <div className="idle-view__hpbar-fill" style={{ width: `${hpPct}%` }} />
          </div>
          <span>{Math.round(state.hp)} / {Math.round(state.max_hp)} HP</span>
          <div className="idle-view__xpbar">
            <div className="idle-view__xpbar-fill" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="idle-view__xp-label">{state.hero_xp} / {state.xp_to_next_level} XP</span>
        </div>

        <div className="idle-view__enemies">
          {enemies.length === 0
            ? <div className="idle-view__enemies-empty">{isRunning ? 'Waiting for enemies...' : 'Not in a run'}</div>
            : enemies.map(e => {
              const info = MONSTER_INFO[e.kind] || { icon: '👹', maxHp: e.hp }
              const ePct = info.maxHp > 0 ? Math.round((e.hp / info.maxHp) * 100) : 0
              return (
                <div key={e.id} className="idle-view__enemy-card">
                  <div className="idle-view__sprite idle-view__sprite--enemy">{info.icon}</div>
                  <div className="idle-view__hpbar idle-view__hpbar--enemy">
                    <div className="idle-view__hpbar-fill idle-view__hpbar-fill--enemy" style={{ width: `${ePct}%` }} />
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      <div className="idle-view__stats">
        <span>Coins: {state.coins}</span>
        <span>Diamonds: {state.diamonds}</span>
        <span>Potions: {state.potions}</span>
      </div>

      <div className="idle-view__fragments">
        {Object.entries(state.fragments || {}).map(([slot, qty]) => (
          <span key={slot} className="idle-view__fragment-pill">{slot}: {qty}</span>
        ))}
      </div>

      <div className="idle-view__auto-potion">
        <span>Auto-potion below:</span>
        {AUTO_POTION_OPTIONS.map(pct => (
          <button
            key={pct}
            type="button"
            className={state.auto_potion_pct === pct ? 'is-active' : ''}
            onClick={() => handleSetAutoPotion(pct)}
          >
            {pct}%
          </button>
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
          <button type="button" onClick={handleStart}>Start idle run</button>
        )}
        <button type="button" onClick={() => handleBuyPotions(1)}>Buy 1 potion (10 coins)</button>
      </div>

      <div className="idle-view__equipment">
        <h3>Equipment</h3>
        {Object.keys(SLOT_ICONS).map(slotType => {
          const equippedPlus = state.equipment?.[slotType]
          return (
            <div key={slotType} className="idle-view__equip-row">
              <span>{SLOT_ICONS[slotType]} {slotType}</span>
              <span>{equippedPlus != null ? `+${equippedPlus}` : 'empty'}</span>
              {equippedPlus != null && (
                <button type="button" onClick={() => handleUnequip(slotType)}>Unequip</button>
              )}
            </div>
          )
        })}
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

      <div className="idle-view__inventory">
        <h3>Inventory</h3>
        {inventory.length === 0
          ? <p className="idle-view__inventory-empty">No crafted items yet.</p>
          : inventory.map(entry => (
            <div key={`${entry.slot_type}:${entry.plus_level}`} className="idle-view__inventory-row">
              <span>{SLOT_ICONS[entry.slot_type] ?? '📦'} {entry.slot_type} +{entry.plus_level} x{entry.qty}</span>
              <button type="button" onClick={() => handleEquip(entry.slot_type, entry.plus_level)}>Equip</button>
              {entry.qty >= 2 && entry.plus_level < 10 && (
                <button type="button" onClick={() => handleMerge(entry.slot_type, entry.plus_level)}>
                  Merge → +{entry.plus_level + 1}
                </button>
              )}
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
