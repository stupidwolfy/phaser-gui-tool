import { create } from 'zustand';
import { cloneWithNewIds, createNode, newProject } from './defaults';
import {
  findNode,
  type GameObjectNode,
  type ImageAsset,
  type NodeType,
  type Project,
  type SceneDoc,
  type Transform,
} from './schema';

const HISTORY_LIMIT = 100;

export interface EditorState {
  project: Project;
  selectedId: string | null;
  /** Name of the file on disk, once saved or opened. Drives the title bar. */
  fileName: string | null;
  /** True when there are changes not yet written to a file. */
  dirty: boolean;

  past: Project[];
  future: Project[];
  /** Depth of nested transactions; >0 means "don't record intermediate steps". */
  txDepth: number;
  /**
   * The selected node's transform as it was when it was selected, so the mobile
   * move bar's cancel button can put it back where it started.
   */
  moveOrigin: { id: string; transform: Transform } | null;
  /**
   * Copied node, kept outside the document so it survives undo, redo and
   * opening another file. Paste offsets from it and writes the result back, so
   * pasting repeatedly cascades instead of stacking copies on one spot.
   */
  clipboard: GameObjectNode | null;
  /**
   * Whether scaling keeps the object's aspect ratio. Editor state, not document
   * state: it is a preference about the tool, like `selectedId`, and two people
   * opening the same file should not disagree about the shape of its objects.
   *
   * On by default — a non-uniform scale is almost always a slip rather than an
   * intent, and it is the corner handle's normal behaviour everywhere else.
   */
  lockAspect: boolean;
  setLockAspect: (lockAspect: boolean) => void;
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
  select: (id: string | null) => void;
  /** Mobile move bar: put the node back where it was when selected. */
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
  addNode: (type: NodeType) => void;
  deleteNode: (id: string) => void;
  /** Copies the node, its style and its subtree, one step above the original. */
  duplicateNode: (id: string) => void;
  copyNode: (id: string) => void;
  pasteNode: () => void;
  /**
   * Moves a top-level node to `toIndex`, clamped. Array order *is* draw order —
   * the Phaser sync sets each object's depth from its index — so this is the
   * whole of raise, lower, bring to front and send to back.
   */
  reorderNode: (id: string, toIndex: number) => void;
  renameNode: (id: string, name: string) => void;
  setNodeVisible: (id: string, visible: boolean) => void;
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

    const recordHistory = state.txDepth === 0;
    set({
      project,
      dirty: true,
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

  return {
    project: newProject(),
    selectedId: null,
    fileName: null,
    dirty: false,
    past: [],
    future: [],
    txDepth: 0,
    moveOrigin: null,
    clipboard: null,
    lockAspect: true,

    setLockAspect: (lockAspect) => set({ lockAspect }),

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
        selectedId: null,
        dirty: false,
        past: [],
        future: [],
        txDepth: 0,
        moveOrigin: null,
      }),

    resetProject: () =>
      set({
        project: newProject(),
        fileName: null,
        selectedId: null,
        dirty: false,
        past: [],
        future: [],
        txDepth: 0,
        moveOrigin: null,
      }),

    markSaved: (fileName) => set({ fileName, dirty: false }),

    renameProject: (name) =>
      set((state) => ({ project: { ...state.project, name }, dirty: true })),

    select: (id) =>
      set((state) => {
        const node = id ? findNode(activeScene(state.project).children, id) : null;
        return {
          selectedId: id,
          moveOrigin: node ? { id: node.id, transform: { ...node.transform } } : null,
        };
      }),

    cancelMove: () => {
      const { moveOrigin } = get();
      if (!moveOrigin) return;
      // Applied as an ordinary edit rather than a history rewind, so cancelling
      // is itself undoable and can't strand the user mid-stack.
      get().updateTransform(moveOrigin.id, moveOrigin.transform);
      set({ selectedId: null, moveOrigin: null });
    },

    commitMove: () => set({ selectedId: null, moveOrigin: null }),

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
      const scene = activeScene(get().project);
      // Drop new objects at the scene centre rather than 0,0, which on a
      // top-left origin would put them half off-canvas.
      const node = createNode(type, Math.round(scene.width / 2), Math.round(scene.height / 2));
      editScene((s) => ({ ...s, children: [...s.children, node] }));
      get().select(node.id);
    },

    deleteNode: (id) => {
      editScene((scene) => ({ ...scene, children: removeNode(scene.children, id) }));
      if (get().selectedId === id) set({ selectedId: null, moveOrigin: null });
    },

    duplicateNode: (id) => {
      const children = activeScene(get().project).children;
      const index = children.findIndex((node) => node.id === id);
      if (index === -1) return;
      const copy = offsetCopy(children[index]);
      editScene((scene) => ({
        ...scene,
        // Directly after the original, so the copy sits one step in front of
        // what it was copied from rather than jumping to the top of the scene.
        children: [
          ...scene.children.slice(0, index + 1),
          copy,
          ...scene.children.slice(index + 1),
        ],
      }));
      get().select(copy.id);
    },

    copyNode: (id) => {
      const node = findNode(activeScene(get().project).children, id);
      if (node) set({ clipboard: node });
    },

    pasteNode: () => {
      const { clipboard } = get();
      if (!clipboard) return;
      const copy = offsetCopy(clipboard);
      editScene((scene) => ({ ...scene, children: [...scene.children, copy] }));
      // Cascade: the next paste offsets from where this one landed.
      set({ clipboard: copy });
      get().select(copy.id);
    },

    reorderNode: (id, toIndex) =>
      editScene((scene) => {
        const from = scene.children.findIndex((node) => node.id === id);
        if (from === -1) return scene;
        const to = Math.max(0, Math.min(scene.children.length - 1, toIndex));
        if (to === from) return scene;
        const children = scene.children.slice();
        const [node] = children.splice(from, 1);
        children.splice(to, 0, node);
        return { ...scene, children };
      }),

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
        selectedId:
          state.selectedId && findNode(activeScene(previous).children, state.selectedId)
            ? state.selectedId
            : null,
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
        selectedId:
          state.selectedId && findNode(activeScene(next).children, state.selectedId)
            ? state.selectedId
            : null,
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

export const useSelectedNode = (): GameObjectNode | null =>
  useEditorStore((state) =>
    state.selectedId
      ? (findNode(activeScene(state.project).children, state.selectedId) ?? null)
      : null,
  );
