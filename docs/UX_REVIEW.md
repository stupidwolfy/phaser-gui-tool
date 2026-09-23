# Product and UX review

Reviewed 23 September 2026 from the default project at 1440 × 900 and 390 × 844, plus a source and test-suite review. This is a heuristic product review, not user research. Findings about discoverability should be validated with five to eight first-time Phaser users.

## Executive summary

Phaser GUI Tool is already a capable **scene composer and lightweight no-code game builder**, not merely a mock-up tool. Its strongest differentiators are local-first files, a faithful in-editor/run-time split, unusually good mobile support, prefabs, tile maps, rules, physics, motion, and self-contained export. The visual system is coherent and the default scene makes the canvas understandable immediately.

The largest product risk is not lack of raw capability; it is that the capability is hidden in a dense three-pane interface. A first-time user sees object-type buttons, unlabeled toolbar icons, a hierarchy, and collapsed inspector sections, but no guided path from “edit this sample” to “build and export a game.” The product also lacks the workflow infrastructure expected once a project grows: a searchable asset browser, hierarchy search and locking, validation, zoom readout, project/game settings, and an escape hatch for custom code.

**Overall heuristic score: 7/10.** It is strong for small 2D scenes and prototypes, but needs discoverability and scale-oriented workflows before it feels like a complete daily-use editor.

## UX/UI scorecard

| Area | Score | Assessment |
| --- | ---: | --- |
| Information architecture | 7/10 | Familiar hierarchy/canvas/inspector model, but scene-, project-, and object-level settings all compete in the inspector. |
| Learnability | 5/10 | Sensible defaults, but no onboarding, templates, empty-state guidance, or in-product shortcut/help surface. |
| Editing efficiency | 8/10 | Multi-select, snapping, guides, alignment, copy/paste, grouping, undo/redo, and keyboard nudging cover frequent layout work. |
| Visual design | 7/10 | Consistent, restrained dark theme and strong canvas focus; small low-emphasis labels and many similar controls weaken hierarchy. |
| Feedback and safety | 7/10 | Dirty state, autosave, toasts, undo, preview, and explicit Play/Stop are good. Destructive actions and export readiness need clearer preflight feedback. |
| Mobile | 8/10 | The fitted canvas, bottom tabs, sheets, and touch-sized controls are unusually thoughtful for a game editor. The reduced toolbar is cryptic without persistent labels. |
| Accessibility | 5/10 | Native form controls and many ARIA labels help, but the canvas workflow, title-only explanations, glyph buttons, focus visibility, and color-dependent object markers need a dedicated pass. |
| Project scalability | 4/10 | The current UI works for a handful of scenes and objects; search, folders, locking, asset organization, diagnostics, and batch operations are absent. |

## What works well

### 1. The core layout matches users’ mental model

The desktop hierarchy → canvas → properties arrangement is immediately recognizable. The canvas receives most of the screen, while the phone layout preserves that priority by moving the two side panels into bottom sheets rather than shrinking everything into unusable columns.

### 2. The default document is an effective first impression

A platform, ball, and title communicate scale, selection targets, layering, and the editor’s purpose faster than an empty canvas would. “Fit scene” also starts users in a predictable view.

### 3. Interaction details show strong product thinking

Touch targets are deliberately large; sheets reserve space instead of obscuring the object being edited; motion preview is distinct from running the game; paint mode has a surface-level exit; and multi-selection supports both desktop modifiers and a persistent mobile mode. These are specific solutions to real editor problems.

### 4. The feature set is deeper than the restrained UI suggests

The implementation covers multiple scenes, groups, prefabs, sprite animation, tile maps and layers, particles, audio, camera controls, Arcade and Matter physics, collisions, variables, rules, tweens, filters, masks, touch controls, guides, snapping, and runnable HTML/JS/TS export. Automated browser tests cover these high-risk systems, which is a major quality strength.

### 5. Local-first is a clear and credible proposition

Plain project files, autosaved browser drafts, no account, and self-contained output make the tool easy to trust and try. This should be stated in the editor itself—not only in repository documentation—because it answers “where did my work go?” and “will upload expose my assets?”

## UX/UI issues and recommendations

### P0 — Make the first successful workflow obvious

**Problem:** The editor opens into a sample without explaining whether it is a template, how to manipulate it, or what “preview motion” versus “Play game” means. Most advanced capabilities remain behind collapsed sections. The repository README is excellent, but users should not need it beside the app.

**Recommendation:** Add a dismissible welcome checklist anchored to real UI:

