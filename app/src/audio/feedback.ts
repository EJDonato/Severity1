import { audio } from '.'
import type { Cue } from '.'

// One place for the non-visual half of feedback: a short sound and a short vibration per meaningful moment.
// The visual half lives with each component. Both sound and vibration sit behind the single "Sound and haptics" switch,
// are off by default, and never carry information on their own.
export type Moment = 'tap' | 'place' | 'connect' | 'remove' | 'error' | 'success' | 'chaos' | 'hint' | 'resolved' | 'incident1' | 'incident2' | 'incident3'

const SOUND: Partial<Record<Moment, Cue>> = {
  place: 'place', connect: 'connect', remove: 'remove', error: 'invalid', success: 'star', chaos: 'chaos', hint: 'hint',
  resolved: 'resolved', incident1: 'incident1', incident2: 'incident2', incident3: 'incident3',
}
const BUZZ: Record<Moment, number | number[]> = {
  tap: 8, place: 12, connect: [10, 25, 10], remove: 14, error: [50, 30, 50], success: [15, 30, 15], chaos: 80,
  hint: 8, resolved: [10, 30], incident1: [60, 40, 60], incident2: [40, 40], incident3: 20,
}

let enabled = false

export const feedback = {
  setEnabled(v: boolean) { enabled = v },
  fire(m: Moment) {
    if (!enabled) return
    const cue = SOUND[m]
    if (cue) audio.cue(cue)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(BUZZ[m])
  },
}
