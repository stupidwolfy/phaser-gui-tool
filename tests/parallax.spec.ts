import fs from 'node:fs/promises';
import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';

/**
 * Scroll factors: how far an object moves when the scene's camera does.
 *
 * Like a blend mode and unlike a physics body, this is a standing fact about
 * how an object is *drawn* rather than a step of a simulation — so the canvas
 * and the exported game do the same thing, and there is no "drawn, never run"
 * to arrange. What there is instead is an arithmetic agreement: the editor
 * draws the offset itself because it never applies the document's camera, and
 * the export gets it from Phaser for free. **The claim that matters here is
 * that those two answers are the same**, and the near side can only assert half
 * of it; `export.spec.ts` carries the other half.
 *
 * **The instrument is an extent** (`findDrawnBox`), never a centroid. What is
 * asserted is *where* something is drawn, and `camera.spec.ts` records a
 * centroid moving 14px on the mobile project alone for a reason that is not
 * position — a stroke lands on a different sub-pixel phase on each of its four
 * edges. An extent is immune to that, because a one-pixel edge and a two-pixel
 * edge start in the same place.
 *
 * **The fixture colours are `blend.spec.ts`', deliberately reused rather than
 * newly picked.** Both were already checked by arithmetic against every hex
 * literal in `tests/` and every chrome colour in `EditorScene.ts` — `#aa66aa`
 * at a worst channel margin of 71 and `#448800` at 68, against `findColor`'s
 * tolerance of 24 — and neither comes near the one fixture colour added since
 * (`#00ff6a`, at 170 and 68). Reusing a checked pair is strictly safer than
 * picking a new one, and it is why this file carries no arithmetic table of its
 * own. The violet camera frame this file deliberately switches on is `#a259ff`,
 * which both clear comfortably.
 *
 * **Every drawn claim here needs a camera that opens scrolled**, which is the
 * one state where the offset is not zero. That is not a contrivance to make the
 * test work — it is the only state in which the editor and the export could
 * ever have disagreed, and therefore the only one worth a screenshot.
 */

const PINNED = '#aa66aa';
const PLAIN = '#448800';

/** How far the camera is scrolled in the tests that scroll it, in scene units. */
const SCROLL = 300;

/**
 * Two rectangles of equal size, far enough apart to never overlap and big
 * enough to have a middle that is not the scale handle — at the mobile
 * project's zoom a 200x120 box is ~74x44 on screen against a 44px touch target.
 *
 * Both start at the same `x`, which is what makes the drawn claim below a
 * comparison rather than two measurements: whatever the projection does to one
 * it does to the other, so the *difference* between their drawn left edges is
 * the offset and nothing else.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();

  for (const [name, fill, y] of [
    ['Pinned', PINNED, 160],
    ['Plain', PLAIN, 380],
  ] as const) {
    await editor.addObject('Rectangle');
    // Renamed because every rectangle this editor adds is called "Rectangle"
    // and `selectInTree` is an exact-name locator — `prefabs.spec.ts`' trap.
    await editor.setField('Name', name);
    await editor.setField('Width', 200);
    await editor.setField('Height', 120);
    await editor.setField('Fill', fill);
    await editor.setField('X', 220);
    await editor.setField('Y', y);
  }
}

/** The scale handle and the cyan outline sit over the pixels being measured. */
async function box(editor: EditorPage, hex: string) {
  await editor.deselect();
  await editor.closePanels();
  return editor.findDrawnBox(hex);
}

test('an object added plain moves with the world and stores nothing', async ({ editor }) => {
  await setup(editor);

  expect(await editor.numberValue('Scroll factor X')).toBe(1);
  expect(await editor.numberValue('Scroll factor Y')).toBe(1);

  const parsed = JSON.parse((await editor.saveToFile()).contents);
  // `{ x: 1, y: 1 }` is absence, so there is no key at all — the claim an
  // `updateProps` implementation fails while passing every other test in this
  // file, because a spread can set `scrollFactor: undefined` and can never
  // remove it. `blend.spec.ts`' assertion, one field over.
  expect(parsed.scenes[0].children[0].scrollFactor).toBeUndefined();
});

