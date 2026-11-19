import { useEffect, useRef, useState } from 'react'
import { Board } from '../board/Board'
import { SANDBOX_LEVEL } from '../content'
import { Sim } from '../engine/sim'
import type { Snapshot } from '../schema'
import { useGame } from '../session/store'
import { Icon } from './Icon'

// The landing page is one idea: press Play. Behind the button, a small live system keeps running, and you can break it.
function Demo() {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [design] = useState(() => SANDBOX_LEVEL.startDesign)
  const sim = useRef<Sim | null>(null)
  const [breaking, setBreaking] = useState(false)
  useEffect(() => {
    const s = new Sim({ ...SANDBOX_LEVEL, traffic: { ...SANDBOX_LEVEL.traffic, base: { read: 90, write: 15, photo: 45, upload: 5, search: 0, bot: 0 } } }, design, 3)
    for (let i = 0; i < 10; i++) s.step()
    sim.current = s
    const t = setInterval(() => {
      const next = s.step()
      setSnap(next)
    }, 250)
    return () => clearInterval(t)
  }, [design])
  const breakIt = () => {
    if (!sim.current || breaking) return
    sim.current.apply({ kind: 'chaos', event: { kind: 'spike', duration: 14, magnitude: 5 } })
    setBreaking(true)
    setTimeout(() => setBreaking(false), 6000)
  }
  const open = snap?.open ?? []
  const worst = open.slice().sort((a, b) => a.severity - b.severity)[0]
  return (
    <div className="demo-wrap rise" style={{ animationDelay: '520ms' }}>
      <div className="demo-bar">
        <span className={`status-pill${worst ? ` sev${worst.severity}` : ' ok'}`} role="status" aria-live="polite">
          <span className="status-dot" aria-hidden />
          {worst ? worst.name : 'All systems healthy'}
        </span>
        <button className="btn small" onClick={breakIt} disabled={breaking}><Icon name="bolt" size={14} /> {breaking ? 'Breaking…' : 'Try breaking it'}</button>
      </div>
      <div className="demo" aria-hidden inert>
        <Board design={design} snap={snap} reduced={reduced} />
      </div>
    </div>
  )
}

export function Landing() {
  const g = useGame()
  return (
    <div className="landing">
      <section className="hero">
        <h1><span className="rise" style={{ animationDelay: '60ms' }}>See how systems</span><br /><span className="rise" style={{ animationDelay: '150ms' }}>really work.</span></h1>
        <p className="lede rise" style={{ animationDelay: '260ms' }}>Build a social network from a dorm-room site into a global platform, and watch real traffic push it until it breaks.</p>
        <div className="row center rise" style={{ animationDelay: '360ms' }}>
          <button className="btn primary huge cta" onClick={() => g.enterLevel('sandbox')}><Icon name="play" size={20} filled /> Play</button>
        </div>
        <p className="muted small rise" style={{ animationDelay: '440ms' }}>Free, in your browser. Nothing is saved; each visit starts fresh.</p>
      </section>
      <Demo />
    </div>
  )
}
