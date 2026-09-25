import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  DEFAULT_FRAME_RATE,
  cloneWithNewIds,
  createInstanceNode,
  createNode,
  createScene,
  createTilemapLayer,
  defaultPhysicsBody,
  defaultSceneSound,
  newProject,
} from './defaults';
import {
  alignDeltas,
  boundsOf,
  distributeDeltas,
  type AlignEdge,
  type Axis,
  type Deltas,
  type Rect,
} from './bounds';
import {
  cameraOf,
  canHavePhysics,
  atlasOf,
  type AtlasFrame,
  coerceVariableValue,
  collidersOf,
  composeTransform,
  containsInstance,
  containsNode,
  controlsOf,
  defaultControls,
  defaultEffect,
  defaultTween,
  blendModeOf,
  scrollFactorOf,
  isDefaultScrollFactor,
  particleFollowOf,
  compensateFollowers,
  effectsOf,
  findAsset,
  findNode,
  findParent,
  findPrefab,
  findVariable,
  frameCountOf,
  frameGridOf,
  frameNamesOf,
  guidesOf,
  isDefaultCamera,
  labelOf,
  localTransformIn,
  newId,
  physicsOf,
  prefabChildrenOf,
  fontStackOf,
  soundsOf,
  ruleUsesVariable,
  rulesOf,
  scenePhysicsOf,
  tweenOf,
  variableKindOf,
  worldTransformOf,
  type AnimationClip,
  type AudioAsset,
  type FontAsset,
  type FrameGrid,
  type GameObjectNode,
  type ImageAsset,
  EMPTY_TILE,
  MAX_TILEMAP_SIDE,
  tileLayerOf,
  tileMapOf,
  MAX_EFFECTS,
  RAW_DECIMALS,
  type BlendMode,
  type ScrollFactor,
  type NodeEffect,
  type NodeTween,
  type VariableLabel,
  type TweenProperty,
  type TileLayer,
  type TilemapLayerDoc,
  type NodeControls,
  type NodeType,
  type PhysicsBody,
  type Prefab,
  type Project,
  type ProjectVariable,
  type RuleAction,
  type RuleCondition,
  type RuleTrigger,
  type SceneRule,
  type SceneCamera,
  type SceneCollider,
  type SceneDoc,
  type SceneSound,
  type SpriteProps,
  type TileCell,
  type TileMap,
  type TilemapProps,
  type Transform,
  type VariableKind,
} from './schema';
import { blockingIssues, validateProject, type ValidationIssue } from './validation';

const HISTORY_LIMIT = 100;

/**
 * The grid's pitch until someone changes it, in scene units.
 *
 * 32 because it is the tile size most 2D games start from, and because it is
 * coarse enough at the default 960x540 scene that switching the grid on is
 * visibly a different way of working rather than a rounding of what you had.
 */
const DEFAULT_GRID_SIZE = 32;

/**
 * The angular pitch a rotate gesture lands on, in degrees, until someone
 * changes it.
 *
 * 15 because it divides both 360 and 90, so 30, 45 and 90 all fall on the way
 * round without the user setting anything — and because it is the step every
 * drawing tool's rotation constraint has used for decades, so it is the one
 * number a user does not have to be told.
 */
const DEFAULT_ANGLE_STEP = 15;

export interface EditorState {
  project: Project;
  /**
   * The selected objects, in the order they were picked. The last entry is the
   * *primary* selection: what the inspector edits, where the scale handle sits,
   * and which group a new object lands in.
   *
   * An array rather than a single id because nearly every editing action is
   * worth applying to several objects at once, and doing that by hand — select,
   * act, select, act — is most of what makes a phone painful. Selection order
   * is not document order; `selectionRoots` is what turns this into the
   * document-ordered set an edit should actually act on.
   */
  selectedIds: string[];
  /** Name of the file on disk, once saved or opened. Drives the title bar. */
  fileName: string | null;
  /** True when there are changes not yet written to a file. */
  dirty: boolean;

  past: Project[];
  future: Project[];
  /** Depth of nested transactions; >0 means "don't record intermediate steps". */
  txDepth: number;
  /**
   * Each selected node's transform as it was when it was selected, so the
   * mobile move bar's cancel button can put the whole selection back where it
   * started. One entry per selected node: a move bar that could only undo part
   * of the move it had just confirmed would be worse than none.
   */
  moveOrigins: { id: string; transform: Transform }[];
  /**
   * Copied nodes, kept outside the document so they survive undo, redo and
   * opening another file. Paste offsets from them and writes the result back,
   * so pasting repeatedly cascades instead of stacking copies on one spot.
   */
  clipboard: GameObjectNode[];
  /**
   * Whether scaling keeps the object's aspect ratio. Editor state, not document
   * state: it is a preference about the tool, like the selection itself, and
   * two people opening the same file should not disagree about the shape of
   * its objects.
   *
   * On by default — a non-uniform scale is almost always a slip rather than an
   * intent, and it is the corner handle's normal behaviour everywhere else.
   */
  lockAspect: boolean;
  setLockAspect: (lockAspect: boolean) => void;
  /**
   * Sticky additive selection: while it is on, a press adds to the selection
   * instead of replacing it.
   *
   * Editor state, like `lockAspect`. Desktop has Shift and Ctrl for this, and a
   * phone has neither — a modifier that only exists on a keyboard would make
   * multi-select a desktop feature, which is exactly the split this project
   * does not accept. The toggle sits in the scene tree's header, where the rows
   * it changes the meaning of are.
   */
  multiSelect: boolean;
  setMultiSelect: (multiSelect: boolean) => void;
  /**
   * Whether a canvas drag is pulled into line with the objects around it.
   *
   * Editor state, like the two above: it changes how a gesture behaves, never
   * what the document says, so it is neither saved nor undoable. On by default,
   * because the precision a snap supplies is precisely what a fingertip lacks —
   * and off is one tap away for the drag that has to sit at 241.
   */
  snapEnabled: boolean;
  setSnapEnabled: (snapEnabled: boolean) => void;
  /**
   * Whether a canvas drag is also pulled onto a regular grid, and how far apart
   * that grid's lines are in scene units.
   *
   * A second toggle rather than a mode of the first: the two answer different
   * questions — "line this up with that object" and "put this on the pitch this
   * layout is built to" — and a tile-based game wants both at once. Object
   * snapping wins wherever they disagree (see `snapMove`).
   *
   * Off by default, because a grid nobody asked for silently coarsens every
   * drag in a project that has no pitch at all. Editor state like the rest of
   * this group: the pitch describes how you are working, not what the scene
   * is, and two people opening the same file are entitled to different answers.
   */
  gridEnabled: boolean;
  setGridEnabled: (gridEnabled: boolean) => void;
  gridSize: number;
  setGridSize: (gridSize: number) => void;
  /**
   * The angular pitch a rotate gesture lands on, in degrees.
   *
   * Governed by the *grid* toggle rather than a switch of its own. The grid
   * already means "quantise this to a regular pitch", and an angle step is that
   * idea one dimension over — just as the magnet means "agree with another
   * object", and snapping to a neighbour's tilt is *that* idea one dimension
   * over. So the two toggles each govern one more thing, and a 390px toolbar
   * that already clips does not have to hold a third.
   *
   * Editor state like the rest of this group: never saved, never undoable.
   */
  angleStep: number;
  setAngleStep: (angleStep: number) => void;
  /**
   * Whether the user's own guides are drawn — and, by the same switch, whether
   * a drag agrees with them.
   *
   * One flag for both because the alternative is a line that silently moves
   * things while not being on screen, which is the rule already applied to
   * hidden objects: a snap the user cannot see the reason for reads as the
   * editor rearranging their scene by itself.
   *
   * Editor state like the rest of this group, even though the guides
   * *themselves* are saved with the document. Whether you are currently looking
   * at them is how you are working; where they are is what the project says.
   */
  guidesVisible: boolean;
  setGuidesVisible: (guidesVisible: boolean) => void;

  /**
   * Whether the canvas moves by itself: animated sprites play, and particle
   * emitters emit.
   *
   * Editor state, never saved, and off by default — the same family as
   * `snapEnabled` and `lockAspect`. A canvas that animates by itself is a
   * canvas whose objects are never where you last looked, which makes placing
   * one by eye a matter of timing; and the frame a still sprite shows is a
   * document field the user is editing, so it has to be the frame on screen
   * while they edit it. Preview is therefore something asked for, and the one
   * moment the canvas stops mirroring the document exactly.
   *
   * An emitter is that argument at its sharpest — stopped it sits at a fixed
   * place, running it draws a cloud that is somewhere different every frame —
   * which is why it rides on this one field rather than a second toggle. Named
   * for the motion rather than for animations because it governs both: a field
   * named after one of two things is how a future reader talks themselves into
   * adding a second flag for the other.
   */
  previewMotion: boolean;
  setPreviewMotion: (previewMotion: boolean) => void;

  /**
   * Whether Play game is running: the exported game, isolated over the editor.
   *
   * Editor state in the `previewMotion` / `snapEnabled` / `lockAspect` family —
   * never saved, never dirty, never undoable. Unlike the section state it is
   * deliberately *not* persisted through `io/prefs.ts`: the shape of a tidied
   * panel is worth having back after a reload, and a running game is not.
   * Coming back to a game covering the document is coming back to a document
   * you cannot see.
   *
   * It is not `previewMotion`, which is the distinction worth keeping sharp.
   * Starting Play game turns Preview motion off so two runtimes are never
   * presented as active at once, but neither transition touches `project`.
   * Preview motion animates the *document's* canvas; Play game runs a *game* in
   * a document of its own, while the editor canvas underneath keeps refusing
   * to simulate. See "Play" in CLAUDE.md.
   *
   * Nothing prunes it the way `paintingId` is pruned, because there is nothing
   * here to dangle — the overlay holds a snapshot of the page, not a reference
   * into the document. `loadProject` and `resetProject` do clear it, since a
   * game whose project has been replaced is a game no document describes.
   */
  playGameRunning: boolean;
  /** Last validation result, shared by Play/export UI and navigable in-place. */
  validationIssues: ValidationIssue[];
  /** Field requested by the issue summary; inspectors may use it as a focus target. */
  validationFocusPath: string | null;
  /**
   * The inspector section an issue asked to be revealed, until that section has
   * scrolled itself into view and taken focus. Editor state, never saved.
   */
  validationFocusSection: string | null;
  clearValidationFocusSection: () => void;
  setPlayGameRunning: (running: boolean) => void;
  showValidationIssues: (issues: ValidationIssue[]) => void;
  focusValidationIssue: (issue: ValidationIssue) => void;

  /**
   * Which sections of the inspector are open.
   *
   * Editor state, in the `lockAspect` / `snapEnabled` family — it is a
   * preference about the panel, never a fact about the project, so it is not
   * saved with the document, does not mark the file dirty and is not undoable.
   * Unlike the rest of that family it *is* persisted, through `io/prefs.ts`: a
   * panel the user has tidied should still be tidy after a reload, where
   * whether the aspect lock is on is about the gesture in hand.
   *
   * Two fields rather than a set of what is open. `setAllSections` has to be
   * able to say "everything, including sections that are not on screen right
   * now and sections nobody has written yet", and a set cannot — it would have
   * to enumerate every title in the file, which is a list that goes stale
   * silently the next time one is added. So the default is a field of its own
   * and an override is recorded only for a section the user has touched.
   *
   * Keyed by title, so a section stays as it was left across a selection change
   * and across node types: opening "Appearance" once means it is open on the
   * next sprite too, which is how anyone actually works. Every repeated title
   * in the inspector is either a mutually exclusive `node.type` branch or an
   * alternate empty state of one section, so no two can render at once.
   */
  sectionsOpenByDefault: boolean;
  sectionOverrides: Record<string, boolean>;
  toggleSection: (title: string) => void;
  setAllSections: (open: boolean) => void;
  /**
   * Replaces the section state wholesale, for `main.tsx` to seed from storage
   * before the first render.
   *
   * The store deliberately does not read or write localStorage itself: nothing
   * in `core/` imports from `io/`, and adding the first such import to hold a
   * panel preference would invert the one layering rule this codebase has. The
   * composition root does the wiring, which is where a persistence decision
   * belongs, and doing it before `render` is what keeps the panel from opening
   * and then visibly snapping shut a frame later.
   */
  hydrateSections: (openByDefault: boolean, overrides: Record<string, boolean>) => void;
  /**
   * The tilemap the canvas is currently painting, or null.
   *
   * Editor state, in the `lockAspect` / `snapEnabled` family: it changes what a
   * press on the canvas does and never what the document says, so it is neither
   * saved nor undoable. It is a mode, and it says so — while it is set, a press
   * lays a tile instead of selecting, panning or dragging, and the two handles
   * are hidden. That is the whole reason it exists rather than painting
   * whenever a tilemap happens to be selected: without a mode, a selected
   * tilemap could never be moved or resized on the canvas again, and on touch
   * the tap meant to pick some other object would lay a tile instead.
   *
   * It is pruned wherever the selection is, so "you can only paint a tilemap
   * that exists and is on screen" is an invariant rather than something delete,
   * undo and the scene switcher each have to remember.
   */
  paintingId: string | null;
  /**
   * The layer the brush lays on, the palettes read and the paint grid marks.
   *
   * Editor state beside `paintingId` and pruned with it, so "you can only paint
   * a layer that exists on the map in hand" is an invariant rather than
   * something delete, undo, the scene switcher and `removeTilemapLayer` each
   * have to remember. Null resolves to the frontmost layer through
   * `tileLayerOf`, which is the one a user has just added.
   */
  activeLayerId: string | null;
  /** The tile the brush lays. An index into the tileset, like a sprite frame. */
  brushTile: number;
  /** Whether the brush clears instead, which is laying `EMPTY_TILE`. */
  erasing: boolean;
  setPainting: (nodeId: string | null) => void;
  setActiveLayer: (layerId: string | null) => void;
  setBrushTile: (brushTile: number) => void;
  setErasing: (erasing: boolean) => void;
  /**
   * Scales a node, honouring `lockAspect`. Both the inspector's Scale fields
   * and the canvas corner handle go through here so the lock cannot mean one
   * thing in one place and something else in the other.
   */
  scaleNode: (id: string, axis: 'x' | 'y', value: number) => void;

  // -- document lifecycle ----------------------------------------------------
  loadProject: (project: Project, fileName: string | null) => void;
  resetProject: () => void;
  markSaved: (fileName: string) => void;
  renameProject: (name: string) => void;

  // -- scenes ----------------------------------------------------------------
  /**
   * Switches which scene the editor is looking at.
   *
   * A document edit like any other, not an editor preference: `activeSceneId`
   * is saved with the file, so a project reopens on the scene it was left on.
   * That it is undoable falls out of the same fact, and is what makes undo
   * legible across a switch — an edit made in another scene is undone *with*
   * the jump back to the scene it happened in, rather than silently somewhere
   * the user cannot see.
   *
   * Nothing here clears the selection: `editProject` prunes it against the
   * scene that is now active, and no id from the old one survives that. The
   * invariant does the work, as it does for a delete.
   */
  setActiveScene: (id: string) => void;
  /** Adds an empty scene and switches to it, in one undo step. */
  addScene: () => void;
  /**
   * Copies the active scene — objects, guides and all, with fresh ids — and
   * switches to the copy.
   *
   * New ids because two scenes sharing a node id would have `findNode` answer
   * with whichever it reached first, and the renderer keys display objects by
   * that id. A scene is the one place a duplicate is a whole document subtree
   * rather than a node, but it is `cloneWithNewIds` doing the work either way.
   */
  duplicateScene: () => void;
  /**
   * Removes a scene, and switches to a neighbour when it was the active one.
   *
   * Refused for the last scene: a project with no scenes has nothing to draw,
   * no active scene for every panel that reads one, and `parseProject` rejects
   * the file it would save. "Delete the only scene" means "empty it", which the
   * tree's own row buttons already do.
   */
  removeScene: (id: string) => void;

  // -- selection -------------------------------------------------------------
  /** Replaces the selection with one node, or clears it. */
  select: (id: string | null) => void;
  /** Adds a node to the selection, or takes it out if it is already in. */
  toggleSelect: (id: string) => void;
  /** Replaces the selection outright, in the order given. */
  selectMany: (ids: string[]) => void;
  /**
   * Everything at the top level of the scene. Nested objects are deliberately
   * left out: they are already covered by the group they are in, and an edit
   * applied to a group *and* its children would apply twice.
   */
  selectAll: () => void;
  /** Mobile move bar: put the selection back where it was when selected. */
  cancelMove: () => void;
  /** Mobile move bar: accept the move and leave move mode. */
  commitMove: () => void;

  // -- assets ----------------------------------------------------------------
  addAsset: (asset: ImageAsset) => void;
  /**
   * Removes an image and clears it from every sprite pointing at it, in one
   * undo step. Dropping only the asset would leave dangling references in a
   * saved file, so the document can never be in that state by any action here.
   */
  removeAsset: (id: string) => void;

  /**
   * Cuts an image into frames, or (with null) puts it back to being one
   * picture.
   *
   * On the asset rather than on a sprite, because the grid is a property of the
   * image. Re-cutting clamps the frames of every sprite and clip that reads it;
   * un-cutting removes those clips, since there is no longer a sequence for
   * their indices to point into. All of it is one undo step.
   */
  setAssetSheet: (assetId: string, sheet: FrameGrid | null) => void;
  /**
   * Cuts an image by a texture atlas, or (with null) puts it back to being one
   * picture.
   *
   * `setAssetSheet` one cut over, and the two are exclusive: setting either
   * deletes the other, because an image is cut one way. Re-importing an atlas
   * keeps every clip frame whose *name* survives and drops the rest; changing
   * which kind of cut an image has removes its clips outright, since an index
   * and a name cannot mean each other. One undo step.
   */
  setAssetAtlas: (assetId: string, frames: AtlasFrame[] | null) => void;
  /**
   * Creates a clip over every frame of the sprite's image — indices of a grid,
   * or names out of an atlas — and plays it on that sprite, in one step. There
   * is no bare `addAnimation`: a clip nothing plays cannot be seen, so creating
   * one and assigning it are the same act.
   */
  addAnimationFor: (nodeId: string) => void;
  updateAnimation: (id: string, patch: Partial<Omit<AnimationClip, 'id' | 'assetId'>>) => void;
  /** Removes a clip and stops every sprite playing it, in one undo step. */
  removeAnimation: (id: string) => void;

  // -- audio -----------------------------------------------------------------
  addAudio: (asset: AudioAsset) => void;
  /**
   * Removes a sound and every scene entry registering it, in one undo step.
   *
   * `removeAsset` settled that the document may never hold a dangling reference
   * after any action in the editor. What differs is what is left behind: there,
   * a sprite is an object that *has* an image, so clearing the reference leaves
   * something on the canvas worth keeping. A `SceneSound` **is** a reference —
   * an id and four settings for it — so when the file goes there is nothing for
   * the entry to be, and it goes too.
   */
  removeAudio: (id: string) => void;
  /** Registers a sound in the active scene, at rest. */
  addSceneSound: (audioId: string) => void;
  updateSceneSound: (id: string, patch: Partial<Omit<SceneSound, 'id'>>) => void;
  removeSceneSound: (id: string) => void;

