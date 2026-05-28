import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '../lib/session'
import GuestConversionModal from '../components/GuestConversionModal'

export default function BattlePage() {
  const navigate = useNavigate()
  const initialized = useRef(false)
  const [cssReady, setCssReady] = useState(false)
  // Tracks whether the imperative scripts (battle.js + bot-ai.js + simulate.js
  // + socket.io + mobile.js) have all loaded. Buttons in this page dispatch
  // through globals those scripts register (window.startBattle, openQuitModal,
  // toggleBattleSpeed, etc.) — clicking before they're loaded silently does
  // nothing. Hiding the page until both CSS and scripts are ready avoids that.
  const [scriptsReady, setScriptsReady] = useState(false)

  // ── Modal visibility (was: classList toggling driven by globals in battle.js)
  // Phase 1 of #16 — UI chrome is React-driven; battle.js still calls
  // window.openQuitModal etc. via the registered shims below.
  const [quitOpen, setQuitOpen] = useState(false)
  const [howToOpen, setHowToOpen] = useState(false)

  // ── Round/phase timer (Phase 2 of #16, first slice)
  // Was: battle.js mutated #phase-timer.textContent and toggled .timer-urgent
  // every second from inside startPhaseTimer / startRoundTimer. Now battle.js
  // dispatches via window.setRoundTimer / window.hideRoundTimer, registered
  // below. Same pattern as the modal shims — proves out the imperative→React
  // direction before we extend it to score, banner, opponent name, etc.
  const [timerText, setTimerText] = useState('')
  const [timerUrgent, setTimerUrgent] = useState(false)

  // ── Header / HUD reactive state (Phase 2 of #16, finishes the Header)
  // All of these were imperative DOM mutations in battle.js (renderDuelBar,
  // setBanner, applyBattleSpeed, updateFieldLabels, etc.). Each one is now a
  // pure React state slice; battle.js dispatches via the window shims
  // registered below. Once the Barracks/Shop/Field migration lands in
  // Phase 3, the entire #hdr block will be read-from-state.
  const sessionForBadge = getSession()
  const [userBadge] = useState(
    sessionForBadge?.username ? `@${sessionForBadge.username}` : '@you'
  )
  const [convModal, setConvModal] = useState(false)
  const [formatLabel, setFormatLabel] = useState('BO3')
  const [bannerText, setBannerText] = useState(
    '🛍️ Analyze the enemy, buy cards and build your army!'
  )
  const [bannerClass, setBannerClass] = useState('bshop')
  const [oppName, setOppName] = useState('Enemy')
  const [armyCount, setArmyCount] = useState('')
  // Score dots: arrays of 'w' (won), 'l' (lost), 'e' (empty/pending). Length
  // matches G.format. battle.js's renderDuelBar() now computes these arrays
  // and dispatches them in one shot.
  const [scoreDots, setScoreDots] = useState({ p: [], e: [] })
  // Speed toggle: read the stored preference once on mount so the initial
  // render matches what battle.js's initBattleSpeed IIFE would have written.
  const [speed, setSpeed] = useState(() => {
    try {
      const n = Number(localStorage.getItem('hf_battle_speed'))
      const fast = !(n === 1)
      return { label: fast ? '2x' : '1x', fast }
    } catch { return { label: '2x', fast: true } }
  })

  // ── Barracks (bench) — Phase 3 of #16, first slice
  // battle.js's renderBench() previously cleared #benchrow.innerHTML and
  // rebuilt every card by hand on every state change. Now it computes a
  // pure render shape and dispatches via window.setBenchState; React owns
  // the DOM. Click/drag/hover events on the cards delegate back to battle.js
  // through the window.benchCard* shims so existing G mutations / merge
  // animations / drag-drop interactions keep working unchanged.
  const [bench, setBench] = useState({
    active: false,
    count: 0,
    max: 5,
    emptyMessage: null,
    cards: [],
  })

  // ── Recruitment (shop) — Phase 3 of #16, second slice
  // Same pattern as bench: battle.js's renderShop computes a render shape
  // (each card's targetLeft, price/count labels, classes) and dispatches via
  // window.setShopState. Click/hover events delegate to window.shopCardClick
  // and window.shopInfo*. Combo-hover lift is React-managed via hoveredCombo.
  const [shop, setShop] = useState({
    active: false,
    gold: 0,
    rerollDisabled: true,
    cards: [],
  })
  const [hoveredCombo, setHoveredCombo] = useState(null)

  // ── Field (pfield + efield) — Phase 3 of #16, third slice (final panel)
  // Both fields render from a single state object. battle.js's renderField
  // builds a render shape per side; click/drag/drop/hover events delegate
  // back via window.fieldCell* callbacks. Transient visual feedback
  // (target-preview highlights on hover, dnd-over on drag, attack arrow
  // overlays) stays imperative — battle.js querySelector-toggles classes
  // on the React-rendered cells using their stable data-i/data-side attrs.
  const [field, setField] = useState({
    p: Array(9).fill(null),
    e: Array(9).fill(null),
    interactive: false,    // true if shop phase (player field accepts input)
    fieldSel: null,        // selected pfield slot index
    dropMode: false,       // any selection active → highlight empty cells with .dr
  })

  // ── Mobile orchestration — Phase 4 of #16
  // Single mutually-exclusive state for the mobile panel layer. Only one
  // can be visible at a time: a gameplay panel ('recruit'/'barracks'),
  // the log overlay ('log'), the menu ('menu'), or none (null).
  // battle.js's setMobileStep / togglePanel / toggleMobileMenu wrappers
  // dispatch via window.setMobileView; React drives every visibility
  // class. Replaces a tangle of classList toggles across 5 elements.
  const [mobileView, setMobileView] = useState(null)
  const [fsBtnText, setFsBtnText] = useState('Enter Fullscreen')

  // Fullscreen banner state — shown once on first visit to touch devices
  // with Fullscreen API support; user accepts (auto-enter on next touch)
  // or declines (never show again). localStorage pref persists the choice.
  const [fsBannerOpen, setFsBannerOpen] = useState(false)

  // Duel-result overlay (Phase 4 of #16). battle.js's showDuelResult()
  // builds the full render shape and dispatches via window.showDuelResult.
  // Kept as one composite state because the overlay's contents only
  // change when the duel ends — no partial updates needed except for
  // toggling open/closed and the PvP "submitting..." 3s lifecycle.
  const [duelResult, setDuelResult] = useState({
    open: false,
    pw: false,
    scoreP: 0, scoreE: 0,
    battles: [],
    dmgP: 0, dmgE: 0,
    killsP: 0, killsE: 0,
    mergesP: 0, mergesE: '—',
    teamP: [],
    teamE: [],
    isPvP: false,
    wager: 0,
    nextLabel: '🌟 Next Duel',
    submitting: null, // null | { state: 'pending' | 'done', text, sub }
  })

  const closeQuit = useCallback(() => setQuitOpen(false), [])
  const confirmQuit = useCallback(() => {
    setQuitOpen(false)
    // Emit 'concede' before disconnecting so the server ends the series
    // immediately instead of waiting 45s grace — this prevents the player
    // from being reconnected to the same match when they search a new one.
    if (window._PVP?.socket) {
      window._PVP.socket.emit('concede')
      window._PVP.socket.disconnect()
    }
    window.location.href = '/lobby'
  }, [])

  useEffect(() => {
    // Register the globals battle.js dispatches through. Removing the legacy
    // function definitions in battle.js (openQuitModal, closeQuitModal,
    // confirmQuit, openHowTo, closeHowTo) means these shims are now the
    // single source of truth for modal state.
    window.openQuitModal = () => setQuitOpen(true)
    window.closeQuitModal = closeQuit
    window.confirmQuit = confirmQuit
    window.openHowTo = () => setHowToOpen(true)
    window.closeHowTo = () => setHowToOpen(false)
    // Round timer — battle.js calls these from its tick() functions.
    window.setRoundTimer = (text, urgent) => {
      setTimerText(text || '')
      setTimerUrgent(!!urgent)
    }
    window.hideRoundTimer = () => {
      setTimerText('')
      setTimerUrgent(false)
    }
    // Header / HUD dispatchers — see state declarations above.
    window.setBanner = (text, cls) => { setBannerText(text || ''); setBannerClass(cls || '') }
    window.setBattleFmt = (label) => setFormatLabel(label || '')
    window.setBattleOpp = (name) => setOppName(name || 'Enemy')
    window.setBattleArmyCount = (text) => setArmyCount(text || '')
    window.setBattleScoreDots = ({ p, e }) => setScoreDots({ p: p || [], e: e || [] })
    window.setBattleSpeed = ({ label, fast }) => setSpeed({ label: label || '2x', fast: !!fast })
    // Barracks — full render shape. battle.js builds it; React renders.
    window.setBenchState = (state) => setBench({
      active: !!state?.active,
      count: state?.count ?? 0,
      max: state?.max ?? 5,
      emptyMessage: state?.emptyMessage ?? null,
      cards: state?.cards ?? [],
    })
    // Recruitment — render shape including gold + reroll state. Accepts
    // partial updates (e.g. updateHdr() in battle.js dispatches just `{ gold }`
    // to refresh the header without rebuilding the full card list).
    window.setShopState = (state) => setShop((prev) => ({
      active: state?.active ?? prev.active,
      gold: state?.gold ?? prev.gold,
      rerollDisabled: state?.rerollDisabled ?? prev.rerollDisabled,
      cards: state?.cards ?? prev.cards,
    }))
    // Field — accepts partial updates. battle.js's renderField sends both
    // sides + interaction flags; isolated mutations (e.g. selection
    // changes) can dispatch only the slice they need.
    window.setFieldState = (state) => setField((prev) => ({
      p: state?.p ?? prev.p,
      e: state?.e ?? prev.e,
      interactive: state?.interactive ?? prev.interactive,
      fieldSel: state?.fieldSel === undefined ? prev.fieldSel : state.fieldSel,
      dropMode: state?.dropMode ?? prev.dropMode,
    }))
    // Mobile view — single mutually-exclusive value. battle.js's
    // setMobileStep / togglePanel / toggleMobileMenu wrappers compute
    // the next view (toggle behavior, etc.) and dispatch the result.
    window.setMobileView = (view) => setMobileView(view ?? null)
    window.setFullscreenBtnText = (txt) => setFsBtnText(txt || 'Enter Fullscreen')
    // Duel-result overlay — full render shape from battle.js's
    // showDuelResult(). closeDuelResult flips just `open` so the
    // ✕ View Field button doesn't disturb the rest of the data.
    window.showDuelResult = (data) => {
      if (data?.pw && !data?.isPvP && sessionForBadge?.mode === 'guest') {
        if (!localStorage.getItem('hf_conv_victory')) {
          setTimeout(() => setConvModal(true), 1500)
        }
      }
      setDuelResult({
      open: true,
      pw: !!data?.pw,
      scoreP: data?.scoreP ?? 0,
      scoreE: data?.scoreE ?? 0,
      battles: data?.battles ?? [],
      dmgP: data?.dmgP ?? 0,
      dmgE: data?.dmgE ?? 0,
      killsP: data?.killsP ?? 0,
      killsE: data?.killsE ?? 0,
      mergesP: data?.mergesP ?? 0,
      mergesE: data?.mergesE ?? '—',
      teamP: data?.teamP ?? [],
      teamE: data?.teamE ?? [],
      isPvP: !!data?.isPvP,
      wager: data?.wager ?? 0,
      nextLabel: data?.isPvP ? '🏠 Back to Lobby' : '🌟 Next Duel',
      submitting: data?.isPvP
        ? {
          state: 'pending',
          text: 'Submitting results...',
          sub: data.wager > 0
            ? `${data.wager} HIVE will be transferred to the winner`
            : 'Friendly match — no wager to process',
        }
        : null,
      })
    }
    window.closeDuelResult = () => setDuelResult((prev) => ({ ...prev, open: false }))
    return () => {
      // React-side dispatchers (this useEffect registered them above).
      // Critical to remove — they hold setState closures that would warn
      // on unmount if invoked.
      const reactSide = [
        'openQuitModal', 'closeQuitModal', 'confirmQuit',
        'openHowTo', 'closeHowTo',
        'setRoundTimer', 'hideRoundTimer',
        'setBanner', 'setBattleFmt', 'setBattleOpp', 'setBattleArmyCount',
        'setBattleScoreDots', 'setBattleSpeed',
        'setBenchState', 'setShopState', 'setFieldState',
        'setMobileView', 'setFullscreenBtnText',
        'showDuelResult', 'closeDuelResult',
      ]
      // battle.js-side callbacks that delegate from JSX. Not React state, but
      // they hold closures over battle.js's `G` global; cleaning them up
      // prevents stale handlers from firing if the script-load chain is
      // racing on a quick remount, and frees the closures for GC.
      const battleSide = [
        'duelResultNext',
        'fieldCellClick', 'fieldCellDragStart', 'fieldCellDragEnd', 'fieldCellDrop',
        'fieldCellMouseEnter', 'fieldCellMouseLeave',
        'fieldInfoShow', 'fieldInfoHide',
        'fieldTouchStart', 'fieldTouchEnd', 'fieldTouchMove',
        'shopCardClick', 'shopInfoShow', 'shopInfoHide',
        'benchCardClick', 'benchCardDragStart', 'benchCardDragEnd',
        'retBench',
        'benchInfoShow', 'benchInfoHide',
        'setMobileStep', 'togglePanel',
        'toggleMobileMenu', 'openMobileMenu', 'closeMobileMenu',
        // Top-level `function …()` declarations also become globals on
        // window. Listed here so the unmount sweep is exhaustive.
        'startBattle', 'rerollShop', 'toggleBattleSpeed',
        'render',
      ]
      for (const name of reactSide) delete window[name]
      delete window.HF_equipped_backgrounds
      delete window.HF_equipped_skins
      delete window.HF_gear
      for (const name of battleSide) delete window[name]
    }
  }, [closeQuit, confirmQuit])

  // PvP "submitting results..." mock — flips to "done" after 3s. This is a
  // placeholder that mirrors the original imperative behaviour (Etapa 3 will
  // be a real on-chain confirmation; until then it's a UX cue that the
  // server has accepted the result). Effect resets on each duel-result open.
  useEffect(() => {
    if (!duelResult.open || !duelResult.isPvP) return
    if (duelResult.submitting?.state === 'done') return
    const t = setTimeout(() => {
      setDuelResult((prev) => prev.open && prev.isPvP ? {
        ...prev,
        submitting: {
          state: 'done',
          text: 'Results submitted!',
          sub: prev.wager > 0
            ? 'Transfer complete. Check your Hive wallet.'
            : 'Match recorded.',
        },
      } : prev)
    }, 3000)
    return () => clearTimeout(t)
  }, [duelResult.open, duelResult.isPvP, duelResult.submitting?.state])

  // ── Fullscreen banner + handlers (Phase 4 of #16) ───────────────────
  // Was an IIFE in battle.js gated on isTouch+hasFS feature detection.
  // Now lives in BattlePage. Banner visibility is React state; the
  // localStorage preference and first-touch auto-enter behaviour are
  // preserved exactly. window.toggleFullscreen / acceptFullscreen /
  // declineFullscreen are still registered for the menu button (and
  // for any code that calls them).
  useEffect(() => {
    const FS_KEY = 'hf_fullscreen'
    const isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    const docEl = document.documentElement
    const hasFS = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen)

    function enterFS() {
      const p = docEl.requestFullscreen
        ? docEl.requestFullscreen()
        : docEl.webkitRequestFullscreen
          ? docEl.webkitRequestFullscreen()
          : null
      if (p) p.catch(() => { })
    }
    function exitFS() {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    }

    window.toggleFullscreen = () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) exitFS()
      else enterFS()
      window.closeMobileMenu?.()
    }
    window.acceptFullscreen = () => {
      try { localStorage.setItem(FS_KEY, '1') } catch { }
      setFsBannerOpen(false)
      enterFS()
    }
    window.declineFullscreen = () => {
      try { localStorage.setItem(FS_KEY, '0') } catch { }
      setFsBannerOpen(false)
    }

    let bannerTimer = null
    let firstTouchOff = null
    if (isTouch && hasFS) {
      let pref = null
      try { pref = localStorage.getItem(FS_KEY) } catch { }
      if (pref === '1') {
        // Auto-enter on the next user gesture (FS APIs require one).
        const onFirstTouch = () => {
          document.removeEventListener('touchstart', onFirstTouch, true)
          document.removeEventListener('click', onFirstTouch, true)
          if (!document.fullscreenElement && !document.webkitFullscreenElement) enterFS()
        }
        document.addEventListener('touchstart', onFirstTouch, { once: true, capture: true })
        document.addEventListener('click', onFirstTouch, { once: true, capture: true })
        firstTouchOff = () => {
          document.removeEventListener('touchstart', onFirstTouch, true)
          document.removeEventListener('click', onFirstTouch, true)
        }
      } else if (pref === null) {
        // First visit on a touch device — show the banner after a short delay.
        bannerTimer = setTimeout(() => setFsBannerOpen(true), 1500)
      }
    }
    return () => {
      if (bannerTimer) clearTimeout(bannerTimer)
      if (firstTouchOff) firstTouchOff()
      delete window.toggleFullscreen
      delete window.acceptFullscreen
      delete window.declineFullscreen
    }
  }, [])

  useEffect(() => {
    if (!getSession()) { navigate('/', { replace: true }); return }
    if (initialized.current) return
    initialized.current = true

    // Make #root fill the viewport and act as flex container for battle layout
    const root = document.getElementById('root')
    if (root) {
      root.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;min-height:100dvh;margin:0;padding:0;border:none;max-width:none;text-align:left;'
    }

    // ── Load CSS files in parallel ──
    // Only gate visibility on battle.css (critical, 105KB). Others are small/optional.
    const cssFiles = ['/css/battle.css', '/mobile.css', '/css/hf-portraits.css']
    const links = cssFiles.map(href => {
      const el = document.createElement('link')
      el.rel = 'stylesheet'
      el.href = href
      if (href === '/css/battle.css') {
        el.onload = () => setCssReady(true)
        el.onerror = () => setCssReady(true)
      }
      document.head.appendChild(el)
      return el
    })

    // ── Load scripts ──
    // Order: shared/simulate.js (ES module, exposes window.HFSimulate) must
    // resolve before battle.js, which reads it. Everything else loads in
    // parallel afterward. battle.js boot only needs DOM ready.
    const scripts = []
    function addScript(src, opts = {}) {
      return new Promise((resolve) => {
        const s = document.createElement('script')
        s.src = src
        if (opts.type) s.type = opts.type
        s.onload = resolve
        s.onerror = resolve // don't block on error
        document.body.appendChild(s)
        scripts.push(s)
      })
    }

    // bot-ai.js exposes window.HFBot and skill-tooltip.js exposes
    // window.HFTooltip — both must be present before battle.js's
    // _bootBattle fires (which is right after battle.js evaluates).
    // Serialize: simulate (module) → bot-ai + skill-tooltip → battle.
    // socket.io and mobile.js load in parallel.
    //
    // setScriptsReady fires after battle.js's onload — by that point its
    // _bootBattle has run synchronously, so dispatched globals like
    // window.startBattle / window.toggleBattleSpeed / window.setMobileStep
    // are guaranteed to be registered.
    // Load order matters:
    //   1. simulate.js (module) registers window.HFSimulate.
    //   2. bot-ai.js + skill-tooltip.js register window.HFBot/HFTooltip.
    //   3. battle.js evaluates _bootBattle which reads all of the above.
    //      socket.io.js can load in parallel — battle.js doesn't touch it
    //      at top level.
    //   4. mobile.js wraps window.render and must run AFTER battle.js
    //      registers it; loading them in parallel was a race that silently
    //      dropped the touch-cell highlight feature.
    addScript('/shared/simulate.js', { type: 'module' })
      .then(() => Promise.all([
        addScript('/js/bot-ai.js'),
        addScript('/js/skill-tooltip.js'),
      ]))
      .then(async () => {
        const sess = getSession()
        if (sess?.mode === 'hive' && sess?.token) {
          const headers = { Authorization: `Bearer ${sess.token}` }
          try {
            const [bgs, skins, gearRes] = await Promise.all([
              fetch('/api/cosmetics/backgrounds/equipped', { headers }).then(r => r.json()),
              fetch('/api/cosmetics/skins/equipped', { headers }).then(r => r.json()),
              fetch(`/api/gear?player=${encodeURIComponent(sess.username)}`, { headers }).then(r => r.json()),
            ])
            window.HF_equipped_backgrounds = bgs.equipped || []
            window.HF_equipped_skins = skins.equipped || {}
            window.HF_gear = gearRes.ok ? gearRes.gear : {}
          } catch {
            window.HF_equipped_backgrounds = []
            window.HF_equipped_skins = {}
            window.HF_gear = {}
          }
        } else {
          window.HF_equipped_backgrounds = []
          window.HF_equipped_skins = {}
          window.HF_gear = {}
        }
      })
      .then(() => Promise.all([
        addScript('/socket.io/socket.io.js'),
        addScript('/js/battle.js'),
      ]))
      .then(() => addScript('/mobile.js'))
      .then(() => setScriptsReady(true))

    return () => {
      links.forEach(el => el.remove())
      scripts.forEach(s => s.remove())
      // Restore #root styles on unmount
      if (root) root.style.cssText = ''
    }
  }, [navigate])

  // Render the 9 cells of a field side. Cell layout, occupancy, selection,
  // and drop-target highlighting come from React state. Transient effects
  // (target-preview on hover, dnd-over on drag, attack arrow overlays)
  // remain imperative — battle.js querySelectors them by data-i/data-side.
  const renderFieldCells = (side) => {
    const cells = field[side]
    const interactive = side === 'p' && field.interactive
    return Array.from({ length: 9 }, (_, i) => {
      const u = cells[i]
      const isSel = side === 'p' && field.fieldSel === i
      const isDrop = side === 'p' && field.dropMode && !u && field.interactive
      const cls = `cell${u ? ' occ' : ''}${isSel ? ' field-sel' : ''}${isDrop ? ' dr' : ''}`
      return (
        <div
          key={i}
          data-i={i}
          data-side={side}
          className={cls}
          onClick={interactive ? () => window.fieldCellClick?.(side, i) : undefined}
          onDragOver={interactive ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } : undefined}
          onDragEnter={interactive ? (e) => { e.preventDefault(); e.currentTarget.classList.add('dnd-over') } : undefined}
          onDragLeave={interactive ? (e) => e.currentTarget.classList.remove('dnd-over') : undefined}
          onDrop={interactive ? (e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('dnd-over')
            window.fieldCellDrop?.(side, i, e.nativeEvent)
          } : undefined}
          onMouseEnter={interactive && u ? () => window.fieldCellMouseEnter?.(side, i) : undefined}
          onMouseLeave={interactive && u ? () => window.fieldCellMouseLeave?.(side, i) : undefined}
        >
          {u && (
            <div
              className={`unit l${u.lv}`}
              data-uid={u.uid}
              data-cid={u.cid}
              style={{ background: u.bg }}
              draggable={interactive}
              onDragStart={interactive ? (e) => window.fieldCellDragStart?.(side, i, e.nativeEvent) : undefined}
              onDragEnd={interactive ? () => window.fieldCellDragEnd?.(side, i) : undefined}
              onTouchStart={(e) => window.fieldTouchStart?.(side, i, e.currentTarget)}
              onTouchEnd={() => window.fieldTouchEnd?.()}
              onTouchMove={() => window.fieldTouchMove?.()}
            >
              <div className="ulvl">{u.levelLabel}</div>
              <div
                className="hf-info-btn"
                title=""
                onMouseEnter={(e) => window.fieldInfoShow?.(side, i, e.currentTarget)}
                onMouseLeave={() => window.fieldInfoHide?.()}
                onClick={(e) => { e.stopPropagation(); window.fieldInfoShow?.(side, i, e.currentTarget) }}
              >i</div>
              <div
                className={`cportrait${u.portraitUrl ? ' has-portrait' : ''}`}
                style={u.portraitUrl ? { '--portrait-url': `url('${u.portraitUrl}')` } : undefined}
              >
                <div className="cico">{u.ico}</div>
              </div>
              <div className="uhb">
                <div className="uhf hi" style={{ width: '100%' }}></div>
              </div>
              <div className="uprog" style={{ color: u.dotColor }}>
                {[0, 1, 2].map((d) => (
                  <div
                    key={d}
                    className={`uprog-dot ${u.lv >= 5 || d < u.stack ? 'filled' : 'empty'}`}
                    style={{ borderColor: u.dotColor }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )
    })
  }

  const ready = cssReady && scriptsReady
  return (
    <div style={ready ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' } : { visibility: 'hidden', position: 'absolute' }}>
      {/* ══ QUIT MODAL ══ */}
      <div id="quit-overlay" className={quitOpen ? 'open' : ''}
        onClick={e => e.target === e.currentTarget && closeQuit()}>
        <div id="quit-modal">
          <div className="qm-icon">⚠️</div>
          <div className="qm-title">Quit Match?</div>
          <div className="qm-body">
            You will lose all progress in this match and return to the Lobby.
          </div>
          <div className="qm-btns">
            <button className="qm-btn qm-cancel" onClick={closeQuit}>Keep Playing</button>
            <button className="qm-btn qm-confirm" onClick={confirmQuit}>Quit</button>
          </div>
        </div>
      </div>

      {/* ══ GAME ══ */}
      <div id="game">
        {/* HEADER */}
        <div id="hdr">
          <div className="hdr-row-top">
            <div className="duelbar-center">
              <span className="sb suser" id="h-user">{userBadge}</span>
              <div className="dscore" id="dots-p">
                {scoreDots.p.map((s, i) => <div key={`p${i}`} className={`dot dot-${s}`} />)}
              </div>
              <span className="duel-vs">⚔️</span>
              <div className="dscore" id="dots-e">
                {scoreDots.e.map((s, i) => <div key={`e${i}`} className={`dot dot-${s}`} />)}
              </div>
              <span className="sb sopp" id="lbl-score-enemy">{oppName}</span>
            </div>
          </div>
          <div className="hdr-row-bottom">
            <span className="sb sfmt" id="h-fmt">{formatLabel}</span>
            <span id="h-timer">⏱ 2:00</span>
            <div id="banner" className={bannerClass}>
              {bannerText}
            </div>
            <button
              id="battle-speed-toggle"
              type="button"
              className={speed.fast ? 'is-fast' : ''}
              onClick={() => window.toggleBattleSpeed?.()}
              title="Toggle battle speed"
            >
              {speed.label}
            </button>
            <button className="htp-btn hback-btn" onClick={() => window.openQuitModal?.()} title="Concede">
              Concede
            </button>
          </div>
        </div>

        {/* ══ MOBILE HUD OVERLAY ══ */}
        <div id="mobile-hud">
          <div id="mobile-opp-badge">
            <span id="mobile-opp-name">{oppName}</span>
          </div>

          <span
            id="mobile-round-timer"
            className={timerUrgent ? 'timer-urgent' : ''}
            style={{ display: timerText ? 'block' : 'none' }}
          >
            {timerText}
          </span>

          <button
            id="mobile-speed-btn"
            type="button"
            className={speed.fast ? 'is-fast' : ''}
            onClick={() => window.toggleBattleSpeed?.()}
          >
            {speed.label}
          </button>

          <div id="mobile-dots-right">
            <div id="mobile-dots-e" className="mdots">
              {scoreDots.e.map((s, i) => <div key={`me${i}`} className={`dot dot-${s}`} />)}
            </div>
            <div className="mdots-divider"></div>
            <div id="mobile-dots-p" className="mdots">
              {scoreDots.p.map((s, i) => <div key={`mp${i}`} className={`dot dot-${s}`} />)}
            </div>
          </div>
        </div>

        {/* ══ ARENA ══ */}
        <div id="arena-wrap">
          <div id="turnpanel" className="hidden">
            <div className="tp-title">⚔ Order</div>
            <div className="tp-list" id="tp-list"></div>
          </div>
          <div id="fields-row">
            <div className="fwrap">
              <div className="flbl flbl-row">
                <span id="lbl-player" style={{ color: '#88aaff' }}>⚔ Your Army</span>
                <span id="army-count">{armyCount}</span>
              </div>
              <div className="field pf" id="pfield">{renderFieldCells('p')}</div>
            </div>
            <div id="vs"><span className="vstxt">VS</span></div>
            <div className="fwrap">
              <div className="flbl" style={{ color: '#ff8888' }}>
                <span id="lbl-enemy">☠ Opponent</span>
              </div>
              <div className="field ef" id="efield">{renderFieldCells('e')}</div>
            </div>
          </div>
        </div>

        {/* ══ BOTTOM ZONE ══ */}
        <div id="bottom-zone">
          {/* LEFT: Barracks */}
          <div id="benchwrap" className={`${bench.count > 0 ? 'expanded' : ''}${mobileView === 'barracks' ? ' mobile-open' : ''}`.trim()}>
            <div className="sec-hdr">
              <span className="sec-title barracks-title">Barracks</span>
              <span className="sec-title bcount-lbl" id="bcount">
                {`${bench.count}/${bench.max}`}
              </span>
            </div>
            <div id="benchrow">
              {bench.emptyMessage && (
                <div className="bench-msg">{bench.emptyMessage}</div>
              )}
              {bench.cards.map((c, bi) => (
                <div
                  key={c.cid}
                  data-cid={c.cid}
                  className={`bcard${c.isSel ? ' bsel' : ''}${c.isNewRecruit ? ' bcard-enter' : ''}`}
                  style={{
                    background: c.bg,
                    borderColor: c.isSel ? '#88ccff' : c.borderCol,
                    ...(c.isNewRecruit ? { animationDelay: `${bi * 40}ms` } : {}),
                  }}
                  draggable={bench.active}
                  onClick={bench.active ? () => window.benchCardClick?.(c.cid) : undefined}
                  onDragStart={bench.active ? (e) => window.benchCardDragStart?.(c.cid, e.nativeEvent) : undefined}
                  onDragEnd={bench.active ? () => window.benchCardDragEnd?.(c.cid) : undefined}
                >
                  <div className="blvl">{c.levelLabel}</div>
                  <div
                    className="hf-info-btn"
                    title=""
                    onMouseEnter={(e) => window.benchInfoShow?.(c.cid, e.currentTarget)}
                    onMouseLeave={() => window.benchInfoHide?.()}
                    onClick={(e) => { e.stopPropagation(); window.benchInfoShow?.(c.cid, e.currentTarget) }}
                  >i</div>
                  <div
                    className={`cportrait${c.portraitUrl ? ' has-portrait' : ''}`}
                    style={c.portraitUrl ? { '--portrait-url': `url('${c.portraitUrl}')` } : undefined}
                  >
                    <div className="cico">{c.ico}</div>
                  </div>
                  <div className="bprog" style={{ color: c.dotColor }}>
                    {[0, 1, 2].map((d) => (
                      <div
                        key={d}
                        className={`bprog-dot ${d < c.stack ? 'filled' : 'empty'}`}
                        style={{ borderColor: c.dotColor }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {bench.cards.length > 0 && Array.from(
                { length: Math.max(0, bench.max - bench.cards.length) },
                (_, i) => <div key={`empty-${i}`} className="bcard-empty" />,
              )}
            </div>
          </div>

          {/* CENTER: Battle button + Log */}
          <div id="center-col">
            <div id="ctrl">
              <button className="btn bbtn" id="bfight" onClick={() => window.startBattle?.()}>
                Battle!
              </button>
              <div
                id="phase-timer"
                className={timerUrgent ? 'timer-urgent' : ''}
                style={{ display: timerText ? 'block' : 'none' }}
              >
                {timerText}
              </div>
            </div>
            <div id="log"></div>
          </div>

          {/* RIGHT: Recruitment */}
          <div id="shopwrap" className={mobileView === 'recruit' ? 'mobile-open' : ''}>
            <div className="sec-hdr">
              <span className="sec-title recruit-title">
                Recruitment <span className="sb sg" id="h-gold">{`💰 ${shop.gold}`}</span>
              </span>
              <div className="recruit-controls">
                <button
                  className="rrbtn"
                  id="breroll"
                  disabled={shop.rerollDisabled}
                  onClick={() => window.rerollShop?.()}
                >
                  New Recruitment (2💰)
                </button>
              </div>
            </div>
            <div id="shoprow">
              {shop.cards.map((c) => {
                const isLifted = !!c.comboKey && hoveredCombo === c.comboKey && c.canBuy
                const cls = `scard${c.isCombo ? ' combo-card' : ''}${c.isAtMax ? ' maxed' : c.canBuy ? ' buyable' : ' broke'
                  }${isLifted ? ' combo-lift' : ''}`
                return (
                  <div
                    key={c.uid}
                    data-uid={c.uid}
                    className={cls}
                    style={{
                      left: `${c.targetLeft}px`,
                      background: c.bg,
                      borderColor: c.borderCol,
                      transition:
                        'left .38s cubic-bezier(.22,.68,0,1.2),' +
                        'opacity .26s ease,transform .18s ease,' +
                        'filter .18s ease,box-shadow .18s ease',
                    }}
                    onClick={c.canBuy ? () => window.shopCardClick?.(c.slotIdx) : undefined}
                    onMouseEnter={
                      c.comboKey ? () => setHoveredCombo(c.comboKey) : undefined
                    }
                    onMouseLeave={
                      c.comboKey
                        ? (e) => {
                          // Don't clear if moving into another card of the same combo
                          const relUid = e.relatedTarget?.closest?.('[data-uid]')?.dataset?.uid
                          const stayingInCombo = relUid && shop.cards.some(
                            (x) => x.uid === relUid && x.comboKey === c.comboKey,
                          )
                          if (!stayingInCombo) setHoveredCombo(null)
                        }
                        : undefined
                    }
                  >
                    <div className={`sprice ${c.priceClass}`}>{c.priceLabel}</div>
                    <div className={`scnt ${c.countClass}`}>{c.countLabel}</div>
                    <div
                      className={`cportrait${c.portraitUrl ? ' has-portrait' : ''}`}
                      style={c.portraitUrl ? { '--portrait-url': `url('${c.portraitUrl}')` } : undefined}
                    >
                      <div className="cico">{c.ico}</div>
                    </div>
                    <div
                      className="hf-info-btn"
                      title=""
                      onMouseEnter={(e) => window.shopInfoShow?.(c.uid, e.currentTarget)}
                      onMouseLeave={() => window.shopInfoHide?.()}
                      onClick={(e) => {
                        e.stopPropagation()
                        window.shopInfoShow?.(c.uid, e.currentTarget)
                      }}
                    >i</div>
                    <div className="caction">{c.actionLabel}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MOBILE LOG OVERLAY ══ */}
      <div id="mobile-log-overlay" className={mobileView === 'log' ? 'open' : ''}>
        <div className="mob-log-handle" onClick={() => window.togglePanel?.('log')}></div>
        <div className="mob-log-title">Battle Log</div>
        <div id="mobile-log-entries"></div>
      </div>

      {/* ══ MOBILE MENU PANEL ══ */}
      <div id="mobile-menu-overlay" className={mobileView === 'menu' ? 'open' : ''}>
        <div className="mob-log-handle" onClick={() => window.toggleMobileMenu?.()}></div>
        <div className="mmp-title">Menu</div>

        <button
          className="mmp-btn"
          onClick={() => {
            window.closeMobileMenu?.()
            window.openHowTo?.()
          }}
        >
          Rules
        </button>

        <button
          className="mmp-btn"
          id="mmp-fs-btn"
          onClick={() => window.toggleFullscreen?.()}
        >
          {fsBtnText}
        </button>

        <button
          className="mmp-btn mmp-danger"
          onClick={() => {
            window.closeMobileMenu?.()
            window.openQuitModal?.()
          }}
        >
          Concede
        </button>
      </div>

      {/* ══ MOBILE ACTION BAR ══ */}
      <div className="mobile-actions">
        <button type="button" data-step="recruit"
          className={mobileView === 'recruit' ? 'ms-active' : ''}
          onClick={() => window.setMobileStep?.('recruit')}>
          🛍️<span>Recruit</span>
        </button>
        <button type="button" data-step="barracks"
          className={mobileView === 'barracks' ? 'ms-active' : ''}
          onClick={() => window.setMobileStep?.('barracks')}>
          🏕️<span>Barracks</span>
        </button>
        <div className="mab-center">
          <button id="mobile-battle-btn" type="button" onClick={() => window.startBattle?.()}>⚔️</button>
        </div>
        <button type="button" data-step="log"
          className={mobileView === 'log' ? 'ms-active' : ''}
          onClick={() => window.togglePanel?.('log')}>
          📜<span>Log</span>
        </button>
        <button type="button" data-step="menu"
          className={mobileView === 'menu' ? 'ms-active' : ''}
          onClick={() => window.toggleMobileMenu?.()}>
          ⚙️<span>Menu</span>
        </button>
      </div>

      {/* ══ DUEL RESULT ══ */}
      <div id="duel-result" className={duelResult.open ? 'open' : ''}>
        <div id="dr-box">
          <div className={`dr-title ${duelResult.pw ? 'win' : 'loss'}`} id="dr-title">
            {duelResult.pw ? '🏆 DUEL WON!' : '💔 DUEL LOST!'}
          </div>
          <div className="dr-score" id="dr-score">
            <span style={{ color: '#88ff88' }}>{duelResult.scoreP}</span>
            {' – '}
            <span style={{ color: '#ff8888' }}>{duelResult.scoreE}</span>
          </div>
          <div className="dr-battles" id="dr-battles">
            {duelResult.battles.map((b, i) => (
              <div key={i} className={`dr-bat ${b.winner === 'p' ? 'w' : 'l'}`}>
                {`B${i + 1} ${b.winner === 'p' ? '✓' : '✗'}`}
              </div>
            ))}
          </div>
          <div className="dr-divider"></div>
          <div className="dr-stats-grid">
            <div className="dr-stat-row">
              <div className="dr-val p" id="drs-dmgP">{duelResult.dmgP.toLocaleString()}</div>
              <div className="dr-stat-lbl">⚔️ Total Damage</div>
              <div className="dr-val e" id="drs-dmgE">{duelResult.dmgE.toLocaleString()}</div>
            </div>
            <div className="dr-stat-row">
              <div className="dr-val p" id="drs-killsP">{duelResult.killsP}</div>
              <div className="dr-stat-lbl">💀 Kills</div>
              <div className="dr-val e" id="drs-killsE">{duelResult.killsE}</div>
            </div>
            <div className="dr-stat-row">
              <div className="dr-val p" id="drs-merges">{duelResult.mergesP}</div>
              <div className="dr-stat-lbl">✨ Merges</div>
              <div className="dr-val e" id="drs-mergesE">{duelResult.mergesE}</div>
            </div>
          </div>
          <div className="dr-divider"></div>
          <div className="dr-teams">
            <div className="dr-team">
              <div className="dr-team-lbl" style={{ color: 'rgba(136, 170, 255, 0.6)' }}>
                Your Final Army
              </div>
              <div className="dr-team-units" id="drt-p">
                {duelResult.teamP.length === 0
                  ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>—</span>
                  : duelResult.teamP.map((u, i) => (
                    <div key={i} className={`dr-unit ${u.alive ? 'alive' : 'dead'}`}>
                      <span>{u.ico}</span>
                      <span style={{ fontSize: 7, color: u.alive ? '#88ff88' : '#ff8888' }}>{u.levelLabel}</span>
                      <span className="dr-unit-lbl">{u.shortName}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="dr-team">
              <div className="dr-team-lbl" style={{ color: 'rgba(255, 100, 100, 0.6)' }}>
                Enemy Army
              </div>
              <div className="dr-team-units" id="drt-e">
                {duelResult.teamE.length === 0
                  ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>—</span>
                  : duelResult.teamE.map((u, i) => (
                    <div key={i} className={`dr-unit ${u.alive ? 'alive' : 'dead'}`}>
                      <span>{u.ico}</span>
                      <span style={{ fontSize: 7, color: u.alive ? '#88ff88' : '#ff8888' }}>{u.levelLabel}</span>
                      <span className="dr-unit-lbl">{u.shortName}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <div
            id="dr-submitting"
            className={`${duelResult.submitting ? 'visible' : ''}${duelResult.submitting?.state === 'done' ? ' done' : ''}`.trim()}
          >
            <div className="dr-submit-row">
              <div
                className={`dr-submit-spinner${duelResult.submitting?.state === 'done' ? ' done' : ''}`}
                id="dr-spin"
              >
                {duelResult.submitting?.state === 'done' ? '✓' : ''}
              </div>
              <div className="dr-submit-text" id="dr-submit-text">
                {duelResult.submitting?.text || 'Submitting results...'}
              </div>
            </div>
            <div className="dr-submit-sub" id="dr-submit-sub">
              {duelResult.submitting?.sub || 'Processing match outcome on the blockchain...'}
            </div>
          </div>
          <div className="dr-cta">
            <button
              className="btn gnbtn"
              id="dr-next-btn"
              onClick={() => window.duelResultNext?.()}
            >
              {duelResult.nextLabel}
            </button>
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.6)' }}
              onClick={() => window.closeDuelResult?.()}
            >
              ✕ View Field
            </button>
          </div>
        </div>
      </div>

      {/* ══ HOW TO PLAY ══ */}
      <div id="howto" className={howToOpen ? 'open' : ''}
        onClick={e => e.target === e.currentTarget && setHowToOpen(false)}>
        <div id="htp-box">
          <button id="htp-close" onClick={() => setHowToOpen(false)}>✕ Close</button>
          <div className="htp-h1">📖 How To Play</div>
          <div className="htp-h2">🎯 Objective</div>
          <p className="htp-p">
            Win the most rounds in a duel to emerge victorious. The number of rounds will depend on which game mode you selected. Recruit, combine, level up and win.
          </p>
          <div className="htp-h2">💰 Gold</div>
          <div className="htp-tips">
            <div className="htp-tip">
              <span className="htp-tip-ico">🏁</span>
              <div>Each duel starts with <b style={{ color: '#ffdd55' }}>7💰</b>.</div>
            </div>
            <div className="htp-tip">
              <span className="htp-tip-ico">⚔️</span>
              <div>Both players receive the same amount each round.</div>
            </div>
            <div className="htp-tip">
              <span className="htp-tip-ico">🔄</span>
              <div>New Recruitment costs <b style={{ color: '#ffdd55' }}>2💰</b>.</div>
            </div>
          </div>
          <div className="htp-h2">⛺ Recruitment &amp; Bench</div>
          <div className="htp-tips">
            <div className="htp-tip">
              <span className="htp-tip-ico">🆕</span>
              <div>Buying a character you don&apos;t own yet costs <b style={{ color: '#ffdd55' }}>3💰</b>. They go straight to the Barracks.</div>
            </div>
            <div className="htp-tip">
              <span className="htp-tip-ico">🔗</span>
              <div>Buying a character you already own costs <b style={{ color: '#88ff88' }}>2💰</b> and stacks on the same card — each hero uses only <b>1 slot</b> in the Barracks.</div>
            </div>
            <div className="htp-tip">
              <span className="htp-tip-ico">🖱️</span>
              <div><b>Drag</b> a card from Barracks to a field slot, or click it then click the slot.</div>
            </div>
          </div>
          <div className="htp-h2">✨ Card Merging</div>
          <div className="htp-tips">
            <div className="htp-tip">
              <span className="htp-tip-ico">⭐</span>
              <div>
                Stack <b>3 copies</b> of the same character to auto-merge — they level up (
                <b style={{ color: '#ffcc44' }}>★ → ★★ → ★★★...</b>) and become much more powerful.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ FULLSCREEN BANNER ══ */}
      <div id="fs-banner" className={fsBannerOpen ? 'show' : ''}>
        <div className="fsb-text">🎮 Play in fullscreen for the best experience?</div>
        <div className="fsb-btns">
          <button className="fsb-yes" onClick={() => window.acceptFullscreen?.()}>Yes, fullscreen</button>
          <button className="fsb-no" onClick={() => window.declineFullscreen?.()}>No thanks</button>
        </div>
      </div>

      {/* ══ ATTACK ARROW OVERLAY ══ */}
      <svg
        id="attack-svg"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 95, overflow: 'visible' }}
      >
        <defs>
          <filter id="arr-blur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
          </filter>
          <marker id="arr-primary" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
            <path d="M0.5,0.5 L8.5,4.5 L0.5,8.5 L2,4.5 Z" fill="rgba(255,88,72,.96)" />
          </marker>
          <marker id="arr-splash" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
            <path d="M0.5,0.5 L8.5,4.5 L0.5,8.5 L2,4.5 Z" fill="rgba(255,178,35,.94)" />
          </marker>
          <marker id="arr-ally" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
            <path d="M0.5,0.5 L8.5,4.5 L0.5,8.5 L2,4.5 Z" fill="rgba(72,230,115,.94)" />
          </marker>
        </defs>
      </svg>
      <GuestConversionModal
        open={convModal}
        context="victory"
        onClose={() => {
          localStorage.setItem('hf_conv_victory', '1')
          setConvModal(false)
        }}
      />
    </div>
  )
}
