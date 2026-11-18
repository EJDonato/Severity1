// Content as data. shortcut: typed TS objects instead of JSON files + JSON Schema in CI; the content tests in content.test.ts play the CI role.
import { SIZE } from '../tokens'
import type { CType, DNode, Design, Lesson, Level, NodeConfig, Rates } from '../schema'

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
const lvl = (l: Partial<Level> & Pick<Level, 'id' | 'chapter' | 'title' | 'story' | 'lessons' | 'placeable' | 'startDesign' | 'reference' | 'traffic' | 'budget' | 'minDesign' | 'hints' | 'codex' | 'debrief'>): Level => ({ cycles: 2, slo, ...l })
const T = (base: Rates, fanout = 0) => ({ base, peak: 1.3, cycle: 40, fanout })
const P1: CType[] = ['users', 'app']

export const LEVELS: Level[] = [
  lvl({
    id: 'ch0', chapter: 0, title: 'Tutorial: your first request',
    story: 'Friendbook is a website one student built in a dorm room. Connect the people using it to the server that answers them, then press Start and watch what a request does.',
    lessons: ['client-server', 'latency'], placeable: P1, startDesign: d0, reference: dTutorial,
    traffic: T(rates(60, 10, 0, 0)), budget: 100, minDesign: ['users', 'app'],
    hints: ['Look at where the requests are going. Is there a path from users to a server?', 'Open the Codex card "Client–server": every request needs a path from a client to a server.', 'Place Users and an App Server, then connect Users to the App Server.'],
    codex: 'client-server',
    debrief: { note: 'Large social networks still begin with this exact shape: clients send requests, servers answer. Everything else in this game exists to keep that exchange fast as it grows.', diffs: { users: 'Source of every request.', app: 'Runs the application logic and answers each request.' } },
  }),
  lvl({
    id: 'ch1', chapter: 1, title: 'Year one: the dorm-room launch',
    story: 'Friendbook now stores profiles and friendships in a database, and people are uploading photos. Pages are crawling and the database is choking. Find out why.',
    lessons: ['db-storage'], placeable: [...P1, 'db', 'storage'], startDesign: dCh1Start, reference: dCh1Ref,
    traffic: T(rates(40, 8, 30, 4)), budget: 450, minDesign: ['db', 'storage'],
    hints: ['Look at what the database is busy with. Is it all profile data?', 'Open the Codex card "Databases vs. object storage": big files do not belong in a database.', 'Place Object Storage and connect the App Server to it so photos skip the database.'],
    codex: 'db-storage',
    debrief: { note: 'Large social networks keep structured data (profiles, friendships) in databases and put photos and video in object storage, often behind a content delivery network. Databases are built for small, related rows; storage is built for big blobs.', diffs: { storage: 'Photos and uploads go here, so the database only handles profile and friendship data.', db: 'Now handles only reads and writes of structured data.' } },
  }),
  lvl({
    id: 'ch2', chapter: 2, title: 'Every college wants in',
    story: 'New campuses join every week. One server is overloaded and users see 503 errors. Make Friendbook handle three times the traffic.',
    lessons: ['load-balancing'], placeable: [...P1, 'db', 'storage', 'lb'], startDesign: dCh1Ref, reference: dCh2Ref,
    traffic: T(rates(180, 30, 100, 15)), budget: 650, minDesign: ['lb', 'db', 'storage'],
    hints: ['Check the App Server. How full is it, and can one machine ever keep up?', 'Open the Codex card "Load balancing": spread requests across several identical servers.', 'Place a Load Balancer between Users and the App Server, then add instances to the App Server.'],
    codex: 'load-balancing',
    debrief: { note: 'Large social networks run many identical, stateless app servers behind load balancers, so they can add or lose servers without users noticing. Keeping servers stateless is what makes this possible.', diffs: { lb: 'Spreads requests across servers and skips unhealthy ones.', app: 'Several identical servers share the load; capacity is visible as a stack.' } },
  }),
  lvl({
    id: 'ch3', chapter: 3, title: 'News Feed launches',
    story: 'The new News Feed re-reads every friend\'s posts on every refresh. The servers cope, but the database is drowning in reads. Take the pressure off it.',
    lessons: ['caching', 'replication'], placeable: [...P1, 'db', 'storage', 'lb', 'cache'], startDesign: dCh3Start, reference: dCh3Ref,
    traffic: T(rates(450, 40, 80, 10)), budget: 900, minDesign: ['cache', 'db', 'storage', 'lb'],
    hints: ['The App Servers are fine. What is the Database busy with?', 'Open the Codex card "Caching": keep popular data in memory so most reads never reach the database.', 'Place a Cache between the App Server and the Database, connect App to Cache and Cache to Database, and make it a big one in settings.'],
    codex: 'caching',
    debrief: { note: 'Large social networks put in-memory caches in front of their databases and serve the bulk of reads from memory, often with replicas behind for the rest. Caches are cheap relative to the database load they remove, but they add a new failure: when a cache is flushed, every request falls through at once.', diffs: { cache: 'Serves most feed reads from memory so the database only sees the misses.', db: 'Now carries only writes and the reads the cache could not answer.' } },
  }),
  lvl({
    id: 'ch4', chapter: 4, title: 'Photos go global',
    story: 'Friendbook has gone international. People abroad wait seconds for photos, and the storage service is maxed out serving every image from one place. Bring the content closer to the people.',
    lessons: ['cdn-dns'], placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns'], startDesign: dCh3Ref, reference: dCh4Ref,
    traffic: T(rates(200, 20, 600, 10)), budget: 900, minDesign: ['cdn', 'dns', 'storage'], regions,
    hints: ['Look at Object Storage and at how far half of your users are from it.', 'Open the Codex card "CDNs, DNS and geography": serve popular files from edge servers near viewers, and route people to the nearest place.', 'Add a CDN in front of Object Storage for photos, and DNS in front of everything so users are routed to the nearest copy.'],
    codex: 'cdn-dns',
    debrief: { note: 'Large social networks serve images and video from content delivery networks with edge servers on every continent, and use DNS to steer each user to a nearby, healthy region. The origin storage only sees the small fraction of requests the edge could not answer.', diffs: { cdn: 'Edge servers answer most photo requests near the viewer; only misses reach storage.', dns: 'Routes each user toward the nearest region, cutting the distance every request travels.' } },
  }),
  lvl({
    id: 'ch5', chapter: 5, title: 'Likes, comments and notifications',
    story: 'Every post now notifies hundreds of friends. Posting stalls while the server works through the list. Do the slow part later, off the request path.',
    lessons: ['async'], placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker'], startDesign: dCh4Ref, reference: dCh5Ref,
    traffic: T(rates(200, 60, 400, 10), 8), budget: 1150, minDesign: ['queue', 'worker'], regions,
    hints: ['Notice who is doing the work when someone posts. Does the user need to wait for it?', 'Open the Codex card "Asynchronous processing": drop a job on a queue and let workers handle it later.', 'Add a Message Queue and Workers; connect App Server to Queue and Queue to Workers, with enough workers to keep up.'],
    codex: 'async',
    debrief: { note: 'Large social networks do the slow, fan-out work (notifying friends, updating feeds) in background workers fed by message queues. The user\'s request returns immediately; the queue absorbs bursts, and workers catch up. If workers fall behind far enough, the queue overflows and notifications are lost.', diffs: { queue: 'Holds jobs so posting returns immediately.', worker: 'Processes notifications in the background; enough of them keeps the queue short.' } },
  }),
  lvl({
    id: 'ch6', chapter: 6, title: '"Find your friends"',
    story: 'People search for each other by name. Every search scans the whole users table and the database cannot keep up. Give search its own system.',
    lessons: ['search'], placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search'], startDesign: dCh5Ref, reference: dCh6Ref,
    traffic: T(rates(200, 30, 400, 10, 150), 8), budget: 1400, minDesign: ['search'], regions,
    hints: ['Look at which requests are hitting the Database hardest.', 'Open the Codex card "Search indexes": an index finds a name without scanning every row.', 'Add a Search Index and connect the App Server to it so searches stop touching the Database.'],
    codex: 'search',
    debrief: { note: 'Large social networks keep a dedicated search index next to the main database and update it from the same stream of changes. Reads from the index are fast, at the cost of the index sometimes lagging a moment behind the truth.', diffs: { search: 'Answers name searches from an index instead of scanning the database.' } },
  }),
  lvl({
    id: 'ch7', chapter: 7, title: '100 million users',
    story: 'The users and posts tables no longer fit one primary database. Writes are the problem, and replicas cannot help with writes. Split the data.',
    lessons: ['sharding'], placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard'], startDesign: dCh6Ref, reference: dCh7Ref,
    traffic: T(rates(400, 200, 400, 20, 200), 2), budget: 2200, minDesign: ['shard'], regions,
    hints: ['Look at the Database: is it reads or writes that fill it? Do replicas help?', 'Open the Codex card "Sharding": split the data across machines by a key, and pick the key carefully.', 'Replace the Database with a Sharded Database, with several shards, and set the shard key to user ID so load spreads evenly.'],
    codex: 'sharding',
    debrief: { note: 'Large social networks split their biggest tables across many database machines by a key such as user ID, so each machine owns a slice. A poor key creates a hot shard, and celebrity accounts create hot spots even with a good one, which is why they are often handled specially.', diffs: { shard: 'Splits users and posts by user ID so writes spread across machines.' } },
  }),
  lvl({
    id: 'ch8', chapter: 8, title: 'Spam and fake accounts',
    story: 'Bots are flooding friend requests and posts. They use up capacity that real users need. Block the bots without blocking people.',
    lessons: ['rate-limiting'], placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard', 'limiter'], startDesign: dCh7Ref, reference: dCh8Ref,
    traffic: T(rates(400, 200, 400, 20, 200, 500), 2), budget: 2300, minDesign: ['limiter'], regions,
    hints: ['Look at the traffic: some of it is not real people.', 'Open the Codex card "Rate limiting": a limit per user stops floods but a limit that is too strict blocks real people too.', 'Add a Rate Limiter in front of the Load Balancer and set a medium limit: strict limits block real users, lenient ones let bots through.'],
    codex: 'rate-limiting',
    debrief: { note: 'Large social networks put rate limits and gateways at the edge: per-user and per-address quotas, bursts allowed up to a point. The art is the threshold: too tight blocks real people during a busy moment, too loose lets abuse through.', diffs: { limiter: 'Drops most bot traffic at the door so it never uses app or database capacity.' } },
  }),
  lvl({
    id: 'ch9', chapter: 9, title: 'Chaos Monkey',
    story: 'From now on, things break on purpose: servers crash, a whole region goes dark, the cache is wiped. Survive it with no single point of failure, and make sure someone is told.',
    lessons: ['redundancy'], placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard', 'limiter', 'monitor'], startDesign: dCh8Ref, reference: dCh9Ref,
    traffic: T(rates(250, 100, 400, 10, 100, 100), 2), budget: 2500, minDesign: ['monitor'], regions,
    chaos: [
      { tick: 48, kind: 'crash', target: 'app', duration: 10 },
      { tick: 56, kind: 'crash', target: 'lb', duration: 8 },
      { tick: 64, kind: 'cacheFlush', duration: 1 },
      { tick: 70, kind: 'regionOut', duration: 6 },
    ],
    hints: ['Find the machine whose loss takes everything down.', 'Open the Codex card "Redundancy and failover": run at least one more than you need, so losing one is survivable.', 'Give the Load Balancer a second instance, keep spare App Server capacity, and add Monitoring so alerts fire fast.'],
    codex: 'redundancy',
    debrief: { note: 'Large social networks assume machines fail constantly. They run N+1 capacity everywhere, spread across regions, and test it deliberately with chaos engineering. Monitoring turns a long silent outage into a short, alerted one.', diffs: { lb: 'Two balancers: losing one no longer takes the front door down.', app: 'Spare capacity: a crash or a lost region leaves enough servers running.', monitor: 'Alerts fire early and crashed machines are replaced faster.' } },
  }),
  lvl({
    id: 'boss', chapter: 10, title: 'New Year\'s Eve at midnight',
    story: 'Midnight. Everyone in the world posts at once. A traffic spike, a crashed server, a bot attack, a flushed cache and a lost region all arrive in the same ten minutes. Use everything you have learned.',
    lessons: [], placeable: [...P1, 'db', 'storage', 'lb', 'cache', 'cdn', 'dns', 'queue', 'worker', 'search', 'shard', 'limiter', 'monitor'], startDesign: dCh9Ref, reference: dBossRef,
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
    codex: 'redundancy',
    debrief: { note: 'Real launches and big events are rehearsed exactly like this: load tests at multiples of expected peak, with failures injected on purpose, so the first time everything goes wrong is not the real time.', diffs: { app: 'Sized for the spike and a lost region.', shard: 'More shards keep the busiest shard under capacity.', worker: 'Enough workers that the queue never spills.' } },
  }),
]

