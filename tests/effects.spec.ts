import fs from 'node:fs/promises';
import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';
import { findColor, findColorBox } from './helpers/pixels';

/**
 * Visual effects: Phaser 4 filters on an object, drawn on the canvas exactly as
 * the export draws them.
 *
 * This is the first feature in a long while where the editor and the exported
 * game do the *same thing* rather than one describing the other — a filter is a
 * standing fact about how an object is drawn, not a step of a simulation, so
 * there is no "drawn, never run" to arrange. What that buys the suite is that
 * almost every claim here can be made on the near side of the export.
 *
 * **The instrument is a colour count, and the glow is what makes it work.** A
 * glow puts a colour on the canvas that is on nothing else, *outside* the
 * object's own box — so "it is drawn at all" is `count > 0` where a feature
 * silently doing nothing gives exactly 0, and "it is a glow rather than a
 * recolour" is an extent strictly larger than the object's own. A blur is the
 * opposite reading and needs one: it has no colour of its own, so what is
 * asserted is that the *exact* fill colour stops being on screen while the
 * object plainly still is.
 *
 * A pixelate is asserted through the document and the export rather than
 * through pixels, and deliberately: a solid rectangle pixelates to the same
 * solid rectangle, so a pixel claim about it would be a claim about the fixture
 * rather than about the feature. Typography's call for weight and slant.
 */

/**
 * A live filter is dear on a software renderer, so this file gets room.
 *
 * `enableFilters` puts the object — and with it the frame — through a
 * framebuffer, and the headless container rasterises that on the CPU: every
 * screenshot taken while one is switched on costs real seconds, and the cost
 * scales with the viewport, so the desktop project pays it twice over. Each
 * test below already touches as few fields as it can once an effect is live and
 * reads one screenshot three ways rather than taking three, and this is the
 * remaining half. `export-toolchain.spec.ts`' reason for the same line, with a
 * GPU in place of a compiler.
 */
test.describe.configure({ timeout: 180_000 });

/**
 * The object's own fill, and the glow drawn around it.
 *
 * Both have to clear every chrome colour *and* every other fixture colour in
 * the suite by more than `findColor`'s tolerance of 24 on at least one channel
 * — it matches only when *every* channel is within it, so "obviously a
 * different colour" is not the test. `GLOW` was picked by arithmetic rather
 * than by eye, which `TOUCH_COLOR`, `TWEEN_COLOR` and `SPAWN_COLOR` all record
 * having nearly got wrong: against all forty-eight fixture colours in `tests/`
 * and all ten chrome colours in `EditorScene.ts`, its worst channel margin is
 * 85. Re-run that check when a fixture colour is added.
 */
const FILL = '#4ef2a1';
const GLOW = '#997722';

/**
 * How long a canvas reading gets to come back.
 *
 * Generous, and for the reason the file's own timeout is: one screenshot taken
 * while a filter is live can itself outlast a default poll budget on the larger
 * viewport, which leaves the poll with a single attempt and turns "slow" into
 * "absent". `expect.poll` takes its own budget rather than the test's, so this
 * has to be said separately from the `describe.configure` above.
 */
const POLL = 30_000;

/**
 * Small enough to keep the filtered passes cheap.
 *
 * A filter renders the object to a texture and runs a shader over it, and the
 * headless container rasterises that on the CPU — so every interaction *after*
 * an effect is switched on costs real time, and it scales with the object's
 * area. That is also why each test below changes as few fields as it can once
 * an effect is live, and why `defaultEffect` is seeded strongly enough that
 * most of them need change none at all.
 */
const SIZE = 120;

/** An empty scene holding one selected rectangle, and nothing else to measure. */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Width', SIZE);
  await editor.setField('Height', SIZE);
  await editor.setField('Fill', FILL);
  await editor.setField('X', 480);
  await editor.setField('Y', 270);
}

