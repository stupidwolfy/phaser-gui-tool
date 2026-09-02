import { expect, test } from './helpers/fixtures';
import { PRIME, SCENE, type EditorPage, type Point } from './helpers/editor';

/**
 * Turning an object on the canvas, and the angle agreeing with something.
 *
 * Rotation was an inspector field until now, so the first claim here is simply
 * that a gesture exists. The rest are the snapping claims, and they are exact
 * for the reason the drag-snapping suite's are: an object turned *near* 45° and
 * left there would satisfy a tolerance just as happily with no snapping at all,
 * which is why every case below is paired with the same drag proving the raw
 * angle is somewhere else.
 *
 * One thing is easier here than anywhere else in the suite. The rotation
 * threshold is in degrees and is *not* divided by the camera zoom, so it is the
 * same 5° on both projects — unlike the drag threshold, which is ~9 scene units
 * on desktop and ~22 on mobile and shapes every fixture in `snapping.spec.ts`.
 */

/** Neither is the guide's magenta, so a centroid can only mean one thing. */
const A = '#ffcc00';
const MARKER = '#00ff88';
/** The guide colour from EditorScene — the ticks and the readout chip share it. */
const GUIDE = '#ff3ea5';
/** Screenshot centroids and CSS-pixel maths agree to about a pixel. */
const NEAR = 5;

/**
 * Big enough to have a middle that is not a handle's touch target, which is the
 * fixture rule the rest of the suite already follows — and big enough that its
 * top edge, where the rotate knob is parked, is well clear of its own centre at
 * the mobile project's zoom.
 */
const SIZE = { width: 220, height: 140 };
const CENTRE = { x: SCENE.width / 2, y: SCENE.height / 2 };

interface SavedNode {
  name: string;
  transform: { rotation: number };
  children: SavedNode[];
}

/**
 * The named node's stored transform, straight out of a saved file.
 *
 * Recursive, unlike the flat lookup in `snapping.spec.ts`: one case here turns
 * a group, and the object it has to check is inside it.
 */
async function transformOf(editor: EditorPage, name: string) {
  const saved = await editor.saveToFile();
  const find = (nodes: SavedNode[]): SavedNode | undefined => {
    for (const node of nodes) {
      if (node.name === name) return node;
      const inside = find(node.children);
      if (inside) return inside;
    }
    return undefined;
  };
  const found = find((JSON.parse(saved.contents).scenes[0].children as SavedNode[]) ?? []);
  if (!found) throw new Error(`no node named ${name} in the saved project`);
  return found.transform;
}

async function placeRectangle(
  editor: EditorPage,
  name: string,
  fill: string,
  at: Point,
  rotation = 0,
) {
  await editor.addObject('Rectangle');
  await editor.setField('Name', name);
  await editor.setField('Fill', fill);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
  await editor.setField('X', at.x);
  await editor.setField('Y', at.y);
  if (rotation !== 0) await editor.setField('Rotation°', rotation);
}

/**
 * A rotate drag that sweeps the object by exactly `sweep` degrees.
 *
 * The priming move is the whole difficulty, and it behaves differently here
 * than in a drag. Phaser captures the grab only once the 8px threshold is
 * cleared, so the gesture measures from the *primed* point — which for a move
 * shifts where the object ends up, and for a rotation shifts where the gesture
 * *starts*. At the knob's radius those 12px are several degrees, and more on
 * the mobile project than the desktop one, so an exact-angle assertion cannot
 * ignore them.
 *
 * The primed point sits on the chord rather than the circle, so its angle
 * depends on where the drag ends, which depends on its angle. Three fixed-point
 * passes settle it — each moves the answer by a fraction of a degree, and it is
 * deterministic rather than merely convergent.
 */
