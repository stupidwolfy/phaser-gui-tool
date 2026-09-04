import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { SCENE, type EditorPage } from './helpers/editor';
import { stripPng } from './helpers/png';

/**
 * Sprite sheets and animations.
 *
 * Two things here are only ever visible on the canvas, so both are checked
 * against pixels rather than against the document: that slicing an image makes
 * a sprite draw *one* frame of it rather than the whole strip, and that a
 * playing animation actually advances through them. A store-level assertion
 * would pass on a sheet that was cut but never handed to Phaser's parser, which
 * is precisely the mistake worth catching.
 */

/** One colour per frame, so a colour centroid answers "which frame is drawn". */
const FRAMES = ['#22cc44', '#cc2244', '#2244cc', '#cccc22'] as const;
const FRAME_SIZE = 32;

const sheetPng = () => ({
  name: 'walk.png',
  buffer: stripPng(FRAME_SIZE, [...FRAMES]),
});

/**
 * A single sliced sprite, scaled up, alone in the scene.
 *
 * The scale is what makes the assertions robust rather than decorative: at the
 * mobile project's zoom of ~0.37 a 32px frame is 12 screen pixels across, and a
 * centroid over ~140 pixels tolerates the antialiased edge that a centroid over
 * ~14 does not. The scene is cleared first because the starter project's three
 * objects are three more colours a centroid could pick up, and this suite
 * asserts exact ones.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Image');
  await editor.importImage(sheetPng());
  await editor.sliceSheet(FRAME_SIZE);
  await editor.setField('Scale X', 4);
  await editor.setField('Scale Y', 4);
}

test('slicing an image draws one frame of it, and the frame field picks which', async ({
  editor,
}) => {
  await setup(editor);
  await expect(editor.panel('inspect').getByText('4 frames (4×1) of 32×32px')).toBeVisible();

  await editor.closePanels();

  // The whole strip would put all four colours on the canvas at once. One
  // frame is the first colour and nothing else — which is the assertion that
  // the grid reached Phaser's parser rather than merely the document.
  const first = await editor.findDrawn(FRAMES[0]);
  expect(first.count).toBeGreaterThan(100);
  for (const other of FRAMES.slice(1)) {
    expect((await editor.findDrawn(other)).count, `frame ${other} should not be drawn`).toBe(0);
  }

  // Centred, so the sprite is one frame wide rather than the strip's width.
  const centre = await editor.sceneToScreen({ x: SCENE.width / 2, y: SCENE.height / 2 });
  expect(Math.abs(first.x - centre.x)).toBeLessThan(6);
  expect(Math.abs(first.y - centre.y)).toBeLessThan(6);

  await editor.setField('Frame', 2);
  await editor.closePanels();
  expect((await editor.findDrawn(FRAMES[2])).count).toBeGreaterThan(100);
  expect((await editor.findDrawn(FRAMES[0])).count).toBe(0);
});

test('an animation plays only while preview is on, and stops on its own frame', async ({
  editor,
}) => {
  await setup(editor);
  await editor.setField('Frame', 3);
  await editor.addAnimation();

  // Creating a clip assigns it, but the canvas stays still: preview is off by
  // default precisely so that placing an object is not a matter of timing.
  await editor.closePanels();
  expect((await editor.findDrawn(FRAMES[3])).count).toBeGreaterThan(100);

  await editor.setPreview(true);

  // Which frame is up at any instant is a race with the frame rate, so the
  // claim under test is "it reaches a frame it did not start on" — polled,
  // because that is a statement about time passing rather than about one shot.
  await expect
    .poll(
      async () => {
        for (const [index, colour] of FRAMES.entries()) {
          if (index === 3) continue;
          if ((await editor.findDrawn(colour)).count > 100) return true;
        }
        return false;
      },
      { timeout: 10_000, message: 'the animation never advanced past its starting frame' },
    )
    .toBe(true);

  // Stopping puts it back on the document's frame rather than wherever the
  // playhead happened to be — the field and the canvas have to agree again.
  await editor.setPreview(false);
  await expect
    .poll(async () => (await editor.findDrawn(FRAMES[3])).count, { timeout: 5_000 })
    .toBeGreaterThan(100);
});

test('a sheet and its animation survive a save and an open', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.addAnimation();
  await editor.setField('Animation name', 'walk');
  await editor.setField('Frames', '0-2');
  await editor.setField('Frames/sec', 6);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);

  // The bump is load-bearing: a v3 build rebuilds assets field by field and
  // names the project's fields one at a time, so it would silently drop both of
  // these and write the file back without them. 5 as of prefabs, which bumped
  // it again for that same reason and for a type an older build cannot draw.
  expect(parsed.schemaVersion).toBe(6);
  expect(parsed.assets[0].sheet).toEqual({
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    margin: 0,
    spacing: 0,
  });
  expect(parsed.animations).toHaveLength(1);
  expect(parsed.animations[0]).toMatchObject({ name: 'walk', frames: [0, 1, 2], frameRate: 6 });

  const path = testInfo.outputPath('animated.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);
  await editor.closePanels();

  // Opening always waits on a decode, and the sheet has to be re-cut from the
  // stored grid when it lands — otherwise the whole strip is drawn.
  await expect
    .poll(async () => (await editor.findDrawn(FRAMES[0])).count, { timeout: 10_000 })
    .toBeGreaterThan(100);
  expect((await editor.findDrawn(FRAMES[3])).count).toBe(0);
});

test('un-slicing an image draws it whole again and takes its animations with it', async ({
  editor,
}) => {
  await setup(editor);
  await editor.addAnimation();

  await editor.openPanel('inspect');
  await editor.checkbox('Sliced into frames').click();
  await editor.closePanels();

  // Every colour at once is the strip drawn whole, which is what an image with
  // no grid is.
  for (const colour of FRAMES) {
    expect((await editor.findDrawn(colour)).count, `${colour} should be drawn`).toBeGreaterThan(20);
  }

  // The clip went with the grid: its frame indices had nothing left to index.
  await editor.openPanel('inspect');
  await expect(editor.panel('inspect').getByText('Slice this image into frames')).toBeVisible();
});

test('an exported scene loads the sheet and plays the clip', async ({ editor }) => {
  await setup(editor);
  await editor.addAnimation();
  await editor.setField('Animation name', 'walk');

  const exported = await editor.exportCode('ts');
  expect(exported.contents).toContain('this.load.spritesheet(');
  expect(exported.contents).toContain('frameWidth: 32');
  expect(exported.contents).toContain('key: "walk"');
  expect(exported.contents).toContain('generateFrameNumbers');
  expect(exported.contents).toContain('.play("walk")');
  // A sprite, not an image: only a Sprite carries an AnimationState.
  expect(exported.contents).toContain('this.add.sprite(');
});
