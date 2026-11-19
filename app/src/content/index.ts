// Content as data. shortcut: typed TS objects instead of JSON files + JSON Schema in CI; the content tests in content.test.ts play the CI role.
import { SIZE, clampCell } from '../tokens'
import type { CType, DNode, Design, Level, NodeConfig, Rates } from '../schema'

// Candidate grid slots per component, in cells. The first free one is used when the player places a part.
// How many App Servers and Workers each stage's solution runs (tuned so each stage clears with headroom).
const APPS = { ch3: 4, ch4: 2, ch5: 2, ch6: 3, ch7: 5, ch8: 5, ch9: 4, boss: 7 }
const WORKERS = { ch5: 3, boss: 4 }

// Board layout, in cells. Repeatable parts (App Servers, Workers, Load Balancers) have several slots.
const rows = (k: number): number[] => (k <= 0 ? [] : k === 1 ? [5] : k === 2 ? [3.5, 6.5] : k === 3 ? [2, 5, 8] : [0.5, 3.5, 6.5, 9.5])
const appSpots = (n: number): [number, number][] => [...rows(Math.min(n, 4)).map((y): [number, number] => [13.5, y]), ...rows(n - 4).map((y): [number, number] => [16.5, y])]
export const SLOTS: Record<CType, [number, number][]> = {
  users: [[0.5, 5]], dns: [[3.5, 5]], limiter: [[6.5, 5]], cdn: [[6.5, 1]], lb: [[9.5, 5], [9.5, 8.5]],
  app: [[13.5, 5], [13.5, 2], [13.5, 8], [16.5, 5], [16.5, 2], [16.5, 8], [13.5, 10.25], [16.5, 10.25]],
  cache: [[19.5, 5]], queue: [[19.5, 1.5]], search: [[19.5, 8.5]],
  db: [[22.5, 5]], shard: [[22.5, 5]], storage: [[22.5, 8.5]],
  worker: [[25.5, 0.5], [25.5, 3.5], [25.5, 6.5], [25.5, 9.5]], monitor: [[0.5, 9.5]],
}
const rates = (read: number, write: number, photo: number, upload: number, search = 0, bot = 0): Rates => ({ read, write, photo, upload, search, bot })

// Every stage's design is built from separate machines: more capacity means more App Servers on the board.
interface Spec { apps?: number; lbs?: number; storage?: boolean; cache?: NodeConfig; dns?: boolean; cdn?: boolean; workers?: number; search?: boolean; shards?: number; limiter?: NodeConfig['limit']; monitor?: boolean }
function build(sp: Spec): Design {
  const nodes: DNode[] = []
  const edges: { from: string; to: string }[] = []
  const add = (id: string, type: CType, x: number, y: number, instances = 1, config?: NodeConfig) => { nodes.push({ id, type, x, y, instances, ...(config ? { config } : {}) }); return id }
  const wire = (from: string, to: string) => edges.push({ from, to })
  add('users', 'users', 0.5, 5)
  let door = 'users'
  if (sp.dns) { add('dns', 'dns', 3.5, 5); wire('users', 'dns'); door = 'dns' }
  if (sp.cdn) { add('cdn', 'cdn', 6.5, 1); wire(door, 'cdn') }
  if (sp.limiter) { add('limiter', 'limiter', 6.5, 5, 1, { limit: sp.limiter }); wire(door, 'limiter'); door = 'limiter' }
  const apps = appSpots(sp.apps ?? 1).map(([x, y], i) => add(i ? `app${i + 1}` : 'app', 'app', x, y))
  const lbs = sp.lbs ?? 0
  if (lbs) {
    for (let i = 0; i < lbs; i++) {
      const lb = add(i ? `lb${i + 1}` : 'lb', 'lb', 9.5, lbs === 1 ? 5 : [3.5, 6.5][i])
      wire(door, lb)
      for (const a of apps) wire(lb, a)
    }
  } else wire(door, apps[0])
  const data = sp.shards ? add('shard', 'shard', 22.5, 5, sp.shards, { shardKey: 'userId' }) : add('db', 'db', 22.5, 5)
  if (sp.storage) add('storage', 'storage', 22.5, 8.5)
  if (sp.cache) add('cache', 'cache', 19.5, 5, 1, sp.cache)
  if (sp.workers) add('queue', 'queue', 19.5, 1.5)
  if (sp.search) add('search', 'search', 19.5, 8.5)
  for (const a of apps) {
    if (sp.cache) wire(a, 'cache')
    wire(a, data)
    if (sp.storage) wire(a, 'storage')
    if (sp.workers) wire(a, 'queue')
    if (sp.search) wire(a, 'search')
  }
  if (sp.cache) wire('cache', data)
  if (sp.cdn) wire('cdn', 'storage')
  rows(sp.workers ?? 0).forEach((_, i) => { const w = add(i ? `worker${i + 1}` : 'worker', 'worker', 25.5, [0.5, 3.5, 6.5, 9.5][i]); wire('queue', w) })
  if (sp.monitor) add('monitor', 'monitor', 0.5, 9.5)
  return { nodes, edges }
}

