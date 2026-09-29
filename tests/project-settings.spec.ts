import fs from 'node:fs/promises';
import { expect, test as pure } from '@playwright/test';
import { expect as expectUi, test } from './helpers/fixtures';
import { SCENE } from './helpers/editor';
import { rectsPng } from './helpers/png';
import { reaches } from './helpers/poll';
import { createScene, defaultPhysicsBody, newProject } from '../src/core/defaults';
import {
  SCHEMA_VERSION,
  bootSceneOf,
  cameraViewOf,
  defaultControls,
  gameViewportOf,
  projectSettingsOf,
  touchZonesOf,
  type Project,
} from '../src/core/schema';
import { useEditorStore } from '../src/core/store';
import { validateProject } from '../src/core/validation';
import { parseProject } from '../src/io/fileIO';
import { generateRunnableHtml, generateScene } from '../src/io/exportPhaser';
import { hostileProject } from './helpers/hostile';

/**
 * Project settings: what the game is, as against what one scene holds.
 *
 * The claim that carries the feature is the default one. A project that chose
 * nothing has no `settings` key and exports byte for byte what it exported
 * before — so the first tests here pin the old config text literally rather than
 * comparing the exporter against itself. The rest follow one setting each from
 * the panel into the document, the export, and where there is one, the canvas.
 */

/** `CAMERA_COLOR` in EditorScene. */
const CAMERA = '#9b7bff';
/** A fill only the start scene carries, so Play can say which scene booted. */
const START_FILL = '#d01c8b';
/** And one only the other scene carries. */
const OTHER_FILL = '#1cd0c0';
/** The checker's two colours: far apart on every channel, and on no chrome. */
const CHECK_A = '#e0e000';
const CHECK_B = '#0000e0';

/** The literal game config every project exported before settings existed. */
const DEFAULT_CONFIG = `new Phaser.Game({
        type: Phaser.AUTO,
        width: 960,
        height: 540,
        backgroundColor: "#1d2330",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: MainScene,
      });`;

// -- the model, with no browser ---------------------------------------------

