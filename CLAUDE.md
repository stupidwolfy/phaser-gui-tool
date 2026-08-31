# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A visual editor for the [Phaser](https://phaser.io) game framework, running entirely
client-side and hosted on GitHub Pages at
<https://stupidwolfy.github.io/phaser-gui-tool/>. No backend, no accounts — projects are
saved as JSON files on the user's own device.

The long-term goal is to cover the whole Phaser surface. Iteration 1 (shipped) built the
foundation: rectangles, ellipses and text; select/drag/zoom; inspector; save and open.
Iteration 2 (shipped) added code export, and the editing operations around it: duplicate,
copy/paste, draw-order control and a keyboard layer. See the README for the user-facing
feature list.

**Mobile is a first-class target**, not an afterthought. Anything added has to work with
a thumb on a 390px-wide screen.

## Commands

```sh
npm run dev        # http://localhost:5173/phaser-gui-tool/  (note the base path)
npm run build      # tsc -b && vite build  — typecheck is part of the build
npm run preview    # serve dist/ at the same base path
npm run typecheck  # tsc -b alone
```

There is no test runner or linter configured yet. `npm run build` is the gate — it fails
on type errors, and `noUnusedLocals`/`noUnusedParameters` are on, so dead bindings break
the build.

## The one architectural rule

**The project document is the single source of truth. Phaser is only a renderer.**

```
        Project document (plain JSON, src/core/schema.ts)
                          ▲
              ┌───────────┴───────────┐
         React UI                EditorScene
    (tree, inspector)         (draws it, drags it)
```

React renders from the store; the Phaser scene subscribes to the same store directly
(`useEditorStore.subscribe`, not props) and diffs its display objects against it. Both
write edits back through store actions. No editor state lives anywhere else.

This is what makes `JSON.stringify(project)` a complete save by construction, and what
makes new object types additive. **Do not stash state on Phaser game objects** beyond the
`nodeId`/`nodeType` lookup keys already there.

`zustand` was chosen specifically because Phaser lives outside React and needs a vanilla
`subscribe`.

## Adding a Phaser object type

This is the repeating unit of work for most future iterations. Add a `sprite`, and:

1. `src/core/schema.ts` — add to the `NodeType` union and add its props interface to
   `NodePropsByType`. The union is built so this turns every unhandled case elsewhere
   into a **compile error**, which is the intended way to find the rest of the work.
2. `src/core/defaults.ts` — a `createNode` case with sensible starting values.
3. `src/editor/phaser/EditorScene.ts` — a `createDisplayObject` case and an `applyNode`
   case.
4. `src/ui/Inspector.tsx` — a properties section.
5. `src/ui/SceneTree.tsx` — add to `ADDABLE`; add a `.tree__type[data-type=...]` colour
   chip in `src/styles/app.css`.
6. `src/io/exportPhaser.ts` — a `constructorFor` case. This one fails silently rather
   than at compile time: an unhandled type exports nothing at all, so check it in the
   same pass as the `EditorScene` case.

Bump `SCHEMA_VERSION` only for a change existing files can't be read under. `parseProject`
already rejects files from a *newer* schema with a readable message.

## Non-obvious things, learned the hard way

Each of these was a real bug found in browser testing. Don't re-derive them.

- **`game.scale.refresh()` alone is not enough.** It reuses a cached parent size and
  leaves the canvas one resize behind. Call `game.scale.getParentBounds()` first
  (`src/editor/Viewport.tsx`). Symptom: the scene mis-fits and canvas clicks land in the
  wrong place.
- **The selection outline must not be the UI accent blue** — that is also the default
  rectangle fill, so the outline vanished on the object you had just selected. It is cyan
  for that reason.
- **Hit areas must be resized as the object changes** (`applyHitArea`). A text object's
  size follows its content, so it drifts out of step as you type.
- **Undo is transaction-grouped.** `beginTransaction`/`endTransaction` wrap drags
  (dragstart/dragend), inspector fields (focus/blur) and arrow-key nudges (first
  keydown/keyup), so one gesture is one undo step. New editing UI must do the same or it
  will flood the history stack. A held arrow key is the sharpest case: it repeats at the
  OS rate, so an ungrouped nudge buries the stack in a second. `App.tsx` closes that
  transaction on an idle timer as well as on keyup, because a keyup is lost if the window
  loses focus mid-press.
