# phaser-gui-tool

A visual editor for the [Phaser](https://phaser.io) game framework that runs entirely in your browser.

**→ [Open the editor](https://stupidwolfy.github.io/phaser-gui-tool/)**

No install, no account, no server. Projects are saved as a plain JSON file on your own
device, and nothing you make is ever uploaded anywhere. It works on a phone as well as
on a desktop.

## Status: iteration 2

The goal is to eventually cover the whole Phaser surface. Iteration 1 built the
foundation and got it deployed; iteration 2 added code export and the editing operations
that make it usable for more than a couple of objects.

**Works today**

- Place rectangles, ellipses and text in a scene
- Select and drag objects on the canvas; pan and pinch-zoom the camera
- Edit name, position, rotation, scale, size, colour and alpha in the inspector
- Duplicate, copy and paste objects, keeping their styling
- Change draw order: Arrange buttons in the inspector, or drag rows in the scene tree
- Keyboard: arrow keys nudge (Shift for 10px), Delete removes, Escape deselects,
  Ctrl/Cmd+D/C/V/Z/S/O
- Undo/redo, grouped sensibly (one drag, one field edit or one held arrow key is one step)
- Save and open `.phaser.json` project files from your device
- Autosaved draft in the browser, so a closed tab doesn't lose your work
- Responsive: three panels on desktop, canvas plus bottom sheets on a phone
- Export the scene as real Phaser code: a Scene class in TypeScript or JavaScript, or a
  self-contained runnable HTML page

**Not yet** — sprites and asset management, animations, tilemaps, physics, particles,
audio, cameras, multiple scenes and prefabs.

## How it works

One rule shapes the whole codebase: **the project document is the single source of truth,
and Phaser is only a renderer.** React draws the UI from that document, Phaser draws the
canvas from it, and both write edits back to it. Nothing about the editor's live state
lives anywhere else — which is what makes "save to a file" complete by construction, and
what will make adding the rest of Phaser's object types additive rather than a rewrite.

```
src/
  core/schema.ts      the project document types (the file format)
  core/store.ts       zustand store: document, selection, undo/redo
  io/fileIO.ts        save/open, File System Access API + download fallback
  io/exportPhaser.ts  the document turned into runnable Phaser code
  editor/phaser/      the Phaser scene that renders the document
  ui/                 toolbar, scene tree, inspector, responsive shell
```

Saving uses the File System Access API where it exists (desktop Chrome and Edge, which
lets "Save" write back to the same file), and falls back to a normal download everywhere
else — including Chrome on Android and Safari on iOS, where that API is unavailable. The
fallback is the path most phone users take, not a degraded mode.

## Development

```sh
npm install
npm run dev        # http://localhost:5173/phaser-gui-tool/
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

Requires Node 20+. Built with Vite, React and Phaser 4.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). You can also run it by
hand from a branch with **Actions → Deploy to GitHub Pages → Run workflow**.

One-time repository setup: **Settings → Pages → Source: GitHub Actions**.

If you fork this under a different repository name, set `VITE_BASE` to `/<your-repo>/`
when building — otherwise the deployed page loads but its assets 404.

## License

MIT
