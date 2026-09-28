import { readFileSync } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { TARGET_PHASER_VERSION } from '../src/core/schema';
import { SHORTCUTS } from '../src/ui/helpContent';

/**
 * The Help dialog: reachable in one press at every width, searchable, linked
 * from the sections and the validation rows it explains, and closed without
 * disturbing anything behind it.
 *
 * The toolbar's Help is reached by its exact name. A section's link is named
 * `Help: <title>`, so a bare "Help" matches exactly one control; that is what
 * the first test proves by clicking it with strict mode on.
 */

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

test('Help opens in one press, closes with Escape and returns focus', async ({ editor, page }) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Kept');
  await editor.closePanels();

  const launcher = page.getByRole('button', { name: 'Help', exact: true });
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('searchbox', { name: 'Search help' })).toBeFocused();

  // Focus stays inside while it is open.
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();

  // Escape closed Help and nothing else: the selection behind it survived.
  await editor.openPanel('inspect');
  await expect(editor.field('Name')).toHaveValue('Kept');
});

test('the ? key opens Help, but not while typing', async ({ editor, page }) => {
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');
  const name = editor.field('Name');
  await name.focus();
  await page.keyboard.type('?');
  await expect(name).toHaveValue(/\?$/);
  await expect(page.getByRole('dialog', { name: 'Help' })).toBeHidden();

  await editor.closePanels();
  await editor.deselect();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Help' })).toBeVisible();
});

test('searching a task finds a topic that says how', async ({ editor, page }) => {
  void editor;
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  const search = dialog.getByRole('searchbox', { name: 'Search help' });
  const results = dialog.getByRole('list', { name: 'Help topics' }).getByRole('button');

  const cases: [string, string][] = [
    ['save', 'Saving and opening files'],
    ['physics', 'Physics, collisions and controls'],
    ['animation', 'Images, animation, sound and fonts'],
    ['undo', 'Keyboard shortcuts'],
  ];
  for (const [term, title] of cases) {
    await search.fill(term);
    await expect(results.first()).toHaveText(title);
  }

  await search.fill('physics');
  await results.first().click();
  await expect(dialog.getByRole('heading', { name: 'Physics, collisions and controls' })).toBeVisible();
  await dialog.getByRole('button', { name: 'All topics' }).click();
  await expect(search).toBeFocused();

  await search.fill('zzzzqqq');
  await expect(dialog.getByRole('status')).toContainText('Nothing matches');
});

test('a section links to its own topic', async ({ editor, page }) => {
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');
  const link = editor.panel('inspect').getByRole('button', { name: 'Help: Physics', exact: true });
  await link.click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await expect(dialog.getByRole('heading', { name: 'Physics, collisions and controls' })).toBeVisible();
  // The head keeps its own name, so exact-name locators for it are unchanged.
  await expect(editor.sectionHead('Physics')).toHaveAttribute('aria-label', 'Physics');

  await dialog.getByRole('button', { name: 'Close help' }).click();
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
});

test('a validation row links to the topic that explains it', async ({ editor, page }) => {
  // An emitter with no image is a warning under the Particles section.
  await editor.clearScene();
  await editor.addObject('Particles');
  await editor.deselect();
  await editor.saveToFile();
  await editor.closePanels();

  const report = page.getByRole('complementary', { name: 'Validation issues' });
  await report.getByRole('button', { name: 'Help for config.asset-unset' }).click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await expect(dialog.getByRole('heading', { name: 'Particles and tweens' })).toBeVisible();
});

test('the shortcut table lists every key the editor answers', async ({ editor, page }) => {
  void editor;
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await dialog.getByRole('searchbox', { name: 'Search help' }).fill('shortcuts');
  await dialog.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  const rows = dialog.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(SHORTCUTS.length);
  for (const [index, row] of SHORTCUTS.entries()) {
    await expect(rows.nth(index)).toContainText(row.keys);
  }
  // A sample of the table, pressed: each one of these is a branch in App.tsx.
  for (const keys of ['?', 'Ctrl/Cmd + Z', '= or +', 'Shift + 1', 'Escape']) {
    expect(SHORTCUTS.some((row) => row.keys === keys)).toBe(true);
  }
});

test('the footer names the editor and Phaser versions', async ({ editor, page }) => {
  void editor;
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await expect(dialog).toContainText(`Phaser GUI Tool ${version}`);
  await expect(dialog).toContainText(`Phaser ${TARGET_PHASER_VERSION}`);
  await expect(dialog.getByRole('link', { name: 'Send feedback' })).toHaveAttribute('href', /\/issues$/);
});

test('Help fits a phone, and the toolbar still does', async ({ editor, page, isMobile }) => {
  void editor;
  test.skip(!isMobile, 'compact layout only');
  const viewport = page.viewportSize()!;
  const launcher = page.getByRole('button', { name: 'Help', exact: true });
  const save = page.getByRole('toolbar', { name: 'Project tools' }).getByRole('button', { name: 'Save' });
  for (const control of [launcher, save]) {
    const box = await control.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  }
  await launcher.click();
  const box = await page.getByRole('dialog', { name: 'Help' }).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
});
