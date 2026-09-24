import { promises as fs } from 'node:fs';

import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';
import { solidPng } from './helpers/png';

/**
 * Rules: game logic in the document, and an editor that never runs a line of it.
 *
 * Iteration 20 drew a line — the document may state standing facts about the
 * world but not a sequence of events — and this feature crosses it deliberately.
 * What replaces it is the claim every test here is shaped by: **the document may
 * name a moment Phaser already delivers and a list of things to do at it, and it
 * may not name a moment Phaser would have to go looking for.**
 *
 * Which means this file carries **no positive claim at all**. Nothing here fires,
 * because nothing in the editor runs a rule: a rule destroys objects and starts
 * other scenes, so a preview would not merely animate the document the way a
 * tween does, it would demolish it. Every "it actually works" claim is in
 * `export.spec.ts`, on the far side of the export — `behaviour.spec.ts`' split,
 * at its sharpest yet.
 *
 * What is left here is the document, the panels, and the one thing only the near
 * side can see: that pressing ▶ over a rule that would delete everything changes
 * nothing whatsoever.
 *
 * Iteration 29 added text variables and `setText` and did not change that shape
 * by a line. The caption claims here are the document's, the panel's and the
 * emitted text's, plus one negative the far side cannot make: a canvas that goes
 * on drawing `props.text` while a rule says it should read something else. The
 * positive half — a label that reads what the game counted — is in
 * `export.spec.ts`, where anything that has to actually run belongs.
 */

/** The default rectangle fill, which a plain new rectangle draws in. */
const FILL = '#4f8cff';

/**
 * The version a saved file must carry now that `project.variables` exists and a
 * variable may hold text — v13 for the table, v14 for the kind.
 */
const SCHEMA = 16;

/** One rectangle, alone, so a colour reading has exactly one source. */
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

test.describe('variables', () => {
  test('a variable is declared, shows the key it reads as, and survives a save', async ({
    editor,
  }, testInfo) => {
    await oneBox(editor);

    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);

    // The key is derived, never stored — `audioKeyOf`'s treatment — so the row
    // showing it is the only place a user can learn what a hand-written
    // `this.registry.get(...)` would have to say.
    expect(await editor.variableKey(1)).toBe('score');

    const document = await saved(editor);
    // The bump is the whole reason this feature touched the version at all:
    // `scene.rules` rides in on `scenes` verbatim and would not have bumped it,
    // while `project.variables` is a project table `parseProject` names one at
    // a time — so a v12 build drops it and re-saves the file without it.
    expect(document.schemaVersion).toBe(SCHEMA);
    expect(document.variables).toEqual([
      { id: expect.any(String), name: 'Score', value: 0 },
    ]);

    const path = testInfo.outputPath('variables.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    expect(await editor.variableKey(1)).toBe('score');
    await editor.deselect();
    await editor.openPanel('inspect');
    expect(await editor.fieldValue('Variable 1 name')).toBe('Score');
  });

  test('a new variable arrives under a name nothing else has', async ({ editor }) => {
    await oneBox(editor);

    await editor.addVariable();
    await editor.addVariable();

    // Unique on arrival rather than de-duplicated only at export, so a fresh
    // row never opens already showing a suffixed key.
    await editor.deselect();
    await editor.openPanel('inspect');
    const first = await editor.fieldValue('Variable 1 name');
    const second = await editor.fieldValue('Variable 2 name');
    expect(first).not.toBe(second);
  });

  test('two variables deriving one key are told apart on screen', async ({ editor }) => {
    await oneBox(editor);

    await editor.addVariable();
    await editor.setVariable(1, 'lives', 3);
    await editor.addVariable();
    await editor.setVariable(2, 'Lives', 99);

    // Two variables sharing one registry key is a value silently shared at
    // runtime — both rows would go on showing their own number while the game
    // kept one. The suffix is the only thing on screen that can say so, which
    // is why the panel is shown the de-duplicated answer rather than a
    // per-row derivation the way an audio row is.
    expect(await editor.variableKey(1)).toBe('lives');
    expect(await editor.variableKey(2)).toBe('lives2');
  });

  test('a variable holds text, and the kind is the type of its value', async ({
    editor,
  }, testInfo) => {
    await oneBox(editor);

    await editor.addVariable();
    await editor.setVariableKind(1, 'Text');
    await editor.setVariable(1, 'Status', 'ready');

    // The key is derived from the *name*, so it is the same question it was for
    // a number — nothing about text reaches `variableKeyOf`.
    expect(await editor.variableKey(1)).toBe('status');

    const document = await saved(editor);
    // v14, and the whole reason for it: a v13 `parseVariables` coerces this
    // value with `Number(...)`, so it would open as 0 and carry the rules that
    // name it away with it.
    expect(document.schemaVersion).toBe(SCHEMA);
    expect(document.variables).toEqual([
      { id: expect.any(String), name: 'Status', value: 'ready' },
    ]);

    const path = testInfo.outputPath('texted.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    // The open is the half only a round trip can see: `parseVariables` rebuilds
    // this table field by field, so a string surviving it is a claim about that
    // function rather than about the store.
    await editor.deselect();
    await editor.openPanel('inspect');
    expect(await editor.fieldValue('Variable 1 starts at')).toBe('ready');
    expect(await editor.selectValue('Variable 1 holds')).toBe('text');
  });

  test('switching a kind converts the value rather than losing it', async ({ editor }) => {
    await oneBox(editor);

    await editor.addVariable();
    await editor.setVariable(1, 'Score', 7);
    await editor.setVariableKind(1, 'Text');

    // A conversion rather than a reset, because the value on screen is what the
    // user typed — and `0` for text that is not a number is `parseVariables`'
    // own repair, so the panel and the opener agree.
    expect((await saved(editor)).variables).toEqual([
      { id: expect.any(String), name: 'Score', value: '7' },
    ]);

    await editor.setVariable(1, 'Score', 'abc');
    await editor.setVariableKind(1, 'Number');
    expect((await saved(editor)).variables).toEqual([
      { id: expect.any(String), name: 'Score', value: 0 },
    ]);
  });

  test('a variable can be deleted', async ({ editor }) => {
    await oneBox(editor);

    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);
    await editor.removeVariable('Score');

    expect((await saved(editor)).variables).toEqual([]);
  });
});

test.describe('the editor runs none of it', () => {
  test('a project with no variables exports no table and no helper', async ({ editor }) => {
    await oneBox(editor);

    // The rule the asset table, the tilemap helper, the prefab factories, the
    // emitted `update()` and the touch buttons all follow: a project that
    // predates a feature exports byte for byte what it always did.
    const exported = await editor.exportCode('ts');
    expect(exported.contents).not.toContain('VARIABLES');
    expect(exported.contents).not.toContain('initVariables');
  });

  test('declaring a variable emits the table, the helper and one call', async ({
    editor,
  }) => {
    await oneBox(editor);
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 7);

    const exported = await editor.exportCode('ts');
    expect(exported.contents).toContain('const VARIABLES = {');
    expect(exported.contents).toContain('"score": 7,');
    // The `has` guard is the feature rather than a detail: `create()` runs
    // again every time a scene starts, and `scene.start` is one of the things a
    // rule can do — so an unguarded `set` would reset the score on every change
    // of level and make the registry do nothing for the one job it is here for.
    expect(exported.contents).toContain('if (!scene.registry.has(key))');
    expect(exported.contents).toContain('initVariables(this, VARIABLES);');
  });

  test('the canvas is untouched by a variable', async ({ editor }) => {
    await oneBox(editor);
    const before = await editor.findDrawn(FILL);

    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);
    await editor.deselect();
    await editor.closePanels();

    // Nothing about a variable is drawn, and `EditorScene.ts` is untouched by
    // this whole feature — Audio's claim, one iteration on.
    const after = await editor.findDrawn(FILL);
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  });
});

