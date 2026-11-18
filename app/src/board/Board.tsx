import { useEffect, useMemo, useRef } from 'react'
import { CELL, color } from '../tokens'
import { PARAMS, REQ_TYPES } from '../schema'
import type { CType, DNode, Design, Health, Mood, Snapshot } from '../schema'

const SIZE: Record<CType, [number, number]> = { users: [2, 2], app: [2, 2], db: [2, 2], storage: [2, 2], lb: [3, 2] }
const HEALTH_COLOR: Record<Health, string> = { healthy: color.ok, strained: color.warn, overloaded: color.danger, failing: color.critical, down: color.borderStrong }
const HEALTH_LABEL: Record<Health, string> = { healthy: 'healthy', strained: 'strained', overloaded: 'overloaded', failing: 'failing', down: 'down' }
const REQ_COLOR = { read: color.read, write: color.write, photo: color.photo, upload: color.upload }

const px = (n: DNode) => ({ x: n.x * CELL, y: n.y * CELL, w: SIZE[n.type][0] * CELL, h: SIZE[n.type][1] * CELL })

interface Props {
  design: Design
  snap: Snapshot | null
  ghosts?: DNode[]
  selected?: string | null
  linkFrom?: string | null
  focus?: string | null
  reduced?: boolean
  speed?: number
  onNode?: (id: string) => void
  onGhost?: (type: CType) => void
}

// Status badge: distinct shape per state, never color alone (Design System 3.2).
function Badge({ health, x, y }: { health: Health; x: number; y: number }) {
  const c = HEALTH_COLOR[health]
  return (
    <g transform={`translate(${x},${y})`} aria-hidden>
      <circle r={11} fill={color.bg0} />
      {health === 'healthy' && <><circle r={8} fill={c} /><path d="M-4 0l3 3 5-6" stroke={color.bg0} strokeWidth={2.2} fill="none" /></>}
      {health === 'strained' && <><path d="M0-8L8 7H-8Z" fill={c} /><path d="M0-3v5M0 4v1" stroke={color.bg0} strokeWidth={2} /></>}
      {health === 'overloaded' && <><path d="M-3-8h6l5 5v6l-5 5h-6l-5-5v-6z" fill={c} /><path d="M0-4v5M0 4v1" stroke={color.bg0} strokeWidth={2} /></>}
      {health === 'failing' && <path d="M0-9C3-4 7-2 7 3a7 7 0 0 1-14 0c0-3 2-4 3-6 1 2 2 2 2 0 0-2 1-4 2-6z" fill={c} />}
      {health === 'down' && <><rect x={-7} y={-7} width={14} height={14} fill={c} /><path d="M-4-4l8 8M4-4l-8 8" stroke={color.bg0} strokeWidth={2} /></>}
    </g>
  )
}

function Face({ mood, cx, cy }: { mood: Mood; cx: number; cy: number }) {
  const mouth = mood === 'happy' ? 'M-6 3Q0 10 6 3' : mood === 'impatient' ? 'M-6 6H6' : 'M-6 8Q0 1 6 8'
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={13} fill={color.bg2} stroke={color.textSecondary} strokeWidth={2} />
      <circle cx={-5} cy={-3} r={1.8} fill={color.textPrimary} />
      <circle cx={5} cy={-3} r={1.8} fill={color.textPrimary} />
      <path d={mouth} stroke={color.textPrimary} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  )
}

function Art({ type, w, h, util, mood }: { type: CType; w: number; h: number; util: number; mood: Mood }) {
  const line = color.textSecondary
  if (type === 'users') return <><Face mood={mood} cx={w * 0.3} cy={h * 0.42} /><Face mood={mood} cx={w * 0.7} cy={h * 0.42} /><Face mood={mood} cx={w * 0.5} cy={h * 0.68} /></>
  if (type === 'app')
    return <>{[0, 1, 2].map((i) => (
      <g key={i}><rect x={14} y={14 + i * 22} width={w - 28} height={16} rx={4} fill={color.bg0} stroke={line} strokeWidth={2} />
        <circle className="blink" cx={26} cy={22 + i * 22} r={3} fill={color.ok} style={{ animationDuration: `${Math.max(0.25, 1.4 - util)}s`, animationDelay: `${i * 0.2}s` }} />
        <rect x={40} y={20 + i * 22} width={w - 64} height={4} rx={2} fill={line} /></g>
    ))}</>
  if (type === 'db')
    return <><ellipse cx={w / 2} cy={26} rx={30} ry={9} fill={color.bg0} stroke={line} strokeWidth={2} /><path d={`M${w / 2 - 30} 26v38c0 5 13 9 30 9s30-4 30-9V26`} fill={color.bg0} stroke={line} strokeWidth={2} />
      <path d={`M${w / 2 - 30} 45c0 5 13 9 30 9s30-4 30-9`} fill="none" stroke={line} strokeWidth={2} /></>
  if (type === 'storage')
    return <>{[[16, 40], [48, 40], [32, 14]].map(([x, y], i) => <g key={i}><rect x={x} y={y + 8} width={28} height={26} rx={3} fill={color.bg0} stroke={line} strokeWidth={2} /><path d={`M${x} ${y + 18}h28`} stroke={line} strokeWidth={2} /></g>)}</>
  return <>{[0, 1, 2].map((i) => <path key={i} d={`M16 ${28 + i * 20}H${w * 0.45}L${w - 16} ${20 + i * 28}`} stroke={line} strokeWidth={3} fill="none" strokeLinecap="round" />)}
    <circle cx={w * 0.45} cy={h / 2} r={8} fill={color.bg0} stroke={line} strokeWidth={2} /></>
}

