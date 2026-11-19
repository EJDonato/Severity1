import { useEffect, useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { levelById } from '../content'
import { ALL_TYPES, PARAMS, costOf } from '../schema'
import type { CType, ChaosKind, DNode, Design, NodeConfig } from '../schema'
import { SPEEDS, useGame } from '../session/store'
import { Icon, sevIcon } from './Icon'
import { Challenges } from './Challenges'
import { Palette } from './Palette'

const total = (d: Design) => d.nodes.reduce((s, n) => s + costOf(n), 0)
const CAN_CONNECT: CType[] = ['users', 'dns', 'limiter', 'lb', 'app', 'cache', 'cdn', 'queue']
const CHAOS: { kind: ChaosKind; label: string; target?: CType }[] = [
  { kind: 'crash', label: 'Crash a server', target: 'app' }, { kind: 'regionOut', label: 'Lose a region' }, { kind: 'cacheFlush', label: 'Flush the cache' },
  { kind: 'spike', label: 'Traffic spike' }, { kind: 'badDeploy', label: 'Bad deploy' }, { kind: 'botAttack', label: 'Bot attack' },
]

function Tile({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={`tile${bad ? ' bad' : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{bad ? <Icon name="warn" size={16} /> : null}{value}<span className="sr-only">{bad ? ' (over target)' : ''}</span></span>
    </div>
  )
}

function Select<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <label className="field">
      <span className="muted small">{label}</span>
      <select value={value} onChange={(e) => onChange((typeof value === 'number' ? Number(e.target.value) : e.target.value) as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

function Stepper({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <span className="small">{label}</span>
      <button className="btn small" aria-label={`Fewer ${label}`} onClick={() => onChange(value - 1)} disabled={value <= min}>−</button>
      <span className="mono">{value}</span>
      <button className="btn small" aria-label={`More ${label}`} onClick={() => onChange(value + 1)} disabled={value >= max}>+</button>
      {hint && <span className="muted small">{hint}</span>}
    </span>
  )
}

function Settings({ node }: { node: DNode }) {
  const g = useGame()
  const cfg = (c: NodeConfig) => g.setConfig(node.id, c)
  return (
    <div className="settings">
      {(node.type === 'app' || node.type === 'lb') && <Stepper label="Instances" value={node.instances} min={1} max={16} onChange={(v) => g.setInstances(node.id, v)} hint={`$${PARAMS[node.type].cost}/mo each`} />}
      {node.type === 'db' && <Stepper label="Read replicas" value={node.instances - 1} min={0} max={8} onChange={(v) => g.setInstances(node.id, v + 1)} hint="$120/mo each" />}
      {node.type === 'worker' && <Stepper label="Workers" value={node.instances} min={1} max={16} onChange={(v) => g.setInstances(node.id, v)} hint={`$${PARAMS.worker.cost}/mo each`} />}
      {node.type === 'shard' && <Stepper label="Shards" value={node.instances} min={1} max={16} onChange={(v) => g.setInstances(node.id, v)} hint={`$${PARAMS.shard.cost}/mo each`} />}
      {node.type === 'search' && <Stepper label="Instances" value={node.instances} min={1} max={16} onChange={(v) => g.setInstances(node.id, v)} hint={`$${PARAMS.search.cost}/mo each`} />}
      {node.type === 'cache' && (
        <>
          <Select label="Cache size" value={node.config?.cacheSize ?? 2} options={[[1, 'Small'], [2, 'Medium'], [3, 'Large']]} onChange={(v) => cfg({ cacheSize: v as 1 | 2 | 3 })} />
          <Select label="Entries expire after" value={node.config?.expiry ?? 30} options={[[5, '5 seconds'], [15, '15 seconds'], [30, '30 seconds']]} onChange={(v) => cfg({ expiry: v as 5 | 15 | 30 })} />
        </>
      )}
      {node.type === 'shard' && <Select label="Shard key" value={node.config?.shardKey ?? 'userId'} options={[['userId', 'User ID'], ['region', 'Region']]} onChange={(v) => cfg({ shardKey: v })} />}
      {node.type === 'limiter' && <Select label="Limit per user" value={node.config?.limit ?? 'medium'} options={[['low', 'Strict'], ['medium', 'Medium'], ['high', 'Lenient']]} onChange={(v) => cfg({ limit: v })} />}
    </div>
  )
}

export function LevelScreen({ id }: { id: string }) {
  const g = useGame()
  const level = levelById(id)
  const design = g.designs[id]
  const snap = g.snap
  const sandbox = !!level.sandbox || !!level.interview // both open every component and skip the lessons
  const interview = !!level.interview
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!interview) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [interview])
  const left = g.deadline ? Math.max(0, Math.round((g.deadline - now) / 1000)) : null
  const [picking, setPicking] = useState(false)
  const ghosts = useMemo(() => (sandbox ? [] : level.reference.nodes.filter((n) => !design.nodes.some((x) => x.id === n.id) && level.placeable.includes(n.type))), [design, level, sandbox])
  const sel = design.nodes.find((n) => n.id === g.selected)
  const m = snap?.metrics
  const idle = !g.running && !snap
  const hint = g.hintShown > 0 ? level.hints.slice(0, g.hintShown) : []
  const result = g.result
  const chaosNow = g.chaos && snap && snap.tick - g.chaos.tick < 8 ? g.chaos : null

  return (
    <div className="level">
      <header className="level-head">
        <button className="btn quiet" onClick={() => g.go({ name: 'menu' })}><Icon name="back" /> Home</button>
        <div>
          <h2>{level.title}</h2>
          <p className="muted">{level.story}</p>
        </div>
        <button className="btn challenges-btn" onClick={() => setPicking(true)}>Challenges</button>
      </header>

      <div className="level-grid">
        <section className="stage" aria-label="Board">
          <div className="toolbar" role="toolbar" aria-label="Components">
            {ALL_TYPES.filter((t) => level.placeable.includes(t)).map((t) => (
              <button key={t} className="chip" onClick={() => g.place(t)} title={`${PARAMS[t].label}, $${PARAMS[t].cost}/month`} aria-label={`Add ${PARAMS[t].label}`}>
                <Icon name="plus" size={14} /> {PARAMS[t].label}
              </button>
            ))}
          </div>

          {left !== null && <div className={`chaos-banner${left === 0 ? ' over' : ''}`} role="timer" aria-label="Time left"><Icon name="bolt" /> <strong className="mono">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong> <span>{left === 0 ? 'Time is up. Run your design now.' : 'left to design. Press Start whenever you are ready.'}</span></div>}
          {chaosNow && <div className="chaos-banner" role="status"><Icon name="bolt" /> <strong>{chaosNow.name}</strong> <span>Watch what it takes down, and what survives.</span></div>}

          <Board design={design} snap={snap} ghosts={ghosts} selected={g.selected} linkFrom={g.linkFrom} focus={g.focusNode}
            reduced={g.settings.reducedMotion} speed={g.settings.speed} onNode={g.clickNode} onGhost={g.place} />
          <div className="live" role="status" aria-live="polite">{g.message}</div>

          {sel && (
            <div className="panel inspect">
              <div className="row between">
                <div>
                  <strong>{PARAMS[sel.type].label}</strong>
                  {snap?.nodes[sel.id] && sel.type !== 'users' && (
                    <span className="small muted"> · {Math.round(snap.nodes[sel.id].util * 100)}% used · {Math.round(snap.nodes[sel.id].latencyMs)} ms · {snap.nodes[sel.id].health}</span>
                  )}
                </div>
                <span className="small muted">{design.edges.filter((e) => e.from === sel.id).map((e) => `→ ${e.to}`).join('  ') || 'no outgoing connections'}</span>
              </div>
              <Settings node={sel} />
              <div className="row">
                {CAN_CONNECT.includes(sel.type) && (
                  <button className={`btn${g.linkFrom === sel.id ? ' primary' : ''}`} onClick={() => g.startLink(sel.id)}>{g.linkFrom === sel.id ? 'Pick target…' : 'Connect to…'}</button>
                )}
                <button className="btn danger" onClick={() => g.remove(sel.id)}>Remove</button>
              </div>
            </div>
          )}
          {!sel && <p className="muted small">Click a component to inspect, scale, configure or connect it. Dashed outlines show where the next piece goes. Press <kbd>/</kbd> for the command palette.</p>}

          {level.sandbox && (
            <div className="panel sandbox">
              <h3>Sandbox controls</h3>
              <label className="field"><span className="small">Traffic</span>
                <input type="range" min={0.25} max={4} step={0.25} defaultValue={1} onChange={(e) => g.setSandboxLoad(Number(e.target.value))} aria-label="Traffic multiplier" /></label>
              <div className="row">{CHAOS.map((c) => <button key={c.kind} className="btn small" onClick={() => g.fireChaos(c.kind, c.target)}><Icon name="bolt" size={14} /> {c.label}</button>)}</div>
              <p className="muted small">Press Start, then break things. The sandbox is never scored.</p>
            </div>
          )}
        </section>

        <aside className="side">
          <div className="panel">
            <div className="row between">
              <h3>Run</h3>
              <span className="mono small">{snap ? (sandbox ? `tick ${snap.tick}` : `tick ${snap.tick}/${level.traffic.cycle * level.cycles}`) : `cost $${total(design)}/mo`}</span>
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
              {SPEEDS.map((s) => <button key={s} className="btn small" aria-pressed={g.settings.speed === s} onClick={() => g.setSpeed(s)}>{s}×</button>)}
            </div>
            {!sandbox && <button className="btn quiet small" onClick={g.restartFromReference}>Restart chapter from reference design</button>}
          </div>

          {(
            <div className="panel metrics" aria-label="Live metrics">
              <h3>Live metrics</h3>
              <div className="tiles">
                <Tile label="Requests/s" value={m ? m.rps.toFixed(0) : '–'} />
                <Tile label="p50" value={m ? `${Math.round(m.p50)} ms` : '–'} />
                <Tile label="p95" value={m ? `${Math.round(m.p95)} ms` : '–'} bad={!!m && !level.sandbox && m.p95 > level.slo.p95Ms} />
                <Tile label="Errors" value={m ? `${(m.errorRate * 100).toFixed(1)}%` : '–'} bad={!!m && !level.sandbox && m.errorRate > level.slo.errorRate} />
                <Tile label="Cost/mo" value={`$${m ? m.cost : total(design)}`} bad={!sandbox && (m ? m.cost : total(design)) > level.budget} />
                {m && m.botRps > 0 ? <Tile label="Bot traffic/s" value={m.botRps.toFixed(0)} /> : <Tile label="Available" value={m ? `${(m.availability * 100).toFixed(1)}%` : '–'} />}
              </div>
              {(!sandbox || interview) && <p className="muted small">Goal: p95 under {level.slo.p95Ms} ms, errors under {(level.slo.errorRate * 100).toFixed(1)}%, budget ${level.budget}/mo.</p>}
            </div>
          )}

          <div className="panel">
            <h3>Incidents</h3>
            {g.timeline.length === 0 && <p className="muted small">Nothing yet. Press Start.</p>}
            <ul className="incidents" aria-live="polite">
              {g.timeline.slice(-6).map((t, i) => (
                <li key={i} className={t.chaos ? 'chaos' : t.resolved ? 'ok' : `sev${t.severity}`}>
                  <Icon name={t.chaos ? 'bolt' : t.resolved ? 'check' : sevIcon(t.severity)} /> <span className="mono small">t{t.tick}</span> {t.resolved ? `Resolved: ${t.text.replace(/^SEV-\d: /, '')}` : t.text}
                </li>
              ))}
            </ul>
          </div>

          {!sandbox && (
            <div className="panel">
              <h3>Hints</h3>
              {hint.map((h, i) => <p key={i} className="small">{i + 1}. {h}</p>)}
              {g.hintShown < 3 && (
                <button className="btn small" onClick={g.useHint}>
                  {['Nudge', 'Concept', 'Specific fix'][g.hintShown]} (costs the Senior engineer star)
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="sr-only" aria-label="Design description">
        <h3>Current design</h3>
        <ul>
          {design.nodes.map((n) => <li key={n.id}>{PARAMS[n.type].label} {n.id}, {n.instances} instance{n.instances > 1 ? 's' : ''}{snap?.nodes[n.id] ? `, ${snap.nodes[n.id].health}, ${Math.round(snap.nodes[n.id].util * 100)} percent used` : ''}.</li>)}
          {design.edges.map((e) => <li key={`${e.from}>${e.to}`}>{e.from} sends requests to {e.to}.</li>)}
        </ul>
      </section>
      <Palette />
      {picking && <Challenges onClose={() => setPicking(false)} />}

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

      {result && (!level.sandbox) && (
        <div className="modal-back">
          <div className="modal panel" role="dialog" aria-modal="true" aria-label="Run result">
            <h2>{interview ? `Interview score: ${Math.round(((result.rubric ?? []).filter((r) => r.pass).length / Math.max(1, (result.rubric ?? []).length)) * 100)}/100` : result.stars.ship ? 'Shipped!' : 'Not there yet'}</h2>
            {result.rubric && <ul className="slos">{result.rubric.map((r) => <li key={r.label} className={r.pass ? 'ok' : 'bad'}><Icon name={r.pass ? 'check' : 'cross'} /> {r.label}</li>)}</ul>}
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
