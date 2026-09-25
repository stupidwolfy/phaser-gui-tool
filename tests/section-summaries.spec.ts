import { expect, test } from '@playwright/test';
import {
  DEFAULT_CAMERA,
  type NodeControls,
  type NodeTween,
  type PhysicsBody,
} from '../src/core/schema';
import { newProject } from '../src/core/defaults';
import { inspectorSectionFor } from '../src/core/sections';
import * as summary from '../src/ui/sectionSummaries';

/**
 * The one-line summaries a collapsed inspector section shows on its head.
 *
 * Pure, like `validation.spec.ts`: every formatter takes what a section has
 * already read through the document's own readers, so what is under test here
 * is the wording and the state — default, configured or mixed — and nothing
 * about the page. `inspector.spec.ts` carries the claims that need one.
 */

const body = (patch: Partial<PhysicsBody> = {}): PhysicsBody =>
  ({ kind: 'dynamic', shape: 'box', ...patch }) as PhysicsBody;

test.describe('physics', () => {
  const cases: [string, Parameters<typeof summary.physicsSummary>, string, string][] = [
    ['no body', [null, 'arcade', true, false], 'Off', 'default'],
    ['arcade dynamic box', [body(), 'arcade', true, true], 'Dynamic · box', 'configured'],
    ['arcade static circle', [body({ kind: 'static', shape: 'circle' }), 'arcade', true, true], 'Static · circle', 'configured'],
    ['matter', [body(), 'matter', true, true], 'Matter · dynamic · box', 'configured'],
    ['nested, none stored', [null, 'arcade', false, false], 'Top level only', 'default'],
    ['nested, one kept', [null, 'arcade', false, true], 'Kept · not in force in a group', 'mixed'],
  ];
  for (const [label, args, text, state] of cases) {
    test(label, () => expect(summary.physicsSummary(...args)).toEqual({ text, state }));
  }
});

test('tween: off, then the properties it drives and how', () => {
  expect(summary.tweenSummary(null)).toEqual({ text: 'Off', state: 'default' });
  const tween = {
    to: { x: 400, alpha: 0 },
    duration: 1000,
    delay: 0,
    ease: 'Linear',
    yoyo: true,
    repeat: -1,
    repeatDelay: 0,
  } as NodeTween;
  expect(summary.tweenSummary(tween)).toEqual({
    text: 'x, alpha · 1000ms · yoyo · forever',
    state: 'configured',
  });
  expect(summary.tweenSummary({ ...tween, yoyo: false, repeat: 2 }).text).toBe('x, alpha · 1000ms · ×3');
});

test('effects list their kinds in apply order', () => {
  expect(summary.effectsSummary([])).toEqual({ text: 'None', state: 'default' });
  expect(
    summary.effectsSummary([
      { kind: 'blur', quality: 0, x: 2, y: 2, strength: 1 },
      { kind: 'glow', color: '#ffffff', outerStrength: 8, innerStrength: 0, scale: 2 },
    ]),
  ).toEqual({ text: 'Blur, Glow', state: 'configured' });
});

test('controls name the scheme and the buttons', () => {
  expect(summary.controlsSummary(null).text).toBe('Off');
  const controls = { mode: 'platformer', scheme: 'wasd', speed: 200, jump: 450, touch: true } as NodeControls;
  expect(summary.controlsSummary(controls)).toEqual({
    text: 'Platformer · WASD · buttons',
    state: 'configured',
  });
});

test('blend and scroll are quiet at their defaults', () => {
  expect(summary.blendSummary('NORMAL')).toEqual({ text: 'Normal', state: 'default' });
  expect(summary.blendSummary('ADD')).toEqual({ text: 'Add', state: 'configured' });
  expect(summary.scrollSummary({ x: 1, y: 1 })).toEqual({ text: '1 × 1', state: 'default' });
  expect(summary.scrollSummary({ x: 0.3, y: 1 })).toEqual({ text: '0.3 × 1', state: 'configured' });
  expect(summary.scrollSummary({ x: 0, y: 0 }).text).toBe('0 × 0 · pinned');
});