  // -- fonts -----------------------------------------------------------------
  addFont: (asset: FontAsset) => void;
  /**
   * Removes a font, and touches nothing else.
   *
   * **Beside `removeAsset`'s walk of every node in the project this looks like
   * a forgotten step, and it is the whole payoff of the design.** A sprite
   * names an image by id, so an image that goes leaves an id pointing at
   * nothing — the one thing the document is never allowed to hold. A text node
   * names a *family*, which is the same field it uses to name Georgia, and a
   * family naming nothing is not dangling: it is what every text node in every
   * project made before this feature already says. So the text keeps the name
   * the user chose, and goes back to being drawn in the browser's fallback,
   * which is exactly the state it was in before the font was imported.
   *
   * The picker still warns first, through `countFontUses` — the change is
   * visible even though it is not destructive, and a font is one press to
   * import again but the family name is not one press to retype.
   */
  removeFont: (id: string) => void;

  // -- variables -------------------------------------------------------------
  /**
   * Declares a new variable, starting at zero under a name nothing else has.
   *
   * The name is unique on arrival rather than de-duplicated at export, so a
   * fresh row never opens already showing a suffixed key — `defaultTween`'s
   * rule that a thing switched on should arrive doing something legible. A
   * *rename* is deliberately not de-duplicated, for `renamePrefab`'s reason:
   * forcing uniqueness on every keystroke fights the user halfway through a
   * word, and `collectVariables`' own set is the backstop that makes the
   * export correct regardless.
   */
  addVariable: () => void;
  updateVariable: (id: string, patch: Partial<Omit<ProjectVariable, 'id'>>) => void;
  /**
   * Switches what kind of value a variable holds, converting the value and
   * every rule in the project that reads or writes it in the same step. Not an
   * `updateVariable` patch, because the kind *is* the value's type and changing
   * it reaches further than the row — see the implementation.
   */
  setVariableKind: (id: string, kind: VariableKind) => void;
  /** Removes a variable. */
  removeVariable: (id: string) => void;

  // -- prefabs ---------------------------------------------------------------
  /**
   * Turns the selection into a prefab definition and leaves an instance of it
   * in the selection's place, on the `groupSelection` model: the frontmost
   * selected object anchors it, so nothing moves on the canvas.
   */
  createPrefabFromSelection: () => void;
  /** Places an instance, landing in the group you are working in as an add does. */
  placePrefab: (prefabId: string) => void;
  /**
   * Overwrites a definition from a group in the scene — the round trip that
   * makes editing a prefab possible without a mode of its own: detach an
   * instance, edit it with every tool that already exists, then push it back.
   *
   * Refused when it would make the prefab contain itself, for the reason
   * `moveNode` refuses a cycle: the guard belongs where every caller passes.
   */
  updatePrefabFrom: (prefabId: string, nodeId: string) => void;
  /**
   * Replaces an instance with a real group holding a copy of the definition's
   * contents. Its transform, name and visibility survive, and so does its id,
   * so the object stays selected across the change.
   */
  detachInstance: (id: string) => void;
  renamePrefab: (id: string, name: string) => void;
  /**
   * Removes a definition, detaching every instance of it first and in the same
   * undo step. `removeAsset` sets the rule: no action here may leave a dangling
   * reference in the document, and refusing instead would leave the user with a
   * prefab they cannot delete and no way to find what still uses it.
   */
  removePrefab: (id: string) => void;

  // -- editing ---------------------------------------------------------------
  /**
   * Adds a node. It lands in the group you are working in — the selection when
   * that is a group, otherwise the group the selection sits in — and at the top
   * level of the scene when neither applies.
   */
  addNode: (type: NodeType) => void;
  /**
   * Reparents a node, keeping it exactly where it is on the canvas: the stored
   * transform is recomputed against the new parent's. `parentId` must name a
   * container, and may not be the node itself or anything inside it — a cycle
   * would make the tree unrenderable and unsaveable.
   */
  moveNode: (id: string, parentId: string | null, index?: number) => void;
  /**
   * Wraps the selection in a new container, in the frontmost selected object's
   * place in the draw order. The container takes that object's position and
   * every selected object is recomputed against it, so nothing moves on the
   * canvas — grouping changes what things move *with*, not where they are.
   */
  groupSelection: () => void;
  /** Deletes one node, whichever is selected — the scene tree's row button. */
  deleteNode: (id: string) => void;
  deleteSelection: () => void;
  /** Copies each selected object, its style and its subtree, one step above it. */
  duplicateSelection: () => void;
  copySelection: () => void;
  pasteNode: () => void;
  /**
   * Moves a node to `toIndex` among its own siblings, clamped. Array order *is*
   * draw order — the Phaser sync sets each object's depth from its index — so
   * this is the whole of raise, lower, bring to front and send to back, within
   * whichever list the node lives in.
   */
  reorderNode: (id: string, toIndex: number) => void;
  renameNode: (id: string, name: string) => void;
  setNodeVisible: (id: string, visible: boolean) => void;
  /** Shows or hides every selected object, in one undo step. */
  setSelectionVisible: (visible: boolean) => void;
  /**
   * Moves the whole selection by a delta in *world* pixels — the arrow keys.
   *
   * World rather than local because that is what the user sees: two objects in
   * differently rotated groups nudged by the same key should travel the same
   * way on screen, not each along its own group's axes.
   */
  nudgeSelection: (dx: number, dy: number) => void;
  /**
   * Lines the selection up on one edge or centre line of its own bounding box,
   * in one undo step.
   *
   * Works on measured bounds (`src/core/bounds.ts`) rather than on stored
   * positions: a node's `x`/`y` is its origin, and lining origins up is not
   * lining objects up as soon as two of them are different sizes — which they
   * almost always are.
   */
  alignSelection: (edge: AlignEdge) => void;
  /**
   * The same, against the scene rectangle instead of the selection's own box.
   *
   * This is the one alignment a *single* object can ask for — "centre this in
   * the scene". Aligning one object to its own bounding box is a no-op by
   * construction, which is why `alignSelection` refuses below two and this
   * deliberately does not.
   */
  alignSelectionToScene: (edge: AlignEdge) => void;
  /** Spaces the selection evenly along one axis, by centres. Needs three. */
  distributeSelection: (axis: Axis) => void;
  updateTransform: (id: string, patch: Partial<Transform>) => void;
  updateProps: (id: string, patch: Record<string, unknown>) => void;
  /**
   * `guides` is excluded alongside `children` and `id`: they have their own
   * four actions below, and one patch path that could also rewrite the array
   * wholesale is how a second, undocumented way to edit them appears. `camera`
   * and `colliders` are excluded for the same reason and have `setCamera` and
   * the three collider actions below.
   */
  updateScene: (
    patch: Partial<Omit<SceneDoc, 'children' | 'id' | 'guides' | 'camera' | 'colliders'>>,
  ) => void;

  // -- camera ----------------------------------------------------------------
  /**
   * Edits the scene's camera, merging over the validated read.
   *
   * `camera` is excluded from `updateScene`'s patch for the reason `guides` is:
   * one path that could also rewrite it wholesale is how a second, undocumented
   * way to edit it appears — and this one cleans a hand-edited field on its way
   * past, which a wholesale patch would not.
   *
   * A `followId` naming anything but a direct child of the scene is ignored,
   * which is `setNodePhysics` reaching into `scene.children` directly and for
   * the same reason: a camera follows world coordinates, and a node inside a
   * container has none of its own.
   */
  setCamera: (patch: Partial<SceneCamera>) => void;

  // -- physics ---------------------------------------------------------------
  /**
   * Adds, edits or removes a node's Arcade body. `null` removes it.
   *
   * It reaches into `scene.children` directly rather than through `mapNode`,
   * and that is the whole of the "only a top-level node may have a body" rule:
   * a nested node is not in that array, so this action cannot reach one and
   * there is no second place to remember the guard — the `moveNode` cycle
   * refusal by another route. A patch merges over whatever the node already
   * has, so the inspector's fields each send one key.
   */
  setNodePhysics: (id: string, patch: Partial<PhysicsBody> | null) => void;

  // -- behaviour -------------------------------------------------------------
  /**
   * Adds, edits or removes what the player drives a node with. `null` removes
   * it.
   *
   * It reaches into `scene.children` directly for `setNodePhysics`' reason, and
   * it is the same rule: only a top-level node with a dynamic body can be
   * driven, so a nested one is simply not in the array this searches. There is
   * no second place to remember the guard.
   */
  setNodeControls: (id: string, patch: Partial<NodeControls> | null) => void;

  // -- tweens ----------------------------------------------------------------
  /**
   * Adds, edits or removes a node's tween. `null` removes it.
   *
   * It goes through `mapNode` rather than reaching into `scene.children`, and
   * that difference from `setNodePhysics` and `setNodeControls` is the whole of
   * "a tween has no top-level rule". Those two search that array *because* only
   * a top-level node may carry a body or be driven — a velocity and an Arcade
   * body both read world coordinates. A tween writes the object's own
   * properties, which a container child has as surely as a scene child does, so
   * copying their shape here would be a limit nobody argued for.
   *
   * A patch merges over whatever the node already has, so the inspector's
   * fields each send one key. `to` is merged one level deeper by
   * `setTweenTarget`, since a `Partial<NodeTween>` naming `to` would replace the
   * whole destination rather than one of its properties.
   */
  setNodeTween: (id: string, patch: Partial<NodeTween> | null) => void;
  /**
   * Sets one of the six destination properties, or clears it with `null`.
   *
   * Its sibling rather than a fifth argument to `setNodeTween`, which is
   * `editTilemapLayer`'s relationship to `editTilemapProps` and for its reason:
   * a patch merged at the top level cannot say "leave the other five alone".
   * Clearing is a `delete` rather than a zero, because `tweenOf` reads an absent
   * property as one this tween is not about and a zero as a destination.
   */
  setTweenTarget: (id: string, property: TweenProperty, value: number | null) => void;
  /**
   * Appends an effect of `kind`, seeded by `defaultEffect`, or does nothing at
   * the cap.
   *
   * Through `mapNode` rather than `scene.children`, which is `setNodeTween`'s
   * difference from `setNodePhysics` and for its reason: an effect on a node
   * inside a group is a perfectly ordinary thing to want, and on a node inside
   * a prefab definition it draws in every placement.
   */
  addEffect: (id: string, kind: NodeEffect['kind']) => void;
  /**
   * Replaces one effect outright.
   *
   * Whole rather than a patch, unlike `setNodeTween`, and the union is why: a
   * `Partial<NodeEffect>` cannot be merged onto a member without the compiler
   * losing which member it is, so a patch would have to be typed loosely enough
   * to let a blur take a `decay`. The panel holds the effect it is editing
   * anyway, so a spread at the call site costs it nothing — and switching the
   * *kind* is this same call with `defaultEffect(kind)`, which is what stops a
   * glow's fields surviving underneath a pixelate.
   */
  setEffect: (id: string, index: number, effect: NodeEffect) => void;
  removeEffect: (id: string, index: number) => void;
  /** Moves one effect along the list, which is the order the passes run in. */
  moveEffect: (id: string, index: number, delta: number) => void;
  /**
   * Sets how a node composites with what is behind it, at any depth.
   *
   * Its own action rather than an `updateProps` patch because `NORMAL` is
   * *absence* and a spread cannot remove a key — `setNodePhysics`,
   * `setNodeControls`, `setNodeTween` and `setNodeLabel`'s reason — and because
   * it also strips the pre-v15 `ParticlesProps.blendMode` in the same write.
   */
  setNodeBlendMode: (id: string, mode: BlendMode) => void;
  /**
   * Sets how far a top-level node moves when the camera does, per axis.
   *
   * Its own action rather than an `updateProps` patch because `{ x: 1, y: 1 }`
   * is *absence* and a spread cannot remove a key — `setNodePhysics`,
   * `setNodeControls`, `setNodeTween`, `setNodeLabel` and `setNodeBlendMode`'s
   * reason, for the sixth time: `{ scrollFactor: undefined }` leaves the key
   * holding undefined, which survives in memory, vanishes through
   * `JSON.stringify`, and gives the document two spellings of one state.
   *
   * It reaches `scene.children` directly rather than through `mapNode`, and
   * that **is** the refuse-on-write half of the top-level rule — a nested node
   * is simply not in the array it searches. `setNodePhysics`' shape exactly,
   * where `setNodeBlendMode` beside it deliberately uses `mapNode` because a
   * blend mode means something at any depth.
   */
  setNodeScrollFactor: (id: string, factor: ScrollFactor | null) => void;
  /**
   * Makes a top-level emitter follow another top-level object, or stop, with
   * `null`.
   *
   * **The emitter does not move on the canvas**, which is `moveNode`'s
   * reparenting rule arriving on a follow: while a follow is in force the
   * stored `x`/`y` is an offset from the target, so starting one rewrites the
   * position as "where it is drawn, less the target", and stopping one adds the
   * target back. Both sides go through `particleFollowOf`, so a follow the
   * reader would not honour — a turned emitter, a target that is gone — moves
   * nothing when it is set or cleared either.
   *
   * An action of its own rather than an `updateProps` patch, for
   * `setNodeScrollFactor`'s reason: a spread can set a key and never remove
   * one. And `scene.children` directly, which *is* the top-level rule.
   */
  setParticleFollow: (id: string, targetId: string | null) => void;
  /**
   * Binds a text node's caption to a variable, edits the format, or unbinds it
   * with `null`.
   *
   * An action of its own rather than `updateProps`, for two reasons and the
   * first is the one that decides it. `updateProps` spreads a patch, so it can
   * set a label and can never *remove* one: `{ label: undefined }` leaves the
   * key in place holding undefined, which survives in memory, vanishes through
   * `JSON.stringify`, and gives the document two spellings of "off".
   * `setNodePhysics`, `setNodeControls` and `setNodeTween` all `delete` for that
   * reason and this joins them. The second is that binding one has to *seed* a
   * variable — `defaultTween`'s rule, that a thing arrives already naming
   * something rather than naming nothing — and `updateProps` cannot see the
   * project's variable table from inside a scene edit.
   */
  setNodeLabel: (id: string, patch: Partial<VariableLabel> | null) => void;
  /**
   * Adds a collider row between two nodes, or edits or removes one.
   *
   * A row is added already pointing at the two nodes the caller names, which is
   * what the inspector's "+ Collision" button has to hand — because a row naming
   * nothing has nothing for `collidersOf` to keep, so there would be no row on
   * screen to then fill in.
   */
  addCollider: (aId: string, bId: string) => void;
  updateCollider: (id: string, patch: Partial<Omit<SceneCollider, 'id'>>) => void;
  /**
   * Removes a pairing, and with it every rule that fires on that touch.
   *
   * `removePrefab` detaching its instances, and `removeAsset`'s invariant: the
   * document may never hold a dangling reference after any action in the
   * editor. A collide rule *is* the row's third argument, so when the row goes
   * there is nowhere left for the rule to be emitted.
   */
  removeCollider: (id: string) => void;

  // -- rules -----------------------------------------------------------------
  /**
   * Adds a rule to the active scene, already doing something.
   *
   * Every picker it opens with is seeded with a real choice, which is
   * `defaultTween`'s rule and its reason: the first thing anybody does after
   * switching a feature on is try it, and a rule that arrives naming nothing is
   * one `rulesOf` drops on the very next read — so there would be nothing on
   * screen left to fill in. `CollidersSection` already records that failure.
   *
   * An Arcade `collide` trigger **creates the collider row it needs**, in the
   * same undo step. That is `addCollider`'s "a row arrives already pointing at
   * two objects", and it is the first time the write half of "strip on read,
   * refuse on write" is a *construction* rather than a refusal.
   */
  addRule: (when: RuleTrigger) => void;
  updateRule: (id: string, patch: Partial<Omit<SceneRule, 'id'>>) => void;
  removeRule: (id: string) => void;
  /**
   * Conditions and actions are addressed **by index**, because they carry no id
   * — see `RuleCondition`. Nothing outside the rule names one.
   */
  addRuleCondition: (ruleId: string) => void;
  updateRuleCondition: (ruleId: string, index: number, patch: Partial<RuleCondition>) => void;
  removeRuleCondition: (ruleId: string, index: number) => void;
  addRuleAction: (ruleId: string) => void;
  updateRuleAction: (ruleId: string, index: number, action: RuleAction) => void;
  removeRuleAction: (ruleId: string, index: number) => void;
  /** The order actions run in is the order they are listed in, so it is edited. */
  moveRuleAction: (ruleId: string, index: number, delta: number) => void;

  // -- tilemaps --------------------------------------------------------------
  /**
   * Lays `tile` in each of the given cells, or clears them when it is
   * `EMPTY_TILE`. Cells outside the grid are ignored rather than refused: a
   * stroke that runs off the edge of the map is a normal gesture, not an error.
   *
   * One call is one edit, and the array is rewritten once for however many
   * cells it names — a stroke is a list of cells, not a call per cell. Nothing
   * is written at all when every cell already holds that tile, so the identity
   * `editProject` reads for "no undo step" survives a finger held still.
   */
  paintTiles: (nodeId: string, layerId: string | null, cells: TileCell[], tile: number) => void;
  /** Every cell of one layer at once, in one step. */
  fillTiles: (nodeId: string, layerId: string | null, tile: number) => void;
  /**
   * Re-shapes the grid, keeping the top-left anchored — a column added is a
   * column of empties on the right.
   *
   * A dedicated action rather than two `updateProps` calls because the array is
   * flat: reinterpreting it under a new column count shifts every row after the
   * first, so the re-shape has to happen in the same step as the number that
   * causes it.
   */
  resizeTilemap: (nodeId: string, columns: number, rows: number) => void;
  /**
   * Marks one of the tileset's frames solid, or lets it go back to being
   * scenery. Which *frames* are solid, never which cells: a wall tile is a wall
   * wherever it was painted, and a per-cell flag would be a second array the
   * length of `data` for a distinction nobody draws.
   */
  setTileSolid: (nodeId: string, layerId: string | null, tile: number, solid: boolean) => void;

  /**
   * Adds a layer to a map, removes one, renames it, hides it or moves it in the
   * draw order.
   *
   * Layers are the map's own array order, back to front, exactly as
   * `scene.children` is — there is no depth field here either, so `moveTilemapLayer`
   * splicing the array is the whole of forward and back.
   *
   * `removeTilemapLayer` refuses the last one, which is `removeScene`'s rule for
   * `removeScene`'s reason: a map with no layers has nothing to paint on, nothing
   * to draw and no layer for `tileLayerOf` to answer with. "Delete the only
   * layer" means "empty it", which the Clear button already does.
   */
  addTilemapLayer: (nodeId: string) => void;
  removeTilemapLayer: (nodeId: string, layerId: string) => void;
  renameTilemapLayer: (nodeId: string, layerId: string, name: string) => void;
  setTilemapLayerVisible: (nodeId: string, layerId: string, visible: boolean) => void;
  moveTilemapLayer: (nodeId: string, layerId: string, delta: number) => void;

  // -- guides ----------------------------------------------------------------
  /**
   * Places a guide, and moves, removes or clears them.
   *
   * Document actions, so they are undoable like any other edit and are saved
   * with the project — a guide is a line the user authored, not a preference
   * about how the editor behaves. (`guidesVisible`, above, is the preference,
   * and it is neither.)
   */
  addGuide: (axis: Axis, position: number) => void;
  moveGuide: (id: string, position: number) => void;
  removeGuide: (id: string) => void;
  clearGuides: () => void;

  // -- history ---------------------------------------------------------------
  /**
   * Groups every mutation until `endTransaction` into one undo step. Dragging an
   * object fires a mutation per pointer-move; without this, one drag would bury
   * the undo stack under a hundred entries.
   */
  beginTransaction: () => void;
  endTransaction: () => void;
  undo: () => void;
  redo: () => void;
}

