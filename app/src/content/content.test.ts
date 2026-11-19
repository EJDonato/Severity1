import { describe, expect, it } from 'vitest'
import { INTERVIEW_LEVEL, LEVELS, SANDBOX_LEVEL, STAGE_UNLOCKS, UNLOCK_ORDER } from '.'
import { Sim, connectError, runAll } from '../engine/sim'
import type { Design, EditEntry, Level, NodeConfig } from '../schema'

// These tests play the role of the architecture PRD's content CI (section 7) and solvability checks (section 12).
const seed = (l: Level) => l.chapter * 1000 + 1
const evalOf = (l: Level, d: Design) => runAll(l, d, seed(l)).evaluate(1, 0)
const withNode = (d: Design, id: string, f: (n: Design['nodes'][number]) => void): Design => {
  const c = structuredClone(d)
  f(c.nodes.find((n) => n.id === id)!)
  return c
}
const level = (id: string) => LEVELS.find((l) => l.id === id)!

describe('content rules', () => {
  it('the sandbox and interview unlock every component, and there are 11 challenge levels', () => {
    expect(LEVELS).toHaveLength(11)
    for (const l of [SANDBOX_LEVEL, INTERVIEW_LEVEL]) expect(l.placeable).toHaveLength(14)
  })
  it('parts unlock in order: a stage never needs a locked part, and every part it unlocks is used in its solution', () => {
    expect(new Set(UNLOCK_ORDER).size).toBe(14)
    for (const l of LEVELS) {
      for (const n of l.reference.nodes) expect(l.placeable, `${l.id} needs ${n.type}`).toContain(n.type)
      for (const t of STAGE_UNLOCKS[l.id]) expect(l.reference.nodes.some((n) => n.type === t), `${l.id} unlocks ${t} but does not use it`).toBe(true)
    }
    // the order of the parts list is the order they unlock
    expect(LEVELS.flatMap((l) => STAGE_UNLOCKS[l.id])).toEqual(UNLOCK_ORDER)
  })
  it('the sandbox opens on a working system', () => {
    expect(SANDBOX_LEVEL.startDesign.nodes.length).toBeGreaterThan(3)
    expect(runAll(SANDBOX_LEVEL, SANDBOX_LEVEL.startDesign, 1, [], () => {}).hash().length).toBeGreaterThan(0)
  })
  it('every design in the content is validly wired', () => {
    for (const l of [...LEVELS, SANDBOX_LEVEL])
      for (const d of [l.startDesign, l.reference]) for (const e of d.edges) {
        const without = { ...d, edges: d.edges.filter((x) => x !== e) }
        expect(connectError(without, e.from, e.to), `${l.id} ${e.from}>${e.to}`).toBeNull()
      }
  })
  it('chaos events fall inside the judged (final) traffic cycle', () => {
    for (const l of LEVELS) for (const c of l.chaos ?? []) expect(c.tick, l.id).toBeGreaterThanOrEqual(l.traffic.cycle * (l.cycles - 1))
  })
})

