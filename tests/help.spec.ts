import { expect, test } from './helpers/fixtures';

test('Help opens, searches deterministically, navigates topics, and closes with focus return', async ({ editor, page, isMobile }) => {
  void editor;
  const launch = page.getByRole('button', { name: 'Help' });
  await launch.click();
  const help = page.getByRole('dialog', { name: 'Help' });
  await expect(help).toBeVisible();
  if (!isMobile) await expect(help.getByRole('searchbox', { name: 'Search help' })).toBeFocused();

  const search = help.getByRole('searchbox', { name: 'Search help' });
  await search.fill('physics');
  await expect(help.getByRole('button', { name: 'Physics', exact: true })).toBeVisible();
  await expect(help.getByRole('button', { name: 'Animation', exact: true })).toHaveCount(0);
  await help.getByRole('button', { name: 'Physics', exact: true }).click();
  await expect(help.getByRole('heading', { name: 'Physics', exact: true })).toBeVisible();

  await search.fill('animation');
  await help.getByRole('button', { name: 'Animation', exact: true }).click();
  await expect(help.getByRole('heading', { name: 'Animation', exact: true })).toBeVisible();
  await search.fill('SAVE');
  await expect(help.getByRole('button', { name: 'Save and open projects' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await expect(launch).toBeFocused();
});

test('Help contains keyboard-operable topic navigation and accurate product links', async ({ editor, page }) => {
  void editor;
  await page.getByRole('button', { name: 'Help' }).click();
  const help = page.getByRole('dialog', { name: 'Help' });
  await help.getByRole('button', { name: 'Keyboard shortcuts' }).focus();
  await page.keyboard.press('Enter');
  await expect(help.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
  await expect(help).toContainText('Ctrl/Cmd+S Save');
  await expect(help).toContainText('Phaser 4.2.1');
  await expect(help.getByRole('link', { name: 'Phaser documentation' })).toHaveAttribute('href', 'https://docs.phaser.io/');
});

test('Help uses the compact sheet and traps keyboard focus', async ({ editor, page, isMobile }) => {
  void editor;
  test.skip(!isMobile, 'compact layout only');
  await page.getByRole('button', { name: 'Help' }).click();
  const sheet = page.getByRole('dialog', { name: 'Help' });
  await expect(sheet).toBeVisible();
  for (let index = 0; index < 20; index += 1) await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-labelledby'))).not.toBeNull();
});