/** Adds an effect and switches it to `kind`, which arrives as a glow. */
async function addEffect(editor: EditorPage, index: number, kind?: string): Promise<void> {
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: '+ Add an effect' }).click();
  if (kind) await editor.setChoice(`Effect ${index} kind`, kind);
}

test('an object with no effect says so, and draws nothing extra', async ({ editor }) => {
  await setup(editor);
  await expect(
    editor.panel('inspect').getByText('Nothing is drawn over this object yet.', { exact: false }),
  ).toBeVisible();

  await editor.deselect();
  await editor.closePanels();
  expect((await editor.findDrawn(GLOW)).count).toBe(0);
});

test('a glow draws a colour of its own, outside the object it is on', async ({ editor }) => {
  await setup(editor);
  // The colour is the only field touched: a new glow already arrives at an
  // outer strength of 8 and a spread of 2, which is `defaultEffect`'s rule —
  // an effect that arrives doing nothing is indistinguishable from the feature
  // being broken.
  await addEffect(editor, 1);
  await editor.setField('Effect 1 colour', GLOW);

  // Deselected before measuring: the selection outline and the scale handle sit
  // over the very pixels a colour reading is averaging, which is the trap
  // `physics.spec.ts` records paying for.
  await editor.deselect();
  await editor.closePanels();

  // Polled rather than read once: a filter is an extra render pass, and under
  // a loaded machine's software renderer the first frame after a store change
  // can land before it. "It is drawn" is a statement about time passing, which
  // is the reading `animation.spec.ts` already settled on.
  //
  // The screenshot the poll succeeded on is kept and read three ways, rather
  // than three readings each taking their own. That is not tidiness: a live
  // filter puts the whole canvas through a framebuffer, so on the larger
  // viewport every screenshot after one is switched on costs real seconds.
  let png: Buffer | undefined;
  await expect
    .poll(
      async () => {
        png = (await editor.shot()).png;
        return (await findColor(editor.page, png, GLOW)).count;
      },
      { timeout: POLL },
    )
    .toBeGreaterThan(0);

  const glow = await findColorBox(editor.page, png as Buffer, GLOW);
  const fill = await findColorBox(editor.page, png as Buffer, FILL);

  // And it is a *glow* rather than a recolour — it is drawn outside the box the
  // object occupies, which is the one thing a tint could not do. An extent
  // rather than a centroid, because what is asserted is how big it is drawn.
  expect(glow.width).toBeGreaterThan(fill.width);
  expect(glow.height).toBeGreaterThan(fill.height);
  // The object itself is untouched: a glow adds light around it, it does not
  // repaint it. Measured off the same shot, so the two cannot disagree about
  // which frame they are talking about.
  expect(fill.count).toBeGreaterThan(0);
});

test('removing the effect puts the canvas back', async ({ editor }) => {
  await setup(editor);
  await addEffect(editor, 1);
  await editor.setField('Effect 1 colour', GLOW);
  await editor.deselect();
  await editor.closePanels();
  await expect
    .poll(async () => (await editor.findDrawn(GLOW)).count, { timeout: POLL })
    .toBeGreaterThan(0);

  await editor.selectInTree('Rectangle');
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByTitle('Remove effect 1').click();
  await editor.deselect();
  await editor.closePanels();

  // Back to nothing, which is what proves the renderer tears a filter list down
  // rather than only building one up.
  await expect
    .poll(async () => (await editor.findDrawn(GLOW)).count, { timeout: POLL })
    .toBe(0);
  expect((await editor.findDrawn(FILL)).count).toBeGreaterThan(0);
});

test('a blur takes the exact fill colour off the canvas', async ({ editor }) => {
  await setup(editor);
  await editor.deselect();
  await editor.closePanels();
  const before = (await editor.findDrawn(FILL)).count;
  expect(before).toBeGreaterThan(0);

  await editor.selectInTree('Rectangle');
  // No fields touched at all: a new blur arrives at medium quality over four
  // pixels, which is already enough to spread a flat fill into a gradient.
  await addEffect(editor, 1, 'Blur');
  await editor.deselect();
  await editor.closePanels();

  // A blur has no colour of its own, so the reading is what it *removes*: the
  // exact fill is spread across a gradient and stops matching at all.
  await expect
    .poll(async () => (await editor.findDrawn(FILL)).count, { timeout: POLL })
    .toBeLessThan(before / 2);
});

