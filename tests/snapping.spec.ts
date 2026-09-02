import { expect, test } from './helpers/fixtures';
import { PRIME, SCENE, type EditorPage } from './helpers/editor';

/**
 * Snapping a drag into line with what is already there.
 *
 * The claim under test is a precision one, so the assertions are exact: an
 * object dropped *near* a neighbour's edge does not land near it, it lands on
 * it. That is the whole difference between snapping and a steady hand, and a
 * tolerance-based assertion would pass just as happily without any snapping at
 * all — which is why the off case below drags to the same place and checks the
 * object stayed where the pointer left it.
 *
 * Both projects run all of it. Snapping matters most under a thumb, and the
 * gesture that reaches it differs between the two.
 */

/** Neither is the guide's magenta, so a centroid can only mean one thing. */
const A = '#ffcc00';
const B = '#00ff88';
/** The guide colour from EditorScene, which nothing else on the canvas uses. */
const GUIDE = '#ff3ea5';
/** Screenshot centroids and CSS-pixel maths agree to about a pixel. */
const NEAR = 4;

/**
 * Both rectangles this size, so aligned left edges mean equal x.
 *
 * Deliberately large: the scale handle keeps a 44px touch target around the
 * object's bottom-right corner, and at the mobile project's zoom a 100x60
 * object is 37x22 on screen — small enough that the handle's target covers its
 * own centre, so a press meant to drag it starts a resize instead. That is the
 * editor behaving as designed; the fixture has to be big enough to have a
 * middle that is not the handle.
 */
const SIZE = { width: 220, height: 140 };
const ANCHOR = { x: 300, y: 180 };
const START = { x: 650, y: 400 };
/** Inside the 8px snap radius at either project's zoom, and clear of it after. */
const NEAR_MISS = 6;

/**
 * Two rectangles of one size: a still one to catch on, and one to drag.
 *
 * Their vertical positions are deliberately far apart — every horizontal line
 * either could snap to is more than a threshold away from every other — so the
 * horizontal drags below can only ever snap on one axis, and a failure names
 * the axis it happened on.
 */
async function twoRectangles(editor: EditorPage) {
  // Nothing but these two: a new project's three example objects would be
  // three more things to snap to, and the assertions below name exact numbers.
  await editor.clearScene();

  const place = async (name: string, fill: string, at: { x: number; y: number }) => {
    await editor.addObject('Rectangle');
    await editor.setField('Name', name);
    await editor.setField('Fill', fill);
    await editor.setField('Width', SIZE.width);
    await editor.setField('Height', SIZE.height);
    await editor.setField('X', at.x);
    await editor.setField('Y', at.y);
  };

  await place('Anchor', A, ANCHOR);
  await place('Mover', B, START);
  await editor.closePanels();
}

/** The named node's stored position, straight out of a saved file. */
async function positionOf(editor: EditorPage, name: string) {
  const saved = await editor.saveToFile();
  const scene = JSON.parse(saved.contents).scenes[0];
  const node = scene.children.find((child: { name: string }) => child.name === name);
  return node.transform as { x: number; y: number };
}

/**
 * Aims a drag so that the *object* finishes on `target`, rather than the
 * pointer.
 *
 * The two differ by the priming move: Phaser captures the pointer-to-object
 * offset only once the drag threshold is cleared, so the object trails the
 * pointer by that distance for the rest of the gesture. Every test here is
 * about where the object comes to rest against another object, so every one of
 * them wants the compensated aim.
 */
async function aimAt(
  editor: EditorPage,
  from: { x: number; y: number },
  target: { x: number; y: number },
) {
  const start = await editor.sceneToScreen(from);
  const end = await editor.sceneToScreen(target);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return {
    start,
    end: {
      x: end.x + ((end.x - start.x) / length) * PRIME,
      y: end.y + ((end.y - start.y) / length) * PRIME,
    },
  };
}

/**
 * Drags the mover to `target` in scene coordinates and returns where the
 * pointer alone would have put it.
 *
 * The pointer's own answer is worth returning because the two tests want
 * opposite things from it: with snapping on it must be overridden, with
 * snapping off it must be honoured exactly.
 */
