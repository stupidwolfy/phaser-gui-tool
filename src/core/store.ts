import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  DEFAULT_FRAME_RATE,
  cloneWithNewIds,
  createInstanceNode,
  createNode,
  createScene,
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
  canHavePhysics,
  clampFrame,
  composeTransform,
  containsInstance,
  containsNode,
  findAsset,
  findNode,
  findParent,
  findPrefab,
  frameCountOf,
  frameGridOf,
  guidesOf,
  localTransformIn,
  newId,
  physicsOf,
  prefabChildrenOf,
  soundsOf,
  worldTransformOf,
  type AnimationClip,
  type AudioAsset,
  type FrameGrid,
  type GameObjectNode,
  type ImageAsset,
  EMPTY_TILE,
  MAX_TILEMAP_SIDE,
  tileMapOf,
  type NodeType,
  type PhysicsBody,
  type Prefab,
  type Project,
  type SceneDoc,
  type SceneSound,
  type SpriteProps,
  type TileCell,
  type TileMap,
  type TilemapProps,
  type Transform,
} from './schema';

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
  /** The tile the brush lays. An index into the tileset, like a sprite frame. */
  brushTile: number;
  /** Whether the brush clears instead, which is laying `EMPTY_TILE`. */
  erasing: boolean;
  setPainting: (nodeId: string | null) => void;
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
   * Creates a clip over every frame of the sprite's sheet and plays it on that
   * sprite, in one step. There is no bare `addAnimation`: a clip nothing plays
   * cannot be seen, so creating one and assigning it are the same act.
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
   * wholesale is how a second, undocumented way to edit them appears.
   */
  updateScene: (patch: Partial<Omit<SceneDoc, 'children' | 'id' | 'guides'>>) => void;

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
  paintTiles: (nodeId: string, cells: TileCell[], tile: number) => void;
  /** Every cell at once, in one step. */
  fillTiles: (nodeId: string, tile: number) => void;
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
    const props = patch(tileMapOf(project, node.props));
    if (!props) return scene;
    return {
      ...scene,
      children: mapNode(
        scene.children,
        nodeId,
        (current) => ({ ...current, props: { ...current.props, ...props } }) as GameObjectNode,
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
    set({
      project,
      dirty: true,
      selectedIds: pruneIds(children, state.selectedIds, (id) => id),
      moveOrigins: pruneIds(children, state.moveOrigins, (origin) => origin.id),
      paintingId: prunePainting(children, state.paintingId),
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
    const moves = [...deltasFor(boxes)].flatMap(([id, { dx, dy }]) => {
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
    paintingId: null,
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
    setPreviewMotion: (previewMotion) => set({ previewMotion }),

    setPainting: (paintingId) => set({ paintingId }),
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
            if (node.type === 'sprite') {
              if (node.props.assetId === id) {
                return {
                  ...node,
                  props: { ...node.props, assetId: null, frame: 0, animationId: null },
                };
              }
              if (node.props.animationId && orphaned.has(node.props.animationId)) {
                return { ...node, props: { ...node.props, animationId: null } };
              }
              return null;
            }
            if (node.type === 'particles' && node.props.assetId === id) {
              return { ...node, props: { ...node.props, assetId: null, frame: 0 } };
            }
            if (node.type === 'tilemap' && node.props.assetId === id) {
              return { ...node, props: { ...node.props, assetId: null } };
            }
            return null;
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

        // Clips are indices into a grid, so re-cutting one can leave a clip
        // naming frames that no longer exist, and un-cutting removes the grid
        // they were indices into at all. Dropping the clips outright on a
        // re-cut would throw away a walk cycle over a one-pixel margin
        // correction, so they are clamped instead, and only an un-cut — where
        // there is no longer a sequence to clamp to — removes them.
        const count = frameCountOf(next);
        const removed = new Set(
          sheet
            ? []
            : project.animations.filter((clip) => clip.assetId === assetId).map((c) => c.id),
        );
        const animations = project.animations.flatMap((clip) => {
          if (clip.assetId !== assetId) return clip;
          if (removed.has(clip.id)) return [];
          const frames = [...new Set(clip.frames.map((frame) => Math.min(frame, count - 1)))];
          return { ...clip, frames };
        });

        // An emitter indexes the same grid a sprite does — `frameCountOf` is a
        // property of the image, which is the whole point of the grid living
        // on the asset — so its frame is clamped by the same call, in the same
        // traversal, and for the same reason.
        return mapProjectNodes(
          {
            ...project,
            assets: project.assets.map((entry) => (entry.id === assetId ? next : entry)),
            animations,
          },
          (node) => {
            if (node.type === 'sprite') {
              if (node.props.assetId !== assetId) return null;
              const frame = clampFrame(next, node.props.frame);
              const animationId =
                node.props.animationId && removed.has(node.props.animationId)
                  ? null
                  : node.props.animationId;
              return frame === node.props.frame && animationId === node.props.animationId
                ? null
                : { ...node, props: { ...node.props, frame, animationId } };
            }
            if (node.type === 'particles') {
              if (node.props.assetId !== assetId) return null;
              const frame = clampFrame(next, node.props.frame);
              return frame === node.props.frame
                ? null
                : { ...node, props: { ...node.props, frame } };
            }
            return null;
          },
        );
      }),

    addAnimationFor: (nodeId) => {
      const state = get();
      const node = findNode(activeScene(state.project).children, nodeId);
      if (!node || node.type !== 'sprite' || !node.props.assetId) return;
      const asset = findAsset(state.project, node.props.assetId);
      // Only a sheet has a sequence to animate. A plain image is one frame, and
      // a one-frame animation is a still picture with a frame rate.
      if (!asset || !frameGridOf(asset)) return;

      const clip: AnimationClip = {
        id: newId(),
        name: uniqueAnimationName(state.project, 'Animation'),
        assetId: asset.id,
        // Every frame, in order: the sheet the user has just cut is almost
        // always exactly the sequence they cut it for, and trimming it is far
        // easier than typing it out.
        frames: Array.from({ length: frameCountOf(asset) }, (_, index) => index),
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

        const count = frameCountOf(findAsset(project, clip.assetId));
        const frames = patch.frames
          ?.filter((frame) => Number.isFinite(frame) && frame >= 0 && frame < count)
          .map((frame) => Math.floor(frame));
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
        return {
          ...detached,
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

      // One undo step for the whole selection, nested inside whatever
      // transaction the caller has open for the key press itself.
      state.beginTransaction();
      for (const id of ids) {
        const node = findNode(children, id);
        if (!node) continue;
        state.updateTransform(id, worldMovePatch(children, node, dx, dy));
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

    paintTiles: (nodeId, cells, tile) =>
      editProject((project) =>
        editTilemapProps(project, nodeId, (map) => {
          const value = tile < 0 || tile >= map.tileCount ? EMPTY_TILE : Math.floor(tile);
          // Copied on the first cell that actually changes and not before, so a
          // stroke that repaints what is already there allocates nothing and
          // records no undo step.
          let data: number[] | null = null;
          for (const { column, row } of cells) {
            if (column < 0 || row < 0 || column >= map.columns || row >= map.rows) continue;
            const index = row * map.columns + column;
            if ((data ?? map.data)[index] === value) continue;
            data ??= [...map.data];
            data[index] = value;
          }
          return data ? { data } : null;
        }),
      ),

    fillTiles: (nodeId, tile) =>
      editProject((project) =>
        editTilemapProps(project, nodeId, (map) => {
          const value = tile < 0 || tile >= map.tileCount ? EMPTY_TILE : Math.floor(tile);
          if (map.data.every((current) => current === value)) return null;
          return { data: map.data.map(() => value) };
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
          const data = Array.from({ length: nextColumns * nextRows }, (_, index) => {
            const column = index % nextColumns;
            const row = Math.floor(index / nextColumns);
            return column < map.columns && row < map.rows
              ? map.data[row * map.columns + column]
              : EMPTY_TILE;
          });
          return { columns: nextColumns, rows: nextRows, data };
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
      // A tilemap uses its tileset and an emitter its particle texture exactly
      // as a sprite uses its image, and the count is what the removal warning
      // says out loud — so leaving either out would under-report by a whole
      // object type.
      if (
        (node.type === 'sprite' ||
          node.type === 'tilemap' ||
          node.type === 'particles') &&
        node.props.assetId === assetId
      ) {
        count += 1;
      }
      walk(node.children);
    }
  };
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
 * Whether anything in the project moves by itself — an animation clip, or a
 * particle emitter anywhere in it.
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
 */
export function hasMotionIn(project: Project): boolean {
  if (project.animations.length > 0) return true;

  const walk = (nodes: GameObjectNode[]): boolean =>
    nodes.some((node) => node.type === 'particles' || walk(node.children));

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
