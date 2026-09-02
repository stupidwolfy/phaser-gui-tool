/**
 * Pulling a dragged object into line with the ones already there.
 *
 * Align and distribute (see `bounds.ts`) tidy a layout up *after* it has been
 * built; this does it while the finger is still down, which is the half that
 * matters on a phone. A thumb on a 390px screen cannot land an object on 240.0,
 * and until now the only way to line two things up was to drag roughly, select
 * both, open a panel and press a button. Snapping makes the drag itself the
 * alignment.
 *
 * Three kinds of agreement are on offer, and they are tried in that order on
 * each axis independently:
 *
 * 1. an **edge or centre line** shared with another object,
 * 2. an **equal gap** continuing a run of objects already evenly spaced,
 * 3. a **grid** line.
 *
 * The order is the strength of the intent behind each. Sharing an edge with a
 * specific object is a decision about *those two objects*; matching a gap is a
 * decision about a run; the grid agrees with everything everywhere and so has
 * the least to say about where this object in particular belongs. Resolving
 * them the other way round would have the grid quietly overrule the object you
 * were plainly aiming at.
 *
 * Pure geometry over the same measured boxes align and distribute use, and
 * deliberately nothing else: no store, no scene, no camera. The renderer
 * decides *what* is a candidate and how wide the threshold is in world units;
 * this decides where the move lands and what to draw for it.
 */

import { rectBottom, rectCenterX, rectCenterY, rectRight, type Axis, type Rect } from './bounds';

/**
 * A line to draw while the snap is in force, in scene coordinates.
 *
 * It carries its own extent rather than spanning the viewport: a guide that
 * runs the width of the screen says only "something over there agrees", while
 * one drawn from the dragged object to the object it caught on says *which*
 * object, which is the whole content of the feedback.
 */
export interface Guide {
  /** 'x' for a vertical line at a constant x, 'y' for a horizontal one. */
  axis: Axis;
  position: number;
  /** The line's extent along the other axis. */
  from: number;
  to: number;
}

/**
 * One of the equal gaps an equal-spacing snap has produced, as a bar to draw
 * across it.
 *
 * A gap is not a line, so it cannot be shown as one: the claim is "this space
 * is the same size as that space", and the only way to say it is to draw both
 * spaces. `distance` is carried so the renderer can label the bar — the number
 * is what turns two bars that look similar into two bars that are equal.
 */
export interface Spacing {
  /** The axis the gap is measured *along*. */
  axis: Axis;
  /** The gap's extent along that axis. */
  from: number;
  to: number;
  /** Where to draw the bar on the other axis: the middle of the shared band. */
  cross: number;
  distance: number;
}

export interface SnapResult {
  /** Added to the move being made, so no snap on an axis is simply 0. */
  dx: number;
  dy: number;
  guides: Guide[];
  spacings: Spacing[];
}

export interface SnapOptions {
  /**
   * Grid pitch in world units; 0 or absent for no grid.
   *
   * A pitch rather than a full grid description because that is all the
   * geometry needs: the grid is infinite and anchored at the scene origin, so
   * every line on it is a multiple of this one number.
   */
  grid?: number;
}

/**
 * The three lines an object snaps by, on one axis.
 *
 * Edges before the centre so that an edge-to-edge match wins a tie: two objects
 * sharing a left edge is a layout decision, whereas the centres agreeing at the
 * same moment is usually a coincidence of them being the same width.
 */
const linesOf = (rect: Rect, axis: Axis): number[] =>
  axis === 'x'
    ? [rect.x, rectRight(rect), rectCenterX(rect)]
    : [rect.y, rectBottom(rect), rectCenterY(rect)];

const spanOf = (rect: Rect, axis: Axis): [number, number] =>
  axis === 'x' ? [rect.y, rectBottom(rect)] : [rect.x, rectRight(rect)];

const startOf = (rect: Rect, axis: Axis): number => (axis === 'x' ? rect.x : rect.y);
const endOf = (rect: Rect, axis: Axis): number =>
  axis === 'x' ? rectRight(rect) : rectBottom(rect);
const sizeOf = (rect: Rect, axis: Axis): number =>
  axis === 'x' ? rect.width : rect.height;

/** Floats that came out of the same subtraction, compared as the same line. */
const SAME_LINE = 1e-6;

/** Keeps the smallest correction seen, within the threshold. */
function closest(threshold: number) {
  let best: number | null = null;
  return {
    offer(offset: number) {
      if (Math.abs(offset) > threshold) return;
      if (best === null || Math.abs(offset) < Math.abs(best)) best = offset;
    },
    get value() {
      return best;
    },
  };
}