/** Rebuilds the tree with `fn` applied to the node matching `id`. */
function mapNode(
  nodes: GameObjectNode[],
  id: string,
  fn: (node: GameObjectNode) => GameObjectNode,
): GameObjectNode[] {
  return nodes.map((node) => {
    if (node.id === id) return fn(node);
    if (node.children.length === 0) return node;
    const children = mapNode(node.children, id, fn);
    return children === node.children ? node : { ...node, children };
  });
}

/**
 * Rebuilds the tree with `fn` applied to the *list* `id` belongs to — its
 * parent's children, or the scene's own array.
 *
 * Draw order is array order at every level of the tree, so raise, lower,
 * duplicate and drag-to-reorder are all "splice this list" and differ only in
 * how. Doing that through one traversal is what stops each of them growing its
 * own idea of where a node lives.
 */
function editSiblings(
  nodes: GameObjectNode[],
  id: string,
  fn: (list: GameObjectNode[], index: number) => GameObjectNode[],
): GameObjectNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) return fn(nodes, index);

  let changed = false;
  const next = nodes.map((node) => {
    if (node.children.length === 0) return node;
    const children = editSiblings(node.children, id, fn);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  // Identity is how editProject hears "nothing happened".
  return changed ? next : nodes;
}

/** Inserts `node` into a container's children, or into the scene's own list. */
function insertNode(
  nodes: GameObjectNode[],
  parentId: string | null,
  node: GameObjectNode,
  index?: number,
): GameObjectNode[] {
  const into = (list: GameObjectNode[]) => {
    const at = Math.max(0, Math.min(list.length, index ?? list.length));
    return [...list.slice(0, at), node, ...list.slice(at)];
  };
  if (parentId === null) return into(nodes);
  return mapNode(nodes, parentId, (parent) => ({ ...parent, children: into(parent.children) }));
}

function removeNode(nodes: GameObjectNode[], id: string): GameObjectNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children.length === 0
        ? node
        : { ...node, children: removeNode(node.children, id) },
    );
}

/**
 * Rewrites every sprite in the tree through `patch`, which returns the props to
 * merge or null to leave that sprite alone.
 *
 * One traversal for the four things that reach across the document into
 * sprites — removing an image, removing an animation, and re-cutting or
 * un-cutting a sheet. Each of those has to touch every scene, and each has to
 * preserve array identity where nothing changed, because identity is the signal
 * `editProject` reads for "nothing happened" and therefore for "no undo step".
 * Written once, that invariant is kept once.
 */
function mapSprites(
  nodes: GameObjectNode[],
  patch: (props: SpriteProps, id: string) => Partial<SpriteProps> | null,
): GameObjectNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    const children = node.children.length === 0 ? node.children : mapSprites(node.children, patch);
    // Narrowed inside the branch rather than through a `props` local: spreading
    // a partial patch over the union widens `props` past the branch `type`
    // picked, which is the same cast `updateProps` needs and does not need here.
    if (node.type === 'sprite') {
      const props = patch(node.props, node.id);
      if (props) {
        changed = true;
        return { ...node, props: { ...node.props, ...props }, children };
      }
    }
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : nodes;
}

/**
 * The same, across every scene in the project.
 *
 * The division of labour with `mapProjectNodes` is worth stating once, because
 * both look like "reach across the document and patch things": this one is the
 * traversal for everything about a **clip**, which only a sprite can play, and
 * `mapProjectNodes` is the traversal for everything about an **image**, which a
 * sprite, an emitter and a tilemap can all point at. That is also why only the
 * second one walks the prefab definitions — an image reference inside one
 * outlives the image otherwise.
 */
function mapProjectSprites(
  project: Project,
  patch: (props: SpriteProps, id: string) => Partial<SpriteProps> | null,
): Project {
  let changed = false;
  const scenes = project.scenes.map((scene) => {
    const children = mapSprites(scene.children, patch);
    if (children === scene.children) return scene;
    changed = true;
    return { ...scene, children };
  });
  return changed ? { ...project, scenes } : project;
}

/**
 * Rewrites every node in a tree through `patch`, which returns a replacement or
 * null to leave that node alone.
 *
 * `mapSprites`' sibling, and separate from it on purpose: that one merges a
 * props patch into one node type, this one replaces whole nodes of any type,
 * which is what detaching an instance is. Both keep array identity where
 * nothing changed, because identity is the signal `editProject` reads for "no
 * undo step".
 *
 * Children are rewritten before the node itself, so a patch sees the subtree it
 * is about to replace already up to date.
 */
function mapNodes(
  nodes: GameObjectNode[],
  patch: (node: GameObjectNode) => GameObjectNode | null,
): GameObjectNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    const children = node.children.length === 0 ? node.children : mapNodes(node.children, patch);
    const current =
      children === node.children ? node : ({ ...node, children } as GameObjectNode);
    const replaced = patch(current);
    if (replaced || current !== node) changed = true;
    return replaced ?? current;
  });
  return changed ? next : nodes;
}

/**
 * The same, across every scene *and* every prefab definition.
 *
 * The definitions are walked too because an instance can live inside one: a
 * chest prefab that contains a coin prefab is a normal thing to build, and
 * deleting the coin has to reach that instance as surely as it reaches the ones
 * sitting in a scene.
 */
function mapProjectNodes(
  project: Project,
  patch: (node: GameObjectNode) => GameObjectNode | null,
): Project {
  let changed = false;

  const scenes = project.scenes.map((scene) => {
    const children = mapNodes(scene.children, patch);
    if (children === scene.children) return scene;
    changed = true;
    return { ...scene, children };
  });

  const prefabs = project.prefabs.map((prefab) => {
    const children = mapNodes(prefab.children, patch);
    if (children === prefab.children) return prefab;
    changed = true;
    return { ...prefab, children };
  });

  return changed ? { ...project, scenes, prefabs } : project;
}

/**
 * This node's effect list with every mask over `assetId` unpointed, or `null`
 * when it holds none.
 *
 * `null` for "nothing changed" rather than the list back, because the caller
 * feeds `mapProjectNodes`, whose whole contract is that an untouched branch
 * comes back by identity — returning a fresh equal array would mark every node
 * in the project as edited and cost an undo step for a delete that missed it.
 *
 * Read through `effectsOf`, so what is written back is what the renderer and
 * the exporter would have read anyway: a hand-edited file cannot survive a
 * deletion with a shape the reader refuses. That is the strip-on-read /
 * repair-on-write pair this codebase makes everywhere, here in the direction
 * that keeps the *file* right rather than the canvas.
 */
function maskedFxWithout(node: GameObjectNode, assetId: string): NodeEffect[] | null {
  const effects = effectsOf(node);
  if (!effects.some((effect) => effect.kind === 'mask' && effect.assetId === assetId)) {
    return null;
  }
  return effects.map((effect) =>
    effect.kind === 'mask' && effect.assetId === assetId
      ? { ...effect, assetId: null }
      : effect,
  );
}

/**
 * The frame a node should hold once its image has been cut a different way.
 *
 * Within one kind of cut the document is left alone and the repair happens on
 * read, through `resolveFrame` — a name an atlas has lost comes back the moment
 * the atlas is re-imported with it, and rewriting it here would throw that away
 * over a typo in somebody else's packer. What this does rewrite is a frame of
 * the *wrong kind*: an index has no meaning against an atlas and a name has
 * none against a grid, so switching between the two cannot be deferred.
 *
 * The grid branch also clamps, which is the behaviour a re-cut has always had.
 */
function recutFrame(asset: ImageAsset, frame: number | string): number | string {
  const atlas = atlasOf(asset);
  if (atlas) return typeof frame === 'string' ? frame : atlas[0].name;
  if (typeof frame !== 'number' || !Number.isFinite(frame)) return 0;
  return Math.min(Math.max(0, Math.floor(frame)), frameCountOf(asset) - 1);
}

/**
 * The frames a clip should hold once its image has been cut a different way,
 * and empty when the clip cannot survive at all.
 *
 * A clip is a *sequence*, so unlike a node's single frame it has no read-time
 * fallback to lean on — `generateFrameNames` over a name the texture does not
 * carry throws before anything is drawn. So this one repairs in the document.
 *
 * The two branches drop differently, and each drops the only way it can. A grid
 * clamps, because a walk cycle should survive a one-pixel margin correction,
 * and then de-duplicates because clamping is exactly what collapses several
 * out-of-range indices onto one. An atlas filters, because a name has no
 * neighbour to clamp towards — and deliberately does *not* de-duplicate, since
 * nothing in that branch can create a repeat the user did not write, and
 * `[a, b, c, b]` is a ping-pong.
 *
 * An empty answer means the clip goes: an un-cut image has no sequence to index
 * at all, and a cut changed from one kind to the other has none this clip could
 * ever have meant.
 */
function recutClipFrames(
  asset: ImageAsset,
  frames: readonly (number | string)[],
): (number | string)[] {
  const atlas = atlasOf(asset);
  if (atlas) {
    const names = new Set(atlas.map((frame) => frame.name));
    return frames.filter((frame) => typeof frame === 'string' && names.has(frame));
  }
  if (!frameGridOf(asset)) return [];
  const count = frameCountOf(asset);
  return [
    ...new Set(
      frames
        .filter((frame): frame is number => typeof frame === 'number')
        .map((frame) => Math.min(frame, count - 1)),
    ),
  ];
}

/**
 * Re-cutting one image: the new asset in place, every clip on it resolved
 * against the new cut, and every node drawing it brought back into step.
 *
 * One traversal for both cuts and for all four types that carry a frame, so a
 * grid and an atlas cannot come to disagree about what re-cutting means. It is
 * `mapProjectNodes` rather than `mapProjectSprites` because a frame is about an
 * *image*, which a sprite, an emitter, a panel and a tile sprite can all point
 * at — and because only that traversal reaches inside a prefab definition.
 */
function recut(project: Project, assetId: string, next: ImageAsset): Project {
  const removed = new Set<string>();
  const animations = project.animations.flatMap((clip) => {
    if (clip.assetId !== assetId) return clip;
    const frames = recutClipFrames(next, clip.frames);
    if (frames.length === 0) {
      removed.add(clip.id);
      return [];
    }
    return { ...clip, frames };
  });

  return mapProjectNodes(
    {
      ...project,
      assets: project.assets.map((entry) => (entry.id === assetId ? next : entry)),
      animations,
    },
    (node) => {
      // Four branches rather than one condition over four types, for the reason
      // `removeAsset` spells out: the discriminated union narrows `props` only
      // when the check names a single type, so a combined test widens the
      // spread to a union of all four and the result matches none of them.
      if (node.type === 'sprite') {
        if (node.props.assetId !== assetId) return null;
        const frame = recutFrame(next, node.props.frame);
        const animationId =
          node.props.animationId && removed.has(node.props.animationId)
            ? null
            : node.props.animationId;
        return frame === node.props.frame && animationId === node.props.animationId
          ? null
          : { ...node, props: { ...node.props, frame, animationId } };
      }
      if (node.type === 'particles' && node.props.assetId === assetId) {
        const frame = recutFrame(next, node.props.frame);
        return frame === node.props.frame ? null : { ...node, props: { ...node.props, frame } };
      }
      if (node.type === 'nineslice' && node.props.assetId === assetId) {
        const frame = recutFrame(next, node.props.frame);
        return frame === node.props.frame ? null : { ...node, props: { ...node.props, frame } };
      }
      if (node.type === 'tileSprite' && node.props.assetId === assetId) {
        const frame = recutFrame(next, node.props.frame);
        return frame === node.props.frame ? null : { ...node, props: { ...node.props, frame } };
      }
      return null;
    },
  );
}


/**
 * Rewrites one tilemap's props, with the node resolved through `tileMapOf`
 * first so the patch sees a grid that is certainly the right shape.
 *
 * Every tilemap edit goes through here for the reason `worldMovePatch` exists:
 * the arithmetic wants the *usable* map — the real tile size, the real column
 * count, the data padded to match — and re-deriving that per action is three
 * chances to derive it differently. Returning null leaves the project's
 * identity alone, which is how `editProject` hears "no undo step" from a stroke
 * that painted the tile that was already there.
 */
function editTilemapProps(
  project: Project,
  nodeId: string,
  patch: (map: TileMap) => Partial<TilemapProps> | null,
): Project {
  return withActiveScene(project, (scene) => {
    const node = findNode(scene.children, nodeId);
    if (!node || node.type !== 'tilemap') return scene;
    const map = tileMapOf(project, node.props);
    const props = patch(map);
    if (!props) return scene;
    return {
      ...scene,
      children: mapNode(scene.children, nodeId, (current) => {
        const next = { ...current.props, ...props } as TilemapProps;
        // The pre-v12 pair goes the moment anything is written, so the document
        // holds one shape and only one — `setAssetSheet` and `setAssetAtlas`
        // deleting each other's field, one type over. A patch that did not name
        // `layers` still normalises, because `tileMapOf` has already migrated
        // the old grid into `map.layers` and this is where that becomes the
        // document's own answer rather than a reading of it.
        if (!props.layers) next.layers = map.layers.map(toLayerDoc);
        delete next.data;
        delete next.collides;
        return { ...current, props: next } as GameObjectNode;
      }),
    };
  });
}

/** A resolved layer back in the shape the document stores. */
function toLayerDoc(layer: TileLayer): TilemapLayerDoc {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    data: layer.data,
    ...(layer.collides.length > 0 ? { collides: layer.collides } : {}),
  };
}

/**
 * Rewrites one layer of one tilemap.
 *
 * `editTilemapProps` merges a `Partial<TilemapProps>` at the top level, which
 * cannot say "patch layer N" — so this is its sibling rather than a fifth
 * argument to it, and it is what every per-layer action goes through. The patch
 * sees the layer already resolved, so it never has to ask whether `data` is the
 * length the grid claims.
 */
function editTilemapLayer(
  project: Project,
  nodeId: string,
  layerId: string | null,
  patch: (layer: TileLayer, map: TileMap) => Partial<TilemapLayerDoc> | null,
): Project {
  return editTilemapProps(project, nodeId, (map) => {
    const target = tileLayerOf(map, layerId);
    const changes = patch(target, map);
    if (!changes) return null;
    return {
      layers: map.layers.map((layer) =>
        layer.id === target.id ? { ...toLayerDoc(layer), ...changes } : toLayerDoc(layer),
      ),
    };
  });
}

/**
 * The painted tilemap, but only while it still names a live one.
 *
 * `pruneIds` for the paint mode: the node can be deleted, undone away or left
 * behind by a scene switch, and every one of those has to end the mode. Doing
 * it beside the selection means none of those actions has to know the mode
 * exists.
 */
function prunePainting(children: GameObjectNode[], paintingId: string | null): string | null {
  if (!paintingId) return null;
  const node = findNode(children, paintingId);
  return node && node.type === 'tilemap' ? paintingId : null;
}

/**
 * The active layer, but only while it still names one of the selected map's.
 *
 * `prunePainting` one level down, and it has one more way to go stale than the
 * mode does: `removeTilemapLayer` can take the layer out from under it without
 * touching the node. Null is a legal answer — `tileLayerOf` reads it as the
 * frontmost — so this never has to guess a replacement.
 */
function pruneActiveLayer(
  children: GameObjectNode[],
  nodeIds: readonly string[],
  activeLayerId: string | null,
): string | null {
  if (!activeLayerId) return null;
  for (const nodeId of nodeIds) {
    const node = findNode(children, nodeId);
    if (node?.type === 'tilemap' && node.props.layers?.some((l) => l.id === activeLayerId)) {
      return activeLayerId;
    }
  }
  return null;
}

/**
 * An instance turned into an ordinary group holding its own copy of what the
 * prefab draws.
 *
 * The children are cloned with fresh ids so the group and the definition can
 * never alias — editing the detached copy must not reach back into the prefab,
 * which is the entire difference between a detached group and an instance. The
 * node's own id is kept, so a detach does not clear the selection.
 */
function detachedNode(project: Project, node: GameObjectNode): GameObjectNode {
  const children = prefabChildrenOf(project, node).map(cloneWithNewIds);
  return {
    id: node.id,
    name: node.name,
    type: 'container',
    visible: node.visible,
    transform: node.transform,
    props: { alpha: node.type === 'instance' ? node.props.alpha : 1 },
    children,
  };
}

/**
 * The selected nodes that an edit should act on, in document order, with
 * anything already covered by another selected node left out.
 *
 * Selecting a group *and* something inside it is easy to do and means one
 * thing, not two: the group. Without this, deleting that selection would remove
 * the child twice over, duplicating it would copy it twice, and dragging it
 * would move it at double speed because both its own move and its group's would
 * apply. Every multi-object action goes through here for that reason.
 *
 * Document order, not selection order, so that duplicate, group and paste keep
 * the draw order the objects already had rather than the order they happened to
 * be tapped in.
 */
export function selectionRoots(
  nodes: GameObjectNode[],
  ids: readonly string[],
): string[] {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  const roots: string[] = [];
  const walk = (list: GameObjectNode[]) => {
    for (const node of list) {
      // Selected: take it and stop — everything below it comes with it.
      if (wanted.has(node.id)) roots.push(node.id);
      else walk(node.children);
    }
  };
  walk(nodes);
  return roots;
}

/** The last-picked selection: what the inspector edits. Null when nothing is. */
export function primaryId(state: EditorState): string | null {
  return state.selectedIds.at(-1) ?? null;
}

/**
 * Drops entries naming a node that is no longer in the scene — see
 * `editProject`. Returns the array it was given when nothing was dropped, so a
 * sync that changed nothing costs no re-render.
 */
function pruneIds<T>(
  children: GameObjectNode[],
  entries: T[],
  idOf: (entry: T) => string,
): T[] {
  if (entries.length === 0) return entries;
  const kept = entries.filter((entry) => findNode(children, idOf(entry)));
  return kept.length === entries.length ? entries : kept;
}

/** The move bar's undo snapshot for a set of nodes. */
function originsFor(
  children: GameObjectNode[],
  ids: readonly string[],
): { id: string; transform: Transform }[] {
  return ids.flatMap((id) => {
    const node = findNode(children, id);
    return node ? [{ id, transform: { ...node.transform } }] : [];
  });
}

/**
 * An animation name not already taken, since the name is the animation *key* in
 * exported code and two clips sharing one would have Phaser's manager warn and
 * keep only the first. The exporter de-duplicates as a backstop; doing it here
 * as well means the name the user sees in the editor is the name their game
 * plays, rather than a silently renamed one.
 */
