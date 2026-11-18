// Content as data. shortcut: typed TS objects instead of JSON files + JSON Schema in CI; move to JSON when chapters 3+ land.
import type { Design, DNode, Level, Lesson, Rates } from '../schema'

const node = (id: string, type: DNode['type'], x: number, y: number, instances = 1): DNode => ({ id, type, x, y, instances })
export const SLOTS = { users: [1, 3], lb: [5, 3], app: [9, 3], db: [14, 1], storage: [14, 5] } as const
const N = {
  users: node('users', 'users', 1, 3),
  lb: node('lb', 'lb', 5, 3),
  app: (n = 1) => node('app', 'app', 9, 3, n),
  db: node('db', 'db', 14, 1),
  storage: node('storage', 'storage', 14, 5),
}
const rates = (read: number, write: number, photo: number, upload: number): Rates => ({ read, write, photo, upload })

const d0: Design = { nodes: [], edges: [] }
const dTutorial: Design = { nodes: [N.users, N.app()], edges: [{ from: 'users', to: 'app' }] }
const dCh1Start: Design = { nodes: [N.users, N.app(), N.db], edges: [{ from: 'users', to: 'app' }, { from: 'app', to: 'db' }] }
const dCh1Ref: Design = { nodes: [N.users, N.app(), N.db, N.storage], edges: [...dCh1Start.edges, { from: 'app', to: 'storage' }] }
const dCh2Ref: Design = {
  nodes: [N.users, N.lb, N.app(4), N.db, N.storage],
  edges: [{ from: 'users', to: 'lb' }, { from: 'lb', to: 'app' }, { from: 'app', to: 'db' }, { from: 'app', to: 'storage' }],
}

export const LEVELS: Level[] = [
  {
    id: 'ch0', chapter: 0, title: 'Tutorial: your first request',
    story: 'Friendbook is a website one student built in a dorm room. Connect the people using it to the server that answers them, then press Start and watch what a request does.',
    lessons: ['client-server', 'latency'], placeable: ['users', 'app'],
    startDesign: d0, reference: dTutorial,
    traffic: { base: rates(60, 10, 0, 0), peak: 1.3, cycle: 40 }, cycles: 2,
    slo: { p95Ms: 300, errorRate: 0.01 }, budget: 100, minDesign: ['users', 'app'],
    hints: ['Look at where the requests are going. Is there a path from users to a server?', 'Open the Codex card "Client–server": every request needs a path from a client to a server.', 'Place Users and an App Server, then connect Users to the App Server.'],
    codex: 'client-server',
    debrief: {
      note: 'Large social networks still begin with this exact shape: clients send requests, servers answer. Everything else in this game exists to keep that exchange fast as it grows.',
      diffs: { users: 'Source of every request.', app: 'Runs the application logic and answers each request.' },
    },
  },
  {
    id: 'ch1', chapter: 1, title: 'Year one: the dorm-room launch',
    story: 'Friendbook now stores profiles and friendships in a database, and people are uploading photos. Pages are crawling and the database is choking. Find out why.',
    lessons: ['db-storage'], placeable: ['users', 'app', 'db', 'storage'],
    startDesign: dCh1Start, reference: dCh1Ref,
    traffic: { base: rates(40, 8, 30, 4), peak: 1.3, cycle: 40 }, cycles: 2,
    slo: { p95Ms: 300, errorRate: 0.01 }, budget: 450, minDesign: ['db', 'storage'],
    hints: ['Look at what the database is busy with. Is it all profile data?', 'Open the Codex card "Databases vs. object storage": big files do not belong in a database.', 'Place Object Storage and connect the App Server to it so photos skip the database.'],
    codex: 'db-storage',
    debrief: {
      note: 'Large social networks keep structured data (profiles, friendships) in databases and put photos and video in object storage, often behind a content delivery network. Databases are built for small, related rows; storage is built for big blobs.',
      diffs: { storage: 'Photos and uploads go here, so the database only handles profile and friendship data.', db: 'Now handles only reads and writes of structured data.' },
    },
  },
  {
    id: 'ch2', chapter: 2, title: 'Every college wants in',
    story: 'New campuses join every week. One server is overloaded and users see 503 errors. Make Friendbook handle three times the traffic.',
    lessons: ['load-balancing'], placeable: ['users', 'app', 'db', 'storage', 'lb'],
    startDesign: dCh1Ref, reference: dCh2Ref,
    traffic: { base: rates(180, 30, 100, 15), peak: 1.3, cycle: 40 }, cycles: 2,
    slo: { p95Ms: 300, errorRate: 0.01 }, budget: 650, minDesign: ['lb', 'db', 'storage'],
    hints: ['Check the App Server. How full is it, and can one machine ever keep up?', 'Open the Codex card "Load balancing": spread requests across several identical servers.', 'Place a Load Balancer between Users and the App Server, then add instances to the App Server.'],
    codex: 'load-balancing',
    debrief: {
      note: 'Large social networks run many identical, stateless app servers behind load balancers, so they can add or lose servers without users noticing. Keeping servers stateless is what makes this possible.',
      diffs: { lb: 'Spreads requests across servers and skips unhealthy ones.', app: 'Several identical servers share the load; capacity is visible as a stack.' },
    },
  },
]

