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
 *
 * Scene `guides` deliberately did *not* bump it. The rule is "would a deployed
 * older build break on this file", and a v3 build does not: `parseProject`
 * passes `scenes` through verbatim, nothing in that build reads `scene.guides`,
 * so the file opens, draws identically, and even carries the guides back out on
 * a re-save. Guides change nothing about what is drawn for the objects — they
 * are the editor's own furniture that happens to be worth saving. Do not bump
 * this reflexively for the next field of that kind.
 *
 * v4 — sprite sheets and animations — is the other side of that same rule, and
 * it is worth spelling out because it looks superficially like guides did.
 * Neither `asset.sheet` nor `project.animations` crashes a v3 build. They do
 * something worse: `parseAssets` rebuilds every asset field by field and
 * `parseProject` names the project's fields one at a time, so a v3 build drops
 * both on open and writes the file back without them. The user's frame grids
 * and every animation they authored are gone, with nothing on screen having
 * said so — and the sheet a sprite was showing one frame of is suddenly drawn
 * whole. Guides survived an old build precisely because scenes are the one
 * thing passed through verbatim; these do not, so this bumps.
 *
 * v5 — prefabs — bumps for both halves of the rule at once, which is why it is
 * not a judgement call. `project.prefabs` is another field `parseProject` names
 * one at a time, so a v4 build drops the whole library on open and re-saves
 * without it; and an `instance` node is a type a v4 build has no
 * `createDisplayObject` case for, so it leaves the object undefined and
 * crashes, exactly as `container` did to v2. Either alone would bump this.
 */
export const SCHEMA_VERSION = 5;

/** The Phaser release this editor targets and will export code for. */
export const TARGET_PHASER_VERSION = '4.2.1';

/** Object kinds the editor can currently place. Grows one entry at a time. */
export type NodeType =
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'sprite'
  | 'container'
  | 'instance';

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
  /**
   * Absent on a plain image; present when the image is a grid of frames.
   *
   * The grid is a property of the *image*, not of any sprite drawing it: two
   * sprites showing different frames of one sheet are reading the same cuts,
   * and an animation is a list of indices that only means anything against
   * them. Recording it per sprite would let two of them disagree about how
   * many frames their own image has.
   */
  sheet?: FrameGrid;
}

/**
 * How an image is cut into equally sized frames.
 *
 * Exactly the four numbers Phaser's own sprite-sheet parser takes, under the
 * same names, so that `load.spritesheet` in the exported code is handed this
 * object more or less verbatim. Anything the editor could derive instead —
 * a frame count, a column count — is deliberately not stored: two fields over
 * one number is how they come to disagree, and `frameCountOf` computes it with
 * the parser's own arithmetic.
 */
export interface FrameGrid {
  frameWidth: number;
  frameHeight: number;
  /** Blank border around the whole sheet, in pixels. */
  margin: number;
  /** Gap between neighbouring frames, in pixels. */
  spacing: number;
}

/**
 * The asset's frame grid, but only when it can actually cut a frame out.
 *
 * The single reader of `asset.sheet`, for the reason `guidesOf` is the single
 * reader of `scene.guides`: a grid whose frames are wider than the image, or
 * zero pixels across, would divide by zero in `frameCountOf` and make Phaser's
 * parser warn and produce a texture with no frames in it. Answering "is this a
 * sheet" and "is this grid usable" with one call means no caller can check the
 * first and forget the second.
 */
export function frameGridOf(asset: ImageAsset | undefined): FrameGrid | null {
  const sheet = asset?.sheet;
  if (!sheet) return null;
  const usable =
    Number.isFinite(sheet.frameWidth) &&
    Number.isFinite(sheet.frameHeight) &&
    sheet.frameWidth > 0 &&
    sheet.frameHeight > 0 &&
    sheet.frameWidth <= asset.width &&
    sheet.frameHeight <= asset.height;
  return usable ? sheet : null;
}

/**
 * Columns and rows the grid cuts the image into.
 *
 * The arithmetic is copied from Phaser's `Textures.Parsers.SpriteSheet` —
 * margin subtracted once, spacing added back before the division — and it has
 * to stay copied. This is what the inspector's Frame field clamps against and
 * what "12 frames (4×3)" reports, so a formula of our own that rounded
 * differently would offer the user a frame the exported game does not have.
 *
 * A grid that yields nothing in one direction reports one, not zero: it is the
 * whole image, which is the plain-image answer and keeps every caller's
 * arithmetic free of a zero.
 */
export function frameLayoutOf(asset: ImageAsset): { columns: number; rows: number } {
  const sheet = frameGridOf(asset);
  if (!sheet) return { columns: 1, rows: 1 };
  const across = (span: number, frame: number) =>
    Math.max(1, Math.floor((span - sheet.margin + sheet.spacing) / (frame + sheet.spacing)));
  return {
    columns: across(asset.width, sheet.frameWidth),
    rows: across(asset.height, sheet.frameHeight),
  };
}

