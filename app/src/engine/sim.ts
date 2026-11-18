import { makeRng } from './rng'
import { PARAMS, REQ_TYPES } from '../schema'
import type {
  Command, DNode, Design, EdgeState, EditEntry, Evaluation, Health, Incident, Level, Metrics, Mood, NodeState, Rates, ReqType, Snapshot,
} from '../schema'

const RANK = { users: 0, lb: 1, app: 2, db: 3, storage: 3 } as const
const zero = (): Rates => ({ read: 0, write: 0, photo: 0, upload: 0 })
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

// Triangle wave (not sin) so results never depend on a browser's Math.sin.
export function multiplier(tick: number, cycle: number, peak: number): number {
  const p = (tick % cycle) / cycle
  const tri = p < 0.5 ? p * 2 : (1 - p) * 2
  return 0.6 + (peak - 0.6) * tri
}

export function healthOf(util: number, drop: number): Health {
  if (util >= 1 || drop > 0) return 'failing'
  if (util >= 0.85) return 'overloaded'
  if (util >= 0.6) return 'strained'
  return 'healthy'
}

export function connectError(d: Design, from: string, to: string): string | null {
  const a = d.nodes.find((n) => n.id === from)
  const b = d.nodes.find((n) => n.id === to)
  if (!a || !b || from === to) return 'Pick two different components.'
  if (d.edges.some((e) => e.from === from && e.to === to)) return 'Already connected.'
  const ok: Record<string, string[]> = { users: ['lb', 'app'], lb: ['app'], app: ['db', 'storage'] }
  if (b.type === 'users') return 'Nothing sends traffic to users; requests flow away from them.'
  if (a.type === 'users' && (b.type === 'db' || b.type === 'storage')) return 'Users should never talk to the database or storage directly. Go through an app server.'
  if (!(ok[a.type] ?? []).includes(b.type)) return `${PARAMS[a.type].label} can't send requests to ${PARAMS[b.type].label}.`
  return null
}


// Pure edit shared by the live sim and the idle builder, so both obey the same rules.
export function applyTo(d: Design, command: Command): string | null {
  if (command.kind === 'place') {
    if (d.nodes.some((n) => n.id === command.node.id)) return 'duplicate id'
    d.nodes.push(clone(command.node))
  } else if (command.kind === 'remove') {
    d.nodes = d.nodes.filter((n) => n.id !== command.id)
    d.edges = d.edges.filter((e) => e.from !== command.id && e.to !== command.id)
  } else if (command.kind === 'connect') {
    const err = connectError(d, command.from, command.to)
    if (err) return err
    d.edges.push({ from: command.from, to: command.to })
  } else if (command.kind === 'disconnect') {
    d.edges = d.edges.filter((e) => !(e.from === command.from && e.to === command.to))
  } else {
    const n = d.nodes.find((x) => x.id === command.id)
    if (!n) return 'unknown node'
    n.instances = Math.max(1, Math.min(8, Math.round(command.instances)))
  }
  return null
}

export class Sim {
  tick = 0
  design: Design
  editLog: EditEntry[] = []
  readonly total: number
  level: Level
  private backlog: Record<string, number> = {}
  private rng: () => number
  private hot: Record<string, number> = {}
  private cool: Record<string, number> = {}
  private slow: Record<string, number> = {}
  private incidents: Record<string, Incident> = {}
  private history: { offered: number; errors: number; p95: number }[] = []

  constructor(level: Level, design: Design, seed: number) {
    this.level = level
    this.design = clone(design)
    this.rng = makeRng(seed)
    this.total = level.traffic.cycle * level.cycles
  }

  apply(command: Command): string | null {
    const err = applyTo(this.design, command)
    if (!err) this.editLog.push({ tick: this.tick, command: clone(command) })
    return err
  }

  private cost(): number {
    return this.design.nodes.reduce((s, n) => s + PARAMS[n.type].cost * (n.type === 'lb' ? 1 : n.instances), 0)
  }

