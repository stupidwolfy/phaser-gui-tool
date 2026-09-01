/**
 * Where objects actually are on the canvas, and the maths that lines them up.
 *
 * Alignment needs each object's *drawn* box, and the document does not hold
 * one. A rectangle's box could be worked out from its props, but a text
 * object's is whatever the font measured to, a sprite's is its image's
 * intrinsic size, and a group's is the union of everything inside it — all
 * three are answers only the renderer has. `EditorScene` already computes
 * exactly this box for the selection outline, the hit area and the scale
 * handle, so it publishes what it measured here rather than a second
 * implementation being written against half the information.
 *
 * This is not document state and is never saved: it is a cache of what the
 * last frame drew, keyed by node id. It lives outside the store on purpose —
 * the scene syncs on every store change, so writing measurements *into* the
 * store would have each sync schedule the next one.
 */

/** An axis-aligned box in scene (world) coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

let measured: ReadonlyMap<string, Rect> = new Map();

/** Called by the renderer at the end of each sync, with every node it drew. */
export function publishBounds(bounds: ReadonlyMap<string, Rect>): void {
  measured = bounds;
}

/**
 * The box last drawn for a node, or undefined when it has not been drawn yet.
 *
 * Undefined is a real answer rather than a failure: an action that arrives
 * before the first frame — or for a node the renderer has not caught up with —
 * has nothing to align against, and doing nothing is the only safe response.
 */
export function boundsOf(id: string): Rect | undefined {
  return measured.get(id);
}

export const rectRight = (rect: Rect): number => rect.x + rect.width;
export const rectBottom = (rect: Rect): number => rect.y + rect.height;
export const rectCenterX = (rect: Rect): number => rect.x + rect.width / 2;
export const rectCenterY = (rect: Rect): number => rect.y + rect.height / 2;

/** Which edge or centre line an alignment lines objects up on. */
export type AlignEdge = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom';

export type Axis = 'x' | 'y';

/** The smallest box containing all of them. Undefined for an empty list. */
export function unionRect(rects: readonly Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map(rectRight));
  const bottom = Math.max(...rects.map(rectBottom));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** A world-space move, per node id. Zero entries are left in; callers skip them. */
export type Deltas = Map<string, { dx: number; dy: number }>;

/**
 * How far each box must move to line up with the others on `edge`.
 *
 * The target is the selection's own bounding box, so aligning left moves
 * everything to the leftmost object rather than to the scene or to whichever
 * object happened to be picked first. Nothing outside the selection moves, and
 * running the same alignment twice is a no-op — both of which are what makes
 * it safe to press repeatedly while looking at the result.
 */
export function alignDeltas(boxes: ReadonlyMap<string, Rect>, edge: AlignEdge): Deltas {
  const deltas: Deltas = new Map();
  const union = unionRect([...boxes.values()]);
  if (!union) return deltas;

  for (const [id, box] of boxes) {
    switch (edge) {
      case 'left':
        deltas.set(id, { dx: union.x - box.x, dy: 0 });
        break;
      case 'centerX':
        deltas.set(id, { dx: rectCenterX(union) - rectCenterX(box), dy: 0 });
        break;
      case 'right':
        deltas.set(id, { dx: rectRight(union) - rectRight(box), dy: 0 });
        break;
      case 'top':
        deltas.set(id, { dx: 0, dy: union.y - box.y });
        break;
      case 'middleY':
        deltas.set(id, { dx: 0, dy: rectCenterY(union) - rectCenterY(box) });
        break;
      case 'bottom':
        deltas.set(id, { dx: 0, dy: rectBottom(union) - rectBottom(box) });
        break;
    }
  }
  return deltas;
}

/**
 * Even spacing along one axis, by centres.
 *
 * The two outermost objects stay exactly where they are and everything between
 * them is spread evenly, which is what makes distribute a tidying-up operation
 * rather than a move: the selection's extent does not change, so pressing it
 * cannot walk a layout off the screen.
 *
 * Centres rather than gaps: with objects of different sizes the two readings
 * differ, and even centres is the one that stays predictable when a text object
 * grows as it is typed into. Fewer than three objects have nothing to spread —
 * the outer two are the whole selection — so that returns no moves at all.
 */
export function distributeDeltas(boxes: ReadonlyMap<string, Rect>, axis: Axis): Deltas {
  const deltas: Deltas = new Map();
  if (boxes.size < 3) return deltas;

  const centerOf = axis === 'x' ? rectCenterX : rectCenterY;
  const ordered = [...boxes].sort((a, b) => centerOf(a[1]) - centerOf(b[1]));
  const first = centerOf(ordered[0][1]);
  const last = centerOf(ordered[ordered.length - 1][1]);
  const step = (last - first) / (ordered.length - 1);

  ordered.forEach(([id, box], index) => {
    const move = first + step * index - centerOf(box);
    deltas.set(id, axis === 'x' ? { dx: move, dy: 0 } : { dx: 0, dy: move });
  });
  return deltas;
}
