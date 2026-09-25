import { promises as fs } from 'node:fs';

import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';

/**
 * Remembered variables: a value the exported game keeps in the player's browser
 * between plays, and a rule action that puts every one of them back.
 *
 * Like `rules.spec.ts`, this file carries no positive runtime claim. The editor
 * never reads `persist`, and Play runs in a sandbox with no storage, so the
 * claim that a value outlives a reload is in `export.spec.ts` (a page served
 * over HTTP, where storage is real) and the claim that Play survives having no
 * storage at all is in `play.spec.ts`. What is left here is the document, the
 * panel and the emitted text.
 */

/** One rectangle, alone, so the scene has something in it and nothing else. */
async function oneBox(editor: EditorPage): Promise<void> {
  await editor.clearScene();
  await editor.addObject('Rectangle');
  await editor.deselect();
  await editor.closePanels();
}

/** The saved document, parsed. */
async function saved(editor: EditorPage): Promise<Record<string, unknown>> {
  const file = await editor.saveToFile();
  return JSON.parse(file.contents) as Record<string, unknown>;
}

type SavedVariable = { id: string; name: string; value: number | string; persist?: unknown };

/** Two variables, Score and Best, with only Best remembered. */
async function scoreAndBest(editor: EditorPage): Promise<void> {
  await oneBox(editor);
  await editor.addVariable();
  await editor.setVariable(1, 'Score', 5);
  await editor.addVariable();
  await editor.setVariable(2, 'Best', 0);
  await editor.setVariablePersist(2, true);
}

test('a remembered variable round-trips, and unticking takes the key out', async ({
  editor,
}, testInfo) => {
  await oneBox(editor);
  await editor.addVariable();
  await editor.setVariable(1, 'Best', 0);
  await editor.setVariablePersist(1, true);

  // v17: a v16 build rebuilds each variable field by field and would drop the
  // flag on a re-save, which is a game that silently stops remembering.
  const document = await saved(editor);
  expect(document.schemaVersion).toBe(17);
  expect(document.variables).toEqual([
    { id: expect.any(String), name: 'Best', value: 0, persist: true },
  ]);

  const path = testInfo.outputPath('remembered.phaser.json');
  await fs.writeFile(path, JSON.stringify(document), 'utf8');
  await editor.newProject();
  await editor.openFile(path);
  expect(await editor.variablePersisted(1)).toBe(true);

  // Absent, never `false`: one spelling of "off".
  await editor.setVariablePersist(1, false);
  const after = await saved(editor);
  const [variable] = after.variables as SavedVariable[];
  expect(variable).toEqual({ id: expect.any(String), name: 'Best', value: 0 });
  expect('persist' in variable).toBe(false);
});

test('a hand-edited flag is carried only when it is true', async ({ editor }, testInfo) => {
  await oneBox(editor);
  // Named before the save: a default "Variable 1" raises a name warning, and on
  // a phone the issue list it opens sits over the tab bar.
  await editor.addVariable();
  await editor.setVariable(1, 'Loose', 0);
  await editor.addVariable();
  await editor.setVariable(2, 'Kept', 0);
  const document = await saved(editor);
  const [first, second] = document.variables as SavedVariable[];
  document.variables = [
    { ...first, persist: 'yes' },
    { ...second, persist: true },
  ];

  const path = testInfo.outputPath('hand-edited.phaser.json');
  await fs.writeFile(path, JSON.stringify(document), 'utf8');
  await editor.newProject();
  await editor.openFile(path);

  expect(await editor.variablePersisted(1)).toBe(false);
  expect(await editor.variablePersisted(2)).toBe(true);
  const resaved = (await saved(editor)).variables as SavedVariable[];
  expect('persist' in resaved[0]).toBe(false);
  expect(resaved[1].persist).toBe(true);
});

