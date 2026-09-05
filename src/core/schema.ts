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
 *
 * v6 — tilemaps — bumps on that same crash half, and only on it. A `tilemap` is
 * a node type a v5 build has no `createDisplayObject` case for, so it leaves the
 * object undefined and its renderer crashes. Nothing else about the feature
 * needs it: a tileset is an ordinary sliced image, which v4 already reads, and
 * the node's own props ride in on `scenes`, the one part of a file
 * `parseProject` passes through verbatim — so there is no field an older build
 * would silently drop and re-save without. The crash alone is enough, and it is
 * not a judgement call.
 *
 * v7 — particles — is the same crash half again, and only that half. A v6 build
 * has no `'particles'` case in `createDisplayObject`, so it leaves the object
 * undefined and its renderer crashes, exactly as `tilemap` did to v5 and
 * `instance` to v4. Nothing else about the feature needs it: a particle texture
 * is an ordinary image, sliced or not, which v2 already reads, and the emitter's
 * own settings ride in on `scenes` — verbatim, again.
 *
 * Physics bodies did *not* bump it, and this is the guides case rather than any
 * of the four crash cases above. A body is not a node type: it is an optional
 * field on a node and an optional field on a scene, and both of those ride in
 * on `scenes`, which `parseProject` passes through verbatim. A v7 build has a
 * `createDisplayObject` case for every type in the file, reads `node.physics`
 * nowhere, draws the scene identically, and carries both fields back out on a
 * re-save. Nothing is dropped and nothing is undefined. **This stays contingent
 * on `parseProject` not reconstructing the scenes field by field**, exactly as
 * the guides decision is — if it ever starts to, an old build silently loses
 * every body on every save, which is data loss with no crash. `physics.spec.ts`
 * asserts the current version in the saved artefact so a future bump is a
 * deliberate act.
 *
 * v8 — audio — is the *other* half of the rule, and the first bump since v4 to
 * turn on it rather than on a crash. There is no new node type, so a v7 build
 * has a `createDisplayObject` case for everything in the file and draws it
 * identically; what it does instead is worse. `parseProject` names the
 * project's fields one at a time, so a v7 build opening a v8 file drops the
 * whole `audio` table and writes the file back without it — every imported
 * sound gone, with nothing having said so. That is the `animations` case
 * exactly. The scene's own `sounds` list would have survived on its own, riding
 * in on `scenes` as the guides and the bodies do, which is precisely why it is
 * not what bumps this: the table it points at is. `audio.spec.ts` asserts the
 * current version in the saved artefact so a future bump is a deliberate act —
 * as six other specs now do, which is what makes a bump loud on purpose.
 */
export const SCHEMA_VERSION = 8;

/** The Phaser release this editor targets and will export code for. */
export const TARGET_PHASER_VERSION = '4.2.1';

/** Object kinds the editor can currently place. Grows one entry at a time. */
export type NodeType =
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'sprite'
  | 'container'
  | 'instance'
  | 'tilemap'
  | 'particles';

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
 * An imported sound, held in the document as a data URL.
 *
 * The `ImageAsset` argument, unchanged: the bytes are in the document because
 * `JSON.stringify(project)` is the whole of the save, and a path to a file on
 * disk breaks the moment the project moves. The cost is file size, which
 * `importAudioFile` bounds far more tightly than it bounds an image — a minute
 * of ordinary music outweighs a scene's worth of sprites.
 *
 * Nothing here is recorded that a decode can answer. `ImageAsset` stores
 * `width`/`height` because a sprite's size is read on every sync and cannot
 * wait for one; a duration is shown in a single panel row, so it is derived
 * through `audio.ts`'s decode cache instead of being a second copy of a number
 * the file already contains.
 */
