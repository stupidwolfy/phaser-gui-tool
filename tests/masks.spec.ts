import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';
import { halfAlphaPng } from './helpers/png';

/**
 * Masks: a `NodeEffect` whose dial is an image rather than a number.
 *
 * `Phaser.Filters.Mask` multiplies the object by the mask image's **alpha** —
 * `color *= invert ? (1.0 - a) : a` is the whole of its fragment shader — and
 * an *internal* filter samples the mask at the object's own texel, so the
 * picture is stretched across whatever it is masking rather than aligned to it
 * in pixels. Both halves of that shape this file: the fixture has to vary in
 * alpha, and the claims are about proportions of the object rather than about
 * pixel positions.
 *
 * **The instrument is an extent and a count together, and neither is enough
 * alone.** A glow next door can be asserted by a colour that is on nothing
 * else; a blur by the exact fill ceasing to exist. A mask is neither — what it
 * leaves behind is *still exactly the object's own colour*, and what changes is
 * how much of it there is and where it stops. So a count says "something was
 * taken away" and an extent says "a *side* was taken away", which is the claim
 * a fade or a tint could not make.
 *
 * Every drawn claim is a **ratio against the unmasked shot** rather than a
 * pixel figure. The two projects draw at different zooms — a 240-wide object is
 * about 89 screen pixels on the mobile project — so an absolute width is a
 * number that means one thing on one project and something else on the other,
 * which `parallax.spec.ts` and `nineslice.spec.ts` both record.
 */

/**
 * A live filter is dear on a software renderer, so this file gets room.
 *
 * `effects.spec.ts`' line and its reason exactly: `enableFilters` puts the
 * object — and with it the frame — through a framebuffer, and the headless
 * container rasterises that on the CPU, at a cost that scales with the
 * viewport. A mask is one of the cheapest passes there is, but it is still a
 * pass, and the desktop project pays for it twice over.
 */
test.describe.configure({ timeout: 180_000 });

/**
 * How long a canvas reading gets to come back.
 *
 * `expect.poll` takes its own budget rather than the test's, so this has to be
 * said separately from the `describe.configure` above — otherwise a screenshot
 * that outlasts the default poll budget leaves the poll with a single attempt
 * and turns "slow" into "absent".
 */
const POLL = 30_000;

/**
 * The object's fill, and the mask image's own colour.
 *
 * Reused from `blend.spec.ts` rather than picked afresh, which is strictly
 * safer than new arithmetic: both were already checked by hand against every
 * hex literal in `tests/` and every chrome colour in `EditorScene.ts` —
 * `#448800` at a worst channel margin of 68 and `#aa66aa` at 71, against
 * `findColor`'s tolerance of 24, which matches only when *every* channel is
 * inside it.
 *
 * `MASK_INK` is never asserted and does not have to clear anything: a mask
 * image is sampled by the filter and is never itself drawn to the canvas. It is
 * a distinct colour only so that a screenshot which somehow *did* contain it
 * would be obvious to a person reading a failure.
 */
const FILL = '#448800';
const MASK_INK = '#aa66aa';

/** Big enough that half of it is still a solid reading at the mobile zoom. */
const SIZE = 240;

/** The mask image: opaque down the left, fully transparent down the right. */
const maskImage = () => ({ name: 'mask.png', buffer: halfAlphaPng(64, 64, MASK_INK) });

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

/**
 * Adds an effect and switches it to a mask.
 *
 * An effect arrives as a glow, which is `defaultEffect`'s rule — every kind is
 * seeded to be visible immediately. A mask is the one kind that cannot obey it,
 * because there is nothing to seed an image with, so this always takes two
 * steps where `effects.spec.ts`' glow tests take one.
 */
async function addMask(editor: EditorPage, index: number): Promise<void> {
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: '+ Add an effect' }).click();
  await editor.setChoice(`Effect ${index} kind`, 'Mask');
}

/** The box the object's own fill occupies, once the canvas has settled. */
async function fillBox(editor: EditorPage) {
  await editor.deselect();
  await editor.closePanels();
  let box = await editor.findDrawnBox(FILL);
  await expect
    .poll(
      async () => {
        box = await editor.findDrawnBox(FILL);
        return box.count;
      },
      { timeout: POLL },
    )
    .toBeGreaterThan(0);
  return box;
}

test('a mask with no image chosen draws the object whole', async ({ editor }) => {
  await setup(editor);
  const before = await fillBox(editor);

  await editor.selectInTree('Rectangle');
  await addMask(editor, 1);
  await expect(
    editor.panel('inspect').getByText('No image chosen — this mask does nothing until one is.'),
  ).toBeVisible();

  // The load-bearing negative, and the assertion that goes red the day somebody
  // "fixes" the fallback by handing `addMask` the placeholder. That texture is
  // a 96px *opaque* square, so as a mask it would do nothing — and inverted it
  // would erase the object outright. A mask with nothing to sample runs no pass
  // at all, here and in the export alike.
  const after = await fillBox(editor);
  expect(after.width).toBeGreaterThan(before.width * 0.9);
  expect(after.count).toBeGreaterThan(before.count * 0.9);
});