const toyApp = design([node('users'), node('app')], [['users', 'app']])
const toyDbPhotos = design([node('users'), node('app'), node('db')], [['users', 'app'], ['app', 'db']])
const toyLb = design([node('users'), node('lb'), node('app')], [['users', 'lb'], ['lb', 'app']])
const cacheToy = (size?: 1 | 2 | 3) => design(
  size ? [node('users'), node('app', 2), node('cache', 1, { cacheSize: size }), node('db')] : [node('users'), node('app', 2), node('db')],
  size ? [['users', 'app'], ['app', 'cache'], ['app', 'db'], ['cache', 'db']] : [['users', 'app'], ['app', 'db']],
)
const replToy = design([node('users'), node('lb'), node('app', 3), node('db', 1)], [['users', 'lb'], ['lb', 'app'], ['app', 'db']])
const cdnToy = (cdn: boolean) => design(
  cdn ? [node('users'), node('dns'), node('cdn'), node('lb'), node('app', 2), node('storage')] : [node('users'), node('lb'), node('app', 2), node('storage')],
  cdn ? [['users', 'dns'], ['dns', 'cdn'], ['dns', 'lb'], ['cdn', 'storage'], ['lb', 'app'], ['app', 'storage']] : [['users', 'lb'], ['lb', 'app'], ['app', 'storage']],
)
const asyncToy = (q: boolean) => design(
  q ? [node('users'), node('lb'), node('app', 2), node('db'), node('queue'), node('worker', 3)] : [node('users'), node('lb'), node('app', 2), node('db')],
  q ? [['users', 'lb'], ['lb', 'app'], ['app', 'db'], ['app', 'queue'], ['queue', 'worker']] : [['users', 'lb'], ['lb', 'app'], ['app', 'db']],
)
const searchToy = (idx: boolean) => design(
  idx ? [node('users'), node('lb'), node('app', 2), node('db'), node('search')] : [node('users'), node('lb'), node('app', 2), node('db')],
  idx ? [['users', 'lb'], ['lb', 'app'], ['app', 'db'], ['app', 'search']] : [['users', 'lb'], ['lb', 'app'], ['app', 'db']],
)
const shardToy = (kind: 'none' | 'userId' | 'region') => design(
  kind === 'none' ? [node('users'), node('lb'), node('app', 4), node('db')] : [node('users'), node('lb'), node('app', 4), node('shard', 3, { shardKey: kind })],
  kind === 'none' ? [['users', 'lb'], ['lb', 'app'], ['app', 'db']] : [['users', 'lb'], ['lb', 'app'], ['app', 'shard']],
)
const limitToy = (limit?: NodeConfig['limit']) => design(
  limit ? [node('users'), node('limiter', 1, { limit }), node('app', 3), node('db')] : [node('users'), node('app', 3), node('db')],
  limit ? [['users', 'limiter'], ['limiter', 'app'], ['app', 'db']] : [['users', 'app'], ['app', 'db']],
)
const redToy = (spare: boolean) => design(
  [node('users'), node('lb', spare ? 2 : 1), node('app', spare ? 4 : 2), node('db')],
  [['users', 'lb'], ['lb', 'app'], ['app', 'db']],
)