async function dragMoverTo(editor: EditorPage, target: { x: number; y: number }) {
  const { start, end } = await aimAt(editor, START, target);
  const moved = await editor.drag(start, end);
  const zoom = await editor.zoom();
  return { x: START.x + moved.x / zoom, y: START.y + moved.y / zoom };
}

test('a drag that comes close to another object lands exactly on its edge', async ({
  editor,
}) => {
  await twoRectangles(editor);

  // Six units short of aligned: near enough to be caught, far enough that
  // landing on the anchor's edge cannot be the pointer's own doing.
  const unsnapped = await dragMoverTo(editor, { x: ANCHOR.x + NEAR_MISS, y: START.y });
  expect(Math.abs(unsnapped.x - ANCHOR.x)).toBeLessThan(8);

  // The canvas first: reading the document means saving, and on mobile the file
  // sheet covers the very canvas the next assertion would screenshot.
  const drawn = await editor.findDrawn(B);
  const expected = await editor.sceneToScreen({ x: ANCHOR.x, y: START.y });
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);

  // Equal widths, so equal x is equal left edges — and equal centres, and equal
  // right edges, which is why this one number is the whole assertion.
  const moved = await positionOf(editor, 'Mover');
  expect(moved.x).toBe(ANCHOR.x);
  // The axis nothing was in range of is untouched, and still rounds to a whole
  // pixel the way an unsnapped drag always has.
  expect(moved.y).toBe(START.y);
});

test('with snapping off the same drag lands where the pointer left it', async ({
  editor,
}) => {
  await twoRectangles(editor);
  await editor.setSnapping(false);

  const unsnapped = await dragMoverTo(editor, { x: ANCHOR.x + NEAR_MISS, y: START.y });

  // Within a pixel of the pointer's own answer, and nowhere near the anchor:
  // the point is that nothing corrected it, not that it hit a exact number the
  // harness could equally have derived from the snap.
  const moved = await positionOf(editor, 'Mover');
  expect(Math.abs(moved.x - unsnapped.x)).toBeLessThanOrEqual(1);
  expect(moved.x).not.toBe(ANCHOR.x);

  await editor.setSnapping(true);
});

test('a lone object snaps to the centre of the scene', async ({ editor }) => {
  // The scene rectangle is a snap target in its own right, which is what makes
  // snapping useful in a project that has only one object in it — centring the
  // first thing you place is the most common alignment there is.
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Only');
  await editor.setField('Fill', A);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
  await editor.setField('X', 220);
  await editor.setField('Y', 160);
  await editor.closePanels();

  const centre = { x: SCENE.width / 2, y: SCENE.height / 2 };
  const { start, end } = await aimAt(
    editor,
    { x: 220, y: 160 },
    { x: centre.x + NEAR_MISS, y: centre.y + NEAR_MISS },
  );
  await editor.drag(start, end);

  const moved = await positionOf(editor, 'Only');
  expect(moved.x).toBe(centre.x);
  expect(moved.y).toBe(centre.y);
});

test('guides are drawn while the snap holds, and gone once it is dropped', async ({
  editor,
}) => {
  await twoRectangles(editor);

  const { start, end } = await aimAt(editor, START, { x: ANCHOR.x + NEAR_MISS, y: START.y });
  // Held down: the guides exist only for the duration of the gesture, so a
  // drag that completes before the screenshot would show an empty canvas and
  // look exactly like a guide that was never drawn.
  await editor.drag(start, end, { hold: true });

  // At the default tolerance, which a hairline guide would fail: a one-pixel
  // line never reaches full strength through antialiasing, and matching it
  // loosely enough to see would also match an object's own antialiased edge.
  // Two screen pixels is what gives the line a solid middle — the same weight
  // the selection outline carries, for the same reason.
  expect((await editor.findDrawn(GUIDE)).count).toBeGreaterThan(0);

  await editor.endDrag();
  expect((await editor.findDrawn(GUIDE)).count).toBe(0);
});
