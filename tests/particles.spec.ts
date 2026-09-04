import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';
import { solidPng } from './helpers/png';

/**
 * Particle emitters: stopped, previewed, reconfigured and cleared.
 *
 * `editing.spec` carries the "it draws where the document says, and survives a
 * save and an open" duty for this type, because a stopped emitter draws its
 * marker with no setup at all. What is left here is everything that is about
 * *time*: an emitter is the first object whose whole point is what it does over
 * one, so the claims worth making are that nothing moves until preview is on,
 * that something does once it is, and that switching it off puts the canvas
 * back where it was.
 *
 * Every assertion is against pixels. A store-level check would pass on a config
 * that reached the document and never reached Phaser, which is exactly the
 * mistake worth catching — the argument the sheet and tilemap suites already
 * make one panel over.
 */

/**
 * The particle texture, in a colour nothing else on the canvas draws.
 *
 * "Nothing else" has to include the editor's own chrome, not just the other
 * objects: the selection outline is `0x00e5ff`, and a freshly added node is
 * selected — so a cyan particle would be counted together with the outline
 * drawn around its own emitter, and the test would report particles that were
 * never emitted. The guides are `0xff3ea5` and `0xffa723`, the marker
 * `#ff6bd6`, the frame `0x5a6478` and the scene `#1d2330`; these two clear all
 * of them by well over `findColor`'s per-channel tolerance.
 */
const PARTICLE = '#00ff6a';
/** A second one, so "the texture changed" is a colour change and not a guess. */
const OTHER_PARTICLE = '#b026ff';
/** The colour the editor draws a stopped emitter's marker in. */
const MARKER = '#ff6bd6';

/**
 * 64px, then scaled up: at the mobile project's zoom of ~0.37 a 16px particle
 * is 6 screen pixels across and a centroid over it is all antialiased edge.
 */
const TEXTURE_SIZE = 64;

/** Where the emitter sits. Above `shot`'s clipped bottom band, and clear of it. */
const ORIGIN = { x: SCENE.width / 2, y: 200 };

/** Screenshot centroids and CSS-pixel maths agree to a few pixels. */
const NEAR = 10;

const particlePng = (hex: string, name: string) => ({
  name,
  buffer: solidPng(TEXTURE_SIZE, TEXTURE_SIZE, hex),
});

