// Drawn icons, one stroke weight (2px on a 20px grid). Status icons mirror the board badges.
const P: Record<string, string> = {
  plus: 'M10 4v12M4 10h12',
  lock: 'M5 9h10v8H5zM7 9V6a3 3 0 0 1 6 0v3',
  check: 'M4 10.5l4 4 8-9',
  cross: 'M5 5l10 10M15 5L5 15',
  back: 'M16 10H4M9 5l-5 5 5 5',
  next: 'M4 10h12M11 5l5 5-5 5',
  play: 'M6 4l10 6-10 6z',
  pause: 'M6 4v12M14 4v12',
  warn: 'M10 3l8 14H2zM10 8v4M10 14.5v.5',
  octagon: 'M7 3h6l4 4v6l-4 4H7l-4-4V7zM10 7v4M10 13.5v.5',
  flame: 'M10 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 1.5 1.5 1.5 1.5 0 0-2 .5-4 1.5-6z',
  star: 'M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z',
  close: 'M5 5l10 10M15 5L5 15',
}
export type IconName = keyof typeof P

export function Icon({ name, size = 18, filled, className }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" aria-hidden focusable="false">
      <path d={P[name]} />
    </svg>
  )
}

export const sevIcon = (s: number): IconName => (s === 3 ? 'warn' : s === 2 ? 'octagon' : 'flame')

// Wordmark: set type only. The numeral takes the accent colour.
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }} aria-label="Severity 1">
      <span aria-hidden>Severity</span><span className="one" aria-hidden>1</span>
    </span>
  )
}
