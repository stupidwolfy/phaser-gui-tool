# Product plan

This backlog turns the findings and recommendations in the
[UX review](./UX_REVIEW.md) into sequenced, testable product work. The review remains the
source for the usability evidence and rationale; this document defines delivery order and
the conditions for calling each initiative complete.

## How to read this plan

- **Priority** describes order within and across phases: **P0** is required groundwork,
  **P1** is the next highest-value work, and **P2** follows once the earlier workflows are
  sound.
- **Status** records the current delivery state. **Implemented** means every acceptance
  criterion and required validation has evidence; **In progress** may include shipped code
  but still has unmet criteria or validation; **Deferred** records an explicit product
  decision not to pursue the initiative in the current plan.
- Checkboxes appear only beside concrete deliverables. Problems, dependencies, and
  validation notes are intentionally not checklists.
- “Automated validation” means a repeatable CI-suitable check. “Manual validation” means a
  scripted human evaluation with an observable result, not a general request to “check the
  UX.”

## Phase 1 — Make the editor understandable and safe

Phase 1 addresses first-run comprehension, clarifies the editor's two preview modes, makes
navigation and selection easier to understand, and establishes validation and accessibility
standards before larger workflows are added.

### 1. Guided onboarding and starter project

**Priority:** P0
**Status:** Deferred (out of scope)

**Status note (2026-09-24).** Product decision: skip guided onboarding. No deliverable or
acceptance checkbox below is claimed; the scope is retained as a record of what was deferred.

**User problem.** A first-time user lands in a feature-dense editor without a clear first
task, an explanation of the three-panel model, or confidence that experimenting will not
damage a project.

**Proposed scope.**

- [ ] Add a dismissible first-run tour that points to the scene tree, canvas, inspector,
  Save, and Play.
- [ ] Offer an annotated starter project and a blank-project path without blocking the
  editor.
- [ ] Persist tour completion locally and provide a way to restart it from Help.
- [ ] Add concise empty states that lead to the first object, imported asset, and rule.

**Relevant modules.** `src/App.tsx`, `src/ui/Layout.tsx`, `src/ui/Toolbar.tsx`,
`src/ui/SceneTree.tsx`, `src/ui/Inspector.tsx`, `src/io/prefs.ts`, and
`src/core/defaults.ts`.

**Dependencies.** The Help entry point below; accessible focus management and reduced-motion
behavior from the accessibility initiative; stable test selectors for tour targets.

**Acceptance criteria.**

- [ ] A new browser profile can choose Blank or Starter and complete a create-select-edit-
  play-save path from the tour.
- [ ] Dismissing or completing the tour prevents automatic reappearance, while Help can
  relaunch it.
- [ ] The tour never traps users, changes document data, or obscures the highlighted control
  at supported desktop and mobile breakpoints.

**Required validation.** Automated: Playwright coverage for first-run, dismiss, persistence,
restart, keyboard traversal, and both layout breakpoints; unit coverage for preference
migration. Manual: run the tour at desktop and phone widths with keyboard only, touch, 200%
zoom, reduced motion, and a screen reader; have at least three unfamiliar users complete the
script without coaching and record where they stall.

### 2. Help and contextual guidance

**Priority:** P0
**Status:** Proposed

**User problem.** Labels and tooltips explain individual controls, but users cannot easily
discover concepts, shortcuts, file behavior, or the distinction between editing and running
a game when they need that information.

**Proposed scope.**

- [ ] Add a persistent Help entry in desktop and compact layouts with searchable task-based
  topics, keyboard shortcuts, file/privacy behavior, and a link to full documentation.
- [ ] Add context links from complex inspector sections and validation messages to the
  matching Help topic.
- [ ] Include version, Phaser target version, and feedback links in Help.

**Relevant modules.** `src/ui/Toolbar.tsx`, `src/ui/Layout.tsx`, `src/ui/Inspector.tsx`,
`src/ui/Section.tsx`, `src/core/schema.ts`, and `README.md`.