test.describe('rules', () => {
  test('a rule round-trips, and the editor draws nothing for it', async ({
    editor,
  }, testInfo) => {
    await oneBox(editor);
    const before = await editor.findDrawn(FILL);

    const name = await editor.addRule();
    await editor.deselect();
    await editor.closePanels();

    // Nothing about a rule is drawn: `EditorScene.ts` is untouched by this
    // whole feature, which is Audio's claim and sharper here — a rule destroys
    // objects and starts scenes, so a preview would not animate the document,
    // it would demolish it.
    const after = await editor.findDrawn(FILL);
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(after.count).toBeGreaterThan(before.count * 0.9);

    const document = await saved(editor);
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as { rules?: unknown[] }[])[0];
    expect(scene.rules).toHaveLength(1);

    const path = testInfo.outputPath('ruled.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.fieldValue('Rule 1 name')).toBe(name);
  });

  test('a rule made on an object panel shows on the scene panel', async ({ editor }) => {
    await oneBox(editor);

    // `SceneInspector` renders only with an empty selection, so a rules panel
    // that lived only there would be off screen for the whole of the time a
    // person spends building the objects a rule is about. That is the bug
    // `CollidersSection` shipped with, applied here before it could happen.
    await editor.selectInTree('Rectangle');
    await editor.addRuleOnNode('Rectangle');
    expect(await editor.ruleCount()).toBe(1);

    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
  });

  test('deleting the node a rule names drops it from the panel and leaves the file alone', async ({
    editor,
  }) => {
    await oneBox(editor);
    await editor.selectInTree('Rectangle');
    await editor.addRuleOnNode('Rectangle');
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);

    await editor.selectInTree('Rectangle');
    await editor.page.keyboard.press('Delete');
    await editor.settle();

    // Both readings together, because neither alone can see what is happening:
    // `rulesOf` drops a rule naming a node that is gone, and **nothing prunes
    // it** — not `deleteNode`, not undo, not the scene switcher — exactly as
    // nothing prunes a dangling `followId`, `audioId` or collider row.
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(0);

    const scene = (await saved(editor)).scenes as { rules?: unknown[] }[];
    expect(scene[0].rules).toHaveLength(1);
  });

  test('a collide rule makes the collision row, and one undo takes both', async ({
    editor,
  }) => {
    await editor.clearScene();
    await editor.addObject('Rectangle');
    await editor.selectInTree('Rectangle');
    await editor.setPhysics(true);
    await editor.addObject('Ellipse');
    await editor.selectInTree('Ellipse');
    await editor.setPhysics(true);
    await editor.deselect();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'two objects touch');

    // Arcade's handler *is* the third argument of the `add.collider` call the
    // row emits, so a collide rule needs the row to exist — and creating it
    // here is the first time the write half of "strip on read, refuse on write"
    // is a construction rather than a refusal.
    let document = await saved(editor);
    let scene = (document.scenes as {
      colliders?: unknown[];
      rules?: { when: { kind: string } }[];
    }[])[0];
    expect(scene.colliders).toHaveLength(1);
    expect(scene.rules).toHaveLength(1);

    // One step, and this is the claim: the row and the trigger that needs it
    // were written in one `editScene`, so a single undo takes both. Two steps
    // would leave a collide rule with no row behind — which is exactly the
    // state `rulesOf` drops, so the rule would vanish from the panel on the
    // next read with nothing having said why.
    await editor.undo();
    document = await saved(editor);
    scene = (document.scenes as {
      colliders?: unknown[];
      rules?: { when: { kind: string } }[];
    }[])[0];
    expect(scene.colliders ?? []).toHaveLength(0);
    expect(scene.rules?.[0].when.kind).toBe('tap');
  });

  test('deleting a variable takes the rules that read it, whole', async ({ editor }) => {
    await oneBox(editor);
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);

    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.panel('inspect').getByTitle('Add a check to rule 1').click();
    await editor.settle();

    expect(await editor.ruleCount()).toBe(1);

    await editor.removeVariable('Score');

    // The whole rule, not just the condition. Dropping the condition would
    // *widen* what the rule says — `if score >= 1` removed is a rule that now
    // fires always — and a repair may narrow what the document says and may
    // never widen it. The store says the same thing `rulesOf` says on read.
    expect(await editor.ruleCount()).toBe(0);
    const scene = (await saved(editor)).scenes as { rules?: unknown[] }[];
    expect(scene[0].rules ?? []).toHaveLength(0);
  });

  test('a rule survives a duplicated scene pointing at the copy', async ({ editor }) => {
    await oneBox(editor);
    await editor.selectInTree('Rectangle');
    await editor.addRuleOnNode('Rectangle');
    await editor.deselect();

    await editor.duplicateScene();
    expect(await editor.ruleCount()).toBe(1);

    // The camera's index trick a third time: the two child lists are the same
    // list in the same order, so the copy's rule names the copy's node. A rule
    // left pointing into the scene it was copied from is one `rulesOf` drops on
    // the next read — a rule silently lost on a duplicate.
    const scenes = (await saved(editor)).scenes as {
      children: { id: string }[];
      rules?: { when: { nodeId?: string } }[];
    }[];
    const copy = scenes[1];
    expect(copy.rules?.[0].when.nodeId).toBe(copy.children[0].id);
    expect(copy.rules?.[0].when.nodeId).not.toBe(
      scenes[0].rules?.[0].when.nodeId,
    );
  });

  test('a rule puts no preview button on the toolbar', async ({ editor }) => {
    await oneBox(editor);
    await editor.addRule();
    await editor.closePanels();

    // `hasMotionIn`'s sixth refusal, and the one a reader will most expect to
    // be wrong — a rule is *nothing but* a thing that happens over time. But
    // that toggle exists so a canvas moving by itself can be stopped, and no
    // rule in this editor moves anything at all.
    await expect(
      editor.page.getByRole('button', { name: 'Preview motion' }),
    ).toHaveCount(0);
  });

  test('a project with no rules emits no rule helper at all', async ({ editor }) => {
    await oneBox(editor);

    // The rule the asset table, the tilemap helper, the prefab factories, the
    // emitted `update()` and the touch buttons all follow — one gate per
    // helper, so a project that uses none of them exports byte for byte what
    // it always did.
    const exported = (await editor.exportCode('ts')).contents;
    expect(exported).not.toContain('function onKey');
    expect(exported).not.toContain('function onTap');
    expect(exported).not.toContain('function onMatterHit');
    expect(exported).not.toContain('function onVariableChange');
  });
});

/**
 * The sixth trigger: when the value behind a variable changes.
 *
 * Iteration 28 named this one as the thing on the far side of its own line —
 * *"'while…' or 'when the score passes ten' is the first that has to be watched
 * for every frame"* — and the second half of that example was wrong. Phaser's
 * `DataManager` emits `changedata-<key>` itself, and iteration 30's labels have
 * been listening to it ever since. So every claim here is a version of one
 * claim: **this is a moment Phaser already delivers**, and `update()` still
 * gains nothing.
 *
 * No positive claim, for this file's reason — the editor runs no rule. The one
 * that needs a running game is in `export.spec.ts`.
 */
test.describe('a variable changing', () => {
  /** One box and one number for a rule to watch. */
  async function oneCounter(editor: EditorPage): Promise<void> {
    await oneBox(editor);
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);
  }

  test('the trigger is offered only once a variable exists', async ({ editor }) => {
    await oneBox(editor);
    const name = await editor.addRule();
    await editor.openRule(name);

    // Withheld rather than offered and then silently falling back to
    // `sceneStart`, which is what `defaultTrigger` would have to do with
    // nothing to name. An option that leaves the picker where it was reads as a
    // broken control.
    await editor.openPanel('inspect');
    const when = editor.choice('Rule 1 when');
    await expect(when.getByRole('option', { name: 'a variable changes' })).toHaveCount(0);

    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);
    await editor.openRule(name);
    await expect(when.getByRole('option', { name: 'a variable changes' })).toHaveCount(1);
  });

  test('a varChange rule round-trips, and the editor draws nothing for it', async ({
    editor,
  }, testInfo) => {
    await oneCounter(editor);
    const before = await editor.findDrawn(FILL);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'a variable changes');
    await editor.deselect();
    await editor.closePanels();

    // `EditorScene.ts` is untouched by this whole feature, for the sixth time
    // after Audio, Rules, iteration 29 and iteration 31 — and the canvas has
    // nothing to draw for a moment it never reaches.
    const after = await editor.findDrawn(FILL);
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(after.count).toBeGreaterThan(before.count * 0.9);

    const document = await saved(editor);
    // Still 14 — the guides case, tenth time. No new `NodeType`, and the
    // trigger rides in on `scenes`, which `parseProject` passes through
    // verbatim, so a v14 build carries it back out on a re-save.
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as { rules?: { when: { kind: string } }[] }[])[0];
    expect(scene.rules?.[0].when.kind).toBe('varChange');

    const path = testInfo.outputPath('watched.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    expect(await editor.ruleCount()).toBe(1);
  });

  test('deleting the watched variable takes the rule whole', async ({ editor }) => {
    await oneCounter(editor);
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'a variable changes');
    expect(await editor.ruleCount()).toBe(1);

    await editor.removeVariable('Score');

    // The trigger is the one reference `'variableId' in action` cannot see, so
    // this is the whole of what `ruleUsesVariable`'s new first line buys:
    // without it the document would keep a rule whose *moment* names nothing,
    // and `rulesOf` would drop it on the next read with nothing having said so.
    expect(await editor.ruleCount()).toBe(0);
    const scene = (await saved(editor)).scenes as { rules?: unknown[] }[];
    expect(scene[0].rules ?? []).toHaveLength(0);
  });

  test('it emits a subscription to a moment Phaser delivers, never an update()', async ({
    editor,
  }) => {
    await oneCounter(editor);
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'a variable changes');

    const exported = (await editor.exportCode('ts')).contents;

    // The same `changedata-<key>` a bound label rides on, one consumer over —
    // which is the whole argument that this trigger is on the near side of
    // iteration 28's line.
    expect(exported).toContain('function onVariableChange');
    expect(exported).toContain("scene.registry.events.on('changedata-' + key, run)");
    expect(exported).toContain('onVariableChange(this, "score", () => {');

    // Nothing is polled, so nothing needs a frame.
    expect(exported).not.toContain('update(): void');

    // The guard, which is the whole protection against the one thing this
    // vocabulary can now run away with: `registry.set` emits synchronously, so
    // a rule that writes the variable it watches would re-enter its own handler
    // with no bottom.
    expect(exported).toContain('if (busy) return;');

    // And the unsubscribe, which matters more here than for a label: the
    // registry belongs to the *game*, and `restartScene` is one of this
    // vocabulary's own actions — so every restart would otherwise leave another
    // listener behind holding objects that are gone.
    expect(exported).toContain("scene.registry.events.off('changedata-' + key, run)");
  });

  test('a threshold is the condition that already existed', async ({ editor }) => {
    await oneCounter(editor);
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'a variable changes');
    await editor.openRule(name);
    await editor.panel('inspect').getByTitle('Add a check to rule 1').click();
    await editor.settle();
    await editor.setChoice('Rule 1 check 1 is', 'is at least');
    await editor.setField('Rule 1 check 1 value', 10);

    // "When the score reaches ten" is this trigger plus a gate this vocabulary
    // already had — read once, at the moment, never polled. That split is not a
    // convenience; it is what keeps the whole feature on the near side of the
    // line.
    const exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('onVariableChange(this, "score", () => {');
    expect(exported).toContain('if (this.registry.get("score") >= 10) {');
  });

  test('it puts no preview button on the toolbar', async ({ editor }) => {
    await oneCounter(editor);
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'a variable changes');
    await editor.closePanels();

    // `hasMotionIn`'s tenth refusal. A rule that fires by itself is the hardest
    // one yet to expect false — but that toggle exists so a canvas moving by
    // itself can be stopped, and this canvas never fires one.
    await expect(
      editor.page.getByRole('button', { name: 'Preview motion' }),
    ).toHaveCount(0);
  });
});

