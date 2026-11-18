---
name: Severity 1
description: A system-design game printed in two inks, where load shows as a machine slipping out of register.
colors:
  paper: "#E6EAF6"
  panel: "#F6F7FC"
  card: "#FFFFFF"
  hairline: "#C3CAE3"
  line-strong: "#4A5798"
  ink: "#14215C"
  ink-soft: "#3E4A7E"
  shell: "#2748C9"
  shell-deep: "#1B3499"
  on-shell: "#F6F7FC"
  ok: "#1DA463"
  warn: "#FFC72C"
  danger: "#FF5B2E"
  critical: "#E5243B"
  ok-text: "#0B6B3C"
  warn-text: "#7A5A00"
  danger-text: "#B33A12"
  critical-text: "#B3122A"
  calm-tint: "#CAD3F5"
  warn-tint: "#FFE9A8"
  danger-tint: "#FFC9B8"
  critical-tint: "#FFB8C0"
  req-read: "#2748C9"
  req-write: "#7A3FC4"
  req-photo: "#F0399A"
  req-upload: "#00A19B"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "1.25rem"
    fontWeight: 600
rounded:
  sm: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.on-shell}"
    rounded: "{rounded.sm}"
    padding: "4px 14px"
  button-primary-hover:
    backgroundColor: "{colors.shell-deep}"
  button-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 14px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  metric-tile-alert:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: Severity 1

## Overview

Severity 1 looks like a two-ink print job. Every machine on the board is a keyline plate (ink-blue outline and detail) with a colour plate behind it. When the machine is healthy the plates are in perfect register. As utilization climbs the colour plate slides up and to the right; past capacity it is fully out of register and hatched with halftone dots. A player reads which machine is failing from its body, then reads the number. The wordmark carries the same idea: the "1" is printed twice, yellow and orange, slightly misaligned.

The shell is calm and committed: a riso-blue top band, cool pale paper, white working panels with 1.5px ink hairlines, no shadows. Spot inks are used flat. No mascots, no gradients except a very faint paper drift on the page.

## Colors

- **Paper and panels:** `paper` ground, `panel` and `card` for work areas. Text is `ink`, never black; supporting text `ink-soft`.
- **Shell:** `shell` is the single committed colour field (top bar, primary buttons, selection). Focus rings are 3px `ink` (white on the shell band).
- **Spot inks (status):** green ok, yellow strained, orange overloaded, red failing. Always paired with a badge shape (check circle, triangle, octagon, flame, crossed square). As text on paper use the `*-text` variants.
- **Request types:** read blue circle, write violet square, photo pink diamond, upload teal triangle, each with a 1px ink keyline.
- Never use colour alone: every status also has an icon, and load also moves the plate.

## Typography

Bricolage Grotesque for headings and the wordmark, Hanken Grotesk for body, JetBrains Mono only for numbers, ticks and units. Minimum text size 14px. Headings use balanced wrapping; no label sits above a heading.

## Layout

Operate shell: top bar; level screen is three columns (224px toolbox, flexible board, 316px side rail) collapsing to one column at 1100px with the toolbox as a wrapped row. Board ground is a dot matrix on a 48px cell with registration crosshairs in each corner. Spacing scale 4, 8, 16, 24.

## Elevation & Depth

Flat. Depth comes from the print metaphor only: an offset colour plate behind the pager alert, and the machine plates themselves. No drop shadows.

## Shapes

4px corners everywhere, 1.5px ink hairlines, 2.5px keylines on machines. Icons are drawn on a 20px grid with a 2px square-cap stroke.

## Components

- **Machine:** keyline rect + colour plate (tint by health) offset by `drift` (0 at 55% utilization to full at failure) + halftone overlay when overloaded or failing + badge + label with mono utilization.
- **Pager:** white card, ink border, colour plate offset behind in the severity colour.
- **Buttons:** ink-bordered rects; primary fills with `shell`; quiet is an underlined link.
- **Metric tile:** white; turns `danger-tint` with a warning icon when over target.
- **Stars:** drawn star icons, yellow-filled when earned.

## Do's and Don'ts

- Do express load by plate drift and halftone before any number.
- Do keep every status shape-coded and every text at 4.5:1 or better.
- Don't add drop shadows, gradients, mascots, emoji or Unicode glyph icons.
- Don't put a kicker label above a heading, or use mono as decoration.
- Don't introduce a colour outside the spot-ink set.
