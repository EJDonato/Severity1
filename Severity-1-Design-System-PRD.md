# Severity 1 — Design System PRD

November 18, 2026

Companion to the [Product Requirements Document](Severity-1-PRD.md) and the [System Architecture PRD](Severity-1-System-Architecture-PRD.md). Requirement IDs (FR-xx) refer to the product PRD.

## 1. Purpose and scope

The design system is the shared visual and interaction language of Severity 1: tokens, machine art, request particles, UI components, motion, sound and the rules for using them. Its job is the product PRD's first goal: **a player can tell what is wrong by looking, before reading any numbers.**

It covers the game UI, the board art, the Academy scenes and the Codex. It does not cover marketing sites or the fictional product's own screens beyond the scene art in lessons.

## 2. Design principles

1. **State is visible.** Load, health, flow and failure show on the machine itself, not only in a panel.
2. **Never color alone.** Every status and request type has a shape or icon as well as a color (FR-18).
3. **Quiet, white, premium.** A modern, minimalist white interface in the spirit of a premium product page: generous space, large calm type, one accent colour, soft depth. Flat 2D machines with strong silhouettes; no isometric depth, no decorative gradients.
4. **Calm by default, loud on purpose.** The board is quiet when healthy; ring colour, glow, motion and sound escalate with severity so that incidents stand out against the white page.
5. **Original and fictional.** All art, names and UI are original. No real company logos, product UI or brand colors. The fictional social network is called Friendbook and has its own mark (section 12) (FR-28).
6. **Systematic.** Everything comes from tokens, so the slice's greybox art can be restyled without rework.

## 3. Design tokens

Tokens live in one JSON source in the `tokens` package and generate CSS custom properties and a TypeScript module. The SVG, Pixi and HTML layers all read from them. Raw hex values never appear outside the token file.

### 3.1 Color

The default theme is light: a white page, light-grey grouped surfaces, and white objects (machines, tiles) that sit on them. A dark theme is a post-launch option and must use the same semantic names. One accent blue carries primary actions, links, selection and focus; everything else is neutral until something needs attention.

**Surfaces and text**

| Token | Hex | Use |
| --- | --- | --- |
| `bg.1` | `#FFFFFF` | Page, machines, tiles, toolbox items, modals |
| `bg.0` | `#F5F5F7` | Grouped surfaces: panels, board, chapter cards |
| `border.subtle` | `#E5E5EA` | Hairlines inside lists and tables (decorative; never the only boundary of a control) |
| `border.strong` | `#8E8E93` | Connections, control boundaries, dashed ghost outlines |
| `text.primary` (`ink`) | `#1D1D1F` | Body, headings, line art |
| `text.secondary` | `#6E6E73` | Supporting text |
| `accent` | `#0066CC` | Primary actions, links, selection, focus ring |
| `accent.deep` | `#004F9F` | Pressed and hover state of primary actions |

**Status** (always paired with the badge shape in 3.2; badge shapes carry an `ink` outline)

| Token | Hex | Meaning | Text-safe variant |
| --- | --- | --- | --- |
| `status.ok` | `#1E9A4B` | Healthy, resolved | `#1B7A3A` |
| `status.warn` | `#F5B400` | Strained, watch | `#8A5A00` |
| `status.danger` | `#E0600F` | Overloaded, degraded | `#B34A0A` |
| `status.critical` | `#E5352B` | Failing, SEV-1, errors | `#C4261D` |

**Request types** (color plus shape; see 3.2)

| Token | Hex | Type |
| --- | --- | --- |
| `req.read` | `#0066CC` | Reads |
| `req.write` | `#9B3FD0` | Writes |
| `req.photo` | `#E0207F` | Photo loads |
| `req.upload` | `#008A8A` | Uploads |
| `req.search` | `#B25E00` | Searches |
| `req.bot` | `#6E6E73` | Bot traffic |

