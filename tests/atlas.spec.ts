import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import { type EditorPage } from './helpers/editor';
import {
  ATLAS_FRAMES,
  REPACKED_FRAMES,
  atlasArray,
  atlasHash,
  atlasPng,
} from './helpers/atlas';

/**
 * Texture atlases: an image cut into named frames of any size.
 *
 * The suite picks its instrument per claim, and the two it leans on are
 * different in kind.
 *
 * **Colour** answers *which* frame is drawn, because each fixture frame is a
 * solid colour of its own — the instrument `animation.spec.ts` uses, and it is
 * what separates a cut that reached Phaser's parser from one that reached the
 * document only.
 *
 * **Extent** answers *what size* it is drawn, and it is the reading that proves
 * this is an atlas rather than a sheet with names on it. The fixture's frames
 * have different aspect ratios, which is the one thing four grid numbers cannot
 * describe — so an implementation that quietly fell back to a grid, or drew the
 * whole image, passes every colour claim here and fails this one. A centroid
 * could not make it: a two-pixel edge lands on a different sub-pixel phase on
 * each side, which moves a centroid by a tenth of the shape's width for a
 * reason that is not size.
 *
 * The **ratio** is asserted rather than the pixels, because the two projects
 * draw at different zooms and what is being claimed is about the picture, not
 * about the screen.
 */

const NAMES = ATLAS_FRAMES.map((frame) => frame.name);
const colourOf = (name: string) => ATLAS_FRAMES.find((f) => f.name === name)!.hex;

const atlasFile = (contents = atlasHash()) => ({ name: 'sheet.json', contents });
// The name is a parameter because the asset rows are located by it: importing a
// second image called `sheet.png` puts two rows titled "Use sheet.png" on the
// page, and `importImage`'s own wait then matches both.
const imageFile = (frames = ATLAS_FRAMES, name = 'sheet.png') => ({
  name,
  buffer: atlasPng(frames),
});

/**
 * One sprite drawing an atlas-cut image, scaled up, alone in the scene.
 *
 * Scaled for `animation.spec.ts`' reason: at the mobile project's zoom a 16px
 * frame is six screen pixels across, and every reading over six pixels is
 * antialiased edge. The scene is cleared because the starter project's three
 * objects are three more colours a centroid can pick up.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Image');
  await editor.importImage(imageFile());
  await editor.attachAtlas(atlasFile());
  await editor.setField('Scale X', 4);
  await editor.setField('Scale Y', 4);
}

/** The drawn box of one frame's colour, with its aspect ratio worked out. */
async function drawn(editor: EditorPage, name: string) {
  await editor.closePanels();
  const box = await editor.findDrawnBox(colourOf(name));
  expect(box.count, `frame ${name} should be drawn`).toBeGreaterThan(100);
  return { ...box, ratio: box.width / box.height };
}

test('an atlas cuts an image into named frames, and the frame field names them', async ({
  editor,
}) => {
  await setup(editor);

  await expect(editor.panel('inspect').getByText('3 named frames, 16×16 to 64×40px')).toBeVisible();
  expect(await editor.frameOptions()).toEqual(NAMES);

  // One frame's colour and none of the others. The whole image would put all
  // three on the canvas at once, which is what a cut that reached the document
  // and not Phaser's texture manager would draw.
  await editor.setFrameName('wide');
  const wide = await drawn(editor, 'wide');
  for (const other of ['tall', 'small']) {
    expect(
      (await editor.findDrawn(colourOf(other))).count,
      `frame ${other} should not be drawn`,
    ).toBe(0);
  }
  expect(wide.count).toBeGreaterThan(100);
});

test('the frames are drawn at their own sizes, which no grid could describe', async ({
  editor,
}) => {
  await setup(editor);

  // 64×16 and 16×40 in the source. What is asserted is that the two disagree
  // about their shape — the claim that fails the moment an atlas degrades to a
  // grid, where every frame is the same size by construction.
  await editor.setFrameName('wide');
  const wide = await drawn(editor, 'wide');
  expect(wide.ratio).toBeGreaterThan(2.5);

  await editor.setFrameName('tall');
  const tall = await drawn(editor, 'tall');
  expect(tall.ratio).toBeLessThan(0.7);

  // And the wide frame really is wider than the tall one is, rather than the
  // two merely being labelled differently.
  expect(wide.width).toBeGreaterThan(tall.width * 2);
  expect(tall.height).toBeGreaterThan(wide.height * 1.5);
});

