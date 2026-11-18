import { useState } from 'react'
import { CHECK, LESSONS, LEVELS, levelById } from '../content'
import { useGame } from '../session/store'

export function Menu() {
  const g = useGame()
  const done = (i: number) => !!g.stars[LEVELS[i].id]?.ship
  const allDone = LEVELS.every((_, i) => done(i))
  return (
    <div className="menu">
      <section className="panel hero">
        <h1>Severity 1</h1>
        <p className="big">Build Friendbook from a dorm-room site to a global network. Learn a concept, build with it, then watch real traffic stress it.</p>
        <p className="muted small">Progress is not saved. Each visit starts fresh.</p>
        {g.check.before === undefined && <button className="btn" onClick={() => g.go({ name: 'check', phase: 'before' })}>Take the 1-minute "explain this architecture" check</button>}
        {g.check.before !== undefined && <p className="muted small">Starting check: {g.check.before}/100{g.check.after !== undefined ? ` → now ${g.check.after}/100 (${g.check.after - g.check.before >= 0 ? '+' : ''}${g.check.after - g.check.before})` : ''}</p>}
      </section>

      <section aria-label="Chapters" className="chapters">
        {LEVELS.map((l, i) => {
          const unlocked = i === 0 || done(i - 1)
          const s = g.stars[l.id]
          const lessonsDone = l.lessons.every((x) => g.lessonsDone.includes(x))
          const nextLesson = l.lessons.find((x) => !g.lessonsDone.includes(x))
          return (
            <article key={l.id} className={`panel chapter${unlocked ? '' : ' locked'}`}>
              <div>
                <span className="muted small">Chapter {l.chapter}</span>
                <h3>{l.title}</h3>
                <p className="muted small">{l.story}</p>
                <p className="small">Lessons: {l.lessons.map((x) => LESSONS.find((y) => y.id === x)!.title).join(' · ')}</p>
              </div>
              <div className="col">
                <span className="stars" aria-label={s ? 'Stars earned' : 'No stars yet'}>
                  <span className={s?.ship ? 'on' : ''}>★</span><span className={s?.thrifty ? 'on' : ''}>★</span><span className={s?.senior ? 'on' : ''}>★</span>
                </span>
                {!unlocked && <span className="muted small">🔒 Finish the previous chapter</span>}
                {unlocked && !lessonsDone && <button className="btn primary" onClick={() => g.go({ name: 'lesson', id: nextLesson! })}>Start lesson</button>}
                {unlocked && lessonsDone && <button className="btn primary" onClick={() => g.enterLevel(l.id)}>{s ? 'Replay level' : 'Play level'}</button>}
                {unlocked && lessonsDone && <button className="btn quiet small" onClick={() => g.go({ name: 'lesson', id: l.lessons[0] })}>Replay lesson</button>}
              </div>
            </article>
          )
        })}
        <article className="panel chapter locked"><div><h3>Chapters 3–9 and the boss level</h3><p className="muted small">Caching, CDNs, queues, search, sharding, rate limits and Chaos Monkey come after the vertical slice.</p></div></article>
      </section>

      {allDone && g.check.after === undefined && (
        <section className="panel"><p>You finished the slice! Retake the check to see what you learned.</p><button className="btn primary" onClick={() => g.go({ name: 'check', phase: 'after' })}>Take the check again</button></section>
      )}
      <Codex />
    </div>
  )
}

function Codex() {
  const g = useGame()
  const [q, setQ] = useState('')
  const cards = LESSONS.filter((l) => g.lessonsDone.includes(l.id) && (l.title + l.codex.analogy + l.codex.note).toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="panel" aria-label="Codex">
      <div className="row between"><h3>Codex</h3>
        <label className="small">Search <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="cache, latency…" /></label></div>
      {g.lessonsDone.length === 0 && <p className="muted small">Finish a lesson to collect its concept card.</p>}
      <div className="cards">{cards.map((l) => <div key={l.id} className="card"><strong>{l.title}</strong><p>{l.codex.analogy}</p><p className="muted small">{l.codex.note}</p></div>)}</div>
    </section>
  )
}