**Dependencies.** Agreed product terminology; accessible dialog or sheet primitive.

**Acceptance criteria.**

- [ ] Help is reachable in one action at all supported widths and can be operated and closed
  entirely by keyboard.
- [ ] Searching a task term such as “save,” “physics,” or “animation” returns an actionable
  topic and preserves the user's editor context.
- [ ] Help content and visible keyboard shortcuts agree with implemented commands.

**Required validation.** Automated: component/search-index tests plus Playwright tests for
open, search, context-link navigation, focus return, Escape, and compact layout. Manual:
screen-reader heading/link audit and a content review against `README.md` and the current
keyboard handlers.

### 3. Play and Preview terminology

**Priority:** P0
**Status:** In progress

**Status note (2026-09-24).** The runtime terminology and behavior are implemented and covered
by `tests/play.spec.ts` in desktop and mobile projects, including labels, distinct toggle/action
states, keyboard activation, Stop/Restart, and byte-for-byte document preservation. The required
five-task manual terminology comprehension review has not been recorded, so this initiative is
not yet Implemented.

**User problem.** The motion preview toggle and full game Play action use similar visual
language even though one previews passive animation on the canvas and the other runs the
exported game in an isolated overlay.

**Proposed scope.**

- [x] Rename and visually distinguish **Preview motion** from **Play game** everywhere.
- [x] Add short state text and accessible names that explain what runs and whether project
  data can change.
- [x] Ensure Stop and Restart are unmistakable inside the running-game surface.
- [ ] Update Help, onboarding, and export language to use the same terms.

**Relevant modules.** `src/ui/Toolbar.tsx`, `src/ui/PlayOverlay.tsx`,
`src/editor/Viewport.tsx`, `src/core/store.ts`, and `tests/play.spec.ts`.

**Dependencies.** Final terminology and icon choices; Help topic structure.

**Acceptance criteria.**

- [x] Every motion-preview control is named “Preview motion,” and every full runtime launch
  is named “Play game,” including accessible names and tooltips.
- [x] Entering and leaving either mode restores the exact authored document state.
- [x] Only controls relevant to the active mode are presented as active, and Play cannot be
  mistaken for an on/off editor toggle.

**Required validation.** Automated: extend Playwright coverage for labels, pressed states,
focus, Stop/Restart, and document-state equality before and after both modes. Manual: run a
five-task terminology comprehension test on desktop and mobile, including one project with
tweens, particles, rules, and physics.

### 4. Explicit zoom controls

**Priority:** P1
**Status:** Proposed

**User problem.** Pan, wheel, and pinch gestures are not self-evident, and Fit alone does not
show the current zoom or provide predictable incremental control.

**Proposed scope.**

- [ ] Add Zoom out, current percentage, Zoom in, and Fit controls near the viewport.
- [ ] Define bounded zoom steps and add documented keyboard shortcuts.
- [ ] Keep wheel/pinch behavior and synchronize every input with the displayed percentage.
- [ ] Preserve the point of interest where practical and expose Reset to 100%.

**Relevant modules.** `src/editor/Viewport.tsx`, `src/editor/phaser/EditorScene.ts`,
`src/ui/Toolbar.tsx`, `src/ui/Layout.tsx`, and `src/styles/app.css`.

**Dependencies.** A single camera/zoom command API and compact-layout placement; accessibility
rules for touch-target size and names.

**Acceptance criteria.**

- [ ] Users can reach minimum, maximum, 100%, and Fit without a precision gesture.
- [ ] The percentage always matches the editor camera and is announced meaningfully to
  assistive technology.
- [ ] Zoom controls do not change the project's game-camera settings or authored data.

