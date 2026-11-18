import { useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { CHECK, GLOSSARY_EXTRA, LESSONS, LEVELS, levelById } from '../content'
import { runAll } from '../engine/sim'
import type { Design, Snapshot } from '../schema'
import { useGame } from '../session/store'
import { Icon } from './Icon'

export function Menu() {
  const g = useGame()
  const done = (i: number) => !!g.stars[LEVELS[i].id]?.ship
  const allDone = LEVELS.every((_, i) => done(i))
  const started = g.lessonsDone.length > 0
  const start = () => {
    const i = LEVELS.findIndex((l) => !g.stars[l.id]?.ship)
    const l = LEVELS[i < 0 ? 0 : i]
    const lesson = l.lessons.find((x) => !g.lessonsDone.includes(x))
    if (lesson) g.go({ name: 'lesson', id: lesson }); else g.enterLevel(l.id)
  }
  return (
    <div className="menu">
      <section className="hero">
        <h1>See how systems<br />really work.</h1>
        <p className="lede">Build Friendbook from a dorm-room site into a global network. Learn a concept, build with it, then watch real traffic push it until it breaks.</p>
        <div className="row center">
          <button className="btn primary large" onClick={start}>{started ? 'Continue' : 'Start learning'}</button>
          {g.check.before === undefined && <button className="btn quiet large" onClick={() => g.go({ name: 'check', phase: 'before' })}>Take the 1-minute check <Icon name="next" size={16} /></button>}
        </div>
        {g.check.before !== undefined && <p className="muted small">Starting check: {g.check.before}/100{g.check.after !== undefined ? `, now ${g.check.after}/100 (${g.check.after - g.check.before >= 0 ? '+' : ''}${Math.round(g.check.after - g.check.before)})` : ''}</p>}
        <p className="muted small">Progress is not saved. Each visit starts fresh.</p>
      </section>

      <h2 className="section-title">Build Friendbook</h2>
      <section aria-label="Chapters" className="chapters">
        {LEVELS.map((l, i) => {
          const unlocked = i === 0 || done(i - 1)
          const s = g.stars[l.id]
          const lessonsDone = l.lessons.every((x) => g.lessonsDone.includes(x))
          const nextLesson = l.lessons.find((x) => !g.lessonsDone.includes(x))
          return (
            <article key={l.id} className={`panel chapter${unlocked ? '' : ' locked'}`}>
              <div>
                <h3>{l.chapter === 0 ? l.title : l.id === 'boss' ? `Finale. ${l.title}` : `${l.chapter}. ${l.title}`}</h3>
                <p className="muted small">{l.story}</p>
                {l.lessons.length > 0 && <p className="small">Lessons: {l.lessons.map((x) => LESSONS.find((y) => y.id === x)!.title).join(' · ')}</p>}
              </div>
              <div className="col">
                <span className="stars" aria-label={s ? 'Stars earned' : 'No stars yet'}>
                  <span className={s?.ship ? 'on' : ''}><Icon name="star" filled={s?.ship} size={22} /></span><span className={s?.thrifty ? 'on' : ''}><Icon name="star" filled={s?.thrifty} size={22} /></span><span className={s?.senior ? 'on' : ''}><Icon name="star" filled={s?.senior} size={22} /></span>
                </span>
                {s?.fromReference && <span className="muted small">from a reference start</span>}
                {!unlocked && <span className="muted small"><Icon name="lock" size={16} /> Finish the previous chapter</span>}
                {unlocked && !lessonsDone && <button className="btn primary" onClick={() => g.go({ name: 'lesson', id: nextLesson! })}>Start lesson</button>}
                {unlocked && lessonsDone && <button className="btn primary" onClick={() => g.enterLevel(l.id)}>{s ? 'Replay level' : 'Play level'}</button>}
                {unlocked && lessonsDone && l.lessons.length > 0 && <button className="btn quiet small" onClick={() => g.go({ name: 'lesson', id: l.lessons[0] })}>Replay lesson</button>}
                {unlocked && !lessonsDone && <button className="btn quiet small" onClick={() => g.testOut(l.id)} title="Skip the lessons and start from this chapter's reference design">Test out</button>}
              </div>
            </article>
          )
        })}
        <article className="panel chapter">
          <div><h3>Sandbox</h3><p className="muted small">Every component unlocked. Set the traffic, build anything, and break it on purpose. Never scored.</p></div>
          <div className="col"><button className="btn" onClick={() => g.enterLevel('sandbox')}>Open the sandbox</button></div>
        </article>
        <article className="panel chapter">
          <div><h3>Interview mode</h3><p className="muted small">An open prompt, 15 minutes, and a scored rubric, like a system design interview. Everything is unlocked and there are no hints.</p></div>
          <div className="col"><button className="btn" onClick={() => g.enterLevel('interview')}>Start an interview</button></div>
        </article>
      </section>

      {allDone && g.check.after === undefined && (
        <section className="panel"><p>You finished the campaign! Retake the check to see what you learned.</p><button className="btn primary" onClick={() => g.go({ name: 'check', phase: 'after' })}>Take the check again</button></section>
      )}
      <Codex />
    </div>
  )
}

function Codex() {
  const g = useGame()
  const [q, setQ] = useState('')
  const needle = q.toLowerCase()
  const done = LESSONS.filter((l) => g.lessonsDone.includes(l.id))
  const cards = done.filter((l) => !needle || (l.title + l.codex.analogy + l.codex.note + (l.terms ?? []).map((t) => t.term + t.meaning).join(' ')).toLowerCase().includes(needle))
  const terms = [...done.flatMap((l) => l.terms ?? []), ...GLOSSARY_EXTRA].filter((t) => !needle || (t.term + t.meaning).toLowerCase().includes(needle))
  return (
    <section className="panel codex" aria-label="Codex">
      <div className="row between"><h3>Codex</h3>
        <label className="small">Search <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="cache, latency, shard…" /></label></div>
      {done.length === 0 && <p className="muted small">Finish a lesson to collect its concept card and glossary terms.</p>}
      <div className="cards">{cards.map((l) => (
        <div key={l.id} className="card"><strong>{l.title}</strong><p>{l.codex.analogy}</p><p className="muted small">{l.codex.note}</p><p className="muted small">Sources: {l.codex.sources.join('; ')}</p></div>
      ))}</div>
      {terms.length > 0 && done.length > 0 && (
        <>
          <h3>Glossary</h3>
          <dl className="glossary">{terms.map((t) => <div key={t.term}><dt>{t.term}</dt><dd className="muted">{t.meaning}</dd></div>)}</dl>
        </>
      )}
    </section>
  )
}

export function Check({ phase }: { phase: 'before' | 'after' }) {
  const g = useGame()
  const [ans, setAns] = useState<number[]>([])
  const qn = ans.length
  const finish = (a: number[]) => {
    const score = a.reduce((s, x, i) => s + (x === CHECK[i].answer ? 100 / CHECK.length : 0), 0)
    g.setCheck(phase, Math.round(score))
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

interface Frame { snap: Snapshot; design: Design }

export function Debrief({ id }: { id: string }) {
  const g = useGame()
  const level = levelById(id)
  const design = g.designs[id]
  const s = g.stars[id]
  const ref = level.reference
  const next = LEVELS[level.chapter + 1]
  const card = LESSONS.find((l) => l.id === level.codex)
  const run = g.lastRun?.levelId === id ? g.lastRun : null
  const [at, setAt] = useState(-1)
  // Replay (FR-27): re-run the engine from the recorded seed and edit log, keeping each tick's snapshot and design.
  const frames = useMemo<Frame[]>(() => {
    if (!run) return []
    const out: Frame[] = []
    runAll(level, run.startDesign, run.seed, run.editLog, (snap, sim) => out.push({ snap, design: JSON.parse(JSON.stringify(sim.design)) as Design }))
    return out
  }, [run, level])
  const idx = at < 0 ? frames.length - 1 : at
  const frame = frames[idx]
  const marks = g.timeline.filter((t) => !t.resolved).map((t) => t.tick)
  const jump = (dir: 1 | -1) => {
    const tick = frame?.snap.tick ?? 0
    const nextMark = dir > 0 ? marks.find((t) => t > tick) : [...marks].reverse().find((t) => t < tick)
    if (nextMark !== undefined) setAt(Math.max(0, nextMark - 1))
  }
  const ids = [...new Set([...design.nodes.map((n) => n.id), ...ref.nodes.map((n) => n.id)])]
  const differs = (nid: string) => {
    const a = design.nodes.find((n) => n.id === nid), b = ref.nodes.find((n) => n.id === nid)
    return !a || !b || a.instances !== b.instances || JSON.stringify(a.config ?? null) !== JSON.stringify(b.config ?? null)
  }

  return (
    <div className="panel debrief">
      <h2>Debrief: {level.title}</h2>
      <div className="stars big" aria-label="Stars earned"><span className={s?.ship ? 'on' : ''}><Icon name="star" filled={s?.ship} size={22} /> Ship it</span><span className={s?.thrifty ? 'on' : ''}><Icon name="star" filled={s?.thrifty} size={22} /> Thrifty</span><span className={s?.senior ? 'on' : ''}><Icon name="star" filled={s?.senior} size={22} /> Senior engineer</span></div>
      {s?.fromReference && <p className="muted small">Earned from a reference start.</p>}

      <h3>Replay of your run</h3>
      {frame ? (
        <>
          <Board design={frame.design} snap={frame.snap} reduced={g.settings.reducedMotion} />
          <div className="row scrub">
            <button className="btn small" onClick={() => jump(-1)} disabled={!marks.some((t) => t < frame.snap.tick)}>Previous incident</button>
            <input type="range" min={0} max={frames.length - 1} value={idx} onChange={(e) => setAt(Number(e.target.value))} aria-label="Replay position" aria-valuetext={`tick ${frame.snap.tick}`} />
            <button className="btn small" onClick={() => jump(1)} disabled={!marks.some((t) => t > frame.snap.tick)}>Next incident</button>
            <span className="mono small">tick {frame.snap.tick}/{frames.length}</span>
          </div>
          <div className="timeline" aria-hidden>{frames.map((f, i) => <span key={i} className={marks.includes(f.snap.tick) ? 'mark' : ''} style={{ left: `${(i / Math.max(1, frames.length - 1)) * 100}%` }} />)}</div>
          <p className="muted small">p95 {Math.round(frame.snap.metrics.p95)} ms · errors {(frame.snap.metrics.errorRate * 100).toFixed(1)}% · cost ${frame.snap.metrics.cost}/mo</p>
        </>
      ) : <p className="muted small">Replay is available for the most recent run of this level.</p>}

      <h3>Incidents</h3>
      {g.timeline.length === 0 ? <p className="muted small">No incidents fired this run.</p> : (
        <ul className="incidents">{g.timeline.map((t, i) => <li key={i} className={t.chaos ? 'chaos' : t.resolved ? 'ok' : `sev${t.severity}`}><span className="mono small">t{t.tick}</span> {t.resolved ? 'Resolved: ' : ''}{t.text}</li>)}</ul>
      )}

      <h3>Your design vs. the reference</h3>
      <div className="compare-boards">
        <figure><Board design={design} snap={null} /><figcaption className="small muted">Yours</figcaption></figure>
        <figure><Board design={ref} snap={null} /><figcaption className="small muted">Reference</figcaption></figure>
      </div>
      <table className="compare">
        <thead><tr><th>Component</th><th>Yours</th><th>Reference</th><th>Why</th></tr></thead>
        <tbody>
          {ids.map((nid) => {
            const a = design.nodes.find((n) => n.id === nid), b = ref.nodes.find((n) => n.id === nid)
            const d = differs(nid)
            return (
              <tr key={nid} className={d ? 'diff' : ''}>
                <td>{nid}</td><td>{a ? `×${a.instances}` : '—'}</td><td>{b ? `×${b.instances}` : '—'}</td>
                <td className="small">{d ? <strong>Differs. </strong> : null}{level.debrief.diffs[nid] ?? ''}</td>
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
        <button className="btn primary" onClick={() => g.go({ name: 'menu' })}>{next ? 'Next chapter' : 'Back to chapters'}</button>
      </div>
    </div>
  )
}
