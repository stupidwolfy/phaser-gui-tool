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
handle to play — on a canvas that stays silent unless asked. See the README for the
user-facing feature list.

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
4. `src/ui/Inspector.tsx` — a properties section.
5. `src/ui/SceneTree.tsx` — add to `ADDABLE`; add a `.tree__type[data-type=...]` colour
   chip in `src/styles/app.css`.
6. `src/io/exportPhaser.ts` — a `constructorFor` case. That one *is* a compile error under
   `strict` (the switch stops being exhaustive against a non-nullable return), but
   `modifiersFor`, `collectAssets`, `usedIn`, `missingReason`, `collectAnimations` and
   `emitNode` are not exhaustive, so check them in the same pass as the `EditorScene`
   case. `collectAssets` and `usedIn` are a pair and both are needed: the first decides
   what a texture is called across the file, the second what *one scene* preloads.
   `countAssetUses` in `src/core/store.ts` is off this checklist entirely and is the same
   kind of hand-matched list — miss it and the image-deletion warning under-reports by a
   whole object type. `PHYSICS_TYPES` in `schema.ts` is a second such list and the
   **fourth silent step**: a new type is not body-eligible until it is named there, and
   nothing anywhere fails if it should have been.
7. `tests/` — the two silent steps are exactly the two the suite covers: add the type to
   `tests/editing.spec.ts` (it draws where the document says, and survives a save and an
   open) and give it a hostile instance in `tests/helpers/hostile.ts`, which puts its
   strings through both export toolchains.

`instance` is the one type not in `editing.spec.ts`, because it is the one type with no
`ADDABLE` entry to add it with — `prefabs.spec.ts` carries the "it draws, it survives a
save and an open" duty for it instead. That is a deliberate exception, not a skipped step.
`sprite` and `tilemap` are the same exception by a different route: neither draws anything
at all until an image has been imported and, for a tilemap, sliced, so `assets.spec.ts` and
`tilemap.spec.ts` carry that duty for them. A type that *can* be added and seen with no
setup still belongs in `editing.spec.ts`.

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
  `previewMotion` and governs emitters too — see "Particles".
- **The original argument for it.** A canvas that animates by itself is a
  canvas whose objects are never where you last looked, which makes placing one by eye a
  matter of timing; and the frame a still sprite shows is a document field the user is
  editing, so it has to be the frame on screen while they edit it. It is the one moment
  the canvas deliberately stops mirroring the document exactly.
- **`play(key, true)` — ignoreIfPlaying — is not optional.** The scene syncs on every
  store change, so without it a selection or a nudge of some unrelated object restarts
  every animation from frame 0 and nothing ever visibly advances.
- **The toolbar's ▶ appears only once the project holds something that moves** — an
  animation or, since iteration 15, an emitter (`hasMotionIn`). A 390px toolbar already
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

A `tilemap` node is a grid of tile indices drawn as a real `Phaser.Tilemaps.TilemapLayer`,
so what the canvas shows is what the export builds. Two decisions carry the rest of it.

- **A tileset is an image that has already been sliced, and there is no tileset type.**
  `ImageAsset.sheet` is the four numbers `addTilesetImage` takes, under the same names,
  for the reason `load.spritesheet` is handed them near-verbatim — so a tile index *is* a
  frame index, `SheetSection` is the tileset cutter with no new UI, the grid folded into
  the texture key already handles a re-cut, and `preload()` already emits the right load
  call. A
  `project.tilesets` table would be those same four numbers in a second place, free to
  disagree with the first, plus a parser and a picker.
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
- **A body is axis-aligned and does not turn with its object.** That is Phaser's, not a
  simplification here, and it is the one thing about physics the canvas can tell a user that
  the docs will not — so `drawBodies` builds the box from `displayWidth`/`displayHeight`
  centred on the node's own position rather than from `worldBoundsOf`, which is the rotated
  AABB and a different, larger box.
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
  prefabs.spec.ts           saving a prefab, placing it twice, editing it once
  tilemap.spec.ts           slicing a tileset, painting it, filling and erasing
  particles.spec.ts         an emitter stopped, previewed, reconfigured and cleared
  physics.spec.ts           a body drawn, never simulated, and refused inside a group
  audio.spec.ts             a sound imported, registered, saved, reopened and exported
  scenes.spec.ts            a second scene: switching, saving, duplicating, exporting
  assets.spec.ts            image import, decode-on-open, removal
  export.spec.ts            the runnable page, actually run
  export-toolchain.spec.ts  the .ts under tsc --strict, the .js through a Vite build
  helpers/editor.ts         the page object: panels, fields, gestures, downloads
  helpers/pixels.ts         canvas readback and colour centroids
  helpers/hostile.ts        the project made of everything a project should not contain
  helpers/png.ts            a solid-colour PNG, so image fixtures are readable in a diff
  helpers/wav.ts            a synthesised WAV, for the same reason and with no encoder
