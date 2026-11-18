// Types shared by engine, content, board and ui. No logic except constants.
export type CType = 'users' | 'app' | 'db' | 'storage' | 'lb'
export type ReqType = 'read' | 'write' | 'photo' | 'upload'
export const REQ_TYPES: ReqType[] = ['read', 'write', 'photo', 'upload']
export type Rates = Record<ReqType, number>
export type Health = 'healthy' | 'strained' | 'overloaded' | 'failing' | 'down'
export type Mood = 'happy' | 'impatient' | 'leaving'

export interface DNode { id: string; type: CType; x: number; y: number; instances: number }
export interface DEdge { from: string; to: string }
export interface Design { nodes: DNode[]; edges: DEdge[] }

export type Command =
  | { kind: 'place'; node: DNode }
  | { kind: 'remove'; id: string }
  | { kind: 'connect'; from: string; to: string }
  | { kind: 'disconnect'; from: string; to: string }
  | { kind: 'setInstances'; id: string; instances: number }
export interface EditEntry { tick: number; command: Command }

export interface Traffic { base: Rates; peak: number; cycle: number; flat?: boolean }
export interface Slo { p95Ms: number; errorRate: number }

export interface Level {
  id: string
  chapter: number
  title: string
  story: string
  lessons: string[]
  placeable: CType[]
  startDesign: Design
  reference: Design
  traffic: Traffic
  cycles: number
  slo: Slo
  budget: number
  minDesign: CType[]
  hints: [string, string, string]
  codex: string
  debrief: { note: string; diffs: Record<string, string> }
}

export interface Toy {
  base: Rates
  designs: { label: string; design: Design }[]
  stepper?: { label: string; id: string; min: number; max: number }
  load?: { label: string; steps: number[] }
}
export interface Lesson {
  id: string
  title: string
  unlocks: (CType | 'metrics' | 'scaling')[]
  hook: { lines: string[]; caption: string }
  analogy: { pairs: [string, string][] }
  toy: Toy
  predict: { question: string; options: string[]; answer: number; scenario: { design: number; instances?: number; load?: number }; explain: string }
  codex: { analogy: string; note: string; sources: string[] }
}

export interface Incident { id: string; node: string; severity: 1 | 2 | 3; name: string; openedTick: number; resolvedTick?: number }
export interface NodeState { util: number; health: Health; instances: number; queue: number; dropFrac: number; latencyMs: number }
export interface EdgeState { from: string; to: string; flow: Rates; failFrac: number }
export interface Metrics { rps: number; p50: number; p95: number; errorRate: number; cost: number; availability: number }
export interface Snapshot {
  tick: number
  nodes: Record<string, NodeState>
  edges: EdgeState[]
  metrics: Metrics
  mood: Mood
  events: { type: 'opened' | 'resolved'; incident: Incident }[]
  open: Incident[]
  done: boolean
}
export interface SloResult { name: string; pass: boolean; measured: string; target: string }
export interface Evaluation { slos: SloResult[]; missing: CType[]; ship: boolean; thrifty: boolean; cost: number }

// Component parameters live in data so tuning never touches engine code.
export interface Param { cap: number; baseMs: number; cost: number; weight: Rates; label: string }
const w = (read: number, write: number, photo: number, upload: number): Rates => ({ read, write, photo, upload })
export const PARAMS: Record<CType, Param> = {
  users: { cap: Infinity, baseMs: 0, cost: 0, weight: w(0, 0, 0, 0), label: 'Users' },
  lb: { cap: 2000, baseMs: 3, cost: 100, weight: w(1, 1, 1, 1), label: 'Load Balancer' },
  app: { cap: 150, baseMs: 20, cost: 50, weight: w(1, 1, 1, 1), label: 'App Server' },
  db: { cap: 400, baseMs: 15, cost: 200, weight: w(1, 2, 10, 12), label: 'Database' },
  storage: { cap: 800, baseMs: 25, cost: 80, weight: w(0, 0, 1, 2), label: 'Object Storage' },
}