test('nothing remembered exports exactly what it did before', async ({ editor }) => {
  await oneBox(editor);
  await editor.addVariable();
  await editor.setVariable(1, 'Score', 0);

  // The byte-for-byte rule: no table, the two-argument call and the old helper.
  const exported = await editor.exportCode('ts');
  expect(exported.contents).not.toContain('SAVED_VARIABLES');
  expect(exported.contents).not.toContain('localStorage');
  expect(exported.contents).toContain('initVariables(this, VARIABLES);');
  expect(exported.contents).toContain(
    'function initVariables(scene: Phaser.Scene, values: Record<string, number>): void {',
  );
  expect(exported.contents).toContain(
    'if (!scene.registry.has(key)) scene.registry.set(key, values[key]);',
  );
});

test('a remembered variable exports a saved table keyed by its id, and a guarded load', async ({
  editor,
}) => {
  await scoreAndBest(editor);
  const variables = (await saved(editor)).variables as SavedVariable[];
  const best = variables.find((variable) => variable.name === 'Best');
  expect(best).toBeDefined();

  const ts = (await editor.exportCode('ts')).contents;
  // Keyed by the id, so a renamed variable keeps every player's save. Only the
  // remembered one is in the table.
  expect(ts).toContain('const SAVED_VARIABLES = {');
  expect(ts).toContain(`"best": "saved-variable:${best!.id}",`);
  expect(ts).not.toContain('"score": "saved-variable:');
  expect(ts).toContain('initVariables(this, VARIABLES, SAVED_VARIABLES);');
  expect(ts).toContain('  saved: Record<string, string>,');
  // Every storage access is caught: in Play's sandbox, reading
  // `window.localStorage` throws, and uncaught that is a `create()` that throws
  // before any object is added.
  expect(ts).toContain('const stored = window.localStorage.getItem(storageKey);');
  expect(ts).toContain(
    'window.localStorage.setItem(storageKey, JSON.stringify(registry.get(key)));',
  );
  expect(ts.match(/\} catch \{/g)?.length).toBe(2);
  // Saved on the moment labels and varChange rules already ride, so no
  // `update()` is emitted for it.
  expect(ts).toContain("registry.events.on('changedata-' + key, () => {");
  expect(ts).not.toContain('update()');

  const html = (await editor.exportCode('html')).contents;
  expect(html).toContain('function initVariables(scene, values, saved) {');
  expect(html).toContain('initVariables(this, VARIABLES, SAVED_VARIABLES);');
});

test.describe('reset remembered variables', () => {
  test('is offered only while something is remembered', async ({ editor }) => {
    await oneBox(editor);
    await editor.addVariable();

    const name = await editor.addRule();
    await editor.openRule(name);
    const option = editor
      .choice('Rule 1 do 1')
      .getByRole('option', { name: 'Reset remembered variables' });
    // Withheld rather than offered and refused: the reader drops it while
    // nothing is remembered, so it would vanish the moment it was picked.
    await expect(option).toHaveCount(0);

    await editor.setVariablePersist(1, true);
    await editor.openRule(name);
    await expect(option).toHaveCount(1);
  });

  test('emits a set for each remembered variable only, and says which', async ({
    editor,
  }) => {
    await scoreAndBest(editor);
    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Reset remembered variables');

    await expect(
      editor.panel('inspect').getByText('Sets Best back to the value each starts at'),
    ).toBeVisible();

    // The line a `setVar` emits, once per remembered variable. Score is not
    // remembered, so a reset leaves it alone.
    const exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('this.registry.set("best", 0);');
    expect(exported).not.toContain('this.registry.set("score", 5);');
  });

  test('unticking the last remembered variable drops the action, and the file keeps it', async ({
    editor,
  }) => {
    await scoreAndBest(editor);
    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Reset remembered variables');
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);

    // `setVelocity` on a body switched off, one table over: the reader drops
    // the action (and, being the only one, the rule) while the document keeps
    // it, so ticking again brings both back.
    await editor.setVariablePersist(2, false);
    expect(await editor.ruleCount()).toBe(0);

    const document = await saved(editor);
    const scene = (document.scenes as { rules?: { do: { kind: string }[] }[] }[])[0];
    expect(scene.rules?.[0].do[0].kind).toBe('resetPersisted');

    await editor.setVariablePersist(2, true);
    expect(await editor.ruleCount()).toBe(1);
  });
});
