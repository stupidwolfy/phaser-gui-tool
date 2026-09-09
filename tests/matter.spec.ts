import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';

/**
 * The Matter engine: a body that is a real polygon and turns with its object.
 *
 * Everything here is about *shape*, because that is the one thing choosing
 * Matter buys and the whole reason the setting exists. Arcade's body is a
 * rectangle whose sides are the world's and nothing in Phaser turns one, so a
 * platform stood on end can only ever be approximated by the box that holds it.
 *
 * The editor still never simulates under either engine, so every claim a canvas
 * can make here is about the outline that is drawn. The claim that the body is
 * *real* lives in `export.spec.ts`, on the far side of the export, where a page
 * actually runs it — the split `behaviour.spec.ts` already makes.
 */

/** `BODY_COLOR` in EditorScene. Nothing else on this canvas is pure green. */
const BODY = '#00ff00';

const AT = { x: SCENE.width / 2, y: SCENE.height / 2 };
/** Long and thin, so turning it moves the extents a great deal on both axes. */
const SIZE = { width: 300, height: 60 };

async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('X', AT.x);
  await editor.setField('Y', AT.y);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
  await editor.setPhysics(true);
}

test('at a quarter turn the two engines agree exactly, and that is the point', async ({
  editor,
}) => {
  await setup(editor);
  await editor.setField('Rotation°', 90);
  await editor.deselect();
  await editor.closePanels();

  const arcade = await editor.findDrawnBox(BODY);
  expect(arcade.count).toBeGreaterThan(0);
  // A 300x60 bar stood on end is 60 wide and 300 tall, and the box that holds
  // it is the same numbers swapped — so Arcade's grown box and Matter's turned
  // polygon are the *same rectangle*, and there is nothing here to tell apart.
  expect(arcade.width).toBeLessThan(arcade.height);

  await editor.setSceneEngine('matter');
  await editor.deselect();
  await editor.closePanels();

  const matter = await editor.findDrawnBox(BODY);
  expect(Math.abs(matter.width - arcade.width)).toBeLessThan(arcade.width * 0.15);
  expect(Math.abs(matter.height - arcade.height)).toBeLessThan(arcade.height * 0.15);

  // Recorded rather than left implicit, because it is exactly why the test
  // below turns 45 degrees instead: at a right angle every reading a canvas can
  // give is identical under both engines, so a suite that only ever turned
  // things by 90 degrees would assert nothing at all about the difference.
});

test('at 45 degrees the two engines put their outline in different places', async ({
  editor,
}) => {
  await setup(editor);
  await editor.setField('Rotation°', 45);
  await editor.deselect();
  await editor.closePanels();

  // The two engines' bodies share a bounding box *exactly*, and always: the box
  // Arcade grows to hold a turned object is by definition that object's own
  // bounding box. So an extent cannot separate them, a centroid cannot (both
  // are symmetric about the same centre), and a whole-canvas pixel count only
  // can by luck — at the mobile project's zoom the two ink 371 pixels each, to
  // the digit. The first version of this test asserted exactly that and passed
  // on one project while measuring nothing on the other.
  //
  // What is different is the *corner*. An upright box has its outline there; a
  // turned bar inside that box has nothing there at all.
  const box = await editor.findDrawnBox(BODY);
  expect(box.count).toBeGreaterThan(0);
  const corner = {
    x: box.x + box.width * 0.72,
    y: box.y,
    width: box.width * 0.28,
    height: box.height * 0.28,
  };

  const arcadeCorner = await editor.countDrawnIn(BODY, corner);
  expect(arcadeCorner).toBeGreaterThan(0);

  await editor.setSceneEngine('matter');
  await editor.deselect();
  await editor.closePanels();

  const turned = await editor.findDrawnBox(BODY);
  const matterCorner = await editor.countDrawnIn(BODY, corner);

  // The same box, and nothing in the corner of it.
  expect(Math.abs(turned.width - box.width)).toBeLessThan(box.width * 0.12);
  expect(Math.abs(turned.height - box.height)).toBeLessThan(box.height * 0.12);
  expect(matterCorner).toBe(0);
});

test('the engine, the Matter dials and the rows they hide survive a save', async ({
  editor,
}, testInfo) => {
  await setup(editor);
  await editor.setSceneEngine('matter');

  await editor.selectInTree('Rectangle');
  await editor.setField('Bounciness', 0.6);
  await editor.setField('Air friction', 0.03);
  await editor.setField('Surface friction', 0.25);

  const file = await editor.saveToFile();
  const saved = JSON.parse(file.contents);

  expect(saved.scenes[0].physics.engine).toBe('matter');
  const body = saved.scenes[0].children[0].physics;
  expect(body.restitution).toBeCloseTo(0.6, 5);
  expect(body.frictionAir).toBeCloseTo(0.03, 5);
  expect(body.friction).toBeCloseTo(0.25, 5);

  // The engine is a field on `scene.physics`, which rides in on `scenes` — the
  // one part of a file `parseProject` passes through verbatim — so this is the
  // guides case and the version does not move. Asserted so a future bump is a
  // deliberate act rather than a surprise.
  expect(saved.schemaVersion).toBe(12);

  const path = testInfo.outputPath('matter.phaser.json');
  await fs.writeFile(path, file.contents, 'utf8');
  await editor.newProject();
  await editor.openFile(path);
  await editor.deselect();
  await editor.openPanel('inspect');
  expect(await editor.selectValue('Physics engine')).toBe('matter');
});

test('switching to Matter and back keeps both engines dials', async ({ editor }) => {
  await setup(editor);

  // Arcade's own two, set while Arcade is the engine.
  await editor.setField('Bounce X', 0.5);
  await editor.setField('Drag X', 40);

  await editor.setSceneEngine('matter');
  await editor.selectInTree('Rectangle');

  // Arcade's are gone from the panel — a Matter body has no per-axis bounce or
  // drag at all, so they are absent rather than disabled, by the rule a static
  // body's missing velocity already follows.
  await expect(editor.field('Bounce X')).toHaveCount(0);
  await expect(editor.field('Drag X')).toHaveCount(0);
  await editor.setField('Bounciness', 0.7);

  await editor.setSceneEngine('arcade');
  await editor.selectInTree('Rectangle');

  // And back, unchanged. Both sets live on the node and neither is ever
  // deleted, which is what makes trying the other engine free.
  expect(await editor.numberValue('Bounce X')).toBe(0.5);
  expect(await editor.numberValue('Drag X')).toBe(40);
});

test('a Matter scene says the collider rows are unnecessary rather than hiding them', async ({
  editor,
}) => {
  await setup(editor);
  await editor.addObject('Ellipse');
  await editor.setField('X', 200);
  await editor.setField('Y', 200);
  await editor.setPhysics(true);
  await editor.setSceneEngine('matter');

  await editor.deselect();
  await editor.openPanel('inspect');
  // A panel that is right and cannot be reached reads exactly like a feature
  // that does not exist, which is the trap iteration 20's collider rows were
  // fixed for. An empty Collisions panel under Matter would read as the same
  // bug, so it says why instead.
  await expect(
    editor.panel('inspect').getByText('collides every body with every other'),
  ).toBeVisible();
});
