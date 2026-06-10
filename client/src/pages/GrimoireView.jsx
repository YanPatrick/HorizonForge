import { useState, useEffect} from 'react'

const CHAPTERS = {
  0: 'Basics', 1: 'Formation', 2: 'Gold & Recruit',
  3: 'Battlefield', 4: 'Combos', 5: 'Fusion', 6: 'Strategies',
  7: <>{'Chests & Items '}<i>(Soon)</i></>
}

export default function GrimoireView() {
  const [activeChapter, setActiveChapter] = useState(0)
  const [topicsOpen, setTopicsOpen] = useState(false)

  useEffect(() => {
    const content = document.getElementById('gr-wiki-content');
    if (content) content.scrollTop = 0;
  }, [activeChapter]);

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
          {[[2,'💰 Gold & Recruit'],[4,'✨ Combos'],[5,'⭐ Fusion'],[7, <>🎁 Chests & Items <i>(Soon)</i></>]].map(([ch,label]) => (
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
              <div className="gr-arena-wrap">
                <div className="gr-arena">
                  <div>
                    <p style={{fontSize:'11px',color:'rgba(200,160,60,0.6)',textAlign:'center',marginBottom:'6px',fontFamily:'"Cinzel",serif',letterSpacing:'1px'}}>YOUR ARMY</p>
                    <div className="gr-arena-side">
                      <div className="gr-arena-cell back">A-Back</div>
                      <div className="gr-arena-cell mid">A-Mid</div>
                      <div className="gr-arena-cell front">A-Front</div>
                      <div className="gr-arena-cell back">B-Back</div>
                      <div className="gr-arena-cell mid">B-Mid</div>
                      <div className="gr-arena-cell front">B-Front</div>
                      <div className="gr-arena-cell back">C-Back</div>
                      <div className="gr-arena-cell mid">C-Mid</div>
                      <div className="gr-arena-cell front">C-Front</div>
                    </div>
                  </div>
                  <div className="gr-arena-vs">VS</div>
                  <div>
                    <p style={{fontSize:'11px',color:'rgba(200,160,60,0.6)',textAlign:'center',marginBottom:'6px',fontFamily:'"Cinzel",serif',letterSpacing:'1px'}}>OPPONENT</p>
                    <div className="gr-arena-side">
                      <div className="gr-arena-cell front">A-Front</div>
                      <div className="gr-arena-cell mid">A-Mid</div>
                      <div className="gr-arena-cell back">A-Back</div>
                      <div className="gr-arena-cell front">B-Front</div>
                      <div className="gr-arena-cell mid">B-Mid</div>
                      <div className="gr-arena-cell back">B-Back</div>
                      <div className="gr-arena-cell front">C-Front</div>
                      <div className="gr-arena-cell mid">C-Mid</div>
                      <div className="gr-arena-cell back">C-Back</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="gr-arena-legend">
                <span><span className="dot" style={{background:'#66ee88'}}></span>Front — absorbs damage</span>
                <span><span className="dot" style={{background:'#88aaff'}}></span>Mid — versatile</span>
                <span><span className="dot" style={{background:'#c88cff'}}></span>Back — protected</span>
              </div>
              <div className="gr-section-title">⚡ Attack Order (SPD)</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">📋</span><div>Before battle, the game builds an <span className="gr-hl">attack queue</span> with all living heroes from both sides, sorted by speed (<span className="gr-hl">SPD</span>) — fastest first.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>This queue runs in a <span className="gr-hl">continuous loop</span>: each hero attacks on their turn, and when the list ends it restarts from the top.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">💀</span><div>When a hero dies, the queue is <span className="gr-hl">rebuilt</span> on the next cycle with the survivors — the order can shift as the field empties.</div></div>
              </div>
              <div className="gr-section-title">🎯 Row Targeting</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">➡️</span><div><strong>Row priority:</strong> each hero attacks the frontmost enemy in the <span className="gr-hl">same row</span> they occupy.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">A</span><div><strong>Row A:</strong> if no enemy in row A, searches row B then row C.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">B</span><div><strong>Row B:</strong> if no enemy in row B, picks <span className="gr-hl">randomly</span> between row A and row C (50/50). If only one has enemies, attacks that one.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">C</span><div><strong>Row C:</strong> if no enemy in row C, searches row B then row A.</div></div>
              </div>
            </div>
          )}
          {activeChapter === 4 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">✨ Chapter 2 — Combos</div>
              <div className="gr-section-title">🤔 What is a Combo?</div>
              <p className="gr-p">When recruitment generates <span className="gr-hl">2 or 3 identical adjacent heroes</span> in the shop, they are highlighted with glowing borders. That's a Combo — a chance to recruit multiple heroes at once for a reduced special cost.</p>
              <div className="gr-section-title">✨ Combo 2</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">2️⃣</span><div>Two identical adjacent heroes in the shop. Special cost: <span className="gr-hl">2💰</span> for both at once (instead of 6💰 separately).</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">📦</span><div>Both go to the Barracks and stack — you're already 2/3 of the way to a merge!</div></div>
              </div>
              <div className="gr-section-title">✨✨ Combo 3</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">3️⃣</span><div>Three identical adjacent heroes in the shop. Special cost: <span className="gr-hl">2💰</span> for all three at once.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⭐</span><div>All 3 are recruited and the merge happens <strong>immediately</strong> — you walk away with a hero already evolved to <span className="gr-hl">★★</span> at no extra cost!</div></div>
              </div>
              <div className="gr-section-title">💡 Why It Matters</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">💰</span><div>Huge gold savings — 3 heroes for 2💰 vs 3×3💰 = 9💰 individually.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🚀</span><div>Speeds up hero evolution, letting you field stronger units earlier in the duel.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⚠️</span><div>Combos appear with limited probability each recruitment — always watch for the glowing borders!</div></div>
              </div>
            </div>
          )}
          {activeChapter === 5 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">⭐ Chapter 3 — Fusion &amp; Evolution</div>
              <div className="gr-section-title">🔄 How Fusion Works</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">📦</span><div>Stack <span className="gr-hl">3 copies</span> of the same hero (in Barracks or on the field) → automatic merge → hero levels up: <span className="gr-hl">★ → ★★</span>.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>The process repeats: if you have a <span className="gr-hl">★★</span> hero and combine it three more times, it levels up to <span className="gr-hl">★★★</span>. Do this until you reach the maximum level <span className="gr-hl">★★★★★</span>.</div></div>
              </div>
              <div className="gr-section-title">📈 Power Scaling</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">❤️</span><div><strong>Hit points (HP) and attack (ATK)</strong> increase with each new level the hero gains. A ★★★★★ hero has more than double the base hit points and attack.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">✨</span><div><strong>Skill Power</strong> also increases with each new level, but on a different scale, thus making the skills increasingly impactful.</div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🏆</span><div>A single <span className="gr-hl">★★★</span> hero is dramatically stronger than three separate <span className="gr-hl">★</span> heroes — focus on evolving rather than spreading resources.</div></div>
              </div>
            </div>
          )}
          {activeChapter === 6 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">💡 Chapter 4 — Strategy Tips</div>
              <div className="gr-section-title">🤖 Solo Mode (vs Bot)</div>
              <div className="gr-strategy-tip">👁️ <strong>Analyze the enemy army before placing your heroes.</strong> In Solo mode you can see the opponent's field — use it to counter their row positioning directly.</div>
              <div className="gr-strategy-tip">🛡️ <strong>Pay attention to the positioning.</strong> Always remember to place tank-type heroes at the front of the battlefield, so that heroes with less health are protected, increasing their chances of survival.</div>
              <div className="gr-strategy-tip">💚 <strong>Tank + Heal = classic sustain combo.</strong> A tank hero on the battlefield, accompanied by a healing hero, keeps your team standing much longer.</div>
              <div className="gr-strategy-tip">⭐ <strong>A Combo 3 early can decide the match.</strong> Fielding a ★★ hero in round one creates a power lead that is very hard to overcome.</div>
              <div className="gr-strategy-tip">🌟 <strong>Area attacks.</strong> Some heroes have attack modifiers, meaning their attack hits more than one target. Take advantage of this and try to build an explosive strategy.</div>
              <div className="gr-warning">⚠️ <strong>Note — PvP Mode:</strong> in battles against other players via blockchain, you will <strong>not see the opponent's field</strong> before the battle. This completely changes the dynamic — building a balanced and adaptable army will matter more than direct countering. Prepare for the challenge!</div>
            </div>
          )}
          {activeChapter === 7 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">📦 Chapter 7 — Chest & Items</div>
              
              <div className="gr-section-title">🎲 The Motor of Chaos</div>
              <p className="gr-p">
                Items in Horizon Forge are not static. Every item is unique, generated by our <span className="gr-hl">Motor of Chaos</span>. 
                The stats, requirements, and even the names are procedurally generated, meaning you might find a "God Roll" artifact that is the only one of its kind in the entire server.
              </p>

              <div className="gr-section-title">🏆 How to earn Chests</div>
              <div className="gr-tips">
                <div className="gr-tip">
                  <span className="gr-tip-ico">⚔️</span>
                  <div>
                    <strong>PVP Mode (Cumulative):</strong> The arena retains at least 10% fee from every HIVE wager. 
                    This fee fills your <span className="gr-hl">Chest Meter</span>. 
                    When you accumulate <strong>2.000 HIVE</strong> in fees <em>(the price of the Basic Chest)</em>, you automatically receive a <strong>Veteran Chest</strong>. 
                    <em> (A winning in a 10 HIVE match with Payout Preference set to Hive Liquid grants a chest instantly!)</em>
                  </div>
                </div>
                <div className="gr-tip">
                  <span className="gr-tip-ico">🍃</span>
                  <div>
                    <strong>Free Mode:</strong> Each victory in Free PvP has a <span className="gr-hl">1% flat chance</span> <em>(which can be increased with items)</em> to grant a Basic Chest. It's all a matter of luck! 
                  </div>
                </div>
              </div>

                 {/* ── Nova Seção: Drop Rates Adicionada Aqui ── */}
              <div className="gr-section-title">📊 Chest Rarities &amp; Drop Rates</div>
              <p className="gr-p">
                Whenever you obtain and open a Chest, the <span className="gr-hl">Motor of Chaos</span> determines the item's rarity based on the following probability distribution and visual indicators:
              </p>
              <div className="gr-tips">
                <div className="gr-tip">
                  <span className="gr-tip-ico">⚪</span>
                  <div>
                    <strong>Common — 40%:</strong> Grants 1 stat bonus and has no requirements to equip.
                  </div>
                </div>
                <div className="gr-tip">
                  <span className="gr-tip-ico" style={{ color: '#6acc6a' }}>🟢</span>
                  <div>
                    <strong style={{ color: '#6acc6a' }}>Uncommon — 30%:</strong> Grants 1 stat bonus and comes with 1 attribute requirement.
                  </div>
                </div>
                <div className="gr-tip">
                  <span className="gr-tip-ico" style={{ color: '#4488ff' }}>🔵</span>
                  <div>
                    <strong style={{ color: '#4488ff' }}>Rare — 20%:</strong> Grants 2 stat bonuses and comes with 1 attribute requirements.
                  </div>
                </div>
                <div className="gr-tip">
                  <span className="gr-tip-ico" style={{ color: '#aa44ff' }}>🟣</span>
                  <div>
                    <strong style={{ color: '#aa44ff' }}>Epic — 8%:</strong> Grants 2 stat bonuses and comes with 2 attribute requirements.
                  </div>
                </div>
                <div className="gr-tip">
                  <span className="gr-tip-ico" style={{ color: '#ff33aa' }}>💗</span>
                  <div>
                    <strong style={{ color: '#ff33aa' }}>Legendary — 2%:</strong> Grants 3 stat bonuses and comes with 2 attribute requirements.
                  </div>
                </div>
              </div>

              <div className="gr-section-title">📏 Requirements & Penalties</div>
              <p className="gr-p">
                Any hero can equip any item, but effectiveness depends on your <span className="gr-hl">Aptitude (TA)</span>.
              </p>
              <div className="gr-strategy-tip">
                💡 <strong>TA = Hero Attribute / Item Requirement.</strong><br/>
                If your Knight has 15 STR and the Axe requires 20, he only gets 75% of the bonus and suffers a <strong>Proportional Penalty</strong> to his Attack Speed, due to the weight of the Axe.
              </div>

              <div className="gr-section-title">✨ Seasonings & Customization</div>
              <p className="gr-p">
                Rare items can come with <span className="gr-hl">Seasonings</span> — special effects like healing adjacent allies or making enemies laugh. 
                Don't like the name the AI gave your item? You can pay a fee in Gold or HIVE <em>(if you don't want to spend your bright coins)</em> to <strong>Rename</strong> your legendary gear!
              </p>
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
            {[[2,'💰 Gold & Recruit'],[4,'✨ Combos'],[5,'⭐ Fusion'],[7, '🎁 Chests and Items']].map(([ch,label]) => (
              <button key={ch} className={`gr-tp-item${activeChapter === ch ? ' active' : ''}`} onClick={() => { setActiveChapter(ch); setTopicsOpen(false) }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
