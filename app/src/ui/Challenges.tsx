import { useEffect } from 'react'
import { INTERVIEW_LEVEL, LEVELS, SANDBOX_LEVEL } from '../content'
import { stageOpen, useGame } from '../session/store'
import { Icon } from './Icon'

export function Challenges({ onClose }: { onClose: () => void }) {
  const g = useGame()
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [onClose])
  const play = (id: string) => { onClose(); g.enterLevel(id) }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel challenges" role="dialog" aria-modal="true" aria-label="Stages" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2>Stages</h2><button className="btn quiet" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <ol className="challenge-list">
          {LEVELS.map((l, i) => {
            const open = stageOpen(i, g.stars)
            const done = !!g.stars[l.id]?.ship
            return (
              <li key={l.id} className={open ? '' : 'locked'}>
                <span className={`stage-num${done ? ' done' : ''}`} aria-hidden>{done ? <Icon name="check" size={14} /> : i + 1}</span>
                <div className="stage-text">
                  <strong>{l.title}</strong>
                  <p className="muted small">{open ? l.story.split('. ')[0] + '.' : 'Solve the stage before to open this one.'}</p>
                </div>
                {open ? <button className="btn small" onClick={() => play(l.id)}>{done ? 'Replay' : 'Play'}</button> : <Icon name="lock" size={16} />}
              </li>
            )
          })}
        </ol>
        <h3 className="more-modes">More ways to play</h3>
        <ul className="challenge-list">
          {[SANDBOX_LEVEL, INTERVIEW_LEVEL].map((l) => (
            <li key={l.id}>
              <div className="stage-text"><strong>{l.id === 'sandbox' ? 'Sandbox' : l.title}</strong><p className="muted small">{l.id === 'sandbox' ? 'Everything unlocked, no goals. Build anything and break it on purpose.' : '15 minutes, an open prompt and a scored rubric.'}</p></div>
              <button className="btn small" onClick={() => play(l.id)}>Open</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
