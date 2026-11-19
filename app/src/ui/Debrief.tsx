import { useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { LEVELS, levelById } from '../content'
import { runAll } from '../engine/sim'
import type { Design, Snapshot } from '../schema'
import { useGame } from '../session/store'
import { Icon } from './Icon'

interface Frame { snap: Snapshot; design: Design }

export function Debrief({ id }: { id: string }) {
  const g = useGame()
  const level = levelById(id)
  const design = g.designs[id]
  const s = g.stars[id]
  const ref = level.reference
  const next = LEVELS[LEVELS.findIndex((l) => l.id === id) + 1]
  const run = g.lastRun?.levelId === id ? g.lastRun : null
  const [at, setAt] = useState(-1)
  // Replay: re-run the engine from the recorded seed and edit log, keeping each tick's snapshot and design.
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
      <h2>{level.title}: how it went</h2>
      <div className="stars big" aria-label="Stars earned"><span className={s?.ship ? 'on' : ''}><Icon name="star" filled={s?.ship} size={22} /> Ship it</span><span className={s?.thrifty ? 'on' : ''}><Icon name="star" filled={s?.thrifty} size={22} /> Thrifty</span><span className={s?.senior ? 'on' : ''}><Icon name="star" filled={s?.senior} size={22} /> Senior engineer</span></div>

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
          <p className="muted small">Traffic {Math.round(frame.snap.metrics.rps)} req/s · response time {Math.round(frame.snap.metrics.p95)} ms · errors {(frame.snap.metrics.errorRate * 100).toFixed(1)}% · ${frame.snap.metrics.cost}/month</p>
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
      <div className="row">
        <button className="btn" onClick={() => g.go({ name: 'level', id })}>Back to the level</button>
        {next && <button className="btn primary" onClick={() => g.enterLevel(next.id)}>Next problem: {next.title}</button>}
        <button className="btn" onClick={() => g.enterLevel('sandbox')}>Back to the sandbox</button>
      </div>
    </div>
  )
}