export interface AudioAsset {
  id: string;
  /**
   * The file name it was imported from — and, with its extension stripped, the
   * key exported code plays it by. That is why this one is editable where an
   * image's name is not: a texture key is only ever read by generated code,
   * while `this.sound.play('jump')` is the one line the user writes by hand.
   */
  name: string;
  /** One of `AUDIO_MIME_TYPES`; unlike an image's, it is not re-encoded. */
  mimeType: string;
  dataUrl: string;
  /**
   * Seconds, measured by the decode import performs anyway.
   *
   * Recorded for `ImageAsset.width`/`height`'s reason: decoding is
   * asynchronous and a panel row is not, so a duration derived on demand would
   * have every row read "—" for a moment on every open. It is intrinsic to the
   * bytes rather than a second opinion about them, which is what separates it
   * from the fields this schema keeps refusing.
   */
  duration: number;
}

/**
 * One sound a scene registers, and how it is tuned.
 *
 * On the scene rather than on a node, because a sound is not a display object:
 * it has no transform, no bounds and no name of its own to set, and the scene
 * tree's whole organizing principle is a transform hierarchy. It sits beside
 * `guides` and `physics`, which are scene-level document state for the same
 * kind of reason.
 *
 * What is *not* here is when it plays. Registering a sound is layout; deciding
 * that a coin makes a noise when something touches it is game logic — the
 * argument that keeps `scene.start` out of the document, and the one
 * `ParticlesProps` makes when it refuses an `emitting` field. The export emits
 * a named `const` per entry so that `coinSound.play()`, the one line the user
 * writes, has something to reach. `autoplay` is the single exception, and it is
 * one because scene start is not a trigger the user chooses.
 */
