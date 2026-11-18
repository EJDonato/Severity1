import { expect, test } from 'vitest'
import { makeRng } from './rng'

test('same seed gives the same sequence', () => {
  const a = makeRng(42), b = makeRng(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})

test('different seeds differ and values stay in [0,1)', () => {
  const x = makeRng(1)(), y = makeRng(2)()
  expect(x).not.toBe(y)
  expect(x >= 0 && x < 1).toBe(true)
})