**Contrast (computed, and asserted in CI by `tokens.test.ts`).** Primary text is 16.8:1 on white and 15.5:1 on the grey surface; secondary text 5.1:1 and 4.7:1; the accent is 5.6:1 on white and 5.1:1 on grey, and white text on the accent fill is 5.6:1. Every text-safe status variant is at least 5.3:1 on white. `border.strong` is 3.3:1 on white, `status.ok` 3.6:1, `status.danger` 3.6:1 and every request colour at least 3.2:1 on white (the grey surface lowers some of these by up to half a point, which is why shapes, not hue, carry meaning). `status.warn` yellow is only 1.8:1 on white, so it is never used alone: the badge shape has a 1.5px `ink` outline (ink against yellow is 9.2:1) and every status also has a text label. Any change to a token must keep this test green.

**Colorblind safety.** No meaning relies on hue alone. Status uses a distinct badge shape and a text label; request types use distinct particle shapes; mood faces use mouth shape. Each palette change is checked in protanopia, deuteranopia and tritanopia simulations.

### 3.2 Shapes and icons that carry meaning

| Meaning | Shape / icon | Notes |
| --- | --- | --- |
| Healthy | Circle with check | Solid, calm |
| Strained | Triangle with exclamation | Outline plus fill |
| Overloaded | Octagon with exclamation | Slightly thicker stroke |
| Failing | Flame | Animated unless reduced motion |
| Down | Square with cross | Hatched fill |
| Resolved | Circle with check and ring | Brief confirmation |
| Read request | Circle particle | 8 px |
| Write request | Square particle | 8 px |
| Photo load | Diamond particle | 10 px |
| Upload | Triangle particle | 10 px |
| Search | Hexagon particle | 10 px |
| Bot traffic | Grey square particle with a cross | 8 px |
| Failed request | Any shape in `status.critical` with a cross mark, bouncing back | Always red plus the cross |

### 3.3 Typography

System font stack only: SF Pro on Apple devices, Helvetica Neue or Arial elsewhere. No font downloads, so type is crisp, native and free from the load budget.

| Role | Stack | Sizes (px) | Notes |
| --- | --- | --- | --- |
| Display and headings | `-apple-system, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial` | 19, 24, 32, 40 to 72 fluid | Bold, tight tracking (-0.022em to -0.035em), line height 1.05 to 1.15, balanced wrapping |
| Body and UI | `-apple-system, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial` | 14, 15, 17, 21 | Body 17, line height 1.47, tracking -0.011em |
| Metrics and logs | `ui-monospace, 'SF Mono', Menlo` for ticks and logs; tabular figures in the sans for tile values | 13, 14, 22 | Tabular numbers so values do not jitter |

Minimum text size is 13px for supporting labels and 14px for anything interactive. All text scales to 200% without loss of function (WCAG 1.4.4); layouts use relative units. No label sits above a heading.

### 3.4 Spacing, grid and shape

- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48 px.
- **Board grid:** one cell is 48 px at 100% zoom. Machines are 2×2 cells (96 px) by default; the load balancer, CDN and sharded database are 3×2. Ports sit on cell edges.
- **Radii:** 16 (tiles, toolbox items), 22 (panels, machines), 26 (cards and the board), 30 (lesson frame), 980 (pill buttons, chips).
- **Elevation:** nearly flat. Hierarchy comes from surface tone (white on grey on white), not borders. Machines carry a soft diffuse shadow that warms to the state colour under load. Floating surfaces (alert, modal) use frosted white with a large soft shadow. A frosted translucent bar sticks to the top.
- **Z-layers:** board 0, connections 10, machines 20, particles 30, in-board labels 40, panels 100, modals 200, toasts and pager alerts 300.

### 3.5 Motion

| Token | Value | Use |
| --- | --- | --- |
| `motion.fast` | 150 ms | Hover, toggle, press |
| `motion.base` | 250 ms | Panels, tooltips |
| `motion.slow` | 450 ms | Scene morphs, camera moves |
| `ease.standard` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Most transitions |
| `ease.alert` | `cubic-bezier(0.2, 0.9, 0.3, 1.1)` | Pager drop-in, small overshoot |

Rules: motion explains cause and effect, never decorates. Nothing flashes more than three times per second (seizure safety). All motion respects reduced-motion mode (section 9).

## 4. Machine art

Each component in the catalog is an illustrated machine, drawn as a layered SVG symbol, with five visible health states driven by utilization.

### 4.1 Anatomy and spec

