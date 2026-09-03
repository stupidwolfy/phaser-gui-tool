import fs from 'node:fs/promises';
import { expect, test } from './helpers/fixtures';
import { PRIME, SCENE, type EditorPage } from './helpers/editor';

/**
 * Guides the user placed, and objects agreeing with them.
 *
 * Every other line an object can snap to is incidental — wherever another
 * object happens to sit, or wherever the grid falls. A guide is the one line
 * the user authored, and it is the only part of the snapping family that is
 * document state, so these tests carry two claims the other suites do not: that
 * a guide *survives a save*, and that it outranks everything else on its axis.
 *
 * Both projects run all of it. The threshold is much wider in world units on
 * mobile — 8 screen pixels over a zoom of ~0.37 is about 22 scene units against
 * ~9 on desktop — so every clearance below is sized against the mobile figure.
 */

const A = '#ffcc00';
const B = '#00ff88';
/** `PLACED_GUIDE_COLOR` in EditorScene. Nothing else on the canvas is amber. */
const PLACED = '#ffa723';
/** `GUIDE_COLOR`: the snap magenta a held guide turns. */
const HELD = '#ff3ea5';
const NEAR = 4;

/** Big enough to have a middle that is not the scale handle's 44px target. */
const SIZE = { width: 220, height: 140 };
const START = { x: 650, y: 400 };
/** Where the tests put the guide: clear of the scene's own centre lines. */
const GUIDE_X = 300;
/** Inside the snap radius on both projects, outside it once snapped. */
const NEAR_MISS = 6;

/** A scene holding one draggable rectangle and one guide at `GUIDE_X`. */
async function oneRectangleAndAGuide(editor: EditorPage) {
  // A new project's three example objects would be three more things to snap
  // to, and every assertion here names an exact number.
  await editor.clearScene();

  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Mover');
  await editor.setField('Fill', B);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
  await editor.setField('X', START.x);
  await editor.setField('Y', START.y);

  await editor.addGuide('x');
  // The button drops it down the middle of the scene, which is also the scene
  // rectangle's own centre line — so a snap there would prove nothing about
  // guides. Moved off it before anything is measured.
  await editor.setField('Guide 1 x', GUIDE_X);
  await editor.closePanels();
}

/** The scene straight out of a saved file. */
async function savedScene(editor: EditorPage) {
  const saved = await editor.saveToFile();
  return JSON.parse(saved.contents) as {
    schemaVersion: number;
    scenes: {
      guides?: { id: string; axis: 'x' | 'y'; position: number }[];
      children: { name: string; transform: { x: number; y: number } }[];
    }[];
  };
}

async function positionOf(editor: EditorPage, name: string) {
  const file = await savedScene(editor);
  const node = file.scenes[0].children.find((child) => child.name === name);
  return node!.transform;
}

/**
 * Drags the mover so the *object* — not the pointer — finishes on `target`.
 *
 * Phaser captures the pointer-to-object offset only once its 8px threshold is
 * cleared, so the object trails the pointer by the priming move for the rest of
 * the gesture. See `snapping.spec.ts`, which compensates the same way.
 */
async function dragMoverTo(
  editor: EditorPage,
  target: { x: number; y: number },
  options?: { hold?: boolean },
) {
  const start = await editor.sceneToScreen(START);
  const aim = await editor.sceneToScreen(target);
  const length = Math.hypot(aim.x - start.x, aim.y - start.y);
  const end = {
    x: aim.x + ((aim.x - start.x) / length) * PRIME,
    y: aim.y + ((aim.y - start.y) / length) * PRIME,
  };
  const moved = await editor.drag(start, end, options);
  const zoom = await editor.zoom();
  return { x: START.x + moved.x / zoom, y: START.y + moved.y / zoom };
}

test('a guide is drawn where the document says it is', async ({ editor }) => {
  await oneRectangleAndAGuide(editor);

  const drawn = await editor.findDrawn(PLACED);
  expect(drawn.count).toBeGreaterThan(0);
  const expected = await editor.sceneToScreen({ x: GUIDE_X, y: SCENE.height / 2 });
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
});

