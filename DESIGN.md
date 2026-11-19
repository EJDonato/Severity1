---
name: Severity 1
description: A system-design game in quiet white, one blue, large type and soft depth.
colors:
  white: "#FFFFFF"
  surface: "#F5F5F7"
  hairline: "#E5E5EA"
  line-strong: "#8E8E93"
  ink: "#1D1D1F"
  ink-soft: "#6E6E73"
  accent: "#0071E3"
  accent-deep: "#0058B8"
  ok: "#30B15A"
  warn: "#F5B400"
  danger: "#F2701D"
  critical: "#E5352B"
  ok-text: "#1B7A3A"
  warn-text: "#8A5A00"
  danger-text: "#B34A0A"
  critical-text: "#C4261D"
  danger-tint: "#FFEBDD"
  warn-tint: "#FFF6DB"
  req-read: "#0071E3"
  req-write: "#AF52DE"
  req-photo: "#FF2D92"
  req-upload: "#00A6A6"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.47
    letterSpacing: "-0.011em"
rounded:
  md: "16px"
  lg: "22px"
  xl: "26px"
  pill: "980px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  button-default:
    backgroundColor: "#E8E8ED"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  chapter-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "28px"
  metric-tile:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
---

# Design System: Severity 1

## Overview

Quiet, white and generous, in the spirit of modern premium product pages: big confident headlines, lots of air, one blue, soft rounded surfaces, a frosted sticky bar. The interface recedes so the running system on the board is the thing you look at. Nothing here copies any company's marks, copy or artwork; only general principles (space, scale, restraint) are shared.

## Colors

White page, `surface` grey for grouped panels and the board, white for the things that sit on them (machines, tiles, toolbox items). One accent blue for the primary action, links, selection and focus. Status colours are used only for state, always with a badge shape, and as text only in the darker `*-text` variants (4.5:1 or better on white).

## Typography

System font stack only (SF on Apple devices, Helvetica/Arial elsewhere). Display headings are tight and bold, body is 17px. Numbers use tabular figures. Minimum text size 13px for supporting labels, 14px and up for anything interactive.

## Layout

Centered, max width 1440. The landing page is a single centered hero (88px headline, lede, one Play button) over a live demo board with a status pill and a "Try breaking it" button. The game screen is three columns: a 104px hotbar of parts, the arena (heads-up display row with the run controls on the left and live metric chips on the right, the board, and a footer strip that shows the how-to line or the current alert), and a 300px rail (inspector, objectives or break-it controls, incidents, hints). At 1180px the rail moves under the arena as a wrapping grid; at 760px everything stacks and a note says the board needs a bigger screen.

## Motion and feel

Game feel, in the system's quiet register. Easing tokens: `--out` cubic-bezier(0.16, 1, 0.3, 1) for entrances, `--in` for exits, `--spring` cubic-bezier(0.34, 1.56, 0.64, 1) for anything pressed or placed.

- Press: buttons and parts squash to 0.94–0.95 in 80ms, then spring back.
- Place: parts pop in from 0.55 with a spring; on first load they arrive staggered 55ms apart. Removed parts shrink out in 240ms.
- Wire: new connections draw themselves on (stroke-dashoffset, 560ms).
- Refuse: a wire dropped on a part that cannot accept it shakes the target and the reason line.
- State: status badges pop when health changes; metric chips glide to new values (280ms ease-out) and nudge when they cross a target; objective checks pop green or shake red.
- Chaos: the arena jolts once (480ms) and flashes; a banner drops in at the top of the board.
- Result: the dialog springs up; earned stars spin in one after another with a small burst; a failed run shakes once.
- Feedback: `audio/feedback.ts` fires a short sound and vibration per moment behind the single Sound switch, off by default. Every cue has a visual twin.
- Reduced motion (setting or OS preference) removes all movement and keeps the colour, shape and text feedback.

## Elevation & Depth

Almost flat. Machines carry a soft diffuse shadow that warms to the state colour under load (yellow, orange, pulsing red when failing). Floating surfaces (alert, modal) use frosted white with a large soft shadow. No borders on cards; hairlines only inside lists and tables.

## Shapes

Large radii: 16 tiles, 22 panels, 26 cards and board, 980 pill buttons and chips. Machines are 22px-radius white tiles; icons are drawn on a 20px grid, 2px stroke.

## Components

- **Machine:** white rounded tile, ink line art, a status badge (check circle, triangle, octagon, flame, crossed square), a thin utilization bar along the bottom, a ring in the state colour when not healthy.
- **Buttons:** pill. Primary blue, default light grey, quiet blue text link.
- **Alert (pager):** replaces the how-to line in the strip under the board, so it never covers a part; severity icon, one line, Go to and dismiss. SEV-1 adds a red outline and waits to be dismissed; SEV-2 and SEV-3 step aside after 8 seconds.
- **Heads-up display:** a pill Play/Pause button (blue when idle, ink when running), a restart button, a segmented speed control, a run-progress bar, and white metric chips.
- **Inspector:** part name with a health pill, a load gauge, steppers with round buttons, and settings; an empty state when nothing is selected.
- **Objectives:** a live checklist of the challenge's targets with round check marks.
- **Hotbar:** a narrow column of square white tiles (drawing and name; cost in the tooltip) on the grey surface; drag one onto the board, or click to add it at the next free spot.
- **Board editing:** parts drag freely on a fixed canvas (half-cell snap); a blue handle on a part's right edge drags a wire; valid targets get an accent ring, others dim to 40%.
- **How-to line:** four short inline hints under the board with a blue-dot glyph and keycaps, shown when nothing is selected.
- **Metric tile:** white card, large number, small label; turns soft orange with a warning icon when over target.
- **Stars:** yellow filled star icons when earned.

## Do's and Don'ts

- Do give things room; prefer one clear action per view.
- Do keep every status shape-coded and text at 4.5:1 or better.
- Don't add gradients, hard borders, heavy shadows, emoji, or a second accent colour.
- Don't set a small label above a heading.