test('camera: default, then a follow and a zoom', () => {
  expect(summary.cameraSummary(DEFAULT_CAMERA, null)).toEqual({ text: 'Default', state: 'default' });
  expect(summary.cameraSummary({ ...DEFAULT_CAMERA, zoom: 2 }, 'Player')).toEqual({
    text: 'Follows Player · zoom 2',
    state: 'configured',
  });
});

test('a follow that is stored but not in force reads as mixed', () => {
  const target = newProject().scenes[0].children[0];
  expect(summary.followSummary(null, null)).toEqual({ text: 'Off', state: 'default' });
  expect(summary.followSummary(target.id, target).state).toBe('configured');
  expect(summary.followSummary(target.id, null)).toEqual({ text: 'Off · not in force', state: 'mixed' });
});

test('a selection that disagrees about visibility says so rather than picking one', () => {
  expect(summary.selectionSummary([{ visible: true }, { visible: true }])).toEqual({
    text: '2 objects · all visible',
    state: 'default',
  });
  expect(summary.selectionSummary([{ visible: true }, { visible: false }, { visible: true }])).toEqual({
    text: '1 of 3 hidden',
    state: 'mixed',
  });
  expect(summary.selectionSummary([{ visible: false }]).text).toBe('1 object · all hidden');
  expect(summary.objectsSummary([{ type: 'rectangle' }, { type: 'text' }, { type: 'rectangle' }])).toEqual({
    text: 'Rectangle ×2, Text',
    state: 'mixed',
  });
});

test('free text is clipped by characters and flattened', () => {
  expect(summary.clip('short')).toBe('short');
  const long = summary.clip('a'.repeat(40));
  expect(long).toHaveLength(24);
  expect(long.endsWith('…')).toBe(true);
  expect(summary.clip('two\n  lines')).toBe('two lines');
});

test('transform and appearance say only what differs', () => {
  expect(summary.transformSummary({ x: 480, y: 270, rotation: 0, scaleX: 1, scaleY: 1 }).text).toBe('480, 270');
  expect(summary.transformSummary({ x: 1.234, y: 0, rotation: 30, scaleX: 2, scaleY: 0.5 }).text).toBe(
    '1.23, 0 · 30° · 2×0.5',
  );
  expect(summary.appearanceSummary({ tint: '#FFFFFF', alpha: 1 })).toEqual({ text: 'Default', state: 'default' });
  expect(summary.appearanceSummary({ tint: '#ff0000', alpha: 0.5, flipX: true }).text).toBe(
    'Tint #ff0000 · Alpha 0.5 · Flip X',
  );
});

test('a field path names the section that renders its control', () => {
  expect(inspectorSectionFor('sprite', 'props.assetId')).toBe('Image');
  expect(inspectorSectionFor('sprite', 'props.animationId')).toBe('Animation');
  expect(inspectorSectionFor('sprite', 'props.tint')).toBe('Appearance');
  expect(inspectorSectionFor('text', 'props.label.variableId')).toBe('Text');
  expect(inspectorSectionFor('text', 'props.strokeColor')).toBe('Stroke and shadow');
  expect(inspectorSectionFor('particles', 'props.followId')).toBe('Follow');
  expect(inspectorSectionFor('tilemap', 'props.assetId')).toBe('Tiles');
  expect(inspectorSectionFor('instance', 'props.prefabId')).toBe('Prefab');
  expect(inspectorSectionFor('rectangle', 'transform.x')).toBe('Transform');
});

test('variables say how many the game remembers, and only when some are', () => {
  expect(summary.variablesSummary([])).toEqual({ text: 'None', state: 'default' });
  expect(summary.variablesSummary([{}, {}])).toEqual({ text: '2 variables', state: 'configured' });
  expect(summary.variablesSummary([{ persist: true }, {}])).toEqual({
    text: '2 variables · 1 remembered',
    state: 'configured',
  });
});
