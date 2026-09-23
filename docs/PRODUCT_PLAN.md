# Product plan

This document is the source of truth for product priorities and delivery status. Contributor
architecture and implementation constraints live in [`CLAUDE.md`](../CLAUDE.md); UX findings
and supporting evidence live in [`UX_REVIEW.md`](UX_REVIEW.md).

## Product direction

Phaser GUI Tool is a client-side visual editor that helps people compose Phaser scenes and
export code they can own. The product should remain useful on a 390 px-wide touch screen,
keep saved projects portable JSON, and make the exported result testable without requiring a
backend or account.

## Current status

The foundation and the editor's main authoring loop are shipped: shapes and text, image and
font assets, selection and multi-selection, containers, alignment and snapping, guides,
animations, prefabs, multiple scenes, tilemaps, particles, physics, audio, cameras, advanced
image rendering, behaviours and rules, previewing the generated game, effects, blend modes,
masks, parallax/pinning, and round physics bodies.

The detailed user-facing inventory remains in the [README](../README.md). “Shipped” here
means available in the editor and exporter; it does not mean every Phaser option or every UX
refinement for that capability is complete.

## Priorities

Priorities should be selected from the UX review rather than from whichever Phaser API is
still uncovered. Use this order when planning work:

1. **Remove blockers in the core create → edit → preview → export journey.** Treat data loss,
   unusable mobile interactions, inaccessible primary controls, and output that cannot run as
   release blockers.
2. **Improve discoverability and feedback.** Prefer clearer modes, labels, empty states,
   validation, and recovery over adding another advanced property to an existing feature.
3. **Close coherent capability gaps.** Add a missing workflow only when the document,
   editor, asset/reference lifecycle, preview, export, and tests can describe it end to end.
4. **Expand advanced Phaser coverage.** Additional filters, particle controls, rule actions,
   and import formats follow the core workflow work unless they unblock a concrete project.

Record each selected initiative below with an owner or issue link, acceptance criteria, and
one of the defined statuses. Do not use `CLAUDE.md` as a parallel queue.

## Planned work

No initiative is committed until it has been selected from the UX review and given acceptance
criteria. Candidate areas already exposed by the product are:

- core-workflow usability and mobile/touch polish;
- accessibility, discoverability, validation, and error recovery;
- import/export confidence and preview diagnostics;
- carefully scoped additions to rules, effects, particles, tilemaps, prefabs, and geometry
  tools.

These are candidate areas, not a delivery order. Implementation complexity and architectural
constraints are documented in `CLAUDE.md` and should inform scoping after product priority is
established.

## Status definitions

- **Proposed** — supported by a UX finding, but not yet scoped or committed.
- **Planned** — has acceptance criteria and is selected for an upcoming iteration.
- **In progress** — implementation is active.
- **Shipped** — merged, documented where user-facing, and covered by the required checks.
- **Deferred** — intentionally postponed with the product reason recorded here.

When a capability ships, update its entry rather than appending a second historical roadmap.
Implementation lessons that contributors must continue to observe belong in `CLAUDE.md`.
