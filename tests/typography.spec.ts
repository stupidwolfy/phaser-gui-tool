import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';

/**
 * Text that is more than five fields: a stroke, a wrap, an alignment and the
 * rest of iteration 22.
 *
 * `text` keeps its "it draws, it drags, it survives a save and an open" duty in
 * `editing.spec.ts` — typography does not make it a sixth exception alongside
 * `sprite`, `tilemap`, `instance`, `nineslice` and `tileSprite`, because a
 * stroked, wrapped paragraph is visibly its own thing with no image imported
 * and nothing sliced. What is here is only what those five fields could not say.
 *
 * Two instruments, chosen per claim rather than by habit. **Extents** for the
 * wrap, because what is being asserted is how big something is drawn, and a
 * colour centroid moves by a tenth of a shape's width on antialiasing phase
 * alone — the reading that cost the camera frame 14px on one project and
 * nothing on the other. **A centroid** for the alignment, because there the box
 * is pinned by the longest line and what actually moves is the distribution of
 * glyphs inside it; an extent would assert nothing at all.
 *
 * Weight and slant are asserted through the document and the export instead of
 * through pixels, and deliberately: a font's bold face is the browser's, and a
 * headless container falling back to a synthesised one would make a pixel claim
 * about weight a claim about the machine.
 */

/**
 * The fill and the stroke, both of which have to clear every chrome colour by
 * more than `findColor`'s tolerance on at least one channel — it matches only
 * when *every* channel is within it, so "obviously a different colour" is not
 * the test. Against the outline 0x00e5ff, the guides 0xff3ea5 and 0xffa723, the
 * frame 0x5a6478, the emitter marker 0xff6bd6, the scene 0x1d2330, bodies
 * 0x00ff00, the camera 0x9b7bff, the touch rings 0xff5c33, the default fill
 * 0x4f8cff and white, the nearest miss for either of these is 57.
 */
const FILL = '#ffe066';
const STROKE = '#7a1fa2';

/** Big enough that a glyph is still several pixels wide at the mobile zoom. */
const FONT = 96;

/** An empty scene holding one selected text object, and nothing else to measure. */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Text');
}

/** That object, readable at the middle of the scene in the fixture colour. */
async function textAt(editor: EditorPage, content: string): Promise<void> {
  await editor.setField('Content', content);
  await editor.setField('Font size', FONT);
  await editor.setField('Text colour', FILL);
  await editor.setField('X', 480);
  await editor.setField('Y', 270);
}

/** A checkbox has no setter on the page object, and two of these want one. */
async function setFlag(editor: EditorPage, label: string): Promise<void> {
  await editor.openPanel('inspect');
  await editor.checkbox(label).check();
  await editor.settle();
}

/** Everything the two round-trip tests set, so neither can drift from the other. */
async function styleEverything(editor: EditorPage): Promise<void> {
  await setFlag(editor, 'Bold');
  await setFlag(editor, 'Italic');
  await editor.setChoice('Align', 'Centre');
  await editor.setField('Wrap width', 180);
  await editor.setField('Line spacing', 6);
  await editor.setField('Letter spacing', 2);
  await editor.setField('Stroke colour', STROKE);
  await editor.setField('Stroke width', 3);
  await editor.setField('Shadow colour', '#123456');
  await editor.setField('Shadow X', 4);
  await editor.setField('Shadow Y', -2);
  await editor.setField('Shadow blur', 5);
}

test('a stroke draws where the fill alone did not', async ({ editor }) => {
  await setup(editor);
  await textAt(editor, 'AVA');

  // Deselected before every reading: the scale handle keeps a 44px screen
  // target over the object's bottom-right corner and would occlude the very
  // pixels being measured.
  await editor.deselect();
  await editor.closePanels();
  expect((await editor.findDrawn(FILL)).count).toBeGreaterThan(50);
  expect((await editor.findDrawn(STROKE)).count).toBe(0);

  await editor.selectInTree('Text');
  await editor.setField('Stroke colour', STROKE);
  await editor.setField('Stroke width', 12);

  await editor.deselect();
  await editor.closePanels();
  expect((await editor.findDrawn(STROKE)).count).toBeGreaterThan(50);
  // The fill is still there: a stroke is drawn around the glyphs, not over them.
  expect((await editor.findDrawn(FILL)).count).toBeGreaterThan(50);
});

