import { promises as fs } from 'node:fs';

import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';

/**
 * A label that follows a variable: what a text object *says*, sourced from the
 * project's own table rather than from its `text` field alone.
 *
 * It belongs in neither of the two files it sits between, which is why it is a
 * third. `rules.spec.ts` is built around "the editor runs none of it", and a
 * label is the opposite claim — the canvas *does* show it, at boot, because the
 * variable's starting value is the document's own statement about the frame the
 * game opens on rather than anything simulated. `typography.spec.ts` is scoped
 * to iteration 22's twelve drawing fields and hands `text`'s "it draws and it
 * survives a save" duty back to `editing.spec.ts`; this is a third subject.
 *
 * **The instrument is an extent, never a centroid**, for the reason
 * `fonts.spec.ts` already states: text is one colour however much of it there
 * is, so the only thing a screenshot can say about a string is how wide it is
 * drawn. Every claim here is therefore of the form "this draws wider than that".
 *
 * The positive *runtime* claim — a label that follows a score while the game
 * runs, with nothing writing its text — cannot live here at all, because the
 * editor runs no rule. It is in `export.spec.ts`, which is where anything that
 * has to actually run belongs.
 */

/**
 * The fill, which has to clear every chrome colour by more than `findColor`'s
 * tolerance on at least one channel. `typography.spec.ts`' own, and for its
 * reasoning: against the outline 0x00e5ff, the guides 0xff3ea5 and 0xffa723,
 * the frame 0x5a6478, the emitter marker 0xff6bd6, the scene 0x1d2330, bodies
 * 0x00ff00, the camera 0x9b7bff, the touch rings 0xff5c33, the tween ghost, the
 * default fill 0x4f8cff and white, the nearest miss is 57.
 */
const FILL = '#ffe066';

/** Big enough that a glyph is still several pixels wide at the mobile zoom. */
const FONT = 96;

/** The version a saved file must carry: a label rides in on `scenes`, verbatim. */
const SCHEMA = 16;

/** One text object, alone, readable, with one variable for it to follow. */
async function setup(editor: EditorPage, value: number | string = 1234): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Text');
  await editor.setField('Name', 'Label');
  // A full stop rather than an empty caption: a text object drawing nothing at
  // all has no extent to compare against, and "wider than nothing" is a claim
  // about whether anything is drawn rather than about how much.
  await editor.setField('Content', '.');
  await editor.setField('Font size', FONT);
  await editor.setField('Text colour', FILL);
  await editor.setField('X', 480);
  await editor.setField('Y', 270);
  await editor.deselect();
  await editor.addVariable();
  await editor.setVariable(1, 'Score', value);
  await editor.selectInTree('Label');
}

/** How wide the text is drawn, with the panels shut and nothing selected. */
async function width(editor: EditorPage): Promise<number> {
  // Deselected before measuring, because the selection outline and the scale
  // handle sit over the very pixels a reading averages — the trap the physics
  // suite records, and it costs an extent as surely as a centroid.
  await editor.deselect();
  await editor.closePanels();
  const box = await editor.findDrawnBox(FILL);
  expect(box.count).toBeGreaterThan(0);
  return box.width;
}

/** The saved document, parsed. */
async function saved(editor: EditorPage): Promise<Record<string, unknown>> {
  const file = await editor.saveToFile();
  return JSON.parse(file.contents) as Record<string, unknown>;
}

/** The first scene's first child, which every fixture here makes the label. */
function firstNode(document: Record<string, unknown>): Record<string, unknown> {
  const scenes = document.scenes as { children: Record<string, unknown>[] }[];
  return scenes[0].children[0];
}

