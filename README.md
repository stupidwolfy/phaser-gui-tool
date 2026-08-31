# phaser-gui-tool

A visual editor for the [Phaser](https://phaser.io) game framework that runs entirely in your browser.

**→ [Open the editor](https://stupidwolfy.github.io/phaser-gui-tool/)**

No install, no account, no server. Projects are saved as a plain JSON file on your own
device, and nothing you make is ever uploaded anywhere. It works on a phone as well as
on a desktop.

## What it does

- Place rectangles, ellipses, text and images in a scene
- Select and drag objects on the canvas; pan and pinch-zoom the camera
- Resize by dragging the corner handle, keeping the aspect ratio unless you unlink it
- Import your own images and use them as sprites, with tint, flip and alpha
- Edit name, position, rotation, scale, size, colour and alpha in the inspector
- Duplicate, copy and paste objects, keeping their styling
- Change draw order with the inspector's Arrange buttons, or by dragging rows in the
  scene tree (the first row is the object furthest back)
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
| Delete / Backspace | Delete the selected object |
| Escape | Deselect |
| Ctrl/Cmd + D, C, V | Duplicate, copy, paste |
| Ctrl/Cmd + Z, Shift+Z | Undo, redo |
| Ctrl/Cmd + S, O | Save, open |

On a phone, tapping an object selects it and only a second drag moves it — a fingertip
covers enough of the screen that honouring the first touch as a drag moved whichever
object it happened to graze.

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

The goal is to eventually cover the whole Phaser surface; three iterations in, it is a
working editor but a small one.

**Not built yet** — animations and sprite sheets, tilemaps, physics, particles, audio,
cameras, multiple scenes, prefabs, nesting/containers, and multi-select.

**Not verified automatically** — there is no test suite and no CI on pull requests.
`npm run build` (which typechecks) is the only gate; changes to the canvas, layout or file
I/O are checked by driving the production build in Chromium at 1440×900 and 390×844, and
exports are checked by running them. Committing that as a Playwright suite is the next
infrastructure task.

## Development

```sh
npm install
npm run dev        # http://localhost:5173/phaser-gui-tool/  (note the base path)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

Requires Node 20+. Built with Vite, React and Phaser 4.

```
src/
  core/schema.ts      the project document types (the file format)
  core/store.ts       zustand store: document, selection, undo/redo
  io/fileIO.ts        save/open, File System Access API + download fallback
  io/exportPhaser.ts  the document turned into runnable Phaser code
  editor/phaser/      the Phaser scene that renders the document
  ui/                 toolbar, scene tree, inspector, responsive shell
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