**Required validation.** Automated: unit tests for clamping/steps and Playwright tests for
buttons, shortcuts, Fit, percentage synchronization, resize, and separation from game-camera
zoom. Manual: mouse, trackpad, touch, keyboard, 200% browser zoom, and small-screen checks.

### 5. Inspector summaries and progressive disclosure

**Priority:** P1
**Status:** Proposed

**User problem.** Collapsed inspector sections hide whether a feature is configured, forcing
users to open many sections to understand an object or scene.

**Proposed scope.**

- [ ] Show concise, read-only summaries on collapsed sections (for example, physics mode,
  image/frame, active effects, tween destination, and rule count).
- [ ] Give incomplete or invalid configuration a consistent warning summary and direct path
  to the field.
- [ ] Provide a useful multi-selection summary without pretending conflicting values agree.
- [ ] Preserve section expansion preferences and avoid shifting controls while values edit.

**Relevant modules.** `src/ui/Inspector.tsx`, `src/ui/Section.tsx`,
`src/ui/fields.tsx`, `src/core/schema.ts`, and `src/core/store.ts`.

**Dependencies.** Shared validation result model; content and truncation rules; accessible
status treatment.

**Acceptance criteria.**

- [ ] Every configurable inspector section communicates empty/default, configured, mixed,
  and invalid states without requiring expansion.
- [ ] Selecting a warning focuses or reveals its responsible field.
- [ ] Summaries update immediately after undo, redo, selection change, and field edit.

**Required validation.** Automated: summary formatter unit tests and Playwright coverage for
single/multi-selection, errors, undo/redo, persistence, and overflow. Manual: scan five
representative objects with all sections collapsed at desktop and phone widths, using color-
vision simulation and a screen reader.

### 6. Validation foundation

**Priority:** P0
**Status:** In progress

**Status note (2026-09-24).** `src/core/validation.ts`, `src/core/store.ts`,
`src/ui/IssueSummary.tsx`, and `tests/validation.spec.ts` provide the shared issue model,
Play/export gates, warning behavior, schema protection, and scene/object navigation. Validation
does not currently run after every edit or on every load, and issue navigation records a field
path but no inspector control consumes it to focus the smallest editable target. The full issue
matrix, integration coverage, and manual fixture/responsiveness review also remain outstanding.

**User problem.** Invalid references and incomplete configuration can surface late during
Play or export, while feedback is distributed across controls and lacks a consistent severity
or recovery path.

**Proposed scope.**

- [x] Define structured validation issues with stable code, severity, message, object/scene
  location, field path, and export-blocking flag.
- [ ] Validate project load, edits, Play, and export through shared pure validators.
- [ ] Add an issue summary with navigation to the affected scene, tree item, and inspector
  field.
- [ ] Distinguish blocking errors from warnings and never silently discard valid document
  data during repair or migration.

**Relevant modules.** `src/core/schema.ts`, `src/core/store.ts`,
`src/ui/Inspector.tsx`, `src/ui/SceneTree.tsx`, `src/ui/PlayOverlay.tsx`,
`src/io/fileIO.ts`, and `src/io/exportPhaser.ts`.

**Dependencies.** Stable IDs and field paths in the schema; decisions on warning versus error
policy; Help context links.

**Acceptance criteria.**

- [x] The same invalid project produces the same issue codes before Play and every export
  format.
- [ ] Each blocking issue explains how to recover and navigates to the smallest editable
  target.
- [x] Valid projects generate no issues, and warnings do not block saving or export.
- [x] Unknown/newer schema versions remain protected from destructive saves.

**Required validation.** Automated: table-driven validator tests for missing assets,
references, duplicate/unsafe names, malformed values, and schema versions; integration tests
for load, navigation, Play, and TS/JS/HTML export gating. Manual: inject a fixture for every
issue type, verify wording/focus/recovery, and confirm large-project validation remains
responsive.

### 7. Accessibility baseline

**Priority:** P0
**Status:** In progress

