import { promises as fs } from 'node:fs';
import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';
import { blockTtf } from './helpers/ttf';

/**
 * Web fonts: the hole iteration 22 left, which was that `fontFamily` named a
 * font the *page* had to already have.
 *
 * The claim that matters is a drawn one, and it needs an instrument that can
 * actually see a typeface. A **colour** cannot: text is the same colour in
 * every font, so the reading every other suite reaches for says nothing at all
 * here. An **extent** says how big the text is drawn, which is most of it. And
 * a **density** — matched pixels over the area of that extent — is what says
 * *which* face, because the fixture's every glyph is a filled em-square (see
 * `helpers/ttf.ts`), so text set in it inks nearly all of its own box where a
 * real face inks a fraction. That last one is a property of the shapes rather
 * than their size, so unlike a width it does not move with the zoom, the font
 * size or the string.
 *
 * The rest is either side of the canvas, the way `audio.spec.ts` is: that the
 * bytes survive a round trip, that removing a font leaves the objects alone,
 * and that the export carries the scene rather than the workbench.
 *
 * Two of these tests are here because they failed before the code was right,
 * and both would pass on a reading taken a moment earlier or later: the cold
 * boot (the style cache has to be cleared when a face lands, or the text stays
 * measured in the fallback) and the reused family (a face tracked by name alone
 * survives into a project that means something else by it).
 */

/** Distinct enough to clear every chrome colour — `typography.spec.ts`' list. */
const FILL = '#ffe066';

/** Big enough that a glyph is many pixels across even at the mobile zoom. */
const FONT_SIZE = 96;

const chunky = () => ({ name: 'Chunky Block.ttf', buffer: blockTtf() });

/** A second face, identical but for its advance — see `blockTtf`. */
const narrow = () => ({ name: 'narrow.ttf', buffer: blockTtf(400) });

/**
 * One selected text object on an empty scene, with nothing else to measure.
 *
 * `lll` rather than a word, and the choice is the instrument. Three narrow
 * letters cover almost none of the box they sit in, where three of this
 * fixture's glyphs cover nearly all of it — so the difference between "a system
 * font" and "the imported font" is a factor of three in width and a factor of
 * three in density, rather than the few percent a wide letter like `M` would
 * have given. A fixture that made the claim marginal would be a test that
 * passed on the machine it was written on.
 */
async function setup(editor: EditorPage, content = 'lll'): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Text');
  await editor.setField('Content', content);
  await editor.setField('Font size', FONT_SIZE);
  await editor.setField('Text colour', FILL);
  await editor.setField('X', 480);
  await editor.setField('Y', 270);
}

/**
 * How wide the text is drawn, and how much of that box it actually inks.
 *
 * An extent, because what is being asserted is how big something is drawn —
 * `typography.spec.ts`' rule. The **density** beside it is what an extent alone
 * cannot say and what this suite needs: which typeface. Every glyph in the
 * fixture is a filled square, so text set in it inks nearly the whole of its
 * own bounding box, where a real face inks a fraction of one. That is a
 * property of the shapes rather than of their size, so unlike a width it does
 * not move with the zoom, the font size or the string.
 *
 * Deselected first for `typography.spec.ts`' reason: the scale handle keeps a
 * 44px screen target over the object's bottom-right corner and would occlude
 * the very pixels being measured.
 */
async function drawn(editor: EditorPage): Promise<{ width: number; density: number }> {
  await editor.deselect();
  await editor.closePanels();
  const box = await editor.findDrawnBox(FILL);
  expect(box.count).toBeGreaterThan(50);
  return { width: box.width, density: box.count / (box.width * box.height) };
}

/** The width alone, for the claims that are only about size. */
async function drawnWidth(editor: EditorPage): Promise<number> {
  return (await drawn(editor)).width;
}

