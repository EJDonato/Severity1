import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { MachineIcon } from '../board/Board'
import { PART_INFO, unlockStage } from '../content'
import { PARAMS } from '../schema'
import type { CType } from '../schema'
import { Icon } from './Icon'

// The parts, in the order the game needs them. Unlocked ones drag onto the board (or add on click);
// locked ones show which stage opens them; parts that just unlocked wear a "New" badge for that stage.
export function PartsPalette({ types, unlocked, fresh = [], onAdd, onDrop, onHover }: {
  types: CType[]; unlocked: CType[]; fresh?: CType[]; onAdd: (t: CType) => void; onDrop: (t: CType, clientX: number, clientY: number) => void
  onHover?: (clientX: number, clientY: number) => boolean
}) {
  const [drag, setDrag] = useState<{ type: CType; x: number; y: number; over: boolean } | null>(null)

  const start = (e: ReactPointerEvent, type: CType) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return
      moved = true
      setDrag({ type, x: ev.clientX, y: ev.clientY, over: onHover?.(ev.clientX, ev.clientY) ?? false })
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
        {types.map((t, i) => {
          const open = unlocked.includes(t)
          const isNew = open && fresh.includes(t)
          const stage = unlockStage(t) + 1
          return open ? (
            <button key={t} className={`part${isNew ? ' is-new' : ''}`} style={{ ['--i' as string]: i }} onPointerDown={(e) => start(e, t)} onClick={(e) => { if (e.detail === 0) onAdd(t) }}
              aria-label={`Add ${PARAMS[t].label}${isNew ? ', new' : ''}`} title={`${PARAMS[t].label} · ${PARAMS[t].cost ? `$${PARAMS[t].cost}/mo` : 'free'}\n${PART_INFO[t]}`}>
              {isNew && <span className="new-badge" aria-hidden>New</span>}
              <span className="part-logo"><MachineIcon type={t} size={38} /></span>
              <span className="part-name">{PARAMS[t].label}</span>
            </button>
          ) : (
            <button key={t} className="part locked" style={{ ['--i' as string]: i }} disabled aria-label={`${PARAMS[t].label}, locked until stage ${stage}`} title={`Unlocks at stage ${stage}`}>
              <span className="part-logo"><MachineIcon type={t} size={38} /><span className="lock" aria-hidden><Icon name="lock" size={14} /></span></span>
              <span className="part-name">{PARAMS[t].label}</span>
            </button>
          )
        })}
      </div>
      {drag && createPortal(
        <div className={`drag-ghost${drag.over ? ' over' : ''}`} style={{ left: drag.x, top: drag.y }} aria-hidden>
          <MachineIcon type={drag.type} size={56} />
          <span className="drag-label">{drag.over ? `Drop to place ${PARAMS[drag.type].label}` : PARAMS[drag.type].label}</span>
        </div>,
        document.body,
      )}
    </>
  )
}
