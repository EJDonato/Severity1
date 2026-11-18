import { create } from 'zustand'
import { LEVELS, SLOTS, levelById } from '../content'
import { Sim, applyTo } from '../engine/sim'
import { telemetry } from '../telemetry'
import type { CType, Command, Design, DNode, Incident, Level, Snapshot } from '../schema'

export type Screen =
  | { name: 'menu' }
  | { name: 'check'; phase: 'before' | 'after' }
  | { name: 'lesson'; id: string }
  | { name: 'level'; id: string }
  | { name: 'debrief'; id: string }
export interface Stars { ship: boolean; thrifty: boolean; senior: boolean; fromReference: boolean }
export interface Result { slos: { name: string; pass: boolean; measured: string; target: string }[]; missing: CType[]; cost: number; stars: Stars }

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
export const SPEEDS = [0.5, 1, 2, 4]
const TICK_MS = 250 // wall time per tick at 1x

interface State {
  screen: Screen
  lessonsDone: string[]
  stars: Record<string, Stars>
  designs: Record<string, Design>
  fromRef: Record<string, boolean>
  check: { before?: number; after?: number }
  settings: { speed: number; reducedMotion: boolean }
  consentAsked: boolean
  // per-level run state
  snap: Snapshot | null
  running: boolean
  runs: number
  hints: number
  hintShown: number
  result: Result | null
  timeline: { tick: number; text: string; severity: number; resolved: boolean }[]
  log: string[]
  message: string
  selected: string | null
  linkFrom: string | null
  focusNode: string | null
  pager: Incident | null
  // actions
  go(s: Screen): void
  completeLesson(id: string): void
  setConsent(v: boolean): void
  setCheck(phase: 'before' | 'after', score: number): void
  enterLevel(id: string): void
  restartFromReference(): void
  place(type: CType): void
  remove(id: string): void
  clickNode(id: string): void
  startLink(id: string): void
  setInstances(id: string, n: number): void
  start(): void
  togglePause(): void
  setSpeed(n: number): void
  useHint(): void
  setReduced(v: boolean): void
  dismissPager(): void
}

let sim: Sim | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let levelId = ''

export const getSim = () => sim
const stop = () => { if (timer) clearTimeout(timer); timer = null }