test('an imported font changes what the canvas draws', async ({ editor }) => {
  await setup(editor);
  const before = await drawn(editor);

  await editor.selectInTree('Text');
  await editor.importFont(chunky());

  // The picker shows the derived family, because that is the string Font family
  // has to say and "Chunky Block.ttf" does not spell it.
  await expect(editor.panel('inspect').getByText(/draws as ChunkyBlock/)).toBeVisible();

  // Importing picks it, so the field now names the font rather than the stack a
  // new text node ships with.
  await expect(editor.field('Font family')).toHaveValue('ChunkyBlock');

  const after = await drawn(editor);
  // Three filled squares, where `lll` in any system face is three thin bars in
  // a box mostly made of gap. Both readings say so and they say it
  // independently: the text got much wider, and what it draws inside that width
  // went from mostly background to almost solid.
  //
  // Neither bound is tight against a measured value on purpose. The "before"
  // face is whatever the container happens to have, so an exact figure would be
  // a claim about the machine rather than about the font — which is the same
  // reason `typography.spec.ts` asserts weight through the document.
  expect(after.width).toBeGreaterThan(before.width * 1.5);
  expect(before.density).toBeLessThan(0.6);
  expect(after.density).toBeGreaterThan(0.8);
});

test('two fonts draw the same string at two widths', async ({ editor }) => {
  await setup(editor);
  await editor.selectInTree('Text');

  await editor.importFont(chunky());
  const wide = await drawnWidth(editor);

  await editor.selectInTree('Text');
  await editor.importFont(narrow());
  await expect(editor.field('Font family')).toHaveValue('Narrow');
  const tight = await drawnWidth(editor);

  // The two faces have identical glyphs and different advances — 800 against
  // 400 units of a 1000-unit em — so this is the sharpest statement available
  // that the canvas is drawing the font the document names rather than one it
  // already had: nothing but the family changed between the two shots.
  expect(tight).toBeLessThan(wide * 0.75);
});

test('a font survives a save and an open', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.selectInTree('Text');
  await editor.importFont(chunky());

  const drawn = await drawnWidth(editor);

  // The canvas first, then the file: on mobile the file sheet covers the canvas,
  // so a reading taken after a save screenshots the sheet.
  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);

  // Asserted in the artefact so a future bump is a deliberate act, the way
  // `audio.spec`, `guides.spec` and the rest each assert their own. This is the
  // bump fonts caused: a project-level table a v9 build would silently drop.
  expect(parsed.schemaVersion).toBe(10);
  expect(parsed.fonts).toHaveLength(1);
  expect(parsed.fonts[0]).toMatchObject({ name: 'Chunky Block.ttf', family: 'ChunkyBlock' });
  // Nothing but the four allowed mime types is ever written or read back — and
  // this one was derived from the extension, since the import was handed no
  // mime at all.
  expect(parsed.fonts[0].mimeType).toBe('font/ttf');
  expect(parsed.fonts[0].dataUrl).toMatch(/^data:font\/ttf;base64,/);
  // The link is the family named in the node, not an id.
  expect(parsed.scenes[0].children[0].props.fontFamily).toBe('ChunkyBlock');

  const path = testInfo.outputPath('with-font.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await editor.openFile(path);

  // The decode-on-open path: nothing is in the font cache when a project is
  // opened, so this is the load that has to land and then re-lay the text out.
  // It is also the one that fails silently if `syncFonts` does not clear the
  // style cache — the text would come back at its fallback width.
  await expect
    .poll(async () => (await editor.findDrawnBox(FILL)).width, { timeout: 5000 })
    .toBeCloseTo(drawn, -1);
});

test('a font is applied after a cold boot decodes it', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.selectInTree('Text');
  await editor.importFont(chunky());
  const wanted = await drawnWidth(editor);

  const saved = await editor.saveToFile();
  const path = testInfo.outputPath('cold-boot.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  // A reload, and then the file — not a `newProject` and the file. The reload
  // is what empties the module-level decode cache, which is the only way to
  // reach the asynchronous branch of `syncFonts` from a test at all; opening
  // the file afterwards is what makes it deterministic, since the autosaved
  // draft this comes back on is written on an 800ms debounce and may or may not
  // have caught the import.
  await editor.reload();
  await editor.openFile(path);
  await editor.closePanels();

  // What makes this the sharpest test here is that the failure it catches is
  // invisible from the document. The load lands, the face registers, the sync
  // re-runs — and the text stays at its fallback width, because the style
  // signature `applyTextStyle` guards on did not change by a character and
  // Phaser's `Text` has no reason to re-measure a canvas it already rasterised.
  // Only clearing that cache when the face arrives fixes it, and only a reading
  // of the pixels can tell.
  await expect
    .poll(async () => (await editor.findDrawnBox(FILL)).width, { timeout: 10_000 })
    .toBeCloseTo(wanted, -1);
});