export interface SceneSound {
  id: string;
  audioId: string;
  loop: boolean;
  /** Phaser's own 0..1. */
  volume: number;
  /** Plays as the scene starts — a level's music, which has no other cue. */
  autoplay: boolean;
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

/**
 * A grid of tiles cut from one sliced image.
 *
 * There is no tileset type here and there is deliberately not going to be one: a
 * tileset *is* an `ImageAsset` with a `sheet`, and a tile index *is* a frame
 * index. `FrameGrid` already holds exactly the four numbers Phaser's
 * `addTilesetImage` takes, under the same names, for the same reason
 * `load.spritesheet` is handed them near-verbatim — so the slicer, the texture
 * key, the re-cut diff and the preload line are all the ones sprite sheets
 * already brought, and two tilemaps drawing one image cannot disagree about how
 * big a tile is.
 *
 * Which is also why there is no tile size stored here. It is the asset's frame
 * size, read back through `tileMapOf`, exactly as a sprite has no width or
 * height of its own. A copy of it on the node would be a second field over one
 * number, which is how the two come to disagree.
 */
export interface TilemapProps {
  /** The sliced image the tiles come from. Null draws the placeholder grid. */
  assetId: string | null;
  columns: number;
  rows: number;
  /**
   * The tiles, row-major, `columns * rows` of them. `-1` is an empty cell,
   * which is Phaser's own value for one rather than a convention of ours.
   *
   * Flat rather than nested: it is a third of the JSON of an array of arrays,
   * and one array is one thing for `cloneWithNewIds` to copy rather than one
   * per row.
   */
  data: number[];
  alpha: number;
}

/**
 * A particle emitter: a source that throws copies of one texture around.
 *
 * The first node whose whole point is what it does *over time*, which is why it
 * is stopped in the editor unless the preview toggle is on — the argument that
 * already keeps a sprite's animation still while you place it.
 *
 * Every field is one number and one Phaser config key, flattened out of the
 * `{min, max}` and `{start, end}` pairs Phaser takes, and the set is chosen as
 * the smallest one that makes fire, sparks and falling snow three visibly
 * different objects from the inspector alone. Nothing here is array-valued,
 * which is why `cloneWithNewIds` needs no case for it and `tilemap.props.data`
 * stays the one array in the schema.
 *
 * There is deliberately no `emitting` field. Whether an emitter runs is the
 * preview toggle's answer in the editor and Phaser's default in an export; a
 * document field would be a second answer to the same question, and an emitter
 * that starts switched off and is triggered later is a line of game logic —
 * the argument that keeps `scene.start` out of the document.
 */
export interface ParticlesProps {
  /** Null until an image is chosen; the canvas draws the emitter marker until then. */
  assetId: string | null;
  /**
   * Which frame of the asset's sheet each particle draws, clamped by
   * `clampFrame` exactly as a sprite's is. One frame rather than a list: a
   * `frames` array would be the second array-valued prop in the schema and the
   * second `cloneWithNewIds` special case, for a look a single frame mostly
   * covers.
   */
  frame: number;
  /** How long one particle lives, in milliseconds. */
  lifespan: number;
  /** Phaser's `speed: { min, max }`, in pixels per second. */
  speedMin: number;
  speedMax: number;
  /**
   * Phaser's `angle: { min, max }`, the emission direction in degrees. The one
   * field that turns a puff into a jet or into snow with nothing else touched.
   */
  angleMin: number;
  angleMax: number;
  /** Phaser's `scale: { start, end }` — smoke grows, sparks shrink. */
  scaleStart: number;
  scaleEnd: number;
  /**
   * Phaser's `alpha: { start, end }`. Without a fade particles pop out of
   * existence at the end of their life, which reads as a rendering fault
   * rather than as a decision.
   */
  alphaStart: number;
  alphaEnd: number;
  /** Particles per emission, and milliseconds between emissions. */
  quantity: number;
  frequency: number;
  /**
   * The one thing an emission angle cannot express: an arc. An ember that
   * rises and then falls is gravity, not a direction.
   */
  gravityX: number;
  gravityY: number;
  /** '#ffffff' means untinted, the same convention a sprite's tint uses. */
  tint: string;
  /**
   * 'ADD' is what makes fire look like fire rather than a heap of opaque
   * discs. Two options, so a select rather than a number.
   */
  blendMode: 'NORMAL' | 'ADD';
  /** The emitter object's own alpha, as every node type has. */
  alpha: number;
}

export interface NodePropsByType {
  rectangle: RectangleProps;
  ellipse: EllipseProps;
  text: TextProps;
  sprite: SpriteProps;
  container: ContainerProps;
  instance: InstanceProps;
  tilemap: TilemapProps;
  particles: ParticlesProps;
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
     * An Arcade Physics body, or absent for the great majority of nodes that
     * have none.
     *
     * Here rather than in `props` because it is the one setting that is not
     * per-type: every entry of `NodePropsByType` would otherwise carry the same
     * dozen fields, and `createNode` would have to answer "what is this
     * rectangle's bounce" for an object nobody has asked to simulate. Optional
     * for the reason `guides` is: every file written before this existed has no
     * such field, and `parseProject` passes scenes through without
     * reconstructing them. Read it through `physicsOf`, never directly.
     */
    physics?: PhysicsBody;
    /**
     * Nested nodes, positioned relative to this one. Only a `container`
     * renders them, but the array is present on every node so that traversal,
     * cloning and the parser never have to branch on the type.
     */
    children: GameObjectNode[];
  };
}[NodeType];

/**
 * The node types that can carry an Arcade body, and the only reader of that
 * list is `physicsOf`.
 *
 * An Arcade body reads its owner's `x`/`y`, `width` and `height` every step, so
 * the object has to have all four and they have to mean what the world thinks
 * they mean. A `rectangle`, an `ellipse`, a `text` and a `sprite` all do. The
 * four that are missing are each missing for their own reason, and none of them
 * is an oversight:
 *
 * - a `container` and an `instance` are Phaser Containers, which Arcade does
 *   not simulate — a body on one would be a box around children that go on
 *   moving independently of it;
 * - a `particles` node has no ComputedSize at all (see EditorScene's wrapper),
 *   so it has no width or height for a body to take;
 * - a `tilemap`'s collision is `setCollision([...])` — a different API about
 *   which *tiles* are solid, and a per-tile flag in the schema is the beginning
 *   of a behaviour model rather than more of this one.
 */
