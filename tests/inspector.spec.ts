import { expect, test } from './helpers/fixtures';
import { SCENE } from './helpers/editor';

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
