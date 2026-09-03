import fs from 'node:fs/promises';
import { expect, test } from './helpers/fixtures';
import { SCENE } from './helpers/editor';

/**
 * Prefabs: a definition held once by the project, placed as many times as the
 * user likes, and edited in one place.
 *
 * The claim that matters here cannot be made about the document. "The two
 * copies stay in step" is true of a duplicate for exactly as long as nobody
 * edits either one, and a store-level assertion would go green on an editor
 * that quietly stored a second copy. So the linked test edits one definition
 * and reads the *other* instance's pixels.
 */

/** Distinct from every default fill, so a centroid can only mean our object. */
const BODY = '#ff00ff';
const AFTER = '#00ff88';
/** Screenshot centroids and CSS-pixel maths agree to about a pixel. */
const NEAR = 6;

const HOME = { x: SCENE.width / 2, y: SCENE.height / 2 };
const AWAY = { x: 220, y: 150 };

/**
 * One rectangle saved as a prefab, leaving a single instance where it was.
 *
 * Deliberately one object rather than a group: `createPrefabFromSelection`
 * anchors on the frontmost selected object either way, and a fixture of one
 * makes "it did not move" an exact claim rather than an average of two.
 */
async function oneRectanglePrefab(editor: import('./helpers/editor').EditorPage) {
  await editor.clearScene();
  await editor.setSnapping(false);
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Body');
  await editor.setField('Fill', BODY);
  await editor.saveAsPrefab();
}

test('saving a prefab leaves an instance exactly where the objects were', async ({
  editor,
}) => {
  await editor.clearScene();
  await editor.setSnapping(false);
  await editor.addObject('Rectangle');
  await editor.setField('Fill', BODY);
  await editor.closePanels();
  const before = await editor.findDrawn(BODY);

  await editor.saveAsPrefab();
  await editor.closePanels();

  // One row, not two: the objects went into the definition and an instance
  // took their place. Its contents are not tree rows — they are in no array
  // the scene holds, so there is nothing there to select, reorder or delete.
  await expect(editor.treeItems()).toHaveCount(1);

  const after = await editor.findDrawn(BODY);
  expect(after.count).toBeGreaterThan(100);
  expect(Math.abs(after.x - before.x)).toBeLessThan(NEAR);
  expect(Math.abs(after.y - before.y)).toBeLessThan(NEAR);
});

test('a second instance draws the same objects somewhere else', async ({ editor }) => {
  await oneRectanglePrefab(editor);

  await editor.placePrefab('Body');
  await editor.setField('X', AWAY.x);
  await editor.setField('Y', AWAY.y);
  await editor.closePanels();

  await expect(editor.treeItems()).toHaveCount(2);

  // Both are drawn, which two separate reads have to establish: one centroid
  // over two blobs is their midpoint and would assert nothing about either.
  const home = await editor.sceneToScreen(HOME);
  const away = await editor.sceneToScreen(AWAY);
  const blob = await editor.findDrawn(BODY);
  expect(blob.count).toBeGreaterThan(200);
  expect(Math.abs(blob.x - (home.x + away.x) / 2)).toBeLessThan(NEAR * 3);
  expect(Math.abs(blob.y - (home.y + away.y) / 2)).toBeLessThan(NEAR * 3);
});

