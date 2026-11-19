// Content as data. shortcut: typed TS objects instead of JSON files + JSON Schema in CI; the content tests in content.test.ts play the CI role.
import { SIZE } from '../tokens'
import type { CType, DNode, Design, Level, NodeConfig, Rates } from '../schema'

// Candidate grid slots per component, in cells. The first free one is used when the player places a part.
export const SLOTS: Record<CType, [number, number][]> = {
  users: [[1, 4]], dns: [[4, 4]], limiter: [[7, 4]], cdn: [[7, 0]], lb: [[10, 4]], app: [[14, 4], [14, 8]],
  cache: [[17, 4]], queue: [[17, 0]], worker: [[21, 0]], db: [[21, 4]], shard: [[21, 4], [25, 4]], search: [[17, 8]], storage: [[21, 8]], monitor: [[1, 8]],
}
const at = (type: CType, i = 0) => SLOTS[type][i]
const node = (type: CType, instances = 1, config?: NodeConfig, id: string = type): DNode => ({ id, type, x: at(type)[0], y: at(type)[1], instances, ...(config ? { config } : {}) })
const e = (from: string, to: string) => ({ from, to })
const rates = (read: number, write: number, photo: number, upload: number, search = 0, bot = 0): Rates => ({ read, write, photo, upload, search, bot })
const design = (nodes: DNode[], edges: [string, string][]): Design => ({ nodes, edges: edges.map(([a, b]) => e(a, b)) })

const d0: Design = { nodes: [], edges: [] }
const dTutorial = design([node('users'), node('app')], [['users', 'app']])
const dCh1Start = design([node('users'), node('app'), node('db')], [['users', 'app'], ['app', 'db']])
const dCh1Ref = design([node('users'), node('app'), node('db'), node('storage')], [['users', 'app'], ['app', 'db'], ['app', 'storage']])
const dCh2Ref = design([node('users'), node('lb'), node('app', 4), node('db'), node('storage')], [['users', 'lb'], ['lb', 'app'], ['app', 'db'], ['app', 'storage']])
const dCh3Start = design([node('users'), node('lb'), node('app', 7), node('db'), node('storage')], [['users', 'lb'], ['lb', 'app'], ['app', 'db'], ['app', 'storage']])
const dCh3Ref = design(
  [node('users'), node('lb'), node('app', 7), node('cache', 1, { cacheSize: 3, expiry: 30 }), node('db'), node('storage')],
  [['users', 'lb'], ['lb', 'app'], ['app', 'cache'], ['app', 'db'], ['cache', 'db'], ['app', 'storage']],
)
const dCh4Ref = design(
  [node('users'), node('dns'), node('cdn'), node('lb'), node('app', 4), node('cache', 1, { cacheSize: 3, expiry: 30 }), node('db'), node('storage')],
  [['users', 'dns'], ['dns', 'cdn'], ['dns', 'lb'], ['cdn', 'storage'], ['lb', 'app'], ['app', 'cache'], ['app', 'db'], ['cache', 'db'], ['app', 'storage']],
)
const dCh5Ref = design(
  [...dCh4Ref.nodes, node('queue'), node('worker', 5)],
  [...dCh4Ref.edges.map((x): [string, string] => [x.from, x.to]), ['app', 'queue'], ['queue', 'worker']],
)
const dCh6Ref = design(
  [...dCh5Ref.nodes.map((n) => (n.id === 'app' ? { ...n, instances: 5 } : n)), node('search')],
  [...dCh5Ref.edges.map((x): [string, string] => [x.from, x.to]), ['app', 'search']],
)
const dCh7Ref = design(
  [...dCh6Ref.nodes.filter((n) => n.id !== 'db').map((n) => (n.id === 'app' ? { ...n, instances: 9 } : n)), node('shard', 4, { shardKey: 'userId' })],
  [...dCh6Ref.edges.filter((x) => x.from !== 'db' && x.to !== 'db').map((x): [string, string] => [x.from, x.to]), ['app', 'shard'], ['cache', 'shard']],
)
const swapDnsLb = (d: Design, limit: NodeConfig['limit']): Design => ({
  nodes: [...d.nodes, node('limiter', 1, { limit })],
  edges: [...d.edges.filter((x) => !(x.from === 'dns' && x.to === 'lb')), e('dns', 'limiter'), e('limiter', 'lb')],
})
const dCh8Ref = (() => {
  const d = swapDnsLb(dCh7Ref, 'medium')
  return { ...d, nodes: d.nodes.map((n) => (n.id === 'app' ? { ...n, instances: 10 } : n)) }
})()
const dCh9Ref: Design = {
  nodes: [...dCh8Ref.nodes.map((n) => (n.id === 'lb' ? { ...n, instances: 2 } : n.id === 'app' ? { ...n, instances: 8 } : n)), node('monitor')],
  edges: dCh8Ref.edges,
}
const dBossRef: Design = {
  nodes: dCh9Ref.nodes.map((n) => (n.id === 'app' ? { ...n, instances: 14 } : n.id === 'shard' ? { ...n, instances: 5 } : n.id === 'worker' ? { ...n, instances: 8 } : n.id === 'search' ? { ...n, instances: 2 } : n)),
  edges: dCh9Ref.edges,
}

