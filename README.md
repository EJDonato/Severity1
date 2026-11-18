# Severity 1

A browser game that teaches system design. You build Friendbook, a fictional social network, from a dorm-room site into a global platform, and watch live traffic stress and break it.

- Product: [Severity-1-PRD.md](Severity-1-PRD.md) · Architecture: [Severity-1-System-Architecture-PRD.md](Severity-1-System-Architecture-PRD.md) · Design system: [Severity-1-Design-System-PRD.md](Severity-1-Design-System-PRD.md)
- Context for design work: [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md)

## Run it

```
cd app
npm install
npm run dev        # play
npm test           # engine, content and design-token tests
npm run e2e        # Playwright end-to-end tests (uses your installed Chrome)
```

## What is built

Everything in the product PRD's v1 scope: the Tutorial, Chapters 1 to 9 and the boss level (11 levels), 12 Academy lessons, all 14 components, tick-based simulation with incidents, chaos events, SLO judging and three-star scoring, guided build, hints, test-out, Codex with searchable glossary, debrief with run replay and side-by-side design comparison, sandbox, interview mode with a scored rubric, keyboard command palette, screen-reader design description, reduced motion, sound (off by default), consent-gated anonymous analytics, offline play, and no persistence.

| FR | Status |
| --- | --- |
| FR-01 to FR-15, FR-17 to FR-20, FR-22 to FR-28 | Built. FR-01 uses click-to-place and click-to-connect plus the command palette; there is no drag and no zoom or pan. |
| FR-16 | Built: Chapters 3–9 and the boss level. |
| FR-21 accounts, cloud sync, leaderboards | Not built, on purpose: it needs a backend and contradicts the v1 decision of no saving. |

## Known gaps and honest caveats

- **Simulation runs on the main thread, not in a Web Worker** (architecture PRD, section 6). A tick costs well under 4 ms on the largest design (asserted in tests), so nothing is lost at this scale, but the worker boundary is not built.
- **Particles use Canvas 2D, not PixiJS.** Fine at the current few hundred particles; the 2,000-particle target has not been profiled.
- **Content is typed TypeScript, not JSON validated by JSON Schema.** The content tests (`src/content/content.test.ts`) enforce the same rules: one lesson per component, every reference design passes, every starting design fails, minimum-design guards, sources on every Codex card.
- **Golden replays run in Chrome only** (via the Node test runner and Chrome end-to-end), not in Firefox and Safari.
- **Chapters 3–9 numbers are tuned by script, not reviewed.** The PRD asks for a senior engineer to review the simulation constants and lessons before a playtest. That has not happened.
- **Analytics has no collection endpoint.** Events queue in memory and send only if `VITE_ANALYTICS_URL` is set.
- **Lesson scenes are text and a live toy simulation, not illustrated art.** Sound is synthesized tones, not authored audio.
- **Not done:** colorblind-simulation checks, a Lighthouse load-time check, Storybook and screenshot regression, a manual WCAG audit.
- Non-engineering items from the PRDs (team, budget, legal review of the wordmark, hosting choice) are still open.