- **Layers (named in the SVG):** `body`, `details` (lights, screens, props), `status-overlay` (glow, smoke, fire, cross hatch), `instance-stack` (copies for scaling), `ports`.
- **Size and weight:** each symbol under 8 KB optimized; ink line art on a white tile with at most two supporting tones from the token palette; no strokes thinner than 1.75 px at 100% zoom.
- **Scaling is physical.** Adding an instance stacks another unit (up to a visible cap, then a "×N" badge). Capacity is readable at a glance.
- **Ports:** inputs on the left or top, outputs on the right or bottom, drawn as 12 px sockets with the connection-type shape inside (solid, dashed, dotted) so valid pairings are visible.

### 4.2 Load states

| State | Utilization | Visual change | Icon badge |
| --- | --- | --- | --- |
| Healthy | below 60% | Neutral hairline, soft grey shadow, green load bar | Check circle |
| Strained | 60–85% | Yellow ring and warm shadow, load bar fills | Triangle |
| Overloaded | 85–100% | Orange ring and glow, load bar near full, queue visibly growing | Octagon |
| Failing | over 100% or errors | Red ring, pulsing red glow, red failed particles bounce | Flame |
| Down | crashed or region out | Dashed outline, greyed, cross badge, no animation | Square cross |

State boundaries are tokens, not hard-coded, and match the engine's `health()` output. The first three states must be distinguishable in grayscale.

### 4.3 Component catalog

| Component | Metaphor (from the product PRD) | Load cues | Size | Special notes |
| --- | --- | --- | --- | --- |
| Users | Crowd on a world map with mood faces | Faces go happy, impatient, leaving as latency and errors rise | map overlay | Mood uses face shape and mouth, not color alone |
| App Server | Rack with blinking lights | Light speed, glow, smoke, fire | 2×2 | Instance stack of racks |
| Load Balancer | Traffic controller directing lanes | Arm speed; lanes visibly unbalanced if misconfigured | 3×2 | Lane widths show distribution |
| Database | Vault with a clerk at the counter | Waiting line grows; lock icons on contention | 2×2 | Replicas shown as smaller linked vaults |
| Cache | Shelf of glowing memory chips | Hits flash green and bounce back; misses fall through | 2×1 | Sits next to the server it serves |
| Object Storage | Warehouse of labeled crates | Loading dock congests at max egress | 2×2 | |
| CDN | Globe ringed with edge towers | Towers light near viewers; origin pipe thins as hit rate rises | 3×2 | |
| DNS | Signpost or directory board | Arrows point to the nearest region | 1×1 | Small; shows policy |
| Message Queue | Conveyor belt of packages | Packages pile up and spill | 3×1 | Spill is a distinct failure animation |
| Worker | Small robots at workbenches | Speed up, then sweat; idle ones nap | 2×1 | Napping robots use a Zzz icon |
| Search Index | Library card catalog | Drawers open faster; stale drawers marked | 2×2 | Out-of-sync state has its own badge |
| Sharded Database | Vault wall split into labeled bays | Hot shard glows and leans | 3×2 | Shard key label on each bay |
| Rate Limiter / API Gateway | Bouncer at a gate | Blocked requests bounce at the gate | 2×1 | Blocked requests use a distinct "denied" mark |
| Monitoring | Wall of dashboards with a pager | Alerts blink at thresholds | 2×1 | Required for fast recovery |

### 4.4 Slice vs. final art

The vertical slice begins with **greybox** versions: the same silhouettes and ports, flat single-tone fills, and all five states implemented with tokens (glow, badge, simple blink). This is enough to test whether the sim is readable. Final art replaces the `body` and `details` layers per machine without changing ports, sizes or state hooks, so no engine or layout work is redone.

## 5. Traffic and flow

- **Connections.** Three styles: synchronous request (solid), data replication (dashed), async message (dotted). Thickness encodes current flow. Arrowheads show direction. Invalid connections show a short explanation in a tooltip (for example "users should never talk to the database directly").
- **Particles.** Shape and color by type (3.1, 3.2), speed by simulated travel time, so slow systems visibly delay particles. Slight trail at higher speeds. Cap of 2,000 live particles.
- **Sampling label.** A permanent, small scale readout on the board ("1 particle = N requests") so particle counts are never mistaken for volumes.
- **Failure.** A failed particle turns `status.critical`, gains a cross mark, and bounces back toward users.
- **X-ray view.** Slows time, dims everything except one chosen trace, and labels each hop with its latency contribution.