const PHYSICS_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'rectangle',
  'ellipse',
  'text',
  'sprite',
]);

/**
 * An Arcade Physics body attached to one object.
 *
 * The fields are Phaser's own, under Phaser's names, so the exported code is
 * this object with the setters wrapped round it — the rule `AnimationClip` and
 * `ParticlesProps` already follow.
 *
 * What is deliberately *not* here is behaviour over time: no colliders, no
 * overlap callbacks, no `stopAfter`. Which two objects collide is a line of
 * game logic, and the argument that keeps `scene.start` out of the document
 * applies here unchanged. What is here is the body's own standing state, which
 * is layout: how big it is, where it starts, and how it responds.
 */
export interface PhysicsBody {
  /**
   * A static body never moves and has no velocity, bounce, drag, mass or
   * gravity — Phaser's `StaticBody` does not carry those properties at all,
   * which is why they are not merely ignored for one but absent from the
   * emitted code. The inspector hides them for the same reason.
   */
  kind: 'dynamic' | 'static';
  velocityX: number;
  velocityY: number;
  bounceX: number;
  bounceY: number;
  /** Deceleration in pixels/sec^2, applied while acceleration is zero. */
  dragX: number;
  dragY: number;
  /** Degrees per second. */
  angularVelocity: number;
  mass: number;
  /**
   * `mass` and `immovable` only ever matter inside a collision, and this editor
   * emits no `collider` or `overlap` anywhere — deciding what collides with
   * what is game logic, the `scene.start` argument. They are here anyway, and
   * that is the point: the collider is the one line the user adds by hand, and
   * these two are the body properties that line reads. Emitting them means the
   * line they write is the only thing they have to write.
   */
  immovable: boolean;
  /** False exempts this body from the scene's world gravity. */
  allowGravity: boolean;
  collideWorldBounds: boolean;
}

/**
 * The node's body, defaulted and validated in one place.
 *
 * The `guidesOf` / `frameGridOf` / `prefabChildrenOf` / `tileMapOf` family, and
 * for the sharpest version of their reason: it answers three questions at once
 * — may this node type carry a body, is this node somewhere a body would mean
 * anything, and is the stored object well formed — and any one of them
 * forgotten is a body drawn in the wrong place or exported onto an object
 * Arcade cannot simulate.
 *
 * `topLevel` is the second question, and it is a parameter rather than
 * something this function could work out because a node does not know its
 * parent. A body positioned by `x`/`y` that are *parent-relative* is a body in
 * the wrong place, so only a direct child of the scene may have one. A body
 * found deeper reads as absent rather than being deleted — the answer
 * `tileMapOf` gives an out-of-range tile, and for the same reason: a node
 * dragged into a group and back out again is the same node, and throwing its
 * settings away on the way in would be a deletion nothing on screen asked for.
 */
export function physicsOf(
  node: GameObjectNode,
  topLevel: boolean,
): PhysicsBody | null {
  // A fresh object every call, exactly as `tileMapOf` builds one — so
  // `useEditorStore((s) => physicsOf(...))` is an infinite render loop, since
  // zustand compares snapshots by identity. Select the node and derive outside
  // the selector.
  if (!topLevel || !PHYSICS_TYPES.has(node.type)) return null;
  const raw = node.physics;
  if (typeof raw !== 'object' || raw === null) return null;
  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    kind: raw.kind === 'static' ? 'static' : 'dynamic',
    velocityX: numberOr(raw.velocityX, 0),
    velocityY: numberOr(raw.velocityY, 0),
    bounceX: numberOr(raw.bounceX, 0),
    bounceY: numberOr(raw.bounceY, 0),
    dragX: numberOr(raw.dragX, 0),
    dragY: numberOr(raw.dragY, 0),
    angularVelocity: numberOr(raw.angularVelocity, 0),
    // Phaser's own default, and zero would be a body every collision sends to
    // infinity rather than a light one.
    mass: Math.max(0.0001, numberOr(raw.mass, 1)),
    immovable: raw.immovable === true,
    allowGravity: raw.allowGravity !== false,
    collideWorldBounds: raw.collideWorldBounds === true,
  };
}

