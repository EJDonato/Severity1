import { create } from 'zustand'
import { DEFAULT_CONFIG, LEVELS, freeSlot, levelById, rubric } from '../content'
import { audio } from '../audio'
import { Sim, applyTo } from '../engine/sim'
import { telemetry } from '../telemetry'
import type { CType, ChaosKind, Command, Design, DNode, EditEntry, Incident, Level, NodeConfig, Snapshot } from '../schema'

export type Screen =
  | { name: 'menu' }
  | { name: 'check'; phase: 'before' | 'after' }
  | { name: 'lesson'; id: string }
  | { name: 'level'; id: string }
  | { name: 'debrief'; id: string }
export interface Stars { ship: boolean; thrifty: boolean; senior: boolean; fromReference: boolean }
export interface Result { slos: { name: string; pass: boolean; measured: string; target: string }[]; missing: CType[]; cost: number; stars: Stars; rubric?: { label: string; pass: boolean }[] }
export interface TimelineItem { tick: number; text: string; severity: number; resolved: boolean; chaos?: boolean }
export interface RunRecord { levelId: string; seed: number; startDesign: Design; editLog: EditEntry[] }

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
export const SPEEDS = [0.5, 1, 2, 4]
const TICK_MS = 250 // wall time per tick at 1x
const SINGLE: CType[] = ['users', 'dns', 'cdn', 'limiter', 'lb', 'queue', 'monitor']

interface State {
  screen: Screen
  lessonsDone: string[]
  stars: Record<string, Stars>
  designs: Record<string, Design>
  fromRef: Record<string, boolean>
  check: { before?: number; after?: number }
  settings: { speed: number; reducedMotion: boolean; sound: boolean }
  consentAsked: boolean
  snap: Snapshot | null
  running: boolean
  runs: number
  hints: number
  hintShown: number
  result: Result | null
  timeline: TimelineItem[]
  lastRun: RunRecord | null
  message: string
  selected: string | null
  linkFrom: string | null
  focusNode: string | null
  pager: Incident | null
  deadline: number | null
  chaos: { name: string; tick: number } | null
  go(s: Screen): void
  completeLesson(id: string): void
  setConsent(v: boolean): void
  setCheck(phase: 'before' | 'after', score: number): void
  enterLevel(id: string): void
  testOut(id: string): void
  restartFromReference(): void
  place(type: CType): void
  remove(id: string): void
  clickNode(id: string): void
  startLink(id: string): void
  connect(from: string, to: string): void
  setInstances(id: string, n: number): void
  setConfig(id: string, cfg: NodeConfig): void
  fireChaos(kind: ChaosKind, target?: CType): void
  setSandboxLoad(mult: number): void
  start(): void
  togglePause(): void
  setSpeed(n: number): void
  useHint(): void
  setReduced(v: boolean): void
  setSound(v: boolean): void
  dismissPager(): void
}

