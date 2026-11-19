import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { MachineIcon } from '../board/Board'
import { PART_INFO } from '../content'
import { PARAMS } from '../schema'
import type { CType } from '../schema'

// Cards with a logo for each part. Drag one onto the board, or click it to add it at the next free spot.
export function PartsPalette({ types, onAdd, onDrop }: { types: CType[]; onAdd: (t: CType) => void; onDrop: (t: CType, clientX: number, clientY: number) => void }) {
  const [drag, setDrag] = useState<{ type: CType; x: number; y: number } | null>(null)

  const start = (e: ReactPointerEvent, type: CType) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return
      moved = true
      setDrag({ type, x: ev.clientX, y: ev.clientY })
    }
    const end = (ev: PointerEvent) => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', end)
      removeEventListener('pointercancel', end)
      setDrag(null)
      if (moved) onDrop(type, ev.clientX, ev.clientY)
      else onAdd(type)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
  }

  return (
    <>
      <div className="parts" role="toolbar" aria-label="Parts">
        {types.map((t) => (
          <button key={t} className="part" onPointerDown={(e) => start(e, t)} onClick={(e) => { if (e.detail === 0) onAdd(t) }}
            aria-label={`Add ${PARAMS[t].label}`} title={`${PARAMS[t].label} · ${PARAMS[t].cost ? `$${PARAMS[t].cost}/mo` : 'free'}\n${PART_INFO[t]}`}>
            <span className="part-logo"><MachineIcon type={t} size={38} /></span>
            <span className="part-name">{PARAMS[t].label}</span>
          </button>
        ))}
      </div>
      {drag && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden><MachineIcon type={drag.type} size={56} /></div>}
    </>
  )
}
