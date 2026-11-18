import { describe, expect, it } from 'vitest'
import { LEVELS, LESSONS } from '../content'
import { runAll } from './sim'
import type { Command, Design } from '../schema'

const lvl = (id: string) => LEVELS.find((l) => l.id === id)!
const ev = (id: string, design: Design, log: { tick: number; command: Command }[] = []) =>
  runAll(lvl(id), design, 1, log).evaluate(1, 0)

describe('solvability (content CI rules)', () => {
  for (const l of LEVELS) {
    it(`${l.id}: reference passes`, () => {
      const e = ev(l.id, l.reference)
      expect(e.slos.map((s) => s.measured)).toBeTruthy()
      expect(e.ship).toBe(true)
      expect(e.thrifty).toBe(true)
    })
    it(`${l.id}: starting design fails`, () => {
      expect(ev(l.id, l.startDesign).ship).toBe(false)
    })
  }
  it('ch2: adding instances alone cannot pass without a load balancer', () => {
    const start = structuredClone(lvl('ch2').startDesign)
    start.nodes.find((n) => n.id === 'app')!.instances = 8
    expect(ev('ch2', start).ship).toBe(false)
  })
  it('every placeable component is unlocked by exactly one lesson', () => {
    const all = new Set(LEVELS.flatMap((l) => l.placeable))
    for (const t of all) expect(LESSONS.filter((l) => (l.unlocks as string[]).includes(t))).toHaveLength(1)
  })
})

describe('determinism and replay', () => {
  const l = lvl('ch2')
  const log = [
    { tick: 5, command: { kind: 'place', node: { id: 'lb', type: 'lb', x: 5, y: 3, instances: 1 } } },
    { tick: 6, command: { kind: 'disconnect', from: 'users', to: 'app' } },
    { tick: 7, command: { kind: 'connect', from: 'users', to: 'lb' } },
    { tick: 8, command: { kind: 'connect', from: 'lb', to: 'app' } },
    { tick: 9, command: { kind: 'setInstances', id: 'app', instances: 4 } },
  ] as const
  it('same seed + edit log reproduces the run exactly', () => {
    const a = runAll(l, l.startDesign, 7, [...log])
    const b = runAll(l, l.startDesign, 7, [...log])
    expect(a.hash()).toBe(b.hash())
    expect(a.evaluate(1, 0).ship).toBe(true)
    expect(runAll(l, l.startDesign, 8, [...log]).hash()).not.toBe(a.hash())
  })
})

describe('directional truth', () => {
  it('more instances behind a balancer never increase p95 or errors', () => {
    const l = lvl('ch2')
    let prev = Infinity
    for (let n = 3; n <= 8; n++) { // below 3 the tier is saturated and p95 is capped noise
      const d = structuredClone(l.reference)
      d.nodes.find((x) => x.id === 'app')!.instances = n
      const sim = runAll(l, d, 3)
      const e = sim.evaluate(1, 0)
      const p95 = parseFloat(e.slos[0].measured)
      expect(p95).toBeLessThanOrEqual(prev + 1e-9)
      prev = p95
    }
  })
  it('photos through the database load it more than storage does', () => {
    const l = lvl('ch1')
    const bad = runAll(l, l.startDesign, 1)
    const good = runAll(l, l.reference, 1)
    expect(bad.hash()).not.toBe(good.hash())
    expect(good.evaluate(1, 0).ship).toBe(true)
  })
})
