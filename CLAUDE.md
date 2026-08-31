# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A visual editor for the [Phaser](https://phaser.io) game framework, running entirely
client-side and hosted on GitHub Pages at
<https://stupidwolfy.github.io/phaser-gui-tool/>. No backend, no accounts — projects are
saved as JSON files on the user's own device.

The long-term goal is to cover the whole Phaser surface. Iteration 1 (shipped) built the
foundation: rectangles, ellipses and text; select/drag/zoom; inspector; save and open.
See the README for the user-facing feature list.

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
  (dragstart/dragend) and inspector fields (focus/blur), so one gesture is one undo step.
  New editing UI must do the same or it will flood the history stack.
- **The drag guard matters.** `EditorScene.draggingId` makes the store sync skip the
  position of the object under the pointer; without it the sync fights the drag.
- **The File System Access API is desktop-Chromium only** — absent on Chrome for Android,
  iOS Safari and Firefox. `src/io/fileIO.ts` feature-detects and falls back to a download
  plus an `<input type="file">`. That fallback is the majority path, not a degraded one.
- **Phaser 4, not 3.** The renderer, FX/filters and masks all changed. `node_modules/phaser/skills/`
  ships official per-topic docs (`v3-to-v4-migration`, `scale-and-responsive`,
  `input-keyboard-mouse-touch`, `tilemaps`, …) — read those rather than relying on Phaser 3
  memory.
- **CSS that looks cosmetic but isn't:** `touch-action: none` on `.viewport` (or the
  browser steals pan/pinch from the camera), and `font-size: 16px` on inputs (or iOS
  Safari zooms the page on focus).

## Verification

There is no automated suite. Changes to the canvas, layout or file I/O were verified by
driving the production build in Chromium via Playwright, at **1440×900 and 390×844**,
checking: add → select → drag → inspector edit → undo → save → reload → reopen, with a
console-error assertion.

Two things to know if you rebuild that harness:

- Chromium is preinstalled at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; do not
  run `playwright install`.
- **Headless Chromium exposes `showSaveFilePicker` but can never resolve it** (no UI), so a
  save test hangs. `delete window.showSaveFilePicker` in an `addInitScript` — which also
  makes the test exercise the real mobile path.

Promoting that script into a committed Playwright suite is a good early task.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` builds and publishes to Pages. Repository
setting **Settings → Pages → Source: GitHub Actions** is already configured; without it
`actions/deploy-pages` fails in about a second.

`vite.config.ts` sets `base: '/phaser-gui-tool/'` to match the repo name. A wrong base
gives a blank page with 404ing assets — the single most likely deploy failure. Override
with the `VITE_BASE` env var for a fork or custom domain.

## Not built yet

Sprites and asset management, animations, tilemaps, physics, particles, audio, cameras,
multiple scenes, prefabs, and code export. The schema's `children` array and Phaser
Containers are the intended path for nesting — `EditorScene` currently renders only
top-level nodes on purpose, since nested ones would be positioned wrong without
Containers.