const src = {
  ddia: 'Designing Data-Intensive Applications (Kleppmann)',
  sre: 'Site Reliability Engineering (Google)',
}

export const LESSONS: Lesson[] = [
  {
    id: 'client-server', title: 'Client–server and requests', unlocks: ['users', 'app'],
    hook: { lines: ['You walk up to a counter and ask for a coffee.', 'The cashier hears you, makes it, and hands it over.'], caption: 'Every website works like ordering at a counter.' },
    analogy: { pairs: [['You, the customer', 'Users (clients)'], ['Your order', 'A request'], ['The cashier', 'App Server'], ['The coffee', 'The response']] },
    toy: { base: rates(5, 0, 0, 0), designs: [{ label: 'One server', design: toyApp }], load: { label: 'Requests per second', steps: [1, 4, 8] } },
    predict: { question: 'Traffic goes from 5 to 40 requests per second. One server can handle 150. What happens?', options: ['Everything still works fine', 'Requests start failing immediately'], answer: 0, scenario: { design: 0, load: 8 }, explain: 'One server has plenty of room at 40 requests per second, so nothing breaks yet. Capacity matters when load approaches it.' },
    codex: { analogy: 'Ordering at a counter: a client asks, a server answers.', note: 'Every large social network is, at its core, clients sending requests to fleets of servers.', sources: [src.ddia + ', ch. 1'] },
    terms: [{ term: 'Request', meaning: 'One message from a client asking a server to do something.' }, { term: 'Client', meaning: 'The person or program making requests.' }, { term: 'Server', meaning: 'A machine that answers requests.' }],
  },
  {
    id: 'latency', title: 'Latency and throughput', unlocks: ['metrics'],
    hook: { lines: ['A highway is fast at 2 a.m.', 'At rush hour the same road crawls, even though nothing broke.'], caption: 'Busy roads slow everyone down.' },
    analogy: { pairs: [['Cars on the road', 'Requests'], ['Lanes', 'Server capacity'], ['Travel time', 'Latency'], ['Cars per hour', 'Throughput']] },
    toy: { base: rates(100, 0, 0, 0), designs: [{ label: 'One server', design: toyApp }], load: { label: 'Load', steps: [0.4, 0.8, 1.2, 1.6] } },
    predict: { question: 'Load goes from 40% to 90% of capacity. Does response time rise a little, or a lot?', options: ['A little: 2.25x the load means about 2.25x the time', 'A lot: the curve bends sharply near full'], answer: 1, scenario: { design: 0, load: 0.8 }, explain: 'Queues build as a server fills up, so latency stays flat for a while and then climbs steeply near 100% utilization.' },
    codex: { analogy: 'A highway: speed versus lanes.', note: 'Real services keep utilization well below 100% because queues make latency explode near full.', sources: ['Queueing theory: waiting time grows sharply as utilization approaches 100%'] },
    terms: [{ term: 'Latency', meaning: 'How long one request takes, start to finish.' }, { term: 'Throughput', meaning: 'How many requests are handled per second.' }, { term: 'p95', meaning: 'The latency that 95 out of 100 requests beat; it shows how slow the unlucky ones are.' }, { term: 'Utilization', meaning: 'How full a component is, as a percentage of its capacity.' }, { term: 'SLO', meaning: 'Service level objective: a target such as p95 under 300 ms.' }],
  },
  {
    id: 'db-storage', title: 'Databases vs. object storage', unlocks: ['db', 'storage'],
    hook: { lines: ['A filing cabinet holds small, organized folders.', 'Try stuffing a refrigerator into it.'], caption: 'Different tools suit different things.' },
    analogy: { pairs: [['Filing cabinet', 'Database'], ['Warehouse of crates', 'Object Storage'], ['Folders', 'Profiles and friendships'], ['Crates', 'Photos']] },
    toy: { base: rates(40, 8, 30, 4), designs: [{ label: 'Photos in the database', design: toyDbPhotos }, { label: 'Photos in object storage', design: dCh1Ref }] },
    predict: { question: 'Friendbook stores photos in the database. What happens to page loads?', options: ['They stay fast: the database is built for this', 'They slow down and fail: photos swamp the database'], answer: 1, scenario: { design: 0 }, explain: 'Photos are big. Pushing them through the database starves the small lookups it exists for. Object storage takes the heavy files.' },
    codex: { analogy: 'A filing cabinet versus a warehouse.', note: 'Large social networks keep structured data in databases and photos or video in object storage, usually behind a CDN.', sources: [src.ddia + ', ch. 2–3'] },
    terms: [{ term: 'Database', meaning: 'A system for storing and querying structured data.' }, { term: 'Object storage', meaning: 'A system for storing large files such as photos and video.' }],
  },
  {
    id: 'load-balancing', title: 'Horizontal scaling and load balancing', unlocks: ['lb', 'scaling'],
    hook: { lines: ['A restaurant has one waiter and a line out the door.', 'Hiring more waiters helps only if someone seats diners across them.'], caption: 'More servers need someone to share the work.' },
    analogy: { pairs: [['Restaurant host', 'Load Balancer'], ['Waiters', 'App Servers'], ['Diners', 'Requests'], ['Hiring a waiter', 'Adding an instance']] },
    toy: { base: rates(300, 0, 0, 0), designs: [{ label: 'No load balancer', design: toyApp }, { label: 'With a load balancer', design: toyLb }], stepper: { label: 'App Server instances', id: 'app', min: 1, max: 6 } },
    predict: { question: 'You raise App Server instances to 4 but there is no load balancer. Does capacity grow?', options: ['Yes: four servers handle four times the traffic', 'No: without a balancer traffic still hits one server'], answer: 1, scenario: { design: 0, instances: 4 }, explain: 'Extra servers sit idle if nobody spreads requests across them. The load balancer is what turns many machines into one bigger service.' },
    codex: { analogy: 'A restaurant host seating diners across waiters.', note: 'Large social networks run many identical, stateless servers behind load balancers.', sources: [src.sre + ', ch. 20'] },
    terms: [{ term: 'Horizontal scaling', meaning: 'Adding more machines instead of a bigger one.' }, { term: 'Load balancer', meaning: 'Spreads requests across several servers and skips unhealthy ones.' }, { term: 'Stateless', meaning: 'A server that keeps nothing between requests, so any server can answer any request.' }],
  },
  {
    id: 'caching', title: 'Caching', unlocks: ['cache'],
    hook: { lines: ['The librarian fetches the same popular book fifty times a day from the back stacks.', 'So she keeps a copy on the front desk.'], caption: 'Keep what everyone wants close by.' },
    analogy: { pairs: [['Front desk copy', 'Cache'], ['Back stacks', 'Database'], ['Finding it at the desk', 'A cache hit'], ['Walking to the stacks', 'A cache miss']] },
    toy: { base: rates(300, 20, 0, 0), designs: [{ label: 'No cache', design: cacheToy() }, { label: 'Small cache', design: cacheToy(1) }, { label: 'Big cache', design: cacheToy(3) }] },
    predict: { question: 'You add a big cache in front of the database. What happens to database load?', options: ['It barely changes', 'It drops sharply, because most reads never reach it'], answer: 1, scenario: { design: 2 }, explain: 'Most feed reads ask for the same popular data. The cache answers them from memory, so the database only handles the misses and the writes.' },
    codex: { analogy: 'Keeping popular books on the front desk.', note: 'Large social networks serve the bulk of reads from in-memory caches. Hit rate depends on cache size and how long entries live; a flushed or restarted cache is cold and sends everything to the database at once.', sources: [src.ddia + ', ch. 5', 'Facebook-scale memcached practice, described in public engineering papers'] },
    terms: [{ term: 'Cache', meaning: 'A fast memory that keeps recently used data close to where it is needed.' }, { term: 'Hit rate', meaning: 'The share of requests the cache answers on its own.' }, { term: 'Expiry', meaning: 'How long a cached entry may be reused before it must be refreshed.' }, { term: 'Cold cache', meaning: 'An empty cache that has not yet warmed up, so almost everything misses.' }],
  },
  {
    id: 'replication', title: 'Replication', unlocks: ['replicas'],
    hook: { lines: ['One reference book, a hundred students, one line.', 'Make photocopies, and everyone reads at once.'], caption: 'Copies let many people read.' },
    analogy: { pairs: [['Photocopies', 'Read replicas'], ['The master copy', 'The primary database'], ['Reading a copy', 'A read'], ['Editing the master', 'A write']] },
    toy: { base: rates(400, 60, 0, 0), designs: [{ label: 'Database with replicas', design: replToy }], stepper: { label: 'Database instances', id: 'db', min: 1, max: 5 } },
    predict: { question: 'You add four read replicas to a database that is full of writes. Does it get much faster?', options: ['Yes: every request is now shared four ways', 'Only for reads: every write still goes to one primary'], answer: 1, scenario: { design: 0, instances: 5 }, explain: 'Replicas copy data for reading. Every write still lands on the single primary, so a write-heavy database stays busy however many replicas you add.' },
    codex: { analogy: 'Photocopies of a reference book.', note: 'Large social networks add read replicas to scale reads, and accept that a replica can lag a moment behind the primary. Writes need another solution, which is sharding.', sources: [src.ddia + ', ch. 5'] },
    terms: [{ term: 'Replica', meaning: 'A copy of a database kept up to date for serving reads.' }, { term: 'Primary', meaning: 'The one database copy that accepts writes.' }, { term: 'Replication lag', meaning: 'How far behind the primary a replica is; a just-posted comment may not show yet.' }],
  },
  {
    id: 'cdn-dns', title: 'CDNs, DNS and geography', unlocks: ['cdn', 'dns'],
    hook: { lines: ['One giant warehouse makes every delivery slow for customers far away.', 'Local stores keep the popular items close.'], caption: 'Distance is latency.' },
    analogy: { pairs: [['Local convenience store', 'CDN edge server'], ['The central warehouse', 'Object Storage (origin)'], ['The directory that points you to the nearest store', 'DNS'], ['Distance to the shop', 'Network latency']] },
    toy: { base: rates(60, 0, 300, 0), regions: { farShare: 0.5, farMs: 300 }, designs: [{ label: 'One place for everything', design: cdnToy(false) }, { label: 'CDN and DNS', design: cdnToy(true) }] },
    predict: { question: 'Half your viewers are far from your single storage location. A CDN and DNS are added. What happens to response time?', options: ['It stays about the same: the data is the same data', 'It falls a lot: popular photos come from nearby and routing is shorter'], answer: 1, scenario: { design: 1 }, explain: 'Most requests are for popular photos, which the edge keeps near viewers. DNS sends each person to the nearest place, so the long trip happens rarely.' },
    codex: { analogy: 'Local convenience stores versus one central warehouse.', note: 'Large social networks serve images and video from edge servers around the world, and use DNS to steer users to a nearby region. The origin only sees cache misses.', sources: ['How CDNs and DNS-based routing work, standard networking references'] },
    terms: [{ term: 'CDN', meaning: 'Content delivery network: edge servers that keep popular files near viewers.' }, { term: 'Origin', meaning: 'The original storage the CDN copies from.' }, { term: 'DNS', meaning: 'The directory that turns a name into an address, and can route people to the nearest region.' }, { term: 'Region', meaning: 'A geographic area where a copy of the system runs.' }],
  },
  {
    id: 'async', title: 'Asynchronous processing', unlocks: ['queue', 'worker'],
    hook: { lines: ['At the dry cleaner you drop clothes off and get a ticket.', 'You do not stand there while they are cleaned.'], caption: 'Hand off slow work and carry on.' },
    analogy: { pairs: [['The ticket', 'A job on the Message Queue'], ['The back-room cleaners', 'Workers'], ['Dropping off', 'Posting'], ['Picking up later', 'The notification arriving']] },
    toy: { base: rates(100, 60, 0, 0), fanout: 8, designs: [{ label: 'Do it while the user waits', design: asyncToy(false) }, { label: 'Queue and workers', design: asyncToy(true) }] },
    predict: { question: 'Every post notifies 8 friends, and the server does it all before replying. What happens when posts become popular?', options: ['Posting slows down and errors rise: the server is busy notifying', 'Nothing: sending notifications is free'], answer: 0, scenario: { design: 0 }, explain: 'Each post becomes nine units of work on the server, all while the user waits. A queue lets the server reply at once and workers do the notifying behind the scenes.' },
    codex: { analogy: 'A dry-cleaning ticket: drop off now, pick up later.', note: 'Large social networks fan out feed updates and notifications in background workers fed by queues. The queue absorbs bursts; if workers fall too far behind, it overflows and work is lost.', sources: [src.ddia + ', ch. 11'] },
    terms: [{ term: 'Queue', meaning: 'A line of jobs waiting to be processed.' }, { term: 'Worker', meaning: 'A machine that takes jobs off a queue and does them.' }, { term: 'Fan-out', meaning: 'One action that causes many follow-up tasks, such as notifying every friend.' }, { term: 'Asynchronous', meaning: 'Done later, not while the user waits.' }],
  },
  {
    id: 'search', title: 'Search indexes', unlocks: ['search'],
    hook: { lines: ['To find a name in a book you could read every page.', 'Or look it up in the index at the back.'], caption: 'Do not read everything to find one thing.' },
    analogy: { pairs: [['The index at the back', 'Search Index'], ['Reading every page', 'Scanning the database'], ['Looking up a name', 'A search request'], ['A page that moved since printing', 'An index slightly out of date']] },
    toy: { base: rates(60, 10, 0, 0, 120), designs: [{ label: 'Scan the database', design: searchToy(false) }, { label: 'Search index', design: searchToy(true) }] },
    predict: { question: 'Searching names scans the whole users table every time. What happens as searches increase?', options: ['The database buckles: each search reads everything', 'Nothing: databases are good at this'], answer: 0, scenario: { design: 0 }, explain: 'A scan makes every search very expensive. An index finds the right rows directly, so the database is left for everything else.' },
    codex: { analogy: 'The index at the back of a book.', note: 'Large social networks keep a dedicated search index updated from the main data, trading a small delay for much faster lookups.', sources: ['Inverted indexes, standard information-retrieval references'] },
    terms: [{ term: 'Index', meaning: 'A lookup structure that finds rows without scanning all of them.' }, { term: 'Scan', meaning: 'Reading every row to find a match.' }],
  },
  {
    id: 'sharding', title: 'Sharding', unlocks: ['shard'],
    hook: { lines: ['One phone book for the whole country is too heavy to lift.', 'Split it into A–M and N–Z, and give each to a different clerk.'], caption: 'Split the data so no one machine holds it all.' },
    analogy: { pairs: [['A–M and N–Z', 'Shards'], ['Choosing the split', 'The shard key'], ['A clerk with all the Smiths', 'A hot shard'], ['More clerks', 'More shards']] },
    toy: { base: rates(100, 200, 0, 0), designs: [{ label: 'One database', design: shardToy('none') }, { label: 'Shard by user ID', design: shardToy('userId') }, { label: 'Shard by region', design: shardToy('region') }], stepper: { label: 'Shards', id: 'shard', min: 1, max: 6 } },
    predict: { question: 'You shard by region, but most users are in one region. What happens?', options: ['Load spreads evenly across shards', 'One shard gets most of the load and becomes a hot spot'], answer: 1, scenario: { design: 2 }, explain: 'A shard key decides who gets how much. A key with uneven groups leaves one machine overloaded while others idle. Hashing by user ID spreads load evenly.' },
    codex: { analogy: 'Splitting a phone book A–M and N–Z.', note: 'Large social networks shard their biggest tables by user ID. A bad key, or celebrity accounts, create hot spots, and the busiest shard sets the limit.', sources: [src.ddia + ', ch. 6'] },
    terms: [{ term: 'Shard', meaning: 'One slice of a database, held on its own machine.' }, { term: 'Shard key', meaning: 'The field used to decide which shard a row lives on.' }, { term: 'Hot shard', meaning: 'A shard that gets far more traffic than the others.' }],
  },
  {
    id: 'rate-limiting', title: 'Rate limiting', unlocks: ['limiter'],
    hook: { lines: ['A bouncer lets the first people into the club.', 'They stop one person from running in and out a thousand times.'], caption: 'Fair use for everyone.' },
    analogy: { pairs: [['The bouncer', 'Rate Limiter'], ['A person who runs in a thousand times', 'A bot'], ['How strict the bouncer is', 'The limit'], ['A regular turned away by mistake', 'A false positive']] },
    toy: { base: rates(100, 40, 0, 0, 0, 400), designs: [{ label: 'No limiter', design: limitToy() }, { label: 'Strict limit', design: limitToy('low') }, { label: 'Medium limit', design: limitToy('medium') }, { label: 'Lenient limit', design: limitToy('high') }] },
    predict: { question: 'You set the strictest limit possible. Is that always best?', options: ['Yes: block everything suspicious', 'No: a limit that is too strict blocks real people too'], answer: 1, scenario: { design: 1 }, explain: 'The strictest limit stops nearly all bots, but it also turns away some real users. Good limits balance the two.' },
    codex: { analogy: 'A bouncer at the door.', note: 'Large social networks apply per-user and per-address limits at the edge, allowing short bursts. Thresholds are tuned against real traffic to avoid blocking people.', sources: ['Token-bucket and leaky-bucket rate limiting, standard references'] },
    terms: [{ term: 'Rate limit', meaning: 'A cap on how many requests one user can make in a period.' }, { term: 'Bot', meaning: 'A program that sends automated, often abusive, requests.' }, { term: 'False positive', meaning: 'A real user wrongly blocked.' }],
  },
  {
    id: 'redundancy', title: 'Redundancy and failover', unlocks: ['monitor'],
    hook: { lines: ['A car carries a spare tire.', 'You hope never to need it. When you do, you are glad it is there.'], caption: 'Plan for the thing that will break.' },
    analogy: { pairs: [['The spare tire', 'A spare instance (N+1)'], ['A flat tire', 'A crashed machine'], ['The dashboard warning light', 'Monitoring'], ['A detour', 'Failover to another region']] },
    toy: { base: rates(300, 0, 0, 0), designs: [{ label: 'No spare', design: redToy(false) }, { label: 'With spares (N+1)', design: redToy(true) }] },
    predict: { question: 'One of your two servers crashes and you have no spare capacity. What happens at peak?', options: ['Nothing: the other one picks up the slack easily', 'The survivor is overloaded and requests fail'], answer: 1, scenario: { design: 0 }, explain: 'If the remaining machines cannot carry the load, losing one takes you down. Running one more than you need means a failure is survivable.' },
    codex: { analogy: 'A spare tire.', note: 'Large social networks run N+1 capacity, spread across regions, and rehearse failures with chaos engineering. Monitoring means someone is told within seconds.', sources: [src.sre + ', ch. 3 and ch. 6', 'Principles of chaos engineering (public manifesto)'] },
    terms: [{ term: 'Redundancy', meaning: 'Having more than the minimum, so one failure is survivable.' }, { term: 'N+1', meaning: 'Enough capacity to lose any one machine and still cope.' }, { term: 'Failover', meaning: 'Automatically switching to a healthy copy when one fails.' }, { term: 'Single point of failure', meaning: 'One component whose loss takes everything down.' }],
  },
]