const toyApp: Design = { nodes: [N.users, N.app()], edges: [{ from: 'users', to: 'app' }] }
const toyDbPhotos: Design = { nodes: [N.users, N.app(), N.db], edges: dCh1Start.edges }
const toyLb: Design = { nodes: [N.users, N.lb, N.app()], edges: [{ from: 'users', to: 'lb' }, { from: 'lb', to: 'app' }] }

export const LESSONS: Lesson[] = [
  {
    id: 'client-server', title: 'Client–server and requests',
    unlocks: ['users', 'app'],
    hook: { lines: ['You walk up to a counter and ask for a coffee.', 'The cashier hears you, makes it, and hands it over.'], caption: 'Every website works like ordering at a counter.' },
    analogy: { pairs: [['You, the customer', 'Users (clients)'], ['Your order', 'A request'], ['The cashier', 'App Server'], ['The coffee', 'The response']] },
    toy: { base: rates(5, 0, 0, 0), designs: [{ label: 'One server', design: toyApp }], load: { label: 'Requests per second', steps: [1, 4, 8] } },
    predict: {
      question: 'Traffic goes from 5 to 40 requests per second. One server can handle 150. What happens?',
      options: ['Everything still works fine', 'Requests start failing immediately'], answer: 0,
      scenario: { design: 0, load: 8 },
      explain: 'One server has plenty of room at 40 requests per second, so nothing breaks yet. Capacity matters when load approaches it.',
    },
    codex: { analogy: 'Ordering at a counter: a client asks, a server answers.', note: 'Every large social network is, at its core, clients sending requests to fleets of servers.', sources: ['Designing Data-Intensive Applications, ch. 1'] },
  },
  {
    id: 'latency', title: 'Latency and throughput',
    unlocks: ['metrics'],
    hook: { lines: ['A highway is fast at 2 a.m.', 'At rush hour the same road crawls, even though nothing broke.'], caption: 'Busy roads slow everyone down.' },
    analogy: { pairs: [['Cars on the road', 'Requests'], ['Lanes', 'Server capacity'], ['Travel time', 'Latency'], ['Cars per hour', 'Throughput']] },
    toy: { base: rates(100, 0, 0, 0), designs: [{ label: 'One server', design: toyApp }], load: { label: 'Load', steps: [0.4, 0.8, 1.2, 1.6] } },
    predict: {
      question: 'Load goes from 40% to 90% of capacity. Does response time rise a little, or a lot?',
      options: ['A little: 2.25x the load means about 2.25x the time', 'A lot: the curve bends sharply near full'], answer: 1,
      scenario: { design: 0, load: 0.8 },
      explain: 'Queues build as a server fills up, so latency stays flat for a while and then climbs steeply near 100% utilization.',
    },
    codex: { analogy: 'A highway: speed versus lanes.', note: 'Real services keep utilization well below 100% because queues make latency explode near full.', sources: ['Little\'s Law and queueing delay, any operations-research text'] },
  },
  {
    id: 'db-storage', title: 'Databases vs. object storage',
    unlocks: ['db', 'storage'],
    hook: { lines: ['A filing cabinet holds small, organized folders.', 'Try stuffing a refrigerator into it.'], caption: 'Different tools suit different things.' },
    analogy: { pairs: [['Filing cabinet', 'Database'], ['Warehouse of crates', 'Object Storage'], ['Folders', 'Profiles and friendships'], ['Crates', 'Photos']] },
    toy: {
      base: rates(40, 8, 30, 4),
      designs: [
        { label: 'Photos in the database', design: toyDbPhotos },
        { label: 'Photos in object storage', design: dCh1Ref },
      ],
    },
    predict: {
      question: 'Friendbook stores photos in the database. What happens to page loads?',
      options: ['They stay fast: the database is built for this', 'They slow down and fail: photos swamp the database'], answer: 1,
      scenario: { design: 0 },
      explain: 'Photos are big. Pushing them through the database starves the small lookups it exists for. Object storage takes the heavy files.',
    },
    codex: { analogy: 'A filing cabinet versus a warehouse.', note: 'Large social networks keep structured data in databases and photos or video in object storage, usually behind a CDN.', sources: ['Designing Data-Intensive Applications, ch. 2–3'] },
  },
  {
    id: 'load-balancing', title: 'Horizontal scaling and load balancing',
    unlocks: ['lb', 'scaling'],
    hook: { lines: ['A restaurant has one waiter and a line out the door.', 'Hiring more waiters helps only if someone seats diners across them.'], caption: 'More servers need someone to share the work.' },
    analogy: { pairs: [['Restaurant host', 'Load Balancer'], ['Waiters', 'App Servers'], ['Diners', 'Requests'], ['Hiring a waiter', 'Adding an instance']] },
    toy: {
      base: rates(300, 0, 0, 0),
      designs: [{ label: 'No load balancer', design: toyApp }, { label: 'With a load balancer', design: toyLb }],
      stepper: { label: 'App Server instances', id: 'app', min: 1, max: 6 },
    },
    predict: {
      question: 'You raise App Server instances to 4 but there is no load balancer. Does capacity grow?',
      options: ['Yes: four servers handle four times the traffic', 'No: without a balancer traffic still hits one server'], answer: 1,
      scenario: { design: 0, instances: 4 },
      explain: 'Extra servers sit idle if nobody spreads requests across them. The load balancer is what turns many machines into one bigger service.',
    },
    codex: { analogy: 'A restaurant host seating diners across waiters.', note: 'Large social networks run many identical, stateless servers behind load balancers.', sources: ['Site Reliability Engineering (Google), ch. 20'] },
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)!
export const levelById = (id: string) => LEVELS.find((l) => l.id === id)!

// "Explain this architecture" check (FR-24): 4 questions, 25 points each.
export const CHECK: { q: string; options: string[]; answer: number }[] = [
  { q: 'Pages get slow when one server is busy. What is the most direct fix?', options: ['Add more servers behind a load balancer', 'Make the database bigger', 'Ask users to retry'], answer: 0 },
  { q: 'Where should large photo files live?', options: ['In the main database', 'In object storage', 'On the app server disk'], answer: 1 },
  { q: 'Users should talk to which component first?', options: ['The database', 'The app server or load balancer', 'Object storage'], answer: 1 },
  { q: 'Latency near 100% utilization usually...', options: ['Stays flat', 'Falls', 'Climbs steeply'], answer: 2 },
]
