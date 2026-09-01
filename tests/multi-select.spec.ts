import { expect, test } from './helpers/fixtures';
import { SCENE } from './helpers/editor';

/**
 * Selecting several objects and editing them as one.
 *
 * The interesting half of this is the canvas: the store part of a multi-object
 * edit is a loop, but "one drag moves all of them, each by the same distance"
 * is a claim about pixels, and the way a selection is built at all differs
 * between a mouse and a thumb. Both projects run all of it.
 */

/** Distinct from every default fill, so a centroid can only mean our object. */
const FIRST = '#ff00ff';
const SECOND = '#00ff88';
/** Screenshot centroids and CSS-pixel maths agree to about a pixel. */
const NEAR = 4;

const CENTRE = { x: SCENE.width / 2, y: SCENE.height / 2 };
const AWAY = { x: 260, y: 160 };

/**
 * Two rectangles in known places and known colours, the second left selected.
 *
 * They are added at the scene centre and one is moved, rather than being placed
 * directly, because adding is the only thing that puts an object at a position
 * both this file and the editor agree on without a field edit per coordinate.
 */
async function twoRectangles(editor: import('./helpers/editor').EditorPage) {
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'First');
  await editor.setField('Fill', FIRST);

  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Second');
  await editor.setField('Fill', SECOND);
  await editor.setField('X', AWAY.x);
  await editor.setField('Y', AWAY.y);
  await editor.closePanels();
}

test('taps on the canvas build a selection, and one drag moves all of it', async ({
  editor,
}) => {
  await twoRectangles(editor);

  // Additive presses are how a selection is built where there is no modifier
  // key to hold, so this is the path a phone takes — and the same toggle is on
  // screen for a mouse, which is why both projects run it.
  // Adding an object selects it, so the second rectangle is already in the
  // selection — an additive tap on it would take it back out. A press on empty
  // canvas clears the selection, which is what makes this start from nothing.
  await editor.tap(await editor.sceneToScreen({ x: 40, y: 40 }));
  await editor.setMultiSelect(true);
  await editor.closePanels();
  const first = await editor.sceneToScreen(CENTRE);
  const second = await editor.sceneToScreen(AWAY);
  await editor.tap(first);
  await editor.tap(second);
  await expect(editor.selectionCount()).toHaveText('2 of 5');

  // Off again before dragging: while it is on, a press changes the selection
  // and never starts a move — a press that did both would move everything
  // already picked each time another object was added.
  await editor.setMultiSelect(false);
  await editor.closePanels();

  const beforeFirst = await editor.findDrawn(FIRST);
  const beforeSecond = await editor.findDrawn(SECOND);
  expect(beforeFirst.count).toBeGreaterThan(100);
  expect(beforeSecond.count).toBeGreaterThan(100);

  // Pressing one of them moves both, by the pointer's own displacement. The
  // touch two-step is already satisfied — both are selected — so this must not
  // send the extra selecting tap, which under an additive press would instead
  // take the object back out of the selection.
  const moved = await editor.drag(
    first,
    { x: first.x + 60, y: first.y - 70 },
    { select: false },
  );

  const afterFirst = await editor.findDrawn(FIRST);
  const afterSecond = await editor.findDrawn(SECOND);
  expect(Math.abs(afterFirst.x - (beforeFirst.x + moved.x))).toBeLessThan(NEAR);
  expect(Math.abs(afterFirst.y - (beforeFirst.y + moved.y))).toBeLessThan(NEAR);
  expect(Math.abs(afterSecond.x - (beforeSecond.x + moved.x))).toBeLessThan(NEAR);
  expect(Math.abs(afterSecond.y - (beforeSecond.y + moved.y))).toBeLessThan(NEAR);

  // And one drag is still one undo step, however many objects it moved.
  await editor.undo();
  const undoneFirst = await editor.findDrawn(FIRST);
  const undoneSecond = await editor.findDrawn(SECOND);
  expect(Math.abs(undoneFirst.x - beforeFirst.x)).toBeLessThan(NEAR);
  expect(Math.abs(undoneSecond.x - beforeSecond.x)).toBeLessThan(NEAR);
});

test('deleting a selection takes all of it in one step', async ({ editor }) => {
  await twoRectangles(editor);

  await editor.setMultiSelect(true);
  await editor.selectInTree('First');
  await editor.setMultiSelect(false);

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByTitle('Delete these objects').click();
  await editor.settle();

  await expect(editor.treeItems()).toHaveCount(3);
  await editor.closePanels();
  expect((await editor.findDrawn(FIRST)).count).toBe(0);
  expect((await editor.findDrawn(SECOND)).count).toBe(0);

  // One step, so one undo brings both back.
  await editor.undo();
  await expect(editor.treeItems()).toHaveCount(5);
  await editor.closePanels();
  expect((await editor.findDrawn(FIRST)).count).toBeGreaterThan(100);
  expect((await editor.findDrawn(SECOND)).count).toBeGreaterThan(100);
});

test('grouping a selection leaves every object where it was', async ({ editor }) => {
  await twoRectangles(editor);

  await editor.closePanels();
  const beforeFirst = await editor.findDrawn(FIRST);
  const beforeSecond = await editor.findDrawn(SECOND);

  await editor.setMultiSelect(true);
  await editor.selectInTree('First');
  await editor.setMultiSelect(false);

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Group', exact: true }).click();
  await editor.settle();

  // The group replaces the two rows with one, holding both.
  await expect(editor.treeItems()).toHaveCount(6);

  // Nothing moved: grouping changes what an object moves *with*, not where it
  // is, and that holds for objects the group did not start out beneath.
  await editor.closePanels();
  const afterFirst = await editor.findDrawn(FIRST);
  const afterSecond = await editor.findDrawn(SECOND);
  expect(Math.abs(afterFirst.x - beforeFirst.x)).toBeLessThan(NEAR);
  expect(Math.abs(afterFirst.y - beforeFirst.y)).toBeLessThan(NEAR);
  expect(Math.abs(afterSecond.x - beforeSecond.x)).toBeLessThan(NEAR);
  expect(Math.abs(afterSecond.y - beforeSecond.y)).toBeLessThan(NEAR);

  // Both are really inside it in the document, in the draw order they had.
  const saved = await editor.saveToFile();
  const scene = JSON.parse(saved.contents).scenes[0];
  const group = scene.children.find((node: { type: string }) => node.type === 'container');
  expect(group.children.map((child: { name: string }) => child.name)).toEqual([
    'First',
    'Second',
  ]);
  expect(
    scene.children.some((node: { name: string }) => node.name === 'First'),
    'the originals were left behind as well as grouped',
  ).toBe(false);
});

test('duplicating a selection copies all of it and selects the copies', async ({
  editor,
}) => {
  await twoRectangles(editor);

  await editor.setMultiSelect(true);
  await editor.selectInTree('First');
  await editor.setMultiSelect(false);

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Duplicate', exact: true }).click();
  await editor.settle();

  await editor.openPanel('scene');
  await expect(editor.treeItems()).toHaveCount(7);
  // The copies, not the originals: what you have just made is what you want to
  // move next, and the header is where that is visible.
  await expect(editor.selectionCount()).toHaveText('2 of 7');
  await expect(
    editor.panel('scene').getByRole('button', { name: 'First copy', exact: true }),
  ).toBeVisible();
  await expect(
    editor.panel('scene').getByRole('button', { name: 'Second copy', exact: true }),
  ).toBeVisible();
});