/** The smallest correction on one axis that brings a line onto a target's. */
function bestOffset(moving: Rect, targets: readonly Rect[], axis: Axis, threshold: number) {
  const best = closest(threshold);

  for (const target of targets) {
    for (const to of linesOf(target, axis)) {
      for (const from of linesOf(moving, axis)) {
        best.offer(to - from);
      }
    }
  }
  return best.value;
}

/**
 * Every target the snapped box now agrees with, as lines to draw.
 *
 * All of them, not just the one that decided the offset: dragging a box onto a
 * column of three already-aligned objects should light the whole column up, and
 * the guide is drawn across the objects that share the line, so it reads as
 * "these four agree" rather than "you are at x = 240".
 */
function guidesFor(snapped: Rect, targets: readonly Rect[], axis: Axis): Guide[] {
  const guides: Guide[] = [];
  const [movingFrom, movingTo] = spanOf(snapped, axis);

  for (const target of targets) {
    for (const position of linesOf(target, axis)) {
      const hit = linesOf(snapped, axis).some((line) => Math.abs(line - position) < SAME_LINE);
      if (!hit) continue;
      const [targetFrom, targetTo] = spanOf(target, axis);
      guides.push({
        axis,
        position,
        from: Math.min(movingFrom, targetFrom),
        to: Math.max(movingTo, targetTo),
      });
      // One line per target: a target agreeing on two of its own lines at once
      // (a zero-width object) has nothing more to say the second time.
      break;
    }
  }
  return guides;
}

// -----------------------------------------------------------------------------
// Equal spacing
// -----------------------------------------------------------------------------

/**
 * Where two boxes overlap on the axis *across* the one being measured, or null
 * when they miss each other entirely.
 *
 * This is what makes a "row" a row. Spacing along x is only meaningful between
 * objects that are side by side — two boxes in opposite corners of the scene
 * have a horizontal gap in the arithmetic sense and nothing a person would call
 * one, so matching it would move things for reasons the user cannot see.
 */
function bandOverlap(a: Rect, b: Rect, axis: Axis): [number, number] | null {
  const [aFrom, aTo] = spanOf(a, axis);
  const [bFrom, bTo] = spanOf(b, axis);
  const from = Math.max(aFrom, bFrom);
  const to = Math.min(aTo, bTo);
  return from <= to ? [from, to] : null;
}

/** Where to draw a bar spanning the gap between two boxes: their shared band. */
function crossOf(a: Rect, b: Rect, axis: Axis): number {
  const overlap = bandOverlap(a, b, axis);
  if (overlap) return (overlap[0] + overlap[1]) / 2;
  const [aFrom, aTo] = spanOf(a, axis);
  const [bFrom, bTo] = spanOf(b, axis);
  return (Math.min(aFrom, bFrom) + Math.max(aTo, bTo)) / 2;
}

interface Gap {
  before: Rect;
  after: Rect;
  size: number;
}

/**
 * The clear space between each neighbouring pair in a row, in order.
 *
 * Pairs that overlap produce no gap at all rather than a negative one: objects
 * sitting on top of each other are not a run with a spacing, and letting a
 * negative through would offer to match it, which reads as the editor pushing
 * things into each other.
 */
function gapsIn(row: readonly Rect[], axis: Axis): Gap[] {
  const ordered = [...row].sort((a, b) => startOf(a, axis) - startOf(b, axis));
  const gaps: Gap[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const before = ordered[index];
    const after = ordered[index + 1];
    const size = startOf(after, axis) - endOf(before, axis);
    if (size > SAME_LINE) gaps.push({ before, after, size });
  }
  return gaps;
}

/**
 * The smallest correction that makes the moving box's gap equal one already in
 * the row.
 *
 * Three placements, which between them are every way a box joins an evenly
 * spaced run: after its far end, before its near end, or into the middle of an
 * existing gap with equal space on both sides. The third is distribute-as-you-
 * drag — dropping something exactly between two objects — and it is the one of
 * the three that a steady hand never gets right.
 */
function spacingOffset(
  moving: Rect,
  row: readonly Rect[],
  axis: Axis,
  threshold: number,
): number | null {
  const best = closest(threshold);

  for (const gap of gapsIn(row, axis)) {
    best.offer(endOf(gap.after, axis) + gap.size - startOf(moving, axis));
    best.offer(startOf(gap.before, axis) - gap.size - endOf(moving, axis));

    const slack = gap.size - sizeOf(moving, axis);
    if (slack >= 0) best.offer(endOf(gap.before, axis) + slack / 2 - startOf(moving, axis));
  }
  return best.value;
}