```

Adding a node type means adding to `editing.spec.ts` (it draws, it drags, it survives a
save) and to `helpers/hostile.ts` (any new string that reaches the exporter). The hostile
project now nests a rectangle inside a hostilely-named group, so both export paths run the
nested emit and the `add([...])` list, not only the flat one — and holds a hostilely-named
prefab, placed twice plus once danglingly, whose own children include a *sprite*. That
sprite is not decoration: it is the only thing that fails if `collectAssets` stops
descending into definitions, and the failure it catches is an export that boots and draws
a missing-texture square rather than one that errors. It also holds a hostilely-named
emitter with a non-default value in all eighteen of its fields, plus one with no image.
The first carries no free user text to escape and is not there for escaping: it is the
only place the emitted config literal's *shape* meets `ParticleEmitterConfig` under
`tsc --strict`, which is where a Phaser config key renamed between versions would fail and
nowhere else.

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

Texture atlases (the asset table holds whole images cut on a regular grid; an atlas is
named frames of arbitrary size, which is `generateFrameNames` and a second parser rather
than more of this one), and cameras.

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

Physics shipped in iteration 16 with five deliberate holes. **No simulation in the
editor** — the argument is the whole of the Physics section above, and it is the one hole
here that is not a loosening: running the world rewrites the document, so "add a play
button" is not a smaller version of this, it is a different editor. **No colliders or
overlap callbacks** — which two objects collide is game logic, the `scene.start` argument,
and it is also what `mass` and `immovable` are emitted for. **No circular bodies** —
`setCircle(radius, offsetX, offsetY)` defaults its offsets to the body's *current* offset
rather than to centred, so a bare `setCircle(r)` parks the circle in the corner of a
non-square object; getting it right means a radius and two offsets, and the radius is a
second answer to the object's own size (the "a sprite has no width or height" argument).
For a `text` node it is worse than awkward: text measures against the font at runtime and
the document does not know its size, so the editor's outline and the exported call could
compute different circles, in the one place where being wrong is invisible until something
fails to collide. It is a pure loosening later — one prop and three emitted arguments.
**No Matter physics**, which is a second engine with a second body model rather than more
of this one. And **no body on a node inside a group or a prefab**, which is *not* deferred
work: an axis-aligned body cannot express a rotated parent's frame at all, so it is a limit
of Arcade's body model rather than of this editor.

Particles shipped in iteration 15 with four deliberate holes. **No emit or death zones** —
a zone is a geometry object, i.e. a second sub-format inside the document with its own
parser, picker and validator, which is the `.tmj` argument at a smaller scale. **No
follow target, timed burst or `stopAfter`** — behaviour over time is game logic, the
`scene.start` argument again. **No per-particle animation**: `ParticlesProps` would grow an
`animationId` and `collectAnimations` a branch, which is a pure loosening later rather than
a format break, and the editor's whole clip story is built around a Sprite's
`AnimationState`. **No multi-frame particles**: a `frames` array would be the second
array-valued prop in the schema and the second `cloneWithNewIds` special case, for a look a
single frame mostly covers.

Tilemaps shipped in iteration 14 with three deliberate holes: **one layer per map**, **no
per-tile collision**, and **no Tiled import**. The first is a loosening rather than a
format break — `TilemapProps` would grow a list of layers where it has one `data`, and the
exporter a `createLayer` per entry — but each one is its own `putTileAt` diff and a layer
picker in the paint bar, which is a second mode inside a mode. The second is game logic
rather than layout, and the argument that keeps `scene.start` out of the document applies
unchanged: `setCollision([1, 2, 3])` is a line the user writes, and a per-tile flag in the
schema is the beginning of a behaviour model. Tiled import is not a loosening at all — a
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
iteration 15 and physics bodies in iteration 16. The
boxes the geometry family needs are in `src/core/bounds.ts`,
which any further geometry tool can read. That family is complete in the sense that
mattered — the user can now author a line of their own — and what is left of it is more of
the same shape: another line or gap fed to `snapMove`, or another kind of agreement on the
end of `snapRotation`'s chain. Guides at an angle are the one that is not, since a diagonal
guide has no per-axis offset and would need `snapMove`'s whole per-axis structure
rethought.