const regions = { farShare: 0.5, farMs: 300 }
const slo = { p95Ms: 300, errorRate: 0.01 }
const lvl = (l: Partial<Level> & Pick<Level, 'id' | 'chapter' | 'title' | 'story' | 'placeable' | 'startDesign' | 'reference' | 'traffic' | 'budget' | 'minDesign' | 'hints' | 'debrief'>): Level => ({ cycles: 2, slo, ...l })
const T = (base: Rates, fanout = 0) => ({ base, peak: 1.3, cycle: 40, fanout })
const P1: CType[] = ['users', 'app']

export const LEVELS: Level[] = [
  lvl({
    id: 'ch0', chapter: 0, title: 'Tutorial: your first request',
    story: 'Friendbook is a website one student built in a dorm room. Connect the people using it to the server that answers them, then press Start and watch what a request does.',
    placeable: P1, startDesign: d0, reference: dTutorial,
    traffic: T(rates(60, 10, 0, 0)), budget: 100, minDesign: ['users', 'app'],
    hints: ['Look at where the requests are going. Is there a path from users to a server?', 'Every request needs a path from a client to a server.', 'Place Users and an App Server, then connect Users to the App Server.'],
    debrief: { note: 'Large social networks still begin with this exact shape: clients send requests, servers answer. Everything else in this game exists to keep that exchange fast as it grows.', diffs: { users: 'Source of every request.', app: 'Runs the application logic and answers each request.' } },
  }),
  lvl({
    id: 'ch1', chapter: 1, title: 'Year one: the dorm-room launch',
    story: 'Friendbook now stores profiles and friendships in a database, and people are uploading photos. Pages are crawling and the database is choking. Find out why.',
    placeable: [...P1, 'db', 'storage'], startDesign: dCh1Start, reference: dCh1Ref,
    traffic: T(rates(40, 8, 30, 4)), budget: 450, minDesign: ['db', 'storage'],
    hints: ['Look at what the database is busy with. Is it all profile data?', 'Big files do not belong in a database.', 'Place Object Storage and connect the App Server to it so photos skip the database.'],
    debrief: { note: 'Large social networks keep structured data (profiles, friendships) in databases and put photos and video in object storage, often behind a content delivery network. Databases are built for small, related rows; storage is built for big blobs.', diffs: { storage: 'Photos and uploads go here, so the database only handles profile and friendship data.', db: 'Now handles only reads and writes of structured data.' } },
  }),
  lvl({
    id: 'ch2', chapter: 2, title: 'Every college wants in',
    story: 'New campuses join every week. One server is overloaded and users see 503 errors. Make Friendbook handle three times the traffic.',
    placeable: [...P1, 'db', 'storage', 'lb'], startDesign: dCh1Ref, reference: dCh2Ref,
    traffic: T(rates(180, 30, 100, 15)), budget: 650, minDesign: ['lb', 'db', 'storage'],
    hints: ['Check the App Server. How full is it, and can one machine ever keep up?', 'Spread requests across several identical servers.', 'Place a Load Balancer between Users and the App Server, then add instances to the App Server.'],
    debrief: { note: 'Large social networks run many identical, stateless app servers behind load balancers, so they can add or lose servers without users noticing. Keeping servers stateless is what makes this possible.', diffs: { lb: 'Spreads requests across servers and skips unhealthy ones.', app: 'Several identical servers share the load; capacity is visible as a stack.' } },
  }),
  lvl({
    id: 'ch3', chapter: 3, title: 'News Feed launches',
    story: 'The new News Feed re-reads every friend\'s posts on every refresh. The servers cope, but the database is drowning in reads. Take the pressure off it.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache'], startDesign: dCh3Start, reference: dCh3Ref,
    traffic: T(rates(450, 40, 80, 10)), budget: 900, minDesign: ['cache', 'db', 'storage', 'lb'],
    hints: ['The App Servers are fine. What is the Database busy with?', 'Keep popular data in memory so most reads never reach the database.', 'Place a Cache between the App Server and the Database, connect App to Cache and Cache to Database, and make it a big one in settings.'],
    debrief: { note: 'Large social networks put in-memory caches in front of their databases and serve the bulk of reads from memory, often with replicas behind for the rest. Caches are cheap relative to the database load they remove, but they add a new failure: when a cache is flushed, every request falls through at once.', diffs: { cache: 'Serves most feed reads from memory so the database only sees the misses.', db: 'Now carries only writes and the reads the cache could not answer.' } },
  }),
  lvl({
    id: 'ch4', chapter: 4, title: 'Photos go global',
    story: 'Friendbook has gone international. People abroad wait seconds for photos, and the storage service is maxed out serving every image from one place. Bring the content closer to the people.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns'], startDesign: dCh3Ref, reference: dCh4Ref,
    traffic: T(rates(200, 20, 600, 10)), budget: 900, minDesign: ['cdn', 'dns', 'storage'], regions,
    hints: ['Look at Object Storage and at how far half of your users are from it.', 'Serve popular files from edge servers near viewers, and route people to the nearest place.', 'Add a CDN in front of Object Storage for photos, and DNS in front of everything so users are routed to the nearest copy.'],
    debrief: { note: 'Large social networks serve images and video from content delivery networks with edge servers on every continent, and use DNS to steer each user to a nearby, healthy region. The origin storage only sees the small fraction of requests the edge could not answer.', diffs: { cdn: 'Edge servers answer most photo requests near the viewer; only misses reach storage.', dns: 'Routes each user toward the nearest region, cutting the distance every request travels.' } },
  }),
  lvl({
    id: 'ch5', chapter: 5, title: 'Likes, comments and notifications',
    story: 'Every post now notifies hundreds of friends. Posting stalls while the server works through the list. Do the slow part later, off the request path.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker'], startDesign: dCh4Ref, reference: dCh5Ref,
    traffic: T(rates(200, 60, 400, 10), 8), budget: 1150, minDesign: ['queue', 'worker'], regions,
    hints: ['Notice who is doing the work when someone posts. Does the user need to wait for it?', 'Drop a job on a queue and let workers handle it later.', 'Add a Message Queue and Workers; connect App Server to Queue and Queue to Workers, with enough workers to keep up.'],
    debrief: { note: 'Large social networks do the slow, fan-out work (notifying friends, updating feeds) in background workers fed by message queues. The user\'s request returns immediately; the queue absorbs bursts, and workers catch up. If workers fall behind far enough, the queue overflows and notifications are lost.', diffs: { queue: 'Holds jobs so posting returns immediately.', worker: 'Processes notifications in the background; enough of them keeps the queue short.' } },
  }),
  lvl({
    id: 'ch6', chapter: 6, title: '"Find your friends"',
    story: 'People search for each other by name. Every search scans the whole users table and the database cannot keep up. Give search its own system.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search'], startDesign: dCh5Ref, reference: dCh6Ref,
    traffic: T(rates(200, 30, 400, 10, 150), 8), budget: 1400, minDesign: ['search'], regions,
    hints: ['Look at which requests are hitting the Database hardest.', 'An index finds a name without scanning every row.', 'Add a Search Index and connect the App Server to it so searches stop touching the Database.'],
    debrief: { note: 'Large social networks keep a dedicated search index next to the main database and update it from the same stream of changes. Reads from the index are fast, at the cost of the index sometimes lagging a moment behind the truth.', diffs: { search: 'Answers name searches from an index instead of scanning the database.' } },
  }),
  lvl({
    id: 'ch7', chapter: 7, title: '100 million users',
    story: 'The users and posts tables no longer fit one primary database. Writes are the problem, and replicas cannot help with writes. Split the data.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard'], startDesign: dCh6Ref, reference: dCh7Ref,
    traffic: T(rates(400, 200, 400, 20, 200), 2), budget: 2200, minDesign: ['shard'], regions,
    hints: ['Look at the Database: is it reads or writes that fill it? Do replicas help?', 'Split the data across machines by a key, and pick the key carefully.', 'Replace the Database with a Sharded Database, with several shards, and set the shard key to user ID so load spreads evenly.'],
    debrief: { note: 'Large social networks split their biggest tables across many database machines by a key such as user ID, so each machine owns a slice. A poor key creates a hot shard, and celebrity accounts create hot spots even with a good one, which is why they are often handled specially.', diffs: { shard: 'Splits users and posts by user ID so writes spread across machines.' } },
  }),
  lvl({
    id: 'ch8', chapter: 8, title: 'Spam and fake accounts',
    story: 'Bots are flooding friend requests and posts. They use up capacity that real users need. Block the bots without blocking people.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard', 'limiter'], startDesign: dCh7Ref, reference: dCh8Ref,
    traffic: T(rates(400, 200, 400, 20, 200, 500), 2), budget: 2300, minDesign: ['limiter'], regions,
    hints: ['Look at the traffic: some of it is not real people.', 'A limit per user stops floods but a limit that is too strict blocks real people too.', 'Add a Rate Limiter in front of the Load Balancer and set a medium limit: strict limits block real users, lenient ones let bots through.'],
    debrief: { note: 'Large social networks put rate limits and gateways at the edge: per-user and per-address quotas, bursts allowed up to a point. The art is the threshold: too tight blocks real people during a busy moment, too loose lets abuse through.', diffs: { limiter: 'Drops most bot traffic at the door so it never uses app or database capacity.' } },
  }),
  lvl({
    id: 'ch9', chapter: 9, title: 'Chaos Monkey',
    story: 'From now on, things break on purpose: servers crash, a whole region goes dark, the cache is wiped. Survive it with no single point of failure, and make sure someone is told.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard', 'limiter', 'monitor'], startDesign: dCh8Ref, reference: dCh9Ref,
    traffic: T(rates(250, 100, 400, 10, 100, 100), 2), budget: 2500, minDesign: ['monitor'], regions,
    chaos: [
      { tick: 48, kind: 'crash', target: 'app', duration: 10 },
      { tick: 56, kind: 'crash', target: 'lb', duration: 8 },
      { tick: 64, kind: 'cacheFlush', duration: 1 },
      { tick: 70, kind: 'regionOut', duration: 6 },
    ],
    hints: ['Find the machine whose loss takes everything down.', 'Run at least one more than you need, so losing one is survivable.', 'Give the Load Balancer a second instance, keep spare App Server capacity, and add Monitoring so alerts fire fast.'],
    debrief: { note: 'Large social networks assume machines fail constantly. They run N+1 capacity everywhere, spread across regions, and test it deliberately with chaos engineering. Monitoring turns a long silent outage into a short, alerted one.', diffs: { lb: 'Two balancers: losing one no longer takes the front door down.', app: 'Spare capacity: a crash or a lost region leaves enough servers running.', monitor: 'Alerts fire early and crashed machines are replaced faster.' } },
  }),
  lvl({
    id: 'boss', chapter: 10, title: 'New Year\'s Eve at midnight',
    story: 'Midnight. Everyone in the world posts at once. A traffic spike, a crashed server, a bot attack, a flushed cache and a lost region all arrive in the same ten minutes. Use everything you have learned.',
    placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard', 'limiter', 'monitor'], startDesign: dCh9Ref, reference: dBossRef,
    traffic: { base: rates(350, 150, 500, 15, 150, 120), peak: 1.4, cycle: 40, fanout: 2 }, budget: 3600, minDesign: ['limiter', 'shard', 'monitor', 'cdn', 'queue', 'cache', 'search', 'lb'], regions,
    slo: { p95Ms: 280, errorRate: 0.008 },
    chaos: [
      { tick: 46, kind: 'spike', duration: 8, magnitude: 1.5 },
      { tick: 50, kind: 'crash', target: 'app', duration: 10 },
      { tick: 56, kind: 'botAttack', duration: 8, magnitude: 5 },
      { tick: 62, kind: 'cacheFlush', duration: 1 },
      { tick: 68, kind: 'regionOut', duration: 6 },
    ],
    hints: ['Everything at once: look for the weakest tier during the spike.', 'Your Chapter 9 design is the base; scale each tier for peak plus a lost machine.', 'Add servers, shards and workers until a spike plus a crash plus a lost region still leaves headroom.'],
    debrief: { note: 'Real launches and big events are rehearsed exactly like this: load tests at multiples of expected peak, with failures injected on purpose, so the first time everything goes wrong is not the real time.', diffs: { app: 'Sized for the spike and a lost region.', shard: 'More shards keep the busiest shard under capacity.', worker: 'Enough workers that the queue never spills.' } },
  }),
]

