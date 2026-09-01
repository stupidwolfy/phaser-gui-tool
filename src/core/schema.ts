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

/**
 * Bumped whenever a change to these types is not backwards compatible.
 *
 * v2 added `sprite` and the project-level `assets` table. v3 made `children`
 * load-bearing: a `container` node nests other nodes, and every node's position
 * is now relative to its parent rather than to the scene.
 *
 * Files written by an older version still read fine here — a v2 file simply has
 * no containers and an all-empty `children` — but the bump is about the other
 * direction. A v2 build has no `container` case anywhere: its
 * `createDisplayObject` leaves the object undefined and its renderer crashes,
 * and its scene tree would silently drop every nested node. The version check
 * turns both into the "made with a newer version" message.
 */
export const SCHEMA_VERSION = 3;

/** The Phaser release this editor targets and will export code for. */
export const TARGET_PHASER_VERSION = '4.2.1';

/** Object kinds the editor can currently place. Grows one entry at a time. */
export type NodeType = 'rectangle' | 'ellipse' | 'text' | 'sprite' | 'container';

/**
 * An imported image, held in the document as a data URL.
 *
 * Storing the bytes rather than a path is what keeps `JSON.stringify(project)`
 * a complete save: a project file that referenced `player.png` on disk would
 * break the moment it was moved or shared, and there is no server here to hold
 * the file instead. The cost is file size, which `importImageFile` bounds.
 *
 * `width`/`height` are the image's intrinsic pixel size, recorded at import so
 * that nothing downstream has to wait on a decode to lay a sprite out.
 */
export interface ImageAsset {
  id: string;
  /** The file name it was imported from, which is what the picker shows. */
  name: string;
  /** Always 'image/png' or 'image/jpeg' — import re-encodes to one of the two. */
  mimeType: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * A node's transform is relative to its parent, exactly as Phaser treats a
 * Container's children — the scene itself is the parent of a top-level node, so
 * for those it still reads as scene coordinates.
 */
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

/**
 * A sprite has no width or height of its own: its size is the asset's intrinsic
 * size times the shared transform scale, exactly as Phaser treats an Image.
 * Carrying a separate display size would mean two fields fighting over one
 * number, since Phaser's `setDisplaySize` is itself just a scale.
 */
export interface SpriteProps {
  /** Null until an image is chosen; the canvas draws a placeholder until then. */
  assetId: string | null;
  alpha: number;
  /** '#ffffff' means untinted, and exports as no `setTint` call at all. */
  tint: string;
  flipX: boolean;
  flipY: boolean;
}

/**
 * A container groups other nodes: moving, rotating or scaling it moves its whole
 * subtree, and `children` is its content.
 *
 * It has no size of its own — a Phaser Container is a transform with a display
 * list, and its bounds are whatever its children occupy. Alpha is the one thing
 * worth setting on the group as a whole, and it multiplies down the tree the
 * way Phaser's does.
 */
export interface ContainerProps {
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
  sprite: SpriteProps;
  container: ContainerProps;
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
    /**
     * Nested nodes, positioned relative to this one. Only a `container`
     * renders them, but the array is present on every node so that traversal,
     * cloning and the parser never have to branch on the type.
     */
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
  /**
   * Images, shared across every scene. Project-level rather than per-scene so
   * that one import can back sprites in several scenes without duplicating the
   * bytes — the single largest thing in the file.
   */
  assets: ImageAsset[];
  scenes: SceneDoc[];
  activeSceneId: string;
}

export function findAsset(
  project: Project,
  id: string | null | undefined,
): ImageAsset | undefined {
  return id ? project.assets.find((asset) => asset.id === id) : undefined;
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

/**
 * The node holding `id`, or null when it sits at the top level of the scene.
 *
 * Null therefore also covers "no such node", which every caller here wants:
 * both cases mean "no parent to compose against".
 */
export function findParent(
  nodes: GameObjectNode[],
  id: string,
  parent: GameObjectNode | null = null,
): GameObjectNode | null {
  for (const node of nodes) {
    if (node.id === id) return parent;
    const hit = findParent(node.children, id, node);
    if (hit) return hit;
  }
  return null;
}

/**
 * The array `id` lives in — its parent's children, or the scene's own list.
 *
 * Draw order is array order at every level, so this is what raise, lower and
 * the tree's drag-to-reorder all work against.
 */
export function siblingsOf(root: GameObjectNode[], id: string): GameObjectNode[] {
  const parent = findParent(root, id);
  return parent ? parent.children : root;
}

/** True when `id` is `node` itself or anywhere beneath it. */
export function containsNode(node: GameObjectNode, id: string): boolean {
  return node.id === id || node.children.some((child) => containsNode(child, id));
}

/**
 * The transform a child of `parent` is composed against: position, rotation and
 * scale accumulated from the scene down.
 *
 * Phaser composes a Container's transform onto its children the same way, so
 * this is what lets the editor convert between a node's local coordinates and
 * where it actually is on the canvas.
 */
export function worldTransformOf(
  nodes: GameObjectNode[],
  id: string | null,
): Transform {
  if (!id) return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  const parent = findParent(nodes, id);
  const node = findNode(nodes, id);
  if (!node) return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  return composeTransform(worldTransformOf(nodes, parent?.id ?? null), node.transform);
}

/** Applies a parent transform to a local one, giving the world transform. */
export function composeTransform(parent: Transform, local: Transform): Transform {
  const angle = (parent.rotation * Math.PI) / 180;
  const x = local.x * parent.scaleX;
  const y = local.y * parent.scaleY;
  return {
    x: parent.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: parent.y + x * Math.sin(angle) + y * Math.cos(angle),
    rotation: parent.rotation + local.rotation,
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY,
  };
}

/**
 * The inverse: the local transform a node needs under `parent` to stay exactly
 * where it is now. This is what keeps an object still on the canvas when it is
 * dragged into or out of a container.
 *
 * A parent that is both rotated and scaled unevenly composes a skew, which
 * neither this nor Phaser's own transform can represent; the position is still
 * exact and only the child's apparent proportions shift.
 */
export function localTransformIn(parent: Transform, world: Transform): Transform {
  const angle = (-parent.rotation * Math.PI) / 180;
  const dx = world.x - parent.x;
  const dy = world.y - parent.y;
  // A zero-scaled parent has collapsed its children to a point; there is no
  // local position that undoes that, so fall back to the parent's origin.
  const scaleX = parent.scaleX || 1;
  const scaleY = parent.scaleY || 1;
  return {
    x: (dx * Math.cos(angle) - dy * Math.sin(angle)) / scaleX,
    y: (dx * Math.sin(angle) + dy * Math.cos(angle)) / scaleY,
    rotation: world.rotation - parent.rotation,
    scaleX: world.scaleX / scaleX,
    scaleY: world.scaleY / scaleY,
  };
}
