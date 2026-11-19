import { useEffect, useRef, useState } from 'react'
import { useGame } from '../session/store'

// Numbers glide to their new value instead of jumping, so a change reads as movement (ease-out, about a quarter second).
export function Tween({ value, format }: { value: number | null; format: (v: number) => string }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (value === null || from.current === null || reduced) { from.current = value; setShown(value); return }
    const a = from.current, b = value, start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 280)
      const v = a + (b - a) * (1 - Math.pow(1 - k, 3))
      from.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, reduced])
  return <>{shown === null ? '–' : format(shown)}</>
}

export function Chip({ label, value, format, bad, wide, explain }: { label: string; value: number | null; format: (v: number) => string; bad?: boolean; wide?: boolean; explain?: string }) {
  return (
    <div className={`tile chip-metric${bad ? ' bad' : ''}${wide ? ' wide' : ''}`} title={explain}>
      <span className="tile-label">{label}</span>
      <span className="tile-value"><Tween value={value} format={format} /><span className="sr-only">{bad ? ' (over target)' : ''}{explain ? `. ${explain}` : ''}</span></span>
    </div>
  )
}
