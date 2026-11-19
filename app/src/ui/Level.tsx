import { useEffect, useRef, useState } from 'react'
import { Board, clientToCell } from '../board/Board'
import { LEVELS, PART_INFO, STAGE_UNLOCKS, UNLOCK_ORDER, levelById } from '../content'
import { PARAMS, costOf } from '../schema'
import type { CType, ChaosKind, DNode, Design, NodeConfig } from '../schema'
import { SPEEDS, connectCheck, useGame } from '../session/store'
import { SIZE } from '../tokens'
import { Icon, sevIcon } from './Icon'
import { Challenges } from './Challenges'
import { Chip } from './Hud'
import { PartsPalette } from './PartsPalette'
import { Palette } from './Palette'
import { StageIntro } from './StageIntro'

const total = (d: Design) => d.nodes.reduce((s, n) => s + costOf(n), 0)
const CAN_CONNECT: CType[] = ['users', 'dns', 'limiter', 'lb', 'app', 'cache', 'cdn', 'queue']
const CHAOS: { kind: ChaosKind; label: string; target?: CType }[] = [
  { kind: 'crash', label: 'Crash a server', target: 'app' }, { kind: 'regionOut', label: 'Lose a region' }, { kind: 'cacheFlush', label: 'Flush the cache' },
  { kind: 'spike', label: 'Traffic spike' }, { kind: 'badDeploy', label: 'Bad deploy' }, { kind: 'botAttack', label: 'Bot attack' },
]

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
    <div className="stepper" role="group" aria-label={label}>
      <span className="small stepper-label">{label}</span>
      <div className="stepper-ctl">
        <button className="btn small round" aria-label={`Fewer ${label}`} onClick={() => onChange(value - 1)} disabled={value <= min}>−</button>
        <span className="stepper-value" key={value}>{value}</span>
        <button className="btn small round" aria-label={`More ${label}`} onClick={() => onChange(value + 1)} disabled={value >= max}>+</button>
      </div>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}