test('a mask cuts the object to the opaque part of its image', async ({ editor }) => {
  await setup(editor);
  const before = await fillBox(editor);

  await editor.selectInTree('Rectangle');
  await addMask(editor, 1);
  // Imported through the mask row's own picker, which assigns it on the way in
  // — `AssetPicker` calls `onPick` itself after an import. A rectangle is the
  // fixture rather than a sprite for a locator reason as much as a cheapness
  // one: a sprite's own panel carries a second "Import image…" button, and the
  // harness matches that name exactly.
  await editor.importImage(maskImage());

  const after = await fillBox(editor);

  // A count says something was taken away...
  expect(after.count).toBeLessThan(before.count * 0.75);
  expect(after.count).toBeGreaterThan(0);
  // ...and an extent says a *side* was, which is the half a fade or a tint
  // could not produce. Bounded loosely on purpose: what is asserted is "about
  // half", and both ends of a measured extent carry a colour boundary's
  // sub-pixel phase, so a tolerance tight enough to mean anything on one
  // project sits inside the noise on the other.
  expect(after.width).toBeLessThan(before.width * 0.75);
  expect(after.height).toBeGreaterThan(before.height * 0.9);
});

test('invert keeps the other half', async ({ editor }) => {
  await setup(editor);
  await editor.selectInTree('Rectangle');
  await addMask(editor, 1);
  await editor.importImage(maskImage());
  const plain = await fillBox(editor);

  await editor.selectInTree('Rectangle');
  await editor.openPanel('inspect');
  await editor.checkbox('Effect 1 invert').check();

  const inverted = await fillBox(editor);

  // The claim `invert` exists for, and the one a symmetric fixture could not
  // make at all: the surviving half moves to the other side of the object. Two
  // extents of the same width, starting in different places — so this is the
  // one reading in the file that is about *where* rather than how much.
  expect(inverted.count).toBeGreaterThan(0);
  expect(inverted.x).toBeGreaterThan(plain.x + plain.width * 0.5);
});

test('a mask survives a save and an open', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.selectInTree('Rectangle');
  await addMask(editor, 1);
  await editor.importImage(maskImage());
  await editor.checkbox('Effect 1 invert').check();

  const file = await editor.saveToFile();
  const saved = JSON.parse(file.contents);

  // No bump: `node.fx` rides in on `scenes`, which `parseProject` passes
  // through verbatim, and on `prefabs.children`, which `parsePrefabs` passes
  // through unvalidated — so both homes survive an old build's re-save, and a
  // v14 build's `effectsOf` drops the unknown kind and draws the object
  // unmasked. An old build doing less, not a file breaking. Asserted so that a
  // future bump is a deliberate act.
  expect(saved.schemaVersion).toBe(14);

  const effect = saved.scenes[0].children[0].fx[0];
  expect(effect.kind).toBe('mask');
  expect(effect.invert).toBe(true);
  expect(typeof effect.assetId).toBe('string');

  const path = testInfo.outputPath('with-mask.phaser.json');
  await fs.writeFile(path, file.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);

  await editor.selectInTree('Rectangle');
  expect(await editor.choice('Effect 1 kind').inputValue()).toBe('mask');
  await expect(editor.checkbox('Effect 1 invert')).toBeChecked();
});

test('deleting the image unpoints the mask rather than removing it', async ({
  editor,
  page,
}) => {
  await setup(editor);
  await editor.selectInTree('Rectangle');
  await addMask(editor, 1);
  await editor.importImage(maskImage());
  const masked = await fillBox(editor);

  await editor.selectInTree('Rectangle');
  await editor.openPanel('inspect');
  // The warning counts the mask, which is `countAssetUses`' new branch — the
  // one use of an image in this document that is not keyed on the node's type.
  page.on('dialog', (dialog) => {
    expect(dialog.message()).toContain('1 object');
    void dialog.accept();
  });
  await editor.panel('inspect').getByRole('button', { name: 'Remove mask.png' }).click();
  await editor.settle();

  // The reference goes and the effect stays, which is `removeAsset`'s own rule
  // rather than `removeAudio`'s: a `SceneSound` *is* a reference and goes with
  // the file, where an object that has an image is still an object. So the mask
  // keeps its `invert` and picking another image puts it straight back.
  await editor.selectInTree('Rectangle');
  expect(await editor.choice('Effect 1 kind').inputValue()).toBe('mask');

  const whole = await fillBox(editor);
  expect(whole.width).toBeGreaterThan(masked.width * 1.4);

  // And the document holds no dangling id by any action in the editor, which is
  // what keeps `effectsOf`'s fallback a guard against hand-edited files rather
  // than something the editor leans on.
  const file = await editor.saveToFile();
  const saved = JSON.parse(file.contents);
  expect(saved.assets).toHaveLength(0);
  expect(saved.scenes[0].children[0].fx[0].assetId).toBeNull();
});

test('a mask applies on a cold open, after its texture decodes', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.selectInTree('Rectangle');
  await addMask(editor, 1);
  await editor.importImage(maskImage());
  const masked = await fillBox(editor);
  const file = await editor.saveToFile();
  const path = testInfo.outputPath('cold-open.phaser.json');
  await fs.writeFile(path, file.contents, 'utf8');

  // **The only test that reaches `syncTextures`' asynchronous branch, and the
  // only one that fails when its `nodeEffects.clear()` is removed.** The decode
  // cache in `assets.ts` is module-level, so `newProject` followed by
  // `openFile` re-opens a project the page has *already* decoded — every other
  // test in this file silently asserts the synchronous path twice. Only a
  // reload gives the mask's texture a chance to land *after* the sync that
  // wanted it, which is the state every real user's first open is in.
  //
  // `fonts.spec.ts` owns the same reload for the same reason, and its lesson
  // applies here too: open the saved file rather than trusting the autosaved
  // draft the page comes back on, because that draft is written on an 800ms
  // debounce.
  await editor.reload();
  await editor.openFile(path);

  const reopened = await fillBox(editor);
  expect(reopened.count).toBeGreaterThan(0);
  expect(reopened.width).toBeLessThan(masked.width * 1.25);
});