- **Draw order is the array order, and nothing else.** There is no `depth` field in the
  schema: `applyNode` calls `setDepth(index)` with the node's index in `scene.children`,
  and the exporter emits the array in order. So `reorderNode` splicing the array is the
  whole of raise/lower/front/back, and the scene tree deliberately lists the array as it
  is — the first row is the object furthest back. Showing it front-first would read more
  like Photoshop but would put an index flip between every UI action and the store.
- **Phaser's drag system never moves anything itself.** `DRAG` only reports `dragX/dragY`;
  the handler must call `setPosition`. Because the store sync deliberately skips the object
  under the pointer (`EditorScene.draggingId`, which stops the rounded store value fighting
  the gesture), forgetting that leaves the object not following the finger at all.
- **Clear `draggingId` *before* calling `endTransaction()`.** `endTransaction` publishes a
  store change, and the sync it triggers is what settles the object on its final position.
  Clearing afterwards meant that sync was still skipped, so the object stayed visually
  stale until some later unrelated store change redrew it — which looked like "the move
  only applies when I press the confirm button".
- **The File System Access API is desktop-Chromium only** — absent on Chrome for Android,
  iOS Safari and Firefox. `src/io/fileIO.ts` feature-detects and falls back to a download
  plus an `<input type="file">`. That fallback is the majority path, not a degraded one.
- **Phaser 4, not 3.** The renderer, FX/filters and masks all changed. `node_modules/phaser/skills/`
  ships official per-topic docs (`v3-to-v4-migration`, `scale-and-responsive`,
  `input-keyboard-mouse-touch`, `tilemaps`, …) — read those rather than relying on Phaser 3
  memory.
- **`touch-action: none` is needed on the canvas itself, not just `.viewport`.** Phaser
  does not set it, and the property is not inherited, so the canvas computed `auto` and a
  real phone could reclaim a drag as a scroll mid-gesture. The resulting `pointercancel`
  fires no `DRAG_END`, which stranded `draggingId` and left that object permanently
  unmovable. `EditorScene` now also listens for `pointercancel` and
  `POINTER_UP_OUTSIDE` to end the gesture.
- **`font-size: 16px` on inputs** is not cosmetic either — anything smaller makes iOS
  Safari zoom the page on focus.
- **Emulated touch is not real touch.** Playwright's CDP `Input.dispatchTouchEvent`
  bypasses the browser's gesture-detection heuristics, so the drag bug above reproduced
  perfectly on a phone and not at all in the harness. Treat a clean emulated pass as
  necessary, not sufficient.

## Interaction model

Touch and mouse deliberately differ, keyed off `pointer.wasTouch`:

- **Mouse:** press on an object selects it *and* starts the drag in one gesture.
- **Touch:** the first press only selects; only the already-selected object can then be
  dragged. A fingertip covers far more than a cursor, so honouring the first touch as a
  drag moved whichever object it happened to graze.

`DRAG_START` must compare against `EditorScene.selectionAtPress`, not the live
`selectedId` — `GAMEOBJECT_DOWN` has already selected the object by then, so the live
value always matches and the two-step rule silently stops working.

`src/ui/MoveBar.tsx` makes that rule visible on mobile: it appears on selection and gives
the move an explicit ending (✓ keep, ✗ put it back, using the `moveOrigin` snapshot the
store takes in `select()`).

## Code export

`src/io/exportPhaser.ts` turns the document into real Phaser code: a Scene class in
TypeScript or JavaScript, and a self-contained runnable HTML page. It is a pure function
of the document, which is the payoff for keeping Phaser a renderer.

The three outputs cover the three real cases without overlapping. `.ts` and `.js` are ES
modules that import Phaser, for a bundler-based project; the runnable page is the
script-tag flavour where Phaser is a global. TS and JS differ by exactly one token — the
`: void` return annotation — because everything `buildCreateBody` emits is already plain
JavaScript, which is the same property that lets the HTML embed the body verbatim.

Both outputs share `buildCreateBody`, so the runnable page can never drift from the
file you ship. Adding a node type means adding a `constructorFor` case; anything not
handled there silently exports nothing, so check it alongside the `EditorScene` case.

