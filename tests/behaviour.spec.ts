import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';
import { stripPng } from './helpers/png';

/**
 * Behaviour: what is solid, what collides, and what the player drives.
 *
 * The three of them are one feature and are tested as one, because none is
 * useful alone — a collider with nothing solid is half a floor, and controls
 * with neither fall through it.
 *
 * Everything here is still a *negative* about the canvas, which is what this
 * spec has in common with `physics.spec`: the editor draws a body, shades a
 * solid tile and marks a driven object, and runs none of it. The positive — a
 * body that lands, a key that moves something — can only be asserted in a game
 * that is actually running, so it lives in `export.spec` beside "the exported
 * page runs the physics it was given".
 *
 * Nothing here drags, so none of these fixtures is shaped by the mobile
 * project's ~22-scene-unit snap threshold, and its absence is deliberate rather
 * than an oversight — the note `physics.spec` already carries.
 */

/** `BODY_COLOR` in EditorScene: the body outline, and a solid tile's shading. */
const BODY = '#00ff00';

/** `TOUCH_COLOR` in EditorScene: where the export will draw its buttons. */
const TOUCH = '#ff5c33';

/** One colour per tile, so a colour centroid answers "which tile is drawn". */
const TILES = ['#22cc44', '#cc2244', '#2244cc', '#cccc22'] as const;
const TILE = 32;

const AT = { x: SCENE.width / 2, y: SCENE.height / 2 };
const SIZE = { width: 240, height: 160 };

/** One rectangle big enough for its outline to survive the mobile zoom. */
async function rectangle(editor: EditorPage, name = 'Rectangle'): Promise<void> {
  await editor.addObject('Rectangle');
  await editor.setField('Name', name);
  await editor.setField('X', AT.x);
  await editor.setField('Y', AT.y);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
}

test('controls are offered on a dynamic body and nowhere else', async ({ editor }) => {
  await editor.clearScene();
  await rectangle(editor, 'Player');

  // No body at all: nothing to drive, so the field is absent rather than
  // switched off — the rule the dynamic-only velocity rows already follow.
  expect(await editor.controlsOffered()).toBe(false);

  await editor.setPhysics(true);
  expect(await editor.controlsOffered()).toBe(true);

  // A StaticBody genuinely has no velocity for a key to change, so the whole
  // block goes rather than being disabled.
  await editor.setChoice('Body', 'Static — never moves');
  expect(await editor.controlsOffered()).toBe(false);

  await editor.setChoice('Body', 'Dynamic — moves');
  await editor.setControls(true);
  await editor.setField('Walk speed', 260);
  expect(await editor.numberValue('Walk speed')).toBe(260);

  // Top-down has no down to jump from, so the field does not apply rather than
  // being switched off — the camera's smoothing field, one panel over.
  await editor.setChoice('Control mode', 'Top-down — walk any way');
  await expect(editor.field('Jump speed')).toHaveCount(0);
});

test('a node inside a group cannot be driven, and gets it back on the way out', async ({
  editor,
}) => {
  await editor.clearScene();
  await rectangle(editor, 'Player');
  await editor.setPhysics(true);
  await editor.setControls(true);
  await editor.setField('Walk speed', 175);

  // A group has to exist before the parent picker can offer it, and adding one
  // while the rectangle is selected puts it beside rather than inside — the
  // dance `physics.spec`'s own nested-body test already does.
  await editor.addObject('Group');
  await editor.selectInTree('Player');
  await editor.setChoice('Group', 'Group');

  // Stripped on read rather than deleted on the way in — a node dragged into a
  // group and back out is the same node, which is the answer a nested body and
  // a nested follow target both already get.
  expect(await editor.controlsOffered()).toBe(false);

  await editor.setChoice('Group', 'Scene');
  expect(await editor.controlsOffered()).toBe(true);
  expect(await editor.numberValue('Walk speed')).toBe(175);
});

