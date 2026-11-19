import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { CANVAS, CELL, SIZE, clampCell, color } from '../tokens'
import { PARAMS, REQ_TYPES } from '../schema'
import type { CType, DNode, Design, Health, Mood, Snapshot } from '../schema'

const HEALTH_COLOR: Record<Health, string> = { healthy: color.ok, strained: color.warn, overloaded: color.danger, failing: color.critical, down: color.borderStrong }
const HEALTH_LABEL: Record<Health, string> = { healthy: 'healthy', strained: 'strained', overloaded: 'overloaded', failing: 'failing', down: 'down' }
const REQ_COLOR = { read: color.read, write: color.write, photo: color.photo, upload: color.upload, search: color.search, bot: color.bot }
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
  // Editing: drag parts to move them, drag from a part's blue handle to another part to connect them.
  editable?: boolean
  onMove?: (id: string, x: number, y: number) => void
  onConnect?: (from: string, to: string) => void
  canConnect?: (from: string, to: string) => string | null
  onEdge?: (from: string, to: string) => void
  selectedEdge?: { from: string; to: string } | null
}

export const OUT_TYPES: CType[] = ['users', 'dns', 'limiter', 'lb', 'app', 'cache', 'cdn', 'queue']

// Convert a screen point to board cells, or null when the point is outside the board.
export function clientToCell(root: Element | null, cx: number, cy: number): [number, number] | null {
  const svg = root?.querySelector('svg')
  const m = svg?.getScreenCTM()
  if (!svg || !m) return null
  const r = svg.getBoundingClientRect()
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null
  const p = new DOMPoint(cx, cy).matrixTransform(m.inverse())
  return [p.x / CELL, p.y / CELL]
}

// A part's picture, for the parts palette.
export function MachineIcon({ type, size = 48 }: { type: CType; size?: number }) {
  const [cw, ch] = SIZE[type]
  return (
    <svg viewBox={`0 0 ${cw * CELL} ${ch * CELL}`} width={(size * cw) / 2} height={size} aria-hidden focusable="false">
      <Art type={type} w={cw * CELL} h={ch * CELL} util={0} mood="happy" />
    </svg>
  )
}

// Status badge: distinct shape per state, never color alone (Design System 3.2).
function Badge({ health, x, y }: { health: Health; x: number; y: number }) {
  const c = HEALTH_COLOR[health]
  return (
    <g transform={`translate(${x},${y})`} aria-hidden>
      <circle r={12} fill={color.bg1} stroke={color.borderSubtle} strokeWidth={1.5} />
      {health === 'healthy' && <><circle r={8} fill={c} stroke={color.ink} strokeWidth={1.5} /><path d="M-4 0l3 3 5-6" stroke={color.ink} strokeWidth={2.2} fill="none" /></>}
      {health === 'strained' && <><path d="M0-8L8 7H-8Z" fill={c} stroke={color.ink} strokeWidth={1.5} strokeLinejoin="round" /><path d="M0-3v5M0 4v1" stroke={color.ink} strokeWidth={2} /></>}
      {health === 'overloaded' && <><path d="M-3-8h6l5 5v6l-5 5h-6l-5-5v-6z" fill={c} stroke={color.ink} strokeWidth={1.5} /><path d="M0-4v5M0 4v1" stroke={color.ink} strokeWidth={2} /></>}
      {health === 'failing' && <path d="M0-9C3-4 7-2 7 3a7 7 0 0 1-14 0c0-3 2-4 3-6 1 2 2 2 2 0 0-2 1-4 2-6z" fill={c} stroke={color.ink} strokeWidth={1.5} />}
      {health === 'down' && <><rect x={-7} y={-7} width={14} height={14} fill={color.bg0} stroke={color.ink} strokeWidth={1.5} /><path d="M-4-4l8 8M4-4l-8 8" stroke={color.ink} strokeWidth={2} /></>}
    </g>
  )
}