1. Select the ball.
2. Drag it and resize it.
3. Open Physics or add a rule.
4. Press Play.
5. Export or save the project.

Also add a Help menu containing searchable shortcuts, gesture instructions, the local-first promise, and links to a five-minute tutorial and example projects. Remember dismissal locally.

**Success measure:** At least 80% of first-time test participants can change an object and run the result within three minutes without external help.

### P0 — Clarify the two play concepts and icon-only toolbar

**Problem:** The magnet, grid, motion-preview triangle/square, game-in-a-screen icon, fit glyph, undo, and redo rely on symbols and hover titles. Hover is unavailable on touch, and the semantic difference between motion preview and running the exported game is important but subtle.

**Recommendation:**

- Group toggles under a compact “View” or “Canvas” control on narrow widths.
- Give Play a visible text label on desktop and, where space permits, mobile.
- Rename the two concepts consistently to **Preview motion** and **Play game** in visible UI.
- Show a one-time callout when motion becomes available.
- Add a zoom percentage beside Fit (for example, `67%`) with `−`, `+`, `100%`, and Fit choices.

### P0 — Add project validation and export preflight

**Problem:** A sophisticated rules/asset/physics system can contain dangling references, missing assets, invalid frame ranges, unreachable scenes, or rules that can grow entities forever. Users currently discover many errors only after Play or export.

**Recommendation:** Add a Problems panel and status count. Validate continuously for missing references, duplicate names/keys, invalid frames, unavailable physics targets, empty masks, missing rule targets, scene-transition targets, and likely unbounded spawners. Before export, show errors and warnings with “Go to” links; errors block only when output would be invalid.

**Success measure:** Every invalid reference has an editor-visible diagnostic that selects the affected scene/object/field.

### P1 — Improve hierarchy scalability

**Problem:** The left panel gives most of its initial height to creation buttons. Objects have visibility and delete actions, but there is no search, lock state, folders/layers independent of transform groups, type filtering, or clear selected-row affordance at a glance. Many scenes would also turn the scene chips into a cramped selector.

**Recommendation:**

- Replace the permanent creation grid with one searchable **Add object** menu and keep the last few types as quick actions.
- Add hierarchy search and filters for type, hidden, locked, physics, and errors.
- Add lock/unlock and non-transform folders.
- Support inline rename, range selection, context menus, and multi-object batch edits.
- Move scenes to a scrollable/list popover once there are more than a few, with search, reorder, duplicate, and start-scene indication.

### P1 — Create a real asset workspace

**Problem:** Images, fonts, and audio are selected inside feature-specific pickers. There is no single place to see project weight, dimensions, usage, duplicate files, missing references, or unused assets. This will become the dominant pain point in real projects.

**Recommendation:** Add an Assets tab with thumbnails/waveforms, folders/tags, drag-and-drop multi-import, rename, replace while preserving references, usage count, delete protection, unused filtering, and total/export size. Support atlas JSON and common sprite-sheet metadata as first-class imports.

### P1 — Strengthen inspector hierarchy

**Problem:** The collapsible-section approach prevents an impossibly long form, but section names alone do not expose active state. A collapsed Tween, Physics, Effects, or Controls section looks the same whether configured or untouched. Scene-level options and object-level options also occupy the same visual grammar.

**Recommendation:**

- Add concise summaries to collapsed headers: `Physics · Dynamic`, `Tween · 3 props`, `Effects · 2`.
- Visually separate identity/transform from optional behaviors.
- Add inspector search (“gravity”, “font”, “collision”).
- Allow pinning frequently edited properties.
- Add reset/revert and mixed-value states for multi-selection.
- Use tooltips with examples for domain terms such as scroll factor, nine-slice, easing, and collision category.

### P1 — Add an extensibility path for custom game logic

**Problem:** Rules are approachable but finite. Serious Phaser projects quickly need loops, state machines, data loading, procedural behavior, APIs, plugins, or custom component logic. Exporting code only at the end creates a one-way workflow: edits made outside the builder cannot round-trip.

**Recommendation:** Provide event hooks/custom script modules referenced by stable object and scene IDs. A safe first step is generated hook files (scene create/update and rule action callbacks) that exports never overwrite. Later, add reusable behaviors/components and a code editor only if user demand warrants it.

### P2 — Accessibility and inclusive interaction

Run a dedicated keyboard and screen-reader audit. Initial priorities:

