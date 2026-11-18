// Consent-gated, anonymous, in-memory analytics (FR-23). Nothing is stored in the browser.
// shortcut: no collection endpoint is bundled; set VITE_ANALYTICS_URL to enable sending. Without it events only queue.
type Ev = { name: string; t: number; data: Record<string, string | number | boolean> }

const visitId = crypto.randomUUID()
const queue: Ev[] = []
let consent: boolean | null = null // asked every visit; never remembered

export const telemetry = {
  setConsent(v: boolean) {
    consent = v
    if (!v) queue.length = 0
    else flush()
  },
  consent: () => consent,
  track(name: string, data: Ev['data'] = {}) {
    if (consent !== true) return
    queue.push({ name, t: Date.now(), data })
    if (queue.length >= 20) flush()
  },
  queued: () => queue.length,
}

function flush() {
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined
  if (!url || !navigator.onLine || !queue.length) return
  const body = JSON.stringify({ visit: visitId, events: queue })
  const ok = navigator.sendBeacon?.(url, body) ?? false
  if (ok) queue.length = 0
}

addEventListener('online', flush)
addEventListener('pagehide', flush)