const big: NodeConfig = { cacheSize: 3, expiry: 30 }
const d0: Design = { nodes: [], edges: [] }
const dCh1Start = build({})
const dCh1Ref = build({ storage: true })
const dCh2Ref = build({ storage: true, lbs: 1, apps: 2 })
const dCh3Ref = build({ storage: true, lbs: 1, apps: APPS.ch3, cache: big })
const dCh4Ref = build({ storage: true, lbs: 1, apps: APPS.ch4, cache: big, dns: true, cdn: true })
const dCh5Ref = build({ storage: true, lbs: 1, apps: APPS.ch5, cache: big, dns: true, cdn: true, workers: WORKERS.ch5 })
const dCh6Ref = build({ storage: true, lbs: 1, apps: APPS.ch6, cache: big, dns: true, cdn: true, workers: WORKERS.ch5, search: true })
const dCh7Ref = build({ storage: true, lbs: 1, apps: APPS.ch7, cache: big, dns: true, cdn: true, workers: WORKERS.ch5, search: true, shards: 4 })
const dCh8Ref = build({ storage: true, lbs: 1, apps: APPS.ch8, cache: big, dns: true, cdn: true, workers: WORKERS.ch5, search: true, shards: 4, limiter: 'medium' })
const dCh9Ref = build({ storage: true, lbs: 2, apps: APPS.ch9, cache: big, dns: true, cdn: true, workers: WORKERS.ch5, search: true, shards: 4, limiter: 'medium', monitor: true })
const dBossRef = build({ storage: true, lbs: 2, apps: APPS.boss, cache: big, dns: true, cdn: true, workers: WORKERS.boss, search: true, shards: 5, limiter: 'medium', monitor: true })

const regions = { farShare: 0.5, farMs: 300 }
const slo = { p95Ms: 300, errorRate: 0.01 }
const lvl = (l: Partial<Level> & Pick<Level, 'id' | 'chapter' | 'title' | 'story' | 'placeable' | 'startDesign' | 'reference' | 'traffic' | 'budget' | 'minDesign' | 'hints' | 'debrief'>): Level => ({ cycles: 2, slo, ...l })
const T = (base: Rates, fanout = 0) => ({ base, peak: 1.3, cycle: 40, fanout })
// Every part is available at every stage. Choosing the right one is the puzzle.
const ALL: CType[] = ['users', 'dns', 'cdn', 'limiter', 'lb', 'app', 'cache', 'queue', 'worker', 'db', 'shard', 'search', 'storage', 'monitor']

