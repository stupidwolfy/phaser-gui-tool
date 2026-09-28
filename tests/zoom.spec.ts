import type { Page } from '@playwright/test';
import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';

/**
 * The editor's own zoom: the bar over the canvas, its keys, and what it never
 * touches.
 *
 * The instrument is a rectangle's drawn *extent*, because what a zoom changes is
 * how big something is drawn — a centroid would say nothing — and the claim
 * that a step "keeps the point of interest" is the same box's centre holding
 * still. Every reading is a ratio against the fitted view, since the two
 * projects fit at different zooms.
 */

/** `createNode`'s rectangle fill, and a fixture colour nothing else draws. */
const FILL = '#4f8cff';
const WIDTH = 160;

/** Extents agree with CSS-pixel arithmetic to a couple of pixels. */
const NEAR = 3;

/** `OVERLAY_BAND` in the page object: what `shot` crops off the canvas. */
const BAND = 130;

function percent(page: Page) {
  return page.getByTestId('zoom-percent');
}

async function readPercent(page: Page): Promise<number> {
  return Number((await percent(page).textContent())?.replace('%', ''));
}

function zoomButton(page: Page, name: string) {
  return page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name, exact: true });
}

/** One rectangle at the scene's centre, deselected so no outline touches it. */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.deselect();
}

async function drawnWidth(editor: EditorPage) {
  const box = await editor.findDrawnBox(FILL);
  expect(box.count).toBeGreaterThan(0);
  return box;
}

test('the bar shows the fitted zoom, and steps through the ladder about the centre', async ({
  editor,
  page,
}) => {
  await setup(editor);
  const fitted = await editor.zoom();
  await expect(percent(page)).toHaveText(`${Math.round(fitted * 100)}%`);

  const before = await drawnWidth(editor);
  expect(Math.abs(before.width - WIDTH * fitted)).toBeLessThan(NEAR);
  const centre = { x: before.x + before.width / 2, y: before.y + before.height / 2 };

  // One stop in is the first stop above the fitted zoom, whatever that was.
  await zoomButton(page, 'Zoom in').click();
  const stepped = await readPercent(page);
  expect(stepped).toBeGreaterThan(Math.round(fitted * 100));
  const after = await drawnWidth(editor);
  expect(Math.abs(after.width - WIDTH * (stepped / 100))).toBeLessThan(NEAR);
  // About the middle of the view: what the user was looking at stays put.
  expect(Math.abs(after.x + after.width / 2 - centre.x)).toBeLessThan(NEAR);
  expect(Math.abs(after.y + after.height / 2 - centre.y)).toBeLessThan(NEAR);

  await zoomButton(page, 'Zoom out').click();
  await zoomButton(page, 'Zoom out').click();
  expect(await readPercent(page)).toBeLessThan(Math.round(fitted * 100));

  // 100% is one scene unit per screen pixel — reachable in one press.
  await zoomButton(page, 'Reset zoom to 100%').click();
  await expect(percent(page)).toHaveText('100%');
  expect(Math.abs((await drawnWidth(editor)).width - WIDTH)).toBeLessThan(NEAR);

  await zoomButton(page, 'Fit scene to view').click();
  await expect(percent(page)).toHaveText(`${Math.round(fitted * 100)}%`);
  expect(Math.abs((await drawnWidth(editor)).width - WIDTH * fitted)).toBeLessThan(NEAR);
});

test('the limits are reachable without a precision gesture, and disable their button', async ({
  editor,
  page,
}) => {
  await setup(editor);

  const out = zoomButton(page, 'Zoom out');
  for (let guard = 0; guard < 20 && (await out.isEnabled()); guard += 1) await out.click();
  await expect(percent(page)).toHaveText('10%');
  await expect(out).toBeDisabled();

  const into = zoomButton(page, 'Zoom in');
  for (let guard = 0; guard < 20 && (await into.isEnabled()); guard += 1) await into.click();
  await expect(percent(page)).toHaveText('400%');
  await expect(into).toBeDisabled();
  await expect(out).toBeEnabled();
});

test('the keys zoom, and are the field’s own while typing', async ({ editor, page }) => {
  await setup(editor);
  const fitted = Math.round((await editor.zoom()) * 100);

  await page.keyboard.press('Equal');
  expect(await readPercent(page)).toBeGreaterThan(fitted);
  await page.keyboard.press('Digit0');
  await expect(percent(page)).toHaveText('100%');
  await page.keyboard.press('Minus');
  expect(await readPercent(page)).toBeLessThan(100);
  await page.keyboard.press('Shift+Digit1');
  await expect(percent(page)).toHaveText(`${fitted}%`);

  // A minus sign typed into a number is a minus sign.
  await editor.addObject('Rectangle');
  await editor.openPanel('inspect');
  const field = editor.field('X');
  await field.focus();
  const typing = await readPercent(page);
  await field.press('Minus');
  await field.press('Equal');
  await field.press('Digit0');
  expect(await readPercent(page)).toBe(typing);
  await field.blur();
});

test('a wheel zoom shows up on the bar', async ({ editor, page, isMobile }) => {
  test.skip(isMobile, 'no wheel on a phone; a pinch goes through the same publish');
  await setup(editor);
  const fitted = await editor.zoom();
  const box = await editor.canvasBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.wheel(0, -100);
  await expect.poll(() => readPercent(page)).toBe(Math.round(fitted * 1.1 * 100));
});

test('the view is not the document: the game camera and the saved bytes stay put', async ({
  editor,
  page,
}) => {
  await setup(editor);
  // A game camera at 2x is drawn as a frame, and must not move the view.
  await editor.setCamera({ zoom: 2 });
  await editor.closePanels();
  await expect(percent(page)).toHaveText(`${Math.round((await editor.zoom()) * 100)}%`);

  const saved = await editor.saveToFile();
  await editor.closePanels();
  await zoomButton(page, 'Zoom in').click();
  await zoomButton(page, 'Zoom in').click();
  await page.keyboard.press('Digit0');
  const again = await editor.saveToFile();
  expect(again.contents).toBe(saved.contents);
  const project = JSON.parse(again.contents) as { scenes: Array<{ camera?: { zoom?: number } }> };
  expect(project.scenes[0].camera?.zoom).toBe(2);
});

test('the bar stays in the band the canvas readings crop, clear of the move bar', async ({
  editor,
  page,
  isMobile,
}) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.closePanels();

  const canvas = await editor.canvasBox();
  const bar = await page.getByRole('group', { name: 'Zoom' }).boundingBox();
  expect(bar).not.toBeNull();
  expect(bar!.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - BAND);
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  expect(bar!.x + bar!.width).toBeLessThanOrEqual(canvas.x + canvas.width);

  if (isMobile) {
    // A selection puts the move bar up; the two share the band and must not touch.
    const move = await page.locator('.movebar').boundingBox();
    expect(move).not.toBeNull();
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(move!.y);
  }
});
