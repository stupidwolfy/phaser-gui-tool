# phaser-gui-tool

A visual editor for the [Phaser](https://phaser.io) game framework that runs entirely in your browser.

**→ [Open the editor](https://stupidwolfy.github.io/phaser-gui-tool/)**

No install, no account, no server. Projects are saved as a plain JSON file on your own
device, and nothing you make is ever uploaded anywhere. It works on a phone as well as
on a desktop.

## What it does

- Place rectangles, ellipses, text, images, stretchable panels and tiled backgrounds in a
  scene
- Style that text properly: bold and italic, a wrap width and an alignment, line and
  letter spacing, a stroke and a drop shadow — with room for the last two worked out for
  you so neither is clipped
- Give that text a font of your own: import a TTF, OTF, WOFF or WOFF2 under the text
  object's Font family and pick it from the list. The font travels inside the project file
  and inside the export, so the words come out in the face you chose on a machine that has
  never heard of it — where naming a font the browser has to already have is a coin toss
- Select and drag objects on the canvas; pan and pinch-zoom the camera
- Select several objects at once — turn on **Multi** in the scene tree and tap them, or
  Shift/Ctrl-click on a desktop — then move, group, duplicate, hide or delete all of them
  in one go
- Line several objects up: align their left, right, top or bottom edges or their
  centres, or spread three or more evenly across or down — or centre one object, or all
  of them, in the scene
- Snap while you drag: an object pulled near another's edge or centre — or the scene's —
  lands exactly on it, with a guide showing what it caught. The magnet button in the
  toolbar turns it off for the drag that has to sit one pixel out
- Match the spacing of a row you drop into: drag an object onto the end of an evenly
  spaced run, or into the middle of a gap, and it takes the spacing that is already
  there — with a labelled bar across every gap that agrees
- Snap to a grid: the **#** button beside the magnet draws a grid and lands drags on
  it. Set its pitch under Snapping in the Scene panel; the two toggles are independent,
  and lining up with an object wins wherever they disagree
- Place your own guides: add a vertical or horizontal one under Guides in the Scene
  panel, drag it on the canvas to move it or off the edge of the scene to remove it, or
  type an exact number. Objects line up with a guide before anything else, and the guide
  lights up while it is holding a drag. Guides are saved with the project — unlike the
  snapping settings — and **Show guides** hides them and stops objects agreeing with them
  without deleting them
- Resize by dragging the corner handle, keeping the aspect ratio unless you unlink it
- Turn an object with the knob above it, on the canvas rather than in a panel. The angle
  snaps the same way a drag does: the magnet catches another object's angle, the **#**
  button lands it on a fixed step (15° unless you change it under Snapping), and the
  degrees are shown while either is holding it
- Import your own images and use them as sprites, with tint, flip and alpha
- Slice an image into a sprite sheet — frame size, margin and spacing — and pick
  which frame a sprite shows
- Animate it: build a clip from the frames (`0-3, 7` picks and orders them), set the
  frame rate and whether it loops, and press ▶ in the toolbar to watch it play on the
  canvas — the same button starts and stops every particle emitter and every tween, since
  all three are the canvas moving by itself. Animations are saved with the project and exported as real
  `this.anims.create(...)` calls, so the sheet and the clip come out the other side
- Edit name, position, rotation, scale, size, colour and alpha in the inspector
- Group objects: a group moves, rotates, scales and fades everything inside it as one,
  and groups can hold groups. Drag a row onto a group in the scene tree, or set an
  object's Parent in the inspector — either way it stays exactly where it was on screen
- Reuse a piece of layout as a **prefab**: select some objects, **Save as prefab** in the
  inspector, and place it again from the Prefabs list in the scene panel. Every placement
  is linked to the one definition, so editing it changes all of them at once — detach an
  instance into an ordinary group, edit it with the usual tools, then **Replace** the
  prefab from it. Deleting a prefab detaches its instances rather than deleting the
  objects, and exported code gets one factory function per prefab, called once per
  placement
- Paint a level out of **tiles**: `+ Tiles` adds a map, an imported image sliced into
  frames is its tileset, and **Edit tiles** turns the canvas into a paint surface — tap or
  drag to lay the tile you picked, ⌫ to rub tiles out, ✓ when you are done. Set the map's
  size in columns and rows, fill the whole thing with one tile, and export it as a real
  `make.tilemap` / `addTilesetImage` / `createLayer`, tile data and all. A map holds as
  many **layers** as you like over the one tileset — a floor, the walls that stand on it,
  the leaves in front — each with its own tiles, its own solid frames and its own show/hide,
  reorderable back to front, and switchable from the paint bar without leaving the canvas
- Throw **particles**: `+ Particles` adds an emitter, an imported image is what it
  throws, and the inspector shapes it — lifespan, how fast and in which directions, how it
  grows and fades, how many and how often, gravity, tint and blend mode. It sits still
  until you press ▶ in the toolbar, so an emitter stays where you put it while you place
  the rest of the scene, and exports as a real `this.add.particles(...)` with every
  setting in one object
- Make an object **move by itself**: switch on Tween in the inspector and say where its
  X, Y, rotation, scale or alpha should end up, over how long, with which easing, and
  whether it goes back again and repeats. The destination is drawn on the canvas as a
  dashed outline, so you can place it by eye; press ▶ and it runs, press ▶ again and
  everything snaps back exactly where you left it — a preview never changes a single
  number in your project. It works on anything at any depth, groups and prefabs included,
  and exports as a real `this.tweens.add({ ... })` beside the object it belongs to
- Stretch a **panel** without stretching its corners: `+ Panel` adds a nine-slice, and the
  four Slice fields say how wide its border is. Make it any size you like — the corners
  keep the size you drew them at, and only the edges and the middle stretch, which is what
  a dialog frame or a button needs. Leave Slice top and bottom at 0 for a bar that
  stretches sideways only
- Repeat one image across a box with `+ Tiled`: a wall, water or a parallax background
  layer. Tile offset scrolls the pattern inside the box and tile scale changes how big one
  repeat is, neither of which moves or resizes the object itself
- Give a scene **sound**: import an MP3, OGG, WAV, M4A or WebM under Audio in the scene
  panel, press ▶ on its row to hear it, and add it to the scene to set its volume, whether
  it loops and whether it starts with the scene. Exported code preloads exactly the sounds
  a scene uses and gives each one a named handle, so `jumpSound.play()` is the one line you
  write — the editor itself stays silent while you work
- Point the **camera**: under Camera in the scene panel, set where the game opens, how far
  in it is zoomed, whether scrolling stays inside the scene, and which object it follows.
  The violet frame on the canvas is the shot the scene starts on, and it exports as real
  `this.cameras.main.setScroll(...)` / `setZoom(...)` / `startFollow(...)`. Nothing here
  moves your own view of the scene — pan and pinch as usual, and press ⤢ to see all of it
  again
- Build a game out of several **scenes**: `+ Scene` in the scene panel adds one, the
  chips beside it switch between them, and the inspector duplicates or deletes the one
  you are in. Images, sounds, animations and prefabs are shared by all of them; the project
  reopens on the scene you left it on
- Make the game actually **play**: under Rules in the scene panel — or on any object's own
  panel — say when something happens and what it does. *When* is the scene starting, two
  objects touching, an object being tapped, a key being pressed or a timer firing; *what* is
  removing an object, showing or hiding one, setting an object's text, playing a sound or an
  animation, starting a movement, going to another scene, changing a number — or moving the
  camera: shake it when something is hit, flash or fade it in a colour of your choosing, pan
  it somewhere, zoom it in or out, each over a time and an easing you set. Declare
  those numbers under Variables — a score, a lives count — and a rule can check one before
  it runs (`only if Score is at least 3`). Variables survive a change of scene, so a score
  carries from level to level. The editor never runs a rule, because a rule deletes things:
  press Export and play the page it gives you
- **Show what the game counts**: a variable can hold a line of text as well as a number, and
  a rule that sets an object's text can put a variable's value on the end of it — so a text
  object reading `Score: 0` in the editor reads `Score: 7` in the game. The editor leaves the
  text the document says, since only a running game can change it
- **Keep the label up to date**: a text object can name a variable under *Shows variable* on
  its own panel, and then follows it — the value goes on the end of what the object says, and
  changes in the game whenever the number does, with no rule needed to rewrite it. *Decimal
  places* and *Pad to width* say how the number reads, so a score shows `0007` rather than
  `7`. The editor draws the value the variable starts at, which is the frame the game opens on
- Duplicate, copy and paste objects, keeping their styling
- Change draw order with the inspector's Arrange buttons, or by dragging rows in the
  scene tree (the first row is the object furthest back; inside a group, the same applies
  to the group's own contents)
- Undo/redo, grouped by gesture — one drag, one field edit or one held arrow key is one
  step
- Save and open `.phaser.json` project files from your device, with an autosaved draft in
  the browser so a closed tab doesn't lose your work
- Export the project as real Phaser code: a Scene class per scene in TypeScript or
  JavaScript, or a self-contained runnable HTML page — images included, so an export needs
  no files alongside it. The scene you are editing is the module's default export and the
  one the page starts; the rest are registered alongside it, ready for `scene.start`
- Three panels on desktop, canvas plus bottom sheets on a phone
- The properties panel is a stack of collapsible sections, closed until you open
  them. What you open stays open — across objects, and the next time you visit
- One button in the panel header opens or closes them all

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

An image sliced into frames is loaded with `this.load.spritesheet(...)` and the same four
numbers you set in the editor, so the frames your game cuts are the frames you drew with.

An image can instead be cut by a **texture atlas** — the `.json` a packer such as
TexturePacker writes, holding named frames of any size and position. Attach it in the same
place you slice a grid, because an image is cut one way: attaching an atlas clears the
grid, and slicing a grid clears the atlas. A sprite, a panel, a tiled image or an emitter
then *names* the frame it draws, and an animation is a list of names — so re-packing your
art and re-importing keeps every frame that kept its name, where indices would all have
shifted. Exported code carries the frames inline in an `ATLASES` object and loads them
with `this.load.atlas(...)`; replace a value with a path to serve the real `.json`
instead.

A tileset is just such an image, sliced on a grid: the frames you slice it into are the
tiles you paint with, and a tilemap's tile size is its frame size — so one image can be a
sprite sheet and a tileset at once, and there is nothing extra to set up. An atlas cannot
be a tileset, because a tile size has to be uniform and an atlas is the absence of one.

### Physics

Any rectangle, ellipse, text or sprite at the top level of a scene can be given an **Arcade
Physics body** — Dynamic for something that moves, Static for a floor or a wall — plus
velocity, bounce, drag, spin, mass and whether it feels the scene's gravity. Gravity itself
is a scene setting, and the world's edges are the scene rectangle you can already see.

The editor **draws** the body and never runs it. Its green box is where the body sits, and
because an Arcade body is axis-aligned it stays square to the screen however the object is
turned — which is the one thing about physics the canvas can tell you and the docs cannot.
Nothing moves while you are placing it: the document is what you are editing, so the
simulation belongs to the game you export. Export the runnable page to watch it go.

The export is the real thing — `this.physics.add.existing(...)` with every setter written
out, `this.physics.world.gravity.set(...)` and `setBounds(...)` per scene. The runnable
page enables Arcade in its own game config; a `.ts` or `.js` module cannot, so it says at
the top what to add to yours.

A body is only half of a floor. Two bodies pass straight through each other until you say
they collide — see **Collisions** below, which is on each object's own panel as well as on
the scene's, and which an object with a body and no pairing will tell you about.

### Making it play

Three things turn a scene into something you can actually play, and all three are settings
rather than code.

**Solid tiles.** Under Collision in a tilemap's inspector, pick the frames of its tileset
that should stop things — walls, floors. They outline green on the map while you paint, and
export as `layer.setCollision([...])`. Solidity belongs to the *layer*, so one tileset can
be a wall on the layer you are painting and scenery on the layer behind it.

**Collisions.** A body on its own stops nothing — Arcade only separates two things that
have been told to meet, so a box with a body falls straight through a floor with a body
until you say the two collide. Say it on either object's own panel, under **Collides with**,
or scene-wide under Collisions in the scene panel; both are the same list, and an object
that nothing collides with says so on its panel rather than leaving you to find out in the
exported game. Solid stops them, Overlap only reports the touch. A tilemap is a valid side,
so "the player stands on the ground" is one row — and a multi-layer map contributes one
collider per layer, so walls painted above the floor still stop things. It exports as a
real `this.physics.add.collider(...)` or `overlap(...)`, written after the objects it names.

**Controls.** Any object with a dynamic body can be given **Player controls** — Platformer
(walk and jump) or Top-down (walk any way), on the arrow keys or WASD, with a walk speed and
a jump speed. Green arrows on the body outline say which object the keys drive. It exports as an
`update()` method that reads the keys and sets a velocity, with the jump gated on there being
something underneath — which is what the solid tiles and the collisions are for.

**Touch controls.** Tick **On-screen buttons** beside the keys and the exported game draws a
D-pad and — for a platformer — a jump button over its canvas, so what you built on a phone
plays on one. The buttons are the game's, not the editor's: orange rings on the canvas show
where they will land, and nothing here presses them. There is one set per scene, sized
against the scene rectangle, and the keys still work alongside them — one export plays on a
desktop and on a phone.

None of it runs in the editor. Nothing moves, nothing collides and no key does anything
while you are placing objects: the document is what you are editing. Export the runnable
page to play it.

What is still deliberately yours is what *happens* — a coin that disappears, a scene that
starts the next one. The export hands you the overlap and the handles; the line inside it is
game logic and stays where you write it.

### Saving

Where the File System Access API exists (desktop Chrome and Edge), **Save** writes back to
the same file. Everywhere else — including Chrome on Android and Safari on iOS — it
downloads the file, and **Open** uses a normal file picker. That fallback is the path most
phone users take, not a degraded mode.

## Status

The goal is to eventually cover the whole Phaser surface; twenty-four iterations in, it is
a working editor but a small one.

**Not built yet** — text has typography and its own imported fonts, with four limits: a
family is one face, so bold and italic are the browser's synthesis rather than a real bold
file; there are no bitmap fonts; there is no gradient fill or background colour behind the
text (a coloured box behind something is a rectangle, which this editor has had since the
first iteration); and there is no per-word styling. Texture atlases are in, with five
limits: one image per atlas (no multi-page packs), rotated frames are refused rather than
drawn on trust, an atlas cannot be a tileset, frames are named by the file rather than
renameable here, and there is no packing or rect-editing in the editor — bring a `.json`. Panels and tiled images are in, with three limits: a
panel's scalable regions stretch rather than repeating, a tiled image has an offset but no
scroll speed (a background that drifts is one line in your own `update()`), and neither can
play an animation, which is Phaser's limit rather than this editor's. Cameras are in, with
five limits: one camera per scene, no fade, shake, pan or other effects over time, no follow
offset or dead zone, no way to grab the camera frame on the canvas, and no button that
points your own view through it. Audio is in, with four limits: no audio
sprites, no per-play settings like rate or pan (those belong on the handle, in the line you
write), no positional sound, and nothing stops a sound when a scene ends. Physics is in,
with three limits:
nothing is simulated in the editor, bodies are rectangles rather than circles, and only an
object at the top level of a scene can have one — a body is positioned in world coordinates,
and an object inside a group is not.
Collisions and controls are in, with two limits: nothing happens *when* two things touch
(that line is yours, on the collider the export hands back), and a tile is either solid or
it is not — there are no per-tile properties beyond that. On-screen controls are in, with
three: the layout is fixed rather than placeable, there is no analogue stick or swipe (every
direction here is on or off, as a key is), and the buttons' look belongs to the exported
code rather than to a setting in the editor.
Tweens are in, with five limits: one tween per object (a second one is a different
duration, which is a list this does not have), nothing chains or sequences them, nothing
*starts* one but the scene starting, only the six transform-and-alpha properties can be
driven, and there are no callbacks — what happens when a tween finishes is a line in your
own code.
Scenes are in, with one limit: nothing in the editor starts one scene from another, since
that is a line of game logic rather than a piece of layout — the export registers them all
and leaves `this.scene.start('Level 2')` to you. Prefabs are in, with two limits: a prefab cannot contain another prefab,
and an instance cannot override part of what it draws — detach it and edit the copy.

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
  core/snapping.ts    pulling a dragged box onto the guides, lines, gaps and grid around
                      it, and a turned object onto the angles around it
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
  guides.spec.ts      placing a guide, dragging it, and a drag agreeing with it
  animation.spec.ts   slicing a sheet, drawing one frame of it, and playing a clip
  nineslice.spec.ts   a panel whose corners hold, and a texture that repeats
  typography.spec.ts  a stroke, a wrap, an alignment, and a style that round-trips
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