test.describe('a label that follows a variable', () => {
  test('the canvas draws the value the variable starts at', async ({ editor }) => {
    await setup(editor);
    const plain = await width(editor);

    await editor.selectInTree('Label');
    await editor.setLabelVariable('Score');
    const bound = await width(editor);

    // Four digits of 96px text beside a full stop is not a subtle difference,
    // and asserting a multiple rather than a pixel count keeps the claim the
    // same on both projects, which draw at different zooms.
    expect(bound).toBeGreaterThan(plain * 3);
  });

  test('the value follows the variable as it is edited', async ({ editor }) => {
    await setup(editor, 1);
    await editor.selectInTree('Label');
    await editor.setLabelVariable('Score');
    const short = await width(editor);

    await editor.setVariable(1, 'Score', 123456);
    const long = await width(editor);

    // The label is not re-bound and the node's own text is never touched: what
    // moved is the table it reads, which is the whole of what a binding is.
    expect(long).toBeGreaterThan(short * 2);
  });

  test('the format dials widen what is drawn', async ({ editor }) => {
    await setup(editor, 3);
    await editor.selectInTree('Label');
    await editor.setLabelVariable('Score');
    const bare = await width(editor);

    await editor.selectInTree('Label');
    await editor.setLabelFormat({ decimals: 2 });
    const fixed = await width(editor);
    expect(fixed).toBeGreaterThan(bare);

    await editor.selectInTree('Label');
    await editor.setLabelFormat({ pad: 8 });
    const padded = await width(editor);
    expect(padded).toBeGreaterThan(fixed);
  });

  test('a label survives a save and an open, and does not bump the version', async ({
    editor,
  }, testInfo) => {
    await setup(editor, 7);
    await editor.selectInTree('Label');
    await editor.setLabelVariable('Score');
    await editor.setLabelFormat({ decimals: 1, pad: 5 });

    const document = await saved(editor);
    // No bump: a label is a field on `props`, and `props` rides in on `scenes`
    // — the one part of a file `parseProject` passes through verbatim.
    expect(document.schemaVersion).toBe(SCHEMA);
    expect((firstNode(document).props as Record<string, unknown>).label).toEqual({
      variableId: expect.any(String),
      decimals: 1,
      pad: 5,
    });

    const drawn = await width(editor);

    const path = testInfo.outputPath('labelled.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    expect(await width(editor)).toBeCloseTo(drawn, 0);
    await editor.selectInTree('Label');
    expect(await editor.numberValue('Decimal places')).toBe(1);
    expect(await editor.numberValue('Pad to width')).toBe(5);
  });

  test('deleting the variable leaves the caption and no dangling reference', async ({
    editor,
  }) => {
    await setup(editor);
    const plain = await width(editor);

    await editor.selectInTree('Label');
    await editor.setLabelVariable('Score');
    expect(await width(editor)).toBeGreaterThan(plain * 3);

    await editor.removeVariable('Score');

    // Both halves at once, and the second is the one only this test can make:
    // the canvas falls back to the plain caption because `labelOf` reads a
    // dangling binding as absent, *and* the document no longer holds one at all
    // — which is what a `removeVariable` that forgot to walk the nodes would
    // fail while still drawing the right thing.
    expect(await width(editor)).toBeCloseTo(plain, 0);
    const document = await saved(editor);
    expect(firstNode(document).props).not.toHaveProperty('label');
  });

  test('a text variable is shown as it is, and offers no format', async ({ editor }) => {
    await setup(editor, 4);
    await editor.selectInTree('Label');
    await editor.setLabelVariable('Score');
    // Set while the variable still holds a number, so the document carries a
    // non-default format into the switch below rather than a pair of defaults.
    await editor.setLabelFormat({ decimals: 2, pad: 10 });

    await editor.setVariableKind(1, 'Text');
    await editor.setVariable(1, 'Score', 'go');

    await editor.selectInTree('Label');
    await editor.openPanel('inspect');
    // The dials are hidden rather than sitting there doing nothing: the panel
    // does not offer what the emit would ignore.
    await expect(editor.field('Decimal places')).toHaveCount(0);
    await expect(editor.field('Pad to width')).toHaveCount(0);

    // And the stored pad of 10 is ignored rather than padding `go` to ten
    // characters, which is `formatVariable`'s non-number branch — the one place
    // the editor's copy of the formatter and the printed one could disagree,
    // and did, on the first run of this file.
    const shown = await width(editor);
    await editor.selectInTree('Label');
    await editor.setLabelVariable(null);
    await editor.setField('Content', '.go');
    expect(await width(editor)).toBeCloseTo(shown, 0);
  });
});