/** Whether the inspector may offer a body for this node type at all. */
export function canHavePhysics(type: NodeType): boolean {
  return PHYSICS_TYPES.has(type);
}

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
  /**
   * The Arcade world this scene's bodies live in. Optional for the reason
   * `guides` is, and read through `scenePhysicsOf`, never directly.
   */
  physics?: ScenePhysics;
  /**
   * The sounds this scene registers. Optional for the reason `guides` is, and
   * read through `soundsOf`, never directly.
   */
  sounds?: SceneSound[];
  /**
   * Where the game looks when this scene starts. Optional for the reason
   * `guides` is, and read through `cameraOf`, never directly.
   */
  camera?: SceneCamera;
}

/**
 * The scene's physics world.
 *
 * Gravity and nothing else. The world's *bounds* are deliberately absent: the
 * scene already has a width and a height, and a second rectangle saying how big
 * the scene is would be two fields free to disagree about one number — the
 * argument that gives a sprite no width of its own and a tilemap no tile size
 * of its own. The exporter emits `setBounds(0, 0, width, height)` from the
 * scene's own size, which is also what Phaser would have defaulted to for a
 * game exactly the size of this scene and what it would *not* have defaulted to
 * for a module dropped into a larger one.
 */
export interface ScenePhysics {
  /** Pixels/sec^2. Positive y is downward, as everywhere else here. */
  gravityX: number;
  gravityY: number;
}

/**
 * The scene's gravity, defaulted and validated in one place — `guidesOf`'s
 * sibling, on the other optional field scenes carry.
 */
