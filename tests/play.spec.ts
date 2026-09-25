import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';
import { reaches } from './helpers/poll';

/**
 * Play: the exported game, running over the editor.
 *
 * Every other spec in this suite asserts something about a *drawing*. This one
 * asserts something about a *game*, and the two halves of it are the two halves
 * of the feature's own argument:
 *
 * - The game does what the editor has always refused to do. A body falls, which
 *   `physics.spec.ts` exists to prove the canvas never lets happen.
 * - The document does not move while it does. That is the assertion that fails
 *   the day somebody wires a simulation into `EditorScene`, and it is the whole
 *   reason Play is allowed to exist at all: the running thing is a different
 *   document, and Stop throws it away.
 *
 * The instrument is `EditorPage.findInPlay`, which screenshots the **iframe**
 * rather than the canvas — see its own comment for why, and for the three ways
 * a reading in there differs from one out here. The most important is that the
 * game letterboxes itself with `Scale.FIT`, so nothing below asserts an
 * absolute landing point: every claim about the game is about *travel*.
 *
 * Nothing here drags, so none of these fixtures is shaped by the mobile
 * project's ~22-scene-unit snap threshold — its absence would otherwise read as
 * an oversight.
 */

/** The default rectangle fill, from `src/core/defaults.ts`. */
const FILL = '#4f8cff';

/** Where the faller starts: high in the scene, with room to fall. */
const TOP = { x: SCENE.width / 2, y: 90 };
const SIZE = { width: 220, height: 120 };

/**
 * How far down the scene the faller has to get before the claim is made, in
 * *scene units*.
 *
 * Its whole fall is about 390 of them — from y=90 to resting on the world
 * bounds, which Arcade keeps it inside by default — so this is comfortably
 * inside what a working page reaches and far outside any letterboxing or
 * antialiasing slop. In scene units rather than frame pixels because the game
 * chooses its own scale: see `EditorPage.playScale`.
 */
const FELL = 200;

/**
 * One rectangle near the top of an otherwise empty scene.
 *
 * Big enough that its fill is several thousand pixels of the frame on the
 * mobile project as well as the desktop one — the game scales to whatever box
 * the frame gives it, and on a 390px screen that box is small.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('X', TOP.x);
  await editor.setField('Y', TOP.y);
  await editor.setField('Width', SIZE.width);
  await editor.setField('Height', SIZE.height);
}

/** The same rectangle, given a dynamic body in a scene with gravity. */
async function setupFalling(editor: EditorPage): Promise<void> {
  await setup(editor);
  await editor.setPhysics(true);
  await editor.setGravity(0, 900);
}

test('Play runs the project, and Stop puts the editor back', async ({ editor }) => {
  await setup(editor);
  await editor.deselect();
  await editor.closePanels();

  // Nothing is playing until it is asked for, which is what keeps the overlay
  // off every other spec in this suite.
  await expect(editor.playFrame()).toHaveCount(0);

  await editor.play();
  const drawn = await editor.findInPlay(FILL);
  expect(drawn.count).toBeGreaterThan(0);

  await editor.stopPlay();

  // The editor is back, drawing the scene it was drawing before — and the frame
  // is gone rather than hidden, which is the whole of the teardown: a discarded
  // document takes its textures, timers and listeners with it.
  await expect(editor.playFrame()).toHaveCount(0);
  expect((await editor.findDrawn(FILL)).count).toBeGreaterThan(0);
});

test('the game does what the canvas refuses to, and the document never moves', async ({
  editor,
}) => {
  await setupFalling(editor);
  await editor.deselect();
  await editor.closePanels();

  // Where the document says the object is, on the editor's own canvas. The
  // canvas has never moved this object and never will — that is
  // `physics.spec.ts`' claim, and this test is standing on it.
  const before = await editor.findDrawn(FILL);
  expect(before.count).toBeGreaterThan(0);

  await editor.play();
  const start = await editor.findInPlay(FILL);
  expect(start.count).toBeGreaterThan(0);

  /*
   * Polled rather than timed, because what a running game is doing at one
   * wall-clock instant is a race with the frame rate — see `reaches`. The claim
   * is "it gets well down the scene", which is a statement about time passing
   * and is the only kind a simulation can be asked for.
   */
  const scale = await editor.playScale();
  const fallen = await reaches(
    () => editor.findInPlay(FILL),
    (blob) => blob.count > 0 && blob.y - start.y > FELL * scale,
  );
  expect(fallen.y - start.y).toBeGreaterThan(FELL * scale);

  await editor.stopPlay();

  // And the document is exactly where it was. Not "nearly" — the same reading,
  // to within a screenshot's own noise, because nothing in the editor was ever
  // asked to move.
  const after = await editor.findDrawn(FILL);
  expect(after.count).toBeGreaterThan(0);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);

  await editor.selectInTree('Rectangle');
  expect(await editor.numberValue('Y')).toBe(TOP.y);

  const saved = await editor.saveToFile();
  const savedProject = JSON.parse(saved.contents) as {
    scenes: { children: { transform: { y: number } }[] }[];
  };
  expect(savedProject.scenes[0]?.children[0]?.transform.y).toBe(TOP.y);
});

