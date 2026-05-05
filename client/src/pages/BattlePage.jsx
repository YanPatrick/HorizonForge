import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '../lib/session'

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

  const closeQuit = useCallback(() => setQuitOpen(false), [])
  const confirmQuit = useCallback(() => {
    setQuitOpen(false)
    // Disconnect any live PvP socket so the server marks us as quit, not just
    // dropped — and hard-redirect rather than navigate(): battle.js attaches
    // a lot of imperative side effects on this page that we want fully torn
    // down. A hard reload is the simplest way to clean them up.
    if (window._PVP?.socket) window._PVP.socket.disconnect()
    window.location.href = '/lobby'
  }, [])

  useEffect(() => {
    // Register the globals battle.js dispatches through. Removing the legacy
    // function definitions in battle.js (openQuitModal, closeQuitModal,
    // confirmQuit, openHowTo, closeHowTo) means these shims are now the
    // single source of truth for modal state.
    window.openQuitModal  = () => setQuitOpen(true)
    window.closeQuitModal = closeQuit
    window.confirmQuit    = confirmQuit
    window.openHowTo      = () => setHowToOpen(true)
    window.closeHowTo     = () => setHowToOpen(false)
    // Round timer — battle.js calls these from its tick() functions.
    window.setRoundTimer  = (text, urgent) => {
      setTimerText(text || '')
      setTimerUrgent(!!urgent)
    }
    window.hideRoundTimer = () => {
      setTimerText('')
      setTimerUrgent(false)
    }
    // Header / HUD dispatchers — see state declarations above.
    window.setBanner             = (text, cls) => { setBannerText(text || ''); setBannerClass(cls || '') }
    window.setBattleFmt          = (label) => setFormatLabel(label || '')
    window.setBattleOpp          = (name) => setOppName(name || 'Enemy')
    window.setBattleArmyCount    = (text) => setArmyCount(text || '')
    window.setBattleScoreDots    = ({ p, e }) => setScoreDots({ p: p || [], e: e || [] })
    window.setBattleSpeed        = ({ label, fast }) => setSpeed({ label: label || '2x', fast: !!fast })
    // Barracks — full render shape. battle.js builds it; React renders.
    window.setBenchState         = (state) => setBench({
      active: !!state?.active,
      count: state?.count ?? 0,
      max: state?.max ?? 5,
      emptyMessage: state?.emptyMessage ?? null,
      cards: state?.cards ?? [],
    })
    return () => {
      delete window.openQuitModal
      delete window.closeQuitModal
      delete window.confirmQuit
      delete window.openHowTo
      delete window.closeHowTo
      delete window.setRoundTimer
      delete window.hideRoundTimer
      delete window.setBanner
      delete window.setBattleFmt
      delete window.setBattleOpp
      delete window.setBattleArmyCount
      delete window.setBattleScoreDots
      delete window.setBattleSpeed
      delete window.setBenchState
    }
  }, [closeQuit, confirmQuit])

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

    // bot-ai.js exposes window.HFBot and must be present before battle.js's
    // _bootBattle fires (which is right after battle.js evaluates). Serialize
    // the order: simulate (module) → bot-ai → battle. socket.io and mobile.js
    // can load in parallel — battle.js doesn't touch them at top-level.
    //
    // setScriptsReady fires after battle.js's onload — by that point its
    // _bootBattle has run synchronously, so dispatched globals like
    // window.startBattle / window.toggleBattleSpeed / window.setMobileStep
    // are guaranteed to be registered.
    addScript('/shared/simulate.js', { type: 'module' })
      .then(() => addScript('/js/bot-ai.js'))
      .then(() => Promise.all([
        addScript('/socket.io/socket.io.js'),
        addScript('/js/battle.js'),
        addScript('/mobile.js'),
      ]))
      .then(() => setScriptsReady(true))

    return () => {
      links.forEach(el => el.remove())
      scripts.forEach(s => s.remove())
      // Restore #root styles on unmount
      if (root) root.style.cssText = ''
    }
  }, [navigate])

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
            <button className="htp-btn hback-btn" onClick={() => window.openQuitModal?.()} title="Back to Lobby">
              ← Lobby
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
              <div className="field pf" id="pfield"></div>
            </div>
            <div id="vs"><span className="vstxt">VS</span></div>
            <div className="fwrap">
              <div className="flbl" style={{ color: '#ff8888' }}>
                <span id="lbl-enemy">☠ Opponent</span>
              </div>
              <div className="field ef" id="efield"></div>
            </div>
          </div>
        </div>

        {/* ══ BOTTOM ZONE ══ */}
        <div id="bottom-zone">
          {/* LEFT: Barracks */}
          <div id="benchwrap" className={bench.count > 0 ? 'expanded' : ''}>
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
          <div id="shopwrap">
            <div className="sec-hdr">
              <span className="sec-title recruit-title">
                Recruitment <span className="sb sg" id="h-gold">💰 7</span>
              </span>
              <div className="recruit-controls">
                <button className="rrbtn" id="breroll" onClick={() => window.rerollShop?.()}>
                  New Recruitment (2💰)
                </button>
              </div>
            </div>
            <div id="shoprow"></div>
          </div>
        </div>
      </div>

      {/* ══ MOBILE LOG OVERLAY ══ */}
      <div id="mobile-log-overlay">
        <div className="mob-log-handle" onClick={() => window.togglePanel?.('log')}></div>
        <div className="mob-log-title">Battle Log</div>
        <div id="mobile-log-entries"></div>
      </div>

      {/* ══ MOBILE MENU PANEL ══ */}
      <div id="mobile-menu-overlay">
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
          Enter Fullscreen
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
        <button type="button" data-step="recruit" onClick={() => window.setMobileStep?.('recruit')}>
          🛍️<span>Recruit</span>
        </button>
        <button type="button" data-step="barracks" onClick={() => window.setMobileStep?.('barracks')}>
          🏕️<span>Barracks</span>
        </button>
        <div className="mab-center">
          <button id="mobile-battle-btn" type="button" onClick={() => window.startBattle?.()}>⚔️</button>
        </div>
        <button type="button" data-step="log" onClick={() => window.togglePanel?.('log')}>
          📜<span>Log</span>
        </button>
        <button type="button" data-step="menu" onClick={() => window.toggleMobileMenu?.()}>
          ⚙️<span>Menu</span>
        </button>
      </div>

      {/* ══ DUEL RESULT ══ */}
      <div id="duel-result">
        <div id="dr-box">
          <div className="dr-title" id="dr-title">🏆 DUEL WON!</div>
          <div className="dr-score" id="dr-score"></div>
          <div className="dr-battles" id="dr-battles"></div>
          <div className="dr-divider"></div>
          <div className="dr-stats-grid">
            <div className="dr-stat-row">
              <div className="dr-val p" id="drs-dmgP">0</div>
              <div className="dr-stat-lbl">⚔️ Total Damage</div>
              <div className="dr-val e" id="drs-dmgE">0</div>
            </div>
            <div className="dr-stat-row">
              <div className="dr-val p" id="drs-killsP">0</div>
              <div className="dr-stat-lbl">💀 Kills</div>
              <div className="dr-val e" id="drs-killsE">0</div>
            </div>
            <div className="dr-stat-row">
              <div className="dr-val p" id="drs-merges">0</div>
              <div className="dr-stat-lbl">✨ Merges</div>
              <div className="dr-val e" id="drs-mergesE">—</div>
            </div>
          </div>
          <div className="dr-divider"></div>
          <div className="dr-teams">
            <div className="dr-team">
              <div className="dr-team-lbl" style={{ color: 'rgba(136, 170, 255, 0.6)' }}>
                Your Final Army
              </div>
              <div className="dr-team-units" id="drt-p"></div>
            </div>
            <div className="dr-team">
              <div className="dr-team-lbl" style={{ color: 'rgba(255, 100, 100, 0.6)' }}>
                Enemy Army
              </div>
              <div className="dr-team-units" id="drt-e"></div>
            </div>
          </div>
          <div id="dr-submitting">
            <div className="dr-submit-row">
              <div className="dr-submit-spinner" id="dr-spin"></div>
              <div className="dr-submit-text" id="dr-submit-text">Submitting results...</div>
            </div>
            <div className="dr-submit-sub" id="dr-submit-sub">
              Processing match outcome on the blockchain...
            </div>
          </div>
          <div className="dr-cta">
            <button className="btn gnbtn" id="dr-next-btn">🌟 Next Duel</button>
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.6)' }}
              onClick={() => document.getElementById('duel-result')?.classList.remove('open')}
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
          <div className="htp-h1">📖 How To Play — Horizon Forge</div>
          <div className="htp-h2">🎯 Objective</div>
          <p className="htp-p">
            Win most battles in a duel to advance. In{' '}
            <span className="htp-hl">Best of 3</span>, win 2 battles. In{' '}
            <span className="htp-hl">Best of 5</span>, win 3. The opponent keeps the
            same army for the whole duel — analyze it before building yours.
          </p>
          <div className="htp-h2">💰 Gold</div>
          <div className="htp-tips">
            <div className="htp-tip">
              <span className="htp-tip-ico">🏁</span>
              <div>Each duel starts with <b style={{ color: '#ffdd55' }}>7💰</b>.</div>
            </div>
            <div className="htp-tip">
              <span className="htp-tip-ico">⚔️</span>
              <div>Between battles you receive gold automatically — both players receive the same amount each round.</div>
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
      <div id="fs-banner">
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
    </div>
  )
}
