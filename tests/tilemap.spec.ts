import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { type EditorPage } from './helpers/editor';
import { stripPng } from './helpers/png';

/**
 * Tilemaps: cutting a tileset, painting with it, and getting the map back.
 *
 * This spec carries the "it draws where the document says, and survives a save
 * and an open" duty that `editing.spec` carries for the types that can be added
 * and seen with no setup. A tilemap cannot: it needs an image, and that image
 * has to be sliced before there is a tile to lay. `sprite` is here for the same
 * reason and lives in `assets.spec`, and `instance` in `prefabs.spec` — this is
 * that pattern, not a step skipped.
 *
 * Everything is asserted against pixels. A store-level check would pass on a
 * map that reached the document and never reached Phaser's parser, which is
 * exactly the mistake worth catching — the same argument the sheet tests make
 * one panel over.
 */

/** One colour per tile, so a colour centroid answers "which tile is drawn". */
const TILES = ['#22cc44', '#cc2244', '#2244cc', '#cccc22'] as const;
const TILE = 32;

/** Columns and rows of the map under test, and the scale it is drawn at. */
const COLUMNS = 4;
const ROWS = 3;
const SCALE = 4;

/**
 * Where the map's top-left corner sits, in scene units.
 *
 * Not the scene centre, which is where adding an object puts it: a tilemap's
 * origin is its *top-left*, so a 512x384 map dropped at 480,270 hangs off the
 * right-hand edge of a 960x540 scene. Anchoring it here puts the whole grid on
 * the canvas, which is what every centroid below is measured against.
 */
const ORIGIN = { x: 100, y: 60 };

/** Screenshot centroids and CSS-pixel maths agree to a few pixels. */
const NEAR = 8;

const tilesetPng = () => ({ name: 'tiles.png', buffer: stripPng(TILE, [...TILES]) });

/** The centre of one cell, in scene units. */
const cellCentre = (column: number, row: number) => ({
  x: ORIGIN.x + (column + 0.5) * TILE * SCALE,
  y: ORIGIN.y + (row + 0.5) * TILE * SCALE,
});