/**
 * The bars to draw for a snapped box: its own gap, and every other gap in the
 * row that is the same size.
 *
 * The equality is the whole message, so a single bar would say nothing — and
 * lighting every matching gap is the same choice `guidesFor` makes for lines,
 * for the same reason: dropping a box onto the end of an evenly spaced run
 * should show the whole run agreeing, not just the pair nearest the finger.
 */
function spacingsFor(snapped: Rect, row: readonly Rect[], axis: Axis): Spacing[] {
  const gaps = gapsIn([...row, snapped], axis);
  const mine = gaps.filter((gap) => gap.before === snapped || gap.after === snapped);
  if (mine.length === 0) return [];

  const matched = gaps.filter((gap) =>
    mine.some((own) => Math.abs(own.size - gap.size) < SAME_LINE),
  );
  // One bar is a measurement, not an agreement: without a second gap the same
  // size there is nothing being claimed and nothing worth drawing.
  if (matched.length < 2) return [];

  return matched.map((gap) => ({
    axis,
    from: endOf(gap.before, axis),
    to: startOf(gap.after, axis),
    cross: crossOf(gap.before, gap.after, axis),
    distance: gap.size,
  }));
}

// -----------------------------------------------------------------------------
// Grid
// -----------------------------------------------------------------------------

/**
 * The smallest correction that puts one of the box's lines on a grid line.
 *
 * All three lines, not just the leading edge: a box whose width is not a
 * multiple of the pitch can only ever have one of its edges on the grid, and
 * which one the user meant is answered by whichever is nearest to the one they
 * dragged it to.
 */
function gridOffset(moving: Rect, axis: Axis, grid: number, threshold: number): number | null {
  if (!(grid > 0)) return null;
  const best = closest(threshold);
  for (const line of linesOf(moving, axis)) {
    best.offer(Math.round(line / grid) * grid - line);
  }
  return best.value;
}

/**
 * Where a proposed move should actually land, and what to draw for it.
 *
 * `moving` is the dragged set's box *after* the raw move, so this is a
 * correction to a position rather than a position: the caller adds `dx`/`dy` to
 * the move it was about to make. The axes are resolved independently, so an
 * object can catch a neighbour's left edge without its vertical position being
 * touched — coupling them would make a horizontal drag jump vertically.
 *
 * The threshold is in world units; the caller divides its screen-pixel
 * threshold by the camera zoom, so the pull stays the same size to the finger
 * however far in the view is. Fixed in world units instead, snapping would be
 * unusably sticky zoomed out and unreachable zoomed in.
 */
export function snapMove(
  moving: Rect,
  targets: readonly Rect[],
  threshold: number,
  options: SnapOptions = {},
): SnapResult {
  const resolve = (axis: Axis) => {
    // Only the objects sharing a band with the moving box are a row it could
    // be spaced within; the same list decides both the offset and the bars.
    const row = targets.filter((target) => bandOverlap(moving, target, axis) !== null);

    const edge = bestOffset(moving, targets, axis, threshold);
    if (edge !== null) return { offset: edge, kind: 'edge' as const, row };

    const spacing = spacingOffset(moving, row, axis, threshold);
    if (spacing !== null) return { offset: spacing, kind: 'spacing' as const, row };

    const grid = gridOffset(moving, axis, options.grid ?? 0, threshold);
    if (grid !== null) return { offset: grid, kind: 'grid' as const, row };

    return null;
  };

  const x = resolve('x');
  const y = resolve('y');
  const snapped: Rect = {
    ...moving,
    x: moving.x + (x?.offset ?? 0),
    y: moving.y + (y?.offset ?? 0),
  };

  const drawn = (axis: Axis, result: ReturnType<typeof resolve>) => {
    if (result?.kind === 'edge') return { guides: guidesFor(snapped, targets, axis), spacings: [] };
    if (result?.kind === 'spacing') {
      return { guides: [], spacings: spacingsFor(snapped, result.row, axis) };
    }
    // A grid snap draws nothing of its own: the grid is already on the canvas,
    // and the object visibly landing on it is the feedback. A guide along a
    // line that is drawn anyway would only say it twice.
    return { guides: [], spacings: [] };
  };

  const horizontal = drawn('x', x);
  const vertical = drawn('y', y);

  return {
    dx: x?.offset ?? 0,
    dy: y?.offset ?? 0,
    guides: [...horizontal.guides, ...vertical.guides],
    spacings: [...horizontal.spacings, ...vertical.spacings],
  };
}
