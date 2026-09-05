import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';

/**
 * The scene camera: seeing it, saving it, and exporting it.
 *
 * The claim that carries the feature is a negative one, and it is asserted on
 * both sides of the canvas: the document's camera is *drawn* and never applied
 * to the editor's own view. So every test here goes on using `sceneToScreen`,
 * which derives the editor's zoom from `zoomToFit` — and would be wrong by a
 * factor of the camera's zoom the moment the two were confused. A camera set to
 * zoom 2 whose frame lands where the arithmetic says it does is the whole of it.
 *
 * Nothing here drags, so none of these fixtures is shaped by the mobile
 * project's ~22-scene-unit snap threshold — the note `physics.spec.ts` makes
 * for the same reason.
 */

/** `CAMERA_COLOR` in EditorScene. Nothing else on this canvas is violet. */
const CAMERA = '#9b7bff';

/** Screenshot centroids and CSS-pixel maths agree to a few pixels. */
const NEAR = 10;

/**
 * At zoom 2 the camera sees 480x270 of the scene, and at scroll (0, 0) that
 * view is centred in it — the view is centred on the *unzoomed* viewport's
 * middle, which is `cameraViewOf`'s copied Phaser arithmetic and the one part
 * of it a reader would get wrong by guessing. It is also what keeps the whole
 * frame clear of the band `shot` clips off the bottom of the canvas.
 */
const ZOOM = 2;
const CENTRE = { x: SCENE.width / 2, y: SCENE.height / 2 };

async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
}

test('the frame is drawn where the camera looks, and moves with the scroll', async ({
  editor,
}) => {
  await setup(editor);

  // Nothing at all while the camera is still the default: it would land exactly
  // on the scene frame and say the same thing twice.
  await editor.closePanels();
  expect((await editor.findDrawn(CAMERA)).count).toBe(0);

  await editor.setCamera({ zoom: ZOOM });
  await editor.closePanels();

  // The extent rather than the centroid, which for an outline is the reading
  // that holds still — see `findColorBox`. It is also the only one that can say
  // the frame is the right *size*, which is half of what a zoom means.
  const drawn = await editor.findDrawnBox(CAMERA);
  expect(drawn.count).toBeGreaterThan(0);
  const zoom = await editor.zoom();
  const centre = await editor.sceneToScreen(CENTRE);
  expect(Math.abs(drawn.x + drawn.width / 2 - centre.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y + drawn.height / 2 - centre.y)).toBeLessThan(NEAR);
  // 480x270 of a 960x540 scene, since the view is the scene divided by the zoom.
  expect(Math.abs(drawn.width - (SCENE.width / ZOOM) * zoom)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.height - (SCENE.height / ZOOM) * zoom)).toBeLessThan(NEAR);

  await editor.setCamera({ x: 120 });
  await editor.closePanels();

  const moved = await editor.findDrawnBox(CAMERA);
  const expected = await editor.sceneToScreen({ x: CENTRE.x + 120, y: CENTRE.y });
  expect(Math.abs(moved.x + moved.width / 2 - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(moved.y + moved.height / 2 - centre.y)).toBeLessThan(NEAR);
});

test('limiting the camera to the scene holds the shot inside it', async ({ editor }) => {
  await setup(editor);

  // Far enough out that half the view is off the right-hand edge of the scene.
  await editor.setCamera({ zoom: ZOOM, x: 600 });
  await editor.setSceneFlag('Limit camera to the scene', true);
  await editor.closePanels();

  // Clamped to the last shot that fits: 480 wide against a 960 scene, so its
  // centre lands three quarters of the way across. The clamp moves the scroll
  // rather than cropping the view, which is Phaser's own behaviour and is why
  // the frame is still its full width here.
  const drawn = await editor.findDrawnBox(CAMERA);
  const expected = await editor.sceneToScreen({ x: SCENE.width * 0.75, y: CENTRE.y });
  expect(Math.abs(drawn.x + drawn.width / 2 - expected.x)).toBeLessThan(NEAR);
});

test('resetting the camera puts the frame away again', async ({ editor }) => {
  await setup(editor);
  await editor.setCamera({ zoom: ZOOM, x: 60 });
  await editor.closePanels();
  expect((await editor.findDrawn(CAMERA)).count).toBeGreaterThan(0);

  await editor.deselect();
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Reset camera' }).click();
  await editor.settle();

  await editor.closePanels();
  expect((await editor.findDrawn(CAMERA)).count).toBe(0);
});