/**
 * One emitter, alone in the scene, configured so that what it draws is
 * something a colour centroid can honestly measure.
 *
 * `findColor` returns a single centroid over every matching pixel, so a random
 * scatter would average out to a number that means nothing and a `count` that
 * depends on frame timing. Every source of randomness is therefore pinned:
 * speed min and max both zero, so particles stay on the emitter; no gravity;
 * scale and alpha constant, so the blob is one size and opaque enough to clear
 * `findColor`'s alpha threshold; and a lifespan long enough that nothing dies
 * mid-assertion. What is drawn is then a solid block of the texture exactly on
 * the emitter's origin.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Particles');
  await editor.importImage(particlePng(PARTICLE, 'spark.png'));

  await editor.setField('X', ORIGIN.x);
  await editor.setField('Y', ORIGIN.y);
  await editor.setField('Speed min', 0);
  await editor.setField('Speed max', 0);
  await editor.setField('Scale start', 1);
  await editor.setField('Scale end', 1);
  await editor.setField('Alpha start', 1);
  await editor.setField('Alpha end', 1);
  await editor.setField('Lifespan', 5000);
  await editor.setField('Quantity', 4);
}

test('an emitter is stopped by default and draws its marker instead', async ({ editor }) => {
  await setup(editor);
  await editor.closePanels();

  // Preview is off, so the emitter throws nothing — the whole argument for the
  // toggle, stated as pixels.
  expect(
    (await editor.findDrawn(PARTICLE)).count,
    'an emitter emitted with preview off',
  ).toBe(0);

  const marker = await editor.findDrawn(MARKER);
  const expected = await editor.sceneToScreen(ORIGIN);
  expect(marker.count, 'the stopped emitter drew nothing at all').toBeGreaterThan(100);
  expect(Math.abs(marker.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(marker.y - expected.y)).toBeLessThan(NEAR);
});

test('preview starts it, and stopping clears what is in flight', async ({ editor }) => {
  await setup(editor);
  await editor.setPreview(true);
  await editor.closePanels();

  // Polled rather than screenshotted once: what is on the canvas at any instant
  // is a race with the frame rate, so the honest claim is about time passing.
  await expect
    .poll(async () => (await editor.findDrawn(PARTICLE)).count, {
      timeout: 10_000,
      message: 'the emitter never drew a particle with preview on',
    })
    .toBeGreaterThan(100);

  const drawn = await editor.findDrawn(PARTICLE);
  const expected = await editor.sceneToScreen(ORIGIN);
  expect(Math.abs(drawn.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(drawn.y - expected.y)).toBeLessThan(NEAR);
  // One state, not two: the marker stands in for the emitter only while it is
  // not drawing itself.
  expect((await editor.findDrawn(MARKER)).count).toBe(0);

  await editor.setPreview(false);
  await editor.closePanels();
  // This is what `stop(true)` buys. Left to die out, the particles above would
  // hang about for their whole 5000ms lifespan, and switching preview off would
  // not visibly do anything for five seconds.
  await expect
    .poll(async () => (await editor.findDrawn(PARTICLE)).count, {
      timeout: 5_000,
      message: 'particles outlived the preview toggle',
    })
    .toBe(0);
  expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);
});

test('an edit to the emitter reaches the canvas', async ({ editor }) => {
  await setup(editor);
  await editor.setPreview(true);
  await editor.closePanels();
  await expect
    .poll(async () => (await editor.findDrawn(PARTICLE)).count, { timeout: 10_000 })
    .toBeGreaterThan(100);

  // Straight down, at one speed, so the motion is deterministic rather than a
  // spray: min and max equal on both fields removes the randomness the same way
  // `setup` does. This is the only assertion that proves `setConfig` runs at
  // all and that its cache is not stuck holding the first config forever.
  await editor.setField('Angle min', 90);
  await editor.setField('Angle max', 90);
  await editor.setField('Speed min', 200);
  await editor.setField('Speed max', 200);
  await editor.closePanels();

  const origin = await editor.sceneToScreen(ORIGIN);
  await expect
    .poll(
      async () => {
        const drawn = await editor.findDrawn(PARTICLE);
        return drawn.count > 100 ? drawn.y - origin.y : 0;
      },
      { timeout: 10_000, message: 'the speed and angle never reached Phaser' },
    )
    .toBeGreaterThan(40);
});

test('changing the image changes what it throws', async ({ editor }) => {
  await setup(editor);
  await editor.importImage(particlePng(OTHER_PARTICLE, 'ember.png'));
  await editor.setPreview(true);
  await editor.closePanels();

  await expect
    .poll(async () => (await editor.findDrawn(OTHER_PARTICLE)).count, {
      timeout: 10_000,
      message: 'the emitter kept throwing the old texture',
    })
    .toBeGreaterThan(100);
  expect((await editor.findDrawn(PARTICLE)).count).toBe(0);
});

test('removing the image leaves the emitter without one', async ({ editor, page }) => {
  await setup(editor);

  // The picker warns with a count, and that count has to include emitters or it
  // under-reports by a whole object type.
  page.on('dialog', (dialog) => {
    expect(dialog.message()).toContain('1 object');
    void dialog.accept();
  });
  await editor.openPanel('inspect');
  await page.getByRole('button', { name: 'Remove spark.png' }).click();

  // Preview off is the default, so the marker is what should be on the canvas —
  // the same state "no image chosen yet" leaves it in, which is the point of
  // there being one marker rather than two.
  await editor.closePanels();
  expect((await editor.findDrawn(PARTICLE)).count).toBe(0);
  expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  expect(parsed.scenes[0].children[0].props.assetId).toBeNull();
  expect(parsed.assets).toHaveLength(0);
});
