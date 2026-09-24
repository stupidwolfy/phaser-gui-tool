import { promises as fs } from 'node:fs';

import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';

/**
 * Tweens: a destination drawn, a preview that runs it, and a document that
 * never moves.
 *
 * `editing.spec` carries the "it draws where the document says, and survives a
 * save and an open" duty for every node type, and a tween adds no type — so
 * what is left here is everything that is about *time*, which is the particles
 * suite's split one feature over.
 *
 * The claim this file exists for is the last one: preview moves the object on
 * the canvas and **not in the document**, so switching it off puts everything
 * back exactly. That is the whole argument for why a tween may run here where a
 * physics step may not, and it is the one claim no single screenshot can make.
 */

/** The default rectangle fill, which is what a plain new rectangle draws in. */
const FILL = '#4f8cff';
/** The colour the editor draws a tween's destination outline in. */
const GHOST = '#78f000';

/** Big enough to have a middle that is not the scale handle's 44px target. */
const SIZE = { width: 240, height: 160 };
/** Where the object starts, and where it is told to end up. */
const START = { x: 220, y: 190 };
const TARGET_X = 720;

/** Screenshot centroids and CSS-pixel maths agree to a few pixels. */
const NEAR = 12;

/**
 * One rectangle, alone in the scene, sliding a long way to the right.
 *
 * The travel is deliberately most of the scene's width: at the mobile project's
 * zoom of ~0.37 a 100-unit move is 37 screen pixels, which is close enough to
 * the noise on a centroid that "it moved" would be a weak claim. 500 units is
 * about 185 screen pixels there and 500 on the desktop project, and neither is
 * arguable.
 *
 * A long duration for the same reason the playback tests use one: the claim is
 * that the object *reaches a state it did not start in*, polled — so the tween
 * has to still be travelling while the poll is looking.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('X', START.x);
  await editor.setField('Y', START.y);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);

  await editor.setTween(true);
  await editor.setTweenTarget('X', TARGET_X);
  await editor.setField('Tween duration ms', 4000);
  await editor.setField('Tween delay ms', 0);
  // Off, so the object travels one way and stays there — a yoyo would have the
  // poll below racing a return trip.
  await editor.checkbox('Tween goes back again').uncheck();
  await editor.setField('Tween repeat', 0);
  await editor.settle();
}

/** Where the object's own colour is, with nothing selected to occlude it. */
async function drawnAt(editor: EditorPage): Promise<number> {
  // Deselect first: the scale handle keeps a 44px *screen* target over the
  // object's bottom-right corner in the selection cyan, and a centroid averaged
  // over pixels it has covered sits several units off the object's real middle
  // — ten at the mobile project's zoom. Neither number is motion, and both look
  // exactly like it.
  await editor.deselect();
  return (await editor.findDrawn(FILL)).x;
}

test('the destination is drawn, and nothing has moved to it', async ({ editor }) => {
  await setup(editor);
  await editor.deselect();

  const start = await editor.sceneToScreen(START);
  const object = await editor.findDrawn(FILL);
  expect(object.count, 'the rectangle is not drawn at all').toBeGreaterThan(100);
  expect(Math.abs(object.x - start.x), 'the object moved with preview off').toBeLessThan(NEAR);

  // An extent, not a centroid: the ghost is a two-pixel dashed stroke, and each
  // of its four edges lands on a different sub-pixel phase — which drags a
  // centroid by a tenth of the shape's width for a reason that is not position.
  // The camera frame's lesson, and `findColorBox` is the reading immune to it.
  const ghost = await editor.findDrawnBox(GHOST);
  expect(ghost.count, 'no destination outline was drawn').toBeGreaterThan(20);

  const expected = await editor.sceneToScreen({ x: TARGET_X, y: START.y });
  const middle = ghost.x + ghost.width / 2;
  expect(Math.abs(middle - expected.x), 'the ghost is not at the destination').toBeLessThan(
    NEAR,
  );

  const zoom = await editor.zoom();
  expect(Math.abs(ghost.width - SIZE.width * zoom), 'the ghost is the wrong size').toBeLessThan(
    NEAR,
  );
});

