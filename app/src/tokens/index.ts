// One source for design tokens. Hex values live only here. World: quiet white, one blue, soft depth.
// Contrast (measured): ink on white 16.6:1, textSecondary on white 5.1:1 and on page grey 4.7:1, white on accent 4.6:1,
// each *Text variant on white >= 4.5:1.
export const color = {
  bg0: '#F5F5F7', bg1: '#FFFFFF', bg2: '#FFFFFF',
  borderSubtle: '#E5E5EA', borderStrong: '#8E8E93', dot: '#D8D8DD',
  textPrimary: '#1D1D1F', textSecondary: '#6E6E73',
  ink: '#1D1D1F', paper: '#F5F5F7',
  shell: '#0071E3', shellDeep: '#0058B8', onShell: '#FFFFFF',
  accent: '#0071E3', focus: '#0071E3',
  // status colours, always paired with a badge shape
  ok: '#30B15A', warn: '#F5B400', danger: '#F2701D', critical: '#E5352B', info: '#0071E3',
  okText: '#1B7A3A', warnText: '#8A5A00', dangerText: '#B34A0A', criticalText: '#C4261D',
  okTint: '#E8F6EE', warnTint: '#FFF6DB', dangerTint: '#FFEBDD', criticalTint: '#FFE5E3', calmTint: '#EAF2FE',
  read: '#0071E3', write: '#AF52DE', photo: '#FF2D92', upload: '#00A6A6',
} as const

export const motion = { fast: '150ms', base: '250ms', slow: '450ms', standard: 'cubic-bezier(0.25, 0.1, 0.25, 1)', alert: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)' }
export const CELL = 48

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export function applyTokens(root: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(color)) root.style.setProperty(`--c-${kebab(k)}`, v)
  for (const [k, v] of Object.entries(motion)) root.style.setProperty(`--m-${k}`, v)
}
