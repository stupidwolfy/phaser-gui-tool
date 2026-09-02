import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { cloneWithNewIds, createNode, newProject } from './defaults';
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
  composeTransform,
  containsNode,
  findNode,
  findParent,
  localTransformIn,
  worldTransformOf,
  type GameObjectNode,
  type ImageAsset,
  type NodeType,
  type Project,
  type SceneDoc,
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
  /** Spaces the selection evenly along one axis, by centres. Needs three. */
  distributeSelection: (axis: Axis) => void;
  updateTransform: (id: string, patch: Partial<Transform>) => void;
  updateProps: (id: string, patch: Record<string, unknown>) => void;
  updateScene: (patch: Partial<Omit<SceneDoc, 'children' | 'id'>>) => void;

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

/** Points every sprite using `assetId` back at nothing. See `removeAsset`. */
function clearAssetReferences(nodes: GameObjectNode[], assetId: string): GameObjectNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    const children =
      node.children.length === 0 ? node.children : clearAssetReferences(node.children, assetId);
    if (node.type === 'sprite' && node.props.assetId === assetId) {
      changed = true;
      return { ...node, props: { ...node.props, assetId: null }, children };
    }
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  // Identity is the signal editProject reads for "nothing happened", so an
  // untouched branch has to come back as the very same array.
  return changed ? next : nodes;
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
      past: recordHistory
        ? [...state.past, state.project].slice(-HISTORY_LIMIT)
        : state.past,
      future: recordHistory ? [] : state.future,
    });
  };

  /** The same, narrowed to the scene the user is looking at. */
  const editScene = (fn: (scene: SceneDoc) => SceneDoc) =>
    editProject((project) => {
      const current = activeScene(project);
      const next = fn(current);
      if (next === current) return project;
      return {
        ...project,
        scenes: project.scenes.map((scene) => (scene.id === current.id ? next : scene)),
      };
    });

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
      }),

    markSaved: (fileName) => set({ fileName, dirty: false }),

    renameProject: (name) =>
      set((state) => ({ project: { ...state.project, name }, dirty: true })),

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
      editProject((project) => ({
        ...project,
        assets: project.assets.filter((asset) => asset.id !== id),
        scenes: project.scenes.map((scene) => ({
          ...scene,
          children: clearAssetReferences(scene.children, id),
        })),
      })),

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
      if (node.type === 'sprite' && node.props.assetId === assetId) count += 1;
      walk(node.children);
    }
  };
  for (const scene of project.scenes) walk(scene.children);
  return count;
}

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
