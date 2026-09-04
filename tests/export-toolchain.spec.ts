import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';
import { hostileProject } from './helpers/hostile';
import { findColor } from './helpers/pixels';
import { serveDirectory } from './helpers/server';

/**
 * The other two export targets, checked with the toolchain a user would put
 * them through rather than by reading the text: `tsc --strict` against the real
 * Phaser types for the `.ts`, and a Vite bundle that actually boots for the
 * `.js`. That bundle is the literal "drop it into your Phaser project" path.
 */

const run = promisify(execFile);
const RECT_FILL = '#4f8cff';
const ELLIPSE_FILL = '#ffb84f';

/**
 * Both cases shell out to a compiler, so they run one at a time even though the
 * rest of the suite is fully parallel: two Vite builds and two `tsc` runs
 * competing with the browsers is how this file first went from ten seconds to a
 * four-minute timeout.
 */
test.describe.configure({ mode: 'default', timeout: 300_000 });

/**
 * `--no-install` so a resolution miss fails immediately instead of npx trying
 * to fetch the package, and a timeout so a hung compiler is reported as one.
 */
const compile = (args: string[]) =>
  run('npx', ['--no-install', ...args], { timeout: 180_000 });

/**
 * Both toolchain checks run twice: once over the starter project, and once over
 * a project whose every string is hostile. The hostile pass is what caught the
 * unescaped scene name reaching `super(...)`, and a compiler is a far better
 * reader of "is this still valid code" than any assertion about the text.
 */
const VARIANTS = ['starter', 'hostile'] as const;

async function load(
  editor: EditorPage,
  variant: (typeof VARIANTS)[number],
  path: string,
): Promise<void> {
  if (variant === 'starter') return;
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);
}

for (const variant of VARIANTS) {
  test(`the exported TypeScript compiles under --strict against the Phaser types (${variant})`, async ({
    editor,
  }, testInfo) => {
    await load(editor, variant, testInfo.outputPath('project.json'));
    const exported = await editor.exportCode('ts');

    // Inside the repo, so `import Phaser from 'phaser'` resolves to the very
    // types a consumer of this file would be compiling against.
    const directory = testInfo.outputPath('ts');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(join(directory, 'Scene.ts'), exported.contents, 'utf8');
    await fs.writeFile(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: [],
        },
        include: ['Scene.ts'],
      }),
      'utf8',
    );

    await compile(['tsc', '-p', join(directory, 'tsconfig.json')]);
  });

  test(`the exported JavaScript bundles with Vite and the bundle runs (${variant})`, async ({
    editor,
    page,
  }, testInfo) => {
    await load(editor, variant, testInfo.outputPath('project.json'));
    const exported = await editor.exportCode('js');

    const directory = testInfo.outputPath('js');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(join(directory, 'Scene.js'), exported.contents, 'utf8');
    await fs.writeFile(
      join(directory, 'main.js'),
      [
        "import Phaser from 'phaser';",
        "import Scene from './Scene.js';",
        '',
        'new Phaser.Game({',
        '  type: Phaser.AUTO,',
        '  width: 960,',
        '  height: 540,',
        "  parent: 'app',",
        // The one thing the exported module cannot do for itself, and the one
        // thing its header comment tells the reader to add. This harness is
        // that reader: without it `this.physics` is undefined and `create()`
        // throws on the first body, which is precisely the failure the note
        // exists to prevent — so following the note here is what proves the
        // note is sufficient.
        "  physics: { default: 'arcade' },",
        '  scene: Scene,',
        '});',
        '',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      join(directory, 'index.html'),
      '<!doctype html><html><body><div id="app"></div>' +
        '<script type="module" src="./main.js"></script></body></html>',
      'utf8',
    );

    // Relative base, because the bundle is served from the root of a throwaway
    // server rather than from a known path.
    // The root is positional, and it holds no vite.config, so the throwaway
    // build gets Vite's defaults rather than the editor's own config.
    await compile(['vite', 'build', directory, '--base', './', '--logLevel', 'warn']);

    // Over HTTP, not file://: browsers refuse ES modules from the filesystem,
    // which reads as a broken export and is not one.
    const server = await serveDirectory(join(directory, 'dist'));
    const bundled = await page.context().newPage();
    const errors: string[] = [];
    bundled.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    bundled.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));

    await bundled.goto(server.origin);
    await expect(bundled.locator('canvas')).toBeVisible();
    await bundled.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );

    const shot = await bundled.locator('canvas').screenshot();
    expect((await findColor(bundled, shot, RECT_FILL)).count).toBeGreaterThan(100);
    // The hostile project's ellipse fill is not a colour at all, so it falls back
    // to white rather than keeping the starter project's amber.
    const secondFill = variant === 'starter' ? ELLIPSE_FILL : '#ffffff';
    expect((await findColor(bundled, shot, secondFill)).count).toBeGreaterThan(100);
    expect(errors).toEqual([]);
    expect(
      await bundled.evaluate(() => (window as unknown as { __pwned?: string }).__pwned),
    ).toBeUndefined();

    await bundled.close();
    await server.close();
  });
}
