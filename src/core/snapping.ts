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
 * Pure geometry over the same measured boxes align and distribute use, and
 * deliberately nothing else: no store, no scene, no camera. The renderer
 * decides *what* is a candidate and how wide the threshold is in world units;
 * this decides where the move lands and which lines to draw for it.
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

export interface SnapResult {
  /** Added to the move being made, so no snap on an axis is simply 0. */
  dx: number;
  dy: number;
  guides: Guide[];
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

/** Floats that came out of the same subtraction, compared as the same line. */
const SAME_LINE = 1e-6;

/** The smallest correction on one axis that brings a line onto a target's. */
function bestOffset(moving: Rect, targets: readonly Rect[], axis: Axis, threshold: number) {
  let best: number | null = null;

  for (const target of targets) {
    for (const to of linesOf(target, axis)) {
      for (const from of linesOf(moving, axis)) {
        const offset = to - from;
        if (Math.abs(offset) > threshold) continue;
        if (best === null || Math.abs(offset) < Math.abs(best)) best = offset;
      }
    }
  }
  return best;
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
): SnapResult {
  if (targets.length === 0) return { dx: 0, dy: 0, guides: [] };

  const dx = bestOffset(moving, targets, 'x', threshold);
  const dy = bestOffset(moving, targets, 'y', threshold);
  const snapped: Rect = { ...moving, x: moving.x + (dx ?? 0), y: moving.y + (dy ?? 0) };

  return {
    dx: dx ?? 0,
    dy: dy ?? 0,
    guides: [
      ...(dx === null ? [] : guidesFor(snapped, targets, 'x')),
      ...(dy === null ? [] : guidesFor(snapped, targets, 'y')),
    ],
  };
}