test('Restart is a new game, not a resumed one', async ({ editor }) => {
  await setupFalling(editor);
  await editor.deselect();
  await editor.closePanels();

  await editor.play();
  const start = await editor.findInPlay(FILL);

  const scale = await editor.playScale();
  const fallen = await reaches(
    () => editor.findInPlay(FILL),
    (blob) => blob.count > 0 && blob.y - start.y > FELL * scale,
  );
  expect(fallen.y - start.y).toBeGreaterThan(FELL * scale);

  await editor.restartPlay();

  /*
   * Two claims, and the first one is deliberately *not* polled.
   *
   * "It is back near the top" is a claim that gets less true as the new run
   * goes on, so `reaches` is the wrong instrument for it — polling would be
   * waiting for it to go away. It is read once, and the margin is what makes
   * that safe: run one ended some 390 scene units below where it started, so a
   * reading taken even half a second late is still far above it.
   */
  const again = await editor.findInPlay(FILL);
  expect(again.count).toBeGreaterThan(0);
  expect(again.y).toBeLessThan(fallen.y);

  /*
   * And then it falls again, which is the half that is polled because it does
   * become true with time — and it is the claim a shared or resumed game cannot
   * pass at all. Such a game would be resting on the world bounds already, with
   * nowhere left to travel; only a fresh realm has the whole drop in front of
   * it.
   */
  const twice = await reaches(
    () => editor.findInPlay(FILL),
    (blob) => blob.count > 0 && blob.y - again.y > FELL * scale,
  );
  expect(twice.y - again.y).toBeGreaterThan(FELL * scale);

  await editor.stopPlay();
});

test('Play asks the network for nothing', async ({ editor, page }) => {
  /*
   * The offline claim, and it is the reason `generateRunnableHtml` grew a
   * parameter at all. A downloaded export fetches Phaser from a CDN pinned to
   * the version the project records; this editor is served from Pages, works
   * offline and has never made a request in its life, so Play hands the page
   * the copy the app itself ships.
   *
   * Counted rather than blocked: an aborted request would make a broken Play
   * look like a passing test, where a fulfilled one that is never asked for
   * proves the page never went looking.
   */
  let cdnRequests = 0;
  await page.route('https://cdn.jsdelivr.net/**', async (route) => {
    cdnRequests += 1;
    await route.fulfill({
      path: 'node_modules/phaser/dist/phaser.min.js',
      contentType: 'text/javascript',
    });
  });

  await setup(editor);
  await editor.deselect();
  await editor.closePanels();
  await editor.play();

  expect((await editor.findInPlay(FILL)).count).toBeGreaterThan(0);
  expect(cdnRequests).toBe(0);

  await editor.stopPlay();
});