test('a frame is named, not numbered, so a repack keeps what it points at', async ({
  editor,
}) => {
  await setup(editor);
  await editor.setFrameName('tall');
  const before = await drawn(editor, 'tall');

  // The same names in different places, and `small` gone. An index-based
  // implementation passes every other claim in this file and fails this one:
  // `tall` is entry 1 before the repack and entry 0 after it.
  await editor.importImage(imageFile(REPACKED_FRAMES, 'repacked.png'));
  await editor.attachAtlas(atlasFile(atlasHash(REPACKED_FRAMES)));

  const after = await drawn(editor, 'tall');
  expect(after.count).toBeGreaterThan(100);
  expect(after.ratio).toBeCloseTo(before.ratio, 0);
  expect(await editor.frameOptions()).toEqual(['tall', 'wide']);
});

test('an image is cut one way: slicing a grid and attaching an atlas exclude each other', async ({
  editor,
}) => {
  await setup(editor);

  // The atlas is on, so the grid checkbox is refused rather than silently
  // destroying it along with anything built on it.
  await editor.openPanel('inspect');
  await expect(editor.checkbox('Sliced into frames')).toBeDisabled();

  await editor.removeAtlas();
  await expect(editor.checkbox('Sliced into frames')).toBeEnabled();

  // And the other way: with a grid on, the atlas button says so instead of
  // offering a state that would do nothing.
  await editor.sliceSheet(16);
  await expect(
    editor.panel('inspect').getByRole('button', { name: /^Attach atlas…$/ }),
  ).toBeDisabled();

  const { contents } = await editor.saveToFile();
  const saved = JSON.parse(contents);
  expect(saved.assets[0].sheet).toBeDefined();
  expect(saved.assets[0].atlas).toBeUndefined();
});

test('an atlas survives a save and an open, linking by name', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.setFrameName('small');
  await drawn(editor, 'small');

  const { name, contents } = await editor.saveToFile();
  expect(name).toMatch(/\.phaser\.json$/);
  const saved = JSON.parse(contents);

  // The literal, so a bump is a deliberate act rather than something the suite
  // compares against itself and never notices.
  expect(saved.schemaVersion).toBe(13);
  expect(saved.assets[0].atlas).toEqual(
    ATLAS_FRAMES.map(({ name: frameName, x, y, w, h }) => ({
      name: frameName,
      x,
      y,
      width: w,
      height: h,
    })),
  );
  // The node stores the *name*, which is the whole of the linking rule.
  expect(saved.scenes[0].children[0].props.frame).toBe('small');

  const path = testInfo.outputPath('atlas.phaser.json');
  await fs.writeFile(path, contents, 'utf8');

  // A reload, not just a new project: the decode cache in `assets.ts` is
  // module-level, so re-opening a project this page has already decoded takes
  // the synchronous path and never reaches the branch every real open takes.
  // `fonts.spec.ts` learned this the hard way and it applies to any texture.
  await editor.reload();
  await editor.openFile(path);

  const reopened = await drawn(editor, 'small');
  expect(reopened.count).toBeGreaterThan(100);
  expect(reopened.ratio).toBeCloseTo(1, 0);
});

test('both of the packer JSON shapes describe the same cut', async ({ editor }) => {
  await setup(editor);
  const fromHash = JSON.parse((await editor.saveToFile()).contents).assets[0].atlas;

  await editor.newProject();
  await editor.clearScene();
  await editor.addObject('Image');
  await editor.importImage(imageFile());
  await editor.attachAtlas({ name: 'sheet.json', contents: atlasArray() });

  const fromArray = JSON.parse((await editor.saveToFile()).contents).assets[0].atlas;
  // A document claim rather than a drawn one: two files that describe the same
  // picture must import to the same cut, and a pixel test would pass if one
  // shape were silently ignored and the image drawn whole.
  expect(fromArray).toEqual(fromHash);
});

