import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';

/**
 * The properties panel's collapsible sections.
 *
 * This is the one spec in the suite that runs against the *shipped* section
 * preference. Every other spec is handed "everything open" by the seed in
 * `EditorPage.open`, because collapsing by default would otherwise turn some
 * forty direct `panel('inspect')` locators — several of them deliberate
 * *absence* assertions — into statements that pass for the wrong reason. So the
 * seeding is what keeps those honest, and this file is what keeps the seeding
 * honest.
 *
 * Nothing here reads pixels. What a disclosure does is decide whether a control
 * is in the DOM at all, which is a question about the panel rather than about
 * the canvas — the one test below that touches the canvas does so only to prove
 * that a field reached through a disclosure still drives the document.
 */

test.beforeEach(async ({ editor }) => {
  await editor.useShippedSectionDefaults();
  await editor.clearScene();
});

test('a section ships collapsed, and its controls are not merely hidden', async ({
  editor,
}) => {
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');

  await expect(editor.sectionHead('Transform')).toBeVisible();
  expect(await editor.sectionIsOpen('Transform')).toBe(false);

  // Count, not visibility: the body is unmounted rather than hidden, and the
  // difference matters — a hidden field still matches every locator in this
  // suite, so asserting only `not.toBeVisible()` would pass either way.
  await expect(editor.field('X')).toHaveCount(0);
});

test('pressing a head reveals its controls, and they still drive the document', async ({
  editor,
}) => {
  await editor.addObject('Rectangle');
  await editor.toggleSection('Transform');
  expect(await editor.sectionIsOpen('Transform')).toBe(true);

  // The round trip that matters: a field reached through a disclosure opens and
  // closes an undo transaction the same way, so the edit lands and comes back.
  await editor.setField('X', 300);
  await editor.setField('Y', 200);
  expect(await editor.numberValue('X')).toBe(300);

  await editor.toggleSection('Transform');
  expect(await editor.sectionIsOpen('Transform')).toBe(false);
  await expect(editor.field('X')).toHaveCount(0);
});

/**
 * The positive counterpart to `physics.spec.ts`'s `toHaveCount(0)`.
 *
 * That test asserts a section is *absent* for a type that cannot carry a body,
 * by exact text. A head that rendered its title and its chevron as one text
 * node would make it match nothing and pass vacuously for ever, so the title
 * has to stay a text node of its own — and something has to say so.
 */
test('a section title is still exact text', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');
  await expect(
    editor.panel('inspect').getByText('Transform', { exact: true }),
  ).toHaveCount(1);
});

test('an open section stays open across a selection change', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.toggleSection('Transform');

  await editor.closePanels();
  await editor.addObject('Ellipse');

  // A different object, and for the second half of the claim a different node
  // type: the state is keyed by title rather than by node, which is what makes
  // "I always want Transform open" hold rather than needing saying again.
  expect(await editor.sectionIsOpen('Transform')).toBe(true);
});

test('the open sections survive a reload', async ({ editor }) => {
  // A scene-panel section rather than a node's. The selection is editor state
  // and is deliberately not saved, so the panel comes back on `SceneInspector`
  // after a reload and a node section has nothing to read — which is the
  // editor behaving correctly, not the preference having been lost.
  await editor.toggleSection('Snapping');
  expect(await editor.sectionIsOpen('Snapping')).toBe(true);

  await editor.reload();

  // The only test of `io/prefs.ts` round-tripping. The marker set by
  // `useShippedSectionDefaults` keeps `open`'s init script from re-seeding on
  // the way back, so what comes back is what was actually written.
  expect(await editor.sectionIsOpen('Snapping')).toBe(true);
});

/**
 * The claim that justifies storing a default plus overrides rather than a set
 * of open titles.
 *
 * Expand-all has to reach sections that are not on screen when it is pressed —
 * a set could only name the ones that were. A tilemap selected *afterwards*
 * shows sections the button never saw, and they have to be open.
 */
