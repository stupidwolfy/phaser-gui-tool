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

test('the map survives a save and an open, at schema 12', async ({ editor, page }, testInfo) => {
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
  // silently drops. Layers took it to 12 on that second half, and worse: an old
  // build finds no `data`, draws an empty map and re-saves it that way.
  expect(parsed.schemaVersion).toBe(13);

  const map = parsed.scenes[0].children.find(
    (node: { name: string }) => node.name === 'Ground',
  );
  expect(map.type).toBe('tilemap');
  expect(map.props.columns).toBe(COLUMNS);
  expect(map.props.rows).toBe(ROWS);
  // One layer, written in the v12 shape: the flat `data` the pre-v12 file held
  // is gone, and the tiles are on the layer.
  expect(map.props.data).toBeUndefined();
  expect(map.props.layers).toHaveLength(1);
  // Row-major and exactly columns*rows long, all of it tile 0.
  expect(map.props.layers[0].data).toHaveLength(COLUMNS * ROWS);
  expect(map.props.layers[0].data.every((tile: number) => tile === 0)).toBe(true);

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

/**
 * Layers, from here down.
 *
 * Every claim is a colour on the canvas rather than a shape of the document,
 * for the reason at the top of this file: a layer that reached `props.layers`
 * and never reached Phaser's parser passes every store-level check and draws
 * nothing. Colour is the instrument because the fixture's tiles are one solid
 * colour each, so "which layer is on top" is a question a centroid can answer.
 */

/** A map with a second layer, each filled with a tile of its own. */
async function twoLayers(editor: EditorPage): Promise<void> {
  await setup(editor);
  await editor.renameLayer('Floor');
  await editor.pickTile(0);
  await editor.fillTiles();

  // Adding a layer selects it, exactly as adding an object does — so this fill
  // lands on the new one with no second call to say so.
  await editor.addLayer();
  await editor.renameLayer('Walls');
  await editor.pickTile(1);
  await editor.fillTiles();
}

test('a second layer draws over the first', async ({ editor }) => {
  await twoLayers(editor);
  await editor.closePanels();

  // The whole grid is tile 1, because the second layer covers the first — array
  // order is draw order here as it is everywhere else in this editor.
  expect((await editor.findDrawn(TILES[1])).count).toBeGreaterThan(400);
  expect(
    (await editor.findDrawn(TILES[0])).count,
    'the floor should be completely covered',
  ).toBe(0);
});

test('hiding a layer shows what is under it, and only that layer', async ({ editor }) => {
  await twoLayers(editor);

  await editor.setLayerVisible('Walls', false);
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[0])).count).toBeGreaterThan(400);
  expect((await editor.findDrawn(TILES[1])).count).toBe(0);

  // Back again, which is what separates "hidden" from "emptied": the tiles were
  // never touched.
  await editor.setLayerVisible('Walls', true);
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[1])).count).toBeGreaterThan(400);
});

test('moving a layer back swaps which one is seen', async ({ editor }) => {
  await twoLayers(editor);

  await editor.moveLayer('Walls', 'back');
  await editor.closePanels();
  expect(
    (await editor.findDrawn(TILES[0])).count,
    'the floor should now be in front',
  ).toBeGreaterThan(400);
  expect((await editor.findDrawn(TILES[1])).count).toBe(0);
});

test('a stroke lands on the layer the bar is set to', async ({ editor }) => {
  await setup(editor);
  await editor.renameLayer('Floor');
  await editor.pickTile(0);
  await editor.fillTiles();
  await editor.addLayer();
  await editor.renameLayer('Walls');

  // Back to the floor from the *bar*, which is the control that has to work
  // mid-gesture: on a phone the Properties sheet covers the canvas being
  // painted, so this is the one a thumb can reach without hiding the map.
  await editor.pickTile(2);
  await editor.setPainting(true);
  await editor.pickLayerInBar('Floor');

  const target = cellCentre(1, 1);
  await editor.paintCell(target);
  await editor.setPainting(false);
  await editor.closePanels();

  // One cell of the floor changed, and the rest of it is still tile 0. If the
  // stroke had gone to the front layer the picture would be identical — which
  // is why the *document* is not what this asserts, and why the count matters:
  // tile 2 covers exactly one cell of twelve.
  const painted = await editor.findDrawn(TILES[2]);
  expect(painted.count).toBeGreaterThan(100);
  const expected = await editor.sceneToScreen(target);
  expect(Math.abs(painted.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(painted.y - expected.y)).toBeLessThan(NEAR);
  expect((await editor.findDrawn(TILES[0])).count).toBeGreaterThan(400);
});

test('a resize re-shapes every layer, not just the one being painted', async ({
  editor,
}) => {
  await twoLayers(editor);
  await editor.setLayerVisible('Walls', false);

  // A narrower grid, which re-reads a flat array at the wrong offset unless the
  // re-shape happens in the same step — and has to do that for every layer, not
  // only the active one.
  await editor.setField('Columns', COLUMNS - 1);
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[0])).count).toBeGreaterThan(300);

  await editor.setLayerVisible('Walls', true);
  await editor.closePanels();
  expect(
    (await editor.findDrawn(TILES[1])).count,
    'the hidden layer should have been re-shaped too',
  ).toBeGreaterThan(300);
  expect((await editor.findDrawn(TILES[0])).count).toBe(0);
});

test('the last layer cannot be deleted, and a second one can', async ({ editor }) => {
  await twoLayers(editor);

  expect(await editor.removeLayer('Walls')).toBe(true);
  await editor.closePanels();
  expect((await editor.findDrawn(TILES[0])).count).toBeGreaterThan(400);

  // A map with no layers has nothing to paint on and nothing for `tileLayerOf`
  // to answer with, so the button says it cannot rather than quietly doing
  // nothing — `removeScene`'s rule one level down.
  expect(
    await editor.removeLayer('Floor'),
    'the only layer should not be deletable',
  ).toBe(false);
});

test('layers survive a save and an open, in order', async ({ editor, page }, testInfo) => {
  await twoLayers(editor);
  await editor.setLayerVisible('Walls', false);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  const map = parsed.scenes[0].children.find(
    (node: { type: string }) => node.type === 'tilemap',
  );
  expect(map.props.layers).toHaveLength(2);
  expect(map.props.layers.map((layer: { name: string }) => layer.name)).toEqual([
    'Floor',
    'Walls',
  ]);
  expect(map.props.layers[1].visible).toBe(false);

  const path = testInfo.outputPath('tilemap-layers.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  page.on('dialog', (dialog) => void dialog.accept());
  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  // The floor is what is seen, because the layer over it came back hidden — the
  // claim being that the *whole* list round-tripped and not only its tiles.
  expect((await editor.findDrawn(TILES[0])).count).toBeGreaterThan(400);
  expect((await editor.findDrawn(TILES[1])).count).toBe(0);
});