test('a clip over named frames keeps the names a repack kept, and goes when the atlas does', async ({
  editor,
}) => {
  await setup(editor);
  await editor.addAnimation();

  await editor.openPanel('inspect');
  await expect(editor.field('Frames')).toHaveValue(NAMES.join(', '));

  // A repack drops `small`, so the clip loses that frame and keeps the rest —
  // where a grid re-cut clamps, because a name has no neighbour to clamp to.
  //
  // In the *clip's* order, not the atlas's: the sequence is the thing the user
  // authored, and a repack that moved the rectangles around did not reorder
  // their animation. That is what makes a ping-pong survive one.
  await editor.attachAtlas(atlasFile(atlasHash(REPACKED_FRAMES)));
  await expect(editor.field('Frames')).toHaveValue('wide, tall');

  // Removing the cut removes the clip: names against a plain image index
  // nothing, and there is no sequence left to clamp to.
  await editor.removeAtlas();
  const saved = JSON.parse((await editor.saveToFile()).contents);
  expect(saved.animations).toEqual([]);
});

test('an atlas-cut image is not offered as a tileset', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Image');
  await editor.importImage(imageFile());
  await editor.attachAtlas(atlasFile());

  await editor.addObject('Tiles');
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByTitle('Use sheet.png').click();
  await editor.settle();

  // The usual advice — "slice this image into tiles" — would destroy the atlas,
  // so the panel says the true thing instead. A tileset needs a uniform tile
  // size and an atlas is the absence of one.
  await expect(
    editor.panel('inspect').getByText(/This image is cut into named frames/),
  ).toBeVisible();
});

test('the export loads the atlas and names the frame it draws', async ({ editor }) => {
  await setup(editor);
  await editor.setFrameName('tall');

  const still = (await editor.exportCode('ts')).contents;

  expect(still).toContain('const ATLASES = {');
  expect(still).toContain('this.load.atlas("sheet", ASSETS["sheet"], ATLASES["sheet"]);');
  expect(still).not.toContain('this.load.spritesheet');
  // The frames are in the table, and the still sprite names one in its own
  // call — a quoted name where a grid would print a bare number.
  expect(still).toContain('"tall": {"frame":{"x":0,"y":24,"w":16,"h":40}}');
  expect(still).toContain('this.add.image(480, 270, "sheet", "tall")');
});

test('the export registers a clip over named frames', async ({ editor }) => {
  await setup(editor);
  await editor.addAnimation();

  const { contents } = await editor.exportCode('ts');

  // The frames themselves, not `generateFrameNames`. That call's runtime would
  // do the right thing, but Phaser types its config's `frames` as
  // `boolean | number[]`, so the exported `.ts` would not compile under
  // `--strict` — and the shared `create()` body has nowhere to put a cast.
  // `export-toolchain.spec.ts` is what says so; this asserts the shape that
  // survives it.
  expect(contents).toContain('{ key: "sheet", frame: "wide" },');
  expect(contents).toContain('{ key: "sheet", frame: "small" },');
  expect(contents).not.toContain('generateFrameNumbers');
  // An animated sprite emits no frame argument at all — the clip owns the frame
  // — which is why the still case above is a test of its own rather than one
  // more assertion here.
  expect(contents).toContain('this.add.sprite(480, 270, "sheet")');
});

test('a project with no atlas emits no atlas table', async ({ editor }) => {
  // The rule every table before this one has followed: a project that predates
  // the feature exports byte for byte what it always did. A gate on "the asset
  // table has anything in it" rather than "something is cut by an atlas" would
  // pass every other test in this file and quietly break that.
  await editor.clearScene();
  await editor.addObject('Image');
  await editor.importImage(imageFile());
  await editor.sliceSheet(16);

  const { contents } = await editor.exportCode('ts');
  expect(contents).toContain('this.load.spritesheet');
  expect(contents).not.toContain('ATLASES');
});