export function Check({ phase }: { phase: 'before' | 'after' }) {
  const g = useGame()
  const [ans, setAns] = useState<number[]>([])
  const qn = ans.length
  const finish = (a: number[]) => {
    const score = a.reduce((s, x, i) => s + (x === CHECK[i].answer ? 100 / CHECK.length : 0), 0)
    g.setCheck(phase, score)
    g.go({ name: 'menu' })
  }
  const q = CHECK[qn]
  return (
    <div className="panel check">
      <h2>{phase === 'before' ? 'Before we start' : 'Now, again'}: explain this architecture</h2>
      <p className="muted">Question {qn + 1} of {CHECK.length}. No pressure; this only measures how much you learn.</p>
      <h3>{q.q}</h3>
      <div className="options">{q.options.map((o, i) => <button key={o} className="btn" onClick={() => (qn + 1 === CHECK.length ? finish([...ans, i]) : setAns([...ans, i]))}>{o}</button>)}</div>
      <button className="btn quiet" onClick={() => g.go({ name: 'menu' })}>Skip</button>
    </div>
  )
}

export function Debrief({ id }: { id: string }) {
  const g = useGame()
  const level = levelById(id)
  const design = g.designs[id]
  const s = g.stars[id]
  const ref = level.reference
  const mine = new Set(design.nodes.map((n) => n.id))
  const refIds = new Set(ref.nodes.map((n) => n.id))
  const next = LEVELS[level.chapter + 1]
  const card = LESSONS.find((l) => l.id === level.codex)
  return (
    <div className="panel debrief">
      <h2>Debrief: {level.title}</h2>
      <div className="stars big" aria-label="Stars earned"><span className={s?.ship ? 'on' : ''}>★ Ship it</span><span className={s?.thrifty ? 'on' : ''}>★ Thrifty</span><span className={s?.senior ? 'on' : ''}>★ Senior engineer</span></div>
      {s?.fromReference && <p className="muted small">Earned from a reference start.</p>}
      <h3>Timeline</h3>
      {g.timeline.length === 0 ? <p className="muted small">No incidents fired this run.</p> : (
        <ul className="incidents">{g.timeline.map((t, i) => <li key={i} className={t.resolved ? 'ok' : `sev${t.severity}`}><span className="mono small">t{t.tick}</span> {t.resolved ? 'Resolved: ' : ''}{t.text}</li>)}</ul>
      )}
      <h3>Your design vs. the reference</h3>
      <table className="compare">
        <thead><tr><th>Component</th><th>Yours</th><th>Reference</th><th>Why</th></tr></thead>
        <tbody>
          {[...new Set([...design.nodes.map((n) => n.id), ...ref.nodes.map((n) => n.id)])].map((nid) => {
            const a = design.nodes.find((n) => n.id === nid), b = ref.nodes.find((n) => n.id === nid)
            const diff = !mine.has(nid) || !refIds.has(nid) || a?.instances !== b?.instances
            return (
              <tr key={nid} className={diff ? 'diff' : ''}>
                <td>{nid}</td><td>{a ? `×${a.instances}` : '—'}</td><td>{b ? `×${b.instances}` : '—'}</td>
                <td className="small">{diff ? '≠ ' : ''}{level.debrief.diffs[nid] ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <h3>How large social networks do it</h3>
      <p>{level.debrief.note}</p>
      {card && <div className="card"><strong>Codex card earned: {card.title}</strong><p className="muted small">{card.codex.analogy}</p></div>}
      <div className="row">
        <button className="btn" onClick={() => g.go({ name: 'level', id })}>Back to the level</button>
        <button className="btn primary" onClick={() => g.go({ name: 'menu' })}>{next && next.chapter <= 2 ? 'Next chapter' : 'Back to chapters'}</button>
      </div>
    </div>
  )
}
