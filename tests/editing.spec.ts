import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE } from './helpers/editor';

/**
 * The editing round trip, on both form factors.
 *
 * Every canvas assertion checks what is *drawn*, not only what is stored: the
 * bug this harness was built after held the right coordinates in the document
 * the whole time while the canvas showed something else, and passed every
 * store-level check.
 */

/** Distinct from every default fill, so a centroid can only mean our object. */
const MARKER = '#ff00ff';
const RECT_FILL = '#4f8cff';
const ELLIPSE_FILL = '#ffb84f';

/** Screenshot centroids and CSS-pixel maths agree to about a pixel. */
const NEAR = 4;

test('boots with the starter project, and draws it where the document says', async ({
  editor,
}) => {
  await expect(editor.treeItems()).toHaveCount(3);

  const rectangle = await editor.findDrawn(RECT_FILL);
  const ellipse = await editor.findDrawn(ELLIPSE_FILL);
  expect(rectangle.count, 'the starter rectangle is not on the canvas').toBeGreaterThan(100);
  expect(ellipse.count, 'the starter ellipse is not on the canvas').toBeGreaterThan(100);

  // The document puts them at 480,320 and 300,190.
  const expectedRect = await editor.sceneToScreen({ x: 480, y: 320 });
  const expectedEllipse = await editor.sceneToScreen({ x: 300, y: 190 });
  expect(Math.abs(rectangle.x - expectedRect.x)).toBeLessThan(NEAR);
  expect(Math.abs(rectangle.y - expectedRect.y)).toBeLessThan(NEAR);
  expect(Math.abs(ellipse.x - expectedEllipse.x)).toBeLessThan(NEAR);
  expect(Math.abs(ellipse.y - expectedEllipse.y)).toBeLessThan(NEAR);
});

test('adds an object at the scene centre and draws it there', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await expect(editor.treeItems()).toHaveCount(4);

  await editor.setField('Fill', MARKER);
  expect(await editor.numberValue('X')).toBe(SCENE.width / 2);
  expect(await editor.numberValue('Y')).toBe(SCENE.height / 2);

  await editor.closePanels();
  const drawn = await editor.findDrawn(MARKER);
  const expected = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  expect(drawn.count).toBeGreaterThan(100);
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);
});

test('drags on the canvas, stores the move, and undoes it', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.closePanels();
  // Snapping off: this test's claim is that the object lands where the pointer
  // put it, and a snap is the editor deliberately putting it somewhere else.
  // Snapping has its own spec; here it would only add a neighbour's edge to
  // the arithmetic.
  await editor.setSnapping(false);

  const start = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  const before = await editor.findDrawn(MARKER);
  expect(before.count).toBeGreaterThan(100);

  // Small enough to stay inside the canvas at 390px wide, large enough to be
  // unambiguous against Phaser's 8px drag threshold.
  const delta = { x: 60, y: -70 };
  // The drag returns the displacement the object should take, which is the
  // gesture less the priming move Phaser's drag threshold swallows.
  const moved = await editor.drag(start, { x: start.x + delta.x, y: start.y + delta.y });

  const zoom = await editor.zoom();
  const expectedX = Math.round(SCENE.width / 2 + moved.x / zoom);
  const expectedY = Math.round(SCENE.height / 2 + moved.y / zoom);

  // The document moved...
  // Within a pixel of scene units: the drag stores exact floats and rounds
  // once on release, and the pointer lands on a whole device pixel.
  expect(Math.abs((await editor.numberValue('X')) - expectedX)).toBeLessThanOrEqual(2);
  expect(Math.abs((await editor.numberValue('Y')) - expectedY)).toBeLessThanOrEqual(2);

  // ...and so did the pixels, by the same amount.
  await editor.closePanels();
  const after = await editor.findDrawn(MARKER);
  expect(Math.abs(after.x - (before.x + moved.x))).toBeLessThan(NEAR);
  expect(Math.abs(after.y - (before.y + moved.y))).toBeLessThan(NEAR);

  // One drag is one undo step, so a single undo puts it back at the centre.
  await editor.undo();
  expect(await editor.numberValue('X')).toBe(SCENE.width / 2);
  expect(await editor.numberValue('Y')).toBe(SCENE.height / 2);

  await editor.closePanels();
  const undone = await editor.findDrawn(MARKER);
  expect(Math.abs(undone.x - before.x)).toBeLessThan(NEAR);
  expect(Math.abs(undone.y - before.y)).toBeLessThan(NEAR);
});