## 6. UI components

Every component is documented with its states (default, hover, focus, active, disabled, loading, error where relevant), its tokens, and its keyboard behaviour. Interactive targets are at least 44 × 44 px on tablet and 32 × 32 px on desktop.

| Component | Purpose | Notes |
| --- | --- | --- |
| Button (primary, secondary, quiet, danger) | Actions | One primary per view; icon optional |
| Icon button | Toolbars | Always has an accessible name and tooltip |
| Toggle, slider, stepper | Lesson toy controls, settings, instance plus/minus | Stepper shows live cost delta |
| Toolbox item | Draggable component | Locked state shows a padlock and "unlocks in: lesson name"; keyboard "add" action |
| Panel and tabs | Inspect, settings, logs | Resizable on desktop; becomes a bottom sheet on tablet portrait |
| Settings field set | Cache size, expiry, shard key, regions | Inline validation and units |
| Metrics tile and sparkline | Requests per second, p50/p95, error rate, availability, cost | Monospace tabular numbers; threshold coloring plus icon |
| Pager alert | Incident notification | Slides in with `ease.alert`; severity icon, name, one-line symptom, "Go to" action |
| Hint button (three tiers) | Nudge, concept, fix | Shows the star cost before use |
| Mood face | User sentiment | Shape-coded (mouth and eyes), three to five states |
| Star rating and title badge | Scoring and career ladder | Filled star plus label ("Ship it", "Thrifty", "Senior engineer") |
| Codex card | Collectible concept card | Analogy illustration, diagram, "how large social networks do it" note, sources |
| Lesson scene frame | Academy beats | Illustrated scene area, caption, control strip, progress dots |
| Toast | Non-blocking confirmations | Auto-dismiss except for errors; announced to screen readers |
| Modal | Rare, blocking decisions | Traps focus; Escape closes where safe |
| Timeline scrubber | Debrief replay | Incident markers; keyboard stepping by incident |
| Design compare view | Player design vs. reference | Side by side with highlighted differences |

## 7. Incident presentation

| Severity | Color token | Icon | Alert | Sound |
| --- | --- | --- | --- | --- |
| SEV-3 | `status.warn` | Triangle | Quiet pager slide-in, no camera move | Soft chime |
| SEV-2 | `status.danger` | Octagon | Pager slide-in, camera eases to the failing component | Two-tone alarm |
| SEV-1 | `status.critical` | Flame | Pager slide-in, screen-edge pulse (once), camera focus, simulation pauses on request | Continuous alarm until acknowledged |

An incident panel always shows: name, symptom, affected component link, time open, hint tiers, and a link to the relevant Codex card (the just-in-time refresher). Resolved incidents show the green check state briefly and move to the timeline.

## 8. Audio

- **Hum.** A data center ambience whose pitch and volume rise with overall utilization. Capped at a comfortable level.
- **Cues.** Short, distinct sounds for: component placed, connection made, invalid connection, incident by severity, incident resolved, star earned, hint used.
- **Rules.** Master, effects and ambience sliders; mute remembered; nothing plays before the first user interaction; every cue has a visual equivalent, so audio is never the only signal; no sound louder than the loudest baseline cue.

## 9. Accessibility and adaptive modes

| Requirement | Design rule |
| --- | --- |
| Contrast | Text 4.5:1; UI boundaries and icons 3:1; verified automatically against tokens in CI |
| Color independence | Status, request types and mood each have a shape or icon |
| Focus | Visible 2 px `focus` ring with 2 px offset on every interactive element; never removed |
| Keyboard | Everything operable without a pointer, including building (see the architecture PRD, section 13) |
| Touch | 44 px minimum targets on tablet; ports get an enlarged hit area while dragging a connection |
| Reduced motion | A user setting (and the OS preference as default). Particles become line thickness and dash speed; fire and smoke become static badges; camera moves become cuts; the pager appears without sliding |
| Speed | Pause and 0.5x, 1x, 2x, 4x always visible |
| Text size | Scales to 200% |
| Flashing | Nothing flashes more than three times per second |
| Screen readers | Structured design description and live announcements for incidents and run results |

Both a colorblind palette check and a reduced-motion check are part of the definition of done for any new visual element.