test('a driven object is marked on its own body outline', async ({ editor }) => {
  await editor.clearScene();
  await rectangle(editor, 'Player');
  await editor.setPhysics(true);

  // Deselected before every reading: the scale handle keeps a 44px screen
  // target over the bottom-right corner and the body outline runs straight
  // through it, so a count taken while the object is selected is a count of the
  // handle as well. Two shots under identical chrome is the other way out, and
  // this is the one `physics.spec` already uses.
  await editor.deselect();
  await editor.closePanels();
  const plain = (await editor.findDrawn(BODY)).count;
  expect(plain).toBeGreaterThan(0);

  await editor.selectInTree('Player');
  await editor.setControls(true);
  await editor.deselect();
  await editor.closePanels();
  const driven = (await editor.findDrawn(BODY)).count;

  // Two filled arrows inside the same box: strictly more green, in the same
  // colour, which is the static body's cross by the same argument and measured
  // the same way. Filled rather than stroked precisely so this reading means
  // something — an outlined arrow is antialiased along its whole length and
  // barely moves a pure-colour count at all.
  expect(driven).toBeGreaterThan(plain * 1.5);
});

test('on-screen buttons are drawn where the game will draw them, and only when asked', async ({
  editor,
}) => {
  await editor.clearScene();
  await rectangle(editor, 'Player');
  await editor.setPhysics(true);
  await editor.setControls(true);

  // Deselected before every reading, for the arrow test's reason: the scale
  // handle keeps a 44px screen target over the object's corner, and at the
  // mobile zoom that is most of the object.
  await editor.deselect();
  await editor.closePanels();
  expect((await editor.findDrawn(TOUCH)).count).toBe(0);

  await editor.selectInTree('Player');
  await editor.setTouchControls(true);
  await editor.deselect();
  await editor.closePanels();

  // An extent rather than a centroid, which is `camera.spec`'s instrument and
  // for its reason: these are rings, and a two-pixel stroke lands on a
  // different sub-pixel phase on each edge. It is also the only reading that
  // can say *where on the canvas* the pad is, which is the whole claim.
  const platformer = await editor.findDrawnBox(TOUCH);
  expect(platformer.count).toBeGreaterThan(0);

  // The geometry `touchZonesOf` derives: 7.5% of the shorter side is a radius
  // of 40.5 on a 960x540 scene, the pad sits one radius in from the left and
  // the jump button one in from the right. Asserted against the scene's own
  // corners rather than against those numbers, so a change to the ratio moves
  // the test with the feature rather than against it.
  const middle = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  const bottomLeft = await editor.sceneToScreen({ x: 0, y: SCENE.height });
  const bottomRight = await editor.sceneToScreen({ x: SCENE.width, y: SCENE.height });

  // Below the middle of the scene and inside both of its bottom corners: a HUD
  // in the corners of the canvas, which is the one thing the drawing says that
  // the numbers in the panel do not.
  expect(platformer.y).toBeGreaterThan(middle.y);
  expect(platformer.x).toBeGreaterThanOrEqual(bottomLeft.x - 2);
  expect(platformer.x + platformer.width).toBeLessThanOrEqual(bottomRight.x + 2);
  // A platformer reaches the right-hand corner, because its jump button is
  // there. Half the scene's width is a wide margin around that claim.
  expect(platformer.x + platformer.width).toBeGreaterThan(middle.x);

  // Top-down has no jump, so the right-hand button goes; it walks on four axes,
  // so up and down join the pad. The pad's own left and right do not move,
  // which is why `touchZonesOf` builds a cross rather than a row.
  await editor.selectInTree('Player');
  await editor.setChoice('Control mode', 'Top-down — walk any way');
  await editor.deselect();
  await editor.closePanels();

  const topDown = await editor.findDrawnBox(TOUCH);
  expect(topDown.count).toBeGreaterThan(0);
  expect(topDown.height).toBeGreaterThan(platformer.height);
  expect(topDown.width).toBeLessThan(platformer.width);
  expect(topDown.x + topDown.width).toBeLessThan(middle.x);
  expect(Math.abs(topDown.x - platformer.x)).toBeLessThan(4);

  // And off again leaves nothing behind, which is what says the rings are
  // derived every frame rather than drawn once and forgotten.
  await editor.selectInTree('Player');
  await editor.setTouchControls(false);
  await editor.deselect();
  await editor.closePanels();
  expect((await editor.findDrawn(TOUCH)).count).toBe(0);
});

