import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';

/**
 * Finding things in the scene tree: the filter, expand/collapse all, and the
 * tree revealing whatever is selected.
 *
 * All of it is editor state local to the tree — never saved, never undoable —
 * so the claims are about rows and about the document *not* moving.
 */

const CENTRE = { x: SCENE.width / 2, y: SCENE.height / 2 };

/**
 * A group called Box holding a rectangle called Needle, beside a top-level
 * ellipse called Round. Adding lands in the group being worked in, so the
 * rectangle goes inside the group; a press on empty canvas then clears the
 * selection so the ellipse lands at the top level.
 */
async function nestedScene(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Group');
  await editor.setField('Name', 'Box');
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Needle');
  await editor.closePanels();
  await editor.tap(await editor.sceneToScreen({ x: 30, y: 30 }));
  await editor.addObject('Ellipse');
  await editor.setField('Name', 'Round');
  await editor.setField('X', 150);
  await editor.setField('Y', 120);
}

async function collapse(editor: EditorPage, group: string): Promise<void> {
  await editor.openPanel('scene');
  await editor.panel('scene').getByRole('button', { name: `Collapse ${group}`, exact: true }).click();
}

test('the filter lists matches with their groups, and clearing it restores what was collapsed', async ({
  editor,
}) => {
  await nestedScene(editor);
  await collapse(editor, 'Box');
  expect(await editor.treeRowNames()).toEqual(['Box', 'Round']);

  await editor.filterTree('need');
  expect(await editor.treeRowNames()).toEqual(['Box', 'Needle']);
  const scene = editor.panel('scene');
  await expect(scene.locator('.tree__item.is-context')).toHaveCount(1);
  await expect(scene.getByRole('button', { name: 'Box, container, contains a match', exact: true })).toBeVisible();
  await expect(scene.locator('.tree__name mark')).toHaveText('Need');
  await expect(scene.locator('.panel__count')).toHaveText('1 of 3');
  // The filter opens the group's path without touching the collapsed set.
  await expect(scene.getByRole('button', { name: 'Expand all groups' })).toBeDisabled();

  await editor.filterTree('');
  expect(await editor.treeRowNames()).toEqual(['Box', 'Round']);
});

test('a filter matches on type, and says so when nothing matches', async ({ editor }) => {
  await nestedScene(editor);
  await editor.filterTree('ELLIPSE');
  expect(await editor.treeRowNames()).toEqual(['Round']);

  await editor.filterTree('zzz');
  expect(await editor.treeRowNames()).toEqual([]);
  await expect(editor.panel('scene').getByText('No objects match “zzz”.')).toBeVisible();
});

test('filtering keeps the selection and leaves the document alone', async ({ editor }) => {
  await nestedScene(editor);
  await editor.selectInTree('Round');
  const before = (await editor.saveToFile()).contents;

  await editor.filterTree('needle');
  expect(await editor.treeRowNames()).not.toContain('Round');
  await editor.filterTree('');

  const row = editor.panel('scene').getByRole('button', { name: 'Round, ellipse', exact: true });
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  const after = (await editor.saveToFile()).contents;
  expect(JSON.parse(after).scenes).toEqual(JSON.parse(before).scenes);
});

test('collapse all hides every nested row, and expand all brings them back', async ({ editor }) => {
  await nestedScene(editor);
  await editor.openPanel('scene');
  const scene = editor.panel('scene');
  expect(await editor.treeRowNames()).toEqual(['Box', 'Needle', 'Round']);

  await scene.getByRole('button', { name: 'Collapse all groups' }).click();
  expect(await editor.treeRowNames()).toEqual(['Box', 'Round']);
  await expect(scene.getByRole('button', { name: 'Collapse all groups' })).toBeDisabled();

  await scene.getByRole('button', { name: 'Expand all groups' }).click();
  expect(await editor.treeRowNames()).toEqual(['Box', 'Needle', 'Round']);
});

test('selecting a hidden child on the canvas opens the groups above its row', async ({ editor }) => {
  await nestedScene(editor);
  await collapse(editor, 'Box');
  await editor.closePanels();
  // Clear first, so a phone's first tap is the one that selects the child.
  await editor.tap(await editor.sceneToScreen({ x: 30, y: 30 }));
  await editor.tap(await editor.sceneToScreen(CENTRE));

  expect(await editor.treeRowNames()).toEqual(['Box', 'Needle', 'Round']);
  await expect(
    editor.panel('scene').getByRole('button', { name: 'Needle, rectangle', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('/ focuses the filter, and Escape there clears it without deselecting', async ({
  editor,
  page,
}) => {
  await nestedScene(editor);
  await editor.selectInTree('Round');
  await editor.closePanels();
  await page.locator('body').focus();
  await page.keyboard.press('/');

  const input = editor.panel('scene').getByRole('searchbox', { name: 'Filter objects', exact: true });
  await expect(input).toBeFocused();
  await page.keyboard.type('need');
  expect(await editor.treeRowNames()).toEqual(['Box', 'Needle']);

  await page.keyboard.press('Escape');
  await expect(input).toHaveValue('');
  await expect(
    editor.panel('scene').getByRole('button', { name: 'Round, ellipse', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