test('expand all reaches a section that was not on screen when it was pressed', async ({
  editor,
}) => {
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');

  await editor.panel('inspect').getByRole('button', { name: 'Expand all sections' }).click();
  expect(await editor.sectionIsOpen('Transform')).toBe(true);

  await editor.closePanels();
  await editor.addObject('Tiles');
  expect(await editor.sectionIsOpen('Brush')).toBe(true);

  await editor.panel('inspect').getByRole('button', { name: 'Collapse all sections' }).click();
  expect(await editor.sectionIsOpen('Brush')).toBe(false);
  expect(await editor.sectionIsOpen('Transform')).toBe(false);
});

/**
 * The invariant the whole architecture rests on: this is editor state, so it
 * must not reach the document.
 */
test('collapsing a section does not touch the saved file', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.toggleSection('Transform');
  await editor.setField('X', SCENE.width / 2);

  const before = (await editor.saveToFile()).contents;

  await editor.toggleSection('Transform');
  await editor.toggleSection('Arrange');

  const after = (await editor.saveToFile()).contents;
  expect(after).toBe(before);
});

test('a section head is a 44px touch target', async ({ editor, isMobile }) => {
  test.skip(!isMobile, 'the thumb-sized claim is about the phone layout');

  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');

  const box = await editor.sectionHead('Transform').boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

// -- summaries on collapsed heads ------------------------------------------

/** What a collapsed head says about its section, or nothing while it is open. */
const summaryOf = (editor: EditorPage, title: string) =>
  editor.sectionHead(title).locator('.section__summary');

/** Closes the validation report, which floats over the mobile tab bar. */
async function dismissReport(editor: EditorPage): Promise<void> {
  const dismiss = editor.page.getByRole('button', { name: 'Dismiss validation issues' });
  if ((await dismiss.count()) > 0) await dismiss.click();
}

/** Presses a toolbar button by its accessible name, with every sheet closed. */
async function toolbar(editor: EditorPage, name: 'Undo' | 'Redo'): Promise<void> {
  await editor.closePanels();
  await editor.page.getByRole('button', { name, exact: true }).click();
  await editor.settle();
  await editor.openPanel('inspect');
}

test('a collapsed head says what its section holds, and follows undo and redo', async ({
  editor,
}) => {
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');

  await expect(summaryOf(editor, 'Physics')).toHaveText('Off');
  await expect(summaryOf(editor, 'Physics')).toHaveClass(/section__summary--default/);

  // Open, the fields say it and the head does not: a summary that changed as
  // the fields under it were edited would move every control below the head.
  await editor.toggleSection('Physics');
  await expect(summaryOf(editor, 'Physics')).toHaveCount(0);
  await editor.setPhysics(true);
  await editor.toggleSection('Physics');

  await expect(summaryOf(editor, 'Physics')).toContainText('Dynamic · box');
  await expect(summaryOf(editor, 'Physics')).toHaveClass(/section__summary--configured/);

  await toolbar(editor, 'Undo');
  await expect(summaryOf(editor, 'Physics')).toHaveText('Off');
  await toolbar(editor, 'Redo');
  await expect(summaryOf(editor, 'Physics')).toContainText('Dynamic · box');
});

test('a summary follows the selection to another object', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.toggleSection('Physics');
  await editor.setPhysics(true);
  await editor.toggleSection('Physics');
  await editor.closePanels();
  await editor.addObject('Ellipse');
  await editor.openPanel('inspect');

  await expect(summaryOf(editor, 'Physics')).toHaveText('Off');

  await editor.selectInTree('Rectangle');
  await editor.openPanel('inspect');
  await expect(summaryOf(editor, 'Physics')).toContainText('Dynamic · box');
});

test('the effects head lists what is drawn over the object', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');
  await expect(summaryOf(editor, 'Effects')).toHaveText('None');

  await editor.toggleSection('Effects');
  await editor.panel('inspect').getByRole('button', { name: '+ Add an effect' }).click();
  await editor.settle();
  await editor.toggleSection('Effects');

  await expect(summaryOf(editor, 'Effects')).toContainText('Glow');
});

/**
 * The name stays the title, and the summary is the description.
 *
 * The mobile tab bar and every exact-name locator in the suite depend on the
 * first half; a screen reader hearing "Physics, Configured: Dynamic · box"
 * rather than only "Physics" is the second.
 */