export function scenePhysicsOf(scene: SceneDoc): ScenePhysics {
  const raw = scene.physics;
  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  if (typeof raw !== 'object' || raw === null) return { gravityX: 0, gravityY: 0 };
  return { gravityX: numberOr(raw.gravityX, 0), gravityY: numberOr(raw.gravityY, 0) };
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
 * The scene's sounds: defaulted, validated, and resolved against the table.
 *
 * The `guidesOf` / `frameGridOf` / `physicsOf` / `tileMapOf` / `prefabChildrenOf`
 * family, answering three questions at once — is there a list, is each entry
 * well formed, and does each one name a sound the project still holds. Any of
 * the three forgotten is an export that does not boot, because
 * `this.sound.add(undefined)` is not a thing Phaser can be asked for.
 *
 * A dangling entry is *dropped* rather than kept and drawn some placeholder
 * way, which is stricter than the treatment a sprite pointing at a missing
 * image gets. The difference is the one `parseAnimations` already draws: a
 * sprite has a placeholder to fall back to and a sound has nothing to be. The
 * editor cannot produce one either way — `removeAudio` takes the entries with
 * the file — so this only ever fires on a file the editor did not write, and
 * dropping here means nothing downstream needs a guard of its own.
 *
 * A fresh array every call, exactly as `tileMapOf` and `physicsOf` build a
 * fresh object — so `useEditorStore((s) => soundsOf(...))` compares unequal on
 * every store change and loops forever (React error #185). Select the project
 * and derive outside the selector.
 */
export function soundsOf(project: Project, scene: SceneDoc): SceneSound[] {
  if (!Array.isArray(scene.sounds)) return [];

  const sounds: SceneSound[] = [];
  for (const candidate of scene.sounds) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const sound = candidate as Partial<SceneSound>;
    if (typeof sound.id !== 'string' || !sound.id) continue;
    // The one thing that costs a row rather than being repaired. Everything
    // else here has a sensible value to fall back to; a reference to a sound
    // the project does not hold has none, and `this.sound.add(undefined)` is
    // not something Phaser can be asked for.
    if (findAudio(project, sound.audioId) === undefined) continue;

    const volume = Number(sound.volume);
    sounds.push({
      id: sound.id,
      audioId: sound.audioId as string,
      loop: sound.loop === true,
      // Clamped rather than rejected: one nonsensical number should not cost
      // the row, which is the treatment `parseSheet` gives a margin.
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
      autoplay: sound.autoplay === true,
    });
  }
  return sounds;
}

/**
 * Where the game looks when this scene starts.
 *
 * The scene already says how big the view is — a camera's viewport is the game
 * canvas, which is this scene's own width and height — so what is left is where
 * that view sits, how far in it is zoomed, what it may not scroll past and what
 * it chases. Nothing here says *when*: an effect over time is game logic, the
 * argument that keeps `scene.start` out of the document.
 *
 * `boundToScene` is a boolean rather than a rectangle for the reason
 * `ScenePhysics` has no bounds of its own: the scene rectangle already says how
 * big the scene is, and a second rectangle saying it again is two fields free
 * to disagree about one number.
 */
export interface SceneCamera {
  /** Top-left of the *unzoomed* viewport in world space, as Phaser stores it. */
  scrollX: number;
  scrollY: number;
  /** Above 1 shows less of the world, below 1 shows more. Never 0. */
  zoom: number;
  /** Whether scrolling is held inside the scene rectangle. */
  boundToScene: boolean;
  /** Phaser's own pixel-art switch, passed on to `startFollow` as well. */
  roundPixels: boolean;
  /**
   * A top-level node this camera follows, or null.
   *
   * Top-level for the reason an Arcade body is: following reads the target's
   * `x`/`y` as world coordinates, and a node inside a container has
   * parent-relative ones. It is the same rule arriving twice, and it is
   * enforced the same way — stripped on read here, refused on write in the
   * store.
   */
  followId: string | null;
  /** How hard it chases: 1 snaps, lower is smoother. Phaser's `lerp`. */
  followLerp: number;
}

/** What a scene's camera is when the file does not say. */
export const DEFAULT_CAMERA: SceneCamera = {
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  boundToScene: false,
  roundPixels: false,
  followId: null,
  followLerp: 1,
};

/**
 * The scene's camera: defaulted, validated, and resolved against the scene.
 *
 * The `guidesOf` / `scenePhysicsOf` / `soundsOf` / `frameGridOf` / `tileMapOf` /
 * `prefabChildrenOf` family, and it answers three questions at once — is there a
 * camera, are its numbers ones Phaser can be given, and does it follow
 * something a follow could actually work on. Any of the three forgotten is a
 * `setZoom(0)`, which Phaser clamps behind your back, or a
 * `startFollow(undefined)`, which it cannot be asked for at all.
 *
 * Numbers are repaired and the *reference* is dropped, which is `soundsOf`'s
 * split: a nonsensical zoom has a sensible value to fall back to and a
 * `followId` naming nothing has none. Dropping it here is what means nothing
 * downstream needs a guard — no pruning in `deleteNode`, in `undo` or in the
 * scene switcher, exactly as no action prunes a dangling `audioId`.
 *
 * A follow target found below the top level reads as *absent* rather than being
 * deleted, which is the answer `physicsOf` gives a body on a nested node and for
 * its reason: a node dragged into a group and back out is the same node, and
 * throwing the setting away on the way in would be a deletion nothing asked for.
 *
 * A fresh object every call, exactly as `physicsOf` and `tileMapOf` build one —
 * so `useEditorStore((s) => cameraOf(...))` compares unequal on every store
 * change and loops forever (React error #185). Select the scene and derive
 * outside the selector.
 */
export function cameraOf(scene: SceneDoc): SceneCamera {
  const raw = scene.camera;
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_CAMERA };

  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const zoom = numberOr(raw.zoom, 1);
  const lerp = numberOr(raw.followLerp, 1);
  const followId =
    typeof raw.followId === 'string' &&
    scene.children.some((child) => child.id === raw.followId)
      ? raw.followId
      : null;

  return {
    scrollX: numberOr(raw.scrollX, 0),
    scrollY: numberOr(raw.scrollY, 0),
    // Phaser clamps a zoom of 0 to 0.001 rather than refusing it, which is a
    // camera showing a thousand scenes at once and nothing saying why.
    zoom: zoom > 0 ? zoom : 1,
    boundToScene: raw.boundToScene === true,
    roundPixels: raw.roundPixels === true,
    followId,
    // Clamped, and a zero repaired rather than kept: Phaser reads a lerp of 0
    // as "do not track on this axis", which is a camera that says it follows
    // something and then does not.
    followLerp: lerp > 0 ? Math.min(1, lerp) : 1,
  };
}