pure.describe('the settings model', () => {
  pure('a new project has no settings, and exports the config it always did', () => {
    const project = newProject();
    expect(project.settings).toBeUndefined();
    expect(generateRunnableHtml(project)).toContain(DEFAULT_CONFIG);
    expect(generateScene(project, 'ts')).not.toContain('pixelArt');
    expect(projectSettingsOf(project)).toEqual({
      startSceneId: null,
      viewport: null,
      scaleMode: 'fit',
      pixelArt: false,
      renderer: 'auto',
    });
  });

  pure('every setting reaches the config, from an allowlist', () => {
    const project = newProject();
    project.settings = {
      viewport: { width: 480, height: 270 },
      scaleMode: 'envelop',
      pixelArt: true,
      renderer: 'webgl',
    };
    const html = generateRunnableHtml(project);
    expect(html).toContain('type: Phaser.WEBGL,');
    expect(html).toContain('width: 480,');
    expect(html).toContain('height: 270,');
    expect(html).toContain('pixelArt: true,');
    expect(html).toContain('mode: Phaser.Scale.ENVELOP,');
    // A module dropped into somebody else's game cannot set their config, so it
    // says what it needs — the Arcade note's pattern.
    expect(generateScene(project, 'ts')).toContain(
      '// Drawn as pixel art. Your game config needs: pixelArt: true',
    );

    project.settings = { scaleMode: 'none', renderer: 'canvas' };
    const other = generateRunnableHtml(project);
    expect(other).toContain('type: Phaser.CANVAS,');
    expect(other).toContain('mode: Phaser.Scale.NONE,');
    expect(other).not.toContain('pixelArt');
  });

  pure('the start scene boots, whichever scene is being edited', () => {
    const project = newProject();
    const second = createScene('Level');
    project.scenes.push(second);
    project.activeSceneId = second.id;
    expect(bootSceneOf(project).id).toBe(second.id);

    project.settings = { startSceneId: project.scenes[0].id };
    expect(bootSceneOf(project).id).toBe(project.scenes[0].id);
    const module = generateScene(project, 'ts');
    expect(module).toContain('export default MainScene;');
    expect(generateRunnableHtml(project)).toContain('scene: [MainScene, Level]');
  });

  pure('a hand-edited file opens, warns, and exports the defaults', () => {
    const project = newProject();
    const raw = {
      ...project,
      settings: {
        startSceneId: 'gone',
        viewport: { width: 0, height: 540 },
        renderer: 'banana',
        scaleMode: 'stretch',
        pixelArt: 'yes',
      },
    };
    const opened = parseProject(JSON.stringify(raw));
    // What the type allows survives the open, usable or not, so validation can
    // say so; what the type does not allow is dropped there.
    expect(opened.settings).toEqual({ startSceneId: 'gone', viewport: { width: 0, height: 540 } });
    const codes = validateProject(opened).map((issue) => issue.code);
    expect(codes).toContain('config.start-scene-missing');
    expect(codes).toContain('config.viewport-invalid');
    // Neither blocks: the reader repairs both, to the old behaviour.
    expect(validateProject(opened).every((issue) => !issue.blocksExport)).toBe(true);
    expect(generateRunnableHtml(opened)).toContain(DEFAULT_CONFIG);
    // The version is stamped with this build's, which is what the bump is for.
    expect(opened.schemaVersion).toBe(18);
    expect(SCHEMA_VERSION).toBe(18);
  });

  pure('a project with no settings opens with no settings key', () => {
    const opened = parseProject(JSON.stringify(newProject()));
    expect('settings' in opened).toBe(false);
  });

  pure('Canvas warns about effects, and only about effects', () => {
    const project = newProject();
    project.settings = { renderer: 'canvas' };
    expect(validateProject(project).map((issue) => issue.code)).not.toContain(
      'config.canvas-renderer-effects',
    );
    project.scenes[0].children[0].fx = [{ kind: 'blur', strength: 2 } as never];
    expect(validateProject(project).map((issue) => issue.code)).toContain(
      'config.canvas-renderer-effects',
    );
  });

  pure('a fixed size measures the camera and the touch buttons against the game canvas', () => {
    const project = newProject();
    const scene = project.scenes[0];
    // With no fixed size, the scene rectangle — exactly as before.
    expect(cameraViewOf(scene, gameViewportOf(project, scene))).toEqual(cameraViewOf(scene));

    project.settings = { viewport: { width: 480, height: 270 } };
    expect(cameraViewOf(scene, gameViewportOf(project, scene))).toEqual({
      x: 0,
      y: 0,
      width: 480,
      height: 270,
    });

    // Touch buttons sit on the canvas, so the jump button hugs its right edge
    // rather than the scene's.
    const ball = scene.children.find((node) => node.name === 'Ball')!;
    ball.physics = defaultPhysicsBody('dynamic');
    ball.controls = { ...defaultControls(), touch: true };
    const buttons = touchZonesOf(scene, gameViewportOf(project, scene));
    const jump = buttons.find((button) => button.key === 'jump');
    expect(jump).toBeDefined();
    expect(jump!.x + jump!.radius).toBeLessThan(480);
  });
});

