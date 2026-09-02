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

/**
 * The grid, which is the other half of the toolbar's snapping pair.
 *
 * Object snapping is switched off for this one on purpose: the scene rectangle
 * is a snap target in its own right, so with both on there would be two
 * explanations for the object landing on a round number and the assertion could
 * not say which had done it. Off also proves the two toggles are independent
 * rather than one being a mode of the other.
 */
const GRID = 50;
/** Sized in multiples of the pitch, so every one of its lines is on the grid. */
const TILE = { width: 300, height: 200 };
const TILE_START = { x: 250, y: 200 };

test('with the grid on, a drag lands on the pitch', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Tile');
  await editor.setField('Fill', A);
  await editor.setField('Width', TILE.width);
  await editor.setField('Height', TILE.height);
  await editor.setField('X', TILE_START.x);
  await editor.setField('Y', TILE_START.y);

  await editor.setSnapping(false);
  await editor.setGrid(true);
  await editor.setGridSize(GRID);

  // Six units past a grid crossing on both axes — inside the pull at either
  // project's zoom, and far enough that landing on the crossing cannot be the
  // pointer's own doing.
  const { start, end } = await aimAt(editor, TILE_START, {
    x: 400 + NEAR_MISS,
    y: 250 + NEAR_MISS,
  });
  await editor.drag(start, end);

  const moved = await positionOf(editor, 'Tile');
  expect(moved.x).toBe(400);
  expect(moved.y).toBe(250);

  await editor.setGrid(false);
  await editor.setSnapping(true);
});

/**
 * Equal spacing: joining a run of evenly spaced objects at the spacing it
 * already has.
 *
 * The fixture is built so that *only* a spacing snap can explain the result.
 * The two objects already placed are tall and narrow and the joiner is short
 * and wide, positioned so that no edge or centre line of any of them comes
 * within a threshold of any other on either axis — at the mobile project's zoom
 * that threshold is around 22 scene units, which is what all the clearances
 * below are sized against. So there is no line to catch on: the object either
 * matches the gap or lands where the pointer left it.
 */
const RUN_GAP = 100;
const POST = { width: 100, height: 500 };
const JOINER = { width: 200, height: 200 };
/** Spans 450..550 and 650..750, so the gap between them is RUN_GAP. */
const FIRST = { x: 500, y: 270 };
const SECOND = { x: 700, y: 270 };
const JOINER_START = { x: 600, y: 145 };
/** Joining before the run: right edge at 450 - RUN_GAP, so the centre is here. */
const JOINED_X = 250;

async function aRunOfTwo(editor: EditorPage) {
  await editor.clearScene();

  const place = async (
    name: string,
    fill: string,
    size: { width: number; height: number },
    at: { x: number; y: number },
  ) => {
    await editor.addObject('Rectangle');
    await editor.setField('Name', name);
    await editor.setField('Fill', fill);
    await editor.setField('Width', size.width);
    await editor.setField('Height', size.height);
    await editor.setField('X', at.x);
    await editor.setField('Y', at.y);
  };

  await place('First', A, POST, FIRST);
  await place('Second', A, POST, SECOND);
  await place('Joiner', B, JOINER, JOINER_START);
  await editor.closePanels();
}

test('a drag joining a row takes the spacing the row already has', async ({ editor }) => {
  await aRunOfTwo(editor);

  const { start, end } = await aimAt(editor, JOINER_START, {
    x: JOINED_X + NEAR_MISS,
    y: JOINER_START.y,
  });
  await editor.drag(start, end);

  const joiner = await positionOf(editor, 'Joiner');
  // The gap it made is the gap that was already there, to the unit. Stated as
  // the two gaps rather than as the position, because equality of gaps is the
  // claim — the position is only how it is achieved.
  const madeGap = FIRST.x - POST.width / 2 - (joiner.x + JOINER.width / 2);
  expect(madeGap).toBe(RUN_GAP);
  expect(joiner.x).toBe(JOINED_X);
  // Nothing was in range on the other axis, which is what makes the line above
  // a spacing snap rather than an edge one that happened to look like it.
  expect(joiner.y).toBe(JOINER_START.y);
});

test('the equal gaps are drawn while the spacing snap holds', async ({ editor }) => {
  await aRunOfTwo(editor);

  const { start, end } = await aimAt(editor, JOINER_START, {
    x: JOINED_X + NEAR_MISS,
    y: JOINER_START.y,
  });
  await editor.drag(start, end, { hold: true });

  // The same magenta the guides use — deliberately, since it is the same
  // feedback about the same gesture. Here it can only be the spacing bars and
  // their labels: this fixture has no line pair within a threshold on either
  // axis, so no guide can be drawn at all.
  expect((await editor.findDrawn(GUIDE)).count).toBeGreaterThan(0);

  await editor.endDrag();
  expect((await editor.findDrawn(GUIDE)).count).toBe(0);
});
