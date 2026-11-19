import type { CType } from '../schema'
// One source for design tokens. Hex values live only here. World: quiet white, one blue, soft depth.
// Contrast is asserted in tokens.test.ts, so any change that breaks 4.5:1 text or 3:1 graphics fails CI.
export const color = {
  bg0: '#F5F5F7', bg1: '#FFFFFF', bg2: '#FFFFFF',
  borderSubtle: '#E5E5EA', borderStrong: '#8E8E93', dot: '#D8D8DD',
  textPrimary: '#1D1D1F', textSecondary: '#6E6E73',
  ink: '#1D1D1F', paper: '#F5F5F7',
  shell: '#0066CC', shellDeep: '#004F9F', onShell: '#FFFFFF',
  accent: '#0066CC', focus: '#0066CC',
  // status colours, always paired with a badge shape that carries an ink outline
  ok: '#1E9A4B', warn: '#F5B400', danger: '#E0600F', critical: '#E5352B', info: '#0066CC',
  okText: '#1B7A3A', warnText: '#8A5A00', dangerText: '#B34A0A', criticalText: '#C4261D',
  okTint: '#E8F6EE', warnTint: '#FFF6DB', dangerTint: '#FFEBDD', criticalTint: '#FFE5E3', calmTint: '#EAF2FE',
  read: '#0066CC', write: '#9B3FD0', photo: '#E0207F', upload: '#008A8A', search: '#B25E00', bot: '#6E6E73',
} as const

export const motion = { fast: '150ms', base: '250ms', slow: '450ms', standard: 'cubic-bezier(0.25, 0.1, 0.25, 1)', alert: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)' }
export const CELL = 48
// The editable board is a fixed canvas, in cells. Parts can go anywhere inside it.
export const CANVAS = { w: 28.5, h: 13 }
export const half = (v: number) => Math.round(v * 2) / 2
export const SIZE: Record<CType, [number, number]> = {
  users: [2, 2], dns: [2, 2], cdn: [2, 2], limiter: [2, 2], lb: [3, 2], app: [2, 2], cache: [2, 2], queue: [2, 2],
  worker: [2, 2], db: [2, 2], shard: [2, 2], search: [2, 2], storage: [2, 2], monitor: [2, 2],
}

// Keep a part (and its label underneath) inside the canvas, on a half-cell grid.
export function clampCell(type: CType, x: number, y: number): [number, number] {
  const [w, h] = SIZE[type]
  return [half(Math.max(0.5, Math.min(CANVAS.w - w - 0.5, x))), half(Math.max(0.25, Math.min(CANVAS.h - h - 0.75, y)))]
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export function applyTokens(root: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(color)) root.style.setProperty(`--c-${kebab(k)}`, v)
  for (const [k, v] of Object.entries(motion)) root.style.setProperty(`--m-${k}`, v)
}

// WCAG relative-luminance contrast, exported for the token test.
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