test('editing the definition changes every instance', async ({ editor }) => {
  await oneRectanglePrefab(editor);
  await editor.placePrefab('Body');
  // Renamed before detaching, because an instance is named after its prefab
  // and its detached contents keep the definition's names — so without this
  // there are three rows called "Body" and no locator can mean one of them.
  await editor.setField('Name', 'Copy');
  await editor.setField('X', AWAY.x);
  await editor.setField('Y', AWAY.y);

  // Detach the *second* instance and edit it. Everything from here on is done
  // with the ordinary tools — that is the whole argument for there being no
  // prefab editing mode.
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Detach into a group' }).click();
  await editor.settle();

  // The group's only child, by position: rows are the instance, the group, and
  // the group's contents, in that order.
  await editor.openPanel('scene');
  await editor.treeItems().nth(2).locator('.tree__label').click();
  await editor.settle();
  await editor.setField('Fill', AFTER);

  // Push it back into the definition.
  await editor.selectInTree('Copy');
  await editor.setChoice('Update', 'Body');
  await editor.panel('inspect').getByRole('button', { name: /^Replace Body/ }).click();
  await editor.settle();
  await editor.closePanels();

  // The assertion the feature exists for: the *other* instance, which nothing
  // in this test ever touched, is now drawn in the new colour. Both objects
  // carry it — the detached group because it was edited directly, the instance
  // at HOME only because the definition changed under it — so the centroid of
  // the new colour sits between them, and the old colour is gone from the
  // canvas entirely. That last line is what fails if the instance kept a copy.
  const home = await editor.sceneToScreen(HOME);
  const away = await editor.sceneToScreen(AWAY);
  const blob = await editor.findDrawn(AFTER);
  expect(blob.count).toBeGreaterThan(200);
  expect(Math.abs(blob.x - (home.x + away.x) / 2)).toBeLessThan(NEAR * 3);
  expect(Math.abs(blob.y - (home.y + away.y) / 2)).toBeLessThan(NEAR * 3);
  expect((await editor.findDrawn(BODY)).count).toBe(0);
});

test('detaching gives back ordinary objects, in the same place', async ({ editor }) => {
  await oneRectanglePrefab(editor);
  await editor.closePanels();
  const before = await editor.findDrawn(BODY);

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Detach into a group' }).click();
  await editor.settle();
  await editor.closePanels();

  // A group and its child, where there was one leaf row.
  await expect(editor.treeItems()).toHaveCount(2);
  const after = await editor.findDrawn(BODY);
  expect(Math.abs(after.x - before.x)).toBeLessThan(NEAR);
  expect(Math.abs(after.y - before.y)).toBeLessThan(NEAR);
});

test('deleting a prefab detaches its instances rather than erasing them', async ({
  editor,
}) => {
  await oneRectanglePrefab(editor);
  await editor.placePrefab('Body');
  await editor.closePanels();

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Delete prefab' }).click();
  await editor.settle();
  await editor.closePanels();

  // Two groups now, each holding its own copy: the link is what was deleted,
  // not the objects. A dangling reference in a saved file is the alternative,
  // and the document is never allowed to hold one.
  await expect(editor.treeItems()).toHaveCount(4);
  expect((await editor.findDrawn(BODY)).count).toBeGreaterThan(200);
});

test('a prefab survives a save and an open', async ({ editor }, testInfo) => {
  await oneRectanglePrefab(editor);
  await editor.placePrefab('Body');
  await editor.closePanels();

  // The canvas first: on mobile the file sheet covers it, so a screenshot
  // after the save would report the objects missing.
  const drawn = await editor.findDrawn(BODY);
  expect(drawn.count).toBeGreaterThan(200);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  // A literal rather than the imported constant, so a bump stays a deliberate
  // act. 5 as of prefabs, which a v4 build would drop on open and re-save
  // without — and whose `instance` nodes it could not draw at all.
  expect(parsed.schemaVersion).toBe(5);
  expect(parsed.prefabs).toHaveLength(1);
  expect(parsed.prefabs[0].name).toBe('Body');
  expect(parsed.prefabs[0].children).toHaveLength(1);
  // The instance holds a reference and its own transform, and no contents:
  // that is what makes one edit reach every placement.
  const instance = parsed.scenes[0].children[0];
  expect(instance.type).toBe('instance');
  expect(instance.props.prefabId).toBe(parsed.prefabs[0].id);
  expect(instance.children).toEqual([]);

  const path = testInfo.outputPath('prefabs.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  expect((await editor.findDrawn(BODY)).count).toBeGreaterThan(200);
});