function Face({ mood, cx, cy }: { mood: Mood; cx: number; cy: number }) {
  const mouth = mood === 'happy' ? 'M-6 3Q0 10 6 3' : mood === 'impatient' ? 'M-6 6H6' : 'M-6 8Q0 1 6 8'
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={13} fill={color.bg1} stroke={color.ink} strokeWidth={1.75} />
      <circle cx={-5} cy={-3} r={1.8} fill={color.textPrimary} />
      <circle cx={5} cy={-3} r={1.8} fill={color.textPrimary} />
      <path d={mouth} stroke={color.textPrimary} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  )
}

function Art({ type, w, h, util, mood }: { type: CType; w: number; h: number; util: number; mood: Mood }) {
  const line = color.ink
  const soft = color.bg0
  if (type === 'users') return <><Face mood={mood} cx={w * 0.3} cy={h * 0.42} /><Face mood={mood} cx={w * 0.7} cy={h * 0.42} /><Face mood={mood} cx={w * 0.5} cy={h * 0.68} /></>
  if (type === 'app')
    return <>{[0, 1, 2].map((i) => (
      <g key={i}><rect x={14} y={14 + i * 22} width={w - 28} height={16} rx={4} fill={soft} stroke={line} strokeWidth={1.75} />
        <circle className="blink" cx={26} cy={22 + i * 22} r={3} fill={color.accent} style={{ animationDuration: `${Math.max(0.25, 1.4 - util)}s`, animationDelay: `${i * 0.2}s` }} />
        <rect x={40} y={20 + i * 22} width={w - 64} height={4} rx={2} fill={line} /></g>
    ))}</>
  if (type === 'db')
    return <><ellipse cx={w / 2} cy={26} rx={30} ry={9} fill={soft} stroke={line} strokeWidth={1.75} /><path d={`M${w / 2 - 30} 26v38c0 5 13 9 30 9s30-4 30-9V26`} fill={soft} stroke={line} strokeWidth={1.75} />
      <path d={`M${w / 2 - 30} 45c0 5 13 9 30 9s30-4 30-9`} fill="none" stroke={line} strokeWidth={2} /></>
  if (type === 'storage')
    return <>{[[16, 40], [48, 40], [32, 14]].map(([x, y], i) => <g key={i}><rect x={x} y={y + 8} width={28} height={26} rx={3} fill={soft} stroke={line} strokeWidth={1.75} /><path d={`M${x} ${y + 18}h28`} stroke={line} strokeWidth={2} /></g>)}</>
  if (type === 'lb')
    return <>{[0, 1, 2].map((i) => <path key={i} d={`M16 ${28 + i * 20}H${w * 0.45}L${w - 16} ${20 + i * 28}`} stroke={line} strokeWidth={3} fill="none" strokeLinecap="round" />)}
      <circle cx={w * 0.45} cy={h / 2} r={8} fill={soft} stroke={line} strokeWidth={1.75} /></>
  if (type === 'dns')
    return <><path d={`M${w / 2} 12v54`} stroke={line} strokeWidth={2.5} strokeLinecap="round" />{[[18, 1], [34, -1], [50, 1]].map(([y, d], i) => (
      <path key={i} d={d > 0 ? `M${w / 2} ${y}h22l8 6-8 6h-22z` : `M${w / 2} ${y}h-22l-8 6 8 6h22z`} fill={color.bg0} stroke={line} strokeWidth={1.75} strokeLinejoin="round" />
    ))}</>
  if (type === 'cdn')
    return <><circle cx={w / 2} cy={44} r={24} fill={soft} stroke={line} strokeWidth={1.75} /><ellipse cx={w / 2} cy={44} rx={10} ry={24} fill="none" stroke={line} strokeWidth={1.5} /><path d={`M${w / 2 - 24} 44h48M${w / 2 - 20} 32h40M${w / 2 - 20} 56h40`} stroke={line} strokeWidth={1.5} />
      {[[14, 22], [w - 14, 22], [w / 2, 12]].map(([x, y], i) => <path key={i} d={`M${x} ${y + 8}v-8m-4 0h8`} stroke={color.accent} strokeWidth={2.5} strokeLinecap="round" />)}</>
  if (type === 'limiter')
    return <><path d={`M22 66V26M${w - 22} 66V26`} stroke={line} strokeWidth={3} strokeLinecap="round" /><path d={`M22 36L${w - 22} 28`} stroke={color.danger} strokeWidth={5} strokeLinecap="round" /><path d={`M22 36L${w - 22} 28`} stroke={line} strokeWidth={1.75} strokeDasharray="6 8" /><circle cx={22} cy={66} r={4} fill={soft} stroke={line} strokeWidth={1.75} /><circle cx={w - 22} cy={66} r={4} fill={soft} stroke={line} strokeWidth={1.75} /></>
  if (type === 'cache')
    return <>{[0, 1, 2].map((i) => <g key={i}><rect x={14 + i * 24} y={20} width={20} height={30} rx={4} fill={soft} stroke={line} strokeWidth={1.75} /><path d={`M${19 + i * 24} 56v8m5-8v8m5-8v8`} stroke={line} strokeWidth={1.75} strokeLinecap="round" /><circle className="blink" cx={24 + i * 24} cy={35} r={3} fill={color.accent} style={{ animationDelay: `${i * 0.25}s` }} /></g>)}</>
  if (type === 'queue')
    return <><rect x={10} y={46} width={w - 20} height={12} rx={6} fill={soft} stroke={line} strokeWidth={1.75} />{[0, 1, 2].map((i) => <rect key={i} x={16 + i * 22} y={26} width={18} height={18} rx={3} fill={color.bg1} stroke={line} strokeWidth={1.75} />)}<circle cx={22} cy={52} r={2.5} fill={line} /><circle cx={w / 2} cy={52} r={2.5} fill={line} /><circle cx={w - 22} cy={52} r={2.5} fill={line} /></>
  if (type === 'worker')
    return <>{[26, 70].map((x, i) => <g key={i}><rect x={x - 12} y={26} width={24} height={18} rx={5} fill={soft} stroke={line} strokeWidth={1.75} /><circle cx={x - 5} cy={35} r={2.2} fill={line} /><circle cx={x + 5} cy={35} r={2.2} fill={line} /><path d={`M${x} 26v-8`} stroke={line} strokeWidth={1.75} /><circle cx={x} cy={16} r={2.5} fill={color.accent} /><rect x={x - 10} y={48} width={20} height={16} rx={4} fill={soft} stroke={line} strokeWidth={1.75} /></g>)}</>
  if (type === 'search')
    return <><circle cx={44} cy={36} r={18} fill={color.bg1} stroke={line} strokeWidth={2.5} /><path d="M57 49l16 16" stroke={line} strokeWidth={4} strokeLinecap="round" /><path d="M34 32h20M34 40h14" stroke={line} strokeWidth={2} strokeLinecap="round" /></>
  if (type === 'shard')
    return <>{[0, 1, 2].map((i) => <g key={i}><ellipse cx={22 + i * 26} cy={26} rx={11} ry={5} fill={soft} stroke={line} strokeWidth={1.75} /><path d={`M${11 + i * 26} 26v28c0 3 5 5 11 5s11-2 11-5V26`} fill={soft} stroke={line} strokeWidth={1.75} /></g>)}</>
  return <>{[[14, 18], [w / 2 + 2, 18], [14, 46], [w / 2 + 2, 46]].map(([x, y], i) => <g key={i}><rect x={x} y={y} width={w / 2 - 16} height={22} rx={4} fill={soft} stroke={line} strokeWidth={1.75} /><path d={`M${x + 5} ${y + 16}l7-6 5 3 6-8`} fill="none" stroke={i === 2 ? color.danger : color.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></g>)}</>
}

function edgePath(a: DNode, b: DNode) {
  const A = px(a), B = px(b)
  const fwd = B.x + B.w / 2 >= A.x + A.w / 2 // leave from the right when the target is ahead, from the left when it is behind
  const x1 = fwd ? A.x + A.w : A.x, y1 = A.y + A.h / 2
  const x2 = fwd ? B.x : B.x + B.w, y2 = B.y + B.h / 2
  const dx = Math.max(40, Math.abs(x2 - x1) / 2) * (fwd ? 1 : -1)
  return { d: `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`, p: [[x1, y1], [x1 + dx, y1], [x2 - dx, y2], [x2, y2]] as [number, number][] }
}
const bez = (p: [number, number][], t: number): [number, number] => {
  const u = 1 - t
  const f = (i: 0 | 1) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i]
  return [f(0), f(1)]
}

