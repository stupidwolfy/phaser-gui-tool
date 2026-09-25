import { expect, test } from '@playwright/test';
import { newProject } from '../src/core/defaults';
import { useEditorStore } from '../src/core/store';
import { ProjectValidationError, validateProject } from '../src/core/validation';
import { generateRunnableHtml, generateScene } from '../src/io/exportPhaser';

test.describe('pure project validation', () => {
  const cases = [
    ['unsafe project name', (project: ReturnType<typeof newProject>) => { project.name = ''; }, 'config.project-name-missing'],
    ['newer schema', (project: ReturnType<typeof newProject>) => { project.schemaVersion += 1; }, 'schema.unsupported-newer'],
    ['malformed scene size', (project: ReturnType<typeof newProject>) => { project.scenes[0].width = Number.NaN; }, 'config.scene-size-invalid'],
    ['missing asset', (project: ReturnType<typeof newProject>) => {
      project.scenes[0].children.push({ id: 'sprite', name: 'Sprite', type: 'sprite', visible: true, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, props: { assetId: 'gone', alpha: 1, tint: '#ffffff', flipX: false, flipY: false, frame: 0, animationId: null }, children: [] });
    }, 'reference.asset-missing'],
  ] as const;

  for (const [label, change, code] of cases) test(label, () => {
    const project = newProject();
    change(project);
    const before = structuredClone(project);
    expect(validateProject(project).map((issue) => issue.code)).toContain(code);
    expect(project).toEqual(before);
  });
});

test('Play and every export report identical blocking codes', () => {
  const project = newProject();
  project.schemaVersion += 1;
  useEditorStore.getState().loadProject(project, null);
  useEditorStore.getState().setPlayGameRunning(true);
  const playCodes = useEditorStore.getState().validationIssues.filter((issue) => issue.blocksExport).map((issue) => issue.code);
  expect(useEditorStore.getState().playGameRunning).toBe(false);

  for (const exportPath of [() => generateScene(project, 'ts'), () => generateScene(project, 'js'), () => generateRunnableHtml(project)]) {
    let codes: string[] = [];
    try { exportPath(); } catch (error) {
      if (error instanceof ProjectValidationError) codes = error.issues.map((issue) => issue.code);
    }
    expect(codes).toEqual(playCodes);
  }
});

test('warnings do not block Play or export', () => {
  const project = newProject();
  project.name = '';
  expect(() => generateScene(project)).not.toThrow();
  useEditorStore.getState().loadProject(project, null);
  useEditorStore.getState().setPlayGameRunning(true);
  expect(useEditorStore.getState().playGameRunning).toBe(true);
});

test('every node issue names a section the inspector actually renders', () => {
  const project = newProject();
  project.variables = [];
  project.scenes[0].children.push(
    { id: 'sprite', name: 'Sprite', type: 'sprite', visible: true, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, props: { assetId: 'gone', alpha: 1, tint: '#ffffff', flipX: false, flipY: false, frame: 0, animationId: null }, children: [] },
    { id: 'caption', name: 'Caption', type: 'text', visible: true, transform: { x: 0, y: Number.NaN, rotation: 0, scaleX: 1, scaleY: 1 }, props: { ...(project.scenes[0].children.find((node) => node.type === 'text')!.props as object), label: { variableId: 'nope', decimals: -1, pad: 0 } } as never, children: [] },
  );
  const issues = validateProject(project);
  const section = (objectId: string, code: string) =>
    issues.find((issue) => issue.objectId === objectId && issue.code === code)?.inspectorSection;

  expect(section('sprite', 'reference.asset-missing')).toBe('Image');
  expect(section('caption', 'reference.variable-missing')).toBe('Text');
  expect(section('caption', 'value.not-finite')).toBe('Transform');
  // The old catch-all named no section at all, so an issue pressed in the
  // summary opened nothing.
  expect(issues.some((issue) => issue.inspectorSection === 'Properties')).toBe(false);
});

test('dangling references and malformed colours warn, and do not block', () => {
  // The exporter already copes with both: a reader drops a reference that names
  // nothing, and a colour is repaired to a default. So the output is valid, and
  // an issue blocks only when the output would not be.
  const project = newProject();
  const text = project.scenes[0].children.find((node) => node.type === 'text')!;
  const rectangle = project.scenes[0].children.find((node) => node.type === 'rectangle')!;
  (rectangle.props as { fill: string }).fill = 'not a colour';
  project.scenes[0].backgroundColor = 'red; } body { color: red';
  project.scenes[0].children.push(
    { id: 'sprite', name: 'Sprite', type: 'sprite', visible: true, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, props: { assetId: 'gone', alpha: 1, tint: '#ffffff', flipX: false, flipY: false, frame: 0, animationId: null }, children: [] },
    { ...text, id: 'caption', props: { ...(text.props as object), label: { variableId: 'nope', decimals: -1, pad: 0 } } as never },
  );

  const issues = validateProject(project);
  for (const code of ['reference.asset-missing', 'reference.variable-missing', 'value.color-malformed']) {
    const found = issues.filter((issue) => issue.code === code);
    expect(found.length, code).toBeGreaterThan(0);
    for (const issue of found) {
      expect(issue.severity).toBe('warning');
      expect(issue.blocksExport).toBe(false);
    }
  }

  expect(() => generateScene(project, 'ts')).not.toThrow();
  expect(() => generateRunnableHtml(project)).not.toThrow();
  useEditorStore.getState().loadProject(project, null);
  useEditorStore.getState().setPlayGameRunning(true);
  expect(useEditorStore.getState().playGameRunning).toBe(true);
});
