import { useState } from 'react'

const CHAPTERS = {
  0: 'Basics', 1: 'Formation', 2: 'Gold & Recruit',
  3: 'Battlefield', 4: 'Combos', 5: 'Fusion', 6: 'Strategies',
}

export default function GrimoireView() {
  const [activeChapter, setActiveChapter] = useState(0)
  const [topicsOpen, setTopicsOpen] = useState(false)

  return (
    <div id="view-grimoire" className="lv active">
      <div className="gr-mobile-bar">
        <button className="gr-topics-btn" onClick={() => setTopicsOpen(true)}>
          <span className="gr-topics-btn-left">
            <span>📖</span>
            <span className="gr-topics-btn-label">{CHAPTERS[activeChapter]}</span>
          </span>
          <span className="gr-topics-chevron">▾</span>
        </button>
      </div>

      <div className="wiki-layout">
        <aside className="wiki-sidebar">
          <div className="wiki-category">How to Play</div>
          {[[0,'📖 Basics'],[1,'🛡️ Formation'],[3,'⚔️ Battlefield'],[6,'💡 Strategies']].map(([ch,label]) => (
            <button key={ch} className={`wiki-item${activeChapter === ch ? ' active' : ''}`} onClick={() => setActiveChapter(ch)}>{label}</button>
          ))}
          <div className="wiki-category">Mechanics</div>
          {[[2,'💰 Gold & Recruit'],[4,'✨ Combos'],[5,'⭐ Fusion']].map(([ch,label]) => (
            <button key={ch} className={`wiki-item${activeChapter === ch ? ' active' : ''}`} onClick={() => setActiveChapter(ch)}>{label}</button>
          ))}
        </aside>

        <div className="wiki-content" id="gr-wiki-content">
          {activeChapter === 0 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">📖 Chapter 1 — The Basics</div>
              <div className="gr-section-title">🎯 Objective</div>
              <p className="gr-p">Win the most <span className="gr-hl">rounds</span> in a <span className="gr-hl">duel</span> to be declared the winner. The format determines how many victories are needed:<br /><span className="gr-hl">&gt; BO3</span> (best of 3, need 2 wins)<br /><span className="gr-hl">&gt; BO5</span> (best of 5, need 3 wins)<br /><span className="gr-hl">&gt; BO7</span> (best of 7, need 4 wins).</p>
              <div className="gr-section-title">⚔️ What is a Duel?</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🤖</span><div>A duel is an <span className="gr-hl">automatic simulation</span>. Once heroes are placed, you control nothing — all strategy happens <em>before</em> combat begins.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">👁️</span><div>Watch the fight unfold in real time through the battle log and field animations — learn from every outcome.</div></div>
              </div>
              <div className="gr-section-title">🏆 What is a Round?</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>A duel consists of a series of rounds. Between each round, you return to the <span className="gr-hl">recruitment phase</span> to buy new heroes, fuse copies and reposition your army.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔒</span><div>You may end up <span className="gr-hl">identifying your opponent's positioning pattern</span> through the matches. If this happens, adapt your strategies to counter it.</div></div>
              </div>
            </div>
          )}
          {activeChapter === 1 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">🛡️ Chapter 2 — Formation</div>
              <div className="gr-section-title">📋 What is a Formation?</div>
              <p className="gr-p">A <span className="gr-hl">Formation</span> is your pre-built deck of exactly <span className="gr-hl">8 heroes</span> that you bring into every battle. You must configure and save at least one Formation before you can start any duel.</p>
              <div className="gr-section-title">🗂️ The Three Deck Slots</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">1️⃣</span><div>You have <span className="gr-hl">3 formation slots</span>, each can hold a completely different team composition.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⭐</span><div>Click the <span className="gr-hl">star icon</span> on any deck card to mark it as your <span className="gr-hl">active deck</span>.</div></div>
              </div>
              <div className="gr-section-title">⚠️ Before You Battle</div>
              <p className="gr-p">You <strong>cannot start a duel</strong> without a saved formation with 8 heroes. Make sure your active deck (the starred one) is fully configured.</p>
            </div>
          )}
          {activeChapter === 2 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">💰 Chapter 1 — Gold &amp; Recruitment</div>
              <div className="gr-section-title">💸 Earning Gold</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🏁</span><div>Each duel starts with <span className="gr-hl">7💰</span>.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⏱️</span><div>Gold is awarded automatically between battles. Both players receive the same amount each round.</div></div>
              </div>
              <div className="gr-section-title">🛒 Recruitment Actions</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🆕</span><div>Recruiting a new hero: <span className="gr-hl">3💰</span>.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔗</span><div>Recruiting a duplicate: <span className="gr-hl">2💰</span>. Stacks on the same card.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔄</span><div>New Recruitment (reroll): <span className="gr-hl">2💰</span>.</div></div>
              </div>
            </div>
          )}
          {activeChapter === 3 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">⚔️ Chapter 3 — The Battlefield</div>
              <div className="gr-section-title">🗺️ The 3×3 Arena</div>
              <p className="gr-p">Each side has a grid of <span className="gr-hl">3 rows × 3 columns</span>. Rows are A, B and C (top to bottom). Columns indicate depth: <span className="gr-hl" style={{color:'#66ee88'}}>Front</span>, <span className="gr-hl" style={{color:'#88aaff'}}>Mid</span>, and <span className="gr-hl" style={{color:'#c88cff'}}>Back</span>.</p>
              <div className="gr-section-title">⚡ Attack Order (SPD)</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">📋</span><div>Before battle, the game builds an <span className="gr-hl">attack queue</span> sorted by speed — fastest first.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>This queue runs in a <span className="gr-hl">continuous loop</span>.</div></div>
              </div>
              <div className="gr-section-title">🎯 Row Targeting</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">➡️</span><div><strong>Row priority:</strong> each hero attacks the frontmost enemy in the <span className="gr-hl">same row</span>.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">B</span><div><strong>Row B:</strong> if no enemy in row B, picks <span className="gr-hl">randomly</span> between row A and row C.</div></div>
              </div>
            </div>
          )}
          {activeChapter === 4 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">✨ Chapter 2 — Combos</div>
              <div className="gr-section-title">🤔 What is a Combo?</div>
              <p className="gr-p">When recruitment generates <span className="gr-hl">2 or 3 identical adjacent heroes</span> in the shop, they are highlighted with glowing borders.</p>
              <div className="gr-section-title">✨ Combo 2</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">2️⃣</span><div>Two identical adjacent heroes. Special cost: <span className="gr-hl">2💰</span> for both at once.</div></div>
              </div>
              <div className="gr-section-title">✨✨ Combo 3</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">3️⃣</span><div>Three identical adjacent heroes. Cost: <span className="gr-hl">2💰</span> for all three, merge happens <strong>immediately</strong>.</div></div>
              </div>
            </div>
          )}
          {activeChapter === 5 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">⭐ Chapter 3 — Fusion &amp; Evolution</div>
              <div className="gr-section-title">🔄 How Fusion Works</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">📦</span><div>Stack <span className="gr-hl">3 copies</span> of the same hero → automatic merge → <span className="gr-hl">★ → ★★</span>.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>Repeat up to <span className="gr-hl">★★★★★</span>.</div></div>
              </div>
              <div className="gr-section-title">📈 Power Scaling</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">❤️</span><div>HP and ATK increase each level. A ★★★★★ hero has more than double the base stats.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🏆</span><div>A single <span className="gr-hl">★★★</span> hero is dramatically stronger than three separate <span className="gr-hl">★</span> heroes.</div></div>
              </div>
            </div>
          )}
          {activeChapter === 6 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">💡 Chapter 4 — Strategy Tips</div>
              <div className="gr-section-title">🤖 Solo Mode (vs Bot)</div>
              <div className="gr-strategy-tip">👁️ <strong>Analyze the enemy army before placing your heroes.</strong> In Solo mode you can see the opponent's field.</div>
              <div className="gr-strategy-tip">🛡️ <strong>Pay attention to the positioning.</strong> Always place tank-type heroes at the front.</div>
              <div className="gr-strategy-tip">💚 <strong>Tank + Heal = classic sustain combo.</strong></div>
              <div className="gr-strategy-tip">⭐ <strong>A Combo 3 early can decide the match.</strong> Fielding a ★★ hero in round one creates a power lead.</div>
              <div className="gr-warning">⚠️ <strong>Note — PvP Mode:</strong> in battles against other players you will <strong>not see the opponent's field</strong> before the battle.</div>
            </div>
          )}
        </div>
      </div>

      {topicsOpen && (
        <div className="gr-topics-overlay open" onClick={() => setTopicsOpen(false)}>
          <div className="gr-topics-panel" onClick={e => e.stopPropagation()}>
            <div className="gr-tp-header">
              <span className="gr-tp-title">📖 GRIMOIRE</span>
              <button className="gr-tp-close" onClick={() => setTopicsOpen(false)}>✕</button>
            </div>
            <div className="gr-tp-group">How to Play</div>
            {[[0,'📖 Basics'],[1,'🛡️ Formation'],[3,'⚔️ Battlefield'],[6,'💡 Strategies']].map(([ch,label]) => (
              <button key={ch} className={`gr-tp-item${activeChapter === ch ? ' active' : ''}`} onClick={() => { setActiveChapter(ch); setTopicsOpen(false) }}>{label}</button>
            ))}
            <div className="gr-tp-group">Mechanics</div>
            {[[2,'💰 Gold & Recruit'],[4,'✨ Combos'],[5,'⭐ Fusion']].map(([ch,label]) => (
              <button key={ch} className={`gr-tp-item${activeChapter === ch ? ' active' : ''}`} onClick={() => { setActiveChapter(ch); setTopicsOpen(false) }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