pure.describe('the store', () => {
  const load = (project: Project) => useEditorStore.getState().loadProject(project, null);
  const state = () => useEditorStore.getState();

  pure('a setting set back to its default leaves no key behind', () => {
    load(newProject());
    state().setProjectSettings({ pixelArt: true, renderer: 'webgl' });
    expect(state().project.settings).toEqual({ pixelArt: true, renderer: 'webgl' });
    state().setProjectSettings({ pixelArt: undefined, renderer: 'auto' });
    expect('settings' in state().project).toBe(false);
  });

  pure('a no-op pushes no undo step', () => {
    load(newProject());
    const before = state().past.length;
    state().setProjectSettings({ scaleMode: 'fit' });
    expect(state().past.length).toBe(before);
  });

  pure('deleting the start scene clears it, and undo brings both back', () => {
    const project = newProject();
    const second = createScene('Level');
    project.scenes.push(second);
    load(project);
    const firstId = project.scenes[0].id;
    state().setProjectSettings({ startSceneId: firstId });
    state().removeScene(firstId);
    expect(state().project.settings).toBeUndefined();
    state().undo();
    expect(state().project.settings).toEqual({ startSceneId: firstId });
    expect(state().project.scenes).toHaveLength(2);
  });
});

// -- the editor -------------------------------------------------------------

test('the panel writes every setting, and the file keeps them', async ({ editor }, testInfo) => {
  await editor.deselect();
  await editor.setField('Game title', 'Crisp Game');
  await editor.setChoice('Game size', 'Fixed size');
  await editor.setField('Game width', 480);
  await editor.setField('Game height', 270);
  await editor.setChoice('Scaling', 'Fill (crop the edges)');
  await editor.checkbox('Pixel art').check();
  await editor.setChoice('Renderer', 'WebGL');

  const saved = await editor.saveToFile();
  const json = JSON.parse(saved.contents) as Project;
  expect(json.schemaVersion).toBe(18);
  expect(json.name).toBe('Crisp Game');
  expect(json.settings).toEqual({
    viewport: { width: 480, height: 270 },
    scaleMode: 'envelop',
    pixelArt: true,
    renderer: 'webgl',
  });

  const page = await editor.exportCode('html');
  expect(page.contents).toContain('<title>Crisp Game</title>');
  expect(page.contents).toContain('type: Phaser.WEBGL,');
  expect(page.contents).toContain('width: 480,');
  expect(page.contents).toContain('pixelArt: true,');

  // And it all survives a reopen.
  const path = testInfo.outputPath('settings.phaser.zip');
  await fs.writeFile(path, saved.archive);
  await editor.newProject();
  await editor.openFile(path);
  await editor.deselect();
  expectUi(await editor.numberValue('Game width')).toBe(480);
  await expectUi(editor.checkbox('Pixel art')).toBeChecked();
  await expectUi(editor.choice('Scaling')).toHaveValue('envelop');

  // Back to the default size: the key goes, rather than holding the default.
  await editor.setChoice('Game size', "Each scene's own size");
  await expectUi(editor.field('Game width')).toHaveCount(0);
  const after = JSON.parse((await editor.saveToFile()).contents) as Project;
  expect(after.settings?.viewport).toBeUndefined();
});

test('the collapsed head says what was chosen, and warns about Canvas and effects', async ({
  editor,
}) => {
  await editor.deselect();
  await editor.toggleSection('Project settings');
  const head = editor.sectionHead('Project settings');
  await expectUi(head.locator('.section__summary')).toContainText('Defaults');

  await editor.toggleSection('Project settings');
  await editor.setChoice('Renderer', 'Canvas');
  await expectUi(editor.panel('inspect').getByText(/under Canvas they draw nothing/)).toBeVisible();
  await editor.toggleSection('Project settings');
  await expectUi(head.locator('.section__summary')).toContainText('Canvas');

  // An effect on any object turns that into a warning on the head.
  await editor.selectInTree('Platform');
  await editor.openPanel('inspect');
  await editor.panel('inspect').getByRole('button', { name: '+ Add an effect' }).click();
  await editor.deselect();
  await expectUi(head.locator('.section__summary--warning')).toBeVisible();
});

