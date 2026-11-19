# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: junior developers and students who can code but have never designed a system at scale. Also interview-preppers (harder challenges, interview mode with a scored rubric) and curious non-engineers. Desktop first, tablets supported, phones only see a note that the board needs a bigger screen. Sessions run about 20 minutes.

## Product Purpose

Severity 1 is a game about system design. Players build a fictional social network, Friendbook, from live infrastructure components and watch real traffic stress and break it. It is a game, not a course: there are no lessons or quizzes. A landing page has one Play button that opens a sandbox with every part unlocked; optional Challenges (11 scenarios and an interview mode) add goals, stars and debriefs. Success: players can explain and sketch why a system breaks and how to fix it, and say it was fun.

## Positioning

The system is something you can see running: requests are particles, machines show load on their bodies, users get angry. A text course or diagram tool cannot show cause and effect as it happens. The prototype (Scale It) was judged "not visual enough: boxes and lines read as a diagram."

## Operating Context

Core loop: build (drag parts onto the board and drag wires between them), run live traffic, break it (chaos buttons, or a challenge's scripted events), diagnose the incident, fix, and in a challenge get a debrief with a replay. Players read incidents, metrics (rps, p50/p95, errors, cost) and the board like an on-call engineer.

## Capabilities and Constraints

- Stack: React 19 + TypeScript strict + Vite, Zustand, SVG board with canvas particles; simulation is a pure seeded engine. No persistence in v1, no backend.
- Every status carries icon and shape as well as colour; request types differ by shape (circle read, square write, diamond photo, triangle upload).
- Accessibility: WCAG 2.1 AA text, keyboard-operable building, reduced-motion mode, adjustable speed, minimum 14px text, nothing flashes over 3 per second.
- Terminology: SEV-1/2/3, SLO, p95, Ship it / Thrifty / Senior engineer stars, Challenges, debrief, sandbox.

## Brand Commitments

- Product is Severity 1; in-game network is Friendbook with an original wordmark. FR-28: original art only, no real company names, logos, UI imitation or brand colours.
- Flat 2D art, not isometric. Calm when healthy, loud on purpose when failing.
- Confirmed by the user (second redesign): the look must be completely modern, minimalist, white and premium, in the spirit of an Apple-style website (space, scale, restraint). Accessibility rules above stay binding. No copying of any company's marks or artwork.
- Must not feel childish or cartoon-mascot.

## Evidence on Hand

PRDs in repo root (product, architecture, design system). Working slice in `app/`. No logo, illustration, audio or photography assets exist; Friendbook's wordmark must be authored. No playtest data yet.

## Product Principles

1. State is visible on the machine itself before it appears in a number.
2. Play first: learning comes from cause and effect on the board, never from a quiz.
3. Never colour alone.
4. Calm by default, loud on purpose.
5. Original and fictional: nothing borrowed from a real company's look.

## Accessibility & Inclusion

WCAG 2.1 AA, colourblind-safe status via shape and icon, reduced-motion mode that swaps particles for line thickness and dash speed, 200% text scaling, keyboard-only play.
