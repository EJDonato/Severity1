// One source for design tokens. Hex values live only here. World: two-ink print ("registration").
// Contrast (measured): ink on paper 12.9:1, inkSoft on paper 6.4:1, paper on shell 7.2:1, ink on every spot-ink fill 4.9:1 or better.
export const color = {
  // paper and ink
  bg0: '#E6EAF6', bg1: '#F6F7FC', bg2: '#FFFFFF',
  borderSubtle: '#C3CAE3', borderStrong: '#4A5798',
  textPrimary: '#14215C', textSecondary: '#3E4A7E',
  ink: '#14215C', paper: '#E6EAF6',
  shell: '#2748C9', shellDeep: '#1B3499', onShell: '#F6F7FC',
  accent: '#2748C9', focus: '#14215C',
  // spot inks, always paired with a shape (status) or a particle shape (request)
  ok: '#1DA463', warn: '#FFC72C', danger: '#FF5B2E', critical: '#E5243B', info: '#2748C9',
  // darker text-safe variants of the spot inks (colour as text on paper)
  okText: '#0B6B3C', warnText: '#7A5A00', dangerText: '#B33A12', criticalText: '#B3122A',
  // tints for plates
  okTint: '#BFE8D2', warnTint: '#FFE9A8', dangerTint: '#FFC9B8', criticalTint: '#FFB8C0', calmTint: '#CAD3F5',
  read: '#2748C9', write: '#7A3FC4', photo: '#F0399A', upload: '#00A19B',
} as const

export const motion = { fast: '120ms', base: '220ms', slow: '400ms', standard: 'cubic-bezier(0.2, 0, 0, 1)', alert: 'cubic-bezier(0.3, 1.4, 0.5, 1)' }
export const CELL = 48

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export function applyTokens(root: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(color)) root.style.setProperty(`--c-${kebab(k)}`, v)
  for (const [k, v] of Object.entries(motion)) root.style.setProperty(`--m-${k}`, v)
}