## 10. Illustration and Academy scene style

- Story-hook scenes use the same palette and flat style as the board: bold shapes, warm skin and prop tones from outside the status hues (so scenes never imply alarm by accident), minimal text in the art.
- The **analogy morph** (for example, restaurant host to load balancer) uses shared shapes between the two so the mapping is visible: the transition keeps position and size while swapping detail.
- Diagram style for Codex cards: machine silhouettes at small size, solid, dashed and dotted lines per connection type, a maximum of six elements per diagram.
- Every Academy scene is drawn by the art pipeline below; none uses stock or third-party brand imagery.

## 11. Asset pipeline and governance

**Pipeline.** Vector source files (for example Figma) export to SVG, are optimized with SVGO using a project config that keeps layer IDs, and are checked by a script for: allowed token colors only, required layers present, size under the cap, and no external references. Pixi particle sprites are packed into one atlas at build time.

**Tooling.** A component catalog (Storybook or equivalent) shows every UI component and every machine in every state, in normal and reduced-motion modes, and in a colorblind-simulation view. The same stories drive screenshot tests.

**Definition of done for a new machine or component**

- [ ] Uses tokens only; passes contrast checks
- [ ] All five states (machines) or all interaction states (UI) exist
- [ ] Distinguishable in grayscale and under the three colorblind simulations
- [ ] Reduced-motion variant exists
- [ ] Keyboard and screen reader behaviour documented and tested
- [ ] Under size cap; layer names match the spec
- [ ] Story and screenshot test added

**Change process.** Token and component changes go through pull requests that show visual diffs; the design owner approves changes to tokens, status shapes and machine silhouettes, because those affect readability across all levels.

## 12. Brand and legal rules

- The product is **Severity 1**. The in-game fictional network is **Friendbook**, with an original wordmark and logo mark (a simple speech-bubble-and-link motif) created for the project.
- The visual language borrows only general principles from premium product design (white space, scale, restraint, a native system font); do not reference, imitate or recolor any real company's logo, wordmark, copy, artwork, UI layout or color scheme. Do not use the real brand names in UI text, art, file names or marketing.
- Real techniques and technologies (caching, sharding, queues) may be named in educational text. Real companies' products are not shown.
- Fonts, icons, sounds and illustrations must be original or under licenses that permit commercial use and redistribution; the license for each asset is recorded in an asset register.
- Have a lawyer review the wordmark and the asset register before launch.

## 13. Deliverables by phase

| Phase | Design system deliverables |
| --- | --- |
| 1. Vertical slice | Token file and generated CSS/TS; greybox machines for Users, App Server, Database, Object Storage, Load Balancer with all five states; particle shapes; connection styles; core UI components (buttons, steppers, metrics tiles, pager, panels, toolbox, lesson frame); reduced-motion mode; colorblind checks; catalog tooling and CI checks. Final art for the same set after the fun gate. |
| 2. Campaign alpha | Remaining machines (greybox first), Codex card and compare view, timeline scrubber, audio cues and hum, light theme decision |
| 3. Beta and polish | Final art for all machines, scene illustrations for all lessons, accessibility audit against section 9, audio mix |
| 4. Launch | Asset register complete, wordmark and legal review, documentation for adding future campaigns |

## 14. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Flat art still reads as a diagram, which was the prototype's complaint | Players do not "see" the system | Motion and state cues are specified in section 4.2 and tested in the slice; greybox first to test readability |
| Too many animated elements at once | Visual noise hides the real problem | Calm-by-default rule; severity-driven escalation; particle cap and sampling |
| Palette fails for some players | Players miss alerts | Shape-and-icon rule, simulations in CI, user testing with colorblind players in the slice |
| Art volume (14 machines, five states each, plus scenes) | Delay and inconsistency | Shared base shapes, layered SVG, tokens, per-chapter art rollout, definition of done checklist |
| Audio annoys or excludes | Players mute or leave | Capped levels, separate sliders, visual equivalents for every cue |

## 15. Open questions

- Dark theme: not needed for launch; the semantic token names allow adding one later.
- Who creates the original art and sound, and what is the budget? (This is the same open question as in the product PRD.)
- Whether to commission a small illustration style guide for Academy scenes before the first lesson is drawn.
