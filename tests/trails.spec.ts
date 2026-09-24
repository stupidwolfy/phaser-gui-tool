import { expect, test } from './helpers/fixtures';
import { reaches } from './helpers/poll';
import { type EditorPage } from './helpers/editor';
import { solidPng } from './helpers/png';

/**
 * Particle trails: an emitter that follows another object.
 *
 * While a follow is in force the emitter's own `x`/`y` is an *offset* from its
 * target, because that is what Phaser computes — it fires at `target.x` and
 * then draws through the emitter's own transform. Every claim here is about
 * that one fact from a different side: setting a follow must not move the
 * emitter on screen, moving the target must move it, moving both must not move
 * it twice, and a follow Phaser would honour wrongly is not honoured at all.
 *
 * The emitter is measured by its marker, which a stopped emitter draws with no
 * image at all, so most of these need no fixture. The one claim about particles
 * themselves — that ▶ leaves a trail behind a *moving* target — imports one.
 */

/** The colour the editor draws a stopped emitter's marker in. */
const MARKER = '#ff6bd6';
/** `particles.spec.ts`' particle colour, already checked against the chrome. */
const PARTICLE = '#00ff6a';

const PLAYER = { x: 200, y: 270 };
const SMOKE = { x: 600, y: 270 };

/** Screenshot centroids and CSS-pixel maths agree to a few pixels. */
const NEAR = 10;

/** A player and an emitter beside it, the emitter selected and not yet following. */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Player');
  await editor.setField('Width', 120);
  await editor.setField('Height', 80);
  await editor.setField('X', PLAYER.x);
  await editor.setField('Y', PLAYER.y);

  await editor.addObject('Particles');
  await editor.setField('Name', 'Smoke');
  await editor.setField('X', SMOKE.x);
  await editor.setField('Y', SMOKE.y);
}

/** Where the marker is drawn, with nothing selected to draw over it. */
async function markerAt(editor: EditorPage) {
  await editor.deselect();
  await editor.closePanels();
  return editor.findDrawn(MARKER);
}

async function expectMarkerAt(editor: EditorPage, scene: { x: number; y: number }) {
  const marker = await markerAt(editor);
  const expected = await editor.sceneToScreen(scene);
  expect(marker.count, 'the emitter drew no marker').toBeGreaterThan(100);
  expect(Math.abs(marker.x - expected.x)).toBeLessThan(NEAR);
  expect(Math.abs(marker.y - expected.y)).toBeLessThan(NEAR);
}

/** The saved scene's nodes, by name. */
async function savedByName(editor: EditorPage, sceneIndex = 0) {
  const saved = await editor.saveToFile();
  const project = JSON.parse(saved.contents);
  const children: {
    id: string;
    name: string;
    transform: { x: number; y: number };
    props: { followId?: string };
  }[] = project.scenes[sceneIndex].children;
  return { project, byName: new Map(children.map((node) => [node.name, node])) };
}

test('following leaves the emitter where it is drawn, and makes its position an offset', async ({
  editor,
}) => {
  await setup(editor);
  await editor.setChoice('Emitter follows', 'Player');

  // The emitter did not move on screen, and its stored position is now
  // measured from the player — `moveNode`'s reparenting rule, on a follow.
  expect(await editor.numberValue('X')).toBe(SMOKE.x - PLAYER.x);
  expect(await editor.numberValue('Y')).toBe(0);
  await expect(editor.panel('inspect').getByText('X and Y are now measured from Player')).toBeVisible();
  await expectMarkerAt(editor, SMOKE);

  const { project, byName } = await savedByName(editor);
  expect(byName.get('Smoke')?.props.followId).toBe(byName.get('Player')?.id);
  expect(byName.get('Smoke')?.transform).toMatchObject({ x: 400, y: 0 });
  // 16 because of this field: an older build would draw and export the emitter
  // at its bare offset, beside the scene's corner.
  expect(project.schemaVersion).toBe(16);

  // Choosing nothing adds the target back, so stopping does not move it either.
  await editor.selectInTree('Smoke');
  await editor.setChoice('Emitter follows', 'Nothing');
  expect(await editor.numberValue('X')).toBe(SMOKE.x);
  await expectMarkerAt(editor, SMOKE);
});

test('the trail goes where its object goes', async ({ editor }) => {
  await setup(editor);
  await editor.setChoice('Emitter follows', 'Player');

  await editor.selectInTree('Player');
  await editor.setField('X', PLAYER.x + 100);
  await expectMarkerAt(editor, { x: SMOKE.x + 100, y: SMOKE.y });
});