/** Whether a camera is the one every scene has by default. */
export function isDefaultCamera(camera: SceneCamera): boolean {
  return (
    camera.scrollX === DEFAULT_CAMERA.scrollX &&
    camera.scrollY === DEFAULT_CAMERA.scrollY &&
    camera.zoom === DEFAULT_CAMERA.zoom &&
    camera.boundToScene === DEFAULT_CAMERA.boundToScene &&
    camera.roundPixels === DEFAULT_CAMERA.roundPixels &&
    camera.followId === DEFAULT_CAMERA.followId &&
    camera.followLerp === DEFAULT_CAMERA.followLerp
  );
}

/**
 * The part of the world the camera opens on, in scene coordinates.
 *
 * The arithmetic is Phaser's own, from `Camera.preRender` and `clampX`/`clampY`,
 * and it has to stay copied for `frameLayoutOf`'s reason: this is what the
 * editor draws, and a formula of our own would offer the user a shot their
 * exported game does not open on. Two parts of it are easy to get wrong by
 * guessing — the view is centred on the *unzoomed* viewport's middle rather
 * than pinned to its top-left, so zooming closes in on the middle of the shot
 * and not on its corner; and the bounds clamp moves the scroll rather than
 * cropping the view.
 *
 * The viewport is the scene's own width and height because that is the size of
 * the game canvas an export builds — the same "one number, one place" that
 * gives a sprite no width of its own.
 *
 * Where a follow would take it is deliberately not in here. The frame is the
 * shot the scene opens on; a camera in motion is the thing the editor does not
 * run, exactly as it does not run a physics step.
 */