let sim: Sim | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let levelId = ''
let runStart: Design | null = null
let sandboxBase: Level['traffic']['base'] | null = null

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
    if (s.settings.sound) audio.cue(err ? 'invalid' : command.kind === 'connect' ? 'connect' : 'place')
    return err
  }
  const resetRun = () => {
    stop()
    audio.stopHum()
    sim = null
    runStart = null
    set({ snap: null, running: false, result: null, timeline: [], pager: null, focusNode: null, chaos: null })
  }
  const loop = () => {
    stop()
    const tick = () => {
      if (!sim || !get().running) return
      const snap = sim.step()
      const s0 = get()
      const timeline = [...s0.timeline]
      let { pager, focusNode, chaos } = s0
      for (const ev of snap.events) {
        if (ev.type === 'chaos') {
          timeline.push({ tick: snap.tick, text: `Chaos event: ${ev.name}`, severity: 3, resolved: false, chaos: true })
          chaos = { name: ev.name, tick: snap.tick }
          continue
        }
        const inc = ev.incident
        timeline.push({ tick: snap.tick, text: inc.name, severity: inc.severity, resolved: ev.type === 'resolved' })
        if (ev.type === 'opened') {
          pager = inc
          if (inc.severity <= 2) focusNode = inc.node
          telemetry.track('incident_opened', { level: levelId, severity: inc.severity })
          if (s0.settings.sound) audio.cue(`incident${inc.severity}` as 'incident1')
        } else if (s0.settings.sound) audio.cue('resolved')
      }
      if (s0.settings.sound) {
        const us = Object.entries(snap.nodes).filter(([id]) => sim!.design.nodes.find((n) => n.id === id)?.type !== 'users').map(([, n]) => n.util)
        audio.hum(us.length ? us.reduce((a, b) => a + Math.min(b, 1.2), 0) / us.length : 0)
      }
      set({ snap, timeline, pager, focusNode, chaos })
      if (snap.done) {
        audio.stopHum()
        const s = get()
        const ev = sim.evaluate(s.runs, s.hints)
        const stars: Stars = { ship: ev.ship, thrifty: ev.thrifty, senior: ev.senior, fromReference: !!s.fromRef[levelId] }
        const prev = s.stars[levelId]
        const n = (x: Stars) => +x.ship + +x.thrifty + +x.senior
        set({
          running: false,
          result: { slos: ev.slos, missing: ev.missing, cost: ev.cost, stars, ...(level().interview ? { rubric: rubric(sim.design, ev.slos, ev.cost, level().budget) } : {}) },
          lastRun: { levelId, seed: levelId === 'sandbox' ? 0 : level().chapter * 1000 + s.runs, startDesign: clone(runStart!), editLog: clone(sim.editLog) },
          stars: ev.ship && !level().interview && (!prev || n(stars) >= n(prev)) ? { ...s.stars, [levelId]: stars } : s.stars,
        })
        telemetry.track('run_completed', { level: levelId, ship: ev.ship })
        if (ev.ship) {
          telemetry.track('stars_awarded', { level: levelId, count: n(stars) })
          if (s.settings.sound) audio.cue('star')
        }
        return
      }
      timer = setTimeout(tick, TICK_MS / get().settings.speed)
    }
    timer = setTimeout(tick, TICK_MS / get().settings.speed)
  }

  return {
    screen: { name: 'menu' },
    lessonsDone: [], stars: {}, designs: {}, fromRef: {}, check: {},
    settings: { speed: 1, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, sound: false },
    consentAsked: false,
    snap: null, running: false, runs: 0, hints: 0, hintShown: 0, result: null, timeline: [], lastRun: null, message: '',
    selected: null, linkFrom: null, focusNode: null, pager: null, chaos: null, deadline: null,

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
        deadline: l.interview ? Date.now() + l.interview.minutes * 60000 : null,
      })
      telemetry.track('level_started', { level: id })
    },
    // Test out (FR-19): skip a chapter's lessons and start from its reference starting design; stars are marked as such.
    testOut: (id) => {
      const l = levelById(id)
      const s = get()
      set({
        lessonsDone: [...new Set([...s.lessonsDone, ...l.lessons])],
        designs: { ...s.designs, [id]: clone(l.startDesign) },
        fromRef: { ...s.fromRef, [id]: true },
      })
      get().enterLevel(id)
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
      if (SINGLE.includes(type) && d.nodes.some((n) => n.type === type)) {
        set({ message: `You only need one ${type === 'lb' ? 'Load Balancer' : type} component.` })
        return
      }
      const ghost = l.reference.nodes.find((n) => n.type === type && !d.nodes.some((x) => x.id === n.id))
      const [x, y] = ghost ? [ghost.x, ghost.y] : freeSlot(type, d)
      let id: string = ghost?.id ?? type
      for (let i = 2; d.nodes.some((n) => n.id === id); i++) id = `${type}${i}`
      const cfg = DEFAULT_CONFIG[type]
      const node: DNode = { id, type, x, y, instances: 1, ...(cfg ? { config: { ...cfg } } : {}) }
      edit({ kind: 'place', node })
      set({ selected: id })
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
    connect: (from, to) => { edit({ kind: 'connect', from, to }) },
    setInstances: (id, n) => { edit({ kind: 'setInstances', id, instances: n }) },
    setConfig: (id, config) => { edit({ kind: 'setConfig', id, config }) },
    fireChaos: (kind, target) => {
      if (!sim) { set({ message: 'Press Start first, then break things.' }); return }
      sim.apply({ kind: 'chaos', event: { kind, target, duration: kind === 'cacheFlush' ? 1 : 10 } })
    },
    setSandboxLoad: (mult) => {
      if (!sim || !sandboxBase) return
      const b = sandboxBase
      sim.level.traffic.base = { read: b.read * mult, write: b.write * mult, photo: b.photo * mult, upload: b.upload * mult, search: b.search * mult, bot: b.bot * mult }
    },
    start: () => {
      const s = get()
      const l = clone(level()) // a copy: the sandbox edits its own traffic
      const runs = s.runs + 1
      runStart = clone(s.designs[levelId])
      sim = new Sim(l, s.designs[levelId], l.chapter * 1000 + runs)
      sandboxBase = clone(l.traffic.base)
      set({ runs, running: true, snap: null, result: null, timeline: [], pager: null, chaos: null, message: '' })
      if (s.settings.sound) audio.unlock()
      telemetry.track('run_started', { level: levelId, run: runs })
      loop()
    },
    togglePause: () => {
      if (!sim || get().snap?.done) return
      const running = !get().running
      set({ running })
      if (running) loop(); else { stop(); audio.stopHum() }
    },
    setSpeed: (n) => {
      set({ settings: { ...get().settings, speed: n } })
      if (get().running) loop()
    },
    useHint: () => {
      const s = get()
      if (s.hintShown >= 3) return
      set({ hints: s.hints + 1, hintShown: s.hintShown + 1 })
      if (s.settings.sound) audio.cue('hint')
      telemetry.track('hint_used', { level: levelId, tier: s.hintShown + 1 })
    },
    setReduced: (v) => set({ settings: { ...get().settings, reducedMotion: v } }),
    setSound: (v) => {
      set({ settings: { ...get().settings, sound: v } })
      audio.setMuted(!v)
      if (v) audio.unlock(); else audio.stopHum()
    },
    dismissPager: () => set({ pager: null }),
  }
})

// Test hook: only when the URL asks for it (?e2e), so scripts can jump to any level.
if (typeof location !== 'undefined' && location.search.includes('e2e')) Object.assign(window, { __game: useGame, __levels: LEVELS })
export const stopLoop = stop