test('an inspector edit moves what is drawn', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.setField('X', 700);
  await editor.setField('Y', 400);
  await editor.closePanels();

  const drawn = await editor.findDrawn(MARKER);
  const expected = await editor.sceneToScreen({ x: 700, y: 400 });
  expect(drawn.count).toBeGreaterThan(100);
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);
});

test('draw order is the list order, and Arrange changes it', async ({ editor }) => {
  // Two objects on the same spot: whichever is later in the list wins the
  // pixels, which is the whole of draw order in this editor.
  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.addObject('Rectangle');
  await editor.setField('Fill', '#00ff88');
  await editor.closePanels();

  expect((await editor.findDrawn(MARKER)).count).toBe(0);
  expect((await editor.findDrawn('#00ff88')).count).toBeGreaterThan(100);

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByTitle('Send to back').click();
  await editor.closePanels();

  expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);
});

test('saves a file, starts over, and reopens it', async ({ editor, page }, testInfo) => {
  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.setField('Name', 'Marker');

  const saved = await editor.saveToFile();
  expect(saved.name).toMatch(/\.phaser\.json$/);

  const parsed = JSON.parse(saved.contents);
  // A literal rather than the imported constant: the point is that a bump is
  // noticed and made deliberately, which comparing the code against itself
  // could never catch. 6 as of tilemaps.
  expect(parsed.schemaVersion).toBe(6);
  const names = parsed.scenes[0].children.map((node: { name: string }) => node.name);
  expect(names).toContain('Marker');

  const path = testInfo.outputPath('saved.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  // Nothing is dirty after a save, so New goes through without a confirm.
  page.on('dialog', (dialog) => void dialog.accept());
  await editor.newProject();
  await editor.closePanels();
  await expect(editor.treeItems()).toHaveCount(3);
  expect((await editor.findDrawn(MARKER)).count).toBe(0);

  await editor.openFile(path);
  await editor.closePanels();
  await expect(editor.treeItems()).toHaveCount(4);
  expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);
});

