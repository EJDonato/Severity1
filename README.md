# Severity 1

A browser game about system design. You build Friendbook, a fictional social network, out of live infrastructure and watch real traffic stress and break it.

Press **Play** and you are welcomed to Friendbook as its only engineer. Stage 1 is just Users, an App Server and a Database. Each of the 11 stages brings one new problem, told as a symptom, and you work out the fix; your design carries over, so it grows from a dorm-room site into a global architecture. Stars, hints and a debrief with a replay come with every stage. The **sandbox** (everything unlocked, chaos buttons, no goals) and an **interview mode** are there too.

- Product: [Severity-1-PRD.md](Severity-1-PRD.md) (see "Direction change") · Architecture: [Severity-1-System-Architecture-PRD.md](Severity-1-System-Architecture-PRD.md) · Design system: [Severity-1-Design-System-PRD.md](Severity-1-Design-System-PRD.md)
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

Landing page with Play, an 11-stage campaign with a welcome and one problem per stage, the sandbox and interview mode, all 14 components, a tick-based simulation with incidents, chaos events, SLO judging and star scoring, run replay and side-by-side design comparison in the debrief, a drag-and-drop board (drag parts from the Parts column onto the canvas, drag them around, drag from the blue dot on a part to another part to wire them), a keyboard command palette (press `/`), screen-reader design description, reduced motion, sound (off by default), offline play, and no persistence.

Removed on purpose: the Academy lessons, quizzes, component locking, test-out, the Codex and the before/after check. See the PRD's "Direction change".

## Known gaps and honest caveats

- **Accounts, cloud sync and leaderboards (FR-21) are not built**: they need a backend and contradict the v1 decision of no saving.
- **The simulation runs on the main thread, not in a Web Worker.** A tick costs well under 4 ms on the largest design (asserted in tests).
- **Particles use Canvas 2D, not PixiJS.** The 2,000-particle target has not been profiled.
- **Content is typed TypeScript, not JSON validated by JSON Schema.** `src/content/content.test.ts` enforces the same rules: every reference design passes, every starting design fails, minimum-design guards hold, wrong settings fail.
- **Golden replays run in Chrome only**, not Firefox and Safari.
- **The challenge numbers are tuned by script, not reviewed** by a senior engineer, as the PRD asks before a playtest.
- **Sound is synthesized tones.** There is no authored art or audio.
- **Not done:** colorblind-simulation checks, a Lighthouse load-time check, Storybook and screenshot regression, a manual WCAG audit.
