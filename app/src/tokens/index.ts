// One source for design tokens (Design System PRD 3.1). Hex values live only here.
export const color = {
  bg0: '#0E1320', bg1: '#151C2C', bg2: '#1E2740',
  borderSubtle: '#2A3452', borderStrong: '#7384AD',
  textPrimary: '#E8ECF4', textSecondary: '#A9B3C7',
  accent: '#6C9CFF', focus: '#FFFFFF',
  ok: '#2FBF8F', warn: '#F2A93B', danger: '#F26B3A', critical: '#FF5A6E', info: '#5BB8F0',
  read: '#5BB8F0', write: '#F2A93B', photo: '#E58FC0', upload: '#F0E442',
} as const

export const motion = { fast: '120ms', base: '220ms', slow: '400ms', standard: 'cubic-bezier(0.2, 0, 0, 1)', alert: 'cubic-bezier(0.3, 1.4, 0.5, 1)' }
export const CELL = 48

const kebab = (s: string) => s.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)

export function applyTokens(root: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(color)) root.style.setProperty(`--c-${kebab(k)}`, v)
  for (const [k, v] of Object.entries(motion)) root.style.setProperty(`--m-${k}`, v)
}