export function cameraViewOf(scene: SceneDoc): { x: number; y: number; width: number; height: number } {
  const camera = cameraOf(scene);
  const width = scene.width / camera.zoom;
  const height = scene.height / camera.zoom;

  // Phaser's `clampX`, where the viewport and the bounds are both the scene's
  // own size — which is what makes the two arguments one number here.
  const clamp = (scroll: number, display: number, size: number) => {
    if (!camera.boundToScene) return scroll;
    const low = (display - size) / 2;
    const high = Math.max(low, low + size - display);
    return Math.min(high, Math.max(low, scroll));
  };

  const scrollX = clamp(camera.scrollX, width, scene.width);
  const scrollY = clamp(camera.scrollY, height, scene.height);

  return {
    x: scrollX + scene.width / 2 - width / 2,
    y: scrollY + scene.height / 2 - height / 2,
    width,
    height,
  };
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
   * Sounds, shared across every scene for the reason the images are: two levels
   * playing one theme should carry its bytes once, and those bytes are the
   * largest thing in the file after the images.
   *
   * What a scene holds is a `SceneSound` pointing in here by id, which is the
   * `animations` arrangement rather than the `assets` one — a sound is tuned
   * per scene (a menu's theme is quieter than a boss fight's) while the file it
   * plays is the same file.
   */
  audio: AudioAsset[];
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

export function findAudio(
  project: Project,
  id: string | null | undefined,
): AudioAsset | undefined {
  return id ? project.audio.find((asset) => asset.id === id) : undefined;
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

/** An empty cell, which is Phaser's own value for one. */
export const EMPTY_TILE = -1;

/**
 * The most tiles a map may be across or down.
 *
 * A bound rather than a preference: history is whole-project snapshots, the
 * document is a file the user carries around, and 256x256 is 65,536 numbers per
 * map already. Phaser's own GPU layer stops at 4096, which is four hundred times
 * the JSON this editor should ever be asked to hold in a browser tab.
 */
export const MAX_TILEMAP_SIDE = 256;

/** The tile size a map is drawn at while it has no usable tileset. */
export const FALLBACK_TILE = 32;

/** One cell of a tilemap, in tile coordinates rather than pixels. */
export interface TileCell {
  column: number;
  row: number;
}

/** A tilemap as it can actually be drawn, however the document says it. */
export interface TileMap {
  /** The tileset image, or undefined when there is none to draw. */
  asset: ImageAsset | undefined;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  /** Exactly `columns * rows` entries, each `-1` or a frame the tileset has. */
  data: number[];
  /** How many distinct tiles the tileset offers; never zero. */
  tileCount: number;
}

/**
 * A tilemap node's props, resolved against the project and made usable.
 *
 * The only reader of `TilemapProps`, in the family `frameGridOf`, `guidesOf` and
 * `prefabChildrenOf` belong to, and for the sharpest version of their reason:
 * every consumer here would otherwise have to ask four separate questions — is
 * there a tileset, how big is a tile, is `data` the length the grid says, and is
 * every entry a frame that exists — and any one of them forgotten is a Phaser
 * warning and a missing-texture cell. Answering all four in one call means the
 * renderer, the exporter, the palette and the paint gesture cannot disagree.
 *
 * The padding and truncation are the hand-edited-file backstop, not the resize
 * path: `resizeTilemap` re-shapes the array row by row, because reinterpreting a
 * flat array under a new column count shifts every row after the first. What
 * arrives here has already been re-shaped, or was never written by this editor.
 *
 * A tile the tileset does not have reads as *empty*, not as the nearest one it
 * does. That is the opposite of `clampFrame`, deliberately: a sprite has no way
 * to show "no frame", so clamping is the only answer there, while `-1` is a
 * first-class value here and Phaser's own. It is also what lets a re-cut leave
 * the document alone — the map goes blank while the sheet is mid-edit and comes
 * back whole the moment the numbers are right again, where rewriting the stored
 * indices would have thrown the level away over a mistyped margin.
 *
 * `data` keeps its identity when the document's array is already well formed, so
 * a sync that changes nothing allocates nothing.
 */
export function tileMapOf(project: Project, props: TilemapProps): TileMap {
  const asset = findAsset(project, props.assetId);
  const grid = frameGridOf(asset);
  const tileCount = frameCountOf(asset);

  const side = (value: number) =>
    Number.isFinite(value) ? Math.min(Math.max(1, Math.floor(value)), MAX_TILEMAP_SIDE) : 1;
  const columns = side(props.columns);
  const rows = side(props.rows);

  const size = columns * rows;
  const source = Array.isArray(props.data) ? props.data : [];
  const clamp = (value: number) => {
    const tile = Math.floor(value);
    return Number.isFinite(tile) && tile >= 0 && tile < tileCount ? tile : EMPTY_TILE;
  };

  let data = source;
  if (source.length !== size || source.some((tile) => clamp(tile) !== tile)) {
    data = Array.from({ length: size }, (_, index) => clamp(source[index]));
  }

  return {
    asset,
    tileWidth: grid ? grid.frameWidth : FALLBACK_TILE,
    tileHeight: grid ? grid.frameHeight : FALLBACK_TILE,
    columns,
    rows,
    data,
    tileCount,
  };
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
