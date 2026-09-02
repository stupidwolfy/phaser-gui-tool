# phaser-gui-tool

A visual editor for the [Phaser](https://phaser.io) game framework that runs entirely in your browser.

**→ [Open the editor](https://stupidwolfy.github.io/phaser-gui-tool/)**

No install, no account, no server. Projects are saved as a plain JSON file on your own
device, and nothing you make is ever uploaded anywhere. It works on a phone as well as
on a desktop.

## What it does

- Place rectangles, ellipses, text and images in a scene
- Select and drag objects on the canvas; pan and pinch-zoom the camera
- Select several objects at once — turn on **Multi** in the scene tree and tap them, or
  Shift/Ctrl-click on a desktop — then move, group, duplicate, hide or delete all of them
  in one go
- Line several objects up: align their left, right, top or bottom edges or their
  centres, or spread three or more evenly across or down
- Snap while you drag: an object pulled near another's edge or centre — or the scene's —
  lands exactly on it, with a guide showing what it caught. The magnet button in the
  toolbar turns it off for the drag that has to sit one pixel out
- Match the spacing of a row you drop into: drag an object onto the end of an evenly
  spaced run, or into the middle of a gap, and it takes the spacing that is already
  there — with a labelled bar across every gap that agrees
- Snap to a grid: the **#** button beside the magnet draws a grid and lands drags on
  it. Set its pitch under Snapping in the Scene panel; the two toggles are independent,
  and lining up with an object wins wherever they disagree
- Resize by dragging the corner handle, keeping the aspect ratio unless you unlink it
- Turn an object with the knob above it, on the canvas rather than in a panel. The angle
  snaps the same way a drag does: the magnet catches another object's angle, the **#**
  button lands it on a fixed step (15° unless you change it under Snapping), and the
  degrees are shown while either is holding it
- Import your own images and use them as sprites, with tint, flip and alpha
- Edit name, position, rotation, scale, size, colour and alpha in the inspector
- Group objects: a group moves, rotates, scales and fades everything inside it as one,
  and groups can hold groups. Drag a row onto a group in the scene tree, or set an
  object's Parent in the inspector — either way it stays exactly where it was on screen
- Duplicate, copy and paste objects, keeping their styling
- Change draw order with the inspector's Arrange buttons, or by dragging rows in the
  scene tree (the first row is the object furthest back; inside a group, the same applies
  to the group's own contents)
- Undo/redo, grouped by gesture — one drag, one field edit or one held arrow key is one
  step
- Save and open `.phaser.json` project files from your device, with an autosaved draft in
  the browser so a closed tab doesn't lose your work
- Export the scene as real Phaser code: a Scene class in TypeScript or JavaScript, or a
  self-contained runnable HTML page — images included, so an export needs no files
  alongside it
- Three panels on desktop, canvas plus bottom sheets on a phone

### Keyboard

| Keys | Does |
| --- | --- |
| Arrow keys | Nudge 1px — hold Shift for 10px |
| Delete / Backspace | Delete the selection |
| Escape | Deselect |
| Ctrl/Cmd + A | Select every top-level object |
| Ctrl/Cmd + G | Wrap the selection in a group |
| Ctrl/Cmd + D, C, V | Duplicate, copy, paste |
| Ctrl/Cmd + Z, Shift+Z | Undo, redo |
| Ctrl/Cmd + S, O | Save, open |

On a phone, tapping an object selects it and only a second drag moves it — a fingertip
covers enough of the screen that honouring the first touch as a drag moved whichever
object it happened to graze.

While **Multi** is on, a press adds an object to the selection or takes it out again, and
never moves anything; turn it off to drag what you have picked. Dragging any one of
several selected objects moves all of them together, wherever in the tree they sit.

Groups are selected from the scene tree: on the canvas a press picks the object you
actually touched. Once a group *is* selected, dragging anywhere on its contents moves the
whole group, which is otherwise impossible — the children cover the only box the group
has.

### Images

Imported images are stored **inside the project file**, as data URLs. One `.phaser.json`
is the whole project: nothing breaks when you move it, rename a folder or send it to
someone else, and there is no server here to hold the files instead.

The cost is size, so import scales anything over 2048px down and refuses an image that
would still be over 4 MB encoded. A project with several images can also outgrow the
browser's autosave quota — the editor says so when that happens, and saving to a file
keeps working either way.

Exported code carries the same bytes in an `ASSETS` object at the top of the file. To
serve real image files in your own project instead, replace each value in it with a path.

### Saving

Where the File System Access API exists (desktop Chrome and Edge), **Save** writes back to
the same file. Everywhere else — including Chrome on Android and Safari on iOS — it
downloads the file, and **Open** uses a normal file picker. That fallback is the path most
phone users take, not a degraded mode.

## Status

The goal is to eventually cover the whole Phaser surface; six iterations in, it is a
working editor but a small one.

**Not built yet** — animations and sprite sheets, tilemaps, physics, particles, audio,
cameras, multiple scenes, and prefabs.

**Verified by** a Playwright suite that drives the production build in Chromium at both
1440×900 and 390×844, and by CI on every pull request. It checks the editing round trip
against the pixels on the canvas — not just the document — and checks the three exports by
running them: the page in a browser, the `.ts` under `tsc --strict`, and the `.js` through
a real Vite bundle.

## Development

```sh
npm install
npm run dev        # http://localhost:5173/phaser-gui-tool/  (note the base path)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm test           # the Playwright suite (builds first, then drives dist/)
```

Requires Node 20+. Built with Vite, React and Phaser 4.

The first `npm test` on a machine needs the browser: `npx playwright install chromium`.
`npm run test:ui` opens the interactive runner, and `npm run test:report` shows the report
from the last run.

```
src/
  core/schema.ts      the project document types (the file format)
  core/store.ts       zustand store: document, selection, undo/redo
  core/bounds.ts      the boxes the renderer last drew, and the align maths
  core/snapping.ts    pulling a dragged box onto the lines, gaps and grid around it,
                      and a turned object onto the angles around it
  io/fileIO.ts        save/open, File System Access API + download fallback
  io/exportPhaser.ts  the document turned into runnable Phaser code
  editor/phaser/      the Phaser scene that renders the document
  ui/                 toolbar, scene tree, inspector, responsive shell
tests/
  editing.spec.ts     add, drag, inspect, group, undo, save, reopen — on both viewports
  multi-select.spec.ts  building a selection, and moving/grouping it as one
  align.spec.ts       aligning and distributing a selection by its drawn edges
  snapping.spec.ts    a drag landing on a neighbour's edge, an equal gap or the grid
  rotation.spec.ts    the rotate knob, and an angle landing on a neighbour or a step
  assets.spec.ts      image import, drawing, save/reopen, removal
  export.spec.ts      the runnable page, run in a browser
  export-toolchain.spec.ts  the .ts through tsc --strict, the .js through Vite
  helpers/            the page object, pixel readback, fixtures
```

One rule shapes all of it: **the project document is the single source of truth, and
Phaser is only a renderer.** `CLAUDE.md` has the architecture notes and the traps worth
knowing before changing the canvas or the file format.

## Deployment

Pushing to `main` publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml); it can also be run by hand
from a branch under **Actions**. Forking under a different repository name means setting
`VITE_BASE` to `/<your-repo>/` when building, or the deployed page loads with 404ing
assets.

## License

MIT
