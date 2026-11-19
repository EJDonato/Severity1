import { create } from 'zustand'
import { DEFAULT_CONFIG, LEVELS, freeSlot, levelById, resolveSpot, rubric } from '../content'
import { audio } from '../audio'
import { feedback } from '../audio/feedback'
import { Sim, applyTo, connectError } from '../engine/sim'
import type { CType, ChaosKind, Command, Design, DNode, EditEntry, Incident, Level, NodeConfig, Snapshot } from '../schema'

export type Screen =
  | { name: 'menu' }
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
  stars: Record<string, Stars>
  designs: Record<string, Design>
  fromRef: Record<string, boolean>
  settings: { speed: number; reducedMotion: boolean; sound: boolean }
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
  selectedEdge: { from: string; to: string } | null
  focusNode: string | null
  pager: Incident | null
  deadline: number | null
  intro: string | null
  introSeen: string[]
  chaos: { name: string; tick: number } | null
  go(s: Screen): void
  enterLevel(id: string): void
  startCampaign(): void
  nextStage(): void
  closeIntro(): void
  restartFromReference(): void
  place(type: CType, x?: number, y?: number): void
  move(id: string, x: number, y: number): void
  selectEdge(from: string, to: string): void
  removeEdge(): void
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
// A stage opens once the one before it has been solved.
export const stageOpen = (i: number, stars: Record<string, Stars>) => i === 0 || !!stars[LEVELS[i - 1]?.id]?.ship
// Would this wire be allowed? Used to highlight valid targets while dragging a connection.
export const connectCheck = (from: string, to: string): string | null => {
  const d = useGame.getState().designs[levelId]
  return d ? connectError(d, from, to) : 'no design'
}
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
    feedback.fire(err ? 'error' : command.kind === 'connect' ? 'connect' : command.kind === 'place' ? 'place' : command.kind === 'remove' || command.kind === 'disconnect' ? 'remove' : 'tap')
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
          feedback.fire('chaos')
          continue
        }
        const inc = ev.incident
        timeline.push({ tick: snap.tick, text: inc.name, severity: inc.severity, resolved: ev.type === 'resolved' })
        if (ev.type === 'opened') {
          pager = inc
          if (inc.severity <= 2) focusNode = inc.node
          feedback.fire(`incident${inc.severity}` as 'incident1')
        } else feedback.fire('resolved')
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
        if (!ev.ship && !level().sandbox) feedback.fire('error')
        if (ev.ship) {
          feedback.fire('success')
        }
        return
      }
      timer = setTimeout(tick, TICK_MS / get().settings.speed)
    }
    timer = setTimeout(tick, TICK_MS / get().settings.speed)
  }

  return {
    screen: { name: 'menu' },
    stars: {}, designs: {}, fromRef: {},
    settings: { speed: 1, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, sound: false },
    snap: null, running: false, runs: 0, hints: 0, hintShown: 0, result: null, timeline: [], lastRun: null, message: '',
    selected: null, linkFrom: null, selectedEdge: null, focusNode: null, pager: null, chaos: null, deadline: null, intro: null, introSeen: [],

    go: (screen) => {
      if (screen.name !== 'level' && screen.name !== 'debrief') resetRun()
      set({ screen, message: '', selected: null, linkFrom: null })
    },
    enterLevel: (id) => {
      resetRun()
      levelId = id
      const s = get()
      const l = levelById(id)
      // The game is one growing system: a stage starts from the design that solved the stage before it.
      // Coming back to a stage you already touched restores your own design for it.
      const idx = LEVELS.findIndex((x) => x.id === id)
      const prev = idx > 0 ? LEVELS[idx - 1] : undefined
      const carried = prev && s.stars[prev.id]?.ship ? s.designs[prev.id] : undefined
      const own = s.designs[id] ?? carried
      set({
        screen: { name: 'level', id },
        intro: idx >= 0 && !s.introSeen.includes(id) ? id : null,
        designs: { ...s.designs, [id]: clone(own ?? l.startDesign) },
        runs: 0, hints: 0, hintShown: 0, message: '', selected: null, linkFrom: null,
        deadline: l.interview ? Date.now() + l.interview.minutes * 60000 : null,
      })
    },
    startCampaign: () => {
      const s = get()
      const next = LEVELS.find((l) => !s.stars[l.id]?.ship) ?? LEVELS[LEVELS.length - 1]
      get().enterLevel(next.id)
    },
    nextStage: () => {
      const i = LEVELS.findIndex((l) => l.id === levelId)
      if (i >= 0 && i < LEVELS.length - 1) get().enterLevel(LEVELS[i + 1].id)
    },
    closeIntro: () => {
      const s = get()
      set({ intro: null, introSeen: s.intro && !s.introSeen.includes(s.intro) ? [...s.introSeen, s.intro] : s.introSeen })
    },
    restartFromReference: () => {
      resetRun()
      const l = level()
      set({ designs: { ...get().designs, [levelId]: clone(l.startDesign) }, fromRef: { ...get().fromRef, [levelId]: true }, runs: 0, hints: 0, hintShown: 0 })
    },
    place: (type, px, py) => {
      const s = get()
      const d = s.designs[levelId]
      const l = level()
      if (!l.placeable.includes(type)) return
      if (SINGLE.includes(type) && d.nodes.some((n) => n.type === type)) {
        set({ message: `You only need one ${type === 'lb' ? 'Load Balancer' : type} component.` })
        return
      }
      const ghost = l.reference.nodes.find((n) => n.type === type && !d.nodes.some((x) => x.id === n.id))
      const [x, y] = px !== undefined && py !== undefined ? resolveSpot(d, type, px, py) : ghost ? [ghost.x, ghost.y] : freeSlot(type, d)
      let id: string = ghost?.id ?? type
      for (let i = 2; d.nodes.some((n) => n.id === id); i++) id = `${type}${i}`
      const cfg = DEFAULT_CONFIG[type]
      const node: DNode = { id, type, x, y, instances: 1, ...(cfg ? { config: { ...cfg } } : {}) }
      edit({ kind: 'place', node })
      set({ selected: id })
    },
    remove: (id) => { edit({ kind: 'remove', id }); set({ selected: null }) },
    move: (id, x, y) => {
      const d = get().designs[levelId]
      const n = d.nodes.find((q) => q.id === id)
      if (!n) return
      const [nx, ny] = resolveSpot(d, n.type, x, y, id)
      edit({ kind: 'move', id, x: nx, y: ny })
    },
    selectEdge: (from, to) => set({ selectedEdge: { from, to }, selected: null, linkFrom: null, message: '' }),
    removeEdge: () => {
      const e = get().selectedEdge
      if (!e) return
      edit({ kind: 'disconnect', from: e.from, to: e.to })
      set({ selectedEdge: null })
    },
    clickNode: (id) => {
      const { linkFrom } = get()
      set({ selectedEdge: null })
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
      feedback.fire('hint')
    },
    setReduced: (v) => set({ settings: { ...get().settings, reducedMotion: v } }),
    setSound: (v) => {
      set({ settings: { ...get().settings, sound: v } })
      audio.setMuted(!v)
      feedback.setEnabled(v)
      if (v) audio.unlock(); else audio.stopHum()
    },
    dismissPager: () => set({ pager: null }),
  }
})

// Test hook: only when the URL asks for it (?e2e), so scripts can jump to any level.
if (typeof location !== 'undefined' && location.search.includes('e2e')) Object.assign(window, { __game: useGame, __levels: LEVELS })
export const stopLoop = stop