**Status note (2026-09-24).** Foundational accessible names, visible focus, compact-sheet and
Play-dialog focus handling, keyboard tree selection, non-color selection state, touch sizing,
and reduced-motion behavior are covered in part by `tests/accessibility.spec.ts`. There is no
automated axe-equivalent scan or complete keyboard-path coverage, and the required keyboard,
screen-reader, 200%/400% zoom, forced-colors, contrast, reduced-motion, and touch audit has not
been recorded. Accessibility therefore remains In progress.

**User problem.** Icon-only actions, dense panels, canvas interaction, and modal mobile sheets
can exclude keyboard, screen-reader, low-vision, and motor-impaired users.

**Proposed scope.**

- [ ] Publish keyboard interaction and focus-order rules for toolbar, tree, inspector, sheets,
  dialogs, and Play.
- [ ] Give every interactive control an accessible name, visible focus, sufficient target
  size, and non-color state indicator.
- [ ] Implement tree semantics and keyboard selection/reordering without removing pointer
  behavior.
- [ ] Add announcements for selection, mode changes, validation, saves, and destructive
  actions; honor reduced motion and high contrast.
- [ ] Add automated accessibility checks to the representative Playwright flows.

**Relevant modules.** `src/ui/Toolbar.tsx`, `src/ui/SceneTree.tsx`,
`src/ui/Inspector.tsx`, `src/ui/Layout.tsx`, `src/ui/Sheet.tsx`,
`src/editor/Viewport.tsx`, and `src/styles/app.css`.

**Dependencies.** Shared dialog/sheet and status-announcement patterns; terminology; browser
and assistive-technology support matrix.

**Acceptance criteria.**

- [ ] Core create, select, edit, reorder, save, validate, and Play/Stop journeys are keyboard
  operable with no focus trap or inaccessible pointer-only action.
- [ ] Representative screens have no serious or critical automated accessibility violations.
- [ ] State, errors, focus, and selected tree nodes remain understandable without color or
  animation.

**Required validation.** Automated: axe (or equivalent) scans at desktop/mobile widths plus
Playwright keyboard-path and focus-restoration tests. Manual: WCAG 2.2 AA review of core
flows using keyboard only, 200%/400% zoom, forced colors, reduced motion, VoiceOver/Safari,
and NVDA/Firefox or documented equivalents.

## Phase 2 — Scale from a scene mock-up to a project

Phase 2 improves management of growing asset libraries and hierarchies, moves runtime-wide
choices into explicit project settings, and makes reusable input and distributable output
first-class.

### 8. Asset workspace

**Priority:** P1
**Status:** Proposed

**User problem.** Images, atlases, fonts, audio, and their usages are managed in separate
contextual controls, making larger libraries hard to search, audit, rename, replace, or clean
up safely.

**Proposed scope.**

- [ ] Add a unified asset workspace with type filters, search, preview, metadata, and usage
  count.
- [ ] Support import, rename, replace, and safe delete with an impact preview.
- [ ] Surface sprite-sheet/atlas slicing, audio preview, and font preview from the selected
  asset.
- [ ] Detect duplicate names and optionally identify byte-identical imports.

**Relevant modules.** `src/core/assets.ts`, `src/core/atlas.ts`, `src/core/audio.ts`,
`src/core/fonts.ts`, `src/ui/AssetPicker.tsx`, `src/ui/AudioPicker.tsx`,
`src/ui/FontPicker.tsx`, `src/ui/Inspector.tsx`, and `src/core/schema.ts`.

**Dependencies.** Validation issue model; scalable workspace layout; reference graph across
nodes, animations, masks, tilemaps, audio, and prefabs.

**Acceptance criteria.**

- [ ] Search and filters cover every supported asset type and remain usable with 500 assets.
- [ ] Replace preserves references; delete lists all usages and cannot leave an unreported
  dangling reference.
- [ ] Asset mutations participate in undo/redo and survive save/open without changing bytes
  or metadata unexpectedly.

