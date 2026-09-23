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
copy/paste, draw-order control and a keyboard layer. Iteration 3 (shipped) added sprites
and image assets. Iteration 4 (shipped) made the tree a real tree: a `container` node
type, Phaser Containers, reparenting, and nested export. Iteration 5 (shipped) made the
selection a set: several objects moved, grouped, duplicated, hidden and deleted as one.
Iteration 6 (shipped) added align and distribute, and with them the first thing the store
knows about *drawn* geometry. Iteration 7 (shipped) put that geometry inside the gesture:
a drag now snaps to the objects around it, with guides. Iteration 8 (shipped) widened what
a drag can agree with: equal spacing within a row, and a grid. Iteration 9 (shipped) gave
rotation a gesture of its own — a knob on the canvas — and put the same kind of agreement
inside it. Iteration 10 (shipped) let the user author a line of their own: guides, saved
with the document, that a drag agrees with before anything else — and, with them, "centre
this in the scene". Iteration 11 (shipped) made an image more than one picture: a frame
grid on the asset, animation clips on the project, and a canvas that plays them on
request. Iteration 12 (shipped) made a piece of layout reusable: prefab definitions on the
project, an `instance` node that draws one, and an export that emits a factory function
per prefab rather than a copy per placement. Iteration 13 (shipped) made the `scenes`
array hold more than one: a switcher, and an export that emits every scene rather than the
one on screen. Iteration 14 (shipped) made a level out of tiles: a `tilemap` node, a
tileset that is nothing more than an image already sliced into frames, and a paint mode
that owns the canvas while it is on. Iteration 15 (shipped) put motion into the scene
itself: a `particles` node drawn as a real `ParticleEmitter`, stopped by default and
running only under the preview toggle the animations already had. Iteration 16 (shipped)
gave an object a body: an Arcade physics body on a top-level node, a gravity on the scene,
and an export that emits real `physics.add.existing` — drawn on a canvas that still
refuses to simulate. Iteration 17 (shipped) gave a scene a sound: an audio table beside the
images, a per-scene list of what a scene registers, and an export that hands the user a named
handle to play — on a canvas that stays silent unless asked. Iteration 18 (shipped) said
where the game looks: a per-scene camera with a scroll, a zoom, a follow target and the
scene for its bounds, drawn on the canvas as the frame it opens on and never once applied
to the editor's own view. Iteration 19 (shipped) let an image be drawn at a size that is
not its own: a `nineslice` panel whose corners hold while its middle stretches, and a
`tileSprite` that repeats rather than scaling. Iteration 20 (shipped) made the scene do
something once the game runs: solid tiles, a per-scene collider table and a keyboard
behaviour on a node — the first `update()` this exporter has ever emitted, on a canvas that
still simulates nothing. Iteration 21 (shipped) gave that behaviour a thumb: on-screen
buttons, derived from the scene rectangle rather than stored, drawn by the editor as rings
it will never press and by the export as a real HUD. Iteration 22 (shipped) went back to
the one type that had not changed since iteration 1 and made text into typography: weight
and slant, a wrap and an alignment, spacing, a stroke and a shadow — the first iteration to
widen an existing node type's props rather than add a type. Iteration 23 (shipped) gave
that typography a font to be set in: a third asset table holding font files, a family
picked on the node rather than typed from memory, and an export that carries the bytes —
so text finally looks the same on a machine that has never heard of the font. Iteration 24
(shipped) gave an image a second way to be cut: a texture atlas, named frames of any size
imported from a packer's JSON, and with it a `frame` that is a name rather than an index.
Iteration 25 (shipped) made a level out of more than one pass: a tilemap node holds an
ordered list of layers over one shared tileset and one shared grid, each with its own
tiles, its own solid frames and its own visibility — the first iteration to close a hole
by *nesting* an existing prop rather than adding a type or a table. Iteration 26 (shipped)
gave a scene its choice of engine: an Arcade body grown to hold the object it is turned
with, or a Matter body that is a real polygon and turns with it — the first iteration to
put a second implementation behind an existing feature rather than adding to it.
Iteration 27 (shipped) let an object move on its own: a tween on a node, its destination
drawn on the canvas, run under the ▶ toggle the animations and emitters already had — and
the first thing ever allowed to break `applyNode`'s "drawn position == stored position"
invariant, because it is also the first that can be stopped without the document having
moved. Iteration 28 (shipped) crossed the line iteration 20 drew and let the document
say what *happens*: a rule table on the scene, numbers the game keeps on the project, and an
export that emits real listeners — on a canvas that runs none of it, because a rule does not
merely animate the document, it destroys objects and starts other scenes. Iteration 29
(shipped) let the game say what it counts: a variable may now hold text as well as a number,
and a rule may set an object's text — with a variable's value on the end, which is how a
score gets on screen. The first iteration whose whole subject is a hole the previous one
left, and the third to leave `EditorScene.ts` untouched. Iteration 30 (shipped) let that
label keep up: a text node now *names* the variable it shows and draws the value on the end
of its own caption, with two dials for how a number reads, and an export that subscribes to
`changedata-<key>` — a moment Phaser already delivers, so iteration 28's line does not move
and `update()` still gains nothing. The second iteration running whose whole subject is a
hole the previous one left, and the first since 27 to touch `EditorScene.ts` at all.
Iteration 31 (shipped) let the camera do something at a moment: five rule actions — shake,
flash, fade, pan and zoom — which is the refusal iteration 18 made arriving at the door
iteration 28 built, with no new format, no new table, no new emitted helper and an
`EditorScene.ts` untouched for the fourth time, because here the canvas's refusal to run a
rule and the camera's "drawn, never applied" are the same refusal twice. Iteration 32
(shipped) let the user press play: the exported page, run in a sandboxed iframe over the
editor, so sixteen iterations of emitted behaviour the canvas refuses to run are finally
visible without a download — and the first iteration in this list that changes the document
not at all, because the thing that simulates is a different document. Iteration 33 (shipped)
let a rule watch a number: a `varChange` trigger, which is the example iteration 28 gave for
what lay on the far side of its own line — and which turned out to be on the near side of it,
because `changedata-<key>` is a moment Phaser already delivers and iteration 30's labels had
been riding it for two iterations. One trigger kind, one emitted helper, no table, no format
change and no `update()`, on a canvas that still fires no rule. Iteration 34 (shipped) gave
`destroy` its inverse: a rule may now **build** a prefab at a point, which is the factory
function iteration 12 has been emitting for twenty-two iterations and nothing has ever called
but a placement — so the document stopped being able to describe only a level and started
being able to describe a wave. One `RuleAction` member, no table, no new helper and no schema
bump; the work was two passes in the exporter, because a prefab nothing *places* was invisible
to every collector in the file, and the first mark this canvas has ever drawn for a rule —
a spawn being the first thing a rule says that has a *where*. Iteration 35 (shipped) let an
object be drawn with something over it: a glow, a blur, a drop shadow or a pixelate, as
Phaser 4 *filters* — the largest hole this file's own "Not built yet" list never once
named, and the first feature in a long while where the editor and the exported game do the
same thing rather than one describing the other, because a filter is a standing fact about
how an object is drawn rather than a step of a simulation. Iteration 36 (shipped) said how
an object *meets* what is behind it: a blend mode on any node, drawn and exported alike —
which is the third thing named in the one sentence that found filters, and the one nothing
ever asked about again, so it is iteration 34's closing lesson landing twice in a row. The
second iteration to take a field **off** a props interface, after iteration 25 moved a
tilemap's `data` into its layers — and it deliberately copies that one's mechanics: a blend
mode had lived on `ParticlesProps` since iteration 15, where it was one type's answer to a
question every type asks, so the work was less the four modes than the migration that leaves
the document saying it once. Iteration 37 (shipped) let a rule set something moving: a
`setVelocity` action, which is the third iteration running to close a hole no refusal list
ever named — and the widest of the three, because the two halves it joins had each been
complete for a dozen iterations. Physics shipped in 16, colliders and a drive-scheme in 20, a
thumb in 21, a second engine in 26, and rules in 28; and across the six iterations that grew
that vocabulary to seventeen actions, **not one of them touched a body** — so the only thing
in this document that could put one in motion was a player holding a key. One `RuleAction`
member, two emit shapes for the two engines, no table, no helper, no gate and no schema bump,
and the first canvas mark this file has ever argued *against* on the grounds that the thing
has nowhere to be. Iteration 38 (shipped) let a rule reach the one object type whose whole
point is what it does over time: a `particles` node may now be started, stopped or burst at a
moment — which is the refusal iteration 15 wrote about *itself*, in the exact words rules
were later built to answer (*"an emitter that starts switched off and is triggered later is
a line of game logic"*), and which nothing revisited across ten iterations of widening that
vocabulary. Three `RuleAction` members and **no `emitting` prop**: whether an emitter waits
is *derived* at the emit from whether a rule starts it, which is `ctx.ruleTweens`' own
`paused: true` one type over and is what keeps iteration 15's sentence true rather than
overturning it. No table, no helper, no gate, no schema bump and an `EditorScene.ts`
untouched for the eighth time — the strongest version of that yet, because this is the first
rule action whose result the canvas was **already showing**. Iteration 39 (shipped) said how
far an object moves when the camera does: a `scrollFactor` on a node, which is parallax at
0.3 and a HUD at 0 — and which iteration 25 had refused in a sentence whose second clause was
simply wrong, a standing fact carried in on a comma beside a real limit. The first iteration
to close a hole by finding a *false* argument rather than a dated one, and the first ever to
give `applyNode`'s "drawn position == stored position" a **standing** exception, because a
canvas that showed a pinned object somewhere the exported game would not is the one
disagreement this project refuses hardest. Iteration 40 (shipped) let an object be painted
only where a picture says: a `mask` effect, which is the **last of the three** things the one
sentence that found filters and blend modes named — and the second iteration running to close
a hole by finding a *false* argument, because the clause that kept masks out ("the first
thing in this document that points at another node") was wrong about a document holding
`followId`, both sides of a collider and ten `RuleAction` node ids. The first feature here
whose refusal was **one sentence covering six filters at once**, which is where a welded
argument is hardest to see. Iteration 41 (shipped) let a rule build a prefab **where an object
stands** rather than only at a fixed point: an optional `nodeId` on the `spawn` action, with
`x`/`y` read as an offset from it — the loosening iteration 34 named as "the obvious next ask",
and cheaper than it predicted, because naming the field `nodeId` rather than `at` made
`ruleNames` and the scene duplicator's remap inherit it with no edit. Iteration 42 (shipped)
let a rule **move** an object: a `setPosition` action, to a point or to another object plus an
offset. That is the loosening iteration 37 named as "the thing a reader will ask for next", and
it works on a node with no body at all. It is the first action to carry a *second* node
reference (`atId`), so it is the first that `ruleNames` and `remapActionRefs` could not inherit
from a field name, and each gained one explicit line. Iteration 43 (shipped) closed the one
hole iteration 34 recorded as having *made* rather than inherited: a prefab placed nowhere had
no controls anywhere, so one built only by a rule could be neither renamed nor deleted without
placing it first. The library in the scene panel now carries each definition's name, where it
is used and a delete, behind one toggle — and like iteration 32 it changes the document not at
all. Iteration 44 (shipped) let a body be round: a `shape` on the physics body, whose radius
is the circle inscribed in the object and is never stored — the "no circular bodies" hole
iteration 16 left, and the first bump taken because iteration 41 said the next edge of its
kind should bump rather than be recorded.
See the README for the user-facing feature list.

**Mobile is a first-class target**, not an afterthought. Anything added has to work with
a thumb on a 390px-wide screen.

## Commands

```sh
npm run dev        # http://localhost:5173/phaser-gui-tool/  (note the base path)
npm run build      # tsc -b && vite build  — typecheck is part of the build
npm run preview    # serve dist/ at the same base path
npm run typecheck  # tsc -b alone, tests included
npm test           # Playwright: builds, previews dist/, drives it in Chromium
```

There is no linter configured. `npm run build` and `npm test` are the two gates, and CI
runs both on every pull request. The build fails on type errors, and
`noUnusedLocals`/`noUnusedParameters` are on, so dead bindings break it;
`tsconfig.tests.json` puts the suite under the same rules.

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

This is the repeating unit of work for most future iterations. Add a `tileSprite`, and:

1. `src/core/schema.ts` — add to the `NodeType` union and add its props interface to
   `NodePropsByType`. The union is built so this turns every unhandled case elsewhere
   into a **compile error**, which is the intended way to find the rest of the work.
   Not everywhere, though: step 4 below is conditional JSX and step 5 is a data table,
   so neither fails the build. Check those two by hand.
2. `src/core/defaults.ts` — a `createNode` case with sensible starting values.
3. `src/editor/phaser/EditorScene.ts` — a `createDisplayObject` case and an `applyNode`
   case. Only the first is enforced: `createDisplayObject` assigns `object` and uses it
   after the switch, so a missing case is a definite-assignment error, while a missing
   `applyNode` case is **silent**. That makes three silent steps, not the two below.
4. `src/ui/Inspector.tsx` — a properties section, as a `<Section title=…>`. It needs
   registering nowhere: the open/closed state is a default plus sparse overrides, so a
   section nobody has touched simply follows the default. Keep it a flat peer of the
   sections around it — see "The properties panel".
5. `src/ui/SceneTree.tsx` — add to `ADDABLE`; add a `.tree__type[data-type=...]` colour
   chip in `src/styles/app.css`.
6. `src/io/exportPhaser.ts` — a `constructorFor` case. That one *is* a compile error under
   `strict` (the switch stops being exhaustive against a non-nullable return), but
   `modifiersFor`, `collectAssets`, `usedIn`, `missingReason`, `collectAnimations` and
   `emitNode` are not exhaustive, so check them in the same pass as the `EditorScene`
   case. `collectAssets` and `usedIn` are a pair and both are needed: the first decides
   what a texture is called across the file, the second what *one scene* preloads.
   A type that carries `fx` needs nothing extra: `effectsOf` reads it off the node and
  `emitNode` emits it for every type alike, which is the one part of this checklist that
  is additive by construction.
  `countAssetUses` in `src/core/store.ts` is off this checklist entirely and is the same
   kind of hand-matched list — miss it and the image-deletion warning under-reports by a
   whole object type; `removeAsset`'s own patch beside it is a third, and a type missing
   from that one leaves the document holding a dangling `assetId`, which is the invariant
   nothing else in the editor is allowed to break. `PHYSICS_TYPES` in `schema.ts` is a second such list and the
   **fourth silent step**: a new type is not body-eligible until it is named there, and
   nothing anywhere fails if it should have been. A type that draws *text* has a fifth:
   `familiesIn` in the exporter matches on `node.type === 'text'`, so a new type carrying a
   `fontFamily` would export a scene whose text is drawn in a font the page never loaded —
   which looks exactly like the bug iteration 23 exists to remove.
   A `text` type has a sixth, and any type carrying a `frame` has a seventh: `resolveFrame`
   answers for a grid *and* an atlas, so a new frame-carrying type must resolve rather than
   read `props.frame` raw, or it draws a missing texture the moment its image is cut by an
   atlas.
7. `tests/` — the two silent steps are exactly the two the suite covers: add the type to
   `tests/editing.spec.ts` (it draws where the document says, and survives a save and an
   open) and give it a hostile instance in `tests/helpers/hostile.ts`, which puts its
   strings through both export toolchains.

`instance` is the one type not in `editing.spec.ts`, because it is the one type with no
`ADDABLE` entry to add it with — `prefabs.spec.ts` carries the "it draws, it survives a
save and an open" duty for it instead. That is a deliberate exception, not a skipped step.
`sprite` and `tilemap` are the same exception by a different route: neither draws anything
at all until an image has been imported and, for a tilemap, sliced, so `assets.spec.ts` and
`tilemap.spec.ts` carry that duty for them. `nineslice` and `tileSprite` are that exception
one step further out, and the reason is worth stating because they look like they fail it:
both *do* draw with no setup, on the placeholder — but what either one is *for* cannot be
seen until an image is imported, since a solid colour stretched and a solid colour sliced
put identical pixels on the canvas. `nineslice.spec.ts` carries that duty for the pair. A
type that *can* be added and seen doing its own job with no setup still belongs in
`editing.spec.ts`.

A `container` is the one type that is not purely additive: its children render, so
`EditorScene.syncNodes` recurses into it and the exporter emits an `add([...])` for it.
See "Nesting" below.

Bump `SCHEMA_VERSION` when a *deployed older build* would break on the new file, not only
when this build can't read an old one — those are different directions and the second is
the one that bites. Adding `sprite` kept every v1 file readable but made v2 files fatal to
a v1 build, whose `createDisplayObject` has no case for the type and leaves the object
undefined; the bump turns that crash into `parseProject`'s "made with a newer version of
the editor" message. Pages serves whatever build a browser has cached, so this is a real
combination, not a hypothetical one.

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
  size follows its content, so it drifts out of step as you type. `setSize` does not carry
  the hit area with it — that is also why the scale handle keeps a 44px touch target
  around the 14px square it draws, re-applied every frame against the camera zoom.
- **The add-row is a grid, not a flex row.** The buttons are `nowrap`, so a flex row
  cannot shrink them below their labels; the fourth object type clipped `+ Image` in half
  in the 260px scene-tree column. `repeat(auto-fit, minmax(84px, 1fr))` lets the column
  count follow the width with no breakpoint to maintain.
- **Undo is transaction-grouped.** `beginTransaction`/`endTransaction` wrap drags
  (dragstart/dragend), corner-handle scaling, inspector fields (focus/blur) and
  arrow-key nudges (first keydown/keyup), so one gesture is one undo step. New editing UI must do the same or it
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

## Images and assets

Imported images live **in the document**, as `project.assets: ImageAsset[]` holding
base64 data URLs. That is the whole of asset management — there is nowhere else for an
image to be, which is what keeps `JSON.stringify(project)` a complete save. A path to a
file on disk would break the moment the project moved, and there is no server to hold the
bytes instead.

Consequences worth knowing before touching any of it:

- **Import re-encodes everything** (`src/core/assets.ts`), through a canvas, to PNG or
  JPEG only. That normalises the stored form to two mime types — which is what lets the
  exporter and the validator stop sniffing — and rasterises SVG at import, so a sprite's
  intrinsic size is always a real pixel count. JPEG is only used for a source that was
  already JPEG: it has no alpha channel, so anything that might be transparent stays PNG.
- **Decoding is async, the store sync is not.** Phaser needs an `HTMLImageElement` to
  build a texture from. `assets.ts` caches decodes keyed by *data URL* (the content, so
  the cache can't go stale), and `EditorScene.syncTextures` starts a decode for anything
  missing and re-runs the sync when it lands. Opening a project always takes that path.
- **A sprite with no usable image still has to be a real object** — selectable,
  draggable, visible. That is what `PLACEHOLDER_TEXTURE` is for. The same placeholder
  covers "no image chosen yet" and "the image is gone", so there is one state, not two.
- **Textures outlive scenes.** They belong to the game, so `EditorScene` tracks the keys
  it created in `assetTextures` and removes exactly those on SHUTDOWN. Removing by
  guesswork would take out Phaser's own `__DEFAULT`/`__MISSING`.
- **A sprite has no width/height props.** Its size is the asset's intrinsic size times the
  shared transform scale, which is exactly what Phaser does — `setDisplaySize` is itself
  just a scale. A separate display size would be two fields fighting over one number.
- **`removeAsset` also clears every sprite pointing at the image**, in one undo step, so
  the document can never hold a dangling reference by any action in the editor.
  `parseProject` still tolerates one, because a hand-edited file can.
- **An atlas is the first untrusted field in this table that is not a data URL**, and its
  guard is about a different thing. `ASSET_DATA_URL` exists because an SVG data URL can
  carry script into an `<img>`; a frame name carries no script anywhere, since `str()` sits
  between it and all three places it reaches the output. What `parseAtlas` guards is the
  *cut*: names non-empty, never `__BASE`, rects four finite positive numbers — because a
  bad one is a frame that silently draws as another. See "Texture atlases".
- **The asset table is untrusted input on open.** `parseAssets` accepts only
  `data:image/png|jpeg;base64,…` — an SVG data URL can carry script, and these strings go
  into an `<img>` and into exported code. It drops bad entries rather than failing the
  open: one unreadable image should not cost the user the rest of their work.
- **localStorage autosave is ~5 MB**, which images blow past quickly. `scheduleDraftSave`
  now reports the failure once and clears the stale draft, rather than swallowing it —
  silently believing you have a draft is worse than knowing you don't.

## Sprite sheets and animations

An image can be cut into frames, and a sprite can play a sequence of them. Both are
document state, and the shape of them follows from where each thing actually belongs.

- **A grid is now one of two cuts.** Iteration 24 added `ImageAsset.atlas` beside
  `ImageAsset.sheet`, and everything below still describes the grid: `frameGridOf`,
  `frameLayoutOf` and `formatFrameList`'s ranges are all about *indices*, which is what a
  grid has and an atlas does not. The two are mutually exclusive and `atlasOf` breaks the
  tie — see "Texture atlases" below.
- **The frame grid is on the asset, the clip is on the project, the choice is on the
  node.** `ImageAsset.sheet?: FrameGrid` is how *that image* is cut, so every sprite
  drawing it reads the same cuts and no two can disagree about how many frames it has.
  `project.animations: AnimationClip[]` sits beside the assets for the reason the assets
  are project-level: a clip is a way of reading one image, and two scenes can share a
  "walk" without either owning it. The sprite carries only `frame` and `animationId`.
- **`frameGridOf` is the only reader of `asset.sheet`**, the job `guidesOf` does for
  `scene.guides`, and it answers two questions at once — "is this a sheet" and "is this
  grid usable" — so no caller can check the first and forget the second. A frame wider
  than the image divides into a zero column count and would have Phaser's parser warn and
  build a texture with no frames in it.
- **`frameLayoutOf`'s arithmetic is copied from Phaser's `Textures.Parsers.SpriteSheet`
  and has to stay copied** — margin subtracted once, spacing added back before the
  division. It is what the Frame field clamps against and what "12 frames (4×3)" reports,
  so a formula of our own that rounded differently would offer the user a frame their
  exported game does not have.
- **`SCHEMA_VERSION` bumped to 4, and this is the counter-example to the guides
  decision.** Neither field crashes a v3 build. They do something worse: `parseAssets`
  rebuilds each asset field by field and `parseProject` names the project's fields one at
  a time, so a v3 build drops both on open and writes the file back without them — every
  grid and every clip gone, with nothing having said so. Guides survived an old build
  *because* scenes are the one thing passed through verbatim. These are not, so this
  bumps. `animation.spec.ts` asserts the current version in the saved artefact.
- **The texture key carries the grid, and the animation key carries the clip.** A Phaser
  texture's frames are cut once, when it is added, and an `Animation` is built from its
  frames at `create` time; neither can be re-cut in place. Folding a signature into the
  key means the existing "add what is wanted, remove what is not" diff in `syncTextures`
  and `syncAnimations` handles a re-cut on its own, with no special case — the new key is
  missing so it is added, the old key is unwanted so it goes.
- **Animations belong to the game, not the scene.** `this.anims` is a singleton shared by
  every scene, exactly as the texture manager is, so `EditorScene` tracks the keys it
  registered in `animationKeys` and removes those on SHUTDOWN. Forgetting that leaks every
  clip the user ever edited, a new key per edit.
- **The editor draws every sprite node as a `Sprite`; the exporter emits `add.image`
  unless the node animates.** Only a Sprite carries an AnimationState, and in the editor a
  still sprite has to be able to start playing the moment the user gives it a clip. In an
  export that capability would be a heavier object and a reader's question about what it
  is for, so there the still case stays the `add.image` it always was — frame argument and
  all, since frame 0 is `add.image`'s own default.
- **Preview is off by default and is editor state**, and since iteration 15 the field is
  `previewMotion` and governs emitters too — see "Particles" — and since iteration 27
  tweens, which is the one thing it governs that moves an object rather than redrawing
  one.
- **The original argument for it.** A canvas that animates by itself is a
  canvas whose objects are never where you last looked, which makes placing one by eye a
  matter of timing; and the frame a still sprite shows is a document field the user is
  editing, so it has to be the frame on screen while they edit it. It is the one moment
  the canvas deliberately stops mirroring the document exactly.
- **`play(key, true)` — ignoreIfPlaying — is not optional.** The scene syncs on every
  store change, so without it a selection or a nudge of some unrelated object restarts
  every animation from frame 0 and nothing ever visibly advances.
- **The toolbar's ▶ appears only once the project holds something that moves** — an
  animation, an emitter since iteration 15, or a tween since iteration 27 (`hasMotionIn`). A 390px toolbar already
  clips when everything is shown, and a control that can only ever do nothing is worth
  less than the width it costs — while a project that *does* move needs it in the toolbar
  rather than a panel, because on a phone a panel is a sheet over the canvas you are
  trying to watch.
- **Un-slicing removes the clips; re-cutting only clamps them.** A clip is a list of
  indices into a grid, so removing the grid leaves them indexing nothing — but dropping a
  walk cycle over a one-pixel margin correction would be absurd, so a re-cut clamps
  instead. Both are one undo step, through `mapProjectSprites`.
- **`mapProjectSprites` is the one traversal for everything that reaches across the
  document into sprites** — removing an image, removing a clip, re-cutting and un-cutting
  a sheet. Each has to touch every scene and each has to preserve array identity where
  nothing changed, because identity is the signal `editProject` reads for "nothing
  happened" and therefore for "no undo step". Written once, that invariant is kept once.
- **The parser drops a clip whose asset did not survive the open**, which is stricter than
  the treatment of a sprite pointing at a missing image — that is tolerated and draws the
  placeholder. The difference is that a dangling clip has no such fallback state:
  `generateFrameNumbers` on a texture that was never loaded throws, so it would export a
  game that does not boot.
- **The frame list is text, and ranges are the readable form.** `formatFrameList` collapses
  runs — "0-11" rather than twelve numbers, which is what fits and what a person would
  write — and `parseFrameList` accepts both, counting down for a descending range. It runs
  on every keystroke, so half-typed input is the normal case: an unparseable part is
  dropped rather than throwing the rest of the list away, and the store refuses an empty
  result rather than storing a clip Phaser cannot create.
- **The clip's field is labelled "Animation name", not "Name".** The object's own name
  field is a few rows up the same panel. Two fields labelled Name is ambiguous to a reader
  as well as to a test locator, and this one is the key the exported code plays by.

## Texture atlases

An image can be cut a second way: `ImageAsset.atlas?: AtlasFrame[]` holds **named frames of
any size and position**, as a packer like TexturePacker writes them, and a node then *names*
the frame it draws rather than indexing one. It is one claim and everything follows from it:
an atlas is a second answer to `ImageAsset.sheet`'s question, not a second question.

- **So it lives where the first answer lives.** How an image is cut is a property of the
  *bytes* — how many frames it has and what they are called is not a thing two sprites
  drawing it may disagree about. That is `ImageAsset.sheet`'s argument unchanged, and it is
  deliberately **not** the nine-slice insets' one: an inset decides nothing about the image,
  which is why that lives on the use. It is also what makes `removeAsset` need no edit — an
  atlas goes with the bytes it cuts, so there is no third table to clean up and no dangling
  reference to prune, `removeFont`'s one-liner arriving for the same structural reason.
- **An image is cut one way, and the tie is broken in exactly one place.** `atlasOf` answers
  null when `asset.sheet` is present, and `frameGridOf` is untouched — a grid wins a file
  that says both, because it is the older of the two and so the one an older build could have
  written. The rejected shape was a check on *both* sides, which is circular; the other
  rejected shape was "both means neither", which is a third state to explain. Nothing the
  editor writes can be in that state at all — `setAssetSheet` and `setAssetAtlas` delete each
  other's field and `parseAssets` keeps only one — so this fires only on a hand-edited file:
  **strip on read, refuse on write**, the physics body's pair for the third time.
- **`frameGridOf` needed no edit, and that is the load-bearing accident.** An atlas-cut asset
  has no `sheet`, so every existing consumer of a grid — `tilesetKeyFor`, `tileMapOf`,
  `collectAssets`' tileset gate, `collectTilemaps`, `TilePalette`, `buildPreloadBody` —
  already answers "not a grid" for one, which is exactly the right answer everywhere. Only
  the *wording* changed. Said out loud because here "already covered" and "forgotten" read
  identically, and the next reader will otherwise add a redundant guard or delete a live one.
- **A node names a frame, and identity is the whole point rather than a detail of it.** A
  packer re-run with one sprite added renumbers every frame after it, so an index would
  silently redraw half a scene while a name either still exists or visibly does not. That is
  `EMPTY_TILE`'s argument arriving from the other side: there a re-cut must be able to blank
  the answer and hand it back whole, and here a re-import must be able to *keep* an answer
  that a position could not. `atlas.spec.ts` asserts it with a repack, which is the one claim
  an index-based implementation fails while passing every other test in the file.
- **`atlasOf` is the only reader**, in the `guidesOf` / `frameGridOf` / `tileMapOf` /
  `physicsOf` / `soundsOf` / `cameraOf` / `sliceInsetsOf` / `textStyleOf` / `fontStackOf` /
  `prefabChildrenOf` family, and it answers four questions at once: is this an atlas, is it
  the only cut, does every rect lie inside the image, and is every name usable. The last one
  is new in kind. A name must be **unique**, because it is a key in the object literal the
  exporter emits and JavaScript resolves a repeat by silently keeping the last — one frame
  drawing as another, in the export only. And a name may not be **`__BASE`**, which is the
  sharpest small trap here: `Texture.add` answers `null` for a name the texture already
  holds, every texture holds `__BASE` from its constructor, so a frame called that is dropped
  by Phaser with no warning and every node naming it draws the whole image. The `CSS_GENERICS`
  decision one format over. A fresh array per call, so
  `useEditorStore((s) => atlasOf(...))` is React error #185 — the `tileMapOf` trap, seventh time.
- **`clampFrame` became `resolveFrame`, renamed rather than widened, and the rename is the
  point.** Ten call sites each had to decide what a *named* frame means to them, and a rename
  is a compile error at each where a widened return type is not — the `NodeType` union's trick
  applied to a function. For a grid it is `clampFrame` to the digit, which is what keeps every
  existing export byte for byte what it was. For an atlas it resolves by identity and falls
  back to the first frame, because a name has no near neighbour to clamp towards.
- **`frameSizeOf` was factored out of `sliceInsetsOf`, and a trimmed frame answers with its
  *source* size.** An atlas's frames are not all one size — that is the whole of what an atlas
  is — so a panel cut from one measures its insets against *its* frame rather than the image.
  The trim half is the subtle one: Phaser's `Frame.setTrim` sets `width`/`height` to the
  untrimmed size, so measuring against the packed rect would have the editor's insets and
  Phaser's slice disagree by exactly the trim, on a panel where being wrong is invisible until
  it is stretched.
- **`this.load.atlas`'s second argument may be the frame data itself, so the cut rides
  inline.** Phaser's `AtlasJSONFile` takes "a well formed JSON object" in place of the atlas
  URL and skips the fetch — no second file, no boot-order question. That is the `load.font`
  discovery of iteration 23 arriving a second time, and it is why this is one iteration rather
  than two. Read the loader before predicting this kind of thing, which is what "Phaser 4, not
  3" has been saying all along.
- **One builder, two consumers.** `atlasDataOf` is handed to `textures.addAtlas` by the
  renderer and printed into `ATLASES` by the exporter, so the canvas and the export cannot
  disagree about where a frame is. `textStyleOf`'s two-consumer argument, and the sharpest
  version of it yet: a disagreement about pixel coordinates is invisible in *both* outputs
  until somebody looks at the game.
- **`ATLASES` is a projection of `ASSETS`, not a second collection.** Unlike `TILEMAPS`, which
  is keyed by node, an atlas is a property of an image already in the asset table — so
  `collectAssets` and `usedIn` gained nothing, and `EmitContext` gained nothing. On the export
  checklist a table with no `collect*` beside it reads exactly like a missed step, which is
  why it says so here. It is gated on *something being cut by an atlas* rather than on the
  asset table being non-empty, or every project with a plain image would emit an empty
  `const ATLASES = {}` — which passes every test and breaks the byte-for-byte property every
  table before it has kept.
- **The clip emits its frames, and `generateFrameNames` is refused even though it is the
  obvious call.** Its runtime does the right thing — `prefix + Pad(frame, 0) + suffix` leaves
  a name alone — but Phaser types its config's `frames` as `boolean | number[]`, so the
  exported `.ts` does not compile under `--strict`, and the `create()` body is the same plain
  JavaScript in the `.ts`, the `.js` and the runnable page, so it can carry no cast. The
  answer is `Types.Animations.AnimationFrame` — `{ key, frame: string | number }` — which
  `anims.create` takes directly and which `EditorScene.syncAnimations` was *already* building,
  so the two halves of the feature now say the same thing the same way. A grid keeps
  `generateFrameNumbers`, unchanged to the character. **Only `export-toolchain.spec.ts` could
  have found this**: the emitted text is correct, the runnable page runs it, and the `.js`
  bundles.
- **`syncAnimations` needed nothing at all.** `texture.has(String(frame))` and
  `AnimationFrameConfig.frame` both already take a name, so the editor's half of the clip
  story is the type widening and no logic. Worth writing down, because a reader will come here
  looking for the branch the *exporter* has and find none.
- **`drawableFrame`'s fallback had to split.** A number falls back to `0`, which is what it
  has always done; a name cannot, because an atlas texture has no frame called "0" unless one
  happens to be named that — so it falls back to `texture.firstFrame`, Phaser's own answer to
  "some frame, certainly". This only shows up mid-decode, which is to say on a cold open,
  which is to say the path every real user takes and only a `reload` test reaches.
- **`animationKeyFor` stopped joining with a comma.** Joined, `['a,b']` and `['a', 'b']` are
  the same string, so an edit between the two would keep the old key, find it already
  registered and go on playing the animation built first. `JSON.stringify` is one word longer
  and removes the question; nothing outside that file reads the key.
- **The import accepts both packer shapes and stores one.** JSON Hash keys its frames by name
  and JSON Array carries a `filename` inside each record; they are one dropdown apart in the
  same tool, and refusing whichever a user's team picked is refusing a file that plainly is an
  atlas — `fontMimeOf`'s argument, one format over. Storing the file verbatim would be the
  `project.tilesets` mistake: the same facts in a second shape, with a parser at every read
  site rather than at the one write site.
- **A frame name reaches the output in three places and `str()` covers all three** — an
  object-literal key in `ATLASES`, a call argument (`add.image`, `add.nineslice`,
  `add.tileSprite`, the emitter config's `frame:`), and an `AnimationFrame` entry. Nothing new
  escapes: `generateRunnableHtml` still composes the whole script and escapes it once at the
  end, which is precisely the rule that exists so a newly added interpolation cannot be
  forgotten.
- **The Frame control changes shape, not range.** A grid's frame is a number with a top and a
  bottom, which a `NumberField` states; a name is an identity, and typed by hand it is wrong
  by one character and the object silently draws some other frame — so an atlas gets a
  `SelectField` of names. `FontPicker`'s argument without its free-text half, because unlike a
  font family a frame name is never something the machine might already have. A native select
  is also the one picker that gets an OS wheel under a thumb and stays one row however many
  frames there are, where a list of names would push the transform fields off a 390px sheet.
  The label stays exactly "Frame": nothing else in the panel is called that.
- **`formatFrameList` stops collapsing runs for names, and that is not a regression.** A range
  is arithmetic on indices; `hero_run_01-hero_run_04` would mean inventing a naming convention
  and reading it back, which is `generateFrameNames`' `prefix`/`zeroPad` scheme entering the
  document as a second way to say what a list already says — and it would only work on names
  that happen to be numbered. `parseFrameList` takes the asset's names as an argument rather
  than sniffing per part, so a half-typed list cannot disagree with itself halfway down.
- **A clip keeps its own order through a re-import.** `recutClipFrames` filters the *clip's*
  list rather than rebuilding it from the atlas, because the sequence is the thing the user
  authored and a repack that moved the rectangles did not reorder their animation. It also
  does not de-duplicate, where the grid branch does — that de-duplication exists only to undo
  the collisions clamping creates, and nothing in the atlas branch can create a repeat the
  user did not write, so `[a, b, c, b]` survives as the ping-pong it is.
- **`SCHEMA_VERSION` bumped to 11, on the silent-data-loss half of the rule and only that
  half — twice over, which is new.** There is **no crash half at all**: no new `NodeType`, so
  a v10 `createDisplayObject` has a case for everything in the file. What a v10 build does is
  drop `asset.atlas` in `parseAssets`' field-by-field rebuild *and* coerce every named frame
  to `NaN` in `parseAnimations`, dropping the clip entirely — two tables lost in one open. And
  what it leaves behind is worse than either: the nodes still name frames, `clampFrame` turns
  a name into 0, and the picture is wrong with nothing having said so. The v8 audio and v10
  font case at its worst so far. `atlas.spec.ts` asserts the 11 in the saved artefact.
- **Almost none of the "Adding a Phaser object type" checklist applies**, and listing which is
  half of what a reader needs — the typography case for the second time. There is no new type,
  so `NodeType`, `ADDABLE`, the colour chip, `PHYSICS_TYPES`, `createDisplayObject`,
  `constructorFor`, `localRectOf` and `editing.spec.ts` are all untouched. What this feature
  did instead was **widen an existing field's type across four node types and one table**,
  which is a compile error at every consumer — the closest thing to the union's own trick that
  a non-type change can get, and the reason the renderer and the exporter were mechanical.
  The steps that carried real risk were the silent ones, as always: the branch order in
  `syncTextures` and `buildPreloadBody` (an atlas has no grid, so a fall-through adds a
  one-frame texture and ships `load.image`, which boots and draws the sheet whole), the
  `ATLASES` gate, and `drawableFrame`'s fallback.
- **The suite's instruments are colour for *which* frame and extent for *what size*.** Colour
  is `animation.spec.ts`' instrument and separates a cut that reached Phaser's parser from one
  that reached the document only. Extent is the claim that proves this is an atlas at all: the
  fixture's frames have different aspect ratios, which is the one thing four grid numbers
  cannot describe, so an implementation that quietly fell back to a grid passes every colour
  claim and fails that one. The **ratio** is asserted rather than the pixels, because the two
  projects draw at different zooms and the claim is about the picture rather than the screen —
  and a centroid could not make it at all, since a two-pixel edge lands on a different
  sub-pixel phase on each side.
- **`tests/helpers/atlas.ts` builds the image and both JSON shapes from one array of
  rectangles**, which is `png.ts`'s, `wav.ts`'s and `ttf.ts`'s argument with one addition of
  its own: an atlas is *two files stating one fact*, and two fixture helpers free to disagree
  about where a frame is would be exactly the failure this feature's one-builder rule exists
  to prevent. `rectsPng` is `stripPng` generalised, and it exists because no fixture
  parameterised by a frame size can be a fixture for an atlas.

## Nesting

The schema always had `children`; iteration 4 made it load-bearing. A `container` node
renders as a Phaser Container, and **every node's transform is relative to its parent** —
for a top-level node the parent is the scene, so those still read as scene coordinates.

- **Reparenting keeps the object where it is on the canvas.** `moveNode` recomputes the
  stored transform against the new parent (`worldTransformOf` composes down the chain,
  `localTransformIn` inverts it) and rounds the result, so a node dragged into a group and
  back out again lands on the numbers it started with rather than 479.99999999999994. A
  parent that is both rotated and unevenly scaled composes a skew that no single transform
  can represent; the position stays exact and only the proportions shift.
- **Cycles are refused in the store, not in the UI.** `moveNode` rejects a parent that is
  the node itself or inside it — a cycle detaches a branch from the scene and cannot be
  rendered or serialised, and the tree drag, the inspector's Parent field and any future
  caller all go through that one guard.
- **A container has no size of its own, and its origin is not its centre.** Phaser gives
  it `width`/`height` only so it can have a hit area. `EditorScene.containerBounds` holds
  each group's box in its own local space, recomputed from its children every sync — which
  is why `syncNodes` is depth-first and applies children before their parent. The
  selection outline, the hit area and the scale handle all read that box through
  `localRectOf`, so they cannot disagree about where a group is.
- **The container hit area is offset, not centred.** Phaser measures a custom hit area from
  `-displayOrigin`, so `applyContainerBounds` shifts the rect by half the size; without
  that a group whose children sit to one side of its origin is grabbable everywhere except
  where it is drawn.
- **An empty group still gets a box** (`EMPTY_GROUP_SIZE`). A container with no children
  has no bounds at all, which would make the group you have just added invisible,
  unselectable and undraggable — exactly when you most need to grab it.
- **A group is selected from the scene tree, and dragged by its contents.** A press on the
  canvas selects the object actually touched, because a group's box is covered by the very
  children that give it one. Once the group *is* selected, `EditorScene.dragProxy` turns a
  press on any descendant into a move of the group: Phaser's `dragX/dragY` describe where
  the *child* would go, so the group instead follows the pointer's own displacement,
  measured in the space its position lives in. Without it a group could be selected but
  never moved on the canvas, which on a phone is most of what a group is for.
- **Gesture maths runs in the object's parent space.** `toParentSpace` inverts the parent
  container's world matrix; for a top-level object that is the identity, so the corner-scale
  code is the same at every depth. Phaser already reports drag positions in container-local
  space (see `InputPlugin`), which is why the plain drag handler needed no change.
- **Draw order is still array order — at every level.** `editSiblings` in the store is the
  one traversal that finds the list a node lives in, and raise/lower/duplicate/drag-drop
  all splice through it. Inside a container the list order is what renders, not `depth`
  (a child's depth only sorts it within its container), so the sync calls `moveTo`.
- **Adding lands in the group you are working in** — the selection when it is a group,
  otherwise whatever group the selection is inside. The second half is what makes filling
  a group work at all: adding selects the new object, so without it every add after the
  first would jump back out to the top level. Paste follows the same rule.

## Prefabs

A prefab is a piece of layout the project knows how to build, stored once and placed as
often as the user likes. `project.prefabs: Prefab[]` holds the definitions; a scene holds
`instance` nodes, and **an instance stores a reference and nothing else** — a `prefabId`
plus its own transform, name, visibility and alpha.

- **The contents are derived, never copied, and that is the whole design.**
  `prefabChildrenOf` is read at render time and at export time, so a definition edited once
  is edited everywhere, in every scene. There is no propagation traversal to write, nothing
  to keep in step, and no way for two placements to disagree — because there was only ever
  one copy. An instance that stored its own children would be a duplicate with extra
  bookkeeping, which is what copy/paste already is.
- **`prefabChildrenOf` is the only reader of `prefabId`**, the job `guidesOf` does for a
  scene's guides and `frameGridOf` does for an asset's sheet. A missing definition draws an
  empty instance rather than throwing — the treatment a sprite whose image is gone already
  gets, because one unreadable reference must not cost the user the rest of the scene.
- **A definition may not contain an instance, and `prefabChildrenOf` strips any it finds.**
  That is the entire cycle story: prefab A containing an instance of A is two id strings, an
  infinite recursion in the renderer and an emit with no valid order in the exporter, and a
  hand-edited file can hold one whatever the store refuses to build. Answering with a tree
  that contains no instances at all means **nothing downstream needs a depth cap, a visited
  set or a termination argument** — the recursion is finite because the data is. A cap was
  the alternative and is worse: it renders a truncated scene with nothing saying so, and it
  does not help the exporter at all.
- **The store refuses to build one too** — `createPrefabFromSelection` and
  `updatePrefabFrom` both check `containsInstance` — so the strip only ever fires on a file
  the editor did not write. The inspector disables the button and says why, rather than
  offering something that silently does nothing.
- **`SCHEMA_VERSION` bumped to 5, for both halves of the rule at once.** `parseProject`
  names the project's fields one at a time, so a v4 build drops the whole library on open
  and re-saves without it — the `animations` case. *And* `createDisplayObject` has no
  `'instance'` case in a v4 build, so it leaves the object undefined and crashes — the
  `container` case. Either alone would have bumped it. Guides remain the counter-example.
- **The renderer keys display objects by a *display key*, not a node id.** A prefab's child
  ids are shared by every instance of it, so two coins on screen would fight over one map
  entry. `syncNodes` threads a prefix: `''` for scene nodes, so every existing key is
  unchanged, and `` `${instanceKey}/` `` for what an instance draws. Prefix concatenation
  composes to any depth, which is what makes a container nested inside a definition work
  with no further code. `containerBounds` is keyed the same way — `localRectOf` reads a
  group's measured box back through `getData('nodeId')`, so a container inside a definition
  needs its box under its own key or the two instances share one.
- **`nodeId` on a display object therefore means "the key this object is stored under".**
  For every scene node the two are the same string, so nothing changed; only a derived child
  makes them differ.
- **Derived children are never made interactive, and that is what makes the key
  redefinition safe.** With no input on them `GAMEOBJECT_DOWN` can never fire for a key that
  names no node — so a press cannot call `select()` with a string the document has never
  heard of, which would have silently *cleared* the selection. It also means a press on a
  prefab lands on the instance's own container hit area: an instance is grabbable over its
  whole box, where a group is deliberately grabbed by its children, and on touch the first
  tap selects it rather than something inside it. An instance is easier to move with a thumb
  than a group is, and `dragProxy` never applies to one.
- **A prefab's contents drop out of the snap targets and the angle targets on their own.**
  Both loops resolve each display key through `findNode` and skip what they cannot find.
  That is the right answer rather than a lucky one — an instance snaps as one object,
  because one object is what it is. `publishMeasuredBounds` is the one place that needed
  saying explicitly, through `documentKeys`, because it publishes rather than filters.
- **Editing a definition is "update this prefab from this group", not a mode.** A group's
  own frame *is* an instance's frame, so its children's transforms transfer with no
  arithmetic at all: `updatePrefabFrom` is `node.children.map(cloneWithNewIds)` and nothing
  else. Detach an instance, edit it with every tool that already exists, push it back. A
  prefab editing mode would have needed `activeScene`/`editScene` to grow an editing-context
  notion that every action and every `useActiveScene` consumer flows through, to be a second
  place to do the same thing.
- **`detachInstance` keeps the node's id.** The selection therefore survives the change with
  no `select()` call, and `syncNodes` already rebuilds an object whose `nodeType` changed, so
  the renderer needs no special case for the flip. A dangling instance detaches to an empty
  group, which is honest rather than a failure.
- **`removePrefab` detaches every instance first, in the same undo step.** `removeAsset`
  settled that the document may never hold a dangling reference by any action in the editor,
  and here — unlike an image, where there is no local copy of the bytes — detaching keeps
  everything that was on the canvas. Refusing while in use would be the only action in this
  codebase that says no because of a count, and would leave the user hunting instances across
  scenes with no tool for finding them.
- **`mapProjectNodes` walks the prefab bodies as well as the scenes**, which is
  `mapProjectSprites`' sibling and keeps the same array-identity discipline for the same
  reason. It walks definitions because it has to reach an instance nested in one — which a
  well-formed document does not have, but a file the editor did not write does, and deleting
  a prefab must clean those up too.
- **The export is one factory function per placed prefab, and one call per instance.** That
  is the actual point of a prefab in code: twenty coins is twenty lines, not twenty copies of
  a coin. `constructorFor`'s `'instance'` case is a call rather than an `add.*`, and because
  the factory returns the Container, every existing modifier — `.setAngle`, `.setScale`,
  `.setAlpha`, `.setVisible`, the following `setName` — applies to it exactly as it does to a
  group.
- **Factory names are allocated from the *module's* identifier set before anything else
  draws from it, and every function body's set is seeded with all of them.** Both halves
  matter. An object named "create coin" inside `create()` would otherwise bind `createCoin`
  and shadow the function the instance call beside it is trying to reach — it would call the
  container. Inside a factory body the seed also carries `scene`, `x`, `y` and `root`, since
  an object in a definition named "scene" would shadow the thing the body adds to.
- **`collectAssets` and `collectAnimations` descend into the definitions of placed prefabs**,
  through `emittedNodes`. Without that a prefab full of sprites exports the "no image chosen
  in the editor" stand-in for images that *are* chosen — an export that looks right, boots,
  and draws nothing. The hostile project puts a sprite inside its prefab for exactly that
  assertion.
- **An instance is a leaf row in the scene tree.** Its contents are in no array the scene
  holds, so there is nothing there to select, rename, reorder, hide or drag — a read-only
  subtree would be rows rejecting every interaction the rows above them accept, and on a
  390px screen it would bury the scene under a prefab's internals. The inspector's use count
  says the same thing without lying about it.
- **`instance` is deliberately absent from `ADDABLE`.** It has to name a prefab, and a
  `+ Instance` button could only produce one pointing at nothing. This is one of the two
  silent steps in "Adding a Phaser object type", and here the correct answer looks exactly
  like having forgotten it — hence the comment in the file.
- **The prefab list lives in the Scene panel, and every button keeps its `+ ` prefix.**
  The scene panel is always on screen, while the inspector's `SceneInspector` appears only
  with an empty selection — so putting placement there would mean a deselect first, every
  time. A fourth mobile tab would cost a `MobileTab`, a sheet, a `SHEET_TITLE` and a quarter
  of a 390px tab bar. The prefix is not decoration: the tab bar's labels are single common
  words matched *exactly*, so a prefab a user names "Scene" would otherwise be a second
  button reading exactly "Scene" — the trap that once took out seventeen mobile tests.
- **The clip's field is labelled "Prefab name" for the reason the clip's is "Animation
  name".** The object's own Name field is a few rows up the same panel, and this one is the
  definition's, shared by every instance — and the factory function's name in exported code.

### The library's own controls

Iteration 43 put each definition's rename and delete in the scene panel's library, beside the
place buttons, because until then they lived only on a placed instance's panel — and a prefab a
rule's `spawn` builds is placed nowhere. There was no way to rename the exported factory or
delete the definition without placing one first, and the suite said so in a comment.

- **No document change at all**: no schema, no reader, no exporter, no `EditorScene` edit and no
  `SCHEMA_VERSION` question. Both controls go through `renamePrefab` and `removePrefab`, which
  already existed, so a delete from the library detaches instances and strips spawn actions
  exactly as the inspector's does — one store action, two buttons.
- **Behind one `Manage prefabs` toggle, not always open.** The scene panel is on screen at all
  times and on a phone sheet the tree sits under it; three rows per prefab would push every
  object down for an action taken a handful of times a project. A per-prefab button in the
  place grid was the other shape, and a grid cell cannot hold a card. The open state is local
  `useState`, like the tree's collapsed groups — never saved, never undoable, not persisted.
- **The field is `Prefab <n> name`, never the inspector's `Prefab name`.** On desktop both panels
  are on screen together, so with an instance selected both fields are visible at once and an
  exact label would name two of them. Indexed, as `Variable <n> name` and `Rule <n> name` are.
  One field, two controls — the tile eraser's rule.
- **The delete is `Delete prefab <name>`.** The inspector's is a bare `Delete prefab` and the
  tree's rows are `Delete <object>`, so a named one collides with neither under exact matching
  (`Delete layer <x>`'s rule). No confirm, matching the inspector's: it is one undo step.
  Because the name is free user text, `.prefab-card .btn` ellipsises rather than letting a long
  one run through the button's border.
- **`prefabRemovalSummary` is the one sentence for both delete buttons' titles.** It is exported
  from `SceneTree.tsx` and imported by `InstanceSection`, so the two cannot drift apart about a
  press that detaches instances and removes rule actions.
- **The usage hint has a third case that matters most**: "Placed nowhere and built by nothing".
  A definition in that state is dead weight in the export's factory list, and this is the one
  place in the editor that can say so. Both counts are plain numbers, so they are selected
  directly: `countPrefabUses` and `countPrefabSpawns` are *not* the `tileMapOf` trap.
- **The suite reaches the library through `EditorPage.managePrefabs`, `setLibraryField` and
  `deletePrefabFromLibrary`**, and `labelled` now takes a panel defaulting to `'inspect'`, so
  `field()` stays inspector-scoped for every existing caller. `rules.spec.ts`' "deleting the
  prefab takes the spawn" test lost its place-then-delete workaround and now deletes a prefab
  that was never placed, which is the claim the hole was about.

## Scenes

`project.scenes` has been an array since the first iteration and `activeSceneId` has
always named one entry of it; iteration 13 let a second entry exist. Almost nothing had to
change for that, which is the point of the shape — `activeScene`, `withActiveScene` and
`useActiveScene` were already the only readers.

- **Switching scenes is a document edit, not an editor preference.** `activeSceneId` is
  saved with the file, so a project reopens on the scene it was left on, and the switch is
  undoable because it is part of the document. That is what makes undo legible across one:
  an edit made in another scene is undone *with* the jump back to the scene it happened
  in, rather than silently somewhere the user cannot see. It also means switching marks
  the file dirty, which is honest — the saved bytes differ.
- **Nothing clears the selection on a switch.** `editProject` prunes it against the scene
  that is now active and no id from the old one survives that, exactly as for a delete.
  The invariant does the work; a `select(null)` here would be a second place to remember.
- **The renderer needed one line.** `syncFromStore` reads `activeScene` and diffs display
  objects against it, so a switch destroys every object of the old scene and builds the
  new one with the machinery that was already there. The one thing the diff cannot see is
  the *camera*: it belongs to the scene that is gone, so `drawnSceneId` notices the change
  and re-fits. A pan over the corner of a 1920-wide level is off the edge of a 480-wide
  menu, on a canvas that would then be empty for no visible reason.
- **`SCHEMA_VERSION` did not bump, and this is the guides case rather than the prefabs
  one.** The rule is "would a deployed older build break on this file", and a v5 build
  does not: `parseProject` passes `scenes` through verbatim and validates `activeSceneId`
  against that array, so an old build opens a two-scene file on the same scene, draws it
  identically, and carries the other one back out on a re-save. Nothing is dropped and
  nothing is undefined. `scenes.spec.ts` asserts the current version in the saved artefact so a future
  bump is a deliberate act. **This stays contingent on `parseProject` not reconstructing
  the scenes field by field**, exactly as the guides decision is.
- **The switcher is in the scene panel; duplicate and delete are in the inspector.** The
  scene panel is on screen at all times while `SceneInspector` appears only with an empty
  selection, so a switcher there would mean deselecting before every switch — the argument
  that already put the prefab list in that panel. The two destructive actions go the other
  way on purpose: they are about the scene you are *in*, they sit under its own name and
  size fields, and a delete button in a row of chips you tap to switch is a delete button
  one thumb-width from the wrong target.
- **A chip's accessible name is `Switch to <name>`, not the scene's name.** The mobile tab
  bar's labels are single common words matched *exactly*, so a scene a user calls "Scene"
  would otherwise put a second button reading exactly "Scene" on the page — the trap the
  prefab buttons' `+ ` prefix exists for, arriving by a different route because a chip has
  no prefix to give it.
- **The switcher row hides itself for a one-scene project**, since there is nothing to
  switch to, but `+ Scene` stays: it is the only way to reach the second one.
- **`removeScene` refuses the last scene.** A project with no scenes has no active scene
  for every panel that reads one, nothing to draw, and `parseProject` rejects the file it
  would save. "Delete the only scene" means "empty it", which the tree's row buttons do.
- **`duplicateScene` gives the copy fresh node *and* guide ids.** Two scenes sharing a node
  id would have `findNode` answer with whichever it reached first, and the renderer keys
  display objects by that id.
- **The export emits every scene, and the tables are file-wide.** A game's scenes are
  registered together and start each other by key, so an export carrying only the one on
  screen would be a game with nowhere to go. `prepare` builds the class names, the prefab
  factories, the `ASSETS` table and the animation keys once for the whole file — a
  second scene drawing the same sheet adds nothing to any of them, which is the same "one
  definition, many placements" property a prefab has, one level up. `usedIn` then answers
  what *one* scene has to preload and register: a menu that loads the whole game's artwork
  is a menu that waits for it, and a scene that registered a clip over a texture it never
  loaded would throw in `generateFrameNumbers` before drawing anything.
- **Scene names are de-duplicated twice over.** A name reaches the output as a class
  declaration *and* as the key handed to `super()`, and a repeat is fatal in both: two
  `class Main` in one module will not parse, and two scenes under one key has Phaser's
  manager keep the first and lose the second. Class names come out of the module's
  identifier set before the prefab factories draw from it, the rule the factories already
  followed for object bindings.
- **`anims.create` is guarded by `anims.exists`.** An animation belongs to the *game* while
  `create()` belongs to a scene and may run more than once against it — two scenes playing
  one clip, or a scene restarted, which is the ordinary way a game returns to its menu.
  This is the one place a single-scene export changed shape, and it was already wrong
  there.
- **The scene being edited is the module's default export and the page's boot scene**,
  with the rest registered after it. It is the scene the user was looking at when they
  pressed the button, and it is document state, so the same project exports the same way
  for anyone who opens it.
- **Nothing in the editor starts one scene from another.** That is a line of game logic
  rather than a piece of layout, and the document has no place to put it that would not be
  the beginning of a scripting model.

## Tilemaps

A `tilemap` node is an ordered list of layers of tile indices, drawn as real
`Phaser.Tilemaps.TilemapLayer`s, so what the canvas shows is what the export builds. Two
decisions carry the rest of it, and a third — see "Tilemap layers" below — arrived in
iteration 25.

- **A tileset is an image that has already been sliced, and there is no tileset type.**
  `ImageAsset.sheet` is the four numbers `addTilesetImage` takes, under the same names,
  for the reason `load.spritesheet` is handed them near-verbatim — so a tile index *is* a
  frame index, `SheetSection` is the tileset cutter with no new UI, the grid folded into
  the texture key already handles a re-cut, and `preload()` already emits the right load
  call. A
  `project.tilesets` table would be those same four numbers in a second place, free to
  disagree with the first, plus a parser and a picker.
- **A tileset is still a grid, and an atlas cannot be one.** `addTilesetImage` needs a
  uniform tile size and an atlas is the absence of one, which is Phaser's limit rather than
  this editor's. It cost no code: `frameGridOf` answers null for an atlas-cut image, so
  `tilesetKeyFor`, `tileMapOf`, the tileset gate in `collectAssets`, `collectTilemaps` and
  `TilePalette` all already refuse one. Only the *wording* changed — worth saying, because
  on this list "already covered" and "forgotten" read the same.
- **The tile size is derived from the tileset, never stored on the node.** The argument
  that put the frame grid on the image, and the argument for a sprite having no width or
  height: two maps drawing one tileset cannot disagree about how big a tile is.
  `FALLBACK_TILE` covers "no tileset chosen yet".
- **`tileMapOf` is the only reader of `TilemapProps`**, in the `frameGridOf` / `guidesOf` /
  `prefabChildrenOf` family and for the sharpest version of their reason: four questions —
  is there a tileset, how big is a tile, is `data` the length the grid claims, is every
  entry a frame that exists — and any one of them forgotten is a Phaser warning and a
  missing-texture cell. It answers all four at once, so the renderer, the exporter, the
  palette and the paint gesture cannot disagree.
- **A tile the tileset does not have reads as empty, not as the nearest one it does.**
  The opposite of `clampFrame`, deliberately: a sprite cannot show "no frame", so clamping
  is the only answer there, while `-1` is a first-class value here and Phaser's own. It is
  what lets a re-cut leave the document alone — the map blanks while the sheet is mid-edit
  and comes back whole when the numbers are right again, where rewriting the stored indices
  would throw a level away over a mistyped margin. `tilemap.spec.ts` asserts the round trip.
- **`data` is flat and row-major, and `cloneWithNewIds` copies it.** Flat because it is a
  third of the JSON of an array of arrays and one thing to copy rather than one per row —
  and it is the first props field that is an array at all, so the shallow spread every
  duplicate, paste and prefab goes through had to learn about it.
- **`resizeTilemap` re-shapes row by row, and `tileMapOf`'s padding is only the
  hand-edited-file backstop.** Reinterpreting a flat array under a new column count shifts
  every row after the first, so the re-shape has to happen in the same step as the number
  that causes it. That is why it is an action rather than two `updateProps` calls.
- **`SCHEMA_VERSION` bumped to 6, on the crash half of the rule and only that half.** A v5
  build has no `'tilemap'` case in `createDisplayObject`, so it leaves the object undefined
  and its renderer crashes — the `container` and `instance` case exactly. Nothing else
  about the feature needs it: a tileset is an ordinary sliced image, and the node's props
  ride in on `scenes`, the one part of a file `parseProject` passes through verbatim.
- **The renderer rebuilds on a *shape* change and diffs on a *data* change.** A Phaser map
  fixes its dimensions, tile size and tileset when it parses one, so any of those changing
  is a new map rather than a changed one — `textureKeyForAsset`'s argument one object over.
  Folding a signature into a `nodeShape` data key means `syncNodes`' existing "the type
  changed, rebuild it" branch does the whole job. Tile *contents* are deliberately not in
  the signature: `applyNode` compares against `tileData`, a cache of what was last drawn,
  and calls `putTileAt` only for the cells that differ. A stroke publishes a store change
  per pointer-move, so re-putting 65,536 tiles each time is the gesture's whole budget.
- **A `Tilemap` is not a display object, so the sync's prune never reaches one.** That is
  what `destroyDisplayObject` is for, and why both the prune and the rebuild branch go
  through it — the `assetTextures` / `animationKeys` bookkeeping, third time.
- **A tilemap layer's origin is its top-left**, where everything else here is centred.
  `localRectOf` has the one case for it, and the outline, the hit area, the scale handle,
  the rotate knob and the published bounds all read the box back through that function, so
  there is one place the difference is expressed.
- **A map with no tileset still gets a texture**, `editor:no-tiles`, the
  `PLACEHOLDER_TEXTURE` rule one level over: an unfinished map has to be selectable,
  draggable and paintable, and giving the empty case a texture rather than a branch means
  "no tileset yet" and "the tileset is gone" are one state and one code path.
- **Paint mode owns the canvas, and that is why it is a mode.** While `paintingId` is set a
  press lays a tile and does nothing else: `GAMEOBJECT_DOWN` does not select, `POINTER_DOWN`
  does not pan, `DRAG_START` refuses outright (the `additivePress` refusal by another
  route), the handles are hidden and the selection shortcuts are off. Without a mode a
  selected tilemap could never be moved or resized on the canvas again, and on touch the tap
  meant to pick some other object would lay a tile.
- **A stroke is one transaction, and the stroke state is cleared before it closes.** History
  is whole-project snapshots, so an ungrouped per-cell paint is the held-arrow-key problem
  with a faster finger; and the clear-before-`endTransaction` order is the `draggingId`
  trap, which here would leave a stroke's last cell visually stale.
- **A stroke fills in the cells between two pointer samples.** A finger crossing a map lands
  a move every several tiles, and painting only where the samples fall leaves a dotted line
  — which on a phone reads as dropped input rather than as the frame rate it is.
- **`paintingId` is pruned where the selection is**, in `editProject`, `undo` and `redo`, so
  "you can only paint a map that exists and is on screen" is an invariant rather than
  something delete, undo and the scene switcher each have to remember.
- **The bar over the canvas is the palette that has to work; the inspector's is the
  convenience.** On a phone the Properties sheet covers the canvas being painted, so
  choosing a tile and placing it could never be seen at once. The bar takes the move bar's
  slot and shape, the two are never on screen together, and unlike the move bar it is on the
  desktop too — the way out of a mode belongs on the surface the mode has taken.
- **The eraser is the same field from two controls, not two answers to one question.** The
  palette's erase cell and the bar's toggle both write `erasing`; what would be wrong is a
  second notion of what the brush is.
- **The export is one module-level helper plus a `TILEMAPS` table.** `constructorFor` may
  only answer with a single expression and a tilemap is three statements, so it takes the
  route `instance` already took: emit a function, return a call to it. The name comes out of
  the module's identifier set right after the prefab factories, by the rule they follow, and
  every factory body's seed set carries it. The data goes in a named const for `ASSETS`'
  reasons — `create()` stays a list of objects rather than a wall of numbers, and moving a
  level out to a JSON file is one object to edit.
- **`collectAssets` and `usedIn` both had to learn about a tileset**, and they are separate
  on purpose: the first decides what the texture is called across the file, the second what
  *this* scene preloads. Missing either gives a layer built on a texture the scene never
  loaded, which throws before anything is drawn. Only a *sliced* image is collected, because
  an unsliced one exports a `missingReason` comment rather than a layer, and loading bytes
  for a texture nothing draws is the failure the sprite case already warns about.
- **A tilemap node cannot be selected out of a `TileMap` in a zustand selector.**
  `tileMapOf` builds a fresh object every call and zustand compares snapshots by identity,
  so `useEditorStore((s) => tileMapOf(...))` is an infinite render loop — React error #185,
  found the first time the suite ran. Select the project and derive outside the selector, or
  reach for `useShallow` the way `useSelectionNodes` does.

### Tilemap layers

`TilemapProps.layers: TilemapLayerDoc[]` is the level, back to front: one tileset, one
grid, and as many passes over it as the user wants. It is iteration 14's first deliberate
hole closed, and it is the first feature here to close one by *nesting* an existing prop
rather than by adding a type or a table.

- **The tileset and the grid stayed on the map; only the tiles and the walls moved.** That
  split is the one this whole file keeps making: the tile size is *derived* from the
  tileset, so a per-layer tileset would let two layers of one map disagree about how big a
  cell is — the second field over one number that `ImageAsset.sheet` and a sprite's missing
  width both exist to refuse. The payoff is that `collectAssets`, `usedIn`,
  `countAssetUses`, `removeAsset`, `recut` and `tilesetKeyFor` needed **no edit at all**,
  which on this checklist reads exactly like a step that was forgotten.
- **`collides` moved to the layer, and iteration 20 had already written the sentence that
  says why.** Arguing solidity onto the node rather than onto the asset, it said: *"one
  tileset is a wall in the level and scenery in the layer behind it."* That described a
  feature that did not exist. It does now, and it is the whole of the argument — it is the
  nine-slice insets' call again, one level in.
- **`tileMapOf` is still the only reader, and it carries the migration.** It answers seven
  questions now rather than five, and the new pair are "does this map have layers at all,
  or is it a file written before they existed" and "is every layer id usable". A pre-v12
  grid becomes one layer called `Layer 1` under `LEGACY_LAYER_ID` — a *constant*, because a
  derived id has to be stable across calls: React keys and the store's `activeLayerId` both
  hold it. Ids are also de-duplicated there, since a hand-edited file repeating one would
  have a press on one row edit another.
- **Each layer's `data` and `collides` keep their identity; the layer objects do not.**
  Three caches read the first — `applyNode`'s per-layer tile diff, `drawPaintGrid`'s
  signature gate, and the store's "nothing happened, no undo step". Nothing compares the
  second, so building fresh layer objects per call costs nothing. `tileMapOf` is still React
  error #185 in a selector, for the eighth time.
- **The document holds one shape, and `editTilemapProps` is where that becomes true.**
  Every write deletes the pre-v12 `data`/`collides` pair, whether or not the patch named
  `layers` — `setAssetSheet` and `setAssetAtlas` deleting each other's field, one type over.
  `editTilemapLayer` is its sibling rather than a fifth argument to it, because a
  `Partial<TilemapProps>` merged at the top level cannot say "patch layer N".
- **`resizeTilemap` fans out over every layer in the one step.** That is the same argument
  that made it an action rather than two `updateProps` calls, N times over: reinterpreting a
  flat array under a new column count shifts every row after the first, so a resize that
  reached only the layer being painted would leave the rest silently sheared.
- **`activeLayerId` lives beside `paintingId` and is pruned with it.** Editor state, not
  saved, not undoable. It has one more way to go stale than the mode does —
  `removeTilemapLayer` can take the layer out from under it without touching the node — and
  null is a legal answer, since `tileLayerOf` reads it as the frontmost. That is why nothing
  downstream ever has to guess a replacement.
- **`removeTilemapLayer` refuses the last layer**, which is `removeScene`'s rule for
  `removeScene`'s reason: a map with no layers has nothing to paint on and nothing for
  `tileLayerOf` to answer with. "Delete the only layer" means "empty it", which the Clear
  button already does. The button is disabled and says why rather than doing nothing.
- **The renderer wraps the layers in a Container; the exporter emits them as siblings. That
  disagreement is deliberate and each side is right for its own reason.** In the editor a
  node is one entry in `displayObjects`, so several drawn things need something to hold
  them — the particles wrapper exactly, safety argument included: `syncNodes` recurses into
  a container *by node type*, so nothing walks into this one and `reparent`'s index
  assertion never sees it. In the export a `TilemapLayer` *is* what Arcade collides against,
  so a collider naming the map has to name a layer; a wrapper would leave it with a
  Container and nothing to bind to. Siblings are also created in sequence, which is exactly
  the display-list order the layer order asks for.
- **The Container would have broken `localRectOf`, and the fix was to reuse rather than to
  branch.** A tilemap layer's origin is its top-left where a Container's box is centred, so
  `applyNode` publishes the map's known box into `containerBounds` through
  `publishContainerBounds` — the half of `applyContainerBounds` that does not measure. The
  outline, the hit area, both handles, the published bounds and the snapping all keep
  reading one function, and the half-size hit-area shift stays written once. A second copy
  of that shift is a second chance to get the sign wrong, and a wrong sign is a map
  grabbable everywhere except where it is drawn.
- **`tilemapSignatureOf` gained the layer ids in order, and nothing else.** A layer added,
  removed or moved is a different set of Phaser maps rather than a changed one, so
  `syncNodes`' existing "the shape changed, rebuild it" branch does the whole job. Tile
  contents and `visible` stay out: both are in-place setters, and folding either in would
  rebuild the stack on every stroke.
- **`buildTilemapHelper` was not touched by a character**, which is the part of iteration
  14's prediction that turned out to cost nothing: it already builds one map with one layer
  and returns it, and that is one document layer. `constructorFor` emits the *first* layer
  exactly as it always did, and `emitNode` emits the rest beside it — so a map with one
  layer exports byte for byte what it exported before. The first layer's `TILEMAPS` key is
  still `toIdentifier(node.name, …)`; the rest take the node's name and theirs.
- **`emitNode` now answers with a list of bindings rather than one.** Everything but a
  tilemap emits exactly one and its callers read `[0]`; the container `add([...])` list and
  a prefab factory's `root.add` take all of them. A collider row naming a tilemap emits one
  line per layer, because a layer collides through its *own* solid tiles — a row that named
  only the first would have the walls stop nothing the moment they were painted on the layer
  above the floor. `collidersOf` already refuses two tilemaps, so at most one side is ever
  longer than one.
- **A hidden layer is still built and still collides.** Visibility is about drawing, exactly
  as it is for a hidden node whose Arcade body is emitted all the same. `setVisible(false)`
  is its own statement rather than part of the chain, because the chain is `modifiersFor`'s
  and belongs to the node.
- **The layer list is in the inspector; the layer picker is on the paint bar.** The brush
  already splits that way and for that reason: on a phone the Properties panel is a sheet
  over the canvas being painted, so switching from the floor to the walls and then placing a
  tile could never be seen at once. Layers are deliberately **not** rows in the scene tree —
  a layer is not a `GameObjectNode`, and the tree's twisty, drag-to-reparent, selection and
  delete are all built on nodes, so a layer row there would reject most of what the rows
  above it accept.
- **Listed in array order, front-most last**, which is the scene tree's rule and for its
  reason: the array order *is* the draw order, and showing it front-first would put an index
  flip between every press and the store. The bar's sheet reverses it, because that list is
  read top-down under a thumb rather than as the document.
- **Every accessible name carries "layer" or the verb it needs** — `Paint on <layer>`,
  `Hide layer <layer>`, `Delete layer <layer>`, `Move <layer> forward`. The tree already owns
  `Hide <name>` and `Delete <name>` and the palettes own `Tile N` and `Erase tiles`, and the
  suite matches a name exactly: a layer called the same thing as an object would otherwise
  put two identical buttons on the page. The prefab buttons' `+ ` prefix rule, a fourth time.
  `pickLayerInBar` scopes to the bar sheet's own group for the same reason — on desktop the
  inspector is not hidden, so both controls are on the page at once, which is the point of
  them writing one field.
- **The stroke fixes its layer at `beginPaint`**, the way the moving set is measured once at
  `DRAG_START`: a gesture is about one thing, and a layer switched mid-stroke would have one
  drag write two arrays inside one undo step.
- **`SCHEMA_VERSION` bumped to 12, on the silent-data-loss half of the rule and only that
  half — and it is the worst instance of it so far.** No new `NodeType`, so a v11
  `createDisplayObject` has a case for everything in the file. What a v11 build does is read
  `props.data` as `undefined`, have `tileMapOf` pad it to a grid of `EMPTY_TILE`, draw an
  empty map, and re-save the file that way — every layer of every level gone. The v10 font
  case and the v11 atlas case both left something visibly wrong; this one leaves a map that
  is merely empty, which is indistinguishable from one nobody has painted yet.
- **The suite's instrument is colour, and the claims are about *which* layer.** The fixture
  gives every tile a solid colour of its own, so "the second layer draws over the first",
  "hiding one shows what is under it" and "moving one back swaps them" are each one centroid
  and one count. The resize claim is the sharp one: it hides a layer, resizes, and then shows
  it — which is the only way to see that the layer the panel was *not* about was re-shaped
  too.

## Nine-slice panels and tile sprites

Two ways to draw one image at a size that is not its own. A `nineslice` is a real
`Phaser.GameObjects.NineSlice`: four insets divide the texture into corners, edges and a
middle, and only the middle and the edges stretch. A `tileSprite` is a real
`Phaser.GameObjects.TileSprite`: the texture repeats to fill a box, with a scroll offset
and a tile scale of its own. Neither adds any architecture — they are the "Adding a Phaser
object type" checklist run twice, silent steps included — so what is worth writing down is
where each one's fields live and why.

- **Both have a width and a height, where a sprite deliberately has neither.** That is not
  an inconsistency, it is the whole point of them. A sprite has no size because scaling one
  *is* scaling the picture, so a display size would be two fields fighting over one number.
  Here the box and the picture that fills it are genuinely two facts: a panel is made wider
  without its corners getting wider, and a tile sprite is made wider by fitting more
  repeats in. The transform's scale still means what it always did — it stretches the box
  and everything in it — which is why the inspector's fields are "Width"/"Height" and "Tile
  scale X/Y" and never a bare "Scale".
- **The insets are on the node, and this is the one place the feature contradicts
  `ImageAsset.sheet`.** A frame grid is a property of the *bytes*: it decides how many
  frames an image has, and two sprites drawing it must not disagree about that. An inset
  decides nothing about the image — one 64px rounded-corner texture is a dialog frame with
  16px corners and a health bar with 4px ones — and nothing downstream indexes an inset the
  way a tile index indexes a frame. So it belongs to the *use*, which is the call
  `SceneSound`'s `loop` and `volume` already made.
- **The insets are measured against the node's own frame**, which since iteration 24 means
  a *named* frame of any size rather than a grid cell. `frameSizeOf` was factored out of
  `sliceInsetsOf` for that, and a trimmed atlas frame answers with its untrimmed size,
  because that is what Phaser's `Frame.width` is and therefore the box the slice is cut
  against.
- **`sliceInsetsOf` is the only reader**, in the `frameGridOf` / `tileMapOf` / `guidesOf` /
  `physicsOf` / `soundsOf` / `cameraOf` family and answering three questions at once: is
  there a source to measure against, how big is one *frame* of it, and do these four
  numbers fit. Phaser needs `left + right` to be no wider than both the frame they are cut
  from and the box they are drawn into — exceeding the frame samples pixels that are not
  there, exceeding the box overlaps the corners and draws the panel inside out. The
  opposing pair is scaled down together against whichever limit binds, so a panel narrowed
  below its own corners degrades rather than breaks. It builds a fresh object per call, so
  `useEditorStore((s) => sliceInsetsOf(...))` is React error #185 — the `tileMapOf` trap,
  fifth time.
- **Three-slice is free and gets no field.** Phaser reads `top === 0 && bottom === 0` as a
  horizontal-only slice, which is exactly what a progress bar wants. A mode switch would be
  a second answer to what the four numbers already say.
- **Both draw `PLACEHOLDER_TEXTURE` with no image**, which is its argument for the fourth
  and fifth time: "no image chosen", "the image is gone" and "the image is still decoding"
  stay one state and one code path. Phaser 4's TileSprite builds its repeat with
  `createPattern` at frame size rather than a WebGL wrap, so the placeholder's non-power-of-
  two 96px is not a problem and needs no stand-in of its own — that was a real concern under
  Phaser 3 and is worth knowing before anyone adds one back.
- **Neither is in `localRectOf`, `hitAreaFor` or `applyHitArea`, and that is not an
  omission.** Both are centred, sized game objects with Origin and ComputedSize, so the
  existing `-width/2, -height/2` box is already right; a tilemap layer's top-left origin
  stays the one exception in the `Renderable` union. Said in a comment there, because here
  "no branch needed" and "forgot a branch" look identical.
- **Both are in `PHYSICS_TYPES`, which is the fourth silent step.** Arcade reads `x`, `y`,
  `width` and `height` off either exactly as it does off a rectangle, and a panel or a
  repeating wall is the kind of thing a platformer stands on. Nothing anywhere fails if a
  type is left out of that list — it is simply never offered a body, which looks like a
  decision. The hostile project's tile sprite carries a static body for exactly that.
- **The renderer rebuilds on a texture change and applies everything else in place.** A
  nine-slice builds its vertices and a tile sprite its fill pattern when they are
  constructed, so re-pointing either at another image or another frame is a new object
  rather than a changed one: `shapeOf` folds `textureKey:frame` in and `syncNodes`' existing
  "the shape changed, rebuild it" branch does the rest, exactly as it does for a tilemap.
  Size, insets, offset, tile scale, tint and alpha are all in-place setters and deliberately
  *not* in the signature — otherwise every keystroke in the inspector would rebuild the
  object, which is the emitter's `setConfig` argument arriving by the other route.
- **`setSlices` sets the size and the four insets in one call, and has to.** `setSize`
  alone leaves the slice geometry built for the old box, so a widened panel stretches as if
  it were an image — which is precisely the failure the type exists to avoid, and precisely
  the one that looks like the feature not being implemented at all.
- **`drawableFrame` was factored out of the sprite case rather than copied.** All three
  types resolve a document frame index against the texture *actually loaded*, which
  disagrees with the document for as long as a decode is in flight.
- **Neither type can animate, and that is a fact about Phaser rather than a list that could
  go stale.** A `NineSlice` and a `TileSprite` carry no AnimationState, so `collectAnimations`
  and `usedIn`'s animation half gained nothing and say so in comments.
- **The export is two ordinary `add.*` calls**, so neither takes the module-level-helper
  route a tilemap and an instance had to — both are single expressions. The panel's ten
  arguments are emitted whole, insets included, because they only mean anything beside each
  other and beside the box they are cut against: the emitter config's call and the physics
  body's, deliberately unlike `modifiersFor`. The tile sprite's offset and tile scale are
  the opposite, and by the same reasoning — `add.tileSprite` has nowhere to take them, so
  they are `modifiersFor`'s first new branch since sprite, emitted only when they differ
  from a plain repeat.
- **`collectAssets` collects both unconditionally**, on the emitter's reasoning rather than
  the tileset's: an unsliced image is a perfectly good source for either, since frame 0 of a
  one-frame texture is the whole picture. There is nothing here for a grid to gate.
- **`missingReason` needed no edit at all**, since its catch-all already says the true thing
  about both — worth stating, because on that checklist "already covered" and "forgotten"
  read the same.
- **`SCHEMA_VERSION` bumped to 9, on the crash half of the rule and only that half.** A v8
  build has no case for either type in `createDisplayObject`, so it leaves the object
  undefined and its renderer crashes: `particles` to v7, `tilemap` to v6, `instance` to v5
  and `container` to v2 exactly. Cameras did not bump it and these do, which is the whole
  difference between a field on a scene and a new kind of object in one.
- **`nineslice.spec.ts` carries the "it draws, it drags, it survives a save and an open"
  duty for both**, which makes them the fourth and fifth exception to `editing.spec.ts` —
  and for `sprite`'s reason rather than a step skipped. Both *appear* with no setup, but
  what either is *for* cannot be seen until an image is imported: a solid colour stretched
  and a solid colour sliced put identical pixels on the canvas. `framePng` and `tilePng`
  exist for that, the job `stripPng` does for sheets.
- **Every claim there is an extent, not a centroid**, because what is being asserted is how
  big something is drawn. And the border reading is bounded *proportionally* rather than to
  a pixel: it is the difference between two independently measured extents, so both of its
  ends carry a colour boundary's sub-pixel phase and the two do not cancel. What the test
  actually needs is that the border did not scale with the panel — near 1x is the answer,
  near 3x is the failure — and an absolute tolerance tight enough to mean that sits inside
  the noise on one project and passes trivially on the other.

## Typography

A `text` node carries a weight, a slant, a wrap, an alignment, two spacings, a stroke and a
shadow. It is the first iteration to widen an **existing** node type's props rather than
add a type, which is what makes it worth writing down: most of the "Adding a Phaser object
type" checklist does not apply, and on that checklist "already covered" and "forgotten"
read identically.

- **`textStyleOf` is the only reader, and it is the first one with two consumers.** It
  joins the `guidesOf` / `frameGridOf` / `sliceInsetsOf` / `physicsOf` / `soundsOf` /
  `cameraOf` / `tileMapOf` family, and it is the sharpest version of their argument
  because the renderer *and* the exporter both read it. Before it existed each built its
  own style object out of the same three keys, written twice, in `EditorScene.applyNode`
  and in `constructorFor` — two places free to disagree about how the text looks, which is
  the one kind of failure a user cannot see until the game is in their hand. It answers
  three questions at once: what shape Phaser takes these in, whether a hand-edited file's
  numbers are ones Phaser can be handed, and how much padding the stroke and the shadow
  need. A fresh object per call, so `useEditorStore((s) => textStyleOf(...))` is React
  error #185 — the `tileMapOf` trap, sixth time.
- **It returns the whole style, every key, defaults included, and that is load-bearing
  rather than tidiness.** `TextStyle.setStyle` reads each key with
  `GetValue(style, key, this[key])` and its `setDefaults` argument is false, so an
  *omitted* key keeps whatever it already had. A style built from only the non-default
  keys could switch a stroke on and could never switch one off. What to *print* is a
  separate question and it is the exporter's — which is the one place this feature splits
  a decision the emitter config and the physics body keep together.
- **`setStyle` does not carry `padding`, `lineSpacing` or `letterSpacing`.** Phaser's
  `TextStyle` has a `propertyMap` of the keys it copies out of a style object and those
  three are not in it; they live on the `Text` game object. The *constructor* reads them —
  `new Text(...)` checks `style.padding` and the other two by hand — which is why the
  exported code can put everything in one config literal and `applyTextStyle` cannot.
  Handing them to `setStyle` silently does nothing, and "the wrap works but the line
  spacing is ignored" is exactly what that looks like from the canvas.
- **A shadow set through a style object needs `stroke: true, fill: true` or it is never
  painted.** `Text.setShadow()` defaults `fill` to true, but `propertyMap` defaults *both*
  `shadow.fill` and `shadow.stroke` to false — so a shadow given an offset, a colour and a
  blur and nothing else is computed, stored, and invisible. Both are emitted explicitly,
  and the export asserts the pair rather than the offsets.
- **`bold` and `italic` are two booleans, not one `fontStyle` string.** Phaser's key is a
  string, but its value is nothing more than those two independent facts joined by a
  space. A free string field would accept `oblique 350` and every other CSS token, which
  the editor cannot draw predictably and the exporter would pass straight into a game. Two
  questions, two answers — `NodeControls.touch`'s argument, which was the same refusal of
  a third `scheme` value.
- **There is no `padding` prop, and that is not an omission.** Phaser sizes a text object's
  canvas from the glyphs alone, so a stroke and a shadow are drawn outside it and clipped.
  The room they need is a *function* of the stroke and the shadow — `ceil(max(thickness/2,
  |offset| + blur))` per axis — not a decision anyone makes, so `textStyleOf` derives it. A
  stored one would be two fields free to disagree about one number: the argument that gives
  a sprite no width of its own and a tilemap no tile size of its own. The panel says so
  rather than offering a field that would mostly be wrong.
- **`wordWrapWidth: 0` means off**, a first-class sentinel like `EMPTY_TILE`, because a
  wrap width of zero has no other meaning. It becomes Phaser's own `wordWrap.width: null`
  in the derived style — `0` there would be a width every word is wider than.
- **Word wrap changes the object's measured box, and nothing had to learn about it.** That
  is the connection to `bounds.ts`, and the answer is a comment rather than code:
  `hitAreaFor` reads `object.width`/`height` live, `applyHitArea` re-runs every sync, and
  `publishMeasuredBounds` already said in as many words that a text object's size is
  whatever the font measured to — because it has always followed the content as it was
  typed. A wrapped paragraph is just a text object that measured differently, so the
  outline, both handles, the published bounds, snapping and align/distribute all follow it
  with no edit. Said out loud in `Renderable`, beside the nine-slice and tile-sprite note
  that exists for the same reason.
- **`shapeOf` gains nothing.** A `Text` re-lays itself out on `setStyle`, so every dial is
  an in-place setter — the emitter's `setConfig` case rather than the nine-slice's and the
  tile sprite's, which bake their geometry at construction. Folding a style signature in
  would rebuild the object on every keystroke in the inspector.
- **`applyTextStyle` is cache-guarded, which is `setConfig`'s guard one type over.**
  Applying a style re-rasterises the text's own canvas and the scene syncs on *every* store
  change, so without it a selection, or a nudge of some unrelated object, re-renders every
  piece of text in the scene. That was already true of the three keys this replaced; a
  fresh object per call would have made it unconditional.
- **The export is one config literal, so `modifiersFor` gains no branch** and says so.
  Every typography field is a `TextStyle` key, so the whole feature lands in the call
  `constructorFor` already made and nothing chains. `.setOrigin(0.5)` stays its only text
  branch.
- **Each new key is printed only where it differs from Phaser's default — the opposite call
  from the emitter config and the physics body, which are emitted whole.** Those two are
  dials that interact: drag only bites while acceleration is zero, a lifespan only means
  anything beside a frequency. A stroke tells a reader nothing about an alignment, so here
  a line restating a default is just a line to check. Two things stay grouped for the
  interaction reason: `stroke` with `strokeThickness`, since a colour with no thickness
  draws nothing and a thickness with no colour is black by accident; and the shadow's six
  keys as one object. The payoff is the property every feature here has had to keep — a
  text node made before iteration 22 derives a style whose every new key is at its default,
  so it prints the same three keys in the same order and its export does not move by a
  byte. `typography.spec.ts` asserts that rather than assuming it.
- **`SCHEMA_VERSION` did not bump, and this is the guides case for the fifth time.** These
  are fields on `props`, and `props` rides in on `scenes` — the one part of a file
  `parseProject` passes through verbatim. A v9 build has a `case 'text'` in
  `createDisplayObject`, draws the text with the three keys it knows, reads the rest
  nowhere, and carries them back out on a re-save. **Still contingent on `parseProject` not
  reconstructing scenes field by field**, exactly as physics, cameras, behaviour and touch
  controls are.
- **Almost none of the "Adding a Phaser object type" checklist applies**, and listing which
  is half of what a reader needs. `text` was already in `NodeType`, `ADDABLE`, the
  `.tree__type` colour chip, `PHYSICS_TYPES`, `createDisplayObject`, `constructorFor`,
  `localRectOf`/`hitAreaFor` and `editing.spec.ts`; and typography adds no asset, no
  texture and no animation, so `collectAssets`, `usedIn`, `countAssetUses`, `removeAsset`,
  `mapProjectNodes`, `collectAnimations` and `missingReason` are all untouched. The one
  step the compiler catches is `defaults.ts`, because the new props are required. The three
  that carry real risk — the renderer's `applyNode` case, the exporter's `constructorFor`
  case and the inspector — are **all silent**, as the whole of physics and cameras were.
- **The labels were renamed, and that is the "Animation name, not Name" rule.** "Size"
  became "Font size", "Color" became "Text colour" and "Font" became "Font family",
  because the panel now carries three colours and two widths and the suite matches a label
  exactly. Nothing in `tests/` read the old three, so the rename was free — which it will
  not be next time.
- **The suite's claims pick their instrument per claim.** An **extent** for the wrap,
  because what is asserted is how big something is drawn and a centroid moves by a tenth of
  a shape's width on antialiasing phase alone. A **centroid** for the alignment, because
  there the box is pinned by the longest line and what moves is the distribution of glyphs
  inside it — an extent would assert nothing. And weight and slant are asserted through the
  document and the export rather than through pixels, because a font's bold face is the
  browser's and a headless container may synthesise it, which would make a pixel claim
  about weight a claim about the machine.
- **The hostile project gained two things.** Its existing text node's `fontFamily` is now
  hostile — free user text that reaches a JS string literal *and* the runnable page's
  `<script>` body, and until now the one field on that node nobody had made hostile, which
  is exactly where the holes have always been. And a second node carries a non-default
  value in all twelve new fields while carrying no hostile string at all: it is the only
  place the emitted style literal's *shape* meets
  `Phaser.Types.GameObjects.Text.TextStyle` under `tsc --strict`, which is where a key
  renamed between Phaser versions fails and nowhere else. The hostile emitter's argument,
  one type over.

## Web fonts

`project.fonts` holds font files as data URLs, and a text node is drawn in one by *naming
its family* — the same `fontFamily` field it has always used to name Georgia. It closes
iteration 22's first hole, which was that a project could look right on the machine it was
made on and render in Courier on somebody else's.

- **The predicted hard part does not exist, and that is the first thing to know.**
  CLAUDE.md said this needed "a `document.fonts.load` that has to finish before `create()`
  — a boot-order question this exporter has never had to answer". Phaser 4 ships
  `this.load.font(key, url, format)` (`LoaderPlugin#font`, since 3.87), so the answer is
  the `preload()` that has been here since images: `create()` already runs only once the
  loader is done. Three details of `FontFile` are what make it fit with no adaptation at
  all — it sets `FILE_POPULATED` in its constructor and therefore **skips XHR**, handing
  its URL straight to `new FontFace`; `GetURL` returns a `data:` URL as-is, which is the
  only form anything in this document has ever been stored in; and **the loader key *is*
  the family name**, so `load.font('Chunky', …)` is what makes `fontFamily: 'Chunky'`
  resolve. A failure is a `console.warn` and the loader carries on, so a bad font degrades
  to the fallback rather than breaking the boot. The prediction was made from Phaser 3
  memory, which is the thing "Phaser 4, not 3" above tells every reader not to do.
- **A text node names a font; it does not point at one, and everything else follows from
  that.** `textStyleOf` is untouched, `constructorFor`'s `'text'` case is untouched, and
  `TextProps` gains no field — a family that names an imported font resolves to it, and one
  that names `Georgia` does what it always did. The rejected shape was a `fontId` beside
  `fontFamily`, which is two fields answering one question: the argument that gives a
  sprite no width of its own, a tilemap no tile size and a camera no rectangle.
- **So there is no dangling reference, and `removeFont` is one line.** Beside
  `removeAsset`'s walk of every node in the project that looks exactly like a forgotten
  step, which is why it says so in a comment. A family naming nothing is not a dangling id;
  it is what every text node in every project made before this feature already said. The
  text keeps the name the user chose and falls back, so **"no font chosen", "the font is
  gone" and "an ordinary system family" are one state and one code path** —
  `PLACEHOLDER_TEXTURE`'s argument for a case that needs no placeholder at all.
- **`family` is stored on the asset, where an audio key is derived.** `audioKeyOf` works a
  sound's key out at export time because nothing in the document points at it; a family is
  named *by the document*, so it has to be stable for the life of the project and unique
  within it. `fontFamilyFor` allocates it once at import against the families already
  there. Not editable, which is an image's treatment rather than a sound's and for an
  image's reason: renaming would break every node that named the old string.
- **It is an identifier-safe token — no spaces, no punctuation.** `Press Start 2P.ttf`
  imports as `PressStart2P`. That is what lets `fontStackOf` be a plain split with no CSS
  quoting anywhere, and it is what makes a family safe in every place it is printed.
- **A derived family may not be a CSS generic, and this is the sharpest small trap here.**
  `serif.ttf` would otherwise import as `Serif`, register cleanly, be written into the node
  — and draw the browser's default serif, because generic keywords are matched
  case-insensitively and win over a registered face. Every part of the editor would insist
  the font had been applied. `CSS_GENERICS` goes into `fontFamilyFor`'s taken set rather
  than being rewritten, so a generic takes the same numeric suffix a real clash would and
  there is one de-duplication rule rather than two. Only the hyphen-free keywords are in
  that set, because `sans-serif.ttf` already derives `SansSerif` and cannot collide.
- **`fontStackOf` is the only reader**, in the `guidesOf` / `frameGridOf` / `sliceInsetsOf`
  / `physicsOf` / `soundsOf` / `cameraOf` / `tileMapOf` / `textStyleOf` family, and it
  exists because `fontFamily` has always been a *stack*: a new text node ships with
  `system-ui, sans-serif`. The renderer asks which imported fonts a node needs and the
  exporter asks which a scene preloads, and a node reading `Chunky, serif` has to count as
  using `Chunky` in both.
- **`FONT_FAMILY` is checked on open and the entry is dropped, not repaired.** A repaired
  family would no longer be the string the text nodes name, so the font would sit in the
  table looking imported and apply to nothing; dropping it lands in the fallback state that
  already has a code path. It also means **a hostile family cannot survive an open**, so
  the exporter's `str(...)` around one is belt-and-braces rather than the only guard.
- **The mime is decided by the extension whenever the browser's claim is not one of the
  four, and this is the one place fonts do not follow audio.** `importAudioFile` trusts
  `file.type` because every platform reports an audio mime; for a font they report
  `font/ttf`, `application/x-font-ttf`, `application/octet-stream` or the empty string
  depending on the OS and the picker, so trusting it would refuse good fonts on most
  machines. The stored mime is always re-derived, which is what keeps `FONT_DATA_URL` as
  tight as its two siblings. `pickFontFile` is the same problem one layer up: `font/*` is
  not an accept wildcard browsers honour, so it names extensions.
- **The cap is 1 MB, half a sound's**, and set against `autosave.ts`'s ~5 MB draft the way
  that one is. It is the only lever there is — an oversized image is scaled down, and a
  font can only be refused. A WOFF2 Latin face is tens of kilobytes; the thing this refuses
  is a CJK face, which needs subsetting rather than a bigger number.
- **The import decodes before it accepts**, which is what a canvas round-trip is for an
  image: `FontFace.load()` runs the browser's own sanitiser, so bytes that are not really a
  font are refused while the user is at the picker. That matters more here than anywhere
  else, because the failure it prevents is *silent* — a rejected font draws in the fallback
  family, which looks exactly like nothing having happened.
- **`syncFonts` is `syncTextures` one table over, and the one line that is not a copy is
  the whole feature.** `applyTextStyle` is cache-guarded on the style object, and a font
  landing **does not change the style by a character** — the node still says
  `fontFamily: 'Chunky'`, exactly as it did while the font was loading. So the re-sync
  finds every signature unchanged, skips every `setStyle`, and Phaser's `Text` does not
  re-measure itself when `document.fonts` gains a family: it holds a canvas it rasterised
  in the fallback face and has no reason to think otherwise. **`syncFonts` must clear
  `textStyles` when a face arrives or departs.** That is the `play(key, true)` and
  `setConfig` guard family arriving *inverted*: those exist to stop an apply firing on
  every store change, and this one has to break the guard, because what changed is outside
  the document the signature is computed from. Opening a project always takes this path.
- **Faces are tracked and removed on SHUTDOWN**, the `assetTextures` / `animationKeys`
  bookkeeping for the third time and the widest version of it: a texture belongs to the
  game and an animation to the game's manager, while `document.fonts` belongs to the
  *page* and outlives the game entirely.
- **`fontFaceKey` folds the bytes in beside the family, and that is
  `textureKeyForAsset`'s signature trick rather than caution.** With the bytes in the key
  the existing "add what is wanted, remove what is not" diff handles a change of face with
  no special case: the new key is missing so it is added, the old one is unwanted so it
  goes. Tracked by family alone it does not, and **the reproduction needs no empty state in
  between**, which is the part worth writing down. Opening one project directly over
  another whose `Chunky` is a different file gives a sync that sees `Chunky` both before
  and after: the add loop skips it as already registered, the prune loop keeps it as still
  wanted, and the first project's glyphs go on being drawn for the second project's font.
  Go via a new project first and the prune drops the family before the next one arrives, so
  it works by accident — which is why `fonts.spec.ts` deliberately opens one file straight
  over the other.
- **The picker is in `TextSection`, not `SceneInspector`.** `AssetPicker`'s placement
  rather than `AudioSection`'s, and for the stated reason: a sound is scene state, a font
  is what *this object* is drawn in. **The free-text Font family field stays** — typing
  `Georgia, serif` goes on working, and a project has every right to name a font it expects
  the machine to have. What the picker adds is the one thing free text cannot: making a
  *derived* family reachable without reading it off a row and retyping it. That is a gap
  `audioKeyOf`'s "plays as jump" row can afford to leave open, because an audio key is a
  hint for a line written later while a family is the link itself — wrong by one letter and
  the font silently does nothing.
- **The export is a `FONTS` table and one `preload` line**, gated like every other table so
  a project with no font emits byte for byte what it always did. The `format` argument is
  emitted rather than defaulted: Phaser's own default is `'truetype'`, so a WOFF2 left to it
  is refused by the browser and falls back with only a console warning — which is why
  `fontFormatOf` sits beside the asset and is read by the renderer and the exporter alike.
- **`usedIn` gains a fourth set, and it is a *walk* where the audio set is a read.** A text
  node can sit inside a prefab definition exactly as a sprite can, so this half has the
  images' shape. `collectFonts` and `usedIn` share `familiesIn` rather than asking the
  question twice — unlike an image, a font has no second question about what it is *called*
  for the file-wide half to answer on its own.
- **Nothing reaches the HTML: no `@font-face`, no `<link>`, no `<style>` entry**, and that
  is worth stating because a reader will go looking for the piece that is missing. Phaser's
  loader builds the `FontFace` itself inside `preload()`, so the family and the bytes stay
  inside the one script `generateRunnableHtml` composes and escapes in a single pass. The
  markup around it is guarded only by `escapeHtml` and `cssColor`, so an `@font-face` would
  have been a new unescaped surface carrying a family and a data URL — in the half of that
  output where the escaping has historically been got wrong.
- **No game-config key and no header note**, the fifth entry in the comment block above
  `arcadeConfig` where the audio, camera, keyboard and touch refusals already are.
- **`SCHEMA_VERSION` bumped to 10, on the silent-data-loss half of the rule and only that
  half — the v8 audio case exactly.** No new `NodeType`, so a v9 `createDisplayObject` has
  a case for everything in the file. What a v9 build does is drop `project.fonts` on open
  and re-save without it, and that is *worse* than the audio case it copies: a sound that
  loses its table makes no noise, where text that loses its font goes on drawing, in a face
  the user never chose, with nothing having said so.
- **The suite's instrument is a density, not a colour and not only an extent.** Text is the
  same colour in every font, so a centroid says nothing; an extent says how *big* it is
  drawn but not *which face*. The fixture's every glyph is a filled em-square, so text set
  in it inks nearly the whole of its own bounding box where a real face inks a fraction —
  a property of the shapes rather than their size, so it does not move with the zoom, the
  font size or the string. `lll` is the string for that reason: three narrow letters make
  the difference a factor of three both ways, where `MMM` made it four pixels.
- **`tests/helpers/ttf.ts` synthesises the font**, `png.ts`'s and `wav.ts`'s argument for a
  third time and the one that needed the most defending. Ten tables, which is what Chrome's
  sanitiser accepts against the fifteen to seventeen a real face carries. TrueType rather
  than WOFF for `wav.ts`'s reason: it is the only one of the four allowed formats that
  needs no compressor. The one thing to know before editing it is that **the sanitiser
  rejects silently** — a font it refuses is a warning and a fall back, which from the canvas
  is indistinguishable from the feature not working.
- **`EditorPage.reload` exists for one test and is the only cold boot available.** The
  decode caches in `assets.ts`, `audio.ts` and `fonts.ts` are module-level, so `newProject`
  followed by `openFile` re-opens a project the page has *already decoded* — which means
  every other test here silently asserts the synchronous path twice. Only a reload reaches
  the asynchronous branch of `syncFonts`, and only that test fails when the `textStyles`
  clear above is removed. It opens a saved file after the reload rather than trusting the
  autosaved draft it comes back on, because that draft is written on an 800ms debounce and
  caught the import on one project and not the other.

## Particles

A `particles` node is a real `Phaser.GameObjects.Particles.ParticleEmitter`, so what the
canvas throws is what the export builds. It is the first node whose whole point is what it
does *over time*, and two decisions carry the rest of it.

- **Preview governs emission, on the toggle the animations already had.** The argument is
  the animation one at its sharpest: a canvas that animates by itself is a canvas whose
  objects are never where you last looked. An emitter is therefore stopped unless ▶ is on.
  It rides on the one toggle rather than a second, the call the angle step made when it
  rode on the grid button — a 390px toolbar that already clips does not get a third motion
  switch for the same idea. The field is `previewMotion`, not `previewAnimations`: named
  after one of the two things it governs, it is exactly the setup for a future reader
  talking themselves into a second flag for the other. The button appears when
  `hasMotionIn` says the project holds a clip *or* an emitter, and that walks the prefab
  bodies as well as the scenes, because an emitter placed only inside a prefab still
  animates the canvas and would otherwise have no way to be stopped.
- **A stopped emitter still has to be a real object**, which is `PLACEHOLDER_TEXTURE`'s
  argument a third time and the widest version of it. `editor:emitter` covers "no image
  chosen", "the image is gone", "the image is still decoding" *and* "chosen, but not
  running" — one state and one code path rather than four. Its discs are filled, not
  stroked: a one-pixel line never reaches full strength on screen, so an outlined marker
  is both hard to see under a thumb and invisible to a colour-centroid assertion.
- **The display object is a Container holding the marker and the emitter, and the wrapper
  is not decoration.** A `ParticleEmitter` mixes in Transform, Visible, AlphaSingle,
  BlendMode, Depth and Texture but **not** ComputedSize and **not** Origin — so it has no
  `width`, no `height`, and no `displayOriginX` for `InputManager.pointWithinHitArea` to
  add to every point it tests. That addition yields `NaN`, so a bare emitter can never be
  hit at all: not selectable, not draggable, not resizable. A Container has all three,
  which is why `localRectOf`, `hitAreaFor` and `applyHitArea` needed **no case for
  particles** — a container with no measured bounds already falls through to a centred
  `width`/`height` box, and `EMITTER_SIZE` is that size. Check this first if Phaser ever
  gives the emitter ComputedSize; the wrapper could then go.
- **The wrapper's children are private to the renderer, which is what makes it safe.**
  `syncNodes` recurses into `container` and `instance` nodes *by node type*, and
  `applyContainerBounds` runs for those two only — so nothing walks into a particles
  container, nothing measures it, and `reparent`'s `getIndex(object) === index` assertion
  never sees it. Putting the marker in a *user's* container instead would have broken that
  assertion for every sibling after it, and with it "draw order is the array order, at
  every level".
- **The marker is shown exactly when the emitter is not.** One field, two controls, never
  two notions of the same state — the eraser rule from the tile bar, one object over.
- **`setConfig` in place; no rebuild, and no shape signature.** `setConfig` routes
  `texture` and `frame` to `setTexture`/`setEmitterFrame` and leaves `emitting` alone, so
  an emitter can be re-pointed and re-tuned without being replaced. That matters: a
  rebuild kills every live particle, so nudging Lifespan with preview on would blank the
  canvas on every keystroke. This is where the tilemap draws its line differently, and
  deliberately — a Phaser map fixes its dimensions when it parses one, and an emitter
  fixes nothing.
- **`setConfig` is cache-guarded, and that is the `play(key, true)` trap by another
  route.** It calls `resetCounters`, which restarts the flow — and the scene syncs on
  *every* store change, so applying the config unconditionally would have a selection, or
  a nudge of some unrelated object, reset every emitter before it had emitted anything.
  `emitterConfigs` holds the last-applied config per display key and is compared first.
- **Stopping is `stop(true)` — killing what is in flight, not letting it die out.**
  Switching preview off has to put the canvas back immediately; particles lingering for a
  whole lifespan would make the toggle look broken, and would leave a test polling for
  five seconds to find out.
- **Running is one condition: preview on *and* a real texture.** Without the second half
  an emitter with no image would spray 96px markers across the scene — the document says
  no such thing, and nobody asked for it.
- **There is no `emitting` prop, and that is the `scene.start` argument.** Whether an
  emitter runs is the preview toggle's answer in the editor and Phaser's default in an
  export. A document field would be a second answer to the same question, and an emitter
  that starts switched off and is triggered later is a line of game logic.
- **The export is one `add.particles` with its config emitted whole**, defaults included —
  deliberately unlike `modifiersFor`, which emits only what differs from Phaser's
  defaults. A chained modifier left out is a line that would have restated a default; the
  config literal *is* the object, so writing it whole means the generated code says what
  the document says and every dial is in one place. It needs no module-level helper: an
  emitter is a single expression, so it stays an `add.*` where a tilemap and an instance
  could not.
- **`setAngle` on a `ParticleEmitter` is Transform's, not the emission angle.** It was the
  emission angle in Phaser 3.55, which would have made the shared `.setAngle` modifier
  silently wrong — and wrong in a way *no* export assertion would catch. It is
  `setEmitterAngle` now, and the config's `angle` carries it. `modifiersFor` therefore has
  no particles branch, and says so in a comment, because here "no branch needed" and
  "forgot a branch" look identical.
- **The two traversals split by what they are *about*.** `mapProjectSprites` is for
  everything about a **clip**, which only a sprite can play; `mapProjectNodes` is for
  everything about an **image**, which a sprite, an emitter and a tilemap can all point
  at. Only the second walks the prefab definitions — which closed a real hole in passing:
  `removeAsset` used to leave a sprite *inside a definition* holding a dangling `assetId`,
  because the sprite traversal never reached one.
- **`SCHEMA_VERSION` bumped to 7, on the crash half of the rule and only that half.** A v6
  build has no `'particles'` case in `createDisplayObject`, so it leaves the object
  undefined and its renderer crashes — `tilemap` to v5 and `instance` to v4 exactly.
  Nothing else needs it: a particle texture is an ordinary image, sliced or not, and the
  emitter's settings ride in on `scenes`, the one part of a file `parseProject` passes
  through verbatim.
- **`particles` is in `editing.spec.ts`, where `sprite`, `tilemap` and `instance` are
  not** — and the marker is what earns it that. Those three draw nothing until an image is
  imported; an emitter draws with no setup at all, which is the whole reason the marker
  exists.
- **The fields are Phaser's own names, and "Scale start" is not "Scale".** The transform's
  Scale X/Y and the object's own Alpha are a few rows up the same panel, so bare "Scale"
  and "Alpha" would be ambiguous to a reader and to `labelled()`'s exact-match locator
  alike — the "Animation name, not Name" rule.

## Visual effects

A node may carry `fx?: NodeEffect[]` — a glow, a blur, a drop shadow or a pixelate, drawn
as real Phaser 4 **filters**. It is the largest capability hole the "Not built yet" list
below never names: `grep` over `src/` found no `setMask`, no `preFX`/`postFX` and no filter
of any kind, while the "Phaser 4, not 3" bullet has flagged since iteration 4 that *the
renderer, FX/filters and masks all changed* — an awareness note with no feature behind it.
That is iteration 34's own closing lesson arriving on schedule: **a refusal list is a list
of things somebody thought of, and the hole that survives is the one nothing prompted the
question.**

- **This is the first feature in a long while with nothing to refuse the canvas.** Physics
  is drawn and never run, a camera is drawn and never applied, a rule fires nowhere, a
  touch ring is never pressed — every one of those because running it would rewrite the
  document or move the user's own view. A filter does neither: it is a standing fact about
  how an object is *drawn*, so the canvas shows exactly what the export gives you, in the
  same renderer, and there is no "drawn, never …" paragraph to write. `hasMotionIn` is
  untouched all the same and records its **twelfth** refusal, which is the easy one for
  once: a glow does not move.
- **Every fact below was read out of the shipped package, not recalled.**
  `node_modules/phaser/skills/filters-and-postfx/SKILL.md`, `types/phaser.d.ts` and
  `src/filters/*.js` — which is what "Phaser 4, not 3" tells every reader to do, and what
  the Web-fonts iteration records the cost of not doing. A spike then ran the real
  `phaser.min.js` in the suite's own Chromium before a line of schema was written, because
  the one thing that could have killed this feature — filters are **WebGL only** and the
  headless container rasterises on the CPU — is not something to discover at the end.
- **`fx` is a fourth optional field beside `physics`, `controls` and `tween`**, for
  `physics`' reason: it is not per-type, so every entry of `NodePropsByType` would carry
  the same array and `createNode` would have to answer "what is this rectangle's glow".
- **A list, where `tween` is deliberately one — and the refusal does not transfer.** That
  one was refused because a second tween means a second *duration*, which is a schedule and
  therefore a program. A second filter is a second **pass**: a Phaser `FilterList` is
  defined as an ordered chain where each filter takes the previous one's output, and
  glow-and-shadow is one look rather than two. The array order is the apply order, which is
  "draw order is the array order" one level in, and `TilemapProps.layers` is the same shape
  for the same reason. `MAX_EFFECTS` is 4, which is `MIN_TIMER_DELAY`'s job one field over
  and the only runaway here: every active filter is another pass, and an unbounded list is
  the one thing in this feature that can quietly take the frame rate with it.
- **No top-level rule, which is the tween's case and not physics'.** A body and a
  drive-scheme are banned inside a container because both read their owner's `x`/`y` as
  *world* coordinates every step. A filter writes no coordinate at all. So `effectsOf`
  takes no `topLevel` argument, nothing is stripped on read, `setNodeEffects` reaches
  through `mapNode`, and an effect in a prefab definition draws in every placement. Worth
  saying in as many words, because two of its three neighbours ban exactly this and the
  code reads like a missed guard.
- **`effectsOf` is the only reader**, in the `physicsOf` / `controlsOf` / `tweenOf` /
  `guidesOf` / `soundsOf` / `cameraOf` / `tileMapOf` family, answering four questions at
  once: is there a list, is every kind one this editor can both draw *and* emit, are the
  numbers ones Phaser can be handed, and is the list within the cap. Its policy is split
  the way the rule decides — *a repair may narrow what the document says; it may never
  widen it*. An unknown `kind` costs the **effect**, not the node, which is
  `ruleActionsOf`'s split: a list of passes still means something without one of them.
  Numbers are **repaired, never dropped**, which is `cameraOf`'s policy and satisfied
  trivially, because there is no gate inside an effect to open. A fresh array per call, so
  `useEditorStore((s) => effectsOf(...))` is React error #185 — the `tileMapOf` trap,
  thirteenth time.
- **It is the first reader in that family with no dangling reference to check**, because an
  effect names nothing the document holds — no node, no asset, no variable, no scene. That
  is also why `removeAsset`, `removeVariable`, `removePrefab`, `mapProjectNodes`,
  `mapProjectSprites`, `ruleNames` and `duplicateScene` all needed **no edit at all**,
  which on those checklists reads exactly like seven forgotten steps.
- **Four kinds, and the allowlist is stronger here than `TWEEN_EASES`'.** An unknown ease
  resolves to `Power0` and says nothing; an unknown key registers a listener nothing fires.
  An unknown kind reaching `filters.internal[...]` is `addBanana is not a function` — a
  **TypeError inside the player's game**, thrown out of `create()` before anything is
  drawn. What is left out is left out per reason: `addMask`, `addDisplacement`, `addBlend`,
  `addGradientMap`, `addCombineColorMatrix` and `addImageLight` take a **texture or another
  game object**, which is a reference into the document and therefore an `AssetPicker`, a
  dangling-reference story, a `removeAsset` patch and a `collectAssets` branch — an
  iteration rather than a member. `addSampler` takes a **callback**, which is code in the
  document and the emit-zone argument. `addWipe` and `addParallelFilters` are a *progress
  animated over time*, the `scene.start` argument, and the second is two nested lists where
  this is one. `addColorMatrix`'s dials are not arguments but calls on a sub-object, so it
  is a second shape inside the union. Vignette, barrel, bokeh, tilt shift, threshold,
  quantize, key and blocky are legal, cheap and a **pure loosening** later — one member and
  one emit case each; the first two are effects on a *view* rather than on an object, which
  is where iteration 31 already put camera effects.
- **Each kind's fields are a *prefix* of Phaser's own argument list, and that is what chose
  them.** `addGlow` takes seven arguments and this document stops after the fourth, so
  nothing is ever printed that the document does not hold. A dial in the middle would force
  the exporter to invent every argument before it.
- **A glow's `quality` and `distance` are not fields, and the reason is a `TypeError`.**
  Both are `readonly` on Phaser's controller, and the spike confirmed that assigning one
  throws — so a document that could say them would need a renderer that destroys and
  rebuilds a filter for two fields, and a crash the day it forgot. They default from the
  game-config keys `glowQuality`/`glowDistance`, which **neither the editor nor the export
  sets**, so both take Phaser's 10 and cannot disagree about how a glow looks. That is the
  one game-config key this feature could have needed, and it is the seventh entry in the
  comment block above `arcadeConfig` where the audio, camera, keyboard, touch, tween and
  label refusals already are.
- **`internal`, not `external`, and not a field.** An internal filter runs before the
  camera transform, in the object's own local space — so a glow on a turned object turns
  with it and a blur along X blurs along the object's X, which is what "an effect on this
  object" means. External is screen space and full-screen: on a per-object effect it is
  both dearer and wrong. A stored `space` would be a second answer to a question that
  choosing "on this object" already settles.
- **The renderer rebuilds the list; it never patches a controller.** `applyEffects` is
  cache-guarded on the whole list in `nodeEffects`, which is `textStyles`' and
  `emitterConfigs`' guard for the third time and for their reason — the scene syncs on
  *every* store change, so an unguarded apply would tear down and rebuild every filter in
  the scene on every selection. That it rebuilds rather than patches is the readonly trap
  above: folding everything into a signature and letting one "it changed, so rebuild"
  branch do the job is `textureKeyForAsset`'s trick, and it costs nothing because it only
  runs when the signature moved. Deliberately **not** part of `shapeOf`, which rebuilds the
  display *object* — a glow must not destroy and recreate the sprite under it.
- **SHUTDOWN needs nothing, and that absence is worth a sentence** beside four neighbours
  that all do bookkeeping, because here "nothing to do" and "forgot to do it" read
  identically. A texture belongs to the game, an animation to its manager and a `FontFace`
  to the *page*, so all three outlive the scene; a `Controller` is destroyed with its
  `FilterList`, which is destroyed with the game object. The one line that *is* needed is
  `nodeEffects.delete(key)` in `destroyDisplayObject`, beside the three deletes already
  there — a stale signature would have the next node to land on that key skip filters it
  has never been given.
- **A `particles` node is filtered on its emitter, not on its wrapper, and it is the one
  case in the feature.** That container also holds the editor's own pink marker, which is
  chrome the exported game does not have — so filtering it would make the canvas and the
  export disagree about a picture, which is the single failure this project guards hardest
  against. An `instance` and a `tilemap` are Containers *of* what the node is, so each
  takes one pass over the whole prefab and the whole map, which is what an effect on either
  means. The spike confirmed a filtered Container renders before any of this was written.
- **Nothing measures differently.** Filters do not touch `object.width`/`height`, so
  `localRectOf`, `hitAreaFor`, `applyHitArea`, `worldBoundsOf`, `publishMeasuredBounds`,
  both handles, `bounds.ts` and the whole of `snapping.ts` needed **no edit at all** — said
  out loud in `applyEffects`, because on that list "no branch needed" and "forgot a branch"
  read identically.
- **`enableFilters()` is called only for a node that has effects.** It is idempotent — its
  first line returns early when a filter camera already exists — so calling it always would
  be safe, but it allocates a camera per object and a scene where every object carries one
  is the cost this avoids.
- **The export is a sixteenth module helper, allocated last of all.** `attachEffects` is
  four lines, and it exists for `arcadeBody`'s reason to the character: Phaser declares
  `readonly filters: FiltersInternalExternal | null`, so `coin.filters.internal.addGlow(…)`
  does not compile under `--strict`, and the `create()` body is the same plain JavaScript in
  the `.ts`, the `.js` and the runnable page, so it can carry no `!`, no cast and no
  annotation. Where it parts company with `arcadeBody` is that it answers `null` rather than
  throwing: filters are WebGL only, so a browser that cannot run them is a legitimate thing
  for a player's to be, and the object then draws plain — here and in the export alike, so
  the two still agree. The name is drawn after `onVarFn` by the rule the tenth to fifteenth
  already state, and for its reason rather than tidiness: `toIdentifier` suffixes a clash,
  so a new name drawn earlier moves the suffix an *earlier* helper was given, and four of
  those are asserted by name in the suite.
- **The emit sits in `emitNode` beside the tween, and needs no `ctx.receiver` at all.** The
  tween goes there rather than in the epilogue because it names only the binding on the line
  above, and so does this; but a tween reaches `this.tweens` where a filter list is reached
  *through the object*, so the same text is correct verbatim inside a prefab factory with
  nothing to parameterise. The binding is `<name>Filters` out of `create()`'s identifier
  set, the sound handles' rule and for their reason — an object a user called "coin filters"
  must not take the binding the line beside it reaches for.
- **`modifiersFor` gains no branch, and says so**, by the rule that function already invokes
  three times. `enableFilters()` does return the object and could chain — but the call after
  it answers with the *controller*, and `filters` is nullable in a way no chain can narrow.
- **`constructorFor` gains no case, so the one compile error is `effectCallFor`'s
  exhaustive switch with no `default`** — `ruleActionLines`' arrangement, and the only thing
  standing between a new effect kind and an exporter quietly falling behind. Everything else
  here is silent: the renderer, the store, the inspector and the gate alike, exactly as the
  whole of physics and cameras were.
- **`collectEffects` is a boolean where every `collect*` beside it is a `Map`**, because
  there is nothing here to name: an effect is read off the node it is on and points at no
  table, no texture and no identifier. It takes `emittedNodes`' `project` for
  `collectLabels`' reason, and the hostile project's spawn-only prefab carries an effect for
  exactly that: without it, a definition a *rule* names emits the attach call while the
  helper is never declared — not a wrong picture but a compile error, which only
  `export-toolchain.spec.ts` could find.
- **`SCHEMA_VERSION` did not bump — the guides case, twelfth time.** No new `NodeType`, so
  a v14 `createDisplayObject` has a case for everything in the file. `node.fx` rides in on
  `scenes`, which `parseProject` passes through verbatim, **and on `prefabs.children`, which
  `parsePrefabs` also passes through unvalidated** — so both homes survive an old build's
  re-save. An old build draws the object plain, reads the field nowhere, and carries it back
  out. Still contingent on `parseProject` not reconstructing scenes or prefab children field
  by field, exactly as physics, cameras, behaviour, touch, Matter, tweens and labels are.
  `effects.spec.ts` asserts the 14 in the saved artefact.
- **A new effect arrives visible.** `defaultEffect` seeds a glow at an outer strength of 8
  and a spread of 2 rather than at Phaser's 4 and 1, which is `defaultTween`'s rule and its
  reason: the first thing anybody does after adding an effect is look at the object, and one
  that arrives doing nothing is indistinguishable from the feature being broken. It is also
  what lets most of the suite change no field at all.
- **Switching a kind replaces the effect rather than patching it**, which is what stops a
  glow's colour surviving underneath a pixelate that has no use for one. `setEffect` takes a
  whole `NodeEffect` for the same reason a `Partial` would not do: merged onto a union
  member the compiler loses which member it is, so a patch would have to be typed loosely
  enough to let a blur take a `decay`.
- **Every label carries "Effect <n>"** — `Effect 1 kind`, `Effect 1 colour`, `Effect 2
  amount` — because Alpha, Colour, X, Y, Scale X and Width are all rows further up the same
  panel and the suite matches a label exactly. The "Animation name, not Name" rule, and
  `NodeRulesSection`'s `Rule <n> do <m>` shape one feature over. The section is titled
  `Effects`, which collides with no `SECTION_TITLE` value and with none of the mobile tab
  bar's exactly-matched `Scene`/`Properties`/`File` — and it is a **storage key** now, since
  `Section` keys its open state by title.
- **The panel says effects need WebGL, unconditionally rather than on detection.** The
  Inspector is React and has no handle on the renderer, and plumbing one into the store to
  light up a sentence would be editor state existing for a sentence. A silently absent
  feature reads as a broken one, and a sentence is the cheap half of that fix.
- **The suite's instrument is a colour count, and the glow is what makes it work.** A glow
  puts a colour on the canvas that is on nothing else, *outside* the object's own box — so
  "it is drawn at all" is `count > 0` where a feature silently doing nothing gives exactly
  0, and "it is a glow rather than a recolour" is an extent strictly larger than the
  object's own. A blur is the opposite reading and needs one, having no colour of its own:
  what is asserted is that the *exact* fill stops being on screen while the object plainly
  still is. A pixelate is asserted through the document and the export instead, and
  deliberately — a solid rectangle pixelates to the same solid rectangle, so a pixel claim
  about it would be a claim about the fixture. Typography's call for weight and slant.
  `GLOW` is `#997722`, picked by arithmetic rather than by eye, which `TOUCH_COLOR`,
  `TWEEN_COLOR` and `SPAWN_COLOR` all record nearly getting wrong: its worst channel margin
  against all forty-eight fixture colours and all ten chrome colours is **85**, against a
  tolerance of 24.
- **A live filter is dear on a software renderer, and that shapes the suite more than
  anything else here.** `enableFilters` puts the frame through a framebuffer, which the
  headless container rasterises on the CPU — so every screenshot taken while one is on costs
  real seconds, and the cost scales with the viewport, which the desktop project pays twice
  over. Three things follow, and all three are in the file: each test touches as few fields
  as it can once an effect is live, the glow test keeps the screenshot its poll succeeded on
  and reads it three ways rather than taking three, and the file carries a
  `describe.configure({ timeout })` — `export-toolchain.spec.ts`' line with a GPU in place
  of a compiler. `expect.poll` takes its own budget rather than the test's, so that is said
  separately.
- **The hostile project carries a pixelate in the booted scene and the other three kinds in
  a scene that is registered and never started.** The split is not tidiness: the emitted
  `.ts` carries every scene, so `tsc --strict` still meets all four filter shapes, while
  only one cheap pass is ever rendered — four of them in the booted scene timed
  `export.spec.ts`'s hostile run out at sixty seconds. The pixelate is there so
  `attachEffects` is a function the running game really calls rather than only one the
  compiler reads, and it sits on the object named `arcade body` — the one fill in the
  project nothing measures, and a name that already collides with a helper, so the
  `arcadeBodyFilters` binding beside it is a free test of the suffix rule.
- **What stays refused.** **Masks shipped in iteration 40**, and the sentence that used to
  stand here is kept in `EFFECT_KINDS`' comment as a worked example rather than deleted: it
  refused six filters at once, and the clause doing the real work — that a mask "would be the
  first thing in this document that points *at another node*" — was false. **No camera-wide
  effects here** — a filter on
  `cameras.main` is a property of the view, and iteration 31 already put what happens to a
  view on a rule. **No custom shader**, which is code in the document, the emit-zone
  argument and the gradient fill's. **No animating an effect** — a tween's `to` is six
  properties that are one shape across the whole union, and an effect's dials are per-kind,
  which is exactly the refusal that keeps a seventh tween property out. And **no effect on a
  tilemap layer, a prefab child from outside, or a group's children individually**: an
  effect is on a node, and a layer is not one.

### Masks

A fifth `NodeEffect` kind: `{ kind: 'mask'; assetId; invert }`, drawn as a real Phaser 4
`addMask` and painting the object **only where its image is opaque**. It is the last of the
three things named in the one sentence that found filters and blend modes, and the second
iteration running to close a hole by finding an argument that was *false* rather than dated.

- **The refusal covered six filters in one sentence, and that is where it went wrong.**
  `EFFECT_KINDS`' comment said `addMask`, `addDisplacement`, `addBlend`, `addGradientMap`,
  `addCombineColorMatrix` and `addImageLight` "all take a **texture or another game
  object**, which is a reference into the document … which is an iteration rather than a
  member", and CLAUDE.md's copy added that a mask "would be the first thing in this document
  that points *at another node*". That last clause is **false** — `SceneCamera.followId`,
  both sides of a `SceneCollider` and nine `RuleAction` members all name a node, each with a
  dangling-reference story already written — and a mask sourced from a *texture* never needs
  the "or another game object" half at all. What was left was four real costs, every one of
  them machinery this project already had.
- **So the lesson is narrower than iteration 39's and is its second instance.** That one
  found a fake limit riding beside a real one on a comma, inside a single sentence about a
  single feature. This one is a fake limit riding beside a real one **across six features at
  once**: the sentence was true of `addDisplacement` and `addImageLight`, and a reader
  checking it would have found it true — of the case beside the one they were asking about.
  **A refusal that covers a list is the hardest kind to check, because it is right about
  most of the list.** The survivors are now argued one at a time for exactly that reason.
- **`assetId: string | null`, the spelling five props interfaces already use**, so nothing
  here is a new shape. `invert` is a boolean rather than a mode word — `NodeControls.touch`'s
  call — and it is the one dial that makes a mask expressive: keep the shape, or cut a hole.
- **There is no `frame`, and that is Phaser's doing rather than a field left for later.**
  `Mask.setTexture` reads `textures.getFrame(key).glTexture`, and every frame of a sheet
  shares the one `glTexture` of the image it was cut from — so naming a frame would change
  nothing about what is sampled. A `frame` here would be a field the document holds, the
  panel offers and the picture ignores, which is worse than an absent one. **Read out of
  `node_modules/phaser/src/filters/Mask.js`, not recalled**, and it is the fact in this
  iteration that would most obviously have been got wrong by guessing.
- **The two fields are a prefix of `addMask`'s own argument list**, which is what chose them:
  the signature is `(mask, invert, viewCamera, viewTransform, scaleFactor)` and the third
  argument would have to be invented. `addGlow`'s rule, one kind over.
- **The mask is stretched across the object, not aligned to it in pixels.** Its whole
  fragment shader is `color *= invert ? (1.0 - a) : a`, sampled at `outTexCoord` — the
  *object's* texel, because the filter is `internal`. That is what lets one mask image work
  on objects of any size, and it is why nothing here has a width or an offset.
- **`internal` for iteration 35's reason, and the package states it in as many words**: an
  internal mask "will match the object/view being filtered", an external one "will match the
  context of the camera". External is the camera-shaped answer, and iteration 31 already put
  what happens to a view on a rule.
- **A mask with no usable texture adds no pass at all, and this is the one real decision in
  the feature.** It is the single place `PLACEHOLDER_TEXTURE`'s rule is deliberately not
  followed, so `maskTextureKeyFor` carries the paragraph: the placeholder is a 96px **opaque**
  square, so as a mask it would do nothing — and inverted it would erase the object outright,
  which looks like the editor having deleted something. The placeholder exists so an
  unfinished *object* stays selectable and draggable; a mask is not an object, it is a pass
  over one, and the honest empty state for a pass is not to run it. So "no image chosen", "the
  image is gone" and "the image is still decoding" stay **one state and one code path** — that
  state is simply *unmasked*. It is what `attachEffects` already produces in an export running
  without WebGL, so the canvas and the export still agree.
- **`effectsOf` still takes no `Project`, and that is now a decision rather than an
  accident.** It stopped being the one reader in its family with no reference to check, and it
  still does not check one. `soundsOf` takes the project and *drops* a dangling row because
  `sound.add(undefined)` is not something Phaser can be asked for; `labelOf` drops because a
  label with no variable has nothing to append. A mask needs neither, because a mask naming
  nothing lands in a state both sides already have a code path for. Widening the signature
  would put a `Project` through thirteen call sites to answer a question that already has a
  safe answer.
- **What that does not excuse is the document holding the dangling id.** `removeAsset` clears
  a mask's `assetId` and `countAssetUses` counts one, by the rule that the editor may never
  leave a dangling reference — those two are the guard and the reader is only the fallback.
- **Both store edits are of a shape the file did not have: not keyed on the node's type.**
  `fx` is on the base node, so any of the ten types can carry a mask. `countAssetUses` counts
  **per effect** rather than per node, because `MAX_EFFECTS` is four and two masks over one
  picture are two uses of it. And `removeAsset`'s branch is computed *first* and merged
  *last*, because the type branches `return` — a sprite with both a dangling `props.assetId`
  and a mask over the same image has to have both cleared, and a mask branch written after
  them would never run for one.
- **The reference is cleared and the effect kept**, which is `removeAsset`'s own rule rather
  than `removeAudio`'s ten lines up: a `SceneSound` *is* a reference and goes with the file,
  where an object that has an image is still an object. The mask keeps its `invert`.
- **`syncTextures` must clear `nodeEffects`, and that is the whole renderer story.**
  `applyEffects` is cache-guarded on the effect list, and a texture arriving between one sync
  and the next does not change that list by a character — the node still says
  `assetId: 'a1'`, exactly as it did while the image was decoding. So the re-sync the decode
  triggers would find every signature unchanged, skip every apply, and the mask would never
  be applied at all. **This is `syncFonts`' `textStyles.clear()` one cache over**, and the
  irony is that the fix now belongs in `syncTextures` itself. The guard family arriving
  inverted for the second time: those exist to stop an apply firing on every store change,
  and this one has to *break* a guard, because what changed is outside the document the
  signature is computed from. The removal loop clears it too — a texture that has *gone*
  changes what a mask draws just as much as one that has arrived.
- **Only a cold boot reaches that**, so `masks.spec.ts` carries one reload test, and **it was
  verified by deleting the line and watching it go red** — iteration 33's and 37's rule, that
  a guard test which has never failed asserts nothing. The decode cache in `assets.ts` is
  module-level, so `newProject` followed by `openFile` re-opens a project the page has
  already decoded and every other test in the file silently asserts the synchronous path
  twice.
- **`effectCallFor` gained a required parameter rather than a rename.** It needs a texture
  *key*, which is `collectAssets`' answer rather than anything the node knows, so it takes
  the table. The `clampFrame` → `resolveFrame` rule does not apply: that exists for a widened
  **return** type, which compiles silently wherever it was not updated, and a new required
  parameter is named by the compiler at the one call site.
- **A mask naming an image the table does not hold emits no call**, which is the renderer's
  "no usable texture, no pass" answered on the far side so the two cannot disagree about a
  picture. The calls are therefore built *before* the gate in `emitNode`, or a node whose
  only effect is one of those would emit an `enableFilters` and an empty `if` block.
- **`collectAssets` and `usedIn` both gained a branch, and missing the second is the silent
  half.** The pair is two questions: what the texture is *called* across the file, and what
  *one scene* preloads. A key the scene never loaded makes `getFrame` answer null, so the
  mask quietly does nothing — an export that looks almost right, which is the failure
  `collectAssets`' own comment already names for emitters. Both reach prefab definitions and
  rule-spawned prefabs through `emittedNodes`, which needed no edit.
- **`shapeOf` gains nothing, and nothing measures differently.** A mask must not destroy and
  recreate the object under it, and filters do not touch `object.width`/`height` — so a
  masked object is still grabbable over its whole *unmasked* box, which is correct: the
  document says the object is that size, and the mask says what of it is painted.
- **`SCHEMA_VERSION` did not bump — the guides case, seventeenth time.** No new `NodeType`,
  and `node.fx` rides in on `scenes` (verbatim) and on `prefabs.children` (unvalidated), so
  both homes survive an old build's re-save: a v14 build's `effectsOf` drops the unknown kind
  through its `default: break`, draws the object unmasked and carries the field back out. The
  one edge worth recording rather than discovering is that a v14 build's `removeAsset` does
  not know to strip a mask's `assetId`, so deleting an image there can leave a dangling one —
  which is not the invariant breaking, because the invariant is about *the editor*, the
  reader draws the object unmasked either way, and a current build fixes it on the next
  delete. An old build doing less, not a file breaking.
- **A mask is the one kind `defaultEffect` cannot seed visibly**, and the comment says so
  beside four that can. There is nothing to seed an image with, and seeding the first asset in
  the table would silently re-cut the object with a picture nobody chose — `createNode`'s
  "adding an object must never open a file dialog", one level up. So it arrives inert and the
  panel says what it wants: `AlignSection`'s rule, that a control which says why it cannot
  beats one that is not there.
- **The suite's instrument is an extent and a count together, and neither is enough alone.**
  A glow is found by a colour on nothing else; a blur by the exact fill ceasing to exist. What
  a mask leaves behind is *still exactly the object's own colour* — so a count says something
  was taken away and an **extent** says a *side* was, which is the claim a fade or a tint
  could not make. Every drawn claim is a **ratio against the unmasked shot**, because the two
  projects draw at different zooms.
- **`halfAlphaPng` exists because every other builder in `png.ts` writes an alpha of 255.**
  Until masks, every feature in this suite cared about colour; a mask reads nothing but alpha,
  so a fully opaque fixture masks nothing and a test built on one passes whatever the feature
  does. It is split down one axis and **asymmetric on purpose**: a symmetric mask cannot tell
  "masked" from "inverted", and `invert` is one of the kind's two fields. It also makes the
  sharpest case there is for `assets.ts` only picking JPEG for a source that was already one —
  as a JPEG this fixture would be a rectangle that masks nothing.
- **The hostile project's masks are on a node of their own in the registered-never-started
  scene**, and both halves are deliberate. A node of their own because `MAX_EFFECTS` is four
  and the sprite there already carries three, so a fifth would be dropped by `effectsOf` on
  the way past and the dangling case would silently vanish. That scene because the emitted
  `.ts` carries every scene, so `tsc --strict` meets the call without any frame paying to
  render it. One names `sheet-1`, whose file name is hostile, which is the only place the
  emitted key and the `ASSETS` table have to agree about a hostile string; the other dangles,
  and must emit **no call at all** — in the exported `.ts` that is the difference between a
  wrong picture and a compile error.
- **`hasMotionIn` is untouched and records its seventeenth refusal**: a mask does not move.

**What stays refused.** **No mask from another node**, which is the half of the old sentence
that is still true and is a genuinely different feature: it needs a node picker, and a mask
node would have to be drawn and then not drawn. **No geometry mask** — Phaser's other mask
kind takes a `Graphics`, which is a shape this document has no way to describe: the emit-zone
argument and the gradient fill's. **No `viewCamera`, `viewTransform` or `scaleFactor`** —
every one is past where the prefix stops, and the last two only mean anything for a
GameObject mask. **The other four texture-taking filters** are now each a *pure loosening* of
the machinery this built, one member and one picker apiece, which is worth saying because
their cost genuinely dropped when this shipped. **No animating a mask** — a tween's `to` is
six numeric properties that are one shape across the whole union. And **no mask on a tilemap
layer, a prefab child from outside, or a group's children individually** — `fx`'s and
`blendMode`'s refusal verbatim: this is on a node, and a layer is not one.

## Blend modes

A node may carry `blendMode?: BlendMode` — `NORMAL`, `ADD`, `MULTIPLY` or `SCREEN` — and it
is drawn on the canvas and emitted in the export identically, because like a filter a blend
mode is a standing fact about *how an object is drawn* rather than a step of a simulation.

- **This is iteration 34's closing lesson arriving on schedule, for the second time
  running.** *A refusal list is a list of things somebody thought of, and the hole that
  survives is the one nothing prompted the question.* Iteration 35 quoted that against
  filters, and the sentence it quoted named **three** things absent from `src/`: masks,
  filters and blend modes. Filters shipped, and masks followed in iteration 40 — when the
  argument that had refused them turned out to be six filters priced in one sentence, with a
  false clause doing the deciding. Blend modes were never mentioned again — and the grep that found them was one line long: `blendMode`
  lived in exactly one place, as a **per-type particles prop**, so a fire emitter could say
  "add me to what is behind" while a glowing sprite, a highlight panel and a text caption
  could not. The list never named it because the list is a record of questions somebody
  asked, and nobody asked this one.
- **One field, and the particles prop migrated into it — the whole iteration turns on
  this.** A `ParticleEmitter` mixes in Phaser's BlendMode component exactly as every other
  game object does, so `ParticlesProps.blendMode` and a node-level field were never two
  questions; they were **two answers to one**, which is what a sprite having no width of its
  own, a tilemap no tile size, a camera no rectangle and a text node a `fontFamily` rather
  than a `fontId` all exist to refuse. The rejected shape was to leave the prop alone and
  exclude `particles` from the node-level field: cheaper by one reader and one migration,
  and wrong three times over — it is two answers to one question; it makes `particles` the
  one type whose blend is per-type, so the two allowlists are free to drift (and
  `TAPPABLE_TYPES`-beside-`PHYSICS_TYPES` is a *deliberate* second list asking a different
  question, where this would be an accidental one asking the same); and it puts two fields
  about blending on one panel, which the suite's exact-match locator turns into a failure.
  This is the second iteration to take a field **off** a props interface — iteration 25
  moved a tilemap's `data` and `collides` into its layers the same way, and the deprecation
  comment, the migration-on-read and the delete-on-write here are all copied from it rather
  than invented.
- **A fifth optional top-level field**, beside `physics`, `controls`, `tween` and `fx`, for
  `fx`'s reason: it is not per-type, so every entry of `NodePropsByType` would carry the same
  word and `createNode` would have to answer "what is this rectangle's blend mode".
- **No top-level rule, which is `tween`'s and `fx`'s call and not `physics`'.** A body and a
  drive-scheme are banned inside a container because both read their owner's `x`/`y` as
  *world* coordinates every step; a blend mode writes no coordinate at all. So `blendModeOf`
  takes no `topLevel` argument, nothing is stripped on read, `setNodeBlendMode` reaches
  through `mapNode`, and a blend inside a prefab definition draws in every placement. Worth
  saying in as many words, because two of its four neighbours ban exactly this and the code
  reads like a missed guard.
- **Four modes, and the number was read out of the shipped package rather than recalled.**
  `node_modules/phaser/skills/game-object-components/SKILL.md` and `setBlendMode`'s own doc
  comment in `types/phaser.d.ts` both say that under WebGL only NORMAL, ADD, MULTIPLY,
  SCREEN and ERASE exist; the `v3-to-v4-migration` skill puts it sharpest — *"Canvas retains
  one advantage: 27 blend modes vs WebGL's 4 native modes."* Both this canvas and the
  exported page run WebGL, so the other 23 are a control that would do nothing on the only
  renderer anybody here uses. That is Phaser's limit rather than this editor's, the
  `NineSlice`-cannot-animate sentence one component over. "Phaser 4, not 3" for the fifth
  time, and the one iteration where following it cost a single grep.
- **`BLEND_MODES` is an allowlist and the argument is not injection** — `str()` already sits
  between the value and the output. It is `TWEEN_EASES`' and `RULE_KEYS`' reason exactly: a
  mode Phaser does not implement is a **silent no-op**, no warning and no error and a picture
  that simply never changes, which is indistinguishable from the feature being broken.
  Refuse the value rather than discover it on the far side of an export. It is also what
  makes the control a `SelectField`.
- **ERASE is left out for its own reason rather than that one.** It *is* a WebGL mode, so it
  would work; what it does is cut a hole through to what is behind the object, which on this
  canvas is the editor's own background and in the export is the game's — and the migration
  skill notes that meaning it properly in v4 needs "indirection through a `CaptureFrame`,
  `DynamicTexture`, or similar", a render target the document has no way to name. So an
  ERASE would draw one thing here and another in a game that composites over anything, which
  is the single failure this project guards hardest against. A render-texture feature, not
  one array entry.
- **`blendModeOf` is the only reader**, in the `effectsOf` / `tweenOf` / `physicsOf` /
  `guidesOf` / `tileMapOf` family, answering three questions at once: is there a mode, is it
  one this editor can both draw *and* emit, and is this a `particles` node written before the
  mode moved off its props. **It is the first reader in that family that is *not* React error
  #185 in a zustand selector**, and that needs saying because thirteen of its neighbours
  carry the opposite warning: they build a fresh object or array per call, and this returns a
  bare string, which zustand compares by value. Say it, or the next reader adds a warning
  that is not true.
- **The new field wins a document that says both, which is `atlasOf`'s tie-break inverted.**
  There a grid wins because it is the older shape and therefore the one an older build could
  have written; here the only way both can be present is that an old build wrote the prop and
  a current build then wrote the field, so the field is the later statement of intent. The
  store makes that state unreachable anyway — strip on read, refuse on write, for the sixth
  time.
- **The migration is deliberately *not* `editTilemapProps`' normalise-on-every-write.** A
  tilemap normalises on every write because `layers` and `data` are two spellings of one
  array that later writes both touch; this is one word with one reader, so a legacy emitter
  edited in some other field keeps its stale prop and nothing disagrees, because nothing else
  reads it. Only the blend write normalises. Said out loud, because "lazy migration" and
  "forgot to normalise" read identically.
- **`setNodeBlendMode` is a store action of its own, and `updateProps` genuinely could not do
  it.** `updateProps` spreads a patch, so it can set a key and can never *remove* one:
  `{ blendMode: undefined }` leaves the key holding undefined, which survives in memory,
  vanishes through `JSON.stringify`, and gives the document two spellings of "off". That is
  why `setNodePhysics`, `setNodeControls`, `setNodeTween` and `setNodeLabel` all `delete`,
  and NORMAL is absence here in exactly that way. The second reason is that it strips the
  pre-v15 particles prop in the same write, which a props patch could not do at all.
- **Absent means NORMAL, and `createNode` seeds nothing** — the rule the asset table, the
  tilemap helper, the prefab factories and `NodeControls.touch` all follow, so every project
  written before this exports byte for byte what it exported before. It is the one deliberate
  contrast with `defaultEffect` and `defaultTween`, which both seed a *visible* value because
  a thing that arrives doing nothing looks like a broken feature: a blend mode is never
  added, it is **chosen**, so there is no press to make visible and that rule does not
  transfer.
- **A `particles` node is blended on its emitter, not on its wrapper — and it needs no
  renderer write at all.** `applyBlend` returns early for one. The mode is part of
  `emitterConfigFor`'s config, exactly as it is part of the exporter's config literal, so the
  canvas and the export set an emitter's blend through the *same shape* — `textStyleOf`'s
  two-consumer rule — and the existing `emitterConfigs` guard already covers it. Reaching in
  and calling `setBlendMode` on the emitter beside that config would be two notions of one
  state, which is the tile eraser's and the emitter marker's refusal. The wrapper is refused
  for `applyEffects`' reason verbatim: it also holds the editor's own pink marker, which is
  chrome the exported game does not have.
- **No cache guard, and the absence is deliberate** — which needs saying beside three
  neighbours that all have one and all explain why. `applyTextStyle`, `setConfig` and
  `applyEffects` are guarded because applying is expensive or destructive: `setStyle`
  re-rasterises a text object's own canvas, `setConfig` calls `resetCounters` and restarts
  the flow, `applyEffects` tears down and rebuilds a `FilterList`. `setBlendMode` assigns a
  number and marks the object dirty. The batch flush Phaser's docs warn about is a cost of
  *drawing* two modes in a row, which no guard could avoid.
- **SHUTDOWN needs nothing and `destroyDisplayObject` gains no line**, because nothing is
  cached. A texture belongs to the game, an animation to its manager and a `FontFace` to the
  *page*, so all three outlive the scene; a blend mode is a number on the object and dies
  with it. `shapeOf` gains nothing either — an in-place setter, the emitter's `setConfig`
  case rather than the nine-slice's, and folding it into the rebuild signature would destroy
  and recreate the object for a word.
- **The export is one `modifiersFor` branch, the first since `tileSprite`, and it follows
  *that* function's rule where the emitter config follows the opposite.** The config literal,
  the physics body, the camera block and the Matter body are all emitted whole because their
  dials only mean anything beside each other — a body's drag only bites while acceleration is
  zero, a lifespan only means something beside a frequency. A blend mode means something
  entirely alone, one word about one object like a tint or a flip, so `.setBlendMode("NORMAL")`
  on every object in the file would be a line restating a default on every object in the file.
  The tint branch's own call, one property over.
- **`setBlendMode` returns `this`**, checked in `types/phaser.d.ts` rather than recalled — so
  unlike the physics setters and the filter calls it genuinely chains, and `modifiersFor`
  needed no "there is no branch here, and here is why" comment for once. The argument is the
  **quoted string**, which is the spelling this exporter has used for exactly this value in
  the emitter config literal since iteration 15 and is therefore already proved to type-check
  under `tsc --strict`; it also needs nothing of the shared `create()` body, which is the same
  plain JavaScript in the `.ts`, the `.js` and the runnable page and can carry no cast.
  Phaser declares the parameter `string | Phaser.BlendModes | number`.
- **A `particles` node is excluded from that branch, and not for the renderer's reason** — it
  is that an emitter's mode is already in the config literal, emitted whole. Emitting both
  would be the same fact twice, and moving it out of the config into the chain would break
  the whole-config rule and the byte-for-byte rule in one go.
- **No gate, no table, no `EmitContext` field, no `prepare` flag and no new module helper**,
  so nothing is drawn from the module identifier set and **nothing above it moves** —
  `toIdentifier` suffixes a clash and four helper names are asserted verbatim in the suite.
  Iteration 31's "nothing moved" for the second time.
- **`constructorFor` gains no case, so every step of this feature is silent** — the renderer,
  the exporter, the inspector and the store alike, exactly as the whole of physics, cameras,
  behaviour and touch were. There is no `effectCallFor`-style exhaustive switch to catch a
  new mode. `blend.spec.ts`, `export.spec.ts` and `export-toolchain.spec.ts` stand in for the
  compiler. What the compiler *did* do was find the work: making `ParticlesProps.blendMode`
  optional rather than deleting it turned both remaining consumers into compile errors, which
  is the `clampFrame` → `resolveFrame` trick applied to a field.
- **The panel is a new flat peer `Blend` section above `Effects`**, rendered for every node
  type because Phaser mixes BlendMode into the base `GameObject` — so there is no eligibility
  list to keep in step, `EffectsSection`'s sentence one field over. Not a row inside an
  `Appearance` section, because there are five of those, one per type branch, so a field
  belonging to *every* node would be reachable on half the types and missing on the rest.
  And not a row inside `Effects`, because folding it in would have meant retitling that
  section — and **a `Section` title is a persisted storage key**, so the rename would silently
  reset it for every existing user. Above Effects because that is the order the pixels go in.
- **The label is `Blend mode`**, never the bare `Blend` the particles panel used to carry and
  never `Mode`: the suite matches a label exactly, and that panel already holds a Frame, a
  Name and a Kind. The section title `Blend` collides with no `SECTION_TITLE` value, no other
  `Section` title, and none of the mobile tab bar's exactly-matched `Scene`/`Properties`/`File`.
- **`SCHEMA_VERSION` did not bump — the guides case, thirteenth time, and the reasoning is
  worth keeping because it nearly went the other way.** No new `NodeType`, so a v14
  `createDisplayObject` has a case for everything in the file, and `node.blendMode` rides in
  on `scenes`, which `parseProject` passes through verbatim, **and on `prefabs.children`,
  which `parsePrefabs` also passes through unvalidated**. The half that had to be thought
  about is the particles migration, because a current build *deletes* `props.blendMode` and a
  v14 build reads that prop in two places. What settles it was read out of the shipped
  package rather than predicted: `ParticleEmitter`'s `configFastMap` loop assigns through
  `HasValue`, and the `blendMode` setter does `value |= 0`, which coerces `undefined` to `0`
  — NORMAL — and assigns. **No throw**, so the crash half does not fire. Its exporter prints
  `str(undefined)`, which is `JSON.stringify(undefined)`, the *value* `undefined`, so the
  emitted line reads `blendMode: undefined,` and runs as NORMAL. So a v14 build draws and
  exports that one emitter plain — and loses nothing from the file, because `node.blendMode`
  survives its re-save verbatim and `props.blendMode` was already gone before it arrived.
  **An old build doing less, not a file breaking**, which is iterations 31, 33 and 34's edge
  exactly, and emphatically *not* the v12 tilemap-layers case, which bumped because the old
  build wrote the loss back into the file. `blend.spec.ts` asserts the 14 in the saved
  artefact so a future bump is a deliberate act.
- **One edge recorded rather than left to be found**: a v14 build's own particles Blend
  select renders with `value={undefined}`, shows "Normal", and *writing* it puts
  `props.blendMode` back — after which a current build ignores that edit, because the reader
  prefers the node field. An old build's edit silently not taking effect is the sharpest
  thing here, and it is still not a file breaking.
- **The suite's instrument is a colour that is on neither object alone**, which is a strictly
  stronger reading than the glow's next door: that one only had to find its colour *outside*
  a box, where this finds a colour no object in the scene was given. Additive blending puts
  `BACK + SHAPE` on the canvas, so "it blended at all" is `count > 0` where a feature
  silently doing nothing gives exactly 0 — and the negative half is what makes it mean
  something: back at Normal that colour is gone while both fills remain.
- **The three colours were picked by arithmetic, not by eye**, which `TOUCH_COLOR`,
  `TWEEN_COLOR`, `SPAWN_COLOR` and `GLOW` all record nearly getting wrong. Checked against
  every hex literal in `tests/` and every chrome colour in `EditorScene.ts`, 53 in all,
  against `findColor`'s tolerance of 24: backdrop `#aa66aa` at a worst channel margin of 71,
  shape `#448800` at 68, and the sum `#eeeeaa` at 68, with the sum 136 and 170 from the two
  sources. **No channel clamps**, so the arithmetic is exact rather than saturated and the
  claim is about blending rather than about hitting the ceiling. Re-run that check when a
  fixture colour is added anywhere in the suite.
- **`blend.spec.ts` needs no raised timeout and no long poll budget**, unlike
  `effects.spec.ts` beside it: a live filter puts the frame through a framebuffer the
  headless container rasterises on the CPU, and a blend mode is a blend-state change that
  costs the software renderer nothing measurable. Said in the file, because a reader arriving
  from the neighbouring spec will wonder where the line went.
- **The particles claim is asserted through the document and the export, never through
  pixels**, and deliberately: an emitter is stopped unless ▶ is on, and what a running
  emitter's blended particles average to at one instant is a race with the frame rate.
  Typography's call for weight and slant. One trap it cost on the first run: an emitter with
  no image emits a `missingReason` comment rather than an `add.particles` call, so a fixture
  meant to assert the config literal has to carry a real one — found by running the test, not
  by reading.
- **`hasMotionIn` is untouched and records its thirteenth refusal**, which is the easy one
  for once: a blend mode does not move.

**What stays refused.** **No canvas-only modes** — the other 23 are Phaser's limit under
WebGL, and offering one would be the silent no-op the allowlist exists to prevent; the v4
`Blend` *filter* can recreate them, and that is a render-texture feature and a fifth
`NodeEffect` kind rather than an array entry here. **No ERASE**, above. **No custom blend
equation**, which is a shader, which is code in the document — the emit-zone argument and the
gradient fill's. **No blend mode on a tilemap layer, a prefab child from outside, or a
group's children individually** — `fx`'s refusal verbatim: a blend mode is on a node, and a
layer is not one. **No camera-wide blend**, which is a property of the view, and iteration 31
already put what happens to a view on a rule. And **no animating one** — a tween's `to` is six
numeric properties that are one shape across the whole union, and a mode is a discrete word,
which is exactly the refusal that keeps a seventh tween property out.

## Parallax and pinning

A node may carry `scrollFactor?: { x: number; y: number }` — how far it moves when the
scene's camera does. `1` is in sync with the world and is what absence means, `0` pins the
object to the camera, and between them is parallax. Drawn on the canvas and emitted as a
real `.setScrollFactor(...)`, so the editor and the exported game do the same thing.

- **It is iteration 38's prescribed check run, and it found the refusal with a wrong clause
  in it.** That iteration left iteration 39 a mechanical instruction: `grep` this file for
  `scene.start` and for "game logic" and read every pre-28 refusal against what a rule can
  say now. Nineteen such refusals; eleven already closed, and most survivors turned out to
  be one cheap member. This is the one that was interesting, and it is interesting because
  of *how* it was wrong rather than *that* it was:
  - Iteration 19 wrote **"No scroll speed on a tile sprite — a background that drifts is
    `tilePositionX += delta` in the game's own `update()`, which is behaviour over time and
    the `scene.start` argument."** That is **correct and stays refused**. A per-frame
    increment is the one shape this vocabulary structurally cannot name.
  - Iteration 25 then wrote **"No scroll factor and no parallax, which is the tile sprite's
    refused scroll speed one type over: a layer that drifts is behaviour over time, and a
    layer that moves at a different rate to the camera is a second camera's question."**
    The first clause is a citation of a real limit. **The second is wrong.** A thing that
    moves at a different rate to the camera is not a second camera and is not behaviour
    over time — it is `setScrollFactor`, declared once at boot, which is a *standing fact
    about the world* in iteration 20's own sense, in the same breath as `setCollision` and
    `add.collider`.
- **So the lesson to carry forward is narrower than 38's, and it is a new failure mode: a
  refusal sentence can weld a real limit to a fake one, and the fake half inherits the real
  half's authority.** Iteration 34 said a refusal list is a list of things somebody thought
  of; 37 said it gets longer in the direction it is already looking; 38 said the holes are
  in the sentences a feature wrote about itself before the closer existed. This one is
  inside a *single sentence*: "a layer that drifts" earned the refusal and "a layer that
  moves at a different rate to the camera" rode in beside it on a comma. Nobody went back,
  because the sentence reads as one argument. **The check for iteration 40 is therefore to
  re-read the refusals that justify themselves by pointing at a neighbour** — the ones that
  say "X's argument one type over", "the same sentence one feature on", "the `.tmj`
  argument at a smaller scale — and ask whether the neighbour's argument actually reaches
  this case, or only the case beside it.
- **The fact that settled it was already in the exporter.** `grep -rn scrollFactor src/`
  returned three lines before this iteration, all of them inside the touch-controls helper,
  where iteration 21 wrote *"`setScrollFactor(0)`, the first this exporter has ever emitted,
  which is what makes these a HUD rather than three objects in the level."* The editor has
  known how to build a HUD for eighteen iterations and the document has never been able to
  ask for one.
- **And two shipped features did not work together.** Iteration 30 gave a text node a live
  variable label — a score readout — and iteration 18 gave the scene a camera that scrolls
  and follows a target. The score slides off the screen. `README.md` has meanwhile
  advertised the `tileSprite` type as *"a wall, water or a parallax background layer"* since
  iteration 19, which it could not be: a tile sprite repeats, and nothing in the document
  could say it moves at a different rate to the camera, which is the whole of what parallax
  is. A README promising a feature the schema cannot express is the sharpest version of a
  hole this list has produced.

**The canvas draws the offset, and that is the decision the rest of it turns on.**

- **`applyNode`'s invariant gains its second exception, and it is a different kind from the
  first.** Phaser renders at `x - camera.scrollX * scrollFactorX`, so at the frame the game
  opens on a factor-`f` object occupies the world point `x + scroll * (1 - f)`. The editor
  draws it there. A tween's break of that invariant is **temporary and thrown away** —
  switch ▶ off and everything is back. This one is **standing**, and it does not need to be
  either: it is a *constant* per node, read off the document's own camera, so it is exact
  rather than drifting.
- **At the default camera scroll of `(0, 0)` the offset is exactly zero for every factor**,
  which is not a special case but the arithmetic agreeing — a camera that has not moved
  offsets nothing. So every project written before this draws byte for byte what it drew
  before, and so does the canonical HUD case, since a camera that *follows* a target still
  opens where it was put. The offset is visible only for a scene whose camera opens already
  scrolled, which is precisely the only state in which the canvas and the export could ever
  have disagreed.
- **The alternative was to draw nothing, and it is the one this document would normally
  take** — the camera's own "drawn, never applied" for the fifth time. It was refused
  because of what it buys: for a scene whose camera opens scrolled, the editor would show a
  HUD element outside the shot while the exported game puts it inside. A canvas and an
  export disagreeing about a picture is the single failure this project guards hardest
  against, and it outranks an invariant that already has one exception.
- **The offset is drawn as a position, never by setting `object.scrollFactorX`**, and that
  is the trap worth stating because the one-line version looks obviously right. The editor's
  `cameras.main` is the **user's own view** — pan, pinch, ⤢ Fit — so an object given a
  factor of 0 there would pin itself to the *viewport* and slide about the scene as the user
  looked around. The document means the game's camera, which this canvas never applies.
- **Three consumers, one computation.** `applyNode` works the offset out and remembers it in
  `scrollOffsets`, keyed by display key; `drawBodies` and `drawTweenGhosts` read it back.
  Both draw a mark *around* an object rather than the object itself, so a mark that
  recomputed the offset would be a second place for the sign to be wrong — and a wrong sign
  is an outline at twice the distance in the opposite direction. `drawBodies` adds it to the
  **document's** position rather than reading `object.x`, which would be identical today and
  would quietly start following a tweened object under ▶.
- **The drag needed no change at all**, and that is worth stating because it looks like the
  first thing that would break. `DRAG` applies the pointer's own *displacement* to each
  node's stored start value, so a constant added to both sides subtracts out. `localRectOf`,
  `hitAreaFor`, `applyHitArea`, `worldBoundsOf`, `publishMeasuredBounds`, `snapTargetsFor`
  and both handles all read the **object**, so they follow the drawn position automatically
  and stay consistent with each other. On that list "no branch needed" and "forgot a branch"
  read identically, which is why it says so in the code. The consequence worth stating rather
  than discovering: **align and snapping work in drawn space**, so lining a pinned object up
  with a world one lines up what is on screen — and because the offset is a constant,
  `worldMovePatch` applying a drawn-space delta to the stored value lands exactly. That is
  `publishMeasuredBounds`' own definition ("as the renderer last drew it") holding, the way
  it already does for a tweened object under ▶.
- **`cameraScrollOf` was split out of `cameraViewOf` rather than copied.** The violet frame
  and the offset both need the clamped scroll, and a clamp written twice is a HUD drawn
  inside the frame by one and outside it by the other — `textStyleOf`'s two-consumer rule,
  on a number nobody can check by eye.

**Top-level only, and — unusually — not for `physics`' reason.**

- **Phaser honours a container child's scroll factor perfectly well.** This was read out of
  `ContainerWebGLRenderer.js` rather than guessed: it sets
  `child.setScrollFactor(childScrollFactorX * scrollFactorX, …)` before rendering each child
  and restores it afterwards, so nesting genuinely **composes multiplicatively** and an
  export could say it. That is the opposite of what a reader will assume from the two
  neighbours that share this rule, and the reason the ban is argued from the other end.
- **What cannot say it is the editor's canvas.** A scroll factor is drawn here as a position
  offset, and a position offset composed through a rotated, unevenly scaled parent chain is
  not a translation a child's own `x`/`y` can express. Refusing it in the document is
  therefore honest where drawing it wrong would not be — the canvas and the export agreeing
  is the property this whole feature exists to keep, and this is the one place it could have
  been bought at the cost of itself.
- **And it loses nothing, because a container *is* a node.** "Pin these five things" is said
  on the group, which is top-level, and everything inside it moves together. The hostile
  project's rotated group carries a real factor for exactly that, and its rotated child
  carries an illegal one — the strip is asserted against the case that would be hardest to
  draw.
- **Strip on read, refuse on write**, for the seventh time: `scrollFactorOf(node, topLevel)`
  answers `{1, 1}` for a nested node and `setNodeScrollFactor` reaches `scene.children`
  directly, so `moveNode`, `groupSelection`, `pasteNode` and the tree's drag-to-nest each
  need no guard, and a node dragged into a group and back out again keeps what it had —
  `physicsOf`'s treatment of a nested body exactly. A prefab definition's children are
  container children by the same mechanism, so one ban covers both; they take **different
  code paths in the exporter** (`buildFactories` emits a definition's children through
  `emitNode(..., true)` rather than through the container branch), which is why the hostile
  project carries one of each.

**The field, the reader, and the rest.**

- **Two numbers rather than one**, which is the transform's Scale X/Y and a tile sprite's
  Tile scale X/Y rather than the second-field-over-one-number this document refuses
  everywhere else. They are a genuine two-axis fact: a side-scroller's sky wants
  `{ x: 0.3, y: 1 }` so that it lags sideways and does not slide when the camera rises, and
  a HUD wants both at zero. One number could say neither.
- **`scrollFactorOf` is the only reader**, in the `blendModeOf` / `effectsOf` / `tweenOf` /
  `physicsOf` / `guidesOf` / `tileMapOf` family, answering three questions at once: is there
  a factor, is this node somewhere one would mean anything, and are both numbers ones Phaser
  and the canvas can be handed. **It builds a fresh object per call, so
  `useEditorStore((s) => scrollFactorOf(...))` is React error #185** — the `tileMapOf` trap,
  fourteenth time. That needs saying twice as loudly here as anywhere else, because the
  reader immediately above it in the file is documented as the *one* member of the family
  that is safe in a selector: a bare string compares by value and a pair of numbers does not,
  and anybody arriving from `blendModeOf` will carry the wrong half over.
- **Repair, never drop** — `cameraOf`'s policy rather than `soundsOf`'s split, and *a repair
  may narrow what the document says; it may never widen it* is satisfied trivially, there
  being no gate inside a scroll factor for a repair to open. A nonsense number reads as 1,
  which is the state every object was in before this field existed. A repair costs the
  *number*, not the object and not the other axis.
- **`MAX_SCROLL_FACTOR` is 10, exported, and it is the only runaway here.** A factor is a
  multiplier on the camera's scroll, so a hand-edited six-figure one is an object that has
  silently left the game the moment the camera moves. Exported where `DEFAULT_BURST` is not,
  by that pair's split: a *limit* has to be the same number in the panel's field and in the
  reader's clamp, or the control offers what the reader takes back. There is no seed beside
  it, because a scroll factor is never added — it is set.
- **Negative is legal and left alone**, which is deliberate rather than an oversight: an
  object that travels *against* the camera is a real effect people reach for, and refusing
  it would be refusing a thing Phaser does.
- **Absent means `{ x: 1, y: 1 }`**, so `createNode` seeds nothing — the rule the asset
  table, the tilemap helper, the prefab factories and `blendMode` all follow. It is the
  deliberate contrast with `defaultEffect` and `defaultTween`, which both seed a *visible*
  value because a thing that arrives doing nothing looks broken: a scroll factor is never
  added, it is **chosen**, so there is no press to make visible and that rule does not
  transfer.
- **`setNodeScrollFactor` is a store action of its own, and `updateProps` genuinely could
  not do it.** `updateProps` spreads, so it can set a key and can never *remove* one:
  `{ scrollFactor: undefined }` survives in memory, vanishes through `JSON.stringify`, and
  gives the document two spellings of "off". `setNodePhysics`, `setNodeControls`,
  `setNodeTween`, `setNodeLabel` and `setNodeBlendMode` all `delete` for that reason and
  this joins them, sixth. It also normalises `{ x: 1, y: 1 }` to absence in the same write,
  so the panel can never put the default into the document.
- **Nothing else in the store needed an edit**, and beside `removePrefab` and
  `removeVariable` that reads like six forgotten steps. A scroll factor names nothing the
  document holds — no node, no asset, no variable, no scene — so `removeAsset`,
  `removeVariable`, `removePrefab`, `mapProjectNodes`, `ruleNames` and `duplicateScene` all
  inherit the right answer. It is `effectsOf`'s "the first reader in that family with no
  dangling reference to check", one field over.

**The export.**

- **One `modifiersFor` branch, the second since `tileSprite`**, following *that* function's
  rule as the blend mode above it does: printed only where it differs from Phaser's default,
  so `.setScrollFactor(1, 1)` is never a line on every object in the file and every project
  that predates this exports byte for byte what it did before. A scroll factor means
  something entirely alone — one fact about one object, like a tint or a flip — which is
  what puts it on this side of the line rather than beside the emitter config and the
  physics body, whose dials only mean anything next to each other.
- **`setScrollFactor(x, y?)` returns `this`** (checked in `types/phaser.d.ts`, not recalled),
  so unlike the physics setters and the filter calls it genuinely chains. The one-argument
  form means **both** axes, which is Phaser's own shorthand, so a HUD emits
  `.setScrollFactor(0)` rather than `.setScrollFactor(0, 0)`.
- **A `tilemap` needed nothing**, and that was checked rather than assumed, because it is
  the one type where one chain visibly has several objects to reach. `emitNode` emits the
  further layers as siblings and reuses the *same chain string* for each, so a stack scrolls
  as one piece for free. A map whose floor lagged behind its walls is exactly the failure
  that would read as the feature half-working.
- **A `particles` node is included, and that is the one place this parts company with the
  blend mode directly above it.** That one excludes an emitter because its mode is already
  inside the config literal `constructorFor` emits whole; `scrollFactor` is **not** a
  `ParticleEmitterConfig` key at all — checked, the emitter reads `scrollFactorX`/
  `scrollFactorY` off itself in its renderer — so the chain is the only place it can go. In
  the editor the offset lands on the wrapper Container, which is what carries the position,
  and the pink marker riding along is correct because the marker marks where the emitter is.
  That is the opposite call from `applyEffects` and `applyBlend`, which both refuse that
  wrapper, and the difference is that those are about pixels and this is about a place.
- **No gate, no table, no `EmitContext` field, no `prepare` flag and no new module helper**,
  so nothing is drawn from the module identifier set and **nothing above it moves** —
  `toIdentifier` suffixes a clash and four helper names are asserted verbatim in the suite.
  Iteration 31's, 36's, 37's and 38's "nothing moved", fifth time.
- **No game-config key and no header note**, the next entry in the comment block above
  `arcadeConfig` where the audio, camera, keyboard, touch, tween, label and glow refusals
  already are. `cameras.main` is built for every Phaser game and a scroll factor is a
  property of an object, so a module dropped into someone else's game needs nothing added.
- **`constructorFor` gains no case, so every step of this feature is silent** — the renderer,
  the exporter, the inspector and the store alike, exactly as the whole of physics and
  cameras were. There is no exhaustive switch to catch a missed one. `parallax.spec.ts`,
  `export.spec.ts` and `export-toolchain.spec.ts` stand in for the compiler.

**The panel.**

- **A new flat peer `Scroll` section between `Blend` and `Effects`**, rendered for every node
  type because Phaser mixes `ScrollFactor` into the base `GameObject` and a `TilemapLayer`
  and a `ParticleEmitter` each carry one too — so there is no eligibility list to keep in
  step, `BlendSection`'s sentence one field over. Deliberately **not** titled `Camera`, which
  `SceneInspector` already owns: a `Section` title is a persisted storage key, so two panels
  sharing one would open and close together though they are about different things. Below
  Blend because a blend mode is about the pixels and this is about the place.
- **The labels are `Scroll factor X` and `Scroll factor Y`**, never a bare `X`/`Y`, which the
  Transform section a few rows up this same panel owns, and clear of `SceneInspector`'s
  `Camera X`/`Camera Y`. The suite matches a label exactly.
- **A nested node gets a sentence, not a hidden section** — `NodeRulesSection`'s and
  `CollidersSection`'s rule, *a control that says why it cannot beats one that is not there*.
  **And its wording is deliberately clear of that section's own nested hint**, which says
  "top level of the scene" a few rows down the same panel: both are hints and both render at
  once for a nested node, so a spec reaching either by its text matched two. That is the
  exactly-matched-label rule arriving on a *paragraph*, and it cost this feature's spec a run
  before it was noticed.
- **The physics interaction is stated rather than refused**, in Phaser's own words: its
  `scrollFactorX` doc says *"scroll factor values other than 1 are not taken in to
  consideration when calculating physics collisions. Bodies always collide based on their
  world position."* So a pinned object collides where it is stored rather than where it is
  drawn. The tween-versus-dynamic-body call and the `setText`-versus-label one: a combination
  explained beats a combination silently refused. Shown only where a non-default factor and a
  body are **both** present, so it is a fact about that object rather than a warning on every
  object in the project — and it is the one hint here that names a state two sections apart
  on the same panel.

**The suite.**

- **The instrument is an extent (`findDrawnBox`), never a centroid.** What is asserted is
  *where* something is drawn, and `camera.spec.ts` records a centroid moving 14px on the
  mobile project alone for a reason that is not position — a stroke lands on a different
  sub-pixel phase on each of its four edges.
- **The fixture colours are `blend.spec.ts`', reused rather than newly picked**, which is
  strictly safer than a fresh pair: both were already checked by arithmetic against every hex
  literal in `tests/` and every chrome colour in `EditorScene.ts` — `#aa66aa` at a worst
  channel margin of 71 and `#448800` at 68 — and neither comes near the one fixture colour
  added since. It is why that file carries no arithmetic table of its own.
- **Every drawn claim needs a camera that opens scrolled**, which is not a contrivance to
  make the test work: it is the only state in which the offset is non-zero, and therefore the
  only one worth a screenshot. The claim is a *difference* between two objects that start at
  the same stored `x`, so whatever the projection does to one it does to the other.
- **The positive runtime claim is in `export.spec.ts` and can only be there**, because the
  editor never applies the document's camera. The near side can say where an object is drawn
  at the frame the game opens on; whether it then stays there while the camera *travels* is a
  question about a camera in motion, which is what this canvas does not run. A pan rather
  than a follow, for the fade's reason: a pan is a stated destination over a stated time
  where a follow is a race with whatever it follows. And the world object is asserted to have
  moved **first**, because "the HUD did not move" is true of an export where the camera never
  panned at all.
- **Both guards were checked by breaking them**, which is iteration 33's and 37's rule: the
  `applyNode` offset was removed and the drawn test confirmed red, and the reader's
  `topLevel` strip was removed and the nested test confirmed red. The second is stronger than
  it looks — deleting the parameter's *use* is caught by `noUnusedParameters` before a test
  runs at all, so the guard has a compiler behind it as well as a claim.
- **`SCHEMA_VERSION` did not bump — the guides case, sixteenth time.** No new `NodeType`, so
  a v14 `createDisplayObject` has a case for everything in the file, and `node.scrollFactor`
  rides in on `scenes`, which `parseProject` passes through verbatim, **and on
  `prefabs.children`, which `parsePrefabs` also passes through unvalidated** — so both homes
  survive an old build's re-save. A v14 build draws the object at its document position,
  emits no setter and carries the field back out untouched: **an old build doing less, not a
  file breaking**, which is iterations 31, 33, 34, 36 and 37's edge exactly. Still contingent
  on `parseProject` not reconstructing scenes or prefab children field by field.
  `parallax.spec.ts` asserts the 14 in the saved artefact.
- **`hasMotionIn` is untouched and records its sixteenth refusal**, and it is an easy one: a
  parallax background moves only because the camera does, and this canvas never applies the
  camera. There is nothing here for a ▶ to start and nothing it could stop.

**What stays refused.** **No scroll speed and no drift** — iteration 19's refusal, intact and
for its own reason: `tilePositionX += delta` is a per-frame increment, which is the one shape
this vocabulary cannot name and the first thing that would need an emitted `update()`. That
half of iteration 25's sentence stands; only the half riding beside it on a comma did not.
**No scroll factor on a tilemap *layer*, a prefab child from outside, or a group's children
individually** — `fx`'s and `blendMode`'s refusal verbatim: this is on a node, and a layer is
not one. **No animating one** — a tween's `to` is six numeric properties that are one shape
across the whole union, which is exactly the refusal that keeps a seventh out. **No rule
action that sets one** — it is a standing fact about how an object is drawn rather than
something that happens at a moment, which is the call `blendMode` and `fx` both made. **No
camera-relative *size*** — `setScrollFactor` has no scale twin, and a HUD that resized with
the zoom is the camera's `ignore` list and a second viewport rather than a field. And **no
screen-space authoring mode**: a second coordinate system in the document is the rectangle
iteration 21 refused when it made the touch pad's layout derived rather than stored.

## Tweens

A `tween` on a node says where its own numbers end up and how they get there. It runs on
the canvas under the ▶ toggle the animations and the emitters already had, it is drawn as
a dashed destination when it is not running, and it exports as a real `this.tweens.add`.

- **It is the first thing allowed to break `applyNode`'s invariant, and the difference
  from physics is the whole of why.** That comment says "drawn position == stored
  position, always"; while preview is on, a tween owns the properties it drives and the
  document is never written. Physics is refused here because a step *rewrites the numbers
  the document is made of* — there is nowhere else for the result to go, so there is no
  version of "run it for a moment" that leaves the document alone. A tween's result is
  thrown away the instant it stops, so switching ▶ off puts every object back exactly. It
  is the animation branch's own admission one step further: preview is the moment the
  canvas deliberately stops mirroring the document, and until now that only cost a sprite
  the frame it was showing. `tweens.spec.ts` asserts the document byte for byte across a
  run rather than taking the argument on trust.
- **The tween is on the node, beside `physics` and `controls`, and it is the first of the
  three with no top-level rule.** That contrast is the point rather than an omission. An
  Arcade body and a drive-scheme both read their owner's `x`/`y` as *world* coordinates
  every step, which is why both are banned inside a container and inside a prefab
  definition; a tween writes the object's own properties, which are parent-relative for a
  container child exactly as the document's are. So `tweenOf` takes no `topLevel`
  argument, nothing is stripped on read, `setNodeTween` reaches through `mapNode`, and a
  tween in a definition animates in every placement. Beside two neighbours that
  deliberately search only `scene.children`, using `mapNode` looks like a mistake — which
  is why the store says so in as many words.
- **Project-level was the other shape and it is wrong for `AnimationClip`'s own reason,
  inverted.** A clip is project-level because it is a way of reading one *image*: the
  frames belong to the bytes, and two sprites drawing one sheet must not disagree about
  how it is cut. A tween's targets are the object's own numbers — `x: 400` means nothing
  without the object it is about. The nine-slice insets' call, not the frame grid's.
- **One tween per node, several properties inside it.** Phaser's config takes many
  properties under one duration and one ease, which is most of what anybody asks for
  ("slide and fade"). A second tween on one object means a second *duration*, which is a
  list — a deliberate hole rather than a thing forgotten.
- **A new tween's destination is offset from the object, not equal to it.** The first
  thing anybody does after switching this on is press ▶, and a target equal to the
  object's current position is a tween that runs perfectly and moves nothing — which is
  indistinguishable from the feature being broken, and is the failure mode this file warns
  about more than any other. `addCollider`'s rule: a row arrives already pointing at two
  objects rather than at nothing. `x` is the offset property because it is the one well
  defined for every node type — a container and an instance have no width of their own and
  a sprite has no height — and the default yoyos forever so that it ends where it began,
  since switching preview off must not look like the editor moved something. Switching on
  one *further* property seeds it at the object's current value instead, and that is not
  an inconsistency: by then something is already moving, and the user is naming an axis
  they are about to type a number into.
- **`tweenOf` is the only reader**, in the `guidesOf` / `physicsOf` / `controlsOf` /
  `soundsOf` / `cameraOf` / `tileMapOf` family, answering four questions at once: is there
  a tween, does it drive anything, are the numbers ones Phaser can be handed, and is the
  ease one the editor offers. The second costs the whole tween rather than being repaired,
  which is `soundsOf`'s split: a tween with an empty `to` is a real Phaser tween that
  animates no property, holds the object for its duration and looks exactly like the
  feature being broken. A fresh object per call, so `useEditorStore((s) => tweenOf(...))`
  is React error #185 — the `tileMapOf` trap, ninth time.
- **An absent target is not a zero, and that is why `to` is a bag of optionals.**
  `wordWrapWidth: 0`'s sentinel inverted: a wrap width of zero has no second meaning,
  while `x: 0`, `rotation: 0` and `alpha: 0` are all destinations somebody asks for. A
  sentinel would have been the one target the user could not express.
- **Absolute values, never Phaser's `'+=100'`.** Phaser takes either, and a relative
  offset would be a second way of saying where something ends up. Absolute names a
  *place*, which is what lets the canvas draw the destination — and drawing it is half of
  what makes this editable by eye. It is also what keeps a `repeat: -1` tween from walking
  the object off the scene.
- **`TWEEN_EASES` is an allowlist, and the argument is not injection.** `str()` already
  sits between the value and the output. It is that `GetEaseFunction` resolves an unknown
  name to `Power0` and **says nothing at all** — no warning, no error, a linear tween
  where the user asked for a bounce. `CSS_GENERICS` and `__BASE` one module over, and the
  same answer: refuse the value rather than discover it on the far side of an export. It
  is also what makes the control a `SelectField`, the atlas Frame field's argument.
- **`TWEEN_PHASER_KEY` is the one builder for what each property is called in Phaser, and
  five of its six entries are the same word twice.** The sixth is why it exists:
  `rotation` on a Game Object is **radians** and Phaser's degrees property is `angle`, so
  a tween emitted against `rotation: 180` is a legal tween of 180 radians. It compiles, it
  runs, the emitted text looks right, and it is wrong by a factor of 57. Two consumers —
  the renderer and the exporter — which is `textStyleOf`'s and `bodyShapeOf`'s rule on one
  of the few things nobody can see until the game is in their hand.
- **Alpha became one channel across the whole union, and that was a prerequisite rather
  than tidying.** `applyNode` used to write alpha eight times, once per type, and the
  shapes were the odd one out: a rectangle carried the document's alpha as its *fill's*
  alpha while everything else carried it as the object's — and the exporter has always
  emitted `.setAlpha()` for all of them. Invisible while nothing animates, since a solid
  fill over the background composites the same either way, and wrong the moment a tween
  eases one channel while the export eases the other. It is now written once, above the
  switch, which is also what makes the skip below a single line.
- **The release is above the writes and the start is below them, and that ordering is the
  feature.** `releaseTween` lets go of a tween that should no longer hold the object
  *before* the document's values are restored, so the sync that switches ▶ off puts
  everything back in that same sync; doing it afterwards strands the object wherever the
  tween left it until some unrelated store change redraws it, which is the
  `draggingId`-cleared-after-`endTransaction` trap wearing a new face and looks exactly
  like "the toggle only applies when I touch something else". `startTween` runs after the
  writes so a tween created this pass starts from the document's own values. Both halves
  live inside `applyNode`, where the key, the node and the object are already in hand —
  which makes the requirement structural rather than remembered, and avoids a second
  traversal that would be a second place to compute a display key.
- **The signature carries the start values as well as the tween, and that half is the one
  a reader will not expect.** Without them a drag under ▶ is invisible: the tween holds
  `x`, `applyNode` skips the write, and the object never follows the finger. With them a
  nudge restarts the tween from where the object now sits, while a selection — or a nudge
  of some *other* object — leaves every signature alone. That second half is
  `play(key, true)`'s ignoreIfPlaying and `setConfig`'s cache guard for the third time:
  the scene syncs on every store change, so an unguarded rebuild means nothing ever
  visibly travels anywhere.
- **Keyed by display key, never node id.** Two instances of one prefab share their
  children's node ids and must not share a tween, exactly as they do not share a display
  object — `containerBounds`' argument. `tweens.spec.ts` places one definition twice and
  polls that *both* move, which is the one claim a node-id implementation fails while
  passing every other test in the file.
- **`persist: true` on every tween, so the scene owns the whole lifetime.** Phaser
  destroys a completed tween unless told otherwise, which would leave the map holding a
  corpse that `applyNode`'s skip still believes in. With it, one map answers both "is this
  running" and "what is it driving".
- **`remove()`, not `stop()`.** A stopped tween is only flagged for removal and is still in
  the manager for another update, which would let it write once more over the values being
  restored on the very line below.
- **SHUTDOWN needs no removal loop, and that absence is worth a sentence** beside four
  neighbours that all do bookkeeping — here "nothing to do" and "forgot to do it" read
  identically. A texture belongs to the game, an animation to the game's manager and a
  `FontFace` to the *page*, so all three outlive the scene; a Tween belongs to the scene's
  own `TweenManager`, which the scene destroys with itself. Only the lookups are dropped.
- **`nodeTweens`, not `tweens`.** `Phaser.Scene` already owns a `tweens` property — its
  `TweenManager` — and a field of that name would shadow the very thing every line below
  calls to make one. The easiest way to lose an afternoon in this file.
- **The ghost is shown exactly when the tween is not**, which is the emitter marker's rule
  one feature over: one condition, `nodeTweens.has(key)`, so there is one notion of
  "running" rather than two. Without it the feature has nothing on the canvas at all until
  ▶ is pressed, since a tween that is not running is invisible by definition.
- **It is drawn from `localRectOf` and the destination's own local transform, composed
  with the *parent's* world matrix.** That is what puts a container child's ghost in its
  parent's frame exactly as the child itself is, and it is what would be wrong if it were
  built from a world transform. The box comes from `localRectOf` so a tilemap's top-left
  origin and a container's measured bounds are both already right, expressed in one place.
- **Dashed, stroked, at depth 996, and in `update()`.** Dashed because this is the one
  mark on the canvas deliberately the same shape and size as a real object, so the break
  is what tells them apart at a glance. Stroked rather than filled — the opposite call
  from the emitter marker and the control arrows, and right for the opposite reason: those
  are small marks that have to survive antialiasing, this is full-size and sitting over
  the layout the object is about to travel across. Depth 996 is above every object, since
  a destination hidden under a tilemap says nothing, and below every other piece of chrome,
  since everything that says something about the document belongs on top of a second copy
  of an object. In `update()` with `drawBodies` and `drawCamera` for their reason — the
  stroke and the dash are screen widths divided by the camera zoom, and a pinch changes
  the zoom without touching the store — and signature-gated, because on almost every frame
  none of it has moved.
- **Alpha is not ghosted.** A ghost drawn at the target alpha would say "this fades" and
  "this is barely drawn" with the same pixels, and an outline is not where a fade is
  legible anyway. The panel says it; the canvas does not.
- **The ghost colour was picked by arithmetic, and the obvious yellow failed.** `#ffe600`
  is within `findColor`'s tolerance of the fixture `#ffd60a` on *all three* channels — the
  touch rings' azure trap exactly, one band over, and the warm band is the most crowded
  one in `tests/`. The check is against every fixture colour in the suite as well as every
  chrome colour, and the chartreuse that survives clears all forty-four by at least 84.
- **`hasMotionIn` gained its first *addition***, where the four paragraphs above it are
  refusals. A tween under ▶ moves an object across the canvas by itself, which is exactly
  what that button exists to stop — where a body, a sound and a key press all move nothing
  here. Read through `tweenOf`, so a tween that drives nothing does not put a button on
  the toolbar that stops nothing.
- **The export is one statement immediately after the node's own binding, through
  `ctx.receiver`.** Not the epilogue, where the camera's `startFollow` and the collider
  rows go: those name bindings the object list has not made yet, and a tween names only
  the binding on the line above. `receiver` is what makes the same emit correct verbatim
  in `create()` and in a prefab factory, which a tween on a definition's child needs — and
  unlike the sound block, which hardcodes `this` because a definition has no scene of its
  own, a factory genuinely is handed one.
- **`targets` is the whole `ids` list rather than the first**, so a tilemap of several
  layers travels as one object instead of sliding its floor out from under its walls.
- **The config is emitted whole, defaults included; the six properties are not.** The
  dials are the emitter config's and the physics body's call, because they only mean
  anything beside each other — a yoyo says nothing without a duration, a repeat delay
  nothing without a repeat. A target is the opposite and not by the `modifiersFor` rule
  either: an absent one is not a default, it is a property this tween is *not about*, and
  printing the object's current value would emit a tween that holds it still.
- **No gate and no table, which is unlike every feature before it.** The block sits inside
  `emitNode`'s successful branch, so a project with no tween emits byte for byte what it
  emitted before with nothing to suppress — and a tween on a node that emitted no object
  never reaches the line at all, which is why `missingReason` needs no branch for one.
  `modifiersFor` gains nothing for a mechanical reason rather than a chosen one:
  `tweens.add` answers with a Tween, not with the object, so it cannot join a chain.
- **No game-config key and no header note**, the sixth entry in the comment block above
  `arcadeConfig`. `Scene.tweens` is installed for every scene in every Phaser game there
  has ever been, as `cameras.main` and `sound` are. Said out loud because a tween is the
  one thing in that list that visibly moves something, which makes "surely that needed
  enabling" the natural assumption.
- **`SCHEMA_VERSION` did not bump — the guides case, seventh time.** `tween` is an
  optional field on a node and adds no `NodeType`, so a v12 `createDisplayObject` has a
  case for everything in the file. It rides in on `scenes`, which `parseProject` passes
  through verbatim, **and on `prefabs`, whose `children` `parsePrefabs` also passes
  through unvalidated** — so both homes survive an old build's re-save. Still contingent
  on `parseProject` not reconstructing scenes or prefab children field by field, exactly
  as physics, cameras, behaviour, touch and Matter are. `tweens.spec.ts` asserts the 12 in
  the saved artefact.
- **A tween and a dynamic body both write the object's position, and the tween wins.**
  That is Phaser's, not this editor's, and it is a thing the panel says rather than a
  combination refused — the Matter/`drivenIn` lesson, that a silently absent behaviour
  reads as a broken one.
- **`publishMeasuredBounds` publishes the *tweened* box while ▶ is on**, so aligning or
  snapping against an object mid-tween uses where it is drawn this frame. `bounds.ts` is
  by definition "as the renderer last drew it", so this is consistent rather than wrong —
  said here because the other reading ("align moved my object oddly") is a bug report
  waiting to happen.
- **The hostile project's tweens are deliberately at rest**, every target equal to the
  value the object already has. That is `NO_MOTION`'s rule one field over: the fixture's
  job is the *shape* of the emit meeting `TweenBuilderConfig` under `tsc --strict`, and a
  tween that actually moved would have `export.spec`'s colour assertions racing a fade and
  a slide that are both correct behaviour and neither of which those assertions are about.
  All six keys are still emitted and still type-checked, which is the whole job. The
  positive runtime claim is its own test, built through the UI and polled.

## Physics

A node can carry a `PhysicsBody`, and a scene a gravity. Both are document state, both are
exported as real Arcade Physics, and neither is ever run here.

- **The editor never simulates, and that is the load-bearing decision.** A simulating
  canvas moves objects, and a moved object either drifts out of step with the stored
  transform or rewrites it — so a scene left alone for ten seconds is a scene the user has
  to rebuild. That is the animation argument at its limit: preview is off by default
  because a canvas whose objects are never where you last looked makes placing one by eye a
  matter of timing, and a physics step does not merely animate an object, it changes the
  numbers the document is made of. There is no version of "run it for a moment" that leaves
  the document alone. So a body is **drawn, not run**, and it deliberately does *not* ride
  on `previewMotion` — the one place this feature declines the toggle the emitters took.
  `hasMotionIn` is untouched and says so in a comment, because beside a function that walks
  the prefab bodies for emitters, not learning about physics looks like an omission.
- **`SCHEMA_VERSION` did not bump, and this is the guides case rather than any of the four
  crash cases.** A body is not a node type: it is an optional field on a node and an
  optional field on a scene, and both ride in on `scenes`, the one part of a file
  `parseProject` passes through verbatim. A v7 build has a `createDisplayObject` case for
  every type in the file, reads `node.physics` nowhere, draws identically, and carries both
  fields back out on a re-save. **This stays contingent on `parseProject` not
  reconstructing scenes field by field**, exactly as the guides decision is — if it ever
  starts to, an old build silently loses every body on every save, which is data loss with
  no crash. `physics.spec.ts` asserts the current version in the saved artefact so a future bump is a
  deliberate act.
- **`physicsOf(node, topLevel)` is the only reader**, in the `guidesOf` / `frameGridOf` /
  `prefabChildrenOf` / `tileMapOf` family and answering three questions at once: may this
  node type carry a body, is this node somewhere a body would mean anything, and is the
  stored object well formed. Any one forgotten is an outline drawn in the wrong place or an
  export onto an object Arcade cannot simulate. It builds a fresh object per call, so
  `useEditorStore((s) => physicsOf(...))` is React error #185 — the `tileMapOf` trap, and
  the comment is on both.
- **Four types are eligible — `rectangle`, `ellipse`, `text`, `sprite` — and each of the
  four left out is left out for its own reason.** A `container` and an `instance` are
  Phaser Containers, which Arcade does not simulate: a body on one would be a box around
  children that go on moving independently of it. A `particles` node has no ComputedSize at
  all (see Particles above), so there is no width or height for a body to take. A
  `tilemap`'s collision is `setCollision([...])` — a different API about which *tiles* are
  solid, and giving the whole layer one rectangular body would be a half-answer that looks
  like the real one.
- **Only a top-level node may have one, and the rule lives in a reader rather than in five
  store guards.** An Arcade body reads its owner's `x`/`y` as *world* coordinates every
  step, and a node inside a container has parent-relative ones — a prefab definition's
  children are container children by exactly the same mechanism, so the ban is one rule and
  not two. Enforced as **strip on read, refuse on write**: `physicsOf` answers null for a
  nested node, and `setNodePhysics` reaches into `scene.children` directly so a nested node
  is simply not in the array it searches. The two halves look redundant and are not — the
  second is what stops the UI offering something that would do nothing, and the first is
  what lets `moveNode`, `groupSelection`, `pasteNode`, `createPrefabFromSelection` and the
  tree's drag-to-nest each need no guard at all. A body found deeper reads as *absent*
  rather than being deleted, which is the answer `tileMapOf` gives an out-of-range tile and
  for the same reason: a node dragged into a group and back out is the same node, and
  throwing its settings away on the way in would be a deletion nothing asked for. The
  inspector says so in as many words.
- **A body is axis-aligned and does not turn with its object. It is sized to *hold* the
  turned object instead, and that was iteration 16's one real bug.** The first half is
  Phaser's, not a simplification here: `Body.updateBounds` reads the object's scale and
  never its angle, and nothing in Arcade turns a body. What iteration 16 concluded from
  that was wrong — it kept the object's *unrotated* width and height, so a 300x20 platform
  stood on end collided as a 300x20 horizontal floor, a shape with almost no overlap with
  the thing on screen, and the editor drew that box faithfully. A correct drawing of a
  wrong body. The closest shape Arcade *can* express is the box that contains the turned
  object, so that is what both sides now use: `bodyBoxOf(width, height, rotation)` in
  `schema.ts` is the one builder, `drawBodies` is one consumer and the exported fit helper
  is the other — `textStyleOf`'s two-consumer rule, on the one thing here nobody can see
  until the game is in their hand. It is still not `worldBoundsOf`: that is the box the
  *renderer* measured, and a body's is centred on the node's own position, which is where
  Phaser puts one from `displayOrigin`.
- **The fit is a module-level helper reading the object, never numbers the exporter
  printed, and there are two reasons and a trap in it.** A `text` node's size is measured
  against the font at runtime and the document does not know it, so a box computed at
  export time would be right for every type but one; and reading `object.angle` rather than
  printing the document's rotation cannot fall out of step with the `.setAngle` the
  constructor chain above it emitted. The trap is that **`StaticBody.setSize` takes canvas
  pixels while `Body.setSize` takes *source* pixels**, which Phaser then multiplies by the
  object's own scale — one call for both is wrong by the scale on one of them, and wrong
  only on an object that is not at 1x, which is invisible on every fixture that happens to
  sit there. Both recentre, because `setSize` defaults `center` to true and every type in
  `PHYSICS_TYPES` has a centred origin.
- **`syncBounds` is the loop Phaser already ships for this, and it is refused.** It
  re-reads `getBounds()` every step, which does follow an object spinning under
  `angularVelocity` — but it never touches `offset`, so the body grows from its top-left
  corner and ends up off-centre by half of what it gained. A body that spins is therefore
  fitted to the angle the document states rather than the one it reaches, which is exactly
  what the canvas draws.
- **The gate is `bodyIsTurned`, which is `rotation % 180 !== 0` rather than `!== 0`.** At a
  half turn the box is the box, so a project that flips something 180 degrees — and every
  project whose bodies are upright — exports byte for byte what it always did: the rule the
  asset table, the tilemap helper and the prefab factories all follow.
- **The outline sits *above* the selection outline, at depth 1000.5.** For an unrotated
  object the two are the same rectangle, so one of them is going to be invisible — and it
  should be the selection, which is already said by both handles, by the move bar and by the
  whole inspector panel, where this outline is the only thing on the canvas that says the
  object has a body at all. On a rotated object they separate on their own, the cyan turning
  and the green staying square, which is the difference worth being able to see.
- **`drawBodies` is in `update()`, not at the end of the sync.** Its stroke is a screen
  width divided by the camera zoom, and a pinch changes the zoom without touching the store
  — the reason `drawGrid`, `syncPlacedGuides` and the selection outline all live there. Left
  on the sync it is a hairline after zooming in, which is the one-pixel-line trap arriving
  by a new route.
- **There is no visibility toggle, and that is not an omission.** The grid and the guides
  are drawn everywhere whether or not anyone asked, so switching them off switches off
  something the user did not put there; a body outline exists only where one was
  deliberately attached. A control that could only ever hide the answer to "which of these
  has physics" is worth less than the width it would cost a 390px toolbar that already
  clips. A static body is told apart by a cross through the box — one colour and two lines
  rather than a second palette entry, saying the one thing about a body that is visible on a
  canvas nobody is simulating.
- **The world is gravity and nothing else; the bounds are the scene rectangle.** A second
  stored rectangle would be two fields free to disagree about one number — the argument that
  gives a sprite no width of its own and a tilemap no tile size of its own — and a bounds
  rectangle the canvas does not draw is a number with no feedback. `setBounds(0, 0, width,
  height)` is still *emitted*: Phaser defaults the world to the game canvas, which is this
  size for the runnable page and is whatever the host game happens to be for a module
  dropped into one, so the line is redundant in one output and load-bearing in the other,
  and emitting it in both is what makes `collideWorldBounds` mean the same thing in each.
  There is no scene-level "physics enabled" flag either: physics is on iff something carries
  a body, and a flag would be a second answer to the same question.
- **`mass` and `immovable` are kept even though nothing this editor emits can read them.**
  Both only matter inside a collision, and deciding what collides with what is game logic —
  the `scene.start` argument. They are here because the collider *is* the one line the user
  writes by hand, and these two are the body properties that line reads: emitting them means
  that line is the only thing they have to write.
- **The emitted setters are whole, defaults included — the opposite call from
  `modifiersFor`, which emits only what differs from Phaser's.** A chained modifier left out
  is a line restating a default, but a body's dozen numbers interact (drag only bites while
  acceleration is zero, bounce only shows against something to bounce off, gravity is the
  world's unless this body opts out), so a reader tuning one wants the others beside it. The
  emitter config made the same call for the same reason. `modifiersFor` itself gains no
  physics branch and says so, because "no branch needed" and "forgot a branch" look
  identical: `physics.add.existing` answers with the *object*, not the body, and the body
  does not exist until that call has been made, so the setters cannot be chained onto the
  constructor and are their own statements.
- **`arcadeBody` exists for one reason: `ball.body.setBounce(0.8)` does not compile.**
  `GameObject.body` is `Body | StaticBody | MatterJS.BodyType | null` and only the first has
  a bounce. A cast would fix that in TypeScript and would be a *syntax error* in the runnable
  page, whose `create()` body is the same plain JavaScript — and that shared body is the
  property that stops the two outputs drifting, so it is not one to spend here. A three-line
  function narrows it once, reads at the call site almost exactly as `.body` would, and
  throws naming the object rather than leaving a null dereference three frames later, which
  is the tilemap helper's argument. Its name comes out of the module's identifier set right
  after the tilemap helper's, and every factory body's seed set carries it — the hostile
  project holds an object named "arcade body" for exactly that.
- **Only a dynamic body needs the helper, and only a dynamic body gets a chain.** Phaser's
  `StaticBody` genuinely has no velocity, bounce, drag, mass or gravity, so a static body is
  a bare `add.existing(obj, true)` and the inspector's dynamic-only fields are *absent*
  rather than disabled: a disabled field says "not now", and these do not exist for that kind
  of body at all. A file with no dynamic body emits no helper, and a file with no body at all
  emits no physics of any kind — the rule the asset table, the tilemap helper and the prefab
  factories all already follow.
- **The game config is the page's; the gravity is the scene's.** `this.physics` is undefined
  unless the game config asks for Arcade, so `generateRunnableHtml` adds
  `physics: { default: 'arcade' }` itself, while `generateScene` — which cannot reach a
  config it does not own — emits a header comment saying what to add. Gravity stays in
  `create()` because it is per scene and the config is one object for the whole game, which
  is the only split that survives two scenes wanting different gravity.
- **`constructorFor` gains no case, so the one compile error the export checklist advertises
  never fires for this feature.** Every step of it is silent: the renderer, the exporter, the
  inspector and `PHYSICS_TYPES` alike. `physics.spec.ts` and `export.spec.ts` are what stand
  in for the compiler.

## Matter physics

A scene chooses its engine. Arcade is the default and everything above describes it; a
scene switched to Matter gets bodies that are **real polygons and turn with their
objects**, drawn turned on the canvas and exported as real `matter.add.gameObject`. It
closes iteration 16's fourth deliberate hole, and it closed for one reason: the shape.

- **The engine is the *scene's*, and both other granularities are refused for their own
  reasons.** Per node is impossible — gravity, the world bounds and which pairs collide are
  all properties of a *world*, so two engines in one scene is two worlds and every one of
  those settings would have to be said twice. Per project is merely worse: Phaser resolves
  physics per scene already (`GetPhysicsPlugins` reads `sys.settings.physics`), so a
  project-level choice would be this editor imposing a limit Phaser does not have. A
  three-scene hostile project with one world of each kind is what asserts it.
- **`scenePhysicsOf` gained one field and stayed the only reader**, in the `guidesOf` /
  `physicsOf` / `cameraOf` / `soundsOf` / `tileMapOf` family. Absent means Arcade, so every
  project that predates this exports byte for byte what it always did — the rule the asset
  table, the tilemap helper and the prefab factories all follow.
- **`bodyShapeOf` is the one builder for what a body's rectangle actually is**, and the
  renderer and the exported helpers are its consumers. Arcade answers with the box that
  *holds* the turned object at `rotation: 0`; Matter answers with the object's own box at
  the object's own angle. That the Arcade branch answers a rotation of zero however far the
  object has been turned is not a quirk — it is the difference the canvas exists to show.
- **The two engines' dials both live on the node, and neither is ever deleted.**
  `PhysicsBody` gained `restitution`, `frictionAir` and `friction` beside the eight Arcade
  fields. The inspector *hides* the set that is not in force rather than the store dropping
  it, so trying the other engine and switching back loses nothing — `physicsOf`'s treatment
  of a body on a node dragged into a group and out again, one level up. The same goes for
  the collider rows, which `collidersOf` drops under Matter and the document keeps.
- **One gravity field, in px/s², converted at the emit.** Matter applies
  `mass * gravity.y * gravity.scale` as a force and integrates over a squared delta in
  *milliseconds*, so at the default scale of 0.001 a `y` of 1 is 1000 px/s² — which makes
  the conversion a division by a thousand and nothing else. That is why there is one
  gravity and not two: a scene switched from Arcade to Matter falls at exactly the rate it
  already fell at. Velocity (px/s ÷ 60, Matter's base delta being 1000/60 ms) and angular
  velocity (deg/s → radians per step) are converted the same way and for the same reason.
- **A Matter scene declares Matter in its own `super(...)`, and that is the discovery that
  made this one iteration rather than two.** `GetPhysicsPlugins` reads the scene's settings
  alongside the game config's `defaultPhysicsSystem`, so `super({ key, physics: { matter:
  {} } })` starts Matter for that scene alone. Two payoffs: a mixed project works at all,
  which one game-config key could not express; and unlike Arcade there is **no header note
  and no game-config key**, because a module dropped into someone else's game needs nothing
  added to a config it does not own. Arcade keeps the key and the note it has always had —
  changing them would break the byte-for-byte property, and a working thing is not worth
  spending it on.
- **Three facts about `MatterGameObject` are wrong if guessed, which is "Phaser 4, not 3"
  for the fourth time.** *The shape is passed explicitly*: with no `shape` config the body
  is `Bodies.rectangle(x, y, this.width, this.height)` — the object's **unscaled** size, so
  a floor at `setScale(3)` gets a body a third of the width it is drawn. *The angle is read
  before the attach and applied after it*: Matter's Transform component redefines `angle`
  with a getter returning `body.angle`, so the instant the body is attached the object's
  rotation **is** the body's, and the body was built upright — without the `setAngle`, a
  floor turned 30 degrees in the editor snaps upright in the exported game. *And the
  narrowing runs backwards from `arcadeBody`'s*: a Matter body is a plain object with no
  class to test, so what the helper rules out is the two Arcade classes and null, which is
  exactly what leaves `MatterJS.BodyType` — a narrowing TypeScript accepts, in syntax the
  runnable page's shared plain JavaScript can also carry.
- **The dials ride in one config object rather than a setter chain.** `Body.set` handles
  `isStatic`, `mass`, `velocity` and `angularVelocity` and assigns the rest as plain
  properties, so the whole body is one literal — emitted whole, defaults included, which is
  the emitter config's rule and the Arcade chain's for their reason: these numbers interact,
  and a reader tuning the bounciness wants the friction beside it.
- **`collideWorldBounds` becomes the world's walls, because Matter has no per-body
  version.** The walls go up when *anything* in the scene asks to be stopped by them, which
  is the closest thing Matter can say to what the checkbox says. Worth knowing before
  someone reads the emit and thinks a body was missed.
- **`drivenIn` is the third scene-level reader, and it briefly refused a Matter scene.
  That was a bug, and it is worth keeping the reasoning beside the correction.** The
  argument was that the behaviour *is* a velocity written onto an Arcade body every frame,
  and that a platformer's jump was gated on `blocked.down` — Arcade's own flag for "there
  is something under me this step", which Matter has not got. Every clause of that is true
  and the conclusion still did not follow. What it shipped was a Controls panel that went
  on offering "Player controls" and "On-screen buttons" in a Matter scene, accepted both,
  and then drew no arrows, no rings, and emitted no `update()` — **with no sentence
  anywhere saying why**. That is this file's own repeated failure mode arriving from the
  inside: a feature that is silently absent reads exactly like one that is broken, and the
  first person to switch a scene over reported it as one.
- **`update()` has two shapes, and they share no code.** Arcade writes `setVelocityX` and
  leaves the other axis alone; `Body.setVelocity` sets *both*, so the Matter branch reads
  `body.velocity.y` back and writes it again — a zero there holds the object in mid-air and
  makes gravity look broken. Speeds divide by 60 for the reason the body's dials do:
  Matter's units are per step and the document's are per second, converted at the emit so
  there is one number and not two.
- **`matterGround` is Matter's answer to `blocked.down`, and it is a helper rather than the
  behaviour model that was feared.** Matter cannot have that flag — a polygon that turns is
  touched at an angle, and the only thing that says *where* is the collision normal — but
  reading one is twelve lines. Two facts about it are wrong if guessed, and both were
  checked against `Collision.collides` rather than remembered: the normal points **from
  bodyB towards bodyA** (the opposite of what the comment beside it in Matter's source
  suggests), so the other body is underneath when the normal aims *up* out of ours —
  negated when we are bodyA, as-is when we are bodyB. Backwards, the jump works against a
  ceiling and nowhere else: it compiles, it runs, the emitted text is identical, and
  **only a test that presses the button can see it**. It records a *timestamp* rather than
  a boolean because `collisionactive` fires on the physics step and `update()` runs on the
  frame, and the two are not one to one — a flag set on one and cleared on the other
  flickers. Emitted only for a Matter scene that has something that jumps.
- **`matterBodyOf` was split out of `matterBody` rather than written twice**, because
  `update()` needs the same narrowing every frame. That is what lets `create()`'s epilogue
  stay `this.<field> = <object>;` under both engines — identical text, one less thing that
  can disagree.
- **The canvas still never simulates, under either engine**, and nothing here is on the ▶
  toggle. `hasMotionIn` is untouched and records its fourth refusal for its first reason: a
  physics step does not merely animate an object, it rewrites the numbers the document is
  made of.
- **`SCHEMA_VERSION` did not bump, and this is the guides case for the sixth time.** The
  engine is a field on `scene.physics` and the three dials are fields on `node.physics`, and
  both ride in on `scenes` — the one part of a file `parseProject` passes through verbatim.
  A v12 build has a `createDisplayObject` case for every type in the file, reads none of the
  four, draws the Arcade outline it has always drawn, and carries them all back out on a
  re-save. **Still contingent on `parseProject` not reconstructing scenes field by field.**
  `matter.spec.ts` asserts the 12 in the saved artefact so a future bump is deliberate.
- **The suite's instrument is an extent for *which way round* and a pixel count for *what
  shape*.** At a quarter turn the two engines agree exactly — the box that holds a 300x60
  bar stood on end is 60x300, which is the turned bar's own extents — so an extent alone
  cannot tell a polygon from a box and the fixture turns 45 degrees instead. There the
  extents agree *again* (a turned rectangle's bounding box is precisely the box Arcade
  grows to), and the honest reading is how much green there is: a 255-square outline inks
  about 4×255 pixels where a turned 300×60 rectangle inks about 2×360. **Only
  `export.spec.ts` can make the positive claim**, because the editor refuses to run any of
  it — and it asserts a *pass* rather than a catch, dropping the faller over the empty air
  inside the ramp's bounding box, because a catch is what a wrong box gives you too.

### Round bodies

`PhysicsBody.shape` is `'box' | 'circle'`, and a round body is the circle **inscribed in the
object's drawn box**, centred on it. It closes the "no circular bodies" hole iteration 16
left, and the prediction there — "one prop and three emitted arguments" — was right about
the prop and wrong about the arguments, because both of Phaser's Arcade calls have a trap.

- **There is no radius and no offset field.** The radius is `bodyRadiusOf` =
  `min(|w|, |h|) / 2` of what is drawn, which is the argument that gives a sprite no width:
  stored, it is a second answer to the object's size, and a `text` node's size is not known
  until the font measures it. Iteration 16's refusal named exactly that — "the radius is a
  second answer to the object's own size" — and this is the shape that answers it rather than
  arguing with it.
- **Absent means box, and `createNode` seeds nothing.** `physicsOf` reads anything but
  `'circle'` as `'box'`, `defaultPhysicsBody` writes `'box'`, and **an ellipse is not seeded
  round** — a body on an ellipse has been a box for 28 iterations and a shape is chosen, not
  added: `blendMode`'s argument. The picker is `Body shape`, the row under `Body`, and it is
  shown under both engines and both kinds, because a shape is a fact about the body, like
  `kind`.
- **`bodyShapeOf` answers a union now**, `{ kind: 'box', … } | { kind: 'circle', radius }`,
  and gained a `shape` parameter. The union is what made `drawBodies` a compile error until
  it drew one — `clampFrame` → `resolveFrame` applied to a return type. A circle is the one
  answer both engines give identically, so it is a member of the union rather than a branch
  per engine.
- **A round Arcade body skips `fitBodyToAngle`,** and that is the payoff. A circle is the
  same at every angle, so it is the first Arcade body that matches a turned object rather
  than growing a box to hold it. `physicsUsedIn.turned` counts only *box* bodies, so a project
  whose only turned bodies are round emits no fit helper.
- **Three facts from Phaser 4.2.1's source, each wrong if guessed.**
  - **`Body.setCircle` (dynamic) takes source pixels.** That holds for the radius *and* the
    offset: the body sits at `x + scaleX · (offset.x − displayOriginX)` and collides with
    radius `halfWidth`, which is the source radius times `|scaleX|`. So `fitBodyToCircle`
    divides the drawn radius by `|scaleX|` and signs the offset by the scale.
  - **`StaticBody.setCircle` takes canvas pixels, and sets its offset without moving the
    body.** A later `setOffset` subtracts the offset it has just been given before adding it
    back, so passing the same numbers to both moves nothing.
    - What works is `setCircle(r, 0, 0).setOffset(real)`. It relies on the offset being zero
      straight after `add.existing(obj, true)`.
    - `reset()` and `updateFromGameObject()` are refused. Both place the body from
      `getTopLeft`, which rotates that corner on a turned object. The second also writes the
      object's box back over the circle's width.
    - `export.spec.ts` confirms the trap by breaking it. It uses a **non-square** bumper,
      because a square one has a zero offset and passes whichever call is made. The first
      version of that test did exactly that.
  - **Matter's `SetBody` defaults a circle's radius to `max(w, h) / 2`,** the circumscribed
    circle. So the config passes `radius` explicitly.
- **The Arcade limit is on a box's corner, and it is Arcade's.** `World.separateCircle` pushes
  a circle meeting a rectangle's *corner* along the corner's normal, and then hands it to the
  axis-aligned `SeparateY` as well, which stops its fall. A round ball dropped onto a ledge's
  edge therefore hovers on it instead of rolling off.
  - This was found by running the export, not by reading. The planned test was "rolls off a
    corner a box would rest on", and it failed with the circle body demonstrably correct.
  - Two circles are separated along their normal alone, so the runtime test is round against
    round.
  - It carries a bounce of 0.3. At zero, Arcade zeroes the velocity every step and the ball
    creeps round the bumper at a few pixels a second.
  - The README says so, since a user will meet it.
- **An uneven *transform* scale is Arcade's second limit.** A circle collides with radius
  `halfWidth`, while its world-bounds box follows each axis's scale, so on an unevenly scaled
  object the circle is right and the bounds box is squashed. The panel hints this only in
  that state. Width and Height props are source size and are unaffected.
- **Under Matter a round body is a `shape` in the config literal.** The literal is
  `{ type: 'circle', radius: <read off the object> }`, and `MatterBodyConfig` declares `shape`,
  so it compiles under `--strict`.
  - The Matter helper always built a rectangle *after* spreading the config. It now reads
    `shape: config.shape ?? {…}`, but **only in a module that holds a round Matter body**
    (`PhysicsUse.matterCircle`).
  - Every Matter project without one emits the helper byte for byte as before.
- **`fitBodyToCircle` is the seventeenth module helper, allocated last of all, after
  `effectsFn`.** `toIdentifier` suffixes a clash, so a name drawn earlier moves a suffix the
  suite asserts. It is in the three seed sets (factories, `update()`, `create()`) beside
  `fitFn`.
- **`SCHEMA_VERSION` bumped to 15, and this is the first bump taken because this file said
  to.** Taken alone, the field is the guides case, since `node.physics` rides in on `scenes`
  verbatim.
  - The problem is the edge iteration 41 recorded. A v14 `physicsOf` rebuilds a body field by
    field without `shape`, so it draws and exports a box. Its `setNodePhysics` merges over that
    rebuild, so nudging any dial on a round body in a v14 build writes the circle away.
  - Iteration 41 said a second such edge should bump rather than be recorded. Iteration 42's
    `atId` was that second one, and this is the third.
- **The bump exposed a hole in every bump before it: `parseProject` kept the file's own
  version.** A v14 file opened here, given a round body and saved would still have said v14.
  - It now stamps `SCHEMA_VERSION`, because what it returns is already in this build's shape.
  - Without that, a bump only ever protected files that were *made* in a current build.
    Nothing in the suite asserted the old behaviour.
- **The suite:**
  - `physics.spec.ts` checks four things:
    - the circle is square, as tall as the box and narrower than it;
    - its extent does not grow at 45° where a box's does;
    - a static one's cross adds ink;
    - it survives a save and an open, at 15.
  - `matter.spec.ts` checks the same circle under both engines, and that the shape survives
    the switch.
  - `export.spec.ts` checks the emitted text in both engines, including the byte-for-byte
    absences, and runs the glance both ways (circles fall past, boxes rest on top).
  - The hostile project adds a turned, unevenly scaled dynamic round body and a static round
    body, in the registered-never-started scene, plus a round Matter body. They are the only
    place `setCircle`/`setOffset` and the Matter `shape` literal meet `tsc --strict`.
- **What stays refused.**
  - **No radius or offset field**, above.
  - **No ellipse-shaped or polygon body.** Arcade has neither. Under Matter, `fromVertices` is
    a list of points, which is a geometry sub-format and the emit-zone argument.
  - **No `maxSides`.** Matter's 25-sided circle is Phaser's default, and a dial for it
    explains more than it gives.
  - **No round body on a node inside a group.** Physics' top-level rule is unchanged.

## Behaviour

Three things that only mean anything once the game is running: which tiles are solid, which
pairs collide, and which object the player drives. They are one feature because none of them
is useful alone — a collider with nothing solid is half a floor, and controls with neither
fall through it.

- **The line moved; the argument did not.** For nineteen iterations `scene.start` stood for
  everything refused: colliders, tile collision, input, anything over time. What this
  iteration says is *where* that line falls. The document may state **standing facts about
  the world** — what is solid, which pairs interact, which object the player drives, all of
  them declared once at boot. It still may not state **a sequence of events** — what happens
  when something is hit, when a scene ends, what a timer does. `setCollision`,
  `add.collider` and a velocity read off a key are the first kind; `scene.start` is a choice
  made at a moment and is still the user's line. A future reader adding an "on overlap,
  destroy" field is crossing the line, not extending it.
- **The editor still never simulates**, and nothing here is on the ▶ toggle. A body is
  drawn and never run; a solid tile stops nothing here; a key press does nothing at all.
  `hasMotionIn` is untouched and records its third refusal in a comment — physics, audio,
  and now this — because that toggle exists so a canvas moving *by itself* can be stopped,
  and none of this moves anything without a finger on a key in an exported game.
- **`SCHEMA_VERSION` did not bump, and this is the guides case for the third time.** All
  three additions are optional fields — `TilemapProps.collides`, `SceneDoc.colliders`,
  `GameObjectNode.controls` — and none adds a `NodeType`. Every one rides in on `scenes`,
  the one part of a file `parseProject` passes through verbatim, so a v9 build has a
  `createDisplayObject` case for everything in the file, reads none of the three, draws
  identically and carries them back out on a re-save. **Still contingent on `parseProject`
  not reconstructing scenes field by field**, exactly as physics and cameras are.
  `behaviour.spec.ts` asserts the 9 in the saved artefact so a future bump is deliberate.

**Solid tiles** are `TilemapProps.collides: number[]` — frame indices, not cells.

- **On the node, not the asset, which is the one place this contradicts
  `ImageAsset.sheet`** — and it is the nine-slice insets' call rather than the frame grid's.
  A grid decides how many frames an image *has*, which two maps must not disagree about;
  solidity decides nothing about the bytes, and one tileset is a wall in the level and
  scenery in the layer behind it. Frames rather than cells for the same kind of reason: a
  wall tile is a wall wherever it was painted, and a per-cell flag would be a second array
  the length of `data` for a distinction nobody draws.
- **`tileMapOf` answers a fifth question**, and it drops an index the tileset does not have
  rather than clamping it — the treatment an out-of-range *tile* already gets, and for its
  reason: a re-cut must be able to blank the answer and hand it back whole rather than
  rewriting what the user marked over a mistyped margin. Array identity is preserved when
  the document's list is already normalised, or `editProject`'s "nothing happened" contract
  breaks. `collides` is the second array-valued prop in the schema, so `cloneWithNewIds`
  gained its second copy — `data` is no longer the only one.
- **`removeAsset` leaves it alone**, exactly as it already leaves a tilemap's tile indices:
  both still mean something the moment another tileset is picked.
- **Drawn by `drawPaintGrid`, deliberately not by `drawBodies`.** That is the load-bearing
  choice and the one a reader will want to reverse. `drawBodies` runs every frame and walks
  the scene's children; a map is up to `MAX_TILEMAP_SIDE` squared cells, so a per-cell pass
  there is sixty-five thousand fills a frame for a mark nobody is looking at while they
  place a sprite. `drawPaintGrid` is signature-gated, so it costs that once per change —
  and paint mode is where a person is deciding which tiles are walls. Outside the mode the
  palette's own badges are what say which frames are solid. `data` and `collides` join that
  signature **by identity**, because `tileMapOf` hands back the document's own arrays when
  they are well formed and joining sixty-five thousand numbers into a string every frame is
  the cost the gating exists to avoid.
- **The mark is an outline over a wash, not the wash alone.** A translucent fill is a blend
  of the tile's colour and the body green and lands on neither, so a solid tile would be
  visible to a person and invisible to the colour assertion that proves it is drawn. This
  is the "a one-pixel line never reaches full strength" trap wearing the opposite face, and
  it cost the first version of `behaviour.spec.ts`.
- **The export is `layer.setCollision([...])` inside the tilemap helper**, guarded on a
  non-empty list because `setCollision([])` is a line that says nothing and most maps have
  none. The list is emitted **inline at the call site** while the tile data stays in
  `TILEMAPS`, and the split is the one that table was created by: the data is thousands of
  numbers and the thing a reader moves out to a JSON file, while which frames are walls is
  a handful of them and a fact about the tileset rather than about this level. Tabling it
  would turn every row from an array into an object for one short line.

**Colliders** are `SceneDoc.colliders: SceneCollider[]`, the fifth optional field on a scene.

- **This is the line iteration 16 told the user to write by hand**, and the reason
  `PhysicsBody` carries a `mass` and an `immovable` that nothing generated ever read. Those
  two are now read by something this exporter emits.
- **`collidersOf` is the only reader**, in the `guidesOf` / `physicsOf` / `soundsOf` /
  `cameraOf` / `tileMapOf` family, and it takes `soundsOf`'s split rather than `cameraOf`'s
  because there is nothing here to repair: a row is two references and a word.
  `physics.add.collider(undefined, x)` is not something Phaser can be asked for, and unlike
  a sprite with a missing image there is no placeholder state a collider could be in. Four
  things cost a row — a side that is not a direct child of the scene, a side that is neither
  a body nor a tilemap, the same node twice, and two tilemaps. The last is not tidiness:
  **it is what keeps `physicsUsedIn` correct with no edit**, since a surviving row then
  implies a body and the world it needs is already switched on.
- **A tilemap is a valid side without being in `PHYSICS_TYPES`**, because a layer collides
  through its solid tiles rather than through a body. That is the same sentence
  `PHYSICS_TYPES`' comment used to give as the reason a tilemap gets nothing.
- **Nothing prunes a dangling row**, exactly as nothing prunes a dangling `followId` or
  `audioId`: `deleteNode`, `undo` and the scene switcher are all untouched. `duplicateScene`
  is again the one place that has to think, and it uses the camera's index trick — the two
  child lists are the same list in the same order, so no id map is built.
- **Emitted in the epilogue, with the camera's `startFollow`**, because a collider names
  bindings the object list has just made. `buildCreateBody` already kept `bindings` for the
  camera, so this is a second consumer of an existing map — and `startFollow` is no longer
  the only thing this exporter emits after the objects. A row whose side emitted no object
  gets a comment, which is `missingReason`'s treatment and the follow's.
- **The document stores `collide`; the exporter writes `collider`.** `ArcadeFactory`'s
  method is `collider`, and "collide" is the word on the row a person reads. One is the
  word and one is the API, and conflating them emits a method that does not exist — which
  is what the first version did.
- **The row is reachable from either object's own panel, and that is a bug fix rather
  than a convenience.** The reported failure was a static floor, a dynamic box, gravity on,
  and the box going straight through in the exported game — with the editor saying nothing
  anywhere. Arcade never stops two bodies on its own, and `CollidersSection` could always
  say which pairs meet. What it could not do was let anybody *find* it: it lives in
  `SceneInspector`, which renders only with an **empty selection**, so it is off screen for
  the whole of the time a person spends giving two objects bodies — and it hid itself
  outright below two collidable nodes, so deselecting after the first body showed nothing
  either. Correct, and unreachable. That combination is worth recording beside the "no
  branch needed and forgot a branch look identical" family: **a panel that is right and
  cannot be reached reads to a user exactly like a feature that does not exist.**
- **`collidersNaming` is a filter over `collidersOf`, never a second read of
  `scene.colliders`.** The point of one reader is that a row the scene-wide panel has
  dropped cannot come back to life on an object's panel — `touchZonesOf` is built on
  `controlsOf` for that reason. `NodeCollisionsSection` writes through the same
  `addCollider` / `updateCollider` / `removeCollider`, so this is **one field, two
  controls**: the tile eraser's rule and the emitter marker's. Two notions of what collides
  is the failure; two ways to reach the one notion is the fix.
- **`+ Add a collision` takes the first candidate this node is not already paired with**,
  falling back to the first when everything is paired, so filling a scene in is press,
  press, press rather than press and then re-pick. It matters more here than on the scene
  panel — which still takes the first two — because this is the button people actually
  find. The fallback is deliberate: a button that silently does nothing is the thing this
  whole change is about.
- **The node panel's candidate list mirrors `collidersOf`'s refusals rather than a subset
  of them.** Not this node, and never a second tilemap when this node is one — otherwise
  the button makes a row that vanishes on the next read, which is precisely what the scene
  panel's pickers already exist to prevent. A tilemap reaches the section from
  `TilemapSection` rather than from `PhysicsSection`, because it is a valid side without
  being in `PHYSICS_TYPES` and `canHavePhysics` therefore answers false for one.
- **The empty states are sentences, not absences.** One body in the scene says there is
  nothing yet to pair with; a body with no row says the object will fall through everything
  in the exported game. `AlignSection`'s rule — a control that says why it cannot beats one
  that is not there. Both are a plain `.hint` and not `hint--error`: red is for a document
  that is wrong *now*, which a missing image is, and a body nobody has paired yet is a
  document that is merely unfinished, which every project is for its first minute.
- **The physics itself was never at fault, and it was checked rather than assumed.** The
  exported page was run against the report and three variants the suite does not cover: no
  row at all (the faller passes the floor and settles on the world bounds, which is the
  report exactly, and is why the symptom reads as "falls *past* it" rather than "falls
  forever" — `collideWorldBounds` defaults true); a floor sized by a non-uniform transform
  scale, where `modifiersFor`'s `.setScale(x, y)` is chained onto the constructor before
  `physics.add.existing` so the `StaticBody` takes the right `displayWidth`; and an 8px
  floor at 6000 gravity, which does *not* tunnel. One trap for whoever repeats this: the
  aspect lock defaults **on**, so setting Scale X alone sets both and a fixture meant to be
  a wide thin floor is a large disc instead.

**Controls** are `GameObjectNode.controls: NodeControls`, beside `physics` for `physics`'
reason: not per-type, so not in `props`.

- **`controlsOf(node, topLevel)` is the only reader**, and it is the physics rule arriving a
  third time after the body and the camera's follow target: only a **top-level** node with a
  **dynamic** body may be driven. A velocity moves an object in world coordinates and a node
  inside a container has parent-relative ones; a `StaticBody` has no velocity at all.
  Enforced the same way — **strip on read, refuse on write** — so a node dragged into a
  group and back out keeps its controls, and `moveNode`, `groupSelection` and the tree's
  drag-to-nest each need no guard. A prefab definition's children are container children by
  the same mechanism, so this bans a driven node there with no second check and
  `buildFactories` gained nothing.
- **Two modes, not a row of booleans.** Top-down moves on four axes and never jumps; a
  platformer moves on two and jumps, and only while `body.blocked.down` — Arcade's own flag
  for "there is something under me this step", which is exactly the solid tile or the
  collider. The combinations in between are ones nobody asks for and the exporter would have
  to answer for.
- **The mark on the canvas is two filled arrows, and filled is not a style choice.** It is
  the emitter marker's rule arriving a second time: a thin line never reaches full strength
  on screen, so an outlined arrow is hard to see under a thumb and — a diagonal being
  antialiased along its whole length — very nearly invisible to a colour assertion. The
  first version drew chevrons and moved a pure-green pixel count by six percent.
- **The export is the first `update()` this project has ever emitted**, plus a keyboard
  block in `create()`'s prologue and one `this.<field> = <binding>;` in the epilogue — the
  third thing emitted after the objects, and the one with no alternative at all, since
  `update()` runs outside `create()`'s scope. Gated on the emitted body exactly as
  `preload()` is, so a project with nothing driven exports byte for byte what it exported
  before.
- **The `this.<field>` names come out of a set seeded with `SCENE_MEMBERS`**, which is the
  prefab factories' precedence rule one namespace over: `this.player` lands beside
  `this.physics` and `this.input`, so an object a user called "input" must not take a
  property the line beside it reaches through. The keyboard fields are allocated before any
  object's, as sound handles already are.
- **The emitted block narrows with a plain `if`, and this is the constraint that shapes all
  of it.** `this.input.keyboard` is `KeyboardPlugin | null` under `--strict`, and the
  `create()`/`update()` body is the *same plain JavaScript* in the `.ts`, the `.js` and the
  runnable page — so it can carry no `!`, no cast and no annotation. `const keyboard =
  this.input.keyboard; if (keyboard) { … }` is valid in all three. `update()` guards each
  driven object the same way with an `if` rather than an early `return`, so a second driven
  object is still updated when the first is somehow missing.
- **A WASD set is emitted as a whole `CursorKeys`**, six keys including `space` and `shift`,
  and that is a type decision: `Phaser.Types.Input.Keyboard.CursorKeys` names all six and
  none of them is optional, so a four-key literal could not be given that type.
  `addKeys('W,A,S,D')` was the other route and is worse — its declared return is a bare
  `object`, so every property access below it fails under `--strict`.
- **Only the `.ts` declares the fields**, typed `… | undefined` rather than with a `!`,
  which is what satisfies `strictPropertyInitialization` with no syntax the shared body
  could not also carry. That is the existing `.ts`/`.js` difference — the `: void`s and the
  factory parameter types — rather than a new kind of one.
- **No game-config key and no header note**, unlike Arcade. `this.input.keyboard` is built
  for every game that has a keyboard to read, so a module dropped into someone else's game
  needs no change; it is nullable rather than absent, which is what the `if` above is for.
  Said in the comment block beside `arcadeConfig`, where the audio and camera refusals are
  already recorded and where "no branch needed" and "forgot a branch" look identical.
- **`constructorFor` gains no case, so every step of this feature is silent** — the
  renderer, the exporter, the inspector and the store alike. `behaviour.spec.ts` and
  `export.spec.ts` are what stand in for the compiler, exactly as they are for physics and
  cameras. The one thing only the *toolchain* spec can catch is the emitted `update()`
  meeting `CursorKeys` and `Body` under `tsc --strict`, which is why the hostile project's
  driven node has a non-default value in every field.
- **The suite's positive claims are on the far side of the export**, because the editor
  refuses to run any of this. "It lands" and "it plays" are in `export.spec.ts` beside "the
  exported page runs the physics it was given"; `behaviour.spec.ts` carries only what the
  canvas can be asked. And "it lands" asserts *where the object came to rest* rather than
  *whether it has stopped moving* — a settled-yet reading compares two shots milliseconds
  apart and goes red on a loaded machine for a reason that is not the collider.

## Rules

Three things the document may now say that it could not before: **when** something
happens, **whether** it happens, and **what** happens. `SceneDoc.rules: SceneRule[]` holds
them and `project.variables: ProjectVariable[]` holds the numbers — and, since iteration 29,
the text — they test. It is the first iteration to cross a line this file has been drawing
since iteration 20, which is why most of what follows is about where the new line falls
rather than about the code.

- **The line moved, and this is the sentence that replaces iteration 20's.** That one said
  the document may state standing facts about the world but not a sequence of events. This
  one is narrower than "anything goes" and falls out of the emit rather than out of taste:

  > **The document may name a moment Phaser already delivers, and a list of things to do
  > at it. It may not name a moment Phaser would have to go looking for.**
  >
  > **And a rule's actions are a list, never a program.** No order that depends on a
  > result, no value that depends on a value, no branch inside the list. The conditions are
  > one gate on the whole list, read once, at the moment.

  The first half is why all five triggers are `create()`, a collider's own callback,
  `pointerdown`, `keydown-<KEY>` and a `TimerEvent`, and why **`update()` gains nothing at
  all**. Not one of them is polled, and that is not a coincidence — it is the constraint
  that *chose* the five. A sixth trigger of the form "while…" or "when the score passes
  ten" is the first that has to be watched for every frame, which is the first that needs
  an emitted `update()`, which is exactly where the line now falls. A future reader adding
  a "while" trigger is crossing it, not extending it. The second half refuses OR, nesting,
  `onComplete`, arithmetic and callback parameters in one breath.
- **The editor still never runs a rule, and this is the strongest version of a refusal
  made four times already.** Physics is not simulated because a step rewrites the numbers
  the document is made of; a tween *is* run under ▶ because its result is thrown away the
  moment it stops. A rule is neither: it destroys objects and starts other scenes, so a
  preview would not merely animate the document, it would demolish it. There is no version
  of "run it for a moment". **`EditorScene.ts` is untouched by this entire feature** —
  Audio's claim one iteration on — and `hasMotionIn` records its **sixth** refusal, which
  is the one a reader will most expect to be wrong, since a rule is *nothing but* a thing
  that happens over time. But that toggle exists so a canvas moving by itself can be
  stopped, and no rule here moves anything at all.
- **`rulesOf(project, scene)` is the only reader**, in the `guidesOf` / `soundsOf` /
  `collidersOf` / `cameraOf` / `tileMapOf` family, answering six questions at once. A fresh
  array per call, so `useEditorStore((s) => rulesOf(...))` is React error #185 — the
  `tileMapOf` trap, **tenth** time, and `rulesNaming` is the eleventh.
- **Its policy is deliberately not uniform, and the sentence underneath it had never needed
  saying before:**

  > **A repair may narrow what the document says. It may never widen it.**

  Every reader in `schema.ts` has only ever narrowed — `soundsOf` clamps a volume,
  `cameraOf` repairs a zoom, `tileMapOf` drops a tile, `collidersOf` drops a row,
  `physicsOf` strips a nested body. It never had to be said, because until now nothing in
  this document *could* be widened by a repair. A dropped **condition** is the first thing
  that can: `if score >= 10` removed is not a rule that does less, it is a rule that now
  fires **always**. So a condition naming a missing variable costs the **whole rule**,
  where an action naming a missing node costs only that action.
- **A dangling variable in an *action* costs the whole rule too**, which is that argument
  one step further and the one a reader will want to trim back. A variable is the one thing
  a rule names that *another rule reads*: drop an `addVar` and every condition elsewhere in
  the project goes on testing a number that was supposed to have moved, silently. `destroy`
  has no such reach, so it goes alone. The store says the same thing — `removeVariable`
  drops every rule that names it rather than pruning the parts, so the reader and the store
  cannot disagree.
- **A repair may set a rate; it may not open a gate.** `timer.delay` is repaired with a 1ms
  floor exactly as `tweenOf` repairs a duration, and that floor is the whole protection
  against **the one thing in this vocabulary that can run away**: a looping timer at 0ms
  fires on every step of the game loop, and under `addVar` that is a counter in the
  thousands within a second.
- **An unknown trigger kind costs the rule; an unknown action kind costs the action.** A
  trigger is a moment and there is exactly one, so an unknown one leaves nothing to attach
  to. An action is one line of a list the rest of which still means something — and the
  empty-`do` check catches the case where it was the only one, because a real listener
  running an empty callback is indistinguishable from the feature being broken. That is
  `tweenOf`'s "an unknown ease is repaired, an empty `to` is not", inverted.
- **Rules name top-level nodes only, and the reason is *not* `physicsOf`'s.** A body is
  banned inside a container because it reads world coordinates. A rule is banned there
  because `buildCreateBody`'s `bindings` map is keyed off `scene.children`, so a nested node
  has no binding for an action to name — and because a prefab definition's children share
  their node ids across every placement, so `destroy` could not say *which* coin. That is
  `containerBounds`' "two coins on screen would fight over one map entry", arriving in the
  document. Strip on read, refuse on write, as always.
- **A collide trigger binds to the `SceneCollider` row, and under Matter it does not — and
  the split is Phaser's rather than this editor's.** Arcade's handler *is* the third
  argument of the `add.collider` call the row already emits, so a rule **changes that line**
  rather than adding one; two calls on one pair would separate twice. Binding also keeps one
  notion of what collides, inherits `collidersOf`'s four refusals free, gets the
  multi-layer-tilemap loop free, and **inherits the row's own `collide`/`overlap` word** —
  so overlap-versus-contact is a rule parameter this feature never had to invent.
  Under Matter there is no row at all, and the argument is better than "the engines differ":
  `collidersOf` answers `[]` for Matter *because* Matter already collides everything with
  everything, so a row saying "these two meet" says nothing it has not done. **That does not
  transfer by a single word** — "when these two touch, *do this*" is something Matter does
  not do on its own — so this is the one place a Matter scene needs *more* emitted code than
  an Arcade one. Refusing it would be iteration 26's Controls-panel bug repeated
  deliberately, three iterations after it was recorded.
- **`addRule` and `updateRule` both create the row a collide trigger needs, in the same undo
  step.** `addCollider`'s "a row arrives already pointing at two objects", and **the first
  time the write half of strip-on-read/refuse-on-write is a *construction* rather than a
  refusal.** Both halves are needed and the second is the one that was missed first: a rule
  *becomes* a collide rule as often as it arrives as one, and a trigger switched with no row
  is a rule `rulesOf` drops on the very next read — which reads as a rule that vanished the
  moment it was made. `removeCollider` goes the other way and takes that pair's rules with
  it, which is `removePrefab` detaching its instances; creating the row is a convenience,
  destroying the rules is correctness, and the asymmetry is `removeFont`'s.
- **`mapRule` reads `scene.rules` raw, and it is the one place in this feature that
  deliberately does not go through the reader.** `rulesOf` *drops* what it cannot validate,
  so editing through it would silently delete every rule the panel is not currently showing
  the moment any other one was touched — and a rule mid-edit is exactly the rule that does
  not validate yet. The reader is for what the renderer and the exporter see; the store
  edits the document as written.
- **A condition reads a variable and never a live object property.** That is the second
  thing this feature refuses rather than a hole in it. A variable is the one quantity here
  that survives `scene.start`, that validates against a table the document holds, and that
  is *one shape across the whole union* — where `x` on a tilemap, `alpha` on a particles
  wrapper and `width` on a sprite are three different questions. `TWEEN_PROPERTIES`' refusal
  of a seventh property, arriving in a condition.
- **Conditions and actions carry no `id`.** `SceneGuide`, `SceneCollider` and
  `TilemapLayerDoc` each carry one because something *outside* the array names it — a row on
  another panel, or `activeLayerId`. Nothing names an action: it has no existence outside
  the rule that holds it, and that rule is itself keyed. React keys are
  `` `${rule.id}:${index}` ``. Said out loud, because here "no id needed" and "forgot the
  id" read identically.
- **`RULE_KEYS` is an allowlist and the argument is not injection** — `str()` already sits
  between the value and the output. It is that `keyboard.on('keydown-BANANA', …)` registers
  a listener on an event string nothing ever emits: no warning, no error, no throw, and a
  key that simply never works. `TWEEN_EASES`' argument to the character, one plugin over,
  and it is what makes the control a `SelectField`.
- **`RULE_OPERATOR_JS` is the one builder for what a comparison is written as**, read by the
  panel's label and by the emit — `TWEEN_PHASER_KEY`'s rule, on something nobody can see
  until the game is in their hand. `eq` is `===` rather than `==`, because the registry
  holds whatever was last written to it and a coercing comparison would make `0` and `false`
  the same answer.
- **`TAPPABLE_TYPES` is presently the same six as `PHYSICS_TYPES` and is deliberately a
  second list.** One is about whether Arcade can simulate a body, the other about whether
  Phaser can build a hit area, and they come apart the moment either changes — the note in
  `EditorScene` about `ParticleEmitter` gaining ComputedSize is exactly the change that
  would move one and not the other. `canCollide` being separate from `PHYSICS_TYPES` is the
  same call already made once.
- **`playSound` names a `SceneSound` row, not an `audioId`.** `buildSoundLines` already binds
  one `const jumpSound` per row in `create()`'s prologue, so the action emits a name that
  exists over a key `preload()` has already loaded — and `collectAudio`, `usedIn`,
  `missingReason` and the preload gate all need **no edit at all**. An `audioId` would name a
  sound the scene may not register, and `sound.add` on a key the cache does not hold *throws
  inside `create()` before a single object is added*, which Audio already records as worse
  than the image case. It is also the sentence this iteration exists to write: Audio said
  "`jumpSound.play()` is the user's line to write, exactly as the collider is", and this is
  where the document writes it, on the handle iteration 17 built for it.
- **The panel is in two places, and that is the point rather than a duplication.** The
  scene-wide list is in `SceneInspector`; `NodeRulesSection` shows the same rules filtered to
  one object on that object's own panel, built on `rulesNaming` so a rule the scene panel
  dropped cannot come back to life there. `CollidersSection` recorded why: `SceneInspector`
  renders only with an **empty selection**, so a panel that lives only there is off screen
  for the whole of the time a person spends building the objects a rule is about — and *a
  panel that is right and cannot be reached reads to a user exactly like a feature that does
  not exist.* This feature applies that lesson before the bug rather than after it.
- **A rule is a collapsed summary that expands**, because it holds more controls than
  anything else in the panel, and the toggle is titled `Edit <name>` rather than carrying the
  bare name — the scene chips' `Switch to ` rule, arriving a fifth time, and it matters
  because nothing stops a user calling a rule "Scene". Never more than two controls per
  `field-row`: at 390px a third is ~85px and truncates every object name in a picker to
  nothing, which is the reason `CollidersSection` splits four controls into two rows of two.
- **Every picker is seeded with a real choice**, `defaultTween`'s rule and its reason: a rule
  that arrives naming nothing is one `rulesOf` drops on the next read, so there would be
  nothing on screen left to fill in. `restartScene` is the one action that names nothing at
  all, which makes it the only seed that can never dangle whatever the scene holds.
- **`SCHEMA_VERSION` bumped to 13, on the silent-data-loss half and only that half.**
  `scene.rules` rides in on `scenes` — passed through verbatim — and would not have bumped
  anything on its own. `project.variables` is a *project* table, one of the fields
  `parseProject` names one at a time, so a v12 build drops it on open and re-saves without
  it. What it leaves is the audio case made worse the way the font case was: the rules
  survive, naming variables whose declarations are gone, so `rulesOf` drops the rules that
  were the point of the file. A sound that loses its table makes no noise; a game that loses
  its variables still runs, and stops being the game.

### Variables

- **Project-level, and the reason is stronger than the one the tables beside it have.** An
  image is shared because copying the bytes would be wasteful; a score shared per scene would
  not be a score. It has to survive `scene.start`, which is itself one of the actions — so it
  is emitted through `this.registry`, the game-wide `DataManager` and the only store that
  outlives a change of scene. `this.data` is the per-scene one and would silently reset on
  every restart.
- **The initial value is set once per game, and resetting it is a rule.** The emitted helper
  guards with `registry.has(key) ||`, which is `anims.exists`' and `this.sound.get(key) ??`'s
  guard for the third time and for their reason: `create()` runs again every time a scene
  starts. It is also the strictly more expressive choice, which is what settles it rather
  than taste — the document can already say "zero this when the level starts", because
  `sceneStart → setVar` is two things it already holds. Unguarded, there would be no way for
  it to say *don't*. `wordWrapWidth: 0`'s "the one target the user could not express",
  inverted.
- **The registry key is derived at export and never stored** — `audioKeyOf`'s treatment
  rather than `FontAsset.family`'s, by the test this file already states: a family *is* the
  link a node holds, so it must be stable for the life of the project, while nothing in this
  document ever names a registry key. Conditions and actions name `id`, and that is what
  keeps renaming free.
- **`variableKeysOf` answers for the whole table where `audioKeyOf` answers for one name, and
  that difference is the point.** An audio row can afford an un-de-duplicated key because a
  collision is a *second sound that visibly does not play*. Two variables deriving one
  registry key is a value **silently shared at runtime**: both rows go on showing their own
  number while the game keeps one, and the row being edited may not be the one a rule reads.
  The suffix is the only thing on screen that can say so, so the panel has to be shown the
  de-duplicated answer — which means being shown all of them at once. `atlasOf`'s uniqueness
  argument, one table over.
- **`collectVariables` is unfiltered where `collectAssets` and `collectAudio` emit only what a
  scene uses.** Those are filtered because bytes are expensive; a variable is three tokens,
  and it exists *precisely so a hand-written line can read it* — `mass` and `immovable`'s
  reason for being emitted when nothing generated reads them. On that checklist an unfiltered
  collector reads exactly like a missed step, which is why it says so at length.
- **A new variable arrives under a name nothing else has**, so a fresh row never opens already
  showing a suffixed key. A *rename* is deliberately not de-duplicated, for `renamePrefab`'s
  reason: forcing uniqueness on every keystroke fights the user halfway through a word, and
  `collectVariables`' own set is the backstop that keeps the export correct regardless.

### Showing one: text variables and `setText`

Iteration 29 closes the hole iteration 28 left open. A rule could count a score, test it and
carry it across a `scene.start`, and **nothing in a project could show it to a player** — a
text node's string is a document field, so the number the game kept was one nobody playing
could ever see. Two additions, which arrive together because neither is worth anything alone:
a variable may hold **text**, and a rule may **set an object's text**.

- **The line iteration 28 drew does not move, and that is the first thing to check.** Every
  trigger is still a moment Phaser already delivers; `setText` is one more verb in a list run
  at one of them, so `update()` still gains nothing. And the canvas still runs no rule:
  **`EditorScene.ts` is untouched by this whole feature**, for the third time after Audio and
  Rules, and this is the sharpest version of it — a caption is the first action whose result
  *would be visible on the canvas* if anything ran it. What the canvas draws is `props.text`,
  so the document stays the only thing that can change what is on screen, and `hasMotionIn`
  records the refusal in as many words, because a caption is the one result of a rule that
  *would* be visible here.
- **A variable's kind is the type of its value, never a field beside it.** One field, for the
  reason a sprite has no width of its own and a tilemap no tile size: two fields answering one
  question is how they come to disagree, and a `kind: 'text'` over a `value: 0` is a variable
  the panel and the emit would describe differently. `variableKindOf` is the only reader of
  that type and `coerceVariableValue` the only converter, so the row, a condition's field, a
  `setVar`'s field and the reader's refusals cannot disagree about what switching a kind does.
  `atlasOf` needed a tie-break because an image can be cut two ways at once; a value cannot be
  two types at once, so there is nothing here to break a tie between.
- **Text arrives with `setText` rather than before it**, which is the sequencing this file
  already argued and the reason iteration 28 refused it: the only thing anybody wants a text
  variable for is a name to show, and a variable nothing can display is a variable with no use.
- **The reader's new refusals are all the same sentence twice over.** *A repair may narrow what
  the document says; it may never widen it*, and *a variable is the one thing a rule names that
  another rule reads*. So: a condition comparing text with `>`, a condition whose comparand is
  not the kind the variable holds, a `setVar` writing a number into text, an `addVar` on text —
  every one costs the **whole rule**. None is repairable, and the two halves of why are worth
  keeping apart: coercing `"3"` to `3` *invents* a comparison, where dropping a `setVar` leaves
  every condition in the project testing a value nothing writes. A `setText` is the other side
  of it: its node costs only the **action**, because a node reaches nothing outside the rule
  that names it, while its variable costs the rule.
- **`TEXT_OPERATORS` is a set rather than a spelling, and it exists for `TWEEN_EASES`' reason.**
  `'won' > 'lost'` is a comparison JavaScript performs happily, on code points, and nobody asks
  for — so the panel offers two operators for text and the reader refuses the other four, from
  one list. It is also why the operator picker narrows rather than the value field coercing.
- **`setText`'s variable is optional, and absent and empty are one state.** The commonest shape
  is a fixed caption, and an optional field is the only way to say that without a sentinel. It
  put the one real trap in this iteration: `ruleActionsOf` reads a missing `variableId` as
  `''`, and `findVariable(project, '')` answers `undefined` — which in `setVar`'s branch means
  *drop the whole rule*. A `setText` reusing that local would have taken every plain caption in
  the project with it, invisibly, because the panel writes `undefined` and only a reader test
  could see it.
- **The caption is free user text, and that is narrower than it sounds.** It is printed through
  `str()` into a string literal exactly as an object's name and a text node's own content
  already are. What it is *not* is a template: there is no syntax inside it, so nothing parses
  it and nothing can hide in it. One variable goes on the end, named in a field of its own,
  which is why the document holds a `variableId` beside the text rather than a `{score}` a
  parser would have to find. Two variables in one caption is an expression, and that is the
  line this vocabulary does not cross.
- **`setVariableKind` is a store action of its own, and that is the other half of the reader.**
  Switching a kind reaches every rule in the project that reads or writes the variable, so it
  converts each condition's comparand, pulls an ordering operator back to `eq`, converts each
  `setVar` and drops each `addVar` — one undo step, `removeAsset`'s rule one table over: **the
  document may never hold a mismatch by any action in the editor**, so `rulesOf`'s refusals
  only ever fire on a file the editor did not write. Strip on read, repair on write, for the
  fourth time. Without it the refusals above are a trap rather than a guard: flipping a score
  to text would make every rule that sets it vanish from the panel with nothing having said so.
  It is the one place a repair *narrows* a condition deliberately, and that is allowed here
  precisely because the user is in the act of changing the kind — a consequence they asked for
  rather than one the reader invented behind them.
- **`variableLiteral` is the one printer for a variable-shaped value**, read by the table, by
  `setVar` and by a condition's comparand — `frameArg`'s argument one type over, and for its
  reason: `registry.set("score", "7")` compiles, runs, and puts a string where every comparison
  below it expects a number.
- **The emit is a literal and one read, joined with `+`.** Never a template the exporter
  assembles, and never `setText(registry.get(key))` — which would hand `Text` whatever was last
  written to the registry rather than a string. `registry.get` answers `any`, so the
  concatenation needs no annotation in a body that cannot carry one, which is the convenience
  the conditions already rest on. `constructorFor`'s `'text'` case needed **no edit at all**,
  unlike `playAnimation`'s (which widens an `Image` to a `Sprite`) and `startTween`'s (which
  binds a handle): a `Text` is already a `Text`, so there is no `EmitContext` field and no
  pre-pass — which on that checklist reads exactly like a missed step.
- **`buildVariableHelper`'s signature widens only when something in the table is text.** A
  project written before a variable could hold text emits the line it always emitted, which is
  the byte-for-byte rule the asset table, the tilemap helper and the prefab factories follow.
  Not a question of what compiles — the wider type accepts both — but of a diff nobody asked
  for.
- **`SCHEMA_VERSION` bumped to 14, on the silent-data-loss half and only that half — the v13
  case one turn of the screw further.** No new `NodeType`, so a v13 `createDisplayObject` has a
  case for everything in the file. `setText` would not have bumped anything: it rides in on
  `scenes`, verbatim, so an old build drops it from the emit and carries it back out on a
  re-save. What bumps this is `parseVariables`, which rebuilds the project table field by field
  and coerced every value with `Number(...)` — so a v13 build reads `value: 'ready'` as `NaN`,
  repairs that to `0`, and writes back a variable that keeps its name and its id and holds the
  wrong kind. Then `rulesOf` drops every rule whose condition or `setVar` named it. v13 lost
  the declarations and the rules went with them, which at least left the panel empty; this one
  leaves the declarations on screen *looking right* while the rules that were the point of the
  file quietly go.
- **The panel's value field is one label for both kinds**, because it is one question — a
  `TextField` or a `NumberField` under `Variable N starts at`, with `Variable N holds` beside
  the name as the only new label. Three rows per variable rather than three controls in one:
  at 390px a third control is ~85px. And `addVar`'s picker offers only number variables while
  `setVar`'s field follows the variable it names, so the panel cannot build what the reader
  refuses — `CollidersSection`' rule, and the reason every empty state here is a sentence.
- **The suite's instrument is an extent, and the positive claim can only live in
  `export.spec.ts`.** Text is the same colour however much of it there is, so the only thing a
  screenshot can say about a string is how wide it is drawn — `fonts.spec.ts`' reading,
  measuring the string rather than the face. A label that reads `.` until the game starts and
  `Score: 3` afterwards is the whole claim, and it also proves the actions are a list *in
  order*: the value is set and then read inside one callback. `rules.spec.ts` carries the
  negative half — the canvas keeps the text the document states — because the editor runs none
  of it.
- **The hostile project gained a variable whose *value* is hostile**, which is a different set
  of `str()` call sites from its hostile *name*: an object-literal value, a `registry.set`
  argument, a condition's right-hand side and a `setText` argument. Its `setText` on a
  *rectangle* is the sharpest negative in the file — without the reader's `type !== 'text'`
  refusal that is not a wrong picture but a **compile error** in the emitted `.ts`, which only
  `export-toolchain.spec.ts` could find.

### Showing one as it changes: live labels

Iteration 30 closes the first hole iteration 29 left. A rule could put a score on screen and
the score could then move with nothing on screen following it, because a caption written by
`setText` is only right until the next `addVar` — so every rule that touched the number
needed a caption beside it, in every scene, and a number changed from anywhere else went
unshown. `TextProps.label?: VariableLabel` makes a label say what it *shows*, and the whole
iteration is that one shift in subject: from *what happens at this moment* to *what this
object reads*.

- **The line iteration 28 drew does not move, and that is the first thing to check.**
  `registry.events` emits `changedata-<key>` on its own, so a label is still a moment Phaser
  already delivers and `update()` **gains nothing**. That is exactly the test that paragraph
  set: a caption watched for would have been the first thing polled, and the first thing
  polled is where the line falls. Nothing here is watched for.
- **The node's existing `text` is the caption, and there is no second field.** `setText`'s
  shape to the character: one value, on the end, named in a field of its own rather than a
  `{score}` a parser would have to find. Two variables in one caption is an expression, which
  is still the line this vocabulary does not cross.
- **A field on the node rather than an action, and the difference is the whole feature.** The
  question a label answers is "what does this object read", which is about the object; the
  question `setText` answers is "what happens at this moment", which is about the rule. Both
  now exist, and a project may use either — a rule's caption wins until the value next
  changes, which is Phaser's ordering and is a thing the panel says rather than a combination
  refused: the tween-versus-dynamic-body case, one type over.
- **`labelOf(props, project)` is the only reader**, in the `guidesOf` / `tweenOf` / `soundsOf`
  / `textStyleOf` family, and it answers three questions at once: is there a binding, does it
  name a variable the project still holds, and are the two numbers ones `toFixed` and
  `padStart` can be handed. A fresh object per call, so `useEditorStore((s) => labelOf(...))`
  is React error #185 — the `tileMapOf` trap, twelfth time.
- **A dangling variable reads as *absent*, where `rulesOf` costs a `setText` the whole rule.**
  Both follow from the same sentence and they land in different places, which is worth saying
  because the inconsistency is the point: *a repair may narrow what the document says and may
  never widen it.* Dropping a rule's gate widens it; a label that stops appending a value says
  strictly less than it said, and the caption underneath is a state that already has a code
  path. `fontStackOf`'s "no font chosen, the font is gone, and an ordinary family are one
  state", arriving for a fifth time.
- **The clamp is not tidiness.** `toFixed` throws a `RangeError` outside 0..100, and that
  throw happens inside the *player's* game — so a hand-edited `decimals: 999` would be a
  document that crashes the export rather than one that draws something odd. `MIN_TIMER_DELAY`
  in a different direction: there a repair stops a runaway, here it stops a throw.
- **`decimals: -1` is off and `pad: 0` is off**, and the split is deliberate. Zero decimal
  places is a real answer — it is what a score asks for — so the sentinel cannot be `0` there;
  padding to no width says nothing, so it can be here. `wordWrapWidth: 0`'s call where it
  works and an explicit `-1` where it does not.
- **`pad` counts the whole formatted value, because that is what `padStart` counts**, and a
  negative number keeps its sign and pads as written. A cleverer rule — pad the digits before
  the point, move the sign out front — is the one thing this feature refuses on grounds of
  *arithmetic*, and the reason is the next entry.
- **`formatVariable` is the one builder in this codebase that genuinely has a copy.** The
  generated game cannot import `src/core/schema.ts`, so the canvas runs that function and the
  export runs a printed one — `cameraViewOf`'s "copies Phaser's arithmetic and has to stay
  copied" arriving from the other side. The answer is to leave nothing to copy *wrongly*: two
  whole calls, `toFixed` and `padStart`, one early return for a value that is not a number,
  and no arithmetic of our own on either side. The first version of this had the editor pad a
  text variable and the export not, which is precisely the disagreement the rule predicts, and
  `labels.spec.ts` caught it on the first run.
- **The same two dials went onto the `setText` action**, and that was the point of doing them
  at all rather than a second feature bolted on. A rule writing `Score: 0007` beside a label
  following the same variable to `Score: 7` is the one kind of failure a user cannot see until
  the game is in their hand — `textStyleOf`'s two-consumer argument, on a pair of *outputs*
  rather than a pair of readers.
- **`ruleActionsOf` attaches the format only where it differs from the default**, which is not
  cosmetic: the inspector edits that reader's output and writes it straight back, so carrying
  `decimals: -1, pad: 0` unconditionally would put two keys into every `setText` in every
  document the moment any other field on it was touched — and would move an export that should
  not have moved. `rules.spec.ts` asserts the unformatted line byte for byte beside the
  formatted one.
- **`setNodeLabel` is a store action of its own, and `updateProps` genuinely could not do
  it.** `updateProps` spreads a patch, so it can set a label and can never *remove* one:
  `{ label: undefined }` leaves the key holding undefined, which survives in memory, vanishes
  through `JSON.stringify`, and gives the document two spellings of "off". `setNodePhysics`,
  `setNodeControls` and `setNodeTween` all `delete` for that reason and this joins them. The
  second reason is that binding one has to *seed* a variable — `defaultTween`'s rule, that a
  thing arrives already naming something — and a scene edit cannot see the project's table,
  which is why this one action reaches through `editProject` where its three neighbours use
  `editScene`.
- **A label is legal inside a container and inside a prefab definition**, where a body, a
  drive scheme and a rule's `nodeId` are all banned. Same test, opposite answer: those three
  read world coordinates or name a binding the scene's own list has made, and a label writes
  the object's *own* text. It is the tween's rule a second time, and it is why the emit goes
  through `ctx.receiver` — `this` in a scene method, `scene` in a factory. The hostile
  project's definition carries a labelled text child for exactly that, and without it the
  emitted `.ts` would compile in one place and not the other.
- **`removeVariable` strips every label naming it**, through `mapProjectNodes` rather than a
  walk of the scenes, because a label inside a definition is the one nothing else could reach.
  `removeAsset`'s rule — the document may never hold a dangling reference by any action in the
  editor — so `labelOf`'s drop-on-read only ever fires on a file the editor did not write. The
  two look redundant and are not: the reader is what keeps the canvas right, and the walk is
  what keeps the *file* right.
- **`setVariableKind` needed nothing at all**, which is `migrateRuleToKind`'s own sentence
  about `setText` a second time: a label shows whatever the value is, which is the whole point
  of it. Said out loud, because beside a function that migrates every condition and every
  `setVar` in the project, not migrating a label reads exactly like a step that was missed.
- **Two emitted helpers, not one, and the split is the `setText` action's doing.** A rule can
  ask for a format without asking for a subscription, so the formatter is its own function and
  the binder calls it — one formatting implementation in the generated file, two gates in
  `prepare`. Both names come out of the module's identifier set last of all, thirteenth and
  fourteenth, by the rule the tenth to twelfth already state: nothing above them moves, and
  four of those are asserted by name in the suite.
- **The binder draws once before it subscribes, and has to.** `initVariables` sets a key that
  is absent, and Phaser's `DataManager` emits `setdata-<key>` for a first write and
  `changedata-<key>` only for a later one — so a label that waited for the event would sit
  showing its bare caption until the score first moved. That first call is also what makes
  `constructorFor`'s `'text'` case need **no edit at all**: the object is built with its
  caption and handed the whole string one line later.
- **The handler takes no arguments and re-reads the registry**, rather than the
  `(parent, value, previous)` the event carries. `buildKeyHelper`'s paragraph verbatim: Phaser
  types `EventEmitter#on`'s second parameter as the bare `Function`, so a named parameter
  there is an implicit `any` the exported `.ts` refuses. It also means the emitted file
  depends on nothing about the event but its *name*.
- **And it unsubscribes on SHUTDOWN, which the tween deliberately does not.** A Tween belongs
  to the scene's own manager and dies with it; the registry belongs to the **game**, so a
  scene that starts another and comes back would leave a listener holding a destroyed `Text`
  and the next change to the score would throw — in the player's game, long after anything
  points at that line. The `assetTextures` / `animationKeys` / `FontFace` bookkeeping rule,
  in *emitted* code for the first time.
- **The renderer draws the variable's starting value**, which is the document's own statement
  about the frame the game opens on rather than a simulation — the camera frame's rule, and
  the reason `hasMotionIn` records a seventh refusal: a label cannot change here, so there is
  nothing for a ▶ to start or to stop. It is the first thing on this canvas whose content
  comes out of a *project* table, and it is why this is the first iteration since 27 to touch
  `EditorScene.ts`.
- **`SCHEMA_VERSION` did not bump — the guides case, eighth time.** No new `NodeType`, so a
  v14 `createDisplayObject` has a case for everything in the file. `props.label` rides in on
  `scenes`, which `parseProject` passes through verbatim, **and on `prefabs.children`, which
  `parsePrefabs` also passes through unvalidated**; the action's two fields ride in the same
  way. An old build draws the plain caption, reads neither field, and carries both back out on
  a re-save. Still contingent on `parseProject` not reconstructing scenes or prefab children
  field by field, exactly as physics, cameras, behaviour, touch, Matter and tweens are.
  `labels.spec.ts` asserts the 14 in the saved artefact.
- **The suite's instrument is an extent, and every claim is "this draws wider than that".**
  Text is one colour however much of it there is, so a centroid says nothing — `fonts.spec.ts`'
  reading, here measuring the string rather than the face. The positive *runtime* claim cannot
  live in `labels.spec.ts` at all and is in `export.spec.ts`, and it is a strictly stronger
  claim than `setText`'s beside it: **nothing in that fixture writes the label's text**, a
  looping timer adds to the variable, and the caption has to grow twice on its own — which is
  the one thing a set-once emit cannot fake.

## Touch controls

`NodeControls.touch` is a boolean beside `scheme`, and the exported game draws a D-pad and
a jump button over its canvas. It is iteration 20's honest hole closed — for nineteen
iterations "mobile is a first-class target" meant the *editor*, and the game it produced
needed a keyboard.

- **A boolean beside `scheme`, not a third value of it.** CLAUDE.md predicted "a third
  `scheme`" and that prediction was wrong in a way worth recording: which keys drive an
  object and whether there are also buttons are two questions, not two answers to one. A
  mutually exclusive `'touch'` would mean picking it silently produced a game a desktop
  cannot play, with nothing in the panel saying so — where a boolean means one export plays
  in both places. It also leaves `controlsOf`'s `scheme` ternary and the inspector's
  matching one untouched, which is the whole of what the other shape would have rewritten.
- **Off by default**, the rule the asset table, the tilemap helper, the prefab factories
  and the emitted `update()` itself already follow: switching it on puts visible buttons
  into someone's game, so a project that predates the feature has to export byte for byte
  what it exported before. `controlsOf` reads an absent field as `false` for the same
  reason.
- **`touchZonesOf(scene)` is the only reader**, in the `guidesOf` / `physicsOf` /
  `cameraOf` / `soundsOf` / `tileMapOf` / `collidersOf` family, and it answers three
  questions at once: does anything here want buttons, which buttons do the modes present
  need, and where do they sit against this scene's size. Any one answered somewhere else is
  a renderer drawing a pad the export does not build — the one failure a user cannot see
  until the game is in their hand. It walks `scene.children` only, so `controlsOf`'s
  top-level rule is inherited rather than repeated. It builds a fresh array per call, so
  `useEditorStore((s) => touchZonesOf(...))` is React error #185 — the `tileMapOf` trap,
  sixth time.
- **One set of buttons per scene, not per object, and the modes are a union.** The buttons
  belong to the canvas, so two driven objects read the same five flags — which is what a
  player expects and what falls out of the geometry being the scene's. Any top-down node
  puts up and down on the pad; any platformer puts a jump button on the right. A per-object
  pad would be two D-pads in one corner the moment a project had two driven objects.
- **The layout is derived, never stored, and that is the whole reason this cost no
  format.** Radius is 7.5% of the shorter side with a floor — proportional because the canvas is scaled to fit whatever screen the game lands on — margin is one radius,
  and the pad is a *cross* rather than a row so that adding a top-down object does not move
  the left and right buttons a platformer was already using. That the scene rectangle *is*
  the game canvas is not an assumption made here: it is the identity `cameraViewOf` already
  rests on, and the reason a camera has no rectangle of its own.
- **`SCHEMA_VERSION` did not bump, and this is the guides case for the fourth time.**
  `touch` is a field on an optional field on a node and adds no `NodeType`, so it rides in
  on `scenes` — the one part of a file `parseProject` passes through verbatim. A v9 build
  has a `createDisplayObject` case for everything in the file, reads it nowhere, draws
  identically and carries it back out on a re-save. **Still contingent on `parseProject` not
  reconstructing scenes field by field**, exactly as physics, cameras and iteration 20 are.
  `behaviour.spec.ts` asserts the 9 in the saved artefact so a future bump is deliberate.
- **Drawn, never pressed** — Physics' "drawn, never run" and the camera's "drawn, never
  applied", a third time. The rings are not interactive and nothing in the editor reads
  them, because a button that moved an object here would move it *in the document*, which
  is exactly why a physics step is not run either. `hasMotionIn` still answers false, and it
  shares iteration 20's refusal rather than adding a fourth: that comment now names
  controls of *either* kind, keyboard and on-screen alike, because it is one argument —
  the toggle exists so a canvas moving by itself can be stopped, and a ring nobody can
  press moves nothing.
- **`drawTouchZones` is in `update()`** with `drawGrid`, `syncPlacedGuides`, `drawBodies`
  and `drawCamera`, for their reason — the stroke is a screen width divided by the camera
  zoom, and a pinch changes the zoom without touching the store. Signature-gated like the
  camera, because on almost every frame none of it has moved. Depth **997.5**: just above
  the camera frame at 997 and still below the paint grid and the placed guides at 998, which
  is the camera frame's two arguments at once — a ring hidden under a tilemap says nothing,
  and this is furniture nobody grabs, so it must never cover something that is.
- **A colour of its own, where a static body got a cross instead.** That rule — "one colour
  and more marks rather than a second palette entry" — is for telling two kinds of *the same
  thing* apart, and a touch zone is not a body but chrome saying where the game's HUD will
  be, which is the camera frame's case. The practical half settles it either way: in
  `BODY_COLOR` the rings would share a colour with the body outlines and the control arrows,
  and a colour reading over that mixture measures nothing.
- **Picking that colour is a numeric test, not a visual one, and the first attempt failed
  it.** `findColor` matches when *every* channel is within tolerance, and the obvious azure
  `#4d9fff` is within 24 of the default rectangle fill `#4f8cff` on all three — it looked
  clearly different and would have counted every rectangle in the scene. The test to apply
  is "does this differ by more than the tolerance on at least one channel from every fixture
  *and* chrome colour", and the list is longer than the chrome one: both default fills, the
  nested and prefab fixture colours, and white as well.
- **Stroked rings, where the emitter marker and the control arrows are filled.** The
  opposite call, and right for the opposite reason: those are small marks that have to
  survive antialiasing to be seen and counted, where these are large and sit over the level
  being built — a filled disc would hide what the player is going to be standing on.
- **The export is one module-level helper plus one call.** The tilemap helper's route and
  for its reason: a pad is a dozen statements of circle geometry, and `create()` is meant to
  stay a list of the objects in the scene. Its name comes out of the module's identifier set
  immediately after `bodyFn`, by the rule the tilemap helper and `arcade body` follow, and
  every prefab factory body's seed set and `update()`'s carry it. The button array is
  emitted whole and inline — the physics body's call and the emitter config's — because five
  short objects only mean anything beside each other; it is not tabled, since `TILEMAPS`
  exists for thousands of numbers and this is twenty.
- **A bare `setInteractive()` gives a Shape no hit area at all, and this is the trap the
  whole export test exists to have caught.** With no arguments Phaser derives the hit area
  from the object's *texture*, and an `Arc` has none — so the button renders perfectly,
  reads perfectly, and can never be pressed. It has to be handed
  `new Phaser.Geom.Circle(radius, radius, radius)` and `Geom.Circle.Contains` explicitly;
  the centre is `(radius, radius)` because Phaser measures a hit area from
  `-displayOrigin`, which is the container hit area's offset rule arriving one object type
  over. Nothing about the emitted text or the `tsc --strict` pass could see this: only
  `export.spec.ts` actually pressing one did.
- **Three lines in that helper are load-bearing, and each one's absence is a bug visible
  only on a phone.** `addPointer(2)`, because Phaser tracks a single active pointer unless
  asked for more — without it a player cannot walk and jump at once, which reads as the jump
  button being broken rather than as an input budget. `setScrollFactor(0)`, the first this
  exporter has ever emitted, which is what makes these a HUD rather than three objects in
  the level. And `pointerout` and `pointerupoutside` beside `pointerup`, because a finger
  that slides off a button never fires `pointerup` *on that button*, so the direction would
  stay held for the rest of the game.
- **The emitted `update()` has two shapes, and the second one is a correctness fix rather
  than a widening.** An object with no buttons emits what it always emitted, character for
  character. An object *with* them has the keyboard guard moved out of the `if` and into
  each condition — `(cursors && cursors.left.isDown) || touch.left` — because on a phone
  `this.input.keyboard` is null, the key field is never assigned, and the old
  `if (cursors && object)` would have left the buttons doing nothing on precisely the device
  they exist for. The guard becomes `object && touch` instead: `create()` assigns the flags
  unconditionally where it only *may* assign the keys, so that is the one that can be relied
  on — and it is what narrows the exported `.ts`'s `| undefined` field for the reads below
  it.
- **The pad's up is not the platformer's jump.** A platformer reads `touch.jump` where it
  reads `cursors.up`, and the jump button sits in the *other* corner — which is what lets a
  thumb hold a direction and another thumb jump. Wiring the jump to the pad's up would have
  made `addPointer(2)` pointless.
- **No game-config key and no header note**, the fourth entry in the comment block above
  `arcadeConfig` where the audio, camera and keyboard refusals already are. `scene.input` is
  built for every Phaser game, and the extra pointers are asked for at runtime rather than
  declared — which is not only convenience: `input: { activePointers: n }` belongs to the
  whole game, and a module dropped into someone else's game can only speak for its own
  scene.
- **`constructorFor` gains no case, so every step of this feature is silent** — the
  renderer, the exporter, the inspector and the store alike. `behaviour.spec.ts` and
  `export.spec.ts` stand in for the compiler, as they do for physics, cameras and iteration
  20, and the emitted helper meeting `Phaser.Scene` and `GameObjects.Arc` under
  `tsc --strict` is what only the toolchain spec can catch — which is why the hostile
  project's driven node now asks for buttons, and why its two *unemittable* driven nodes ask
  for them too: `touchZonesOf` dropping a nested one is asserted rather than assumed.

## Audio

A scene can register sounds, and the export hands each one a named handle. Nothing here
ever makes a noise on its own.

- **Registering a sound is layout; when it plays is game logic.** This is the
  `scene.start` argument at its sharpest, because a sound is *nothing but* a thing that
  happens over time — so if the rule were going to break anywhere it would break here. It
  does not. `project.audio` holds the files and `scene.sounds` holds
  `{ audioId, loop, volume, autoplay }`, and what the exporter emits is
  `const jumpSound = this.sound.add('jump', { loop: false, volume: 1 })` and then stops.
  `jumpSound.play()` is the user's line to write, exactly as the collider is — and this is
  what Physics meant by emitting `mass` and `immovable` that nothing it generates reads.
- **`autoplay` is not the `emitting` field an emitter deliberately has not got.** That one
  was refused because `previewMotion` already answered the question and two fields over one
  number is how they come to disagree; nothing here answers it, because the editor never
  plays a sound. Nor is it `scene.start`: what makes *that* game logic is that the
  destination is a choice the editor cannot know, while scene start is not a choice at all
  — it is the one moment in a scene's life this exporter already emits a `create()` for.
  The inspector labels it "Play on scene start" rather than "Autoplay", because the second
  reads as the HTML `<audio autoplay>` attribute, which is a browser-policy idea a user
  would reasonably confuse with this one.
- **There is no `sound` node type, and the reason is bigger than the three obvious
  ones.** `emitNode` emits `setName` unconditionally, `modifiersFor` emits `.setAlpha` and
  `.setVisible` from fields a sound has not got, and `missingReason`'s catch-all says "no
  image chosen" — but those are each one branch. The real cost is that a sound would be the
  first *drawn* thing with no geometry, and "Measured bounds" and "Snapping" both rest on
  the invariant that everything in the tree has a box: `localRectOf`, `hitAreaFor`,
  `worldBoundsOf`, `publishMeasuredBounds`, `snapTargetsFor`, `containerBounds`, both
  handles and `PHYSICS_TYPES` would each need a case. The particles wrapper exists (see
  Particles) precisely because a bare `ParticleEmitter` broke that invariant, and the answer
  there was to *give it a box* rather than teach the consumers about a boxless node. A sound
  has no box you could give it. So it is scene state, beside `guides` and `physics`.
- **`loop` and `volume` are on the scene entry, not on the asset — the opposite call from
  `ImageAsset.sheet`, and worth knowing because a reader will want them together.** A frame
  grid is a property of the *bytes*: how that image is cut, which two sprites drawing it must
  not disagree about. A volume is a property of the *use* — one hit sound is a stinger in one
  scene and a background layer in another — and looping is never a fact about a file.
- **`soundsOf` is the only reader**, in the `guidesOf` / `frameGridOf` / `physicsOf` /
  `tileMapOf` / `prefabChildrenOf` family, and it takes the project because it answers a
  question the others do not: does this row name a sound that still exists. Everything else
  it finds is repaired — a bad volume is clamped, a missing boolean is false — and a
  dangling `audioId` is the one thing that costs the row, because `this.sound.add(undefined)`
  is not something Phaser can be asked for and there is no placeholder state for a sound to
  be. Dropping it there is what means **nothing downstream needs a guard**: `missingReason`
  gains no branch, and `collectAudio` cannot miss. It builds a fresh array per call, so
  `useEditorStore((s) => soundsOf(...))` is React error #185 — the `tileMapOf` trap, third
  time.
- **`SCHEMA_VERSION` bumped to 8, on the silent-data-loss half of the rule, and it is the
  first bump since v4 to turn on that half rather than on a crash.** `parseProject` names
  the project's fields one at a time, so a v7 build drops the whole `audio` table on open
  and re-saves without it. `scene.sounds` alone would *not* have bumped it — it rides in on
  `scenes`, verbatim, as guides and bodies do — and what makes that worse rather than
  harmless is precisely that it survives: a v7 re-save keeps a list of sounds pointing at
  bytes it has just thrown away. The table is what bumps this and the scene list is why the
  bump is not a judgement call. There is no crash half at all: no new `NodeType`, so a v7
  `createDisplayObject` has a case for everything in the file.
- **Import allowlists on the way in, where an image's allowlist is a consequence of
  re-encoding.** A canvas round-trip normalises every image to PNG or JPEG, which is what
  lets the exporter and the parser stop sniffing. Web Audio decodes and does not encode, so
  the only re-encode available is raw PCM into a WAV, which makes the file several times
  *larger*. `audio.ts` therefore refuses anything outside its five mime types, and
  `fileIO.ts`'s `AUDIO_DATA_URL` refuses the same set again on open — a **sibling** of
  `ASSET_DATA_URL`, never a loosening of it, because one pattern covering both would let an
  audio mime reach the `<img>` and the `ASSETS` literal.
- **The cap is 2 MB, half an image's, and it is the only lever there is.** An oversized
  image is scaled down; an oversized sound can only be refused. Audio is measured per
  second — a minute of ordinary music outweighs a whole scene's worth of sprites — and
  `autosave.ts`'s localStorage draft is about 5 MB for the entire project, so the cap is set
  against that quota rather than against images' 4 MB.
- **The import decodes before it accepts, and that decode is what a canvas round-trip is
  for an image**: proof the stored bytes are ones a browser can read, said while the user is
  still looking at the picker rather than in an exported game that plays nothing. It yields
  `duration` in passing, which is stored for `ImageAsset.width`/`height`'s reason — decoding
  is async and a panel row is not, so deriving it on demand would have every row read "—"
  for a moment on every open.
- **`this.sound.get(key) ?? this.sound.add(key, config)`, and the guard is not the
  `anims.exists` one even though it looks like it.** That one buys a clean console:
  `anims.create` on a key the manager already holds is refused with a warning. `sound.add`
  on a duplicate key is *accepted* and answers with a second sound object — so a scene that
  runs `create()` twice, which is the ordinary way a game returns to its menu, would end up
  with two copies of a looping theme playing over each other. Audible, not untidy. The `??`
  form was checked against Phaser 4's real types before being written, because `Scene.sound`
  is a union of three managers and a union call across generic signatures is exactly what
  TypeScript refuses; both `get` and `add` synthesise fine, and `export-toolchain.spec.ts`
  is what keeps that true.
- **`.play()` is its own statement and `autoplay` is not in the config literal — one
  decision with two independent reasons.** `BaseSound.play()` answers with a boolean rather
  than the sound, so it cannot join a constructor chain the way a Sprite's `.play` does; and
  `autoplay` is not a `SoundConfig` key, so an excess property on a fresh object literal
  would fail the exported `.ts` under `--strict` while the `.js` and the page both passed.
  `modifiersFor` gains no branch and says so, by the rule that function already invokes
  twice.
- **`this` is hardcoded in the emit rather than `ctx.receiver`.** `receiver` exists because
  *one* emitter runs in two places, in a Scene method and in a prefab factory; this one runs
  in one, because a sound belongs to a scene and a definition has no scene of its own.
  Writing `${ctx.receiver}` would read as though a factory could reach it, and the day one
  did, its sound would be added against a key nothing in `usedIn` had loaded.
- **Missing a preload is worse here than for an image, which is why `usedIn` grew a third
  set rather than the gate being widened.** A texture a scene never loaded draws a
  missing-texture square; `sound.add` on a key the cache does not hold **throws**, inside
  `create()`, before a single object has been added. The sound block sits in the prologue
  above the objects, so `export.spec.ts`'s existing colour assertions on the hostile project
  are already a check that the audio path did not throw — which is why this feature needed
  no runtime assertion about sound at all.
- **`buildSceneClass` now gates `preload()` on the emitted body rather than on a set
  size**, which is the smaller edit with two kinds of key and also the more correct one: a
  set can hold an id no table matched, and a size check would emit an empty `preload() {}`.
  That was already true of the images before there was a second way to get it wrong.
- **Sound handles are allocated out of `create()`'s identifier set before any object draws
  from it, and they are suffixed.** Both halves matter. Allocating first is the prefab
  factories' rule one level down — an object the user named "jump" must not take a binding a
  hand-written line is reaching for. Suffixing is what stops that precedence being a theft:
  the sound gets `jumpSound`, the object keeps `jump`, and neither is `jump2` with nothing
  saying which is which. The hostile project holds an object named "jump sound" for exactly
  that, the way it already holds one named "arcade body".
- **The key comes from the file name, and audio names are no more editable than image
  names are.** An audio key is the one identifier in the whole output whose audience is a
  person writing new code, which is a real argument for making it editable — and exactly the
  same argument applies to a texture key today. Both or neither; this is neither, and
  renaming belongs to an iteration whose subject is asset management. What the panel does
  instead is *show* the derived key ("plays as jump"), since `Jump SFX (final).wav` keys as
  `jumpSFXFinal` and nobody can guess that. `audioKeyOf` is exported from the exporter so
  the row and the output cannot disagree about it.
- **`collectAudio` walks no nodes and no prefab definitions**, and beside `collectAssets`
  and `collectAnimations` — which both descend, and where not descending was a real bug that
  exported a prefab full of sprites with no textures — that absence looks exactly like the
  same mistake. It is not: a sound is registered by a scene, so there is nowhere in a
  definition for one to hide. `countAudioUses` is the same shape for the same reason, and
  `mapProjectNodes` and `mapProjectSprites` are both untouched.
- **No `physicsNote` equivalent, and no game-config key.** `this.physics` is undefined
  unless the config asks for Arcade; `this.sound` never is — Phaser builds a sound manager
  for every game, and the No Audio manager accepts every call and plays nothing. So a module
  dropped into someone else's game needs no change at all, and `exportPhaser.ts` says so in
  a comment above `arcadeConfig`, where "no branch needed" and "forgot a branch" look
  identical.
- **The editor never plays a sound by itself, and audio is not on the ▶ toggle.**
  `hasMotionIn` is untouched and says so in a comment — the second refusal it now records,
  and the one a reader will most expect to be wrong, since a sound is obviously a thing that
  happens over time in a way a static body is not. But that toggle exists so a canvas moving
  by itself can be *stopped*, and a project full of sounds makes no noise there is anything
  to stop. Auditioning is a press on a row that starts and ends inside one gesture, so there
  is no new flag to argue about — and it means **`EditorScene.ts` is untouched by this whole
  feature**, which a reader will otherwise go looking for the sync case of.
- **One `HTMLAudioElement` for auditions, module-level.** Two would be two notions of what
  is playing — the eraser rule from the tile bar and the marker rule from the emitters,
  arriving a third time — and module-level rather than a ref so that closing the sheet or
  switching scenes mid-play cannot strand a sound with no control left on screen. Its
  accessible name is `Audition <name>`, never the bare file name, by the rule that already
  gives prefab buttons a `+ ` prefix and scene chips a `Switch to `.
- **The panel is in `SceneInspector`, with the gravity and the guides.** The prefab list
  went into the scene panel instead because a prefab is *placed*, over and over, so reaching
  it must not cost a deselect first; a sound is imported and tuned a handful of times in a
  project's life. It is a scene setting, and it sits where the scene's other settings are.
- **The suite's claims are on either side of the canvas, because there is no pixel to
  check.** `tests/helpers/wav.ts` synthesises fixtures for `png.ts`'s reason, and WAV is
  picked because it is the only audio format that can be built with no encoder at all — a
  44-byte RIFF header and then the samples, which is simpler than `png.ts`'s CRCs. Keep them
  short: every byte is base64'd into a project file, embedded again into an exported page,
  and decoded by a real browser. And the hostile project's sounds set `autoplay: false`
  deliberately — an autoplaying one would add an AudioContext-resume dependency to two
  toolchain tests for no coverage, since the emitted `.play()` is one statement whose text
  is what `export.spec.ts` asserts.

## Cameras

A scene says where the game looks: `scene.camera` holds a scroll, a zoom, whether
scrolling is held inside the scene, whether it rounds to whole pixels, and what it
follows. It is drawn on the canvas as a violet frame and exported as real
`this.cameras.main` calls, and the editor never once applies it.

- **Drawn, never applied — and this is Physics' "drawn, never run" one iteration on.**
  The editor's `cameras.main` is the *user's view* of the scene: pan, pinch, ⤢ Fit,
  `cameraTouched`. Applying the document's scroll and zoom to it would mean the user
  could not look anywhere else without editing the document, and that panning would
  rewrite it — which is exactly why a physics step is not run here either. So
  `syncFromStore`'s `cameras.main.setBackgroundColor(scene.backgroundColor)` stays the
  **only** thing the document has ever written to the editor's camera, and this feature
  deliberately does not become the second. It is also what keeps the suite's
  `sceneToScreen` honest: that helper derives the editor's zoom from `zoomToFit`, and a
  document camera that moved the view would have made every drawn assertion in every spec
  wrong by a factor nobody would have gone looking for.
- **The camera has no rectangle of its own, and both halves of that follow from one
  rule.** Its *viewport* is the game canvas, which is the scene's own width and height —
  the sprite-has-no-width argument, and the reason `usedIn`'s exported page config already
  reads those two numbers. Its *bounds* are a boolean rather than four numbers, for the
  reason `ScenePhysics` has no bounds either: the scene rectangle already says how big the
  scene is, and a second rectangle saying it again is two fields free to disagree. The
  payoff is in the renderer, which draws nothing for the bounds at all — `sceneFrame`
  already outlines exactly that box.
- **`cameraOf` is the only reader**, in the `guidesOf` / `scenePhysicsOf` / `soundsOf` /
  `frameGridOf` / `tileMapOf` / `prefabChildrenOf` family, and it splits repair from
  dropping the way `soundsOf` does: a nonsensical zoom has a sensible value to fall back
  to, and a `followId` naming nothing has none. A zoom of 0 is *repaired* rather than
  passed on, because Phaser clamps it to 0.001 behind your back — a camera showing a
  thousand scenes at once with nothing saying why — and a `followLerp` of 0 likewise,
  since Phaser reads that as "do not track on this axis", which is a camera that says it
  follows something and then does not. It builds a fresh object per call, so
  `useEditorStore((s) => cameraOf(...))` is React error #185: the `tileMapOf` trap, fourth
  time.
- **Only a top-level node may be followed, and it is the physics rule arriving twice.** A
  camera follow reads its target's `x`/`y` as world coordinates every frame, which is the
  same thing an Arcade body does and the same reason a node inside a container cannot have
  one — a prefab definition's children are container children by the same mechanism.
  Enforced the same way too, **strip on read, refuse on write**: `cameraOf` searches
  `scene.children` only, and `setCamera` ignores an id that is not in that array. The two
  look redundant and are not — the second is what stops the UI offering something that
  would do nothing, and the first is what lets `moveNode`, `groupSelection` and the tree's
  drag-to-nest each need no guard. A target found deeper reads as *absent* rather than
  being deleted, so a node dragged into a group and back out keeps the follow.
- **A dangling `followId` is dropped on read, and that is what means nothing prunes it.**
  `deleteNode`, `deleteSelection`, `undo` and the scene switcher all leave it alone, as no
  action prunes a dangling `audioId`. `duplicateScene` is the one place that has to think:
  a copied camera would otherwise point into the scene it was copied *from*, which
  `cameraOf` would then drop — a follow silently lost on a duplicate. The two child lists
  are the same list in the same order, so the target's index in the original gives its new
  id, and no id map is built.
- **`SCHEMA_VERSION` did not bump, and this is the guides case rather than any of the five
  crash cases.** A camera is not a node type: it is an optional field on a scene, and
  `scenes` is the one part of a file `parseProject` passes through verbatim. A v8 build has
  a `createDisplayObject` case for every type in the file, reads `scene.camera` nowhere,
  draws identically, and carries it back out on a re-save. **This stays contingent on
  `parseProject` not reconstructing scenes field by field** — if it ever starts to, an old
  build silently loses every camera on every save. `camera.spec.ts` asserts the version in
  the saved artefact so a future bump is a deliberate act.
- **`cameraViewOf` copies Phaser's arithmetic and has to stay copied**, which is
  `frameLayoutOf`'s rule one module over: this is what the editor draws, and a formula of
  our own would offer the user a shot their exported game does not open on. Two parts of
  it are wrong if guessed. The view is centred on the *unzoomed* viewport's middle
  (`midPoint = scroll + size / 2`), so zooming closes in on the middle of the shot rather
  than on its top-left corner — which is why a camera at scroll (0, 0) and zoom 2 is
  centred in the scene rather than parked in its corner. And the bounds clamp moves the
  *scroll*, it does not crop the view, so a shot pushed past the edge comes back whole.
- **The frame is drawn only while the camera is not the default.** At the default it lands
  exactly on `sceneFrame` and says the same thing twice, and the grid already settles that
  question — it stops drawing below `MIN_GRID_PIXELS` while the snapping carries on. It
  also means every project that predates this feature draws byte for byte what it drew
  before, which is what let the whole existing suite keep its colour assertions.
- **`drawCamera` is in `update()`, with `drawGrid`, `syncPlacedGuides` and `drawBodies`**,
  and for their reason: its stroke is a screen width divided by the camera zoom, and a
  pinch changes the zoom without touching the store. Signature-gated like the grid, since
  on almost every frame none of it has moved.
- **Depth 997: above every object, below the paint grid and the placed guides at 998.**
  Above, because a camera frame hidden under a tilemap is a camera frame that says nothing
  — the argument that puts the guides over the objects. Below, because unlike a guide this
  is furniture nobody grabs: it is not interactive at all, so it must never cover
  something that is.
- **There is no camera gesture, and the reason is mechanical rather than a matter of
  taste.** A guide is grabbable because its band is 24 screen pixels wide; a camera frame's
  *inside* is the whole scene, so a hit area over it would steal every press on the canvas.
  Grabbing one by an edge band needs a custom hit callback, and it is a loosening for
  later rather than something missing here.
- **The export is a prologue and one epilogue, and the split is the interesting part.**
  Scroll, zoom, rounding and bounds go in `create()`'s prologue beside the background
  colour, which is the same camera. `startFollow` cannot: it names a binding the object
  list has not made yet, so it is **the first thing this exporter has ever emitted after
  the objects**. `emitNode` already returns the identifier it bound, so the loop records
  them and the epilogue looks one up; a follow target that emitted no object gets a
  comment saying so, which is `missingReason`'s treatment.
- **The block is emitted whole, defaults included, and only when the camera is not the
  default** — the physics body's call and the emitter config's, deliberately unlike
  `modifiersFor`. These dials interact: a zoom moves the shot as well as tightening it, and
  bounds only bite once the scroll would leave the scene, so a reader tuning one wants the
  others beside it. The gate is the rule the asset table, the tilemap helper and the prefab
  factories all follow.
- **No game-config key and no header note, unlike Arcade.** `this.cameras.main` is built by
  the Camera Manager when a scene boots, in every Phaser game there has ever been, so a
  module dropped into someone else's game needs no change at all. Said in a comment beside
  `arcadeConfig`, where the audio decision is already recorded and where "no branch needed"
  and "forgot a branch" look identical.
- **`constructorFor` gains no case, so every step of this feature is silent** — the
  renderer, the exporter, the inspector and the store alike. `camera.spec.ts` and
  `export.spec.ts` are what stand in for the compiler, exactly as they are for physics.
- **`findColorBox` is new, and it is a better instrument than a centroid for anything
  outlined.** A two-pixel stroke lands on a different sub-pixel phase on each of its four
  edges, so one edge matches at full strength where the opposite one splits across two
  half-strength pixels — which dragged the frame's centroid 14px sideways on the mobile
  project for a reason that had nothing to do with where it was. An extent is immune to
  that, since a one-pixel edge and a two-pixel edge start in the same place, and it is the
  only reading that can say how *big* something is drawn — which for a camera frame is half
  of what it means.
- **The panel is in `SceneInspector`, with the gravity and the guides**, and always shown
  rather than gated the way the gravity is: every scene has a camera whether or not the
  file says so, and the frame is the only place a user can see what the numbers mean. Every
  label carries "Camera", because Name, Width, Height and both Gravity fields are on that
  same panel and the suite matches a label exactly — the "Animation name, not Name" rule
  arriving by a third route.
- **The editor never looks through the camera, and there is no button that does.** It was
  the obvious convenience and it is the one thing this feature refuses: moving the editor's
  view is what "drawn, never applied" rules out, and a "set the camera from my view" button
  is the same coupling written backwards.

### Doing something at a moment: camera effects

Iteration 31 closes the hole iteration 18 named and iteration 28 costed. A rule may now
`shake`, `flash`, `fade`, `pan` and `zoomTo` the scene's camera. The argument is not new —
it is iteration 18's refusal (*"every one is a thing the camera does over time, which is
game logic and the `scene.start` argument"*) arriving at the door iteration 28 built, and
the interest is entirely in what it cost, which was almost nothing.

- **The line iteration 28 drew does not move, and that is the first thing to check.** An
  effect is one more verb in a list run at a moment Phaser already delivers, so `update()`
  **gains nothing** — which is exactly the test that paragraph set for itself: the first
  thing polled is where the line falls, and nothing here is polled.
- **Five kinds, not one `cameraEffect` with an `effect` field.** The union is already
  discriminated on `kind` at the reader and at the emitter, so a second discriminant inside
  one case would be a switch inside a switch for nothing. Fade carries a `fadeIn` boolean
  rather than splitting in two, which is `setVisible`'s show/hide call: one verb, one
  question.
- **They are the first actions besides `restartScene` that name nothing the document
  holds**, and every structural saving here follows from that one fact. No `nodeId`, no
  `soundId`, no `sceneId`, no `variableId` — so `ruleNames`, `ruleUsesVariable` and the
  store's `remapActionRefs`, all of which key off `'nodeId' in action` and its siblings,
  inherit the right answer with **no edit at all**. On this file's checklists that reads
  exactly like three forgotten steps, which is why it says so here.
- **A consequence worth stating rather than discovering: a rule whose only action is an
  effect appears in the scene's own list and on no object's panel.** `NodeRulesSection` is
  built on `rulesNaming`, which is `ruleNames` filtered — and a camera effect is about no
  object, so there is no object's panel for it to be on.
- **Nothing here can ever cost the whole rule**, which is the first time that needs no
  argument. `setVar` and a dangling variable cost the rule because *a variable is the one
  thing a rule names that another rule reads*; an effect reaches nothing at all and every
  field has a value to fall back to. So the whole block is **repair, never drop** —
  `cameraOf`'s policy rather than `soundsOf`'s split, and `rulesOf`'s "a repair may narrow
  what the document says, it may never widen it" is satisfied trivially, because there is
  no gate here to open.
- **Three of those repairs are silent-fallback traps this file has already paid for.** A
  zoom of 0 becomes 1, because Phaser clamps it to 0.001 behind your back — `cameraOf`'s
  own sentence, one module over. An unknown ease becomes `Linear`, because
  `GetEaseFunction` resolves one to `Power0` and says nothing — `TWEEN_EASES`' whole reason
  for existing. And a duration below `MIN_TIMER_DELAY` becomes the effect's own default,
  because an effect given 0ms completes on the frame it starts and is one nobody sees,
  which is indistinguishable from the action having done nothing.
- **`intensity` is a fraction of the viewport, not a pixel count**, which is Phaser's unit
  and the one number here a reader would guess wrong. The panel says so with a 0.01 step
  and a ceiling of 1 rather than with a sentence there is no room for.
- **`pan`'s two numbers are a *centre*, and the panel's labels say so.** `Camera.pan` moves
  the camera's midPoint where `SceneCamera.scrollX` is its top-left — the distinction
  `cameraViewOf` is built on, arriving on a control. A field reading "Camera X" would be
  wrong by half a viewport with nothing saying so, and *that is also the exact label of the
  scroll field a few sections up the same panel*, which `EditorPage.setCamera` drives. Two
  independent reasons for the same word.
- **`TWEEN_EASES` is reused and deliberately *not* renamed**, where `textColor` became
  `hexOr` in the same change. The difference is the rule: a function whose *answer* widened
  gets renamed (`clampFrame` → `resolveFrame`), and this constant's meaning did not change
  — only who reads it. `Camera.pan` and `zoomTo` take `ease?: string | Function`, so the
  allowlist is handed over unchanged.
- **`EditorScene.ts` is untouched by this whole feature**, for the fourth time after Audio,
  Rules and iteration 29 — and this is the strongest version of it, because two refusals
  meet in one place. The canvas runs no rule. *And* the editor's `cameras.main` is the
  **user's own view**, so a `pan` or a `zoomTo` run here would move where the user is
  looking, which is precisely what "drawn, never applied" rules out, and a `fade` would
  black out the canvas being edited. `hasMotionIn` records its **eighth** refusal, the one
  a reader will expect to be wrong hardest of all.
- **And nothing new is drawn for one.** The violet frame is the shot the scene *opens* on;
  an effect is what happens afterwards, and a second frame showing where a pan ends would
  be a camera in motion, which is the thing this canvas does not show.
- **The emit is five one-line cases and no machinery whatsoever.** No gate, no table, no
  `EmitContext` field, no `prepare` flag, no pre-pass, and — the one that matters — **no new
  emitted helper**, because the identifier allocation warns that a new one must go last or
  it shifts names the suite asserts by name. Nothing moved. A project with no camera action
  emits byte for byte what it emitted before, because the case simply never fires.
- **`this` is hardcoded rather than `ctx.receiver`**, `buildSoundLines`' reason: a rule only
  ever runs in a Scene's `create()`, and `${ctx.receiver}` would read as though a prefab
  factory could reach one.
- **The arguments are emitted whole, defaults included**, and here that is not even a
  choice the way it was for the emitter config and the physics body: these are positional
  arguments with no chain to leave one out of.
- **`rgbArgs` is the one new helper, and it is four lines beside `hexLiteral`.** Every
  colour in this document is a hex string and `flash`/`fade` are the one pair of calls that
  wants three channel numbers, so the split lives in one place rather than at two call
  sites.
- **`constructorFor` gains no case, so every step of this feature is silent except one** —
  and that one is real: `ruleActionLines`' switch is **exhaustive with no `default`**, so
  the five union members are a compile error there until they are written. It is the only
  thing standing between a new action kind and an exporter quietly falling behind.
- **`SCHEMA_VERSION` did not bump — the guides case, ninth time.** No new `NodeType`, and
  the actions ride in on `scenes`, which `parseProject` passes through verbatim. One thing
  worth stating rather than discovering, because it is the closest this gets to the
  silent-data-loss half: a v14 build's `ruleActionsOf` drops an unknown kind through its
  `default: break`, so a rule whose *only* action is an effect fails the empty-`do` check
  and vanishes from **that build's emit**. The document still holds it, a re-save loses
  nothing, and the rule is back the moment a current build opens the file. That is an old
  build exporting less, not a file breaking. `rules.spec.ts` asserts the 14.
- **The suite splits exactly where this feature's own argument says it must.**
  `rules.spec.ts` carries the document, the panel, the emitted text and the one claim only
  the near side can make — that a pan and a zoom move neither the editor's own zoom nor a
  drawn object, and that the violet frame stays absent. That is the assertion that fails the
  day anybody wires an effect into `EditorScene`. `export.spec.ts` carries the positive
  runtime claim, because the editor runs none of it.
- **A fade is the runtime instrument, and a flash is not.** A fade is monotonic and it
  *stays*, where a flash is a race with the poll — "what frame is up at any instant", one
  effect over. The zoom claim is an **extent**, because what is asserted is how big
  something is drawn, and it is the claim a fade cannot make: an effect that painted over
  the picture rather than acting on the camera would darken the canvas and never widen
  anything on it.
- **That zoom test needs a long ramp, and the reason is a trap rather than padding.**
  `runExportedPage` already waits for the canvas and a frame, so a 200ms zoom is **over**
  before the first screenshot comes back — both readings are of the finished state, the
  ratio is 1.0, and it looks exactly like an effect that never ran. Four seconds is what
  makes "before" mean before.
- **The hostile project's effects are deliberately at rest**, which is `NO_MOTION`'s rule
  one action over: they hang off the untriggered `tap` rule nothing in the suite presses,
  so `export.spec.ts`' colour assertions never race a fade that is correct behaviour and is
  not what those assertions are about. All five carry a non-default value in every field,
  because their whole job there is the emitted calls' *shape* meeting
  `Phaser.Cameras.Scene2D.Camera` under `tsc --strict` — and the fade is a `fadeIn`, since
  `fade` is the branch every other fixture already emits.
- **What stays refused.** **No `rotateTo`** — a rotating camera turns everything on screen,
  the HUD the touch buttons draw included, and it is the one effect whose result cannot be
  read off the document at all. **No `onComplete` and nothing that waits** — "fade out,
  *then* change scene" is a sequence, which is `tweens.chain`'s refusal and iteration 28's
  line verbatim; a rule fires at a moment and does not wait for an outcome. **No `force`
  flag** — it says what to do about an effect already in flight, which is again a question
  about a sequence. **Nothing reads whether an effect is running, and there is no
  `resetFX`** — that is a rule about rules.

### Watching a number: the `varChange` trigger

Iteration 33 closes the hole iteration 28 named as being on the far side of its own line,
and it closes it by finding that the line was never in the way. A rule could count a score,
a label could show it, and **nothing in a project could act on it reaching a number** — so
"when the score reaches ten, go to the win scene" was two rows this vocabulary already had
with no moment to hang them on. `RuleTrigger` gains one member and that is the whole format
change.

- **Iteration 28's own example was wrong, and reading the prediction beside the work is
  half of what a reader needs.** That paragraph said a sixth trigger *"of the form 'while…'
  or 'when the score passes ten' is the first that has to be watched for every frame, which
  is the first that needs an emitted `update()`."* The first half is still true and still
  refused. The second half is not: Phaser's `DataManager` emits `changedata-<key>` of its
  own accord, and **iteration 30's labels have been subscribing to that exact moment ever
  since**. So this is a moment Phaser already delivers — the same one, one consumer over —
  and `update()` **gains nothing**. The line does not move; what moved is one example that
  turned out to be on the near side of it all along. That is the Web fonts lesson for the
  second time: the prediction was made from what a feature *sounded* like rather than from
  the loader, and "Phaser 4, not 3" says to read the source instead.
- **The trigger is the moment; the threshold is the condition that already existed.** "When
  the score reaches ten" is this trigger plus a `RuleCondition` of `score >= 10` — a gate
  read **once, at a moment**, exactly as every other rule's is. That split is not a
  convenience, it is the whole of what keeps the feature on the near side of the line: a
  threshold that had its own trigger kind would be a thing watched for, and a thing watched
  for is polled.
- **So it fires on every change at or above ten, not on the *crossing*.** A crossing needs
  the previous value, which is the document holding state about its own past — a program
  rather than a list. The panel says so in a sentence rather than the reader pretending
  otherwise, which is the tween-versus-dynamic-body call and the `setText`-versus-label one:
  a combination explained beats a combination silently refused.
- **Three facts about `DataManager` shape the emit, and all three were read out of
  `src/data/DataManager.js` rather than remembered.** `changedata-<key>` fires only for a
  key that **already exists** — a first write emits `setdata-<key>` alone — which is why the
  variable helper setting every key in `create()`'s prologue means no rule ever fires at the
  boot, and why `sceneStart` is still the trigger for acting then. A write of the value
  already there **still emits**: there is no equality check in `setValue` at all, so
  `setVar score 0` on a score of 0 fires this. And the emit is **synchronous, inside
  `set`** — which is the next entry.
- **A rule that writes the variable it watches would re-enter its own handler with no
  bottom, and the guard is one flag in the emitted helper.** That is a stack overflow in the
  *player's* game on the first change, so this is `MIN_TIMER_DELAY`'s job one trigger over:
  the whole protection against the one thing this vocabulary can run away with. Per listener
  rather than one shared flag, which is what makes a cycle of **any length** terminate — A
  writes B, B writes A, and A's handler finds its own flag still set and returns — while two
  rules legitimately chaining are untouched.
- **The guard is in the helper and not in `rulesOf`, and that asymmetry is the point.**
  Refusing a self-writing rule would cost the rule, and `addVar` on the watched variable is
  something people write on purpose — a counter that clamps itself. The guard makes it
  terminate; it does not make it unsayable. A reader refusal would also be useless against
  the two-rule cycle, which no single rule is wrong about.
- **A dangling trigger variable costs the whole rule**, which is `keyDown`'s treatment and
  not a `setText`'s: a trigger is a moment and there is exactly one, so a trigger naming
  nothing leaves the rest with nothing to attach to — where an action naming nothing is one
  line of a list the rest of which still means something.
- **`ruleUsesVariable` is the one reference-walking function this could not inherit for
  free**, where the camera effects inherited all three. It keys off `'variableId' in action`,
  which cannot see a trigger — and `removeVariable` filters on it, so without the new first
  line deleting a variable would leave a rule whose *moment* names nothing and `rulesOf`
  would drop it on the next read with nothing having said so. `removeAsset`'s rule: the
  document may never hold a dangling reference by any action in the editor.
- **`ruleNames`, `remapTriggerNodes` and `migrateRuleToKind` need nothing**, and each says so
  where it stands, because on those lists "no edit needed" and "forgot the edit" read
  identically. `ruleNames`: the trigger names no object, so such a rule shows in the scene's
  own list and on no object's panel — the camera effects' consequence arriving on a trigger.
  `remapTriggerNodes`: a variable is *project*-level, so a duplicated scene shares it and
  there is nothing to remap — which is exactly why the camera's `followId` did need the
  treatment. `migrateRuleToKind`: a trigger watches for a change and never reads the value,
  so there is nothing there to be in the wrong kind.
- **`migrateRuleToKind`'s guard had to stop being `ruleUsesVariable`, though**, and that is
  the one edit a reader would not predict. It early-returns the rule *by identity* when
  nothing about it mentions the variable, and `setVariableKind` reads that identity back to
  decide whether a scene changed at all — so widening `ruleUsesVariable` would have had a
  kind switch rebuild rules it does not touch, and push an undo step for a scene nothing
  happened in.
- **The emit is a fifteenth module helper and one call.** `buildOnVarHelper` is
  `buildBindLabelHelper` with a guard: the same `changedata-<key>` subscription, the same
  no-argument handler (`EventEmitter#on`'s second parameter is the bare `Function`, so a
  named parameter is an implicit `any` the exported `.ts` refuses), and the same SHUTDOWN
  unsubscribe — which matters **more** here than for a label, because `restartScene` is one
  of this vocabulary's own actions and every restart would otherwise leave another listener
  behind holding objects that are gone. `this` is hardcoded rather than `ctx.receiver`,
  `buildSoundLines`' reason.
- **Its name is allocated last of all, after `bindLabelFn`**, by the rule the tenth to
  fourteenth already state and for its reason rather than for tidiness: `toIdentifier`
  suffixes a clash, so drawing a new name earlier moves the suffix some *earlier* helper was
  given, and four of those are asserted by name in the suite. Gated on `rules.vars` beside
  `keys`, `taps` and `matterHits`, so a project with no such rule emits byte for byte what
  it emitted before.
- **The picker withholds the option rather than offering it and falling back.** With no
  variable declared, `defaultTrigger` would have to answer `sceneStart` — and an option that
  leaves the picker where it was reads as a broken control, which is this file's
  most-repeated lesson. The Variables panel's own empty state is what says where to go,
  exactly as it already does for a condition.
- **`SCHEMA_VERSION` did not bump — the guides case, tenth time.** No new `NodeType`, and
  the trigger rides in on `scenes`, which `parseProject` passes through verbatim. One edge
  worth stating rather than discovering, as iteration 31 did: a v14 build's `ruleTriggerOf`
  answers null for an unknown kind, so the **whole rule** is absent from that build's panel
  and emit — but the document still holds it, a re-save loses nothing, and the rule is back
  the moment a current build opens the file. An old build doing less, not a file breaking.
- **`EditorScene.ts` is untouched for the sixth time**, after Audio, Rules, iteration 29 and
  iteration 31, and `hasMotionIn` records its **tenth** refusal — the hardest one yet to
  expect false, because this is the first trigger that fires without anybody touching
  anything. But that toggle exists so a canvas moving *by itself* can be stopped, and this
  canvas fires no rule at all.
- **The suite splits where the feature's own argument says it must.** `rules.spec.ts` carries
  the document, the panel, the emitted text and the one claim only the near side can make —
  nothing is drawn and nothing moves. `export.spec.ts` carries both positive claims, because
  the editor runs none of it: a caption that appears **late**, after a looping timer has
  moved a number past a gate, which is the one thing a set-once emit cannot fake; and the
  guard, which is the only claim in the suite whose two versions differ by a single `if` that
  both `tsc` and Vite accept. That second test was **run with the guard removed** to check it
  fails, because a guard test that has never failed is a guard test that asserts nothing.
- **What stays refused.** **No "while" trigger** — the half of iteration 28's example that
  was right: a condition watched continuously is the first thing that has to be polled, which
  is the first that needs an emitted `update()`, which is still exactly where the line falls.
  **No crossing detection** — see above; it needs the previous value. **No trigger on a live
  object property** — `x` on a tilemap, `alpha` on a particles wrapper and `width` on a sprite
  are three different questions, and none of them is announced by anything; that is
  `RuleCondition`'s own refusal arriving on a trigger. And **nothing about *which* variable
  changed reaches the body** — the handler takes no arguments, for the typing reason above and
  because a rule already names everything it acts on.



### Making one: the `spawn` action

Iteration 34 gives `destroy` its inverse. Iteration 28 let the document say what *happens*,
and every iteration since has widened the list of verbs — a caption, a live label, five
camera effects, a trigger that watches a number — while that list carried a `destroy` from
the day it was written and never once had the other half. So a project could take a coin off
the screen and could never put one there: every object a game would ever hold had to be
placed by hand, in the editor, before it started. **The document could describe a level. It
could not describe a wave.** And the thing it needed had been sitting in the export since
iteration 12: `function createCoin(scene, x, y)`, one factory per prefab, called once per
placement and never again. This calls it a second time.

- **The line iteration 28 drew does not move, and that is the first thing to check.** A spawn
  is one more verb in a list run at a moment Phaser already delivers, so `update()` **gains
  nothing** and there is no new trigger, no new table and no new emitted helper. The whole
  format change is one member of `RuleAction`.
- **The result is discarded, and that is what keeps the list a list.** The emit is
  `createCoin(this, 320, 240);` — a statement, never a binding. Binding it would be the first
  value in this vocabulary that another action could read, which is precisely iteration 28's
  second half: *a rule's actions are a list, never a program.* `rules.spec.ts` asserts the
  absence of the binding rather than only the presence of the call.
- **A spawn names a prefab, never a node.** A node is one object that already exists; a prefab
  is the one thing in this document that exists *precisely to be built more than once*, which
  is what `buildFactories` is. Cloning an arbitrary node at runtime would be a second answer to
  what a prefab is, and Phaser has no call for it. It is also what makes the action cheap
  everywhere else: a prefab is **project-level**, so `remapActionRefs` has nothing to remap in
  a duplicated scene — `varChange`'s `remapTriggerNodes` sentence verbatim, and exactly why the
  camera's `followId` *did* need the treatment.
- **A dangling prefab costs the action; it is `destroy`'s split rather than `setVar`'s.** The
  reader's own test, said back to it: *a variable is the one thing a rule names that another
  rule reads*, so dropping a `setVar` leaves every condition in the project testing a number
  nothing writes — where a prefab reaches nothing outside the action that names it, so dropping
  one strictly narrows. If it was the rule's only action the empty-`do` check takes the rule,
  which is a lone `destroy` of a missing node's treatment already. `hostile.ts` carries **both**
  cases, `rule-x15` and `rule-x16`, because one of them alone cannot tell the two apart.
- **`x`/`y` are repaired, never dropped**, through the existing `finiteOr` — `cameraPan`'s own
  two coordinates to the character, and for the reason the camera effects' whole block is
  repair-only: there is no gate here to open, so *a repair may narrow what the document says
  and may never widen it* is satisfied trivially.
- **`prefabChildrenOf` is deliberately not consulted by the reader.** A definition made only of
  instances resolves to nothing and `buildFactories` still emits an empty Container for it, so
  a `length` check here would have the reader and the exporter disagree about whether the
  action exists at all. An empty spawn is `detachInstance`'s "an empty group, which is honest
  rather than a failure".
- **`ruleNames` and `ruleUsesVariable` needed nothing, and the consequence is worth stating
  rather than discovering:** a rule whose only action is a spawn appears in the scene's own list
  and on **no object's panel**, because it is about no object. That is the camera effects'
  consequence arriving on an action that *does* name something — just not something a scene
  holds.

**The exporter is the load-bearing half, and it is the one place this is not a one-liner.**

- **A prefab that is only spawned is placed nowhere**, so before this it got **no factory at
  all** — which is not a wrong picture but a `ReferenceError` in the runnable page and a
  *compile error* in the exported `.ts` — and none of its images were preloaded. Two passes
  close it, split exactly the way this file already splits `collectAssets` from `usedIn`: the
  first decides what a factory is *called* across the file, the second what *one scene* loads.
  `prefabsNamedByRules` is `animationsNamedByRules`' sibling, the established shape for "a rule
  names something no node walk can reach".
- **`collectPrefabs`' rule pass runs after the whole node walk, never interleaved with it**,
  and that ordering is the sharp thing here rather than a tidiness. Factory names come out of
  `moduleNames` *before* the fifteen helper names and `toIdentifier` suffixes a clash, so a name
  drawn earlier moves the suffix some *later* helper was given — and four of those are asserted
  by name in the suite. Running last is what keeps a project that predates spawning exporting
  byte for byte what it exported before. `export.spec.ts` asserts the two factories' **order**
  for that reason, so the claim is pinned rather than trusted.
- **`emittedNodes` is the one gate, so it is the one edit.** It gained a `project` and a
  trailing pass over `prefabsNamedByRules`, and all six of its callers — `collectAssets`,
  `collectFonts`, `collectAnimations`, `usedIn`, `collectTilemaps` and `collectLabels` —
  inherit a spawned definition's contents with **no edit of their own**. Said out loud in the
  code, because on that list "already covered" and "forgotten" read identically. (Contrast
  `animationsNamedByRules`, which needs a pass in *two* collectors precisely because a clip is
  not a list of nodes.)
- **`collectLabels` was the exception, and it is the silent trap the file half-predicted.**
  Five of those six already took a `project`; that one did not. Its own doc comment warns that
  *"a gate that missed one would emit the call and not the function it calls"* — and a
  spawned-but-never-placed prefab holding a **labelled text child** is exactly that: the factory
  emits `bindLabel(...)` while `labels.bind` is still false, so the helper is never declared.
  The hostile project's `prefab-2` carries one for no other reason.
- **`buildFactories` and `emittedNodes` now read a definition through `withoutInstances`, and
  that is a real bug this feature would otherwise have shipped.** The *renderer* has always
  reached a definition through `prefabChildrenOf` and so has always had the cycle argument;
  the exporter never called either, and was survivable only by accident, because its prefab
  table held **placed** definitions alone. Widening that table means a nested instance can now
  resolve — so prefab A's definition holding an instance of B emits a factory that calls B's,
  and a mutual pair emits two functions that call each other: unbounded recursion in the
  *player's* game, from a file the editor cannot write but a hand edit can. The fix costs
  nothing, because `withoutInstances` hands the array back by identity when there is nothing to
  strip. The lesson is the general one: *`prefabChildrenOf`'s "nothing downstream needs a
  termination argument" only holds for the things that actually go through it.*
- **No new module helper, no new `Emission.rules` flag, no new gate in either generator, no
  `prepare` pre-pass and no `EmitContext` field.** The factory is already module-level and
  already gated on `ctx.prefabs.size > 0`, which the rule pass now also satisfies — so nothing
  was added to `buildFactories`' or `buildCreateBody`'s seeded identifier sets either, because
  no sixteenth name is drawn and nothing above it moves. `this` is hardcoded rather than
  `ctx.receiver`, `buildSoundLines`' reason: a rule only ever runs in a Scene's `create()`.
- **`ruleActionLines`' switch has no `default`, so this is the one non-silent step** in the
  whole feature — a compile error until the case is written. Everything else here is silent,
  as the whole of physics and cameras were.

**The canvas draws the place, and this is the first iteration since 30 to touch
`EditorScene.ts`.**

- **A spawn is the first thing a rule says that has a *where*, and a where is the one thing
  this canvas has always drawn** — the camera frame, the touch rings, the tween ghost. Without
  a mark the two coordinates are two numbers authored blind, which is the failure this file
  warns about more than any other. It is *drawn, never run*: the camera's "drawn, never
  applied" and the body outline's "drawn, never run" for the fourth time.
- **`rulePointsOf` is a filter over `rulesOf`, never a second read of `scene.rules`** —
  `rulesNaming`'s rule and `touchZonesOf`-on-`controlsOf`'s reason, so a spawn the reader
  dropped cannot come back to life on the canvas. A fresh array per call, so
  `useEditorStore((s) => spawnPointsOf(...))` is React error #185 — the `tileMapOf` trap,
  twelfth time. It resolves the prefab's *name* there, so the renderer never touches
  `project.prefabs`.
- **The data comes from the sync and the drawing from `update()`, which is the `tweenGhosts`
  pattern and deliberately not `drawTouchZones`'.** That one calls its reader every frame;
  `rulePointsOf` goes through `rulesOf`, which builds a child map and calls `collidersOf`,
  `soundsOf` and `scenePhysicsOf`. A spawn point changes only when the document does, so
  `syncFromStore` fills the array and `update()` has only the zoom to react to —
  signature-gated like every drawer beside it, because the stroke and the radius are *screen*
  widths divided by the camera zoom and a pinch is not a store change.
- **A ring and a cross, screen-constant, with the prefab's name under it.** Screen-constant is
  the rotate knob's rule and the opposite of the touch rings': those are sized from the scene
  because a thumb has a real size, and this marks a **place**, which has none. Stroked rather
  than filled, the touch rings' and the tween ghost's call — it sits over the layout the thing
  will land on. The cross is what makes the exact point readable, since a ring alone states a
  region. A *ghost of the prefab* was the other shape and is structurally unavailable: a
  definition's children are drawn nowhere until an instance places them, so there is no
  measured box to copy — `containerBounds` is keyed by display key and a definition has none.
- **`SPAWN_COLOR = 0x00c2a0`, picked by arithmetic and not by eye**, which is what
  `TOUCH_COLOR` and `TWEEN_COLOR` both record having nearly got wrong. Against every colour any
  spec asks `findColor` for **and** every chrome colour in the file, its worst channel margin is
  **61** — nearest the mint `#00ff6a`, then the cyan selection outline at 95 on blue — against a
  tolerance of 24. Re-run the check when a fixture colour is added.
- **Depth 997.7, above the touch rings rather than below them**, and that was a correction: the
  touch glyphs at 997.6 are *filled* and sized in **scene** units against the button radius, so
  on a platformer they are large opaque marks that a screen-constant ring would vanish under.
  Still below the paint grid and the placed guides at 998, the drag guides at 999 and the
  selection outline at 1000, so this stays what the camera frame is — furniture nobody grabs,
  never covering something that is.
- **Its label pool is its own**, like `touchLabels` and unlike the guide and angle drawers,
  which share `overlayLabels` through `usedLabels` — a hide loop scoped to one of a shared pool
  blanks the other's. Reset in `create()` beside the touch pool and for the reason that comment
  already gives: an empty pool *and* an empty signature, or the first frame after a restart
  decides nothing changed and skips a redraw onto a `Graphics` that is no longer the one it drew
  on.
- **Nothing is interactive**, so there is no gesture, no hit area and no two-step-touch
  question. A spawn point is moved by its two fields, exactly as the camera's frame is.
- **`hasMotionIn` records its eleventh refusal**, and it is the one a reader will look hardest
  for an addition in: this is the first thing the document can say that *makes* an object, and
  the first refusal that puts a mark on this canvas at all. But the mark is a place, not a
  thing — nothing is built here, so there is no second state for a ▶ to toggle between and
  nothing moving by itself for it to stop.

**The store, the panel, and what a deletion costs.**

- **`removePrefab` is the one reference-walking edit**, and it is required by the rule
  `removeAsset` set: *the document may never hold a dangling reference by any action in the
  editor*, which is what keeps `ruleActionsOf`'s drop-on-read a guard against hand-edited files
  rather than something the editor leans on. It already detached every instance; it now strips
  every spawn action naming the prefab, across every scene, in the same undo step.
- **It strips the actions and drops only the rules it empties** — `setVariableKind`'s shape
  rather than `removeVariable`'s, and again the reader's cost model said back to it: a dangling
  prefab costs the *action*, so a deletion must cost the action too, or a delete makes rules
  vanish that a re-open would have kept. `removeVariable` drops whole rules because a dangling
  *variable* costs the whole rule. Scenes and rules come back by identity where nothing named
  the prefab, or `editProject`'s "nothing happened, no undo step" contract breaks.
- **`countPrefabSpawns` exists because `countPrefabUses`' own comment stopped being true.** That
  comment says it is "what makes 'Delete prefab' honest about how much it is about to detach",
  and the button's title said so — while the press now also deletes rules. A count nobody is
  shown is exactly the hand-matched-list failure this file keeps paying for, so the title names
  both numbers.
- **The panel is `cameraPan`'s layout**: three controls, so the prefab picker on its own row and
  `x`/`y` in a `field-row` beneath it — at 390px a third control in one row is about 85px and
  truncates every prefab name to nothing. Labels are `Rule <n> do <m> prefab`/`x`/`y`, matched
  exactly by the suite. With an empty library the section is a **sentence pointing at Save as
  prefab**, not an empty picker — `AlignSection`'s rule, and `defaultAction` falls through to
  `restartScene` silently otherwise.
- **The seed is the scene centre**, which is `addNode`'s own choice for a new object and the one
  point guaranteed to be on screen. `defaultTween`'s rule with an extra edge: the marker is
  drawn at that point the moment the action arrives, so the seed is also what makes the feature
  visible at all.
- **`SCHEMA_VERSION` did not bump — the guides case, eleventh time.** No new `NodeType`, and the
  action rides in on `scenes`, which `parseProject` passes through verbatim. The old-build edge
  is iterations 31 and 33's exactly: a v14 build's `ruleActionsOf` drops the unknown kind
  through its `default: break`, so a rule whose *only* action is a spawn fails the empty-`do`
  check and is absent from **that build's** panel and emit — the document still holds it, a
  re-save loses nothing, and the rule is back the moment a current build opens the file. An old
  build doing less, not a file breaking. `rules.spec.ts` asserts the 14.
- **The suite splits where the feature's own argument says it must.** `rules.spec.ts` carries
  the document, the panel, the emitted text and the one claim only the near side can make — the
  marker is drawn at the point the document names **and the prefab's own fill has zero pixels on
  the canvas**, which is the assertion that fails the day anybody wires a spawn into
  `EditorScene`. `export.spec.ts` carries the positive runtime claim, and it is deliberately made
  on a prefab **placed nowhere**: the fill starts at zero and can only arrive by way of the rule
  pass emitting a factory and `create()` calling it.
- **What stays refused.** **No lifespan, and nothing destroys a spawned object** — `destroy`
  names a document node and a spawned one has no id, which is `containerBounds`' "two coins would
  fight over one map entry" arriving at runtime; a `delayedCall` per spawn is "spawn, *then*
  destroy", which is `tweens.chain`'s refusal and iteration 28's line verbatim. It is the hole a
  reader meets first, so the panel says it. ~~No spawn at an object's position~~ — **shipped in
  iteration 41**; see "Building one at an object" below, including why the shape turned out to be
  an optional field rather than the `at: { x, y } | { nodeId }` union predicted here. **No random position, no count and no velocity**: the first two are values that
  depend on nothing the document said, and a velocity is a body on a definition's child, which
  physics bans for the reason it bans one in a container. **No spawning a plain node**, see
  above. And **a spawned object lands on top of everything**, because it is added after every
  object `create()` emitted — Phaser's display list rather than a decision here, there being no
  `depth` in this schema at all; it is the first thing the document can say that has no position
  in the array "draw order is the array order" is about.
- **One hole this iteration *made* rather than inherited — closed in iteration 43**, which put
  the definition's controls in the library; see "The library's own controls". What it said: a prefab
  placed nowhere **has no panel**. `removePrefab`, `renamePrefab` and the use count all live in
  `InstanceSection`, which renders only with an `instance` node selected, and the scene panel's
  library only places. That was already true of an unplaced definition; this is the first feature
  that deliberately produces one — and the name is the exported factory's. The workaround is to
  place one, edit it and delete the placement; the fix is prefab controls in the library, which is
  a panel rather than a field.

### Building one at an object: the spawn anchor

Iteration 41 closes the loosening iteration 34 named first: a `spawn` may carry an optional
`nodeId`, and then the prefab is built **where that object is when the rule fires**, with
`x`/`y` read as an offset from it. "A bullet from the player" and "a coin where the enemy
stood" are the two things a fixed point could never say.

- **An optional field, not the predicted union, and the name is the whole saving.** Iteration
  34 wrote `at: { x, y } | { nodeId }`. That is a second shape every reader of the action would
  have had to switch on. An optional `nodeId` beside the existing `x`/`y` is one shape. Calling
  it `nodeId` rather than `at` or `anchorId` is iteration 37's lesson paid out a second time:
  `ruleNames` and the store's `remapActionRefs` both key off `'nodeId' in action`, so an
  anchored spawn **appears on its anchor's own panel** and a **duplicated scene remaps the
  anchor to the copy**, with no edit to either. That is the opposite of an unanchored spawn,
  which names nothing scene-local and appears only in the scene's own list.
- **`remapActionRefs` needed exactly one change, and the compiler asked for it.** With the
  field optional, `node(action.nodeId)` is `string | undefined` and does not compile. The
  guard is `action.nodeId !== undefined`, which also stops an unanchored spawn gaining a key
  holding `undefined` on a scene duplicate.
- **`x`/`y` change meaning, and the panel says so in the label.** `Rule <n> do <m> x`/`y` for
  a fixed point, `… offset x`/`offset y` once anchored. That is `cameraPan`'s "centre" and
  `setVelocity`'s "speed": one word for a place and a distance is the recorded trap. Choosing
  an object resets the numbers to (0, 0), and choosing "A fixed point" resets them to the scene
  centre. Otherwise an offset of (480, 270) or a point of (0, 0) carries over from the other
  meaning.
- **Absent is the only spelling of "no anchor".** The panel destructures the key away rather
  than writing `undefined`, and the reader attaches it only when present. So the inspector,
  which writes the reader's output straight back, never adds an empty key. The rule
  `setNodeBlendMode` and friends follow, one action over. `rules.spec.ts` asserts the key is
  absent from the saved file.
- **A dangling anchor costs the action, and it is not repaired to a fixed point.** That would
  turn an offset of (10, 0) into the scene point (10, 0): a prefab built in the corner of the
  level. That *widens* what the action says, which `rulesOf`'s one sentence forbids. It is
  `destroy`'s split: a node reaches nothing outside the action naming it. `byId` is
  `scene.children`, so an anchor inside a container or a definition is refused by the same
  mechanism as every other rule reference. Any node type may anchor one, since every node has an
  `x` and a `y`.
- **Reading a position when the rule fires is not a condition on a live property.** Nothing
  *tests* it, so no gate can widen. The value lands in a factory call whose result is still
  discarded, so the list stays a list. `RuleCondition`'s refusal is about a **gate** and still
  stands.
- **The emit is `createCoin(this, player.x + 12, player.y - 34);`.** It reads the anchor's
  binding at the moment the callback runs, so a player who has walked since the scene started
  fires from where they are.
  - It uses `[0]`, which is `setVelocity`'s read: a tilemap's first layer stands where the map
    stands.
  - A zero offset prints no term, and a negative one prints a `-`, so nothing reads `+ -34`.
  - An anchor that emitted no object gets a **comment** rather than nothing. That is the
    camera follow's treatment, and it deliberately differs from `setVelocity`'s silent `[]`: a
    missing push is invisible, while a missing spawn is a whole object that never appears.
  - There is no gate, helper, table or `EmitContext` field, so nothing above it moved.
- **The canvas draws the ring at the anchor's document position plus the offset, tethered to
  the object by a line.**
  - `rulePointsOf` resolves the anchor itself, so the renderer still never reads a table.
  - Without the tether, an offset ring reads as a fixed point, which is the one thing it is
    not.
  - The ring is drawn from the document position, not from `scrollOffsets`: it is a mark about
    a rule, not a drawn object.
  - The anchor is folded into `spawnSignature`, so moving the object moves the mark.
- **`SCHEMA_VERSION` did not bump — the guides case, eighteenth time — and this is the
  sharpest edge any no-bump decision has recorded.** No new `NodeType`, and the key rides in on
  `scenes`, which `parseProject` passes through verbatim, so a re-save keeps it. But an old
  build's `ruleActionsOf` rebuilds a spawn field by field and **drops `nodeId`**. That build
  then draws and exports the action as a fixed point *at the offset*, which is the corner of
  the level. That is a wrong picture rather than a missing one, which is worse than iterations
  31–38's "an old build doing less". And editing that rule there writes the key away for good,
  because the panel writes the reader's output back. It stays unbumped on the rule's own
  wording — the file does not break, and an untouched re-save loses nothing — but if a future
  iteration adds a second edge like this, bump rather than record a third.
- **The suite:**
  - `rules.spec.ts` carries the round trip, the anchor's own panel, the key's absence once
    cleared, the extent of the tethered mark (its left end on the object, its right end past
    the offset) following the object, the dangling anchor costing the action, and the emitted
    line.
  - `export.spec.ts` carries the runtime claim, with a prefab placed nowhere and an anchor at
    the left of the scene. The coin arriving near the anchor rather than at (0, 0) is what
    separates "read the object" from "used the offset as a point".
  - The hostile project adds three spawns, all on the *placed* prefab so `prefab-2`'s
    "called exactly once" claim is untouched:
    - one anchored at the node whose name is the breakout string, with a negative offset;
    - one at the image-less emitter, which must emit the comment;
    - one at a missing node, which must emit nothing.
  - The dangling-anchor guard was **removed and the test confirmed red**, iteration 33's rule.

**What stays refused.**
- **No spawn at a *spawned* object**: a spawned object has no id for anything to name, which
  is the wall `destroy` and `setVelocity` already hit.
- **No rotation from the anchor**: the offset is in scene axes, not the object's, so "in front
  of the player" means a fixed direction. Turning it with the object is `x * cos + y * sin`,
  which is arithmetic on a live value and a value depending on a value.
- **No velocity inherited from the anchor**, for the same reason `spawn` refuses a velocity at
  all.
- **No anchor on another rule's trigger object implicitly** ("spawn at whatever was tapped"):
  that is a callback parameter, which iteration 28 refuses by name.

### Moving one: the `setPosition` action

Iteration 42. `{ kind: 'setPosition'; nodeId; x; y; atId? }` puts an existing object somewhere
when a rule fires: a checkpoint respawn, a ball back on the centre spot, a portal. It is the
loosening "Pushing one" below named last, and it is `spawn`'s anchor applied to an object that
already exists.

- **Iteration 28's line does not move.** One more verb in a list, run at a moment Phaser already
  delivers. `update()` gains nothing. There is no new trigger, table, helper, `EmitContext`
  field or schema bump; the edge for an old build is the one iterations 31–38 record.
- **`nodeId` is the object moved; `atId` is the anchor.** The first name makes the rule appear
  on the moved object's panel and makes a duplicated scene remap it, for free — iteration 37's
  note. The second is the **first second node reference any `RuleAction` carries**, so it is the
  first one the field-name trick cannot reach. `ruleNames` and `remapActionRefs` each gained one
  explicit line. Without the first, a rule that moves the player to a checkpoint would not show
  on the checkpoint. Without the second, a duplicated scene's teleport would point into the scene
  it was copied from, and `rulesOf` would drop it. `atId === nodeId` is legal: "move by the
  offset", read off a live value exactly as a spawn's anchor is.
- **Absent is the only spelling of "no anchor"**, and a dangling anchor costs the action and is
  **not** repaired to a fixed point. Both are spawn's rules, copied rather than re-argued.
- **An Arcade *static* body is refused, and a Matter one is not.** Both halves were read from
  `node_modules/phaser/src`, not guessed:
  - A `StaticBody` is re-synced only by `refreshBody`/`updateFromGameObject`. The shared
    plain-JavaScript `create()` body cannot reach either through `GameObject.body`'s four-way
    union, and `arcadeBody` throws on a static body by design. So `setPosition` would move the
    picture and leave the wall where it was.
  - A Matter object's `x`/`y` and `setPosition` come from Matter's own `Transform` component, and
    they call `Body.setPosition`. So a plain `setPosition` moves a Matter body, static or not.
  - The refusal costs the action (`setVelocity`'s split). The panel leaves static bodies out of
    the object picker, holds the verb back when nothing else is left, and says in a hint why a
    wall is missing.
- **A dynamic Arcade body goes through `Body.reset`, and the reason is not the obvious one.** A
  bare `setPosition` *would* arrive, because `Body.preUpdate` re-reads the object every step.
  But it leaves `prev` at the old spot, so the first step sweeps the body across the whole gap,
  and it keeps its momentum. `reset(x, y)` moves the object and the body, re-seats
  `prev`/`prevFrame` and stops the body. A push after it is one more action in the list. Matter
  keeps its velocity, and the panel says so. No gate was widened, because `physicsUsedIn`
  declares `arcadeBody` from the same `physicsOf(node, true)` call.
- **Everything else is `.setPosition(...)` on every binding**, `destroy`'s `.map`, so a tilemap
  of several layers moves as one piece. `anchoredCoord` was factored out of the spawn case
  rather than copied, and the spawn output is unchanged byte for byte. The exporter needed the
  scene to ask whether the node has a body, so `ruleBodyLines` and `ruleActionLines` now take
  one. Both callers already had it in hand.
- **The destination is a *where*, so it is drawn.** `spawnPointsOf` was renamed to
  `rulePointsOf` rather than widened, the `clampFrame` → `resolveFrame` trick, so each caller
  had to agree to both. A teleport's point takes the spawn mark unchanged: the same
  `SPAWN_COLOR` ring and cross, the same label pool and the same signature. The label is
  `→ <object name>`, and the tether runs from the moved object to where it will land. It is one
  kind of chrome for "a rule puts something here", so no new colour needed the arithmetic check.
  The object itself stays where the document puts it, and `hasMotionIn` records the refusal in
  its comment.
- **The panel is spawn's card**: `Rule <n> do <m> object`, `… at` ("A fixed point" or an object),
  and `… x`/`… y`, which become `… offset x/y` once anchored. Switching the anchor resets the
  numbers, and the key is destructured away rather than written `undefined`. The seed is the
  scene centre, on the first object that can be moved.
- **The suite:**
  - `rules.spec.ts` covers the round trip, both panels, the key's absence once cleared, the
    tethered mark with the object unmoved, the static refusal under Arcade (and its absence
    under Matter), a hand-edited static target and a dangling anchor each costing the action,
    and all four emit shapes.
  - `export.spec.ts` runs a dynamic body teleported to the column above another object. It
    checks that the ball lands on that object's `x`, which is what separates "read the anchor"
    from "used the offset as a point".
  - The hostile project adds a reset, an anchored body-less move with a negative offset, a
    static target, a dangling anchor, and a Matter static body anchored on the faller. All ride
    untriggered rules for `NO_MOTION`'s reason.

**What stays refused.** **No rotation or scale with the move** — those are `startTween`'s job,
and a teleport that turned the object is two verbs in one. **No moving *towards* a point over
time** — that is a tween. **No keeping an Arcade body's velocity** — `reset` is the one call that
leaves the body consistent, and a push afterwards says the rest. **No moving a static Arcade
body** — above; it is a helper away rather than an argument away, and the loosening is a
`refreshBody` helper beside `arcadeBody`. **No moving to a spawned object** — a spawned object
has no id to name, which is the same wall as `destroy`. **No moving to where something was
tapped or hit** — that is a callback parameter, which iteration 28 refuses by name.

### Pushing one: the `setVelocity` action

Iteration 37 closes a hole that ran between two features this file has argued about at
length and never once put in the same sentence. Iteration 16 gave a
node an Arcade body, 20 gave the scene colliders and a drive-scheme, 21 gave that scheme a
thumb, 26 gave the scene a second engine — and 28 to 34 grew a rule vocabulary to six
triggers and seventeen actions. **The two halves never touched.** A rule could destroy an
object, hide one, make one speak, animate it, tween it, build a prefab, shake the camera,
count a number and change scene, and it could not make anything *move under physics*: the
only thing in this document that could put a body in motion was a player holding a key. A
jump pad did nothing. A tap could not launch a ball. A collision could not knock anything
back. A `spawn` put an enemy on screen and it stood there for the rest of the game.

- **It is iteration 34's closing lesson for the third time running, and the clearest
  instance of it yet.** *A refusal list is a list of things somebody thought of, and the hole
  that survives is the one nothing prompted the question.* `grep -i velocit` over this file
  found eleven hits before this iteration and **not one was a refusal about a rule**. Physics
  refuses a simulating canvas, circular bodies and a body inside a group; Rules refuse OR,
  arithmetic, callback parameters, `onComplete`, a "while" trigger and a condition on a live
  property. The one refusal that *says* "no velocity" is `spawn`'s, and it is about a velocity
  on a **definition's child** — which physics bans because a definition's children are
  container children, and which says nothing whatever about a placed object. **Cite it rather
  than leave it, because the next reader will find that sentence and take it for this
  question's answer.** Iterations 35 and 36 found their holes in the *drawing* domain; this
  one is in the domain that had eight sections of argument written about it and still nobody
  asked.
- **Iteration 28's line does not move, and that is the first thing to check.** This is one
  more verb in a list run at a moment Phaser already delivers, so **`update()` gains nothing**,
  there is no new trigger, no new table, no new emitted helper, no `EmitContext` field, no
  `prepare` flag and no pre-pass. It is `startTween`'s sibling, one mover over: that action
  already moves an object, through the tween manager, and this one moves it through the
  physics engine — which is the one mover in this codebase a rule had never been able to
  reach.
- **Absolute, never relative, and the refusal has two reasons rather than the tween's one.**
  `Body.setVelocity` and `matter.body.setVelocity` both *replace* what the body was doing, so
  `{ x: 0, y: 0 }` is a real verb — "stop dead" — rather than an action that does nothing,
  which is what makes the repair policy below trivial. A relative push is an **impulse**, and
  it needs a value the document cannot read: what the body is doing *now*, which is a live
  object property and therefore `RuleCondition`'s own refusal. And Matter's version of an
  impulse is a **force**, in a third unit again. `startTween`'s "absolute values, never `+=`"
  with an engine's arithmetic behind it.
- **One number in the document, converted at the emit — `ScenePhysics.gravityY`'s rule
  exactly.** Pixels per second under both engines; Matter measures velocity per *step*, a step
  being its own 1000/60 ms base delta, so the Matter branch divides by 60. That is the
  conversion `PhysicsBody`'s own dials and the driven `update()` already make, and it is what
  lets a scene switched from Arcade to Matter be pushed at exactly the rate it was pushed at
  before. Two numbers would be two fields free to disagree about one speed.
- **The field is `nodeId`, and that is structural rather than cosmetic.** `ruleNames` keys off
  `'nodeId' in action`, `ruleUsesVariable` off `'variableId' in action`, and the store's
  `remapActionRefs` off both — so the *name* is what makes all three inherit the right answer
  with **no edit at all**. It is also where this parts company with `spawn` and the camera
  effects, which name nothing scene-local: a duplicated scene genuinely *wants* this one
  remapped to the copy, and `'nodeId' in action` already does it. The good consequence is that
  a rule whose only action is a push **appears on that object's own panel**, because it is
  about that object — where a camera effect or a spawn appears only in the scene's own list.
- **Both refusals cost the action, never the rule**, which is `startTween`'s split — the only
  other two-part node gate here — and `destroy`'s reason: a node reaches nothing outside the
  action that names it, so dropping one strictly *narrows* what the rule says, where a
  dangling variable would reopen a gate and costs the whole rule. If it was the only action,
  the empty-`do` check takes the rule, which is a lone `destroy` of a missing node's treatment
  already.
- **The dynamic half is correctness, not taste, and this is the sentence to keep.**
  `arcadeBody` **throws**, naming the object, when it is handed a `StaticBody` or no body at
  all — so an action kept here would be an uncaught throw inside `create()` in the player's
  game, before a single object is drawn. That is Audio's `sound.add`-on-an-unloaded-key
  failure, which it already records as worse than the missing-image case, and it is
  `controlsOf`'s own refusal (*"an exported `update()` calling `setVelocityX` on a
  `StaticBody`, which does not have one"*) arriving on an action.
- **One test for both engines**, for one reason each: an Arcade `StaticBody` genuinely has no
  velocity, and Matter integrates none on a static body. So the reader needs nothing of
  `scenePhysicsOf` and there is no second list — `physicsOf` answers for the node *type* as
  well, so a container, an instance, an emitter and a tilemap are all refused there.
- **No top-level guard of its own, and that is not an omission.** `byId` is built from
  `scene.children` alone and `physicsOf`'s second argument is the same `topLevel` rule a body
  already carries, so a node inside a container or a prefab definition is out twice over.
- **`x`/`y` are repaired, never dropped** — `cameraPan`'s and `spawn`'s `finiteOr`. *A repair
  may narrow what the document says and may never widen it* is satisfied trivially here,
  because there is no gate inside the action for a repair to open: the repaired value is a
  body told to stop, which is a thing somebody asks for.
- **No gate was widened in the exporter, and that had to be traced rather than assumed** —
  because on that checklist "already covered" and "forgotten" read identically. `physicsUsedIn`
  turns `physics.dynamic` on for a scene holding a dynamic Arcade body and `physics.matter` on
  for a Matter scene holding any body, **by calling `physicsOf(node, true)` over
  `scene.children`** — which is the very same call on the very same array that the reader
  makes. So an accepted push cannot outrun its helper, under either engine, and the Matter
  trap that looks like it should bite does not: a Matter scene's `physics.dynamic` is
  deliberately forced false, and the Matter branch needs `physics.matter`, which is true.
- **Nothing is drawn from the module identifier set, so nothing above it moves** —
  `toIdentifier` suffixes a clash and four helper names are asserted verbatim in the suite.
  Iteration 31's and 36's "nothing moved" for the third time, and a project with no
  `setVelocity` exports byte for byte what it exported before.
- **`[0]`, never a `.map` over the bindings.** A node's binding list holds more than one entry
  only because a tilemap emits one object per layer, and a tilemap is not in `PHYSICS_TYPES` —
  so a pushable node emits exactly one object. `playAnimation`'s read rather than `destroy`'s.
- **`constructorFor` gains no case, so the compiler catches exactly two steps — and knowing
  which two is half of what a reader needs.** `ruleActionLines`' switch is exhaustive with no
  `default`, and `ACTION_LABEL` is a `Record<RuleAction['kind'], string>`, so the *panel* also
  refuses to compile. Every other consumer of `action.kind` across `src/` — in
  `collectLabels`, `prefabsNamedByRules`, `animationsNamedByRules`, `buildCreateBody`'s
  pre-pass, `migrateRuleToKind`, `removePrefab`, `countPrefabSpawns` and `rulePointsOf` — is
  a narrowing `=== 'spawn'` / `=== 'setVar'` check that simply never fires for a new member,
  which is the right answer rather than a missed step. Everything genuinely silent is in the
  usual places: `RULE_ACTION_KINDS` (a plain array, so an omission is an action nobody can
  pick), `ActionFields`' and `defaultAction`'s defaulted switches, and `hasMotionIn`'s prose.
- **Nothing is drawn on the canvas, and `EditorScene.ts` is untouched for the seventh time**
  — after Audio, Rules, 29, 31, 32 and 33. This is the first feature here whose canvas
  refusal is not "we could draw it but it would move", so the argument is new and belongs
  written down:
  - **Every mark this canvas draws is a *where*.** The camera frame is the shot the scene
    opens on, the spawn ring is where a prefab will be built, the tween ghost is where an
    object ends up, the body outline is the box that collides, the touch rings are where the
    buttons sit. A velocity is not a where — it is a **rate**, and the only honest picture of
    a rate is the object moving, which is precisely what this canvas refuses to show.
  - **An arrow would be a *path*, and the path would be a lie.** Gravity, drag, bounce,
    friction and every collider bend it, and the document holds none of the arithmetic that
    says how. A straight arrow over a scene with gravity on would say "it goes there" about an
    object that goes somewhere else — the canvas and the export disagreeing about a picture,
    which is the single failure this project guards hardest against.
  - **So a velocity is an authored number with no locus**, exactly like `mass`, `drag`,
    `bounce` and `allowGravity` — the eight Arcade dials that have sat in the panel since
    iteration 16 and have never had a mark either. The body outline draws the *shape*; the
    dials are numbers. This is a ninth dial that arrives on a rule rather than on the body,
    and it takes the dials' treatment.
- **`hasMotionIn` records its tenth refusal there and its fourteenth overall**, and it is the
  one a reader will be surest is wrong, because this is the first thing the document can say
  that puts a **body** in motion. Two refusals meet in it, which is iteration 31's shape: the
  canvas fires no rule, *and* it simulates no body at all — physics' own first decision, made
  because a step does not merely animate the document, it rewrites the numbers the document is
  made of. There is nothing here for a ▶ to start and nothing it could stop.
- **The store needed no edit, and beside `removePrefab` and `removeVariable` that reads like a
  forgotten step.** Nothing prunes a dangling `nodeId` today — `destroy`, `setVisible`,
  `setText`, `playAnimation` and `startTween` all tolerate one and the reader drops the action
  on read. The sharper case is new and needs nothing either: **`setNodePhysics(id, null)` and
  switching a body to static both make an accepted action stop validating without deleting a
  node**, and that is `setNodeTween(id, null)` versus `startTween` to the character. Switching
  the body back on brings the action back, which is `physicsOf`'s own "a node dragged into a
  group and back out again is the same node".
- **The option is withheld from the picker rather than offered and refused, and it is the
  first *action* treated that way.** `varChange`'s mechanism on the trigger picker a few rows
  up, and for its reason: `defaultAction` can only fall through to `restartScene` when nothing
  in the scene carries a dynamic body, and an option that leaves the picker where it was reads
  as a broken control. **The alternative is not merely worse, it is unavailable** — `RuleCard`
  renders `rulesOf`'s *validated* output, so an `ActionFields` empty state for this kind could
  only render for an action the reader accepted while no candidate exists, which is a
  contradiction. A hint there would be a sentence nobody could ever read. (That is quietly
  true of `spawn`'s, `setText`'s and `addVar`'s empty states as well; they are harmless and
  they are not a precedent to copy.)
- **The seed is a jump.** `{ x: 0, y: -450 }`, and 450 is `DEFAULT_JUMP`'s own number rather
  than a new one, so the panel and the built-in platformer cannot disagree about how high one
  goes. Written as a literal rather than by importing that constant, because the two answer
  different questions and a change to the drive-scheme's default should not silently move this
  seed. `defaultTween`'s rule and its reason: an action that runs perfectly and changes nothing
  is indistinguishable from the feature being broken, and `{ x: 0, y: 0 }` is exactly that
  action.
- **The panel's fields are `speed x` and `speed y`, never a bare `x`/`y`.** A `spawn`'s `x` on
  the same card is a **place** and this is a **rate**, and one word for both is `cameraPan`'s
  own recorded trap — the reason its fields say "centre". It also keeps them clear of the
  body's own **`Velocity X`**, which renders a few sections up the same panel, and which the
  suite matches exactly. That neighbour is the one thing about this feature a reader will call
  a duplicate, and it is not: `PhysicsBody.velocityX` is the velocity the body **starts** with,
  an initial condition emitted once on the constructor chain, and this is the velocity it is
  given **at a moment**. Iteration 30's split to the character — a bound label answers "what
  does this object read", `setText` answers "what happens at this moment", and both exist.
- **Three controls, so two rows** — `spawn`'s and `cameraPan`'s layout and the 390px rule.
- **`SCHEMA_VERSION` did not bump — the guides case, fourteenth time.** No new `NodeType`, and
  the action rides in on `scenes`, which `parseProject` passes through verbatim. The old-build
  edge is iterations 31, 33 and 34's exactly: a v14 build's `ruleActionsOf` drops the unknown
  kind through its `default: break`, so a rule whose *only* action is a push is absent from
  **that build's** panel and emit — the document still holds it, a re-save loses nothing, and
  the rule is back the moment a current build opens the file. An old build doing less, not a
  file breaking. `rules.spec.ts` asserts the 14.
- **The suite splits where the feature's own argument says it must.** `rules.spec.ts` carries
  the document, the panel, the emitted text and the two claims only the near side can make:
  that the object is in the same place after a second long enough for a body at 400px/s to
  have crossed the scene, and that no ▶ appears. `export.spec.ts` carries both positive
  claims, one per engine, because the editor runs none of it.
- **The runtime fixture sets gravity to zero and leaves the body's own velocity at zero**,
  which is `spawn`'s "placed nowhere" one action over: nothing else in the exported world is
  able to move that object, so any travel at all can only have come from the emitted call.
  The **direction** is asserted as well as the distance, and the object is asserted to still
  be *on the canvas* — which is what makes one reading catch both failure modes of the `/60`:
  a missing conversion is sixty times too fast and the object is gone by the first screenshot,
  while a doubled one is imperceptible and it never travels at all.
- **Both halves of the one gate are asserted, because each is a separate way to throw.** A
  body switched **off** and a body switched to **static** are two different documents and one
  refusal, and a test exercising only the first leaves half the guard untested. Checked by
  deleting the reader's line and confirming the test goes red, which is the check iteration 33
  ran on its re-entrancy flag — and worth repeating here, because the *hostile* fixtures alone
  do **not** catch it: they ride `keyDown` triggers nothing in the suite presses, so the throw
  they describe never fires at runtime. They are there for the compiler, not for the guard.
- **The hostile project gained four pushes and the Matter scene gained its first rules.** One
  with a non-default value on both axes on the scene's dynamic-bodied node, which is the only
  place `Body.setVelocity` is reached from a rule under `tsc --strict` and the only place
  `arcadeBody` is called anywhere but a constructor chain; one on a **static** body and one on
  a node with **no body**, as a pair on purpose, because either alone cannot tell "costs the
  action" from "costs the rule" — `rule-x15`/`rule-x16`'s shape; and one in the **Matter**
  scene, which is the only place `matter.body.setVelocity` and the `/60` meet
  `MatterJS.BodyType` under the same compiler. The Matter pair's numbers are 300 and -90,
  neither round in both units, which is `gravityY: 940`'s own trick one field over. All of them
  ride triggers nothing presses, `NO_MOTION`'s rule: a body that actually took a push would
  slide out from under every colour assertion in `export.spec.ts`, which is correct behaviour
  and is not what those assertions are about.

**What stays refused.** **No impulse and no relative push** — see above; it needs a value the
document cannot read, and Matter's version is a force in a third unit. **No acceleration,
drag, bounce or gravity from a rule** — a pure loosening, one member each, but the emitter
config's argument applies: those dials only mean anything beside each other, which is why the
body already emits all eight whole, and a rule that set one in isolation would be a dial
fighting the seven printed above it. **No angular velocity** — a second field and a second
unit for a dial `PhysicsBody` already carries. **No push *towards* a point or at another
object** — a direction that depends on a position is a value depending on a value, which is
iteration 28's second half verbatim. **No push on a spawned object** — a spawned object has no
id for anything to name, which is `containerBounds`' "two coins would fight over one map entry"
arriving at runtime, and it is the same wall `destroy` has always hit. **No push on a node
inside a container or a prefab definition** — physics' own top-level rule, inherited twice
over. **No reading a velocity in a condition** — `RuleCondition`'s own refusal: a variable is
the one quantity that survives `scene.start`, validates against a table the document holds, and
is one shape across the whole union. And **no `setPosition`** — a teleport is not a push, it
works on nodes with no body at all, and it is a genuine separate loosening rather than a
smaller version of this one. It is the thing a reader will ask for next. **It shipped in
iteration 42**; see "Moving one" above.

### Making one throw: the particles actions

Iteration 38 closes a hole with the sharpest provenance of any yet, because the sentence
that made it is still in this file and still correct. Iteration 15 refused an `emitting`
prop and refused a burst, in these words:

> **There is no `emitting` prop, and that is the `scene.start` argument.** … an emitter
> that starts switched off and is triggered later is **a line of game logic**.

> **No follow target, timed burst or `stopAfter`** — behaviour over time is game logic,
> **the `scene.start` argument again**.

Both were written thirteen iterations before there was anywhere to put a line of game
logic. Rules arrived in 28, and every iteration since went back for one of those pre-rules
`scene.start` refusals — 28 took scene-start (13's) and the collider callback (20's), 31
took the camera's over-time effects *verbatim*, 34 took spawn, 37 took velocity. **The
particles one, worded identically, was never revisited**, and it is on no "what stays
refused" list and nowhere in "Not built yet". So until now a particle emitter in an
exported game ran from the moment the scene booted, for ever, with no way to say
otherwise — which made a puff of smoke when something is hit, the commonest thing anybody
wants particles for, the one thing this document could not say.

- **The reading to carry forward is narrower than 37's and is the third refinement in a
  row.** 34 said a refusal list is a list of things somebody thought of. 37 said it gets
  longer in the direction it is already looking. This one says where to look instead:
  **the holes are in the sentences a feature wrote about *itself* before the thing that
  would close them existed.** Iteration 37's check — "what did we build that the newest
  feature cannot name" — found this in one pass over eighteen action kinds; the check for
  iteration 39 is to `grep` this file for `scene.start` and read every refusal that
  predates iteration 28 against the vocabulary that exists now.
- **The line iteration 28 drew does not move.** Three more verbs in a list run at a moment
  Phaser already delivers, so **`update()` gains nothing**, and there is no new trigger, no
  new table, no `prepare` flag, no `Emission` gate and **no new module helper**.
  `EmitContext` does gain one field, and it is the whole feature rather than an exception
  to this sentence — see `ruleEmitters` below. Nothing *gates* on it: it changes what one
  existing call prints, where a `prepare` flag decides whether a helper is declared at all.
- **Three kinds, not one with a verb field** — the camera effects' call verbatim: the union
  is already discriminated on `kind` at the reader and at the emitter, so a second
  discriminant inside one case is a switch inside a switch for nothing.
- **Named for the type, not for Phaser's class.** `startParticles` / `stopParticles` /
  `burstParticles`, because `particles` is the word this document already uses —
  `NodeType`, `SECTION_TITLE` and the tree's add button all say it — while the *emit* uses
  `.start()`, `.stop()` and `.explode(n)`. The `collide`/`collider` split kept exactly: one
  is the word a person reads, one is the API.

**There is still no `emitting` prop, and that is the decision the whole feature turns on.**

- **The exporter derives it.** `EmitContext.ruleEmitters` is a per-scene `Set` built in the
  same pre-pass that already builds `ruleAnimated` and `ruleTweens`, and `constructorFor`'s
  particles case adds `emitting: false` to the config literal for the node ids in it. That
  is `ctx.ruleTweens`' `paused: true` one type over, and it is the third member of a family
  whose shared property is worth naming: **what a rule does to an object later can change
  how `constructorFor` has to build it now.**
- **So iteration 15's sentence stays true rather than being overturned.** Whether an
  emitter runs is still `previewMotion`'s answer in the editor and Phaser's in the export;
  a stored field would be the second answer to one question that sentence exists to refuse.
  A rule saying it is a *third* thing, which is why the answer is derived and not kept.
- **A `stopParticles` deliberately does not put a node in the set.** "Stop the smoke when it
  is hit" means the smoke was running. Only a start or a burst describes an emitter that
  waits — which is also the byte-for-byte rule: an emitter a rule only stops emits the
  config it always did, character for character. `rules.spec.ts` asserts both sides, because
  a derivation of "any rule naming it" passes every other claim in the file.
- **It is a *silent* step where `ruleAnimated` is a compile error**, and that asymmetry is
  worth stating. A missed `ruleAnimated` is an `Image` with no `play` and `--strict`
  catches it; a missed `ruleEmitters` is a game whose every emitter runs from the boot,
  which is precisely the state this feature exists to end and which nothing fails on.
- **The canvas/export disagreement it creates is already the accepted answer.** Under ▶ the
  editor runs every emitter, including one the export emits stopped — which is exactly what
  a rule-started tween (`paused: true`) has done since iteration 28. Preview is the one
  moment the canvas deliberately stops mirroring the document, and this is that, one type
  over. Said out loud, because a reader will ask.

**The reader, the emit and what needed nothing.**

- **Both refusals cost the action, never the rule** — `destroy`'s and `setVelocity`'s split
  for its reason: a node reaches nothing outside the action that names it, so dropping one
  strictly *narrows* what the rule says, where a dangling variable would reopen a gate. If
  it was the only action the empty-`do` check takes the rule, which is a lone `destroy` of a
  missing node's treatment already.
- **No hand-matched list, and the absence is deliberate.** `PHYSICS_TYPES` and
  `TAPPABLE_TYPES` exist because their question has six answers apiece with no compile-time
  link back to the union; "can this throw particles" has one answer and it is the type's own
  name, so `node.type !== 'particles'` is the whole gate. Said in the code, because beside
  those two a missing set reads like a third one forgotten.
- **No top-level guard of its own** — `byId` is built from `scene.children` alone, so a
  particles node inside a container or a prefab definition is already out.
- **`MAX_BURST` is the one runaway, and the floor is the one silent no-op.** `explode(n)`
  allocates `n` particles on the frame it fires, so a hand-edited six-figure count is a
  dropped frame in the *player's* game and on a looping timer it is every frame after —
  `MIN_TIMER_DELAY`'s and `MAX_EFFECTS`' job. `explode(0)` is the opposite failure: an
  action that runs perfectly and throws nothing. The cap is exported and the seed is not,
  which is `MAX_EFFECTS`' split — a *limit* the control and the reader disagree about is a
  control offering what the reader takes back, while a seed is the panel's own answer and is
  written there as a literal, `setVelocity`'s 450 for its reason.
- **No helper, no cast, and therefore nothing above it moved.** `add.particles(...)` answers
  with the `ParticleEmitter` itself and all three verbs are on it, so the lines type-check
  under `--strict` as they stand — unlike `arcadeBody` (`GameObject.body` is a four-way
  union) and `attachEffects` (`filters` is declared readonly and nullable), both of which
  exist only because the shared plain-JavaScript `create()` body can carry no narrowing.
  Nothing is drawn from the module identifier set, the seventeen helper names are unmoved
  and four of them are asserted verbatim in the suite. Iteration 31's, 36's and 37's
  "nothing moved", fourth time.
- **`stop()` and not `stop(true)`**, deliberately unlike `EditorScene`'s preview teardown.
  There `stop(true)` exists because switching ▶ off has to put the canvas back
  *immediately*; in a game "stop the smoke" means stop making new smoke and let what is
  already out fade on its own, and killing it is a visible pop. One line, no field.
- **`[0]`, never a `.map`** — `playAnimation`'s read. A node's binding list holds more than
  one entry only because a tilemap emits one object per layer, and a tilemap is not a
  particles node. Undefined is an emitter with no image, which `missingReason` has already
  written a comment in place of — the camera follow's treatment.
- **Three facts were read out of the shipped package rather than recalled**, which is
  "Phaser 4, not 3" for the sixth time, and all three would have been silent if guessed.
  `emitting?: boolean` is a real `ParticleEmitterConfig` key, honoured by the constructor
  and not only by `setConfig`. `explode()` calls `emitParticle` directly, which has **no
  `emitting` guard at all**, so a burst works on an emitter built stopped — without that
  the whole `burstParticles` branch would be a verb that does nothing. And `explode` sets
  `frequency = -1` permanently, so an emitter a rule bursts does not go back to streaming,
  which is what a burst means and is a second reason a burst belongs in `ruleEmitters`
  beside a start. One more worth knowing: `start()` is a no-op in explode mode
  (`frequency === -1`), which a hand-set frequency of -1 can reach.
- **`ruleNames`, `ruleUsesVariable` and the store's `remapActionRefs` needed nothing**, and
  the *field name* is why: all three key off `'nodeId' in action`, so naming it anything
  else would have cost three edits. The good consequence, stated rather than discovered:
  **a rule whose only action is a particles verb appears on that emitter's own panel**,
  where a camera effect or a spawn, naming nothing a scene holds, appears only in the
  scene's list. `rulePointsOf`, `migrateRuleToKind`, `removePrefab` and `countPrefabSpawns`
  narrow with `=== 'spawn'` / `=== 'setVar'` and never fire for a new member, which is the
  right answer rather than a missed step.
- **The store is untouched.** Nothing prunes a dangling `nodeId` for `destroy`,
  `setVisible`, `playAnimation`, `startTween` or `setVelocity` either; the reader drops the
  action on read.

**Nothing is drawn, and `EditorScene.ts` is untouched for the eighth time** — after Audio,
Rules, 29, 31, 32, 33 and 37, and this is the strongest version of it, because this is the
first rule action whose result the canvas is **already showing**.

- **The canvas already says this state, and says it once.** The pink marker is shown exactly
  when the emitter is not running — one notion of "running", not two — and ▶ still governs
  it. A second mark for "a rule starts this" would be a second answer to a question the
  marker already answers.
- **And a burst has no *where* that is not already drawn.** Every mark this canvas makes is
  a where: the camera frame, the spawn ring, the tween ghost, the body outline, the touch
  rings. A burst happens at the emitter's own position, which is an object the user can see
  and drag — `explode(count, x, y)`'s two extra arguments are refused for exactly that, since
  taking them would make this the second thing the document can say that has a where.
- **`hasMotionIn` records its fifteenth refusal**, and it is the easy one for once: an
  emitter already puts ▶ on the toolbar by existing, and a rule that starts one adds nothing
  for that button to start or stop.

**The panel and the suite.**

- **The three verbs are withheld from the picker** when the scene holds no emitter —
  `setVelocity`'s mechanism for its reason, and the second and last use of it rather than a
  precedent to reach for: it is right only because `defaultAction` has nothing to seed these
  with, and `RuleCard` renders `rulesOf`'s *validated* output, so an empty state for the kind
  could only render for an action the reader accepted while no candidate exists.
- **The labels are `Start particles` / `Stop particles` / `Burst particles`**, and the burst's
  fields are `Rule <n> do <m> object` and `Rule <n> do <m> count`. None collides with a label
  already on the panel and none is one of the mobile tab bar's exactly-matched
  `Scene` / `Properties` / `File`.
- **The suite's instrument is a colour count**, and the negative half is what makes it mean
  something: with `emitting: false` the exported page holds **zero** pixels of the particle's
  colour until the timer fires, where before this iteration the count was non-zero on the
  first frame. `#00ff6a`, picked by arithmetic — its worst per-channel margin against every
  other fixture colour in `export.spec.ts`, the hostile project's own fills and the scene
  background is 126, against `findColor`'s tolerance of 24. An export draws no editor chrome,
  so unlike every near-side spec there is no palette of guides and outlines to clear as well.
- **Both guards were checked by breaking them**, which is iteration 33's and 37's rule: the
  reader's `type !== 'particles'` line and the exporter's `ctx.ruleEmitters.has(...)` were
  each removed and the suite confirmed red. The hostile fixtures alone do **not** catch
  either, because their actions ride a `tap` nothing in the suite presses — they are there
  for the compiler, not for the guards.
- **The hostile project's three emitters now split three ways.** `atlas-emitter` is *started*,
  so it is the only place `emitting: false` meets `ParticleEmitterConfig` under
  `tsc --strict`. `n` is only *stopped*, so its config stays untouched — which is what keeps
  the `blendMode: "ADD"` assertion beside it passing unchanged. And `o`, which has no image
  and therefore no binding, is *burst* — the `bindings.get(...)?.[0] === undefined` path,
  which must answer with no line rather than an identifier nothing declared. Beside them a
  missing id and a **text** node, as a pair on purpose, because either alone cannot tell
  "costs the action" from "costs the rule".
- **`SCHEMA_VERSION` did not bump — the guides case, fifteenth time.** No new `NodeType`, and
  the actions ride in on `scenes`, which `parseProject` passes through verbatim. The
  old-build edge is 31's, 33's, 34's and 37's exactly: a v14 build's `ruleActionsOf` drops the
  unknown kind through its `default: break`, so a rule whose *only* action is a particles verb
  is absent from **that build's** panel and emit — the document still holds it, a re-save
  loses nothing, and the rule is back the moment a current build opens the file. An old build
  doing less, not a file breaking. `rules.spec.ts` asserts the 14.

**What stays refused.** **No `pause` / `resume`** — `stop`/`start` is the pair
`playSound`/`stopSound` already established, and a second spelling of one idea is two
notions of one state. **No burst at a point** — above; it would be the second thing this
document can say that has a where. **No `stopAfter`, no `flow`, no emit or death zone, no
follow target** — the rest of iteration 15's refusals, each still its own argument, and the
zone one is still the `.tmj` argument at a smaller scale. **Nothing reads whether an emitter
is running** — that is a rule about rules. **No `advance` or `duration` on a start**, which
are a fast-forward and a stop-after in disguise. And **no "while" trigger, no sequencing, no
`onComplete`** — iteration 28's line, unmoved.

## The properties panel

Every section of the inspector is a disclosure — `src/ui/Section.tsx` — and they ship
**closed**. It is the first iteration whose subject is the editor's own UI rather than what
the document can say, and it exists because the panel had grown a section per iteration and
never a way to put one away: a tilemap carrying a dynamic body renders eighteen at once,
which on a phone is a 55vh sheet of unbroken scroll.

- **Sections are flat peers. Nothing nests.** This is the decision the whole conversion
  turns on and it is not the obvious one. `NodeInspector` used to render one
  `SECTION_TITLE[node.type]` heading above the whole per-type block, so wrapping naively
  would have buried a sprite's Sprite sheet, Animation and Appearance *inside* its Image
  section — invisible while it is closed and two presses away while it is open. Each branch
  therefore opens its own, `SnappingSection` closes before it renders `<GuidesSection/>`,
  and `PhysicsSection` closes before `<NodeCollisionsSection/>` and `<ControlsSection/>`.
  The last is also what gives `NodeCollisionsSection` one shape in both the places it
  appears, since it already rendered flat inside `TilemapSection`.
- **The state is editor state, and the first of its family that is persisted.** It sits in
  the store beside `lockAspect`, `snapEnabled` and `previewMotion` — never in the document,
  so it does not mark the file dirty and is not undoable — but unlike those it is written
  to `io/prefs.ts`. The difference is what each is about: whether the aspect lock is on is
  about the gesture in hand, while this is the shape of a workspace and should still be
  there after a reload. `inspector.spec.ts` asserts a collapse does not move a saved byte.
- **Two fields, not a set of open titles, and `setAllSections` is why.** Expand-all has to
  reach sections that are not on screen when it is pressed *and* sections nobody has
  written yet; a set could only ever name the ones that were rendered. So
  `sectionsOpenByDefault` is a field of its own and `sectionOverrides` records only what
  the user has touched. The payoff on the "Adding a Phaser object type" checklist is that a
  new section needs **no registration anywhere** — which is the opposite of `PHYSICS_TYPES`
  and `countAssetUses`, the lists that go stale silently. `inspector.spec.ts` asserts it by
  pressing Expand-all with a rectangle selected and then checking a *tilemap's* Brush.
- **Keyed by title**, so a section stays as it was left across a selection change and
  across node types. Every repeated title in the file is either a mutually exclusive
  `node.type` branch or an alternate empty state of one section, so no two can render at
  once — checked, not assumed. Two consequences worth knowing: renaming a heading resets
  that section for every existing user and leaves an inert orphan in the overrides map
  (harmless, because the map is sparse — the second reason for that shape); and this file
  renames labels often and for good reasons, so a heading is a **storage key** now.
  `Particles` and `Particle` are one letter apart and are two of them.
- **The head's title must stay its own text node.** `physics.spec.ts` asserts
  `getByText('Physics', { exact: true })` has count 0 for a type that cannot carry a body.
  A head rendering its title and chevron as one text node would match nothing and pass
  vacuously for ever, so the chevron is a separate `aria-hidden` span — and
  `inspector.spec.ts` carries the positive counterpart so the negative cannot rot.
- **A head is a `button` whose accessible name is its title, which is a live locator
  hazard.** `SECTION_TITLE` contains `Group`, `Text`, `Image`, `Panel` and `Tiles`, and
  `multi-select.spec.ts` already clicks a button named exactly `Group`. It is safe only
  because that click happens in `SelectionInspector`, which renders no per-type section.
  The harness therefore reaches a head by `.section__head`, never by role — the "Centre in
  scene ↔ matched the Scene tab" trap, one control type over.
- **A closed body unmounts**, which is what `RuleCard` beside it already does. Hiding would
  not have helped the suite anyway — Playwright refuses to click what it cannot see — and
  unmounting is the cheaper half on a panel that can hold eighteen sections. The one thing
  that would genuinely break: `NumberField` opens an undo transaction on focus and closes
  it on blur, and unmounting a focused input fires **no blur**, which would strand
  `txDepth` above zero and poison undo. Pressing the head moves focus first, so it holds —
  a toggle driven from anywhere that does not move focus has to blur the panel itself.
- **The suite reaches the panel by seeding the preference, not by a test-only branch.**
  `EditorPage.open`'s init script writes the real `PREFS_KEY` (imported, never copied) with
  `openByDefault: true` — the same state the panel's own Expand-all button produces. The
  decisive argument is not the ninety-odd call sites it saves: `panel('inspect')` is a
  *synchronous* locator factory and `openPanel()` returns immediately on desktop, so there
  is no async seam to hang an expand step on — but more importantly several existing
  assertions are **absence** assertions (`physics.spec.ts`'s `toHaveCount(0)`,
  `behaviour.spec.ts`'s empty-state sentences), and a collapsed neighbour turns every one
  of them into a statement that is true for the wrong reason. Seeding keeps the DOM the
  suite sees identical to the one it was written against. The seed is skipped when a marker
  key is present, because `addInitScript` re-runs on every navigation and a spec that only
  cleared the key would find it seeded again after a reload —
  `EditorPage.useShippedSectionDefaults` sets that marker, and `inspector.spec.ts` is its
  one caller.
- **`core/` still imports nothing from `io/`.** The store holds the state and knows nothing
  about where it is kept; `main.tsx` hydrates it before `createRoot(...).render(...)` and
  subscribes to persist. Hydrating in an effect instead would paint the panel closed and
  snap it open a frame later, which is the flash this ordering exists to avoid.
- **`.panel__section` is untouched and still has four owners** — `SceneTree`'s Scenes and
  Prefabs, `Toolbar`'s File and Export to Phaser. Those are lists rather than panels of
  controls and have nothing to collapse. `.section__head` deliberately reuses that rule's
  exact voice (11px, `--text-dim`, uppercase, `0.08em`) so the panel sounds the same as it
  did when these were bare labels; what changed is that it is now a control.
- **One hairline between sections, and nothing else.** `.section + .section` gets a
  `border-top` — no border *and* fill *and* shadow, which on a dark panel stacks into mud
  and makes eighteen sections read as eighteen cards rather than one list. The stylesheet's
  first `:focus-visible` lives here too, because a head is the one control standing between
  a keyboard and every field in the panel.
- **The particles "Stopped." hint moved.** It used to sit between the Sprite sheet heading
  and Emission, which under the flat rule belongs to neither — it would have floated
  between two collapsed bars. It is about the emitter as a whole, so it is in the per-type
  section's lead-in now.

## Selection

`selectedIds: string[]` is the selection, in the order it was picked; the **last** entry
is the primary one — what the inspector edits, where the scale handle sits, and which
group `addNode` and paste drop into. There is no separate "active id" field: two places
holding the same answer is how they come to disagree.

- **`selectionRoots` is what an edit acts on, never `selectedIds` directly.** It returns
  the selection in *document* order with anything already covered by another selected node
  dropped. Selecting a group and something inside it is easy to do and means one thing —
  the group — so without it a delete would remove the child twice, a duplicate would copy
  it twice, and a drag would move it at double speed because both its own move and its
  group's would apply.
- **The selection is pruned in `editProject`, once, for every edit.** "Every id in the
  selection names a live node" is therefore an invariant rather than something each action
  has to remember; `undo`/`redo` prune against the project they restore. That is what let
  `deleteNode` stop clearing the selection by hand, and it is why nothing downstream
  checks whether a selected node still exists.
- **Canvas, tree and keyboard all reach the same actions.** `deleteSelection`,
  `duplicateSelection`, `copySelection`, `groupSelection`, `setSelectionVisible` and
  `nudgeSelection` are the whole multi-object surface, and the single-object case is
  simply a set of one — there are no parallel single-node versions to keep in step.
  `deleteNode` is the one exception, because the tree's row button is about the row it
  sits on and not about what is selected.
- **`groupSelection` anchors on the frontmost selected object**: the group takes that
  object's parent, its place in the draw order and its position, and every selected node
  is recomputed against it, so nothing moves. The originals have to be removed *before*
  the group is inserted — the nodes inside it carry the same ids, and `removeNode`
  recurses, so a group inserted first has its own contents pulled out from under it.
- **The inspector shows a different panel for a set**, with only the operations that mean
  one unambiguous thing for several objects. No position or size fields: there is no
  single number to show, and a field displaying one object's value while writing to all of
  them is the kind of control that loses work. Moving several objects is the drag and the
  arrow keys, both of which apply a *delta*.
- **Align and distribute work on measured bounds, not on stored positions.** A node's
  `x`/`y` is its origin, so lining up `x` lines up origins — which is not lining up
  objects the moment two of them are different sizes, and never is for text or a group,
  whose origins are nowhere near their centres. See "Measured bounds" below.
- **Alignment targets the selection's own bounding box.** Nothing outside the selection
  moves, the object already furthest left stays exactly where it is, and pressing the
  same button twice does nothing the second time — which matters because the second press
  is how someone checks the first. Distribute keeps the outermost pair still and spreads
  the rest by centres, so it cannot walk a layout off the screen; with two objects there
  is nothing in between and the buttons are disabled rather than silently inert.
- **Multi-object scaling and rotation are deliberately not built.** Scaling a set about a
  shared centre is a different gesture from dragging one object's own corner, so the
  handle is hidden when more than one object is selected rather than made to mean two
  things. Rotation is the same rule with a stronger reason: turning a set about a shared
  centre moves every member's *position* as well as its angle — each one orbits the pivot
  — and the gesture model here expresses one world displacement shared by every node,
  which is exactly what an orbit is not. That is a different store action, not this
  gesture with a longer list.

## Measured bounds

`src/core/bounds.ts` holds each node's axis-aligned box in scene coordinates, as the
renderer last drew it, plus the align and distribute arithmetic over those boxes. It is
the one thing the store reads that is not the document.

- **The renderer publishes; nothing computes it twice.** `EditorScene.syncFromStore` ends
  by handing `publishBounds` a box per display object, taken from the same
  `worldBoundsOf` the selection outline, the hit area and the scale handle use — so the
  box an alignment moves is exactly the box drawn around the object. Deriving it from the
  document instead would mean re-measuring text against the font and re-deriving a
  group's union from its children, which is most of what the scene already did.
- **It lives outside the store on purpose.** The scene subscribes to every store change,
  so writing measurements back into the store would have each sync schedule the next one.
  It is a cache of the last frame, never serialised, and no React render reads it.
- **A missing box means "do nothing".** Before the first frame, or for a node the sync has
  not caught up with, `boundsOf` returns undefined and that node drops out of the set —
  treating it as a point at the origin would fling it across the scene.
- **Every world-space move goes through `worldMovePatch`** in the store: the arrow keys,
  align and distribute. It converts a world delta into the node's own parent space and
  applies it as a *difference* against the stored value, so a node in a rotated group
  travels the way the screen says and one moved back and forth lands on the number it
  started on.
- **Compute the moves before opening the transaction.** `beginTransaction` snapshots the
  document whether or not an edit follows, so an alignment with nothing left to do would
  otherwise leave an undo step that undoes nothing.
- **Rotation snapping does not read any of this.** A reader will expect it to, since every
  other geometry tool here does — but an angle is not a box, and the angles it compares
  come from the document through `worldTransformOf`. What it takes from the renderer is
  only the pivots to draw ticks through.
- **Aligning against the scene rectangle is `alignDeltas`' optional `target`**, defaulting
  to `unionRect(boxes)` so the existing behaviour is unchanged byte for byte. It is the one
  alignment a *single* object can ask for — one object's union with itself is itself, so
  every default alignment of one object is a no-op by construction, which is why
  `alignSelection` refuses below two and `alignSelectionToScene` deliberately does not.
  That is also why `AlignSection` now renders for one object with its six union buttons
  disabled rather than absent: a button that silently does nothing is worse than one that
  says it cannot.

## Snapping

`src/core/snapping.ts` is the other half of `bounds.ts`: align tidies a layout up after
it is built, snapping does it while the finger is still down. It is pure geometry over
the same boxes — no store, no scene, no camera — and returns a *correction* plus what to
draw for it.

- **Four kinds of agreement, tried in that order on each axis**: a user-placed guide, a
  shared edge or centre line, an equal gap within a row, then a grid line. The order is
  the strength of the intent behind each — a guide is the only line here the user
  *authored*, an edge is a decision about *those two objects*, a gap is a decision about a
  run, and the grid agrees with everything everywhere. Resolving them the other way round
  has the grid quietly overrule the object you were plainly aiming at. `snapMove`'s
  `resolve` is the whole of that precedence; a fifth kind goes in the same chain.
- **Only one of the four draws a line of its own per axis.** A snap guide means "these
  agree on a line", a spacing bar means "this space is that space", and the grid draws
  nothing at all, because it is already on the canvas — a line along a line that is drawn
  anyway says it twice. A user guide is in the grid's position and for the grid's reason,
  with one difference: a grid is uniform, so "which line caught it" is not a question,
  while with three guides on screen it is. So the *guide itself* turns the snap magenta
  while it is holding the drag — the line already there answering which one agreed, rather
  than a second line beside it. That is what `SnapResult.guideLines` carries; `guides`
  stays empty for a guide snap.

- **The renderer decides what a target is; `snapMove` decides where the move lands.**
  `EditorScene.snapTargetsFor` collects every other drawn object's box plus the scene
  rectangle, once, at `DRAG_START`.
- **The moving set is measured once, at the start, and translated.** Everything in a drag
  takes the same world displacement, so the box after a move is the starting box plus that
  displacement — and re-measuring each frame would feed the snapped position back in as
  the next frame's input, which is a snap that drifts.
- **Three kinds of node are excluded from the targets.** The moving nodes and their
  descendants travel with the gesture. An *ancestor* is subtler: a container's box is the
  union of its children, so a child snapping to its own parent would be chasing a target
  that moves with it. And a hidden object is not on screen, so a guide pointing at one
  points at nothing.
- **The correction is computed once, for the set, in world space** — then folded into the
  pointer position each node is measured against, so `DRAG`'s per-node loop is unchanged
  and a set moves as one piece. Snapping node by node would pull each onto a different
  line and tear the selection apart.
- **The threshold is in screen pixels, divided by the camera zoom at use.** In world units
  it would be unusably sticky zoomed out and unreachable zoomed in.
- **The axes resolve independently**, so catching a neighbour's left edge does not also
  move the object vertically.
- **A snapped axis is not rounded to whole pixels on release.** `finishDrag` has always
  rounded a drag's final position; doing that to a snapped axis would undo by up to half a
  pixel the alignment the gesture had just made. A snapped axis settles on three decimals
  instead, the way a scale does.
- **Guides carry their own extent** — drawn from the dragged object to the object it
  caught on, rather than across the viewport, so they say *which* object agreed. Every
  target that agrees gets one, so dropping a box onto a column of three lights the whole
  column.
- **Guides are two screen pixels wide, like the selection outline.** A hairline is the
  desktop convention and is feedback you cannot see under a thumb, which makes a snap read
  as the editor moving things by itself.
- **A "row" is defined by overlap across the axis, not by proximity along it.** Spacing
  along x only means something between objects that are side by side; two boxes in
  opposite corners have a horizontal gap in the arithmetic and nothing a person would call
  one, so matching it would move things for reasons the user cannot see. The scene
  rectangle drops out of every row by itself — it encloses everything, so every gap it
  would form is negative, and negative gaps are skipped rather than clamped.
- **A single spacing bar is never drawn.** The claim is an *equality*, so one bar is a
  measurement of nothing; `spacingsFor` returns bars only once at least two gaps match,
  and then returns all of them, the way `guidesFor` lights a whole column.
- **The bars carry the number.** Two gaps a few pixels apart are indistinguishable at a
  glance, so bare bars ask the user to take the equality on trust. The labels are pooled
  `Text` objects scaled against the camera zoom — a drag creates and drops them several
  times a second, so they are parked rather than destroyed.
- **The grid is drawn from a signature, not every frame.** Its lines are one screen pixel
  wide, so a pinch has to redraw it and a store subscription alone would not — but it can
  be hundreds of segments, so `drawGrid` compares `gridSize:zoom:width:height` and does
  nothing when they match. Below `MIN_GRID_PIXELS` a square it stops drawing entirely
  while snapping carries on: it is the drawing that has nothing left to say, not the
  geometry.
- **Both toggles are expressed by withholding input, not by a flag the geometry reads.**
  `snappedPointer` passes no targets when object snapping is off and no pitch when the
  grid is off, so `snapMove` has one code path and cannot disagree with the toolbar.
- **The two pitches — the grid's and the angle step's — are editor state, and their
  fields are `undoable={false}`.** Every other
  `NumberField` opens a transaction on focus, and `beginTransaction` snapshots the
  document whether or not an edit follows — so a field that never touches the document
  would push an undo step on every click, and Ctrl+Z would spend its first press undoing
  one.
- The toggle is `store.snapEnabled` — editor state, like `lockAspect` and `multiSelect`,
  never saved. It lives in the toolbar rather than a panel because it changes what a drag
  does, and on mobile a panel is a sheet covering the canvas you are dragging on.
- Snapping applies to the drag and to the rotate gesture, and to nothing else. Arrow-key
  nudges and align/distribute are exact already, and a snap on a 1px nudge would fight the
  user rather than help.

**Guides** (`SceneGuide` in `schema.ts`, `guideOffset` in `snapping.ts`) are the one part
of this family that is document state, and everything below follows from that.

- **They live on the scene, and `SCHEMA_VERSION` did not bump.** A guide is a line in a
  *scene's* coordinates, so a project-level one would be off the edge of a smaller scene.
  The version stayed at 3 because the rule is "would a deployed older build break", and a
  v3 build does not: `parseProject` passes `scenes` through verbatim, nothing there reads
  `scene.guides`, and `editScene` spreads — so an old build opens the file, draws it
  identically, and carries the guides back out on a re-save. That is the opposite of the
  `container` bump, where an unhandled type crashed the renderer. **The no-bump decision
  is contingent on that spread**: if `parseProject` ever starts reconstructing scenes field
  by field, an old build silently drops guides on every save, which is data loss with no
  crash. `guides.spec.ts` asserts the version in the saved artefact so a future bump is a
  deliberate act.
- **`guidesOf` is the only reader**, and it is both the default for older files and the
  validator for hand-edited ones — the job `parseAssets` does for the asset table. Scenes
  are the one part of an opened file that is not rebuilt field by field, so a `?? []` at
  each call site would be trusting a string from disk five times over.
- **They are lines, not zero-width boxes.** Folding them into `targets` would work for the
  offset, and then `guidesFor` would redraw the line already on the canvas, and
  `bandOverlap` would enrol the guide in equal-spacing rows as a phantom object forming
  gaps nobody can see.
- **One toggle, two effects.** Guides ride on the magnet (`snapEnabled`) rather than a
  third switch — the same call the angle step made — and `guidesVisible` hides them *and*
  withholds them from `snapMove`, by the rule that already keeps hidden objects out of the
  targets. Both are still expressed by withholding input, never by a flag the geometry
  reads.
- **A guide is drawn as an interactive `Rectangle` per guide, not a signature-driven
  `Graphics` like the grid** — a `Graphics` cannot be hit-tested line by line, and being
  grabbable is the whole point. Depth 998: above the objects (a guide behind a rectangle is
  neither visible nor grabbable), below the snap overlays and the handles at 999+.
- **Its grab band is 24 screen pixels, not the handles' 44, and that is not a
  compromise.** The handles are *point* targets; a guide is a line, unbounded along its
  own axis, so only one coordinate has to be right — a far easier target at the same
  width. And the band steals every press inside it from the objects underneath, across the
  whole scene: 44px is ~119 scene units of unpressable canvas per guide at the mobile
  zoom. Re-apply the hit area every frame against the zoom, like both handles — `setSize`
  does not carry it.
- **Hidden guides are `disableInteractive()`, not merely invisible.** `setVisible(false)`
  does not stop Phaser hit-testing, so a switched-off guide would go on stealing presses
  with nothing on screen to explain why.
- **A guide is exempt from the two-step touch rule**, like the two handles and for the
  same mechanical reason — it carries no `nodeId`, so the `DRAG_START` comparison would
  reject every guide drag made with a finger — and on its own merits: that rule exists
  because a fingertip lands on whichever *object* it grazed, and a guide is chrome aimed
  at deliberately. Its branch has to come before the rule, as theirs do.
- **`draggingGuide` is cleared before `endTransaction()`**, the `draggingId` trap exactly.
- **A guide drag does not itself snap.** A guide is the thing objects snap *to*, so
  pulling one onto an object's edge would only say that edge twice; a guide on a round
  number is the grid's job and the inspector row's.
- **Dragging one off the scene deletes it** — the convention every editor with rulers has,
  and the one deletion gesture that costs no chrome on a 390px screen. Inside the drag's
  own transaction, so it is one undo step. The inspector's per-guide row is the other way,
  and the one that reaches a guide dragged somewhere a finger no longer can.
- **There are no rulers, and that is deliberate.** A ruler is a place to drag a guide
  *from*; it costs ~24px of chrome on two edges of a 390px viewport, and drag-out from a
  DOM strip onto a WebGL canvas is a cross-boundary gesture with no touch story. Two
  buttons in the Snapping section say the same thing, and the gesture that actually has to
  work under a thumb — *moving* a guide — is identical either way.

**Rotation snapping** (`snapRotation`, same module) is the same shape one dimension over:
a correction plus what to draw, resolved by a first-non-null chain.

- **Two kinds, in the same order and by the same argument**: another object's angle, then
  a fixed step. Agreeing with a specific object's tilt is a decision about those two
  objects; the step agrees with everything everywhere.
- **The toggles map onto the two kinds the way the words already mean.** The magnet is
  "agree with another object", so it governs the neighbour angle; the grid is "quantise to
  a regular pitch", so it governs the step. Each toggle now governs one more thing, and a
  390px toolbar that already clips does not have to hold a third. Both are still expressed
  by *withholding input* — no targets, or a step of 0 — never by a flag the geometry reads.
- **The threshold is in degrees and is deliberately NOT divided by the camera zoom.** This
  is the one place the rotation path contradicts the position one, so do not "fix" it.
  `SNAP_THRESHOLD` is divided because a translation's size on screen is its world size
  times the zoom — the quantity being snapped changes size as the camera moves. An angle
  does not: 5° is 5° at every zoom, and dividing would correct for a distortion that is
  not there, making the snap unreachable zoomed in on a gesture that has become no more
  precise. The grip does change angular sensitivity — at radius r a pixel of finger travel
  is 1/r radians — but the knob sits a fixed *screen* distance from the object, so that
  radius barely varies with the camera either, and a user who has gripped close in has
  chosen a coarse gesture rather than earned a wider capture. The payoff shows up in the
  suite: this is the one threshold that is the same number on both projects.
- **Equality is modulo 360, not 180.** A rectangle turned half a turn looks unchanged, but
  that is a property of that one object's symmetry, not of rotation: 190° and 10° are
  upside down from each other, and for text or a sprite that is the whole point.
- **The scene rectangle is a target for a move and not for a turn.** It has no tilt of its
  own to agree with, and offering it as "an object at 0°" would have the magnet quietly do
  the step's job — upright would snap with the grid switched off, which is not what either
  toggle says.
- **An angle agreement has no locus, and the drawing admits it.** A guide works because a
  shared line is somewhere both objects genuinely sit, so drawing it *is* the agreement.
  Two objects at 37° share only a direction, which has no position, so any tick drawn for
  it is drawn somewhere chosen. The ticks therefore do the `guidesFor` job — saying
  *which* objects agreed, all of them — and the degree readout carries the claim itself,
  exactly as the spacing bars' numbers do. Never ship the tick without the label.
- **A step snap draws only the readout.** That is the grid's rule inside out: the grid
  draws nothing because it is already on the canvas and a guide would say it twice, while
  there is no protractor on the canvas at all, so the number is not a second saying of the
  feedback — it is the whole of it.
- **The readout appears only while something is holding the angle**, so a number on screen
  means what a guide means rather than being a permanent instrument.
- **A rotation settles on three decimals always**, unlike a position, which rounds to
  whole pixels unless a snap is holding. `tidyTransform` already settles rotation that way
  everywhere else, and whole degrees would destroy exactly the agreements this gesture
  exists to make — a neighbour match at 37.5° would not survive them. It is wrapped on
  release too: the document cannot express "the user spun it three times" anyway, since
  the renderer takes it mod 360 and so does the exported `setAngle`.
- **One label pool, with the counter in `update()`.** The rotate readout and the spacing
  distances are the same styled chip and the two gestures can never be in flight at once,
  so a second pool would be the same styling written twice. But the hide loop has to live
  outside both drawers: scoped to one, whichever ran second would blank the other's label.

## Interaction model

Touch and mouse deliberately differ, keyed off `pointer.wasTouch`:

- **Mouse:** press on an object selects it *and* starts the drag in one gesture.
- **Touch:** the first press only selects; only the already-selected object can then be
  dragged. A fingertip covers far more than a cursor, so honouring the first touch as a
  drag moved whichever object it happened to graze.

`DRAG_START` must compare against `EditorScene.selectionAtPress`, not the live
`selectedId` — `GAMEOBJECT_DOWN` has already selected the object by then, so the live
value always matches and the two-step rule silently stops working.

The two handles — the corner scale handle and the rotate knob — are the one thing exempt
from that rule. Neither carries a `nodeId`, so the `DRAG_START` comparison would find
`null !== selectionAtPress`, decide they differ and reject every scale or rotate drag made
with a finger — the handle branches have to come first. They also only exist while
something is selected, so the two-step rule has already been satisfied by the time either
can be touched.

**The rotate knob is parked outside the object, not on a corner, and that is the
load-bearing part of it.** The scale handle's 44px target already swallows a small
object's own centre at the mobile project's zoom; a second 44px target anywhere *on* the
object would leave its middle inside both and make it undraggable rather than merely
awkward. Parked a constant *screen* distance beyond the middle of the object's own top
edge — in the object's frame, so it carries the tilt — the collision is impossible by
construction however small the object gets. Its direction comes from the world matrix
rather than from any stored angle, the same way `cornerOf` transforms a point instead of
adding rotations up. It is an `Arc`, and it is resized with `setRadius` rather than
`setDisplaySize`: `setRadius` resizes the geometry and with it `width`/`height`, which is
what keeps the hit area in world units. Scaling it instead leaves the hit area in *scaled*
units and makes the 44px target wrong by the zoom squared.

Rotation resolves in the object's parent space like every other gesture, and here that
does more work than usual: both the grab angle and the current angle are measured there,
so a container's own rotation cancels out of their *difference* exactly and what comes out
is the change in the local angle — the number the document stores. Nothing composes or
inverts a rotation by hand. The angle it starts from is read from the document rather than
from `object.rotation`, which is radians and a derived copy; round-tripping through it is
the drift `tidyTransform` exists to clean up. And every angular difference is wrapped into
(-180, 180]: without that, a pointer crossing the half turn spins the object all the way
round the other way.

Scaling resolves against the state captured at `beginScale`, not against the previous
frame, so dragging out and back returns the object to the size it started at. The maths
runs in the object's own unrotated frame (a rotated object scales along its own axes),
and with the aspect lock on it projects the pointer onto the starting diagonal rather
than copying one axis onto the other — copying makes the object lurch whenever the drag
is more vertical than horizontal. `store.lockAspect` is editor state, not document state,
and both the handle and the inspector's Scale fields go through `scaleNode` so the lock
cannot mean two different things.

Building a selection and moving one are separated on purpose: while an additive press is
in force — the scene tree's **Multi** toggle, or Shift/Ctrl/Cmd on a desktop —
`GAMEOBJECT_DOWN` toggles membership and `DRAG_START` refuses outright. A press that both
extended the selection and began dragging it would move everything already picked every
time another object was added. The cost is that `multiSelect` has to be switched off again
before the selection can be dragged, which is the trade a phone with no modifier key
forces; the toggle sits in the tree header, with the rows whose meaning it changes.

`EditorScene.dragging` is now the whole of moving things: a list of nodes, each with the
position it started at, plus where the pointer was when the gesture began. Every node in
it follows the pointer's own displacement, converted into that node's own parent space, so
objects in differently transformed groups still travel together. That replaced both the
plain `dragX`/`dragY` path and the group-proxy path — Phaser's `dragX`/`dragY` describe
only the object actually under the pointer, which is the wrong object for a group and for
every object in a selection but one. The two agree exactly for a single-object drag,
priming distance included, which is why the existing drag tests did not move.

`src/ui/MoveBar.tsx` makes that rule visible on mobile: it appears on selection and gives
the move an explicit ending (✓ keep, ✗ put it back, using the `moveOrigin` snapshot the
store takes in `select()`).

## Code export

`src/io/exportPhaser.ts` turns the document into real Phaser code: a Scene class in
TypeScript or JavaScript, and a self-contained runnable HTML page. It is a pure function
of the document, which is the payoff for keeping Phaser a renderer.

The three outputs cover the three real cases without overlapping. `.ts` and `.js` are ES
modules that import Phaser, for a bundler-based project; the runnable page is the
script-tag flavour where Phaser is a global. The `create()` body is plain JavaScript in
both languages, which is what lets the HTML embed it verbatim; the two differ only in
annotations — the `: void` on the methods, and the parameter and return types on the prefab
factories. That second one is not a style choice: the exported `.ts` is compiled under
`tsc --strict` by `export-toolchain.spec.ts`, and a bare `function createCoin(scene, x, y)`
is three implicit `any`s and three errors. (It *was* one token, before prefabs; the
property that actually mattered — one generator, so the runnable page cannot drift from
the file you ship — is unchanged, because both outputs still call the same
`buildFactories` and the same `emitNode`.)

Both outputs share `buildCreateBody`, so the runnable page can never drift from the
file you ship. Adding a node type means adding a `constructorFor` case; under `strict` a
missing case is a compile error there (the declared return is `string | null` and the
switch stops being exhaustive), but `modifiersFor`, `collectAssets`, `usedIn`,
`missingReason`, `collectAnimations`
and `emitNode` are none of them exhaustive over the union, so check those by hand — a
missed `collectAssets` branch is the one that produces a plausible-looking export drawing
a missing-texture square.

`EmitContext` carries what the emitter needs beyond the node, and exists for one field:
`receiver`. The same emit runs inside a Scene method, where objects are added to `this`,
and inside a prefab factory, where they are added to the `scene` it was handed. One
generator, two receivers — a second copy of the emitter for the factory case is exactly
the drift that sharing `buildCreateBody` exists to prevent.

Groups are emitted flat: the container's `const`, then its children's, then one
`group.add([child, …])`. Nesting the children inside a literal would read worse and would
cost the reader a binding per object — every object in the scene stays reachable by name,
which is the point of emitting names at all.

An atlas-cut image adds an `ATLASES` object beside `ASSETS` and loads through
`this.load.atlas(key, ASSETS[key], ATLASES[key])` — the frame data inline, because Phaser's
loader takes an object where a URL would go. It is a *projection* of `ASSETS` rather than a
second collection, so nothing in `collectAssets`, `usedIn` or `EmitContext` knows about it;
on this checklist a table with no `collect*` beside it reads exactly like a missed step.

Images are emitted as an `ASSETS` object literal at the top of the output, and a
`preload()` that loads from it (`this.load.image(key, ASSETS[key])` — Phaser's loader
detects `data:` URLs itself, see `File.js`). Three things about that shape are deliberate:
only assets the scene actually *uses* are emitted, so a deleted-from-the-scene image
doesn't ship a megabyte; the table is a named const rather than inlined, so swapping
embedded bytes for real paths is one object to edit; and a scene with no images emits no
table and no `preload()` at all, so shape-only projects export exactly what they always
did. A sprite with no image emits a comment saying so rather than nothing — an object
silently missing from an export reads as an exporter bug.

Generated code is built from free user text, and the escaping is not optional:

- Object names become JS identifiers (`toIdentifier`) — they can be blank, start with
  a digit, or repeat, so it strips, prefixes and de-duplicates.
- **Embedding JS in HTML needs more than `JSON.stringify`.** An HTML parser ends the
  script at the first literal `</script>`, inside a JS string literal included. A
  project whose text contained one produced an export that would not run *and* could
  execute arbitrary markup in whoever opened it. `escapeForScriptTag` handles that plus
  `<!--` and U+2028/9.
- **`generateRunnableHtml` composes the whole script and escapes it once, at the end.**
  It used to escape fragment by fragment, and that is how the scene name and the
  background colour shipped raw for a release: both are interpolated straight into the
  script, and nothing about `str(...)` at a call site says whether the result is about to
  be embedded in HTML. Composing first means a newly added interpolation cannot be
  forgotten — there is only one place left to forget. Do not reintroduce per-fragment
  escaping.
- The document title, the CSS background colour and the CDN version all come from the
  project file, so they are escaped or validated rather than interpolated raw.

## Play

The Play button runs `generateRunnableHtml`'s output in a sandboxed iframe over the editor,
and Stop throws that document away. It closes the hole every "drawn, never run" paragraph
above has been leaving open since iteration 16: the editor emits physics, colliders, keys,
touch buttons, rules, camera effects and an `update()`, and until now the only way to see
any of it was to download a file and find something to open it with — which on a phone is
most of the way to impossible, in an editor whose first claim is that mobile is a
first-class target.

- **This is the first iteration that changes the document not at all**, and that is the
  sentence the rest of it follows from. Every one before added a type, a table or a field.
  There is no `SCHEMA_VERSION` question to answer, no new reader in the `guidesOf` /
  `tileMapOf` family, no parser, no `collect*`, no `EmitContext` field, no inspector
  section — and `EditorScene.ts` is untouched for the fifth time, after Audio, Rules,
  iteration 29 and iteration 31. What it adds is a window.
- **Not one refusal weakens, because none of this happens on that canvas.** The line
  physics drew — *a step rewrites the numbers the document is made of, so there is no
  version of "run it for a moment" that leaves the document alone* — is about the
  **editor's** canvas, and the editor's canvas is not what is running. The game is a
  different document with a different Phaser in it, and the thing that ends it is the
  DOM node going away. `hasMotionIn` is untouched and records its **ninth** refusal, which
  is the one a reader will expect hardest of all to be wrong: a game is nothing but motion.
  But that toggle exists so a canvas moving *by itself* can be stopped, and nothing here
  moves the canvas at all — the canvas is behind the overlay, drawing what it always drew.
- **The exported page is the product, so Play runs it unmodified.** Not a second renderer,
  not "the editor's scene with physics switched on", and not a reduced build: the bytes in
  the frame are the bytes of the `.html` the Export button downloads, one URL apart. That
  is what makes this a *window* rather than a second implementation, and it is the property
  every decision below is protecting.
- **`generateRunnableHtml` gained one optional parameter and nothing else.** `phaserSrc`
  overrides where the runtime is fetched from; omitted, the CDN URL is built exactly as it
  was, so every exported file is byte for byte what it was — the rule the asset table, the
  tilemap helper and the prefab factories all follow. An argument rather than a second
  generator is `EmitContext.receiver`'s call one layer out: one page, two places it can
  run, and a second copy of the composer is precisely the drift that sharing
  `buildCreateBody` exists to prevent.
- **Play does not touch the network, and that is what the parameter is for.** This editor
  is served from Pages, works offline, and has never made a request in its life; a Play
  button that fails on a plane is not this editor's Play button. So the frame loads the
  copy of Phaser the app itself ships, which is the same `phaser.min.js`
  `tests/export.spec.ts` has been answering the CDN with since the export existed — Play is
  that harness, in the editor. `play.spec.ts` counts jsDelivr requests and asserts zero,
  *fulfilling* rather than aborting them, because an aborted request makes a broken Play
  look like a passing test.
- **The runtime is imported by path, not by specifier, and the reason is worth keeping.**
  Phaser's package `exports` map has no deep entry — `"."` and `"./package.json"` only — so
  `import 'phaser/dist/phaser.min.js?url'` does not resolve at all, and the relative
  `../../node_modules/…?url` is what reaches the file. It is the minified **IIFE** build
  rather than the ESM one because the page is unchanged: a classic `<script>` expecting
  `window.Phaser`. `tsconfig.app.json` already carries `"types": ["vite/client"]`, so `?url`
  needs no declaration. The cost is ~1.4 MB of asset in `dist/`, fetched only on a press.
- **The one honest difference, recorded rather than hidden**: a downloaded export runs
  under the Phaser the *project* pins, and Play runs under the Phaser the *editor* bundles.
  For anything made in this editor they are the same version; for an old file they can
  differ. Fetching the pinned one instead would be the network dependency above.
- **`sandbox="allow-scripts"` and nothing else.** An opaque origin, so the game cannot
  reach `parent`, `localStorage` or the autosaved draft. A classic script from this origin
  still loads (no CORS on those), WebGL still works, and the `?url` import is absolute so
  srcdoc's inherited base URL is not a question. `srcdoc` rather than a blob URL: no
  origin-partitioning question and nothing to revoke, and the ~5 MB localStorage draft
  already caps a project inside what an attribute holds.
- **What the sandbox costs is an error channel, and that is a refusal rather than a
  to-do.** The overlay cannot read an opaque-origin frame, and giving the page a
  `postMessage` would mean changing the bytes the export ships — the one property this
  whole feature exists to preserve. Errors reach the browser console named by frame, which
  is where a developer tool should put them.
- **`position: fixed; inset: 0`, never a slot in the layout**, and this one is load-bearing
  rather than convenient. Giving the game a share of the flow would resize `.app__center`,
  and resizing the viewport re-fits the editor's camera — which is the
  `game.scale.getParentBounds()` trap, entered on the way in and again on the way out.
  Nothing underneath moves, so there is nothing to put back.
- **Restart is a new realm, not a resumed one.** It re-keys the iframe, which discards
  every texture, timer, tween, listener, `FontFace` and sound the old one held. That is why
  there is no teardown here at all — the four bookkeeping maps `EditorScene` keeps on
  SHUTDOWN exist because a texture belongs to the *game* and a face to the *page*, and
  nothing outlives a discarded document. It is the widest version of that rule and the one
  where it costs nothing.
- **The game takes the keyboard, so Stop is a button and there is no Escape.** This is the
  one place Play breaks a convention this editor keeps everywhere else — Escape backs out
  of paint mode and out of a selection, and it does not back out of a running game. Phaser
  focuses its own canvas as it boots, so the iframe becomes the editor's `activeElement`
  and every key after that belongs to the game, which is **correct**: a driven object is
  read with the arrow keys, and an editor stealing one back would be an editor breaking the
  game it is running. A shortcut would therefore work for the moment between the press and
  the boot and never again, and a half-present behaviour reads as a broken one — this
  file's most-repeated lesson, arriving on a keyboard. `App.tsx` still returns early on
  `playing`, because focus *does* come back out: the overlay's own bar is in this document,
  and a press on Restart leaves it holding the keyboard until the next boot. Found by a
  test, not by reasoning — the first version had an Escape branch and it failed on the
  first run.
- **The page is a snapshot, and there is no hot-reload question to answer.** The overlay
  covers the toolbar, the tree and the inspector, so *nothing on screen can make an edit
  while the game runs* — which means the snapshot property is not a rule anybody has to
  remember, and also that it cannot be asserted through the UI. `PlayFrame` reads the
  project through `getState()` rather than a selector for that reason: a subscription could
  only ever cost a re-render and a regenerated multi-megabyte string on a store change
  nobody asked for, an autosave landing being the obvious one.
- **`playing` is editor state in the `previewMotion` / `snapEnabled` / `lockAspect`
  family** — never saved, never dirty, never undoable — and deliberately **not** persisted
  through `io/prefs.ts` the way the section state is: the shape of a tidied panel is worth
  having back after a reload, and a running game is not. Nothing prunes it the way
  `paintingId` is pruned, because there is nothing here to dangle; `loadProject` and
  `resetProject` do clear it, since a game whose project has been replaced is a game no
  document describes.
- **It is not `previewMotion` and the toolbar says so with a different mark.** Preview
  animates the *document's* canvas and is the one moment that canvas stops mirroring the
  document; Play runs a *game*. `PlayIcon` is a triangle inside a screen rather than a
  second bare triangle, because a project with something that moves has both controls on
  screen at once — and the accessible names are `Play game` and `Preview motion`, never a
  bare `Play`, by the rule that already gives prefab buttons a `+ ` prefix and scene chips
  a `Switch to `.
- **In both layouts, where every Export control is desktop-only.** Play is worth most on
  the device where downloading an `.html` and finding something to open it with is hardest,
  and unlike the three Export buttons it produces nothing to file away, so it costs the
  File sheet nothing to leave it in the toolbar. A 390px toolbar already clips when
  everything is shown, which is why `play.spec.ts` asserts the button's right edge is
  inside the viewport rather than only that it exists.
- **The suite's instrument is `EditorPage.findInPlay`, and it is the first reading in this
  harness that does not go through `shot`.** It screenshots the **iframe element**, because
  the editor's canvas is behind the overlay and reading that reports the scene the game was
  generated *from* rather than the game. There is no band to clip — the move bar and the
  toast are the editor's and the overlay covers both — and, the simplification worth saying
  out loud, **an export draws no editor chrome at all**, so the fixture-colour clearance
  list every other spec is shaped by does not apply in there.
- **Every claim about the game is about travel, in scene units, through
  `EditorPage.playScale`.** The exported page asks for `Scale.FIT`, so a 960x540 scene
  letterboxed into the mobile project's 390x792 frame draws about 219 pixels tall — a
  threshold measured against the *frame* is most of the game on one project and a fifth of
  it on the other, which is the shape of a test that passes on one and quietly measures
  something else on the other. It cost the first run of `play.spec.ts` two tests.
  `playScale` is `zoom`'s sibling and derived the same way: from the arithmetic the thing
  being measured actually uses.
- **`reaches` moved to `tests/helpers/poll.ts`.** A simulation is now reached by two
  specs — `export.spec.ts` running the page as a file and `play.spec.ts` running it in the
  editor — and it is the instrument both need for the reason it records: what a running
  game is doing at one wall-clock instant is a race with the frame rate.
- **The load-bearing claim is the negative one**, and it is the assertion that fails the
  day somebody wires a simulation into `EditorScene`: the faller falls in the frame, and
  when Stop comes the object is drawn where the document put it, the inspector reads the
  authored `y`, and the saved bytes hold it. `tweens.spec.ts`' byte-for-byte claim one
  level up — there a preview was allowed precisely because its result was thrown away, and
  here nothing was ever written to throw away.
- **What Play refuses.** **No hot reload** — see the snapshot note above; Stop then Play is
  the edit-to-run path. **No pause, step or inspect** — that is a debugger and a different
  tool. **No choosing a scene** — Play boots the active scene because that is what Export
  already decides, and a second answer is two fields over one number. **No error panel** —
  the sandbox note above. And **nothing reads anything back out of the game**: a running
  game cannot edit the document, which is the whole reason it is allowed to run.

## Verification

`npm test` runs a committed Playwright suite against the **production build** (its
`webServer` builds and previews `dist/`, so the base path and the real bundle are part of
what is under test). CI runs it on every pull request via
`.github/workflows/ci.yml`. Two projects, always both: **desktop 1440×900** and
**mobile 390×844**, because the layout, the file dialogs and the whole touch interaction
model differ between them.

```
tests/
  editing.spec.ts           add → select → drag → inspector → undo → save → reopen
  multi-select.spec.ts      building a selection, then moving, grouping, duplicating it
  align.spec.ts             aligning and distributing it, by edges rather than origins
  snapping.spec.ts          a drag landing on an edge, an equal gap or the grid
  rotation.spec.ts          the rotate knob, and an angle landing on a neighbour or a step
  guides.spec.ts            placing a guide, dragging it, and a drag agreeing with it
  animation.spec.ts         slicing a sheet, drawing one frame, playing a clip
  atlas.spec.ts             an image cut into named frames of unequal size, and repacked
  prefabs.spec.ts           saving a prefab, placing it twice, editing it once, and
                            renaming or deleting it from the library
  tilemap.spec.ts           slicing a tileset, painting it, filling and erasing, and
                            layering it: which one is on top, hidden, moved and resized
  particles.spec.ts         an emitter stopped, previewed, reconfigured and cleared
  tweens.spec.ts            a destination drawn, a preview that runs it, and a
                            document that never moves
  effects.spec.ts           a glow drawn outside the object it is on, a blur that
                            takes its fill away, and a list that keeps its order
  masks.spec.ts             an object painted only where a picture is opaque,
                            inverted, unpointed when its image goes, and still
                            masked after a cold open
  blend.spec.ts             an object composited over what is behind it, a mode
                            that round-trips, and an emitter that keeps the one
                            it was written with
  nineslice.spec.ts         a panel whose corners hold, and a texture that repeats
  typography.spec.ts        a stroke, a wrap, an alignment, and a style that round-trips
  fonts.spec.ts             a font imported, drawn, round-tripped, removed and exported
  physics.spec.ts           a body drawn, never simulated, sized to hold what it is
                            turned with, round when asked, and refused inside a group
  matter.spec.ts            a scene switched to Matter: a body that turns, dials that
                            replace Arcade's, both sets kept through the switch, a
                            round body both engines agree on, and controls that
                            survive the engine change
  behaviour.spec.ts         solid tiles, a collision row, an object the keys drive, and
                            the buttons a thumb will drive it with
  rules.spec.ts             a variable declared, a rule built and refused, a caption
                            written, a camera shaken, a number watched, a prefab
                            marked for building at a point or at an object,
                            an object pushed or moved — and a canvas
                            that runs none of it, builds none of it, moves none
                            of it, and does not move when the camera does
  labels.spec.ts            a caption that follows a variable, formatted, and a
                            binding that falls back when the variable is gone
  inspector.spec.ts         the properties panel's sections: closed by default,
                            remembered, persisted, and never in the document
  audio.spec.ts             a sound imported, registered, saved, reopened and exported
  camera.spec.ts            a camera drawn, clamped, followed, saved and exported
  parallax.spec.ts          an object pinned to the camera, drawn where the game will
                            put it, refused inside a group and repaired from a bad file
  scenes.spec.ts            a second scene: switching, saving, duplicating, exporting
  assets.spec.ts            image import, decode-on-open, removal
  play.spec.ts              that page run in the editor: a body that falls, and a
                            document that does not move while it does
  export.spec.ts            the runnable page, actually run
  export-toolchain.spec.ts  the .ts under tsc --strict, the .js through a Vite build
  helpers/editor.ts         the page object: panels, fields, gestures, downloads
  helpers/pixels.ts         canvas readback, colour centroids and colour extents
  helpers/hostile.ts        the project made of everything a project should not contain
  helpers/png.ts            solid, striped, framed, marked, rect-painted and
                            half-transparent PNGs — the last for masks, which
                            read alpha where everything else reads colour
  helpers/atlas.ts          an atlas image and both packer JSON shapes, from one array
  helpers/wav.ts            a synthesised WAV, for the same reason and with no encoder
```

Adding a node type means adding to `editing.spec.ts` (it draws, it drags, it survives a
save) and to `helpers/hostile.ts` (any new string that reaches the exporter). The hostile
project now nests a rectangle inside a hostilely-named group, so both export paths run the
nested emit and the `add([...])` list, not only the flat one — and holds a hostilely-named
prefab, placed twice plus once danglingly, whose own children include a *sprite*. That
sprite is not decoration: it is the only thing that fails if `collectAssets` stops
descending into definitions, and the failure it catches is an export that boots and draws
a missing-texture square rather than one that errors. Since iteration 34 it holds a
**second** prefab that nothing places at all, built only by a rule's `spawn`: that one is the
only thing in the suite that fails if `collectPrefabs` or `emittedNodes` stops reaching a
definition a *rule* names — the same failure arriving from the side no node walk can see —
and its own labelled text child is the only thing that fails if `collectLabels` loses the
`project` it needs to look inside one. It also holds a hostilely-named
emitter with a non-default value in all eighteen of its fields, plus one with no image.
The first carries no free user text to escape and is not there for escaping: it is the
only place the emitted config literal's *shape* meets `ParticleEmitterConfig` under
`tsc --strict`, which is where a Phaser config key renamed between versions would fail and
nowhere else.

That emitter is also, since iteration 36, the only thing in the suite carrying a **pre-v15
blend mode** — the mode on its props with no node-level field beside it, a shape only a hand
edit or an older build can hold. It is the one fixture that fails if `blendModeOf`'s
migration is dropped, and the reason `export.spec.ts`' `blendMode: "ADD"` assertion goes on
passing unchanged, which is that migration reaching the exporter. Beside it the booted scene
carries an `ADD` node and the registered-never-started scene a `MULTIPLY` one — the booted
one costs that frame nothing where a filter cost it seconds, which is why a blend can sit
there and three of the four filter kinds cannot.

It holds two sounds and four scene rows registering them, for the reasons the emitter and
the bodies are there: a hostile *file name*, because that name becomes the audio cache key
through `toIdentifier` and is the one identifier in the output a person is told to copy by
hand; a plainly-named `jump.wav` beside an object called "jump sound", which is the only
test that handles are allocated before object bindings are; two rows on one file, so the
de-duplication runs; one row pointing at a sound that is not there, which only a hand-edited
file can hold; and a third sound no scene registers at all, which is what proves the export
carries the scene rather than the workbench.

It holds five physics bodies for that same kind of reason: one dynamic with a non-default
value in every field, because that toolchain is the only place the emitted setter chain
ever meets `Phaser.Physics.Arcade.Body`; two static, so `add.existing(obj, true)` reaches
both toolchains; and two the export must *not* emit — one nested in a group and one inside
a prefab definition, neither of which the store can reach to write, so only a hand-edited
file can hold them. Its object named "arcade body" is the only test of `bodyFn` being
allocated from the module's identifier set before any object draws from it: without it, an
object bound as `arcadeBody` inside `create()` would shadow the function the line beside it
calls, and the export would still compile.

Two traps the particles suite hit, both worth knowing before writing a fixture:

- **A fixture colour has to clear the editor's own chrome, not just the other objects.**
  The obvious cyan for a particle texture is `#00e5ff` — which is `SELECTION_COLOR`, and a
  freshly added node is selected, so `findDrawn` counted the outline drawn around the very
  emitter under test and reported particles that were never emitted. The chrome to clear
  is the outline `0x00e5ff`, the guides `0xff3ea5` and `0xffa723`, the frame `0x5a6478`,
  the emitter marker `#ff6bd6` and the scene `#1d2330`.
- **A whole-file `not.toContain` assertion is a shared resource.** The prefab export test
  asserted the string "no image chosen in the editor" was absent from the entire output,
  as its way of proving `collectAssets` descends into definitions. Adding a deliberately
  image-less emitter to the hostile project made that string *correct* output and broke a
  test about something else. Scope such an assertion to the region whose behaviour it is
  actually about — there, the factory body.

One trap the multi-select suite hit immediately: **adding an object selects it**, so a
freshly added object is already in the selection and an additive tap on it takes it back
*out*. A test building a selection from scratch has to clear it first — a press on empty
canvas — or it silently ends up with one fewer object than it thinks.

**Assert what is drawn, not just what is stored.** The drag bug that prompted all this
passed every store-level assertion — the document held the right coordinates the whole
time while the canvas showed something else. Every canvas check goes through
`EditorPage.findDrawn`, which screenshots the canvas and returns the centroid of a colour.

Traps, each of which produced a confident wrong answer at some point:

- The move bar and the toast float *over* the canvas, and the move bar's confirm button is
  `--accent` — the same colour as the default rectangle fill, so it was counted as part of
  the object. `EditorPage.shot` clips that bottom band off. Clip the screenshot, but
  compute pointer coordinates from the *full* canvas box, or the touches land in empty
  space and every assertion silently reads "nothing moved".
- **Read the canvas with Playwright's element or page screenshot, never by drawing it into
  a 2D context in the page.** Phaser runs WebGL without `preserveDrawingBuffer`, so a
  readback after the frame is composited returns solid black — and the centroid of nothing
  looks exactly like "the object isn't drawn". `deviceScaleFactor: 1` keeps screenshot
  pixels 1:1 with CSS pixels, which is what lets a centroid be compared with a box.
- **Headless Chromium exposes `showSaveFilePicker` but can never resolve it** (there is no
  UI), so a save test hangs forever. `EditorPage.open` deletes it in an `addInitScript`,
  which also makes both projects exercise the download/`<input>` path a phone takes.
- **Phaser starts a drag only after 8px of movement, and captures the pointer-to-object
  offset at that moment** — so every drag leaves the object behind by however far the
  pointer had travelled when the drag began. That is editor behaviour, not a harness
  artefact. `EditorPage.drag` sends one deliberate priming move and waits a frame, so the
  distance is a known constant instead of whatever the machine's frame timing made it, and
  returns the displacement the object should actually take.
- **Emulated touch is not real touch.** The touch gestures go through CDP
  `Input.dispatchTouchEvent` (Playwright's mouse would take the desktop branch and never
  exercise the two-step rule), and CDP bypasses the browser's own gesture heuristics. The
  `pointercancel` bug reproduced perfectly on a phone and not at all in the harness. Treat
  a clean run as necessary, not sufficient.
- On mobile the panels are **modal sheets over the canvas**, closed ones translated
  off-screen rather than hidden — so they still match locators, and a tap aimed at the
  canvas lands on them. `openPanel`/`closePanels` handle it; call `closePanels` before any
  canvas interaction. A sheet also resizes the viewport, which re-fits the camera.
- The export toolchain specs shell out to `tsc` and `vite`, so that file runs its tests
  sequentially (`describe.configure({ mode: 'default' })`) even though the rest of the
  suite is fully parallel. Two compilers competing with the browsers is how it went from
  ten seconds to a four-minute timeout.
- **The snap threshold is much wider in world units on the mobile project.** 8 screen
  pixels divided by a zoom of ~0.37 is about 22 scene units, against ~9 on desktop. A
  fixture meant to isolate one kind of snap has to clear *every* line of *every* other
  object by more than the mobile figure — the spacing tests' tall narrow posts and short
  wide joiner are shaped by nothing else. Sizing a clearance against the desktop number
  gives a test that passes on one project and quietly measures a different feature on the
  other.
- **`openPanel` matches the mobile tab bar's labels exactly, and has to.** They are single
  common words — Scene, Properties, File — so a substring match picks up any panel button
  whose own label happens to contain one. "Centre in scene ↔" matched the Scene tab, and
  every mobile test that opened a panel failed at once, seventeen of them, none of them
  near the button that caused it. Adding a control whose label contains one of those words
  is fine; loosening that locator is not.
- **A guide's grab band steals presses over a wide strip on mobile.** 24 screen pixels at
  the mobile project's zoom is about 65 scene units, across the whole height or width of
  the scene — so a fixture whose draggable object sits within ~65 units of a guide has its
  press taken by the guide and drags that instead. The analogue of the spacing tests' tall
  narrow posts: shape the fixture around it, or turn the guides off.
- **The rotation threshold is the one threshold identical on both projects** — 5°, because
  it is not divided by the zoom (see Snapping). A rotation fixture therefore does not need
  the mobile-sized clearances every drag fixture is shaped by.
- **The priming move is *angular* in a rotate test, and it moves the gesture's start.** In
  a drag, Phaser's 8px threshold shifts where the object ends up; in a rotation it shifts
  the angle the grab is measured from, and at the knob's radius those 12px are ~7.6° on
  desktop and ~12.7° on mobile — larger than the whole 5° capture. `sweepBy` in
  `rotation.spec.ts` solves for it with three fixed-point passes, because the primed point
  sits on the chord and so its angle depends on where the drag ends, which depends on its
  angle.
- **A centred rectangle's colour centroid does not move when it turns.** The obvious drawn
  assertion — rotate a box, screenshot it — silently asserts nothing. An off-centre child
  inside a rotated group is the smallest fixture `findDrawn` can actually see a rotation
  in, and it is what a parent-space mistake would put in the wrong place.
- **A rotate drag has to pass `select: false`.** On mobile `drag` otherwise taps the start
  point first to satisfy the two-step rule — and the handles are deliberately exempt from
  that rule, so the tap would hide the very thing under test.
- **An instance is named after its prefab, and its detached contents keep the
  definition's names.** So a prefab called "Body" made from a rectangle called "Body" gives
  three tree rows reading "Body" the moment one instance is detached, and
  `selectInTree` is an exact-name locator. Rename before detaching, or reach the child by
  row position — `prefabs.spec.ts` does both, and says which and why.
- **The scale handle occludes the very pixels a colour centroid is averaging.** It keeps a
  44px *screen* target over the object's bottom-right corner, and a physics body's outline
  runs straight through it — so a centroid measured while the object is selected sits
  several pixels off the object's own centre, and ten pixels off at the mobile project's
  zoom, where a 240x160 box is only ~89x59 on screen. Neither number is motion, and both
  look exactly like it. Deselect before measuring an outline, or compare two shots taken
  under identical chrome. The same care the move bar's accent-coloured button already
  forced on `shot`, arriving on the other side of the canvas.
- **A physics body outline is drawn *above* the selection outline**, at depth 1000.5 — so a
  test can see a body on a freshly added object without deselecting first. What it cannot
  do is *measure* one there, for the reason immediately above.
- **The `.js` toolchain harness enables Arcade in its own game config**, because a scene
  module cannot: `this.physics` is undefined unless the game asks for it, and `create()`
  then throws on the first body and the canvas draws nothing. That is not a harness
  workaround — the exported module's header comment says exactly what to add, and the
  harness following it is what proves the comment is sufficient.
- **A drag test that asserts where the pointer put something has to turn snapping off.**
  It is on by default, so `editing.spec`'s two "the object lands where I dragged it" tests
  now begin with `setSnapping(false)` — the starter project's own objects were pulling the
  marker four pixels onto a neighbour's edge, which is the feature working, not a failure.
- **The scale handle's 44px touch target can swallow a small object's own centre.** At the
  mobile project's zoom a 100x60 object is 37x22 on screen, so a press aimed at its middle
  starts a resize instead of a drag and the test sees an object that never moved — or one
  that vanished. That is the editor behaving as designed (see "Interaction model"); a
  fixture that means to be dragged has to be big enough to have a middle that is not the
  handle.
- **A new project ships three example objects, and they are part of the scene under test.**
  Harmless for a tolerance-based assertion, fatal for an exact one: they are three more
  boxes to snap to and three more colours a centroid can pick up. `EditorPage.clearScene`
  empties the scene through the tree's own row buttons.
- **Reading the document means saving, and saving opens the file sheet.** On mobile that
  sheet covers the canvas, so a `findDrawn` after a `saveToFile` screenshots the sheet and
  reports the object missing. Assert the canvas first, then read the file.
- **A one-pixel line never reaches full strength on screen.** Antialiasing left the guides
  at about 78% over the background on one project and split across two pixels on the
  other, so a colour match found them in one and not the other. Matching loosely enough to
  catch the blend also matches an object's own antialiased edge — which is a wrong answer,
  not a flaky one.
- **A sheet test has to be able to see *which frame* is drawn.** `stripPng` builds a
  horizontal strip of solid-colour frames for exactly that: the assertion "one frame is
  drawn and the other three are not" is what separates a grid that reached Phaser's parser
  from one that only reached the document, and no fixture of shapes could state it.
  Scale the sprite up — at the mobile zoom a 32px frame is 12 screen pixels across, and a
  centroid over ~14 pixels is all antialiased edge.
- **What frame is up at any instant is a race with the frame rate.** The claim a playback
  test can actually make is "it reaches a frame it did not start on", polled — a statement
  about time passing, not a single screenshot. Asserting a specific frame at a specific
  moment is a test that fails on a loaded machine.
- **A page coordinate worked out while a sheet is open points somewhere else once it
  closes.** A sheet shortens the canvas and the camera re-fits, so the zoom `sceneToScreen`
  read is no longer the zoom the tap lands under. It cost both mobile paint tests on the
  first run, and it is why `paintCell` takes *scene* coordinates and converts them on the
  far side of `closePanels` — the conversion cannot then be done at the wrong moment.
- **A paint gesture must pass `select: false`.** Paint mode has taken the press, so the
  priming tap `drag` otherwise sends on touch is itself a stroke, and lays a tile the test
  never asked for. The handles are exempt from the two-step rule for a different reason and
  need the same flag.
- **Leave paint mode before reading pixels.** The cell grid is drawn over the map while the
  mode is on, and a colour assertion should not have to reason about the editor's own
  overlay — the same care the move bar's accent-coloured button already forced on `shot`.
- **A colour centroid is the wrong instrument for an outline.** A two-pixel stroke lands on
  a different sub-pixel phase on each of its four edges, so one edge matches at full
  strength where the opposite one splits across two half-strength pixels — and the centroid
  moves by a tenth of the shape's width for a reason that is not position. It cost the
  camera frame 14px on the mobile project and nothing at all on the desktop one, which is
  the shape of a wrong answer rather than a flaky one. `findColorBox` reports the extent
  instead: immune to it, because a one-pixel edge and a two-pixel edge start in the same
  place, and it is the only reading that can also say how big something is drawn. Both
  edges have to be on screen for it to mean anything.
- **`EditorPage.newProject` silently does nothing on a dirty project unless the confirm is
  accepted.** `handleNew` asks before discarding and Playwright dismisses a dialog nothing
  handles, so the click lands, the panel closes, and the old project is still there. It was
  invisible for twenty-two iterations because every caller followed it with `openFile`,
  which replaces the project anyway — the first test to call it and then keep *using* the
  editor saw the previous project's assets still in the table. It now accepts the dialog,
  with `on`/`off` rather than `once`: a clean project raises no dialog at all, and a `once`
  left armed would accept the next one from anywhere in the test, including the remove
  confirms some specs deliberately dismiss.
- **`reuseExistingServer` means a leftover `vite preview` serves a stale build.** The
  config sets it outside CI, so if a previous run's server is still on the port a new run
  attaches to it and **skips `npm run build` entirely** — every assertion then describes
  code that is no longer on disk. It looks exactly like a fix not working: the source is
  right, the test is right, and the page is old. It bites hardest while iterating on one
  spec after interrupting a full run. Check the port, or check `dist`'s timestamp, before
  believing a failure that contradicts the source.
- `@playwright/test` is pinned to `~1.56` because that is the release whose bundled
  Chromium (1194) is the one preinstalled in the container this repo is developed in — do
  not run `playwright install` there. `CHROMIUM_PATH` overrides the executable if a
  machine's browser is somewhere else. CI installs the matching browser itself.

Export is verified by **running the exported page**: it is served over HTTP with the CDN
request routed to `node_modules/phaser/dist/phaser.min.js`, then asserted to have booted
Phaser, drawn a canvas and produced the expected fill colours. The exported `.ts` is
checked with `tsc --strict` against the real Phaser types, and the exported `.js` is
bundled with Vite in a throwaway project and run, which is the actual "drop it into your
Phaser project" path. Serve that bundle over HTTP — browsers refuse ES modules from
`file://`, which looks like a broken export but is not. All of it also runs against
`hostileProject()`, a project full of hostile names and content — that is what caught the
`</script>` hole, and, once the hostile project's *scene name* was made hostile too, the
unescaped `super(...)` above. Widen what that fixture covers whenever a new field starts
reaching the output; the fields nobody thought to make hostile are exactly where the holes
were.

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

Masks shipped in iteration 40 and are the entry worth reading first, because the check that
found them was the one iteration 39 wrote down — and because they are the second hole in a
row closed by finding an argument that was **false** rather than dated.

Run that check — re-read every refusal that justifies itself by pointing at a neighbour —
and the one that fails hardest is not phrased like a citation at all. It is a *list*.
`EFFECT_KINDS`' comment refused six filters in one sentence: `addMask`, `addDisplacement`,
`addBlend`, `addGradientMap`, `addCombineColorMatrix` and `addImageLight` "all take a
texture or another game object … which is an iteration rather than a member", and this file's
copy of it added that a mask "would be the first thing in this document that points *at
another node*". The document has held `followId` since iteration 18, both sides of a
`SceneCollider` since 20, and a `nodeId` on nine `RuleAction` members since 28 — every one
with a dangling-reference story already written. And a mask fed a *texture* never needed the
"or another game object" half at all.

**So the reading to carry forward is narrower than iteration 39's, and it is about the
shape of the sentence rather than its content: a refusal that covers a list is the hardest
kind to check, because it is right about most of the list.** Iteration 39 found a fake limit
riding beside a real one inside one sentence about one feature. This was a fake limit riding
beside a real one across six features at once — and anyone who spot-checked it would have
picked `addDisplacement` or `addImageLight`, found the sentence true, and moved on. The list
was doing the work of six arguments while having been thought through for about two.

**The check for iteration 41 is therefore to find every refusal in this file that refuses
more than one thing in a single breath** — the ones that name three or four or six things
and then give one reason — and split them: write the reason out once per item, and see which
ones stop being reasons when they have to stand alone. Two are already visible from here.
"No canvas-only modes, no ERASE, no custom blend equation, no per-layer or per-child blend,
no camera-wide blend, and no animating one" is six refusals and about three arguments. So is
particles' "no `stopAfter`, no `flow`, no emit or death zone, no follow target". The
survivors of this iteration's own list are the model: `addDisplacement`,
`addGradientMap`, `addCombineColorMatrix` and `addImageLight` are now each named with their
own cost, and three of the four turn out to be one member and one picker rather than an
iteration.

What iteration 40 leaves is in "Masks" above: no mask from another node (the half of that
sentence which was always true), no geometry mask, no `viewCamera`/`viewTransform`/
`scaleFactor`, no animating a mask, and no mask on a tilemap layer or a prefab child from
outside. **And the four remaining texture-taking filters are now a pure loosening** of the
machinery masks built, which is the part of this worth carrying: their price dropped the
moment somebody paid it once.

Scroll factors shipped in iteration 39, and were the entry worth reading first before that,
because the
check that found them was the one iteration 38 wrote down — and because what they found was
a **new** way for this list to be wrong. The previous four lessons were all about a refusal
being *dated*: 34 said a refusal list is a list of things somebody thought of, 37 said it
gets longer in the direction it is already looking, 38 said the holes are in the sentences a
feature wrote about itself before the closer existed. All three assume the sentence was true
when it was written. This one was not.

Run the grep 38 prescribed — `scene.start`, "game logic", everything older than iteration 28
— and nineteen refusals come back. Eleven were already closed. Most survivors were one cheap
member. The one that mattered read, in iteration 25: *"a layer that drifts is behaviour over
time, and a layer that moves at a different rate to the camera is a second camera's
question."* The first clause is a correct citation of iteration 19's real limit. The second
is a **standing fact** — `setScrollFactor`, declared once at boot — smuggled in beside it on
a comma, and it inherited the first clause's authority for fourteen iterations. Meanwhile
the exporter had been emitting `setScrollFactor(0)` since iteration 21 for its own HUD, and
the README had been advertising a "parallax background layer" since iteration 19.

**So the reading to carry forward: a refusal sentence can weld a real limit to a fake one,
and the fake half inherits the real half's authority.** A dated refusal is at least honest
about its own iteration; this kind is not wrong about the vocabulary, it is wrong about the
*feature*. The check it set for iteration 40 was to re-read every refusal that justifies
itself by pointing at a neighbour — the ones phrased "X's argument one type over", "the
same sentence one feature on", "the `.tmj` argument at a smaller scale", "the second field
over one number" — and ask whether the neighbour's argument actually reaches this case or
only the case beside it. **That check was run and it worked**; see the head of this section
for what it turned up, and note that the answer was a refusal covering a *list*, which is
the same failure one order of magnitude up.

What iteration 39 leaves is in "Parallax and pinning" above: no scroll speed or drift (still
iteration 19's genuine limit, and still the first thing that would need an emitted
`update()`), no factor on a tilemap layer or a prefab child from outside, no animating one,
no rule action that sets one, no camera-relative size, and no screen-space authoring mode.

Starting, stopping and bursting an emitter shipped in iteration 38 and is the entry worth
reading first, because it is the **fourth** hole in a row that nothing on this list had ever
named — and because it finally says where to look, where the three before it only said where
not to. Iteration 34 said a refusal list is a list of things somebody thought of. Iteration
37 said it gets longer in the direction it is already looking, and that the check to run is
"what did we build that the newest feature cannot name". Run over eighteen action kinds that
found this in one pass; and what it found was not an oversight but a **sentence with a date
on it**. Iteration 15 refused a timed burst and an `emitting` prop as "behaviour over time is
game logic, the `scene.start` argument again" — the exact phrase rules were built, thirteen
iterations later, to answer. Rules arrived in 28. Iterations 28, 31, 34 and 37 each went back
for one of those pre-rules `scene.start` refusals, and not one of them noticed the one that
used the phrase twice in its own section.

**So the reading to carry forward is narrower than 37's: the holes are in the sentences a
feature wrote about itself before the thing that would close them existed.** A refusal is
dated, and a dated refusal is a claim about the vocabulary of its own iteration, not about
the document. The check it set for iteration 39 was mechanical, which was the point:
`grep` this file for `scene.start` and for "game logic", and read every refusal older than
iteration 28 against what a rule can say now. That check was run, and it worked — see the
head of this section for what it turned up and for why the answer was not the kind of thing
this paragraph was expecting.

What iteration 38 leaves is short and is in "Making one throw" above: no pause or resume, no
burst at a point, no emit or death zones, no follow target or `stopAfter`, no `advance` or
`duration` on a start, and nothing that reads whether an emitter is running. And the
`emitting` prop is **not** on that list — it is refused and stays refused, because the
exporter derives one.

Pushing an object shipped in iteration 37 and is the entry worth reading next, because it is
the third hole in a row that **nothing on this list had ever named** — and the one that says
most about how this list goes wrong. The two before it were in the drawing domain, where the
"Phaser 4, not 3" bullet had at least written the word down. This one was in the domain with
eight sections of argument about it: rules had a "what stays refused" paragraph per iteration
from 28 onwards, each one carefully refusing a *sequence* — `onComplete`, a "while" trigger,
an expression tree — while none of them noticed that the vocabulary could not touch a physics
body at all. **The reading to carry forward is narrower than iteration 34's and sharper: a
refusal list gets longer in the direction it is already looking.** Six iterations of them
asked "is this a program?" and none asked "what in this project can a rule not reach?" The
answer was the entire physics stack, shipped across iterations 16, 20, 21 and 26 and reachable
only by a player holding a key. The check worth running on the *next* iteration is not "what
did we refuse" but "what did we build that the newest feature still cannot name". What
pushing leaves is short and all of it is in the section above: no impulse or relative push, no
acceleration/drag/bounce/gravity from a rule, no angular velocity, no push towards a point or
at another object, no push on a spawned object or a nested one, no reading a velocity in a
condition. **`setPosition`**, which this paragraph named as the next ask, shipped in iteration
42 — see "Moving one" above.

Blend modes shipped in iteration 36 and are the entry worth reading first, because of the
three things named in the sentence below, that was the one nobody went back for. Masks,
filters and blend modes were all absent from `src/` while the "Phaser 4, not 3" bullet had
been saying for thirty iterations that those three had changed. Filters shipped in 35 and
the paragraph announcing them quoted iteration 34's closing lesson — *a refusal list is a
list of things somebody thought of, and the hole that survives is the one nothing prompted
the question* — and then left two of its own three untouched. One of them was refused with
an argument, which is a decision; the other was simply not mentioned again, which is the
lesson repeating inside the paragraph that states it. **The reading to carry forward: a
sentence naming three gaps is not a list of three tasks, and the one that is neither done
nor argued against is the one to go back to.** What blend modes leave is short, and all of
it is in the section above: no canvas-only modes, no ERASE, no custom blend equation, no
per-layer or per-child blend, no camera-wide blend, and no animating one. **Masks were the
last of the three still standing, and iteration 40 closed them** — so that sentence about
three gaps is now fully discharged, and what it cost is recorded at the head of this
section: the argument still standing against masks was itself the same failure one order of
magnitude up, a single refusal covering six filters at once.

Visual effects shipped in iteration 35, and they were the entry worth reading first before
that, because nothing on this list had ever named them either. What that feature leaves is
short, because it adds no table, no node type and no reference. **Masks were the one entry
here that has since shipped** — iteration 40 took them, and the sentence that stood in this
spot is worth reading beside what it cost: it said `addMask` "would be the first thing in
this document that points at *another node*", which was false, and it priced six filters
together. What was true of it is kept in "Masks" above. **No camera-wide effects here**, since a
filter on `cameras.main` is a property of the view and iteration 31 already put what
happens to a view on a rule. **No custom shader**, which is code in the document — the
emit-zone argument and the gradient fill's. **No animating an effect**: a tween's `to` is
six properties that are one shape across the whole union, and an effect's dials are
per-kind, which is exactly the refusal that keeps a seventh tween property out. And the
eight remaining built-in filters — vignette, barrel, bokeh, tilt shift, threshold,
quantize, key, blocky — are a **pure loosening**, one union member and one emit case each;
the first two are effects on a view rather than on an object, and the rest are dials nobody
has asked for yet. Since iteration 40 the four *texture*-taking ones —
`addDisplacement`, `addGradientMap`, `addCombineColorMatrix` and `addImageLight` — are a
loosening too, each one member and one picker, because masks paid for the asset plumbing
they all share.

Spawning shipped in iteration 34, and it is worth reading beside the list below because it is
the one entry nothing on that list had ever named. `destroy` had been in `RuleAction` since
iteration 28 and every "what stays refused" paragraph since had gone looking for a *sequence*
to refuse, so nobody noticed the vocabulary had a verb for taking something away and none for
putting one there. The lesson is not about spawning: it is that a refusal list is a list of
things somebody thought of, and the hole that survives six iterations is the one nothing
prompted the question. What spawning leaves is short, because it adds no table and no
trigger. **No lifespan, and nothing destroys a spawned object** — the one a user meets first,
and it is not deferred work: `destroy` names a document node, a spawned one has no id, and a
`delayedCall` per spawn is "spawn, *then* destroy", which is `tweens.chain`'s refusal and
iteration 28's line verbatim. A loosening would need spawned objects to be *addressable*,
which is the per-instance identity prefabs already refuse. **Spawning at an object's
position has since shipped**, in iteration 41, as an optional `nodeId` rather than the
predicted union. See "Building one at an object".
**No random position, no count, no velocity** — the first two are values that depend on
nothing the document said, and the third is a body on a definition's child, which physics
bans for the reason it bans one in a container. **No spawning a plain node** — a node is one
object that already exists; the thing this document has for "build another" is a prefab.
The one hole this iteration *made* — **no panel for a prefab nothing places** — closed in
iteration 43, in the shape predicted here: prefab controls in the library rather than a field
anywhere. See "The library's own controls" under Prefabs.

Play shipped in iteration 32, and what it leaves is short because it adds nothing to the
document to leave holes in. **No hot reload** — the overlay covers every control that could
make an edit, so this is not deferred work but a question the shape answers; a loosening
would mean the game and the editor side by side, which is a layout this editor has nowhere
to put on a 390px screen. **No error panel** — see "Play" above: reading an opaque-origin
frame means giving the exported page a reporting channel, and the export's bytes being
exactly what runs is the property the feature exists for. **No pause, step, slow-motion or
inspector**, which is a debugger and is a different tool rather than more of this one; the
shape it would take is a second window onto a game the editor deliberately cannot see
inside. **No editing while it runs, and nothing read back out of the game** — the second is
the one to keep refusing hardest, because "drag it in the running game and keep the
position" is the obvious next ask and it is the physics refusal exactly: a running game
that can write to the document is a document that simulates. And **no choosing which scene
to play** — a second answer to what Export already decides, though if it ever arrives it is
a one-field loosening rather than a shape change, since `generateRunnableHtml` already
emits every scene and boots the active one.

Text variables and `setText` shipped in iteration 29, which closed the first hole iteration
28 left — and it is worth reading the prediction beside the work, because the prediction was
right about the sequencing and wrong about the cost. It said a string variable was "a
loosening in shape", and the *shape* was indeed one field's type. What it did not name is
the half that carried all the risk: a kind is a thing every rule naming the variable has to
agree with, so the work was four new refusals in `rulesOf` and a store action that migrates
the document when a kind is switched — **strip on read, repair on write** — without which the
refusals are a trap rather than a guard. The emit was mechanical, as predicted. Five holes
were left and **two of them closed in iteration 30** — see "Showing one as it changes" above,
and read that prediction beside the work too, because this time it was right about the shape
and wrong about where the cost fell. It said a following label "needs a field on the node
rather than an action", which is exactly what `TextProps.label` is, and it said number
formatting was "a field on the action and a pure loosening", which is exactly what two
`NumberField`s are. What neither line names is the half the work actually went into: a format
on the action and a format on the node are two ways of showing one number, so the emit had to
grow **one printed formatter with two callers** rather than two call sites each printing their
own arithmetic — and the first version of that formatter disagreed with the editor's copy
about a text variable, which is the one disagreement this codebase has no reader to catch. The
other surprise was the store: `updateProps` could set a label and could never remove one, so a
feature whose document change is one optional field still needed an action of its own. Four
holes left, one of which is now a remainder rather than a hole. **No template in a caption** — `Score: {score}` would be a syntax inside a field, so
nothing parses the text and one variable goes on the end instead; two in one caption is an
expression, which is the line this vocabulary does not cross, and the shape a loosening would
take is a *list* of parts rather than a parser. Note what iteration 30 did **not** make of
this: a bound label appends one value to one caption, which is the same refusal said a second
time from the node's side. **No thousands separator**, which is what is left of the formatting
hole — zero padding and decimal places shipped, and a separator is the one of the three that
is a *locale* rather than a number: `toLocaleString` takes a language tag, which is a field
whose right answer depends on who is playing, and `padStart` and `toFixed` were chosen
precisely because neither has an answer that varies. **No text on a type that has no
`setText`** — a `BitmapText` is the obvious second one and it does not exist yet; everything else in the union has no text at all,
which is Phaser's limit and is said in the panel. And **no concatenating two variables**,
which is the expression tree again and is refused rather than deferred.

Rules shipped in iteration 28, and what they refuse divides cleanly into things that are a
pure loosening later and things the feature exists to say no to.

*Loosenings.* **No OR and no nesting** — an OR is two rules with one trigger and one action
list, and the editor could offer a "duplicate this rule" button and deliberately does not.
What would *not* be a loosening is a condition **tree**, which is a second document format
inside a field. **No arithmetic beyond set and add** — `addVar{by: -1}` is subtraction, and
multiply, min and clamp are one `op` field; it is refused because the request after multiply
is `score = score + lives`, which is a second operand *naming a variable*, which is an
expression tree and therefore code in the document. **String variables** were the third, and
they are the one entry on this list that has shipped — in iteration 29, with the `setText`
they were being sequenced behind; see above for what that cost and what it left. **No collision
callback parameters** (which object hit which), and this one is mechanical as well as
principled: the emitted callback takes zero parameters, which is assignable to
`ArcadePhysicsCallback` with nothing to annotate, and the moment it wants two it needs two
types the shared `create()` body has nowhere to put. **No rule inside a prefab** — a rule
names top-level scene nodes only, so a definition's children are unreachable, and the shape it
would take later is a per-*instance* rule, which is the override model prefabs already refuse.
**No tap on a group, an instance, a tilemap or an emitter** — the instance one is the loosening
(the factory would `setSize` from `getBounds()` before returning); the other three are Phaser's
limits or the document's rather than deferred work, and each is said in the panel. **Camera
effects** were the third entry here and **shipped in iteration 31** — and this is the rare
case where a prediction was right to the word: "a pure loosening: five actions and no format
change" is exactly what it was, five union members, five reader cases, five panel cases and
five one-line emits, with no table, no gate, no helper and no schema bump. What it did not
name is the one thing that made it cheaper still, and it is the sentence worth carrying
forward: these are the first actions that **name nothing the document holds**, so three
reference-walking functions inherited the right answer with no edit and nothing in the
reader can cost a rule. See "Doing something at a moment" above, including `rotateTo`,
`onComplete` and `force`, which stayed refused. **Nothing pauses and
nothing stops** — `timer{loop: false}` is the whole of "once", and a rule that switches another
rule off is a rule about rules.

*And the things this feature exists to refuse.* **No condition on a live object property** —
see Rules above; a variable is the one quantity that survives `scene.start`, validates against
a table and is one shape across the whole union, where `x` on a tilemap and `width` on a sprite
are different questions. **No per-object custom code** — a field holding JavaScript is a
document that cannot be validated, cannot be escaped and cannot be drawn: the emit-zone
argument at its purest, and the gradient fill's. **No `onComplete`, and nothing that waits** —
a rule that fires when a tween finishes is a *sequence*, which is `tweens.chain`'s refusal one
iteration on and the same sentence; `startTween` is allowed precisely because it names a moment
and not an outcome. And **no "while" trigger**, which is the sharpest one: every trigger here
is a moment Phaser already delivers, and a condition watched continuously is the first that
would have to be polled — which is the first that needs an emitted `update()`, which is exactly
where this iteration's line falls. **That paragraph gave two examples and only one of them was
right, which iteration 33 found out — and it is worth leaving both here rather than quietly
correcting one.** "While…" is still refused, for the reason above and unchanged. *"When the
score passes ten"* is not: `changedata-<key>` is a moment Phaser delivers of its own accord,
and iteration 30's labels had been listening to it for two iterations by the time anybody
noticed. It shipped as the `varChange` trigger with no polling, no `update()` and no schema
bump — see "Watching a number" above. The lesson is not about this trigger: it is that the
line falls where the *loader and the event list* put it, and this file had guessed from what
a feature sounded like, which is what it tells every reader not to do.

*Not on either list:* relative variable targets are not refused, they are `addVar`; a rule has
no `enabled` flag, because deleting it is one press and a disabled rule is a document saying two
things; and `overlap` is not a hole at all, since a collide rule inherits `SceneCollider.kind`
and the distinction was a parameter this feature never had to invent.

Tweens shipped in iteration 27 with six deliberate holes. **One tween per node** — a
second on the same object means a second *duration*, which is a list; that is a pure
loosening later (`tween?: NodeTween` becomes `tweens?: NodeTween[]` and the emit becomes a
loop), and what it actually costs is an inspector that has to say which of several is being
edited. **No chain and no timeline** — one tween after another is a *sequence of events*,
which is the line iteration 20 drew and this iteration is careful to stay on the near side
of: `tweens.chain` is exactly the shape a behaviour model would take, and it is one.
**Nothing starts a tween but the scene starting** — `paused: true` plus a handle is a
trigger, which is the collider callback's refusal one feature over. **No callbacks** —
`onComplete` is code in the document, the emit-zone argument and the gradient fill's.
**Only the six transform-and-alpha properties**, because a seventh would be the first that
is not on every node: a tint, a tile sprite's offset and a text object's font size are all
per-type, so `to` would stop being one shape across the union and `TWEEN_PHASER_KEY` would
need a per-type answer. And **no per-property duration or ease** — Phaser takes
`x: { value, duration, ease }`, which is a timeline written sideways and the first hole
again. Note what is *not* on this list: relative targets are refused rather than deferred
(see Tweens above), and `hold` is absent for `useAdvancedWrap`'s reason — it is visible
only on a tween that already yoyos and costs more to explain than it gives.

Web fonts shipped in iteration 23 with four deliberate holes. **No `descriptors`** — the
loader takes `{ weight, style }` and would let a real bold face be registered under the
same family, but the editor's Bold and Italic are two booleans and the browser synthesises
from the one face it has. Doing it properly is not a field: it is a *pairing* model, two or
more asset rows that together mean one family, with a UI saying which is the italic of
which. **No Google Fonts and no loading by URL** — a network dependency in a document whose
whole premise is that `JSON.stringify(project)` is a complete save, and a project that
stops rendering when a CDN does is exactly what embedding the bytes is for. **No
subsetting**, which would need a parser per format in the allowlist and is the thing that
would actually make a CJK face fit under the cap. And **no font in the export's own
`<style>`** — not deferred at all, but the thing the feature refuses: Phaser's loader
builds the `FontFace`, so there is nothing for CSS to do and adding it would put a family
name and a data URL into the one half of that output the escaping does not cover.

Typography shipped in iteration 22 with six deliberate holes, and the first of them — **no
web-font loading** — is the one that closed, in iteration 23. It is worth reading what this
paragraph used to say beside what the work turned out to be, because half of the prediction
was wrong and it was the expensive half. It said loading a font would mean "the asset table
again for a second kind of asset with its own mime allowlist and its own size cap, plus a
`document.fonts.load` that has to finish before `create()` — a boot-order question this
exporter has never had to answer, and the one hole here that is an iteration rather than a
field." The first half was exactly right. The second half described a problem that does not
exist: Phaser 4 ships `this.load.font`, so the boot-order question is answered by the
`preload()` this exporter has emitted since images existed. See Web fonts above — and note
that the prediction was made from Phaser 3 memory, which is the thing CLAUDE.md tells every
reader not to do. **No BitmapText**, which is a second node type with a `.fnt` and its
own parser: the texture-atlas argument, and it does not become smaller by sitting next to a
`Text`. **No background colour behind the text** — a coloured box behind something is a
rectangle, which this editor has had since iteration 1 and which has a draw order of its
own; the field would be a second answer to "what is behind this object" that no other type
gets. **No gradient or texture fill** — `color` can be a `CanvasGradient`, which is a
runtime object the document has nowhere to put: the emit-zone argument. **No rich text or
per-run styling**, which is markup inside a field and therefore a second document format.
And **no `useAdvancedWrap` toggle** — the difference only shows on CJK and on unbroken
URLs, so it is a field that costs more to explain than it gives. Note what is *not* on this
list: `padding` is absent because it is derived rather than deferred, and per-side padding
is not a loosening but a way to get it wrong.

On-screen controls shipped in iteration 21 with three deliberate holes. **The layout is
fixed** — a D-pad in one corner and a jump button in the other, sized against the scene
rectangle and not placeable. Making one draggable is not a loosening but the screen-space
rectangle this iteration refused: a new geometry kind with its own hit area, drag gesture,
snap targets and inspector rows, which is an iteration rather than a field. **No analogue
stick and no swipe**, both of which are a *magnitude* where every direction here is a
boolean the keyboard already made — reading one would mean `setVelocityX` taking a
fraction of the walk speed, which is a change to what `speed` means. And **the buttons'
appearance is the export's**, white at a quarter alpha with an arrow in the middle: the one
piece of styling this exporter chooses, chosen to be the line a reader will most easily
change. A skin picker in the editor would be a second answer to a question the generated
code already answers legibly.

Collisions and controls shipped in iteration 20 with four deliberate holes, one of which
iteration 21 then closed. **Nothing happens when two things touch** — no collider callback, no destroy-on-overlap, no scene
transition. That is not deferred work but the line the whole iteration is drawn against:
which pairs interact is a standing fact and what follows a touch is a sequence of events,
so the export hands over the overlap and the line inside it stays the user's. A rule table
of triggers and actions is the shape a later iteration would take, and it is a behaviour
model rather than more of this one. **No touch or on-screen controls** was the second, and
it is the one that closed — see Touch controls above, including where its prediction of "a
third `scheme`" turned out to be the wrong shape. **No collision groups and no
`setCollisionBetween` ranges**: a group is a second way of naming a set of objects that the
scene tree already names one at a time, and a range is `collides` written shorter. **And no
per-tile properties beyond solid** — a tile is a wall or it is not, and anything finer (ice,
a one-way platform, damage) is the beginning of the behaviour model the first hole refuses.

Texture atlases shipped in iteration 24, and it is worth reading what this paragraph used
to say beside what the work turned out to be, because half the prediction was right and the
expensive half was wrong in a new way. It said an atlas was "`generateFrameNames` and a
second parser rather than more of this one". The second parser is real and is `atlas.ts`,
which is most of the iteration's core. `generateFrameNames` is the half that was wrong, and
not for the reason the fonts prediction was wrong — there the answer turned out to be
easier, here it turned out to be *unusable*: Phaser's runtime concatenates a name happily
and its own type declares `frames?: boolean | number[]`, so the exported `.ts` does not
compile under `--strict` and the shared `create()` body has nowhere to put a cast. See
Texture atlases above. Five deliberate holes were left. **No multi-page atlas** — a
multipack is *n* images and one JSON naming each page, and the whole feature rests on a cut
being a property of one set of bytes; a page set is a second kind of asset row rather than
a field, and it is refused at the picker with a message instead of silently dropping pages.
**No rotated frames**, refused at import rather than forwarded, and this is the hole that
was nearly a field: rotation is pure pass-through to Phaser's parser and would have cost
six lines, but it is *off by default* in every packer, it interacts with `frameSizeOf`, a
panel's insets and a tile sprite's pattern, and it is invisible on any symmetric fixture —
so it would have been a field carried on trust and wrong on somebody's real sheet.
`useAdvancedWrap`'s refusal with a sharper edge: not merely unexplained, unverified.
**No `scale9Borders` and no `anchor`/`pivot`** — the first would be a second answer to
`NineSliceProps`' four insets, which iteration 19 deliberately put on the *node* because one
64px texture is a dialog frame with 16px corners and a health bar with 4px ones; the second
is a second answer to the origin every object here already centres. **No atlas authoring and
no renaming** — the editor cuts a grid because a grid is four numbers, while an arbitrary
rect set is a packer, and a name is the link the document holds, so renaming one here would
break every node that named the old string (`FontAsset.family`'s refusal exactly). **And no
Starling, Unity or `.atlasXML` forms** — a parser per format is the `.tmj` argument at a
smaller scale, and JSON Hash plus JSON Array is what the tool people actually use writes.

Nine-slice panels and tile sprites shipped in iteration 19 with four deliberate holes.
**No `tileX`/`tileY` on a panel** — Phaser 4 can repeat a nine-slice's scalable regions
instead of stretching them, which is two booleans and would be a pure loosening except for
one thing: both are `readonly` and constructor-only, so they would have to join
`shapeOf`'s signature and rebuild the object, and a seamless-texture caveat is a thing to
explain in a panel that currently needs none. **No scroll speed on a tile sprite** — a
background that drifts is `tilePositionX += delta` in the game's own `update()`, which is
behaviour over time and the `scene.start` argument; the document says where the pattern
starts, which is the part that is layout. **That refusal stands, and iteration 39 is the
reason it is worth re-reading**: a tile sprite that *drifts* still needs the `update()` this
vocabulary cannot emit, while a tile sprite that moves at a different rate to the camera —
which is what "parallax background layer" in the README always meant — turned out to be a
`scrollFactor` and a standing fact. The two were one sentence in iteration 25 and are two
different things. **Neither type animates**, which is not deferred
work at all: a `NineSlice` and a `TileSprite` carry no AnimationState, so this is Phaser's
limit rather than this editor's. And **no per-corner insets beyond the four** — a nine-slice
*is* four numbers, and anything finer is a second image.

Cameras shipped in iteration 18 with five deliberate holes. **No second camera** —
`cameras.add` is a list of cameras with viewports of their own, plus an ignore list saying
which objects each one draws, and a minimap is two of those decisions rather than more of
this one. **No rotation, fade, flash, shake, pan or `zoomTo`** — every one is a thing the
camera does *over time*, which is game logic and the `scene.start` argument; the handle
they would act on is `this.cameras.main`, which the user already has. Four of those six
**shipped in iteration 31**, and the sentence above is the reason rather than a thing it
overturned: what changed is that iteration 28 gave the document somewhere to put game
logic, so "a thing that happens at a moment" stopped being a thing with no home. `rotateTo`
is the one that stayed refused on its own merits, and the sixth — see "Doing something at a
moment" above. **No follow offset
and no dead zone**, which are a pure loosening later: two numbers and a `setFollowOffset`,
two more and a `setDeadzone`, with nothing about the format or the drawing that has to
change first. **No camera gesture on the canvas** — see Cameras above for why a frame whose
inside is the whole scene cannot simply be made grabbable, and why an edge band is the
shape a later iteration would take. And **no looking through the camera**, which is not
deferred work but the thing the whole feature refuses: moving the editor's own view is what
"drawn, never applied" rules out, and a "set the camera from my view" button is the same
coupling written backwards.

Audio shipped in iteration 17 with four deliberate holes. **No audio sprites** — Phaser's
`load.audioSprite` takes a JSON of named `{ start, duration }` markers, which is a second
sub-format inside the document with its own parser, picker and validator: the `.tmj`
argument at a smaller scale, and the same one that keeps texture atlases out. **No `rate`,
`detune`, `seek`, `delay`, `pan` or `mute`** — every one is a per-*play* adjustment a
hand-written line makes on the handle this feature exists to hand it, where `loop` and
`volume` are standing facts about how a scene uses a sound. A pure loosening later, and one
that costs a field each and nothing else. **No spatial audio**, which would give a sound a
position and therefore a node type, and is the thing the whole "no boxless node" argument
above refuses. **And no stopping a sound on scene shutdown**: the handle is registered in
`create()` and what happens to it afterwards is game logic, which is why the emitted block
carries no `shutdown()` of its own — the one place this feature could have written the
user's line for them and deliberately does not.

Physics shipped in iteration 16 with five deliberate holes, one of which
iteration 20 then closed. **No simulation in the
editor** — the argument is the whole of the Physics section above, and it is the one hole
here that is not a loosening: running the world rewrites the document, so "add a play
button" is not a smaller version of this, it is a different editor. **No colliders**, which
is the one that closed: `SceneCollider` is that line now, and what stayed refused is the
*callback* — see Behaviour above for where the line moved to and why. **No circular
bodies** —
`setCircle(radius, offsetX, offsetY)` defaults its offsets to the body's *current* offset
rather than to centred, so a bare `setCircle(r)` parks the circle in the corner of a
non-square object; getting it right means a radius and two offsets, and the radius is a
second answer to the object's own size (the "a sprite has no width or height" argument).
For a `text` node it is worse than awkward: text measures against the font at runtime and
the document does not know its size, so the editor's outline and the exported call could
compute different circles, in the one place where being wrong is invisible until something
fails to collide. It is a pure loosening later — one prop and three emitted arguments.
**No Matter physics** was the fourth, and it is the one iteration 26 closed — see Matter
above, and note that the reason it closed is not that the argument was wrong. It was
right: Matter *is* a second engine with a second body model. What changed is that the one
thing it buys turned out to be the one thing Arcade genuinely cannot do at all, which is a
collision shape that turns with its object. **Circular bodies shipped in iteration 44** —
see "Round bodies" above; the radius stayed derived, which answered the objection here
rather than overruling it. And **no body on a node inside a group or a
prefab**, which is *not* deferred work: an axis-aligned body cannot express a rotated
parent's frame at all, so it is a limit of Arcade's body model rather than of this editor
— and Matter inherits it here for a different reason, since a Container child's `x`/`y`
are its parent's coordinates whatever is simulating them.

Particles shipped in iteration 15 with four deliberate holes, and **one of them was the
sentence iteration 38 was found in** — worth reading before the rest, because the argument
was not wrong, it was *early*. That iteration refused a timed burst and an `emitting` prop
alike as "behaviour over time is game logic, the `scene.start` argument again", thirteen
iterations before there was anywhere to put a line of game logic; rules arrived in 28 and
nothing went back for it. **The timed burst has now shipped**, as three `RuleAction`
members — and the `emitting` prop has **not**, because the exporter derives one from
whether a rule starts the emitter, which is what keeps the original sentence true rather
than overturning it. See "Making one throw" above. What is left of that iteration's four:
**No emit or death zones** —
a zone is a geometry object, i.e. a second sub-format inside the document with its own
parser, picker and validator, which is the `.tmj` argument at a smaller scale. **No
follow target or `stopAfter`, and no `advance` or `duration` on a start** — the first two
are still behaviour over time with no moment to hang them on, and the last two are a
fast-forward and a stop-after in disguise. **No per-particle animation**: `ParticlesProps` would grow an
`animationId` and `collectAnimations` a branch, which is a pure loosening later rather than
a format break, and the editor's whole clip story is built around a Sprite's
`AnimationState`. **No multi-frame particles**: a `frames` array would be the second
array-valued prop in the schema and the second `cloneWithNewIds` special case, for a look a
single frame mostly covers.

Tilemaps shipped in iteration 14 with three deliberate holes, two of which have since
closed: **one layer per map**, **no per-tile collision**, and **no Tiled import**. The
first closed in iteration 25, and it is worth reading the prediction beside the work,
because it was half right and wrong in an interesting direction. It said `TilemapProps`
"would grow a list of layers where it has one `data`, and the exporter a `createLayer` per
entry" — both exactly right, and the second is the half that turned out to cost *nothing*:
`buildTilemapHelper` already builds one map with one layer and returns it, which is one
document layer, so the emitted helper was not touched by a character. What it got wrong was
"each one is its own `putTileAt` diff", which read as a warning and is simply true and
cheap: the diff was already per array, so it became a loop over an array of arrays. The
real cost was the two things the prediction did not name — where `collides` lives (see
Tilemap layers above, and note that iteration 20 had already written the sentence that
settles it), and the renderer needing a Container where the exporter wanted siblings. What
is left: **no per-layer tileset**, refused for the reason a sprite has no width — the tile
size is derived from the tileset, so two layers of one map could disagree about how big a
cell is. **No per-layer alpha**, which is a field and would be a second answer to the
node's own. **No scroll factor and no parallax** — and this one was *half wrong*, which
iteration 39 found and closed; the sentence is kept as written because the correction is
worth more than the tidy version. It said: "a layer that drifts is behaviour over time, and
a layer that moves at a different rate to the camera is a second camera's question." The
first clause is right and stands. The second is not: a thing that moves at a different rate
to the camera is `setScrollFactor`, a standing fact declared once at boot, and it shipped as
a **node**-level field — see "Parallax and pinning" above. What is still refused for a
*layer* is the same thing refused for an `fx` and a `blendMode`: a scroll factor is on a
node, and a layer is not one, so a parallax stack is several tilemap nodes rather than
several layers of one. And **no layer inside a layer**, which is not a thing Phaser has. The second hole is the one iteration 20 closed,
and it is worth reading what it used to say —
"`setCollision([1, 2, 3])` is a line the user writes, and a per-tile flag in the schema is
the beginning of a behaviour model" — beside where the line actually landed: which tiles are
solid turned out to be a standing fact about the world, and what a solid tile *does* to
whatever hits it is still nowhere in this schema. See Behaviour above. Tiled import is not a
loosening at all — a
`.tmj` carries named tilesets, object layers, per-tile properties and orientations this
schema has nowhere to put, so it is a second document format rather than more of this one.

Prefabs shipped in iteration 12, with two deliberate holes left in them: **a definition
may not contain an instance**, and there are no **per-instance overrides**. The first is
the cycle argument (see "Prefabs" above) and is a pure loosening later —
`Prefab.children` is already `GameObjectNode[]`, so nesting is a validation change plus a
topological order in the exporter, not a format break. The second is a whole override
model, a three-way merge on every definition edit, and a UI for showing and reverting
overrides; "detach and edit" covers the case it would serve, and covers it without any of
that.

Alignment and distribution shipped in iteration 6, snapping in iteration 7, equal spacing
and the grid in iteration 8, the rotate gesture with rotation snapping in iteration 9,
persistent guides in iteration 10, sprite sheets with animations in iteration 11, prefabs
in iteration 12, multiple scenes in iteration 13, tilemaps in iteration 14, particles in
iteration 15, physics bodies in iteration 16, the scene camera in iteration 18, and
nine-slice panels with tile sprites in iteration 19. The
boxes the geometry family needs are in `src/core/bounds.ts`,
which any further geometry tool can read. That family is complete in the sense that
mattered — the user can now author a line of their own — and what is left of it is more of
the same shape: another line or gap fed to `snapMove`, or another kind of agreement on the
end of `snapRotation`'s chain. Guides at an angle are the one that is not, since a diagonal
guide has no per-axis offset and would need `snapMove`'s whole per-axis structure
rethought.