// Sandbox (FR-20): everything unlocked, custom traffic and chaos. Never scored.
export const SANDBOX_LEVEL: Level = lvl({
  id: 'sandbox', chapter: 99, title: 'Sandbox', story: 'Everything is unlocked. Add parts, wire them up, set the traffic, and break it on purpose with the chaos buttons.',
  placeable: ALL_TYPES_NO_USERS(), startDesign: dCh2Ref, reference: dBossRef,
  traffic: { base: rates(150, 25, 80, 10, 0, 10), peak: 1.3, cycle: 40, fanout: 0 }, cycles: 1000, budget: 99999, minDesign: [], regions, sandbox: true,
  hints: ['', '', ''], debrief: { note: '', diffs: {} },
})
function ALL_TYPES_NO_USERS(): CType[] { return ['users', 'dns', 'cdn', 'limiter', 'lb', 'app', 'cache', 'queue', 'worker', 'db', 'shard', 'search', 'storage', 'monitor'] }

// Interview mode (FR-22): an open prompt, a time limit and a scored rubric. Nothing is unlocked by lessons here.
export const INTERVIEW_LEVEL: Level = lvl({
  id: 'interview', chapter: 98, title: 'Interview: a worldwide photo feed',
  story: 'You have 15 minutes. Design a system for a photo-sharing feed with people on every continent, frequent posting and search, and the occasional bot attack. Build it, press Start, and you will be scored on a rubric the way an interviewer would.',
  placeable: ALL_TYPES_NO_USERS(), startDesign: d0, reference: dBossRef,
  traffic: { base: rates(300, 120, 450, 12, 120, 100), peak: 1.4, cycle: 40, fanout: 2 }, budget: 3400, minDesign: [], regions,
  slo: { p95Ms: 300, errorRate: 0.01 }, interview: { minutes: 15 },
  chaos: [{ tick: 50, kind: 'crash', target: 'app', duration: 10 }, { tick: 64, kind: 'cacheFlush', duration: 1 }],
  hints: ['', '', ''], debrief: { note: '', diffs: {} },
})

