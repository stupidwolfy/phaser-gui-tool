import fs from 'node:fs/promises';
import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';
import { solidPng } from './helpers/png';

/**
 * Blend modes: how an object composites with what is already drawn behind it.
 *
 * The second feature running where the editor and the exported game do the
 * *same thing* rather than one describing the other — a blend mode is a
 * standing fact about how an object is drawn, not a step of a simulation — so
 * every claim but the emitted text can be made on the near side of the export,
 * and there is no "drawn, never run" to arrange.
 *
 * **The instrument is a colour that is on neither object alone**, which is a
 * strictly stronger reading than the glow's next door: that one only had to
 * find its colour *outside* a box, where this one finds a colour no object in
 * the scene has been given. Additively blending a shape over a backdrop puts
 * `BACK + SHAPE` on the canvas, so "it blended at all" is `count > 0` where a
 * feature silently doing nothing gives exactly 0 — and the negative half is
 * what makes it mean something: back at Normal that colour is gone while both
 * fills are still there.
 *
 * **The three colours were picked by arithmetic, not by eye**, which
 * `TOUCH_COLOR`, `TWEEN_COLOR`, `SPAWN_COLOR` and `GLOW` all record nearly
 * getting wrong. Checked against every hex literal in `tests/` and every chrome
 * colour in `EditorScene.ts` (53 in all), against `findColor`'s tolerance of
 * 24, which matches only when *every* channel is inside it:
 *
 *     backdrop  #aa66aa   worst channel margin 71   nearest #7a1fa2
 *     shape     #448800   worst channel margin 68   nearest #22cc44
 *     the sum   #eeeeaa   worst channel margin 68   nearest #ffe066
 *
 * The sum is 136 and 170 from the two sources, and **no channel clamps** — the
 * arithmetic is exact rather than saturated, so the claim is about blending
 * rather than about hitting the ceiling. Re-run that check when a fixture
 * colour is added anywhere in the suite.
 *
 * Unlike `effects.spec.ts` this file needs no raised timeout and no long poll
 * budget. A live filter puts the frame through a framebuffer the headless
 * container rasterises on the CPU; a blend mode is a blend-state change that
 * costs the software renderer nothing measurable. Said out loud, because a
 * reader arriving from the neighbouring spec will wonder where the line went.
 */

const BACK = '#aa66aa';
const SHAPE = '#448800';
const SUM = '#eeeeaa';

/**
 * A backdrop with a smaller shape centred on top of it, the shape added second
 * and therefore in front — draw order is the array order, and nothing else.
 *
 * Both are big enough to have a middle that is not the scale handle: at the
 * mobile project's zoom a 300x200 box is ~111x74 on screen against a 44px
 * touch target, which is the trap that eats fixtures meant to be pressed.
 */
async function setup(editor: EditorPage): Promise<void> {
  await editor.clearScene();

  await editor.addObject('Rectangle');
  // Renamed, because every rectangle this editor adds is called "Rectangle"
  // and `selectInTree` is an exact-name locator — two identical rows is a
  // strict-mode ambiguity, which is `prefabs.spec.ts`' trap one fixture over.
  await editor.setField('Name', 'Backdrop');
  await editor.setField('Width', 300);
  await editor.setField('Height', 200);
  await editor.setField('Fill', BACK);
  await editor.setField('X', 480);
  await editor.setField('Y', 270);

  await editor.addObject('Rectangle');
  await editor.setField('Name', 'Blended');
  await editor.setField('Width', 140);
  await editor.setField('Height', 100);
  await editor.setField('Fill', SHAPE);
  await editor.setField('X', 480);
  await editor.setField('Y', 270);
}

/** The scale handle and the cyan outline sit over the pixels being counted. */
async function read(editor: EditorPage, hex: string): Promise<number> {
  await editor.deselect();
  await editor.closePanels();
  return (await editor.findDrawn(hex)).count;
}

test('an object added plain composites normally and stores nothing', async ({ editor }) => {
  await setup(editor);

  expect(await editor.selectValue('Blend mode')).toBe('NORMAL');
  expect(await read(editor, SUM)).toBe(0);
  expect(await read(editor, SHAPE)).toBeGreaterThan(0);

  const parsed = JSON.parse((await editor.saveToFile()).contents);
  const shape = parsed.scenes[0].children[1];
  // NORMAL is absence, so there is no key at all — the claim an `updateProps`
  // implementation fails while passing every other test in this file, because a
  // spread can set `blendMode: undefined` and can never remove it.
  expect(shape.blendMode).toBeUndefined();
});

test('an additively blended object draws a colour that is on neither object', async ({
  editor,
}) => {
  await setup(editor);
  await editor.setChoice('Blend mode', 'Add');

  expect(await read(editor, SUM)).toBeGreaterThan(0);
  // The backdrop is still itself outside the overlap, so the sum is an
  // *addition* rather than the shape having been recoloured.
  expect(await read(editor, BACK)).toBeGreaterThan(0);

  await editor.selectInTree('Blended');
  await editor.setChoice('Blend mode', 'Normal');

  expect(await read(editor, SUM)).toBe(0);
  expect(await read(editor, SHAPE)).toBeGreaterThan(0);
});

