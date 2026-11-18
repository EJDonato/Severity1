import { describe, expect, it } from 'vitest'
import { color, contrast } from '.'

const surfaces = [color.bg1, color.bg0]
describe('design token contrast (WCAG 2.1 AA)', () => {
  it('text tokens reach 4.5:1 on white and on the grey surface', () => {
    for (const t of ['textPrimary', 'textSecondary', 'accent', 'okText', 'warnText', 'dangerText', 'criticalText'] as const)
      for (const s of surfaces) expect(contrast(color[t], s), `${t} on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it('white text on the accent fill reaches 4.5:1', () => {
    expect(contrast(color.onShell, color.shell)).toBeGreaterThanOrEqual(4.5)
  })
  it('control boundaries and non-text graphics reach 3:1 on white', () => {
    for (const t of ['borderStrong', 'ok', 'danger', 'critical', 'read', 'write', 'photo', 'upload'] as const)
      expect(contrast(color[t], color.bg1), t).toBeGreaterThanOrEqual(3)
  })
  it('ink outlines (used on every status badge) reach 3:1 against each status fill', () => {
    for (const t of ['ok', 'warn', 'danger', 'critical'] as const) expect(contrast(color.ink, color[t]), t).toBeGreaterThanOrEqual(3)
  })
  it('status text on its tint reaches 4.5:1', () => {
    expect(contrast(color.dangerText, color.dangerTint)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(color.warnText, color.warnTint)).toBeGreaterThanOrEqual(4.5)
  })
})
