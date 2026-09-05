import Phaser from 'phaser';
import {
  activeScene,
  primaryId,
  selectionRoots,
  useEditorStore,
  type EditorState,
} from '../../core/store';
import {
  cameraOf,
  cameraViewOf,
  clampFrame,
  containsNode,
  findAnimation,
  findAsset,
  findNode,
  findParent,
  EMPTY_TILE,
  frameGridOf,
  guidesOf,
  isDefaultCamera,
  physicsOf,
  prefabChildrenOf,
  tileMapOf,
  worldTransformOf,
  type AnimationClip,
  type GameObjectNode,
  type ImageAsset,
  type ParticlesProps,
  type Project,
  type TileCell,
  type TileMap,
  type TilemapProps,
} from '../../core/schema';
import { decodeImage, decodedImage } from '../../core/assets';
import { publishBounds, unionRect, type Rect } from '../../core/bounds';
import {
  snapMove,
  snapRotation,
  type AngleMark,
  type AngleTarget,
  type Guide,
  type Spacing,
} from '../../core/snapping';

/**
 * The editing surface.
 *
 * This scene renders the project document and reports pointer edits back to it.
 * It deliberately owns no state beyond the display objects it has built: the
 * store is the truth and every frame here is derived from it. That is what keeps
 * "save the project" honest — there is nothing in this scene that a
 * `JSON.stringify` of the document would miss.
 */

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
// Cyan rather than the UI accent blue: the accent is also the default
// rectangle fill, which made the outline invisible on the object you had
// just selected.
const SELECTION_COLOR = 0x00e5ff;
const FRAME_COLOR = 0x5a6478;
/**
 * Snap guides are magenta so that all three canvas overlays stay tellable
 * apart: the accent blue is the default rectangle fill, cyan is the selection
 * outline, and a guide has to be readable while lying across both.
 */
const GUIDE_COLOR = 0xff3ea5;

/**
 * A guide the user placed, as against the magenta one a snap draws for itself.
 *
 * A different colour on purpose, and for the reason the selection outline is
 * not the accent blue: drawn in the snap guide's magenta, "these two objects
 * agree right now" and "there is a line here always" would be the same mark,
 * and the transient one would vanish the moment it landed on the permanent one.
 * Amber is far enough from the accent, the selection cyan and the default
 * rectangle fill to stay tellable apart on top of any of them.
 *
 * Two screen pixels wide like the selection outline and the snap guides: a
 * hairline is the desktop convention and is invisible under a thumb, and this
 * one has to be *grabbable*, not merely visible.
 */
const PLACED_GUIDE_COLOR = 0xffa723;
const PLACED_GUIDE_WIDTH = 2;

/**
 * The outline drawn round an object that carries a physics body.
 *
 * Green because it is the colour Phaser's own Arcade debug draw uses, so the
 * editor and a game running with `debug: true` say the same thing the same way
 * — and because it is clear of every other mark on this canvas: the selection
 * cyan, the two guide colours, the scene frame, the emitter marker and the
 * default fills of all three shapes.
 *
 * There is no toggle for it, unlike the grid and the guides. Those are drawn
 * everywhere whether or not anyone asked, so switching them off is switching
 * off something the user did not put there; a body outline exists only where
 * one was deliberately attached, and it is the only thing on the canvas that
 * says a body is there at all. A control that could only ever hide the answer
 * to "which of these has physics" is worth less than the toolbar width it would
 * cost.
 */
const BODY_COLOR = 0x00ff00;
const BODY_WIDTH = 2;

/**
 * The scene camera's opening view, drawn and never applied.
 *
 * Violet because a colour on this canvas has to clear the editor's own chrome
 * as well as the objects: the selection outline is cyan, the snap guides are
 * magenta, the user guides amber, the scene frame slate, a physics body green
 * and an emitter's marker pink. The suite matches it by name, so a shade that
 * blended into any of those would be a wrong answer rather than a flaky one.
 */
const CAMERA_COLOR = 0x9b7bff;
const CAMERA_WIDTH = 2;

/**
 * The grab band around a guide, in screen pixels.
 *
 * Narrower than the handles' 44 on purpose, and it is not a compromise. Those
 * are *point* targets, where a thumb has to land inside a square; a guide is a
 * line, unbounded along its own axis, so only one coordinate has to be right —
 * a far easier target for the same width. And a guide's band steals every press
 * within it from the objects underneath, across the whole height of the scene:
 * at the mobile project's zoom, 44px is about 119 scene units of canvas that
 * cannot be pressed, per guide. 24 is wide enough for a thumb on a line and
 * halves the strip.
 */
const PLACED_GUIDE_TOUCH = 24;

/**
 * How close a dragged edge has to come before it is pulled into line, in
 * *screen* pixels — divided by the camera zoom at use, so the pull is the same
 * distance to the finger at every zoom. In world units instead it would be
 * unusably sticky zoomed out and unreachable zoomed in.
 */
const SNAP_THRESHOLD = 8;

/**
 * How close a turned object has to come to another's angle, or to the step,
 * before it is pulled onto it — in **degrees**, and deliberately *not* divided
 * by the camera zoom the way the constant above is.
 *
 * That division exists because a translation's size on screen is its size in
 * the world times the zoom, so the quantity being snapped changes size as the
 * camera moves. An angle does not: five degrees is five degrees at every zoom,
 * and dividing would correct for a distortion that is not there — making the
 * snap unreachable zoomed in on a gesture that has become no more precise in
 * the quantity it controls.
 *
 * The real sensitivity question is the grip: at radius r from the pivot, a
 * pixel of finger travel is 1/r radians. But the knob is parked a fixed
 * *screen* distance beyond the object's edge, so that radius barely varies with
 * the camera either, and a user who has gripped close in has chosen a coarse
 * gesture rather than earned a wider capture.
 */
const SNAP_ANGLE = 5;

/**
 * The tick drawn through each pivot that agrees on an angle, in screen pixels.
 *
 * Short on purpose. It is the junior half of the feedback — it says *which*
 * objects agreed, the way a guide lights a whole column, while the readout
 * carries the claim itself. A long one would read as a guide, which is a
 * stronger statement than a shared direction can support.
 */
const ANGLE_MARK_LENGTH = 34;

/**
 * Guide thickness, in screen pixels — the same weight as the selection
 * outline, and for the same reason. A hairline is the desktop convention, but
 * on a phone held at arm's length with a thumb over the object it is feedback
 * you cannot see, which makes the snap look like the editor moving things on
 * its own.
 */
const GUIDE_WIDTH = 2;

/**
 * The end caps on a spacing bar, and the gap the shortest bar still needs to
 * be drawn at all — both in screen pixels.
 *
 * A bar without caps is indistinguishable from a guide lying across the gap,
 * which is the one reading it must not have: a guide says "these agree on a
 * line", a bar says "this space is that space". Below the minimum there is not
 * enough room between two caps for a bar to be anything but a smudge, and two
 * objects that close read as touching anyway.
 */
const SPACING_CAP = 5;
const MIN_SPACING = 6;

/**
 * The grid, in the same slate as the scene frame and at a third of its
 * strength.
 *
 * The frame is the other piece of editor chrome drawn under the user's
 * objects, and it has to survive any background colour they choose, so the
 * grid inherits both the colour and that constraint. A third is where it
 * stopped competing with the objects on top of it: a grid you read before the
 * scene is a grid in the way.
 */
const GRID_COLOR = FRAME_COLOR;
const GRID_ALPHA = 0.33;

/**
 * The smallest a grid square may get on screen before the grid stops being
 * drawn, in screen pixels.
 *
 * Zoomed far enough out, a 32-unit pitch is a solid wash that hides the scene
 * it is meant to help place things in. Snapping still uses the pitch — it is
 * the drawing that has nothing left to say, not the geometry.
 */
const MIN_GRID_PIXELS = 6;

/**
 * Texture keys are namespaced so that `syncTextures` can tell the textures it
 * owns from Phaser's own (`__DEFAULT`, `__MISSING`) and never remove those.
 *
 * The frame grid is folded into the key, not merely into the texture's
 * contents. A Phaser texture's frames are cut once, when it is added, and there
 * is no API to re-cut one in place — so changing the grid has to build a new
 * texture and drop the old one. Making the key depend on the grid means the
 * existing "add what is wanted, remove what is not" diff in `syncTextures`
 * does exactly that on its own, with no special case for a re-cut: the new key
 * is missing, so it is added, and the old key is no longer wanted, so it goes.
 */
const textureKeyForAsset = (asset: ImageAsset): string => {
  const sheet = frameGridOf(asset);
  return sheet
    ? `asset:${asset.id}:${sheet.frameWidth}x${sheet.frameHeight}+${sheet.margin}+${sheet.spacing}`
    : `asset:${asset.id}`;
};

/**
 * Animation keys are namespaced for the same reason, and carry a signature of
 * the clip for the same reason again: Phaser's `Animation` is built from its
 * frames at `create` time, so an edited clip is a new animation rather than a
 * changed one.
 */
const animationKeyFor = (clip: AnimationClip, textureKey: string): string =>
  `anim:${clip.id}:${textureKey}:${clip.frames.join(',')}:${clip.frameRate}:${clip.repeat}`;
/**
 * What a tilemap's Phaser objects are built *from*, as a string.
 *
 * `textureKeyForAsset`'s argument, one object over: a `Tilemap`'s dimensions,
 * tile size and tileset are fixed when it is parsed and there is no API to
 * re-cut one in place, so any of those changing has to build a new map and drop
 * the old one. Comparing a signature means `syncNodes`' existing "rebuild when
 * the type changed" branch does exactly that with nothing added, and the tile
 * *contents* — which change on every stroke — are deliberately not in it.
 */
const tilemapSignatureOf = (map: TileMap, textureKey: string): string =>
  `${textureKey}:${map.tileWidth}x${map.tileHeight}:${map.columns}x${map.rows}`;

const PLACEHOLDER_TEXTURE = 'editor:no-image';
/**
 * The stand-in tileset, cut into `FALLBACK_TILE` squares.
 *
 * `PLACEHOLDER_TEXTURE`'s argument one level over: a tilemap with no tileset
 * chosen, or one whose image has not finished decoding, still has to be a real
 * object that can be selected, dragged, resized and painted on. Giving the
 * empty case a texture of its own rather than a branch means there is one code
 * path through `createTilemapLayer`, and "no tileset yet" and "the tileset is
 * gone" are one state rather than two.
 */
const NO_TILESET_TEXTURE = 'editor:no-tiles';
/** Side of one square of that stand-in, matching the fallback tile size. */
const NO_TILESET_TILE = 32;
/** Side of the stand-in square drawn for a sprite with no image yet. */
const PLACEHOLDER_SIZE = 96;

/**
 * The marker drawn for an emitter that is not emitting.
 *
 * `PLACEHOLDER_TEXTURE`'s argument a third time, and here it covers more than
 * "no image yet": an emitter is stopped unless preview is on, so most of the
 * time it draws nothing at all — and an object that draws nothing cannot be
 * seen, selected or dragged. Giving it a texture rather than a branch means
 * "no image chosen", "the image is gone", "the image is still decoding" and
 * "chosen, but not running" are one state and one code path rather than four.
 *
 * Filled discs rather than an outline: a one-pixel line never reaches full
 * strength on screen, so a stroked marker is both hard to see under a thumb
 * and impossible for a colour-centroid assertion to find.
 */
const EMITTER_TEXTURE = 'editor:emitter';
/**
 * The emitter's size, in world units — the marker's and the box's at once.
 *
 * A `ParticleEmitter` mixes in Transform and Visible but *not* ComputedSize or
 * Origin, so it has no width, no height and no `displayOriginX` for
 * `InputManager.pointWithinHitArea` to offset by. It is therefore drawn inside
 * a Container of this size, which has all three — and because the texture is
 * authored at exactly this size, the marker and the box a gesture reads cannot
 * disagree about where the emitter is.
 */
const EMITTER_SIZE = 96;

/**
 * The corner scale handle, in *screen* pixels — it is resized against the
 * camera zoom every frame so it stays the same size to the eye and to the
 * finger, whatever the camera is doing.
 *
 * The touch target is far larger than the square it draws: 14px is the size
 * that reads as a handle without covering the object it belongs to, and 44px is
 * the size a thumb can actually hit.
 */
const HANDLE_SIZE = 14;
const HANDLE_TOUCH_SIZE = 44;
/** A scale below this is indistinguishable from gone, and can't be dragged back. */
const MIN_SCALE = 0.02;

/**
 * The rotate knob: the circle drawn, and how far beyond the object's own top
 * edge it is parked — both in screen pixels.
 *
 * Outside the object rather than on a corner, and that is the load-bearing
 * choice. The scale handle already keeps a 44px touch target that swallows a
 * small object's own centre at the mobile zoom; a second 44px target anywhere
 * *on* the object would leave its middle inside both and make it undraggable
 * rather than merely awkward. Parked a constant screen distance outside the
 * edge, the collision is impossible by construction however small the object
 * gets — and the knob visibly carries the object's tilt, which is what makes
 * the gesture legible with no cursor to change.
 */
const ROTATE_HANDLE_SIZE = 12;
const ROTATE_HANDLE_OFFSET = 28;

/** Pivot-to-point angle in degrees, y down — the sense Phaser's rotation has. */
const degreesBetween = (px: number, py: number, x: number, y: number): number =>
  (Math.atan2(y - py, x - px) * 180) / Math.PI;

/** The shortest signed way round, in (-180, 180]. See snapping.ts. */
const wrapDegrees = (value: number): number =>
  ((((value + 180) % 360) + 360) % 360) - 180;

/**
 * Three decimals and one turn.
 *
 * Unlike a position, which settles on whole pixels unless a snap is holding, a
 * rotation settles on three decimals *always*: `tidyTransform` already does
 * that everywhere else in the store, and whole degrees would destroy exactly
 * the agreements this gesture exists to make — a neighbour match at 37.5° would
 * not survive them. Wrapped, because the document cannot express "the user
 * spun it three times" anyway: the renderer takes it mod 360 and so does the
 * exported `setAngle`.
 */
const roundRotation = (value: number): number =>
  Math.round(wrapDegrees(value) * 1000) / 1000;

/** Three decimals: finer than the eye at any zoom, and readable in a field. */
const roundScale = (value: number): number =>
  Math.max(MIN_SCALE, Math.round(value * 1000) / 1000);

/** The same three decimals, for a position a snap has to keep exact. */
const roundPosition = (value: number): number => Math.round(value * 1000) / 1000;

