import { useEffect } from 'react'
import { INTERVIEW_LEVEL, LEVELS, SANDBOX_LEVEL } from '../content'
import { useGame } from '../session/store'
import { Icon } from './Icon'

// Optional goals, all open from the start. The sandbox is home; challenges are things to try in it.
export function Challenges({ onClose }: { onClose: () => void }) {
  const g = useGame()
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [onClose])
  const play = (id: string) => { onClose(); g.enterLevel(id) }
  const rows = [SANDBOX_LEVEL, ...LEVELS, INTERVIEW_LEVEL]
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel challenges" role="dialog" aria-modal="true" aria-label="Challenges" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2>Challenges</h2><button className="btn quiet" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <ul className="challenge-list">
          {rows.map((l) => {
            const s = g.stars[l.id]
            return (
              <li key={l.id}>
                <div>
                  <strong>{l.id === 'sandbox' ? 'Sandbox' : l.title}</strong>
                  <p className="muted small">{l.id === 'sandbox' ? 'Build anything and break it on purpose.' : l.story.split('. ')[0] + '.'}</p>
                </div>
                <div className="row">
                  {s?.ship && <span className="stars on" aria-label="Completed"><span className="on"><Icon name="star" filled size={18} /></span></span>}
                  <button className="btn small" onClick={() => play(l.id)}>{l.id === 'sandbox' ? 'Open' : 'Play'}</button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
