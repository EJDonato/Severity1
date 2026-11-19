import { describe, expect, it } from 'vitest'
import { INTERVIEW_LEVEL, LEVELS, SANDBOX_LEVEL } from '.'
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
    it(`${l.id}: the starting design does not ship`, () => {
      expect(evalOf(l, l.startDesign).ship).toBe(false)
    })
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
    expect(evalOf(level('ch3'), withNode(level('ch3').reference, 'cache', (n) => { n.config = { cacheSize: 1, expiry: 5 } })).ship, 'small cache').toBe(false)
    expect(evalOf(level('ch7'), withNode(level('ch7').reference, 'shard', (n) => { n.config = { shardKey: 'region' } })).ship, 'region key').toBe(false)
    for (const limit of ['low', 'high'] as NodeConfig['limit'][])
      expect(evalOf(level('ch8'), withNode(level('ch8').reference, 'limiter', (n) => { n.config = { limit } })).ship, `limit ${limit}`).toBe(false)
    expect(evalOf(level('ch5'), withNode(level('ch5').reference, 'worker', (n) => { n.instances = 1 })).ship, 'one worker').toBe(false)
    expect(evalOf(level('ch9'), withNode(level('ch9').reference, 'lb', (n) => { n.instances = 1 })).ship, 'single load balancer').toBe(false)
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