test('preview runs it, and the ghost gives way to the motion', async ({ editor }) => {
  await setup(editor);

  const start = await drawnAt(editor);
  await editor.setPreview(true);

  // "It reaches a place it did not start in", polled — never "it is at x=720 at
  // 1.5s". What is on the canvas at any instant is a race with the frame rate,
  // and a fixed moment is a test that goes red on a loaded machine.
  await expect
    .poll(async () => (await editor.findDrawn(FILL)).x - start, {
      message: 'the tween never moved the object',
      timeout: 8000,
    })
    .toBeGreaterThan(60);

  // Shown exactly when the tween is not — one field, two appearances, which is
  // the emitter marker's rule one feature over.
  expect(
    (await editor.findDrawnBox(GHOST)).count,
    'the destination outline was still drawn while the tween ran',
  ).toBe(0);
});

test('switching preview off puts the object back where the document says', async ({
  editor,
}) => {
  await setup(editor);

  const start = await drawnAt(editor);
  await editor.setPreview(true);
  await expect
    .poll(async () => (await editor.findDrawn(FILL)).x - start, { timeout: 8000 })
    .toBeGreaterThan(60);

  await editor.setPreview(false);

  // In the same sync, with no wait beyond `setPreview`'s own settle. This is
  // the test that exists for the release-above-the-writes ordering: let go
  // *after* the document's values are restored and the object stays stranded
  // wherever the tween left it until some unrelated store change redraws it.
  expect(
    Math.abs((await editor.findDrawn(FILL)).x - start),
    'the object stayed where the tween left it',
  ).toBeLessThan(NEAR);

  expect(
    (await editor.findDrawnBox(GHOST)).count,
    'the destination outline did not come back',
  ).toBeGreaterThan(20);
});

test('previewing never writes the document', async ({ editor }) => {
  await setup(editor);

  const before = await editor.saveToFile();
  await editor.setPreview(true);
  await expect
    .poll(async () => (await editor.findDrawn(FILL)).x, { timeout: 8000 })
    .toBeGreaterThan((await editor.sceneToScreen(START)).x + 60);
  await editor.setPreview(false);

  const after = await editor.saveToFile();
  const node = (raw: string) => JSON.parse(raw).scenes[0].children[0];
  // The transform is byte-identical across a run of the tween. "There is no
  // version of run it for a moment that leaves the document alone" is the
  // physics section's argument for never simulating; a tween is allowed here
  // precisely because it does, and this is that difference asserted rather than
  // argued.
  expect(node(after.contents).transform).toEqual(node(before.contents).transform);
});

test('a tween survives a save and an open', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.setChoice('Tween ease', 'Bounce.easeOut');
  await editor.setField('Tween repeat', -1);

  const saved = await editor.saveToFile();
  const document = JSON.parse(saved.contents);
  // A tween is an optional field on a node and adds no node type, so it rides
  // in on `scenes` — which `parseProject` passes through verbatim — and an
  // older build neither drops it nor crashes on it. Asserted here so a future
  // bump is a deliberate act rather than a thing that happened.
  expect(document.schemaVersion).toBe(16);

  const stored = document.scenes[0].children[0].tween;
  expect(stored.to.x).toBe(TARGET_X);
  expect(stored.to.y, 'a property with no target was stored anyway').toBeUndefined();
  expect(stored.ease).toBe('Bounce.easeOut');
  expect(stored.repeat).toBe(-1);
  expect(stored.duration).toBe(4000);

  const path = testInfo.outputPath('tweened.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);
  await editor.selectInTree('Rectangle');
  expect(await editor.hasTween()).toBe(true);
  expect(await editor.numberValue('Tween X to')).toBe(TARGET_X);
  expect(await editor.selectValue('Tween ease')).toBe('Bounce.easeOut');

  await editor.deselect();
  const ghost = await editor.findDrawnBox(GHOST);
  expect(ghost.count, 'the reopened tween drew no destination').toBeGreaterThan(20);
});