test('a head is named by its title and described by its summary', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.toggleSection('Physics');
  await editor.setPhysics(true);
  await editor.toggleSection('Physics');

  const head = editor.panel('inspect').getByRole('button', { name: 'Physics', exact: true });
  await expect(head).toHaveCount(1);
  await expect(head).toHaveAccessibleDescription('Configured: Dynamic · box');
});

test('a selection that disagrees says so rather than picking one answer', async ({ editor }) => {
  await editor.addObject('Rectangle');
  await editor.closePanels();
  await editor.addObject('Ellipse');
  await editor.panel('scene').getByRole('button', { name: 'Hide Ellipse', exact: true }).click();
  await editor.settle();

  await editor.setMultiSelect(true);
  await editor.selectInTree('Rectangle');
  await editor.setMultiSelect(false);
  await editor.openPanel('inspect');

  await expect(summaryOf(editor, 'Selection')).toContainText('1 of 2 hidden');
  await expect(summaryOf(editor, 'Selection')).toHaveClass(/section__summary--mixed/);
  await expect(summaryOf(editor, 'Objects')).toContainText('Rectangle, Ellipse');
});

test('an unfinished object warns on the head of the section that fixes it', async ({ editor }) => {
  await editor.addObject('Image');
  await editor.openPanel('inspect');

  // Validation's own message, not a second wording of it: the head reports the
  // issue Play and export report.
  await expect(summaryOf(editor, 'Image')).toContainText('No image asset is selected.');
  await expect(summaryOf(editor, 'Image')).toHaveClass(/section__summary--warning/);
});

/**
 * The broken case, and the path from the report to the field.
 *
 * A dangling image is a file the editor cannot write, so it is written by hand;
 * Play refuses it and lists the issue, and pressing the issue has to land on
 * the section that holds the image picker — which, before issues named real
 * section titles, it opened nothing at all.
 */
test('a broken reference marks its head, and the issue opens that section', async ({
  editor,
}, testInfo) => {
  await editor.addObject('Image');
  const saved = JSON.parse((await editor.saveToFile()).contents);
  // Saving reports the image-less sprite as a warning, and the report sits
  // over the mobile tab bar.
  await dismissReport(editor);
  const scene = saved.scenes.find((entry: { id: string }) => entry.id === saved.activeSceneId);
  const sprite = scene.children.find((node: { type: string }) => node.type === 'sprite');
  sprite.props.assetId = 'gone';
  const path = testInfo.outputPath('dangling.phaser.json');
  await fs.writeFile(path, JSON.stringify(saved), 'utf8');

  await editor.openFile(path);
  await editor.selectInTree('Sprite');
  await editor.openPanel('inspect');
  await expect(summaryOf(editor, 'Image')).toContainText('Asset reference "gone" is missing.');
  await expect(summaryOf(editor, 'Image')).toHaveClass(/section__summary--invalid/);

  await editor.deselect();
  await editor.closePanels();
  await editor.page.getByRole('button', { name: 'Play game' }).click();
  const report = editor.page.getByRole('complementary', { name: 'Validation issues' });
  await report.getByRole('button', { name: /Asset reference "gone" is missing/ }).click();
  await editor.settle();
  await dismissReport(editor);

  await editor.openPanel('inspect');
  expect(await editor.sectionIsOpen('Image')).toBe(true);
  // Revealed, not merely opened: the head the issue named is the one on screen.
  await expect(editor.sectionHead('Image')).toBeInViewport();
});

test('a long summary never grows the head or the panel', async ({ editor }) => {
  await editor.addObject('Text');
  await editor.toggleSection('Text');
  await editor.setField('Content', 'A caption far too long for any head to hold on one line');
  await editor.toggleSection('Text');

  await expect(summaryOf(editor, 'Text')).toContainText('“A caption far too long');
  const box = await editor.sectionHead('Text').boundingBox();
  expect(box?.height ?? 0).toBeLessThanOrEqual(46);

  const panel = editor.panel('inspect').locator('.panel').first();
  const overflow = await panel.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