test('a font named after a CSS generic does not take its name', async ({ editor }) => {
  await setup(editor);
  await editor.selectInTree('Text');
  await editor.importFont({ name: 'serif.ttf', buffer: blockTtf() });

  // `Serif` would register fine and then lose every lookup to the CSS keyword,
  // which is matched case-insensitively and wins — so the editor would say the
  // font was applied and the canvas would draw the browser's default serif.
  await expect(editor.field('Font family')).toHaveValue('Serif2');

  // And it is applied, which is the half a name check alone would not prove.
  expect((await drawn(editor)).density).toBeGreaterThan(0.8);
});

test('a second project reusing a family gets its own face', async ({ editor }, testInfo) => {
  // Two projects whose fonts are different files under the same name, so both
  // derive the family `Reused`. The narrow one is saved first.
  await setup(editor);
  await editor.selectInTree('Text');
  await editor.importFont({ name: 'reused.ttf', buffer: blockTtf(400) });
  await expect(editor.field('Font family')).toHaveValue('Reused');
  const narrowWidth = await drawnWidth(editor);

  const saved = await editor.saveToFile();
  const path = testInfo.outputPath('reused-family.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');

  await editor.newProject();
  await setup(editor);
  await editor.selectInTree('Text');
  await editor.importFont({ name: 'reused.ttf', buffer: blockTtf() });
  const wideWidth = await drawnWidth(editor);
  expect(wideWidth).toBeGreaterThan(narrowWidth * 1.5);

  // Straight from one project to the other with **no empty state in between**,
  // which is the whole point of the fixture. Going via a new project would let
  // `syncFonts`' prune drop the family before the next one arrives, and the bug
  // this guards would not reproduce: tracked by family alone, a sync that sees
  // `Reused` both before and after adds nothing and prunes nothing, so the
  // first project's glyphs go on being drawn for the second project's font.
  await editor.openFile(path);
  await editor.closePanels();

  await expect
    .poll(async () => (await editor.findDrawnBox(FILL)).width, { timeout: 10_000 })
    .toBeCloseTo(narrowWidth, -1);
});

test('removing a font leaves the text alone', async ({ editor }) => {
  await setup(editor);
  await editor.selectInTree('Text');
  await editor.importFont(chunky());
  const withFont = await drawnWidth(editor);

  await editor.selectInTree('Text');
  await editor.openPanel('inspect');
  // Nothing uses it as far as the warning is concerned only if the count is
  // zero; it is one here, so the confirm has to be accepted.
  editor.page.once('dialog', (dialog) => void dialog.accept());
  await editor.panel('inspect').getByLabel('Remove Chunky Block.ttf').click();
  await editor.settle();

  // The node keeps the name the user chose. That is the whole of the
  // family-name design: there is no id to dangle, so nothing had to be rewritten
  // and the text is simply back to naming a font the browser has to supply.
  await expect(editor.field('Font family')).toHaveValue('ChunkyBlock');

  const without = await drawnWidth(editor);
  expect(without).toBeLessThan(withFont * 0.75);
});

test('the export carries the fonts the scene uses, and no others', async ({ editor }) => {
  await setup(editor);
  await editor.selectInTree('Text');
  await editor.importFont(chunky());
  // Imported, then not used by anything, because importing picks the last one.
  await editor.selectInTree('Text');
  await editor.importFont(narrow());
  await editor.selectInTree('Text');
  await editor.setField('Font family', 'ChunkyBlock, sans-serif');

  const { contents: exported } = await editor.exportCode('ts');

  // The key is the family, which is what makes the `fontFamily` beside it
  // resolve at all.
  expect(exported).toContain('this.load.font("ChunkyBlock", FONTS["ChunkyBlock"], "truetype");');
  expect(exported).toContain('fontFamily: "ChunkyBlock, sans-serif"');
  // A stack asks for the imported half and not the browser's half.
  expect(exported).not.toContain('"sans-serif": ');
  // The workbench does not ship: a font in the table that no text node names is
  // as absent from the export as a sound no scene registers.
  expect(exported).not.toContain('Narrow');
  // Phaser's loader builds the FontFace itself, so no CSS ever reaches the page.
  expect(exported).not.toContain('@font-face');
});