test('a tween works on an object inside a group', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Group');
  await editor.setField('X', 200);
  await editor.setField('Y', 200);
  await editor.addObject('Rectangle');
  await editor.setField('X', 0);
  await editor.setField('Y', 0);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);

  // Offered at all, which is the whole contrast with a body: an Arcade body and
  // a drive-scheme both read world coordinates and are therefore refused inside
  // a group, while a tween writes the object's own local numbers.
  await editor.setTween(true);
  await editor.setTweenTarget('X', 400);
  await editor.setField('Tween duration ms', 4000);
  await editor.checkbox('Tween goes back again').uncheck();
  await editor.settle();
  await editor.deselect();

  // The destination is in the *group's* frame, so it lands at the group's
  // origin plus the target — which is what would be wrong if the ghost were
  // built from a world transform rather than the parent's.
  const ghost = await editor.findDrawnBox(GHOST);
  const expected = await editor.sceneToScreen({ x: 200 + 400, y: 200 });
  expect(ghost.count, 'a nested tween drew no destination').toBeGreaterThan(20);
  expect(Math.abs(ghost.x + ghost.width / 2 - expected.x)).toBeLessThan(NEAR);
});

test('two placements of one prefab each animate', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Width', 120);
  await editor.setField('Height', 80);
  await editor.setTween(true);
  await editor.setTweenTarget('X', 400);
  await editor.setField('Tween duration ms', 4000);
  await editor.checkbox('Tween goes back again').uncheck();
  await editor.settle();
  await editor.saveAsPrefab();
  await editor.setField('Prefab name', 'Mover');

  await editor.clearScene();
  await editor.placePrefab('Mover');
  await editor.setField('X', 160);
  await editor.setField('Y', 140);
  await editor.placePrefab('Mover');
  await editor.setField('X', 160);
  await editor.setField('Y', 330);
  await editor.deselect();

  // A box around each placement's starting position, measured separately —
  // because the claim is about *both* of them. A single centroid over the two
  // would move just as far when only one of them did, which is exactly the
  // reading an implementation keyed by node id would pass: two instances share
  // their children's ids, so one entry in the map would have the first
  // placement animate and the second sit frozen.
  const boxes = await Promise.all(
    [140, 330].map(async (y) => {
      const at = await editor.sceneToScreen({ x: 160, y });
      return { x: at.x - 90, y: at.y - 70, width: 180, height: 140 };
    }),
  );

  for (const box of boxes) {
    expect(await editor.countDrawnIn(FILL, box), 'a placement is not drawn').toBeGreaterThan(
      100,
    );
  }

  await editor.setPreview(true);
  await expect
    .poll(
      async () => {
        const counts = await Promise.all(boxes.map((box) => editor.countDrawnIn(FILL, box)));
        return Math.max(...counts);
      },
      { message: 'one of the two placements never moved', timeout: 8000 },
    )
    .toBeLessThan(100);
});

test('the ghost sits at the scene position the numbers describe', async ({ editor }) => {
  await setup(editor);
  // A destination on the other axis as well, so the ghost is a claim about two
  // numbers rather than one.
  await editor.setTweenTarget('Y', 380);
  await editor.deselect();

  const ghost = await editor.findDrawnBox(GHOST);
  const expected = await editor.sceneToScreen({ x: TARGET_X, y: 380 });
  expect(Math.abs(ghost.x + ghost.width / 2 - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(ghost.y + ghost.height / 2 - expected.y)).toBeLessThan(NEAR);
  expect(SCENE.height).toBeGreaterThan(380);
});
