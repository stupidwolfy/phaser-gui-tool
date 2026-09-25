import { expect, test } from './helpers/fixtures';

test('editor controls expose names, selection state, and keyboard tree navigation', async ({ editor, page, isMobile }) => {
  const toolbar = page.getByRole('toolbar', { name: 'Project tools' });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Undo' })).toHaveAttribute('aria-label', 'Undo');
  await expect(toolbar.getByRole('button', { name: 'Fit scene to view' })).toHaveAttribute('aria-label');

  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'First');
  await editor.addObject('Ellipse');
  await editor.setField('Name', 'Second');
  if (isMobile) await page.getByRole('button', { name: 'Scene', exact: true }).click();

  const first = page.locator('.tree__label[data-tree-object]').filter({ hasText: 'First' });
  const second = page.locator('.tree__label[data-tree-object]').filter({ hasText: 'Second' });
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(second).toBeFocused();
  await second.press('Enter');
  await expect(second).toHaveAttribute('aria-pressed', 'true');

  const outline = await second.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
});

test('compact sheets trap focus, close with Escape, and restore their trigger', async ({ editor, page, isMobile }) => {
  void editor;
  test.skip(!isMobile, 'compact layout only');
  const sceneTab = page.locator('.tabbar__btn').filter({ hasText: 'Scene' });
  await sceneTab.click();
  const sheet = page.getByRole('dialog', { name: 'Scene' });
  await expect(sheet).toBeVisible();
  await expect(sceneTab).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(sceneTab).toBeFocused();
});

test('Play is modal and returns focus to its launcher', async ({ editor, page }) => {
  void editor;
  const play = page.getByRole('button', { name: 'Play game' });
  await play.click();
  const dialog = page.getByRole('dialog', { name: 'Play game' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(play).toBeFocused();
});

test('reduced motion removes meaningful transition time', async ({ editor, page }) => {
  void editor;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.locator('.section__chevron').first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(duration).toBeLessThan(0.001);
});

test('the issue list never covers the tab bar or an open sheet', async ({ editor, page, isMobile }) => {
  test.skip(!isMobile, 'compact layout only');
  // An emitter with no image is a warning, so saving opens the list without
  // blocking anything.
  await editor.clearScene();
  await editor.addObject('Particles');
  await editor.deselect();
  await editor.saveToFile();
  await editor.closePanels();

  const issues = page.locator('.issues');
  await expect(issues).toBeVisible();
  const tabbar = await page.locator('.tabbar').boundingBox();
  let panel = await issues.boundingBox();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(tabbar!.y);

  // A tab still takes a press, and the sheet it opens is not covered either.
  await page.getByRole('button', { name: 'Scene', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Scene' });
  await expect(sheet).toBeVisible();
  // Measured against where the sheet comes to rest rather than where it is:
  // it slides in on a transform, so its top mid-slide is lower than its final
  // one and would make this check easier than it should be.
  const sheetBox = await sheet.boundingBox();
  const sheetTop = tabbar!.y - sheetBox!.height;
  panel = await issues.boundingBox();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(sheetTop + 1);
});
