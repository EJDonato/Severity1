import { makeRng } from './rng'
import { PARAMS, REQ_TYPES, costOf } from '../schema'
import type {
  ChaosEvent, ChaosKind, Command, CType, DNode, Design, EdgeState, EditEntry, Evaluation, Health, Incident, Level, Metrics, Mood, NodeState, Rates, ReqType, SimEvent, Snapshot,
} from '../schema'

const RANK: Record<CType, number> = { users: 0, dns: 1, limiter: 2, cdn: 2, lb: 3, app: 4, cache: 5, queue: 6, worker: 7, db: 8, shard: 8, search: 8, storage: 8, monitor: 9 }
const zero = (): Rates => ({ read: 0, write: 0, photo: 0, upload: 0, search: 0, bot: 0 })
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
export const CHAOS_NAMES: Record<ChaosKind, string> = {
  crash: 'Instance crash', regionOut: 'Region outage', cacheFlush: 'Cache flush', spike: 'Traffic spike', badDeploy: 'Bad deploy', botAttack: 'Bot attack',
}
const QUEUE_LIMIT = 4000
const WARMUP_TICKS = 12
const CACHE_HIT = [0.55, 0.72, 0.86]
const EXPIRY_FACTOR: Record<number, number> = { 5: 0.9, 15: 0.96, 30: 1 }
const LIMITER = { low: { block: 0.92, fp: 0.04 }, medium: { block: 0.75, fp: 0.005 }, high: { block: 0.35, fp: 0 } }
const CDN_HIT = 0.9

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

// Allowed wiring. Requests flow left to right; each pair names why it is allowed.
const OK: Record<string, CType[]> = {
  users: ['dns', 'cdn', 'limiter', 'lb', 'app'],
  dns: ['cdn', 'limiter', 'lb', 'app'],
  limiter: ['lb', 'app'],
  lb: ['app'],
  app: ['cache', 'db', 'shard', 'storage', 'search', 'queue'],
  cache: ['db', 'shard'],
  cdn: ['storage'],
  queue: ['worker'],
}
export function connectError(d: Design, from: string, to: string): string | null {
  const a = d.nodes.find((n) => n.id === from)
  const b = d.nodes.find((n) => n.id === to)
  if (!a || !b || from === to) return 'Pick two different components.'
  if (d.edges.some((e) => e.from === from && e.to === to)) return 'Already connected.'
  if (b.type === 'users') return 'Nothing sends traffic to users; requests flow away from them.'
  if (a.type === 'users' && ['db', 'shard', 'storage', 'search', 'cache'].includes(b.type)) return `Users should never talk to the ${PARAMS[b.type].label} directly. Go through an app server.`
  if (a.type === 'monitor' || b.type === 'monitor') return 'Monitoring watches the whole system; it does not need wires.'
  // One front door reaches one App Server. Sharing traffic between several is the Load Balancer's job.
  if (b.type === 'app' && ['users', 'dns', 'limiter'].includes(a.type) && d.edges.some((e) => e.from === from && d.nodes.find((n) => n.id === e.to)?.type === 'app'))
    return `${PARAMS[a.type].label} can only send to one App Server. Add a Load Balancer to share traffic between several.`
  if (!(OK[a.type] ?? []).includes(b.type)) return `${PARAMS[a.type].label} can't send requests to ${PARAMS[b.type].label}.`
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
  } else if (command.kind === 'setInstances') {
    const n = d.nodes.find((x) => x.id === command.id)
    if (!n) return 'unknown node'
    n.instances = Math.max(1, Math.min(16, Math.round(command.instances)))
  } else if (command.kind === 'move') {
    const n = d.nodes.find((x) => x.id === command.id)
    if (!n) return 'unknown node'
    n.x = command.x
    n.y = command.y
  } else if (command.kind === 'setConfig') {
    const n = d.nodes.find((x) => x.id === command.id)
    if (!n) return 'unknown node'
    n.config = { ...n.config, ...command.config }
  }
  return null
}

