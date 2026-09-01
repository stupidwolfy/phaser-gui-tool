import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';

/**
 * Align and distribute.
 *
 * The claim worth testing is that both work on what is *drawn* rather than on
 * what is stored: a node's x/y is its origin, and three objects of different
 * sizes with their origins in a line do not look aligned. So the fixture below
 * gives every rectangle a different size on purpose, and the expected numbers
 * are edges, not origins.
 */

const A = '#ff00ff';
const B = '#00ff88';
const C = '#ffcc00';
/** Screenshot centroids and CSS-pixel maths agree to about a pixel. */
const NEAR = 4;

/** Three rectangles of three sizes, in three places, none of them lined up. */
async function threeRectangles(editor: EditorPage) {
  const place = async (
    name: string,
    fill: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    await editor.addObject('Rectangle');
    await editor.setField('Name', name);
    await editor.setField('Fill', fill);
    await editor.setField('Width', width);
    await editor.setField('Height', height);
    await editor.setField('X', x);
    await editor.setField('Y', y);
  };

  await place('A', A, 150, 100, 60, 40);
  await place('B', B, 400, 200, 120, 40);
  await place('C', C, 700, 400, 40, 40);

  // Adding selects, so C is already in the selection: the other two are the
  // ones to add. An additive tap on C would take it back out.
  await editor.setMultiSelect(true);
  await editor.selectInTree('A');
  await editor.selectInTree('B');
  await editor.setMultiSelect(false);
  await expect(editor.selectionCount()).toHaveText('3 of 6');
}

/** The three rectangles' transforms, by name, straight out of a saved file. */
async function savedTransforms(editor: EditorPage) {
  const saved = await editor.saveToFile();
  const scene = JSON.parse(saved.contents).scenes[0];
  const byName = new Map<string, { x: number; y: number }>(
    scene.children.map((node: { name: string; transform: { x: number; y: number } }) => [
      node.name,
      node.transform,
    ]),
  );
  return byName;
}

test('align moves objects by their drawn edges, in one undo step', async ({ editor }) => {
  await threeRectangles(editor);

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Left', exact: true }).click();
  await editor.settle();

  // The leftmost edge in the selection is A's, at 150 - 60/2 = 120, and that is
  // what the other two move to: the target is the selection's own bounding box,
  // so the object already furthest left does not move at all.
  const transforms = await savedTransforms(editor);
  expect(transforms.get('A')?.x).toBe(150);
  expect(transforms.get('B')?.x).toBe(180);
  expect(transforms.get('C')?.x).toBe(140);
  // Aligning one axis leaves the other alone.
  expect(transforms.get('B')?.y).toBe(200);

  // And the canvas agrees: it is the drawn box that was lined up.
  await editor.closePanels();
  const drawn = await editor.findDrawn(B);
  const expected = await editor.sceneToScreen({ x: 180, y: 200 });
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);

  // One press is one step, however many objects it moved.
  await editor.undo();
  const undone = await savedTransforms(editor);
  expect(undone.get('B')?.x).toBe(400);
  expect(undone.get('C')?.x).toBe(700);
});

test('align sticks: pressing it twice changes nothing the second time', async ({
  editor,
}) => {
  await threeRectangles(editor);

  await editor.openPanel('inspect');
  const top = editor.panel('inspect').getByRole('button', { name: 'Top', exact: true });
  await top.click();
  await editor.settle();
  const once = await savedTransforms(editor);

  await editor.openPanel('inspect');
  await top.click();
  await editor.settle();
  const twice = await savedTransforms(editor);

  // Top edges: A's is 100 - 40/2 = 80, and every box is 40 tall, so all three
  // centres land on 100 and stay there.
  for (const name of ['A', 'B', 'C']) {
    expect(once.get(name)?.y).toBe(100);
    expect(twice.get(name)?.y).toBe(once.get(name)?.y);
  }
});

test('distribute spaces the middle object evenly and leaves the outer two', async ({
  editor,
}) => {
  await threeRectangles(editor);

  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Spread ↕' }).click();
  await editor.settle();

  // Centres at 100, 200 and 400: the outermost pair is the selection's own
  // extent and does not move, and the one in between lands halfway, at 250.
  const transforms = await savedTransforms(editor);
  expect(transforms.get('A')?.y).toBe(100);
  expect(transforms.get('B')?.y).toBe(250);
  expect(transforms.get('C')?.y).toBe(400);
  expect(transforms.get('B')?.x).toBe(400);
});

test('distribute is offered only once there is something in between', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'One');
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Two');
  await editor.setField('X', 400);

  await editor.setMultiSelect(true);
  await editor.selectInTree('One');
  await editor.setMultiSelect(false);

  // Two objects are the outer pair with nothing between them, so there is
  // nothing to spread — the buttons say so rather than doing nothing quietly.
  await editor.openPanel('inspect');
  const inspect = editor.panel('inspect');
  await expect(inspect.getByRole('button', { name: 'Spread ↔' })).toBeDisabled();
  await expect(inspect.getByRole('button', { name: 'Spread ↕' })).toBeDisabled();
});