test('only a top-level object can be followed', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Group');
  // Adding lands in the group you are working in, so this rectangle is inside
  // it — which is the case a follow refuses, for the reason a body does.
  await editor.addObject('Rectangle');

  await editor.deselect();
  await editor.openPanel('inspect');
  await expect(editor.choice('Camera follows').locator('option')).toHaveText([
    'Nothing',
    'Group',
  ]);
});

test('deleting the followed object leaves the camera following nothing', async ({
  editor,
}) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.deselect();
  await editor.setChoice('Camera follows', 'Rectangle');
  expect(await editor.choice('Camera follows').inputValue()).not.toBe('');

  await editor.openPanel('scene');
  await editor
    .panel('scene')
    .locator('.tree__item')
    .first()
    .getByRole('button', { name: /^Delete / })
    .click();
  await editor.settle();

  await editor.deselect();
  await editor.openPanel('inspect');
  // Dropped on read rather than pruned by the delete, which is what means no
  // store action has to remember this one.
  expect(await editor.choice('Camera follows').inputValue()).toBe('');
});

test('a camera survives a save and an open, at schema 8', async ({ editor }, testInfo) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.deselect();
  await editor.setCamera({ x: 40, y: 80, zoom: 1.5 });
  await editor.setChoice('Camera follows', 'Rectangle');
  await editor.setField('Camera smoothing', 0.2);
  await editor.setSceneFlag('Limit camera to the scene', true);
  await editor.setSceneFlag('Round camera to whole pixels', true);

  // The canvas first: on mobile the file sheet covers it, so a `findDrawn`
  // after the save would screenshot the sheet and report the frame missing.
  await editor.closePanels();
  expect((await editor.findDrawn(CAMERA)).count).toBeGreaterThan(0);

  const saved = await editor.saveToFile();
  const project = JSON.parse(saved.contents);

  // Unbumped, and asserted so a future bump is a deliberate act rather than
  // something that happens to a file — the guides, scenes and physics
  // precedent. A camera rides in on `scenes`, which the parser passes through
  // verbatim, so a deployed older build opens this file, draws it identically
  // and carries the camera back out on a re-save.
  expect(project.schemaVersion).toBe(8);
  expect(project.scenes[0].camera).toMatchObject({
    scrollX: 40,
    scrollY: 80,
    zoom: 1.5,
    boundToScene: true,
    roundPixels: true,
    followLerp: 0.2,
  });
  expect(project.scenes[0].camera.followId).toBe(project.scenes[0].children[0].id);

  const path = testInfo.outputPath('camera.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  await editor.openFile(path);

  await editor.closePanels();
  expect((await editor.findDrawn(CAMERA)).count).toBeGreaterThan(0);

  await editor.deselect();
  expect(await editor.numberValue('Camera X')).toBe(40);
  expect(await editor.numberValue('Camera zoom')).toBe(1.5);
  expect(await editor.numberValue('Camera smoothing')).toBe(0.2);
});

test('a scene with no camera exports no camera calls', async ({ editor }) => {
  const exported = await editor.exportCode('ts');
  expect(exported.contents).not.toContain('setZoom');
  expect(exported.contents).not.toContain('setScroll');
  expect(exported.contents).not.toContain('startFollow');
});

test('the camera exports as real cameras.main calls', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Player');
  await editor.deselect();
  await editor.setCamera({ x: 40, y: 80, zoom: 1.5 });
  await editor.setSceneFlag('Limit camera to the scene', true);
  await editor.setSceneFlag('Round camera to whole pixels', true);
  await editor.setChoice('Camera follows', 'Player');
  await editor.setField('Camera smoothing', 0.2);

  const exported = await editor.exportCode('ts');
  expect(exported.contents).toContain('this.cameras.main.setScroll(40, 80);');
  expect(exported.contents).toContain('this.cameras.main.setZoom(1.5);');
  expect(exported.contents).toContain('this.cameras.main.setRoundPixels(true);');
  expect(exported.contents).toContain(
    `this.cameras.main.setBounds(0, 0, ${SCENE.width}, ${SCENE.height});`,
  );
  // After the object list, because it names a binding the list above makes.
  expect(exported.contents).toContain(
    'this.cameras.main.startFollow(player, true, 0.2, 0.2);',
  );
  expect(exported.contents.indexOf('const player')).toBeLessThan(
    exported.contents.indexOf('startFollow'),
  );
});