async function sweepBy(editor: EditorPage, pivotScene: Point, halfHeight: number, sweep: number) {
  const pivot = await editor.sceneToScreen(pivotScene);
  const from = await editor.rotateHandleAt(pivotScene, halfHeight);
  const radius = Math.hypot(from.x - pivot.x, from.y - pivot.y);
  const at = (degrees: number): Point => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return { x: pivot.x + Math.cos(radians) * radius, y: pivot.y + Math.sin(radians) * radius };
  };

  let end = at(sweep);
  for (let pass = 0; pass < 3; pass += 1) {
    const length = Math.hypot(end.x - from.x, end.y - from.y);
    const primed = {
      x: from.x + ((end.x - from.x) / length) * PRIME,
      y: from.y + ((end.y - from.y) / length) * PRIME,
    };
    const primedDegrees =
      (Math.atan2(primed.y - pivot.y, primed.x - pivot.x) * 180) / Math.PI + 90;
    end = at(primedDegrees + sweep);
  }
  return { from, end };
}

/**
 * Turns the named object by `sweep` degrees with the rotate knob.
 *
 * `select: false` is not a shortcut. On mobile `drag` would otherwise tap the
 * start point first to satisfy the two-step touch rule — and the handles are
 * deliberately *exempt* from that rule, so sending the tap would hide the very
 * thing this exercises: a finger can turn an object without a preparatory press
 * on the knob.
 */
async function rotate(
  editor: EditorPage,
  name: string,
  sweep: number,
  { hold = false, halfHeight = SIZE.height / 2, pivot = CENTRE } = {},
) {
  await editor.selectInTree(name);
  await editor.closePanels();
  const { from, end } = await sweepBy(editor, pivot, halfHeight, sweep);
  await editor.drag(from, end, { select: false, hold });
}

test('the rotate knob turns the selected object', async ({ editor }) => {
  await editor.clearScene();
  await placeRectangle(editor, 'Mover', A, CENTRE);
  // Nothing to agree with and no step: the angle can only be the gesture's.
  await editor.setSnapping(false);

  await rotate(editor, 'Mover', 60);

  // Two degrees, because the sweep is compensated geometrically and the
  // pointer travels the chord rather than the arc. The claim is that the
  // gesture writes the angle it was given, not that it is exact to a
  // thousandth — the exactness claims below are the snapping ones.
  const turned = await transformOf(editor, 'Mover');
  expect(Math.abs(turned.rotation - 60)).toBeLessThan(2);

  await editor.setSnapping(true);
});

test('a rotate drag lands on the angle step', async ({ editor }) => {
  await editor.clearScene();
  await placeRectangle(editor, 'Mover', A, CENTRE);
  await editor.setAngleStep(15);
  await editor.setGrid(true);
  // The magnet off, so landing on a round number can only be the step's doing —
  // and so this also proves the two toggles are independent rather than one
  // being a mode of the other.
  await editor.setSnapping(false);

  // Three degrees past 45: inside the 5° capture, and nowhere near 30 or 60.
  await rotate(editor, 'Mover', 48);

  const turned = await transformOf(editor, 'Mover');
  expect(turned.rotation).toBe(45);

  await editor.setGrid(false);
  await editor.setSnapping(true);
});

test('with both toggles off the same drag keeps the angle the pointer left', async ({
  editor,
}) => {
  await editor.clearScene();
  await placeRectangle(editor, 'Mover', A, CENTRE);
  await editor.setSnapping(false);

  await rotate(editor, 'Mover', 48);

  // The mirror of the case above, and what makes it mean anything: the same
  // drag, nothing to correct it, and an angle that is emphatically not 45.
  const turned = await transformOf(editor, 'Mover');
  expect(Math.abs(turned.rotation - 48)).toBeLessThan(2);
  expect(turned.rotation).not.toBe(45);

  await editor.setSnapping(true);
});