**Required validation.** Automated: reference-graph and serialization tests; Playwright flows
for each asset type, duplicate names, replace/delete, undo/redo, and a 500-asset fixture.
Manual: keyboard/screen-reader audit, visual preview checks, large-file responsiveness, and a
round trip through Play and all export formats.

### 9. Scalable hierarchy navigation

**Priority:** P1
**Status:** Proposed

**User problem.** Deep groups, many objects, multiple selections, and drag reordering make the
scene tree increasingly difficult to scan and manipulate accurately.

**Proposed scope.**

- [ ] Add tree search/filter, expand/collapse all, ancestor context, and reveal-selection.
- [ ] Improve multi-select, range-select, drop targets, keyboard reordering, and parent
  changes with explicit feedback.
- [ ] Virtualize long trees while preserving selection, expansion, and accessible position
  information.
- [ ] Make locked/hidden/type/invalid states scannable and non-color-dependent.

**Relevant modules.** `src/ui/SceneTree.tsx`, `src/core/store.ts`,
`src/core/schema.ts`, `src/ui/Inspector.tsx`, and `src/styles/app.css`.

**Dependencies.** Accessibility tree pattern; validation navigation; stable ordering and
parenting commands.

**Acceptance criteria.**

- [ ] A user can locate and reveal a named item in a 1,000-node nested fixture without
  manually expanding every ancestor.
- [ ] Pointer and keyboard moves use identical legality checks and cannot create cycles or
  unexpectedly alter world position.
- [ ] Filtering never mutates the document, loses selection, or makes matches ambiguous about
  ancestry.

**Required validation.** Automated: hierarchy command/property tests plus Playwright coverage
for filter, virtualization, reveal, multi/range selection, drag, keyboard reorder, and undo.
Manual: performance profiling on the 1,000-node fixture and tree operation review with
keyboard, screen reader, mouse, and touch.

### 10. Project settings

**Priority:** P1
**Status:** Proposed

**User problem.** Project-wide runtime and export assumptions are implicit or distributed
across scene controls, so users cannot clearly define the game they intend to ship.

**Proposed scope.**

- [ ] Add a Project settings surface for title, logical viewport, scale/resizing policy,
  background/defaults, start scene, renderer, physics defaults, and export identifiers.
- [ ] Separate editor preferences from saved project settings and per-scene settings.
- [ ] Define migrations and defaults so older files keep current behavior.
- [ ] Feed one normalized settings model into Play and every exporter.

**Relevant modules.** `src/core/schema.ts`, `src/core/defaults.ts`,
`src/core/store.ts`, `src/ui/Inspector.tsx`, `src/App.tsx`,
`src/ui/PlayOverlay.tsx`, and `src/io/exportPhaser.ts`.

**Dependencies.** Validation foundation; product decisions for scaling and renderer support;
schema version/migration policy.

**Acceptance criteria.**

- [ ] New and migrated projects have explicit valid settings and preserve prior runtime
  behavior.
- [ ] Play, TypeScript, JavaScript, and HTML outputs agree on start scene, dimensions,
  scaling, renderer, background, and physics configuration.
- [ ] Invalid identifiers or incompatible combinations are explained before export.

**Required validation.** Automated: schema migration/default tests, exporter snapshots or
semantic assertions, and Playwright settings-to-Play/export flows. Manual: open older fixture
versions, compare Play with all outputs at common viewport sizes, and verify mobile rotation
and resize behavior.

### 11. Named input actions

**Priority:** P1
**Status:** Proposed

**User problem.** Rules tied directly to raw keys or controls are difficult to reuse, remap,
localize, and extend consistently to touch or gamepads.

**Proposed scope.**

- [ ] Add project-level named actions with unique IDs, editable names, and keyboard/touch
  bindings.
- [ ] Let rules refer to actions rather than physical keys while migrating existing key
  rules without behavior loss.