Generated code is built from free user text, and the escaping is not optional:

- Object names become JS identifiers (`toIdentifier`) — they can be blank, start with
  a digit, or repeat, so it strips, prefixes and de-duplicates.
- **Embedding JS in HTML needs more than `JSON.stringify`.** An HTML parser ends the
  script at the first literal `</script>`, inside a JS string literal included. A
  project whose text contained one produced an export that would not run *and* could
  execute arbitrary markup in whoever opened it. `escapeForScriptTag` handles that plus
  `<!--` and U+2028/9.
- The document title, the CSS background colour and the CDN version all come from the
  project file, so they are escaped or validated rather than interpolated raw.

## Verification

There is no automated suite. Changes to the canvas, layout or file I/O were verified by
driving the production build in Chromium via Playwright, at **1440×900 and 390×844**,
checking: add → select → drag → inspector edit → undo → save → reload → reopen, with a
console-error assertion.

**Assert what is drawn, not just what is stored.** The bug above passed every
store-level assertion — the document held the right coordinates the whole time while the
canvas showed something else. The harness now scans the canvas screenshot for the
rectangle's fill colour and compares centroids across each step.

Two traps in that pixel approach, both of which produced confident wrong answers:

- The move bar floats *over* the canvas and its confirm button is `--accent`, the same
  colour as the default rectangle fill, so it was counted as part of the object. Clip the
  bottom band off the screenshot.
- Clip the screenshot, but compute pointer coordinates from the *full* canvas box, or the
  touches land in empty space and every assertion silently reads "nothing moved".

Two things to know if you rebuild that harness:

- Chromium is preinstalled at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; do not
  run `playwright install`.
- **Headless Chromium exposes `showSaveFilePicker` but can never resolve it** (no UI), so a
  save test hangs. `delete window.showSaveFilePicker` in an `addInitScript` — which also
  makes the test exercise the real mobile path.

Export is verified by **running the exported page**: serve it to Chromium with the CDN
request routed to `node_modules/phaser/dist/phaser.min.js`, then assert Phaser booted,
a canvas exists, and the expected fill colours are present. The exported `.ts` is
checked with `tsc --strict` against the real Phaser types, and the exported `.js` is
bundled with Vite in a throwaway project and run, which is the actual "drop it into your
Phaser project" path. Serve that bundle over HTTP — browsers refuse ES modules from
`file://`, which looks like a broken export but is not. Both are also run against a
project full of hostile names and content — that is what caught the `</script>` hole.

Promoting these scripts into a committed Playwright suite is a good early task.

## Writing commits and pull requests

Describe the change, not the conversation that produced it. A reader six months from
now has none of that context and does not need it.

- No "you asked for", "as requested", "reported by", "here it is". If a bug came from
  testing on a phone, the useful fact is *the browser reclaimed the gesture*, not who
  noticed.
- Prefer the change as subject over yourself as subject: "the drag handler now
  positions the object" rather than "I made the drag handler position the object".
- Say what changed, why it is built that way, and how it was verified. Keep verification
  concrete — the numbers, the checks that ran, what they proved.
- Note anything a reviewer would otherwise have to rediscover: a non-obvious constraint,
  a decision between two reasonable options, a trap in the tooling.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` builds and publishes to Pages. Repository
setting **Settings → Pages → Source: GitHub Actions** is already configured; without it
`actions/deploy-pages` fails in about a second.

`vite.config.ts` sets `base: '/phaser-gui-tool/'` to match the repo name. A wrong base
gives a blank page with 404ing assets — the single most likely deploy failure. Override
with the `VITE_BASE` env var for a fork or custom domain.

## Not built yet

Sprites and asset management, animations, tilemaps, physics, particles, audio, cameras,
multiple scenes, and prefabs. Multi-select is not built either — `selectedId: string |
null` runs through the store, the scene and the move bar, so it is its own iteration.
There is still no committed test suite; promoting the Playwright scripts described under
Verification is the standing next-best task. The schema's `children` array and Phaser
Containers are the intended path for nesting — `EditorScene` currently renders only
top-level nodes on purpose, since nested ones would be positioned wrong without
Containers.