test('a group moves what is inside it, and survives a save', async ({
  editor,
  page,
}, testInfo) => {
  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.setField('Name', 'Marker');

  // Wrapping puts the group where the object was, with the object on its
  // origin, so nothing moves at the moment of grouping.
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Wrap in a new group' }).click();
  await editor.settle();
  expect(await editor.numberValue('X')).toBe(SCENE.width / 2);

  await editor.closePanels();
  const grouped = await editor.findDrawn(MARKER);
  const centre = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  expect(grouped.count).toBeGreaterThan(100);
  expect(Math.abs(grouped.x - centre.x)).toBeLessThan(NEAR);

  // Moving the group moves the object with it: the child's own coordinates
  // never change, which is the whole point of the container.
  await editor.setField('X', 700);
  await editor.setField('Y', 400);
  await editor.closePanels();
  const moved = await editor.findDrawn(MARKER);
  const expected = await editor.sceneToScreen({ x: 700, y: 400 });
  expect(Math.abs(moved.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(moved.y - expected.y)).toBeLessThan(NEAR);

  await editor.selectInTree('Marker');
  expect(await editor.numberValue('X')).toBe(0);
  expect(await editor.numberValue('Y')).toBe(0);

  // Dragging a nested object is the case Phaser reports in container space
  // rather than world space, so the stored number and the pixels have to be
  // checked against each other, not just against the gesture.
  await editor.closePanels();
  const delta = { x: 50, y: -60 };
  const drag = await editor.drag(expected, {
    x: expected.x + delta.x,
    y: expected.y + delta.y,
  });
  const zoom = await editor.zoom();
  expect(Math.abs((await editor.numberValue('X')) - Math.round(drag.x / zoom))).toBeLessThanOrEqual(2);

  await editor.closePanels();
  const dragged = await editor.findDrawn(MARKER);
  expect(Math.abs(dragged.x - (moved.x + drag.x))).toBeLessThan(NEAR);
  expect(Math.abs(dragged.y - (moved.y + drag.y))).toBeLessThan(NEAR);

  // The nesting is in the document, and comes back out of a file.
  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  const group = parsed.scenes[0].children.find(
    (node: { type: string }) => node.type === 'container',
  );
  expect(group.children.map((child: { name: string }) => child.name)).toEqual(['Marker']);

  const path = testInfo.outputPath('grouped.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  page.on('dialog', (dialog) => void dialog.accept());
  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  const reopened = await editor.findDrawn(MARKER);
  expect(reopened.count).toBeGreaterThan(100);
  expect(Math.abs(reopened.x - dragged.x)).toBeLessThan(NEAR);
  expect(Math.abs(reopened.y - dragged.y)).toBeLessThan(NEAR);
});

test('a selected group is dragged by its contents', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.setField('Name', 'Marker');
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Wrap in a new group' }).click();
  await editor.settle();
  await editor.closePanels();
  // Snapping off: this test's claim is that the object lands where the pointer
  // put it, and a snap is the editor deliberately putting it somewhere else.
  // Snapping has its own spec; here it would only add a neighbour's edge to
  // the arithmetic.
  await editor.setSnapping(false);

  // Wrapping leaves the group selected, so this press lands on the child and
  // moves the group — a group's own box is covered by the children that give
  // it one, so there is nothing else to press.
  const start = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  const before = await editor.findDrawn(MARKER);
  const moved = await editor.drag(start, { x: start.x + 60, y: start.y - 70 });

  const zoom = await editor.zoom();
  expect(
    Math.abs((await editor.numberValue('X')) - Math.round(SCENE.width / 2 + moved.x / zoom)),
  ).toBeLessThanOrEqual(2);

  await editor.closePanels();
  const after = await editor.findDrawn(MARKER);
  expect(Math.abs(after.x - (before.x + moved.x))).toBeLessThan(NEAR);
  expect(Math.abs(after.y - (before.y + moved.y))).toBeLessThan(NEAR);

  // The group moved, not the object inside it.
  await editor.selectInTree('Marker');
  expect(await editor.numberValue('X')).toBe(0);
  expect(await editor.numberValue('Y')).toBe(0);
});

test('an object dragged into a group in the tree stays where it was', async ({
  editor,
  isMobile,
}) => {
  test.skip(isMobile, 'HTML5 drag and drop is the desktop path; a phone uses the Parent field');

  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.setField('Name', 'Marker');

  // The group second: adding an object while a group is selected puts it
  // inside, and this test needs one that starts outside.
  await editor.addObject('Group');
  await editor.setField('Name', 'Box');
  await editor.setField('X', 200);
  await editor.setField('Y', 150);
  await editor.closePanels();

  const before = await editor.findDrawn(MARKER);

  const source = editor.panel('scene').locator('.tree__item', { hasText: 'Marker' });
  const group = editor.panel('scene').locator('.tree__item', { hasText: 'Box' });
  await source.dragTo(group);
  await editor.settle();

  // Nested now, and its stored position is relative to the group...
  await editor.selectInTree('Marker');
  expect(await editor.numberValue('X')).toBe(SCENE.width / 2 - 200);
  expect(await editor.numberValue('Y')).toBe(SCENE.height / 2 - 150);

  // ...while the pixels have not moved at all, which is what reparenting is
  // supposed to feel like.
  await editor.closePanels();
  const after = await editor.findDrawn(MARKER);
  expect(Math.abs(after.x - before.x)).toBeLessThan(NEAR);
  expect(Math.abs(after.y - before.y)).toBeLessThan(NEAR);
});

test('restores the autosaved draft after a reload', async ({ editor, page }) => {
  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);

  // The draft is debounced by 800ms; waiting for the value to appear is
  // steadier than waiting out the timer.
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem('phaser-gui-tool:draft:v1')?.includes('#ff00ff')),
    )
    .toBe(true);

  await page.reload();
  await editor.waitForCanvas();
  await expect(editor.treeItems()).toHaveCount(4);
  await editor.closePanels();
  expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);
});

test('the first touch selects rather than moving', async ({ editor, isMobile }) => {
  test.skip(!isMobile, 'the two-step rule is the touch interaction model');

  await editor.addObject('Rectangle');
  await editor.setField('Fill', MARKER);
  await editor.closePanels();

  // Deselect first: adding an object selects it, and a selected object is
  // draggable straight away.
  const centre = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  const empty = await editor.sceneToScreen({ x: 40, y: 40 });
  await editor.tap(empty);

  await editor.drag(centre, { x: centre.x + 70, y: centre.y }, { select: false });
  expect(await editor.numberValue('X')).toBe(SCENE.width / 2);

  // The same gesture again, now that the object is selected, does move it.
  await editor.closePanels();
  await editor.drag(centre, { x: centre.x + 70, y: centre.y });
  expect(await editor.numberValue('X')).toBeGreaterThan(SCENE.width / 2);
});
