import { promises as fs } from 'node:fs';

import { expect, test } from './helpers/fixtures';
import type { EditorPage } from './helpers/editor';

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
const SCHEMA = 14;

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
