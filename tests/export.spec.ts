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
  //
  // This is also where the audio path is actually proved, without a single
  // assertion about sound. The `sound.add` calls sit in the `create()`
  // prologue, above every object — so a key the scene failed to preload throws
  // there and *nothing below it is ever added*. Every colour assertion after
  // this line is therefore a check that the sounds loaded and registered.
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

  // The tilemap helper is a module-level `function create…` too, and is not
  // what this test is about — the fixture's map is what puts it in the file.
  const declarations = (exported.contents.match(/^function create\w*\(/gm) ?? []).filter(
    (declaration) => !declaration.includes('createTilemapLayer'),
  );
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
  //
  // Scoped to the factory body rather than the whole file, because the fixture
  // also holds an emitter with deliberately no image, whose own comment is the
  // correct output and would otherwise be read as this failure.
  const factory = exported.contents.slice(
    exported.contents.indexOf(`function ${fn}(`),
  );
  expect(factory.slice(0, factory.indexOf('\n}'))).not.toContain(
    'no image chosen in the editor',
  );

  // A dangling instance is called out rather than silently dropped, the same
  // way a sprite with no image is.
  expect(exported.contents).toContain('the prefab it placed is no longer in the project');
});

test('an emitter exports as one add.particles with its whole config', async ({
  editor,
}, testInfo) => {
  const path = testInfo.outputPath('hostile.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('ts');

  // An `add.*` rather than a helper call: an emitter is one expression, so it
  // does not need the route a tilemap and an instance had to take. One call,
  // because the fixture holds two emitters and only one has an image.
  expect(exported.contents.split('.add.particles(')).toHaveLength(2);

  // The config is emitted whole, defaults included, so the generated code says
  // exactly what the document says rather than half-hiding settings behind
  // Phaser defaults a reader cannot see.
  expect(exported.contents).toContain('lifespan: 750');
  expect(exported.contents).toContain('speed: { min: 30, max: 210 }');
  expect(exported.contents).toContain('scale: { start: 1.4, end: 0.2 }');
  expect(exported.contents).toContain('tint: 0xff8800');
  expect(exported.contents).toContain('blendMode: "ADD"');

  // The particle texture is one the scene actually preloads — without that the
  // emitter throws a texture that was never loaded.
  expect(exported.contents).toContain('this.load.spritesheet(');
});

test('a tilemap exports as one helper, a data table and one call per map', async ({
  editor,
}, testInfo) => {
  const path = testInfo.outputPath('hostile.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('ts');

  // One helper for the whole file, however many maps it holds — the property
  // that makes it a helper rather than three statements inlined per map.
  expect(exported.contents.match(/^function createTilemapLayer\(/gm) ?? []).toHaveLength(1);
  // Annotated, because the exported .ts is compiled under --strict; the
  // toolchain spec is what proves it, this says why the annotations exist.
  expect(exported.contents).toContain('scene: Phaser.Scene');
  expect(exported.contents).toContain('data: number[][]');

  // A named table rather than the rows inlined into the call, and row by row
  // rather than one flat run of numbers.
  expect(exported.contents).toContain('const TILEMAPS = {');
  expect(exported.contents).toContain('[0, -1, 2],');
  expect(exported.contents).toContain('[3, 0, -1],');

  // One call: the fixture holds two maps and only one of them has a tileset.
  expect(exported.contents.split('createTilemapLayer(this, ')).toHaveLength(2);
  // And the other is called out rather than silently dropped, the way a sprite
  // with no image and a dangling instance already are.
  expect(exported.contents).toContain('no tileset chosen in the editor');

  // The tileset is a texture the scene actually preloads. Without that the
  // helper throws on a tileset that was never loaded, and the page never draws.
  expect(exported.contents).toContain('this.load.spritesheet(');
});

test('two scenes named the same thing export as two classes with two keys', async ({
  editor,
}, testInfo) => {
  const path = testInfo.outputPath('hostile.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('ts');

  const classes = exported.contents.match(/^export class (\w+) extends Phaser\.Scene/gm) ?? [];
  expect(classes).toHaveLength(2);
  // Both halves of a scene name reach the output, and a repeat is fatal in
  // both: two identical class declarations will not parse, and two scenes
  // registered under one key has Phaser keep the first and lose the second.
  // `export-toolchain.spec` is what proves the first actually compiles; this
  // says why the de-duplication is there, and covers the key, which is a
  // string literal no compiler would object to.
  expect(new Set(classes).size).toBe(2);
  const keys = exported.contents.match(/^ {4}super\(.*\);$/gm) ?? [];
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(2);

  // One texture, one factory, one animation key — the tables are file-wide, so
  // a second scene drawing the same sheet adds nothing to them.
  expect(exported.contents.match(/^ {2}"[^"]*": "data:image/gm) ?? []).toHaveLength(1);
  // And the clip is registered in each scene that plays it, guarded, because
  // an animation belongs to the game rather than to whichever scene ran first.
  expect(exported.contents.match(/this\.anims\.exists\(/g) ?? []).toHaveLength(2);
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

test('a body exports as add.existing and its setters, and a nested one as nothing', async ({
  editor,
}, testInfo) => {
  const path = testInfo.outputPath('hostile.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('ts');

  // Three bodies reach the output and no more: the fixture holds five, and the
  // two it leaves out are the one nested in a group and the one inside a prefab
  // definition. Both are container children, whose x/y are their parent's
  // coordinates rather than the world's — a count rather than a whole-file
  // `not.toContain`, which is a shared resource this file has already been
  // burned by once.
  expect(exported.contents.match(/physics\.add\.existing\(/g) ?? []).toHaveLength(3);

  // A static body is one call with nothing chained onto it, because Phaser's
  // StaticBody genuinely has no velocity, bounce, drag, mass or gravity.
  expect(exported.contents).toContain(', true);');
  expect(exported.contents.match(/^function arcadeBody\(/gm) ?? []).toHaveLength(1);

  // Every dial, defaults included — deliberately unlike `modifiersFor`, which
  // emits only what differs from Phaser's own.
  expect(exported.contents).toContain('.setVelocity(120, -45)');
  expect(exported.contents).toContain('.setBounce(0.4, 0.85)');
  expect(exported.contents).toContain('.setDrag(30, 5)');
  expect(exported.contents).toContain('.setAngularVelocity(90)');
  expect(exported.contents).toContain('.setMass(2.5)');
  expect(exported.contents).toContain('.setImmovable(false)');
  expect(exported.contents).toContain('.setAllowGravity(false)');
  expect(exported.contents).toContain('.setCollideWorldBounds(true)');

  // One world block per scene that has a body — the second scene sets none of
  // its own, so it takes `scenePhysicsOf`'s default rather than the first
  // scene's.
  expect(exported.contents).toContain('this.physics.world.gravity.set(-20, 480);');
  expect(exported.contents).toContain('this.physics.world.gravity.set(0, 0);');
  expect(exported.contents.match(/world\.setBounds\(/g) ?? []).toHaveLength(2);

  // A module cannot set the game config, so it says what the reader has to add.
  expect(exported.contents).toContain("physics: { default: 'arcade' }");

  // The helper's name came out of the module's identifier set before any object
  // drew from it, so the object the fixture calls "arcade body" binds something
  // else rather than shadowing the function the line beside it calls.
  expect(exported.contents).toContain('const arcadeBody2 = this.add.rectangle(');
});

test('the exported page runs the physics it was given', async ({ editor, page }, testInfo) => {
  // Built through the UI rather than from a fixture: this is the one assertion
  // that the *whole* chain arrived — the game config, the world, `add.existing`
  // and the gravity — and each of those is set somewhere different.
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('X', 480);
  await editor.setField('Y', 120);
  await editor.setPhysics(true);
  await editor.setGravity(0, 600);

  const exported = await editor.exportCode('html');
  expect(exported.contents).toContain("physics: { default: 'arcade' },");

  const run = await runExportedPage(page.context(), testInfo.outputPath('physics'), exported.contents);

  const before = await findColor(run.page, await run.page.locator('canvas').screenshot(), RECT_FILL);
  expect(before.count).toBeGreaterThan(100);
  await run.page.waitForTimeout(600);
  const after = await findColor(run.page, await run.page.locator('canvas').screenshot(), RECT_FILL);

  // Downward, and by more than a rounding error: at 600px/s² a body falls about
  // 100 scene pixels in 600ms, before the canvas scale is even accounted for.
  expect(after.count).toBeGreaterThan(100);
  expect(after.y).toBeGreaterThan(before.y + 20);
  expect(run.errors).toEqual([]);

  await run.close();
});

test('sounds are tabled once, loaded per scene, and named without collision', async ({
  editor,
}, testInfo) => {
  const path = testInfo.outputPath('hostile.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('ts');

  // One table for the whole file, and only what some scene registers: the
  // hostile project imports a third sound no scene uses, and its bytes must
  // not ship — the rule the images already follow.
  expect(exported.contents).toContain('const AUDIO = {');
  expect(exported.contents).toContain('"jump": "data:audio/wav;base64,');
  expect(exported.contents).not.toContain('unused');

  // Per scene, not per file: the second scene registers nothing, so it gets no
  // `load.audio` at all. Splitting on the class declaration is how to say
  // "this scene's preload" without parsing the module.
  const [, first, second] = exported.contents.split(/^export class /m);
  expect(first).toContain('this.load.audio("jump"');
  expect(second).not.toContain('this.load.audio');

  // The handle keeps `jumpSound` and the object named "jump sound" is pushed to
  // `jumpSound2` — the sounds are allocated out of `create()`'s identifier set
  // before any object draws from it. Getting that order wrong compiles, and
  // hands a hand-written `jumpSound.play()` a rectangle.
  expect(first).toContain('const jumpSound = this.sound.get("jump")');
  expect(first).toContain('const jumpSound2 = this.add.rectangle(');

  // Two rows on one file de-duplicate rather than colliding, and the row whose
  // sound is no longer in the project leaves no trace: `soundsOf` drops it, so
  // nothing downstream needs a guard or a stand-in comment.
  expect(first).toContain('Sound2 = this.sound.get(');
  expect(exported.contents).not.toContain("'gone'");
  expect(exported.contents).not.toContain('"gone"');
});

test('the camera is emitted per scene, and the follow line after the objects', async ({
  editor,
}, testInfo) => {
  const path = testInfo.outputPath('hostile-camera.phaser.json');
  await fs.writeFile(path, JSON.stringify(hostileProject()), 'utf8');
  await editor.openFile(path);

  const exported = await editor.exportCode('ts');
  const [, first, second] = exported.contents.split(/^export class /m);

  expect(first).toContain('this.cameras.main.setScroll(120, -60);');
  expect(first).toContain('this.cameras.main.setZoom(1.5);');
  expect(first).toContain('this.cameras.main.setRoundPixels(true);');
  expect(first).toContain('this.cameras.main.setBounds(0, 0, 960, 540);');

  // The one thing this exporter emits after the object list, because it names a
  // binding the list above makes — and the binding is whatever `toIdentifier`
  // made of a hostile name, which is why this asserts the order rather than the
  // text.
  expect(first).toContain('this.cameras.main.startFollow(');
  expect(first.indexOf('this.add.rectangle(')).toBeLessThan(
    first.indexOf('startFollow'),
  );

  // Per scene, not per file: the second scene has no camera of its own, so
  // `cameraOf`'s default branch reaches the same export and emits nothing.
  expect(second).not.toContain('setZoom');
  expect(second).not.toContain('startFollow');
});

test('a project with no bodies exports no physics at all', async ({ editor }) => {
  // The rule the asset table, the tilemap helper and the prefab factories all
  // follow: a project that predates a feature exports byte for byte what it
  // always did.
  const exported = await editor.exportCode('html');
  expect(exported.contents).not.toContain('arcade');
  expect(exported.contents).not.toContain('this.physics');

  const module = await editor.exportCode('ts');
  expect(module.contents).not.toContain('arcade');
});

test('a sprite with no image is called out rather than dropped', async ({ editor }) => {
  await editor.addObject('Image');
  const exported = await editor.exportCode('ts');
  expect(exported.contents).toContain('no image chosen in the editor');
});
