import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE } from './helpers/editor';
import { framePng, tilePng } from './helpers/png';

/**
 * A panel that stretches without stretching its corners, and a background that
 * repeats rather than scaling.
 *
 * These two carry the "it draws, it drags, it survives a save and an open" duty
 * that `editing.spec.ts` carries for every other type, and they are exceptions
 * to it for `sprite`'s reason rather than a step skipped. Both *appear* with no
 * setup — the placeholder sees to that — but the thing either one is for cannot
 * be seen until an image is imported: a solid colour stretched and a solid
 * colour sliced put exactly the same pixels on the canvas. So the fixtures are
 * two-coloured on purpose (see `framePng` and `tilePng`), and every claim here
 * is an extent rather than a centroid, because what is being asserted is how
 * big something is drawn rather than where.
 */

/** The panel's border, and the inset the panel is then told to hold. */
const EDGE = '#ff3b30';
/** Its middle, which is the part that is allowed to stretch. */
const MIDDLE = '#34c759';
const BORDER = 8;
const SOURCE = 64;

/** The repeating tile's ground, and the mark that appears once per repeat. */
const GROUND = '#0a84ff';
const MARK = '#ffd60a';
const TILE = 32;

/** The magenta stand-in either type draws with no image chosen. */
const PLACEHOLDER = '#ff6bd6';

const framePngFile = () => ({
  name: 'frame.png',
  buffer: framePng(SOURCE, BORDER, EDGE, MIDDLE),
});
const tilePngFile = () => ({ name: 'tile.png', buffer: tilePng(TILE, GROUND, MARK) });

test('a new panel and a new tiled image draw the placeholder until an image is chosen', async ({
  editor,
}) => {
  await editor.clearScene();

  await editor.addObject('Panel');
  await expect(editor.panel('inspect').getByText('No image chosen')).toBeVisible();
  await editor.closePanels();
  expect((await editor.findDrawn(PLACEHOLDER)).count).toBeGreaterThan(20);

  await editor.addObject('Tiled');
  await editor.closePanels();
  expect((await editor.findDrawn(PLACEHOLDER)).count).toBeGreaterThan(20);
});

test('a panel keeps its border while its middle stretches', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Panel');
  await editor.importImage(framePngFile());
  await editor.setField('Slice left', BORDER);
  await editor.setField('Slice right', BORDER);
  await editor.setField('Slice top', BORDER);
  await editor.setField('Slice bottom', BORDER);
  await editor.setField('Width', 200);
  await editor.setField('Height', 200);

  // Deselected before every reading: the scale handle keeps a 44px screen
  // target over the object's bottom-right corner and would occlude the very
  // pixels being measured — several pixels of error on desktop and ten at the
  // mobile zoom, neither of which is the panel changing size.
  await editor.deselect();
  await editor.closePanels();
  const narrow = await editor.findDrawnBox(MIDDLE);
  const narrowEdge = await editor.findDrawnBox(EDGE);
  expect(narrow.count).toBeGreaterThan(100);

  await editor.selectInTree('Panel');
  await editor.setField('Width', 600);
  await editor.deselect();
  await editor.closePanels();
  const wide = await editor.findDrawnBox(MIDDLE);
  const wideEdge = await editor.findDrawnBox(EDGE);

  // The whole claim, in two halves. The middle takes the extra 400 scene units
  // — in *screen* pixels, so the comparison is against the narrow reading
  // rather than an absolute, since the two projects are at different zooms.
  expect(wide.width).toBeGreaterThan(narrow.width * 2);
  // And the border does not: it is the same thickness on the left and the right
  // of a panel three times as wide. Measured as the border box minus the middle
  // box, which is exactly the two vertical bars.
  const narrowBorder = narrowEdge.width - narrow.width;
  const wideBorder = wideEdge.width - wide.width;
  // Proportional rather than an absolute pixel tolerance, and deliberately: the
  // reading is the difference between two independently measured extents, so
  // each of its ends carries the sub-pixel phase of a colour boundary and the
  // two do not cancel. An absolute bound tight enough to mean anything sits
  // within a pixel or two of the noise on one project and passes trivially on
  // the other. What the claim actually needs is that the border did not scale:
  // a stretch would have tripled it with the panel, so anything near 1x is the
  // answer and anything near 3x is the failure.
  expect(wideBorder).toBeLessThan(narrowBorder * 1.6);
  expect(wideBorder).toBeGreaterThan(narrowBorder * 0.6);

  // The height was never touched, so nothing about the vertical changed either.
  expect(Math.abs(wide.height - narrow.height)).toBeLessThan(6);
});

