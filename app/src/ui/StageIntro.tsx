import { useEffect } from 'react'
import { LEVELS } from '../content'
import type { Level } from '../schema'
import { Icon } from './Icon'

// Each stage opens with one problem, told as a symptom. It never names the fix: working that out is the game.
export function StageIntro({ level, index, onStart }: { level: Level; index: number; onStart: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onStart() }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [onStart])
  const first = index === 0
  const last = index === LEVELS.length - 1
  return (
    <div className="modal-back">
      <div className="modal intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
        {first ? (
          <>
            <h2 id="intro-title">Welcome to Friendbook</h2>
            <p className="intro-lede">You just launched Friendbook, a social network for your college, from your dorm room. You are its only engineer.</p>
            <p>Right now it is three parts. <strong>Users</strong> send requests to your <strong>App Server</strong>, which keeps profiles in a <strong>Database</strong>. As Friendbook grows, each stage brings one new problem. Watch the board, work out what is breaking, and change the design until every objective is green.</p>
            <ul className="intro-howto">
              <li><Icon name="play" size={16} filled /> Press Play to send traffic through your system.</li>
              <li><Icon name="plus" size={16} /> Drag parts from the left onto the board, and drag the blue dot on a part to connect it.</li>
              <li><Icon name="warn" size={16} /> When something breaks, the part glows and an alert tells you where.</li>
            </ul>
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
            <p className="muted small">Your design carries over from the last stage. Hints are there if you get stuck.</p>
          </>
        )}
        <div className="row center">
          <button className="btn primary large-cta" onClick={onStart} autoFocus>{first ? 'Start the first day' : "Let's go"}</button>
        </div>
      </div>
    </div>
  )
}
