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
this in the scene". See the README for the user-facing feature list.

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
   case.
4. `src/ui/Inspector.tsx` — a properties section.
5. `src/ui/SceneTree.tsx` — add to `ADDABLE`; add a `.tree__type[data-type=...]` colour
   chip in `src/styles/app.css`.
6. `src/io/exportPhaser.ts` — a `constructorFor` case. This one fails silently rather
   than at compile time: an unhandled type exports nothing at all, so check it in the
   same pass as the `EditorScene` case.
7. `tests/` — the two silent steps are exactly the two the suite covers: add the type to
   `tests/editing.spec.ts` (it draws where the document says, and survives a save and an
   open) and give it a hostile instance in `tests/helpers/hostile.ts`, which puts its
   strings through both export toolchains.

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
script-tag flavour where Phaser is a global. TS and JS differ by exactly one token — the
`: void` return annotation — because everything `buildCreateBody` emits is already plain
JavaScript, which is the same property that lets the HTML embed the body verbatim.

Both outputs share `buildCreateBody`, so the runnable page can never drift from the
file you ship. Adding a node type means adding a `constructorFor` case; anything not
handled there silently exports nothing, so check it alongside the `EditorScene` case.

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
  assets.spec.ts            image import, decode-on-open, removal
  export.spec.ts            the runnable page, actually run
  export-toolchain.spec.ts  the .ts under tsc --strict, the .js through a Vite build
  helpers/editor.ts         the page object: panels, fields, gestures, downloads
  helpers/pixels.ts         canvas readback and colour centroids
  helpers/hostile.ts        the project made of everything a project should not contain
  helpers/png.ts            a solid-colour PNG, so image fixtures are readable in a diff
```

Adding a node type means adding to `editing.spec.ts` (it draws, it drags, it survives a
save) and to `helpers/hostile.ts` (any new string that reaches the exporter). The hostile
project now nests a rectangle inside a hostilely-named group, so both export paths run the
nested emit and the `add([...])` list, not only the flat one.

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

Animations and sprite sheets (the asset table holds whole images only, and `sprite` nodes
render as Phaser `Image`s, not `Sprite`s — animation is the reason to change that),
tilemaps, physics, particles, audio, cameras, multiple scenes, and prefabs. Prefabs are the
natural next thing built on containers, and a group is what a prefab instance would be —
now that a selection is a set, "make a prefab of these" has something to start from.
Alignment and distribution shipped in iteration 6, snapping in iteration 7, equal spacing
and the grid in iteration 8, the rotate gesture with rotation snapping in iteration 9, and
persistent guides in iteration 10; the boxes they all need are in `src/core/bounds.ts`,
which any further geometry tool can read. That family is complete in the sense that
mattered — the user can now author a line of their own — and what is left of it is more of
the same shape: another line or gap fed to `snapMove`, or another kind of agreement on the
end of `snapRotation`'s chain. Guides at an angle are the one that is not, since a diagonal
guide has no per-axis offset and would need `snapMove`'s whole per-axis structure
rethought.