export const GLOSSARY_EXTRA = [
  { term: 'SEV-1 / SEV-2 / SEV-3', meaning: 'Incident severity, from most to least serious. SEV-1 means most users are affected.' },
  { term: 'Incident', meaning: 'A named problem the game raises when a metric crosses a threshold.' },
]

// Sandbox (FR-20): everything unlocked, custom traffic and chaos. Never scored.
export const SANDBOX_LEVEL: Level = lvl({
  id: 'sandbox', chapter: 99, title: 'Sandbox', story: 'Everything is unlocked. Build anything, set the traffic, and break it on purpose with the chaos buttons.',
  lessons: [], placeable: ALL_TYPES_NO_USERS(), startDesign: d0, reference: dBossRef,
  traffic: { base: rates(300, 100, 300, 10, 100, 50), peak: 1.3, cycle: 40, fanout: 2 }, cycles: 1000, budget: 99999, minDesign: [], regions, sandbox: true,
  hints: ['', '', ''], codex: 'redundancy', debrief: { note: '', diffs: {} },
})
function ALL_TYPES_NO_USERS(): CType[] { return ['users', 'dns', 'cdn', 'limiter', 'lb', 'app', 'cache', 'queue', 'worker', 'db', 'shard', 'search', 'storage', 'monitor'] }

