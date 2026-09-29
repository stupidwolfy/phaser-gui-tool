import { execFile } from 'node:child_process';
import { promises as fs, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { unzipSync, strFromU8 } from 'fflate';
import { expect, test } from './helpers/fixtures';
import { hostileProject } from './helpers/hostile';
import { findColor } from './helpers/pixels';
import { serveDirectory } from './helpers/server';
import { newProject } from '../src/core/defaults';
import { ProjectValidationError } from '../src/core/validation';
import { decodeAsset } from '../src/io/fileIO';
import {
  BUNDLE_TYPESCRIPT_VERSION,
  BUNDLE_VITE_VERSION,
  bundleNameOf,
  createExportBundle,
} from '../src/io/exportBundle';
import { generateRunnableHtml, generateScene } from '../src/io/exportPhaser';

/**
 * The export bundle: a Vite project in a ZIP, with the scenes as source and
 * every asset they use as a real file.
 *
 * The claims split three ways. The dialog is driven through the UI on both
 * projects. What the archive holds — each asset once, at a safe path, no data
 * URL left in the source, the same bytes on every press — is asserted straight
 * from the builder, where a hostile project can be handed in without a file
 * dialog. And the one claim that matters most, that the bundle builds with its
 * own documented commands and boots, is a real `tsc` and `vite build` over the
 * extracted folder, served from a sub-path the way a deploy would be.
 */

const run = promisify(execFile);
const compile = (args: string[], cwd: string) =>
  run('npx', ['--no-install', ...args], { cwd, timeout: 180_000 });

const RECT_FILL = '#4f8cff';

/** Shells out to compilers, so one at a time — `export-toolchain.spec.ts`' reason. */
test.describe.configure({ mode: 'default', timeout: 300_000 });

const unzip = (bytes: Uint8Array) => unzipSync(bytes);

test('the preflight names what the bundle holds, and the download matches it', async ({
  editor,
  page,
}) => {
  const dialog = await editor.openBundleDialog();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByLabel('Folder name', { exact: true })).toBeFocused();
  await expect(dialog.getByTestId('bundle-size')).toHaveText(/\d+(\.\d)? (B|KB|MB)/);

  // The panel fits the viewport, phone included.
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x + box.width <= viewport.width + 1).toBe(true);

  // The file list in the dialog is the archive's, entry for entry.
  await dialog.locator('.bundle__files summary').click();
  const listed = await dialog
    .getByRole('list', { name: 'Bundle files' })
    .locator('code')
    .allTextContents();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const { name, bytes } = await editor.exportBundle({ name: 'My Game!', language: 'js' });
  expect(name).toBe('my-game.zip');
  const files = unzip(bytes);
  const paths = Object.keys(files);
  expect(paths.every((path) => path.startsWith('my-game/'))).toBe(true);
  expect(paths).toContain('my-game/src/main.js');
  expect(paths).toContain('my-game/src/scenes.js');
  expect(paths).not.toContain('my-game/tsconfig.json');
  // The list read above was TypeScript, the download JavaScript: same shape,
  // one extension apart, and nothing else.
  expect(listed.map((path) => path.replace(/\.ts$/, '.js')).filter((p) => p !== 'tsconfig.json'))
    .toEqual(paths.map((path) => path.slice('my-game/'.length)));

  const pkg = JSON.parse(strFromU8(files['my-game/package.json']));
  expect(pkg.name).toBe('my-game');
  expect(pkg.scripts).toMatchObject({ dev: 'vite', build: 'vite build' });
  expect(pkg.devDependencies).toEqual({ vite: BUNDLE_VITE_VERSION });
});

test('Escape closes the preflight and nothing else', async ({ editor, page }) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Kept');
  await editor.closePanels();

  const dialog = await editor.openBundleDialog();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await editor.closePanels();
  await editor.openPanel('inspect');
  await expect(editor.field('Name')).toHaveValue('Kept');
});