- [ ] Detect conflicts and reserve editor shortcuts only while editing, not while playing.
- [ ] Generate a stable input setup/API in exported projects, with gamepad bindings treated
  as follow-up unless browser support is validated.

**Relevant modules.** `src/core/schema.ts`, `src/core/store.ts`,
`src/ui/Inspector.tsx`, `src/ui/PlayOverlay.tsx`, and `src/io/exportPhaser.ts`.

**Dependencies.** Project settings surface; validation/reference model; input naming and
conflict policy.

**Acceptance criteria.**

- [ ] Renaming an action does not break rules because references use stable IDs.
- [ ] Existing key-based projects migrate to equivalent named actions and behave identically
  in Play and export.
- [ ] Keyboard and touch bindings for the same action trigger the same rule semantics, and
  conflicts are visible before Play.

**Required validation.** Automated: migration, reference-integrity, conflict, generated-code,
and Playwright keyboard/touch tests. Manual: remap a representative game, verify focus/input
behavior on desktop and mobile, and compare Play with an exported bundle.

### 12. Export bundles

**Priority:** P1
**Status:** Proposed

**User problem.** Individual source or HTML exports do not provide an obvious, structured
handoff for continued development, deployment, or sharing with all assets and configuration
accounted for.

**Proposed scope.**

- [ ] Add a downloadable project bundle with source, assets, configuration, entry point,
  dependency metadata, and a short generated README.
- [ ] Offer readable external asset files rather than data URLs where the format allows it.
- [ ] Provide bundle naming, language, and minified/development choices with safe defaults.
- [ ] Show a preflight summary of warnings, contents, estimated size, and unsupported
  features before download.

**Relevant modules.** `src/io/exportPhaser.ts`, `src/core/schema.ts`,
`src/ui/Toolbar.tsx`, `src/ui/PlayOverlay.tsx`, and `src/App.tsx`.

**Dependencies.** Project settings and validation foundation; archive generation strategy;
stable asset filenames and collision policy; named input export contract.

**Acceptance criteria.**

- [ ] A bundle extracted into an empty directory installs, builds, and runs using only its
  documented commands.
- [ ] Every referenced asset is present exactly once at a deterministic safe path, and no
  unreferenced embedded data is required.
- [ ] The bundle's initial scene and runtime behavior match Play for the acceptance fixture.

**Required validation.** Automated: deterministic archive manifest tests, path/name security
tests, extract-install-build smoke test, and runtime assertions against representative
features. Manual: inspect and run TS and JS bundles on supported browsers, deploy the static
result to a clean host, and verify preflight messaging with a warning-heavy project.

## Phase 3 — Express richer game systems visually

Phase 3 builds on stable project configuration, validation, reusable input, and bundling.
These capabilities intentionally follow the workflow foundations because each expands the
schema and generated-code surface substantially.

### 13. Custom-code hooks

**Priority:** P2
**Status:** Proposed

**User problem.** Users outgrow visual rules but lack stable extension points, so manual edits
to generated output are fragile and are overwritten on the next export.

**Proposed scope.**

- [ ] Define named lifecycle and rule-action hooks with typed context and stable generated
  call sites.
- [ ] Let projects declare hook signatures/references without executing arbitrary authored
  code inside the editor.
- [ ] Export user-owned hook files that regeneration preserves or clearly separates from
  generated files.
- [ ] Diagnose missing, duplicate, or invalid hooks during validation and bundle preflight.

**Relevant modules.** `src/core/schema.ts`, `src/ui/Inspector.tsx`,
`src/core/store.ts`, `src/io/exportPhaser.ts`, and `src/ui/PlayOverlay.tsx`.

**Dependencies.** Export bundles, validation foundation, stable generated API, and an explicit
security/content-security policy for Play.

**Acceptance criteria.**

- [ ] Every supported hook has documented timing, arguments, return behavior, and error
  behavior.