test('effects survive a save and an open, in order, and bump nothing', async ({
  editor,
}, testInfo) => {
  await setup(editor);
  await addEffect(editor, 1);
  await addEffect(editor, 2, 'Pixelate');

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  // The guides case, twelfth time: an optional field on a node rides in on
  // `scenes`, which `parseProject` passes through verbatim, so no bump.
  expect(parsed.schemaVersion).toBe(16);

  const node = parsed.scenes[0].children.find(
    (child: { name: string }) => child.name === 'Rectangle',
  );
  expect(node.fx).toHaveLength(2);
  expect(node.fx[0]).toMatchObject({
    kind: 'glow',
    color: '#ffffff',
    outerStrength: 8,
    innerStrength: 0,
    scale: 2,
  });
  expect(node.fx[1]).toMatchObject({ kind: 'pixelate', amount: 6 });

  const path = testInfo.outputPath('effects.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);
  await editor.selectInTree('Rectangle');
  await editor.openPanel('inspect');
  expect(await editor.selectValue('Effect 1 kind')).toBe('glow');
  expect(await editor.selectValue('Effect 2 kind')).toBe('pixelate');
  expect(await editor.numberValue('Effect 2 amount')).toBe(6);
});

test('the order is the order the passes run, and the arrows change it', async ({ editor }) => {
  await setup(editor);
  await addEffect(editor, 1);
  await addEffect(editor, 2, 'Pixelate');

  await editor.openPanel('inspect');
  // The first row cannot move earlier; the second can.
  await expect(editor.panel('inspect').getByTitle('Run effect 1 earlier')).toBeDisabled();
  await editor.panel('inspect').getByTitle('Run effect 2 earlier').click();

  expect(await editor.selectValue('Effect 1 kind')).toBe('pixelate');
  expect(await editor.selectValue('Effect 2 kind')).toBe('glow');
});

test('the export emits the filters, gated and narrowed', async ({ editor }) => {
  await setup(editor);
  await addEffect(editor, 1);
  await addEffect(editor, 2, 'Drop shadow');

  const { contents } = await editor.exportCode('ts');

  // The helper, and the narrowing that is the whole reason it exists: Phaser
  // types `filters` as nullable, and the shared `create()` body can carry no
  // cast.
  expect(contents).toContain('function attachEffects(object: Phaser.GameObjects.GameObject)');
  expect(contents).toContain('object.enableFilters();');
  expect(contents).toContain('return object.filters ? object.filters.internal : null;');

  // The call, the guard and both passes in list order.
  expect(contents).toContain('const rectangleFilters = attachEffects(rectangle);');
  expect(contents).toContain('if (rectangleFilters) {');
  // Emitted whole, defaults included — the emitter config's and the physics
  // body's rule, and here mechanical besides: these are positional, so a later
  // argument cannot be passed without an earlier one. Each call is a *prefix*
  // of Phaser's own list, so nothing is printed the document does not hold.
  expect(contents).toContain('rectangleFilters.addGlow(0xffffff, 8, 0, 2);');
  expect(contents).toContain('rectangleFilters.addShadow(6, 6, 0.1, 1, 0x000000);');
  expect(contents.indexOf('addGlow')).toBeLessThan(contents.indexOf('addShadow'));
});

test('a project with no effect exports none of it', async ({ editor }) => {
  await setup(editor);
  const { contents } = await editor.exportCode('ts');
  // Gated like every table before it, so a project that predates this feature
  // is byte for byte what it was.
  expect(contents).not.toContain('attachEffects');
  expect(contents).not.toContain('enableFilters');
});