function uniqueAnimationName(project: Project, base: string): string {
  const taken = new Set(project.animations.map((clip) => clip.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/**
 * A prefab name not already taken, for the reason an animation name is: the
 * name becomes the factory function's identifier in exported code, and two
 * prefabs sharing one would have the exporter silently rename the second. The
 * name the user reads in the editor should be the one their game is built from.
 */
function uniquePrefabName(project: Project, base: string): string {
  const taken = new Set(project.prefabs.map((prefab) => prefab.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/** How far a duplicate or a paste lands from its source, in scene pixels. */
const COPY_OFFSET = 16;

/**
 * "Ball" -> "Ball copy" -> "Ball copy 2". Without the counter, duplicating a
 * duplicate gives "Ball copy copy", which gets unreadable in three presses.
 */
function nextCopyName(name: string): string {
  const match = /^(.*) copy(?: (\d+))?$/.exec(name);
  if (!match) return `${name} copy`;
  return `${match[1]} copy ${Number(match[2] ?? 1) + 1}`;
}

/** A fresh node just off the original, for duplicate and paste to place. */
function offsetCopy(node: GameObjectNode): GameObjectNode {
  const copy = cloneWithNewIds(node);
  return {
    ...copy,
    name: nextCopyName(copy.name),
    transform: {
      ...copy.transform,
      x: copy.transform.x + COPY_OFFSET,
      y: copy.transform.y + COPY_OFFSET,
    },
  } as GameObjectNode;
}

/** Three decimals: finer than the eye, and readable in an inspector field. */
const settle = (value: number): number => Number(value.toFixed(3));

/**
 * Settles a computed transform on numbers a person would type. Reparenting
 * divides and rotates, so without this a node dropped into a group and back out
 * again drifts to 479.99999999999994.
 */
function tidyTransform(transform: Transform): Transform {
  return {
    x: Math.round(transform.x),
    y: Math.round(transform.y),
    rotation: settle(transform.rotation),
    scaleX: settle(transform.scaleX),
    scaleY: settle(transform.scaleY),
  };
}

/**
 * The `x`/`y` a node needs to travel `dx`/`dy` in *world* pixels.
 *
 * The delta is converted into the space the node's own x/y live in, so a node
 * inside a rotated or scaled group still travels the way the screen says. It is
 * applied as a *difference* against the stored value rather than as the
 * recomputed local position: the world round trip is not numerically exact, and
 * a node moved back and forth should land on the number it started on. For a
 * top-level node the parent is the identity and the whole thing is `x + dx`,
 * integers included.
 *
 * Every world-space move goes through here — the arrow keys, align and
 * distribute — because getting this wrong is invisible until someone nests
 * something in a rotated group.
 */
function worldMovePatch(
  children: GameObjectNode[],
  node: GameObjectNode,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const parent = worldTransformOf(children, findParent(children, node.id)?.id ?? null);
  const world = worldTransformOf(children, node.id);
  const moved = localTransformIn(parent, { ...world, x: world.x + dx, y: world.y + dy });
  const local = localTransformIn(parent, world);
  return {
    x: settle(node.transform.x + moved.x - local.x),
    y: settle(node.transform.y + moved.y - local.y),
  };
}

/**
 * The container a new or pasted object should land in: the selection when it is
 * a group, the group the selection sits in otherwise, and the scene itself when
 * neither applies.
 *
 * The second case matters as much as the first. Filling a group means selecting
 * a group, adding, then having something *else* selected — the object just
 * added — and the next add belongs beside it, not back out at the top level.
 */
function openContainerId(state: EditorState): string | null {
  const selectedId = primaryId(state);
  if (!selectedId) return null;
  const children = activeScene(state.project).children;
  const node = findNode(children, selectedId);
  if (!node) return null;
  if (node.type === 'container') return node.id;
  return findParent(children, node.id)?.id ?? null;
}

/**
 * The project with `fn` applied to its active scene, by identity when the scene
 * came back unchanged.
 *
 * Split out of `editScene` so that an action which edits the scene *and* the
 * prefab library — creating a prefab from the selection is exactly that — can
 * do both inside one `editProject` call and cost one undo step. Calling
 * `editScene` and then `editProject` would cost two, and Ctrl+Z would half-undo
 * it.
 */
function withActiveScene(project: Project, fn: (scene: SceneDoc) => SceneDoc): Project {
  const current = activeScene(project);
  const next = fn(current);
  if (next === current) return project;
  return {
    ...project,
    scenes: project.scenes.map((scene) => (scene.id === current.id ? next : scene)),
  };
}

/**
 * A scene name no scene in the project has, starting from `base`.
 *
 * Names are free text and nothing enforces uniqueness — two scenes may end up
 * called the same thing, and the exporter de-duplicates the class name and the
 * Phaser key it makes from them. What this stops is the editor *offering* a
 * duplicate: a switcher row with two identical chips is a row where neither
 * chip says which scene it is.
 */
function unusedSceneName(project: Project, base?: string): string {
  const taken = new Set(project.scenes.map((scene) => scene.name));
  const stem = base ?? `Scene ${project.scenes.length + 1}`;
  let candidate = stem;
  let n = 2;
  while (taken.has(candidate)) candidate = `${stem} ${n++}`;
  return candidate;
}

/**
 * A variable name nothing in the project has taken yet.
 *
 * `unusedSceneName`'s sibling and for a sharper version of its reason. Two
 * scenes sharing a name is fatal twice over in the export; two *variables*
 * sharing one is quieter and worse — `collectVariables` gives the second a
 * numeric suffix, so the document shows two rows while the game keeps one
 * number, and the row the user is editing may not be the one their rule reads.
 * Arriving unique means that never happens by default.
 */
function unusedVariableName(project: Project): string {
  const taken = new Set(project.variables.map((variable) => variable.name));
  const stem = `Variable ${project.variables.length + 1}`;
  let candidate = stem;
  let n = 2;
  while (taken.has(candidate)) candidate = `${stem} ${n++}`;
  return candidate;
}

/**
 * One rule, with everything it says about this variable read in the new kind.
 *
 * `setVariableKind`'s half of "the document may never hold a mismatch by any
 * action in the editor". Three things can say something about a variable:
 *
 * - a **condition**, whose comparand is converted and whose operator is pulled
 *   back to `eq` when it was an ordering one, since only equality means anything
 *   about text. That is the one place this repairs rather than refuses, and it is
 *   allowed here for the reason it is refused in `rulesOf`: the user is in the
 *   act of changing the kind, so a narrowed test is a consequence they asked for
 *   rather than one the reader invented behind them.
 * - a **`setVar`**, whose value is converted.
 * - an **`addVar`**, which is arithmetic and so cannot survive a switch to text:
 *   the action goes, and a rule left with nothing to do goes with it in the
 *   caller.
 *
 * A `setText` naming the variable needs no migration at all — it shows whatever
 * the value is, which is the whole point of it. Nor does a **`varChange`
 * trigger**, for the same reason one step further out: it watches for the value
 * changing and never reads it, so there is nothing there to be in the wrong
 * kind. Said out loud, because beside a function that rewrites every condition
 * and every `setVar` in the project, not rewriting a trigger reads exactly like
 * a step that was missed.
 *
 * Returns the rule *by identity* when nothing about it mentions the variable, so
 * `editProject`'s "nothing happened, no undo step" contract holds. The guard is
 * deliberately **not** `ruleUsesVariable`, which since iteration 33 answers true
 * for a trigger this function does not touch — that would rebuild an untouched
 * rule, and `setVariableKind` reads the identity back to decide whether a scene
 * changed at all.
 */
function migrateRuleToKind(rule: SceneRule, id: string, kind: VariableKind): SceneRule {
  const migratable =
    rule.conditions.some((condition) => condition.variableId === id) ||
    rule.do.some(
      (action) =>
        (action.kind === 'setVar' || action.kind === 'addVar') && action.variableId === id,
    );
  if (!migratable) return rule;

  const conditions = rule.conditions.map((condition) => {
    if (condition.variableId !== id) return condition;
    const ordering = condition.op !== 'eq' && condition.op !== 'ne';
    const op = kind === 'text' && ordering ? 'eq' : condition.op;
    return { ...condition, op, value: coerceVariableValue(condition.value, kind) };
  });

  const actions = rule.do.flatMap((action): RuleAction[] => {
    if (action.kind === 'setVar' && action.variableId === id) {
      return [{ ...action, value: coerceVariableValue(action.value, kind) }];
    }
    if (action.kind === 'addVar' && action.variableId === id && kind === 'text') return [];
    return [action];
  });

  return { ...rule, conditions, do: actions };
}

/**
 * A rule name nothing in this scene has taken yet.
 *
 * `unusedSceneName`'s and `unusedVariableName`'s sibling. A rule's name is not
 * a key of anything — it reaches the export only as a comment — so this is
 * about the panel rather than about correctness: two rows reading "Rule 1" is a
 * list nobody can navigate, and the name is what the expand toggle is titled by.
 */
function unusedRuleName(scene: SceneDoc): string {
  const rules = scene.rules ?? [];
  const taken = new Set(rules.map((rule) => rule.name));
  const stem = `Rule ${rules.length + 1}`;
  let candidate = stem;
  let n = 2;
  while (taken.has(candidate)) candidate = `${stem} ${n++}`;
  return candidate;
}

/**
 * The scene, with the collider row an Arcade `collide` trigger needs.
 *
 * Shared by `addRule` and `updateRule`, because a rule can arrive as a collide
 * rule *or* become one — and a trigger changed to `collide` with no row is one
 * `rulesOf` drops on the very next read, which is a rule that vanishes the
 * moment it is created. `CollidersSection` already records that failure mode:
 * "a row naming nothing is one `collidersOf` drops on the next read — so there
 * would be nothing on screen left to fill in."
 *
 * Arcade only. A Matter collide rule watches for the touch itself, because
 * `collidersOf` answers `[]` for Matter — and the reason it does is that Matter
 * already collides everything with everything, so a row there says nothing it
 * has not done. That argument does not transfer to a *rule*, which is why this
 * is the one place a Matter scene needs more emitted code rather than less.
 */
function withColliderFor(scene: SceneDoc, when: RuleTrigger): SceneDoc {
  if (when.kind !== 'collide') return scene;
  if (scenePhysicsOf(scene).engine === 'matter') return scene;
  const colliders = collidersOf(scene);
  const paired = colliders.some(
    (row) =>
      (row.aId === when.aId && row.bId === when.bId) ||
      (row.aId === when.bId && row.bId === when.aId),
  );
  if (paired) return scene;
  return {
    ...scene,
    colliders: [...colliders, { id: newId(), aId: when.aId, bId: when.bId, kind: 'collide' }],
  };
}

/**
 * One rule rewritten in place in the scene's list, by id.
 *
 * The conditions and actions inside a rule are addressed by index and there are
 * eight actions that reach them, so the "find the rule, rebuild the array"
 * half is written once — `editSiblings`' argument, two levels down.
 *
 * It reads `scene.rules` raw rather than `rulesOf`, and that is the one place
 * in this feature that deliberately does not go through the reader. `rulesOf`
 * *drops* what it cannot validate, so editing through it would silently delete
 * every rule the panel is not currently showing the moment any other one was
 * touched — and a rule mid-edit is exactly the rule that does not validate yet.
 * The reader is for what the renderer and the exporter see; the store edits the
 * document as written.
 */
function mapRule(
  scene: SceneDoc,
  ruleId: string,
  fn: (rule: SceneRule) => SceneRule,
): SceneDoc {
  const rules = scene.rules ?? [];
  const index = rules.findIndex((rule) => rule.id === ruleId);
  if (index < 0) return scene;
  const next = [...rules];
  next[index] = fn(rules[index]);
  return { ...scene, rules: next };
}

/**
 * A trigger with its node references put through a mapping.
 *
 * A `varChange` trigger falls through untouched and needs no case, which is
 * worth a line because its only caller is `duplicateScene`: a variable is
 * *project*-level, so the copy and the original name the same one and there is
 * nothing to remap. The camera's `followId` needed this treatment precisely
 * because it names a node, which a copied scene does not share.
 */
function remapTriggerNodes(
  when: RuleTrigger,
  node: (id: string) => string,
): RuleTrigger {
  if (when.kind === 'tap') return { ...when, nodeId: node(when.nodeId) };
  if (when.kind === 'collide') {
    return { ...when, aId: node(when.aId), bId: node(when.bId) };
  }
  return when;
}

/** An action with its node and sound references put through a mapping. */
function remapActionRefs(
  action: RuleAction,
  node: (id: string) => string,
  sound: (id: string) => string,
): RuleAction {
  // `!== undefined` because a spawn's anchor is optional: an unanchored spawn
  // names nothing scene-local and must not gain a key holding `undefined`.
  // `setPosition`'s anchor is the one second node reference, so it is the one
  // the field-name rule below cannot reach — and a copied teleport pointing into
  // the scene it was copied from is a rule `rulesOf` would drop.
  if (action.kind === 'setPosition') {
    const moved = { ...action, nodeId: node(action.nodeId) };
    return action.atId === undefined ? moved : { ...moved, atId: node(action.atId) };
  }
  if ('nodeId' in action && action.nodeId !== undefined) {
    return { ...action, nodeId: node(action.nodeId) };
  }
  if ('soundId' in action) return { ...action, soundId: sound(action.soundId) };
  return action;
}

export function activeScene(project: Project): SceneDoc {
  return (
    project.scenes.find((scene) => scene.id === project.activeSceneId) ??
    project.scenes[0]
  );
}

export const useEditorStore = create<EditorState>((set, get) => {
  /**
   * Applies `fn` to the whole document and records an undo step (unless we are
   * inside a transaction). Every editing action lands here eventually, so
   * history and the dirty flag can never drift out of sync with the document.
   *
   * Returning the project unchanged is how an action says "nothing happened",
   * and costs no undo entry.
   */
  const editProject = (fn: (project: Project) => Project) => {
    const state = get();
    const project = fn(state.project);
    if (project === state.project) return;

    // Every edit that can remove a node passes through here, so pruning once in
    // this one place is what makes "the selection always names live nodes" an
    // invariant rather than something each action has to remember. Identity is
    // preserved when nothing was dropped, so this costs no re-render.
    const children = activeScene(project).children;

    const recordHistory = state.txDepth === 0;
    const selectedIds = pruneIds(children, state.selectedIds, (id) => id);
    const paintingId = prunePainting(children, state.paintingId);
    set({
      project,
      dirty: true,
      selectedIds,
      moveOrigins: pruneIds(children, state.moveOrigins, (origin) => origin.id),
      paintingId,
      activeLayerId: pruneActiveLayer(
        children,
        paintingId ? [paintingId, ...selectedIds] : selectedIds,
        state.activeLayerId,
      ),
      past: recordHistory
        ? [...state.past, state.project].slice(-HISTORY_LIMIT)
        : state.past,
      future: recordHistory ? [] : state.future,
    });
  };

  /** The same, narrowed to the scene the user is looking at. */
  const editScene = (fn: (scene: SceneDoc) => SceneDoc) =>
    editProject((project) => withActiveScene(project, fn));

  /**
   * Moves the selection by a world-space delta per node, worked out from what
   * the renderer last drew.
   *
   * Shared by align and distribute because everything except the arithmetic is
   * the same: take the selection's roots, look up each one's measured box, and
   * apply the result as one undo step. A root with no box yet — nothing drawn,
   * or a sync not caught up — drops out of the set entirely rather than being
   * treated as a point at the origin, which would fling it across the scene.
   */
  const applyWorldDeltas = (
    state: EditorState,
    deltasFor: (boxes: ReadonlyMap<string, Rect>) => Deltas,
  ) => {
    const children = activeScene(state.project).children;
    const boxes = new Map<string, Rect>();
    for (const id of selectionRoots(children, state.selectedIds)) {
      const box = boundsOf(id);
      if (box) boxes.set(id, box);
    }

    // Everything that actually moves, worked out before the transaction opens:
    // `beginTransaction` snapshots the document whether or not an edit follows,
    // so an alignment that has nothing left to do would otherwise leave an undo
    // step that undoes nothing. Pressing Left twice is the normal case, not an
    // edge one — the second press is how you check the first.
    // A following emitter moves by its own delta *less* its target's, or a row
    // holding a player and its trail would carry the trail twice.
    const deltas = compensateFollowers(activeScene(state.project), deltasFor(boxes));
    const moves = [...deltas].flatMap(([id, { dx, dy }]) => {
      if (dx === 0 && dy === 0) return [];
      const node = findNode(children, id);
      return node ? [{ id, patch: worldMovePatch(children, node, dx, dy) }] : [];
    });
    if (moves.length === 0) return;

    state.beginTransaction();
    for (const move of moves) state.updateTransform(move.id, move.patch);
    state.endTransaction();
  };

  return {
    project: newProject(),
    selectedIds: [],
    fileName: null,
    dirty: false,
    past: [],
    future: [],
    txDepth: 0,
    moveOrigins: [],
    clipboard: [],
    lockAspect: true,
    multiSelect: false,
    snapEnabled: true,
    gridEnabled: false,
    gridSize: DEFAULT_GRID_SIZE,
    angleStep: DEFAULT_ANGLE_STEP,
    guidesVisible: true,
    previewMotion: false,
    playGameRunning: false,
    validationIssues: [],
    validationFocusPath: null,
    validationFocusSection: null,
    sectionsOpenByDefault: false,
    sectionOverrides: {},
    paintingId: null,
    activeLayerId: null,
    brushTile: 0,
    erasing: false,

    setLockAspect: (lockAspect) => set({ lockAspect }),
    setMultiSelect: (multiSelect) => set({ multiSelect }),
    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    setGridEnabled: (gridEnabled) => set({ gridEnabled }),
    // Clamped rather than validated: a grid of 0 divides by zero in the
    // snapping maths and a fractional one cannot be drawn, and the field this
    // arrives from is a text box a user can empty.
    setGridSize: (gridSize) =>
      set({ gridSize: Math.max(1, Math.round(gridSize) || DEFAULT_GRID_SIZE) }),
    // Clamped at both ends. Zero is the same division-by-zero the grid pitch
    // guards against, and above 180 the nearest multiple of the step is always
    // either where you started or a whole turn from it, so the step stops being
    // a step at all.
    setAngleStep: (angleStep) =>
      set({
        angleStep: Math.max(1, Math.min(180, Math.round(angleStep) || DEFAULT_ANGLE_STEP)),
      }),
    setGuidesVisible: (guidesVisible) => set({ guidesVisible }),
    // Both runtime controls are deliberately editor-only writes. In particular,
    // neither setter passes through `editProject`: entering and leaving Preview
    // motion or Play game cannot add history, mark the file dirty, or replace a
    // single authored value. Starting Play game also stops the canvas preview so
    // the two visually and semantically different runtimes are never active at
    // once underneath the modal game surface.
    setPreviewMotion: (previewMotion) => set({ previewMotion }),
    setPlayGameRunning: (playGameRunning) => {
      if (!playGameRunning) return set({ playGameRunning: false });
      const issues = validateProject(get().project);
      set({
        validationIssues: issues,
        playGameRunning: blockingIssues(issues).length === 0,
        previewMotion: false,
      });
    },
    showValidationIssues: (validationIssues) => set({ validationIssues }),
    clearValidationFocusSection: () => set({ validationFocusSection: null }),
    focusValidationIssue: (issue) => set((state) => ({
      project: issue.sceneId && state.project.scenes.some((scene) => scene.id === issue.sceneId)
        ? { ...state.project, activeSceneId: issue.sceneId }
        : state.project,
      selectedIds: issue.objectId ? [issue.objectId] : [],
      validationFocusPath: issue.fieldPath,
      validationFocusSection: issue.inspectorSection ?? null,
      ...(issue.inspectorSection
        ? { sectionOverrides: { ...state.sectionOverrides, [issue.inspectorSection]: true } }
        : {}),
    })),

    // An override is written for the section that was pressed and nothing else,
    // so a later Expand-all still reaches every section this one does not name.
    toggleSection: (title) =>
      set((state) => {
        const open = state.sectionOverrides[title] ?? state.sectionsOpenByDefault;
        return { sectionOverrides: { ...state.sectionOverrides, [title]: !open } };
      }),

    // Clears the overrides rather than inverting them: "collapse everything"
    // has to mean everything, including the sections this render has no way to
    // name, which is what moving the *default* says and a set of titles cannot.
    setAllSections: (open) =>
      set({ sectionsOpenByDefault: open, sectionOverrides: {} }),

    hydrateSections: (sectionsOpenByDefault, sectionOverrides) =>
      set({ sectionsOpenByDefault, sectionOverrides }),

    setPainting: (paintingId) => set({ paintingId }),
    setActiveLayer: (activeLayerId) => set({ activeLayerId }),
    setBrushTile: (brushTile) => set({ brushTile: Math.max(0, Math.floor(brushTile)) }),
    setErasing: (erasing) => set({ erasing }),

    scaleNode: (id, axis, value) => {
      const state = get();
      const node = findNode(activeScene(state.project).children, id);
      if (!node) return;

      const { scaleX, scaleY } = node.transform;
      if (!state.lockAspect) {
        return state.updateTransform(id, axis === 'x' ? { scaleX: value } : { scaleY: value });
      }

      // Keep the ratio the object already has rather than forcing X === Y:
      // an object deliberately built at 2:1 should stay 2:1 when the lock is
      // switched on, not snap square on the next keystroke.
      const from = axis === 'x' ? scaleX : scaleY;
      const other = axis === 'x' ? scaleY : scaleX;
      // A zero scale carries no ratio to preserve, so fall back to matching.
      const next = from === 0 ? value : other * (value / from);
      state.updateTransform(
        id,
        axis === 'x' ? { scaleX: value, scaleY: next } : { scaleY: value, scaleX: next },
      );
    },

    loadProject: (project, fileName) =>
      set({
        project,
        fileName,
        selectedIds: [],
        dirty: false,
        past: [],
        future: [],
        txDepth: 0,
        moveOrigins: [],
        paintingId: null,
        activeLayerId: null,
        playGameRunning: false,
        previewMotion: false,
      }),

    resetProject: () =>
      set({
        project: newProject(),
        fileName: null,
        selectedIds: [],
        dirty: false,
        past: [],
        future: [],
        txDepth: 0,
        moveOrigins: [],
        paintingId: null,
        activeLayerId: null,
        playGameRunning: false,
        previewMotion: false,
      }),

    markSaved: (fileName) => set({ fileName, dirty: false }),

    renameProject: (name) =>
      set((state) => ({ project: { ...state.project, name }, dirty: true })),

    setActiveScene: (id) =>
      editProject((project) =>
        project.activeSceneId === id || !project.scenes.some((scene) => scene.id === id)
          ? project
          : { ...project, activeSceneId: id },
      ),

    addScene: () =>
      editProject((project) => {
        const scene = createScene(unusedSceneName(project));
        return {
          ...project,
          scenes: [...project.scenes, scene],
          activeSceneId: scene.id,
        };
      }),

    duplicateScene: () =>
      editProject((project) => {
        const current = activeScene(project);
        const copy: SceneDoc = {
          ...current,
          id: newId(),
          name: unusedSceneName(project, `${current.name} copy`),
          children: current.children.map(cloneWithNewIds),
          // Guides are copied with fresh ids for the reason the nodes are: two
          // guides sharing one would have `moveGuide` and `removeGuide` reach
          // whichever scene's array they were handed first.
          guides: guidesOf(current).map((guide) => ({ ...guide, id: newId() })),
          // And the sounds, for the reason the guides and the nodes are:
          // `updateSceneSound` and `removeSceneSound` find an entry by id, so
          // two scenes sharing one would have them reach whichever array they
          // were handed first.
          sounds: soundsOf(project, current).map((sound) => ({ ...sound, id: newId() })),
        };
        // And the camera, whose `followId` names one of the nodes just cloned.
        // The two lists are the same list in the same order, so the follow
        // target's index in the original gives its new id — no id map is needed
        // and none is built. A camera left pointing into the scene it was
        // copied from is the dangling reference `cameraOf` would then drop,
        // which is a follow silently lost on a duplicate.
        if (current.camera !== undefined) {
          const camera = cameraOf(current);
          const index = current.children.findIndex((child) => child.id === camera.followId);
          copy.camera = {
            ...camera,
            followId: index < 0 ? null : copy.children[index].id,
          };
        }
        // And every trail, whose target is one of the nodes just cloned — the
        // camera's index trick for a fourth kind of reference. Top level only,
        // because `particleFollowOf` honours nothing deeper. Left alone, a
        // copied emitter would name its target in the scene it was copied
        // from, the reader would drop it, and the copy would draw at its bare
        // offset in the corner — a trail silently lost on a duplicate.
        copy.children = copy.children.map((child) => {
          if (child.type !== 'particles' || child.props.followId === undefined) return child;
          const at = current.children.findIndex((node) => node.id === child.props.followId);
          if (at < 0) return child;
          return { ...child, props: { ...child.props, followId: copy.children[at].id } };
        });
        // And the colliders, whose two sides name nodes just cloned — the
        // camera's argument twice over, and the same index trick. A row left
        // pointing into the scene it was copied from is one `collidersOf`
        // would drop on the next read, which is a collider silently lost on a
        // duplicate.
        if (current.colliders !== undefined) {
          const side = (id: string) => {
            const at = current.children.findIndex((child) => child.id === id);
            return at < 0 ? id : copy.children[at].id;
          };
          copy.colliders = collidersOf(current).map((collider) => ({
            ...collider,
            id: newId(),
            aId: side(collider.aId),
            bId: side(collider.bId),
          }));
        }
        // And the rules, which is a *third* kind of reference for this function
        // to think about and the price of a `playSound` action naming a
        // `SceneSound` row rather than an audio file. Three kinds, in fact:
        //
        // - node ids in `tap`, `collide` and every action that names one, by
        //   the camera's index trick a third time;
        // - **sound row ids**, because the rows above were just re-identified,
        //   so a copied `playSound` would name a row that no longer exists;
        // - variable ids, left alone on purpose. Variables are project-level,
        //   and the copy counting the same score is the correct reading.
        //
        // `startScene` is left pointing at the original too: a rule that says
        // "go to the menu" still means the menu, and one that named this scene
        // now honestly means the scene it was copied from.
        if (current.rules !== undefined) {
          const node = (id: string) => {
            const at = current.children.findIndex((child) => child.id === id);
            return at < 0 ? id : copy.children[at].id;
          };
          const soundRows = soundsOf(project, current);
          const sound = (id: string) => {
            const at = soundRows.findIndex((row) => row.id === id);
            return at < 0 ? id : (copy.sounds as SceneSound[])[at].id;
          };
          copy.rules = rulesOf(project, current).map((rule) => ({
            ...rule,
            id: newId(),
            when: remapTriggerNodes(rule.when, node),
            do: rule.do.map((action) => remapActionRefs(action, node, sound)),
          }));
        }
        const index = project.scenes.indexOf(current);
        const scenes = [...project.scenes];
        // Beside the scene it came from rather than at the end: the switcher
        // lists them in document order, and a copy that appears somewhere else
        // in that row is a copy the user has to go looking for.
        scenes.splice(index + 1, 0, copy);
        return { ...project, scenes, activeSceneId: copy.id };
      }),

    removeScene: (id) =>
      editProject((project) => {
        if (project.scenes.length < 2) return project;
        const index = project.scenes.findIndex((scene) => scene.id === id);
        if (index === -1) return project;
        const scenes = project.scenes.filter((scene) => scene.id !== id);
        // The neighbour, and the one before it when the last was removed —
        // where the user was looking, rather than back at the start of the row.
        const fallback = scenes[Math.min(index, scenes.length - 1)];
        return {
          ...project,
          scenes,
          activeSceneId:
            project.activeSceneId === id ? fallback.id : project.activeSceneId,
        };
      }),

    select: (id) => get().selectMany(id ? [id] : []),

    toggleSelect: (id) => {
      const { selectedIds } = get();
      get().selectMany(
        selectedIds.includes(id)
          ? selectedIds.filter((current) => current !== id)
          : [...selectedIds, id],
      );
    },

    selectMany: (ids) =>
      set((state) => {
        const children = activeScene(state.project).children;
        // Filtered on the way in, so nothing downstream has to ask whether a
        // selected id still names something — and so a stale id from a caller
        // holding an old list cannot resurrect a deleted node in the inspector.
        const live = ids.filter((id) => findNode(children, id));
        return { selectedIds: live, moveOrigins: originsFor(children, live) };
      }),

    selectAll: () =>
      get().selectMany(activeScene(get().project).children.map((node) => node.id)),

    cancelMove: () => {
      const { moveOrigins } = get();
      if (moveOrigins.length === 0) return;
      // Applied as ordinary edits rather than a history rewind, so cancelling
      // is itself undoable and can't strand the user mid-stack. One transaction
      // for the whole selection: the move was one gesture, so putting it back
      // is one step.
      get().beginTransaction();
      for (const origin of moveOrigins) get().updateTransform(origin.id, origin.transform);
      get().endTransaction();
      set({ selectedIds: [], moveOrigins: [] });
    },

    commitMove: () => set({ selectedIds: [], moveOrigins: [] }),

    addAsset: (asset) =>
      editProject((project) => ({ ...project, assets: [...project.assets, asset] })),

    removeAsset: (id) =>
      editProject((project) => {
        // The clips that read this sheet go with it: an animation over frames
        // of an image that is gone has nothing left to mean, and leaving it
        // behind would put a dangling clip in the file the parser then refuses
        // on the next open. One undo step covers the image, the clips and every
        // sprite that pointed at either.
        const orphaned = new Set(
          project.animations.filter((clip) => clip.assetId === id).map((clip) => clip.id),
        );

        // Every kind of reference to the image goes in one traversal, by the
        // rule that the document may never hold a dangling reference after any
        // action in the editor. `mapProjectNodes` rather than
        // `mapProjectSprites` because that one walks the scenes only, and a
        // sprite, an emitter or a tilemap can all sit inside a prefab
        // definition — where a dangling id would outlive the image with nothing
        // in the editor able to reach it.
        //
        // A tilemap keeps its tiles: unlike an image, where the bytes were the
        // only copy, the indices still mean something the moment another
        // tileset is picked, and `tileMapOf` draws them as empty until one is.
        return mapProjectNodes(
          {
            ...project,
            assets: project.assets.filter((asset) => asset.id !== id),
            animations: project.animations.filter((clip) => !orphaned.has(clip.id)),
          },
          (node) => {
            // A mask names this image too, and unlike every branch below it is
            // not keyed on the node's type: `fx` is on the base node, so any of
            // the ten can carry one. It is therefore computed first and merged
            // last, because the type branches `return` — a sprite with both a
            // dangling `props.assetId` and a mask over the same picture has to
            // have both cleared, and a mask branch written *after* them would
            // never run for one.
            //
            // The reference is cleared and the effect kept, which is this
            // function's own rule rather than `removeAudio`'s ten lines up: a
            // sprite whose image goes stays a sprite and draws the placeholder,
            // because the object is worth keeping — where a `SceneSound` *is* a
            // reference and goes with the file. A mask keeps its `invert`, and
            // picking another image puts it straight back.
            const fx = maskedFxWithout(node, id);

            // `withFx` exists because of the narrowing limit the comment below
            // describes: spreading `node` here would widen `props` to a union
            // of all ten types and match none of them, so the merge is done
            // through one cast in one place rather than in every branch.
            const withFx = (next: GameObjectNode | null): GameObjectNode | null => {
              if (!fx) return next;
              return { ...(next ?? node), fx } as GameObjectNode;
            };

            if (node.type === 'sprite') {
              if (node.props.assetId === id) {
                return withFx({
                  ...node,
                  props: { ...node.props, assetId: null, frame: 0, animationId: null },
                });
              }
              if (node.props.animationId && orphaned.has(node.props.animationId)) {
                return withFx({ ...node, props: { ...node.props, animationId: null } });
              }
              return withFx(null);
            }
            // Three branches rather than one condition over three types, and
            // that is TypeScript's doing rather than a style choice: the
            // discriminated union only narrows `props` when the check names one
            // type, so a combined test widens the spread to a union of all
            // three and the result matches none of them.
            //
            // A panel keeps its insets and its box, and a tile sprite its
            // offset and tile scale: those describe how the *object* is built,
            // not which picture it was built from, and they mean the same thing
            // again the moment another image is chosen. Only the frame goes,
            // for the reason it goes on an emitter — an index into a grid that
            // is no longer there.
            if (node.type === 'particles' && node.props.assetId === id) {
              return withFx({ ...node, props: { ...node.props, assetId: null, frame: 0 } });
            }
            if (node.type === 'nineslice' && node.props.assetId === id) {
              return withFx({ ...node, props: { ...node.props, assetId: null, frame: 0 } });
            }
            if (node.type === 'tileSprite' && node.props.assetId === id) {
              return withFx({ ...node, props: { ...node.props, assetId: null, frame: 0 } });
            }
            if (node.type === 'tilemap' && node.props.assetId === id) {
              return withFx({ ...node, props: { ...node.props, assetId: null } });
            }
            return withFx(null);
          },
        );
      }),

    setAssetSheet: (assetId, sheet) =>
      editProject((project) => {
        const asset = findAsset(project, assetId);
        if (!asset) return project;
        const next: ImageAsset = { ...asset };
        if (sheet) next.sheet = sheet;
        else delete next.sheet;
        // An image is cut one way. This is the refuse-on-write half of that
        // rule and `frameGridOf`/`atlasOf` strip on read as the other — the two
        // look redundant and are not, exactly as the physics body's pair is:
        // this half stops the UI offering a state that would do nothing, and
        // the reader half is what lets every other call site need no guard.
        if (sheet) delete next.atlas;
        return recut(project, assetId, next);
      }),

    setAssetAtlas: (assetId, frames) =>
      editProject((project) => {
        const asset = findAsset(project, assetId);
        if (!asset) return project;
        const next: ImageAsset = { ...asset };
        if (frames) next.atlas = frames;
        else delete next.atlas;
        if (frames) delete next.sheet;
        return recut(project, assetId, next);
      }),

    addAnimationFor: (nodeId) => {
      const state = get();
      const node = findNode(activeScene(state.project).children, nodeId);
      if (!node || node.type !== 'sprite' || !node.props.assetId) return;
      const asset = findAsset(state.project, node.props.assetId);
      // Only a cut image has a sequence to animate, either way it was cut. A
      // plain image is one frame, and a one-frame animation is a still picture
      // with a frame rate.
      if (!asset || (!frameGridOf(asset) && !atlasOf(asset))) return;

      const clip: AnimationClip = {
        id: newId(),
        name: uniqueAnimationName(state.project, 'Animation'),
        assetId: asset.id,
        // Every frame, in order: the image the user has just cut is almost
        // always exactly the sequence they cut it for, and trimming it is far
        // easier than typing it out. For an atlas that order is the packer's
        // own, which is the order the artist exported them in.
        frames: atlasOf(asset)
          ? frameNamesOf(asset)
          : Array.from({ length: frameCountOf(asset) }, (_, index) => index),
        frameRate: DEFAULT_FRAME_RATE,
        repeat: -1,
      };

      // Creating it and playing it are one act, and so one undo step: an
      // animation nothing plays is invisible, so a user who pressed the button
      // and saw nothing change would reasonably conclude it had not worked.
      editProject((project) =>
        mapProjectSprites(
          { ...project, animations: [...project.animations, clip] },
          (_props, id) => (id === nodeId ? { animationId: clip.id } : null),
        ),
      );
    },

    updateAnimation: (id, patch) =>
      editProject((project) => {
        const clip = project.animations.find((entry) => entry.id === id);
        if (!clip) return project;

        // Validated against however the clip's own asset is cut, which is what
        // keeps the two kinds from mixing inside one clip: a name is kept only
        // if the atlas has it, an index only if the grid reaches it.
        const asset = findAsset(project, clip.assetId);
        const names = new Set(frameNamesOf(asset));
        const count = frameCountOf(asset);
        const frames = names.size
          ? patch.frames?.filter((frame) => typeof frame === 'string' && names.has(frame))
          : patch.frames
              ?.filter(
                (frame) =>
                  typeof frame === 'number' && Number.isFinite(frame) && frame >= 0 && frame < count,
              )
              .map((frame) => Math.floor(frame as number));
        // An empty list is not a clip Phaser can create, and the field this
        // arrives from is a text box the user can empty mid-edit. Keeping the
        // frames it had is the only answer that does not lose the sequence.
        const next: AnimationClip = {
          ...clip,
          ...patch,
          frames: frames && frames.length > 0 ? frames : clip.frames,
        };
        return {
          ...project,
          animations: project.animations.map((entry) => (entry.id === id ? next : entry)),
        };
      }),

    removeAnimation: (id) =>
      editProject((project) =>
        mapProjectSprites(
          { ...project, animations: project.animations.filter((clip) => clip.id !== id) },
          (props) => (props.animationId === id ? { animationId: null } : null),
        ),
      ),

    addAudio: (asset) =>
      editProject((project) => ({ ...project, audio: [...project.audio, asset] })),

    removeAudio: (id) =>
      editProject((project) => ({
        ...project,
        audio: project.audio.filter((asset) => asset.id !== id),
        // Every scene, because a sound registered in a scene the user is not
        // looking at is exactly the dangling reference this is here to prevent.
        // Prefabs are deliberately not walked, and that is not an oversight of
        // the kind `removeAsset` had to fix: a definition holds nodes, and a
        // sound is not one, so there is nowhere in a prefab for one to hide.
        scenes: project.scenes.map((scene) => {
          const kept = soundsOf(project, scene).filter((sound) => sound.audioId !== id);
          // Array identity where nothing changed, which is `editProject`'s
          // signal for "nothing happened" and therefore for "no undo step".
          return kept.length === (scene.sounds?.length ?? 0)
            ? scene
            : { ...scene, sounds: kept };
        }),
      })),

    // Through `editProject` and `withActiveScene` rather than `editScene`,
    // because `soundsOf` validates against the project's own table and
    // `editScene` hands its callback the scene alone.
    addSceneSound: (audioId) =>
      editProject((project) =>
        withActiveScene(project, (scene) => ({
          ...scene,
          sounds: [...soundsOf(project, scene), defaultSceneSound(audioId)],
        })),
      ),

    // Rebuilt rather than mutated in place, for the reason `moveGuide` is: the
    // undo history is snapshots of this document, so an in-place edit would
    // rewrite the past along with the present.
    updateSceneSound: (id, patch) =>
      editProject((project) =>
        withActiveScene(project, (scene) => ({
          ...scene,
          sounds: soundsOf(project, scene).map((sound) =>
            sound.id === id ? { ...sound, ...patch } : sound,
          ),
        })),
      ),

    removeSceneSound: (id) =>
      editProject((project) =>
        withActiveScene(project, (scene) => ({
          ...scene,
          sounds: soundsOf(project, scene).filter((sound) => sound.id !== id),
        })),
      ),

    addFont: (asset) =>
      editProject((project) => ({ ...project, fonts: [...project.fonts, asset] })),

    // One line, and see the declaration above for why there is no traversal
    // here: a text node names a family rather than an id, so there is no
    // reference to clear and nothing to leave dangling.
    removeFont: (id) =>
      editProject((project) => ({
        ...project,
        fonts: project.fonts.filter((asset) => asset.id !== id),
      })),

    addVariable: () =>
      editProject((project) => ({
        ...project,
        variables: [
          ...project.variables,
          { id: newId(), name: unusedVariableName(project), value: 0 },
        ],
      })),

    // Rebuilt rather than mutated in place, for the reason `updateSceneSound`
    // is: the undo history is snapshots of this document, so an in-place edit
    // would rewrite the past along with the present.
    updateVariable: (id, patch) =>
      editProject((project) => ({
        ...project,
        variables: project.variables.map((variable) =>
          variable.id === id ? { ...variable, ...patch } : variable,
        ),
      })),

    // Switching a kind is its own action rather than an `updateVariable` patch,
    // because the kind is the *type of the value* and changing it reaches every
    // rule in the project that reads or writes this variable. `removeAsset`'s
    // rule, one table over: **the document may never hold a mismatch by any
    // action in the editor**, so `rulesOf`'s refusals only ever fire on a file
    // the editor did not write. Without this, switching a score to text would
    // leave every rule that sets it holding a number the reader refuses, and
    // those rules would vanish from the panel with nothing having said so —
    // strip on read, repair on write, and one undo step for both halves.
    setVariableKind: (id, kind) =>
      editProject((project) => {
        const variable = findVariable(project, id);
        if (variable === undefined || variableKindOf(variable) === kind) return project;
        return {
          ...project,
          variables: project.variables.map((entry) =>
            entry.id === id
              ? { ...entry, value: coerceVariableValue(entry.value, kind) }
              : entry,
          ),
          scenes: project.scenes.map((scene) => {
            const rules = scene.rules;
            if (rules === undefined) return scene;
            let touched = false;
            const next: SceneRule[] = [];
            for (const rule of rules) {
              const migrated = migrateRuleToKind(rule, id, kind);
              if (migrated !== rule) touched = true;
              // A rule whose every action was arithmetic on what is now text is
              // a rule with nothing left to do, which is one `rulesOf` drops on
              // the next read anyway. Dropping it here keeps the document and
              // the reader saying one thing.
              if (migrated.do.length > 0) next.push(migrated);
            }
            return touched ? { ...scene, rules: next } : scene;
          }),
        };
      }),

    removeVariable: (id) =>
      editProject((project) => {
        // Every text node that *shows* it loses its binding and keeps its
        // caption, in the same undo step — `removeAsset`'s rule, which is that
        // the document may never hold a dangling reference by any action in the
        // editor, so `labelOf`'s drop-on-read only ever fires on a file this
        // editor did not write. Through `mapProjectNodes` rather than a walk of
        // `scenes`, because a label inside a prefab definition is drawn in every
        // placement and is exactly the one a scene walk would miss.
        //
        // It narrows and does not widen: the label stops appending a value,
        // which is strictly less than it said. That is why this is a prune where
        // the rules below are a deletion — a rule that lost its gate would fire
        // always, and a caption that lost its number is only a caption.
        const stripped = mapProjectNodes(project, (node) => {
          if (node.type !== 'text' || node.props.label?.variableId !== id) return null;
          // `delete`, never `label: undefined`: the key would survive in memory
          // and vanish through `JSON.stringify`, which is two spellings of
          // "off" — see `setNodeLabel`, which is where that argument is made.
          const props = { ...node.props };
          delete props.label;
          return { ...node, props };
        });
        return {
          ...stripped,
          variables: stripped.variables.filter((variable) => variable.id !== id),
          // Every rule that names it goes with it — **whole**, in a condition or
          // in an action alike, and that is the same treatment `rulesOf` gives it
          // on read, so the store and the reader say one thing.
          //
          // The naive prune is wrong, and wrong in the direction this feature
          // cares about most: dropping only the *conditions* that read the
          // variable would leave `when tap coin, if score >= 10, startScene win`
          // as `when tap coin, startScene win`, which now fires always. A repair
          // may narrow what the document says and may never widen it, and that
          // rule binds the store exactly as it binds the reader.
          //
          // Every scene, because a rule in a scene the user is not looking at is
          // exactly the dangling reference this is here to prevent —
          // `removeAudio`'s walk. Array identity where nothing changed, which is
          // `editProject`'s signal for "no undo step".
          scenes: stripped.scenes.map((scene) => {
            const rules = scene.rules;
            if (rules === undefined) return scene;
            const kept = rules.filter((rule) => !ruleUsesVariable(rule, id));
            return kept.length === rules.length ? scene : { ...scene, rules: kept };
          }),
        };
      }),

    createPrefabFromSelection: () => {
      const state = get();
      const scene = activeScene(state.project);
      const ids = selectionRoots(scene.children, state.selectedIds);
      if (ids.length === 0) return;
      // A definition may not itself place a prefab: see `prefabChildrenOf`.
      if (containsInstance(ids.flatMap((id) => findNode(scene.children, id) ?? []))) return;

      // The frontmost selected object anchors the instance, exactly as it
      // anchors a group: the instance takes its place in the draw order, its
      // parent and its position, and every selected node is recomputed against
      // that, so nothing moves on the canvas.
      const anchor = ids[ids.length - 1];
      const anchorNode = findNode(scene.children, anchor);
      if (!anchorNode) return;
      const parentId = findParent(scene.children, anchor)?.id ?? null;

      const at: Transform = {
        x: Math.round(anchorNode.transform.x),
        y: Math.round(anchorNode.transform.y),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      // Unrotated and unscaled, so composing it onto the parent and inverting
      // that per child is an exact translation.
      const instanceWorld = composeTransform(
        worldTransformOf(scene.children, parentId),
        at,
      );
      const definition = ids.flatMap((id) => {
        const node = findNode(scene.children, id);
        if (!node) return [];
        return [
          cloneWithNewIds({
            ...node,
            transform: tidyTransform(
              localTransformIn(instanceWorld, worldTransformOf(scene.children, id)),
            ),
          } as GameObjectNode),
        ];
      });

      const prefab: Prefab = {
        id: newId(),
        name: uniquePrefabName(
          state.project,
          ids.length === 1 ? anchorNode.name : 'Prefab',
        ),
        // Fresh ids: the definition's nodes and the scene's must never be the
        // same objects, or editing one would reach into the other.
        children: definition,
      };
      const instance = createInstanceNode(prefab, at.x, at.y);

      editProject((project) => ({
        ...withActiveScene(project, (s) => {
          const siblings = parentId
            ? (findNode(s.children, parentId)?.children ?? [])
            : s.children;
          const index = siblings.findIndex((node) => node.id === anchor);
          // Originals out before the instance goes in, and the anchor's index
          // adjusted for the selected siblings ahead of it — `groupSelection`'s
          // trap, for the same reason: `removeNode` recurses by id.
          const ahead = siblings
            .slice(0, index)
            .filter((node) => ids.includes(node.id)).length;
          return {
            ...s,
            children: insertNode(
              ids.reduce(removeNode, s.children),
              parentId,
              instance,
              index - ahead,
            ),
          };
        }),
        prefabs: [...project.prefabs, prefab],
      }));
      get().select(instance.id);
    },

    placePrefab: (prefabId) => {
      const state = get();
      const prefab = findPrefab(state.project, prefabId);
      if (!prefab) return;
      const scene = activeScene(state.project);
      const parentId = openContainerId(state);
      // `addNode`'s placement rule, and for its reasons.
      const node = parentId
        ? createInstanceNode(prefab, 0, 0)
        : createInstanceNode(
            prefab,
            Math.round(scene.width / 2),
            Math.round(scene.height / 2),
          );
      editScene((s) => ({ ...s, children: insertNode(s.children, parentId, node) }));
      get().select(node.id);
    },

    updatePrefabFrom: (prefabId, nodeId) =>
      editProject((project) => {
        const node = findNode(activeScene(project).children, nodeId);
        // A group only. Its frame *is* the instance's frame, so its children's
        // transforms transfer with no arithmetic at all — which is the whole
        // reason this round trip is one line rather than a rebasing pass.
        if (!node || node.type !== 'container') return project;
        if (!findPrefab(project, prefabId)) return project;
        if (containsInstance(node.children)) return project;
        const children = node.children.map(cloneWithNewIds);
        return {
          ...project,
          prefabs: project.prefabs.map((prefab) =>
            prefab.id === prefabId ? { ...prefab, children } : prefab,
          ),
        };
      }),

    detachInstance: (id) =>
      editProject((project) =>
        withActiveScene(project, (scene) => {
          const node = findNode(scene.children, id);
          if (!node || node.type !== 'instance') return scene;
          return { ...scene, children: mapNode(scene.children, id, () => detachedNode(project, node)) };
        }),
      ),

    renamePrefab: (id, name) =>
      editProject((project) => {
        const prefab = findPrefab(project, id);
        // Not de-duplicated on rename, as a clip's name is not: forcing
        // uniqueness mid-typing fights the user, and the exporter's own
        // `used` set is the backstop that keeps the generated code valid.
        if (!prefab || prefab.name === name) return project;
        return {
          ...project,
          prefabs: project.prefabs.map((p) => (p.id === id ? { ...p, name } : p)),
        };
      }),

    removePrefab: (id) =>
      editProject((project) => {
        if (!findPrefab(project, id)) return project;
        // Detached first, and against the project that still holds the
        // definition, so every instance keeps drawing what it drew. Dropping
        // the definition alone would leave dangling references in a saved file;
        // `removeAsset` settled that this must never happen by any action here.
        const detached = mapProjectNodes(project, (node) =>
          node.type === 'instance' && node.props.prefabId === id
            ? detachedNode(project, node)
            : null,
        );
        // And the rules that build it go too, in the same undo step — the
        // other half of "the document may never hold a dangling reference by
        // any action in the editor", which is what keeps `ruleActionsOf`'s
        // drop-on-read a guard against hand-edited files rather than a thing
        // the editor routinely relies on.
        //
        // **The actions are stripped and only an emptied rule is dropped**,
        // which is `setVariableKind`'s shape rather than `removeVariable`'s,
        // and the reason is the reader's own cost model said back to it: a
        // dangling prefab costs the *action*, so a deletion here must cost the
        // action too. `removeVariable` drops whole rules because a dangling
        // *variable* costs the whole rule. If the store and the reader
        // disagreed about that, a delete would make rules vanish that a
        // re-open would have kept.
        //
        // Scenes and rules are both handed back by identity when nothing in
        // them named the prefab, or `editProject`'s "nothing happened, no undo
        // step" contract breaks.
        const scenes = detached.scenes.map((scene) => {
          const rules = scene.rules;
          if (!Array.isArray(rules)) return scene;
          let changed = false;
          const next: SceneRule[] = [];
          for (const rule of rules) {
            const actions = Array.isArray(rule.do) ? rule.do : [];
            const kept = actions.filter(
              (action) => !(action.kind === 'spawn' && action.prefabId === id),
            );
            if (kept.length === actions.length) {
              next.push(rule);
              continue;
            }
            changed = true;
            // An emptied `do` is a rule `rulesOf` would drop on the next read
            // anyway, so keeping it would be a row in the panel that is not in
            // the emit — `removeCollider`'s reason for taking its rules with it.
            if (kept.length > 0) next.push({ ...rule, do: kept });
          }
          return changed ? { ...scene, rules: next } : scene;
        });
        return {
          ...detached,
          scenes,
          prefabs: detached.prefabs.filter((prefab) => prefab.id !== id),
        };
      }),

    addNode: (type) => {
      const state = get();
      const scene = activeScene(state.project);
      const parentId = openContainerId(state);
      // At the top level, drop new objects at the scene centre rather than 0,0,
      // which on a top-left origin would put them half off-canvas. Inside a
      // container there is no centre to speak of, so a new child starts on the
      // container's own origin, which is where the user can see it.
      const node = parentId
        ? createNode(type, 0, 0)
        : createNode(type, Math.round(scene.width / 2), Math.round(scene.height / 2));
      editScene((s) => ({ ...s, children: insertNode(s.children, parentId, node) }));
      get().select(node.id);
    },

    moveNode: (id, parentId, index) =>
      editScene((scene) => {
        const node = findNode(scene.children, id);
        if (!node) return scene;
        if (parentId !== null) {
          const parent = findNode(scene.children, parentId);
          // Only a container can hold children, and a node cannot be dropped
          // into its own subtree: that would detach the branch from the scene
          // and leave a cycle nothing could render or serialise.
          if (!parent || parent.type !== 'container' || containsNode(node, parentId)) {
            return scene;
          }
        }
        if ((findParent(scene.children, id)?.id ?? null) === parentId && index === undefined) {
          return scene;
        }

        // Recomputed against the new parent so the object does not jump: what
        // reparenting changes is who it moves with, not where it is.
        const local = tidyTransform(
          localTransformIn(
            worldTransformOf(scene.children, parentId),
            worldTransformOf(scene.children, id),
          ),
        );
        const moved = { ...node, transform: local } as GameObjectNode;
        return {
          ...scene,
          children: insertNode(removeNode(scene.children, id), parentId, moved, index),
        };
      }),

    groupSelection: () => {
      const state = get();
      const scene = activeScene(state.project);
      const ids = selectionRoots(scene.children, state.selectedIds);
      if (ids.length === 0) return;

      // The frontmost selected object anchors the group: the group takes its
      // place in the draw order, its parent, and its position. Anchoring on the
      // frontmost rather than the first keeps the group where the objects
      // already were relative to everything else in the list.
      const anchor = ids[ids.length - 1];
      const anchorNode = findNode(scene.children, anchor);
      if (!anchorNode) return;
      const parentId = findParent(scene.children, anchor)?.id ?? null;

      const group = createNode(
        'container',
        Math.round(anchorNode.transform.x),
        Math.round(anchorNode.transform.y),
        ids.length === 1 ? `${anchorNode.name} group` : undefined,
      );
      // The group is unrotated and unscaled, so composing it onto its parent
      // and inverting that for each child is an exact translation: nothing
      // moves, rotates or changes size, whatever the objects came from.
      const groupWorld = composeTransform(
        worldTransformOf(scene.children, parentId),
        group.transform,
      );
      const children = ids.flatMap((id) => {
        const node = findNode(scene.children, id);
        if (!node) return [];
        return [
          {
            ...node,
            transform: tidyTransform(
              localTransformIn(groupWorld, worldTransformOf(scene.children, id)),
            ),
          } as GameObjectNode,
        ];
      });

      editScene((s) => {
        const siblings = parentId
          ? (findNode(s.children, parentId)?.children ?? [])
          : s.children;
        const at = siblings.findIndex((node) => node.id === anchor);
        // The originals have to come out before the group goes in — they carry
        // the same ids as the nodes now inside it, and `removeNode` recurses,
        // so a group inserted first would have its own contents pulled back out
        // from under it. Removing first moves the anchor's index, hence the
        // count of selected siblings ahead of it.
        const ahead = siblings
          .slice(0, at)
          .filter((node) => ids.includes(node.id)).length;
        return {
          ...s,
          children: insertNode(
            ids.reduce(removeNode, s.children),
            parentId,
            { ...group, children },
            at - ahead,
          ),
        };
      });
      get().select(group.id);
    },

    // Deletes one named node — the scene tree's row button, which is about the
    // row it sits on and not about what happens to be selected. `editProject`
    // takes the node out of the selection if it was in it.
    deleteNode: (id) =>
      editScene((scene) => ({ ...scene, children: removeNode(scene.children, id) })),

    deleteSelection: () => {
      const ids = selectionRoots(activeScene(get().project).children, get().selectedIds);
      if (ids.length === 0) return;
      editScene((scene) => ({ ...scene, children: ids.reduce(removeNode, scene.children) }));
    },

    duplicateSelection: () => {
      const ids = selectionRoots(activeScene(get().project).children, get().selectedIds);
      if (ids.length === 0) return;

      const copies: string[] = [];
      editScene((scene) => {
        let children = scene.children;
        for (const id of ids) {
          const node = findNode(children, id);
          if (!node) continue;
          const copy = offsetCopy(node);
          copies.push(copy.id);
          // Directly after the original, among its own siblings: the copy sits
          // one step in front of what it was copied from, in the same
          // container, rather than jumping to the top of the scene.
          children = editSiblings(children, id, (list, index) => [
            ...list.slice(0, index + 1),
            copy,
            ...list.slice(index + 1),
          ]);
        }
        return children === scene.children ? scene : { ...scene, children };
      });
      // The copies, not the originals: what you have just made is what you want
      // to move, and that holds however many of them there are.
      if (copies.length > 0) get().selectMany(copies);
    },

    copySelection: () => {
      const scene = activeScene(get().project);
      const ids = selectionRoots(scene.children, get().selectedIds);
      const nodes = ids.flatMap((id) => findNode(scene.children, id) ?? []);
      if (nodes.length > 0) set({ clipboard: nodes });
    },

    pasteNode: () => {
      const state = get();
      const { clipboard } = state;
      if (clipboard.length === 0) return;
      const copies = clipboard.map(offsetCopy);
      const parentId = openContainerId(state);
      editScene((scene) => ({
        ...scene,
        children: copies.reduce(
          (children, copy) => insertNode(children, parentId, copy),
          scene.children,
        ),
      }));
      // Cascade: the next paste offsets from where this one landed.
      set({ clipboard: copies });
      get().selectMany(copies.map((copy) => copy.id));
    },

    reorderNode: (id, toIndex) =>
      editScene((scene) => ({
        ...scene,
        children: editSiblings(scene.children, id, (list, from) => {
          const to = Math.max(0, Math.min(list.length - 1, toIndex));
          if (to === from) return list;
          const next = list.slice();
          const [node] = next.splice(from, 1);
          next.splice(to, 0, node);
          return next;
        }),
      })),

    renameNode: (id, name) =>
      editScene((scene) => ({
        ...scene,
        children: mapNode(scene.children, id, (node) => ({ ...node, name })),
      })),

    setNodeVisible: (id, visible) =>
      editScene((scene) => ({
        ...scene,
        children: mapNode(scene.children, id, (node) => ({ ...node, visible })),
      })),

    setSelectionVisible: (visible) => {
      const ids = selectionRoots(activeScene(get().project).children, get().selectedIds);
      if (ids.length === 0) return;
      editScene((scene) => ({
        ...scene,
        children: ids.reduce(
          (children, id) => mapNode(children, id, (node) => ({ ...node, visible })),
          scene.children,
        ),
      }));
    },

    alignSelection: (edge) => {
      const state = get();
      // Two objects is the smallest set that can be out of line with each
      // other; one object has nothing to align to but itself.
      applyWorldDeltas(state, (boxes) =>
        boxes.size < 2 ? new Map() : alignDeltas(boxes, edge),
      );
    },

    alignSelectionToScene: (edge) => {
      const state = get();
      const scene = activeScene(state.project);
      const rect: Rect = { x: 0, y: 0, width: scene.width, height: scene.height };
      applyWorldDeltas(state, (boxes) => alignDeltas(boxes, edge, rect));
    },

    distributeSelection: (axis) => {
      applyWorldDeltas(get(), (boxes) => distributeDeltas(boxes, axis));
    },

    nudgeSelection: (dx, dy) => {
      const state = get();
      const children = activeScene(state.project).children;
      const ids = selectionRoots(children, state.selectedIds);
      if (ids.length === 0) return;

      // Every root takes the same delta, so a following emitter whose target is
      // also moving is carried by it and takes none of its own — which is what
      // `compensateFollowers` answers for equal deltas.
      const deltas = compensateFollowers(
        activeScene(state.project),
        new Map(ids.map((id) => [id, { dx, dy }])),
      );

      // One undo step for the whole selection, nested inside whatever
      // transaction the caller has open for the key press itself.
      state.beginTransaction();
      for (const [id, delta] of deltas) {
        const node = findNode(children, id);
        if (!node || (delta.dx === 0 && delta.dy === 0)) continue;
        state.updateTransform(id, worldMovePatch(children, node, delta.dx, delta.dy));
      }
      state.endTransaction();
    },

    updateTransform: (id, patch) =>
      editScene((scene) => ({
        ...scene,
        children: mapNode(scene.children, id, (node) => ({
          ...node,
          transform: { ...node.transform, ...patch },
        })),
      })),

    updateProps: (id, patch) =>
      editScene((scene) => ({
        ...scene,
        children: mapNode(
          scene.children,
          id,
          // The one cast in the store: spreading a partial patch over a
          // discriminated union widens `props` past the branch TypeScript picked
          // from `type`. It is safe because the inspector only ever sends keys
          // belonging to the node type it is currently rendering.
          (node) => ({ ...node, props: { ...node.props, ...patch } }) as GameObjectNode,
        ),
      })),

    updateScene: (patch) => editScene((scene) => ({ ...scene, ...patch })),

    setCamera: (patch) =>
      editScene((scene) => {
        // Merged over the validated read, not over the raw field, so a patch
        // landing on a hand-edited camera cleans it up on its way past — the
        // `setNodePhysics` rule.
        const next = { ...cameraOf(scene), ...patch };
        if (
          next.followId !== null &&
          !scene.children.some((child) => child.id === next.followId)
        ) {
          // Not a direct child of the scene, so not somewhere a follow means
          // anything. `cameraOf` already reads such a target as absent; this is
          // the other half, which is what stops the UI offering it.
          next.followId = null;
        }

        if (isDefaultCamera(next)) {
          if (scene.camera === undefined) return scene;
          // Removed rather than stored as a camera that says nothing: an absent
          // field is what every file written before this feature has, so "no
          // camera" is one state rather than two. `setNodePhysics` strips a
          // body the same way, and it is what the Reset button is.
          const stripped = { ...scene };
          delete stripped.camera;
          return stripped;
        }
        return { ...scene, camera: next };
      }),

    setNodePhysics: (id, patch) =>
      editScene((scene) => {
        const index = scene.children.findIndex((child) => child.id === id);
        // Not a direct child of the scene, so not somewhere a body means
        // anything. Returning the scene unchanged keeps array identity, which
        // is what `editProject` reads for "nothing happened" and therefore for
        // "no undo step".
        if (index < 0) return scene;
        const node = scene.children[index];
        if (!canHavePhysics(node.type)) return scene;

        let next: GameObjectNode;
        if (patch === null) {
          if (!node.physics) return scene;
          // Removed rather than left as a disabled body: an absent field is
          // what every file written before this feature has, so "no body" is
          // one state rather than two.
          const stripped = { ...node } as GameObjectNode;
          delete stripped.physics;
          next = stripped;
        } else {
          // Merged over the validated read, not over the raw field, so a patch
          // landing on a hand-edited body cleans it up on its way past.
          const base = physicsOf(node, true) ?? defaultPhysicsBody();
          next = { ...node, physics: { ...base, ...patch } } as GameObjectNode;
        }

        const children = [...scene.children];
        children[index] = next;
        return { ...scene, children };
      }),

    setNodeControls: (id, patch) =>
      editScene((scene) => {
        // `scene.children` directly, which *is* the top-level rule — the same
        // shape `setNodePhysics` uses and for the same reason.
        const index = scene.children.findIndex((child) => child.id === id);
        if (index < 0) return scene;
        const node = scene.children[index];
        // A static body has no velocity to set, so there is nothing here to
        // switch on. `controlsOf` says the same thing on the way out.
        const body = physicsOf(node, true);
        if (body === null || body.kind !== 'dynamic') return scene;

        let next: GameObjectNode;
        if (patch === null) {
          if (!node.controls) return scene;
          const stripped = { ...node } as GameObjectNode;
          delete stripped.controls;
          next = stripped;
        } else {
          const base = controlsOf(node, true) ?? defaultControls();
          next = { ...node, controls: { ...base, ...patch } } as GameObjectNode;
        }

        const children = [...scene.children];
        children[index] = next;
        return { ...scene, children };
      }),

    setNodeTween: (id, patch) =>
      editScene((scene) => {
        // Found first, then mapped — `detachInstance`'s shape, and here for the
        // "nothing happened, no undo step" contract rather than for the node
        // itself: `mapNode` allocates a new array whether or not it finds
        // anything, so without this an id that names nothing would still push a
        // history entry.
        const node = findNode(scene.children, id);
        if (!node) return scene;
        if (patch === null && !node.tween) return scene;

        // `mapNode`, not `scene.children` — see the declaration. A tween on a
        // node inside a group is a perfectly ordinary thing to want.
        return {
          ...scene,
          children: mapNode(scene.children, id, (current) => {
            if (patch === null) {
              const stripped = { ...current } as GameObjectNode;
              delete stripped.tween;
              return stripped;
            }
            const base = tweenOf(current) ?? defaultTween(current);
            return { ...current, tween: { ...base, ...patch } } as GameObjectNode;
          }),
        };
      }),

    setNodeLabel: (id, patch) =>
      // The project rather than the scene, because the variable to seed with
      // lives on the project — `withActiveScene` keeps that one edit one undo
      // step, which is what the comment above it already says it is for.
      editProject((project) =>
        withActiveScene(project, (scene) => {
          // Found first, then mapped, for `setNodeTween`'s reason: `mapNode`
          // allocates whether or not it finds anything, so without this an id
          // naming nothing would still push a history entry.
          const node = findNode(scene.children, id);
          if (!node || node.type !== 'text') return scene;
          if (patch === null && node.props.label === undefined) return scene;
          // A label with nothing to follow is not a label. The picker cannot
          // offer this, so it only fires on a project whose variables have all
          // been deleted between a render and a press.
          const seed = project.variables[0];
          if (patch !== null && seed === undefined) return scene;

          // `mapNode`, not `scene.children`: a label on a text node inside a
          // group is an ordinary thing to want, and unlike a body or a drive
          // scheme it means exactly the same thing there — it is the object's
          // own text rather than anything read in world coordinates. The tween's
          // rule, one prop over.
          return {
            ...scene,
            children: mapNode(scene.children, id, (current) => {
              if (current.type !== 'text') return current;
              const props = { ...current.props };
              if (patch === null) {
                delete props.label;
                return { ...current, props };
              }
              const base = labelOf(current.props, project) ?? {
                variable: seed,
                decimals: RAW_DECIMALS,
                pad: 0,
              };
              props.label = {
                variableId: base.variable.id,
                decimals: base.decimals,
                pad: base.pad,
                ...patch,
              };
              return { ...current, props };
            }),
          };
        }),
      ),

    setTweenTarget: (id, property, value) =>
      editScene((scene) => {
        const node = findNode(scene.children, id);
        if (!node) return scene;

        return {
          ...scene,
          children: mapNode(scene.children, id, (current) => {
            const base = tweenOf(current) ?? defaultTween(current);
            const to = { ...base.to };
            if (value === null) delete to[property];
            else to[property] = value;
            // Every property cleared is a tween that drives nothing, which
            // `tweenOf` reads as absent — so the document says so too rather
            // than holding a tween the reader will refuse. The alternative is a
            // node whose stored tween and whose drawn state disagree, which is
            // the one thing a single reader exists to prevent.
            if (Object.keys(to).length === 0) {
              const stripped = { ...current } as GameObjectNode;
              delete stripped.tween;
              return stripped;
            }
            return { ...current, tween: { ...base, to } } as GameObjectNode;
          }),
        };
      }),

    // The four effect actions share one shape: find the node first so that an
    // id naming nothing pushes no undo step (`mapNode` allocates whether or not
    // it finds anything — `setNodeTween`'s reason), then rebuild the list
    // through `effectsOf` so the document can only ever hold what the reader
    // would have answered with. That is "strip on read, refuse on write" for
    // the fifth time, and it is what keeps `effectsOf`'s repairs a guard
    // against hand-edited files rather than something the editor leans on.
    //
    // A list that empties `delete`s the field rather than storing `[]`, because
    // `effectsOf` reads both as "no effects" and two spellings of one state is
    // how a document comes to disagree with itself — `setNodeLabel`'s reason,
    // and the reason `updateProps` could not do any of this.
    addEffect: (id, kind) =>
      editScene((scene) => {
        const node = findNode(scene.children, id);
        if (!node || effectsOf(node).length >= MAX_EFFECTS) return scene;
        return {
          ...scene,
          children: mapNode(scene.children, id, (current) => ({
            ...current,
            fx: [...effectsOf(current), defaultEffect(kind)],
          })),
        };
      }),

    setEffect: (id, index, effect) =>
      editScene((scene) => {
        const node = findNode(scene.children, id);
        if (!node || index < 0 || index >= effectsOf(node).length) return scene;
        return {
          ...scene,
          children: mapNode(scene.children, id, (current) => ({
            ...current,
            fx: effectsOf(current).map((existing, at) => (at === index ? effect : existing)),
          })),
        };
      }),

    removeEffect: (id, index) =>
      editScene((scene) => {
        const node = findNode(scene.children, id);
        if (!node || index < 0 || index >= effectsOf(node).length) return scene;
        return {
          ...scene,
          children: mapNode(scene.children, id, (current) => {
            const fx = effectsOf(current).filter((_, at) => at !== index);
            if (fx.length === 0) {
              const stripped = { ...current } as GameObjectNode;
              delete stripped.fx;
              return stripped;
            }
            return { ...current, fx } as GameObjectNode;
          }),
        };
      }),

    moveEffect: (id, index, delta) =>
      editScene((scene) => {
        const node = findNode(scene.children, id);
        if (!node) return scene;
        const effects = effectsOf(node);
        const to = index + delta;
        if (index < 0 || index >= effects.length || to < 0 || to >= effects.length) return scene;
        return {
          ...scene,
          children: mapNode(scene.children, id, (current) => {
            const fx = effectsOf(current);
            const [moved] = fx.splice(index, 1);
            fx.splice(to, 0, moved);
            return { ...current, fx } as GameObjectNode;
          }),
        };
      }),

    // An action of its own, for two independent reasons — `setNodeLabel`'s
    // shape, and its first reason verbatim. `updateProps` **spreads a patch,
    // so it can set a key and can never remove one**: `{ blendMode: undefined }`
    // leaves the key holding undefined, which survives in memory, vanishes
    // through `JSON.stringify`, and gives the document two spellings of "off".
    // That is why `setNodePhysics`, `setNodeControls`, `setNodeTween` and
    // `setNodeLabel` all `delete`, and a blend has the same property: NORMAL is
    // absence. The second reason is that it has to strip the legacy particles
    // prop in the same write, which a props patch could not do at all.
    //
    // Through `mapNode` rather than `scene.children`, so it reaches a node at
    // any depth — the tween's and `setNodeEffects`' route, not the body's.
    // Said in as many words because two of this field's four neighbours
    // deliberately search only the top level, and using `mapNode` beside them
    // reads like a mistake.
    setNodeBlendMode: (id, mode) =>
      editScene((scene) => {
        const node = findNode(scene.children, id);
        if (!node) return scene;
        // Nothing to do, and answering with the scene by identity is what keeps
        // `editProject`'s "nothing happened, no undo step" contract: without it,
        // re-picking the mode already showing pushes a history entry.
        const legacy = node.type === 'particles' && node.props.blendMode !== undefined;
        if (blendModeOf(node) === mode && !legacy && node.blendMode === undefined) return scene;
        return {
          ...scene,
          children: mapNode(scene.children, id, (current) => {
            const next = { ...current } as GameObjectNode;
            if (mode === 'NORMAL') delete next.blendMode;
            else next.blendMode = mode;
            // Whichever branch ran: the document holds one shape from here on,
            // which is `editTilemapProps`' rule for this one field.
            if (next.type === 'particles') {
              const props = { ...next.props };
              delete props.blendMode;
              next.props = props;
            }
            return next;
          }),
        };
      }),

    setNodeScrollFactor: (id, factor) =>
      editScene((scene) => {
        // `scene.children` directly, which *is* the top-level rule — the same
        // shape `setNodePhysics` and `setNodeControls` use, and for the reason
        // `scrollFactorOf`'s second argument states. Returning the scene by
        // identity keeps `editProject`'s "nothing happened, no undo step"
        // contract: without it, re-typing the number already showing pushes a
        // history entry.
        const index = scene.children.findIndex((child) => child.id === id);
        if (index < 0) return scene;
        const node = scene.children[index];

        // `null` and "both axes are 1" are one request, because absence is what
        // the default means. Normalising here rather than in the caller is what
        // stops the panel ever writing `{ x: 1, y: 1 }` into a document that
        // would then say the default twice.
        const wanted =
          factor === null || isDefaultScrollFactor(factor) ? null : factor;
        const current = scrollFactorOf(node, true);
        if (wanted === null && node.scrollFactor === undefined) return scene;
        if (wanted !== null && current.x === wanted.x && current.y === wanted.y) return scene;

        const next = { ...node } as GameObjectNode;
        if (wanted === null) delete next.scrollFactor;
        else next.scrollFactor = { x: wanted.x, y: wanted.y };

        const children = [...scene.children];
        children[index] = next;
        return { ...scene, children };
      }),

    setParticleFollow: (id, targetId) =>
      editScene((scene) => {
        const index = scene.children.findIndex((child) => child.id === id);
        if (index < 0) return scene;
        const node = scene.children[index];
        if (node.type !== 'particles') return scene;
        const wanted = targetId ?? undefined;
        // By identity when nothing changes, or `editProject` pushes an undo step
        // for re-picking the option already showing.
        if (node.props.followId === wanted) return scene;

        const props = { ...node.props };
        if (wanted === undefined) delete props.followId;
        else props.followId = wanted;
        const next = { ...node, props };

        // Where it is drawn stays where it is drawn: the offset changes by
        // whatever the active target changes by.
        const before = particleFollowOf(node, scene, true);
        const after = particleFollowOf(next, scene, true);
        const shiftX = (before?.transform.x ?? 0) - (after?.transform.x ?? 0);
        const shiftY = (before?.transform.y ?? 0) - (after?.transform.y ?? 0);
        const moved =
          shiftX === 0 && shiftY === 0
            ? next
            : {
                ...next,
                transform: {
                  ...next.transform,
                  x: next.transform.x + shiftX,
                  y: next.transform.y + shiftY,
                },
              };

        const children = [...scene.children];
        children[index] = moved;
        return { ...scene, children };
      }),

    addCollider: (aId, bId) =>
      editScene((scene) => ({
        ...scene,
        colliders: [...collidersOf(scene), { id: newId(), aId, bId, kind: 'collide' }],
      })),

    // A row is rebuilt rather than mutated, for the reason `moveGuide` is: the
    // undo history is snapshots of the document, so an in-place edit rewrites
    // the past as well as the present.
    updateCollider: (id, patch) =>
      editScene((scene) => {
        const colliders = collidersOf(scene);
        const index = colliders.findIndex((collider) => collider.id === id);
        if (index < 0) return scene;
        const next = [...colliders];
        next[index] = { ...colliders[index], ...patch, id };
        return { ...scene, colliders: next };
      }),

    removeCollider: (id) =>
      editScene((scene) => {
        const colliders = collidersOf(scene);
        const row = colliders.find((collider) => collider.id === id);
        if (row === undefined) return scene;
        const next = colliders.filter((collider) => collider.id !== id);
        // The rules that fired on this touch go with it, in the same step. A
        // collide rule is emitted *as* this row's third argument, so a rule left
        // behind would be one `rulesOf` drops on the next read — visible only as
        // a row that silently vanished from the panel some time later.
        //
        // Creating the row when a rule needs one is a convenience; destroying
        // the rules when the row goes is a correctness fix. The asymmetry is
        // deliberate, and it is `removeFont`'s.
        const rules = (scene.rules ?? []).filter((rule) => {
          const when = rule.when as RuleTrigger;
          if (when.kind !== 'collide') return true;
          return !(
            (when.aId === row.aId && when.bId === row.bId) ||
            (when.aId === row.bId && when.bId === row.aId)
          );
        });
        return { ...scene, colliders: next, rules };
      }),

    addRule: (when) =>
      editScene((scene) => {
        const paired = withColliderFor(scene, when);
        return {
          ...paired,
          rules: [
            ...(paired.rules ?? []),
            {
              id: newId(),
              name: unusedRuleName(paired),
              when,
              conditions: [],
              // `restartScene` is the one action that names nothing at all, so
              // it is the only seed that can never dangle whatever the scene
              // holds — which is what makes it the right default.
              do: [{ kind: 'restartScene' }],
            },
          ],
        };
      }),

    // Rebuilt rather than mutated, for `updateCollider`'s reason: the undo
    // history is snapshots of this document.
    updateRule: (id, patch) =>
      editScene((scene) => {
        // The row the *new* trigger needs, in the same step. A rule that
        // becomes a collide rule needs one exactly as a rule that arrives as
        // one does — and without this, switching the trigger produces a rule
        // `rulesOf` drops on the next read.
        const paired = patch.when ? withColliderFor(scene, patch.when) : scene;
        return {
          ...paired,
          rules: (paired.rules ?? []).map((rule) =>
            rule.id === id ? { ...rule, ...patch, id } : rule,
          ),
        };
      }),

    removeRule: (id) =>
      editScene((scene) => ({
        ...scene,
        rules: (scene.rules ?? []).filter((rule) => rule.id !== id),
      })),

    addRuleCondition: (ruleId) =>
      editScene((scene) => {
        const variable = get().project.variables[0];
        // Nothing to test against is not an error, it is a scene with no
        // variables yet — and a condition naming nothing would cost the whole
        // rule on the next read rather than just itself.
        if (variable === undefined) return scene;
        // Seeded in the variable's own kind, by the same rule: a check on a text
        // variable with `is at least 1` is one `rulesOf` drops on the next read,
        // so the row would vanish the moment it was added.
        const text = variableKindOf(variable) === 'text';
        return mapRule(scene, ruleId, (rule) => ({
          ...rule,
          conditions: [
            ...rule.conditions,
            text
              ? { variableId: variable.id, op: 'eq' as const, value: '' }
              : { variableId: variable.id, op: 'gte' as const, value: 1 },
          ],
        }));
      }),

    updateRuleCondition: (ruleId, index, patch) =>
      editScene((scene) =>
        mapRule(scene, ruleId, (rule) => ({
          ...rule,
          conditions: rule.conditions.map((condition, at) =>
            at === index ? { ...condition, ...patch } : condition,
          ),
        })),
      ),

    removeRuleCondition: (ruleId, index) =>
      editScene((scene) =>
        mapRule(scene, ruleId, (rule) => ({
          ...rule,
          conditions: rule.conditions.filter((_, at) => at !== index),
        })),
      ),

    addRuleAction: (ruleId) =>
      editScene((scene) =>
        mapRule(scene, ruleId, (rule) => ({
          ...rule,
          do: [...rule.do, { kind: 'restartScene' as const }],
        })),
      ),

    updateRuleAction: (ruleId, index, action) =>
      editScene((scene) =>
        mapRule(scene, ruleId, (rule) => ({
          ...rule,
          do: rule.do.map((existing, at) => (at === index ? action : existing)),
        })),
      ),

    removeRuleAction: (ruleId, index) =>
      editScene((scene) =>
        mapRule(scene, ruleId, (rule) => ({
          ...rule,
          do: rule.do.filter((_, at) => at !== index),
        })),
      ),

    moveRuleAction: (ruleId, index, delta) =>
      editScene((scene) =>
        mapRule(scene, ruleId, (rule) => {
          const to = index + delta;
          if (to < 0 || to >= rule.do.length) return rule;
          const next = [...rule.do];
          const [moved] = next.splice(index, 1);
          next.splice(to, 0, moved);
          return { ...rule, do: next };
        }),
      ),

    paintTiles: (nodeId, layerId, cells, tile) =>
      editProject((project) =>
        editTilemapLayer(project, nodeId, layerId, (target, map) => {
          const value = tile < 0 || tile >= map.tileCount ? EMPTY_TILE : Math.floor(tile);
          // Copied on the first cell that actually changes and not before, so a
          // stroke that repaints what is already there allocates nothing and
          // records no undo step.
          let data: number[] | null = null;
          for (const { column, row } of cells) {
            if (column < 0 || row < 0 || column >= map.columns || row >= map.rows) continue;
            const index = row * map.columns + column;
            if ((data ?? target.data)[index] === value) continue;
            data ??= [...target.data];
            data[index] = value;
          }
          return data ? { data } : null;
        }),
      ),

    fillTiles: (nodeId, layerId, tile) =>
      editProject((project) =>
        editTilemapLayer(project, nodeId, layerId, (target, map) => {
          const value = tile < 0 || tile >= map.tileCount ? EMPTY_TILE : Math.floor(tile);
          if (target.data.every((current) => current === value)) return null;
          return { data: target.data.map(() => value) };
        }),
      ),

    resizeTilemap: (nodeId, columns, rows) =>
      editProject((project) =>
        editTilemapProps(project, nodeId, (map) => {
          const side = (value: number) =>
            Number.isFinite(value)
              ? Math.min(Math.max(1, Math.floor(value)), MAX_TILEMAP_SIDE)
              : 1;
          const nextColumns = side(columns);
          const nextRows = side(rows);
          if (nextColumns === map.columns && nextRows === map.rows) return null;

          // Row by row, not index by index: the array is flat, so a new column
          // count re-reads every row after the first at the wrong offset. The
          // top-left stays put, which is where the map's own origin is.
          //
          // Every layer at once, and in the one step, because the grid is the
          // map's and not a layer's — a resize that reached only the layer being
          // painted would leave the others reinterpreted under a column count
          // that is no longer theirs, which is the same shift this loop exists
          // to prevent, one level up.
          const reshape = (data: number[]) =>
            Array.from({ length: nextColumns * nextRows }, (_, index) => {
              const column = index % nextColumns;
              const row = Math.floor(index / nextColumns);
              return column < map.columns && row < map.rows
                ? data[row * map.columns + column]
                : EMPTY_TILE;
            });
          return {
            columns: nextColumns,
            rows: nextRows,
            layers: map.layers.map((layer) => ({ ...toLayerDoc(layer), data: reshape(layer.data) })),
          };
        }),
      ),

    setTileSolid: (nodeId, layerId, tile, solid) =>
      editProject((project) =>
        editTilemapLayer(project, nodeId, layerId, (target, map) => {
          const index = Math.floor(tile);
          if (!Number.isFinite(index) || index < 0 || index >= map.tileCount) return null;
          const has = target.collides.includes(index);
          if (has === solid) return null;
          // Ascending, which is the order `tileMapOf` normalises to — so a
          // round trip through the reader changes nothing and the emitted
          // `setCollision` reads the same whichever order they were marked in.
          const collides = solid
            ? [...target.collides, index].sort((a, b) => a - b)
            : target.collides.filter((current) => current !== index);
          return { collides };
        }),
      ),

    addTilemapLayer: (nodeId) => {
      let added: string | null = null;
      editProject((project) =>
        editTilemapProps(project, nodeId, (map) => {
          const taken = new Set(map.layers.map((layer) => layer.name));
          let index = map.layers.length + 1;
          while (taken.has(`Layer ${index}`)) index += 1;
          const layer = createTilemapLayer(`Layer ${index}`, map.columns * map.rows);
          added = layer.id;
          // Appended, so a new layer is in *front* — which is what a user adding
          // one to paint over what is already there expects, and the same end of
          // the array `addNode` puts a new object at.
          return { layers: [...map.layers.map(toLayerDoc), layer] };
        }),
      );
      // Selected after the edit, so adding a layer is also switching to it —
      // the rule that already makes `addNode` select what it added.
      if (added) set({ activeLayerId: added });
    },

    removeTilemapLayer: (nodeId, layerId) =>
      editProject((project) =>
        editTilemapProps(project, nodeId, (map) => {
          // The last one is refused rather than allowed to empty the map, which
          // is `removeScene`'s rule: there would be no layer for `tileLayerOf`
          // to answer with and nothing to paint on.
          if (map.layers.length < 2) return null;
          const layers = map.layers.filter((layer) => layer.id !== layerId);
          if (layers.length === map.layers.length) return null;
          return { layers: layers.map(toLayerDoc) };
        }),
      ),

    renameTilemapLayer: (nodeId, layerId, name) =>
      editProject((project) =>
        editTilemapLayer(project, nodeId, layerId, (target) =>
          target.name === name ? null : { name },
        ),
      ),

    setTilemapLayerVisible: (nodeId, layerId, visible) =>
      editProject((project) =>
        editTilemapLayer(project, nodeId, layerId, (target) =>
          target.visible === visible ? null : { visible },
        ),
      ),

    moveTilemapLayer: (nodeId, layerId, delta) =>
      editProject((project) =>
        editTilemapProps(project, nodeId, (map) => {
          const from = map.layers.findIndex((layer) => layer.id === layerId);
          if (from < 0) return null;
          const to = Math.min(Math.max(0, from + delta), map.layers.length - 1);
          if (to === from) return null;
          // Splicing the array is the whole of forward and back, exactly as
          // `reorderNode` is for objects: the array order *is* the draw order
          // and there is no depth field here to disagree with it.
          const layers = map.layers.map(toLayerDoc);
          const [moved] = layers.splice(from, 1);
          layers.splice(to, 0, moved);
          return { layers };
        }),
      ),

    addGuide: (axis, position) =>
      editScene((scene) => ({
        ...scene,
        guides: [...guidesOf(scene), { id: newId(), axis, position }],
      })),

    // A move rebuilds the array rather than mutating an entry: the document is
    // the undo history's snapshots, so an in-place edit would rewrite the past
    // as well as the present.
    moveGuide: (id, position) =>
      editScene((scene) => ({
        ...scene,
        guides: guidesOf(scene).map((guide) =>
          guide.id === id ? { ...guide, position } : guide,
        ),
      })),

    removeGuide: (id) =>
      editScene((scene) => ({
        ...scene,
        guides: guidesOf(scene).filter((guide) => guide.id !== id),
      })),

    clearGuides: () =>
      editScene((scene) => (guidesOf(scene).length === 0 ? scene : { ...scene, guides: [] })),

    beginTransaction: () => {
      const state = get();
      if (state.txDepth === 0) {
        // Snapshot up front: the transaction's own mutations won't record one.
        set({
          past: [...state.past, state.project].slice(-HISTORY_LIMIT),
          future: [],
          txDepth: 1,
        });
      } else {
        set({ txDepth: state.txDepth + 1 });
      }
    },

    endTransaction: () => set((state) => ({ txDepth: Math.max(0, state.txDepth - 1) })),

    undo: () => {
      const state = get();
      const previous = state.past.at(-1);
      if (!previous) return;
      set({
        project: previous,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
        dirty: true,
        selectedIds: pruneIds(activeScene(previous).children, state.selectedIds, (id) => id),
        paintingId: prunePainting(activeScene(previous).children, state.paintingId),
        activeLayerId: pruneActiveLayer(
          activeScene(previous).children,
          [state.paintingId, ...state.selectedIds].filter((id): id is string => id !== null),
          state.activeLayerId,
        ),
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        project: next,
        past: [...state.past, state.project].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        dirty: true,
        selectedIds: pruneIds(activeScene(next).children, state.selectedIds, (id) => id),
        paintingId: prunePainting(activeScene(next).children, state.paintingId),
        activeLayerId: pruneActiveLayer(
          activeScene(next).children,
          [state.paintingId, ...state.selectedIds].filter((id): id is string => id !== null),
          state.activeLayerId,
        ),
      });
    },
  };
});

/** Convenience selector — the scene every panel is currently looking at. */
export const useActiveScene = (): SceneDoc =>
  useEditorStore((state) => activeScene(state.project));

/**
 * How many objects in the whole project use an image. Shown in the picker,
 * because deleting an image in use silently blanks those sprites.
 */
export function countAssetUses(project: Project, assetId: string): number {
  let count = 0;
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      // A tilemap uses its tileset, an emitter its particle texture, and a
      // panel and a tile sprite the picture they are cut from and repeat —
      // exactly as a sprite uses its image. The count is what the removal
      // warning says out loud, so leaving any of them out would under-report by
      // a whole object type.
      if (
        (node.type === 'sprite' ||
          node.type === 'tilemap' ||
          node.type === 'particles' ||
          node.type === 'nineslice' ||
          node.type === 'tileSprite') &&
        node.props.assetId === assetId
      ) {
        count += 1;
      }
      // A mask is the one use of an image that is not keyed on the node's type
      // at all: `fx` is on the base node, so any of the ten types can carry
      // one. Read through `effectsOf` rather than `node.fx`, so the count
      // cannot disagree with what is actually drawn — and counted per *effect*
      // rather than per node, because `MAX_EFFECTS` is four and two masks over
      // one picture are two uses of it. This number is what the deletion
      // warning says out loud.
      for (const effect of effectsOf(node)) {
        if (effect.kind === 'mask' && effect.assetId === assetId) count += 1;
      }
      walk(node.children);
    }
  };
  // Scenes only, where `countFontUses` beside it also walks `project.prefabs`.
  // That difference predates masks and is left alone deliberately: a sprite
  // inside a prefab definition already goes uncounted here, so a mask inside
  // one does too, and quietly fixing half of it would leave this function
  // disagreeing with its own doc comment.
  for (const scene of project.scenes) walk(scene.children);
  return count;
}

/**
 * How many scene entries register a sound, for the removal warning.
 *
 * `countAssetUses`' sibling, and the two differences are worth stating because
 * each of them looks like a mistake. It walks no nodes at all, because a sound
 * is registered by a scene rather than held by an object; and it walks no
 * prefab definitions, because there is nowhere in one for a sound to be.
 * `countAssetUses` is a hand-matched list of object types that under-reports by
 * a whole type if a case is forgotten — this has no list to forget.
 */
export function countAudioUses(project: Project, audioId: string): number {
  return project.scenes.reduce(
    (count, scene) =>
      count + soundsOf(project, scene).filter((sound) => sound.audioId === audioId).length,
    0,
  );
}

/**
 * How many text objects are drawn in a font, for the removal warning.
 *
 * The third of these, and it differs from both siblings in ways that each
 * follow from a font being named rather than pointed at.
 *
 * It matches a **family** rather than an id, through `fontStackOf`, so a node
 * whose `fontFamily` is `Chunky, sans-serif` counts — that node is drawn in the
 * font and would visibly change if it went.
 *
 * And it walks `project.prefabs` as well as `project.scenes`, where
 * `countAssetUses` walks only the scenes. That is not a difference of subject:
 * a text node can sit in a prefab definition exactly as a sprite can, so the
 * one that stops at the scenes under-reports by every object inside a prefab.
 * Copying it here would carry that across rather than inherit it.
 */
export function countFontUses(project: Project, family: string): number {
  let count = 0;
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text' && fontStackOf(node.props.fontFamily).includes(family)) {
        count += 1;
      }
      walk(node.children);
    }
  };
  for (const scene of project.scenes) walk(scene.children);
  for (const prefab of project.prefabs) walk(prefab.children);
  return count;
}

/**
 * Whether anything in the project moves by itself — an animation clip, a
 * particle emitter, or a tween anywhere in it.
 *
 * What decides whether the toolbar shows its preview toggle at all. It walks
 * the prefab definitions as well as the scenes, because an emitter that exists
 * only inside a placed prefab still animates the canvas, and a button that was
 * missing for it would leave that project with no way to stop the motion.
 *
 * Answers a boolean rather than anything derived: a zustand selector that
 * built a fresh object every call would compare unequal every render.
  *
 * Deliberately blind to physics bodies, which is worth saying out loud beside
 * a function that walks the prefab bodies for the emitters: a body does not
 * animate the canvas, because the editor never simulates one. There is nothing
 * for a ▶ to start and nothing for it to stop.
 *
 * Blind to audio for the same reason, and this is the one a reader will most
 * expect to be wrong — a sound is obviously a thing that happens over time in
 * a way a static body is not. But this toggle exists so that a canvas moving by
 * itself can be stopped, and the editor never plays a sound: a project full of
 * them makes no noise there is anything to stop. Auditioning one is a press on
 * its own row, which starts and ends inside the same gesture.
 *
 * A tween is the one *addition* among all of this, and it is here rather than
 * in the refusals below because it is the only one of them that moves an object
 * across the canvas on its own. The three that follow all describe things that
 * move nothing here at all.
 *
 * And blind to controls, keyboard and on-screen alike — the third refusal, and
 * the same one twice. A driven object does not move here because nothing here
 * simulates a body, and the buttons `touchZonesOf` puts on the canvas are
 * drawn rather than pressed: rings the editor never reads. Neither is a canvas
 * moving by itself, so neither is something a ▶ could stop.
 *
 * Blind to rules, which is the refusal a reader will most expect to be wrong
 * now that one of them writes a **caption**: `setText` is the first action whose
 * result would be visible on this canvas if anything ran it. Nothing does. A
 * rule destroys objects and starts scenes, so a preview would not animate the
 * document the way a tween does — it would demolish it, and there would be
 * nothing for a second press of ▶ to put back.
 *
 * And blind to a bound label, which is the seventh refusal and the one that
 * needs the least argument once it is said: a label follows its variable while
 * the *game* runs, and what the canvas draws is the value the document declares
 * — a still frame, the one the game opens on, exactly as the camera frame is
 * drawn and never applied. It cannot change here, so there is nothing for a ▶
 * to start or to stop.
 *
 * And blind to a rule's camera effects, which is the eighth refusal and the one
 * a reader will expect to be wrong hardest of all, since an effect is *nothing
 * but* a thing the camera does over time. Two refusals meet in it. The canvas
 * runs no rule, per the paragraph above. And the editor's `cameras.main` is the
 * **user's own view** of the scene — "drawn, never applied" — so a `pan` or a
 * `zoomTo` run here would move where the user is looking, which is exactly what
 * iteration 18 ruled out, and a `fade` would black out the canvas being edited.
 * There is nothing new drawn for one either: the violet frame is the shot the
 * scene *opens* on, and an effect is what happens after that.
 *
 * And blind to a `spawn`, which is the ninth refusal recorded here and the
 * eleventh this argument has made. It is also the one a reader will look
 * hardest for an addition in, because it is the first thing the document can
 * say that **makes an object** — and because, alone among the refusals above,
 * it now puts a mark on this canvas. But the mark is a place, not a thing:
 * `rulePointsOf` draws a ring where a prefab *will* be built and the canvas
 * builds nothing, so there is no second state for a ▶ to toggle between and
 * nothing moving by itself for it to stop. A spawn is "drawn, never run", the
 * body outline's and the camera frame's rule for the fourth time.
 *
 * And blind to a `setVelocity`, which is the tenth refusal recorded here and
 * the one a reader will be surest is wrong: it is the first thing this
 * document can say that puts a **body** in motion, where every refusal above
 * either redraws something or describes a thing a finger does. Two refusals
 * meet in it, which is iteration 31's shape. The canvas fires no rule, per the
 * paragraph above. And the canvas simulates no body at all — physics' own
 * first decision, made because a step does not merely animate the document, it
 * rewrites the numbers the document is made of. So there is nothing here for a
 * ▶ to start, and nothing it could stop. Nothing is drawn for one either, and
 * that is the one place this parts company with the spawn above: a spawn has a
 * *where*, which is the thing this canvas has always drawn, and a velocity is
 * a **rate** — the only honest picture of which is a body in motion.
 *
 * And blind to a `setPosition`, which is the spawn's case exactly: it has a
 * *where*, so `rulePointsOf` rings the destination and tethers it to the object,
 * and the canvas moves nothing — the object stays where the document puts it.
 * A mark is not a thing that moves by itself, so there is nothing for ▶ to stop.
 */
export function hasMotionIn(project: Project): boolean {
  if (project.animations.length > 0) return true;

  // A tween is the first *addition* this function has taken since the emitters,
  // where the four paragraphs above are all refusals — and it is the one thing
  // since them that plainly qualifies: under ▶ a tween moves an object across
  // the canvas by itself, which is exactly what the button exists to stop.
  // Read through `tweenOf` rather than testing `node.tween`, so a tween that
  // drives nothing does not put a button on the toolbar that stops nothing.
  const walk = (nodes: GameObjectNode[]): boolean =>
    nodes.some(
      (node) => node.type === 'particles' || tweenOf(node) !== null || walk(node.children),
    );

  return (
    project.scenes.some((scene) => walk(scene.children)) ||
    project.prefabs.some((prefab) => walk(prefab.children))
  );
}

/**
 * How many sprites in the whole project play a clip.
 *
 * Shown beside the clip's fields, because those fields are shared: an animation
 * belongs to the project rather than to the sprite whose panel is editing it,
 * so a frame rate changed here changes it everywhere. Saying so is cheaper than
 * the surprise.
 */
export function countAnimationUses(project: Project, animationId: string): number {
  let count = 0;
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'sprite' && node.props.animationId === animationId) count += 1;
      walk(node.children);
    }
  };
  for (const scene of project.scenes) walk(scene.children);
  return count;
}