test('a drag that comes close to a guide lands exactly on it', async ({ editor }) => {
  await oneRectangleAndAGuide(editor);

  // Six units short: near enough to be caught on both projects, far enough that
  // landing on the guide cannot be the pointer's own doing.
  const unsnapped = await dragMoverTo(editor, { x: GUIDE_X + NEAR_MISS, y: START.y });
  expect(Math.abs(unsnapped.x - GUIDE_X)).toBeLessThan(8);

  // The canvas first: reading the document means saving, and on mobile the file
  // sheet covers the very canvas the next assertion would screenshot.
  const drawn = await editor.findDrawn(B);
  const expected = await editor.sceneToScreen({ x: GUIDE_X, y: START.y });
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);

  // The object's own centre line is what caught, so its x is the guide's.
  const moved = await positionOf(editor, 'Mover');
  expect(moved.x).toBe(GUIDE_X);
  // Nothing was in range on the other axis, which still rounds to whole pixels.
  expect(moved.y).toBe(START.y);
});

test('a guide outranks an object edge in range at the same time', async ({ editor }) => {
  await oneRectangleAndAGuide(editor);

  // An anchor whose centre sits 5 units off the guide. Both lines are inside
  // the capture radius on both projects, so the two candidates are genuinely
  // competing and the winner is decided by the precedence chain alone — which
  // is the whole content of "a guide is the strongest agreement on offer".
  const offset = 5;
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Anchor');
  await editor.setField('Fill', A);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
  await editor.setField('X', GUIDE_X + offset);
  // Far enough up that no horizontal line of the two can be in range of the
  // other, so a failure can only be about the axis under test.
  await editor.setField('Y', 120);
  await editor.closePanels();

  await editor.selectInTree('Mover');
  await dragMoverTo(editor, { x: GUIDE_X + NEAR_MISS, y: START.y });

  const moved = await positionOf(editor, 'Mover');
  expect(moved.x).toBe(GUIDE_X);
  expect(moved.x).not.toBe(GUIDE_X + offset);
});

test('the guide holding a drag lights up, and only while it is held', async ({
  editor,
}) => {
  await oneRectangleAndAGuide(editor);

  // At rest the guide is amber and nothing on the canvas is the snap magenta.
  expect((await editor.findDrawn(HELD)).count).toBe(0);

  await dragMoverTo(editor, { x: GUIDE_X + NEAR_MISS, y: START.y }, { hold: true });

  // Mid-gesture the guide itself turns magenta — the line that is already
  // there, answering *which* guide caught, rather than a second line drawn
  // beside it saying the same thing twice.
  expect((await editor.findDrawn(HELD)).count).toBeGreaterThan(0);

  await editor.endDrag();
  expect((await editor.findDrawn(HELD)).count).toBe(0);
  expect((await editor.findDrawn(PLACED)).count).toBeGreaterThan(0);
});

test('hiding the guides stops them being drawn and stops objects agreeing with them', async ({
  editor,
}) => {
  await oneRectangleAndAGuide(editor);
  await editor.setGuidesVisible(false);
  await editor.closePanels();

  expect((await editor.findDrawn(PLACED)).count).toBe(0);

  // The toggle claims both halves: a snap onto a line that is not on screen is
  // the editor moving things for a reason the user cannot see, which is the
  // rule that already keeps hidden objects out of the snap targets.
  const unsnapped = await dragMoverTo(editor, { x: GUIDE_X + NEAR_MISS, y: START.y });
  const moved = await positionOf(editor, 'Mover');
  expect(Math.abs(moved.x - unsnapped.x)).toBeLessThanOrEqual(1);
  expect(moved.x).not.toBe(GUIDE_X);

  await editor.setGuidesVisible(true);
});