test('a scroll factor survives a save and an open', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.selectInTree('Pinned');
  await editor.setField('Scroll factor X', 0);
  await editor.setField('Scroll factor Y', 0.5);

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  // Asserted so that a future bump is a deliberate act. A scroll factor rides
  // in on `scenes`, which `parseProject` passes through verbatim, and on
  // `prefabs.children`, which `parsePrefabs` passes through unvalidated — so it
  // does not bump on its own. An older build draws the object at its document
  // position, emits no setter and carries the field back out untouched: an old
  // build doing less, not a file breaking.
  expect(parsed.schemaVersion).toBe(17);
  expect(parsed.scenes[0].children[0].scrollFactor).toEqual({ x: 0, y: 0.5 });

  const path = testInfo.outputPath('parallax.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  await editor.newProject();
  await editor.openFile(path);

  await editor.selectInTree('Pinned');
  expect(await editor.numberValue('Scroll factor X')).toBe(0);
  expect(await editor.numberValue('Scroll factor Y')).toBe(0.5);
});

test('a pinned object is drawn where the camera will put it, and the document does not move', async ({
  editor,
}) => {
  await setup(editor);

  // Both at the same stored x, so their drawn left edges agree before anything
  // is scrolled. Asserted rather than assumed, because the whole of the next
  // claim is the *difference* between these two numbers.
  const restPinned = await box(editor, PINNED);
  const restPlain = await box(editor, PLAIN);
  expect(Math.abs(restPinned.x - restPlain.x)).toBeLessThan(3);

  await editor.selectInTree('Pinned');
  await editor.setField('Scroll factor X', 0);
  // Nothing has moved yet: at the default scroll of (0, 0) the offset is
  // exactly zero for every factor, which is the arithmetic agreeing rather than
  // a special case — and it is what makes this feature cost every project that
  // predates it nothing at all.
  expect(Math.abs((await box(editor, PINNED)).x - restPinned.x)).toBeLessThan(3);

  await editor.setCamera({ x: SCROLL });

  const scale = await editor.zoom();
  const movedPinned = await box(editor, PINNED);
  const movedPlain = await box(editor, PLAIN);

  // The plain object has not moved: its factor is 1, so it is where it always
  // was. A camera scroll is not a thing the editor applies to its own view, and
  // this is the assertion that fails the day somebody makes it one.
  expect(Math.abs(movedPlain.x - restPlain.x)).toBeLessThan(3);

  // And the pinned one is drawn exactly one scroll to the right, which is the
  // world point it occupies at the frame the game opens on. In scene units,
  // because the two projects draw at different zooms and the claim is about the
  // picture rather than the screen.
  const travelled = (movedPinned.x - restPinned.x) / scale;
  expect(Math.abs(travelled - SCROLL)).toBeLessThan(8);

  // The document never moved, which is the invariant the offset must not eat.
  // `applyNode`'s "drawn position == stored position" gains an exception here,
  // and this is what keeps it an exception rather than a leak: the number the
  // user typed is still the number the file holds.
  await editor.selectInTree('Pinned');
  expect(await editor.numberValue('X')).toBe(220);
  const parsed = JSON.parse((await editor.saveToFile()).contents);
  expect(parsed.scenes[0].children[0].transform.x).toBe(220);
});

