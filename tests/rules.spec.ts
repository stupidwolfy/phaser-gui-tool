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
 */

/** The default rectangle fill, which a plain new rectangle draws in. */
const FILL = '#4f8cff';

/** The version a saved file must carry now that `project.variables` exists. */
const SCHEMA = 13;

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