function edgePath(a: DNode, b: DNode) {
  const A = px(a), B = px(b)
  const x1 = A.x + A.w, y1 = A.y + A.h / 2, x2 = B.x, y2 = B.y + B.h / 2
  const mx = (x1 + x2) / 2
  return { d: `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, p: [[x1, y1], [mx, y1], [mx, y2], [x2, y2]] as [number, number][] }
}
const bez = (p: [number, number][], t: number): [number, number] => {
  const u = 1 - t
  const f = (i: 0 | 1) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i]
  return [f(0), f(1)]
}

export function Board({ design, snap, ghosts = [], selected, linkFrom, focus, reduced, speed = 1, onNode, onGhost }: Props) {
  const all = [...design.nodes, ...ghosts]
  const bounds = useMemo(() => {
    const xs = all.flatMap((n) => [px(n).x, px(n).x + px(n).w])
    const ys = all.flatMap((n) => [px(n).y, px(n).y + px(n).h])
    const minX = Math.min(CELL, ...xs) - CELL / 2, maxX = Math.max(...xs, 4 * CELL) + CELL / 2
    const minY = Math.min(...ys, CELL) - CELL / 2, maxY = Math.max(...ys, 4 * CELL) + CELL
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    // eslint-disable-next-line
  }, [design, ghosts.length])
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  const edges = design.edges.flatMap((e) => {
    const a = byId.get(e.from), b = byId.get(e.to)
    return a && b ? [{ e, ...edgePath(a, b) }] : []
  })
  const rps = snap?.metrics.rps ?? 0
  const scaleN = Math.max(1, Math.ceil(rps / 60))
  const mood = snap?.mood ?? 'happy'

  return (
    <div className="board" style={{ aspectRatio: `${bounds.w} / ${bounds.h}` }}>
      <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} role="group" aria-label="Design board">
        <defs>
          <pattern id="grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse"><path d={`M${CELL} 0H0V${CELL}`} fill="none" stroke={color.borderSubtle} strokeWidth={1} /></pattern>
        </defs>
        <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="url(#grid)" />
        {edges.map(({ e, d }) => {
          const st = snap?.edges.find((x) => x.from === e.from && x.to === e.to)
          const flow = st ? REQ_TYPES.reduce((s, t) => s + st.flow[t], 0) : 0
          return <path key={`${e.from}>${e.to}`} d={d} fill="none" stroke={st && st.failFrac > 0 ? color.critical : color.borderStrong} strokeWidth={reduced ? 2 + Math.min(10, flow / 25) : 3} strokeDasharray={reduced && flow > 0 ? '10 6' : undefined} className={reduced && flow > 0 ? 'flow-dash' : undefined} />
        })}
        {ghosts.map((g) => {
          const { x, y, w, h } = px(g)
          return (
            <g key={g.id} className="ghost" tabIndex={0} role="button" aria-label={`Place ${PARAMS[g.type].label} here`} onClick={() => onGhost?.(g.type)} onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && onGhost?.(g.type)}>
              <rect x={x} y={y} width={w} height={h} rx={16} fill="none" stroke={color.accent} strokeWidth={2} strokeDasharray="8 6" />
              <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fill={color.accent} fontSize={14}>{PARAMS[g.type].label}</text>
            </g>
          )
        })}
        {design.nodes.map((n) => {
          const { x, y, w, h } = px(n)
          const st = snap?.nodes[n.id]
          const health: Health = st?.health ?? 'healthy'
          const isSel = selected === n.id
          return (
            <g key={n.id} transform={`translate(${x},${y})`} className={`machine h-${health}${focus === n.id ? ' focus-pulse' : ''}`} tabIndex={0} role="button"
              aria-label={`${PARAMS[n.type].label}, ${HEALTH_LABEL[health]}${st && n.type !== 'users' ? `, ${Math.round(st.util * 100)}% utilization` : ''}, ${n.instances} instance${n.instances > 1 ? 's' : ''}${linkFrom === n.id ? ', connecting' : ''}`}
              aria-pressed={isSel} onClick={() => onNode?.(n.id)} onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && (k.preventDefault(), onNode?.(n.id))}>
              {n.type !== 'users' && n.type !== 'lb' && Array.from({ length: Math.min(3, n.instances - 1) }, (_, i) => (
                <rect key={i} x={(i + 1) * 5} y={-(i + 1) * 5} width={w} height={h} rx={16} fill={color.bg1} stroke={color.borderStrong} strokeWidth={2} />
              ))}
              <rect className="body" width={w} height={h} rx={16} fill={color.bg2} stroke={isSel || linkFrom === n.id ? color.focus : HEALTH_COLOR[health]} strokeWidth={isSel || linkFrom === n.id ? 4 : 3} strokeDasharray={health === 'down' ? '6 4' : undefined} />
              <Art type={n.type} w={w} h={h} util={st?.util ?? 0} mood={mood} />
              {st && st.queue > 0.05 && <rect x={10} y={h - 12} width={(w - 20) * Math.min(1, st.queue)} height={5} rx={2} fill={color.critical} />}
              <Badge health={health} x={w - 4} y={4} />
              {n.instances > 1 && <text x={w - 8} y={h - 16} textAnchor="end" fill={color.textPrimary} fontSize={14} fontFamily="var(--mono)">×{n.instances}</text>}
              <text x={w / 2} y={h + 18} textAnchor="middle" fill={color.textPrimary} fontSize={14}>{PARAMS[n.type].label}{st && n.type !== 'users' ? ` · ${Math.round(st.util * 100)}%` : ''}</text>
            </g>
          )
        })}
      </svg>
      {!reduced && <Particles design={design} snap={snap} bounds={bounds} scaleN={scaleN} speed={speed} />}
      {snap && <div className="scale" aria-label={`1 particle equals ${scaleN} requests`}>1 particle = {scaleN} request{scaleN > 1 ? 's' : ''}</div>}
    </div>
  )
}

interface P { path: [number, number][]; t: number; dur: number; type: keyof typeof REQ_COLOR; failed: boolean }

// shortcut: Canvas 2D, not PixiJS. Fine at the slice's few hundred particles; switch to Pixi batching before 2,000 (NFR).
function Particles({ design, snap, bounds, scaleN, speed }: { design: Design; snap: Snapshot | null; bounds: { x: number; y: number; w: number; h: number }; scaleN: number; speed: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const parts = useRef<P[]>([])
  const carry = useRef<Record<string, number>>({})
  const lastTick = useRef(-1)

  useEffect(() => {
    if (!snap || snap.tick === lastTick.current) return
    lastTick.current = snap.tick
    const byId = new Map(design.nodes.map((n) => [n.id, n]))
    for (const e of snap.edges) {
      const a = byId.get(e.from), b = byId.get(e.to)
      if (!a || !b) continue
      const path = edgePath(a, b).p
      const lat = snap.nodes[e.to]?.latencyMs ?? 0
      for (const t of REQ_TYPES) {
        const key = `${e.from}>${e.to}:${t}`
        const n = (carry.current[key] ?? 0) + e.flow[t] / scaleN
        const whole = Math.floor(n)
        carry.current[key] = n - whole
        for (let i = 0; i < Math.min(whole, 40); i++)
          parts.current.push({ path, t: -Math.random() * 0.8, dur: 0.9 + Math.min(3, lat / 400), type: t, failed: Math.random() < e.failFrac })
      }
    }
    if (parts.current.length > 2000) parts.current.splice(0, parts.current.length - 2000) // cap; oldest dropped (failed ones are recent, so kept)
  }, [snap, design, scaleN])

  useEffect(() => {
    let raf = 0
    let prev = performance.now()
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000) * speed
      prev = now
      const c = ref.current
      const ctx = c?.getContext('2d')
      if (c && ctx) {
        const r = c.getBoundingClientRect()
        const dpr = devicePixelRatio || 1
        if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr) }
        const k = (r.width * dpr) / bounds.w
        ctx.setTransform(k, 0, 0, k, -bounds.x * k, -bounds.y * k)
        ctx.clearRect(bounds.x, bounds.y, bounds.w, bounds.h)
        parts.current = parts.current.filter((p) => p.t < 1)
        for (const p of parts.current) {
          p.t += dt / p.dur
          if (p.t < 0 || p.t >= 1) continue
          const tt = p.failed ? Math.min(p.t, 1 - p.t) * 1.1 : p.t // failed requests stop short, then bounce back
          const [x, y] = bez(p.path, Math.min(0.9, tt))
          ctx.fillStyle = ctx.strokeStyle = p.failed ? color.critical : REQ_COLOR[p.type]
          ctx.globalAlpha = p.failed ? 1 - p.t * 0.6 : 1
          ctx.beginPath()
          if (p.type === 'read') ctx.arc(x, y, 4, 0, 6.3)
          else if (p.type === 'write') ctx.rect(x - 4, y - 4, 8, 8)
          else if (p.type === 'photo') { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y) }
          else { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5) }
          ctx.fill()
          if (p.failed) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke() }
        }
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [bounds, speed])

  return <canvas ref={ref} className="particles" aria-hidden />
}