test('a fixed game size draws the camera frame at that size', async ({ editor }) => {
  await editor.clearScene();
  await editor.deselect();
  await editor.closePanels();
  // The default camera on a scene its own size draws nothing: it would land on
  // the scene frame.
  expectUi((await editor.findDrawn(CAMERA)).count).toBe(0);

  await editor.setChoice('Game size', 'Fixed size');
  await editor.setField('Game width', 480);
  await editor.setField('Game height', 270);
  await editor.closePanels();

  const drawn = await editor.findDrawnBox(CAMERA);
  expectUi(drawn.count).toBeGreaterThan(0);
  const zoom = await editor.zoom();
  // The top-left quarter of the scene, which is where an unscrolled camera on a
  // 480x270 canvas looks.
  const corner = await editor.sceneToScreen({ x: 0, y: 0 });
  expectUi(Math.abs(drawn.x - corner.x)).toBeLessThan(6);
  expectUi(Math.abs(drawn.width - 480 * zoom)).toBeLessThan(6);
  expectUi(Math.abs(drawn.height - 270 * zoom)).toBeLessThan(6);
  // Half the scene wide, which is the claim a frame at the scene's size fails.
  expectUi(drawn.width).toBeLessThan((SCENE.width * zoom) / 2 + 6);
});

test('pixel art draws the canvas without smoothing', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Image');
  // A 2x2 checker scaled up: smoothed, most of it is a blend of the two
  // colours; unsmoothed, it is four solid squares.
  await editor.importImage({
    name: 'checker.png',
    buffer: rectsPng(2, 2, CHECK_A, [
      { x: 1, y: 0, w: 1, h: 1, hex: CHECK_B },
      { x: 0, y: 1, w: 1, h: 1, hex: CHECK_B },
    ]),
  });
  await editor.setField('Scale X', 80);
  await editor.setField('Scale Y', 80);

  const solid = async () => {
    await editor.deselect();
    await editor.closePanels();
    const zoom = await editor.zoom();
    const topLeft = await editor.sceneToScreen({ x: SCENE.width / 2 - 70, y: SCENE.height / 2 - 70 });
    // Page coordinates: `countDrawnIn` takes the shot's origin off itself.
    const region = {
      x: topLeft.x,
      y: topLeft.y,
      width: 140 * zoom,
      height: 140 * zoom,
    };
    const a = await editor.countDrawnIn(CHECK_A, region);
    const b = await editor.countDrawnIn(CHECK_B, region);
    return (a + b) / (region.width * region.height);
  };

  const smoothed = await solid();
  expectUi(smoothed).toBeLessThan(0.75);

  await editor.openPanel('inspect');
  await editor.checkbox('Pixel art').check();
  const crisp = await solid();
  expectUi(crisp).toBeGreaterThan(0.9);
});

test('Play boots the start scene, not the scene being edited', async ({ editor }) => {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.setField('Fill', START_FILL);
  await editor.addScene();
  await editor.addObject('Rectangle');
  await editor.setField('Fill', OTHER_FILL);

  await editor.deselect();
  await editor.setChoice('Start scene', 'MainScene');
  await editor.play();
  const started = await reaches(
    () => editor.findInPlay(START_FILL),
    (blob) => blob.count > 0,
  );
  expectUi(started.count).toBeGreaterThan(0);
  expectUi((await editor.findInPlay(OTHER_FILL)).count).toBe(0);
  await editor.stopPlay();

  // Deleting the start scene takes the setting with it, in one undo step.
  await editor.switchToScene('MainScene');
  await editor.deleteScene();
  await editor.deselect();
  await expectUi(editor.choice('Start scene')).toHaveValue('');
  await editor.undo();
  await editor.deselect();
  await expectUi(editor.choice('Start scene').locator('option:checked')).toHaveText('MainScene');
});

// Keep the hostile import in use: the settings reach the toolchain through it.
pure('the hostile project carries settings through the exporter', () => {
  const project = hostileProject();
  expect(project.settings).toBeDefined();
  const html = generateRunnableHtml(project);
  expect(html).toContain('pixelArt: true,');
  expect(generateScene(project, 'ts')).toContain('export default');
});
