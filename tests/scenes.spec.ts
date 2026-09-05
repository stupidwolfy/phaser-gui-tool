import fs from 'node:fs/promises';
import { expect, test } from './helpers/fixtures';

/**
 * Several scenes in one project: switching between them, and what that means
 * for the canvas, the file and the export.
 *
 * The document has held a `scenes` array and an `activeSceneId` since the first
 * iteration, and until now exactly one entry ever went into it. So the claims
 * worth making here are about the things that were never exercised by a list of
 * one: that the canvas draws the scene you switched to and nothing of the one
 * you left, that both survive a save, and that the export carries every scene
 * rather than the one that happened to be on screen.
 */

const MARKER = '#ff00aa';
const OTHER = '#00ff88';

test('a second scene is its own canvas, and switching back brings the first one back', async ({
  editor,
}) => {
  // The starter project's three examples would be three more colours a centroid
  // could pick up, and every assertion below names an exact count.
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'First');
  await editor.setField('Fill', MARKER);
  await editor.closePanels();
  expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);

  await editor.addScene();
  await editor.closePanels();
  // Empty, and nothing of the scene we came from is left on the canvas — the
  // renderer's diff has to have destroyed every display object, not merely
  // stopped updating them.
  await expect(editor.treeItems()).toHaveCount(0);
  expect((await editor.findDrawn(MARKER)).count).toBe(0);

  await editor.addObject('Ellipse');
  await editor.setField('Name', 'Second');
  await editor.setField('Fill', OTHER);
  await editor.closePanels();
  expect((await editor.findDrawn(OTHER)).count).toBeGreaterThan(100);

  await editor.switchToScene('MainScene');
  await editor.closePanels();
  await expect(editor.treeItems()).toHaveCount(1);
  expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);
  expect((await editor.findDrawn(OTHER)).count).toBe(0);
});

test('both scenes are saved, and the file reopens on the one it was left on', async ({
  editor,
  page,
}, testInfo) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'First');
  await editor.addScene();
  await editor.addObject('Ellipse');
  await editor.setField('Name', 'Second');
  await editor.setField('Fill', OTHER);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  // A second scene bumps nothing. The rule is "would a deployed older build
  // break on this file", and a v5 build does not: `parseProject` passes
  // `scenes` through verbatim and validates `activeSceneId` against it, so an
  // older build opens this on the same scene, draws it identically, and carries
  // the other one back out on a re-save. That is the guides case, not the
  // prefabs one — a literal here so that a future bump is a deliberate act.
  // It reads 9 because tilemaps, particles, audio and then the two stretchable
  // types bumped it; scenes did not.
  expect(parsed.schemaVersion).toBe(9);
  expect(parsed.scenes).toHaveLength(2);
  expect(parsed.scenes[1].children.map((node: { name: string }) => node.name)).toEqual([
    'Second',
  ]);
  expect(parsed.activeSceneId).toBe(parsed.scenes[1].id);

  const path = testInfo.outputPath('two-scenes.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  page.on('dialog', (dialog) => void dialog.accept());
  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  // Reopened on the second scene, because that is where the file says the user
  // was — the one thing `activeSceneId` is for.
  await expect(editor.treeItems()).toHaveCount(1);
  expect((await editor.findDrawn(OTHER)).count).toBeGreaterThan(100);
});

test('duplicating a scene copies its objects, with ids of their own', async ({
  editor,
}, testInfo) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Copied');
  await editor.duplicateScene();
  await editor.closePanels();

  await expect(editor.treeItems()).toHaveCount(1);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  expect(parsed.scenes).toHaveLength(2);
  expect(parsed.scenes[1].name).toBe('MainScene copy');
  expect(parsed.scenes[1].children[0].name).toBe('Copied');
  // Fresh ids, because `findNode` answers with whichever node it reaches first
  // and the renderer keys its display objects by that id: two scenes sharing
  // one would have an edit in either land in whichever was searched first.
  expect(parsed.scenes[1].children[0].id).not.toBe(parsed.scenes[0].children[0].id);
  expect(parsed.scenes[1].id).not.toBe(parsed.scenes[0].id);

  await fs.writeFile(testInfo.outputPath('copy.phaser.json'), saved.contents, 'utf8');
});

test('the only scene cannot be deleted, and deleting one lands on its neighbour', async ({
  editor,
}) => {
  await editor.deselect();
  await editor.openPanel('inspect');
  // A project with no scenes has nothing to draw and would not reopen, so the
  // button says so rather than silently doing nothing.
  await expect(
    editor.panel('inspect').getByRole('button', { name: 'Delete scene' }),
  ).toBeDisabled();

  await editor.addScene();
  await editor.addObject('Rectangle');
  await editor.setField('Fill', OTHER);
  await editor.deleteScene();
  await editor.closePanels();

  // Back on the starter scene, with its three examples, and nothing of the
  // deleted one left on the canvas.
  await expect(editor.treeItems()).toHaveCount(3);
  expect((await editor.findDrawn(OTHER)).count).toBe(0);

  // One scene again, so the switcher has nothing left to switch between.
  await editor.openPanel('scene');
  await expect(
    editor.panel('scene').getByRole('button', { name: /^Switch to / }),
  ).toHaveCount(0);
});

test('every scene reaches the export, and the one being edited is the one that boots', async ({
  editor,
}) => {
  await editor.addScene();
  await editor.addObject('Rectangle');

  const module = await editor.exportCode('ts');
  const classes = module.contents.match(/^export class (\w+) extends Phaser\.Scene/gm) ?? [];
  // Both, because a game's scenes are registered together and start each other
  // by key: an export carrying only the one on screen is a game with nowhere
  // to go.
  expect(classes).toHaveLength(2);
  expect(module.contents).toContain('export default Scene2;');

  const page = await editor.exportCode('html');
  // Phaser starts the first entry and registers the rest, so the scene the user
  // was looking at goes first.
  expect(page.contents).toContain('scene: [Scene2, MainScene]');
});