test.describe('text on an object', () => {
  /** One text object, alone, and one variable for a rule to show. */
  async function oneLabel(editor: EditorPage): Promise<void> {
    await editor.clearScene();
    await editor.addObject('Text');
    await editor.setField('Name', 'Label');
    await editor.deselect();
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);
  }

  test('a setText rule round-trips, and the editor writes none of it', async ({
    editor,
  }, testInfo) => {
    await oneLabel(editor);

    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', "Set an object's text");
    await editor.setField('Rule 1 do 1 text', 'Score: ');
    await editor.setChoice('Rule 1 do 1 then shows', 'Score');

    const document = await saved(editor);
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as { rules?: { do: unknown[] }[] }[])[0];
    expect(scene.rules?.[0].do).toEqual([
      {
        kind: 'setText',
        nodeId: expect.any(String),
        text: 'Score: ',
        variableId: expect.any(String),
      },
    ]);

    const path = testInfo.outputPath('captioned.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.fieldValue('Rule 1 do 1 text')).toBe('Score: ');
  });

  test('the canvas keeps the text the document states, preview or not', async ({
    editor,
  }) => {
    await oneLabel(editor);
    await editor.selectInTree('Label');
    await editor.setField('Content', 'unchanged');
    await editor.deselect();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', "Set an object's text");
    await editor.setField('Rule 1 do 1 text', 'rewritten');
    await editor.closePanels();

    // `EditorScene.ts` is untouched by this whole feature, which is Audio's
    // claim and Rules' — and sharpest here, because this is the first action
    // whose result would be *visible* on the canvas if anything ran it. The
    // canvas draws `props.text`, so the document is the only thing that can
    // change what is on screen.
    await editor.selectInTree('Label');
    expect(await editor.fieldValue('Content')).toBe('unchanged');
  });

  test('a text check offers only equality, and keeps its rule when the kind switches', async ({
    editor,
  }) => {
    await oneLabel(editor);

    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.panel('inspect').getByTitle('Add a check to rule 1').click();
    await editor.settle();
    await editor.setChoice('Rule 1 check 1 is', 'is at least');
    await editor.setField('Rule 1 check 1 value', 3);

    // Switching the variable the check reads is the one edit that can leave a
    // condition of the wrong kind behind — and a condition the reader refuses
    // costs the *whole rule*, so the rule would vanish from the panel rather
    // than merely losing its gate. The store moves the op and the value with
    // the kind, in one step.
    await editor.setVariableKind(1, 'Text');
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);

    await editor.openRule(name);
    // Only `is` and `is not` mean anything about text: `'won' > 'lost'` is legal
    // JavaScript on code points and nobody asks for it.
    await expect(editor.choice('Rule 1 check 1 is').locator('option')).toHaveCount(2);
    expect(await editor.selectValue('Rule 1 check 1 is')).toBe('eq');
    expect(await editor.fieldValue('Rule 1 check 1 value')).toBe('3');

    await editor.setField('Rule 1 check 1 value', 'won');
    const exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('if (this.registry.get("score") === "won") {');
  });

  test('an ordering check on a text variable costs the whole rule', async ({
    editor,
  }, testInfo) => {
    await oneLabel(editor);
    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.panel('inspect').getByTitle('Add a check to rule 1').click();
    await editor.settle();
    await editor.setChoice('Rule 1 check 1 is', 'is over');

    // Only a hand-edited file can hold this, because the panel converts both
    // halves when a kind is switched — so the document is edited on disk, with
    // the variable made text under a gate the editor would never have written.
    const document = await saved(editor);
    const variables = document.variables as { value: unknown }[];
    variables[0].value = 'a';
    const path = testInfo.outputPath('ordered-text.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    // Dropping the *condition* would widen the rule into one that fires always,
    // and repairing `is over` to `is` would state a test nobody wrote — so the
    // rule goes whole, and the file keeps it, exactly as a rule naming a deleted
    // node is treated.
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(0);
    const scene = (await saved(editor)).scenes as { rules?: unknown[] }[];
    expect(scene[0].rules).toHaveLength(1);
    expect(name).toBeTruthy();
  });
});

test.describe('the emit', () => {
  test('a tap rule emits a hit area, a listener and the action', async ({ editor }) => {
    await oneBox(editor);
    await editor.selectInTree('Rectangle');
    await editor.addRuleOnNode('Rectangle');
    await editor.deselect();

    const exported = (await editor.exportCode('ts')).contents;

    // The hit area is built from the object at runtime rather than from
    // numbers this exporter printed — a text node's size is font-measured and a
    // nine-slice's box is nothing like its source frame, so one helper reading
    // `object.width` is right for all six types at once.
    expect(exported).toContain('function onTap');
    expect(exported).toContain('new Phaser.Geom.Rectangle(0, 0, object.width, object.height)');
    expect(exported).toContain("object.on('pointerdown', handler)");
    expect(exported).toContain('this.scene.restart();');
  });

  test('a rule fires at a moment Phaser already delivers, never in update()', async ({
    editor,
  }) => {
    await oneBox(editor);
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'a key is pressed');

    const exported = (await editor.exportCode('ts')).contents;

    // `onKey` narrows `scene.input.keyboard`, which is `KeyboardPlugin | null`
    // under --strict — and the shared `create()` body can carry no cast, so the
    // narrowing has to live in a module-level helper. `arcadeBody`'s argument.
    expect(exported).toContain('function onKey');
    expect(exported).toContain("keyboard.on('keydown-' + key, handler)");
    expect(exported).toContain('onKey(this, "SPACE", () => {');

    // The line this feature draws: every trigger is a moment Phaser hands over,
    // so nothing here is polled and `update()` gains nothing at all.
    expect(exported).not.toContain('update(): void');
  });

  test('a timer rule emits a TimerEvent with a floor under its delay', async ({
    editor,
  }) => {
    await oneBox(editor);
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'a timer fires');
    await editor.setField('Rule 1 every', 0);
    await editor.page.getByLabel('Rule 1 repeats').check();
    await editor.settle();

    const exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('this.time.addEvent({');
    expect(exported).toContain('loop: true,');
    // A looping timer is the only thing in this vocabulary that can run away: a
    // 0ms delay fires on every step of the game loop. The 1ms floor is the
    // whole of the protection, and it is a repair rather than a refusal because
    // a delay is a rate — `tweenOf` repairs a duration for the same reason.
    expect(exported).toContain('delay: 1,');
  });

  test('a condition becomes one gate over the whole action list', async ({ editor }) => {
    await oneBox(editor);
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);

    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.panel('inspect').getByTitle('Add a check to rule 1').click();
    await editor.settle();

    const exported = (await editor.exportCode('ts')).contents;
    // One `if` around the list, read once at the moment — never a branch inside
    // it. `registry.get` answers `any`, so the comparison needs no annotation
    // in a body that cannot carry one.
    expect(exported).toContain('if (this.registry.get("score") >= 1) {');
  });

  test('a setText action emits a caption, and a variable after it', async ({ editor }) => {
    await editor.clearScene();
    await editor.addObject('Text');
    await editor.setField('Name', 'Label');
    await editor.deselect();
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);

    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', "Set an object's text");
    await editor.setField('Rule 1 do 1 text', 'Score: ');

    // With no variable it is the caption alone, which is the commonest shape —
    // and the one an empty `variableId` would have cost the whole rule.
    let exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('label.setText("Score: ");');

    await editor.setChoice('Rule 1 do 1 then shows', 'Score');
    exported = (await editor.exportCode('ts')).contents;
    // A literal and one read, joined — never a template the emit assembles, and
    // never `setText(registry.get(k))`, which would hand `Text` a number.
    expect(exported).toContain('label.setText("Score: " + this.registry.get("score"));');
    // And nothing else: a `setText` at its default format carries neither field
    // and emits no formatter, so a caption written before iteration 30 exports
    // byte for byte what it always did — the rule the asset table, the tilemap
    // helper and the prefab factories all follow.
    expect(exported).not.toContain('labelValue(');

    await editor.setField('Rule 1 do 1 pad to width', 4);
    exported = (await editor.exportCode('ts')).contents;
    // Formatted, the read goes through the one printed formatter — the same one
    // a bound label reads through, which is the whole reason the two fields are
    // on both: a rule that writes `Score: 0007` and a label that follows the
    // same variable to `Score: 7` is a disagreement nobody sees until the game
    // is in their hand.
    expect(exported).toContain(
      'label.setText("Score: " + labelValue(this.registry.get("score"), -1, 4));',
    );
  });

  test('a text variable is emitted quoted, and widens the helper it is read by', async ({
    editor,
  }) => {
    await oneBox(editor);
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 7);

    // A number-only project emits the signature it always emitted: the
    // byte-for-byte rule the asset table, the tilemap helper and the prefab
    // factories all follow.
    let exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('values: Record<string, number>');
    expect(exported).toContain('"score": 7,');

    await editor.setVariableKind(1, 'Text');
    await editor.setVariable(1, 'Score', 'ready');
    exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('values: Record<string, number | string>');
    expect(exported).toContain('"score": "ready",');
  });

  test('a variable action emits set and inc, not a read-modify-write', async ({
    editor,
  }) => {
    await oneBox(editor);
    await editor.addVariable();
    await editor.setVariable(1, 'Score', 0);

    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Add to a variable');
    await editor.settle();

    const exported = (await editor.exportCode('ts')).contents;
    // Phaser's own `inc` treats an unset key as 0, so it cannot disagree with
    // `initVariables` about what a variable nobody has written holds.
    expect(exported).toContain('this.registry.inc("score", 1);');
  });
});