/**
 * How many frames the sheet cuts into — 1 for a plain image, which is exactly
 * what a single-frame texture is.
 */
export function frameCountOf(asset: ImageAsset | undefined): number {
  if (!asset) return 1;
  const { columns, rows } = frameLayoutOf(asset);
  return columns * rows;
}

/**
 * A frame index that certainly exists on the asset.
 *
 * A sprite keeps its frame number when its image is swapped for a smaller
 * sheet, and a hand-edited file can name any index at all — and Phaser's
 * `setFrame` on a frame that is not there warns and leaves the sprite on a
 * missing texture. Clamping in one place means neither the renderer nor the
 * exporter has to decide what an out-of-range frame means.
 */
export function clampFrame(asset: ImageAsset | undefined, frame: number): number {
  if (!Number.isFinite(frame)) return 0;
  return Math.min(Math.max(0, Math.floor(frame)), frameCountOf(asset) - 1);
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
  /**
   * Which frame of the asset's sheet to draw. Always 0 for a plain image,
   * which has exactly one frame — so this needs no "is it a sheet" branch
   * anywhere that reads it, only a `clampFrame`.
   */
  frame: number;
  /**
   * The clip this sprite plays, or null for a still frame.
   *
   * An id rather than the clip itself: several sprites play one animation, and
   * a copy per sprite would mean editing the frame rate in one place and not
   * in the other. It is also what keeps `frame` meaningful — the animation
   * owns the frame while it is playing, and this field is what the sprite
   * falls back to when it is not.
   */
  animationId: string | null;
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

/**
 * A placed copy of a prefab.
 *
 * It holds a reference and nothing else: the contents are read from
 * `project.prefabs` every time the node is drawn or exported, so a definition
 * edited once is edited everywhere, in every scene, with no propagation pass to
 * write and nothing that can drift out of step. That is the whole design — an
 * instance that stored its own copy of the children would be a duplicate with
 * extra bookkeeping.
 *
 * What it does own is what makes one placement different from another: its
 * transform, name and visibility, which live on the node like every other
 * node's, plus the alpha below, which multiplies down the subtree the way a
 * container's does.
 */
export interface InstanceProps {
  /** Null when the definition it named is gone; the canvas draws an empty box. */
  prefabId: string | null;
  alpha: number;
}

export interface NodePropsByType {
  rectangle: RectangleProps;
  ellipse: EllipseProps;
  text: TextProps;
  sprite: SpriteProps;
  container: ContainerProps;
  instance: InstanceProps;
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

/**
 * A line the user placed for things to line up on.
 *
 * Every other line an object can agree with is incidental — it is wherever some
 * other object happens to sit, or wherever the grid falls. A guide is the one
 * the user gets to author, which is why it is document state and saved with the
 * project rather than an editor preference like the grid pitch.
 *
 * `axis` is written out rather than imported as `bounds.ts`'s `Axis`: this
 * module has no imports at all, and the file format should not come to depend
 * on the measured-bounds cache. The two unions are identical, so they
 * interoperate with no cast.
 */
export interface SceneGuide {
  /** 'x' for a vertical line at a constant x, 'y' for a horizontal one. */
  axis: 'x' | 'y';
  position: number;
  /**
   * Its own identity, for the same reason a node has one: a guide is moved and
   * deleted individually, and an index does not survive undo rebuilding the
   * array.
   */
  id: string;
}

/**
 * A named sequence of frames from one sheet.
 *
 * Project-level, beside the assets and for the same reason: a clip is a way of
 * reading one image, so it belongs wherever that image does rather than in the
 * scene that happens to use it first. That is also what lets two scenes share
 * a "walk" without either owning it.
 *
 * The fields are Phaser's own, under Phaser's names, so `anims.create` in the
 * exported code is this object with the frames expanded.
 */
export interface AnimationClip {
  id: string;
  /**
   * Free text, and the animation key in exported code — so it goes through the
   * same de-duplication object names do rather than being trusted as unique.
   */
  name: string;
  /** The sheet the frame indices are read against. */
  assetId: string;
  /**
   * Frame indices in playback order. Free to repeat and to run backwards: a
   * ping-pong is `[0, 1, 2, 1]`, which is why this is a list rather than a
   * start and an end.
   */
  frames: number[];
  frameRate: number;
  /** Phaser's own: -1 loops forever, 0 plays once. */
  repeat: number;
}

export interface SceneDoc {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  children: GameObjectNode[];
  /**
   * Optional because every file written before guides existed has no such
   * array, and `parseProject` passes scenes through without reconstructing
   * them. Read it through `guidesOf`, never directly.
   */
  guides?: SceneGuide[];
}

/**
 * The scene's guides, defaulted and validated in one place.
 *
 * Scenes are the one part of an opened file that is not rebuilt field by field,
 * so this is where a hand-edited or truncated `guides` array is made safe —
 * `parseAssets` does the same job for the asset table. Being the only reader
 * means no call site has to write `?? []` or wonder whether `position` is a
 * number.
 */
export function guidesOf(scene: SceneDoc): SceneGuide[] {
  if (!Array.isArray(scene.guides)) return [];
  return scene.guides.filter(
    (guide): guide is SceneGuide =>
      typeof guide === 'object' &&
      guide !== null &&
      typeof (guide as SceneGuide).id === 'string' &&
      ((guide as SceneGuide).axis === 'x' || (guide as SceneGuide).axis === 'y') &&
      Number.isFinite((guide as SceneGuide).position),
  );
}

/**
 * A reusable object graph, named and stored once for the whole project.
 *
 * Project-level for the reason the animations are: a prefab is a thing the
 * project knows how to build, not something a scene owns, and two scenes share
 * one without either being the owner. What a scene holds is an `instance` node
 * pointing at this by id.
 *
 * `children` is a list rather than a single root node so that "these three
 * things" is expressible without inventing a wrapper the user did not ask for.
 * An instance draws them inside its own container, which is where the grouping
 * actually comes from.
 */
export interface Prefab {
  id: string;
  /**
   * Free text, and the factory function's name in exported code — so it goes
   * through the same `toIdentifier` de-duplication object names do rather than
   * being trusted to be a usable identifier, or to be unique.
   */
  name: string;
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
  /**
   * Animations, shared across every scene exactly as the assets they read are.
   *
   * A separate table rather than a field on the asset because a clip is
   * removed, renamed and re-pointed on its own, and because the exporter emits
   * only the clips a scene actually plays — which is a filter over a list, not
   * a walk into every asset.
   */
  animations: AnimationClip[];
  /**
   * Prefab definitions, shared across every scene as the assets and clips are.
   *
   * The single copy is the point: an `instance` node in a scene stores only an
   * id into this table, so editing an entry here changes every placement of it
   * everywhere at once. Nothing propagates, because nothing was ever copied.
   */
  prefabs: Prefab[];
  scenes: SceneDoc[];
  activeSceneId: string;
}

export function findAsset(
  project: Project,
  id: string | null | undefined,
): ImageAsset | undefined {
  return id ? project.assets.find((asset) => asset.id === id) : undefined;
}

export function findAnimation(
  project: Project,
  id: string | null | undefined,
): AnimationClip | undefined {
  return id ? project.animations.find((clip) => clip.id === id) : undefined;
}

export function findPrefab(
  project: Project,
  id: string | null | undefined,
): Prefab | undefined {
  return id ? project.prefabs.find((prefab) => prefab.id === id) : undefined;
}

/** Whether this subtree places a prefab anywhere inside it. */
export function containsInstance(nodes: GameObjectNode[]): boolean {
  return nodes.some(
    (node) => node.type === 'instance' || containsInstance(node.children),
  );
}

/**
 * The children an instance node draws, or an empty list.
 *
 * The only place `InstanceProps.prefabId` is ever dereferenced — the job
 * `guidesOf` does for a scene's guides and `frameGridOf` does for an asset's
 * sheet. Being the single reader means no caller can check "is the prefab
 * there" and forget "are its children an array", and the dangling case has one
 * answer instead of one per call site.
 *
 * A missing definition draws an empty instance rather than throwing, the
 * treatment a sprite whose image is gone already gets: one unreadable reference
 * should not cost the user the rest of the scene.
 *
 * **It also strips any instance out of what it returns, recursively, and that
 * is the whole of the cycle story.** A prefab containing an instance of itself
 * is two id strings and an infinite recursion in the renderer and the exporter
 * both, and a hand-edited file can hold one whatever the store refuses to
 * build. Answering with a tree that contains no instances at all means nothing
 * downstream needs a depth cap, a visited set or a termination argument — the
 * recursion is finite because the data handed to it is. The store refuses to
 * *create* a nested definition for the same reason, so this only ever fires on
 * a file the editor did not write.
 *
 * The definition's own array comes back by identity when there was nothing to
 * strip, which is every sync of every well-formed project.
 */
export function prefabChildrenOf(
  project: Project,
  node: GameObjectNode,
): GameObjectNode[] {
  if (node.type !== 'instance') return [];
  const prefab = findPrefab(project, node.props.prefabId);
  if (!Array.isArray(prefab?.children)) return [];
  return withoutInstances(prefab.children);
}

function withoutInstances(nodes: GameObjectNode[]): GameObjectNode[] {
  if (!containsInstance(nodes)) return nodes;
  return nodes
    .filter((node) => node.type !== 'instance')
    .map((node) => ({ ...node, children: withoutInstances(node.children) }));
}

/** The clips that read a given sheet, which is what a sprite may choose from. */
export function animationsForAsset(
  project: Project,
  assetId: string | null | undefined,
): AnimationClip[] {
  return assetId ? project.animations.filter((clip) => clip.assetId === assetId) : [];
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
