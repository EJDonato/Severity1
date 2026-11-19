// Types shared by engine, content, board and ui. No logic except constants.
export type CType = 'users' | 'app' | 'db' | 'storage' | 'lb' | 'cache' | 'cdn' | 'dns' | 'queue' | 'worker' | 'search' | 'shard' | 'limiter' | 'monitor'
export const ALL_TYPES: CType[] = ['users', 'dns', 'cdn', 'limiter', 'lb', 'app', 'cache', 'queue', 'worker', 'db', 'shard', 'search', 'storage', 'monitor']
export type ReqType = 'read' | 'write' | 'photo' | 'upload' | 'search' | 'bot'
export const REQ_TYPES: ReqType[] = ['read', 'write', 'photo', 'upload', 'search', 'bot']
export type Rates = Record<ReqType, number>
export type Health = 'healthy' | 'strained' | 'overloaded' | 'failing' | 'down'
export type Mood = 'happy' | 'impatient' | 'leaving'
export type ChaosKind = 'crash' | 'regionOut' | 'cacheFlush' | 'spike' | 'badDeploy' | 'botAttack'

export interface NodeConfig { cacheSize?: 1 | 2 | 3; expiry?: 5 | 15 | 30; shardKey?: 'userId' | 'region'; limit?: 'low' | 'medium' | 'high' }
export interface DNode { id: string; type: CType; x: number; y: number; instances: number; config?: NodeConfig }
export interface DEdge { from: string; to: string }
export interface Design { nodes: DNode[]; edges: DEdge[] }

export interface ChaosEvent { tick: number; kind: ChaosKind; target?: CType; duration: number; magnitude?: number }
export type Command =
  | { kind: 'place'; node: DNode }
  | { kind: 'remove'; id: string }
  | { kind: 'connect'; from: string; to: string }
  | { kind: 'disconnect'; from: string; to: string }
  | { kind: 'setInstances'; id: string; instances: number }
  | { kind: 'setConfig'; id: string; config: NodeConfig }
  | { kind: 'move'; id: string; x: number; y: number }
  | { kind: 'chaos'; event: Omit<ChaosEvent, 'tick'> }
export interface EditEntry { tick: number; command: Command }

export interface Traffic { base: Rates; peak: number; cycle: number; flat?: boolean; fanout?: number }
export interface Slo { p95Ms: number; errorRate: number }

export interface Level {
  id: string
  chapter: number
  title: string
  story: string
  placeable: CType[]
  startDesign: Design
  reference: Design
  traffic: Traffic
  cycles: number
  slo: Slo
  budget: number
  minDesign: CType[]
  hints: [string, string, string]
  debrief: { note: string; diffs: Record<string, string> }
  regions?: { farShare: number; farMs: number }
  chaos?: ChaosEvent[]
  sandbox?: boolean
  interview?: { minutes: number }
}

export interface Incident { id: string; node: string; severity: 1 | 2 | 3; name: string; openedTick: number; resolvedTick?: number }
export interface NodeState { util: number; health: Health; instances: number; queue: number; dropFrac: number; latencyMs: number }
export interface EdgeState { from: string; to: string; flow: Rates; failFrac: number }
export interface Metrics { rps: number; botRps: number; p50: number; p95: number; errorRate: number; cost: number; availability: number }
export type SimEvent = { type: 'opened' | 'resolved'; incident: Incident } | { type: 'chaos'; name: string; kind: ChaosKind }
export interface Snapshot {
  tick: number
  nodes: Record<string, NodeState>
  edges: EdgeState[]
  metrics: Metrics
  mood: Mood
  events: SimEvent[]
  open: Incident[]
  done: boolean
}
export interface SloResult { name: string; pass: boolean; measured: string; target: string }
export interface Evaluation { slos: SloResult[]; missing: CType[]; ship: boolean; thrifty: boolean; cost: number }

// Component parameters live in data so tuning never touches engine code.
export interface Param { cap: number; baseMs: number; cost: number; weight: Rates; label: string }
const w = (read: number, write: number, photo: number, upload: number, search = 0, bot = 0): Rates => ({ read, write, photo, upload, search, bot })
export const PARAMS: Record<CType, Param> = {
  users: { cap: Infinity, baseMs: 0, cost: 0, weight: w(0, 0, 0, 0), label: 'Users' },
  dns: { cap: 20000, baseMs: 2, cost: 20, weight: w(1, 1, 1, 1, 1, 1), label: 'DNS' },
  cdn: { cap: 4000, baseMs: 15, cost: 90, weight: w(0, 0, 1, 0), label: 'CDN' },
  limiter: { cap: 8000, baseMs: 2, cost: 60, weight: w(1, 1, 1, 1, 1, 1), label: 'Rate Limiter' },
  lb: { cap: 6000, baseMs: 3, cost: 100, weight: w(1, 1, 1, 1, 1, 1), label: 'Load Balancer' },
  app: { cap: 300, baseMs: 20, cost: 100, weight: w(1, 1, 1, 1, 1, 1), label: 'App Server' },
  cache: { cap: 3000, baseMs: 2, cost: 60, weight: w(1, 0, 0, 0), label: 'Cache' },
  queue: { cap: 100000, baseMs: 0, cost: 40, weight: w(0, 1, 0, 0), label: 'Message Queue' },
  worker: { cap: 300, baseMs: 0, cost: 100, weight: w(0, 1, 0, 0), label: 'Worker' },
  db: { cap: 400, baseMs: 15, cost: 200, weight: w(1, 2, 10, 12, 25, 2), label: 'Database' },
  shard: { cap: 400, baseMs: 15, cost: 200, weight: w(1, 2, 10, 12, 25, 2), label: 'Sharded Database' },
  search: { cap: 800, baseMs: 12, cost: 240, weight: w(0, 0, 0, 0, 1), label: 'Search Index' },
  storage: { cap: 800, baseMs: 25, cost: 80, weight: w(0, 0, 1, 2), label: 'Object Storage' },
  monitor: { cap: Infinity, baseMs: 0, cost: 30, weight: w(0, 0, 0, 0), label: 'Monitoring' },
}
// Per-component pricing that is not simply cost x instances.
export function costOf(n: DNode): number {
  const c = PARAMS[n.type].cost
  if (n.type === 'db') return c + 120 * (n.instances - 1)
  if (n.type === 'cache') return c + 30 * ((n.config?.cacheSize ?? 2) - 1)
  if (['dns', 'cdn', 'queue', 'limiter', 'monitor', 'storage', 'cache', 'users'].includes(n.type)) return c
  return c * n.instances
}
