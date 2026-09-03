import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './helpers/fixtures';
import { findColor } from './helpers/pixels';
import { serveDirectory } from './helpers/server';
import { hostileProject } from './helpers/hostile';

/**
 * Code export, verified by *running the exported page* rather than by reading
 * it. The generated file is the product here; a snapshot of its text would go
 * green on output that does not boot.
 */

const PHASER_DIST = 'node_modules/phaser/dist/phaser.min.js';
const RECT_FILL = '#4f8cff';
const ELLIPSE_FILL = '#ffb84f';
/** The fill of the rectangle nested in the hostile project's group. */
const NESTED_FILL = '#22d3ee';
/** The fill of the rectangle inside the hostile project's prefab. */
const PREFAB_FILL = '#7ee787';

interface Run {
  page: Page;
  errors: string[];
  /** How many times the page asked the CDN for Phaser. */
  cdnRequests: number;
  close: () => Promise<void>;
}

/**
 * Serves an exported page and opens it, with the CDN request answered from
 * `node_modules` so the test neither depends on the network nor on jsDelivr
 * happening to have the version the project asked for.
 */
async function runExportedPage(
  context: BrowserContext,
  directory: string,
  html: string,
): Promise<Run> {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(join(directory, 'index.html'), html, 'utf8');
  const server = await serveDirectory(directory);

  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));

  let cdnRequests = 0;
  await page.route('https://cdn.jsdelivr.net/**', async (route) => {
    cdnRequests += 1;
    await route.fulfill({ path: PHASER_DIST, contentType: 'text/javascript' });
  });

  await page.goto(server.origin);
  await expect(page.locator('canvas')).toBeVisible();
  // One frame of the exported scene, so its objects are on the canvas.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

  return {
    page,
    errors,
    get cdnRequests() {
      return cdnRequests;
    },
    close: async () => {
      await page.close();
      await server.close();
    },
  };
}

test('the runnable page boots Phaser and draws the scene', async ({
  editor,
  page,
}, testInfo) => {
  const exported = await editor.exportCode('html');
  expect(exported.name).toBe('MainScene.html');

  const run = await runExportedPage(page.context(), testInfo.outputPath('runnable'), exported.contents);

  expect(run.cdnRequests, 'the page did not load Phaser from the pinned CDN URL').toBe(1);
  expect(await run.page.evaluate(() => typeof (window as unknown as { Phaser?: unknown }).Phaser))
    .toBe('object');

  const shot = await run.page.locator('canvas').screenshot();
  expect((await findColor(run.page, shot, RECT_FILL)).count).toBeGreaterThan(100);
  expect((await findColor(run.page, shot, ELLIPSE_FILL)).count).toBeGreaterThan(100);
  expect(run.errors).toEqual([]);

  await run.close();
});

test('an export of a hostile project runs, and injects nothing', async ({
  editor,
  page,
}, testInfo) => {
  const path = testInfo.outputPath('hostile.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('html');

  // The generated script must not end early. Two closing tags — the CDN script
  // and the scene script — and no third one hiding inside a string literal.
  expect(exported.contents.split('</script>')).toHaveLength(3);

  // Guides are editor furniture, not scene content, and the exporter reads the
  // scene's fields by name rather than enumerating them — so nothing about them
  // reaches the output today. This pins that: the failure it guards against is
  // silent in both directions, an exporter that starts emitting the editor's
  // own overlay into somebody's game.
  expect(exported.contents).not.toContain('guide-1');
  expect(exported.contents).not.toContain('guides');

  const run = await runExportedPage(page.context(), testInfo.outputPath('hostile'), exported.contents);

  expect(
    await run.page.evaluate(() => (window as unknown as { __pwned?: string }).__pwned),
  ).toBeUndefined();
  expect(await run.page.locator('script').count()).toBe(2);
  expect(await run.page.locator('img').count()).toBe(0);

  // It still runs, and the objects are still there: escaping the content is
  // not allowed to cost the export its meaning.
  const shot = await run.page.locator('canvas').screenshot();
  expect((await findColor(run.page, shot, RECT_FILL)).count).toBeGreaterThan(100);
  // Including the one inside a group, which reaches the canvas only if the
  // nested emit and its `add([...])` both came out right.
  expect((await findColor(run.page, shot, NESTED_FILL)).count).toBeGreaterThan(100);
  // And the prefab's, twice over: two instances of one definition, so this is
  // also the assertion that the factory was emitted once and called twice with
  // both calls landing.
  expect((await findColor(run.page, shot, PREFAB_FILL)).count).toBeGreaterThan(200);
  expect(run.errors).toEqual([]);

  await run.close();
});

test('a prefab exports as one factory function, called once per instance', async ({
  editor,
}, testInfo) => {
  const path = testInfo.outputPath('hostile.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('ts');

  const declarations = exported.contents.match(/^function create\w*\(/gm) ?? [];
  expect(declarations).toHaveLength(1);
  const fn = (declarations[0] ?? '').slice('function '.length, -1);
  // Two placements, one definition: the whole reason a factory is emitted at
  // all rather than the instance being expanded inline.
  expect(exported.contents.split(`${fn}(this, `)).toHaveLength(3);
  // Annotated, because the exported .ts is compiled under --strict and bare
  // parameters would be three implicit anys. `export-toolchain.spec` is what
  // actually proves that; this says why the annotations are there.
  expect(exported.contents).toContain(`function ${fn}(scene: Phaser.Scene, x: number, y: number)`);
  // Inside the body the receiver is the scene it was handed, never `this`.
  expect(exported.contents.slice(exported.contents.indexOf(`function ${fn}(`)))
    .not.toMatch(/^ {2}const \w+ = this\./m);

  // The sprite inside the definition proves the asset collection descends into
  // prefab bodies: without that this exports the "no image chosen" stand-in for
  // an image that is chosen, and the page still boots.
  expect(exported.contents).not.toContain('no image chosen in the editor');

  // A dangling instance is called out rather than silently dropped, the same
  // way a sprite with no image is.
  expect(exported.contents).toContain('the prefab it placed is no longer in the project');
});

test('a group exports as a container its children are added to', async ({ editor }) => {
  await editor.addObject('Rectangle');
  // Not one of the starter project's names: the exporter de-duplicates
  // identifiers, and a collision would rename the very thing being asserted.
  await editor.setField('Name', 'Widget');
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Wrap in a new group' }).click();
  await editor.settle();

  const exported = await editor.exportCode('ts');
  expect(exported.contents).toContain('this.add.container(');
  // The group is built before its children and they are added to it after, so
  // the reader gets one binding per object rather than a nested literal.
  expect(exported.contents).toMatch(/const widgetGroup = this\.add\.container\(/);
  expect(exported.contents).toMatch(/widgetGroup\.add\(\[widget\]\);/);
});

test('a sprite with no image is called out rather than dropped', async ({ editor }) => {
  await editor.addObject('Image');
  const exported = await editor.exportCode('ts');
  expect(exported.contents).toContain('no image chosen in the editor');
});
