import { useEffect, useState } from 'react'
import { Board } from '../board/Board'
import { SANDBOX_LEVEL } from '../content'
import { Sim } from '../engine/sim'
import type { Snapshot } from '../schema'
import { useGame } from '../session/store'

// The landing page is one idea: press Play. Behind the button, a small live system keeps running.
function Demo() {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [design] = useState(() => SANDBOX_LEVEL.startDesign)
  useEffect(() => {
    const sim = new Sim({ ...SANDBOX_LEVEL, traffic: { ...SANDBOX_LEVEL.traffic, base: { read: 90, write: 15, photo: 45, upload: 5, search: 0, bot: 0 } } }, design, 3)
    for (let i = 0; i < 10; i++) sim.step()
    const t = setInterval(() => setSnap(sim.step()), 250)
    return () => clearInterval(t)
  }, [design])
  return (
    <div className="demo" aria-hidden inert>
      <Board design={design} snap={snap} reduced={reduced} />
    </div>
  )
}

export function Landing() {
  const g = useGame()
  return (
    <div className="landing">
      <section className="hero">
        <h1>See how systems<br />really work.</h1>
        <p className="lede">Build a social network from a dorm-room site into a global platform, and watch real traffic push it until it breaks.</p>
        <div className="row center">
          <button className="btn primary huge" onClick={() => g.enterLevel('sandbox')} autoFocus>Play</button>
        </div>
        <p className="muted small">Nothing is saved. Each visit starts fresh.</p>
      </section>
      <Demo />
    </div>
  )
}
