/**
 * The project document.
 *
 * This is the single source of truth for the whole editor: React renders it,
 * Phaser draws it, and `JSON.stringify` of it is exactly what the user saves to
 * their device. Nothing about the editor's live state lives anywhere else.
 *
 * It is deliberately small right now. The shape — a tree of nodes, each with a
 * `type` discriminator, a shared `transform`, and a per-type `props` bag — is
 * what lets later iterations add sprites, tilemaps, particles and the rest
 * without a format break.
 */

/** Bumped whenever a change to these types is not backwards compatible. */
export const SCHEMA_VERSION = 1;

/** The Phaser release this editor targets and will export code for. */
export const TARGET_PHASER_VERSION = '4.2.1';

/** Object kinds the editor can currently place. Grows one entry at a time. */
export type NodeType = 'rectangle' | 'ellipse' | 'text';

export interface Transform {
  x: number;
  y: number;
  rotation: number; // degrees, matching what the inspector shows
  scaleX: number;
  scaleY: number;
}

export interface RectangleProps {
  width: number;
  height: number;
  fill: string; // '#rrggbb'
  alpha: number; // 0..1
}

export interface EllipseProps {
  width: number;
  height: number;
  fill: string;
  alpha: number;
}

export interface TextProps {
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  alpha: number;
}

export interface NodePropsByType {
  rectangle: RectangleProps;
  ellipse: EllipseProps;
  text: TextProps;
}

/**
 * One object in a scene. Modelled as a discriminated union so that
 * `node.type === 'text'` narrows `node.props` to `TextProps` — adding a node
 * kind then makes every unhandled `switch` a compile error, which is the point.
 */
export type GameObjectNode = {
  [K in NodeType]: {
    id: string;
    name: string;
    type: K;
    visible: boolean;
    transform: Transform;
    props: NodePropsByType[K];
    /** Reserved for containers. Always present so traversal never branches. */
    children: GameObjectNode[];
  };
}[NodeType];

export interface SceneDoc {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  children: GameObjectNode[];
}

export interface Project {
  schemaVersion: number;
  name: string;
  /** Recorded so a future exporter can tell which Phaser API to emit. */
  phaserVersion: string;
  scenes: SceneDoc[];
  activeSceneId: string;
}

export const newId = (): string =>
  // randomUUID needs a secure context; file:// and some in-app browsers lack it.
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function findNode(
  nodes: GameObjectNode[],
  id: string,
): GameObjectNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Depth-first flatten, used by the scene tree and by the Phaser sync diff. */
export function flattenNodes(nodes: GameObjectNode[]): GameObjectNode[] {
  const out: GameObjectNode[] = [];
  const walk = (list: GameObjectNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
