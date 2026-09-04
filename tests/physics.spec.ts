import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';

/**
 * Arcade physics bodies: attaching one, seeing it, and getting it back.
 *
 * The load-bearing claim of the whole feature is a *negative* one — the editor
 * draws a body and never runs it — and a negative about time cannot be asserted
 * in a single screenshot. So the first test shoots the canvas, waits, and
 * shoots it again, which is the playback test's "poll for a statement about
 * time passing" inverted: there the claim was that something moves, here it is
 * that nothing does.
 *
 * Nothing here drags, so none of these fixtures is shaped by the mobile
 * project's ~22-scene-unit snap threshold. Every other spec in this suite is,
 * and its absence would otherwise read as an oversight.
 */

/** `BODY_COLOR` in EditorScene. Nothing else on this canvas is pure green. */
const BODY = '#00ff00';

/** Where the object under test sits, and how big it is drawn. */
const AT = { x: SCENE.width / 2, y: SCENE.height / 2 };
const SIZE = { width: 240, height: 160 };

/** Screenshot centroids and CSS-pixel maths agree to a few pixels. */
const NEAR = 10;

/**
 * One rectangle at the scene centre, big enough for its outline to be several
 * hundred screenshot pixels on the mobile project as well as the desktop one.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('X', AT.x);
  await editor.setField('Y', AT.y);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
}

test('a body draws a box over its object, and nothing ever moves it', async ({
  editor,
}) => {
  await setup(editor);

  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBe(0);

  await editor.setPhysics(true);

  // Deselected before any of this is measured, and that is not tidiness. The
  // scale handle keeps a 44px *screen* target over the box's bottom-right
  // corner while the object is selected, so it occludes some of the very pixels
  // being averaged — at the mobile project's zoom a 240x160 box is only ~89x59
  // on screen, and the handle drags the centroid ten pixels off the object's
  // own centre for a reason that has nothing to do with the body.
  await editor.deselect();
  await editor.closePanels();

  const drawn = await editor.findDrawn(BODY);
  expect(drawn.count).toBeGreaterThan(0);
  const expected = await editor.sceneToScreen(AT);
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);

  // The whole of "the editor never simulates". Gravity is on and the body is
  // dynamic, so a canvas that ran the world would have dropped this object off
  // the bottom of the scene long before the wait is over — and the document's
  // own Y would either be stale or rewritten. Neither happens.
  //
  // Re-baselined after the gravity is set rather than compared against `drawn`:
  // on mobile the inspector is a sheet, so opening it shortens the canvas and
  // the camera re-fits, which moves every screen coordinate for a reason that
  // is not motion either. Both of the two shots below are taken with the same
  // chrome and the same camera, so they can be compared exactly.
  await editor.setGravity(0, 800);
  await editor.closePanels();

  const settled = await editor.findDrawn(BODY);
  const centre = await editor.sceneToScreen(AT);
  expect(Math.abs(settled.y - centre.y)).toBeLessThan(NEAR);

  await editor.page.waitForTimeout(1200);
  const later = await editor.findDrawn(BODY);
  expect(Math.abs(later.x - settled.x)).toBeLessThan(2);
  expect(Math.abs(later.y - settled.y)).toBeLessThan(2);

  await editor.selectInTree('Rectangle');
  expect(await editor.numberValue('Y')).toBe(AT.y);
});

test('a static body is marked apart from a dynamic one', async ({ editor }) => {
  await setup(editor);
  await editor.setPhysics(true);
  await editor.closePanels();
  const dynamic = (await editor.findDrawn(BODY)).count;

  await editor.setChoice('Body', 'Static — never moves');
  await editor.closePanels();
  const staticCount = (await editor.findDrawn(BODY)).count;

  // The cross through the box. A count comparison rather than a claim about
  // shape, which is all a colour centroid can honestly make: two diagonals of a
  // 240x160 box are about two thirds of its perimeter again.
  expect(staticCount).toBeGreaterThan(dynamic * 1.3);
});

test('an object inside a group cannot be given a body', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Group');
  await editor.addObject('Rectangle');

  // Adding lands in the group you are working in, so the rectangle is already
  // inside it — which is the case this refuses.
  await editor.openPanel('inspect');
  await expect(editor.checkbox('Physics body')).toHaveCount(0);
  await expect(
    editor.panel('inspect').getByText('Only an object in the scene itself'),
  ).toBeVisible();
});

test('moving a body into a group hides it, and moving it back brings it back', async ({
  editor,
}) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('X', AT.x);
  await editor.setField('Y', AT.y);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
  await editor.setPhysics(true);
  await editor.setField('Velocity X', 120);

  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBeGreaterThan(0);

  // A group has to exist before the parent picker can offer it, and adding one
  // while the rectangle is selected puts it beside rather than inside.
  await editor.addObject('Group');
  await editor.selectInTree('Rectangle');
  await editor.setChoice('Group', 'Group');

  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBe(0);

  // Stripped on read, kept in the document: the numbers come back untouched
  // rather than having been deleted on the way in.
  await editor.setChoice('Group', 'Scene');
  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBeGreaterThan(0);
  expect(await editor.numberValue('Velocity X')).toBe(120);
});

test('the types Arcade cannot simulate offer nothing', async ({ editor }) => {
  await editor.clearScene();

  for (const type of ['Group', 'Particles', 'Tiles'] as const) {
    await editor.addObject(type);
    await editor.openPanel('inspect');
    await expect(editor.panel('inspect').getByText('Physics', { exact: true })).toHaveCount(0);
    await editor.deselect();
  }
});

test('a body and the scene gravity survive a save and an open, at schema 7', async ({
  editor,
}, testInfo) => {
  await setup(editor);
  await editor.setPhysics(true);
  await editor.setField('Bounce Y', 0.75);
  await editor.setField('Drag X', 40);
  await editor.setPhysicsFlag('Affected by gravity', false);
  await editor.deselect();
  await editor.setGravity(0, 600);

  // The canvas first: on mobile the file sheet covers it, so a `findDrawn`
  // after the save would screenshot the sheet and report the body missing.
  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBeGreaterThan(0);

  const saved = await editor.saveToFile();
  const project = JSON.parse(saved.contents);

  // Unbumped, and asserted so that a future bump is a deliberate act rather
  // than something that happens to a file — the guides and scenes precedent.
  // A body rides in on `scenes`, which the parser passes through verbatim, so
  // a deployed older build opens this file and draws it identically.
  expect(project.schemaVersion).toBe(7);
  expect(project.scenes[0].physics).toEqual({ gravityX: 0, gravityY: 600 });
  expect(project.scenes[0].children[0].physics).toMatchObject({
    kind: 'dynamic',
    bounceY: 0.75,
    dragX: 40,
    allowGravity: false,
    collideWorldBounds: true,
  });

  const path = testInfo.outputPath('physics.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  await editor.openFile(path);

  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBeGreaterThan(0);

  await editor.selectInTree('Rectangle');
  expect(await editor.hasPhysics()).toBe(true);
  expect(await editor.numberValue('Bounce Y')).toBe(0.75);
  expect(await editor.numberValue('Drag X')).toBe(40);
});

test('gravity appears only once something in the scene has a body', async ({
  editor,
}) => {
  await setup(editor);
  await editor.deselect();
  await editor.openPanel('inspect');
  await expect(editor.field('Gravity Y')).toHaveCount(0);

  await editor.selectInTree('Rectangle');
  await editor.setPhysics(true);
  await editor.deselect();
  await editor.openPanel('inspect');
  await expect(editor.field('Gravity Y')).toHaveCount(1);
});