- [ ] Re-export never overwrites user-owned code, and missing hook implementations fail with
  an actionable message rather than silently doing nothing.
- [ ] Projects without hooks produce equivalent output to the pre-hook exporter.

**Required validation.** Automated: generated-code typechecks, preservation/regeneration,
hook ordering, missing-hook, escaping, and CSP/security tests. Manual: implement one lifecycle
and one rule hook in an exported bundle, re-export after editor changes, and verify source maps
and runtime error reporting.

### 14. Reusable behaviors

**Priority:** P2
**Status:** Proposed

**User problem.** Repeating the same rule, tween, physics, or input setup across objects is
laborious and causes copies to drift apart.

**Proposed scope.**

- [ ] Add a project behavior library with named, parameterized definitions and usage counts.
- [ ] Attach ordered behavior instances to compatible objects and prefabs.
- [ ] Support edit-once propagation, detach/copy, rename, and safe deletion with an impact
  preview.
- [ ] Generate deterministic behavior setup while detecting incompatible or circular
  composition.

**Relevant modules.** `src/core/schema.ts`, `src/core/store.ts`,
`src/ui/Inspector.tsx`, `src/ui/SceneTree.tsx`, and `src/io/exportPhaser.ts`.

**Dependencies.** Named input actions, validation/reference graph, custom-code hook contract,
and prefab interaction rules.

**Acceptance criteria.**

- [ ] Editing a behavior updates every attached instance without overwriting instance
  parameters.
- [ ] Detach produces an equivalent independent configuration; deleting a used behavior
  requires an explicit resolution.
- [ ] Play and exports execute multiple behaviors in documented order with matching results.

**Required validation.** Automated: schema/reference, parameter override, cycle, detach,
undo/redo, serialization, and generated-runtime tests. Manual: author and revise a shared
movement behavior across plain objects and prefab instances, then compare Play and bundle
output.

### 15. Responsive constraints

**Priority:** P2
**Status:** Proposed

**User problem.** Fixed positions and sizes make UI and scenes brittle across aspect ratios,
safe areas, and dynamic viewport sizes.

**Proposed scope.**

- [ ] Add parent-relative anchors, edge/center constraints, margins, percentage sizing, and
  minimum/maximum bounds.
- [ ] Visualize constraints on the canvas and preview a defined set of viewport presets.
- [ ] Specify deterministic conflict resolution and interactions with transforms, groups,
  prefabs, camera scroll factors, and nine-slices.
- [ ] Export resize handling that matches the editor preview.

**Relevant modules.** `src/core/schema.ts`, `src/core/bounds.ts`,
`src/core/store.ts`, `src/editor/Viewport.tsx`, `src/editor/phaser/EditorScene.ts`,
`src/ui/Inspector.tsx`, and `src/io/exportPhaser.ts`.

**Dependencies.** Project logical viewport/scale settings; validation foundation; shared
layout solver usable by editor and generated runtime.

**Acceptance criteria.**

- [ ] Constraint results are deterministic across supported viewport presets and do not
  mutate authored base values merely by previewing.
- [ ] Conflicts and unsatisfiable minimum/maximum combinations are identified before export.
- [ ] Editor preview and exported runtime agree within one device pixel for acceptance
  fixtures.

**Required validation.** Automated: solver unit/property tests, serialization/migration,
visual regression at aspect-ratio presets, and editor/export geometry comparisons. Manual:
resize/rotate desktop and mobile viewports, inspect nested/prefab layouts, and test safe-area
insets and long localized text.

### 16. Polygon physics bodies and paths

**Priority:** P2
**Status:** Proposed

**User problem.** Box and circle bodies cannot closely represent irregular objects, and users
cannot author reusable curves for motion or other path-based behavior.

**Proposed scope.**

- [ ] Add canvas editing for polygon physics vertices with snapping, numeric editing, and a
  reset/auto-outline path.