  step(): Snapshot {
    const { level, design } = this
    const nodes = [...design.nodes].sort((a, b) => RANK[a.type] - RANK[b.type] || (a.id < b.id ? -1 : 1))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const fedByLb = new Set(design.edges.filter((e) => byId.get(e.from)?.type === 'lb').map((e) => e.to))
    // Stateless servers only scale out behind a balancer (directional truth: one entry point is one machine).
    const eff = (n: DNode) => (n.type === 'app' && !fedByLb.has(n.id) ? 1 : n.type === 'lb' ? 1 : n.instances)

    const m = level.traffic.flat ? 1 : multiplier(this.tick, level.traffic.cycle, level.traffic.peak)
    const offered = zero()
    for (const t of REQ_TYPES) offered[t] = level.traffic.base[t] * m * (0.95 + 0.1 * this.rng())
    const offeredTotal = REQ_TYPES.reduce((s, t) => s + offered[t], 0)

    const arr = new Map<string, { flow: Rates; lat: Rates }>()
    const edgeFlow = new Map<string, Rates>()
    const out = (from: string, target: string, flow: Rates, lat: Rates, share: number) => {
      let a = arr.get(target)
      if (!a) arr.set(target, (a = { flow: zero(), lat: zero() }))
      const key = `${from}>${target}`
      const ef = edgeFlow.get(key) ?? zero()
      for (const t of REQ_TYPES) {
        const f = flow[t] * share
        a.lat[t] = a.flow[t] + f > 0 ? (a.lat[t] * a.flow[t] + lat[t] * f) / (a.flow[t] + f) : 0
        a.flow[t] += f
        ef[t] += f
      }
      edgeFlow.set(key, ef)
    }
    const targetsOf = (id: string, types: string[]) =>
      design.edges.filter((e) => e.from === id).map((e) => byId.get(e.to)).filter((n): n is DNode => !!n && types.includes(n.type))
    const split = (from: string, flow: Rates, lat: Rates, ts: DNode[]) => {
      const sum = ts.reduce((s, n) => s + eff(n), 0)
      for (const n of ts) out(from, n.id, flow, lat, eff(n) / sum)
    }

    const states: Record<string, NodeState> = {}
    let doneFlow = 0
    let doneLat = 0

    for (const n of nodes) {
      if (n.type === 'users') {
        const ts = targetsOf(n.id, ['lb', 'app'])
        if (ts.length) split(n.id, offered, zero(), ts)
        continue
      }
      const a = arr.get(n.id) ?? { flow: zero(), lat: zero() }
      const p = PARAMS[n.type]
      const work = REQ_TYPES.reduce((s, t) => s + a.flow[t] * p.weight[t], 0)
      const cap = p.cap * eff(n)
      const util = work / cap
      const queued = (this.backlog[n.id] ?? 0) + work
      const back = queued - Math.min(cap, queued)
      const maxQ = cap * 1.5
      const dropWork = Math.max(0, back - maxQ)
      this.backlog[n.id] = Math.min(back, maxQ)
      const served = work > 0 ? Math.max(0, 1 - dropWork / work) : 1
      const latency = Math.min(p.baseMs / (1 - Math.min(util, 0.95)) + (this.backlog[n.id] / cap) * 1000, 5000)
      states[n.id] = { util, health: healthOf(util, dropWork), instances: eff(n), queue: this.backlog[n.id] / maxQ, dropFrac: 1 - served, latencyMs: latency }

      const flow = zero()
      const lat = zero()
      for (const t of REQ_TYPES) { flow[t] = a.flow[t] * served; lat[t] = a.lat[t] + latency }
      if (n.type === 'lb') split(n.id, flow, lat, targetsOf(n.id, ['app']))
      else if (n.type === 'app') {
        const dbs = targetsOf(n.id, ['db'])
        const stores = targetsOf(n.id, ['storage'])
        const route = (types: ReqType[], ts: DNode[]) => {
          if (!ts.length) return
          const f = zero()
          const l = zero()
          for (const t of types) { f[t] = flow[t]; l[t] = lat[t] }
          split(n.id, f, l, ts)
        }
        if (!dbs.length && !stores.length) {
          // An app with nothing behind it answers from its own memory (tutorial shape).
          for (const t of REQ_TYPES) { doneFlow += flow[t]; doneLat += flow[t] * lat[t] }
        } else {
          route(['read', 'write'], dbs)
          route(['photo', 'upload'], stores.length ? stores : dbs)
        }
      } else {
        for (const t of REQ_TYPES) { doneFlow += flow[t]; doneLat += flow[t] * lat[t] }
      }
    }

    const edges: EdgeState[] = design.edges.map((e) => ({
      from: e.from,
      to: e.to,
      flow: edgeFlow.get(`${e.from}>${e.to}`) ?? zero(),
      failFrac: states[e.to]?.dropFrac ?? 0,
    }))
    const errors = Math.max(0, offeredTotal - doneFlow)
    const errorRate = offeredTotal > 0 ? errors / offeredTotal : 0
    const p50 = doneFlow > 0 ? doneLat / doneFlow : offeredTotal > 0 ? 5000 : 0
    const p95 = Math.min(p50 * 1.5, 9999)
    const metrics: Metrics = { rps: offeredTotal, p50, p95, errorRate, cost: this.cost(), availability: 1 - errorRate }
    this.history.push({ offered: offeredTotal, errors, p95 })

    for (const n of design.nodes) if (n.type === 'users') {
      states[n.id] = { util: 0, health: errorRate > 0.05 ? 'failing' : p95 > level.slo.p95Ms ? 'overloaded' : 'healthy', instances: 1, queue: 0, dropFrac: 0, latencyMs: 0 }
    }
    const mood: Mood = errorRate > 0.05 || p95 > 1000 ? 'leaving' : errorRate > 0.005 || p95 > level.slo.p95Ms ? 'impatient' : 'happy'

    const events = this.detect(states, errorRate)
    this.tick++
    return { tick: this.tick, nodes: states, edges, metrics, mood, events, open: Object.values(this.incidents).filter((i) => i.resolvedTick === undefined), done: this.tick >= this.total }
  }