test('a nested object says why it cannot have one, and keeps what it had', async ({
  editor,
}, testInfo) => {
  // Hand-edited, because the store refuses to write one onto a nested node at
  // all — this is the strip-on-read half, and only a file the editor did not
  // write can exercise it.
  const nested = {
    schemaVersion: 14,
    name: 'Nested',
    phaserVersion: '4.2.1',
    assets: [],
    audio: [],
    fonts: [],
    animations: [],
    prefabs: [],
    variables: [],
    activeSceneId: 'scene-1',
    scenes: [
      {
        id: 'scene-1',
        name: 'Main',
        width: 960,
        height: 540,
        backgroundColor: '#1d2330',
        children: [
          {
            id: 'group',
            type: 'container',
            name: 'Group',
            visible: true,
            transform: { x: 200, y: 200, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { alpha: 1 },
            children: [
              {
                id: 'inside',
                type: 'rectangle',
                name: 'Inside',
                visible: true,
                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                props: { width: 200, height: 120, fill: PINNED, alpha: 1 },
                scrollFactor: { x: 0, y: 0 },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const path = testInfo.outputPath('nested.phaser.json');
  await fs.writeFile(path, JSON.stringify(nested), 'utf8');
  await editor.openFile(path);

  await editor.selectInTree('Inside');
  await editor.openPanel('inspect');
  // A sentence rather than an absent section — `NodeRulesSection`'s rule, and
  // the failure it prevents is this file's most-repeated lesson: a silently
  // absent control reads as a broken one.
  //
  // Matched on "holds directly", which is wording that section's own nested
  // hint does not share. The first version of this reached for "top level of
  // the scene" and matched both, because both render for a nested node — the
  // exactly-matched-label trap arriving on a paragraph.
  await expect(editor.panel('inspect').getByText(/holds directly/)).toBeVisible();
  await expect(editor.panel('inspect').getByLabel('Scroll factor X')).toHaveCount(0);

  // And the field is read as absent rather than deleted, so a node dragged into
  // a group and back out again is the same node — `physicsOf`'s treatment of a
  // nested body exactly. The export is the honest witness: nothing is emitted
  // for it, and the document still holds it.
  const exported = await editor.exportCode('ts');
  expect(exported.contents).not.toContain('.setScrollFactor(');

  const parsed = JSON.parse((await editor.saveToFile()).contents);
  expect(parsed.scenes[0].children[0].children[0].scrollFactor).toEqual({ x: 0, y: 0 });
});

test('the export chains setScrollFactor, and only when it differs', async ({ editor }) => {
  await setup(editor);

  const plain = await editor.exportCode('ts');
  // The exact token, so this cannot be made true or false by some other
  // fixture: `blend.spec.ts` records that trap, and the touch-controls helper
  // in every export with a driven object already carries `setScrollFactor(0)`
  // of its own — which is precisely why the bare word would assert nothing.
  expect(plain.contents).not.toContain('.setScrollFactor(');

  await editor.selectInTree('Pinned');
  await editor.setField('Scroll factor X', 0);
  await editor.setField('Scroll factor Y', 0);
  // Phaser's own one-argument shorthand means both axes, so a HUD is four
  // characters shorter than it would otherwise be.
  expect((await editor.exportCode('ts')).contents).toContain('.setScrollFactor(0)');

  await editor.setField('Scroll factor X', 0.3);
  expect((await editor.exportCode('ts')).contents).toContain('.setScrollFactor(0.3, 0)');
});

test('a hand-edited factor is repaired rather than dropped', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.selectInTree('Pinned');
  await editor.setField('Scroll factor X', 0.5);

  const saved = JSON.parse((await editor.saveToFile()).contents);

  for (const [file, written, want] of [
    // A repair may narrow what the document says; it may never widen it — and
    // there is no gate inside a scroll factor for a repair to open, so the
    // whole block is repair-only. A nonsense number reads as 1, which is the
    // state every object was in before this field existed.
    ['nonsense', { x: 'lots', y: 0.5 }, 1],
    ['runaway', { x: 999_999, y: 0.5 }, 10],
    ['backwards', { x: -999_999, y: 0.5 }, -10],
  ] as const) {
    saved.scenes[0].children[0].scrollFactor = written;
    const path = testInfo.outputPath(`${file}.phaser.json`);
    await fs.writeFile(path, JSON.stringify(saved), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    await editor.selectInTree('Pinned');
    expect(await editor.numberValue('Scroll factor X'), file).toBe(want);
    // The axis beside it is untouched, so a repair costs the number rather than
    // the object — the split `ruleActionsOf` makes, one field over.
    expect(await editor.numberValue('Scroll factor Y'), file).toBe(0.5);
  }
});