test('a guide dragged on the canvas moves, in one undo step', async ({ editor }) => {
  await oneRectangleAndAGuide(editor);

  const from = await editor.sceneToScreen({ x: GUIDE_X, y: SCENE.height / 2 });
  const to = await editor.sceneToScreen({ x: GUIDE_X + 200, y: SCENE.height / 2 });
  // `select: false`, as the rotate tests must: guides are exempt from the
  // two-step touch rule, so a mobile pre-tap would only get in the way.
  await editor.drag(from, to, { select: false });

  const drawn = await editor.findDrawn(PLACED);
  expect(Math.abs(drawn.x - to.x)).toBeLessThan(NEAR + PRIME);

  // One gesture, one undo step: back on the number it started on, not on some
  // position from the middle of the drag.
  await editor.undo();
  const back = await editor.findDrawn(PLACED);
  const expected = await editor.sceneToScreen({ x: GUIDE_X, y: SCENE.height / 2 });
  expect(Math.abs(back.x - expected.x)).toBeLessThan(NEAR);
});

test('a guide dragged off the scene is removed, and one undo brings it back', async ({
  editor,
}) => {
  await oneRectangleAndAGuide(editor);

  const from = await editor.sceneToScreen({ x: GUIDE_X, y: SCENE.height / 2 });
  const to = await editor.sceneToScreen({ x: -80, y: SCENE.height / 2 });
  await editor.drag(from, to, { select: false });

  expect((await editor.findDrawn(PLACED)).count).toBe(0);

  await editor.undo();
  const back = await editor.findDrawn(PLACED);
  expect(back.count).toBeGreaterThan(0);
  const expected = await editor.sceneToScreen({ x: GUIDE_X, y: SCENE.height / 2 });
  expect(Math.abs(back.x - expected.x)).toBeLessThan(NEAR);
});

test('clearing the guides is one undo step, and does nothing when there are none', async ({
  editor,
}) => {
  await oneRectangleAndAGuide(editor);
  await editor.addGuide('y');
  await editor.clearGuides();
  await editor.closePanels();
  expect((await editor.findDrawn(PLACED)).count).toBe(0);

  // Both guides come back together: one action, one step.
  await editor.undo();
  await editor.closePanels();
  expect((await editor.findDrawn(PLACED)).count).toBeGreaterThan(0);
  const scene = (await savedScene(editor)).scenes[0];
  expect(scene.guides).toHaveLength(2);
});

test('guides survive a save and an open, on a version they did not bump', async ({
  editor,
}, testInfo) => {
  await oneRectangleAndAGuide(editor);
  await editor.addGuide('y');
  await editor.setField('Guide 2 y', 200);
  await editor.closePanels();

  const saved = await editor.saveToFile();
  const file = JSON.parse(saved.contents);

  // Asserted in the artefact, not only in a comment: an older build passes
  // `scenes` through verbatim and reads none of these fields, so a file with
  // guides opens, draws identically and even carries them back out on a
  // re-save. That is why guides needed no bump, and it is still true.
  //
  // The number has moved twice all the same, each time for a reason of its own.
  // v4: sprite sheets and animations live on the asset table and the project,
  // both of which *are* rebuilt field by field, so an older build drops them
  // silently. v5: prefabs answer the question below with *both* halves at once
  // — `parseProject` names `prefabs` one field at a time, so a v4 build drops
  // the whole library on open and re-saves without it, and a v4 build also has
  // no `'instance'` case in `createDisplayObject`, so it leaves the object
  // undefined and crashes on the nodes. Either alone would have bumped it.
  //
  // This literal is here to keep every such bump a deliberate act — when it
  // fails, the question to answer is whether the new field is a guide (passed
  // through, no bump) or a sheet (rebuilt, bump), not merely to update the
  // number.
  expect(file.schemaVersion).toBe(5);
  expect(file.scenes[0].guides).toEqual([
    { id: expect.any(String), axis: 'x', position: GUIDE_X },
    { id: expect.any(String), axis: 'y', position: 200 },
  ]);

  const path = testInfo.outputPath('guides.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  const drawn = await editor.findDrawn(PLACED);
  expect(drawn.count).toBeGreaterThan(0);
});
