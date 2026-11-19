import { useEffect, useState } from 'react'
import { MachineIcon } from '../board/Board'
import { LEVELS, PART_INTRO, STAGE_UNLOCKS } from '../content'
import { PARAMS } from '../schema'
import type { Level } from '../schema'
import { SINGLE } from '../session/store'
import { Icon } from './Icon'

// A stage opens with its one problem, told as a symptom. Then each part it unlocks pops up on its own card,
// one at a time, so every new part gets its moment. Escape skips straight to the board.
export function StageIntro({ level, index, onStart }: { level: Level; index: number; onStart: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onStart() }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [onStart])
  const first = index === 0
  const last = index === LEVELS.length - 1
  const parts = STAGE_UNLOCKS[level.id] ?? []
  const [step, setStep] = useState(0) // 0 is the stage card, 1..n are the part cards
  const finalStep = step === parts.length
  const go = () => (finalStep ? onStart() : setStep(step + 1))
  const label = finalStep ? (first ? 'Start the first day' : "Let's go") : 'Next'
  const part = step > 0 ? parts[step - 1] : null

  return (
    <div className="modal-back">
      {part ? (
        <div className="modal unlock-card" role="dialog" aria-modal="true" aria-labelledby="unlock-title" key={part}>
          <div className="unlock-hero">
            <span className="unlock-burst" aria-hidden />
            <span className="unlock-art"><MachineIcon type={part} size={120} /></span>
            <span className="unlock-pill">{first ? 'Starting part' : 'New part unlocked'}</span>
          </div>
          <h2 id="unlock-title">{PARAMS[part].label}</h2>
          <p className="unlock-what">{PART_INTRO[part].what}</p>
          <p className="unlock-use">{PART_INTRO[part].use}</p>
          <p className="unlock-cost muted small">{PARAMS[part].cost ? `$${PARAMS[part].cost} a month${SINGLE.includes(part) ? '' : ' each'}` : 'Free'}</p>
          {parts.length > 1 && (
            <ol className="unlock-dots" aria-label={`Part ${step} of ${parts.length}`}>
              {parts.map((t, i) => <li key={t} className={i === step - 1 ? 'on' : i < step - 1 ? 'past' : ''} />)}
            </ol>
          )}
          <div className="row center">
            <button className="btn primary large-cta" onClick={go} autoFocus>{label}{!finalStep && <Icon name="next" size={16} />}</button>
          </div>
        </div>
      ) : (
        <div className="modal intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
          {first ? (
            <>
              <h2 id="intro-title">Welcome to Friendbook</h2>
              <p className="intro-lede">You just launched Friendbook, a social network for your college, from your dorm room. You are its only engineer.</p>
              <p>As Friendbook grows, each stage brings one new problem and unlocks the part that can help. Watch the board, work out what is breaking, and change the design until every objective is green.</p>
              <ul className="intro-howto">
                <li><Icon name="play" size={16} filled /> Press Play to send traffic through your system.</li>
                <li><Icon name="plus" size={16} /> Drag parts from the left onto the board, and drag the blue dot on a part to connect it.</li>
                <li><Icon name="warn" size={16} /> When something breaks, the part glows and an alert tells you where.</li>
              </ul>
              <p className="muted small">First, meet the three parts you start with.</p>
            </>
          ) : (
            <>
              <p className="intro-stage muted">Stage {index + 1} of {LEVELS.length}</p>
              <h2 id="intro-title">{level.title}</h2>
              <p className="intro-lede">{level.story}</p>
              <div className="intro-goal">
                <h3>{last ? 'Survive the night' : 'To clear this stage'}</h3>
                <ul>
                  <li>p95 latency under {level.slo.p95Ms} ms</li>
                  <li>Errors under {(level.slo.errorRate * 100).toFixed(1)}%</li>
                  <li>Cost under ${level.budget} a month</li>
                </ul>
              </div>
              <p className="muted small">
                Your design carries over from the last stage.
                {parts.length > 0 ? ` This stage unlocks ${parts.length === 1 ? 'a new part' : `${parts.length} new parts`}.` : ''} Hints are there if you get stuck.
              </p>
            </>
          )}
          <div className="row center">
            <button className="btn primary large-cta" onClick={go} autoFocus>{label}{!finalStep && <Icon name="next" size={16} />}</button>
          </div>
        </div>
      )}
    </div>
  )
}
