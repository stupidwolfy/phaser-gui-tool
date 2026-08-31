import { create } from 'zustand';
import { createNode, newProject } from './defaults';
import {
  findNode,
  type GameObjectNode,
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

  // -- document lifecycle ----------------------------------------------------
  loadProject: (project: Project, fileName: string | null) => void;
  resetProject: () => void;
  markSaved: (fileName: string) => void;
  renameProject: (name: string) => void;

  // -- selection -------------------------------------------------------------
  select: (id: string | null) => void;

  // -- editing ---------------------------------------------------------------
  addNode: (type: NodeType) => void;
  deleteNode: (id: string) => void;
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

export function activeScene(project: Project): SceneDoc {
  return (
    project.scenes.find((scene) => scene.id === project.activeSceneId) ??
    project.scenes[0]
  );
}

export const useEditorStore = create<EditorState>((set, get) => {
  /**
   * Applies `fn` to the active scene and records an undo step (unless we are
   * inside a transaction). Every editing action goes through here, so history
   * and the dirty flag can never drift out of sync with the document.
   */
  const editScene = (fn: (scene: SceneDoc) => SceneDoc) => {
    const state = get();
    const current = activeScene(state.project);
    const next = fn(current);
    if (next === current) return;

    const project: Project = {
      ...state.project,
      scenes: state.project.scenes.map((scene) =>
        scene.id === current.id ? next : scene,
      ),
    };

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

  return {
    project: newProject(),
    selectedId: null,
    fileName: null,
    dirty: false,
    past: [],
    future: [],
    txDepth: 0,

    loadProject: (project, fileName) =>
      set({
        project,
        fileName,
        selectedId: null,
        dirty: false,
        past: [],
        future: [],
        txDepth: 0,
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
      }),

    markSaved: (fileName) => set({ fileName, dirty: false }),

    renameProject: (name) =>
      set((state) => ({ project: { ...state.project, name }, dirty: true })),

    select: (id) => set({ selectedId: id }),

    addNode: (type) => {
      const scene = activeScene(get().project);
      // Drop new objects at the scene centre rather than 0,0, which on a
      // top-left origin would put them half off-canvas.
      const node = createNode(type, Math.round(scene.width / 2), Math.round(scene.height / 2));
      editScene((s) => ({ ...s, children: [...s.children, node] }));
      set({ selectedId: node.id });
    },

    deleteNode: (id) => {
      editScene((scene) => ({ ...scene, children: removeNode(scene.children, id) }));
      if (get().selectedId === id) set({ selectedId: null });
    },

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

export const useSelectedNode = (): GameObjectNode | null =>
  useEditorStore((state) =>
    state.selectedId
      ? (findNode(activeScene(state.project).children, state.selectedId) ?? null)
      : null,
  );
