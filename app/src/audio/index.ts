// Web Audio: a data-centre hum that rises with load, plus short cues. Nothing plays before the first user gesture,
// every cue has a visual twin, and one mute switch silences everything (Design System PRD, section 8).
type Cue = 'place' | 'connect' | 'invalid' | 'incident1' | 'incident2' | 'incident3' | 'resolved' | 'star' | 'hint'
const TONES: Record<Cue, [number, number, OscillatorType][]> = {
  place: [[520, 0.08, 'sine']], connect: [[660, 0.06, 'sine'], [880, 0.08, 'sine']], invalid: [[180, 0.16, 'triangle']],
  incident3: [[620, 0.14, 'sine']], incident2: [[520, 0.14, 'square'], [390, 0.18, 'square']], incident1: [[880, 0.12, 'square'], [440, 0.12, 'square'], [880, 0.12, 'square']],
  resolved: [[520, 0.08, 'sine'], [780, 0.14, 'sine']], star: [[660, 0.08, 'sine'], [880, 0.08, 'sine'], [1320, 0.16, 'sine']], hint: [[440, 0.1, 'triangle']],
}

let ctx: AudioContext | null = null
let hum: { osc: OscillatorNode; gain: GainNode } | null = null
let muted = false

function ensure(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx) {
    ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = 55
    gain.gain.value = 0
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 240
    osc.connect(lp).connect(gain).connect(ctx.destination)
    osc.start()
    hum = { osc, gain }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export const audio = {
  // Call from a click handler: browsers only allow audio after a gesture.
  unlock() { ensure() },
  setMuted(v: boolean) {
    muted = v
    if (hum && ctx) hum.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  },
  hum(util: number) {
    if (muted || !ctx || !hum) return
    const u = Math.max(0, Math.min(1.2, util))
    hum.osc.frequency.setTargetAtTime(55 + u * 45, ctx.currentTime, 0.2) // pitch rises with load
    hum.gain.gain.setTargetAtTime(0.012 + u * 0.02, ctx.currentTime, 0.2) // capped well below the cues
  },
  stopHum() { if (hum && ctx) hum.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1) },
  cue(c: Cue) {
    if (muted || !ctx) return
    let t = ctx.currentTime
    for (const [f, d, type] of TONES[c]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = f
      g.gain.setValueAtTime(0.06, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + d + 0.02)
      t += d
    }
  },
}
export type { Cue }
