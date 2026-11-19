import { useEffect } from 'react'
import { applyTokens } from './tokens'
import { useGame } from './session/store'
import { telemetry } from './telemetry'
import { Debrief } from './ui/Debrief'
import { Landing } from './ui/Landing'
import { LevelScreen } from './ui/Level'
import { Wordmark } from './ui/Icon'

export default function App() {
  const g = useGame()
  const s = g.screen
  useEffect(() => { applyTokens() }, [])
  useEffect(() => { document.documentElement.dataset.reduced = String(g.settings.reducedMotion) }, [g.settings.reducedMotion])

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <button className="brand" onClick={() => g.go({ name: 'menu' })} aria-label="Severity 1, home"><Wordmark /></button>
        <span className="toggles">
          <label className="small"><input type="checkbox" checked={g.settings.sound} onChange={(e) => g.setSound(e.target.checked)} /> Sound</label>
          <label className="small"><input type="checkbox" checked={g.settings.reducedMotion} onChange={(e) => g.setReduced(e.target.checked)} /> Reduced motion</label>
        </span>
      </header>
      {!g.consentAsked && (
        <div className="consent panel" role="region" aria-label="Privacy notice">
          <p className="small">Help us improve: allow anonymous gameplay stats (lessons, hints, stars; no personal data)? Nothing is saved on your device, and this is asked every visit.</p>
          <div className="row"><button className="btn primary small" onClick={() => g.setConsent(true)}>Allow</button><button className="btn small" onClick={() => g.setConsent(false)}>No thanks</button></div>
        </div>
      )}
      {g.consentAsked && telemetry.consent() && <div className="muted small consent-note"><button className="btn quiet small" onClick={() => g.setConsent(false)}>Turn off anonymous stats</button></div>}
      <main id="main">
        {s.name === 'menu' && <Landing />}
        {s.name === 'level' && <LevelScreen key={s.id} id={s.id} />}
        {s.name === 'debrief' && <Debrief id={s.id} />}
      </main>
    </>
  )
}