test('a collision row names two objects, and a deleted one takes the row with it', async ({
  editor,
}) => {
  await editor.clearScene();
  await rectangle(editor, 'Player');
  await editor.setPhysics(true);
  await editor.deselect();
  await rectangle(editor, 'Ground');
  await editor.setPhysics(true);
  await editor.setChoice('Body', 'Static — never moves');
  await editor.deselect();

  await editor.openPanel('inspect');
  await expect(editor.choice('Collides 1')).toHaveCount(0);

  await editor.addCollider('Player', 'Ground', 'Overlap');
  await expect(editor.choice('Collides 1')).toHaveCount(1);
  expect(await editor.choice('How 1').inputValue()).toBe('overlap');

  // Nothing prunes a dangling row anywhere — not `deleteNode`, not `undo`, not
  // the scene switcher. It is `collidersOf` dropping it on read that makes the
  // row disappear, which is what a `followId` and an `audioId` already do.
  await editor.openPanel('scene');
  await editor.panel('scene').getByRole('button', { name: 'Delete Ground' }).click();
  await editor.deselect();
  await editor.openPanel('inspect');
  await expect(editor.choice('Collides 1')).toHaveCount(0);
});

test('solid tiles are outlined while painting, and stop being when unmarked', async ({
  editor,
}) => {
  await editor.clearScene();
  await editor.addObject('Tiles');
  await editor.importImage({ name: 'tiles.png', buffer: stripPng(TILE, [...TILES]) });
  await editor.sliceSheet(TILE);
  await editor.setField('Columns', 4);
  await editor.setField('Rows', 3);
  await editor.setField('X', 100);
  await editor.setField('Y', 60);
  await editor.setField('Scale X', 4);
  await editor.setField('Scale Y', 4);

  await editor.pickTile(1);
  await editor.fillTiles();
  await editor.setPainting(true);

  // Nothing is solid yet, so the only green on this canvas would be a bug.
  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBe(0);

  await editor.setTileSolid(1, true);
  await editor.closePanels();
  const shaded = (await editor.findDrawn(BODY)).count;
  expect(shaded).toBeGreaterThan(0);

  // A different frame, which nothing on this map is painted with — so marking
  // it changes what the palette says and nothing at all about the canvas.
  await editor.setTileSolid(2, true);
  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBe(shaded);

  await editor.setTileSolid(1, false);
  await editor.closePanels();
  expect((await editor.findDrawn(BODY)).count).toBe(0);
});

test('solid tiles, a collision and controls survive a save and an open, at schema 9', async ({
  editor,
}, testInfo) => {
  await editor.clearScene();
  await rectangle(editor, 'Player');
  await editor.setPhysics(true);
  await editor.setControls(true);
  await editor.setChoice('Control keys', 'W A S D');
  await editor.setTouchControls(true);
  await editor.setField('Jump speed', 505);
  await editor.deselect();

  await editor.addObject('Tiles');
  await editor.setField('Name', 'Ground');
  await editor.importImage({ name: 'tiles.png', buffer: stripPng(TILE, [...TILES]) });
  await editor.sliceSheet(TILE);
  await editor.setTileSolid(0, true);
  await editor.setTileSolid(2, true);
  await editor.deselect();

  await editor.addCollider('Player', 'Ground');

  const saved = await editor.saveToFile();
  const project = JSON.parse(saved.contents);

  // Unbumped, and asserted so a future bump is a deliberate act rather than
  // something that happens to a file. None of the three is a new node type, and
  // all three ride in on `scenes`, which `parseProject` passes through verbatim
  // — so a deployed v9 build opens this file, draws it identically and carries
  // them back out on a re-save. The guides, physics and camera case exactly.
  expect(project.schemaVersion).toBe(9);
  expect(project.scenes[0].children[0].controls).toEqual({
    mode: 'platformer',
    scheme: 'wasd',
    speed: 200,
    jump: 505,
    touch: true,
  });
  expect(project.scenes[0].children[1].props.collides).toEqual([0, 2]);
  expect(project.scenes[0].colliders).toHaveLength(1);
  expect(project.scenes[0].colliders[0]).toMatchObject({ kind: 'collide' });

  const path = testInfo.outputPath('behaviour.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  await editor.openFile(path);

  await editor.selectInTree('Player');
  expect(await editor.numberValue('Jump speed')).toBe(505);
  await expect(editor.checkbox('On-screen buttons')).toBeChecked();
  await editor.deselect();
  await editor.openPanel('inspect');
  await expect(editor.choice('Collides 1')).toHaveCount(1);
});
