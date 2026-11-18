import { useEffect, useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { lessonById, levelById } from '../content'
import { Sim, applyTo } from '../engine/sim'
import { telemetry } from '../telemetry'
import type { Design, Lesson, Level, Snapshot } from '../schema'
import { useGame } from '../session/store'
import { Icon } from './Icon'

const BEATS = ['Story', 'Analogy', 'Try it', 'Predict', 'Done'] as const
const CYCLE = 1_000_000

// The toy runs the same engine as the levels, so a lesson can never disagree with a level.
function useToy(lesson: Lesson, designIdx: number, instances: number | null, load: number, speed: number) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const design = useMemo<Design>(() => {
    const d = structuredClone(lesson.toy.designs[designIdx].design)
    const st = lesson.toy.stepper
    if (st && instances) applyTo(d, { kind: 'setInstances', id: st.id, instances })
    return d
  }, [lesson, designIdx, instances])
  useEffect(() => {
    const base = { ...lesson.toy.base }
    for (const k of Object.keys(base) as (keyof typeof base)[]) base[k] *= load
    const level = { traffic: { base, peak: 1, cycle: CYCLE, flat: true }, cycles: 1, slo: { p95Ms: 300, errorRate: 0.01 } } as unknown as Level
    const sim = new Sim(level, design, 1)
    let s = sim.step()
    for (let i = 0; i < 8; i++) s = sim.step() // settle so the first frame already shows steady state
    setSnap(s)
    const t = setInterval(() => setSnap(sim.step()), 250 / speed)
    return () => clearInterval(t)
  }, [lesson, design, load, speed])
  return { snap, design }
}

export function LessonScreen({ id }: { id: string }) {
  const g = useGame()
  const lesson = lessonById(id)
  const [beat, setBeat] = useState(0)
  const [designIdx, setDesignIdx] = useState(0)
  const [instances, setInstances] = useState<number | null>(lesson.toy.stepper ? 1 : null)
  const steps = lesson.toy.load?.steps
  const [load, setLoad] = useState(steps ? steps[0] : 1)
  const [picked, setPicked] = useState<number | null>(null)
  const { snap, design } = useToy(lesson, designIdx, instances, load, g.settings.speed)
  const level = Object.values({ a: levelById('ch0'), b: levelById('ch1'), c: levelById('ch2') }).find((l) => l.lessons.includes(id))
  const m = snap?.metrics

  useEffect(() => { telemetry.track('lesson_started', { lesson: id }) }, [id])

  const answer = (i: number) => {
    setPicked(i)
    const sc = lesson.predict.scenario
    setDesignIdx(sc.design)
    if (sc.instances) setInstances(sc.instances)
    if (sc.load) setLoad(sc.load)
  }
  const next = () => {
    if (beat === 3) g.completeLesson(id)
    setBeat(beat + 1)
  }
  const nextLesson = level ? level.lessons[level.lessons.indexOf(id) + 1] : undefined

  return (
    <div className="lesson panel">
      <div className="row between">
        <button className="btn quiet" onClick={() => g.go({ name: 'menu' })}><Icon name="back" /> Chapters</button>
        <ol className="dots" aria-label="Lesson progress">
          {BEATS.map((b, i) => <li key={b} className={i === beat ? 'on' : i < beat ? 'past' : ''} aria-current={i === beat ? 'step' : undefined}>{b}</li>)}
        </ol>
      </div>
      <h2>{lesson.title}</h2>

      {beat === 0 && (
        <div className="scene">
          {lesson.hook.lines.map((l) => <p key={l} className="big">{l}</p>)}
          <p className="muted">{lesson.hook.caption}</p>
        </div>
      )}
      {beat === 1 && (
        <div className="scene">
          <p className="muted">In real systems, each part of the story has a name.</p>
          <ul className="pairs">
            {lesson.analogy.pairs.map(([a, b]) => <li key={a}><span>{a}</span><Icon name="next" /><strong>{b}</strong></li>)}
          </ul>
        </div>
      )}
      {(beat === 2 || beat === 3) && (
        <div className="toy">
          <Board design={design} snap={snap} reduced={g.settings.reducedMotion} speed={g.settings.speed} />
          <div className="controls">
            {lesson.toy.designs.length > 1 && (
              <div className="row" role="group" aria-label="Design">
                {lesson.toy.designs.map((d, i) => <button key={d.label} className={`btn${designIdx === i ? ' primary' : ''}`} aria-pressed={designIdx === i} onClick={() => setDesignIdx(i)}>{d.label}</button>)}
              </div>
            )}
            {lesson.toy.stepper && (
              <div className="row"><span>{lesson.toy.stepper.label}</span>
                <button className="btn" aria-label="Fewer" onClick={() => setInstances(Math.max(lesson.toy.stepper!.min, (instances ?? 1) - 1))}>−</button>
                <span className="mono">{instances}</span>
                <button className="btn" aria-label="More" onClick={() => setInstances(Math.min(lesson.toy.stepper!.max, (instances ?? 1) + 1))}>+</button></div>
            )}
            {steps && (
              <div className="row" role="group" aria-label={lesson.toy.load!.label}><span>{lesson.toy.load!.label}</span>
                {steps.map((s) => <button key={s} className={`btn${load === s ? ' primary' : ''}`} aria-pressed={load === s} onClick={() => setLoad(s)}>{s}×</button>)}</div>
            )}
            <div className="row mono small" role="status">
              <span>{m ? Math.round(m.rps) : 0} req/s</span><span>p95 {m ? Math.round(m.p95) : 0} ms</span>
              <span className={m && m.errorRate > 0.01 ? 'badtext' : ''}><Icon name={m && m.errorRate > 0.01 ? 'cross' : 'check'} size={14} /> errors {m ? (m.errorRate * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </div>
      )}
      {beat === 2 && <p className="muted">Play with the controls and watch the machines. Then continue.</p>}
      {beat === 3 && (
        <div className="predict">
          <h3>{lesson.predict.question}</h3>
          <div className="options">
            {lesson.predict.options.map((o, i) => (
              <button key={o} className={`btn${picked === i ? (i === lesson.predict.answer ? ' primary' : ' danger') : ''}`} disabled={picked !== null} onClick={() => answer(i)}>{o}</button>
            ))}
          </div>
          {picked !== null && (
            <p role="status"><strong>{picked === lesson.predict.answer ? 'Right. ' : 'Not quite. '}</strong>Look at the board above. {lesson.predict.explain}</p>
          )}
        </div>
      )}
      {beat === 4 && (
        <div className="scene">
          <h3>Codex card earned</h3>
          <div className="card"><strong>{lesson.title}</strong><p>{lesson.codex.analogy}</p><p className="muted">{lesson.codex.note}</p><p className="muted small">Sources: {lesson.codex.sources.join('; ')}</p></div>
          <p>Unlocked: {lesson.unlocks.join(', ')}</p>
        </div>
      )}

      <div className="row end">
        {beat < 4 && <button className="btn primary" disabled={beat === 3 && picked === null} onClick={next}>{beat === 3 ? 'Finish lesson' : 'Continue'}</button>}
        {beat === 4 && (nextLesson
          ? <button className="btn primary" onClick={() => g.go({ name: 'lesson', id: nextLesson })}>Next lesson</button>
          : <button className="btn primary" onClick={() => level && g.enterLevel(level.id)}>Start the level</button>)}
      </div>
    </div>
  )
}