function Settings({ node }: { node: DNode }) {
  const g = useGame()
  const cfg = (c: NodeConfig) => g.setConfig(node.id, c)
  return (
    <div className="settings">
      {(node.type === 'app' || node.type === 'worker' || node.type === 'search' || node.type === 'lb') && (
        <p className="muted small">Need more? Drag another {PARAMS[node.type].label} onto the board and wire it up{node.type === 'app' ? ' behind a Load Balancer' : node.type === 'worker' ? ' to the Message Queue' : ''}.</p>
      )}
      {node.type === 'db' && <Stepper label="Read replicas" value={node.instances - 1} min={0} max={8} onChange={(v) => g.setInstances(node.id, v + 1)} hint="$120/mo each" />}
      {node.type === 'shard' && <Stepper label="Shards" value={node.instances} min={1} max={16} onChange={(v) => g.setInstances(node.id, v)} hint={`$${PARAMS.shard.cost}/mo each`} />}
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
  const sandbox = !!level.sandbox || !!level.interview // both open every component and have no hints
  const interview = !!level.interview
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!interview) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [interview])
  const left = g.deadline ? Math.max(0, Math.round((g.deadline - now) / 1000)) : null
  const [picking, setPicking] = useState(false)
  useEffect(() => { window.scrollTo(0, 0) }, [id])
  const boardRef = useRef<HTMLDivElement>(null)
  // A part dropped from the palette lands centred on the pointer.
  const onDrop = (type: CType, cx: number, cy: number) => {
    const cell = clientToCell(boardRef.current, cx, cy)
    if (!cell) return
    const [w, h] = SIZE[type]
    g.place(type, cell[0] - w / 2, cell[1] - h / 2)
  }
  // SEV-2 and SEV-3 alerts step aside after a few seconds; SEV-1 stays until it is dismissed. All stay in the Incidents list.
  useEffect(() => {
    if (!g.pager || g.pager.severity === 1) return
    const t = setTimeout(() => useGame.getState().dismissPager(), 8000)
    return () => clearTimeout(t)
  }, [g.pager])
  // A chaos event lands with a jolt: the arena shakes once and flashes, so the cause is felt before it is read.
  const [quake, setQuake] = useState(false)
  useEffect(() => {
    if (!g.chaos) return
    setQuake(true)
    const t = setTimeout(() => setQuake(false), 520)
    return () => clearTimeout(t)
  }, [g.chaos])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      const st = useGame.getState()
      if (st.selectedEdge) { e.preventDefault(); st.removeEdge() }
      else if (st.selected) { e.preventDefault(); st.remove(st.selected) }
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [])
  // No outlines of the answer: the player works out which part solves the problem.
  const ghosts: DNode[] = []
  const stage = LEVELS.findIndex((l) => l.id === id)
  const sel = design.nodes.find((n) => n.id === g.selected)
  const selState = sel ? snap?.nodes[sel.id] : undefined
  const m = snap?.metrics
  const idle = !g.running && !snap
  const ended = idle || !!g.result || !!snap?.done
  const hint = g.hintShown > 0 ? level.hints.slice(0, g.hintShown) : []
  const result = g.result
  const chaosNow = g.chaos && snap && snap.tick - g.chaos.tick < 8 ? g.chaos : null
  const ticks = level.traffic.cycle * level.cycles
  const cost = m ? m.cost : total(design)
  const goals = level.sandbox ? [] : [
    { label: `p95 under ${level.slo.p95Ms} ms`, ok: m ? m.p95 <= level.slo.p95Ms : null },
    { label: `Errors under ${(level.slo.errorRate * 100).toFixed(1)}%`, ok: m ? m.errorRate <= level.slo.errorRate : null },
    { label: `Under $${level.budget}/mo`, ok: cost <= level.budget },
  ]
  const score = result?.rubric ? Math.round((result.rubric.filter((r) => r.pass).length / Math.max(1, result.rubric.length)) * 100) : 0
  const playLabel = ended ? (snap ? 'Run again' : 'Start') : g.running ? 'Pause' : 'Resume'

  return (
    <div className="level">
      <p className="small-screen-note" role="note">The board needs a bigger screen. Use a tablet or computer to build; you can still look around here.</p>
      <header className="level-head">
        <button className="btn quiet" onClick={() => g.go({ name: 'menu' })}><Icon name="back" /> Home</button>
        <div className="level-title">
          <h2>{level.title}</h2>
          <p className="muted">{level.story}</p>
        </div>
        {stage >= 0 && <span className="stage-pill">Stage {stage + 1} of {LEVELS.length}</span>}
        <button className="btn challenges-btn" onClick={() => setPicking(true)}>Stages</button>
      </header>

      <div className="game">
        <aside className="hotbar" aria-label="Parts">
          <PartsPalette types={UNLOCK_ORDER} unlocked={level.placeable} fresh={STAGE_UNLOCKS[id] ?? []} onAdd={(t) => g.place(t)} onDrop={onDrop} />
        </aside>

        <section className={`arena${quake ? ' quake' : ''}`} aria-label="Board">
          <div className="hud">
            <div className="hud-run" role="group" aria-label="Run controls">
              <button className={`play${ended ? '' : g.running ? ' is-running' : ' is-paused'}`} onClick={ended ? g.start : g.togglePause} aria-label={playLabel}>
                <span className="play-icon" key={playLabel}><Icon name={!ended && g.running ? 'pause' : 'play'} size={18} filled={ended || !g.running} /></span>
                <span>{playLabel}</span>
              </button>
              {!ended && <button className="btn small round" onClick={g.start} aria-label="Restart" title="Restart"><Icon name="restart" size={16} /></button>}
              <div className="segmented" role="group" aria-label="Speed">
                {SPEEDS.map((s) => <button key={s} aria-pressed={g.settings.speed === s} onClick={() => g.setSpeed(s)}>{s}×</button>)}
              </div>
              {!level.sandbox && (
                <div className="progress" role="progressbar" aria-label="Run progress" aria-valuemin={0} aria-valuemax={ticks} aria-valuenow={snap?.tick ?? 0}>
                  <span style={{ transform: `scaleX(${(snap?.tick ?? 0) / ticks})` }} />
                </div>
              )}
            </div>
            <div className="hud-metrics" aria-label="Live metrics">
              <Chip label="Requests/s" value={m ? m.rps : null} format={(v) => v.toFixed(0)} />
              <Chip label="p95" value={m ? m.p95 : null} format={(v) => `${Math.round(v)} ms`} bad={!!m && !level.sandbox && m.p95 > level.slo.p95Ms} />
              <Chip label="Errors" value={m ? m.errorRate * 100 : null} format={(v) => `${v.toFixed(1)}%`} bad={!!m && !level.sandbox && m.errorRate > level.slo.errorRate} />
              <Chip label="Cost/mo" value={cost} format={(v) => `$${Math.round(v)}`} bad={!level.sandbox && cost > level.budget} />
              {m && m.botRps > 0 && <Chip label="Bots/s" value={m.botRps} format={(v) => v.toFixed(0)} />}
            </div>
          </div>

          <div className="arena-board" ref={boardRef}>
            {left !== null && <div className={`arena-banner timer${left === 0 ? ' over' : ''}`} role="timer" aria-label="Time left"><Icon name="bolt" size={16} /> <strong className="mono">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong> <span>{left === 0 ? 'Time is up. Run your design now.' : 'left to design'}</span></div>}
            {chaosNow && <div className="arena-banner chaos" role="status" key={g.chaos?.tick}><Icon name="bolt" size={16} /> <strong>{chaosNow.name}</strong> <span>Watch what breaks, and what survives.</span></div>}
            <Board design={design} snap={snap} ghosts={ghosts} selected={g.selected} linkFrom={g.linkFrom} focus={g.focusNode}
              reduced={g.settings.reducedMotion} speed={g.settings.speed} onNode={g.clickNode} onGhost={(t) => g.place(t)}
              editable onMove={g.move} onConnect={g.connect} canConnect={connectCheck} onEdge={g.selectEdge} selectedEdge={g.selectedEdge} />
            {quake && <span className="flash" aria-hidden />}
          </div>

          <div className="arena-foot">
            {g.pager && !result ? (
              <div className={`pager sev${g.pager.severity}`} role="alert" key={g.pager.id}>
                <Icon name={sevIcon(g.pager.severity)} size={20} />
                <strong>{g.pager.name}</strong>
                <button className="btn small" onClick={() => { g.clickNode(g.pager!.node); g.dismissPager() }}>Go to</button>
                <button className="btn quiet small round" onClick={g.dismissPager} aria-label="Dismiss alert"><Icon name="close" size={16} /></button>
              </div>
            ) : (
              <ul className="howto muted small" aria-label="How to build">
                <li>Drag a part in</li>
                <li>Drag the <span className="dot" aria-hidden /> dot to connect</li>
                <li><kbd>Delete</kbd> removes</li>
                <li><kbd>/</kbd> commands</li>
              </ul>
            )}
            <div className="live" role="status" aria-live="polite" key={g.message}>{g.message}</div>
          </div>
        </section>

        <aside className="rail">
          <div className="panel inspector" aria-label="Inspector">
            {sel ? (
              <div className="inspector-body" key={sel.id}>
                <div className="inspector-head">
                  <h3>{PARAMS[sel.type].label}</h3>
                  {selState && sel.type !== 'users' && <span className={`pill h-${selState.health}`}>{selState.health}</span>}
                </div>
                <p className="small part-info">{PART_INFO[sel.type]}</p>
                {selState && sel.type !== 'users' && (
                  <div className="gauge" aria-label={`${Math.round(selState.util * 100)} percent used`}>
                    <span className={`h-${selState.health}`} style={{ transform: `scaleX(${Math.min(1, selState.util)})` }} />
                  </div>
                )}
                {selState && sel.type !== 'users' && <p className="muted small">{Math.round(selState.util * 100)}% used · {Math.round(selState.latencyMs)} ms</p>}
                <p className="muted small">{design.edges.filter((e) => e.from === sel.id).map((e) => `→ ${e.to}`).join('  ') || 'No outgoing connections yet.'}</p>
                <Settings node={sel} />
                <div className="row">
                  {CAN_CONNECT.includes(sel.type) && (
                    <button className={`btn small${g.linkFrom === sel.id ? ' primary' : ''}`} onClick={() => g.startLink(sel.id)}>{g.linkFrom === sel.id ? 'Pick target…' : 'Connect to…'}</button>
                  )}
                  <button className="btn small danger" onClick={() => g.remove(sel.id)}>Remove</button>
                </div>
              </div>
            ) : g.selectedEdge ? (
              <div className="inspector-body" key="edge">
                <h3>Connection</h3>
                <p className="muted">{g.selectedEdge.from} → {g.selectedEdge.to}</p>
                <button className="btn small danger" onClick={g.removeEdge}>Remove connection</button>
              </div>
            ) : (
              <div className="inspector-empty">
                <h3>Inspector</h3>
                <p className="muted small">Select a part to see its load and tune it. Select a line to remove it.</p>
              </div>
            )}
          </div>

          {goals.length > 0 && (
            <div className="panel objectives">
              <div className="row between objectives-head"><h3>{interview ? 'Targets' : 'Objectives'}</h3><span className="muted small">{snap ? 'live' : 'press Start'}</span></div>
              <p className="muted small objectives-note">Judged over the final traffic cycle of the run.</p>
              <ul>
                {goals.map((o) => (
                  <li key={o.label} className={o.ok === null ? 'pending' : o.ok ? 'ok' : 'bad'}>
                    <span className="check" key={String(o.ok)} aria-hidden>{o.ok === null ? null : <Icon name={o.ok ? 'check' : 'cross'} size={14} />}</span>
                    {o.label}<span className="sr-only">{o.ok === null ? ', not measured yet' : o.ok ? ', met' : ', not met'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {level.sandbox && (
            <div className="panel breakit">
              <h3>Break it</h3>
              <label className="field"><span className="small">Traffic</span>
                <input type="range" min={0.25} max={4} step={0.25} defaultValue={1} onChange={(e) => g.setSandboxLoad(Number(e.target.value))} aria-label="Traffic multiplier" /></label>
              <div className="chaos-grid">{CHAOS.map((c) => <button key={c.kind} className="btn small chaos-btn" onClick={() => g.fireChaos(c.kind, c.target)}><Icon name="bolt" size={14} /> {c.label}</button>)}</div>
              <p className="muted small">Press Start, then break things. The sandbox is never scored.</p>
            </div>
          )}

          <div className="panel">
            <h3>Incidents</h3>
            {g.timeline.length === 0 && <p className="muted small">Quiet so far.</p>}
            <ul className="incidents" aria-live="polite">
              {g.timeline.slice(-6).map((t, i) => (
                <li key={`${t.tick}-${i}-${t.text}`} className={t.chaos ? 'chaos' : t.resolved ? 'ok' : `sev${t.severity}`}>
                  <Icon name={t.chaos ? 'bolt' : t.resolved ? 'check' : sevIcon(t.severity)} /> <span className="mono small">t{t.tick}</span> {t.resolved ? `Resolved: ${t.text.replace(/^SEV-\d: /, '')}` : t.text}
                </li>
              ))}
            </ul>
          </div>

          {!sandbox && (
            <div className="panel">
              <h3>Hints</h3>
              {hint.map((h, i) => <p key={i} className="small hint">{i + 1}. {h}</p>)}
              {g.hintShown < 3 && (
                <>
                  <button className="btn small" onClick={g.useHint}>{['Show a nudge', 'Show the concept', 'Show the fix'][g.hintShown]}</button>
                  {g.hintShown === 0 && <p className="muted small hint-note">Using a hint gives up the Senior engineer star.</p>}
                </>
              )}
              <button className="btn quiet small restart-ref" onClick={g.restartFromReference}>Start over from the reference design</button>
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
      {g.intro === id && <StageIntro level={level} index={stage} onStart={g.closeIntro} />}

      {result && !level.sandbox && (
        <div className="modal-back">
          <div className={`modal result ${result.stars.ship || interview ? 'ship' : 'fail'}`} role="dialog" aria-modal="true" aria-label="Run result">
            <h2>{interview ? `Interview score: ${score}/100` : result.stars.ship ? (stage === LEVELS.length - 1 ? 'Friendbook survived!' : 'Stage cleared!') : 'Not there yet'}</h2>
            {!interview && (
              <div className="star-row" aria-label="Stars earned">
                {([['ship', 'Ship it'], ['thrifty', 'Thrifty'], ['senior', 'Senior engineer']] as const).map(([k, label], i) => (
                  <div key={k} className={`star-slot${result.stars[k] ? ' on' : ''}`} style={{ animationDelay: `${180 + i * 140}ms` }}>
                    {result.stars[k] && <span className="burst" style={{ animationDelay: `${180 + i * 140}ms` }} aria-hidden />}
                    <Icon name="star" filled={result.stars[k]} size={40} />
                    <span className="small">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {result.rubric && <ul className="slos">{result.rubric.map((r) => <li key={r.label} className={r.pass ? 'ok' : 'bad'}><Icon name={r.pass ? 'check' : 'cross'} /> {r.label}</li>)}</ul>}
            <ul className="slos">
              {result.slos.map((s) => <li key={s.name} className={s.pass ? 'ok' : 'bad'}><Icon name={s.pass ? 'check' : 'cross'} /> {s.name}: {s.measured} <span className="muted">({s.target})</span></li>)}
              {result.missing.length > 0 && result.slos.every((x) => x.pass) && <li className="bad"><Icon name="cross" /> The numbers held, but brute force will not last: this stage's problem has a better fix. A hint can point the way.</li>}
              <li className={result.cost <= level.budget ? 'ok' : 'bad'}><Icon name={result.cost <= level.budget ? 'check' : 'cross'} /> Cost ${result.cost}/mo <span className="muted">(budget ${level.budget})</span></li>
            </ul>
            {result.stars.fromReference && <p className="muted small">Stars from a reference start are marked as such.</p>}
            <div className="row">
              {result.stars.ship && !interview && stage >= 0 && stage < LEVELS.length - 1 && <button className="btn primary" onClick={g.nextStage}>Next problem <Icon name="next" size={16} /></button>}
              {result.stars.ship && !interview && <button className={`btn${stage === LEVELS.length - 1 ? ' primary' : ''}`} onClick={() => g.go({ name: 'debrief', id })}>See debrief</button>}
              <button className="btn" onClick={g.start}>Run again</button>
              <button className="btn quiet" onClick={() => useGame.setState({ result: null })}>Keep editing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