test('a wrap narrows the text and makes it taller', async ({ editor }) => {
  await setup(editor);
  await textAt(editor, 'wrap this paragraph');

  await editor.deselect();
  await editor.closePanels();
  const wide = await editor.findDrawnBox(FILL);
  expect(wide.count).toBeGreaterThan(50);

  await editor.selectInTree('Text');
  await editor.setField('Wrap width', 240);

  await editor.deselect();
  await editor.closePanels();
  const wrapped = await editor.findDrawnBox(FILL);

  // Proportional rather than absolute, because both ends of an extent carry a
  // colour boundary's sub-pixel phase and the scene is fitted to a different
  // zoom on each project. What is being claimed is that the paragraph changed
  // shape, not that it landed on a particular pixel.
  expect(wrapped.width).toBeLessThan(wide.width * 0.75);
  expect(wrapped.height).toBeGreaterThan(wide.height * 1.5);
});

test('alignment moves the glyphs inside the wrapped box', async ({ editor }) => {
  await setup(editor);
  await textAt(editor, 'wrap this paragraph');
  await editor.setField('Wrap width', 240);

  await editor.setChoice('Align', 'Left');
  await editor.deselect();
  await editor.closePanels();
  const left = await editor.findDrawn(FILL);
  expect(left.count).toBeGreaterThan(50);

  await editor.selectInTree('Text');
  await editor.setChoice('Align', 'Right');
  await editor.deselect();
  await editor.closePanels();
  const right = await editor.findDrawn(FILL);

  // The box is pinned by the longest line, so only the short one moves — a
  // centroid is the one reading that can see it, and the claim is the
  // direction rather than a distance.
  expect(right.x).toBeGreaterThan(left.x);
});

test('every typography field survives a save and an open', async ({ editor }) => {
  await setup(editor);
  await textAt(editor, 'styled');
  await styleEverything(editor);

  const saved = await editor.saveToFile();
  const project = JSON.parse(saved.contents);

  // Asserted so a future bump is a deliberate act rather than something that
  // happens to a file — the guides, scenes, physics, camera and behaviour
  // precedent. These are fields on `props`, which rides in on `scenes`, the one
  // part of a file the parser passes through verbatim, so a build that predates
  // them opens this file, draws the text with the three keys it knows and
  // carries the rest back out on a re-save. It reads 10 because fonts added a
  // project-level table one iteration later; typography itself did not bump.
  expect(project.schemaVersion).toBe(10);
  expect(project.scenes[0].children[0].props).toMatchObject({
    bold: true,
    italic: true,
    align: 'center',
    wordWrapWidth: 180,
    lineSpacing: 6,
    letterSpacing: 2,
    strokeColor: STROKE,
    strokeThickness: 3,
    shadowColor: '#123456',
    shadowOffsetX: 4,
    shadowOffsetY: -2,
    shadowBlur: 5,
  });
});

test('the export carries the style, and a plain text object exports what it always did', async ({
  editor,
}) => {
  await setup(editor);
  await textAt(editor, 'plain');

  const before = (await editor.exportCode('ts')).contents;
  // Byte-identity, asserted rather than assumed: a text node made before
  // iteration 22 derives a style whose every new key is at its default, so it
  // prints exactly the three keys it has always printed and nothing else.
  expect(before).toContain('fontFamily:');
  expect(before).toContain('fontSize: "96px"');
  expect(before).toContain(`color: "${FILL}"`);
  for (const key of ['fontStyle:', 'align:', 'wordWrap:', 'lineSpacing:', 'letterSpacing:']) {
    expect(before).not.toContain(key);
  }
  for (const key of ['stroke:', 'strokeThickness:', 'shadow:', 'padding:']) {
    expect(before).not.toContain(key);
  }

  await editor.selectInTree('Text');
  await styleEverything(editor);

  const after = (await editor.exportCode('ts')).contents;
  expect(after).toContain('fontStyle: "bold italic"');
  expect(after).toContain('align: "center"');
  expect(after).toContain('wordWrap: { width: 180 }');
  expect(after).toContain('lineSpacing: 6');
  expect(after).toContain('letterSpacing: 2');
  expect(after).toContain(`stroke: "${STROKE}"`);
  expect(after).toContain('strokeThickness: 3');
  // `stroke` and `fill` are not decoration in there: Phaser's property map
  // defaults both to false, so a shadow emitted without them is computed and
  // never painted.
  expect(after).toContain('stroke: true, fill: true }');
  // Derived from the stroke and the shadow rather than stored, and emitted
  // because Phaser sizes a text canvas from the glyphs alone and would
  // otherwise clip both.
  expect(after).toContain('padding: { x: 9, y: 7 }');
});