  private detect(states: Record<string, NodeState>, errorRate: number): Snapshot['events'] {
    const events: Snapshot['events'] = []
    for (const id of Object.keys(states).sort()) {
      const s = states[id]
      const type = this.design.nodes.find((n) => n.id === id)?.type
      if (!type || type === 'users') continue
      const failing = s.util >= 1 || s.dropFrac > 0
      this.hot[id] = failing ? (this.hot[id] ?? 0) + 1 : 0
      this.slow[id] = s.util >= 0.85 ? (this.slow[id] ?? 0) + 1 : 0
      this.cool[id] = s.util < 0.9 && !failing ? (this.cool[id] ?? 0) + 1 : 0
      const cur = this.incidents[id]
      const open = !!cur && cur.resolvedTick === undefined
      const label = PARAMS[type].label
      const pct = Math.round(s.util * 100)
      if (this.hot[id] >= 3 && (!open || cur.severity === 3)) {
        const severity = errorRate > 0.2 ? 1 : 2
        const inc: Incident = { id: `${id}#${this.tick}`, node: id, severity, name: `SEV-${severity}: ${label} at ${pct}% capacity, requests timing out`, openedTick: this.tick }
        this.incidents[id] = inc
        events.push({ type: 'opened', incident: inc })
      } else if (this.slow[id] >= 5 && !open) {
        const inc: Incident = { id: `${id}#${this.tick}`, node: id, severity: 3, name: `SEV-3: ${label} running hot at ${pct}% capacity`, openedTick: this.tick }
        this.incidents[id] = inc
        events.push({ type: 'opened', incident: inc })
      } else if (open && this.cool[id] >= 3) {
        cur.resolvedTick = this.tick
        events.push({ type: 'resolved', incident: { ...cur } })
      }
    }
    return events
  }

  // SLOs are judged over the final full traffic cycle only (product PRD, "Definitions").
  evaluate(runs: number, hintsUsed: number): Evaluation & { senior: boolean } {
    const { level } = this
    const last = this.history.slice(-level.traffic.cycle)
    const offered = last.reduce((s, h) => s + h.offered, 0)
    const errRate = offered > 0 ? last.reduce((s, h) => s + h.errors, 0) / offered : 1
    const sorted = last.map((h) => h.p95).sort((a, b) => a - b)
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 9999
    const present = new Set(this.design.nodes.map((n) => n.type))
    const missing = level.minDesign.filter((t) => !present.has(t))
    const slos = [
      { name: 'p95 latency', pass: p95 <= level.slo.p95Ms, measured: `${Math.round(p95)} ms`, target: `under ${level.slo.p95Ms} ms` },
      { name: 'Error rate', pass: errRate <= level.slo.errorRate, measured: `${(errRate * 100).toFixed(2)}%`, target: `under ${(level.slo.errorRate * 100).toFixed(1)}%` },
    ]
    const cost = this.cost()
    const ship = slos.every((s) => s.pass) && missing.length === 0 && this.history.length >= this.total
    return { slos, missing, ship, thrifty: ship && cost <= level.budget, cost, senior: ship && hintsUsed === 0 && runs <= 2 }
  }

  hash(): string {
    return this.history.map((h) => `${h.offered.toFixed(3)}:${h.errors.toFixed(3)}:${h.p95.toFixed(2)}`).join('|')
  }
}

// Replay: seed + start design + edit log reproduces a run exactly.
export function runAll(level: Level, design: Design, seed: number, editLog: EditEntry[] = []): Sim {
  const sim = new Sim(level, design, seed)
  const log = [...editLog]
  while (sim.tick < sim.total) {
    while (log.length && log[0].tick <= sim.tick) sim.apply(log.shift()!.command)
    sim.step()
  }
  return sim
}