/**
 * Camera effects: the five verbs iteration 18 refused and iteration 28 made a
 * place for.
 *
 * Every claim here is the near side's, for this file's usual reason and one
 * more of its own. The canvas runs no rule; and the editor's `cameras.main` is
 * the *user's view* of the scene, so an effect run here would move where the
 * user is looking — which is the thing "drawn, never applied" rules out. The
 * positive runtime claim is in `export.spec.ts`, where anything that has to
 * actually run belongs.
 */
test.describe('camera effects', () => {
  /** `CAMERA_COLOR` in EditorScene. Nothing else on this canvas is violet. */
  const CAMERA = '#9b7bff';

  test('a camera effect round-trips, and names nothing to dangle', async ({
    editor,
  }, testInfo) => {
    await oneBox(editor);

    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Shake the camera');
    await editor.setField('Rule 1 do 1 duration', 300);

    const document = await saved(editor);
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as { rules?: { do: unknown[] }[] }[])[0];
    // No `nodeId`, no `variableId`, no `sceneId` — the whole of why nothing in
    // this block can cost a rule, and why `ruleNames` and `remapActionRefs`
    // needed no edit.
    expect(scene.rules?.[0].do).toEqual([
      { kind: 'cameraShake', duration: 300, intensity: 0.05 },
    ]);

    const path = testInfo.outputPath('shaken.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.numberValue('Rule 1 do 1 duration')).toBe(300);
  });

  test('a pan and a zoom move nothing the editor is looking through', async ({
    editor,
  }) => {
    await oneBox(editor);
    const before = await editor.findDrawnBox(FILL);
    const zoomBefore = await editor.zoom();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Pan the camera');
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();
    await editor.setChoice('Rule 1 do 2', 'Zoom the camera');
    await editor.closePanels();
    await editor.settle();

    // The sharpest negative available: if anybody ever wires an effect into
    // `EditorScene`, the user's own view moves and both of these change.
    expect(await editor.zoom()).toBeCloseTo(zoomBefore, 5);
    const after = await editor.findDrawnBox(FILL);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.width).toBeCloseTo(before.width, 0);

    // And nothing new is drawn for one. The violet frame is the shot the scene
    // *opens* on, and this scene's camera is still at its default — an effect
    // is what happens afterwards, which this canvas does not show.
    expect((await editor.findDrawn(CAMERA)).count).toBe(0);
  });

  test('the five effects emit five calls on the one camera', async ({ editor }) => {
    await oneBox(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    const add = editor.panel('inspect').getByTitle('Add an action to rule 1');
    for (const [at, kind] of [
      'Shake the camera',
      'Flash the camera',
      'Fade the camera',
      'Pan the camera',
      'Zoom the camera',
    ].entries()) {
      if (at > 0) await add.click();
      await editor.setChoice(`Rule 1 do ${at + 1}`, kind);
    }
    await editor.settle();

    const exported = (await editor.exportCode('ts')).contents;
    // Whole, defaults included — the camera prologue's call and the emitter
    // config's, and here not even a choice: these are positional arguments
    // with no chain to leave one out of.
    expect(exported).toContain('this.cameras.main.shake(100, 0.05);');
    expect(exported).toContain('this.cameras.main.flash(250, 255, 255, 255);');
    expect(exported).toContain('this.cameras.main.fade(250, 0, 0, 0);');
    expect(exported).toContain('this.cameras.main.zoomTo(2, 1000, "Linear");');
    // Panned somewhere it is not already looking, which is `defaultTween`'s
    // rule: a pan seeded on the current centre runs for a second and arrives
    // where it started, which reads as the feature being broken.
    expect(exported).toMatch(/this\.cameras\.main\.pan\(\d+, \d+, 1000, "Linear"\);/);
    expect(exported).not.toContain('this.cameras.main.pan(480, 270,');

    // A direction rather than a second kind, `setVisible`'s show/hide call.
    await editor.openPanel('inspect');
    await editor.setChoice('Rule 1 do 3 direction', 'Fade in');
    expect((await editor.exportCode('ts')).contents).toContain(
      'this.cameras.main.fadeIn(250, 0, 0, 0);',
    );
  });

  test('a hand-edited effect is repaired, never dropped', async ({
    editor,
  }, testInfo) => {
    await oneBox(editor);
    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Zoom the camera');

    const document = await saved(editor);
    const scene = (document.scenes as { rules: { do: Record<string, unknown>[] }[] }[])[0];
    // Only a hand-edited file can hold any of this: a zoom Phaser would clamp
    // to 0.001 behind your back, an ease `GetEaseFunction` would silently
    // resolve to `Power0`, and a duration that finishes on the frame it starts.
    scene.rules[0].do[0] = { kind: 'cameraZoom', zoom: 0, duration: 0, ease: 'Banana' };

    const path = testInfo.outputPath('bent.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();

    // The rule survives, which is the asymmetry worth asserting rather than
    // assuming: a `setVar` naming a variable that is gone costs the whole rule,
    // because a variable is the one thing a rule names that another rule reads.
    // An effect reaches nothing, so every field repairs and nothing is lost.
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.numberValue('Rule 1 do 1 zoom')).toBe(1);
    expect(await editor.numberValue('Rule 1 do 1 duration')).toBe(1000);
    expect(await editor.selectValue('Rule 1 do 1 easing')).toBe('Linear');
  });
});