/**
 * How many instances of a prefab the project holds.
 *
 * Shown beside the prefab's own controls for the reason the clip's count is:
 * the definition is shared, so an edit here is an edit everywhere, and saying
 * how many places that is costs less than the surprise. It is also what makes
 * "Delete prefab" honest about how much it is about to detach.
 */
export function countPrefabUses(project: Project, prefabId: string): number {
  let count = 0;
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'instance' && node.props.prefabId === prefabId) count += 1;
      walk(node.children);
    }
  };
  for (const scene of project.scenes) walk(scene.children);
  return count;
}

/**
 * How many rule actions across the project build this prefab.
 *
 * `countPrefabUses`' sibling, and it exists because that function's own comment
 * — "what makes 'Delete prefab' honest about how much it is about to detach" —
 * stopped being the whole truth the moment `removePrefab` also began stripping
 * spawn actions and dropping the rules they emptied. A count nobody is shown is
 * a press that quietly deletes a rule, which is precisely the hand-matched-list
 * failure this codebase keeps paying for.
 *
 * Read through `rulesOf` rather than `scene.rules`, so a spawn the reader has
 * already dropped is not counted as something about to be removed.
 */
export function countPrefabSpawns(project: Project, prefabId: string): number {
  let count = 0;
  for (const scene of project.scenes) {
    for (const rule of rulesOf(project, scene)) {
      for (const action of rule.do) {
        if (action.kind === 'spawn' && action.prefabId === prefabId) count += 1;
      }
    }
  }
  return count;
}

/** Every scene in the project, in document order. A stable array reference. */
export const useScenes = (): SceneDoc[] => useEditorStore((s) => s.project.scenes);

/** The prefab library. A stable array reference, so no `useShallow` is needed. */
export const usePrefabs = (): Prefab[] => useEditorStore((s) => s.project.prefabs);

/**
 * Every selected object, in document order and without anything already
 * covered by a selected group. This is the set the multi-object inspector
 * lists and the set every action on the selection acts on.
 */
export const useSelectionNodes = (): GameObjectNode[] =>
  useEditorStore(
    useShallow((state) => {
      const children = activeScene(state.project).children;
      return selectionRoots(children, state.selectedIds).flatMap(
        (id) => findNode(children, id) ?? [],
      );
    }),
  );