test('aligning an object and its trail moves the trail once', async ({ editor }) => {
  await setup(editor);
  await editor.setChoice('Emitter follows', 'Player');

  // Smoke is selected from the add; Player joins it.
  await editor.setMultiSelect(true);
  await editor.selectInTree('Player');
  await editor.setMultiSelect(false);

  // Right edges: the player's is 260 and the marker's 648, so the player moves
  // right by 388 and the emitter is already there. Its *offset* therefore has to
  // lose the 388 the player gained — without `compensateFollowers` it keeps 400
  // and is drawn at 988, off the far side of the scene.
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: 'Right', exact: true }).click();
  await editor.settle();

  const { byName } = await savedByName(editor);
  expect(byName.get('Player')?.transform.x).toBe(588);
  expect(byName.get('Smoke')?.transform.x).toBe(12);
  await expectMarkerAt(editor, SMOKE);
});

test('a nudge carries a trail with its object rather than moving it twice', async ({
  editor,
  page,
}) => {
  await setup(editor);
  await editor.setChoice('Emitter follows', 'Player');
  await editor.setMultiSelect(true);
  await editor.selectInTree('Player');
  await editor.setMultiSelect(false);

  await page.keyboard.press('Shift+ArrowRight');
  await editor.settle();

  const { byName } = await savedByName(editor);
  expect(byName.get('Player')?.transform.x).toBe(PLAYER.x + 10);
  expect(byName.get('Smoke')?.transform.x).toBe(SMOKE.x - PLAYER.x);
  await expectMarkerAt(editor, { x: SMOKE.x + 10, y: SMOKE.y });
});

test('a turned emitter stops following, says why, and follows again when put back', async ({
  editor,
}) => {
  await setup(editor);
  await editor.setChoice('Emitter follows', 'Player');

  await editor.setField('Rotation°', 30);
  await expect(
    editor.panel('inspect').getByText('Not following while this emitter is turned or scaled'),
  ).toBeVisible();
  // Kept, not deleted: turning it back brings the trail back.
  const { byName } = await savedByName(editor);
  expect(byName.get('Smoke')?.props.followId).toBe(byName.get('Player')?.id);

  await editor.selectInTree('Smoke');
  await editor.setField('Rotation°', 0);
  await expect(
    editor.panel('inspect').getByText('Not following while this emitter is turned or scaled'),
  ).toHaveCount(0);
  await expectMarkerAt(editor, SMOKE);
});

test('an emitter inside a group is offered no follow', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.addObject('Group');
  // Adding lands in the selected group.
  await editor.addObject('Particles');

  await editor.openPanel('inspect');
  await expect(
    editor.panel('inspect').getByText('Only an emitter placed directly in the scene can follow'),
  ).toBeVisible();
  await expect(editor.panel('inspect').getByText('Emitter follows', { exact: true })).toHaveCount(0);
});

test('a duplicated scene keeps its trail on its own copy of the object', async ({ editor }) => {
  await setup(editor);
  await editor.setChoice('Emitter follows', 'Player');
  await editor.duplicateScene();

  await expectMarkerAt(editor, SMOKE);
  const { byName } = await savedByName(editor, 1);
  expect(byName.get('Smoke')?.props.followId).toBe(byName.get('Player')?.id);
});

test('under ▶ a trail is left behind an object that moves', async ({ editor }) => {
  await setup(editor);
  await editor.importImage({ name: 'smoke.png', buffer: solidPng(64, 64, PARTICLE) });
  // `particles.spec.ts`' pinned emitter: particles stay where they are fired,
  // one size, opaque, and alive for the whole assertion.
  await editor.setField('Speed min', 0);
  await editor.setField('Speed max', 0);
  await editor.setField('Scale start', 1);
  await editor.setField('Scale end', 1);
  await editor.setField('Alpha start', 1);
  await editor.setField('Alpha end', 1);
  await editor.setField('Lifespan', 8000);
  // On the player, so the trail is fired from its middle.
  await editor.setField('X', PLAYER.x);
  await editor.setChoice('Emitter follows', 'Player');

  await editor.selectInTree('Player');
  await editor.setTween(true);
  await editor.setTweenTarget('X', 760);
  await editor.setField('Tween duration ms', 4000);
  await editor.setField('Tween repeat', -1);

  await editor.setPreview(true);
  await editor.deselect();
  await editor.closePanels();

  // A standing emitter throws a 64-unit block and nothing wider; one that
  // follows leaves particles along the player's path. Scene units, because the
  // two projects draw at different zooms.
  const zoom = await editor.zoom();
  const spread = await reaches(
    async () => (await editor.findDrawnBox(PARTICLE)).width / zoom,
    (width) => width > 250,
  );
  expect(spread, 'the particles stayed on the emitter').toBeGreaterThan(250);
});