export const LEVELS: Level[] = [
  lvl({
    id: 'ch0', chapter: 0, title: 'Launch day',
    story: 'Friendbook is live and your first classmates are signing up. Their requests go to your App Server, which keeps profiles in the Database. Press Play and keep everything healthy until the day ends.',
    placeable: ALL, startDesign: dCh1Start, reference: dCh1Start,
    traffic: T(rates(60, 10, 0, 0)), budget: 300, minDesign: ['users', 'app', 'db'],
    hints: ['Press Play and watch the dots: each one is a group of requests travelling through your system.', 'Requests go from Users to the App Server, which reads and writes the Database. The bars under each part show how busy it is.', 'Nothing needs changing yet: let the day run to the end.'],
    debrief: { note: 'Large social networks still begin with this exact shape: clients send requests, servers answer. Everything else in this game exists to keep that exchange fast as it grows.', diffs: { users: 'Source of every request.', app: 'Runs the application logic and answers each request.', db: 'Keeps profiles and friendships.' } },
  }),
  lvl({
    id: 'ch1', chapter: 1, title: 'Photos arrive',
    story: 'Everyone is uploading profile photos, and they all go into the database along with everything else. Pages are crawling. Find what is choking, and fix it.',
    placeable: ALL, startDesign: dCh1Start, reference: dCh1Ref,
    traffic: T(rates(40, 8, 30, 4)), budget: 450, minDesign: ['db', 'storage'],
    hints: ['Look at what the database is busy with. Is it all profile data?', 'Big files do not belong in a database.', 'Place Object Storage and connect the App Server to it so photos skip the database.'],
    debrief: { note: 'Large social networks keep structured data (profiles, friendships) in databases and put photos and video in object storage, often behind a content delivery network. Databases are built for small, related rows; storage is built for big blobs.', diffs: { storage: 'Photos and uploads go here, so the database only handles profile and friendship data.', db: 'Now handles only reads and writes of structured data.' } },
  }),
  lvl({
    id: 'ch2', chapter: 2, title: 'Every college wants in',
    story: 'New campuses join every week and traffic has tripled. Users are starting to see errors. There is only so much one machine can do.',
    placeable: ALL, startDesign: dCh1Ref, reference: dCh2Ref,
    traffic: T(rates(180, 30, 100, 15)), budget: 650, minDesign: ['lb', 'db', 'storage'],
    hints: ['Check the App Server. How full is it, and can one machine ever keep up?', 'Spread requests across several identical servers.', 'Place a Load Balancer between Users and the App Server, then drag in more App Servers and connect the Load Balancer to each one.'],
    debrief: { note: 'Large social networks run many identical, stateless app servers behind load balancers, so they can add or lose servers without users noticing. Keeping servers stateless is what makes this possible.', diffs: { lb: 'Spreads requests across servers and skips unhealthy ones.', app: 'Several identical App Servers share the load; you can see each one on the board.', app2: 'A second App Server, so the work is shared.' } },
  }),
  lvl({
    id: 'ch3', chapter: 3, title: 'The News Feed',
    story: 'The new News Feed re-reads friends\' posts on every refresh. The database is drowning in the same reads, over and over.',
    placeable: ALL, startDesign: dCh2Ref, reference: dCh3Ref,
    traffic: T(rates(520, 40, 80, 10)), budget: 1000, minDesign: ['cache', 'db', 'storage', 'lb'],
    hints: ['The App Servers are fine. What is the Database busy with?', 'Keep popular data in memory so most reads never reach the database.', 'Place a Cache between the App Server and the Database, connect App to Cache and Cache to Database, and make it a big one in settings.'],
    debrief: { note: 'Large social networks put in-memory caches in front of their databases and serve the bulk of reads from memory, often with replicas behind for the rest. Caches are cheap relative to the database load they remove, but they add a new failure: when a cache is flushed, every request falls through at once.', diffs: { cache: 'Serves most feed reads from memory so the database only sees the misses.', db: 'Now carries only writes and the reads the cache could not answer.' } },
  }),
  lvl({
    id: 'ch4', chapter: 4, title: 'Going global',
    story: 'Half of your users now live on other continents. For them every page is slow and photos take seconds. Distance itself has become the problem.',
    placeable: ALL, startDesign: dCh3Ref, reference: dCh4Ref,
    traffic: T(rates(200, 20, 600, 10)), budget: 900, minDesign: ['cdn', 'dns', 'storage'], regions,
    hints: ['Look at Object Storage and at how far half of your users are from it.', 'Serve popular files from edge servers near viewers, and route people to the nearest place.', 'Add a CDN in front of Object Storage for photos, and DNS in front of everything so users are routed to the nearest copy.'],
    debrief: { note: 'Large social networks serve images and video from content delivery networks with edge servers on every continent, and use DNS to steer each user to a nearby, healthy region. The origin storage only sees the small fraction of requests the edge could not answer.', diffs: { cdn: 'Edge servers answer most photo requests near the viewer; only misses reach storage.', dns: 'Routes each user toward the nearest region, cutting the distance every request travels.' } },
  }),
  lvl({
    id: 'ch5', chapter: 5, title: 'Notifications',
    story: 'Every post now notifies hundreds of friends, and posting waits until every notification is sent. Posting has slowed to a crawl.',
    placeable: ALL, startDesign: dCh4Ref, reference: dCh5Ref,
    traffic: T(rates(200, 60, 400, 10), 8), budget: 1250, minDesign: ['queue', 'worker'], regions,
    hints: ['Notice who is doing the work when someone posts. Does the user need to wait for it?', 'Drop a job on a queue and let workers handle it later.', 'Add a Message Queue and Workers; connect App Server to Queue and Queue to Workers, with enough workers to keep up.'],
    debrief: { note: 'Large social networks do the slow, fan-out work (notifying friends, updating feeds) in background workers fed by message queues. The user\'s request returns immediately; the queue absorbs bursts, and workers catch up. If workers fall behind far enough, the queue overflows and notifications are lost.', diffs: { queue: 'Holds jobs so posting returns immediately.', worker: 'Processes notifications in the background; enough of them keeps the queue short.' } },
  }),
  lvl({
    id: 'ch6', chapter: 6, title: 'Find your friends',
    story: 'People search for each other by name, and every search reads the whole users table. The database cannot keep up.',
    placeable: ALL, startDesign: dCh5Ref, reference: dCh6Ref,
    traffic: T(rates(200, 30, 400, 10, 150), 8), budget: 1600, minDesign: ['search'], regions,
    hints: ['Look at which requests are hitting the Database hardest.', 'An index finds a name without scanning every row.', 'Add a Search Index and connect the App Server to it so searches stop touching the Database.'],
    debrief: { note: 'Large social networks keep a dedicated search index next to the main database and update it from the same stream of changes. Reads from the index are fast, at the cost of the index sometimes lagging a moment behind the truth.', diffs: { search: 'Answers name searches from an index instead of scanning the database.' } },
  }),
  lvl({
    id: 'ch7', chapter: 7, title: '100 million users',
    story: 'Writes have outgrown any single database. Copies of it cannot help, because every write still lands in one place.',
    placeable: ALL, startDesign: dCh6Ref, reference: dCh7Ref,
    traffic: T(rates(400, 200, 400, 20, 200), 2), budget: 2400, minDesign: ['shard'], regions,
    hints: ['Look at the Database: is it reads or writes that fill it? Do replicas help?', 'Split the data across machines by a key, and pick the key carefully.', 'Replace the Database with a Sharded Database, with several shards, and set the shard key to user ID so load spreads evenly.'],
    debrief: { note: 'Large social networks split their biggest tables across many database machines by a key such as user ID, so each machine owns a slice. A poor key creates a hot shard, and celebrity accounts create hot spots even with a good one, which is why they are often handled specially.', diffs: { shard: 'Splits users and posts by user ID so writes spread across machines.' } },
  }),
  lvl({
    id: 'ch8', chapter: 8, title: 'Spam and fake accounts',
    story: 'Bots are flooding friend requests and posts, burning capacity your real users need. Stop them without stopping people.',
    placeable: ALL, startDesign: dCh7Ref, reference: dCh8Ref,
    traffic: T(rates(400, 200, 400, 20, 200, 500), 2), budget: 2500, minDesign: ['limiter'], regions,
    hints: ['Look at the traffic: some of it is not real people.', 'A limit per user stops floods but a limit that is too strict blocks real people too.', 'Add a Rate Limiter in front of the Load Balancer and set a medium limit: strict limits block real users, lenient ones let bots through.'],
    debrief: { note: 'Large social networks put rate limits and gateways at the edge: per-user and per-address quotas, bursts allowed up to a point. The art is the threshold: too tight blocks real people during a busy moment, too loose lets abuse through.', diffs: { limiter: 'Drops most bot traffic at the door so it never uses app or database capacity.' } },
  }),
  lvl({
    id: 'ch9', chapter: 9, title: 'Things break',
    story: 'From now on machines crash, a region goes dark and the cache gets wiped, on purpose. Stay up through all of it, and make sure someone is told.',
    placeable: ALL, startDesign: dCh8Ref, reference: dCh9Ref,
    traffic: T(rates(250, 100, 400, 10, 100, 100), 2), budget: 2500, minDesign: ['monitor'], regions,
    chaos: [
      { tick: 48, kind: 'crash', target: 'app', duration: 10 },
      { tick: 56, kind: 'crash', target: 'lb', duration: 8 },
      { tick: 64, kind: 'cacheFlush', duration: 1 },
      { tick: 70, kind: 'regionOut', duration: 6 },
    ],
    hints: ['Find the machine whose loss takes everything down.', 'Run at least one more than you need, so losing one is survivable.', 'Add a second Load Balancer, keep a spare App Server or two, and add Monitoring so alerts fire fast.'],
    debrief: { note: 'Large social networks assume machines fail constantly. They run N+1 capacity everywhere, spread across regions, and test it deliberately with chaos engineering. Monitoring turns a long silent outage into a short, alerted one.', diffs: { lb: 'Two balancers: losing one no longer takes the front door down.', lb2: 'The second Load Balancer.', app: 'Spare servers: a crash or a lost region leaves enough running.', monitor: 'Alerts fire early and crashed machines are replaced faster.' } },
  }),
  lvl({
    id: 'boss', chapter: 10, title: 'New Year\'s Eve at midnight',
    story: 'Midnight. Everyone in the world posts at once. A traffic spike, a crashed server, a bot attack, a flushed cache and a lost region all arrive in the same ten minutes. Use everything you have learned.',
    placeable: ALL, startDesign: dCh9Ref, reference: dBossRef,
    traffic: { base: rates(350, 150, 500, 15, 150, 120), peak: 1.4, cycle: 40, fanout: 2 }, budget: 3600, minDesign: ['limiter', 'shard', 'monitor', 'cdn', 'queue', 'cache', 'search', 'lb'], regions,
    slo: { p95Ms: 280, errorRate: 0.008 },
    chaos: [
      { tick: 46, kind: 'spike', duration: 8, magnitude: 1.5 },
      { tick: 50, kind: 'crash', target: 'app', duration: 10 },
      { tick: 56, kind: 'botAttack', duration: 8, magnitude: 5 },
      { tick: 62, kind: 'cacheFlush', duration: 1 },
      { tick: 68, kind: 'regionOut', duration: 6 },
    ],
    hints: ['Everything at once: look for the weakest tier during the spike.', 'Your Chapter 9 design is the base; scale each tier for peak plus a lost machine.', 'Add App Servers, shards and Workers until a spike plus a crash plus a lost region still leaves headroom.'],
    debrief: { note: 'Real launches and big events are rehearsed exactly like this: load tests at multiples of expected peak, with failures injected on purpose, so the first time everything goes wrong is not the real time.', diffs: { app: 'Sized for the spike and a lost region.', shard: 'More shards keep the busiest shard under capacity.', worker: 'Enough workers that the queue never spills.' } },
  }),
]

