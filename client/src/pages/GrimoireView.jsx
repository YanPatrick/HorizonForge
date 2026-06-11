import { useState, useEffect} from 'react'
import { useT } from '../context/LanguageContext'

export default function GrimoireView() {
  const { t, lang } = useT()
  const pt = lang === 'pt-BR'
  const [activeChapter, setActiveChapter] = useState(0)
  const [topicsOpen, setTopicsOpen] = useState(false)

  const CHAPTERS = {
    0: t('grimoire.basics').replace(/^📖 /, ''),
    1: t('grimoire.formation').replace(/^🛡️ /, ''),
    2: t('grimoire.goldRecruit').replace(/^💰 /, ''),
    3: t('grimoire.battlefield').replace(/^⚔️ /, ''),
    4: t('grimoire.combos').replace(/^✨ /, ''),
    5: t('grimoire.fusion').replace(/^⭐ /, ''),
    6: t('grimoire.strategies').replace(/^💡 /, ''),
    7: t('grimoire.chestsItems').replace(/^🎁 /, ''),
  }

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
          <div className="wiki-category">{t('grimoire.howToPlay')}</div>
          {[[0, t('grimoire.basics')],[1, t('grimoire.formation')],[3, t('grimoire.battlefield')],[6, t('grimoire.strategies')]].map(([ch,label]) => (
            <button key={ch} className={`wiki-item${activeChapter === ch ? ' active' : ''}`} onClick={() => setActiveChapter(ch)}>{label}</button>
          ))}
          <div className="wiki-category">{t('grimoire.mechanics')}</div>
          {[[2, t('grimoire.goldRecruit')],[4, t('grimoire.combos')],[5, t('grimoire.fusion')],[7, t('grimoire.chestsItems')]].map(([ch,label]) => (
            <button key={ch} className={`wiki-item${activeChapter === ch ? ' active' : ''}`} onClick={() => setActiveChapter(ch)}>{label}</button>
          ))}
        </aside>

        <div className="wiki-content" id="gr-wiki-content">
          {activeChapter === 0 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch0.title')}</div>
              <div className="gr-section-title">{t('grimoire.ch0.s1')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch0.p1') : <>Win the most <span className="gr-hl">rounds</span> in a <span className="gr-hl">duel</span> to be declared the winner. The format determines how many victories are needed:<br /><span className="gr-hl">&gt; BO3</span> (best of 3, need 2 wins)<br /><span className="gr-hl">&gt; BO5</span> (best of 5, need 3 wins)<br /><span className="gr-hl">&gt; BO7</span> (best of 7, need 4 wins).</>}
              </p>
              <div className="gr-section-title">{t('grimoire.ch0.s2')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🤖</span><div>
                  {pt ? t('grimoire.ch0.t1') : <>A duel is an <span className="gr-hl">automatic simulation</span>. Once heroes are placed, you control nothing — all strategy happens <em>before</em> combat begins.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">👁️</span><div>
                  {pt ? t('grimoire.ch0.t2') : 'Watch the fight unfold in real time through the battle log and field animations — learn from every outcome.'}
                </div></div>
              </div>
              <div className="gr-section-title">{t('grimoire.ch0.s3')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>
                  {pt ? t('grimoire.ch0.t3') : <>A duel consists of a series of rounds. Between each round, you return to the <span className="gr-hl">recruitment phase</span> to buy new heroes, fuse copies and reposition your army.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔒</span><div>
                  {pt ? t('grimoire.ch0.t4') : <>You may end up <span className="gr-hl">identifying your opponent's positioning pattern</span> through the matches. If this happens, adapt your strategies to counter it.</>}
                </div></div>
              </div>
            </div>
          )}
          {activeChapter === 1 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch1.title')}</div>
              <div className="gr-section-title">{t('grimoire.ch1.s1')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch1.p1') : <>A <span className="gr-hl">Formation</span> is your pre-built deck of exactly <span className="gr-hl">8 heroes</span> that you bring into every battle. You must configure and save at least one Formation before you can start any duel.</>}
              </p>
              <div className="gr-section-title">{t('grimoire.ch1.s2')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">1️⃣</span><div>
                  {pt ? t('grimoire.ch1.t1') : <>You have <span className="gr-hl">3 formation slots</span>, each can hold a completely different team composition.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⭐</span><div>
                  {pt ? t('grimoire.ch1.t2') : <>Click the <span className="gr-hl">star icon</span> on any deck card to mark it as your <span className="gr-hl">active deck</span>.</>}
                </div></div>
              </div>
              <div className="gr-section-title">{t('grimoire.ch1.s3')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch1.p2') : <>You <strong>cannot start a duel</strong> without a saved formation with 8 heroes. Make sure your active deck (the starred one) is fully configured.</>}
              </p>
            </div>
          )}
          {activeChapter === 2 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch2.title')}</div>
              <div className="gr-section-title">{t('grimoire.ch2.s1')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🏁</span><div>
                  {pt ? t('grimoire.ch2.t1') : <>Each duel starts with <span className="gr-hl">7💰</span>.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⏱️</span><div>
                  {pt ? t('grimoire.ch2.t2') : 'Gold is awarded automatically between battles. Both players receive the same amount each round.'}
                </div></div>
              </div>
              <div className="gr-section-title">{t('grimoire.ch2.s2')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">🆕</span><div>
                  {pt ? t('grimoire.ch2.t3') : <>Recruiting a new hero: <span className="gr-hl">3💰</span>.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔗</span><div>
                  {pt ? t('grimoire.ch2.t4') : <>Recruiting a duplicate: <span className="gr-hl">2💰</span>. Stacks on the same card.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔄</span><div>
                  {pt ? t('grimoire.ch2.t5') : <>New Recruitment (reroll): <span className="gr-hl">2💰</span>.</>}
                </div></div>
              </div>
            </div>
          )}
          {activeChapter === 3 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch3.title')}</div>
              <div className="gr-section-title">{t('grimoire.ch3.s1')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch3.p1') : <>Each side has a grid of <span className="gr-hl">3 rows × 3 columns</span>. Rows are A, B and C (top to bottom). Columns indicate depth: <span className="gr-hl" style={{color:'#66ee88'}}>Front</span>, <span className="gr-hl" style={{color:'#88aaff'}}>Mid</span>, and <span className="gr-hl" style={{color:'#c88cff'}}>Back</span>.</>}
              </p>
              <div className="gr-arena-wrap">
                <div className="gr-arena">
                  <div>
                    <p style={{fontSize:'11px',color:'rgba(200,160,60,0.6)',textAlign:'center',marginBottom:'6px',fontFamily:'"Cinzel",serif',letterSpacing:'1px'}}>{t('grimoire.ch3.yourArmy')}</p>
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
                    <p style={{fontSize:'11px',color:'rgba(200,160,60,0.6)',textAlign:'center',marginBottom:'6px',fontFamily:'"Cinzel",serif',letterSpacing:'1px'}}>{t('grimoire.ch3.opponent')}</p>
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
                <span><span className="dot" style={{background:'#66ee88'}}></span>{t('grimoire.ch3.legFront')}</span>
                <span><span className="dot" style={{background:'#88aaff'}}></span>{t('grimoire.ch3.legMid')}</span>
                <span><span className="dot" style={{background:'#c88cff'}}></span>{t('grimoire.ch3.legBack')}</span>
              </div>
              <div className="gr-section-title">{t('grimoire.ch3.s2')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">📋</span><div>
                  {pt ? t('grimoire.ch3.t1') : <>Before battle, the game builds an <span className="gr-hl">attack queue</span> with all living heroes from both sides, sorted by speed (<span className="gr-hl">SPD</span>) — fastest first.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>
                  {pt ? t('grimoire.ch3.t2') : <>This queue runs in a <span className="gr-hl">continuous loop</span>: each hero attacks on their turn, and when the list ends it restarts from the top.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">💀</span><div>
                  {pt ? t('grimoire.ch3.t3') : <>When a hero dies, the queue is <span className="gr-hl">rebuilt</span> on the next cycle with the survivors — the order can shift as the field empties.</>}
                </div></div>
              </div>
              <div className="gr-section-title">{t('grimoire.ch3.s3')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">➡️</span><div>
                  {pt ? t('grimoire.ch3.t4') : <><strong>Row priority:</strong> each hero attacks the frontmost enemy in the <span className="gr-hl">same row</span> they occupy.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">A</span><div>
                  {pt ? t('grimoire.ch3.t5') : <><strong>Row A:</strong> if no enemy in row A, searches row B then row C.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">B</span><div>
                  {pt ? t('grimoire.ch3.t6') : <><strong>Row B:</strong> if no enemy in row B, picks <span className="gr-hl">randomly</span> between row A and row C (50/50). If only one has enemies, attacks that one.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">C</span><div>
                  {pt ? t('grimoire.ch3.t7') : <><strong>Row C:</strong> if no enemy in row C, searches row B then row A.</>}
                </div></div>
              </div>
            </div>
          )}
          {activeChapter === 4 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch4.title')}</div>
              <div className="gr-section-title">{t('grimoire.ch4.s1')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch4.p1') : <>When recruitment generates <span className="gr-hl">2 or 3 identical adjacent heroes</span> in the shop, they are highlighted with glowing borders. That's a Combo — a chance to recruit multiple heroes at once for a reduced special cost.</>}
              </p>
              <div className="gr-section-title">{t('grimoire.ch4.s2')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">2️⃣</span><div>
                  {pt ? t('grimoire.ch4.t1') : <>Two identical adjacent heroes in the shop. Special cost: <span className="gr-hl">2💰</span> for both at once (instead of 6💰 separately).</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">📦</span><div>
                  {pt ? t('grimoire.ch4.t2') : <>Both go to the Barracks and stack — you're already 2/3 of the way to a merge!</>}
                </div></div>
              </div>
              <div className="gr-section-title">{t('grimoire.ch4.s3')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">3️⃣</span><div>
                  {pt ? t('grimoire.ch4.t3') : <>Three identical adjacent heroes in the shop. Special cost: <span className="gr-hl">2💰</span> for all three at once.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⭐</span><div>
                  {pt ? t('grimoire.ch4.t4') : <>All 3 are recruited and the merge happens <strong>immediately</strong> — you walk away with a hero already evolved to <span className="gr-hl">★★</span> at no extra cost!</>}
                </div></div>
              </div>
              <div className="gr-section-title">{t('grimoire.ch4.s4')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">💰</span><div>
                  {pt ? t('grimoire.ch4.t5') : 'Huge gold savings — 3 heroes for 2💰 vs 3×3💰 = 9💰 individually.'}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🚀</span><div>
                  {pt ? t('grimoire.ch4.t6') : 'Speeds up hero evolution, letting you field stronger units earlier in the duel.'}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">⚠️</span><div>
                  {pt ? t('grimoire.ch4.t7') : 'Combos appear with limited probability each recruitment — always watch for the glowing borders!'}
                </div></div>
              </div>
            </div>
          )}
          {activeChapter === 5 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch5.title')}</div>
              <div className="gr-section-title">{t('grimoire.ch5.s1')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">📦</span><div>
                  {pt ? t('grimoire.ch5.t1') : <>Stack <span className="gr-hl">3 copies</span> of the same hero (in Barracks or on the field) → automatic merge → hero levels up: <span className="gr-hl">★ → ★★</span>.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🔁</span><div>
                  {pt ? t('grimoire.ch5.t2') : <>The process repeats: if you have a <span className="gr-hl">★★</span> hero and combine it three more times, it levels up to <span className="gr-hl">★★★</span>. Do this until you reach the maximum level <span className="gr-hl">★★★★★</span>.</>}
                </div></div>
              </div>
              <div className="gr-section-title">{t('grimoire.ch5.s2')}</div>
              <div className="gr-tips">
                <div className="gr-tip"><span className="gr-tip-ico">❤️</span><div>
                  {pt ? t('grimoire.ch5.t3') : <><strong>Hit points (HP) and attack (ATK)</strong> increase with each new level the hero gains. A ★★★★★ hero has more than double the base hit points and attack.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">✨</span><div>
                  {pt ? t('grimoire.ch5.t4') : <><strong>Skill Power</strong> also increases with each new level, but on a different scale, thus making the skills increasingly impactful.</>}
                </div></div>
                <div className="gr-tip"><span className="gr-tip-ico">🏆</span><div>
                  {pt ? t('grimoire.ch5.t5') : <>A single <span className="gr-hl">★★★</span> hero is dramatically stronger than three separate <span className="gr-hl">★</span> heroes — focus on evolving rather than spreading resources.</>}
                </div></div>
              </div>
            </div>
          )}
          {activeChapter === 6 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch6.title')}</div>
              <div className="gr-section-title">{t('grimoire.ch6.s1')}</div>
              <div className="gr-strategy-tip">
                {pt ? `👁️ ${t('grimoire.ch6.st1')}` : <>👁️ <strong>Analyze the enemy army before placing your heroes.</strong> In Solo mode you can see the opponent's field — use it to counter their row positioning directly.</>}
              </div>
              <div className="gr-strategy-tip">
                {pt ? `🛡️ ${t('grimoire.ch6.st2')}` : <>🛡️ <strong>Pay attention to the positioning.</strong> Always remember to place tank-type heroes at the front of the battlefield, so that heroes with less health are protected, increasing their chances of survival.</>}
              </div>
              <div className="gr-strategy-tip">
                {pt ? `💚 ${t('grimoire.ch6.st3')}` : <>💚 <strong>Tank + Heal = classic sustain combo.</strong> A tank hero on the battlefield, accompanied by a healing hero, keeps your team standing much longer.</>}
              </div>
              <div className="gr-strategy-tip">
                {pt ? `⭐ ${t('grimoire.ch6.st4')}` : <>⭐ <strong>A Combo 3 early can decide the match.</strong> Fielding a ★★ hero in round one creates a power lead that is very hard to overcome.</>}
              </div>
              <div className="gr-strategy-tip">
                {pt ? `🌟 ${t('grimoire.ch6.st5')}` : <>🌟 <strong>Area attacks.</strong> Some heroes have attack modifiers, meaning their attack hits more than one target. Take advantage of this and try to build an explosive strategy.</>}
              </div>
              <div className="gr-warning">
                {pt ? `⚠️ ${t('grimoire.ch6.warn')}` : <>⚠️ <strong>Note — PvP Mode:</strong> in battles against other players via blockchain, you will <strong>not see the opponent's field</strong> before the battle. This completely changes the dynamic — building a balanced and adaptable army will matter more than direct countering. Prepare for the challenge!</>}
              </div>
            </div>
          )}
          {activeChapter === 7 && (
            <div className="gr-chapter active">
              <div className="gr-ch-title">{t('grimoire.ch7.title')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch7.p1') : 'There are two types of chests in Horizon Forge. Each one has a distinct personality — one rewards the disciplined veteran, the other tempts fate itself.'}
              </p>

              <div className="gr-section-title">{t('grimoire.ch7.s1')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch7.vp1') : <>The <span className="gr-hl">Veteran Chest</span> is the reward of a seasoned warrior. Items generated here have <strong>curated, balanced stats</strong> with predictable requirements. No chaos, no curses — what you see is what you get.</>}
              </p>
              <div className="gr-tips">
                <div className="gr-tip">
                  <span className="gr-tip-ico">⚔️</span>
                  <div>
                    {pt ? t('grimoire.ch7.vt1') : <><strong>How to obtain:</strong> In PVP Mode, the arena retains a 10% fee from every HIVE wager. This fills your <span className="gr-hl">Chest Meter</span>. Accumulate <strong>2 HIVE</strong> in fees and a Veteran Chest is yours automatically. <em>(Win a 10 HIVE match with Payout set to Hive Liquid and you get one instantly!)</em></>}
                  </div>
                </div>
                <div className="gr-tip">
                  <span className="gr-tip-ico">🛒</span>
                  <div>
                    {pt ? t('grimoire.ch7.vt2') : <><strong>Shop:</strong> Available for direct purchase in the Treasures section.</>}
                  </div>
                </div>
              </div>

              <p className="gr-p" style={{ marginTop: '0.8rem' }}>
                {pt ? t('grimoire.ch7.vp2') : 'The rarity of the item inside is drawn at random, with known odds:'}
              </p>
              <div className="gr-tips">
                <div className="gr-tip"><div><strong>{t('rarity.common').toUpperCase()} — 40%:</strong> {t('grimoire.ch7.vc')}</div></div>
                <div className="gr-tip"><div><strong style={{ color: '#6acc6a' }}>{t('rarity.uncommon').toUpperCase()} — 30%:</strong> {t('grimoire.ch7.vuc')}</div></div>
                <div className="gr-tip"><div><strong style={{ color: '#4488ff' }}>{t('rarity.rare').toUpperCase()} — 20%:</strong> {t('grimoire.ch7.vr')}</div></div>
                <div className="gr-tip"><div><strong style={{ color: '#aa44ff' }}>{t('rarity.epic').toUpperCase()} — 8%:</strong> {t('grimoire.ch7.ve')}</div></div>
                <div className="gr-tip"><div><strong style={{ color: '#ff33aa' }}>{t('rarity.legendary').toUpperCase()} — 2%:</strong> {t('grimoire.ch7.vl')}</div></div>
              </div>

              <div className="gr-section-title" style={{ marginTop: '1.4rem' }}>{t('grimoire.ch7.s2')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch7.cp1') : <>The <span className="gr-hl">Chaos Chest</span> is a gamble with the universe. Powered by the <strong>Motor of Chaos</strong>, every item rolled here is unique — procedurally generated with stats, attribute requirements, and sometimes a fate-sealed inscription. The odds? That's between you and the dice.</>}
              </p>
              <div className="gr-tips">
                <div className="gr-tip">
                  <span className="gr-tip-ico">🛒</span>
                  <div>
                    {pt ? t('grimoire.ch7.ct1') : <><strong>How to obtain:</strong> Available for purchase in the Treasures section of the Shop.</>}
                  </div>
                </div>
                <div className="gr-tip">
                  <span className="gr-tip-ico">🎯</span>
                  <div>
                    {pt ? t('grimoire.ch7.ct2') : <><strong>Attribute Requirement:</strong> Chaos items demand a hero attribute to unlock their full potential. Equip a weapon that requires 20 STR with a hero who has only 10, and you'll only harness <strong>50%</strong> of its power. This is your <span className="gr-hl">Aptitude (TA)</span>.</>}
                  </div>
                </div>
              </div>

              <div className="gr-strategy-tip" style={{ marginTop: '0.8rem' }}>
                {pt
                  ? <>🎲 <strong>{pt ? 'A Jogada do D20' : 'The D20 Roll'}</strong><br/>{t('grimoire.ch7.d20')}</>
                  : <>🎲 <strong>The D20 Roll</strong><br/>When the Motor of Chaos forges your item, it rolls a D20. Higher rolls push stats toward their ceiling. A <strong>natural 20</strong> — a Critical Hit — means a god roll, the best this rarity can offer. A <strong>natural 1</strong> — a Critical Fail — and the artifact emerges cursed: stats twisted, possibly negative, and branded with a <em>flavor inscription</em> only the unlucky few will ever read.</>}
              </div>

              <div className="gr-section-title">{t('grimoire.ch7.s3')}</div>
              <p className="gr-p">
                {pt ? t('grimoire.ch7.ap1') : <>Any hero can equip any Chaos item, but their <span className="gr-hl">Aptitude (TA)</span> determines how much of the power they actually wield.</>}
              </p>
              <div className="gr-strategy-tip">
                {pt
                  ? <>💡 {t('grimoire.ch7.at1')}</>
                  : <>💡 <strong>TA = Hero Attribute ÷ Item Requirement.</strong><br/>If your Knight has 15 STR and the Axe requires 20, he wields only <strong>75%</strong> of its bonuses. Meet or exceed the requirement and you get 100% — no cap.</>}
              </div>
            </div>
          )}
          </div>
      </div>
      {topicsOpen && (
        <div className="gr-topics-overlay open" onClick={() => setTopicsOpen(false)}>
          <div className="gr-topics-panel" onClick={e => e.stopPropagation()}>
            <div className="gr-tp-header">
              <span className="gr-tp-title">{t('grimoire.title')}</span>
              <button className="gr-tp-close" onClick={() => setTopicsOpen(false)}>✕</button>
            </div>
            <div className="gr-tp-group">{t('grimoire.howToPlay')}</div>
            {[[0, t('grimoire.basics')],[1, t('grimoire.formation')],[3, t('grimoire.battlefield')],[6, t('grimoire.strategies')]].map(([ch,label]) => (
              <button key={ch} className={`gr-tp-item${activeChapter === ch ? ' active' : ''}`} onClick={() => { setActiveChapter(ch); setTopicsOpen(false) }}>{label}</button>
            ))}
            <div className="gr-tp-group">{t('grimoire.mechanics')}</div>
            {[[2, t('grimoire.goldRecruit')],[4, t('grimoire.combos')],[5, t('grimoire.fusion')],[7, t('grimoire.chestsItems')]].map(([ch,label]) => (
              <button key={ch} className={`gr-tp-item${activeChapter === ch ? ' active' : ''}`} onClick={() => { setActiveChapter(ch); setTopicsOpen(false) }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