/**
 * An empty scene holding one 4x3 map of a four-tile sheet, scaled up.
 *
 * The scale is load-bearing, not decoration: at the mobile project's zoom of
 * ~0.37 an unscaled 32px tile is 12 screen pixels across, and a centroid over
 * ~14 pixels is all antialiased edge. Four times that is a cell a screenshot
 * can actually be measured in.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Tiles');
  await editor.importImage(tilesetPng());
  await editor.sliceSheet(TILE);

  await editor.setField('Columns', COLUMNS);
  await editor.setField('Rows', ROWS);
  await editor.setField('X', ORIGIN.x);
  await editor.setField('Y', ORIGIN.y);
  await editor.setField('Scale X', SCALE);
  await editor.setField('Scale Y', SCALE);
}

test('an empty map draws nothing of its tileset, and says how big it is', async ({
  editor,
}) => {
  await setup(editor);
  await expect(
    editor.panel('inspect').getByText(`${COLUMNS}×${ROWS} tiles of ${TILE}×${TILE}px`),
  ).toBeVisible();

  await editor.closePanels();
  // Every cell is -1 until something is painted, and an empty cell draws
  // nothing at all rather than tile 0 — which is the whole reason `-1` is a
  // value here rather than a convention.
  for (const colour of TILES) {
    expect((await editor.findDrawn(colour)).count, `${colour} should not be drawn`).toBe(0);
  }
});

test('painting lays the chosen tile where the press lands, and only there', async ({
  editor,
}) => {
  await setup(editor);
  await editor.pickTile(1);
  await editor.setPainting(true);

  const target = cellCentre(0, 0);
  await editor.paintCell(target);

  // Out of paint mode before reading pixels: the cell grid is drawn over the
  // map while the mode is on, and a colour assertion should not have to reason
  // about the editor's own overlay.
  await editor.setPainting(false);
  await editor.closePanels();

  const drawn = await editor.findDrawn(TILES[1]);
  expect(drawn.count, 'the painted tile is not on the canvas').toBeGreaterThan(100);

  const expected = await editor.sceneToScreen(target);
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);

  // One cell, not the row and not the map: a press is a press.
  for (const colour of [TILES[0], TILES[2], TILES[3]]) {
    expect((await editor.findDrawn(colour)).count, `${colour} should not be drawn`).toBe(0);
  }
});

test('a stroke paints every cell it crosses, and undoes as one step', async ({ editor }) => {
  await setup(editor);
  await editor.pickTile(2);
  await editor.setPainting(true);
  await editor.closePanels();

  // Across the top row. `select: false` because paint mode has taken the
  // press: on touch the priming tap `drag` would otherwise send is itself a
  // stroke, and would lay a tile the test never asked for.
  const from = await editor.sceneToScreen(cellCentre(0, 0));
  const to = await editor.sceneToScreen(cellCentre(COLUMNS - 1, 0));
  await editor.drag(from, to, { select: false });

  await editor.setPainting(false);
  await editor.closePanels();

  const painted = await editor.findDrawn(TILES[2]);
  expect(painted.count, 'the stroke did not paint').toBeGreaterThan(100);
  // Centred on the row it crossed, not on the cell it started in — which is
  // what separates a stroke from the single press above.
  const rowCentre = await editor.sceneToScreen({
    x: ORIGIN.x + (COLUMNS * TILE * SCALE) / 2,
    y: cellCentre(0, 0).y,
  });
  expect(Math.abs(painted.x - rowCentre.x)).toBeLessThan(NEAR * 3);
  expect(Math.abs(painted.y - rowCentre.y)).toBeLessThan(NEAR);

  // One press, one undo step — however many cells it reached.
  await editor.undo();
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[2])).count).toBe(0);
});

test('filling lays every cell, and the eraser takes one back', async ({ editor }) => {
  await setup(editor);
  await editor.pickTile(3);
  await editor.fillTiles();
  await editor.closePanels();

  const filled = await editor.findDrawn(TILES[3]);
  expect(filled.count, 'the fill did not reach the canvas').toBeGreaterThan(400);
  const centre = await editor.sceneToScreen({
    x: ORIGIN.x + (COLUMNS * TILE * SCALE) / 2,
    y: ORIGIN.y + (ROWS * TILE * SCALE) / 2,
  });
  expect(Math.abs(filled.x - centre.x)).toBeLessThan(NEAR);
  expect(Math.abs(filled.y - centre.y)).toBeLessThan(NEAR);

  await editor.pickEraser();
  await editor.setPainting(true);
  await editor.paintCell(cellCentre(1, 1));
  await editor.setPainting(false);
  await editor.closePanels();

  // One cell of twelve gone, so the count drops and the centroid shifts off
  // the middle it was exactly on.
  const erased = await editor.findDrawn(TILES[3]);
  expect(erased.count).toBeGreaterThan(100);
  expect(erased.count).toBeLessThan(filled.count);
});

test('the map survives a save and an open, at schema 10', async ({ editor, page }, testInfo) => {
  await setup(editor);
  await editor.setField('Name', 'Ground');
  await editor.pickTile(0);
  await editor.fillTiles();

  await editor.closePanels();
  // The canvas first: saving opens the file sheet, which on mobile covers the
  // canvas a screenshot would then be taken of.
  expect((await editor.findDrawn(TILES[0])).count).toBeGreaterThan(400);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  // A literal, so that a bump is noticed and made deliberately. 10 as of fonts,
  // which is the other half of the rule: tilemaps took it to 6 because a build
  // with no `createDisplayObject` case leaves the object undefined and crashes,
  // where audio took it to 8 and fonts to 10 over a table an older build
  // silently drops.
  expect(parsed.schemaVersion).toBe(10);

  const map = parsed.scenes[0].children.find(
    (node: { name: string }) => node.name === 'Ground',
  );
  expect(map.type).toBe('tilemap');
  expect(map.props.columns).toBe(COLUMNS);
  expect(map.props.rows).toBe(ROWS);
  // Row-major and exactly columns*rows long, all of it tile 0.
  expect(map.props.data).toHaveLength(COLUMNS * ROWS);
  expect(map.props.data.every((tile: number) => tile === 0)).toBe(true);

  const path = testInfo.outputPath('tilemap.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  page.on('dialog', (dialog) => void dialog.accept());
  await editor.newProject();
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[0])).count).toBe(0);

  await editor.openFile(path);
  await editor.closePanels();
  // Drawn again on the far side of a parse and an async texture decode, which
  // is the path that actually breaks: the map is built from a texture that is
  // not there yet, and the sync that lands has to rebuild it.
  const reopened = await editor.findDrawn(TILES[0]);
  expect(reopened.count).toBeGreaterThan(400);
  const centre = await editor.sceneToScreen({
    x: ORIGIN.x + (COLUMNS * TILE * SCALE) / 2,
    y: ORIGIN.y + (ROWS * TILE * SCALE) / 2,
  });
  expect(Math.abs(reopened.x - centre.x)).toBeLessThan(NEAR);
  expect(Math.abs(reopened.y - centre.y)).toBeLessThan(NEAR);
});

test('un-cutting the tileset empties the map, and cutting it again brings it back', async ({
  editor,
}) => {
  await setup(editor);
  await editor.pickTile(3);
  await editor.fillTiles();
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[3])).count).toBeGreaterThan(400);

  // Un-sliced, the image is one picture rather than a set of tiles, so there is
  // no tile 3 to draw — and the map goes blank rather than substituting the
  // nearest tile it does have. The stored indices are untouched, which is what
  // the re-slice below proves.
  await editor.unsliceSheet();
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[3])).count).toBe(0);

  await editor.sliceSheet(TILE);
  await editor.closePanels();
  expect(
    (await editor.findDrawn(TILES[3])).count,
    'the map should come back whole once the sheet is cut again',
  ).toBeGreaterThan(400);
});