test("a rotate drag agrees with another object's angle", async ({ editor }) => {
  await editor.clearScene();
  // 37 is deliberately not a multiple of 15, and is 7° from 30 and 8° from 45,
  // so a step could not be mistaken for it even if the grid leaked on.
  await placeRectangle(editor, 'Anchor', MARKER, { x: 240, y: 150 }, 37);
  await placeRectangle(editor, 'Mover', A, CENTRE);
  await editor.setGrid(false);
  await editor.setSnapping(true);

  await rotate(editor, 'Mover', 40);

  const turned = await transformOf(editor, 'Mover');
  expect(turned.rotation).toBe(37);
});

test('the agreement is drawn while the snap holds and gone once it is dropped', async ({
  editor,
}) => {
  await editor.clearScene();
  await placeRectangle(editor, 'Anchor', MARKER, { x: 240, y: 150 }, 37);
  await placeRectangle(editor, 'Mover', A, CENTRE);
  await editor.setGrid(false);
  await editor.setSnapping(true);

  // Held, because the ticks and the readout only exist while the pointer is
  // down — a test that completes the drag can never see them.
  await rotate(editor, 'Mover', 40, { hold: true });
  expect((await editor.findDrawn(GUIDE)).count).toBeGreaterThan(0);

  await editor.endDrag();
  expect((await editor.findDrawn(GUIDE)).count).toBe(0);
});

test('a step snap draws its readout', async ({ editor }) => {
  await editor.clearScene();
  await placeRectangle(editor, 'Mover', A, CENTRE);
  await editor.setAngleStep(15);
  await editor.setGrid(true);
  // One object and no magnet, so there are no ticks: whatever magenta the
  // canvas holds can only be the readout. Without this the label could quietly
  // never render and the case above would still pass on its ticks alone.
  await editor.setSnapping(false);

  await rotate(editor, 'Mover', 48, { hold: true });
  expect((await editor.findDrawn(GUIDE)).count).toBeGreaterThan(0);

  await editor.endDrag();
  await editor.setGrid(false);
  await editor.setSnapping(true);
});

test('turning a group turns what is inside it', async ({ editor }) => {
  await editor.clearScene();
  // Adding lands in the group you are working in, so the marker goes inside.
  await editor.addObject('Group');
  await editor.setField('Name', 'Crew');
  await editor.setField('X', CENTRE.x);
  await editor.setField('Y', CENTRE.y);
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Marker');
  await editor.setField('Fill', MARKER);
  await editor.setField('Width', 60);
  await editor.setField('Height', 60);
  await editor.setField('X', 0);
  await editor.setField('Y', -150);
  await editor.setAngleStep(15);
  await editor.setGrid(true);
  await editor.setSnapping(false);

  // The group's box is its child's, so its top edge is 180 units above the
  // pivot — 150 up to the marker's centre plus its own half-height.
  await rotate(editor, 'Crew', 88, { halfHeight: 180 });

  // The drawn half, and the reason this case exists at all: a centred
  // rectangle's colour blob has the same centroid at every angle, so
  // `findDrawn` literally cannot see it turn. An off-centre child is the
  // smallest fixture the pixel helper can see a rotation in — and it is
  // exactly what a `toParentSpace` mistake would move to the wrong place.
  const drawn = await editor.findDrawn(MARKER);
  const expected = await editor.sceneToScreen({ x: CENTRE.x + 150, y: CENTRE.y });
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);

  const turned = await transformOf(editor, 'Crew');
  expect(turned.rotation).toBe(90);

  await editor.setGrid(false);
  await editor.setSnapping(true);
});

test('a rotate drag is one undo step', async ({ editor }) => {
  await editor.clearScene();
  await placeRectangle(editor, 'Mover', A, CENTRE);
  await editor.setSnapping(false);

  await rotate(editor, 'Mover', 60);
  await editor.undo();

  // Without the transaction the drag would push an entry per pointer-move and
  // one undo would step back a single frame.
  const turned = await transformOf(editor, 'Mover');
  expect(turned.rotation).toBe(0);

  await editor.setSnapping(true);
});