/** '#rrggbb' -> 0xrrggbb, tolerating a missing '#' or a malformed value. */
function hexToNumber(hex: string, fallback = 0xffffff): number {
  const parsed = Number.parseInt(String(hex).replace('#', ''), 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

type Renderable =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Ellipse
  | Phaser.GameObjects.Text
  // A Sprite rather than an Image: only a Sprite carries an AnimationState, and
  // a sprite node has to be able to play whether or not it does today. The two
  // draw identically — Sprite *is* an Image with playback bolted on — so this
  // costs nothing for the still case. The exporter makes the opposite choice
  // and emits `add.image` unless the node animates, because there the extra
  // capability would be a line of generated code that does nothing.
  | Phaser.GameObjects.Sprite
  | Phaser.GameObjects.Container
  // The real thing, not a stand-in built out of Images: a layer is what the
  // export emits, so drawing one here is what makes the canvas and the
  // generated game agree about how a map is cut, ordered and positioned. It is
  // an ordinary Game Object with Transform, Origin, ComputedSize, Alpha and
  // Visible on it, so every gesture and every modifier already works on one —
  // with the single exception that its origin is its top-left, which is what
  // `localRectOf` has a case for.
  | Phaser.Tilemaps.TilemapLayer;

/**
 * The box an empty group gets, in world units.
 *
 * A container's bounds are its children's, so an empty one has none at all —
 * and an object with no bounds cannot be selected on the canvas, dragged, or
 * even seen. A group you have just added and not yet filled is exactly when you
 * most need to be able to grab it.
 */
const EMPTY_GROUP_SIZE = 24;

/**
 * Hit areas are expressed in the object's local space with (0,0) at its
 * top-left; Phaser applies origin, scale and rotation itself. An ellipse gets a
 * real elliptical test so its corners aren't clickable.
 */
function hitAreaFor(object: Renderable, node: GameObjectNode) {
  const { width, height } = object;
  return node.type === 'ellipse'
    ? new Phaser.Geom.Ellipse(width / 2, height / 2, width, height)
    : new Phaser.Geom.Rectangle(0, 0, width, height);
}

/** The axis-aligned box covering a rectangle transformed by a matrix. */
function transformedBounds(
  rect: Phaser.Geom.Rectangle,
  matrix: Phaser.GameObjects.Components.TransformMatrix,
): Phaser.Geom.Rectangle {
  const corners = [
    matrix.transformPoint(rect.x, rect.y),
    matrix.transformPoint(rect.right, rect.y),
    matrix.transformPoint(rect.x, rect.bottom),
    matrix.transformPoint(rect.right, rect.bottom),
  ].map((point) => ({ x: point.x, y: point.y }));

  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return new Phaser.Geom.Rectangle(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
}

function hitTestFor(node: GameObjectNode) {
  return node.type === 'ellipse'
    ? Phaser.Geom.Ellipse.Contains
    : Phaser.Geom.Rectangle.Contains;
}

export class EditorScene extends Phaser.Scene {
  static readonly KEY = 'editor';

  /**
   * Every drawn object, keyed by its *display key* rather than its node id.
   *
   * For a scene node the two are the same string. They differ only for what an
   * instance draws: a prefab's child ids are shared by every placement of it,
   * so the key is the instance's key plus the child's id (`syncNodes`), and two
   * instances of one prefab cannot collide.
   */
  private displayObjects = new Map<string, Renderable>();
  /**
   * Each container's bounds in its own local space, keyed by display key — a
   * container inside a prefab definition is drawn once per instance, and each
   * of those needs its own box.
   *
   * A Phaser Container has no size of its own, and its origin is not the centre
   * of its contents, so nothing downstream — the selection outline, the hit
   * area, the scale handle — can be derived from `width`/`height` the way it is
   * for every other object. Recomputed from the children each sync, which is
   * also why the sync walks depth-first: a group's box is only knowable once
   * everything inside it has been laid out.
   */
  private containerBounds = new Map<string, Phaser.Geom.Rectangle>();

  /**
   * The emitter inside each particles node's container, by display key.
   *
   * The container is what the document's transform, alpha and hit area apply
   * to; this is the thing that actually throws particles, and the only way
   * back to it once the two are built. The `tilemaps` map one object over.
   */
  private emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  /**
   * The config each emitter was last given, by display key.
   *
   * `setConfig` calls `resetCounters`, which restarts the flow — and the scene
   * syncs on *every* store change, so applying the config unconditionally
   * would have a selection, or a nudge of some unrelated object, reset every
   * emitter before it had emitted anything. This is `play(key, true)`'s
   * ignoreIfPlaying by another route: compare, and only then apply.
   */
  private emitterConfigs = new Map<string, string>();

  /**
   * The display keys belonging to real document nodes, rebuilt every sync.
   *
   * A prefab's contents are drawn but are not in the document, so they are the
   * one thing on screen that no node id names. This is how the measured-bounds
   * publish tells the two apart.
   */
  private documentKeys = new Set<string>();
  /** Texture keys this scene created, so shutdown and pruning only touch ours. */
  /**
   * The `Tilemap` behind each drawn layer, keyed the same way.
   *
   * A `Tilemap` is a data container, not a display object, so the sync's
   * `object.destroy()` prune never reaches one — this is the `assetTextures`
   * bookkeeping again, for the same reason and with the same fix.
   */
  /**
   * The paint stroke in flight: which tilemap, and the last cell it reached.
   *
   * The last cell is what makes a stroke a line rather than a row of dots. A
   * finger crossing a 32px map at speed lands one pointer-move every several
   * tiles, so the cells *between* two samples have to be filled in or the
   * stroke comes out dashed — and on a phone that reads as the editor dropping
   * input rather than as the frame rate it is.
   */
  private painting: { nodeId: string; last: TileCell | null } | null = null;
  /** The cell grid drawn over the map being painted, and what it last drew. */
  private paintGraphics!: Phaser.GameObjects.Graphics;
  private paintSignature = '';

  private tilemaps = new Map<string, Phaser.Tilemaps.Tilemap>();
  /**
   * The tiles each layer was last drawn with, so a sync writes only the cells
   * that actually changed.
   *
   * A stroke fires a store change per pointer-move and the scene syncs on every
   * one of them; re-putting all 65,536 tiles of a full-size map each time would
   * make the gesture unusable. The diff is against what was drawn rather than
   * against the previous document, so a rebuild and a re-open start from a
   * known-empty cache rather than from an assumption.
   */
  private tileData = new Map<string, number[]>();
  private assetTextures = new Set<string>();
  /**
   * Animation keys this scene registered.
   *
   * Animations live on the *game*'s manager, not the scene's — `this.anims` is
   * a singleton shared by every scene — so they outlive a scene teardown
   * exactly as textures do, and have to be removed by the same bookkeeping.
   */
  private animationKeys = new Set<string>();
  /**
   * The animation key each clip currently resolves to, so `applyNode` can find
   * a sprite's animation without recomputing the signature per sprite.
   */
  private animationForClip = new Map<string, string>();
  /**
   * The document and the preview flag for the sync in progress.
   *
   * Held here rather than threaded down through `syncNodes` because they are
   * the same for every node in a pass, while the arguments that pass does
   * thread — the node, its parent, its index — are the ones that differ per
   * node. A sprite needs both: its texture and its animation are looked up in
   * the project's asset and animation tables, which are not on the node.
   */
  private previewing = false;
  private syncing: Project = useEditorStore.getState().project;
  /** Data URLs currently being decoded, so a slow image is only decoded once. */
  private decoding = new Set<string>();
  /** False after SHUTDOWN, so an in-flight decode can't touch a dead scene. */
  private alive = true;
  private sceneFrame!: Phaser.GameObjects.Rectangle;
  /**
   * One outline per selected object, created on demand and reused.
   *
   * A pool rather than one outline per display object: outlines are drawn every
   * frame against the camera zoom, and a selection is a handful of objects in a
   * scene that may hold hundreds. Unused ones are simply hidden.
   */
  private selectionOutlines: Phaser.GameObjects.Rectangle[] = [];
  private scaleHandle!: Phaser.GameObjects.Rectangle;
  private rotateHandle!: Phaser.GameObjects.Arc;
  private unsubscribe?: () => void;

  /**
   * The state a corner-scale gesture needs to be resolved against its start
   * rather than against the previous frame, so a drag out and back returns the
   * object to the size it began at instead of accumulating rounding drift.
   */
  private scaling: {
    id: string;
    /** The object's unscaled bottom-right corner, in its own local space. */
    halfWidth: number;
    halfHeight: number;
    scaleX: number;
    scaleY: number;
    /** Corner minus pointer at grab time, so the handle doesn't jump to it. */
    grabOffsetX: number;
    grabOffsetY: number;
  } | null = null;

  /**
   * The state a rotate gesture is resolved against — its start, never the
   * previous frame, for the reason `scaling` is: turning out and back returns
   * the object to the angle it began at instead of accumulating the rounding of
   * every frame in between.
   */
  private rotating: {
    id: string;
    /**
     * The object's own origin, in its parent's space.
     *
     * Its `x`/`y` unconverted: that is already the space `transform.rotation`
     * lives in, and it is the point Phaser actually turns about — so a group
     * whose children sit off to one side swings the way the document says
     * rather than about the box that happens to be drawn round it.
     */
    pivotX: number;
    pivotY: number;
    /** `transform.rotation` at grab time, from the document, in degrees. */
    startRotation: number;
    /** Pivot-to-pointer angle at grab time, degrees, in the parent's space. */
    grabAngle: number;
    /** What the parent chain contributes: world angle = this + the local one. */
    parentRotation: number;
    /** Every other node's world angle and pivot, measured once at DRAG_START. */
    targets: AngleTarget[];
  } | null = null;

  /**
   * The move gesture in progress: which nodes it moves, where each of them
   * started, and where the pointer was when it began.
   *
   * Everything a press can move goes through this one shape — the object under
   * the finger, the group it belongs to, or the whole selection — because all
   * three are the same gesture: every node in the set follows the pointer's own
   * displacement from where it started.
   *
   * That displacement is computed here rather than taken from Phaser's
   * `dragX`/`dragY`, which describe only the object actually under the pointer.
   * For a press on a group's child that is the child, not the group — and a
   * group's own box is covered by the very children that give it one, so
   * without this a group could be selected but never moved on the canvas, which
   * on a phone is most of what a group is for. The two agree exactly for a
   * plain single-object drag, priming distance included.
   */
  private dragging: {
    nodes: { id: string; startX: number; startY: number }[];
    pointerX: number;
    pointerY: number;
    /**
     * The moving set's box where the gesture began, and everything it may
     * snap to — both measured once, at DRAG_START.
     *
     * Once, because the set translates rigidly: every node in it takes the
     * same world displacement, so the box after a move is the starting box
     * plus that displacement, and nothing being snapped *to* is moving at all.
     * Re-measuring each frame would instead feed the snapped position back in
     * as the next frame's input, which is how a snap turns into a drift.
     */
    startBounds: Rect | undefined;
    targets: Rect[];
    /** Whether the last move was held by a snap, per axis. See finishDrag. */
    snappedX: boolean;
    snappedY: boolean;
  } | null = null;
  /**
   * The lines the current snap is holding, redrawn each frame and cleared when
   * the gesture ends. Empty whenever nothing is snapped, which is also what
   * hides them.
   */
  private guides: Guide[] = [];
  /**
   * The equal gaps the current snap is claiming, on the same lifecycle as the
   * guides: rebuilt every frame of the gesture, empty the rest of the time.
   */
  private spacings: Spacing[] = [];
  /**
   * The angles the current rotate snap is claiming, on the same lifecycle as
   * the guides: rebuilt every frame of the gesture, empty the rest of the time.
   */
  private angleMarks: AngleMark[] = [];
  /** The degree readout for the current rotate snap, or null when nothing is. */
  private angleLabel: { text: string; x: number; y: number } | null = null;
  private guideGraphics!: Phaser.GameObjects.Graphics;
  /**
   * The physics-body outlines, redrawn whole every sync.
   *
   * A Graphics rather than an object per body, unlike the placed guides: a body
   * outline is never hit-tested — it is an annotation on an object that is
   * already grabbable, where a guide has nothing else to be grabbed by.
   */
  private bodyGraphics!: Phaser.GameObjects.Graphics;
  /**
   * One interactive rectangle per guide the user has placed, pooled the way the
   * selection outlines are.
   *
   * Objects rather than a signature-driven `Graphics` like the grid, because a
   * `Graphics` cannot be hit-tested line by line and grabbing one is the whole
   * point: everything about placing a guide with a thumb depends on being able
   * to press it afterwards.
   */
  private placedGuides: Phaser.GameObjects.Rectangle[] = [];
  /**
   * The guide a drag is moving, if any.
   *
   * `syncPlacedGuides` skips it for the reason the object sync skips
   * `draggingId`: the store rounds on release, and a rounded value arriving
   * mid-gesture fights the finger. Cleared *before* `endTransaction`, or the
   * sync that publishes the final position is skipped too and the guide sits
   * visually stale until something unrelated redraws it.
   */
  private draggingGuide: { id: string; axis: 'x' | 'y' } | null = null;
  /**
   * The ids of the guides holding the current snap, on the same lifecycle as
   * `guides` and `spacings`: rebuilt every frame of the gesture, empty the rest
   * of the time. What `syncPlacedGuides` recolours.
   */
  private heldGuides = new Set<string>();
  /**
   * Pooled overlay labels — the spacing bars' distances and the rotate
   * readout — created on first use. See `labelAt`.
   *
   * One pool, because the two gestures can never be in flight at once and a
   * second would be the same styling written twice. The counter and the hide
   * loop live in `update()` rather than in either drawer: scoped to one of
   * them, whichever ran second would blank the other's label.
   */
  private overlayLabels: Phaser.GameObjects.Text[] = [];
  private usedLabels = 0;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  /**
   * What the grid was last drawn for.
   *
   * The grid depends on the camera zoom as well as on the store — its lines are
   * one screen pixel wide, so it has to be redrawn on a pinch, which is not a
   * store change. Redrawing it unconditionally every frame is a few dozen line
   * segments for nothing; comparing a signature makes it a string compare on
   * the frames where nothing about it moved.
   */
  private gridSignature = '';
  private cameraGraphics!: Phaser.GameObjects.Graphics;
  /**
   * What the camera frame was last drawn for — `gridSignature`'s sibling, for
   * its reason: the frame's stroke is a screen width divided by the editor's
   * zoom, so a pinch has to redraw it, and a pinch is not a store change.
   */
  private cameraSignature = '';
  private isPanning = false;
  private pinchDistance = 0;
  /** Once the user has zoomed or panned, stop re-framing the view for them. */
  private cameraTouched = false;

  /**
   * Which scene the last sync drew, so that switching to another one re-frames
   * the camera.
   *
   * A switch is the one store change that replaces every object on screen at
   * once, and the camera it leaves behind belongs to the scene that is gone —
   * a pan over the corner of a 1920-wide level lands somewhere off the edge of
   * a 480-wide menu, on a canvas that is now empty for no visible reason. The
   * diff in `syncFromStore` handles the objects themselves with no help; this
   * is the one thing it cannot see, because both scenes are equally the
   * document's.
   */
  private drawnSceneId: string | null = null;
  /**
   * A drag Phaser started that we are choosing not to honour — a touch landing
   * on an object that wasn't selected yet. See DRAG_START.
   */
  private dragRejected = false;
  /**
   * What was selected when the current press began. DRAG_START has to compare
   * against this, not the live selection: GAMEOBJECT_DOWN has already selected
   * the object by then, so the live value would always match and the two-step
   * touch rule would never trigger.
   */
  private selectionAtPress: readonly string[] = [];
  /**
   * Whether the press that is running was additive, decided once when it
   * landed. DRAG_START cannot ask again: by then the pointer's event is a move,
   * and a Shift released after the press but before the drag would turn a
   * gesture that had just *deselected* an object into a drag of it.
   */
  private additivePress = false;

  constructor() {
    super(EditorScene.KEY);
  }

  create(): void {
    this.alive = true;
    // Before anything can ask for a texture: a sprite with no image yet still
    // has to be drawn, selected and dragged, so it gets a real stand-in rather
    // than nothing at all.
    this.createPlaceholderTexture();
    this.createNoTilesetTexture();
    this.createEmitterTexture();

    // Outline of the scene's own bounds, so the user can see where the game
    // canvas ends even when the camera is zoomed out past it.
    this.sceneFrame = this.add
      .rectangle(0, 0, 100, 100)
      .setOrigin(0)
      .setStrokeStyle(1, FRAME_COLOR)
      .setFillStyle()
      .setDepth(-1000);

    // Below the selection outline and the handle, above everything the user
    // draws: a guide is feedback about a gesture, and must never be mistaken
    // for something in the scene or cover the handle being dragged.
    this.guideGraphics = this.add.graphics().setDepth(999);

    // Above the selection outline (1000) and below the handles (1001), which is
    // a deliberate choice rather than an arbitrary slot. For an *unrotated*
    // object the two outlines are the same rectangle, so one of them is going
    // to be invisible — and it should be the selection: that a thing is
    // selected is already said by the two handles, by the move bar and by the
    // whole inspector panel, while this outline is the only thing anywhere on
    // the canvas that says the object has a body at all. On a rotated object
    // they separate on their own, the cyan turning with the object and the
    // green staying square, which is the difference worth being able to see.
    this.bodyGraphics = this.add.graphics().setDepth(1000.5);

    // Above the objects, so the cells stay visible over what has been painted,
    // and below the snap overlays and the handles — the placed guides' depth,
    // and the two can never be on screen at once.
    this.paintGraphics = this.add.graphics().setDepth(998).setVisible(false);

    // Above the scene frame and below everything the user draws: the grid is
    // the surface objects are placed on, so nothing in the scene may end up
    // behind it.
    this.gridGraphics = this.add.graphics().setDepth(-999);

    // Above every object and below the paint grid, the placed guides and the
    // gesture overlays. Above, because a camera frame hidden under a tilemap is
    // a camera frame that says nothing — the argument that puts the guides over
    // the objects. Below, because unlike a guide this is furniture nobody
    // grabs: it is not interactive at all, so it must never cover something
    // that is.
    this.cameraGraphics = this.add.graphics().setDepth(997);

    // Sits above the outline so it is never the outline that takes the press.
    this.scaleHandle = this.add
      .rectangle(0, 0, HANDLE_SIZE, HANDLE_SIZE, SELECTION_COLOR)
      .setDepth(1001)
      .setVisible(false);
    this.scaleHandle.setData('handle', 'scale');
    this.scaleHandle.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, HANDLE_SIZE, HANDLE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(this.scaleHandle);

    // A circle so that shape, not colour, tells the two handles apart at a
    // glance; both stay selection cyan because both belong to the selection.
    // The hit area is a Rectangle even so: `updateRotateHandle` then re-applies
    // it exactly as `updateScaleHandle` does, and an Arc's own origin
    // convention — the thing that produced the container hit-area bug — never
    // enters into it.
    this.rotateHandle = this.add
      .circle(0, 0, ROTATE_HANDLE_SIZE / 2, SELECTION_COLOR)
      .setDepth(1001)
      .setVisible(false);
    this.rotateHandle.setData('handle', 'rotate');
    this.rotateHandle.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, ROTATE_HANDLE_SIZE, ROTATE_HANDLE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(this.rotateHandle);

    this.registerInput();

    // Vanilla store subscription: Phaser lives outside React, so it reads the
    // same store directly rather than through props.
    this.unsubscribe = useEditorStore.subscribe((state) => this.syncFromStore(state));
    this.syncFromStore(useEditorStore.getState());
    this.zoomToFit();

    // At create() time the canvas may still be at its default size — the
    // ScaleManager has not measured the parent yet, which on a phone left the
    // scene framed for the wrong viewport and mostly off-screen. Re-fit on
    // resize until the user takes control of the camera themselves; that also
    // makes an orientation change do the right thing.
    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      if (!this.cameraTouched) this.zoomToFit();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.scale.off(Phaser.Scale.Events.RESIZE);
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      // Textures outlive scenes — they belong to the game — so an editor that
      // tore down and rebuilt its scene would otherwise leak every image the
      // user had ever imported.
      for (const key of this.assetTextures) this.textures.remove(key);
      this.assetTextures.clear();
      // Animations belong to the game's manager, exactly as textures belong to
      // the game's texture manager, so they leak the same way if left behind.
      for (const key of this.animationKeys) this.anims.remove(key);
      this.animationKeys.clear();
      this.animationForClip.clear();
      // A Tilemap is not a display object either, so the scene tearing down
      // does not take one with it. Same bookkeeping, same reason.
      for (const tilemap of this.tilemaps.values()) tilemap.destroy();
      this.tilemaps.clear();
      this.tileData.clear();
    });
  }

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------

  /**
   * A visible stand-in for a sprite that has no image yet, drawn once into a
   * canvas texture. Magenta because it should read as "unfinished", not as a
   * design choice — and it is nothing like the selection cyan or the accent.
   */
  private createPlaceholderTexture(): void {
    if (this.textures.exists(PLACEHOLDER_TEXTURE)) return;

    const canvas = document.createElement('canvas');
    canvas.width = PLACEHOLDER_SIZE;
    canvas.height = PLACEHOLDER_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#2a2f3a';
    context.fillRect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
    context.strokeStyle = '#ff6bd6';
    context.lineWidth = 2;
    context.setLineDash([6, 4]);
    context.strokeRect(1, 1, PLACEHOLDER_SIZE - 2, PLACEHOLDER_SIZE - 2);
    context.setLineDash([]);
    context.fillStyle = '#ff6bd6';
    context.font = '600 40px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('?', PLACEHOLDER_SIZE / 2, PLACEHOLDER_SIZE / 2 + 2);

    this.textures.addCanvas(PLACEHOLDER_TEXTURE, canvas);
  }

  /**
   * The stand-in tileset: one square, added as a sheet so a Tileset can be
   * built from it exactly as from a real one.
   *
   * A checker rather than the '?' the sprite placeholder draws, because this
   * one is tiled hundreds of times across a map — a field of question marks
   * reads as a bug, while a flat square reads as "nothing here yet", which is
   * what it is.
   */
  private createNoTilesetTexture(): void {
    if (this.textures.exists(NO_TILESET_TEXTURE)) return;

    const canvas = document.createElement('canvas');
    canvas.width = NO_TILESET_TILE;
    canvas.height = NO_TILESET_TILE;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#2a2f3a';
    context.fillRect(0, 0, NO_TILESET_TILE, NO_TILESET_TILE);
    context.strokeStyle = '#ff6bd6';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, NO_TILESET_TILE - 1, NO_TILESET_TILE - 1);

    // A plain canvas texture: `addTilesetImage` cuts tiles out of the source
    // image with its own tile size, margin and spacing, and never reads the
    // texture's frames — so a sheet here would be a cut nothing looks at.
    this.textures.addCanvas(NO_TILESET_TEXTURE, canvas);
  }

  /**
   * The marker drawn for an emitter that is not emitting: a spray of filled
   * discs, in the placeholder's colours so the editor's own stand-ins read as
   * one family.
   *
   * Not tracked in `assetTextures`: that set is the keys built *from the
   * document's images*, and removing an editor stand-in along with them would
   * take out a texture every emitter still needs — the same reason Phaser's
   * own `__DEFAULT` is not removed by guesswork.
   */
  private createEmitterTexture(): void {
    if (this.textures.exists(EMITTER_TEXTURE)) return;

    const canvas = document.createElement('canvas');
    canvas.width = EMITTER_SIZE;
    canvas.height = EMITTER_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#2a2f3a';
    context.fillRect(0, 0, EMITTER_SIZE, EMITTER_SIZE);

    const middle = EMITTER_SIZE / 2;
    context.fillStyle = '#ff6bd6';
    // One large disc at the origin — which is where the emitter actually is —
    // and four smaller ones thrown off it, so the marker says "a source" and
    // not merely "an object".
    const discs: [number, number, number][] = [
      [middle, middle, 13],
      [middle - 24, middle - 20, 7],
      [middle + 22, middle - 26, 5],
      [middle + 27, middle + 21, 8],
      [middle - 27, middle + 25, 6],
    ];
    for (const [x, y, radius] of discs) {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    this.textures.addCanvas(EMITTER_TEXTURE, canvas);
  }

  /**
   * Brings the game's textures in line with the document's asset table.
   *
   * The document holds data URLs; Phaser needs decoded images. Decoding is
   * asynchronous and this sync is not, so an asset whose image is not in the
   * decode cache yet — every asset in a project that was just opened — starts a
   * decode and re-runs the sync when it lands. Until then its sprites draw the
   * placeholder, which is the same thing they show for an image that has been
   * deleted, and is why that placeholder exists at all.
   */
  private syncTextures(project: Project): void {
    const wanted = new Set<string>();

    for (const asset of project.assets) {
      const key = textureKeyForAsset(asset);
      wanted.add(key);
      if (this.textures.exists(key)) continue;

      const image = decodedImage(asset.dataUrl);
      if (image) {
        const sheet = frameGridOf(asset);
        // The grid is handed to Phaser's own sprite-sheet parser rather than
        // cut here, so the frames the editor draws are the very frames
        // `load.spritesheet` will cut from the same numbers in exported code.
        if (sheet) this.textures.addSpriteSheet(key, image, { ...sheet });
        else this.textures.addImage(key, image);
        this.assetTextures.add(key);
      } else if (!this.decoding.has(asset.dataUrl)) {
        this.decoding.add(asset.dataUrl);
        void decodeImage(asset.dataUrl)
          .catch(() => undefined)
          .then(() => {
            this.decoding.delete(asset.dataUrl);
            // A decode that resolves after the scene is gone must not touch it.
            if (this.alive) this.syncFromStore(useEditorStore.getState());
          });
      }
    }

    for (const key of this.assetTextures) {
      if (wanted.has(key)) continue;
      this.textures.remove(key);
      this.assetTextures.delete(key);
    }
  }

  /** The texture a sprite should be drawn with, falling back to the placeholder. */
  private textureKeyFor(project: Project, assetId: string | null): string {
    const asset = findAsset(project, assetId);
    if (!asset) return PLACEHOLDER_TEXTURE;
    const key = textureKeyForAsset(asset);
    return this.textures.exists(key) ? key : PLACEHOLDER_TEXTURE;
  }

  /**
   * The texture a tilemap should cut its tiles from.
   *
   * `textureKeyFor` for tilesets, with one extra condition: an image that has
   * not been sliced is not a tileset. Its "one frame" would be the whole
   * picture, which `addTilesetImage` would then cut into tile-sized pieces
   * nobody chose — so it falls back to the stand-in and the inspector says to
   * slice it, rather than drawing a plausible-looking wrong answer.
   */
  private tilesetKeyFor(project: Project, assetId: string | null): string {
    const asset = findAsset(project, assetId);
    if (!asset || !frameGridOf(asset)) return NO_TILESET_TEXTURE;
    const key = textureKeyForAsset(asset);
    return this.textures.exists(key) ? key : NO_TILESET_TEXTURE;
  }

  /**
   * Builds the `Tilemap` and the layer that draws it.
   *
   * The map is parsed from a plain 2D array, which is the one shape Phaser
   * builds a map from without a Tiled file — and it is the same array the
   * exporter writes into its `TILEMAPS` table, so the canvas and the generated
   * game are cut from one description.
   *
   * Neither `addTilesetImage` nor `createLayer` can fail here, which is what
   * the two assertions say: the first returns null only for a texture key that
   * does not exist, and `tilesetKeyFor` has just checked; the second only for a
   * layer id that is missing or already built, and this map was made one line
   * above with exactly one layer in it.
   */
  private createTilemapLayer(props: TilemapProps, key: string): Phaser.Tilemaps.TilemapLayer {
    const map = tileMapOf(this.syncing, props);
    const textureKey = this.tilesetKeyFor(this.syncing, props.assetId);
    const grid = frameGridOf(map.asset);

    const rows = Array.from({ length: map.rows }, (_, row) =>
      map.data.slice(row * map.columns, (row + 1) * map.columns),
    );
    const tilemap = this.make.tilemap({
      data: rows,
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight,
    });
    const tileset = tilemap.addTilesetImage(
      'tiles',
      textureKey,
      map.tileWidth,
      map.tileHeight,
      grid ? grid.margin : 0,
      grid ? grid.spacing : 0,
    )!;
    // `gpu: false` by explicit omission, and the cast is that decision: a GPU
    // layer would need `generateLayerDataTexture()` after every stroke and
    // cannot mix tilesets, and the declared return covers both kinds.
    const layer = tilemap.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;

    this.tilemaps.set(key, tilemap);
    // What is on screen, so `applyNode`'s diff starts from the truth rather
    // than from an assumption about it.
    this.tileData.set(key, map.data);
    return layer;
  }

  /**
   * What this node's display object was built from, or undefined for a node
   * whose object can always be updated in place.
   *
   * Undefined for every type but `tilemap`, which is what lets `syncNodes`
   * compare it unconditionally: the stored value is undefined too, so the
   * comparison is trivially equal and costs nothing for the other five.
   */
  private shapeOf(node: GameObjectNode): string | undefined {
    if (node.type !== 'tilemap') return undefined;
    return tilemapSignatureOf(
      tileMapOf(this.syncing, node.props),
      this.tilesetKeyFor(this.syncing, node.props.assetId),
    );
  }

  /**
   * Destroys a drawn object and everything held alongside it under its key.
   *
   * Both the sync's prune and its "the type changed, rebuild it" branch go
   * through here, because a tilemap's `Tilemap` and its drawn tile cache are
   * not the display object and a bare `destroy()` leaks both.
   */
  private destroyDisplayObject(key: string, object: Renderable): void {
    object.destroy();
    this.displayObjects.delete(key);
    this.containerBounds.delete(key);
    this.tilemaps.get(key)?.destroy();
    this.tilemaps.delete(key);
    this.tileData.delete(key);
    // The container's own `destroy` takes the emitter and the marker with it,
    // so only the two lookups have to be dropped by hand.
    this.emitters.delete(key);
    this.emitterConfigs.delete(key);
  }

  /**
   * Brings the game's animation manager in line with the document's clips.
   *
   * The same diff `syncTextures` runs, for the same reason and with the same
   * signature trick: an `Animation` is built from its frames when it is
   * created, so an edited clip is a different animation rather than a changed
   * one, and the key carries enough of the clip that editing it makes the old
   * key unwanted and the new one missing.
   *
   * A clip whose texture has not decoded yet is simply skipped. The decode
   * re-runs the whole sync when it lands, which is the same path that gets its
   * sprites off the placeholder.
   */
  private syncAnimations(project: Project): void {
    const wanted = new Set<string>();
    this.animationForClip.clear();

    for (const clip of project.animations) {
      const asset = findAsset(project, clip.assetId);
      if (!asset) continue;
      const textureKey = textureKeyForAsset(asset);
      if (!this.textures.exists(textureKey)) continue;

      // Frames are clamped against the texture actually loaded, not against the
      // document's idea of the grid: `generateFrameNumbers` on a frame the
      // texture does not have produces an animation that renders nothing.
      const texture = this.textures.get(textureKey);
      const frames = clip.frames.filter((frame) => texture.has(String(frame)));
      if (frames.length === 0) continue;

      const key = animationKeyFor(clip, textureKey);
      this.animationForClip.set(clip.id, key);
      wanted.add(key);
      if (this.anims.exists(key)) continue;

      this.anims.create({
        key,
        frames: frames.map((frame) => ({ key: textureKey, frame })),
        frameRate: clip.frameRate,
        repeat: clip.repeat,
      });
      this.animationKeys.add(key);
    }

    for (const key of this.animationKeys) {
      if (wanted.has(key)) continue;
      this.anims.remove(key);
      this.animationKeys.delete(key);
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private registerInput(): void {
    const store = useEditorStore;

    // A finger never holds perfectly still. Without a threshold, a tap meant to
    // select registers as a one-pixel drag and opens a pointless undo step.
    this.input.dragDistanceThreshold = 8;

    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_DOWN,
      (pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
        const id = object.getData('nodeId') as string | undefined;
        if (!id) return;
        const state = store.getState();
        // The press has already been taken by the stroke. Selecting here as
        // well would move the inspector off the map being painted, and on touch
        // would re-arm the two-step rule against whatever was grazed.
        if (state.paintingId) return;
        this.selectionAtPress = state.selectedIds;
        this.additivePress = this.isAdditive(pointer);

        // Additive: the press adds this object to the selection or takes it out
        // again, and never starts a move. Separating the two is what makes
        // building a selection on a phone possible at all — a press that both
        // extended the selection and began dragging it would move everything
        // already picked every time another object was added.
        if (this.additivePress) {
          state.toggleSelect(id);
          return;
        }

        // Pressing something already selected leaves the selection alone, so
        // the press can go on to move it — that is what makes a multi-object
        // drag possible, and it is the same rule that lets a press inside a
        // selected group move the group. Selecting one of a group's children
        // takes a press with the group not selected, or the scene tree.
        if (state.selectedIds.length > 1 && state.selectedIds.includes(id)) return;
        if (this.proxyTargetFor(id)) return;
        store.getState().select(id);
      },
    );

    // A press that hits nothing clears the selection and starts a camera pan.
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        // Paint mode owns the canvas: while it is on, a press lays a tile and
        // does nothing else. It is handled here rather than in GAMEOBJECT_DOWN
        // because a press outside the map still has to end the stroke's
        // transaction cleanly, and because a cell can be reached over empty
        // canvas on the way back into the map.
        if (this.beginPaint(pointer)) return;
        if (currentlyOver.length > 0) return;
        this.selectionAtPress = [];
        this.additivePress = false;
        store.getState().select(null);
        this.isPanning = true;
      },
    );

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.isPanning = false;
      this.pinchDistance = 0;
      this.finishPaint();
      // Not just DRAG_END: if Phaser never emits one, an open transaction would
      // silently swallow every later edit's undo entry.
      this.finishDrag();
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.painting) {
        if (pointer.isDown) this.paintAt(pointer);
        return;
      }
      if (!this.isPanning || !pointer.isDown || this.pinchDistance > 0) return;
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
      this.cameraTouched = true;
    });

    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        this.zoomBy(dy > 0 ? 0.9 : 1.1, pointer.x, pointer.y);
      },
    );

    // Phaser's own drag system handles the pointer bookkeeping and the 8px
    // threshold; the positions it reports are ignored in favour of the pointer's
    // world coordinates, which are the same for every node the gesture moves.
    this.input.on(
      Phaser.Input.Events.DRAG_START,
      (pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
        // Nothing on the canvas is draggable while a map is being painted. The
        // press has already gone to the stroke, and the handles are hidden, so
        // this is the `additivePress` refusal below by a different route: a
        // gesture that meant one thing must not also mean another.
        if (store.getState().paintingId) {
          this.dragRejected = true;
          return;
        }

        // The handle first, and before the touch rule below: it carries no
        // nodeId, so that rule would compare null against the selection, decide
        // they differ and reject every scale drag made with a finger.
        if (object.getData('handle') === 'scale') {
          this.beginScale(pointer);
          return;
        }

        // The rotate knob is here for exactly the same reasons, and it only
        // exists while one object is selected, so the two-step rule has already
        // been satisfied by the time a finger can reach it.
        if (object.getData('handle') === 'rotate') {
          this.beginRotate(pointer);
          return;
        }

        // And a guide, for the first of those two reasons: it carries no
        // nodeId, so the touch rule below would compare null against the
        // selection, find they differ and reject every guide drag made with a
        // finger. It is exempt on its own merits as well — the two-step rule
        // exists because a fingertip lands on whichever *object* it grazed, and
        // a guide is chrome the user aimed at deliberately.
        if (object.getData('handle') === 'guide') {
          const id = object.getData('guideId') as string | undefined;
          const axis = object.getData('guideAxis') as 'x' | 'y' | undefined;
          if (!id || !axis) return;
          this.draggingGuide = { id, axis };
          this.dragRejected = false;
          store.getState().beginTransaction();
          return;
        }

        // An additive press is a selection change and nothing else; letting
        // Phaser turn it into a drag would move the object you were only trying
        // to add to the selection.
        if (this.additivePress) {
          this.dragRejected = true;
          return;
        }

        const pressed = (object.getData('nodeId') as string | undefined) ?? null;
        // A press inside a selected group moves the group, not the child.
        const id = this.proxyTargetFor(pressed) ?? pressed;

        // Touch is a two-step interaction: the first press only selects, and
        // only an already-selected object can then be dragged. A fingertip
        // covers far more than a cursor, so honouring the first touch as a drag
        // moved whichever object it happened to graze. A mouse is precise
        // enough that press-and-drag in one gesture is still the right feel.
        if (pointer.wasTouch && (!id || !this.selectionAtPress.includes(id))) {
          this.dragRejected = true;
          return;
        }

        const state = store.getState();
        const children = activeScene(state.project).children;
        const selected = selectionRoots(children, state.selectedIds);
        // Pressing one of several selected objects moves all of them; pressing
        // anything else moves only what was pressed, which is also what makes a
        // mouse press-and-drag on an unselected object still work.
        const movesSelection = id !== null && selected.length > 1 && selected.includes(id);
        const ids = movesSelection ? selected : id ? [id] : [];

        const nodes = ids.flatMap((nodeId) => {
          const node = findNode(children, nodeId);
          return node
            ? [{ id: nodeId, startX: node.transform.x, startY: node.transform.y }]
            : [];
        });
        if (nodes.length === 0) {
          this.dragRejected = true;
          return;
        }

        this.dragRejected = false;
        this.dragging = {
          nodes,
          pointerX: pointer.worldX,
          pointerY: pointer.worldY,
          startBounds: this.boundsOfSet(nodes.map((item) => item.id)),
          targets: this.snapTargetsFor(nodes.map((item) => item.id), state.project),
          snappedX: false,
          snappedY: false,
        };
        // One undo entry per drag, not one per pointer-move.
        store.getState().beginTransaction();
      },
    );

    this.input.on(
      Phaser.Input.Events.DRAG,
      (pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
        if (object.getData('handle') === 'scale') {
          // The scale is a function of where the pointer is relative to the
          // object, so this gesture reads the pointer directly.
          this.applyScale(pointer);
          return;
        }

        if (object.getData('handle') === 'rotate') {
          this.applyRotate(pointer);
          return;
        }

        // A guide follows the pointer on its own axis and ignores the other.
        // It does not snap: a guide is the thing objects snap *to*, so pulling
        // it onto an object's edge would only say that edge twice, and the
        // interesting case — a guide on a round number — is the grid's job and
        // the inspector's.
        const guide = this.draggingGuide;
        if (guide) {
          const line = object as Phaser.GameObjects.Rectangle;
          const position = guide.axis === 'x' ? pointer.worldX : pointer.worldY;
          line[guide.axis] = position;
          store.getState().moveGuide(guide.id, position);
          return;
        }

        const drag = this.dragging;
        if (this.dragRejected || !drag) return;

        // Every node in the set moves by the same pointer displacement, each
        // measured in the space its own position lives in, so objects sitting
        // in differently transformed groups still travel together. The
        // transaction DRAG_START opened covers all of it.
        //
        // Exact floats while the finger is down; finishDrag rounds once at the
        // end. Rounding per-move would step in whole world units, which is
        // visible as stutter when the camera is zoomed in.
        // The correction is worked out once, in world space, on the box the
        // whole set occupies — then folded into the pointer position every node
        // is measured against, so one snap moves the set as one piece. Snapping
        // per node would pull each of them onto a different line and tear the
        // selection apart.
        const target = this.snappedPointer(drag, pointer);

        for (const item of drag.nodes) {
          const moving = this.displayObjects.get(item.id);
          if (!moving) continue;
          const from = this.toParentSpace(moving, { x: drag.pointerX, y: drag.pointerY });
          const to = this.toParentSpace(moving, target);
          store.getState().updateTransform(item.id, {
            x: item.startX + to.x - from.x,
            y: item.startY + to.y - from.y,
          });
        }
      },
    );

    // Every way a gesture can end routes here, because on a real device several
    // of them fire and some of them don't: DRAG_END, a normal pointer up, a
    // pointer released off-canvas, or the browser cancelling the touch outright
    // when it decides the gesture was a scroll.
    const endGesture = () => {
      this.isPanning = false;
      this.pinchDistance = 0;
      // A stroke ends on every one of these for the reason a drag does: a
      // browser that reclaims the gesture fires only `pointercancel`, and a
      // transaction left open swallows every later edit's undo step.
      this.finishPaint();
      this.finishDrag();
    };

    this.input.on(Phaser.Input.Events.DRAG_END, endGesture);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endGesture);
    this.game.canvas.addEventListener('pointercancel', endGesture);
    this.game.canvas.addEventListener('touchcancel', endGesture);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.canvas?.removeEventListener('pointercancel', endGesture);
      this.game.canvas?.removeEventListener('touchcancel', endGesture);
    });
  }

  /**
   * Closes an open drag, whatever ended it, and snaps the final position to
   * whole pixels.
   *
   * Idempotent on purpose: on a real device more than one of DRAG_END,
   * POINTER_UP, POINTER_UP_OUTSIDE and pointercancel can fire for the same
   * gesture, and sometimes only one of them does. Calling this from all of them
   * is what makes a drag end reliably rather than depending on which events the
   * browser chose to send.
   */
  private finishDrag(): void {
    this.dragRejected = false;
    this.guides = [];
    this.spacings = [];
    this.angleMarks = [];
    this.angleLabel = null;
    this.heldGuides.clear();

    // A guide gesture ends here with the rest of them, and for the same reason:
    // several of the end events fire on a real device and sometimes only one
    // does, and a transaction left open swallows every later edit's undo step.
    if (this.draggingGuide) {
      const { id, axis } = this.draggingGuide;
      const store = useEditorStore.getState();
      const scene = activeScene(store.project);
      const guide = guidesOf(scene).find((candidate) => candidate.id === id);
      // Nulled before the store writes, for the reason `draggingId` had to be:
      // `endTransaction` publishes a change, and the sync it triggers is what
      // settles the guide on its final position. Still standing, that sync is
      // skipped and the guide sits stale until something unrelated redraws it.
      this.draggingGuide = null;
      if (guide) {
        // Released outside the scene, it is thrown away — the convention every
        // editor with rulers uses, and the one deletion gesture that needs no
        // control on a 390px screen. Inside the same transaction, so dragging a
        // guide off is one undo step and not two.
        const limit = axis === 'x' ? scene.width : scene.height;
        if (guide.position < 0 || guide.position > limit) store.removeGuide(id);
        else store.moveGuide(id, Math.round(guide.position));
      }
      store.endTransaction();
    }

    // A scale gesture ends through exactly the same paths as a move, for the
    // same reason: on a real device several of them fire and some of them
    // don't, and a transaction left open swallows every later edit's undo step.
    if (this.scaling) {
      const { id } = this.scaling;
      this.scaling = null;
      const store = useEditorStore.getState();
      const node = findNode(activeScene(store.project).children, id);
      if (node) {
        // Settle on a readable number, the way a move settles on whole pixels.
        // Inside the transaction, so it is part of the same undo step and not a
        // second one the user never asked for.
        store.updateTransform(id, {
          scaleX: roundScale(node.transform.scaleX),
          scaleY: roundScale(node.transform.scaleY),
        });
      }
      store.endTransaction();
    }

    // And a rotate gesture, on the same footing.
    if (this.rotating) {
      const { id } = this.rotating;
      // Nulled before the store write, for the reason `draggingId` had to be:
      // `endTransaction` publishes a change, and gesture state still standing
      // when that sync runs is how an edit ends up looking like it only applies
      // once you press something else.
      this.rotating = null;
      const store = useEditorStore.getState();
      const node = findNode(activeScene(store.project).children, id);
      if (node) store.updateTransform(id, { rotation: roundRotation(node.transform.rotation) });
      store.endTransaction();
    }

    const drag = this.dragging;
    if (!drag) return;
    this.dragging = null;

    const store = useEditorStore;
    for (const item of drag.nodes) {
      const node = findNode(activeScene(store.getState().project).children, item.id);
      if (!node) continue;
      // Whole pixels, except on an axis a snap is holding: rounding there
      // would undo by up to half a pixel the alignment the snap had just made,
      // which is exactly the thing the gesture was for. A snapped axis settles
      // on three decimals instead — finer than the eye at any zoom, and enough
      // to keep 479.99999999999994 out of the inspector.
      store.getState().updateTransform(item.id, {
        x: drag.snappedX ? roundPosition(node.transform.x) : Math.round(node.transform.x),
        y: drag.snappedY ? roundPosition(node.transform.y) : Math.round(node.transform.y),
      });
    }
    store.getState().endTransaction();
  }

  // ---------------------------------------------------------------------------
  // Snapping
  // ---------------------------------------------------------------------------

  /** The box a set of nodes occupies together, as last drawn. */
  private boundsOfSet(ids: readonly string[]): Rect | undefined {
    const boxes = ids.flatMap((id) => {
      const object = this.displayObjects.get(id);
      if (!object) return [];
      const bounds = this.worldBoundsOf(object);
      return [{ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }];
    });
    return unionRect(boxes);
  }

  /**
   * Everything the moving set may snap to: every other drawn object, plus the
   * scene rectangle itself.
   *
   * Three kinds of node are deliberately left out. The moving nodes and
   * anything inside them travel with the gesture, so they are not lines to
   * catch on. An *ancestor* of a moving node is excluded for a subtler reason:
   * a container's box is the union of its children, so dragging a child changes
   * the very box it would be snapping to — the target would chase the gesture.
   * And a hidden object is not on screen, so a guide leading to it would point
   * at nothing.
   *
   * The scene rectangle is in for the case with no other objects at all:
   * centring the first object of a new project is the most common alignment
   * there is, and it has nothing else to line up against.
   *
   * A prefab's contents drop out on their own: their display keys name no
   * document node, so `findNode` returns nothing for them. That is the right
   * answer rather than a lucky one — an instance snaps as one object, because
   * one object is what it is.
   */
  private snapTargetsFor(moving: readonly string[], project: Project): Rect[] {
    const roots = activeScene(project).children;
    const movingNodes = moving.flatMap((id) => findNode(roots, id) ?? []);

    const targets: Rect[] = [];
    for (const [id, object] of this.displayObjects) {
      if (!object.visible) continue;
      const node = findNode(roots, id);
      if (!node) continue;
      const related = movingNodes.some(
        (movingNode) => containsNode(movingNode, id) || containsNode(node, movingNode.id),
      );
      if (related) continue;
      const bounds = this.worldBoundsOf(object);
      targets.push({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    }

    const scene = activeScene(project);
    targets.push({ x: 0, y: 0, width: scene.width, height: scene.height });
    return targets;
  }

  /**
   * Where the pointer should be treated as being, once the snap has had its
   * say — the raw position when snapping is off or nothing is in range.
   *
   * Returning a pointer position rather than a corrected object position is
   * what lets the per-node loop stay exactly as it was: every node already
   * converts this one world point into its own parent space, so a group inside
   * a rotated container snaps correctly with no extra maths.
   */
  private snappedPointer(
    drag: NonNullable<EditorScene['dragging']>,
    pointer: Phaser.Input.Pointer,
  ): { x: number; y: number } {
    const raw = { x: pointer.worldX, y: pointer.worldY };
    drag.snappedX = false;
    drag.snappedY = false;
    this.guides = [];
    this.spacings = [];
    this.heldGuides.clear();

    const start = drag.startBounds;
    const state = useEditorStore.getState();
    const { snapEnabled, gridEnabled, gridSize, guidesVisible } = state;
    if (!start || (!snapEnabled && !gridEnabled)) return raw;

    const moved: Rect = {
      ...start,
      x: start.x + raw.x - drag.pointerX,
      y: start.y + raw.y - drag.pointerY,
    };
    // Every toggle is expressed by withholding what it feeds the geometry
    // rather than by a flag it has to interpret: no targets is no object
    // snapping, no pitch is no grid, no lines is no guides. Guides ride on the
    // magnet rather than a switch of their own — it already means "agree with
    // something specific" — and are withheld when they are hidden too, by the
    // rule that keeps hidden objects out of the targets: a snap onto a line
    // that is not on screen is the editor moving things for a reason the user
    // cannot see.
    const result = snapMove(
      moved,
      snapEnabled ? drag.targets : [],
      SNAP_THRESHOLD / this.cameras.main.zoom,
      {
        grid: gridEnabled ? gridSize : 0,
        guides: snapEnabled && guidesVisible ? this.guideLinesFor(state.project) : undefined,
      },
    );

    drag.snappedX = result.dx !== 0;
    drag.snappedY = result.dy !== 0;
    this.guides = result.guides;
    this.spacings = result.spacings;
    // Positions come back rather than ids — `snapping.ts` knows nothing about
    // the document — so the guides holding the drag are matched back here.
    for (const guide of guidesOf(activeScene(state.project))) {
      if (result.guideLines[guide.axis].includes(guide.position)) {
        this.heldGuides.add(guide.id);
      }
    }
    return { x: raw.x + result.dx, y: raw.y + result.dy };
  }

  /**
   * Redraws the guides for the current frame.
   *
   * Cleared and rebuilt every frame rather than diffed: there are at most a
   * handful of them, they change on every pointer move, and a Graphics object
   * makes one draw call for all of them however many there are. The line width
   * is divided by the camera zoom for the same reason the selection outline's
   * is — a guide is a screen-space annotation, not something in the scene.
   */
  private drawGuides(): void {
    this.guideGraphics.clear();
    if (this.guides.length === 0) return;

    this.guideGraphics.lineStyle(GUIDE_WIDTH / this.cameras.main.zoom, GUIDE_COLOR, 1);
    for (const guide of this.guides) {
      if (guide.axis === 'x') {
        this.guideGraphics.lineBetween(guide.position, guide.from, guide.position, guide.to);
      } else {
        this.guideGraphics.lineBetween(guide.from, guide.position, guide.to, guide.position);
      }
    }
  }

  /**
   * Draws the equal gaps the current snap is claiming, as capped bars with the
   * distance on them.
   *
   * The bar and its caps go on the guide layer, in the guide colour: it is the
   * same feedback about the same gesture, and a second palette would only ask
   * the user to learn which magenta means what. What separates the two is the
   * shape — a guide runs *through* objects, a bar runs *between* them and stops
   * at a cap on each side.
   *
   * The number matters more than it looks. Two gaps a few pixels apart are
   * indistinguishable at a glance, so a pair of bare bars is a claim the user
   * has to take on trust; "24" twice is a claim they can check.
   */
  private drawSpacings(): void {
    if (this.spacings.length > 0) {
      const { zoom } = this.cameras.main;
      const cap = SPACING_CAP / zoom;
      this.guideGraphics.lineStyle(GUIDE_WIDTH / zoom, GUIDE_COLOR, 1);

      for (const spacing of this.spacings) {
        // Too small to draw as a gap: the caps alone would overlap, and two
        // objects that close read as touching rather than as spaced.
        if (spacing.distance * zoom < MIN_SPACING) continue;
        const middle = (spacing.from + spacing.to) / 2;

        if (spacing.axis === 'x') {
          this.guideGraphics.lineBetween(spacing.from, spacing.cross, spacing.to, spacing.cross);
          this.guideGraphics.lineBetween(spacing.from, spacing.cross - cap, spacing.from, spacing.cross + cap);
          this.guideGraphics.lineBetween(spacing.to, spacing.cross - cap, spacing.to, spacing.cross + cap);
        } else {
          this.guideGraphics.lineBetween(spacing.cross, spacing.from, spacing.cross, spacing.to);
          this.guideGraphics.lineBetween(spacing.cross - cap, spacing.from, spacing.cross + cap, spacing.from);
          this.guideGraphics.lineBetween(spacing.cross - cap, spacing.to, spacing.cross + cap, spacing.to);
        }

        const label = this.labelAt(this.usedLabels);
        this.usedLabels += 1;
        label
          .setVisible(true)
          .setText(String(Math.round(spacing.distance)))
          .setScale(1 / zoom)
          .setPosition(
            spacing.axis === 'x' ? middle : spacing.cross,
            spacing.axis === 'x' ? spacing.cross : middle,
          );
      }
    }

  }

  /**
   * The oriented ticks for a rotation agreement: one through the turned
   * object's pivot and one through each object it caught on.
   *
   * On the guide layer and in the guide colour, because it is the same feedback
   * about the same kind of gesture and a second magenta would only ask the user
   * to learn which is which. What the tick cannot do is carry the claim: two
   * objects at 37° share a *direction*, which has no position, so the segment
   * is drawn somewhere chosen rather than on a locus both objects genuinely sit
   * on. That is what the readout below is for, and it is why the tick is never
   * drawn without it.
   */
  private drawAngleMarks(): void {
    if (this.angleMarks.length === 0) return;
    const { zoom } = this.cameras.main;
    const half = ANGLE_MARK_LENGTH / zoom / 2;
    this.guideGraphics.lineStyle(GUIDE_WIDTH / zoom, GUIDE_COLOR, 1);

    for (const mark of this.angleMarks) {
      const radians = Phaser.Math.DegToRad(mark.angle);
      const dx = Math.cos(radians) * half;
      const dy = Math.sin(radians) * half;
      this.guideGraphics.lineBetween(mark.x - dx, mark.y - dy, mark.x + dx, mark.y + dy);
    }
  }

  /**
   * The degree readout for a rotation snap — the half of the feedback that is
   * checkable.
   *
   * Two tilts three degrees apart are indistinguishable at a glance, exactly as
   * two gaps a few pixels apart are, so the number does here what the spacing
   * bars' labels do there: it turns a claim the user has to take on trust into
   * one they can read. For a step snap it is the whole of the feedback, since
   * there is no protractor on the canvas for the angle to visibly land on.
   */
  private drawAngleLabel(): void {
    const readout = this.angleLabel;
    if (!readout) return;
    const { zoom } = this.cameras.main;
    this.labelAt(this.usedLabels)
      .setVisible(true)
      .setText(readout.text)
      .setScale(1 / zoom)
      .setPosition(readout.x, readout.y);
    this.usedLabels += 1;
  }

  /**
   * The nth pooled overlay label, created on first use.
   *
   * Pooled, so the labels a busier frame created are parked rather than
   * destroyed — a gesture creates and drops these several times a second.
   */
  private labelAt(index: number): Phaser.GameObjects.Text {
    let label = this.overlayLabels[index];
    if (!label) {
      label = this.add
        .text(0, 0, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#ffffff',
          // A filled chip rather than bare text: the label sits on top of
          // whatever the user is dragging over, and white on an arbitrary
          // background is only legible by luck.
          backgroundColor: '#ff3ea5',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(999)
        .setVisible(false);
      this.overlayLabels[index] = label;
    }
    return label;
  }

  /**
   * Redraws the grid when anything it depends on has changed.
   *
   * Anchored at the scene origin and clipped to the scene rectangle, rather
   * than filling the viewport: the grid is a property of the scene being built,
   * and one that carried on past the frame would say the space outside it is
   * somewhere objects belong.
   *
   * Lines are one screen pixel at any zoom, for the reason every other overlay
   * here is — but unlike the others the grid can be asked to draw hundreds of
   * them, so below a few pixels a square it draws none at all.
   */
  private drawGrid(): void {
    const { gridEnabled, gridSize } = useEditorStore.getState();
    const scene = activeScene(useEditorStore.getState().project);
    const { zoom } = this.cameras.main;
    const visible = gridEnabled && gridSize * zoom >= MIN_GRID_PIXELS;
    const signature = visible
      ? `${gridSize}:${zoom}:${scene.width}:${scene.height}`
      : '';
    if (signature === this.gridSignature) return;
    this.gridSignature = signature;

    this.gridGraphics.clear();
    if (!visible) return;

    this.gridGraphics.lineStyle(1 / zoom, GRID_COLOR, GRID_ALPHA);
    for (let x = gridSize; x < scene.width; x += gridSize) {
      this.gridGraphics.lineBetween(x, 0, x, scene.height);
    }
    for (let y = gridSize; y < scene.height; y += gridSize) {
      this.gridGraphics.lineBetween(0, y, scene.width, y);
    }
  }

  /**
   * Draws the user's guides, and keeps each one grabbable.
   *
   * Every frame rather than on a store change, because the two things that
   * decide a guide's size on screen — its two-pixel thickness and its grab band
   * — are both functions of the camera zoom, and a pinch is not a store change.
   * Re-applying the hit area each time is the same trap the scale handle
   * documents: `setSize` does not carry the hit area with it, so a guide whose
   * band was set at one zoom is grabbable in the wrong place at the next.
   *
   * Depth 998: above the objects and the grid, because a guide hidden behind a
   * rectangle is neither visible nor grabbable; below the snap guides, the
   * selection outline and the handles at 999+, which describe the gesture
   * actually in progress and must never be covered by the furniture.
   */
  private syncPlacedGuides(): void {
    const { project, guidesVisible } = useEditorStore.getState();
    const scene = activeScene(project);
    const guides = guidesVisible ? guidesOf(scene) : [];
    const { zoom } = this.cameras.main;
    const thickness = PLACED_GUIDE_WIDTH / zoom;
    const band = PLACED_GUIDE_TOUCH / zoom;

    guides.forEach((guide, index) => {
      let line = this.placedGuides[index];
      if (!line) {
        line = this.add.rectangle(0, 0, 1, 1, PLACED_GUIDE_COLOR).setDepth(998);
        line.setData('handle', 'guide');
        this.placedGuides.push(line);
      }

      // The guide under the finger keeps the position the gesture gave it; the
      // store catches up on release.
      const dragging = this.draggingGuide?.id === guide.id;
      const position = dragging ? line[guide.axis] : guide.position;

      const width = guide.axis === 'x' ? thickness : scene.width;
      const height = guide.axis === 'x' ? scene.height : thickness;
      line.setSize(width, height);
      line.setPosition(
        guide.axis === 'x' ? position : scene.width / 2,
        guide.axis === 'x' ? scene.height / 2 : position,
      );
      line.setVisible(true);
      line.setData('guideId', guide.id);
      line.setData('guideAxis', guide.axis);

      // A guide holding the current drag turns the snap magenta. Not a second
      // line drawn beside it — that would say the same thing twice, which is
      // why the grid draws nothing — but the line itself answering *which*
      // guide caught, the question a uniform grid never raises.
      const held = this.heldGuides.has(guide.id);
      line.setFillStyle(held ? GUIDE_COLOR : PLACED_GUIDE_COLOR);

      // The band is the touch target, not the line: two pixels is unhittable
      // with a thumb. Measured from the local top-left, like every hit area
      // here, so it has to be re-offset as well as resized.
      const hitWidth = guide.axis === 'x' ? band : width;
      const hitHeight = guide.axis === 'x' ? height : band;
      const rectangle = new Phaser.Geom.Rectangle(
        (width - hitWidth) / 2,
        (height - hitHeight) / 2,
        hitWidth,
        hitHeight,
      );
      if (line.input) {
        (line.input.hitArea as Phaser.Geom.Rectangle).setTo(
          rectangle.x,
          rectangle.y,
          rectangle.width,
          rectangle.height,
        );
        line.setInteractive();
      } else {
        line.setInteractive(rectangle, Phaser.Geom.Rectangle.Contains);
      }
      this.input.setDraggable(line);
    });

    // Unused entries are hidden *and* disabled. `setVisible(false)` alone does
    // not stop Phaser hit-testing an object, so a switched-off guide would go
    // on stealing presses from the objects under it with nothing on screen to
    // explain why.
    for (let index = guides.length; index < this.placedGuides.length; index += 1) {
      this.placedGuides[index].setVisible(false).disableInteractive();
    }
  }

  /** The guides' positions per axis, as `snapMove` wants them. */
  private guideLinesFor(project: Project): { x: number[]; y: number[] } {
    const lines: { x: number[]; y: number[] } = { x: [], y: [] };
    for (const guide of guidesOf(activeScene(project))) {
      // The one being dragged is not a line to snap to: it would catch on
      // itself and never move.
      if (this.draggingGuide?.id === guide.id) continue;
      lines[guide.axis].push(guide.position);
    }
    return lines;
  }

  /**
   * Whether this press adds to the selection instead of replacing it.
   *
   * Shift, Ctrl or Cmd where there is a keyboard, and the scene tree's own
   * toggle everywhere — a phone has no modifier key, and multi-select that only
   * worked on a desktop would not be multi-select in this editor.
   */
  private isAdditive(pointer: Phaser.Input.Pointer): boolean {
    if (useEditorStore.getState().multiSelect) return true;
    const event = pointer.event as MouseEvent | TouchEvent | undefined;
    if (!event || !('shiftKey' in event)) return false;
    return event.shiftKey || event.ctrlKey || event.metaKey;
  }

  // ---------------------------------------------------------------------------
  // Corner scaling
  // ---------------------------------------------------------------------------

  /**
   * Records what the gesture will be resolved against: the object's unscaled
   * size, the scale it started at, and how far the pointer was from the corner
   * when it grabbed it.
   *
   * The grab offset is what stops the object jumping the instant you touch the
   * handle — a fingertip lands somewhere in a 44px target, not on the corner.
   */
  private beginScale(pointer: Phaser.Input.Pointer): void {
    const store = useEditorStore.getState();
    // Single selection only. Scaling several objects at once means scaling them
    // about a shared centre, which is a different gesture from "drag this
    // object's own corner" — the handle is hidden rather than made to mean two
    // things, and the inspector's Scale fields still reach one object.
    const id = store.selectedIds.length === 1 ? primaryId(store) : null;
    const object = id ? this.displayObjects.get(id) : undefined;
    if (!id || !object) return;

    // The bottom-right of the object's own box, in its unscaled local space.
    // For everything but a container that is half its size; a container's box
    // is its children's, which need not be centred on it at all.
    const rect = this.localRectOf(object);
    const cornerX = rect.right;
    const cornerY = rect.bottom;
    // A corner on the origin gives the gesture nothing to scale against —
    // every pointer position would divide by zero.
    if (Math.abs(cornerX) < 1e-6 || Math.abs(cornerY) < 1e-6) return;

    // Everything is resolved in the object's *parent* space, which for a
    // top-level object is world space and for a nested one is the container's.
    // That is the space its own x/y/rotation/scale are expressed in, so the
    // maths below is the same at every depth.
    const corner = this.toParentSpace(object, this.cornerOf(object));
    const grab = this.toParentSpace(object, { x: pointer.worldX, y: pointer.worldY });
    this.scaling = {
      id,
      halfWidth: cornerX,
      halfHeight: cornerY,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      grabOffsetX: corner.x - grab.x,
      grabOffsetY: corner.y - grab.y,
    };
    // One undo entry for the whole gesture, exactly as a move drag does.
    store.beginTransaction();
  }

  /**
   * Turns the pointer's position into a scale.
   *
   * The maths is done in the object's own unrotated frame, so a rotated object
   * scales along its own axes rather than the screen's — dragging the corner of
   * a tilted object outward makes it bigger, not sheared.
   */
  private applyScale(pointer: Phaser.Input.Pointer): void {
    const gesture = this.scaling;
    const object = gesture ? this.displayObjects.get(gesture.id) : undefined;
    if (!gesture || !object) return;

    const point = this.toParentSpace(object, { x: pointer.worldX, y: pointer.worldY });
    const angle = -object.rotation;
    const dx = point.x + gesture.grabOffsetX - object.x;
    const dy = point.y + gesture.grabOffsetY - object.y;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

    const store = useEditorStore.getState();
    let scaleX: number;
    let scaleY: number;

    if (store.lockAspect) {
      // Project the pointer onto the diagonal the corner started on. Taking one
      // axis and copying it to the other would make the object lurch whenever
      // the drag was more vertical than horizontal; a projection lets the
      // corner track the pointer as closely as one number can.
      const cornerX = gesture.halfWidth * gesture.scaleX;
      const cornerY = gesture.halfHeight * gesture.scaleY;
      const lengthSquared = cornerX * cornerX + cornerY * cornerY;
      if (lengthSquared === 0) return;
      const factor = (localX * cornerX + localY * cornerY) / lengthSquared;
      scaleX = gesture.scaleX * factor;
      scaleY = gesture.scaleY * factor;
    } else {
      scaleX = localX / gesture.halfWidth;
      scaleY = localY / gesture.halfHeight;
    }

    // Clamped rather than allowed through zero into a mirrored object: a flip
    // is a separate idea, and a scale that passes through 0 leaves the handle
    // stuck at the object's centre with no way back.
    store.updateTransform(gesture.id, {
      scaleX: Math.max(MIN_SCALE, scaleX),
      scaleY: Math.max(MIN_SCALE, scaleY),
    });
  }

  /**
   * The object's own bottom-right corner in world space, rotation, scale and
   * every enclosing container included — the world matrix does all of it.
   */
  /**
   * Opens a rotate gesture, capturing everything it will be resolved against.
   *
   * Single selection only, exactly as scaling is, and the reason is stronger
   * here: turning a *set* about a shared centre moves every member's position
   * as well as its angle — each one orbits the pivot — which is a different
   * action against the store, not this gesture with a longer list. So the knob
   * is hidden for a set rather than made to mean two things.
   */
  private beginRotate(pointer: Phaser.Input.Pointer): void {
    const store = useEditorStore.getState();
    const id = store.selectedIds.length === 1 ? primaryId(store) : null;
    const object = id ? this.displayObjects.get(id) : undefined;
    const children = activeScene(store.project).children;
    const node = id ? findNode(children, id) : undefined;
    // Every bail is before `beginTransaction`: it snapshots the document
    // whether or not an edit follows, and one left open swallows the undo step
    // of every edit after it.
    if (!id || !object || !node) return;

    const grab = this.toParentSpace(object, { x: pointer.worldX, y: pointer.worldY });

    this.rotating = {
      id,
      pivotX: object.x,
      pivotY: object.y,
      // From the document, not from `object.rotation`: Phaser's is radians and
      // is a derived copy, and round-tripping through it is exactly the drift
      // `tidyTransform` exists to clean up.
      startRotation: node.transform.rotation,
      grabAngle: degreesBetween(object.x, object.y, grab.x, grab.y),
      parentRotation: worldTransformOf(children, findParent(children, id)?.id ?? null).rotation,
      targets: this.angleTargetsFor(id, store.project),
    };
    store.beginTransaction();
  }

  /**
   * Turns the object to follow the pointer round its pivot.
   *
   * Both angles are measured in the *parent's* space, so a container's own
   * rotation cancels out of their difference exactly and what comes out is the
   * change in the local angle — which is the number the document stores. That
   * is the parent-space rule the corner-scale code follows, applied to angles,
   * and it is why nothing here composes or inverts a rotation by hand.
   */
  private applyRotate(pointer: Phaser.Input.Pointer): void {
    const gesture = this.rotating;
    const object = gesture ? this.displayObjects.get(gesture.id) : undefined;
    if (!gesture || !object) return;

    const point = this.toParentSpace(object, { x: pointer.worldX, y: pointer.worldY });
    const now = degreesBetween(gesture.pivotX, gesture.pivotY, point.x, point.y);
    // Against the gesture's start, and wrapped: without the wrap, a pointer
    // crossing the half turn would spin the object all the way round the other
    // way.
    const raw = gesture.startRotation + wrapDegrees(now - gesture.grabAngle);

    useEditorStore.getState().updateTransform(gesture.id, {
      rotation: this.snappedRotation(gesture, raw),
    });
  }

  /**
   * The angle the turn should actually land on — the raw one when both toggles
   * are off or nothing is in range.
   *
   * The snap resolves in **world** degrees and the correction is folded back
   * into the local value, so an object inside a tilted group agrees with what
   * is on the screen rather than with its parent's frame.
   */
  private snappedRotation(gesture: NonNullable<EditorScene['rotating']>, raw: number): number {
    this.angleMarks = [];
    this.angleLabel = null;

    const { snapEnabled, gridEnabled, angleStep } = useEditorStore.getState();
    if (!snapEnabled && !gridEnabled) return raw;

    const object = this.displayObjects.get(gesture.id);
    if (!object) return raw;
    const pivot = object.getWorldTransformMatrix().transformPoint(0, 0);

    // Each toggle withholds what it feeds the geometry rather than setting a
    // flag the geometry reads: no targets is no neighbour snap, no step is no
    // step. One code path, and it cannot disagree with the toolbar.
    const result = snapRotation(
      { angle: raw + gesture.parentRotation, x: pivot.x, y: pivot.y },
      snapEnabled ? gesture.targets : [],
      SNAP_ANGLE,
      { step: gridEnabled ? angleStep : 0 },
    );

    // Only while something is holding it. A number that appeared throughout the
    // gesture would be a readout; appearing only when the angle has been caught
    // makes it mean the same thing a guide does.
    if (result.delta !== 0) {
      this.angleMarks = result.marks;
      this.angleLabel = { text: `${Math.round(result.angle)}\u00b0`, x: pivot.x, y: pivot.y };
    }
    return raw + result.delta;
  }

  /**
   * Every other drawn node's world angle and pivot, for a rotate gesture to
   * agree with.
   *
   * The same three exclusions `snapTargetsFor` makes, for the same reasons: a
   * descendant turns with the gesture, an ancestor's own angle composes into
   * the very number being measured, and a hidden object is not on screen for a
   * tick to point at.
   *
   * The scene rectangle is *not* here, though it is a target for a move. It has
   * no tilt of its own to agree with, and offering it as "an object at 0°"
   * would have the magnet quietly do the step's job — upright would then snap
   * with the grid switched off, which is not what either toggle says.
   */
  private angleTargetsFor(moving: string, project: Project): AngleTarget[] {
    const roots = activeScene(project).children;
    const movingNode = findNode(roots, moving);
    if (!movingNode) return [];

    const targets: AngleTarget[] = [];
    for (const [id, object] of this.displayObjects) {
      if (!object.visible) continue;
      const node = findNode(roots, id);
      if (!node) continue;
      if (containsNode(movingNode, id) || containsNode(node, moving)) continue;
      const pivot = object.getWorldTransformMatrix().transformPoint(0, 0);
      // The angle comes from the document through `worldTransformOf` — degrees,
      // composed down the chain — rather than from Phaser's `object.rotation`,
      // which is local radians and would silently mean the wrong thing for
      // anything inside a rotated group.
      targets.push({ angle: worldTransformOf(roots, id).rotation, x: pivot.x, y: pivot.y });
    }
    return targets;
  }

  private cornerOf(object: Renderable): { x: number; y: number } {
    const rect = this.localRectOf(object);
    const point = object.getWorldTransformMatrix().transformPoint(rect.right, rect.bottom);
    return { x: point.x, y: point.y };
  }

  /**
   * The selected group a press on `id` should move instead of `id` itself, or
   * null when the press is its own business.
   */
  private proxyTargetFor(id: string | null): string | null {
    if (!id) return null;
    const state = useEditorStore.getState();
    const children = activeScene(state.project).children;
    for (const selected of state.selectedIds) {
      if (selected === id) continue;
      const node = findNode(children, selected);
      if (node?.type === 'container' && containsNode(node, id)) return selected;
    }
    return null;
  }

  /**
   * A world point in the space the object's own transform is expressed in: the
   * enclosing container's, or world space for a top-level object.
   */
  private toParentSpace(
    object: Renderable,
    point: { x: number; y: number },
  ): { x: number; y: number } {
    const parent = object.parentContainer;
    if (!parent) return point;
    const local = parent.getWorldTransformMatrix().applyInverse(point.x, point.y);
    return { x: local.x, y: local.y };
  }

  update(): void {
    this.updatePinch();
    this.updateSelectionOutline();
    // `drawGuides` clears the shared Graphics; everything drawing into it has
    // to come after. The label budget is one per frame across both drawers —
    // scoped to either of them, whichever ran second would hide the other's.
    this.usedLabels = 0;
    this.drawGuides();
    this.drawAngleMarks();
    this.drawSpacings();
    this.drawAngleLabel();
    for (let index = this.usedLabels; index < this.overlayLabels.length; index += 1) {
      this.overlayLabels[index].setVisible(false);
    }
    this.drawGrid();
    this.drawPaintGrid();
    this.syncPlacedGuides();
    this.drawBodies();
    this.drawCamera();
  }

  /** Two fingers down: zoom by how much the gap between them changed. */
  private updatePinch(): void {
    const [first, second] = [this.input.pointer1, this.input.pointer2];
    if (!first?.isDown || !second?.isDown) {
      this.pinchDistance = 0;
      return;
    }

    this.isPanning = false;
    const distance = Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y);
    if (this.pinchDistance > 0 && distance > 0) {
      const midX = (first.x + second.x) / 2;
      const midY = (first.y + second.y) / 2;
      this.zoomBy(distance / this.pinchDistance, midX, midY);
    }
    this.pinchDistance = distance;
  }

  /**
   * Zooms around a screen point, keeping the world point under it fixed —
   * otherwise pinching drifts the scene away from the user's fingers.
   */
  private zoomBy(factor: number, screenX: number, screenY: number): void {
    const camera = this.cameras.main;
    const next = Phaser.Math.Clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (next === camera.zoom) return;

    const before = camera.getWorldPoint(screenX, screenY);
    camera.setZoom(next);
    const after = camera.getWorldPoint(screenX, screenY);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    this.cameraTouched = true;
  }

  /** Frames the whole scene in the viewport. Also the "reset view" action. */
  zoomToFit(): void {
    const camera = this.cameras.main;
    if (camera.width === 0 || camera.height === 0) return;

    const scene = activeScene(useEditorStore.getState().project);
    const zoom = Phaser.Math.Clamp(
      Math.min(camera.width / scene.width, camera.height / scene.height) * 0.9,
      MIN_ZOOM,
      MAX_ZOOM,
    );
    camera.setZoom(zoom);
    camera.centerOn(scene.width / 2, scene.height / 2);
    // An explicit Fit hands control back to the auto-framing.
    this.cameraTouched = false;
  }

  // ---------------------------------------------------------------------------
  // Store -> display objects
  // ---------------------------------------------------------------------------

  private syncFromStore(state: EditorState): void {
    const scene = activeScene(state.project);
    const switched = this.drawnSceneId !== null && this.drawnSceneId !== scene.id;
    this.drawnSceneId = scene.id;
    this.cameras.main.setBackgroundColor(scene.backgroundColor);

    this.sceneFrame.setPosition(0, 0).setSize(scene.width, scene.height);

    // Before the nodes: a sprite created this pass needs its texture to already
    // exist, or Phaser falls back to its own missing-texture green square.
    this.syncTextures(state.project);
    // And after the textures, because an animation is built from a texture's
    // frames — but still before the nodes, which play what it registers.
    this.syncAnimations(state.project);
    this.previewing = state.previewMotion;
    this.syncing = state.project;

    const seen = new Set<string>();
    // The keys that name an actual document node, which is what
    // `publishMeasuredBounds` may publish and nothing else. Filled by
    // `syncNodes` rather than derived from the key's shape, so the separator
    // that builds a derived key stays a detail of one function.
    this.documentKeys = new Set<string>();
    this.syncNodes(scene.children, null, seen, '');

    for (const [id, object] of this.displayObjects) {
      if (seen.has(id)) continue;
      // Destroying a container destroys its children with it, so an object
      // pruned here may already be gone. Phaser's destroy() is a no-op the
      // second time, which is what makes that safe rather than lucky.
      this.destroyDisplayObject(id, object);
    }

    this.publishMeasuredBounds();

    // After the objects, not before: `zoomToFit` frames the scene rectangle,
    // and this way the frame it settles on is the one the user sees drawn.
    if (switched) this.zoomToFit();
  }

  /**
   * Outlines every object in the scene that carries a physics body.
   *
   * The box is deliberately *not* the selection outline's box. An Arcade body
   * is axis-aligned and does not turn with its object, so a rotated sprite's
   * body is a straight rectangle of the object's unrotated display size, and
   * drawing it any other way would show the user a shape their exported game
   * does not have. Centred on the object's position because all four types that
   * can carry a body have a centred origin, which is also how Phaser places the
   * body from `displayOrigin`.
   *
   * A static body gets a cross through it as well as an outline. That is one
   * colour and two extra lines rather than a second palette entry, and it says
   * the one thing about a body that is visible on a canvas nobody is
   * simulating: this one is never going to move.
   *
   * Only `scene.children` is walked, which is the top-level rule again and the
   * reason nothing here has to check for it — `physicsOf` is handed `true`
   * because this loop cannot reach a node for which it would be false.
   *
   * In `update()` rather than at the end of the sync, with `drawGrid`,
   * `syncPlacedGuides` and the selection outline, and for exactly their reason:
   * the stroke is a *screen* width divided by the camera zoom, and a pinch
   * changes the zoom without touching the store. Drawn on the sync alone it
   * would be left at whatever width the last edit happened to see — a hairline
   * after zooming in, which is the one-pixel-line trap arriving by a new route.
   */
  private drawBodies(): void {
    this.bodyGraphics.clear();
    const scene = activeScene(useEditorStore.getState().project);

    const width = BODY_WIDTH / this.cameras.main.zoom;
    let styled = false;

    for (const node of scene.children) {
      const body = physicsOf(node, true);
      // A hidden object is not on screen, so an outline round it would be a
      // mark with nothing under it — the rule that already keeps hidden objects
      // out of the snap targets.
      if (!body || !node.visible) continue;
      const object = this.displayObjects.get(node.id);
      if (!object) continue;

      // Absolute because a negative scale flips an object without giving it a
      // negative-width body; Phaser normalises the same way.
      const w = Math.abs(object.displayWidth);
      const h = Math.abs(object.displayHeight);
      if (!(w > 0) || !(h > 0)) continue;

      const x = node.transform.x - w / 2;
      const y = node.transform.y - h / 2;

      if (!styled) {
        this.bodyGraphics.lineStyle(width, BODY_COLOR, 1);
        styled = true;
      }
      this.bodyGraphics.strokeRect(x, y, w, h);
      if (body.kind === 'static') {
        this.bodyGraphics.lineBetween(x, y, x + w, y + h);
        this.bodyGraphics.lineBetween(x + w, y, x, y + h);
      }
    }
  }

  /**
   * Draws the scene camera's opening view.
   *
   * One rectangle, and which rectangle it is comes entirely from
   * `cameraViewOf`. The editor never applies the document's camera to its own,
   * because the editor's camera is the user's view of the scene: applying it
   * would mean the user could not look anywhere else without editing the
   * document, and that panning would rewrite it. Physics' "drawn, never run",
   * one iteration on — `setBackgroundColor` in `syncFromStore` stays the only
   * thing the document has ever written to the editor's camera.
   *
   * Nothing is drawn for a camera still at its default. It would land exactly
   * on `sceneFrame` and say the same thing twice, and the grid already settles
   * that question: it stops drawing when it has nothing left to say, while the
   * geometry carries on regardless.
   *
   * In `update()` with `drawGrid`, `syncPlacedGuides` and `drawBodies`, and for
   * their reason — the stroke is a *screen* width divided by the camera zoom,
   * and a pinch changes the zoom without touching the store. Signature-gated
   * like the grid, because on almost every frame none of it has moved.
   */
  private drawCamera(): void {
    const scene = activeScene(useEditorStore.getState().project);
    const { zoom } = this.cameras.main;
    const view = cameraViewOf(scene);
    const signature = isDefaultCamera(cameraOf(scene))
      ? ''
      : `${view.x}:${view.y}:${view.width}:${view.height}:${zoom}`;
    if (signature === this.cameraSignature) return;
    this.cameraSignature = signature;

    this.cameraGraphics.clear();
    if (!signature) return;

    this.cameraGraphics.lineStyle(CAMERA_WIDTH / zoom, CAMERA_COLOR, 1);
    this.cameraGraphics.strokeRect(view.x, view.y, view.width, view.height);
  }

  /**
   * Hands every object's drawn box to `core/bounds`, where align and distribute
   * read it.
   *
   * Published from here rather than measured in the store because this is the
   * only place that knows: a text object's size is whatever the font measured
   * to, and a group's is the union of its contents. The same `worldBoundsOf`
   * the selection outline and the scale handle use, so the box an alignment
   * moves is exactly the box the user can see around the object.
   *
   * Straight into a module, not back into the store: this scene syncs on every
   * store change, so a write into the store here would schedule the next sync.
   */
  private publishMeasuredBounds(): void {
    const boxes = new Map<string, Rect>();
    for (const [id, object] of this.displayObjects) {
      // A prefab's contents are not document nodes: nothing can select, align,
      // distribute or snap to one on its own, so a box under a derived key
      // would be an entry no caller could ever have a node id for.
      if (!this.documentKeys.has(id)) continue;
      const bounds = this.worldBoundsOf(object);
      boxes.set(id, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    }
    publishBounds(boxes);
  }

  /**
   * Diffs one level of the document against the display list, then recurses
   * into containers.
   *
   * Depth-first and children-before-parent: a container's size, hit area and
   * selection box are all derived from what is inside it, so it can only be
   * laid out once its contents have been.
   */
  private syncNodes(
    nodes: GameObjectNode[],
    parent: Phaser.GameObjects.Container | null,
    seen: Set<string>,
    prefix: string,
  ): void {
    nodes.forEach((node, index) => {
      const key = prefix + node.id;
      seen.add(key);
      if (prefix === '') this.documentKeys.add(key);
      let object = this.displayObjects.get(key);

      // A node whose type changed has to be rebuilt, not updated — and so does
      // one whose *shape* changed, which today means a tilemap that has been
      // re-cut, resized or pointed at another tileset. Phaser fixes a map's
      // dimensions and tile size when it parses one, so those are a new map
      // rather than a changed one, exactly as a re-cut sheet is a new texture.
      const shape = this.shapeOf(node);
      if (object && (object.getData('nodeType') !== node.type || object.getData('nodeShape') !== shape)) {
        this.destroyDisplayObject(key, object);
        object = undefined;
      }

      if (!object) {
        object = this.createDisplayObject(node, key, prefix === '');
        this.displayObjects.set(key, object);
      }

      this.reparent(object, parent, index);

      if (node.type === 'container') {
        this.syncNodes(node.children, object as Phaser.GameObjects.Container, seen, prefix);
      } else if (node.type === 'instance') {
        // Drawn from the definition, never from `node.children` — an instance
        // has none, and a hand-edited file that gives it some is describing
        // nodes no tree row and no export would ever mention.
        this.syncNodes(
          prefabChildrenOf(this.syncing, node),
          object as Phaser.GameObjects.Container,
          seen,
          `${key}/`,
        );
      }

      this.applyNode(object, node, index, key);
    });
  }

  // -- painting ---------------------------------------------------------------

  /**
   * The cell of the painted map under the pointer, in tile coordinates.
   *
   * Measured in the layer's *own* space through the inverse of its world
   * matrix, which is the same trick `toParentSpace` plays one level up: a
   * tilemap inside a rotated, scaled group is then no different from one at the
   * top level, and nothing here composes a transform by hand. The layer's local
   * origin is its top-left, so a cell is a plain division from there — and the
   * result is deliberately not clamped, because a stroke that runs off the edge
   * is a normal gesture that `paintTiles` drops on its own.
   */
  private cellAt(
    layer: Phaser.Tilemaps.TilemapLayer,
    map: TileMap,
    pointer: Phaser.Input.Pointer,
  ): TileCell {
    const local = layer.getWorldTransformMatrix().applyInverse(pointer.worldX, pointer.worldY);
    return {
      column: Math.floor(local.x / map.tileWidth),
      row: Math.floor(local.y / map.tileHeight),
    };
  }

  /** The painted node, its layer and its resolved grid, or null. */
  private paintTarget(): {
    nodeId: string;
    layer: Phaser.Tilemaps.TilemapLayer;
    map: TileMap;
  } | null {
    const state = useEditorStore.getState();
    if (!state.paintingId) return null;
    const node = findNode(activeScene(state.project).children, state.paintingId);
    if (!node || node.type !== 'tilemap') return null;
    const layer = this.displayObjects.get(state.paintingId);
    if (!(layer instanceof Phaser.Tilemaps.TilemapLayer)) return null;
    return { nodeId: node.id, layer, map: tileMapOf(state.project, node.props) };
  }

  /**
   * Starts a stroke, if the canvas is in paint mode. Answers whether the press
   * was taken, so the caller can stop treating it as a selection or a pan.
   *
   * The transaction opens here and closes in `finishPaint`, so one stroke is
   * one undo step. Without that the history — whole-project snapshots — would
   * take an entry per pointer-move, which is the held-arrow-key problem with a
   * faster finger.
   */
  private beginPaint(pointer: Phaser.Input.Pointer): boolean {
    const target = this.paintTarget();
    if (!target) return false;

    this.painting = { nodeId: target.nodeId, last: null };
    useEditorStore.getState().beginTransaction();
    this.paintAt(pointer);
    return true;
  }

  /**
   * Lays the brush along the way from the last cell to this one.
   *
   * Every cell on the segment, not just the one under the pointer: pointer
   * samples arrive several tiles apart on a fast drag, and painting only where
   * they land leaves a dotted line. Stepping by the larger of the two spans
   * visits each cell on the way exactly once.
   */
  private paintAt(pointer: Phaser.Input.Pointer): void {
    const stroke = this.painting;
    const target = this.paintTarget();
    if (!stroke || !target || target.nodeId !== stroke.nodeId) return;

    const cell = this.cellAt(target.layer, target.map, pointer);
    const from = stroke.last ?? cell;
    const steps = Math.max(Math.abs(cell.column - from.column), Math.abs(cell.row - from.row));
    const cells: TileCell[] = [];
    for (let step = 0; step <= steps; step += 1) {
      const at = steps === 0 ? 1 : step / steps;
      cells.push({
        column: Math.round(from.column + (cell.column - from.column) * at),
        row: Math.round(from.row + (cell.row - from.row) * at),
      });
    }
    stroke.last = cell;

    const state = useEditorStore.getState();
    state.paintTiles(stroke.nodeId, cells, state.erasing ? EMPTY_TILE : state.brushTile);
  }

  /**
   * Ends a stroke. Idempotent, because several of the end events fire on a real
   * device and sometimes only one does.
   *
   * The stroke is cleared *before* the transaction closes, exactly as a drag
   * clears its own state first: `endTransaction` publishes a store change, and
   * a sync that still believed a stroke was running would be one that had to be
   * reasoned about rather than one that cannot happen.
   */
  private finishPaint(): void {
    if (!this.painting) return;
    this.painting = null;
    useEditorStore.getState().endTransaction();
  }

  /**
   * The painted map's own cell grid, and the cell the pointer is over.
   *
   * Drawn from a signature like `drawGrid`, and for a sharper version of its
   * reason: a stroke publishes a store change per pointer-move, and a full-size
   * map is five hundred line segments — redrawing those on every one of them is
   * the frame budget the gesture needs. Depth 998 puts it above the objects, so
   * the cells are visible over what is painted, and below the snap overlays and
   * the handles at 999 and up.
   */
  private drawPaintGrid(): void {
    const target = this.paintTarget();
    if (!target) {
      if (this.paintGraphics.visible) this.paintGraphics.setVisible(false).clear();
      this.paintSignature = '';
      return;
    }

    const { map, layer } = target;
    const { zoom } = this.cameras.main;
    const hover = this.painting?.last;
    // The layer's *world* frame, decomposed, rather than its own transform: a
    // map nested in a rotated or scaled group is drawn through its parents, and
    // the overlay is a top-level object with no parents to be drawn through.
    // The same reason the gestures resolve against a world matrix rather than
    // adding stored transforms up.
    const world = layer.getWorldTransformMatrix().decomposeMatrix();
    const signature = [
      target.nodeId,
      map.columns,
      map.rows,
      map.tileWidth,
      map.tileHeight,
      zoom,
      world.translateX,
      world.translateY,
      world.rotation,
      world.scaleX,
      world.scaleY,
      hover ? `${hover.column},${hover.row}` : '',
    ].join(':');
    if (signature === this.paintSignature) return;
    this.paintSignature = signature;

    const width = map.columns * map.tileWidth;
    const height = map.rows * map.tileHeight;
    this.paintGraphics.setVisible(true).clear();
    this.paintGraphics.setPosition(world.translateX, world.translateY);
    this.paintGraphics.setRotation(world.rotation);
    this.paintGraphics.setScale(world.scaleX, world.scaleY);

    // Divided by the scale it is about to be drawn through as well as by the
    // zoom, so the cell lines stay one screen pixel whatever the map is doing.
    this.paintGraphics.lineStyle(
      1 / (zoom * Math.abs(world.scaleX || 1)),
      GRID_COLOR,
      GRID_ALPHA,
    );
    for (let column = 0; column <= map.columns; column += 1) {
      const x = column * map.tileWidth;
      this.paintGraphics.lineBetween(x, 0, x, height);
    }
    for (let row = 0; row <= map.rows; row += 1) {
      const y = row * map.tileHeight;
      this.paintGraphics.lineBetween(0, y, width, y);
    }

    if (hover && hover.column >= 0 && hover.row >= 0 && hover.column < map.columns && hover.row < map.rows) {
      this.paintGraphics.fillStyle(SELECTION_COLOR, 0.25);
      this.paintGraphics.fillRect(
        hover.column * map.tileWidth,
        hover.row * map.tileHeight,
        map.tileWidth,
        map.tileHeight,
      );
    }
  }

  /**
   * Puts a display object under the right parent, in the right place in its
   * list.
   *
   * Order inside a container is the list order, not depth: a child's `depth`
   * only sorts it within its container, and the container's own list is what
   * actually renders. `moveTo` is therefore the nested equivalent of the
   * `setDepth(index)` the scene's top level uses.
   */
  private reparent(
    object: Renderable,
    parent: Phaser.GameObjects.Container | null,
    index: number,
  ): void {
    const current = object.parentContainer ?? null;
    if (current !== parent) {
      current?.remove(object);
      if (parent) parent.add(object);
      else this.add.existing(object);
    }
    if (parent && parent.getIndex(object) !== index) parent.moveTo(object, index);
  }

  /**
   * `key` is what `displayObjects` stores the object under, and it goes onto the
   * object as `nodeId` — for a scene node the two are the same string, and for
   * a prefab's contents the key is the instance's key plus the child's id, so
   * two placements of one prefab cannot share an entry.
   *
   * `interactive` is false for exactly those derived children, which is what
   * keeps that difference from mattering anywhere else: with no input on them,
   * `GAMEOBJECT_DOWN` can never fire for a key that names no node, so a press
   * on a prefab lands on the instance's own hit area and selects the instance.
   * An instance is therefore grabbable over its whole box — where a group is
   * deliberately grabbed by its children — and needs no `dragProxy`.
   */
  private createDisplayObject(
    node: GameObjectNode,
    key: string,
    interactive: boolean,
  ): Renderable {
    let object: Renderable;

    switch (node.type) {
      case 'rectangle':
        object = this.add.rectangle(0, 0, node.props.width, node.props.height);
        break;
      case 'ellipse':
        object = this.add.ellipse(0, 0, node.props.width, node.props.height);
        break;
      case 'text':
        object = this.add.text(0, 0, node.props.text).setOrigin(0.5);
        break;
      case 'sprite':
        object = this.add.sprite(0, 0, this.textureKeyFor(this.syncing, node.props.assetId));
        break;
      case 'tilemap':
        object = this.createTilemapLayer(node.props, key);
        break;
      case 'particles':
        object = this.createEmitter(node.props, key);
        break;
      case 'container':
      case 'instance':
        // Sized in applyNode from whatever ends up inside it; a container needs
        // a size at all only because that is how Phaser gives it a hit area. An
        // instance is the same object drawing borrowed contents.
        object = this.add.container(0, 0).setSize(EMPTY_GROUP_SIZE, EMPTY_GROUP_SIZE);
        break;
    }

    object.setData('nodeId', key);
    object.setData('nodeType', node.type);
    object.setData('nodeShape', this.shapeOf(node));
    if (interactive) {
      object.setInteractive(hitAreaFor(object, node), hitTestFor(node));
      this.input.setDraggable(object);
    }
    return object;
  }

  /**
   * A particles node's display object: a fixed-size Container holding the
   * marker and the emitter itself.
   *
   * The wrapper is not decoration. A `ParticleEmitter` has Transform and
   * Visible but no ComputedSize and no Origin, so it has no width, no height
   * and no `displayOriginX` — and `InputManager.pointWithinHitArea` adds that
   * origin to every point it tests, so an emitter on its own can never be hit
   * at all. A Container has all three, which makes the node selectable,
   * draggable, scalable and turnable with no special case anywhere: the
   * existing `localRectOf` falls through to a centred `width`/`height` box for
   * a container with no measured bounds, and `hitAreaFor` and `applyHitArea`
   * already do the right thing for one.
   *
   * Its children are private to the renderer — `syncNodes` recurses into
   * `container` and `instance` nodes only, and `applyContainerBounds` is
   * called for those two — so nothing here disturbs "draw order is the array
   * order, at every level".
   */
  private createEmitter(
    props: ParticlesProps,
    key: string,
  ): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0).setSize(EMITTER_SIZE, EMITTER_SIZE);

    const marker = this.add.image(0, 0, EMITTER_TEXTURE);
    const emitter = this.add.particles(0, 0, this.textureKeyFor(this.syncing, props.assetId));
    // An emitter is `emitting` from the moment it is built, so a new one — or
    // one rebuilt because its node type changed — would puff for a frame
    // before the first `applyNode` could stop it.
    emitter.stop(true);

    group.add([marker, emitter]);
    this.emitters.set(key, emitter);
    return group;
  }

  /** The marker inside a particles node's container. */
  private markerOf(group: Phaser.GameObjects.Container): Phaser.GameObjects.Image {
    return group.list[0] as Phaser.GameObjects.Image;
  }

  private applyNode(
    object: Renderable,
    node: GameObjectNode,
    index: number,
    key: string,
  ): void {
    const { transform } = node;

    // Always mirror the document, including mid-drag. An earlier version skipped
    // the object under the pointer to stop the rounded store value fighting the
    // gesture, but that made what you see depend on a delicate ordering of
    // events — and any gesture the browser cut short (pointercancel) left the
    // object stranded at a stale position. The drag now stores exact floats and
    // rounds once on release, so there is nothing to fight and the invariant is
    // simply: drawn position == stored position, always.
    object.setPosition(transform.x, transform.y);
    object.setRotation(Phaser.Math.DegToRad(transform.rotation));
    object.setScale(transform.scaleX, transform.scaleY);
    object.setVisible(node.visible);
    object.setDepth(index);

    switch (node.type) {
      case 'rectangle':
      case 'ellipse': {
        const shape = object as Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;
        shape.setFillStyle(hexToNumber(node.props.fill), node.props.alpha);
        if (shape.width !== node.props.width || shape.height !== node.props.height) {
          shape.setSize(node.props.width, node.props.height);
        }
        break;
      }
      case 'sprite': {
        const sprite = object as Phaser.GameObjects.Sprite;
        const project = this.syncing;
        const key = this.textureKeyFor(project, node.props.assetId);
        const asset = findAsset(project, node.props.assetId);
        const frame = clampFrame(asset, node.props.frame);

        const clip = findAnimation(project, node.props.animationId);
        const animation = clip ? this.animationForClip.get(clip.id) : undefined;

        if (this.previewing && animation) {
          // `true` is ignoreIfPlaying: without it every store change — a
          // selection, a nudge of some other object — would restart the
          // animation from frame 0, so nothing would ever visibly advance.
          sprite.play(animation, true);
        } else {
          if (sprite.anims.isPlaying) sprite.stop();
          // Resolved against the texture actually loaded, not against the
          // document's grid. Those disagree for as long as a decode is in
          // flight — the sprite is on the single-frame placeholder while its
          // node still says frame 3 — and Phaser warns and drops to a missing
          // texture for a frame that is not there. The decode re-runs this
          // whole sync when it lands, which is what puts the real frame up.
          const drawn = this.textures.get(key).has(String(frame)) ? frame : 0;
          // Swapping the image or the frame changes the object's size, which
          // the hit area below then follows — the same reason text needs it as
          // you type.
          if (sprite.texture.key !== key) sprite.setTexture(key, drawn);
          else sprite.setFrame(drawn);
        }

        sprite.setAlpha(node.props.alpha);
        // Multiply is the default tint mode, so white is exactly "no tint".
        sprite.setTint(hexToNumber(node.props.tint));
        sprite.setFlip(node.props.flipX, node.props.flipY);
        break;
      }
      case 'tilemap': {
        const layer = object as Phaser.Tilemaps.TilemapLayer;
        const map = tileMapOf(this.syncing, node.props);
        const drawn = this.tileData.get(key);

        // Only the cells that changed. The layer was built from `drawn`, and
        // `syncNodes` has already rebuilt it if the grid's shape moved, so the
        // two arrays are the same length here by construction.
        if (drawn !== map.data) {
          for (let index = 0; index < map.data.length; index += 1) {
            if (drawn && drawn[index] === map.data[index]) continue;
            layer.putTileAt(map.data[index], index % map.columns, Math.floor(index / map.columns));
          }
          this.tileData.set(key, map.data);
        }

        layer.setAlpha(node.props.alpha);
        break;
      }
      case 'particles': {
        const group = object as Phaser.GameObjects.Container;
        // On the container, so it multiplies down onto the marker and the
        // particles alike — what "fade this emitter" should mean, and what the
        // exported `.setAlpha` does to the bare emitter.
        group.setAlpha(node.props.alpha);
        this.applyEmitter(group, node.props, key);
        break;
      }
      case 'container':
      case 'instance': {
        const group = object as Phaser.GameObjects.Container;
        // Alpha on a Container multiplies down onto its children, which is
        // exactly what "fade the whole group" should mean — and what an
        // instance's alpha should mean over a prefab's contents.
        group.setAlpha(node.props.alpha);
        // Keyed by the display key, not the node id: a container *inside* a
        // definition is drawn once per instance, and each of those needs its
        // own box. `localRectOf` reads it back through the same `nodeId` this
        // key was written to.
        this.applyContainerBounds(group, key);
        break;
      }
      case 'text': {
        const text = object as Phaser.GameObjects.Text;
        if (text.text !== node.props.text) text.setText(node.props.text);
        text.setStyle({
          fontSize: `${node.props.fontSize}px`,
          color: node.props.color,
          fontFamily: node.props.fontFamily,
        });
        text.setAlpha(node.props.alpha);
        break;
      }
    }

    this.applyHitArea(object);
  }

  /**
   * Brings one emitter in line with its node, and decides whether it runs.
   *
   * Running is a single condition rather than several: preview has to be on,
   * *and* there has to be a real image to throw. Without the second half an
   * emitter with no image chosen would spray the 96px marker across the scene,
   * which is neither what the document says nor anything a user asked for.
   *
   * The marker is shown exactly when the emitter is not — one field, two
   * controls, never two notions of the same state.
   */
  private applyEmitter(
    group: Phaser.GameObjects.Container,
    props: ParticlesProps,
    key: string,
  ): void {
    const emitter = this.emitters.get(key);
    if (!emitter) return;

    const config = this.emitterConfigFor(props);
    const signature = JSON.stringify(config);
    // `setConfig` calls `resetCounters`, which restarts the flow — so applying
    // it on every store change would mean nothing ever visibly emitted.
    if (this.emitterConfigs.get(key) !== signature) {
      emitter.setConfig(config);
      this.emitterConfigs.set(key, signature);
    }

    const textureKey = this.textureKeyFor(this.syncing, props.assetId);
    const running = this.previewing && textureKey !== PLACEHOLDER_TEXTURE;
    if (running && !emitter.emitting) emitter.start();
    // `stop(true)` kills what is already in flight rather than letting it die
    // out over a lifespan: switching preview off has to put the canvas back
    // where it was immediately, which is the whole point of the toggle.
    if (!running && emitter.emitting) emitter.stop(true);

    this.markerOf(group).setVisible(!running);
  }

  /**
   * The node's settings as a Phaser emitter config.
   *
   * The texture and the frame go *in the config* rather than into a rebuild
   * signature: `setConfig` routes them to `setTexture` and `setEmitterFrame`,
   * so an emitter can be re-pointed in place — and a rebuild would kill every
   * live particle, which for a field like Lifespan means the canvas going
   * blank each time the number is nudged.
   */
  private emitterConfigFor(props: ParticlesProps): Record<string, unknown> {
    const asset = findAsset(this.syncing, props.assetId);
    return {
      texture: this.textureKeyFor(this.syncing, props.assetId),
      frame: clampFrame(asset, props.frame),
      lifespan: props.lifespan,
      speed: { min: props.speedMin, max: props.speedMax },
      angle: { min: props.angleMin, max: props.angleMax },
      scale: { start: props.scaleStart, end: props.scaleEnd },
      alpha: { start: props.alphaStart, end: props.alphaEnd },
      quantity: props.quantity,
      frequency: props.frequency,
      gravityX: props.gravityX,
      gravityY: props.gravityY,
      tint: hexToNumber(props.tint),
      blendMode: props.blendMode,
    };
  }

  /**
   * Recomputes a container's local bounds from its children and hands them to
   * Phaser as the container's size and hit area.
   *
   * The hit area is offset rather than centred: a container's origin is its
   * transform point, not the middle of its contents, so a group whose children
   * all sit to one side of it would otherwise be grabbable everywhere except
   * where it is drawn. Phaser measures a custom hit area from
   * (-displayOrigin), which is what the half-size shift below undoes.
   */
  private applyContainerBounds(
    group: Phaser.GameObjects.Container,
    id: string,
  ): void {
    const bounds = this.measureContainer(group);
    this.containerBounds.set(id, bounds);
    group.setSize(bounds.width, bounds.height);

    const area = group.input?.hitArea;
    if (area instanceof Phaser.Geom.Rectangle) {
      area.setTo(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        bounds.width,
        bounds.height,
      );
    }
  }

  /** The union of the container's children, in the container's own space. */
  private measureContainer(
    group: Phaser.GameObjects.Container,
  ): Phaser.Geom.Rectangle {
    let bounds: Phaser.Geom.Rectangle | null = null;

    for (const child of group.list as Renderable[]) {
      const box = transformedBounds(this.localRectOf(child), child.getLocalTransformMatrix());
      bounds = bounds ? Phaser.Geom.Rectangle.Union(bounds, box) : box;
    }

    return (
      bounds ??
      new Phaser.Geom.Rectangle(
        -EMPTY_GROUP_SIZE / 2,
        -EMPTY_GROUP_SIZE / 2,
        EMPTY_GROUP_SIZE,
        EMPTY_GROUP_SIZE,
      )
    );
  }

  /**
   * The object's extent in its own unscaled local space.
   *
   * Everything but a container is drawn from its centre, so its box is simply
   * its size around the origin. A container's box is whatever its children
   * happen to occupy, which `measureContainer` worked out in the same pass that
   * drew them.
   */
  private localRectOf(object: Renderable): Phaser.Geom.Rectangle {
    if (object instanceof Phaser.GameObjects.Container) {
      const id = object.getData('nodeId') as string | undefined;
      const bounds = id ? this.containerBounds.get(id) : undefined;
      if (bounds) return bounds;
    }
    const { width, height } = object;
    // A tilemap layer's origin is its top-left, not its centre — Phaser sets
    // `setOrigin(0, 0)` on one and there is no meaningful way to move it, since
    // a tile's coordinates are counted from that corner. Every other object
    // here is centred, so this is the one place the difference is expressed:
    // the outline, the hit area, the scale handle, the rotate knob and the
    // published bounds all read the box back through this function.
    if (object instanceof Phaser.Tilemaps.TilemapLayer) {
      return new Phaser.Geom.Rectangle(0, 0, width, height);
    }
    return new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
  }

  /** The object's axis-aligned box in world space, containers included. */
  private worldBoundsOf(object: Renderable): Phaser.Geom.Rectangle {
    return transformedBounds(this.localRectOf(object), object.getWorldTransformMatrix());
  }

  /**
   * Keeps the input hit area in step with the object's size. Without this, a
   * resized object stays clickable only at its original dimensions — and a text
   * object, whose size follows its content, drifts out of step as you type.
   */
  private applyHitArea(object: Renderable): void {
    // A container's hit area is its children's box, which applyContainerBounds
    // has already set — its own width/height mean nothing here.
    if (object instanceof Phaser.GameObjects.Container) return;

    const area = object.input?.hitArea;
    if (!area) return;

    const { width, height } = object;

    if (area instanceof Phaser.Geom.Ellipse) {
      area.setPosition(width / 2, height / 2);
      area.setSize(width, height);
    } else if (area instanceof Phaser.Geom.Rectangle) {
      area.setTo(0, 0, width, height);
    }
  }

  private updateSelectionOutline(): void {
    const state = useEditorStore.getState();
    const targets = state.selectedIds
      .map((id) => this.displayObjects.get(id))
      .filter((object): object is Renderable => object !== undefined && object.visible);

    targets.forEach((target, index) => {
      // The same box the scale handle and the hit area are built from, rather
      // than Phaser's getBounds(): a Container's getBounds() collapses to a
      // point when it is empty, and an empty group is exactly the one you most
      // need to see the outline of.
      const bounds = this.worldBoundsOf(target);
      this.outlineAt(index)
        .setVisible(true)
        .setPosition(bounds.x, bounds.y)
        .setSize(bounds.width, bounds.height)
        // Constant on-screen thickness however far the camera is zoomed.
        .setStrokeStyle(2 / this.cameras.main.zoom, SELECTION_COLOR);
    });

    for (let index = targets.length; index < this.selectionOutlines.length; index += 1) {
      this.selectionOutlines[index].setVisible(false);
    }

    // Both handles belong to a single object's own frame; with several selected
    // there is no one corner for one to sit on and no one pivot for the other
    // to turn about. See `beginScale` and `beginRotate` — one gate, so the two
    // cannot disagree about when they exist.
    const primary = primaryId(state);
    const handleTarget =
      state.selectedIds.length === 1 && primary && !state.paintingId
        ? this.displayObjects.get(primary)
        : undefined;
    if (handleTarget && handleTarget.visible) {
      this.updateScaleHandle(handleTarget);
      this.updateRotateHandle(handleTarget);
    } else {
      this.scaleHandle.setVisible(false);
      this.rotateHandle.setVisible(false);
    }
  }

  /**
   * Parks the rotate knob beyond the middle of the selected object's top edge.
   *
   * The direction is taken from the world matrix rather than from any stored
   * angle, so a container's rotation, scale and depth all compose into it for
   * free — the same reason `cornerOf` transforms a point instead of adding
   * rotations up.
   */
  private updateRotateHandle(target: Renderable): void {
    const { zoom } = this.cameras.main;
    const size = ROTATE_HANDLE_SIZE / zoom;
    const touch = HANDLE_TOUCH_SIZE / zoom;

    const rect = this.localRectOf(target);
    const midX = (rect.x + rect.right) / 2;
    const matrix = target.getWorldTransformMatrix();
    const edge = matrix.transformPoint(midX, rect.y);
    // A second point one unit further up the object's own axis, so the
    // direction survives any rotation and any scale.
    const above = matrix.transformPoint(midX, rect.y - 1);
    const dx = above.x - edge.x;
    const dy = above.y - edge.y;
    // A collapsed scale still has a direction to park along; fall back to
    // straight up rather than dividing by zero.
    const length = Math.hypot(dx, dy);
    const unitX = length === 0 ? 0 : dx / length;
    const unitY = length === 0 ? -1 : dy / length;
    const reach = ROTATE_HANDLE_OFFSET / zoom;

    this.rotateHandle
      .setVisible(true)
      .setPosition(edge.x + unitX * reach, edge.y + unitY * reach)
      // `setRadius`, not `setDisplaySize`: it resizes the geometry and with it
      // `width`/`height`, so the hit area below stays in world units. Scaling
      // the knob instead would leave the hit area in *scaled* units and make
      // the 44px target wrong by the zoom squared.
      .setRadius(size / 2)
      .setStrokeStyle(1 / zoom, 0x0d1117);

    // The same rule as the scale handle: resizing does not carry the hit area,
    // and the hit area is what the finger actually hits.
    const area = this.rotateHandle.input?.hitArea;
    if (area instanceof Phaser.Geom.Rectangle) {
      const pad = (touch - size) / 2;
      area.setTo(-pad, -pad, touch, touch);
    }
  }

  /** The pooled outline for the nth selected object, created on first use. */
  private outlineAt(index: number): Phaser.GameObjects.Rectangle {
    let outline = this.selectionOutlines[index];
    if (!outline) {
      outline = this.add
        .rectangle(0, 0, 10, 10)
        .setOrigin(0)
        .setStrokeStyle(2, SELECTION_COLOR)
        .setFillStyle()
        .setDepth(1000)
        .setVisible(false);
      this.selectionOutlines[index] = outline;
    }
    return outline;
  }

  /**
   * Parks the scale handle on the selected object's bottom-right corner.
   *
   * On the object's *own* corner, not the corner of the axis-aligned selection
   * box: for a rotated object those are different points, and the handle has to
   * sit where the maths in `applyScale` thinks it is or the object jumps when
   * you grab it.
   *
   * Everything is divided by the camera zoom so the handle keeps one size on
   * screen. A handle that shrank with the scene would be untappable at the zoom
   * levels where precise sizing matters most.
   */
  private updateScaleHandle(target: Renderable): void {
    const { zoom } = this.cameras.main;
    const size = HANDLE_SIZE / zoom;
    const touch = HANDLE_TOUCH_SIZE / zoom;
    const corner = this.cornerOf(target);

    this.scaleHandle
      .setVisible(true)
      .setPosition(corner.x, corner.y)
      .setSize(size, size)
      .setStrokeStyle(1 / zoom, 0x0d1117);

    // setSize does not carry the hit area with it, and the hit area is what the
    // finger actually hits — it stays the touch target's size, centred on the
    // much smaller square that is drawn.
    const area = this.scaleHandle.input?.hitArea;
    if (area instanceof Phaser.Geom.Rectangle) {
      const pad = (touch - size) / 2;
      area.setTo(-pad, -pad, touch, touch);
    }
  }
}