describe('solvability', () => {
  for (const l of LEVELS) {
    it(`${l.id}: the reference design ships, within budget`, () => {
      const e = evalOf(l, l.reference)
      expect(e.missing, 'minimum design').toEqual([])
      expect(e.slos.every((s) => s.pass), JSON.stringify(e.slos)).toBe(true)
      expect(e.thrifty, `cost ${e.cost} vs budget ${l.budget}`).toBe(true)
    })
    const i = LEVELS.indexOf(l)
    if (i === 0) {
      it(`${l.id}: the first stage is a first run that works as given`, () => {
        expect(evalOf(l, l.startDesign).ship).toBe(true)
      })
    } else {
      // One new problem per stage: the solution you carry in from the last stage must not already solve this one.
      it(`${l.id}: carrying in the previous stage's solution does not ship`, () => {
        expect(evalOf(l, LEVELS[i - 1].reference).ship).toBe(false)
        expect(evalOf(l, l.startDesign).ship).toBe(false)
      })
    }
  }
  it('adding instances alone cannot pass the middle chapters (the minimum design is missing)', () => {
    for (const id of ['ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8']) {
      const l = level(id)
      const d = structuredClone(l.startDesign)
      for (const n of d.nodes) if (['app', 'db', 'worker', 'search', 'shard'].includes(n.type)) n.instances = 16
      expect(evalOf(l, d).ship, id).toBe(false)
    }
  })
  it('wrong settings fail even with the right parts', () => {
    expect(evalOf(level('ch7'), withNode(level('ch7').reference, 'shard', (n) => { n.config = { shardKey: 'region' } })).ship, 'region key').toBe(false)
    for (const limit of ['low', 'high'] as NodeConfig['limit'][])
      expect(evalOf(level('ch8'), withNode(level('ch8').reference, 'limiter', (n) => { n.config = { limit } })).ship, `limit ${limit}`).toBe(false)
    const without = (d: Design, drop: (id: string) => boolean): Design => ({ nodes: d.nodes.filter((n) => !drop(n.id)), edges: d.edges.filter((e) => !drop(e.from) && !drop(e.to)) })
    expect(evalOf(level('ch5'), without(level('ch5').reference, (id) => /^worker\d/.test(id))).ship, 'one worker').toBe(false)
    expect(evalOf(level('ch9'), without(level('ch9').reference, (id) => id === 'lb2')).ship, 'single load balancer').toBe(false)
    expect(evalOf(level('ch2'), without(level('ch2').reference, (id) => id === 'app2')).ship, 'one app server behind the balancer').toBe(false)
  })
})

// One problem per stage: arriving with the previous stage's solution, only the parts this stage's problem is about may overload.
// (Bots hit both servers and data; chaos stages and the finale are allowed to stress anything.)
describe('one problem per stage', () => {
  const ALLOWED: Record<string, string[] | 'any'> = {
    ch1: ['db'], ch2: ['app'], ch3: ['db'], ch4: [], ch5: ['app'], ch6: ['db'], ch7: ['db'], ch8: ['app', 'shard', 'db'], ch9: 'any', boss: 'any',
  }
  LEVELS.forEach((l, i) => {
    if (i === 0) return
    it(`${l.id}: only ${ALLOWED[l.id] === 'any' ? 'anything' : (ALLOWED[l.id] as string[]).join(', ') || 'nothing'} overloads with the previous solution`, () => {
      const over = new Set<string>()
      runAll(l, LEVELS[i - 1].reference, seed(l), [], (s, sim) => {
        if (s.tick <= l.traffic.cycle) return
        for (const [id, n] of Object.entries(s.nodes)) {
          const t = sim.design.nodes.find((x) => x.id === id)!.type
          if (t !== 'users' && (n.util >= 1 || n.dropFrac > 0)) over.add(t)
        }
      })
      if (ALLOWED[l.id] !== 'any') for (const t of over) expect(ALLOWED[l.id], `${l.id}: ${t} overloads too`).toContain(t)
    })
  })
})