export const useGame = create<State>((set, get) => {
  const level = (): Level => levelById(levelId)
  const edit = (command: Command): string | null => {
    const s = get()
    let err: string | null
    if (sim) {
      err = sim.apply(command)
      if (!err) set({ designs: { ...s.designs, [levelId]: clone(sim.design) } })
    } else {
      const d = clone(s.designs[levelId])
      err = applyTo(d, command)
      if (!err) set({ designs: { ...s.designs, [levelId]: d } })
    }
    set({ message: err ?? '' })
    return err
  }
  const resetRun = () => {
    stop()
    sim = null
    set({ snap: null, running: false, result: null, timeline: [], pager: null, focusNode: null })
  }
  const loop = () => {
    stop()
    const tick = () => {
      if (!sim || !get().running) return
      const snap = sim.step()
      const timeline = [...get().timeline]
      let pager = get().pager
      let focusNode = get().focusNode
      for (const e of snap.events) {
        const inc = e.incident
        timeline.push({ tick: snap.tick, text: inc.name, severity: inc.severity, resolved: e.type === 'resolved' })
        if (e.type === 'opened') {
          pager = inc
          if (inc.severity <= 2) focusNode = inc.node
          telemetry.track('incident_opened', { level: levelId, severity: inc.severity })
        }
      }
      set({ snap, timeline, pager, focusNode })
      if (snap.done) {
        const s = get()
        const ev = sim.evaluate(s.runs, s.hints)
        const stars: Stars = { ship: ev.ship, thrifty: ev.thrifty, senior: ev.senior, fromReference: !!s.fromRef[levelId] }
        const prev = s.stars[levelId]
        set({
          running: false,
          result: { slos: ev.slos, missing: ev.missing, cost: ev.cost, stars },
          stars: ev.ship && (!prev || +ev.ship + +ev.thrifty + +ev.senior >= +prev.ship + +prev.thrifty + +prev.senior) ? { ...s.stars, [levelId]: stars } : s.stars,
        })
        telemetry.track('run_completed', { level: levelId, ship: ev.ship })
        if (ev.ship) telemetry.track('stars_awarded', { level: levelId, count: +ev.ship + +ev.thrifty + +ev.senior })
        return
      }
      timer = setTimeout(tick, TICK_MS / get().settings.speed)
    }
    timer = setTimeout(tick, TICK_MS / get().settings.speed)
  }

  return {
    screen: { name: 'menu' },
    lessonsDone: [], stars: {}, designs: {}, fromRef: {}, check: {},
    settings: { speed: 1, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches },
    consentAsked: false,
    snap: null, running: false, runs: 0, hints: 0, hintShown: 0, result: null, timeline: [], log: [], message: '',
    selected: null, linkFrom: null, focusNode: null, pager: null,

    go: (screen) => {
      if (screen.name !== 'level' && screen.name !== 'debrief') resetRun()
      set({ screen, message: '', selected: null, linkFrom: null })
    },
    completeLesson: (id) => {
      if (!get().lessonsDone.includes(id)) set({ lessonsDone: [...get().lessonsDone, id] })
      telemetry.track('lesson_completed', { lesson: id })
    },
    setConsent: (v) => { telemetry.setConsent(v); set({ consentAsked: true }) },
    setCheck: (phase, score) => {
      set({ check: { ...get().check, [phase]: score } })
      telemetry.track('check_taken', { phase, score })
    },
    enterLevel: (id) => {
      resetRun()
      levelId = id
      const s = get()
      const l = levelById(id)
      const prev = LEVELS[l.chapter - 1]
      // Continue from the player's own design by default; otherwise the level's start design.
      const own = s.designs[id] ?? (prev && s.stars[prev.id]?.ship ? s.designs[prev.id] : undefined)
      set({
        screen: { name: 'level', id },
        designs: { ...s.designs, [id]: clone(own ?? l.startDesign) },
        runs: 0, hints: 0, hintShown: 0, message: '', selected: null, linkFrom: null,
      })
      telemetry.track('level_started', { level: id })
    },
    restartFromReference: () => {
      resetRun()
      const l = level()
      set({ designs: { ...get().designs, [levelId]: clone(l.startDesign) }, fromRef: { ...get().fromRef, [levelId]: true }, runs: 0, hints: 0, hintShown: 0 })
    },
    place: (type) => {
      const s = get()
      const d = s.designs[levelId]
      const l = level()
      if (!l.placeable.includes(type)) return
      if ((type === 'users' || type === 'lb') && d.nodes.some((n) => n.type === type)) {
        set({ message: `You only need one ${type === 'lb' ? 'Load Balancer' : 'Users'} component.` })
        return
      }
      const same = d.nodes.filter((n) => n.type === type).length
      const ghost = l.reference.nodes.find((n) => n.type === type && !d.nodes.some((x) => x.id === n.id))
      const [x, y] = ghost ? [ghost.x, ghost.y] : [SLOTS[type][0], SLOTS[type][1] + 4 * same]
      let id: string = ghost?.id ?? type
      for (let i = 2; d.nodes.some((n) => n.id === id); i++) id = `${type}${i}`
      const node: DNode = { id, type, x, y, instances: 1 }
      edit({ kind: 'place', node })
    },
    remove: (id) => { edit({ kind: 'remove', id }); set({ selected: null }) },
    clickNode: (id) => {
      const { linkFrom } = get()
      if (linkFrom && linkFrom !== id) {
        const err = edit({ kind: 'connect', from: linkFrom, to: id })
        set({ linkFrom: null, selected: err ? get().selected : id })
      } else set({ selected: id, linkFrom: null })
    },
    startLink: (id) => set({ linkFrom: get().linkFrom === id ? null : id, selected: id, message: get().linkFrom === id ? '' : 'Now click the component to connect to.' }),
    setInstances: (id, n) => { edit({ kind: 'setInstances', id, instances: n }) },
    start: () => {
      const s = get()
      const l = level()
      const runs = s.runs + 1
      sim = new Sim(l, s.designs[levelId], l.chapter * 1000 + runs)
      set({ runs, running: true, snap: null, result: null, timeline: [], pager: null, message: '' })
      telemetry.track('run_started', { level: levelId, run: runs })
      loop()
    },
    togglePause: () => {
      if (!sim) return
      const running = !get().running
      set({ running })
      if (running) loop(); else stop()
    },
    setSpeed: (n) => {
      set({ settings: { ...get().settings, speed: n } })
      if (get().running) loop()
    },
    useHint: () => {
      const s = get()
      if (s.hintShown >= 3) return
      set({ hints: s.hints + 1, hintShown: s.hintShown + 1 })
      telemetry.track('hint_used', { level: levelId, tier: s.hintShown + 1 })
    },
    setReduced: (v) => set({ settings: { ...get().settings, reducedMotion: v } }),
    dismissPager: () => set({ pager: null }),
  }
})

export const stopLoop = stop
