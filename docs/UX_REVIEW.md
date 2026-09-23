# UX review

This review records user-experience findings and the evidence used to prioritize product
work. It does not track delivery status or prescribe implementation details; those belong in
[`PRODUCT_PLAN.md`](PRODUCT_PLAN.md) and [`CLAUDE.md`](../CLAUDE.md), respectively.

## Review principles

- The complete create → edit → preview → export journey matters more than breadth of Phaser
  API coverage.
- Mobile is a first-class target. Primary tasks must remain usable with touch at 390 px wide.
- Modes and selection state must be visible, reversible, and recoverable without knowing a
  keyboard shortcut.
- Validation and failures should explain what the user can do next, especially around assets,
  references, preview, and export.
- Advanced controls should not obscure the common path; use progressive disclosure and clear
  defaults.

## Findings to carry into planning

1. **Protect the core workflow.** Data loss, broken output, and controls that cannot be used
   on touch are blockers rather than polish.
2. **Make editor state legible.** Selection, active modes, snapping, preview state, and
   disabled actions need direct visual feedback and an obvious exit path.
3. **Improve recovery and diagnostics.** Missing assets, invalid references, unsupported
   imports, and preview/export failures should be actionable instead of silent.
4. **Keep dense panels navigable.** Preserve useful defaults, grouping, and progressive
   disclosure as object types gain more properties; do not solve discoverability by placing
   every option at the same visual level.
5. **Test the user journey at both viewport classes.** Desktop-only success is insufficient
   for primary creation, manipulation, preview, save/open, and export flows.

These findings intentionally do not assign release dates or implementation approaches. The
product plan converts them into priorities; contributor guidance explains the constraints of
implementing them.