// The interviewer's rubric: outcomes first, then the design choices a strong answer makes.
export function rubric(d: Design, slos: { pass: boolean }[], cost: number, budget: number): { label: string; pass: boolean }[] {
  const has = (t: CType) => d.nodes.some((n) => n.type === t)
  const count = (t: CType) => d.nodes.filter((n) => n.type === t).reduce((s, n) => s + n.instances, 0)
  return [
    { label: 'Meets the latency target', pass: slos[0]?.pass ?? false },
    { label: 'Meets the error-rate target', pass: slos[1]?.pass ?? false },
    { label: 'Stays within budget', pass: cost <= budget },
    { label: 'Caches hot reads', pass: has('cache') },
    { label: 'Serves photos from a CDN', pass: has('cdn') },
    { label: 'Does slow work off the request path (queue and workers)', pass: has('queue') && has('worker') },
    { label: 'Scales the data tier for writes (shards)', pass: has('shard') },
    { label: 'Protects itself from abuse (rate limiter)', pass: has('limiter') },
    { label: 'No single point of failure (2+ balancers and servers)', pass: count('lb') >= 2 && count('app') >= 2 },
    { label: 'Has monitoring and alerts', pass: has('monitor') },
  ]
}

export const levelById = (id: string) => (id === 'sandbox' ? SANDBOX_LEVEL : id === 'interview' ? INTERVIEW_LEVEL : LEVELS.find((l) => l.id === id)!)

// Defaults for a freshly placed part. Deliberately not the best setting: choosing the right one is the lesson.
export const DEFAULT_CONFIG: Partial<Record<CType, NodeConfig>> = {
  cache: { cacheSize: 1, expiry: 5 }, shard: { shardKey: 'region' }, limiter: { limit: 'low' },
}

const overlaps = (a: DNode, b: { x: number; y: number; type: CType }) => {
  const [aw, ah] = SIZE[a.type], [bw, bh] = SIZE[b.type]
  return a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh && b.y < a.y + ah
}
export function freeSlot(type: CType, d: Design): [number, number] {
  for (const [x, y] of SLOTS[type]) if (!d.nodes.some((n) => overlaps(n, { x, y, type }))) return [x, y]
  const [x, y] = SLOTS[type][SLOTS[type].length - 1]
  return [x, y + 4 * d.nodes.filter((n) => n.type === type).length]
}
