import { useEffect, useRef, useState } from 'react'
import { ALL_TYPES, PARAMS } from '../schema'
import type { CType } from '../schema'
import { useGame } from '../session/store'

// Keyboard alternative to dragging (Architecture PRD, section 13): every board action has a typed command.
// "add cache", "connect lb to app", "set app instances 6", "remove cache", "start", "pause", "resume".
const typeOf = (word: string): CType | undefined => {
  const w = word.trim().toLowerCase()
  return ALL_TYPES.find((t) => t === w || PARAMS[t].label.toLowerCase() === w || PARAMS[t].label.toLowerCase().startsWith(w))
}

export function Palette() {
  const g = useGame()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [out, setOut] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if ((e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape') setOpen(false)
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [])
  useEffect(() => { if (open) input.current?.focus() }, [open])

  const design = g.screen.name === 'level' ? g.designs[g.screen.id] : undefined
  const node = (word: string) => design?.nodes.find((n) => n.id === word.trim().toLowerCase()) ?? design?.nodes.find((n) => n.type === typeOf(word))

  const run = (raw: string) => {
    const s = raw.trim().toLowerCase()
    let m: RegExpMatchArray | null
    if (s === 'start') { g.start(); return 'Started.' }
    if (s === 'pause' || s === 'resume') { g.togglePause(); return s === 'pause' ? 'Paused.' : 'Resumed.' }
    if ((m = s.match(/^add (.+)$/))) {
      const t = typeOf(m[1])
      if (!t) return `Unknown component "${m[1]}".`
      g.place(t)
      return `Added ${PARAMS[t].label}.`
    }
    if ((m = s.match(/^connect (.+) to (.+)$/))) {
      const a = node(m[1]), b = node(m[2])
      if (!a || !b) return 'Both components must be on the board.'
      g.connect(a.id, b.id)
      return `Connecting ${a.id} to ${b.id}. ${useGame.getState().message}`
    }
    if ((m = s.match(/^remove (.+)$/))) {
      const a = node(m[1])
      if (!a) return 'No such component.'
      g.remove(a.id)
      return `Removed ${a.id}.`
    }
    if ((m = s.match(/^set (.+) instances (\d+)$/))) {
      const a = node(m[1])
      if (!a) return 'No such component.'
      g.setInstances(a.id, Number(m[2]))
      return `${a.id} now has ${m[2]} instances.`
    }
    return 'Try: add cache, connect lb to app, set app instances 6, remove cache, start, pause.'
  }

  if (!open || g.screen.name !== 'level') return null
  return (
    <div className="modal-back" onClick={() => setOpen(false)}>
      <form className="modal panel palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); setOut(run(text)); setText('') }}>
        <label className="small muted" htmlFor="palette-input">Type a command, then Enter. Escape closes.</label>
        <input id="palette-input" ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="add cache" autoComplete="off" />
        <p role="status" className="small">{out || 'add cache · connect lb to app · set app instances 6 · remove cache · start · pause'}</p>
      </form>
    </div>
  )
}