- Make focus rings conspicuous on every control and hierarchy row.
- Ensure every glyph button has an explicit accessible name, not only a `title`.
- Expose toggle state in both text and ARIA; do not rely only on blue fill.
- Offer reduced-motion behavior for previews and transitions.
- Provide a high-contrast option and patterns/icons in addition to object-type colors.
- Add keyboard equivalents for canvas zoom/pan, rotation, resize, hierarchy reorder, and section navigation.
- Provide a DOM-accessible selection summary because canvas content itself is not naturally discoverable to assistive technology.

### P2 — Refine visual hierarchy and responsive desktop behavior

The theme is coherent, but almost every surface is the same dark value and many controls share the same bordered-pill treatment. Increase separation between primary canvas actions, document actions, and toggles. Consider resizable/collapsible sidebars and a distraction-free canvas mode. Test intermediate laptop/tablet widths: fixed 260 px and 300 px sidebars can leave little canvas before the mobile breakpoint.

## Missing core features

These are prioritized by the point at which their absence prevents a realistic workflow.

### Needed for a production-ready small-game workflow

1. **Project/game settings:** start scene, logical resolution, scaling mode, orientation, pixel-art/antialias settings, transparent background, renderer preference, FPS, and global physics defaults.
2. **Asset manager:** centralized organization, metadata, replacement, usage, and cleanup.
3. **Validation/diagnostics:** actionable errors and warnings before Play/export.
4. **Hierarchy scale tools:** search, lock, folders, filters, and robust scene management.
5. **Custom-code escape hatch:** non-overwritten hooks or behavior modules.
6. **Deployment presets:** downloadable project bundle (not only a scene module or monolithic HTML), asset folder output, and clear instructions for Vite/static hosting.
7. **Input actions:** named actions such as `moveLeft` or `jump` mapped to multiple keys, pointer, and touch controls instead of behavior depending directly on individual keys.
8. **Data persistence:** explicit save data/local storage support for variables and settings across sessions, distinct from editor autosave.

### Important for richer 2D games

- Animation timeline/state machine with transitions, events, and per-object preview.
- Path/spline editor and path-follow behavior.
- Polygon and freeform collision shapes with a visual body editor.
- Cameras beyond one main camera, including split-screen/minimap use cases.
- Reusable behavior/component definitions and per-instance overrides.
- Localization tables and font-fallback management.
- Responsive anchors/constraints for HUD and multiple aspect ratios.
- Scene loading/preload strategy and progress-screen support.
- Tilemap interchange such as Tiled JSON, not only editor-native maps.
- Build profiles and compression/size reporting.

### Valuable, but not core yet

- Cloud sync, sharing, and real-time collaboration.
- Extension/plugin marketplace.
- Git integration inside the UI.
- AI-assisted object/rule generation.
- 3D tooling (outside the product’s clear 2D scope).

## Suggested roadmap

### Phase 1 — Discoverability and trust (2–4 weeks)

- Welcome checklist, Help/shortcuts surface, examples/templates.
- Visible Play label and clear preview terminology.
- Zoom controls/readout.
- Inspector active-state summaries.
- Basic Problems panel with missing-reference validation.
- Accessibility pass for names, focus, and keyboard reachability.

### Phase 2 — Projects that scale (4–8 weeks)

- Asset workspace with bulk import, replace, usage, and cleanup.
- Hierarchy search, locks, folders, filters, and scene list.
- Project/game settings and named input actions.
- Export preflight and downloadable project-bundle preset.

### Phase 3 — Extensibility and advanced creation (8–12 weeks)

- Stable custom-code hooks.
- Reusable behaviors/components.
- Responsive layout constraints.
- Polygon physics editing, paths, and animation state tooling, prioritized by user research.

## Research plan

Run two moderated task studies rather than asking whether users “like” the interface:

1. **New Phaser user:** change the sample, make the ball respond to input, run it, save it, and export it.
2. **Experienced Phaser user:** import a sprite sheet, create animation/physics/collision, build two scenes with a transition, diagnose one intentionally broken reference, and continue the exported project in code.

Capture time to first successful Play, number of dead ends, sections opened unnecessarily, terminology confusion, and whether participants can explain where project data is stored. Follow with analytics that remain privacy-preserving and opt-in, or use local-only counters during studies.

## Bottom line

The editor has a surprisingly complete and well-tested engine beneath a disciplined interface. The next investment should not be another isolated object type. It should be the connective UX—onboarding, search, assets, validation, project settings, and extensibility—that lets users discover the existing depth and carry a prototype into a maintainable game.
