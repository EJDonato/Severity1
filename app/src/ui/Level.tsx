import { useMemo } from 'react'
import { Board } from '../board/Board'
import { LESSONS, levelById } from '../content'
import { PARAMS } from '../schema'
import type { CType, Design } from '../schema'
import { SPEEDS, useGame } from '../session/store'
import { Icon, sevIcon } from './Icon'

const ALL: CType[] = ['users', 'app', 'lb', 'db', 'storage']
const costOf = (d: Design) => d.nodes.reduce((s, n) => s + PARAMS[n.type].cost * (n.type === 'lb' ? 1 : n.instances), 0)

function Tile({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={`tile${bad ? ' bad' : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{bad ? <Icon name="warn" size={16} /> : null}{value}<span className="sr-only">{bad ? ' (over target)' : ''}</span></span>
    </div>
  )
}

export function LevelScreen({ id }: { id: string }) {
  const g = useGame()
  const level = levelById(id)
  const design = g.designs[id]
  const snap = g.snap
  const metricsOn = g.lessonsDone.includes('latency')
  const scalingOn = g.lessonsDone.includes('load-balancing')
  const ghosts = useMemo(() => level.reference.nodes.filter((n) => !design.nodes.some((x) => x.id === n.id) && level.placeable.includes(n.type)), [design, level])
  const sel = design.nodes.find((n) => n.id === g.selected)
  const m = snap?.metrics
  const idle = !g.running && !snap
  const unlockLesson = (t: CType) => LESSONS.find((l) => (l.unlocks as string[]).includes(t))?.title ?? ''
  const hint = g.hintShown > 0 ? level.hints.slice(0, g.hintShown) : []
  const result = g.result

  return (
    <div className="level">
      <header className="level-head">
        <button className="btn quiet" onClick={() => g.go({ name: 'menu' })}><Icon name="back" /> Chapters</button>
        <div>
          <h2>{level.title}</h2>
          <p className="muted">{level.story}</p>
        </div>
      </header>

      <div className="level-grid">
        <aside className="panel toolbox" aria-label="Toolbox">
          <h3>Components</h3>
          {ALL.map((t) => {
            const ok = level.placeable.includes(t) && LESSONS.filter((l) => (l.unlocks as string[]).includes(t)).every((l) => g.lessonsDone.includes(l.id))
            return (
              <button key={t} className="toolitem" disabled={!ok} onClick={() => g.place(t)} aria-label={ok ? `Add ${PARAMS[t].label}` : `${PARAMS[t].label}, locked. Unlocks in: ${unlockLesson(t)}`}>
                <span className="toolname"><Icon name={ok ? 'plus' : 'lock'} /> {PARAMS[t].label}</span>
                <span className="muted small">{ok ? (PARAMS[t].cost ? `$${PARAMS[t].cost}/mo` : 'free') : `unlocks in: ${unlockLesson(t) || 'a later chapter'}`}</span>
              </button>
            )
          })}
        </aside>

        <section className="stage" aria-label="Board">
          <Board design={design} snap={snap} ghosts={ghosts} selected={g.selected} linkFrom={g.linkFrom} focus={g.focusNode}
            reduced={g.settings.reducedMotion} speed={g.settings.speed} onNode={g.clickNode} onGhost={g.place} />
          <div className="live" role="status" aria-live="polite">{g.message}</div>
          {sel && (
            <div className="panel inspect">
              <strong>{PARAMS[sel.type].label}</strong>
              {snap?.nodes[sel.id] && sel.type !== 'users' && (
                <span className="mono small"> · {Math.round(snap.nodes[sel.id].util * 100)}% used · {Math.round(snap.nodes[sel.id].latencyMs)} ms · {snap.nodes[sel.id].health}</span>
              )}
              <div className="row">
                {sel.type === 'app' && scalingOn && (
                  <span className="stepper" role="group" aria-label="Instances">
                    <button className="btn" aria-label="Remove an instance" onClick={() => g.setInstances(sel.id, sel.instances - 1)} disabled={sel.instances <= 1}>−</button>
                    <span className="mono">{sel.instances}</span>
                    <button className="btn" aria-label="Add an instance" onClick={() => g.setInstances(sel.id, sel.instances + 1)} disabled={sel.instances >= 8}>+</button>
                    <span className="muted small">+${PARAMS.app.cost}/mo each</span>
                  </span>
                )}
                {sel.type !== 'db' && sel.type !== 'storage' && (
                  <button className={`btn${g.linkFrom === sel.id ? ' primary' : ''}`} onClick={() => g.startLink(sel.id)}>{g.linkFrom === sel.id ? 'Pick target…' : 'Connect to…'}</button>
                )}
                {design.edges.filter((e) => e.from === sel.id).map((e) => (
                  <span key={e.to} className="muted small">→ {e.to}</span>
                ))}
                <button className="btn danger" onClick={() => g.remove(sel.id)}>Remove</button>
              </div>
            </div>
          )}
          {!sel && <p className="muted small">Click a component to inspect, scale or connect it. Dashed outlines show where the next piece goes.</p>}
        </section>

        <aside className="side">
          <div className="panel">
            <div className="row between">
              <h3>Run</h3>
              <span className="mono small">{snap ? `tick ${snap.tick}/${level.traffic.cycle * level.cycles}` : `cost $${costOf(design)}/mo`}</span>
            </div>
            <div className="row">
              {idle || result || snap?.done ? (
                <button className="btn primary" onClick={g.start}>{snap ? 'Run again' : 'Start'}</button>
              ) : (
                <>
                  <button className="btn primary" onClick={g.togglePause}>{g.running ? 'Pause' : 'Resume'}</button>
                  <button className="btn" onClick={g.start}>Restart</button>
                </>
              )}
            </div>
            <div className="row" role="group" aria-label="Speed">
              {SPEEDS.map((s) => <button key={s} className={`btn small${g.settings.speed === s ? ' primary' : ''}`} aria-pressed={g.settings.speed === s} onClick={() => g.setSpeed(s)}>{s}×</button>)}
            </div>
            <button className="btn quiet small" onClick={g.restartFromReference}>Restart chapter from reference design</button>
          </div>

          {metricsOn && (
            <div className="panel metrics" aria-label="Live metrics">
              <h3>Live metrics</h3>
              <div className="tiles">
                <Tile label="Requests/s" value={m ? m.rps.toFixed(0) : '–'} />
                <Tile label="p50" value={m ? `${Math.round(m.p50)} ms` : '–'} />
                <Tile label="p95" value={m ? `${Math.round(m.p95)} ms` : '–'} bad={!!m && m.p95 > level.slo.p95Ms} />
                <Tile label="Errors" value={m ? `${(m.errorRate * 100).toFixed(1)}%` : '–'} bad={!!m && m.errorRate > level.slo.errorRate} />
                <Tile label="Cost/mo" value={`$${m ? m.cost : costOf(design)}`} bad={(m ? m.cost : costOf(design)) > level.budget} />
                <Tile label="Available" value={m ? `${(m.availability * 100).toFixed(1)}%` : '–'} />
              </div>
              <p className="muted small">Goal: p95 under {level.slo.p95Ms} ms, errors under {(level.slo.errorRate * 100).toFixed(0)}%, budget ${level.budget}/mo.</p>
            </div>
          )}

          <div className="panel">
            <h3>Incidents</h3>
            {g.timeline.length === 0 && <p className="muted small">Nothing yet. Press Start.</p>}
            <ul className="incidents" aria-live="polite">
              {g.timeline.slice(-6).map((t, i) => (
                <li key={i} className={t.resolved ? 'ok' : `sev${t.severity}`}>
                  <Icon name={t.resolved ? 'check' : sevIcon(t.severity)} /> <span className="mono small">t{t.tick}</span> {t.resolved ? `Resolved: ${t.text.replace(/^SEV-\d: /, '')}` : t.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <h3>Hints</h3>
            {hint.map((h, i) => <p key={i} className="small">{i + 1}. {h}</p>)}
            {g.hintShown < 3 && (
              <button className="btn small" onClick={g.useHint}>
                {['Nudge', 'Concept', 'Specific fix'][g.hintShown]} (costs the Senior engineer star)
              </button>
            )}
            {g.hintShown >= 2 && <button className="btn quiet small" onClick={() => g.go({ name: 'lesson', id: level.lessons[0] })}>Reopen Codex card: {level.lessons[0]}</button>}
          </div>
        </aside>
      </div>

      {g.pager && (
        <div className={`pager sev${g.pager.severity}`} role="alert">
          <span className="pager-plate" aria-hidden />
          <div className="pager-card">
            <Icon name={sevIcon(g.pager.severity)} size={26} />
            <div><strong>{g.pager.name}</strong><div className="small">Check the highlighted machine and the inspect panel.</div></div>
            <button className="btn small" onClick={() => { g.clickNode(g.pager!.node); g.dismissPager() }}>Go to</button>
            <button className="btn quiet small" onClick={g.dismissPager} aria-label="Dismiss alert"><Icon name="close" /></button>
          </div>
        </div>
      )}

      {result && (
        <div className="modal-back">
          <div className="modal panel" role="dialog" aria-modal="true" aria-label="Run result">
            <h2>{result.stars.ship ? 'Shipped!' : 'Not there yet'}</h2>
            <ul className="slos">
              {result.slos.map((s) => <li key={s.name} className={s.pass ? 'ok' : 'bad'}><Icon name={s.pass ? 'check' : 'cross'} /> {s.name}: {s.measured} <span className="muted">({s.target})</span></li>)}
              {result.missing.length > 0 && <li className="bad"><Icon name="cross" /> Design is missing: {result.missing.map((t) => PARAMS[t].label).join(', ')}</li>}
              <li className={result.cost <= level.budget ? 'ok' : 'bad'}><Icon name={result.cost <= level.budget ? 'check' : 'cross'} /> Cost ${result.cost}/mo <span className="muted">(budget ${level.budget})</span></li>
            </ul>
            <div className="stars" aria-label="Stars earned">
              <span className={result.stars.ship ? 'on' : ''}><Icon name="star" filled={result.stars.ship} size={22} /> Ship it</span>
              <span className={result.stars.thrifty ? 'on' : ''}><Icon name="star" filled={result.stars.thrifty} size={22} /> Thrifty</span>
              <span className={result.stars.senior ? 'on' : ''}><Icon name="star" filled={result.stars.senior} size={22} /> Senior engineer</span>
            </div>
            {result.stars.fromReference && <p className="muted small">Stars from a reference start are marked as such.</p>}
            <div className="row">
              {result.stars.ship && <button className="btn primary" onClick={() => g.go({ name: 'debrief', id })}>See debrief</button>}
              <button className="btn" onClick={g.start}>Run again</button>
              <button className="btn quiet" onClick={() => useGame.setState({ result: null })}>Keep editing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