- [ ] Validate winding, duplicates, self-intersection, minimum area, and physics-engine limits.
- [ ] Add named line/Bezier path resources with direct manipulation, ordering, duplication,
  and deletion.
- [ ] Allow supported movement/behavior tools to reference paths and export both paths and
  polygon bodies deterministically.

**Relevant modules.** `src/core/schema.ts`, `src/core/bounds.ts`,
`src/core/store.ts`, `src/editor/Viewport.tsx`, `src/editor/phaser/EditorScene.ts`,
`src/ui/Inspector.tsx`, and `src/io/exportPhaser.ts`.

**Dependencies.** Validation issue model; coordinate/transform utilities; reusable behaviors;
schema migration; confirmed Phaser/Matter constraints.

**Acceptance criteria.**

- [ ] Vertex and control-point editing supports pointer, keyboard, undo/redo, nested
  transforms, and exact numeric entry.
- [ ] Invalid polygons/paths are visibly diagnosed and cannot produce malformed runtime code.
- [ ] Supported polygon collision and path traversal match between Play and export.

**Required validation.** Automated: geometry/property tests, transform round trips, malformed
fixture validation, undo/redo, serialization, exporter assertions, and runtime collision/path
tests. Manual: trace simple concave art, edit a nested rotated object, author a Bezier path on
touch and keyboard, and compare debug overlays in Play and bundle output.

### 17. Richer animation tooling

**Priority:** P2
**Status:** Proposed

**User problem.** Frame-range text and basic clip settings are efficient for simple loops but
make long sequences, timing variation, event placement, reuse, and iteration difficult.

**Proposed scope.**

- [ ] Add a visual frame timeline with thumbnail reordering, multi-select, per-frame duration,
  duplication, and range operations.
- [ ] Add playback speed, repeat/yoyo/delay controls, onion-skin or adjacent-frame context,
  and a scrubber independent of full game Play.
- [ ] Add named animation events that rules, behaviors, or custom-code hooks can consume.
- [ ] Provide missing-frame diagnostics and preserve a compact text-entry path for expert
  users.

**Relevant modules.** `src/ui/AnimationEditor.tsx`, `src/core/schema.ts`,
`src/core/store.ts`, `src/editor/phaser/EditorScene.ts`, `src/ui/Inspector.tsx`,
and `src/io/exportPhaser.ts`.

**Dependencies.** Asset workspace, Preview motion terminology, validation foundation, and
event contracts for rules/behaviors/hooks.

**Acceptance criteria.**

- [ ] Timeline and text representations round-trip without losing frame order, repetition,
  or timing.
- [ ] Scrubbing is deterministic and never modifies project state beyond explicit edits.
- [ ] Animation timing and named event order match in editor preview, Play, and exports.
- [ ] Missing or replaced frames remain diagnosable and recoverable rather than being
  silently removed.

**Required validation.** Automated: parser/timeline round-trip, timing/event, undo/redo,
missing-frame, large-clip performance, generated-code, and cross-mode runtime tests. Manual:
edit short and 500-frame clips using mouse, keyboard, and touch; test reduced motion; compare
event timing in Preview motion, Play game, and an exported bundle.

## Cross-phase release gates

These gates apply to every initiative; they are deliverables only when a release candidate is
being evaluated.

- [ ] User-visible terms and behavior are documented in Help and, where appropriate,
  `README.md`.
- [ ] New schema data has defaults, parsing/repair behavior, backward-compatibility analysis,
  and save/open round-trip coverage.
- [ ] New commands support undo/redo and do not mutate a document during preview-only actions.
- [ ] Play and all supported export formats produce equivalent behavior for the initiative's
  acceptance fixture.
- [ ] Automated checks pass, and the initiative's named manual validation script has a dated
  result attached to the release record.
- [ ] No unresolved P0 accessibility or data-loss defect remains in the changed workflow.