test('the overlay covers the editor and carries the only way out', async ({
  editor,
}) => {
  await setup(editor);
  await editor.closePanels();
  await editor.play();

  /*
   * The overlay is fixed over everything, which on a phone means over the tab
   * bar as well: the way out of a mode belongs on the surface the mode has
   * taken, and a Stop button a sheet could cover would be no way out at all.
   */
  const stop = editor.page.getByRole('button', { name: 'Stop', exact: true });
  await expect(stop).toBeVisible();
  const box = await stop.boundingBox();
  if (!box) throw new Error('Stop has no box');
  expect(box.height).toBeGreaterThanOrEqual(40);

  const frame = await editor.playFrame().boundingBox();
  if (!frame) throw new Error('the play frame has no box');
  const viewport = editor.page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  expect(frame.y + frame.height).toBeGreaterThan(viewport.height - 2);

  /*
   * Every editor shortcut is off while the game runs, and this is the half that
   * can actually be pressed: once the game has booted it owns the keyboard —
   * Phaser focuses its own canvas, so the frame becomes the page's
   * `activeElement` — but a press on the overlay's own bar brings focus back
   * out here, and from there Delete would otherwise remove an object nobody can
   * see it happen to.
   *
   * There is deliberately no Escape to test. It would work for the moment
   * between the press and the boot and never again, which is worse than a key
   * that never works. See `App.tsx`.
   */
  await stop.focus();
  await editor.page.keyboard.press('Delete');
  await editor.page.keyboard.press('Control+z');
  await expect(editor.playFrame()).toHaveCount(1);

  await editor.stopPlay();

  await editor.openPanel('scene');
  await expect(
    editor.panel('scene').getByRole('button', { name: /^Rectangle, / }),
  ).toBeVisible();
});

test('Play is reachable in both layouts, and is not the preview toggle', async ({
  editor,
}) => {
  /*
   * Play survives the compact toolbar where every Export control does not, and
   * the reason is the device: downloading an `.html` and finding something to
   * open it with is hardest on a phone, which is where the button matters most.
   * A 390px toolbar already clips when everything is shown, so this is the
   * check that adding one more control did not push something off the edge.
   */
  await editor.closePanels();
  const play = editor.page.getByRole('button', { name: 'Play game' });
  await expect(play).toBeVisible();
  const box = await play.boundingBox();
  if (!box) throw new Error('Play has no box');
  const viewport = editor.page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  /*
   * And it is a second control rather than a second name for the first. The ▶
   * toggle animates the *document's* canvas; Play runs a *game*, in a document
   * of its own. A project with something that moves has both on screen at once,
   * which is exactly when two controls reading the same would be a trap — the
   * suite matches an accessible name exactly, and so does a reader.
   */
  await editor.addObject('Particles');
  await editor.closePanels();
  await expect(editor.page.getByRole('button', { name: 'Preview motion' })).toBeVisible();
  await expect(play).toBeVisible();
});

test('Preview motion and Play game expose distinct keyboard and running states', async ({
  editor,
}) => {
  await editor.addObject('Particles');
  await editor.closePanels();

  const preview = editor.page.getByRole('button', { name: 'Preview motion' });
  const play = editor.page.getByRole('button', { name: 'Play game' });

  await expect(preview).toHaveAttribute('title', /animate sprites, particles, and tweens/);
  await expect(preview).toHaveAttribute('aria-pressed', 'false');
  await preview.focus();
  await expect(preview).toBeFocused();
  await editor.page.keyboard.press('Space');
  await expect(preview).toHaveAttribute('aria-pressed', 'true');
  await expect(editor.page.getByTestId('viewport')).toHaveAttribute(
    'data-motion-state',
    'previewing',
  );
  await editor.page.keyboard.press('Space');
  await expect(preview).toHaveAttribute('aria-pressed', 'false');

  // Play game is an action that opens a running surface, not a second toggle.
  await expect(play).not.toHaveAttribute('aria-pressed', /.+/);
  await expect(play).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(play).toHaveAttribute('data-state', 'stopped');
  await play.focus();
  await expect(play).toBeFocused();
  await editor.page.keyboard.press('Enter');

  const dialog = editor.page.getByRole('dialog', { name: 'Play game' });
  await expect(dialog).toHaveAttribute('data-state', 'running');
  await expect(dialog).toContainText('Play game running');
  await expect(editor.page.getByRole('button', { name: 'Restart', exact: true })).toBeVisible();
  await expect(editor.page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await editor.stopPlay();
});

test('both runtime modes preserve the authored document byte for byte', async ({ editor }) => {
  await setupFalling(editor);
  await editor.addObject('Particles');
  const before = (await editor.saveToFile()).contents;

  await editor.setPreview(true);
  await editor.setPreview(false);
  const afterPreview = (await editor.saveToFile()).contents;
  expect(afterPreview).toBe(before);

  await editor.play();
  await editor.restartPlay();
  await editor.stopPlay();
  const afterPlay = (await editor.saveToFile()).contents;
  expect(afterPlay).toBe(before);
});