// Interview mode (FR-22): an open prompt, a time limit and a scored rubric. Nothing is unlocked by lessons here.
export const INTERVIEW_LEVEL: Level = lvl({
  id: 'interview', chapter: 98, title: 'Interview: a worldwide photo feed',
  story: 'You have 15 minutes. Design a system for a photo-sharing feed with people on every continent, frequent posting and search, and the occasional bot attack. Build it, press Start, and you will be scored on a rubric the way an interviewer would.',
  lessons: [], placeable: ALL_TYPES_NO_USERS(), startDesign: d0, reference: dBossRef,
  traffic: { base: rates(300, 120, 450, 12, 120, 100), peak: 1.4, cycle: 40, fanout: 2 }, budget: 3400, minDesign: [], regions,
  slo: { p95Ms: 300, errorRate: 0.01 }, interview: { minutes: 15 },
  chaos: [{ tick: 50, kind: 'crash', target: 'app', duration: 10 }, { tick: 64, kind: 'cacheFlush', duration: 1 }],
  hints: ['', '', ''], codex: 'redundancy', debrief: { note: '', diffs: {} },
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

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)!
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

// "Explain this architecture" check (FR-24): 6 questions.
export const CHECK: { q: string; options: string[]; answer: number }[] = [
  { q: 'Pages get slow when one server is busy. What is the most direct fix?', options: ['Add more servers behind a load balancer', 'Make the database bigger', 'Ask users to retry'], answer: 0 },
  { q: 'Where should large photo files live?', options: ['In the main database', 'In object storage, ideally behind a CDN', 'On the app server disk'], answer: 1 },
  { q: 'The database is overloaded by repeated reads of the same popular data. What helps most?', options: ['A cache in front of it', 'A second load balancer', 'More object storage'], answer: 0 },
  { q: 'Sending a notification to 500 friends should happen...', options: ['Before replying to the user', 'In the background, through a queue', 'Never'], answer: 1 },
  { q: 'One database cannot keep up with writes. What can help?', options: ['More read replicas', 'Splitting data across shards', 'A bigger cache'], answer: 1 },
  { q: 'What best protects you when a server crashes?', options: ['More than the minimum capacity, plus alerts', 'Hoping it will not', 'Running everything on one machine'], answer: 0 },
]