test('a blend mode survives a save and an open', async ({ editor }, testInfo) => {
  await setup(editor);
  await editor.setChoice('Blend mode', 'Multiply');

  const saved = await editor.saveToFile();
  const parsed = JSON.parse(saved.contents);
  // Asserted so that a future bump is a deliberate act. A blend mode rides in
  // on `scenes`, which `parseProject` passes through verbatim, so it does not
  // bump on its own — and the particles migration does not either, because an
  // old build coerces the missing key to NORMAL rather than throwing and
  // carries the node-level field back out untouched on a re-save.
  expect(parsed.schemaVersion).toBe(15);
  expect(parsed.scenes[0].children[1].blendMode).toBe('MULTIPLY');

  const path = testInfo.outputPath('blend.phaser.json');
  await fs.writeFile(path, saved.contents, 'utf8');
  await editor.newProject();
  await editor.openFile(path);

  await editor.selectInTree('Blended');
  expect(await editor.selectValue('Blend mode')).toBe('MULTIPLY');
});

test('the export chains setBlendMode, and only when it differs', async ({ editor }) => {
  await setup(editor);

  const plain = await editor.exportCode('ts');
  // The exact token, never the bare word: every particles export in the suite
  // carries `blendMode:` inside the emitter config literal, so a loose
  // assertion here would be a shared resource that some other spec's fixture
  // could make true or false for reasons nothing to do with this one.
  expect(plain.contents).not.toContain('.setBlendMode(');

  await editor.selectInTree('Blended');
  await editor.setChoice('Blend mode', 'Screen');
  const blended = await editor.exportCode('ts');
  expect(blended.contents).toContain('.setBlendMode("SCREEN")');
});

test('an emitter written before the mode moved keeps the one it was given', async ({
  editor,
}, testInfo) => {
  // A pre-v15 document, which only a hand-edited file or an older build can
  // hold: the mode is on the particles props and there is no node-level field.
  // This is the one thing in the file that fails if `blendModeOf`'s migration
  // is dropped, and it is asserted through the document and the export rather
  // than through pixels — an emitter is stopped unless preview is on, and what
  // a running emitter's blended particles average to at one instant is a race
  // with the frame rate. Typography's call for weight and slant.
  const legacy = {
    schemaVersion: 14,
    name: 'Legacy',
    phaserVersion: '4.2.1',
    // An emitter with no image emits a `missingReason` comment rather than an
    // `add.particles` call, so a fixture meant to assert the config literal has
    // to carry a real one. Found by running the test, not by reading.
    assets: [
      {
        id: 'spark',
        name: 'spark.png',
        mimeType: 'image/png',
        dataUrl: `data:image/png;base64,${solidPng(8, 8, '#ffffff').toString('base64')}`,
        width: 8,
        height: 8,
      },
    ],
    activeSceneId: 's',
    scenes: [
      {
        id: 's',
        name: 'Main',
        width: 960,
        height: 540,
        backgroundColor: '#1d2330',
        children: [
          {
            id: 'e',
            name: 'Sparks',
            type: 'particles',
            visible: true,
            transform: { x: 480, y: 270, rotation: 0, scaleX: 1, scaleY: 1 },
            children: [],
            props: {
              assetId: 'spark',
              frame: 0,
              lifespan: 1000,
              speedMin: 50,
              speedMax: 150,
              angleMin: 0,
              angleMax: 360,
              scaleStart: 1,
              scaleEnd: 0,
              alphaStart: 1,
              alphaEnd: 0,
              quantity: 1,
              frequency: 50,
              gravityX: 0,
              gravityY: 0,
              tint: '#ffffff',
              blendMode: 'ADD',
              alpha: 1,
            },
          },
        ],
      },
    ],
  };

  const path = testInfo.outputPath('legacy-blend.phaser.json');
  await fs.writeFile(path, JSON.stringify(legacy), 'utf8');
  await editor.openFile(path);

  await editor.selectInTree('Sparks');
  expect(await editor.selectValue('Blend mode')).toBe('ADD');

  // Still in the config literal, never chained: an emitter's mode is emitted
  // whole with the rest of its dials, so this export has not moved by a byte.
  const exported = await editor.exportCode('ts');
  expect(exported.contents).toContain('blendMode: "ADD"');
  expect(exported.contents).not.toContain('.setBlendMode(');

  // And the first write normalises: the node-level field is set and the
  // pre-v15 prop is gone, in one step.
  await editor.setChoice('Blend mode', 'Screen');
  const parsed = JSON.parse((await editor.saveToFile()).contents);
  const emitter = parsed.scenes[0].children[0];
  expect(emitter.blendMode).toBe('SCREEN');
  expect(emitter.props.blendMode).toBeUndefined();
});