test('every asset is in the bundle once, at a safe path, with its own bytes', () => {
  const project = hostileProject();
  const bundle = createExportBundle(project, { name: '../</script> Hostile', language: 'ts' });
  expect(bundle.name).toBe('script-hostile');

  const safe = /^script-hostile\/[A-Za-z0-9_.\-/]+$/;
  for (const file of bundle.files) {
    expect(file.path).toMatch(safe);
    expect(file.path.split('/')).not.toContain('..');
  }

  const scenes = strFromU8(
    bundle.files.find((file) => file.path.endsWith('src/scenes.ts'))!.bytes,
  );
  // No embedded bytes are left in the source: every table row is a path.
  // (A quoted data URL — the tilemap helper has a parameter called `data`.)
  expect(scenes).not.toMatch(/"data:/);

  const assets = bundle.files.filter((file) => file.path.includes('/public/assets/'));
  const every = [...project.assets, ...project.audio, ...project.fonts];
  for (const file of assets) {
    const relative = file.path.slice('script-hostile/public/'.length);
    // The source names it...
    expect(scenes).toContain(JSON.stringify(relative));
    // ...and it is the decoded bytes of exactly one asset in the document.
    const matches = every.filter((asset) =>
      Buffer.from(decodeAsset(asset.dataUrl, asset.mimeType)).equals(Buffer.from(file.bytes)),
    );
    expect(matches.length).toBeGreaterThan(0);
  }
  // Only what some scene uses: two of the three sounds are registered, and the
  // third ("unused.wav") ships nowhere.
  expect(bundle.counts.audio).toBe(2);
  expect(assets.filter((file) => file.path.includes('/audio/'))).toHaveLength(2);
  expect(new Set(assets.map((file) => file.path)).size).toBe(assets.length);
  expect(bundle.counts).toEqual({
    images: assets.filter((file) => file.path.includes('/images/')).length,
    audio: 2,
    fonts: assets.filter((file) => file.path.includes('/fonts/')).length,
  });
});

test('the same project exports the same bytes every time', () => {
  const project = hostileProject();
  const first = createExportBundle(project, { name: 'same', language: 'ts' }).zip;
  const second = createExportBundle(project, { name: 'same', language: 'ts' }).zip;
  expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
});

test('a project with a blocking error is refused, and the other exports are unchanged', () => {
  const project = newProject();
  project.scenes[0].width = Number.NaN;
  expect(() => createExportBundle(project, { name: 'x', language: 'ts' })).toThrow(
    ProjectValidationError,
  );

  // The option is additive: omitted, the module is what it always was.
  const hostile = hostileProject();
  expect(generateScene(hostile, 'ts', {})).toBe(generateScene(hostile, 'ts'));
  expect(generateScene(hostile, 'ts')).toContain('data:image/png;base64,');
  // And the runnable page still boots through the shared game config — WebGL,
  // because the hostile project asks for it in its settings.
  expect(generateRunnableHtml(hostile)).toContain('new Phaser.Game({\n        type: Phaser.WEBGL,');
});

test('the bundle asks for the toolchain this editor is built with', () => {
  const own = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  expect(BUNDLE_VITE_VERSION).toBe(own.devDependencies.vite);
  expect(BUNDLE_TYPESCRIPT_VERSION).toBe(own.devDependencies.typescript);
  expect(bundleNameOf('   ')).toBe('phaser-game');
});

for (const language of ['ts', 'js'] as const) {
  test(`a hostile ${language} bundle builds with its own commands and boots from a sub-path`, async ({
    page,
  }, testInfo) => {
    const bundle = createExportBundle(hostileProject(), { name: 'game', language });
    const root = testInfo.outputPath('extract');
    for (const file of bundle.files) {
      const path = join(root, file.path);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, file.bytes);
    }
    const project = join(root, 'game');
    // `npm install` stands in as the repository's own node_modules: the bundle
    // pins the same Phaser and Vite, and CI has no registry to install from.
    await fs.symlink(join(process.cwd(), 'node_modules'), join(project, 'node_modules'), 'dir');

    // The README's build step, verbatim from package.json.
    const pkg = JSON.parse(await fs.readFile(join(project, 'package.json'), 'utf8'));
    if (language === 'ts') {
      expect(pkg.scripts.build).toBe('tsc --noEmit && vite build');
      await compile(['tsc', '--noEmit', '-p', '.'], project);
    } else {
      expect(pkg.scripts.build).toBe('vite build');
    }
    await compile(['vite', 'build', '--logLevel', 'warn'], project);

    // Served from a sub-folder, because a relative base is the claim: a
    // rooted asset path would 404 here and nowhere else.
    const site = testInfo.outputPath('site');
    await fs.mkdir(site, { recursive: true });
    await fs.cp(join(project, 'dist'), join(site, 'play'), { recursive: true });
    for (const file of bundle.files.filter((entry) => entry.path.includes('/public/assets/'))) {
      const built = join(site, 'play', file.path.slice('game/public/'.length));
      expect(Buffer.from(await fs.readFile(built)).equals(Buffer.from(file.bytes))).toBe(true);
    }

    const server = await serveDirectory(site);
    const game = await page.context().newPage();
    const errors: string[] = [];
    game.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    game.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));
    const missing: string[] = [];
    game.on('response', (response) => {
      if (response.status() >= 400) missing.push(response.url());
    });

    await game.goto(`${server.origin}/play/`);
    await expect(game.locator('canvas')).toBeVisible();
    await expect
      .poll(async () => (await findColor(game, await game.locator('canvas').screenshot(), RECT_FILL)).count)
      .toBeGreaterThan(100);
    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await game.evaluate(() => (window as unknown as { __pwned?: string }).__pwned),
    ).toBeUndefined();

    await game.close();
    await server.close();
  });
}
