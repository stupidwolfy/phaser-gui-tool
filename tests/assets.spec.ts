import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE } from './helpers/editor';
import { solidPng } from './helpers/png';

/**
 * Images, which are the one part of the document that is not plain data: they
 * are imported through a re-encode, held as data URLs, and drawn only once an
 * asynchronous decode has landed. Every one of those steps is between the
 * document and the canvas, so all of them are checked against pixels.
 */

const IMAGE = '#22cc44';
/** The magenta stand-in a sprite draws when it has no usable image. */
const PLACEHOLDER = '#ff6bd6';

const png = () => ({ name: 'blob.png', buffer: solidPng(64, 64, IMAGE) });

test('a new sprite draws the placeholder until an image is chosen', async ({ editor }) => {
  await editor.addObject('Image');
  await expect(editor.panel('inspect').getByText('No image chosen')).toBeVisible();

  await editor.closePanels();
  expect((await editor.findDrawn(PLACEHOLDER)).count).toBeGreaterThan(20);
});

test('imports an image, draws it, and keeps it across a save and an open', async ({
  editor,
}, testInfo) => {
  await editor.addObject('Image');
  await editor.importImage(png());
  await expect(editor.panel('inspect').getByText('blob.png · 64×64px')).toBeVisible();

  await editor.closePanels();
  const drawn = await editor.findDrawn(IMAGE);
  const centre = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  expect(drawn.count).toBeGreaterThan(100);
  expect(Math.abs(drawn.x - centre.x)).toBeLessThan(4);
  expect(Math.abs(drawn.y - centre.y)).toBeLessThan(4);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  expect(parsed.assets).toHaveLength(1);
  // Import re-encodes to PNG or JPEG, and nothing else is allowed back in.
  expect(parsed.assets[0].dataUrl).toMatch(/^data:image\/png;base64,/);

  const path = testInfo.outputPath('with-image.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  // Opening a project always waits on a decode before anything can be drawn,
  // so this is the path that proves the re-run of the sync after it lands.
  await expect
    .poll(async () => (await editor.findDrawn(IMAGE)).count, { timeout: 10_000 })
    .toBeGreaterThan(100);
});

test('removing an image leaves the sprites that used it on the placeholder', async ({
  editor,
  page,
}) => {
  await editor.addObject('Image');
  await editor.importImage(png());
  await editor.closePanels();
  expect((await editor.findDrawn(IMAGE)).count).toBeGreaterThan(100);

  // The confirm says how many objects are about to lose their image.
  page.on('dialog', (dialog) => {
    expect(dialog.message()).toContain('1 object');
    void dialog.accept();
  });
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Remove blob.png' }).click();
  await editor.closePanels();

  expect((await editor.findDrawn(IMAGE)).count).toBe(0);
  expect((await editor.findDrawn(PLACEHOLDER)).count).toBeGreaterThan(20);
});
