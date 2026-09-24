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
  useEditorStore.getState().setPlaying(true);
  const playCodes = useEditorStore.getState().validationIssues.filter((issue) => issue.blocksExport).map((issue) => issue.code);
  expect(useEditorStore.getState().playing).toBe(false);

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
  useEditorStore.getState().setPlaying(true);
  expect(useEditorStore.getState().playing).toBe(true);
});