test.describe('building one', () => {
  /** The spawn marker's teal, `SPAWN_COLOR` in `EditorScene`. */
  const MARKER = '#00c2a0';
  /** The prefab's own fill, distinct from the marker and from every default. */
  const COIN = '#ff00ff';

  /**
   * One prefab in the library and nothing placing it.
   *
   * `saveAsPrefab` leaves an instance where the object was, and it is cleared
   * away on purpose: with it on screen "nothing is built here" could not be
   * said, because the prefab's own fill would be on the canvas for a reason
   * that is not the rule.
   */
  async function onePrefab(editor: EditorPage): Promise<void> {
    await editor.clearScene();
    await editor.setSnapping(false);
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Coin');
    await editor.setField('Fill', COIN);
    await editor.saveAsPrefab();
    await editor.clearScene();
    await editor.deselect();
    await editor.closePanels();
  }

  test('a spawn round-trips, and names the prefab rather than a node', async ({
    editor,
  }, testInfo) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.setField('Rule 1 do 1 x', 320);
    await editor.setField('Rule 1 do 1 y', 240);

    const document = await saved(editor);
    // Still 14 — the guides case, eleventh time. No new `NodeType`, and the
    // action rides in on `scenes`, which `parseProject` passes through verbatim.
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as { rules?: { do: unknown[] }[] }[])[0];
    expect(scene.rules?.[0].do).toEqual([
      { kind: 'spawn', prefabId: expect.any(String), x: 320, y: 240 },
    ]);

    const path = testInfo.outputPath('spawner.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.numberValue('Rule 1 do 1 x')).toBe(320);
    expect(await editor.numberValue('Rule 1 do 1 y')).toBe(240);
  });

  test('the canvas draws the place and builds nothing at it', async ({ editor }) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.setField('Rule 1 do 1 x', 300);
    await editor.setField('Rule 1 do 1 y', 200);
    await editor.closePanels();
    await editor.settle();

    // The mark is where the document says it is.
    const mark = await editor.findDrawnBox(MARKER);
    expect(mark.count).toBeGreaterThan(20);
    const middle = await editor.sceneToScreen({ x: 300, y: 200 });
    // To a few pixels rather than to one, and the slack is the mark's own
    // making rather than the reading's: this is a *stroked* shape, so each of
    // the extent's two ends carries a colour boundary's sub-pixel phase and the
    // two do not cancel — `findColorBox`' own note, one shape over. What is
    // being claimed is that the ring is centred on the point the document
    // names, which a mark off by half the scene would fail by three hundred.
    expect(Math.abs(mark.x + mark.width / 2 - middle.x)).toBeLessThan(4);

    // And **nothing is built**. This is the assertion that fails the day
    // anybody wires a spawn into `EditorScene`: the prefab's own fill has no
    // pixels on this canvas, because the canvas runs no rule.
    expect((await editor.findDrawn(COIN)).count).toBe(0);
  });

  test('the mark follows the field, and goes when the action does', async ({
    editor,
  }) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.setField('Rule 1 do 1 x', 200);
    await editor.closePanels();
    await editor.settle();
    const before = await editor.findDrawnBox(MARKER);

    await editor.setField('Rule 1 do 1 x', 600);
    await editor.closePanels();
    await editor.settle();
    const after = await editor.findDrawnBox(MARKER);
    expect(after.x).toBeGreaterThan(before.x + 20);

    // Changed away, the mark goes with it — one field, one mark, never two
    // notions of where a rule builds something.
    await editor.setChoice('Rule 1 do 1', 'Restart this scene');
    await editor.closePanels();
    await editor.settle();
    expect((await editor.findDrawn(MARKER)).count).toBe(0);
  });

  test('a spawn puts no preview button on the toolbar', async ({ editor }) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.closePanels();

    // `hasMotionIn`'s eleventh refusal, and the one a reader looks hardest for
    // an addition in: this is the first thing the document can say that *makes*
    // an object, and the first refusal that puts a mark on this canvas. The
    // mark is a place, not a thing — there is no second state for a ▶ to
    // toggle between and nothing moving by itself for it to stop.
    await expect(
      editor.page.getByRole('button', { name: 'Preview motion' }),
    ).toHaveCount(0);
  });

  test('it emits one call to the factory the prefab already had', async ({
    editor,
  }) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.setField('Rule 1 do 1 x', 320);
    await editor.setField('Rule 1 do 1 y', 240);
    await editor.settle();

    const exported = (await editor.exportCode('ts')).contents;
    // A **statement, never a binding**: nothing reads what comes back, which is
    // what keeps a rule's actions a list rather than a program.
    expect(exported).toContain('createCoin(this, 320, 240);');
    expect(exported).not.toMatch(/const \w+ = createCoin\(this, /);
    // The factory is emitted although no instance places it — `collectPrefabs`'
    // rule pass, without which this calls a function that is not declared.
    expect(exported).toContain(
      'function createCoin(scene: Phaser.Scene, x: number, y: number)',
    );
    // A moment Phaser already delivers, so `update()` gains nothing.
    expect(exported).not.toContain('update(): void');
  });

  test('a hand-edited spawn costs the action, never the rule', async ({
    editor,
  }, testInfo) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();
    await editor.settle();

    const document = await saved(editor);
    const scene = (document.scenes as { rules: { do: Record<string, unknown>[] }[] }[])[0];
    // Only a hand-edited file can hold either: a prefab that is not in the
    // library, and coordinates Phaser could not be handed.
    scene.rules[0].do[0] = { kind: 'spawn', prefabId: 'gone', x: 1, y: 2 };

    const path = testInfo.outputPath('bent-spawn.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();

    // The rule survives one action lighter — `destroy`'s split rather than
    // `setVar`'s, because a prefab reaches nothing outside the action naming it
    // where a variable is the one thing another rule reads.
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    await expect(editor.panel('inspect').getByTitle('Remove action 2 of rule 1')).toHaveCount(0);
    expect(await editor.selectValue('Rule 1 do 1')).toBe('restartScene');
    // And nothing is drawn for a spawn the reader dropped.
    await editor.closePanels();
    expect((await editor.findDrawn(MARKER)).count).toBe(0);
  });

  test('a non-finite coordinate is repaired, never dropped', async ({
    editor,
  }, testInfo) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');

    const document = await saved(editor);
    const scene = (document.scenes as { rules: { do: Record<string, unknown>[] }[] }[])[0];
    scene.rules[0].do[0] = {
      ...scene.rules[0].do[0],
      x: 'over there',
      y: null,
    };

    const path = testInfo.outputPath('bent-point.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();

    // `cameraPan`'s two coordinates to the character: there is no gate here to
    // open, so a repair cannot widen what the rule says.
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.numberValue('Rule 1 do 1 x')).toBe(0);
    expect(await editor.numberValue('Rule 1 do 1 y')).toBe(0);
  });

  /**
   * `onePrefab` plus one plain object for a spawn to be built at.
   *
   * Narrow, so the ring drawn 120 units to its right is clear of its fill on
   * both projects, and in the scene's middle so the tether and the ring are
   * both on screen.
   */
  async function prefabAndPlayer(editor: EditorPage): Promise<void> {
    await onePrefab(editor);
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Player');
    await editor.setField('Width', 40);
    await editor.setField('Height', 40);
    await editor.setField('X', 300);
    await editor.setField('Y', 200);
    await editor.deselect();
  }

  /** A rule built from the scene panel that spawns the coin at the player. */
  async function spawnAtPlayer(editor: EditorPage, offsetX = 120): Promise<string> {
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.setChoice('Rule 1 do 1 at', 'Player');
    await editor.setField('Rule 1 do 1 offset x', offsetX);
    return name;
  }

  test('a spawn at an object round-trips, and names the object', async ({
    editor,
  }, testInfo) => {
    await prefabAndPlayer(editor);
    const name = await spawnAtPlayer(editor);

    const document = await saved(editor);
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as {
      children: { id: string; name: string }[];
      rules?: { do: unknown[] }[];
    }[])[0];
    const player = scene.children.find((node) => node.name === 'Player');
    // Choosing an object resets the numbers to an offset of nothing, so what
    // is left is the one field the test set.
    expect(scene.rules?.[0].do).toEqual([
      { kind: 'spawn', prefabId: expect.any(String), x: 120, y: 0, nodeId: player?.id },
    ]);

    const path = testInfo.outputPath('spawn-at.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();
    await editor.openRule(name);
    expect(await editor.selectValue('Rule 1 do 1 at')).toBe(player?.id);
    expect(await editor.numberValue('Rule 1 do 1 offset x')).toBe(120);

    // The field is called `nodeId`, so the rule is on the object's own panel
    // with no edit to `ruleNames` — which is the reason for the name.
    await editor.selectInTree('Player');
    expect(await editor.ruleCount()).toBe(1);
  });

  test('clearing the object takes the key out of the file', async ({ editor }) => {
    await prefabAndPlayer(editor);
    await spawnAtPlayer(editor);
    await editor.setChoice('Rule 1 do 1 at', 'A fixed point');

    const document = await saved(editor);
    const scene = (document.scenes as { rules?: { do: Record<string, unknown>[] }[] }[])[0];
    const action = scene.rules?.[0].do[0] ?? {};
    // Absent is the only spelling of "no anchor" — never a key holding
    // `undefined`, which would vanish through `JSON.stringify` here and survive
    // in memory, two spellings of one state.
    expect(Object.keys(action)).not.toContain('nodeId');
    expect(action).toEqual({
      kind: 'spawn',
      prefabId: expect.any(String),
      x: 480,
      y: 270,
    });
  });

  test('the mark is drawn at the object plus the offset, and follows it', async ({
    editor,
  }) => {
    await prefabAndPlayer(editor);
    await spawnAtPlayer(editor);
    await editor.closePanels();
    await editor.settle();

    // An extent rather than a centre: the tether runs from the object to the
    // ring, so the mark's left end is the object and its right end is past
    // the point the offset names.
    const before = await editor.findDrawnBox(MARKER);
    const anchor = await editor.sceneToScreen({ x: 300, y: 200 });
    const point = await editor.sceneToScreen({ x: 420, y: 200 });
    expect(Math.abs(before.x - anchor.x)).toBeLessThan(4);
    expect(before.x + before.width).toBeGreaterThan(point.x);
    // Nothing built, by the rule the unanchored spawn already keeps.
    expect((await editor.findDrawn(COIN)).count).toBe(0);

    // Moving the object moves the mark: the offset is from the object.
    await editor.selectInTree('Player');
    await editor.setField('X', 400);
    await editor.deselect();
    await editor.closePanels();
    await editor.settle();
    const after = await editor.findDrawnBox(MARKER);
    const moved = await editor.sceneToScreen({ x: 400, y: 200 });
    expect(Math.abs(after.x - moved.x)).toBeLessThan(4);
  });

  test('it emits a call that reads the object when the rule fires', async ({
    editor,
  }) => {
    await prefabAndPlayer(editor);
    await spawnAtPlayer(editor);
    await editor.setField('Rule 1 do 1 offset y', -30);
    await editor.settle();

    const exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('createCoin(this, player.x + 120, player.y - 30);');
  });

  test('a hand-edited spawn at a missing object costs the action', async ({
    editor,
  }, testInfo) => {
    await prefabAndPlayer(editor);
    const name = await spawnAtPlayer(editor);
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();
    await editor.settle();

    const document = await saved(editor);
    const scene = (document.scenes as { rules: { do: Record<string, unknown>[] }[] }[])[0];
    // Not repaired to a fixed point: that would turn an offset of (120, 0)
    // into a prefab built in the corner of the level, which widens what the
    // action says.
    scene.rules[0].do[0] = { ...scene.rules[0].do[0], nodeId: 'gone' };

    const path = testInfo.outputPath('bent-anchor.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();

    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    await expect(editor.panel('inspect').getByTitle('Remove action 2 of rule 1')).toHaveCount(0);
    expect(await editor.selectValue('Rule 1 do 1')).toBe('restartScene');
    await editor.closePanels();
    expect((await editor.findDrawn(MARKER)).count).toBe(0);
  });

  test('deleting the prefab takes the spawn and leaves the rest', async ({
    editor,
  }) => {
    await onePrefab(editor);

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Build a prefab');
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();
    await editor.setChoice('Rule 1 do 2', 'Restart this scene');
    await editor.settle();

    // From the library, with no instance of it ever placed: a prefab only a
    // rule builds is exactly the one that used to have no controls anywhere,
    // and deleting it meant placing one first.
    await editor.managePrefabs();
    await expect(editor.panel('scene').getByTitle('Prefab 1 use')).toHaveText(
      'Placed nowhere — only rules build it (1 spawn action).',
    );
    await expect(editor.treeItems()).toHaveCount(0);
    await editor.deletePrefabFromLibrary('Coin');

    // The action goes and the rule stays, which is the store agreeing with the
    // reader: a dangling prefab costs the action, so a deletion must cost the
    // action too.
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.selectValue('Rule 1 do 1')).toBe('restartScene');
    await expect(
      editor.panel('inspect').getByTitle('Remove action 2 of rule 1'),
    ).toHaveCount(0);

    const document = await saved(editor);
    expect(JSON.stringify(document)).not.toContain('"spawn"');
  });
});