export function Board({ design, snap, ghosts = [], selected, linkFrom, focus, reduced, speed = 1, onNode, onGhost, editable, onMove, onConnect, canConnect, onEdge, selectedEdge }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [link, setLink] = useState<{ from: string; x: number; y: number } | null>(null)
  // While a part is being dragged, the board shows it (and its wires) at the pointer without touching the design.
  const view = useMemo<Design>(() => (drag ? { ...design, nodes: design.nodes.map((n) => (n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n)) } : design), [design, drag])
  const all = [...view.nodes, ...ghosts]
  const bounds = useMemo(() => {
    if (editable) return { x: 0, y: 0, w: CANVAS.w * CELL, h: CANVAS.h * CELL }
    const xs = all.flatMap((n) => [px(n).x, px(n).x + px(n).w])
    const ys = all.flatMap((n) => [px(n).y, px(n).y + px(n).h])
    const minX = Math.min(CELL, ...xs) - CELL / 2, maxX = Math.max(...xs, 4 * CELL) + CELL / 2
    const minY = Math.min(...ys, CELL) - CELL / 2, maxY = Math.max(...ys, 4 * CELL) + CELL
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    // eslint-disable-next-line
  }, [view, ghosts.length, editable])
  const byId = new Map(view.nodes.map((n) => [n.id, n]))
  const edges = view.edges.flatMap((e) => {
    const a = byId.get(e.from), b = byId.get(e.to)
    return a && b ? [{ e, ...edgePath(a, b) }] : []
  })
  const rps = snap?.metrics.rps ?? 0
  const scaleN = Math.max(1, Math.ceil(rps / 60))
  const mood = snap?.mood ?? 'happy'

  const toSvg = (cx: number, cy: number): [number, number] => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return [0, 0]
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return [p.x, p.y]
  }
  const listen = (move: (e: PointerEvent) => void, up: (e: PointerEvent) => void) => {
    const end = (e: PointerEvent) => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', end)
      removeEventListener('pointercancel', end)
      up(e)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
  }

  // Press on a part: a small movement is a click (select), a bigger one moves the part.
  const startDrag = (e: ReactPointerEvent, n: DNode) => {
    if (!editable || e.button !== 0) return
    e.preventDefault()
    const [sx, sy] = toSvg(e.clientX, e.clientY)
    const off = [sx - n.x * CELL, sy - n.y * CELL]
    let moved = false
    let last: [number, number] = [n.x, n.y]
    listen(
      (ev) => {
        if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return
        moved = true
        const [mx, my] = toSvg(ev.clientX, ev.clientY)
        last = clampCell(n.type, (mx - off[0]) / CELL, (my - off[1]) / CELL)
        setDrag({ id: n.id, x: last[0], y: last[1] })
      },
      () => {
        setDrag(null)
        if (moved) onMove?.(n.id, last[0], last[1])
        else onNode?.(n.id)
      },
    )
  }

  // Press on a part's handle and drag onto another part to wire them.
  const startLink = (e: ReactPointerEvent, n: DNode) => {
    if (!editable || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const [sx, sy] = toSvg(e.clientX, e.clientY)
    setLink({ from: n.id, x: sx, y: sy })
    listen(
      (ev) => { const [mx, my] = toSvg(ev.clientX, ev.clientY); setLink({ from: n.id, x: mx, y: my }) },
      (ev) => {
        setLink(null)
        const [mx, my] = toSvg(ev.clientX, ev.clientY)
        const hit = view.nodes.find((t) => {
          const q = px(t)
          return t.id !== n.id && mx >= q.x - 10 && mx <= q.x + q.w + 10 && my >= q.y - 10 && my <= q.y + q.h + 24
        })
        if (hit) onConnect?.(n.id, hit.id)
      },
    )
  }

  const linkNode = link ? byId.get(link.from) : undefined
  const linkPath = (() => {
    if (!link || !linkNode) return ''
    const A = px(linkNode)
    const x1 = A.x + A.w, y1 = A.y + A.h / 2
    const dx = Math.max(40, Math.abs(link.x - x1) / 2)
    return `M${x1} ${y1}C${x1 + dx} ${y1} ${link.x - dx} ${link.y} ${link.x} ${link.y}`
  })()
  const arrows: Record<string, [number, number]> = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }

  return (
    <div className={`board${editable ? ' editable' : ''}${link ? ' linking' : ''}`} style={{ aspectRatio: `${bounds.w} / ${bounds.h}` }}>
      <svg ref={svgRef} viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} role="group" aria-label="Design board" style={editable ? { touchAction: 'none' } : undefined}>
        <defs>
          <pattern id="grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={1.4} fill={color.dot} /></pattern>
        </defs>
        <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="url(#grid)" />
        {edges.map(({ e, d }) => {
          const st = snap?.edges.find((x) => x.from === e.from && x.to === e.to)
          const flow = st ? REQ_TYPES.reduce((sum, t) => sum + st.flow[t], 0) : 0
          const chosen = selectedEdge?.from === e.from && selectedEdge?.to === e.to
          return (
            <g key={`${e.from}>${e.to}`}>
              <path d={d} fill="none" stroke={chosen ? color.accent : st && st.failFrac > 0 ? color.critical : color.borderStrong} strokeLinecap="round" strokeWidth={chosen ? 4 : reduced ? 2 + Math.min(10, flow / 25) : 2} strokeDasharray={reduced && flow > 0 ? '10 6' : undefined} className={reduced && flow > 0 ? 'flow-dash' : undefined} />
              {editable && <path d={d} fill="none" stroke="transparent" strokeWidth={18} pointerEvents="stroke" className="edge-hit" onClick={() => onEdge?.(e.from, e.to)} />}
            </g>
          )
        })}
        {link && <path d={linkPath} fill="none" stroke={color.accent} strokeWidth={3} strokeDasharray="7 6" strokeLinecap="round" pointerEvents="none" />}
        {ghosts.map((g) => {
          const { x, y, w, h } = px(g)
          return (
            <g key={g.id} className="ghost" tabIndex={0} role="button" aria-label={`Place ${PARAMS[g.type].label} here`} onClick={() => onGhost?.(g.type)} onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && onGhost?.(g.type)}>
              <rect x={x} y={y} width={w} height={h} rx={22} fill="none" stroke={color.borderStrong} strokeWidth={1.75} strokeDasharray="6 6" />
              <text x={x + w / 2} y={y + h + 22} textAnchor="middle" fill={color.textSecondary} fontSize={16} fontWeight={500}>{PARAMS[g.type].label}</text>
            </g>
          )
        })}
        {view.nodes.map((n) => {
          const { x, y, w, h } = px(n)
          const st = snap?.nodes[n.id]
          const health: Health = st?.health ?? 'healthy'
          const isSel = selected === n.id
          const linkErr = link && link.from !== n.id ? canConnect?.(link.from, n.id) ?? null : 'self'
          const validTarget = !!link && link.from !== n.id && linkErr === null
          return (
            <g key={n.id} transform={`translate(${x},${y})`} className={`machine h-${health}${focus === n.id ? ' focus-pulse' : ''}${drag?.id === n.id ? ' dragging' : ''}`} tabIndex={0} role="button"
              style={link && !validTarget && link.from !== n.id ? { opacity: 0.4 } : undefined}
              aria-label={`${PARAMS[n.type].label}, ${HEALTH_LABEL[health]}${st && n.type !== 'users' ? `, ${Math.round(st.util * 100)}% utilization` : ''}, ${n.instances} instance${n.instances > 1 ? 's' : ''}${linkFrom === n.id ? ', connecting' : ''}`}
              aria-pressed={isSel} onPointerDown={(e) => startDrag(e, n)} onClick={editable ? undefined : () => onNode?.(n.id)}
              onKeyDown={(k) => {
                if (k.key === 'Enter' || k.key === ' ') { k.preventDefault(); onNode?.(n.id) }
                else if (editable && arrows[k.key]) { k.preventDefault(); const [nx, ny] = clampCell(n.type, n.x + arrows[k.key][0], n.y + arrows[k.key][1]); onMove?.(n.id, nx, ny) }
              }}>
              {n.type !== 'users' && n.type !== 'lb' && Array.from({ length: Math.min(3, n.instances - 1) }, (_, i) => (
                <rect key={i} x={(i + 1) * 7} y={-(i + 1) * 7} width={w} height={h} rx={22} fill={color.bg1} stroke={color.borderStrong} strokeWidth={1.5} />
              ))}
              <rect className="body" width={w} height={h} rx={22} fill={color.bg1} stroke={health === 'healthy' ? color.borderSubtle : HEALTH_COLOR[health]} strokeWidth={health === 'healthy' ? 1.5 : 2.5} strokeDasharray={health === 'down' ? '6 4' : undefined} />
              {(isSel || linkFrom === n.id) && <rect className="sel" x={-6} y={-6} width={w + 12} height={h + 12} rx={27} fill="none" stroke={color.accent} strokeWidth={3} strokeDasharray={linkFrom === n.id ? '8 5' : undefined} />}
              {validTarget && <rect x={-6} y={-6} width={w + 12} height={h + 12} rx={27} fill={color.calmTint} fillOpacity={0.5} stroke={color.accent} strokeWidth={3} pointerEvents="none" />}
              {st && n.type !== 'users' && (
                <g aria-hidden>
                  <rect x={16} y={h - 15} width={w - 32} height={5} rx={2.5} fill={color.borderSubtle} />
                  <rect className="util" x={16} y={h - 15} width={Math.max(0, (w - 32) * Math.min(1, st.util))} height={5} rx={2.5} fill={HEALTH_COLOR[health]} />
                </g>
              )}
              <Art type={n.type} w={w} h={h} util={st?.util ?? 0} mood={mood} />
              <Badge health={health} x={w - 4} y={4} />
              {n.instances > 1 && <text x={w - 8} y={h - 24} textAnchor="end" fill={color.textSecondary} fontSize={14} fontFamily="var(--mono)">×{n.instances}</text>}
              <text x={w / 2} y={h + 24} textAnchor="middle" fill={color.ink} fontSize={16} fontWeight={600} pointerEvents="none">{PARAMS[n.type].label}{st && n.type !== 'users' ? <tspan fill={color.textSecondary} fontWeight={500}>{` ${Math.round(st.util * 100)}%`}</tspan> : null}</text>
              {editable && OUT_TYPES.includes(n.type) && (
                <g className="port" transform={`translate(${w},${h / 2})`} onPointerDown={(e) => startLink(e, n)}>
                  <title>Drag to another part to connect</title>
                  <circle r={16} fill="transparent" />
                  <circle r={7} fill={color.accent} stroke="#fff" strokeWidth={2.5} />
                </g>
              )}
            </g>
          )
        })}
      </svg>
      {!reduced && <Particles design={view} snap={snap} bounds={bounds} scaleN={scaleN} speed={speed} />}
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
          else if (p.type === 'search') { for (let k = 0; k < 6; k++) { const ang = (k * Math.PI) / 3; ctx.lineTo(x + 6 * Math.cos(ang), y + 6 * Math.sin(ang)) } }
          else if (p.type === 'bot') ctx.rect(x - 4, y - 4, 8, 8)
          else { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5) }
          ctx.fill()
          if (p.failed || p.type === 'bot') { ctx.strokeStyle = p.failed ? color.critical : color.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke() }
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
