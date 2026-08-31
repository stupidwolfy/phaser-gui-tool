import Phaser from 'phaser';
import { activeScene, useEditorStore, type EditorState } from '../../core/store';
import type { GameObjectNode } from '../../core/schema';

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

/** '#rrggbb' -> 0xrrggbb, tolerating a missing '#' or a malformed value. */
function hexToNumber(hex: string, fallback = 0xffffff): number {
  const parsed = Number.parseInt(String(hex).replace('#', ''), 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

type Renderable =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Ellipse
  | Phaser.GameObjects.Text;

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
  private sceneFrame!: Phaser.GameObjects.Rectangle;
  private selectionOutline!: Phaser.GameObjects.Rectangle;
  private unsubscribe?: () => void;

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
      this.scale.off(Phaser.Scale.Events.RESIZE);
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    });
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
        _pointer: Phaser.Input.Pointer,
        object: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        const id = object.getData('nodeId') as string | undefined;
        if (!id || this.dragRejected) return;

        // Phaser's drag system reports the pointer but never moves anything
        // itself, and the store sync deliberately skips the object under the
        // pointer (below). So this is the only thing moving it — without it the
        // object simply does not follow your finger.
        (object as Renderable).setPosition(dragX, dragY);

        store
          .getState()
          .updateTransform(id, { x: Math.round(dragX), y: Math.round(dragY) });
      },
    );

    this.input.on(Phaser.Input.Events.DRAG_END, () => {
      if (this.dragRejected) {
        this.dragRejected = false;
        return;
      }
      // Order matters: endTransaction publishes a store change, and the sync it
      // triggers is what settles the object on its final rounded position.
      // Clearing draggingId afterwards meant that sync was still skipped, and
      // the object stayed visually stale until some later, unrelated store
      // change happened to redraw it.
      this.draggingId = null;
      store.getState().endTransaction();
    });

    // A gesture can end without DRAG_END: the browser reclaims the touch, or the
    // finger leaves the canvas. Left unhandled that stranded draggingId, and the
    // store sync then refused to reposition that object ever again.
    const endGesture = () => {
      this.isPanning = false;
      this.pinchDistance = 0;
      if (this.draggingId !== null) {
        this.draggingId = null;
        store.getState().endTransaction();
      }
      this.dragRejected = false;
    };
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endGesture);
    this.game.canvas.addEventListener('pointercancel', endGesture);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.canvas?.removeEventListener('pointercancel', endGesture);
    });
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
    }

    object.setData('nodeId', node.id);
    object.setData('nodeType', node.type);
    object.setInteractive(hitAreaFor(object, node), hitTestFor(node));
    this.input.setDraggable(object);
    return object;
  }

  private applyNode(object: Renderable, node: GameObjectNode, index: number): void {
    const { transform } = node;

    // Skip the position of the object under the pointer. The DRAG handler is
    // already tracking it 1:1, and re-applying the rounded store value on every
    // pointer-move would fight that with visible jitter.
    if (this.draggingId !== node.id) {
      object.setPosition(transform.x, transform.y);
    }
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
  }
}