test.describe('pushing one', () => {
  /**
   * One rectangle with a dynamic body, which is the only thing this action
   * accepts.
   *
   * Snapping off for `editing.spec`'s reason — the starter objects are cleared,
   * but a drag-free fixture still wants the canvas to be about one thing — and
   * deselected before any reading, because the scale handle keeps a 44px screen
   * target over the object's own corner and a centroid measured through it sits
   * several pixels off the object's middle.
   */
  async function onePushable(editor: EditorPage): Promise<void> {
    await editor.clearScene();
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Ball');
    await editor.setPhysics(true);
    await editor.deselect();
    await editor.closePanels();
  }

  /** The rule, built through the panel, at the speed the test names. */
  async function pushRule(
    editor: EditorPage,
    x: number,
    y: number,
  ): Promise<string> {
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Push an object');
    await editor.setField('Rule 1 do 1 speed x', x);
    await editor.setField('Rule 1 do 1 speed y', y);
    return name;
  }

  test('a push round-trips, and names the object it moves', async ({
    editor,
  }, testInfo) => {
    await onePushable(editor);
    const name = await pushRule(editor, 240, -180);

    const document = await saved(editor);
    // Still 14 — the guides case, twelfth time. No new `NodeType`, and the
    // action rides in on `scenes`, which `parseProject` passes through verbatim.
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as { rules?: { do: unknown[] }[] }[])[0];
    expect(scene.rules?.[0].do).toEqual([
      { kind: 'setVelocity', nodeId: expect.any(String), x: 240, y: -180 },
    ]);

    const path = testInfo.outputPath('pusher.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.numberValue('Rule 1 do 1 speed x')).toBe(240);
    expect(await editor.numberValue('Rule 1 do 1 speed y')).toBe(-180);
  });

  test('the canvas never moves what a rule pushes', async ({ editor }) => {
    await onePushable(editor);
    await pushRule(editor, 400, -400);
    await editor.deselect();
    await editor.closePanels();
    await editor.settle();

    // The assertion that fails the day anybody wires this into `EditorScene`.
    // Two refusals meet in it: the canvas fires no rule, and it simulates no
    // body at all — so a second reading, taken after long enough for a body at
    // 400px/s to have crossed most of the scene, is the *same* reading.
    const before = await editor.findDrawnBox(FILL);
    expect(before.count).toBeGreaterThan(100);
    await editor.page.waitForTimeout(900);
    const after = await editor.findDrawnBox(FILL);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.count).toBe(before.count);
  });

  test('a push puts no preview button on the toolbar', async ({ editor }) => {
    await onePushable(editor);
    await pushRule(editor, 240, -180);
    await editor.closePanels();

    // `hasMotionIn`'s tenth refusal, and the one a reader will be surest is
    // wrong: this is the first thing the document can say that puts a body in
    // motion. But that button exists so a canvas moving *by itself* can be
    // stopped, and this canvas neither fires the rule nor simulates the body.
    await expect(
      editor.page.getByRole('button', { name: 'Preview motion' }),
    ).toHaveCount(0);
  });

  test('the picker offers a push only against a dynamic body', async ({
    editor,
  }) => {
    await editor.clearScene();
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Ball');
    await editor.deselect();

    const name = await editor.addRule();
    await editor.openRule(name);
    // Withheld rather than offered-and-refused: `defaultAction` could only
    // fall through to `restartScene` with nothing here to push, and an option
    // that leaves the picker where it was reads as a broken control.
    await expect(
      editor.choice('Rule 1 do 1').getByRole('option', { name: 'Push an object' }),
    ).toHaveCount(0);

    await editor.selectInTree('Ball');
    await editor.setPhysics(true);
    await editor.deselect();
    await editor.openRule(name);
    await expect(
      editor.choice('Rule 1 do 1').getByRole('option', { name: 'Push an object' }),
    ).toHaveCount(1);

    // And a *static* body is not a push target either, under either engine:
    // Arcade's `StaticBody` has no velocity at all and Matter integrates none.
    await editor.selectInTree('Ball');
    await editor.setChoice('Body', 'Static — never moves');
    await editor.deselect();
    await editor.openRule(name);
    await expect(
      editor.choice('Rule 1 do 1').getByRole('option', { name: 'Push an object' }),
    ).toHaveCount(0);
  });

  test('a body switched off or made static drops the action, and the file keeps it', async ({
    editor,
  }) => {
    await onePushable(editor);
    await pushRule(editor, 240, -180);
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);

    // `setNodePhysics(id, null)` is the new way to dangle, and it needs no
    // store edit at all: it is `setNodeTween(id, null)` versus `startTween`
    // exactly. The action stops validating, the empty-`do` check takes the
    // rule, and **the document is untouched** — so switching the body back on
    // brings both back, which is `physicsOf`'s own "a node dragged into a group
    // and back out again is the same node".
    await editor.selectInTree('Ball');
    await editor.setPhysics(false);
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(0);

    const document = await saved(editor);
    const scene = (document.scenes as { rules?: { do: { kind: string }[] }[] }[])[0];
    expect(scene.rules?.[0].do[0].kind).toBe('setVelocity');

    await editor.selectInTree('Ball');
    await editor.setPhysics(true);
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);

    // And the other half of the one gate: a body that is still there but is
    // **static**. Both halves have to be asserted, because each is a separate
    // way for `arcadeBody` to throw inside the player's `create()` — and a
    // guard only one of them exercises is a guard half untested.
    await editor.selectInTree('Ball');
    await editor.setChoice('Body', 'Static — never moves');
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(0);

    await editor.selectInTree('Ball');
    await editor.setChoice('Body', 'Dynamic — moves');
    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
  });

  test('a hand-edited push costs the action, never the rule', async ({
    editor,
  }, testInfo) => {
    await onePushable(editor);
    await pushRule(editor, 240, -180);
    // A second action, so the rule has something left when the first goes.
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();

    const document = await saved(editor);
    const scene = (document.scenes as { rules?: { do: unknown[] }[] }[])[0];
    // Only a hand-edited file can hold this: the panel's picker offers the
    // scene's own dynamic-bodied nodes and nothing else.
    scene.rules![0].do[0] = { kind: 'setVelocity', nodeId: 'gone', x: 1, y: 2 };

    const path = testInfo.outputPath('dangling.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();

    // A node reaches nothing outside the action that names it, so dropping one
    // strictly *narrows* what the rule says — where a dangling variable would
    // widen a gate and costs the whole rule. The rule survives, one lighter.
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule('Rule 1');
    await expect(
      editor.panel('inspect').getByTitle('Remove action 2 of rule 1'),
    ).toHaveCount(0);
    expect(await editor.selectValue('Rule 1 do 1')).toBe('restartScene');
  });

  test('a non-finite speed is repaired, never dropped', async ({
    editor,
  }, testInfo) => {
    await onePushable(editor);
    await pushRule(editor, 240, -180);

    const document = await saved(editor);
    const scene = (document.scenes as {
      rules?: { do: Record<string, unknown>[] }[];
    }[])[0];
    scene.rules![0].do[0].x = 'fast';
    scene.rules![0].do[0].y = null;

    const path = testInfo.outputPath('repaired.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();

    // `cameraPan`'s policy: there is no gate here for a repair to open, since
    // zero on both axes is a body told to stop rather than an action that does
    // nothing — so "a repair may narrow and may never widen" is satisfied
    // trivially and the action survives at rest.
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule('Rule 1');
    expect(await editor.numberValue('Rule 1 do 1 speed x')).toBe(0);
    expect(await editor.numberValue('Rule 1 do 1 speed y')).toBe(0);
  });

  test('it emits the body helper the body already needed, and no update()', async ({
    editor,
  }) => {
    await onePushable(editor);
    await pushRule(editor, 240, -180);

    const exported = (await editor.exportCode('ts')).contents;
    // Reached through `arcadeBody` rather than `ball.body`, because
    // `GameObject.body` is a three-way union under `--strict` and the shared
    // `create()` body can carry no cast.
    expect(exported).toContain('arcadeBody(ball).setVelocity(240, -180);');
    // And **no gate was widened**: the helper this calls is the one a dynamic
    // body already turns on, which is the same predicate the reader requires.
    expect(exported.match(/function arcadeBody\(/g)).toHaveLength(1);
    // A moment Phaser already delivers, so iteration 28's line does not move.
    expect(exported).not.toContain('update(): void');
  });

  test('a Matter scene is pushed in Matter own units', async ({ editor }) => {
    await onePushable(editor);
    await editor.setSceneEngine('matter');
    await pushRule(editor, 300, -90);

    const exported = (await editor.exportCode('ts')).contents;
    // Pixels per *step* rather than per second, a step being Matter's own
    // 1000/60 ms base delta — the conversion the body's dials already make, so
    // the document holds one number and a scene switched between engines is
    // pushed at the same rate. Neither figure is round in both units, so a
    // missing conversion reads as 300 and a doubled one as 0.083.
    expect(exported).toMatch(
      /this\.matter\.body\.setVelocity\(matterBodyOf\(\w+\), \{ x: 5, y: -1\.5 \}\);/,
    );
    expect(exported).not.toContain('arcadeBody(');
  });
});

test.describe('moving one', () => {
  /** The rule marker's teal, `SPAWN_COLOR` in `EditorScene` — shared with spawn. */
  const MARKER = '#00c2a0';

  /**
   * Two plain rectangles, neither with a body: a teleport is the one verb
   * about a place that needs no physics at all. Ball is added first, so it is
   * what `defaultAction` seeds.
   */
  async function ballAndGoal(editor: EditorPage): Promise<void> {
    await editor.clearScene();
    await editor.setSnapping(false);
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Ball');
    await editor.setField('Width', 40);
    await editor.setField('Height', 40);
    await editor.setField('X', 200);
    await editor.setField('Y', 200);
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Goal');
    await editor.setField('Width', 40);
    await editor.setField('Height', 40);
    await editor.setField('X', 700);
    await editor.setField('Y', 200);
    await editor.deselect();
    await editor.closePanels();
  }

  /** A rule that moves the ball to a point. */
  async function moveRule(editor: EditorPage, x: number, y: number): Promise<string> {
    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Move an object to');
    await editor.setChoice('Rule 1 do 1 object', 'Ball');
    await editor.setField('Rule 1 do 1 x', x);
    await editor.setField('Rule 1 do 1 y', y);
    return name;
  }

  test('a move round-trips, and names the object it moves', async ({
    editor,
  }, testInfo) => {
    await ballAndGoal(editor);
    const name = await moveRule(editor, 640, 320);

    const document = await saved(editor);
    // Still 14 — no new `NodeType`, and the action rides in on `scenes`.
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as {
      children: { id: string; name: string }[];
      rules?: { do: unknown[] }[];
    }[])[0];
    const ball = scene.children.find((node) => node.name === 'Ball');
    expect(scene.rules?.[0].do).toEqual([
      { kind: 'setPosition', nodeId: ball?.id, x: 640, y: 320 },
    ]);

    const path = testInfo.outputPath('mover.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();
    await editor.openRule(name);
    expect(await editor.numberValue('Rule 1 do 1 x')).toBe(640);
    expect(await editor.numberValue('Rule 1 do 1 y')).toBe(320);

    // On the moved object's own panel, because the field is `nodeId` — and on
    // nobody else's while there is no anchor.
    await editor.selectInTree('Ball');
    expect(await editor.ruleCount()).toBe(1);
    await editor.selectInTree('Goal');
    expect(await editor.ruleCount()).toBe(0);
  });

  test('a move to an object is on both panels, and clearing it takes the key out', async ({
    editor,
  }) => {
    await ballAndGoal(editor);
    await moveRule(editor, 0, 0);
    await editor.setChoice('Rule 1 do 1 at', 'Goal');
    await editor.setField('Rule 1 do 1 offset y', -60);

    const document = await saved(editor);
    const scene = (document.scenes as {
      children: { id: string; name: string }[];
      rules?: { do: Record<string, unknown>[] }[];
    }[])[0];
    const goal = scene.children.find((node) => node.name === 'Goal');
    expect(scene.rules?.[0].do[0]).toEqual({
      kind: 'setPosition',
      nodeId: expect.any(String),
      x: 0,
      y: -60,
      atId: goal?.id,
    });

    // `atId` is the one second node reference an action carries, so this is the
    // one place `ruleNames` could not inherit the answer from a field name.
    await editor.selectInTree('Goal');
    expect(await editor.ruleCount()).toBe(1);

    await editor.deselect();
    await editor.openRule('Rule 1');
    await editor.setChoice('Rule 1 do 1 at', 'A fixed point');
    const cleared = await saved(editor);
    const action =
      (cleared.scenes as { rules?: { do: Record<string, unknown>[] }[] }[])[0].rules?.[0]
        .do[0] ?? {};
    expect(Object.keys(action)).not.toContain('atId');
    expect(action).toMatchObject({ x: 480, y: 270 });
  });

  test('the canvas marks the destination and moves nothing', async ({ editor }) => {
    await editor.clearScene();
    await editor.setSnapping(false);
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Ball');
    await editor.setField('Width', 40);
    await editor.setField('Height', 40);
    await editor.setField('X', 200);
    await editor.setField('Y', 200);
    await editor.deselect();
    await editor.closePanels();
    await editor.settle();
    const before = await editor.findDrawnBox(FILL);

    await moveRule(editor, 600, 200);
    await editor.deselect();
    await editor.closePanels();
    await editor.settle();

    // The tether runs from the object to the ring, so the mark's left end is
    // the ball and its right end is past the destination.
    const mark = await editor.findDrawnBox(MARKER);
    expect(mark.count).toBeGreaterThan(20);
    const from = await editor.sceneToScreen({ x: 200, y: 200 });
    const to = await editor.sceneToScreen({ x: 600, y: 200 });
    expect(Math.abs(mark.x - from.x)).toBeLessThan(4);
    expect(mark.x + mark.width).toBeGreaterThan(to.x);

    // And the ball has not gone anywhere: the assertion that fails the day
    // anybody wires a rule into `EditorScene`.
    const after = await editor.findDrawnBox(FILL);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    await expect(
      editor.page.getByRole('button', { name: 'Preview motion' }),
    ).toHaveCount(0);
  });

  test('a static Arcade body is not offered, and a hand-edited one costs the action', async ({
    editor,
  }, testInfo) => {
    await editor.clearScene();
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Wall');
    await editor.setPhysics(true);
    await editor.setChoice('Body', 'Static — never moves');
    await editor.deselect();

    // The only object is a static body, so the verb is withheld —
    // `setVelocity`'s mechanism, for its reason.
    const name = await editor.addRule();
    await editor.openRule(name);
    await expect(
      editor.choice('Rule 1 do 1').getByRole('option', { name: 'Move an object to' }),
    ).toHaveCount(0);

    // Under Matter a static body *is* movable — its Transform setter moves it.
    await editor.setSceneEngine('matter');
    await editor.deselect();
    await editor.openRule(name);
    await expect(
      editor.choice('Rule 1 do 1').getByRole('option', { name: 'Move an object to' }),
    ).toHaveCount(1);
    await editor.setSceneEngine('arcade');

    // A hand-edited file: a static target and a dangling anchor, beside a third
    // action that keeps the rule alive. Both cost the action, never the rule.
    await editor.deselect();
    await editor.openRule(name);
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();
    const document = await saved(editor);
    const scene = (document.scenes as {
      children: { id: string }[];
      rules?: { do: unknown[] }[];
    }[])[0];
    const wall = scene.children[0].id;
    scene.rules![0].do = [
      { kind: 'setPosition', nodeId: wall, x: 1, y: 2 },
      { kind: 'setPosition', nodeId: wall, x: 1, y: 2, atId: 'gone' },
      { kind: 'restartScene' },
    ];
    const path = testInfo.outputPath('static-move.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);
    await editor.deselect();

    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.selectValue('Rule 1 do 1')).toBe('restartScene');
    await expect(
      editor.panel('inspect').getByTitle('Remove action 2 of rule 1'),
    ).toHaveCount(0);
  });

  test('it emits setPosition, a read of the anchor, and Body.reset for a body', async ({
    editor,
  }) => {
    await ballAndGoal(editor);
    await moveRule(editor, 640, 320);

    let exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('ball.setPosition(640, 320);');
    expect(exported).not.toContain('update(): void');

    await editor.setChoice('Rule 1 do 1 at', 'Goal');
    await editor.setField('Rule 1 do 1 offset x', 10);
    await editor.setField('Rule 1 do 1 offset y', -20);
    await editor.settle();
    exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('ball.setPosition(goal.x + 10, goal.y - 20);');

    // A dynamic Arcade body goes through `Body.reset`, which moves the body with
    // the object and stops it — through the helper the body already needed.
    await editor.selectInTree('Ball');
    await editor.setPhysics(true);
    exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('arcadeBody(ball).reset(goal.x + 10, goal.y - 20);');
    expect(exported.match(/function arcadeBody\(/g)).toHaveLength(1);

    // Matter's own Transform moves the body, so a plain `setPosition` is right.
    await editor.setSceneEngine('matter');
    exported = (await editor.exportCode('ts')).contents;
    expect(exported).toContain('ball.setPosition(goal.x + 10, goal.y - 20);');
    expect(exported).not.toContain('.reset(');
  });
});

test.describe('making one throw', () => {
  /**
   * The particle texture, in a colour nothing else on the canvas draws.
   *
   * `particles.spec.ts`' own `PARTICLE`, reused deliberately rather than picked
   * again: it already clears the selection outline `0x00e5ff`, the guides
   * `0xff3ea5` and `0xffa723`, the emitter marker `#ff6bd6`, the frame
   * `0x5a6478` and the scene `#1d2330` by well over `findColor`'s per-channel
   * tolerance of 24, and a second green a few steps away would be a colour this
   * file has to re-derive every time one is added anywhere in `tests/`.
   */
  const PARTICLE = '#00ff6a';

  /** The colour the editor draws a stopped emitter's marker in. */
  const MARKER = '#ff6bd6';

  /**
   * One emitter, alone, pinned so that what it draws is something a colour
   * count can honestly measure — `particles.spec.ts`' fixture and its reasons:
   * no speed, so particles stay on the emitter; constant scale and alpha, so
   * the blob is one size and opaque; a lifespan long enough that nothing dies
   * mid-assertion.
   */
  async function oneEmitter(editor: EditorPage, name = 'Smoke'): Promise<void> {
    await editor.addObject('Particles');
    await editor.setField('Name', name);
    // Imported once and then *picked*, because two emitters in one project
    // share one image: a second import of the same file name would put a
    // second row in the library and `Use spark.png` would match both.
    const row = editor.panel('inspect').getByTitle('Use spark.png');
    if ((await row.count()) === 0) {
      await editor.importImage({
        name: 'spark.png',
        buffer: solidPng(64, 64, PARTICLE),
      });
    } else {
      await row.click();
      await editor.settle();
    }
    await editor.setField('Speed min', 0);
    await editor.setField('Speed max', 0);
    await editor.setField('Scale start', 1);
    await editor.setField('Scale end', 1);
    await editor.setField('Alpha start', 1);
    await editor.setField('Alpha end', 1);
    await editor.setField('Lifespan', 5000);
    await editor.setField('Quantity', 4);
  }

  test('a burst round-trips, and names the emitter it throws from', async ({
    editor,
  }, testInfo) => {
    await editor.clearScene();
    await oneEmitter(editor);
    await editor.deselect();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Burst particles');
    await editor.setField('Rule 1 do 1 count', 40);

    const document = await saved(editor);
    // Still 14 — the guides case, fifteenth time. No new `NodeType`, and the
    // action rides in on `scenes`, which `parseProject` passes through verbatim.
    expect(document.schemaVersion).toBe(SCHEMA);
    const scene = (document.scenes as { rules?: { do: unknown[] }[] }[])[0];
    expect(scene.rules?.[0].do).toEqual([
      { kind: 'burstParticles', nodeId: expect.any(String), count: 40 },
    ]);

    const path = testInfo.outputPath('burst.phaser.json');
    await fs.writeFile(path, JSON.stringify(document), 'utf8');
    await editor.newProject();
    await editor.openFile(path);

    await editor.deselect();
    expect(await editor.ruleCount()).toBe(1);
    await editor.openRule(name);
    expect(await editor.numberValue('Rule 1 do 1 count')).toBe(40);
  });

  test('the emitted config says `emitting: false` only where a rule waits', async ({
    editor,
  }) => {
    await editor.clearScene();
    await oneEmitter(editor, 'Smoke');
    await editor.deselect();
    await oneEmitter(editor, 'Steam');
    await editor.deselect();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Start particles');
    await editor.setChoice('Rule 1 do 1 object', 'Smoke');
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();
    await editor.setChoice('Rule 1 do 2', 'Stop particles');
    await editor.setChoice('Rule 1 do 2 object', 'Steam');

    const exported = (await editor.exportCode('ts')).contents;

    // The claim this feature's whole shape rests on, asserted rather than
    // assumed. There is no `emitting` prop in the document: the exporter
    // *derives* it from whether a rule starts or bursts the emitter, which is
    // `ctx.ruleTweens`' `paused: true` one type over and is what keeps
    // iteration 15's "there is no `emitting` prop" true rather than overturning
    // it. Scoped to each emitter's own literal rather than asserted over the
    // whole file, because a whole-file `not.toContain` is a shared resource.
    const smoke = exported.slice(
      exported.indexOf('const smoke = '),
      exported.indexOf('const steam = '),
    );
    const steam = exported.slice(exported.indexOf('const steam = '));
    expect(smoke).toContain('emitting: false,');
    // And the other half: an emitter a rule only *stops* was running, so its
    // config is untouched and its export has not moved by a byte. Without this
    // the derivation could be "any rule naming it" and every test above would
    // still pass.
    expect(steam).not.toContain('emitting: false,');

    // Phaser's own verbs, on the binding the object list already made — no
    // helper, no cast, and therefore nothing drawn from the module identifier
    // set and nothing above it moved.
    expect(exported).toContain('smoke.start();');
    expect(exported).toContain('steam.stop();');
    // A moment Phaser already delivers, so iteration 28's line does not move.
    expect(exported).not.toContain('update(): void');
  });

  test('the canvas throws nothing for a rule, and ▶ still throws everything', async ({
    editor,
  }) => {
    await editor.clearScene();
    await oneEmitter(editor);
    await editor.deselect();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Start particles');
    await editor.closePanels();
    await editor.settle();

    // The assertion that fails the day anybody wires this into `EditorScene`.
    // The scene has started, a rule says to start this emitter, and the canvas
    // fires no rule — so the marker is what is drawn and no particle is.
    await editor.page.waitForTimeout(600);
    expect(
      (await editor.findDrawn(PARTICLE)).count,
      'the canvas fired a rule',
    ).toBe(0);
    expect((await editor.findDrawn(MARKER)).count).toBeGreaterThan(100);

    // And the half that proves the rule has not taken preview's answer away:
    // ▶ still runs every emitter, including one the *export* emits stopped.
    // That disagreement is `previewMotion`'s own documented nature and is
    // exactly what a rule-started tween (`paused: true`) already does.
    await editor.setPreview(true);
    await editor.closePanels();
    await expect
      .poll(async () => (await editor.findDrawn(PARTICLE)).count, {
        timeout: 10_000,
        message: 'preview no longer runs an emitter a rule starts',
      })
      .toBeGreaterThan(100);
  });

  test('the picker offers the particles verbs only against an emitter', async ({
    editor,
  }) => {
    await editor.clearScene();
    await editor.addObject('Rectangle');
    await editor.deselect();

    const name = await editor.addRule();
    await editor.openRule(name);
    // Withheld rather than offered-and-refused — `setVelocity`'s mechanism for
    // its reason: `defaultAction` could only fall through to `restartScene`
    // with no emitter here, and an option that leaves the picker where it was
    // reads as a broken control.
    for (const label of ['Start particles', 'Stop particles', 'Burst particles']) {
      await expect(
        editor.choice('Rule 1 do 1').getByRole('option', { name: label }),
      ).toHaveCount(0);
    }

    await oneEmitter(editor);
    await editor.deselect();
    await editor.openRule(name);
    for (const label of ['Start particles', 'Stop particles', 'Burst particles']) {
      await expect(
        editor.choice('Rule 1 do 1').getByRole('option', { name: label }),
      ).toHaveCount(1);
    }
  });

  test('a hand-edited throw costs the action, never the rule', async ({
    editor,
  }, testInfo) => {
    await editor.clearScene();
    await oneEmitter(editor);
    await editor.deselect();
    await editor.addObject('Rectangle');
    await editor.setField('Name', 'Box');
    await editor.deselect();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Start particles');
    // A second action, so the rule has something left when the first goes.
    await editor.panel('inspect').getByTitle('Add an action to rule 1').click();

    const document = await saved(editor);
    const scene = (document.scenes as {
      children: { id: string; name: string }[];
      rules?: { do: unknown[] }[];
    }[])[0];
    const box = scene.children.find((node) => node.name === 'Box')!;

    // Two ways to be wrong and only a hand-edited file can hold either, since
    // the panel's picker offers the scene's own emitters and nothing else.
    // Asserted as a pair on purpose: a node that is *gone* and a node that is
    // *not an emitter* are two different documents and one refusal, and a test
    // exercising only the first leaves half the gate untested.
    for (const [file, bad] of [
      ['gone', 'nothing-at-all'],
      ['wrong-type', box.id],
    ] as const) {
      scene.rules![0].do[0] = { kind: 'startParticles', nodeId: bad };
      const path = testInfo.outputPath(`${file}.phaser.json`);
      await fs.writeFile(path, JSON.stringify(document), 'utf8');
      await editor.newProject();
      await editor.openFile(path);
      await editor.deselect();

      // `destroy`'s and `setVelocity`'s split: a node reaches nothing outside
      // the action that names it, so dropping one strictly *narrows* what the
      // rule says. The rule survives, one action lighter.
      expect(await editor.ruleCount(), file).toBe(1);
      await editor.openRule('Rule 1');
      await expect(
        editor.panel('inspect').getByTitle('Remove action 2 of rule 1'),
      ).toHaveCount(0);
      expect(await editor.selectValue('Rule 1 do 1')).toBe('restartScene');
    }
  });

  test('a hand-edited burst count is repaired and clamped, never dropped', async ({
    editor,
  }, testInfo) => {
    await editor.clearScene();
    await oneEmitter(editor);
    await editor.deselect();

    const name = await editor.addRule();
    await editor.setRuleTrigger(name, 1, 'the scene starts');
    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Burst particles');

    const document = await saved(editor);
    const scene = (document.scenes as {
      rules?: { do: Record<string, unknown>[] }[];
    }[])[0];

    // `cameraPan`'s policy: there is no gate inside this action for a repair to
    // open. The floor is 1 because `explode(0)` runs perfectly and throws
    // nothing, and the cap is `MAX_BURST` because `explode(n)` allocates `n`
    // particles on the frame it fires — on a looping timer, every frame after.
    for (const [file, count, want] of [
      ['nonsense', 'lots', 24],
      ['zero', 0, 1],
      ['runaway', 999_999, 500],
    ] as const) {
      scene.rules![0].do[0].count = count;
      const path = testInfo.outputPath(`${file}.phaser.json`);
      await fs.writeFile(path, JSON.stringify(document), 'utf8');
      await editor.newProject();
      await editor.openFile(path);
      await editor.deselect();

      expect(await editor.ruleCount(), file).toBe(1);
      await editor.openRule('Rule 1');
      expect(await editor.numberValue('Rule 1 do 1 count'), file).toBe(want);
    }
  });

  test('the preview button tracks the emitter, and a rule adds nothing to it', async ({
    editor,
  }) => {
    // `hasMotionIn`'s fifteenth refusal, asserted as the three readings that
    // actually distinguish it rather than only the easy one. The claim is not
    // "no button" — it is that the button is the *emitter's*, so a rule can
    // neither put one there nor add a second reason for one.
    const preview = editor.page.getByRole('button', { name: 'Preview motion' });

    await editor.clearScene();
    await editor.addObject('Rectangle');
    await editor.deselect();
    const name = await editor.addRule();
    await editor.openRule(name);
    await editor.closePanels();
    // A rule on its own moves nothing this canvas draws, so there is nothing
    // to preview and no button — which is what makes the next reading mean
    // something rather than being true from the start.
    await expect(preview).toHaveCount(0);

    await oneEmitter(editor);
    await editor.deselect();
    await editor.closePanels();
    // The emitter put it there, by existing. No rule names it yet.
    await expect(preview).toHaveCount(1);

    await editor.openRule(name);
    await editor.setChoice('Rule 1 do 1', 'Start particles');
    await editor.closePanels();
    // And the rule added nothing: still exactly one, because that toggle exists
    // so a canvas moving *by itself* can be stopped, and the thing moving is
    // the emitter either way. A second button — or a first one appearing only
    // now — would mean `hasMotionIn` had learnt about rules, which is the edit
    // this feature deliberately did not make.
    await expect(preview).toHaveCount(1);
  });
});