// Parts appear in the order the game needs them, and each stage unlocks the part(s) its problem calls for.
export const UNLOCK_ORDER: CType[] = ['users', 'app', 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard', 'limiter', 'monitor']
export const STAGE_UNLOCKS: Record<string, CType[]> = {
  ch0: ['users', 'app', 'db'], ch1: ['storage'], ch2: ['lb'], ch3: ['cache'], ch4: ['cdn', 'dns'], ch5: ['queue', 'worker'],
  ch6: ['search'], ch7: ['shard'], ch8: ['limiter'], ch9: ['monitor'], boss: [],
}
// Each stage can use everything unlocked so far.
{
  let open: CType[] = []
  for (const l of LEVELS) { open = [...open, ...(STAGE_UNLOCKS[l.id] ?? [])]; l.placeable = open }
}
export const unlockStage = (t: CType) => LEVELS.findIndex((l) => STAGE_UNLOCKS[l.id]?.includes(t))

// The introduction a part gets when it unlocks: what it is, and what it is for.
export const PART_INTRO: Record<CType, { what: string; use: string }> = {
  users: { what: 'The people using Friendbook.', use: 'Every request starts here. More users means more traffic.' },
  app: { what: "A server that runs Friendbook's code.", use: 'It answers each request: it builds pages, saves posts and talks to the database.' },
  db: { what: 'A store for structured data.', use: 'It keeps profiles, posts and friendships, and finds them quickly. Read replicas can share the reading.' },
  storage: { what: 'A store for big files.', use: 'It holds photos and videos so they never clog the database. It is cheap, and built for large files.' },
  lb: { what: 'A traffic director in front of your servers.', use: 'It spreads requests across several App Servers, so you can run more than one and skip any that break.' },
  cache: { what: 'Fast memory for popular data.', use: 'It answers repeated reads instantly, so the database only sees what it has not seen before.' },
  cdn: { what: 'Edge servers all around the world.', use: 'They keep copies of popular files, like photos, close to the people viewing them.' },
  dns: { what: "The internet's directory.", use: 'It sends each user to the nearest copy of your system, so requests travel less far.' },
  queue: { what: 'A waiting line for jobs.', use: 'Slow work, like notifying friends, waits here so users do not have to.' },
  worker: { what: 'A machine that works in the background.', use: 'It takes jobs off the queue and does them. Add more when the queue starts to grow.' },
  search: { what: 'An index of names.', use: 'It finds people instantly, without reading the whole database.' },
  shard: { what: 'A database split into pieces.', use: 'It spreads data, and the writes that come with it, across several machines by a key such as user ID.' },
  limiter: { what: 'A bouncer at the door.', use: 'It caps how many requests one user can send, so bots cannot crowd out real people.' },
  monitor: { what: 'Dashboards and alarms.', use: 'It spots failures fast and alerts you, so broken machines are replaced sooner.' },
}

// What each part does, in plain words. Shown on hover in the hotbar and in the inspector.
export const PART_INFO: Record<CType, string> = {
  users: 'Your users. Every request starts here.',
  dns: 'Points each user to the nearest copy of your system.',
  cdn: 'Edge servers that keep popular files, like photos, close to the people viewing them.',
  limiter: 'Turns away abusive traffic before it reaches your servers.',
  lb: 'Spreads requests across several App Servers, so you can run more than one.',
  app: 'Runs Friendbook and answers requests. To handle more, add more App Servers behind a Load Balancer.',
  cache: 'Fast memory that answers repeated reads without asking the database.',
  queue: 'Holds slow jobs so users do not have to wait for them.',
  worker: 'Takes jobs off the queue and does them in the background.',
  db: 'Stores profiles, posts and friendships. Read replicas share the reading, not the writing.',
  shard: 'A database split across machines by a key, so writes spread out.',
  search: 'Finds people by name without reading the whole database.',
  storage: 'Stores big files like photos and videos.',
  monitor: 'Watches everything and alerts you fast when something breaks.',
}

// Sandbox (FR-20): everything unlocked, custom traffic and chaos. Never scored.
export const SANDBOX_LEVEL: Level = lvl({
  id: 'sandbox', chapter: 99, title: 'Sandbox', story: 'Everything is unlocked. Add parts, wire them up, set the traffic, and break it on purpose with the chaos buttons.',
  placeable: ALL_TYPES_NO_USERS(), startDesign: dCh2Ref, reference: dBossRef,
  traffic: { base: rates(150, 25, 80, 10, 0, 10), peak: 1.3, cycle: 40, fanout: 0 }, cycles: 1000, budget: 99999, minDesign: [], sandbox: true,
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
    { label: 'Pages load fast enough', pass: slos[0]?.pass ?? false },
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

// Parts keep a little room underneath for their label.
const overlaps = (a: DNode, b: { x: number; y: number; type: CType }) => {
  const [aw, ah] = SIZE[a.type], [bw, bh] = SIZE[b.type]
  return a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh + 0.6 && b.y < a.y + ah + 0.6
}

// Where a part dropped at (x, y) should land: clamped to the canvas, and nudged to the nearest free spot if it would sit on another part.
export function resolveSpot(d: Design, type: CType, x: number, y: number, ignoreId?: string): [number, number] {
  const [cx, cy] = clampCell(type, x, y)
  const hit = (px: number, py: number) => d.nodes.some((n) => n.id !== ignoreId && overlaps(n, { x: px, y: py, type }))
  if (!hit(cx, cy)) return [cx, cy]
  for (let r = 0.5; r <= 10; r += 0.5)
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      const [nx, ny] = clampCell(type, cx + dx, cy + dy)
      if (!hit(nx, ny)) return [nx, ny]
    }
  return [cx, cy]
}
export function freeSlot(type: CType, d: Design): [number, number] {
  for (const [x, y] of SLOTS[type]) if (!d.nodes.some((n) => overlaps(n, { x, y, type }))) return [x, y]
  const [x, y] = SLOTS[type][SLOTS[type].length - 1]
  return [x, y + 4 * d.nodes.filter((n) => n.type === type).length]
}
