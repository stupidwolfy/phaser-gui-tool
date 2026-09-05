import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { toneWav } from './helpers/wav';

/**
 * Audio, which is the one feature here with nothing on the canvas to check.
 *
 * Every other suite ends at a pixel, because the rule is to assert what is
 * drawn rather than what is stored. A sound draws nothing, so the claims this
 * file can make are the ones either side of the canvas: that the bytes survive
 * an import, a save and an open, that the document says what the panel says,
 * and that the export loads and registers what the scene asked for. The
 * exported page is *run* in `export.spec.ts`, which is where the claim "these
 * bytes decode in a real browser" is actually made.
 */

const wav = () => ({ name: 'jump.wav', buffer: toneWav(120, 440) });

test('imports a sound and registers it in the scene', async ({ editor }) => {
  await editor.importAudio(wav());

  const panel = editor.panel('inspect');
  // The key as well as the name: it is what a hand-written `play()` call needs,
  // and "jump.wav" keying as `jump` is exactly the step a user cannot guess.
  await expect(panel.getByText(/plays as jump/)).toBeVisible();

  // Importing does not register it — a sound in the table and in no scene is a
  // sound the export deliberately does not carry.
  await expect(panel.getByText('In this scene')).toHaveCount(0);

  await editor.addSceneSound('jump.wav');
  await expect(panel.getByText('In this scene')).toBeVisible();
  await expect(editor.checkbox('Play on scene start')).not.toBeChecked();
});

test('a registered sound survives a save and an open', async ({ editor }, testInfo) => {
  await editor.importAudio(wav());
  await editor.addSceneSound('jump.wav');
  await editor.setField('Volume', 0.25);
  await editor.checkbox('Loop').check();

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);

  // Asserted in the artefact so that a future bump is a deliberate act, the way
  // `guides.spec`, `scenes.spec` and `physics.spec` each assert their own.
  expect(parsed.schemaVersion).toBe(9);
  expect(parsed.audio).toHaveLength(1);
  // Nothing but the five allowed mime types is ever written or read back.
  expect(parsed.audio[0].dataUrl).toMatch(/^data:audio\/wav;base64,/);
  expect(parsed.scenes[0].sounds).toHaveLength(1);
  expect(parsed.scenes[0].sounds[0]).toMatchObject({ loop: true, volume: 0.25 });

  const path = testInfo.outputPath('with-audio.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);
  await editor.deselect();
  await editor.openPanel('inspect');
  await expect(editor.panel('inspect').getByTitle('Use jump.wav')).toBeVisible();
  await expect(editor.numberValue('Volume')).resolves.toBe(0.25);
});

test('removing a sound takes the scene entry with it', async ({ editor, page }) => {
  await editor.importAudio(wav());
  await editor.addSceneSound('jump.wav');

  // The confirm says how many scenes are about to lose it, rather than only
  // asking whether the user is sure.
  page.on('dialog', (dialog) => {
    expect(dialog.message()).toContain('1 scene');
    void dialog.accept();
  });

  const panel = editor.panel('inspect');
  await panel.getByRole('button', { name: 'Remove jump.wav' }).click();

  await expect(panel.getByText('In this scene')).toHaveCount(0);
  await expect(panel.getByTitle('Use jump.wav')).toHaveCount(0);
});

test('a sound registered in a scene reaches the export', async ({ editor }) => {
  await editor.importAudio(wav());
  await editor.addSceneSound('jump.wav');
  await editor.checkbox('Play on scene start').check();

  const exported = await editor.exportCode('ts');

  expect(exported.contents).toContain('const AUDIO = {');
  expect(exported.contents).toContain('this.load.audio("jump", AUDIO["jump"]);');
  expect(exported.contents).toContain('this.sound.add("jump", { loop: false, volume: 1 })');
  expect(exported.contents).toContain('jumpSound.play();');
});

test('a project with no sounds exports no audio at all', async ({ editor }) => {
  // The regression that matters most: everything made before this feature has
  // to export byte for byte what it always did.
  const exported = await editor.exportCode('ts');

  expect(exported.contents).not.toContain('AUDIO');
  expect(exported.contents).not.toContain('load.audio');
  expect(exported.contents).not.toContain('sound.add');
});