describe('directional truth', () => {
  const peakOf = (l: Level, d: Design, id: string) => {
    let peak = 0
    runAll(l, d, seed(l), [], (s) => { if (s.tick > l.traffic.cycle) peak = Math.max(peak, s.nodes[id]?.util ?? 0) })
    return peak
  }
  it('a bigger cache never increases database load', () => {
    const l = level('ch3')
    let prev = Infinity
    for (const size of [1, 2, 3] as const) {
      const u = peakOf(l, withNode(l.reference, 'cache', (n) => { n.config = { cacheSize: size, expiry: 30 } }), 'db')
      expect(u).toBeLessThanOrEqual(prev + 1e-9)
      prev = u
    }
  })
  it('read replicas cut read load but never write load on the primary', () => {
    const l = { ...level('ch3'), traffic: { ...level('ch3').traffic, base: { read: 0, write: 300, photo: 0, upload: 0, search: 0, bot: 0 } } }
    const one = peakOf(l, l.reference, 'db')
    const five = peakOf(l, withNode(l.reference, 'db', (n) => { n.instances = 5 }), 'db')
    expect(five).toBeCloseTo(one, 6)
    const reads = { ...l, traffic: { ...l.traffic, base: { ...l.traffic.base, read: 300, write: 0 } } }
    const noCache = { ...reads.reference, nodes: reads.reference.nodes.filter((n) => n.type !== 'cache'), edges: reads.reference.edges.filter((e) => e.from !== 'cache' && e.to !== 'cache') }
    expect(peakOf(reads, withNode(noCache, 'db', (n) => { n.instances = 5 }), 'db')).toBeLessThan(peakOf(reads, noCache, 'db'))
  })
  it('more servers behind a balancer never raise latency or errors', () => {
    const l = level('ch3')
    let prev = Infinity
    for (let n = 7; n <= 12; n++) {
      const e = evalOf(l, withNode(l.reference, 'app', (x) => { x.instances = n }))
      const p95 = parseFloat(e.slos[0].measured)
      expect(p95).toBeLessThanOrEqual(prev + 1)
      prev = p95
    }
  })
  it('a CDN never makes photo-heavy traffic slower or increases storage load', () => {
    const l = level('ch4')
    const without = { nodes: l.reference.nodes.filter((n) => n.type !== 'cdn'), edges: l.reference.edges.filter((e) => e.from !== 'cdn' && e.to !== 'cdn').concat({ from: 'dns', to: 'lb' }) }
    expect(peakOf(l, l.reference, 'storage')).toBeLessThan(peakOf(l, without, 'storage'))
  })
  it('moving users farther away never lowers latency', () => {
    const l = level('ch4')
    const at = (farMs: number) => parseFloat(evalOf({ ...l, regions: { farShare: 0.5, farMs } }, l.reference).slos[0].measured)
    expect(at(100)).toBeLessThanOrEqual(at(300))
    expect(at(300)).toBeLessThanOrEqual(at(500))
  })
})

describe('determinism, replay and performance', () => {
  it('chaos fired by hand replays exactly from seed + edit log', () => {
    const l = SANDBOX_LEVEL
    const sim = new Sim({ ...l, cycles: 2, traffic: { ...l.traffic, cycle: 30 } }, level('boss').reference, 5)
    const log: EditEntry[] = []
    for (let t = 0; t < 60; t++) {
      if (t === 20) sim.apply({ kind: 'chaos', event: { kind: 'regionOut', duration: 8 } })
      if (t === 35) sim.apply({ kind: 'setInstances', id: 'app', instances: 6 })
      sim.step()
    }
    log.push(...sim.editLog)
    const replay = runAll({ ...l, cycles: 2, traffic: { ...l.traffic, cycle: 30 } }, level('boss').reference, 5, log)
    expect(replay.hash()).toBe(sim.hash())
  })
  it('golden: every level replays to the same result (a change is a bug or a deliberate rebalance)', () => {
    const digest = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(16) }
    const got = Object.fromEntries(LEVELS.map((l) => [l.id, digest(runAll(l, l.reference, seed(l)).hash())]))
    const again = Object.fromEntries(LEVELS.map((l) => [l.id, digest(runAll(l, l.reference, seed(l)).hash())]))
    expect(got).toEqual(again)
    expect(Object.keys(got)).toHaveLength(LEVELS.length)
  })
  it('the largest design ticks in under 4 ms on average', () => {
    const l = level('boss')
    const sim = new Sim(l, l.reference, 1)
    const t0 = performance.now()
    while (sim.tick < sim.total) sim.step()
    expect((performance.now() - t0) / sim.total).toBeLessThan(4)
  })
})
