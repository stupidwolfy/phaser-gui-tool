import Phaser from 'phaser';
import { activeScene, useEditorStore, type EditorState } from '../../core/store';
import { findNode, type GameObjectNode, type Project } from '../../core/schema';
import { decodeImage, decodedImage } from '../../core/assets';

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
 * Texture keys are namespaced so that `syncTextures` can tell the textures it
 * owns from Phaser's own (`__DEFAULT`, `__MISSING`) and never remove those.
 */
const textureKeyForAsset = (assetId: string): string => `asset:${assetId}`;
const PLACEHOLDER_TEXTURE = 'editor:no-image';
/** Side of the stand-in square drawn for a sprite with no image yet. */
const PLACEHOLDER_SIZE = 96;

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

/** Three decimals: finer than the eye at any zoom, and readable in a field. */
const roundScale = (value: number): number =>
  Math.max(MIN_SCALE, Math.round(value * 1000) / 1000);

/** '#rrggbb' -> 0xrrggbb, tolerating a missing '#' or a malformed value. */
function hexToNumber(hex: string, fallback = 0xffffff): number {
  const parsed = Number.parseInt(String(hex).replace('#', ''), 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

type Renderable =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Ellipse
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Image;

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

function hitTestFor(node: GameObjectNode) {
  return node.type === 'ellipse'
    ? Phaser.Geom.Ellipse.Contains
    : Phaser.Geom.Rectangle.Contains;
}

export class EditorScene extends Phaser.Scene {
  static readonly KEY = 'editor';

  private displayObjects = new Map<string, Renderable>();
  /** Texture keys this scene created, so shutdown and pruning only touch ours. */
  private assetTextures = new Set<string>();
  /** Data URLs currently being decoded, so a slow image is only decoded once. */
  private decoding = new Set<string>();
  /** False after SHUTDOWN, so an in-flight decode can't touch a dead scene. */
  private alive = true;
  private sceneFrame!: Phaser.GameObjects.Rectangle;
  private selectionOutline!: Phaser.GameObjects.Rectangle;
  private scaleHandle!: Phaser.GameObjects.Rectangle;
  private unsubscribe?: () => void;

  /**
   * The state a corner-scale gesture needs to be resolved against its start
   * rather than against the previous frame, so a drag out and back returns the
   * object to the size it began at instead of accumulating rounding drift.
   */
  private scaling: {
    id: string;
    /** Unscaled half-size of the object, in world units. */
    halfWidth: number;
    halfHeight: number;
    scaleX: number;
    scaleY: number;
    /** Corner minus pointer at grab time, so the handle doesn't jump to it. */
    grabOffsetX: number;
    grabOffsetY: number;
  } | null = null;

  /** Set between dragstart/dragend so the store sync can't fight the pointer. */
  private draggingId: string | null = null;
  private isPanning = false;
  private pinchDistance = 0;
  /** Once the user has zoomed or panned, stop re-framing the view for them. */
  private cameraTouched = false;
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
  private selectionAtPress: string | null = null;

  constructor() {
    super(EditorScene.KEY);
  }

  create(): void {
    this.alive = true;
    // Before anything can ask for a texture: a sprite with no image yet still
    // has to be drawn, selected and dragged, so it gets a real stand-in rather
    // than nothing at all.
    this.createPlaceholderTexture();

    // Outline of the scene's own bounds, so the user can see where the game
    // canvas ends even when the camera is zoomed out past it.
    this.sceneFrame = this.add
      .rectangle(0, 0, 100, 100)
      .setOrigin(0)
      .setStrokeStyle(1, FRAME_COLOR)
      .setFillStyle()
      .setDepth(-1000);

    this.selectionOutline = this.add
      .rectangle(0, 0, 10, 10)
      .setOrigin(0)
      .setStrokeStyle(2, SELECTION_COLOR)
      .setFillStyle()
      .setDepth(1000)
      .setVisible(false);

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
      const key = textureKeyForAsset(asset.id);
      wanted.add(key);
      if (this.textures.exists(key)) continue;

      const image = decodedImage(asset.dataUrl);
      if (image) {
        this.textures.addImage(key, image);
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
  private textureKeyFor(assetId: string | null): string {
    if (!assetId) return PLACEHOLDER_TEXTURE;
    const key = textureKeyForAsset(assetId);
    return this.textures.exists(key) ? key : PLACEHOLDER_TEXTURE;
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
      (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
        const id = object.getData('nodeId') as string | undefined;
        if (!id) return;
        this.selectionAtPress = store.getState().selectedId;
        store.getState().select(id);
      },
    );

    // A press that hits nothing clears the selection and starts a camera pan.
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length > 0) return;
        this.selectionAtPress = null;
        store.getState().select(null);
        this.isPanning = true;
      },
    );

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.isPanning = false;
      this.pinchDistance = 0;
      // Not just DRAG_END: if Phaser never emits one, an open transaction would
      // silently swallow every later edit's undo entry.
      this.finishDrag();
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
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

    // Phaser's own drag system handles the pointer bookkeeping; dragX/dragY
    // arrive already in world space, so camera zoom and pan are accounted for.
    this.input.on(
      Phaser.Input.Events.DRAG_START,
      (pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
        // The handle first, and before the touch rule below: it carries no
        // nodeId, so that rule would compare null against the selection, decide
        // they differ and reject every scale drag made with a finger.
        if (object.getData('handle') === 'scale') {
          this.beginScale(pointer);
          return;
        }

        const id = (object.getData('nodeId') as string | undefined) ?? null;

        // Touch is a two-step interaction: the first press only selects, and
        // only the already-selected object can then be dragged. A fingertip
        // covers far more than a cursor, so honouring the first touch as a drag
        // moved whichever object it happened to graze. A mouse is precise
        // enough that press-and-drag in one gesture is still the right feel.
        if (pointer.wasTouch && id !== this.selectionAtPress) {
          this.dragRejected = true;
          return;
        }

        this.dragRejected = false;
        this.draggingId = id;
        // One undo entry per drag, not one per pointer-move.
        store.getState().beginTransaction();
      },
    );

    this.input.on(
      Phaser.Input.Events.DRAG,
      (
        pointer: Phaser.Input.Pointer,
        object: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (object.getData('handle') === 'scale') {
          // dragX/dragY describe where the handle would go; the scale is a
          // function of where the pointer is relative to the object, so this
          // gesture reads the pointer directly instead.
          this.applyScale(pointer);
          return;
        }

        const id = object.getData('nodeId') as string | undefined;
        if (!id || this.dragRejected) return;

        // Exact floats while the finger is down; finishDrag rounds once at the
        // end. Rounding per-move would step in whole world units, which is
        // visible as stutter when the camera is zoomed in.
        store.getState().updateTransform(id, { x: dragX, y: dragY });
      },
    );

    // Every way a gesture can end routes here, because on a real device several
    // of them fire and some of them don't: DRAG_END, a normal pointer up, a
    // pointer released off-canvas, or the browser cancelling the touch outright
    // when it decides the gesture was a scroll.
    const endGesture = () => {
      this.isPanning = false;
      this.pinchDistance = 0;
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

    const id = this.draggingId;
    if (id === null) return;
    this.draggingId = null;

    const store = useEditorStore;
    const node = findNode(activeScene(store.getState().project).children, id);
    if (node) {
      store.getState().updateTransform(id, {
        x: Math.round(node.transform.x),
        y: Math.round(node.transform.y),
      });
    }
    store.getState().endTransaction();
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
    const id = store.selectedId;
    const object = id ? this.displayObjects.get(id) : undefined;
    if (!id || !object) return;

    const halfWidth = object.width / 2;
    const halfHeight = object.height / 2;
    // A zero-sized object has no corner to drag and no ratio to scale by.
    if (halfWidth <= 0 || halfHeight <= 0) return;

    const corner = this.cornerOf(object);
    this.scaling = {
      id,
      halfWidth,
      halfHeight,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      grabOffsetX: corner.x - pointer.worldX,
      grabOffsetY: corner.y - pointer.worldY,
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

    const angle = -object.rotation;
    const dx = pointer.worldX + gesture.grabOffsetX - object.x;
    const dy = pointer.worldY + gesture.grabOffsetY - object.y;
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

  /** The object's own bottom-right corner in world space, rotation included. */
  private cornerOf(object: Renderable): { x: number; y: number } {
    const offsetX = (object.width / 2) * object.scaleX;
    const offsetY = (object.height / 2) * object.scaleY;
    const cos = Math.cos(object.rotation);
    const sin = Math.sin(object.rotation);
    return {
      x: object.x + offsetX * cos - offsetY * sin,
      y: object.y + offsetX * sin + offsetY * cos,
    };
  }

  update(): void {
    this.updatePinch();
    this.updateSelectionOutline();
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
    this.cameras.main.setBackgroundColor(scene.backgroundColor);

    this.sceneFrame.setPosition(0, 0).setSize(scene.width, scene.height);

    // Before the nodes: a sprite created this pass needs its texture to already
    // exist, or Phaser falls back to its own missing-texture green square.
    this.syncTextures(state.project);

    // Only top-level nodes render for now. Nested children exist in the schema
    // but need Phaser Containers to position correctly, which arrives with the
    // container node type — drawing them flat here would just place them wrong.
    this.syncNodes(scene.children);
  }

  private syncNodes(nodes: GameObjectNode[]): void {
    const seen = new Set<string>();

    nodes.forEach((node, index) => {
      seen.add(node.id);
      let object = this.displayObjects.get(node.id);

      // A node whose type changed has to be rebuilt, not updated.
      if (object && object.getData('nodeType') !== node.type) {
        object.destroy();
        this.displayObjects.delete(node.id);
        object = undefined;
      }

      if (!object) {
        object = this.createDisplayObject(node);
        this.displayObjects.set(node.id, object);
      }

      this.applyNode(object, node, index);
    });

    for (const [id, object] of this.displayObjects) {
      if (seen.has(id)) continue;
      object.destroy();
      this.displayObjects.delete(id);
    }
  }

  private createDisplayObject(node: GameObjectNode): Renderable {
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
        object = this.add.image(0, 0, this.textureKeyFor(node.props.assetId));
        break;
    }

    object.setData('nodeId', node.id);
    object.setData('nodeType', node.type);
    object.setInteractive(hitAreaFor(object, node), hitTestFor(node));
    this.input.setDraggable(object);
    return object;
  }

  private applyNode(object: Renderable, node: GameObjectNode, index: number): void {
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
        const image = object as Phaser.GameObjects.Image;
        const key = this.textureKeyFor(node.props.assetId);
        // Swapping the image changes the object's size, which the hit area
        // below then follows — the same reason text needs it as you type.
        if (image.texture.key !== key) image.setTexture(key);
        image.setAlpha(node.props.alpha);
        // Multiply is the default tint mode, so white is exactly "no tint".
        image.setTint(hexToNumber(node.props.tint));
        image.setFlip(node.props.flipX, node.props.flipY);
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
   * Keeps the input hit area in step with the object's size. Without this, a
   * resized object stays clickable only at its original dimensions — and a text
   * object, whose size follows its content, drifts out of step as you type.
   */
  private applyHitArea(object: Renderable): void {
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
    const { selectedId } = useEditorStore.getState();
    const target = selectedId ? this.displayObjects.get(selectedId) : undefined;

    if (!target || !target.visible) {
      this.selectionOutline.setVisible(false);
      this.scaleHandle.setVisible(false);
      return;
    }

    // getBounds() is already axis-aligned and accounts for rotation and scale,
    // so the outline stays correct without duplicating the transform maths.
    const bounds = target.getBounds();
    this.selectionOutline
      .setVisible(true)
      .setPosition(bounds.x, bounds.y)
      .setSize(bounds.width, bounds.height)
      // Constant on-screen thickness regardless of how far the camera is zoomed.
      .setStrokeStyle(2 / this.cameras.main.zoom, SELECTION_COLOR);

    this.updateScaleHandle(target);
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