test('a tiled image repeats its texture rather than scaling it', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Tiled');
  await editor.importImage(tilePngFile());
  await editor.setField('Width', 320);
  await editor.setField('Height', 160);
  await editor.deselect();
  await editor.closePanels();

  const ground = await editor.findDrawnBox(GROUND);
  const marks = await editor.findDrawnBox(MARK);
  expect(ground.count).toBeGreaterThan(200);

  // One mark sits in the top-left quarter of a 32px tile, so a *stretched*
  // texture puts it in the top-left quarter of the object and nowhere else,
  // while a tiled one puts a copy in every repeat — which spans the object.
  // Two thirds of the width is comfortably more than the one quarter a single
  // stretched mark could reach, and comfortably less than the whole, so it
  // cannot be satisfied by either failure.
  expect(marks.width).toBeGreaterThan(ground.width * 0.66);
  expect(marks.height).toBeGreaterThan(ground.height * 0.66);
});

test('a panel and a tiled image survive a save and an open', async ({
  editor,
}, testInfo) => {
  await editor.clearScene();
  await editor.addObject('Panel');
  await editor.importImage(framePngFile());
  await editor.setField('Slice left', BORDER);
  await editor.setField('Slice right', BORDER);
  await editor.setField('Width', 300);

  await editor.addObject('Tiled');
  await editor.importImage(tilePngFile());
  // Off the panel, or it covers it: both are added at the centre of the scene
  // and this one is later in the array, which is the whole of draw order here.
  await editor.setField('X', 780);
  await editor.setField('Y', 430);
  await editor.setField('Tile offset X', 7);
  await editor.setField('Tile scale X', 2);

  await editor.deselect();
  await editor.closePanels();
  expect((await editor.findDrawn(MIDDLE)).count).toBeGreaterThan(100);
  expect((await editor.findDrawn(MARK)).count).toBeGreaterThan(20);

  // The canvas first, then the file: reading the document means saving, and on
  // mobile the file sheet covers the canvas a `findDrawn` would screenshot.
  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  expect(parsed.schemaVersion).toBe(10);

  const nodes = parsed.scenes[0].children;
  const panel = nodes.find((node: { type: string }) => node.type === 'nineslice');
  const tiled = nodes.find((node: { type: string }) => node.type === 'tileSprite');
  expect(panel.props.left).toBe(BORDER);
  expect(panel.props.right).toBe(BORDER);
  expect(panel.props.width).toBe(300);
  expect(tiled.props.tilePositionX).toBe(7);
  expect(tiled.props.tileScaleX).toBe(2);

  const path = testInfo.outputPath('panels.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  // Opening waits on a decode before either object can be drawn, which is the
  // path that proves the sync re-runs when it lands — and, for these two, that
  // the rebuild the texture change triggers happens rather than leaving a
  // panel built on the placeholder.
  await expect
    .poll(async () => (await editor.findDrawn(MIDDLE)).count, { timeout: 10_000 })
    .toBeGreaterThan(100);
  expect((await editor.findDrawn(MARK)).count).toBeGreaterThan(20);
});

test('a panel drags where it is put', async ({ editor }) => {
  await editor.clearScene();
  // Snapping is on by default, and this test asserts where the pointer put the
  // object rather than what it agreed with.
  await editor.setSnapping(false);
  await editor.addObject('Panel');
  await editor.importImage(framePngFile());
  await editor.closePanels();

  const from = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  const to = await editor.sceneToScreen({ x: SCENE.width / 2 + 160, y: SCENE.height / 2 });
  const before = await editor.findDrawn(MIDDLE);
  const moved = await editor.drag(from, to);

  const after = await editor.findDrawn(MIDDLE);
  expect(Math.abs(after.x - (before.x + moved.x))).toBeLessThan(6);
  expect(Math.abs(after.y - (before.y + moved.y))).toBeLessThan(6);
});