interface Active { kind: ChaosKind; target?: CType; until: number; magnitude: number }

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
  private active: Active[] = []
  private coldFrom: Record<string, number> = {}
  private pendingChaos: SimEvent[] = []

  constructor(level: Level, design: Design, seed: number) {
    this.level = level
    this.design = clone(design)
    this.rng = makeRng(seed)
    this.total = level.traffic.cycle * level.cycles
    for (const n of this.design.nodes) if (n.type === 'cache') this.coldFrom[n.id] = 0
  }

  apply(command: Command): string | null {
    if (command.kind === 'chaos') {
      this.fire({ tick: this.tick, ...command.event })
    } else {
      const err = applyTo(this.design, command)
      if (err) return err
      if (command.kind === 'place' && command.node.type === 'cache') this.coldFrom[command.node.id] = this.tick
    }
    this.editLog.push({ tick: this.tick, command: clone(command) })
    return null
  }

  private hasType(t: CType) { return this.design.nodes.some((n) => n.type === t) }

  private fire(e: ChaosEvent) {
    // Alerts let the on-call fix things fast: with Monitoring a crash is healed in a few ticks.
    const duration = e.kind === 'crash' && this.hasType('monitor') ? Math.min(e.duration, 6) : e.duration
    if (e.kind === 'cacheFlush') {
      for (const n of this.design.nodes) if (n.type === 'cache') this.coldFrom[n.id] = this.tick
    } else {
      this.active.push({ kind: e.kind, target: e.target, until: this.tick + duration, magnitude: e.magnitude ?? (e.kind === 'spike' ? 2.2 : e.kind === 'botAttack' ? 8 : 1) })
    }
    this.pendingChaos.push({ type: 'chaos', name: CHAOS_NAMES[e.kind], kind: e.kind })
  }

  private cost(): number {
    return this.design.nodes.reduce((s, n) => s + costOf(n), 0)
  }

  step(): Snapshot {
    const { level, design } = this
    const tick = this.tick
    for (const e of level.chaos ?? []) if (e.tick === tick) this.fire(e)
    this.active = this.active.filter((a) => a.until > tick)
    const events: SimEvent[] = this.pendingChaos.splice(0)
    const chaos = (k: ChaosKind) => this.active.find((a) => a.kind === k)

    const nodes = [...design.nodes].sort((a, b) => RANK[a.type] - RANK[b.type] || (a.id < b.id ? -1 : 1))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const fedByLb = new Set(design.edges.filter((e) => byId.get(e.from)?.type === 'lb').map((e) => e.to))
    const hasDns = this.hasType('dns')
    const regionOut = chaos('regionOut')
    // Effective instances after wiring rules and chaos. Stateless servers only scale out behind a balancer.
    // Machines are separate parts on the board, so failures take out whole machines.
    // A crash removes one machine of its target type (or one replica/shard of a database);
    // a region outage removes a third of the App Servers when DNS can fail over, and everything when it cannot.
    const base = (n: DNode) => (n.type === 'app' && !fedByLb.has(n.id) ? 1 : ['lb', 'app', 'db', 'shard', 'worker', 'search'].includes(n.type) ? n.instances : 1)
    const lost = new Map<string, number>()
    for (const a of this.active) {
      if (a.kind !== 'crash' || !a.target) continue
      const victim = nodes.filter((n) => n.type === a.target).find((n) => base(n) - (lost.get(n.id) ?? 0) > 0)
      if (victim) lost.set(victim.id, (lost.get(victim.id) ?? 0) + 1)
    }
    if (regionOut && hasDns) {
      const apps = nodes.filter((n) => n.type === 'app')
      let need = Math.ceil(apps.reduce((s, n) => s + base(n), 0) / 3)
      for (const n of apps) {
        if (need <= 0) break
        const left = base(n) - (lost.get(n.id) ?? 0)
        const take = Math.min(left, need)
        lost.set(n.id, (lost.get(n.id) ?? 0) + take)
        need -= take
      }
    }
    const eff = (n: DNode): number => {
      if (regionOut && !hasDns && ['app', 'lb', 'cache', 'db', 'shard', 'search', 'queue', 'worker'].includes(n.type)) return 0
      return Math.max(0, base(n) - (lost.get(n.id) ?? 0))
    }
    const capMult = (n: DNode) => (n.type === 'app' && chaos('badDeploy') ? 0.5 : 1)

    const spike = chaos('spike')?.magnitude ?? 1
    const m = (level.traffic.flat ? 1 : multiplier(tick, level.traffic.cycle, level.traffic.peak)) * spike
    const offered = zero()
    for (const t of REQ_TYPES) offered[t] = level.traffic.base[t] * m * (0.95 + 0.1 * this.rng())
    const attack = chaos('botAttack')
    if (attack) offered.bot *= attack.magnitude
    const legit = (r: Rates) => r.read + r.write + r.photo + r.upload + r.search
    const offeredTotal = legit(offered)
    const botTotal = offered.bot
    const fanout = level.traffic.fanout ?? 0
    const far = level.regions ? level.regions.farShare * level.regions.farMs * (hasDns ? 0.5 : 1) : 0

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
    const targetsOf = (id: string, types: CType[]) =>
      design.edges.filter((e) => e.from === id).map((e) => byId.get(e.to)).filter((n): n is DNode => !!n && types.includes(n.type))
    // Send the given request types to a target set, split by effective capacity. Dead targets receive nothing (those requests fail).
    const send = (from: string, flow: Rates, lat: Rates, types: ReqType[], ts: DNode[]) => {
      const live = ts.filter((n) => eff(n) > 0)
      const sum = live.reduce((s, n) => s + eff(n), 0)
      const f = zero(), l = zero()
      for (const t of types) { f[t] = flow[t]; l[t] = lat[t] }
      for (const n of live) out(from, n.id, f, l, eff(n) / sum)
      for (const n of ts) if (eff(n) === 0) { const k = `${from}>${n.id}`; if (!edgeFlow.has(k)) edgeFlow.set(k, zero()); const ef = edgeFlow.get(k)!; for (const t of types) ef[t] += f[t] / ts.length }
    }
    const ALL = REQ_TYPES
    const NOT_PHOTO = REQ_TYPES.filter((t) => t !== 'photo')

    const states: Record<string, NodeState> = {}
    let doneFlow = 0
    let doneLat = 0
    let lostJobs = 0
    const complete = (flow: Rates, lat: Rates) => {
      for (const t of REQ_TYPES) if (t !== 'bot') { doneFlow += flow[t]; doneLat += flow[t] * lat[t] }
    }

    for (const n of nodes) {
      if (n.type === 'users') {
        const lat = zero()
        for (const t of REQ_TYPES) lat[t] = t === 'bot' ? 0 : far
        const cdns = targetsOf(n.id, ['cdn'])
        const doors = targetsOf(n.id, ['dns', 'limiter', 'lb', 'app'])
        send(n.id, offered, lat, cdns.length ? NOT_PHOTO : ALL, doors)
        if (cdns.length) send(n.id, offered, lat, ['photo'], cdns)
        continue
      }
      const a = arr.get(n.id) ?? { flow: zero(), lat: zero() }
      const p = PARAMS[n.type]
      const e = eff(n)
      const cap = p.cap * e * capMult(n)

      // ---- queue and worker are asynchronous: they never sit on a user's request path
      if (n.type === 'queue') {
        const workers = targetsOf(n.id, ['worker'])
        const drainCap = workers.reduce((s, w) => s + PARAMS.worker.cap * eff(w), 0)
        const jobs = a.flow.write
        const queued = (this.backlog[n.id] ?? 0) + jobs
        const drain = Math.min(queued, drainCap)
        let back = queued - drain
        const spill = Math.max(0, back - QUEUE_LIMIT)
        back = Math.min(back, QUEUE_LIMIT)
        this.backlog[n.id] = back
        lostJobs += spill
        const util = back / QUEUE_LIMIT
        states[n.id] = { util, health: spill > 0 ? 'failing' : healthOf(util * 0.9, 0), instances: 1, queue: util, dropFrac: jobs > 0 ? spill / jobs : 0, latencyMs: 0 }
        const f = zero(); f.write = drain
        send(n.id, f, zero(), ['write'], workers)
        continue
      }
      if (n.type === 'worker') {
        const work = a.flow.write
        const util = cap > 0 ? work / cap : 0
        states[n.id] = { util, health: e === 0 ? 'down' : healthOf(util, 0), instances: e, queue: 0, dropFrac: e === 0 ? 1 : 0, latencyMs: 0 }
        continue
      }
      if (n.type === 'monitor') {
        states[n.id] = { util: 0, health: 'healthy', instances: 1, queue: 0, dropFrac: 0, latencyMs: 0 }
        continue
      }

      // ---- work, capacity and utilization
      let work = REQ_TYPES.reduce((s, t) => s + a.flow[t] * p.weight[t], 0)
      let capEff = cap
      if (n.type === 'app') work += a.flow.write * (!targetsOf(n.id, ['queue']).length ? fanout : 0)
      if (n.type === 'db') {
        // Read replicas share reads; every write lands on the primary (directional truth).
        const w = a.flow.write * 2 + a.flow.upload * 12 + a.flow.bot * 2
        const r = a.flow.read + a.flow.photo * 10 + a.flow.search * 25
        work = w + r / Math.max(1, e)
        capEff = e === 0 ? 0 : p.cap * capMult(n)
      }
      if (n.type === 'shard') {
        // The busiest shard sets the pace: hashing by user spreads load, a poor key leaves a hot shard.
        const share = n.config?.shardKey === 'region' ? 0.75 : Math.min(1, 1.25 / Math.max(1, e))
        work *= share
        capEff = e === 0 ? 0 : p.cap
      }
      const util = capEff > 0 ? work / capEff : work > 0 ? 9 : 0
      const queued = (this.backlog[n.id] ?? 0) + work
      const back = queued - Math.min(capEff, queued)
      const maxQ = capEff * 1.5
      const dropWork = capEff > 0 ? Math.max(0, back - maxQ) : work
      this.backlog[n.id] = capEff > 0 ? Math.min(back, maxQ) : 0
      const served = e === 0 ? 0 : work > 0 ? Math.max(0, 1 - dropWork / work) : 1
      const latency = e === 0 ? 0 : Math.min(p.baseMs / (1 - Math.min(util, 0.95)) + (capEff > 0 ? (this.backlog[n.id] / capEff) * 1000 : 0), 5000)
      states[n.id] = {
        util: Math.min(util, 9), health: e === 0 ? 'down' : healthOf(util, dropWork), instances: e,
        queue: maxQ > 0 ? this.backlog[n.id] / maxQ : 0, dropFrac: 1 - served, latencyMs: latency,
      }

      const flow = zero()
      const lat = zero()
      for (const t of REQ_TYPES) { flow[t] = a.flow[t] * served; lat[t] = a.lat[t] + latency }

      // ---- routing and completion
      if (n.type === 'dns') {
        const cdns = targetsOf(n.id, ['cdn'])
        const doors = targetsOf(n.id, ['limiter', 'lb', 'app'])
        send(n.id, flow, lat, cdns.length ? NOT_PHOTO : ALL, doors)
        if (cdns.length) send(n.id, flow, lat, ['photo'], cdns)
      } else if (n.type === 'limiter') {
        const cfg = LIMITER[n.config?.limit ?? 'medium']
        const f = { ...flow }
        f.bot *= 1 - cfg.block
        for (const t of REQ_TYPES) if (t !== 'bot') f[t] *= 1 - cfg.fp
        send(n.id, f, lat, ALL, targetsOf(n.id, ['lb', 'app']))
      } else if (n.type === 'lb') {
        send(n.id, flow, lat, ALL, targetsOf(n.id, ['app']))
      } else if (n.type === 'cdn') {
        const hit = CDN_HIT
        const edge = zero(), el = zero()
        edge.photo = flow.photo * hit
        el.photo = latency + a.lat.photo * 0.15 // edge hits skip most of the distance penalty
        complete(edge, el)
        const miss = zero()
        miss.photo = flow.photo * (1 - hit)
        send(n.id, miss, lat, ['photo'], targetsOf(n.id, ['storage']))
      } else if (n.type === 'app') {
        const caches = targetsOf(n.id, ['cache'])
        const dbs = targetsOf(n.id, ['db', 'shard'])
        const stores = targetsOf(n.id, ['storage'])
        const searches = targetsOf(n.id, ['search'])
        const queues = targetsOf(n.id, ['queue'])
        if (!caches.length && !dbs.length && !stores.length && !searches.length) {
          complete(flow, lat) // an app with nothing behind it answers from its own memory (tutorial shape)
        } else {
          send(n.id, flow, lat, ['read'], caches.length ? caches : dbs)
          send(n.id, flow, lat, ['write', 'bot'], dbs)
          send(n.id, flow, lat, ['photo', 'upload'], stores.length ? stores : dbs)
          send(n.id, flow, lat, ['search'], searches.length ? searches : dbs)
          if (queues.length && fanout > 0) {
            const jobs = zero()
            jobs.write = flow.write * fanout
            send(n.id, jobs, zero(), ['write'], queues)
          }
        }
      } else if (n.type === 'cache') {
        const size = n.config?.cacheSize ?? 2
        const warm = Math.min(1, (tick - (this.coldFrom[n.id] ?? 0)) / WARMUP_TICKS)
        const hit = CACHE_HIT[size - 1] * (EXPIRY_FACTOR[n.config?.expiry ?? 30] ?? 1) * Math.max(0, warm)
        const hits = zero(), miss = zero()
        hits.read = flow.read * hit
        miss.read = flow.read * (1 - hit)
        complete(hits, lat)
        send(n.id, miss, lat, ['read'], targetsOf(n.id, ['db', 'shard']))
      } else {
        complete(flow, lat) // db, shard, search, storage are the end of a request's path
      }
    }

    const edges: EdgeState[] = design.edges.map((e) => ({
      from: e.from,
      to: e.to,
      flow: edgeFlow.get(`${e.from}>${e.to}`) ?? zero(),
      failFrac: states[e.to]?.dropFrac ?? 0,
    }))
    const lostRequests = fanout > 0 ? lostJobs / fanout : lostJobs
    const errors = Math.min(offeredTotal, Math.max(0, offeredTotal - doneFlow) + lostRequests)
    const errorRate = offeredTotal > 0 ? errors / offeredTotal : 0
    const p50 = doneFlow > 0 ? doneLat / doneFlow : offeredTotal > 0 ? 5000 : 0
    const p95 = Math.min(p50 * 1.5, 9999)
    const metrics: Metrics = { rps: offeredTotal, botRps: botTotal, p50, p95, errorRate, cost: this.cost(), availability: 1 - errorRate }
    this.history.push({ offered: offeredTotal, errors, p95 })

    for (const n of design.nodes) if (n.type === 'users') {
      states[n.id] = { util: 0, health: errorRate > 0.05 ? 'failing' : p95 > level.slo.p95Ms ? 'overloaded' : 'healthy', instances: 1, queue: 0, dropFrac: 0, latencyMs: 0 }
    }
    const mood: Mood = errorRate > 0.05 || p95 > 1000 ? 'leaving' : errorRate > 0.005 || p95 > level.slo.p95Ms ? 'impatient' : 'happy'

    events.push(...this.detect(states, errorRate))
    this.tick++
    return { tick: this.tick, nodes: states, edges, metrics, mood, events, open: Object.values(this.incidents).filter((i) => i.resolvedTick === undefined), done: this.tick >= this.total }
  }

  private detect(states: Record<string, NodeState>, errorRate: number): SimEvent[] {
    const events: SimEvent[] = []
    for (const id of Object.keys(states).sort()) {
      const s = states[id]
      const type = this.design.nodes.find((n) => n.id === id)?.type
      if (!type || type === 'users' || type === 'monitor') continue
      const failing = s.util >= 1 || s.dropFrac > 0 || s.health === 'down'
      this.hot[id] = failing ? (this.hot[id] ?? 0) + 1 : 0
      this.slow[id] = s.util >= 0.85 ? (this.slow[id] ?? 0) + 1 : 0
      this.cool[id] = s.util < 0.9 && !failing ? (this.cool[id] ?? 0) + 1 : 0
      const cur = this.incidents[id]
      const open = !!cur && cur.resolvedTick === undefined
      const label = PARAMS[type].label
      const pct = Math.round(Math.min(s.util, 9.99) * 100)
      const detail = s.health === 'down' ? 'is down' : `at ${pct}% capacity, requests timing out`
      // With Monitoring on the board an alert fires after 2 ticks; without it the team notices after 3.
      const need = this.design.nodes.some((n) => n.type === 'monitor') ? 2 : 3
      if (this.hot[id] >= need && (!open || cur.severity === 3)) {
        const severity = errorRate > 0.2 ? 1 : 2
        const inc: Incident = { id: `${id}#${this.tick}`, node: id, severity, name: `SEV-${severity}: ${label} ${detail}`, openedTick: this.tick }
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
export function runAll(level: Level, design: Design, seed: number, editLog: EditEntry[] = [], upTo?: (snap: Snapshot, sim: Sim) => void): Sim {
  const sim = new Sim(level, design, seed)
  const log = [...editLog]
  while (sim.tick < sim.total) {
    while (log.length && log[0].tick <= sim.tick) sim.apply(log.shift()!.command)
    const snap = sim.step()
    upTo?.(snap, sim)
  }
  return sim
}
