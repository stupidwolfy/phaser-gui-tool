import { useState } from 'react';
import {
  countPrefabSpawns,
  countPrefabUses,
  useActiveScene,
  useEditorStore,
  usePrefabs,
  useScenes,
  useSelectionNodes,
} from '../core/store';
import {
  DEFAULT_CAMERA,
  EFFECT_KINDS,
  EMPTY_TILE,
  RULE_ACTION_KINDS,
  RULE_KEYS,
  RULE_OPERATORS,
  RULE_OPERATOR_LABEL,
  RULE_TRIGGER_KINDS,
  TEXT_OPERATORS,
  TWEEN_EASES,
  VARIABLE_KINDS,
  type VariableKind,
  cameraOf,
  cameraViewOf,
  canBeTapped,
  canHavePhysics,
  coerceVariableValue,
  collidableNodes,
  collidersNaming,
  collidersOf,
  containsInstance,
  containsNode,
  controlsOf,
  defaultEffect,
  blendModeOf,
  scrollFactorOf,
  isDefaultScrollFactor,
  MAX_SCROLL_FACTOR,
  BLEND_MODES,
  effectsOf,
  findAsset,
  findAudio,
  findParent,
  findVariable,
  frameCountOf,
  frameGridOf,
  frameNamesOf,
  guidesOf,
  isDefaultCamera,
  labelFormatOf,
  labelOf,
  MAX_DECIMALS,
  MAX_BURST,
  MAX_EFFECTS,
  MAX_PAD,
  RAW_DECIMALS,
  physicsOf,
  rulesNaming,
  rulesOf,
  scenePhysicsOf,
  siblingsOf,
  soundsOf,
  tileLayerOf,
  tileMapOf,
  tweenOf,
  variableKindOf,
  type GameObjectNode,
  type BlendMode,
  type NodeEffect,
  type NineSliceProps,
  type ParticlesProps,
  type Project,
  type RuleAction,
  type RuleOperator,
  type RuleTrigger,
  type SceneDoc,
  type SceneRule,
  type TextProps,
  type TileMap,
  type TileSpriteProps,
  type TweenEase,
  type TweenProperty,
} from '../core/schema';
import { variableKeysOf } from '../io/exportPhaser';
import { AssetPicker, AssetSummary, SheetSection } from './AssetPicker';
import { AudioSection } from './AudioPicker';
import { FontPicker } from './FontPicker';
import { SolidPalette, TilePalette } from './TilePalette';
import { AnimationEditor } from './AnimationEditor';
import { Section, SectionsToggle } from './Section';
import { CheckboxField, ColorField, NumberField, SelectField, TextField } from './fields';

/**
 * Edits the selection: one object in full, several at once through the actions
 * that make sense for a set, or the scene itself when nothing is selected.
 */
export function Inspector() {
  // The selection's roots, so picking a group and something inside it edits the
  // group rather than showing two panels' worth of the same objects.
  const nodes = useSelectionNodes();
  if (nodes.length > 1) return <SelectionInspector nodes={nodes} />;
  return nodes.length === 1 ? <NodeInspector node={nodes[0]} /> : <SceneInspector />;
}

/**
 * The multi-object panel.
 *
 * Deliberately only the operations that mean one unambiguous thing for a set —
 * group, duplicate, show/hide, delete. Position and size fields are not among
 * them: with several objects selected there is no single number to show, and a
 * field that displayed one object's value while writing to all of them is the
 * kind of control that loses work. Moving several objects is the canvas drag
 * and the arrow keys, both of which apply a delta rather than a value.
 */
function SelectionInspector({ nodes }: { nodes: GameObjectNode[] }) {
  const select = useEditorStore((s) => s.select);
  const groupSelection = useEditorStore((s) => s.groupSelection);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const setSelectionVisible = useEditorStore((s) => s.setSelectionVisible);
  const createPrefabFromSelection = useEditorStore((s) => s.createPrefabFromSelection);

  const anyVisible = nodes.some((node) => node.visible);
  // A definition may not place a prefab of its own — see `prefabChildrenOf`.
  const nestsPrefab = containsInstance(nodes);

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{nodes.length} objects</span>
        <SectionsToggle />
        <button
          className="icon-btn icon-btn--danger"
          onClick={deleteSelection}
          title="Delete these objects"
        >
          ✕
        </button>
      </div>

      <p className="hint">Drag any one of them on the canvas to move them together.</p>

      <Section title="Selection">
        <div className="arrange-row">
          <button className="btn btn--add" onClick={groupSelection}>
            Group
          </button>
          <button className="btn btn--add" onClick={duplicateSelection}>
            Duplicate
          </button>
          <button className="btn btn--add" onClick={() => setSelectionVisible(!anyVisible)}>
            {anyVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        <button
          className="btn btn--block"
          disabled={nestsPrefab}
          onClick={createPrefabFromSelection}
          title={
            nestsPrefab
              ? 'A prefab cannot contain another prefab yet'
              : 'Reuse these objects, linked, anywhere in the project'
          }
        >
          Save as prefab
        </button>
      </Section>

      <AlignSection count={nodes.length} />

      <Section title="Objects">
        <ul className="tree">
          {nodes.map((node) => (
            <li key={node.id} className="tree__group">
              <div className="tree__item">
                {/* Tapping one drops back to editing just that object, which is
                    the only way out of the multi panel that does not also mean
                    losing the selection you have just built. */}
                <button className="tree__label" onClick={() => select(node.id)}>
                  <span className="tree__type" data-type={node.type} />
                  <span className="tree__name">{node.name}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/**
 * Align and distribute.
 *
 * Both act on the objects' *drawn* boxes, which the renderer publishes to
 * `core/bounds` — lining up the stored x/y would line up origins, and two
 * objects of different sizes with the same origin do not look aligned.
 *
 * Alignment is relative to the selection's own bounding box, so it never moves
 * anything outside what is selected and pressing the same button twice does
 * nothing the second time. Distribute needs three objects: with two, the outer
 * pair is the whole selection and there is nothing in between to space.
 */
function AlignSection({ count }: { count: number }) {
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const alignSelectionToScene = useEditorStore((s) => s.alignSelectionToScene);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);
  const canDistribute = count >= 3;
  // One object has nothing to align to but itself, so `alignSelection` refuses
  // below two. Disabled rather than silently inert: a button that does nothing
  // when pressed is worse than one that says it cannot.
  const canAlign = count >= 2;

  return (
    <Section title="Align">
      <div className="align-grid">
        <button
          className="btn btn--add"
          title="Align left edges"
          disabled={!canAlign}
          onClick={() => alignSelection('left')}
        >
          Left
        </button>
        <button
          className="btn btn--add"
          title="Align centres horizontally"
          disabled={!canAlign}
          onClick={() => alignSelection('centerX')}
        >
          Centre
        </button>
        <button
          className="btn btn--add"
          title="Align right edges"
          disabled={!canAlign}
          onClick={() => alignSelection('right')}
        >
          Right
        </button>
        <button
          className="btn btn--add"
          title="Align top edges"
          disabled={!canAlign}
          onClick={() => alignSelection('top')}
        >
          Top
        </button>
        <button
          className="btn btn--add"
          title="Align centres vertically"
          disabled={!canAlign}
          onClick={() => alignSelection('middleY')}
        >
          Middle
        </button>
        <button
          className="btn btn--add"
          title="Align bottom edges"
          disabled={!canAlign}
          onClick={() => alignSelection('bottom')}
        >
          Bottom
        </button>
      </div>

      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Space evenly across — needs three objects"
          disabled={!canDistribute}
          onClick={() => distributeSelection('x')}
        >
          Spread ↔
        </button>
        <button
          className="btn btn--add"
          title="Space evenly down — needs three objects"
          disabled={!canDistribute}
          onClick={() => distributeSelection('y')}
        >
          Spread ↕
        </button>
      </div>

      {/* Against the scene rather than the selection's own box. This is the one
          alignment a single object can ask for — lining one object up with
          itself is a no-op by construction — which is why these are the buttons
          that stay enabled when the six above are not. */}
      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Centre horizontally in the scene"
          onClick={() => alignSelectionToScene('centerX')}
        >
          Centre in scene ↔
        </button>
        <button
          className="btn btn--add"
          title="Centre vertically in the scene"
          onClick={() => alignSelectionToScene('middleY')}
        >
          Centre in scene ↕
        </button>
      </div>
    </Section>
  );
}

function SceneInspector() {
  const scene = useActiveScene();
  const sceneCount = useScenes().length;
  const updateScene = useEditorStore((s) => s.updateScene);
  const duplicateScene = useEditorStore((s) => s.duplicateScene);
  const removeScene = useEditorStore((s) => s.removeScene);

  return (
    <div className="panel">
      <div className="panel__header">
        <span>Scene</span>
        <SectionsToggle />
      </div>
      <p className="hint">Select an object to edit it.</p>

      <TextField
        label="Name"
        value={scene.name}
        onChange={(name) => updateScene({ name })}
      />
      <div className="field-row">
        <NumberField
          label="Width"
          value={scene.width}
          min={1}
          onChange={(width) => updateScene({ width })}
        />
        <NumberField
          label="Height"
          value={scene.height}
          min={1}
          onChange={(height) => updateScene({ height })}
        />
      </div>
      <ColorField
        label="Background"
        value={scene.backgroundColor}
        onChange={(backgroundColor) => updateScene({ backgroundColor })}
      />

      {/* Here rather than in the switcher row, which is a row of things you tap
          to change scenes: a delete button among them is one thumb-width from
          the chip beside it. These act on the scene whose fields are directly
          above them, which is also what makes them unambiguous with no chip to
          point at. */}
      <div className="field-row">
        <button
          className="btn btn--block"
          onClick={duplicateScene}
          title="Copy this scene, objects and all, into a new one"
        >
          Duplicate scene
        </button>
        <button
          className="btn btn--block btn--danger"
          disabled={sceneCount < 2}
          onClick={() => removeScene(scene.id)}
          title={
            sceneCount < 2
              ? 'A project needs at least one scene'
              : 'Delete this scene and everything in it'
          }
        >
          Delete scene
        </button>
      </div>

      <CameraSection />

      <WorldSection />

      <CollidersSection />

      {/* Here rather than in the scene panel beside the prefab list, which was
          the other candidate: a prefab is *placed*, over and over, so reaching
          it must not cost a deselect first, while a sound is imported and tuned
          a handful of times in a project's life. It sits with the scene's own
          fields, the gravity and the guides, which is what it is one of. */}
      <AudioSection />

      {/* With the sounds and for their reason: a variable is declared and tuned
          a handful of times in a project's life, and it names no node. It sits
          below the audio rather than above it because a sound is a thing the
          scene has and a variable is a thing the *project* has, so it reads as
          the last and widest of the scene panel's settings. */}
      <VariablesSection />

      {/* Last of the scene's own settings, because it is the one that reads
          every other: a rule names the objects in the tree, the sounds the
          panel above registers and the variables the panel above that
          declares. */}
      <RulesSection />

      <SnappingSection />
      {/* A peer of Snapping rather than a child of it, which is where it used to
          render. Sections do not nest, and here that is more than a house rule:
          the guides are saved with the document while the snapping toggles are
          editor preferences, so burying the one inside the other would have put
          a part of the project behind a panel setting. */}
      <GuidesSection />
    </div>
  );
}

/**
 * The numbers the game keeps.
 *
 * Project state shown on the scene panel, which is the one thing here that is
 * not what it looks like — `AudioSection` above it edits the *scene's* list of
 * sounds while the table of files is the project's, and this edits the project
 * outright. It is here because `SceneInspector` is where every setting that is
 * about the game rather than about one object already lives, and because the
 * alternative (a fourth mobile tab) costs a `MobileTab`, a sheet, a
 * `SHEET_TITLE` and a quarter of a 390px tab bar.
 *
 * Each row shows the registry key it derives, the way an audio row shows the
 * key it plays as — `variableKeyOf` is exported from the exporter so the row
 * and the output cannot disagree about it. It shows the *de-duplicated* key,
 * because two variables deriving one key is a value silently shared at runtime,
 * and the suffix is the only thing on screen that says so.
 */
function VariablesSection() {
  const project = useEditorStore((s) => s.project);
  const variables = project.variables;
  const addVariable = useEditorStore((s) => s.addVariable);
  const updateVariable = useEditorStore((s) => s.updateVariable);
  const setVariableKind = useEditorStore((s) => s.setVariableKind);
  const removeVariable = useEditorStore((s) => s.removeVariable);

  // The exporter's own answer rather than a second walk, so the key a row shows
  // is the key the export writes. Derived here rather than in a selector
  // because it builds a fresh Map every call — the `tileMapOf` trap, and the
  // reason every reader in `schema.ts` carries that warning.
  const keys = variableKeysOf(project);

  return (
    <Section title="Variables">

      {variables.length === 0 ? (
        <p className="hint">
          Nothing here counts anything yet. A variable is a number or a line of text the
          game keeps — a score, a lives count, a message to show — and it survives a
          change of scene.
        </p>
      ) : null}

      {variables.map((variable, index) => {
        const kind = variableKindOf(variable);
        return (
          <div key={variable.id}>
            <div className="field-row">
              <TextField
                label={`Variable ${index + 1} name`}
                value={variable.name}
                onChange={(name) => updateVariable(variable.id, { name })}
              />
              {/* The kind is the *type of the value*, so this writes the value
                  rather than a field of its own — and it goes through
                  `setVariableKind` rather than `updateVariable`, because every
                  rule in the project that reads or writes this variable has to
                  move with it. See the store. */}
              <SelectField
                label={`Variable ${index + 1} holds`}
                value={kind}
                options={VARIABLE_KINDS.map((option) => ({
                  value: option,
                  label: option === 'text' ? 'Text' : 'Number',
                }))}
                onChange={(next) => setVariableKind(variable.id, next as VariableKind)}
              />
            </div>
            {/* "starts at", not "Value": it is the value the game *begins*
                with, set once per game rather than once per scene, and a row
                labelled Value would say the opposite of what the helper does.
                The "Animation name, not Name" rule, arriving by a sixth route.
                One label for both kinds, because it is one question. */}
            <div className="field-row">
              {kind === 'text' ? (
                <TextField
                  label={`Variable ${index + 1} starts at`}
                  value={String(variable.value)}
                  onChange={(value) => updateVariable(variable.id, { value })}
                />
              ) : (
                <NumberField
                  label={`Variable ${index + 1} starts at`}
                  value={Number(variable.value)}
                  onChange={(value) => updateVariable(variable.id, { value })}
                />
              )}
              <button
                className="icon-btn icon-btn--danger"
                onClick={() => removeVariable(variable.id)}
                title={`Delete variable ${variable.name}`}
              >
                ✕
              </button>
            </div>
            {/* By title as well as text, the way an audio row is found: the
                text is the derived key, which is the very thing a caller is
                trying to read, so it cannot also be what locates the row. */}
            <p className="hint" title={`Variable ${index + 1} key`}>
              reads as {keys.get(variable.id)}
            </p>
          </div>
        );
      })}

      <button
        className="btn btn--add"
        onClick={addVariable}
        title="Declare a number or a line of text the game keeps"
      >
        + Variable
      </button>
      <p className="hint">
        Exported code declares these once and keeps them in Phaser&apos;s registry, so
        they survive a change of scene. Read one anywhere with{' '}
        <code>this.registry.get(&apos;name&apos;)</code>, or show one to the player with a
        rule that sets an object&apos;s text.
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rules                                                                      */
/* -------------------------------------------------------------------------- */

/** How each trigger kind reads on a picker. */
const TRIGGER_LABEL: Record<RuleTrigger['kind'], string> = {
  sceneStart: 'the scene starts',
  collide: 'two objects touch',
  tap: 'an object is tapped',
  keyDown: 'a key is pressed',
  timer: 'a timer fires',
  varChange: 'a variable changes',
};

/** How each action kind reads on a picker. */
const ACTION_LABEL: Record<RuleAction['kind'], string> = {
  spawn: 'Build a prefab',
  destroy: 'Remove an object',
  setVisible: 'Show or hide an object',
  setText: "Set an object's text",
  playSound: 'Play a sound',
  stopSound: 'Stop a sound',
  playAnimation: 'Play an animation',
  startTween: 'Start a movement',
  setVelocity: 'Push an object',
  setPosition: 'Move an object to',
  // "particles" rather than "emitter", because that is the word the rest of the
  // editor uses for this type — the tree's add button, the section heading and
  // `NodeType` itself all say it. None of the three collides with a label
  // already on this panel, and none is one of the mobile tab bar's
  // exactly-matched Scene / Properties / File.
  startParticles: 'Start particles',
  stopParticles: 'Stop particles',
  burstParticles: 'Burst particles',
  cameraShake: 'Shake the camera',
  cameraFlash: 'Flash the camera',
  cameraFade: 'Fade the camera',
  cameraPan: 'Pan the camera',
  cameraZoom: 'Zoom the camera',
  setVar: 'Set a variable',
  addVar: 'Add to a variable',
  startScene: 'Go to a scene',
  restartScene: 'Restart this scene',
};

/** One `{ value, label }` per top-level node, for the node pickers. */
function nodeOptions(scene: SceneDoc, only?: (node: GameObjectNode) => boolean) {
  return scene.children
    .filter((node) => (only ? only(node) : true))
    .map((node) => ({ value: node.id, label: node.name || node.type }));
}

/**
 * What a rule says, in one line, for the collapsed row.
 *
 * A summary rather than the rule's own name, because the name is free text and
 * a list of rules called "Rule 1".."Rule 6" is a list nobody can navigate. The
 * name is still what the expand toggle is *titled* by, since a title has to be
 * stable for a test locator and a summary changes as the rule is edited.
 */
function ruleSummary(rule: SceneRule, scene: SceneDoc, project: Project): string {
  const name = (id: string) =>
    scene.children.find((node) => node.id === id)?.name ?? 'something';
  const when = rule.when;
  const trigger =
    when.kind === 'collide'
      ? `${name(when.aId)} touches ${name(when.bId)}`
      : when.kind === 'tap'
        ? `${name(when.nodeId)} is tapped`
        : when.kind === 'keyDown'
          ? `${when.key} is pressed`
          : when.kind === 'timer'
            ? `every ${when.delay}ms`
            : when.kind === 'varChange'
              ? `${findVariable(project, when.variableId)?.name ?? 'a variable'} changes`
              : 'the scene starts';
  const count = rule.do.length;
  return `When ${trigger} — ${count} ${count === 1 ? 'action' : 'actions'}`;
}

/**
 * The rules of the scene being edited.
 *
 * Shown in two places, and that is the whole point rather than a duplication:
 * the scene-wide list is here, and `NodeRulesSection` shows the same rules
 * filtered to one object on that object's own panel. `CollidersSection`
 * recorded why — `SceneInspector` renders only with an **empty selection**, so
 * a panel that only lives here is off screen for the whole of the time a person
 * spends building the objects a rule is about, and *a panel that is right and
 * cannot be reached reads to a user exactly like a feature that does not
 * exist.* This feature applies that lesson before the bug rather than after it.
 *
 * Both write through the same `addRule` / `updateRule` / `removeRule`, so this
 * is one field with two controls — the tile eraser's rule and the emitter
 * marker's — never two notions of what the scene does.
 */
function RulesSection() {
  const project = useEditorStore((s) => s.project);
  const scene = useActiveScene();
  const addRule = useEditorStore((s) => s.addRule);
  // Derived outside the selector: `rulesOf` builds a fresh array every call, so
  // selecting it directly is React error #185 — the `tileMapOf` trap.
  const rules = rulesOf(project, scene);
  const tappable = scene.children.filter((node) => canBeTapped(node.type));

  return (
    <Section title="Rules">

      {rules.length === 0 ? (
        <p className="hint">Nothing happens on its own yet.</p>
      ) : null}

      {rules.map((rule, index) => (
        <RuleCard key={rule.id} rule={rule} index={index + 1} />
      ))}

      <button
        className="btn btn--add"
        onClick={() =>
          addRule(
            // Seeded with something that can actually fire, `defaultTween`'s
            // rule: a tap when there is anything tappable, and the one trigger
            // that names nothing at all when there is not.
            tappable.length > 0
              ? { kind: 'tap', nodeId: tappable[0].id }
              : { kind: 'sceneStart' },
          )
        }
        title="Add a rule to this scene"
      >
        + Rule
      </button>
      <p className="hint">
        A rule is a moment, an optional check, and a list of things to do. The editor
        never runs one — press Export to play what they build.
      </p>
    </Section>
  );
}

/**
 * The rules that name the selected object, on its own panel.
 *
 * `collidersNaming`'s shape one feature over, and built on `rulesNaming` rather
 * than on a second read of `scene.rules`, so a rule the scene panel has dropped
 * cannot come back to life here.
 */
function NodeRulesSection({ node }: { node: GameObjectNode }) {
  const project = useEditorStore((s) => s.project);
  const scene = useActiveScene();
  const addRule = useEditorStore((s) => s.addRule);
  const rules = rulesNaming(project, scene, node.id);
  const topLevel = scene.children.some((child) => child.id === node.id);
  const tappable = canBeTapped(node.type);

  // A rule names top-level nodes only — see `rulesOf`. Said rather than left
  // silently absent, which is the failure this file records twice.
  if (!topLevel) {
    return (
      <Section title="Rules">
        <p className="hint">
          Rules name objects at the top level of the scene. Drag this one out of its
          group to give it one.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Rules">

      {rules.length === 0 ? (
        <p className="hint">Nothing happens to this object on its own yet.</p>
      ) : null}

      {rules.map((rule, index) => (
        <RuleCard key={rule.id} rule={rule} index={index + 1} />
      ))}

      <button
        className="btn btn--add"
        onClick={() =>
          addRule(tappable ? { kind: 'tap', nodeId: node.id } : { kind: 'sceneStart' })
        }
        title={`Add a rule about ${node.name}`}
      >
        + Add a rule
      </button>

      {!tappable ? (
        <p className="hint">
          A tap needs an object Phaser can build a hit area for. A group, a prefab, a
          tilemap and an emitter each have no box of their own to press, so a rule about
          one of those starts from another moment.
        </p>
      ) : null}
    </Section>
  );
}

/**
 * One rule, collapsed to a summary until it is opened.
 *
 * A rule carries a trigger with kind-dependent parameters, a variable-length
 * list of checks and a variable-length list of actions, which is far too much
 * for one row on a 390px sheet. Collapsing is the scene tree's idea borrowed,
 * and the expand toggle is titled `Edit <name>` rather than carrying the bare
 * name — the scene chips' `Switch to ` rule, arriving a fifth time, and it
 * matters here because nothing stops a user calling a rule "Scene".
 *
 * Never more than two controls in a `field-row`: at 390px a third is about 85px
 * and truncates every object name in a picker to nothing, which is the reason
 * `CollidersSection` splits four controls into two rows of two.
 */
function RuleCard({ rule, index }: { rule: SceneRule; index: number }) {
  const [open, setOpen] = useState(false);
  const project = useEditorStore((s) => s.project);
  const scene = useActiveScene();
  const updateRule = useEditorStore((s) => s.updateRule);
  const removeRule = useEditorStore((s) => s.removeRule);
  const addRuleCondition = useEditorStore((s) => s.addRuleCondition);
  const updateRuleCondition = useEditorStore((s) => s.updateRuleCondition);
  const removeRuleCondition = useEditorStore((s) => s.removeRuleCondition);
  const addRuleAction = useEditorStore((s) => s.addRuleAction);
  const updateRuleAction = useEditorStore((s) => s.updateRuleAction);
  const removeRuleAction = useEditorStore((s) => s.removeRuleAction);
  const moveRuleAction = useEditorStore((s) => s.moveRuleAction);

  const variables = project.variables;
  const matter = scenePhysicsOf(scene).engine === 'matter';

  return (
    <div className="rule">
      <button
        className="rule__summary"
        onClick={() => setOpen(!open)}
        title={`Edit ${rule.name}`}
      >
        {open ? '▾' : '▸'} {ruleSummary(rule, scene, project)}
      </button>

      {open ? (
        <>
          <TextField
            label={`Rule ${index} name`}
            value={rule.name}
            onChange={(name) => updateRule(rule.id, { name })}
          />

          <SelectField
            label={`Rule ${index} when`}
            value={rule.when.kind}
            // "a variable changes" is withheld rather than offered and then
            // falling back to `sceneStart`, which is what `defaultTrigger` would
            // have to do with nothing to name — an option that silently leaves
            // the picker where it was reads as a broken control, which is the
            // failure this file records more often than any other. The Variables
            // panel's own empty state is what says where to go, exactly as it
            // already does for a condition.
            options={RULE_TRIGGER_KINDS.filter(
              (kind) => kind !== 'varChange' || variables.length > 0,
            ).map((kind) => ({
              value: kind,
              label: TRIGGER_LABEL[kind],
            }))}
            onChange={(kind) =>
              updateRule(rule.id, {
                when: defaultTrigger(kind as RuleTrigger['kind'], scene, project),
              })
            }
          />

          <TriggerFields
            rule={rule}
            index={index}
            scene={scene}
            project={project}
            onChange={(when) => updateRule(rule.id, { when })}
          />

          {rule.when.kind === 'collide' ? (
            <p className="hint">
              {matter
                ? 'This scene runs Matter, so the two do not need to be paired first — the rule watches for the touch itself.'
                : 'Arcade only separates two objects that have been paired, so this rule adds that pairing under Collisions.'}
            </p>
          ) : null}

          <div className="panel__subsection">Only if</div>
          {rule.conditions.length === 0 ? (
            <p className="hint">
              {variables.length === 0
                ? 'Declare a variable under Variables to check one here.'
                : 'No check — this rule always runs.'}
            </p>
          ) : null}
          {rule.conditions.map((condition, at) => {
            // A text variable can only be tested for equality, and the
            // comparand is read in its kind — both of which `rulesOf` refuses
            // rather than repairs, so the panel must not be able to build one.
            const checked = findVariable(project, condition.variableId);
            const text = checked !== undefined && variableKindOf(checked) === 'text';
            return (
              <div key={`${rule.id}:c${at}`}>
                <div className="field-row">
                  <SelectField
                    label={`Rule ${index} check ${at + 1}`}
                    value={condition.variableId}
                    options={variables.map((variable) => ({
                      value: variable.id,
                      label: variable.name,
                    }))}
                    // The op and the value move with the variable, in one
                    // patch: a check switched onto a variable of the other kind
                    // would otherwise be one the reader drops — and it would
                    // take the whole rule with it.
                    onChange={(variableId) => {
                      const next = findVariable(project, variableId);
                      const nextText = next !== undefined && variableKindOf(next) === 'text';
                      updateRuleCondition(rule.id, at, {
                        variableId,
                        op:
                          nextText && condition.op !== 'eq' && condition.op !== 'ne'
                            ? 'eq'
                            : condition.op,
                        value: coerceVariableValue(
                          condition.value,
                          nextText ? 'text' : 'number',
                        ),
                      });
                    }}
                  />
                  <SelectField
                    label={`Rule ${index} check ${at + 1} is`}
                    value={condition.op}
                    options={(text ? TEXT_OPERATORS : RULE_OPERATORS).map((op) => ({
                      value: op,
                      label: RULE_OPERATOR_LABEL[op],
                    }))}
                    onChange={(op) =>
                      updateRuleCondition(rule.id, at, { op: op as RuleOperator })
                    }
                  />
                </div>
                <div className="field-row">
                  {/* One label for both kinds, because it is one question. */}
                  {text ? (
                    <TextField
                      label={`Rule ${index} check ${at + 1} value`}
                      value={String(condition.value)}
                      onChange={(value) => updateRuleCondition(rule.id, at, { value })}
                    />
                  ) : (
                    <NumberField
                      label={`Rule ${index} check ${at + 1} value`}
                      value={Number(condition.value)}
                      onChange={(value) => updateRuleCondition(rule.id, at, { value })}
                    />
                  )}
                  <button
                    className="icon-btn icon-btn--danger"
                    onClick={() => removeRuleCondition(rule.id, at)}
                    title={`Remove check ${at + 1} of rule ${index}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
          <button
            className="btn btn--add"
            disabled={variables.length === 0}
            onClick={() => addRuleCondition(rule.id)}
            title={`Add a check to rule ${index}`}
          >
            + Check
          </button>

          <div className="panel__subsection">Then</div>
          {rule.do.map((action, at) => (
            <div key={`${rule.id}:a${at}`}>
              <SelectField
                label={`Rule ${index} do ${at + 1}`}
                value={action.kind}
                // Withheld rather than offered-and-refused, which is
                // `varChange`'s mechanism on the trigger picker a few rows up
                // and for its reason: `defaultAction` can only fall through to
                // `restartScene` when nothing here carries a dynamic body, and
                // an option that leaves the picker where it was reads as a
                // broken control — the failure this file records more often
                // than any other.
                //
                // The first *action* withheld this way, so it is worth saying
                // that the alternative is genuinely unavailable rather than
                // merely worse. `RuleCard` renders `rulesOf`'s output, which
                // is validated — so an `ActionFields` empty state for this
                // kind could only render for an action the reader accepted
                // while no candidate exists, which is a contradiction. A hint
                // there would be a sentence nobody can ever read.
                //
                // The three particles verbs are withheld the same way and for
                // the same reason, which makes this the second and last use of
                // the mechanism rather than a precedent to reach for: it is
                // right here only because `defaultAction` has nothing to seed
                // these with when the scene holds no emitter.
                options={RULE_ACTION_KINDS.filter((kind) => {
                  if (kind === 'setVelocity') {
                    return scene.children.some(
                      (node) => physicsOf(node, true)?.kind === 'dynamic',
                    );
                  }
                  if (kind === 'setPosition') {
                    return scene.children.some((node) => canMove(node, scene));
                  }
                  if (
                    kind === 'startParticles' ||
                    kind === 'stopParticles' ||
                    kind === 'burstParticles'
                  ) {
                    return scene.children.some((node) => node.type === 'particles');
                  }
                  return true;
                }).map((kind) => ({
                  value: kind,
                  label: ACTION_LABEL[kind],
                }))}
                onChange={(kind) =>
                  updateRuleAction(
                    rule.id,
                    at,
                    defaultAction(kind as RuleAction['kind'], scene, project),
                  )
                }
              />
              <ActionFields
                action={action}
                label={`Rule ${index} do ${at + 1}`}
                scene={scene}
                project={project}
                onChange={(next) => updateRuleAction(rule.id, at, next)}
              />
              <div className="field-row">
                <button
                  className="icon-btn"
                  disabled={at === 0}
                  onClick={() => moveRuleAction(rule.id, at, -1)}
                  title={`Move action ${at + 1} of rule ${index} up`}
                >
                  ↑
                </button>
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={() => removeRuleAction(rule.id, at)}
                  title={`Remove action ${at + 1} of rule ${index}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            className="btn btn--add"
            onClick={() => addRuleAction(rule.id)}
            title={`Add an action to rule ${index}`}
          >
            + Action
          </button>

          <button
            className="btn btn--danger"
            onClick={() => removeRule(rule.id)}
            title={`Delete rule ${rule.name}`}
          >
            Delete rule
          </button>
        </>
      ) : null}
    </div>
  );
}

/** A trigger of the given kind, already naming something this scene holds. */
function defaultTrigger(
  kind: RuleTrigger['kind'],
  scene: SceneDoc,
  project: Project,
): RuleTrigger {
  const tappable = scene.children.filter((node) => canBeTapped(node.type));
  switch (kind) {
    case 'collide': {
      const pair = scene.children.filter((node) => canHavePhysics(node.type));
      return pair.length > 1
        ? { kind: 'collide', aId: pair[0].id, bId: pair[1].id }
        : { kind: 'sceneStart' };
    }
    case 'tap':
      return tappable.length > 0
        ? { kind: 'tap', nodeId: tappable[0].id }
        : { kind: 'sceneStart' };
    case 'keyDown':
      return { kind: 'keyDown', key: 'SPACE' };
    case 'timer':
      return { kind: 'timer', delay: 1000, loop: false };
    case 'varChange': {
      // Seeded with a real variable, `defaultTween`'s rule: a trigger that
      // arrived naming nothing is one `rulesOf` drops on the very next read, so
      // there would be nothing on screen left to fill in. With no variable at
      // all there is nothing to seed it with, so it falls back — and
      // `TriggerFields` says why rather than leaving the picker looking stuck.
      const variable = project.variables[0];
      return variable
        ? { kind: 'varChange', variableId: variable.id }
        : { kind: 'sceneStart' };
    }
    default:
      return { kind: 'sceneStart' };
  }
}

/**
 * Whether a rule may teleport this node: the reader's own refusal, so the panel
 * cannot build what `rulesOf` drops. A static Arcade body is the one thing
 * `setPosition` would move out from under its own collider.
 */
function canMove(node: GameObjectNode, scene: SceneDoc): boolean {
  return (
    physicsOf(node, true)?.kind !== 'static' || scenePhysicsOf(scene).engine === 'matter'
  );
}

/** An action of the given kind, already naming something that exists. */
function defaultAction(
  kind: RuleAction['kind'],
  scene: SceneDoc,
  project: Project,
): RuleAction {
  const first = scene.children[0];
  const variable = project.variables[0];
  const sound = soundsOf(project, scene)[0];
  switch (kind) {
    case 'spawn': {
      // The scene centre, which is `addNode`'s own choice for a new object and
      // the one point guaranteed to be on screen. `defaultTween`'s rule: an
      // action that runs perfectly and puts its result somewhere nobody is
      // looking is indistinguishable from the feature being broken — and here
      // the marker is drawn at that point the moment the action arrives, so the
      // seed is also what makes the feature visible at all.
      const prefab = project.prefabs[0];
      return prefab
        ? {
            kind: 'spawn',
            prefabId: prefab.id,
            x: Math.round(scene.width / 2),
            y: Math.round(scene.height / 2),
          }
        : { kind: 'restartScene' };
    }
    case 'destroy':
      return first ? { kind: 'destroy', nodeId: first.id } : { kind: 'restartScene' };
    case 'setVisible':
      return first
        ? { kind: 'setVisible', nodeId: first.id, visible: false }
        : { kind: 'restartScene' };
    case 'playSound':
    case 'stopSound':
      return sound ? { kind, soundId: sound.id } : { kind: 'restartScene' };
    case 'playAnimation': {
      const sprite = scene.children.find((node) => node.type === 'sprite');
      const clip = project.animations[0];
      return sprite && clip
        ? { kind: 'playAnimation', nodeId: sprite.id, animationId: clip.id }
        : { kind: 'restartScene' };
    }
    case 'startTween': {
      const tweened = scene.children.find((node) => tweenOf(node) !== null);
      return tweened
        ? { kind: 'startTween', nodeId: tweened.id }
        : { kind: 'restartScene' };
    }
    case 'setVelocity': {
      // The first node with a **dynamic** body, which is the only kind the
      // reader accepts — `startTween`'s seed, one optional field over. A seed
      // naming anything else is an action `rulesOf` drops on the very next
      // read, leaving nothing on screen to fill in.
      const pushable = scene.children.find(
        (node) => physicsOf(node, true)?.kind === 'dynamic',
      );
      // Straight up, and at the speed this document already means by a jump:
      // 450 is `DEFAULT_JUMP`, written as a literal rather than imported
      // because the two answer different questions and a change to the
      // drive-scheme's default should not silently move this seed.
      //
      // `defaultTween`'s rule — an action that runs perfectly and changes
      // nothing is indistinguishable from the feature being broken, and
      // `{ x: 0, y: 0 }` is exactly that action.
      return pushable
        ? { kind: 'setVelocity', nodeId: pushable.id, x: 0, y: -450 }
        : { kind: 'restartScene' };
    }
    case 'setPosition': {
      // The scene centre, spawn's seed and its reason: the one point certain to
      // be on screen, and — for any object not already sitting there — a move
      // somebody can see, drawn as a ring the moment the action arrives.
      const movable = scene.children.find((node) => canMove(node, scene));
      return movable
        ? {
            kind: 'setPosition',
            nodeId: movable.id,
            x: Math.round(scene.width / 2),
            y: Math.round(scene.height / 2),
          }
        : { kind: 'restartScene' };
    }
    case 'startParticles':
    case 'stopParticles':
    case 'burstParticles': {
      // The first emitter in the scene — `startTween`'s and `setVelocity`'s
      // seed, and the picker above withholds all three kinds when there is
      // none, so the fall-through is unreachable from the panel and is here
      // for the type rather than for the user.
      const emitter = scene.children.find((node) => node.type === 'particles');
      if (!emitter) return { kind: 'restartScene' };
      // 24 is `DEFAULT_BURST`, written as a literal for `setVelocity`'s 450's
      // reason: the reader's repair and the panel's seed answer different
      // questions, and one moving should not silently move the other. The cap
      // beside it *is* imported, because a limit the control and the reader
      // disagree about is a control that offers what the reader takes back.
      return kind === 'burstParticles'
        ? { kind, nodeId: emitter.id, count: 24 }
        : { kind, nodeId: emitter.id };
    }
    case 'setText': {
      // Seeded with the label's own current text and **no variable**, so the
      // action arrives saying what is already on screen and cannot dangle
      // whatever the project holds — `restartScene`'s property, on an action
      // that names something.
      const label = scene.children.find((node) => node.type === 'text');
      return label
        ? { kind: 'setText', nodeId: label.id, text: String(label.props.text ?? '') }
        : { kind: 'restartScene' };
    }
    case 'setVar':
      // In the variable's own kind, for `addRuleCondition`'s reason: a number
      // written into a text variable is an action `rulesOf` refuses, so the row
      // would vanish the moment it was added.
      return variable
        ? {
            kind: 'setVar',
            variableId: variable.id,
            value: variableKindOf(variable) === 'text' ? '' : 0,
          }
        : { kind: 'restartScene' };
    case 'addVar': {
      // Arithmetic, so only a number variable can carry one at all.
      const counter = project.variables.find((entry) => variableKindOf(entry) !== 'text');
      return counter
        ? { kind: 'addVar', variableId: counter.id, by: 1 }
        : { kind: 'restartScene' };
    }
    // The five camera effects are the only kinds here that cannot fall back,
    // because they are the only ones that name nothing which might not exist —
    // `restartScene`'s own property, arriving on actions that do something.
    // Every seed is chosen to be **visibly** something, which is `defaultTween`'s
    // rule and its reason: an action that runs perfectly and changes nothing is
    // indistinguishable from the feature being broken.
    case 'cameraShake':
      return { kind: 'cameraShake', duration: 100, intensity: 0.05 };
    case 'cameraFlash':
      return { kind: 'cameraFlash', duration: 250, color: '#ffffff' };
    case 'cameraFade':
      return { kind: 'cameraFade', duration: 250, color: '#000000', fadeIn: false };
    case 'cameraPan': {
      // Offset from where the camera already looks, never equal to it — the
      // tween destination's rule. A pan seeded on the current centre is a pan
      // that runs for a second and arrives where it started.
      const view = cameraViewOf(scene);
      return {
        kind: 'cameraPan',
        x: Math.round(view.x + view.width * 0.75),
        y: Math.round(view.y + view.height / 2),
        duration: 1000,
        ease: 'Linear',
      };
    }
    case 'cameraZoom':
      // 2, never the camera's own zoom, for the reason above.
      return { kind: 'cameraZoom', zoom: 2, duration: 1000, ease: 'Linear' };
    case 'startScene': {
      const other = project.scenes.find((entry) => entry.id !== scene.id);
      return other
        ? { kind: 'startScene', sceneId: other.id }
        : { kind: 'restartScene' };
    }
    default:
      return { kind: 'restartScene' };
  }
}

/** The parameters one trigger kind needs, or nothing for the two that need none. */
function TriggerFields({
  rule,
  index,
  scene,
  project,
  onChange,
}: {
  rule: SceneRule;
  index: number;
  scene: SceneDoc;
  project: Project;
  onChange: (when: RuleTrigger) => void;
}) {
  const when = rule.when;

  if (when.kind === 'collide') {
    const options = nodeOptions(scene, (node) => canHavePhysics(node.type) || node.type === 'tilemap');
    return (
      <div className="field-row">
        <SelectField
          label={`Rule ${index} hits`}
          value={when.aId}
          options={options}
          onChange={(aId) => onChange({ ...when, aId })}
        />
        <SelectField
          label={`Rule ${index} and`}
          value={when.bId}
          options={options}
          onChange={(bId) => onChange({ ...when, bId })}
        />
      </div>
    );
  }

  if (when.kind === 'tap') {
    return (
      <SelectField
        label={`Rule ${index} tap on`}
        value={when.nodeId}
        options={nodeOptions(scene, (node) => canBeTapped(node.type))}
        onChange={(nodeId) => onChange({ ...when, nodeId })}
      />
    );
  }

  if (when.kind === 'keyDown') {
    return (
      <SelectField
        label={`Rule ${index} key`}
        value={when.key}
        // A picker rather than a text field, and the argument is not injection:
        // `keyboard.on('keydown-BANANA')` is a listener nothing ever emits to.
        options={RULE_KEYS.map((key) => ({ value: key, label: key }))}
        onChange={(key) => onChange({ ...when, key })}
      />
    );
  }

  if (when.kind === 'timer') {
    return (
      <div className="field-row">
        <NumberField
          label={`Rule ${index} every`}
          value={when.delay}
          min={1}
          onChange={(delay) => onChange({ ...when, delay })}
        />
        <CheckboxField
          label={`Rule ${index} repeats`}
          value={when.loop}
          onChange={(loop) => onChange({ ...when, loop })}
        />
      </div>
    );
  }

  if (when.kind === 'varChange') {
    return (
      <>
        <SelectField
          label={`Rule ${index} watches`}
          value={when.variableId}
          options={project.variables.map((variable) => ({
            value: variable.id,
            label: variable.name || 'Variable',
          }))}
          onChange={(variableId) => onChange({ ...when, variableId })}
        />
        <p className="hint">
          This runs every time the value changes, so a check of “is at least 10”
          runs on every change from 10 upwards rather than only the first.
        </p>
      </>
    );
  }

  return null;
}

/** The parameters one action kind needs, or nothing for `restartScene`. */
function ActionFields({
  action,
  label,
  scene,
  project,
  onChange,
}: {
  action: RuleAction;
  label: string;
  scene: SceneDoc;
  project: Project;
  onChange: (action: RuleAction) => void;
}) {
  switch (action.kind) {
    case 'spawn': {
      if (project.prefabs.length === 0) {
        return (
          <p className="hint">
            Select some objects and use Save as prefab first. A spawn builds a
            prefab, which is the one thing this project knows how to make more
            than one of.
          </p>
        );
      }
      // Four controls, so three rows — `cameraPan`'s layout and the 390px rule,
      // with the anchor picker on a row of its own because an object name is
      // the widest thing on the card.
      const anchored = action.nodeId !== undefined;
      return (
        <>
          <SelectField
            label={`${label} prefab`}
            value={action.prefabId}
            options={project.prefabs.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
            onChange={(prefabId) => onChange({ ...action, prefabId })}
          />
          <SelectField
            label={`${label} at`}
            value={action.nodeId ?? ''}
            options={[{ value: '', label: 'A fixed point' }, ...nodeOptions(scene)]}
            onChange={(nodeId) => {
              // Cleared by destructuring the key away rather than writing
              // `undefined`, which would survive in memory and vanish through
              // `JSON.stringify` — two spellings of "no anchor". Switching
              // between the two meanings resets the numbers, because an offset
              // of (480, 270) and a point of (0, 0) are both nonsense carried
              // over from the other meaning: an anchored spawn starts on its
              // object, and a fixed one at the scene centre, `defaultAction`'s
              // seed.
              const { nodeId: _previous, ...rest } = action;
              void _previous;
              if (nodeId === '') {
                onChange({
                  ...rest,
                  x: Math.round(scene.width / 2),
                  y: Math.round(scene.height / 2),
                });
              } else {
                onChange(
                  anchored
                    ? { ...rest, nodeId }
                    : { ...rest, nodeId, x: 0, y: 0 },
                );
              }
            }}
          />
          <div className="field-row">
            {/* "offset x" once anchored, because the same number now means a
                distance from an object rather than a place in the scene — one
                word for both is `cameraPan`'s recorded trap. */}
            <NumberField
              label={anchored ? `${label} offset x` : `${label} x`}
              value={action.x}
              onChange={(x) => onChange({ ...action, x })}
            />
            <NumberField
              label={anchored ? `${label} offset y` : `${label} y`}
              value={action.y}
              onChange={(y) => onChange({ ...action, y })}
            />
          </div>
          <p className="hint">
            {anchored
              ? 'Built where that object is when the rule fires, moved by the offset. '
              : ''}
            Drawn on the canvas as a ring, and built only in the running game.
            It arrives on top of everything already there, and nothing removes
            it again — a spawn has no handle for another rule to name.
          </p>
        </>
      );
    }

    case 'destroy':
      return (
        <SelectField
          label={`${label} object`}
          value={action.nodeId}
          options={nodeOptions(scene)}
          onChange={(nodeId) => onChange({ ...action, nodeId })}
        />
      );

    case 'setVisible':
      return (
        <div className="field-row">
          <SelectField
            label={`${label} object`}
            value={action.nodeId}
            options={nodeOptions(scene)}
            onChange={(nodeId) => onChange({ ...action, nodeId })}
          />
          <SelectField
            label={`${label} to`}
            value={action.visible ? 'show' : 'hide'}
            options={[
              { value: 'show', label: 'Show' },
              { value: 'hide', label: 'Hide' },
            ]}
            onChange={(to) => onChange({ ...action, visible: to === 'show' })}
          />
        </div>
      );

    case 'setText': {
      const labels = nodeOptions(scene, (node) => node.type === 'text');
      // The variable this caption shows, if it names one. A text variable is
      // shown as it is, so the two format dials below are hidden for one rather
      // than sitting there doing nothing — the panel must not offer what the
      // emit would ignore.
      const shown = findVariable(project, action.variableId);
      if (labels.length === 0) {
        // A sentence rather than an absence: `AlignSection`'s rule, and here it
        // is the one thing that explains why the picker above chose something
        // else — only a text object has text to set.
        return (
          <p className="hint">
            Add a text object to this scene to write on. Only a text object has text
            to set.
          </p>
        );
      }
      return (
        <>
          <div className="field-row">
            <SelectField
              label={`${label} object`}
              value={action.nodeId}
              options={labels}
              onChange={(nodeId) => onChange({ ...action, nodeId })}
            />
            <TextField
              label={`${label} text`}
              value={action.text}
              onChange={(text) => onChange({ ...action, text })}
            />
          </div>
          {/* `'' -> undefined`, never `''` in the document: an empty id is one
              `findVariable` answers nothing for, and an action that names a
              variable it has not got costs the whole rule. */}
          <SelectField
            label={`${label} then shows`}
            value={action.variableId ?? ''}
            options={[
              { value: '', label: 'Nothing' },
              ...project.variables.map((variable) => ({
                value: variable.id,
                label: variable.name,
              })),
            ]}
            onChange={(variableId) =>
              onChange({ ...action, variableId: variableId || undefined })
            }
          />
          {shown !== undefined && variableKindOf(shown) === 'number' && (
            /* Only while a variable is named: a format on a caption with no
               value is a dial on nothing, and the panel must not offer what the
               reader would ignore — `CollidersSection`' rule. The same two
               fields, with the same words, as a bound label's on the object's
               own panel, because they are the same question. */
            <div className="field-row">
              <NumberField
                label={`${label} decimal places`}
                value={labelFormatOf(action).decimals}
                min={RAW_DECIMALS}
                max={MAX_DECIMALS}
                onChange={(decimals) => onChange({ ...action, decimals })}
              />
              <NumberField
                label={`${label} pad to width`}
                value={labelFormatOf(action).pad}
                min={0}
                max={MAX_PAD}
                onChange={(pad) => onChange({ ...action, pad })}
              />
            </div>
          )}
          <p className="hint">
            The variable&apos;s value goes on the end, so a label reads{' '}
            <code>Score: 10</code>. For a number, decimal places −1 leaves it as it
            is and a pad of 0 is off; text is shown as it is.
          </p>
        </>
      );
    }

    case 'playSound':
    case 'stopSound':
      return (
        <SelectField
          label={`${label} sound`}
          value={action.soundId}
          options={soundsOf(project, scene).map((sound) => ({
            value: sound.id,
            label: findAudio(project, sound.audioId)?.name ?? 'sound',
          }))}
          onChange={(soundId) => onChange({ ...action, soundId })}
        />
      );

    case 'playAnimation':
      return (
        <div className="field-row">
          <SelectField
            label={`${label} object`}
            value={action.nodeId}
            options={nodeOptions(scene, (node) => node.type === 'sprite')}
            onChange={(nodeId) => onChange({ ...action, nodeId })}
          />
          <SelectField
            label={`${label} animation`}
            value={action.animationId}
            options={project.animations.map((clip) => ({
              value: clip.id,
              label: clip.name,
            }))}
            onChange={(animationId) => onChange({ ...action, animationId })}
          />
        </div>
      );

    case 'startTween':
      return (
        <SelectField
          label={`${label} object`}
          value={action.nodeId}
          options={nodeOptions(scene, (node) => tweenOf(node) !== null)}
          onChange={(nodeId) => onChange({ ...action, nodeId })}
        />
      );

    case 'setVelocity':
      // Three controls, so two rows — `spawn`'s and `cameraPan`'s layout and
      // the 390px rule the whole card is built on.
      return (
        <>
          <SelectField
            label={`${label} object`}
            value={action.nodeId}
            // `startTween`'s filter, one optional field over, so the panel
            // cannot build what the reader refuses.
            options={nodeOptions(
              scene,
              (node) => physicsOf(node, true)?.kind === 'dynamic',
            )}
            onChange={(nodeId) => onChange({ ...action, nodeId })}
          />
          {/* "speed", never a bare "x": a spawn's `x` on this same card is a
              *place* and this is a *rate*, and one word for both is
              `cameraPan`'s own recorded trap — the reason its fields say
              "centre". It also keeps these clear of the body's own
              "Velocity X", which renders a few sections up the same panel and
              which the suite matches exactly. */}
          <div className="field-row">
            <NumberField
              label={`${label} speed x`}
              value={action.x}
              onChange={(x) => onChange({ ...action, x })}
            />
            <NumberField
              label={`${label} speed y`}
              value={action.y}
              onChange={(y) => onChange({ ...action, y })}
            />
          </div>
          <p className="hint">
            Pixels a second, and it <em>replaces</em> whatever the body was
            doing rather than adding to it — so 0 and 0 stops it dead. Negative
            y is upwards. Gravity, drag and whatever it hits take over from
            there. The editor never runs it: press Play to see it move.
          </p>
        </>
      );

    case 'setPosition': {
      // Four controls, so three rows — spawn's layout for spawn's reason, the
      // anchor on a row of its own because an object name is the widest thing
      // on the card.
      const anchored = action.atId !== undefined;
      const pinned = scene.children.some((node) => !canMove(node, scene));
      return (
        <>
          <SelectField
            label={`${label} object`}
            value={action.nodeId}
            options={nodeOptions(scene, (node) => canMove(node, scene))}
            onChange={(nodeId) => onChange({ ...action, nodeId })}
          />
          <SelectField
            label={`${label} at`}
            value={action.atId ?? ''}
            options={[{ value: '', label: 'A fixed point' }, ...nodeOptions(scene)]}
            onChange={(atId) => {
              // Spawn's anchor picker to the line: the key destructured away
              // rather than written `undefined`, and the numbers reset because
              // an offset and a point are nonsense carried into each other.
              const { atId: _previous, ...rest } = action;
              void _previous;
              if (atId === '') {
                onChange({
                  ...rest,
                  x: Math.round(scene.width / 2),
                  y: Math.round(scene.height / 2),
                });
              } else {
                onChange(anchored ? { ...rest, atId } : { ...rest, atId, x: 0, y: 0 });
              }
            }}
          />
          <div className="field-row">
            <NumberField
              label={anchored ? `${label} offset x` : `${label} x`}
              value={action.x}
              onChange={(x) => onChange({ ...action, x })}
            />
            <NumberField
              label={anchored ? `${label} offset y` : `${label} y`}
              value={action.y}
              onChange={(y) => onChange({ ...action, y })}
            />
          </div>
          <p className="hint">
            {anchored
              ? 'Moved to where that object is when the rule fires, plus the offset. '
              : ''}
            Drawn on the canvas as a ring joined to the object; the editor never
            moves it. An Arcade body stops dead when it arrives; a Matter one keeps moving.
            {pinned
              ? ' Objects with a static body are not listed: moving one would' +
                ' leave its collider behind.'
              : ''}
          </p>
        </>
      );
    }

    case 'startParticles':
    case 'stopParticles':
      return (
        <SelectField
          label={`${label} object`}
          value={action.nodeId}
          // `startTween`'s filter shape, so the panel cannot build what the
          // reader refuses.
          options={nodeOptions(scene, (node) => node.type === 'particles')}
          onChange={(nodeId) => onChange({ ...action, nodeId })}
        />
      );

    case 'burstParticles':
      // Two controls and two full-width rows rather than one `field-row`,
      // which is the 390px rule read the other way: a paired row is for two
      // *numbers* that mean something beside each other (a spawn's x and y, a
      // push's two speeds). An object picker squeezed to half a row truncates
      // every emitter name to nothing, and a count beside it is not its pair.
      return (
        <>
          <SelectField
            label={`${label} object`}
            value={action.nodeId}
            options={nodeOptions(scene, (node) => node.type === 'particles')}
            onChange={(nodeId) => onChange({ ...action, nodeId })}
          />
          <NumberField
            label={`${label} count`}
            value={action.count}
            min={1}
            max={MAX_BURST}
            step={1}
            onChange={(count) => onChange({ ...action, count })}
          />
          <p className="hint">
            One burst of {action.count} at the emitter&rsquo;s own position, and
            the flow stops there — an emitter a rule bursts does not go back to
            streaming afterwards. The editor never fires a rule: press Play to
            see it, or ▶ to watch the emitter itself.
          </p>
        </>
      );

    case 'setVar': {
      const written = findVariable(project, action.variableId);
      const text = written !== undefined && variableKindOf(written) === 'text';
      return (
        <div className="field-row">
          <SelectField
            label={`${label} variable`}
            value={action.variableId}
            options={project.variables.map((variable) => ({
              value: variable.id,
              label: variable.name,
            }))}
            // The value moves with the variable in one patch, the condition
            // picker's rule: a number written into a text variable is an action
            // `rulesOf` refuses, and it refuses the whole rule with it.
            onChange={(variableId) => {
              const next = findVariable(project, variableId);
              const nextText = next !== undefined && variableKindOf(next) === 'text';
              onChange({
                ...action,
                variableId,
                value: coerceVariableValue(action.value, nextText ? 'text' : 'number'),
              });
            }}
          />
          {text ? (
            <TextField
              label={`${label} to`}
              value={String(action.value)}
              onChange={(value) => onChange({ ...action, value })}
            />
          ) : (
            <NumberField
              label={`${label} to`}
              value={Number(action.value)}
              onChange={(value) => onChange({ ...action, value })}
            />
          )}
        </div>
      );
    }

    case 'addVar': {
      // Only a number variable, because `registry.inc` on text is arithmetic on
      // text — the panel cannot build what the reader refuses.
      const counters = project.variables.filter(
        (variable) => variableKindOf(variable) !== 'text',
      );
      if (counters.length === 0) {
        return (
          <p className="hint">
            Declare a variable that holds a number to add to. Text cannot be counted.
          </p>
        );
      }
      return (
        <div className="field-row">
          <SelectField
            label={`${label} variable`}
            value={action.variableId}
            options={counters.map((variable) => ({
              value: variable.id,
              label: variable.name,
            }))}
            onChange={(variableId) => onChange({ ...action, variableId })}
          />
          <NumberField
            label={`${label} by`}
            value={action.by}
            onChange={(by) => onChange({ ...action, by })}
          />
        </div>
      );
    }

    // The five camera effects. No "nothing eligible" hint anywhere below,
    // unlike `setText` and `addVar`: every scene has a camera, so there is no
    // empty state to explain. Two controls to a `field-row` at most, which is
    // the 390px rule the whole card is built on.
    case 'cameraShake':
      return (
        <div className="field-row">
          <NumberField
            label={`${label} duration`}
            value={action.duration}
            min={1}
            onChange={(duration) => onChange({ ...action, duration })}
          />
          {/* A fraction of the viewport, which is Phaser's own unit — hence the
              step and the ceiling rather than a pixel count. */}
          <NumberField
            label={`${label} strength`}
            value={action.intensity}
            step={0.01}
            min={0.01}
            max={1}
            onChange={(intensity) => onChange({ ...action, intensity })}
          />
        </div>
      );

    case 'cameraFlash':
      return (
        <div className="field-row">
          <NumberField
            label={`${label} duration`}
            value={action.duration}
            min={1}
            onChange={(duration) => onChange({ ...action, duration })}
          />
          <ColorField
            label={`${label} colour`}
            value={action.color}
            onChange={(color) => onChange({ ...action, color })}
          />
        </div>
      );

    case 'cameraFade':
      return (
        <>
          <div className="field-row">
            <NumberField
              label={`${label} duration`}
              value={action.duration}
              min={1}
              onChange={(duration) => onChange({ ...action, duration })}
            />
            <ColorField
              label={`${label} colour`}
              value={action.color}
              onChange={(color) => onChange({ ...action, color })}
            />
          </div>
          <SelectField
            label={`${label} direction`}
            value={action.fadeIn ? 'in' : 'out'}
            options={[
              { value: 'out', label: 'Fade out' },
              { value: 'in', label: 'Fade in' },
            ]}
            onChange={(way) => onChange({ ...action, fadeIn: way === 'in' })}
          />
        </>
      );

    case 'cameraPan':
      return (
        <>
          {/* "centre", never "x": `pan` moves the camera's midPoint where
              `SceneCamera.scrollX` is its top-left, so a field reading like the
              Camera X a few sections up would be wrong by half a viewport with
              nothing saying so — and `Camera X` is that other field's exact
              label, on this same panel. */}
          <div className="field-row">
            <NumberField
              label={`${label} centre x`}
              value={action.x}
              onChange={(x) => onChange({ ...action, x })}
            />
            <NumberField
              label={`${label} centre y`}
              value={action.y}
              onChange={(y) => onChange({ ...action, y })}
            />
          </div>
          <div className="field-row">
            <NumberField
              label={`${label} duration`}
              value={action.duration}
              min={1}
              onChange={(duration) => onChange({ ...action, duration })}
            />
            <SelectField
              label={`${label} easing`}
              value={action.ease}
              options={TWEEN_EASES.map((ease) => ({ value: ease, label: ease }))}
              onChange={(ease) => onChange({ ...action, ease: ease as TweenEase })}
            />
          </div>
        </>
      );

    case 'cameraZoom':
      return (
        <>
          <div className="field-row">
            <NumberField
              label={`${label} zoom`}
              value={action.zoom}
              step={0.1}
              min={0.05}
              onChange={(zoom) => onChange({ ...action, zoom })}
            />
            <NumberField
              label={`${label} duration`}
              value={action.duration}
              min={1}
              onChange={(duration) => onChange({ ...action, duration })}
            />
          </div>
          <SelectField
            label={`${label} easing`}
            value={action.ease}
            options={TWEEN_EASES.map((ease) => ({ value: ease, label: ease }))}
            onChange={(ease) => onChange({ ...action, ease: ease as TweenEase })}
          />
        </>
      );

    case 'startScene':
      return (
        <SelectField
          label={`${label} scene`}
          value={action.sceneId}
          options={project.scenes.map((entry) => ({
            value: entry.id,
            label: entry.name,
          }))}
          onChange={(sceneId) => onChange({ ...action, sceneId })}
        />
      );

    default:
      return null;
  }
}

/**
 * Where the game looks when this scene starts.
 *
 * Document state, in the panel about the space objects are placed in and above
 * the gravity for the reason the gravity is above the guides: it belongs to
 * every object at once. Unlike the gravity it is always shown — a camera is not
 * a setting that can only ever do nothing, since every scene has one whether or
 * not the file says so, and the frame it draws is the only place a user can see
 * what the numbers mean.
 *
 * Every label carries "Camera", and that is not decoration: the object's own
 * Name is a few rows up this same panel, so are Width, Height and the two
 * Gravity fields, and the suite locates a field by its exact label. It is the
 * "Animation name, not Name" rule arriving by a third route.
 */
function CameraSection() {
  const scene = useActiveScene();
  // Derived outside the selector, never inside one: `cameraOf` builds a fresh
  // object every call, so `useEditorStore((s) => cameraOf(...))` would compare
  // unequal on every store change and loop forever (React error #185).
  const setCamera = useEditorStore((s) => s.setCamera);
  const camera = cameraOf(scene);

  // Top level only, which is the whole of "a camera follows world coordinates":
  // a node inside a container has parent-relative ones, so following it would
  // scroll to somewhere nothing is. The same rule an Arcade body follows, and
  // the same `true` the exporter and the renderer pass.
  const targets = scene.children;

  return (
    <Section title="Camera">
      <div className="field-row">
        <NumberField
          label="Camera X"
          value={camera.scrollX}
          onChange={(scrollX) => setCamera({ scrollX })}
        />
        <NumberField
          label="Camera Y"
          value={camera.scrollY}
          onChange={(scrollY) => setCamera({ scrollY })}
        />
      </div>
      <NumberField
        label="Camera zoom"
        value={camera.zoom}
        step={0.1}
        min={0.05}
        onChange={(zoom) => setCamera({ zoom })}
      />
      <SelectField
        label="Camera follows"
        value={camera.followId ?? ''}
        options={[
          { value: '', label: 'Nothing' },
          ...targets.map((node) => ({ value: node.id, label: node.name })),
        ]}
        onChange={(followId) => setCamera({ followId: followId === '' ? null : followId })}
      />
      {/* Only while something is followed. A smoothing with nothing to chase is
          a field that does not apply rather than one that is switched off, which
          is the call the dynamic-only body fields already make: they are absent
          on a static body rather than disabled. */}
      {camera.followId !== null && (
        <NumberField
          label="Camera smoothing"
          value={camera.followLerp}
          step={0.05}
          min={0.01}
          max={1}
          onChange={(followLerp) => setCamera({ followLerp })}
        />
      )}
      <CheckboxField
        label="Limit camera to the scene"
        value={camera.boundToScene}
        onChange={(boundToScene) => setCamera({ boundToScene })}
      />
      <CheckboxField
        label="Round camera to whole pixels"
        value={camera.roundPixels}
        onChange={(roundPixels) => setCamera({ roundPixels })}
      />
      {!isDefaultCamera(camera) && (
        <button
          className="btn btn--block"
          onClick={() => setCamera(DEFAULT_CAMERA)}
          title="Put the camera back to the whole scene at zoom 1"
        >
          Reset camera
        </button>
      )}
      <p className="hint">
        The violet frame is what the game opens on. Only objects at the top level
        can be followed — one inside a group is positioned relative to that
        group, not to the scene. Nothing here moves the editor's own view: pan
        and pinch as usual, and press ⤢ to see the whole scene again.
      </p>
    </Section>
  );
}

/**
 * The scene's physics world.
 *
 * Gravity and nothing else, in the panel about the space objects are placed in
 * — the only setting here that belongs to every body at once, and the one a
 * user reaches for immediately after switching their first body on. It is
 * document state, unlike the snapping block below it: two people opening the
 * same file must get the same fall.
 *
 * The row appears only once something in the scene has a body. Gravity with no
 * body to pull on is a number that can only ever do nothing, which is the
 * argument that keeps the ▶ button out of a toolbar with nothing that moves.
 */
function WorldSection() {
  const scene = useActiveScene();
  const updateScene = useEditorStore((s) => s.updateScene);

  // Top level only, which is where a body may be — the same walk the renderer
  // and the exporter make, and the same `true`.
  const any = scene.children.some((child) => physicsOf(child, true) !== null);
  if (!any) return null;

  const gravity = scenePhysicsOf(scene);
  const set = (patch: Partial<typeof gravity>) =>
    updateScene({ physics: { ...gravity, ...patch } });

  return (
    <Section title="Physics world">
      {/* First, above the gravity, because it decides what every field under it
          means — and because it is the one setting here that changes what the
          canvas draws. Labelled "Physics engine" rather than "Engine": the
          suite matches a label exactly, and a bare "Engine" says nothing on a
          panel that also carries a camera and a world. */}
      <SelectField
        label="Physics engine"
        value={gravity.engine}
        options={[
          { value: 'arcade', label: 'Arcade — fast, upright boxes' },
          { value: 'matter', label: 'Matter — shapes that turn' },
        ]}
        onChange={(engine) =>
          set({ engine: engine === 'matter' ? 'matter' : 'arcade' })
        }
      />
      <div className="field-row">
        <NumberField
          label="Gravity X"
          value={gravity.gravityX}
          onChange={(gravityX) => set({ gravityX })}
        />
        <NumberField
          label="Gravity Y"
          value={gravity.gravityY}
          onChange={(gravityY) => set({ gravityY })}
        />
      </div>
      <p className="hint">
        Positive Y falls downward, as everywhere else here — in pixels per
        second squared under either engine, since the export converts to
        Matter's own units for you. The world's bounds are the scene's own width
        and height, so an object set to collide with them stops at the frame you
        can see.
      </p>
    </Section>
  );
}

/**
 * Which pairs of objects Arcade keeps apart, or watches for a touch.
 *
 * A scene setting, where the scene's other settings are — the gravity is
 * directly above it and is the world these rows act in. It is the line
 * iteration 16 told the user to write by hand, and it is here now for the
 * reason that iteration emitted a `mass` and an `immovable` nothing it
 * generated read: which pairs interact is a standing fact about the world,
 * where what should *happen* when they touch is a sequence of events and stays
 * the user's, on the handle `add.overlap` hands them.
 *
 * The pickers offer exactly what `collidersOf` would keep — a top-level node
 * with a body, or a tilemap — so the panel cannot produce a row that vanishes
 * on the next read. Below two such nodes there is no pair to make and the
 * "+ Collision" button would produce nothing, so it says why instead of
 * offering one; below one there is no question at all and it says nothing.
 *
 * This is the scene-wide view of the table. `NodeCollisionsSection` is the same
 * table on one object's own panel, and both write through the same three
 * actions — one field, two controls. It is the *other* one that a person
 * actually finds, because this panel needs an empty selection and giving two
 * objects bodies never leaves you with one.
 */
function CollidersSection() {
  const scene = useActiveScene();
  // Derived outside the selector, never inside one: `collidersOf` builds a
  // fresh array every call, so `useEditorStore((s) => collidersOf(...))` would
  // compare unequal on every store change and loop forever (React error #185).
  const addCollider = useEditorStore((s) => s.addCollider);
  const updateCollider = useEditorStore((s) => s.updateCollider);
  const removeCollider = useEditorStore((s) => s.removeCollider);

  // A Matter world collides everything with everything, so there is no pair to
  // pick — `collidersOf` already answers empty here, and this says why rather
  // than leaving a heading with nothing under it. `AlignSection`'s rule: a
  // control that says why it cannot beats one that is not there.
  if (scenePhysicsOf(scene).engine === 'matter') {
    return (
      <Section title="Collisions">
        <p className="hint">
          This scene runs Matter, which collides every body with every other one
          on its own. There is nothing to pair up. Any rows made under Arcade
          are kept and come back if the scene is switched back.
        </p>
      </Section>
    );
  }

  const candidates = collidableNodes(scene);
  // Nothing at all when nothing in the scene can collide: a project of plain
  // rectangles has no question here to answer. With exactly one, the heading
  // and a sentence rather than silence — that is the trap this whole change
  // exists for, closed from the scene's side: a user who gives the floor a body
  // and then deselects to look for collisions used to find an empty panel and
  // conclude the editor had no such thing.
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return (
      <Section title="Collisions">
        <p className="hint">
          Only one thing here can collide. Give a second object a body — or add
          a tilemap with solid tiles — and the pair can be made here or on
          either object's own panel.
        </p>
      </Section>
    );
  }
  const rows = collidersOf(scene);
  const options = candidates.map((node) => ({ value: node.id, label: node.name }));

  return (
    <Section title="Collisions">
      {/* Every label is numbered, and that is not decoration: a second row puts
          a second field reading exactly "Collides" on the page, and the suite
          locates a field by its exact label — the trap the prefab buttons' "+ "
          prefix and the scene chips' "Switch to " both exist for, arriving here
          by a third route. It also gives the remove button something to name. */}
      {rows.map((row, index) => (
        // Two rows of two rather than one row of four: at 390px a flex row
        // shares its width equally, so four controls are ~85px each and every
        // object name in the picker is truncated to nothing. The pair that has
        // to be read together — what collides with what — gets a row of its
        // own.
        <div key={row.id}>
          <div className="field-row">
            <SelectField
              label={`Collides ${index + 1}`}
              value={row.aId}
              options={options}
              onChange={(aId) => updateCollider(row.id, { aId })}
            />
            <SelectField
              label={`With ${index + 1}`}
              value={row.bId}
              options={options}
              onChange={(bId) => updateCollider(row.id, { bId })}
            />
          </div>
          <div className="field-row field-row--foot">
            <SelectField
              label={`How ${index + 1}`}
              value={row.kind}
              options={[
                { value: 'collide', label: 'Solid' },
                { value: 'overlap', label: 'Overlap' },
              ]}
              onChange={(kind) => updateCollider(row.id, { kind: kind as 'collide' | 'overlap' })}
            />
            <button
              className="btn btn--block btn--danger"
              onClick={() => removeCollider(row.id)}
              aria-label={`Remove collision ${index + 1}`}
              title="Remove this collision"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {/* The first two candidates rather than a blank row, because a row naming
          nothing is one `collidersOf` drops on the next read — so there would
          be nothing on screen left to fill in. */}
      <button
        className="btn btn--block"
        onClick={() => addCollider(candidates[0].id, candidates[1].id)}
      >
        + Collision
      </button>
      <p className="hint">
        Solid stops them; Overlap only reports the touch. What happens then is
        yours to write, on the collider the export hands back.
      </p>
    </Section>
  );
}

/**
 * How a drag behaves, in the panel that is showing whenever nothing is
 * selected.
 *
 * None of this is in the document — it is not saved, not undoable, and two
 * people opening the same file may well want different answers. It sits in the
 * Scene panel anyway because that is the panel about the space objects are
 * placed in, and because a preference with no home ends up in a menu nobody
 * opens. The two toggles are mirrored in the toolbar, which is where they are
 * actually reached mid-gesture; this is where the two pitches are set — the
 * grid's and the angle step's — being numbers you choose once per project
 * rather than ones you flick.
 */
function SnappingSection() {
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const setGridEnabled = useEditorStore((s) => s.setGridEnabled);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);
  const angleStep = useEditorStore((s) => s.angleStep);
  const setAngleStep = useEditorStore((s) => s.setAngleStep);

  return (
    <Section title="Snapping">
      <CheckboxField label="Snap to objects" value={snapEnabled} onChange={setSnapEnabled} />
      <CheckboxField label="Snap to grid" value={gridEnabled} onChange={setGridEnabled} />
      <NumberField
        label="Grid size"
        value={gridSize}
        min={1}
        step={1}
        undoable={false}
        onChange={setGridSize}
      />
      {/* Beside the grid pitch because the grid toggle is what governs it: the
          two numbers are the two pitches, one for position and one for angle. */}
      <NumberField
        label="Angle step°"
        value={angleStep}
        min={1}
        max={180}
        step={1}
        undoable={false}
        onChange={setAngleStep}
      />
      <p className="hint">
        Dragging lines objects up with their neighbours, matches the spacing of a row you
        drop into, and — with the grid on — lands on the pitch. The knob above a selected
        object turns it, agreeing with another object's angle or landing on the step the
        same way. These are editor settings: they are not saved with the project.
      </p>
    </Section>
  );
}

/**
 * Placing, showing and clearing the user's own guides.
 *
 * In this panel rather than the toolbar for the reason the angle step is: a
 * 390px toolbar that already clips cannot hold three more controls, and this is
 * the panel about the space objects are placed in, which is exactly what a
 * guide is. Placing one is not a mid-gesture act either — the gesture that
 * follows it happens on the canvas with no panel open, the same shape as adding
 * an object and then dragging it.
 */
function GuidesSection() {
  const scene = useActiveScene();
  const addGuide = useEditorStore((s) => s.addGuide);
  const moveGuide = useEditorStore((s) => s.moveGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const clearGuides = useEditorStore((s) => s.clearGuides);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const setGuidesVisible = useEditorStore((s) => s.setGuidesVisible);
  const guides = guidesOf(scene);
  const count = guides.length;

  return (
    <Section title="Guides">
      {/* At the centre rather than at 0: a guide on the scene's own edge lies
          under the frame and is half off-screen at the fit zoom, which is the
          same reason a new object does not land at the origin either. */}
      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Add a vertical guide down the middle of the scene"
          onClick={() => addGuide('x', Math.round(scene.width / 2))}
        >
          + Guide ↕
        </button>
        <button
          className="btn btn--add"
          title="Add a horizontal guide across the middle of the scene"
          onClick={() => addGuide('y', Math.round(scene.height / 2))}
        >
          + Guide ↔
        </button>
      </div>
      <CheckboxField label="Show guides" value={guidesVisible} onChange={setGuidesVisible} />

      {/* One row per guide, so a guide can be put on an exact number and
          removed without a gesture. Dragging is the fast way and rounds to
          whole pixels; this is the way to land on 300 — and on a phone it is
          also the only way to delete a guide that has been dragged somewhere
          the finger can no longer reach. */}
      {guides.map((guide, index) => (
        <div className="field-row" key={guide.id}>
          <NumberField
            label={`Guide ${index + 1} ${guide.axis}`}
            value={guide.position}
            onChange={(position) => moveGuide(guide.id, position)}
          />
          <button
            className="icon-btn icon-btn--danger"
            onClick={() => removeGuide(guide.id)}
            title={`Delete guide ${index + 1}`}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        className="btn btn--add"
        disabled={count === 0}
        onClick={clearGuides}
        title="Remove every guide in this scene"
      >
        Clear guides
      </button>
      <p className="hint">
        Drag a guide on the canvas to move it, or off the edge of the scene to remove it.
        Objects line up with guides before anything else while snapping is on. Unlike the
        settings above, guides <em>are</em> saved with the project — turning them off hides
        them and stops objects agreeing with them, but does not delete them.
      </p>
    </Section>
  );
}

/**
 * The prefab controls on an ordinary object: save it as a new prefab, and — for
 * a group — push it into an existing one.
 *
 * That second half is the whole reason there is no prefab editing *mode*. A
 * group's own frame is exactly an instance's frame, so its children's
 * transforms transfer with no arithmetic at all — which makes "detach an
 * instance, edit it with every tool that already exists, push it back" a
 * complete round trip, and a mode only a second place to do the same thing.
 *
 * Saving is offered for every type, not only for groups: one object is a
 * selection of one, and `createPrefabFromSelection` wraps whatever it is given
 * the same way. Replacing is not, because a definition comes from a node's
 * children and a rectangle has none — the answer for a single object is to
 * detach the instance, which gives back a group.
 */
function NodePrefabSection({ node }: { node: GameObjectNode }) {
  const prefabs = usePrefabs();
  const createPrefabFromSelection = useEditorStore((s) => s.createPrefabFromSelection);
  const updatePrefabFrom = useEditorStore((s) => s.updatePrefabFrom);
  const [target, setTarget] = useState('');

  const nestsPrefab = containsInstance(node.children);
  const chosen = prefabs.find((prefab) => prefab.id === target);
  const replaceable = node.type === 'container' && prefabs.length > 0;

  return (
    <Section title="Prefab">
      {nestsPrefab ? (
        <p className="hint">
          This group places a prefab of its own, and a prefab cannot contain another one
          yet.
        </p>
      ) : (
        <>
          <button className="btn btn--block" onClick={createPrefabFromSelection}>
            Save as prefab
          </button>
          {replaceable && (
            <>
              <SelectField
                label="Update"
                value={target}
                options={[
                  { value: '', label: 'Choose a prefab…' },
                  ...prefabs.map((prefab) => ({ value: prefab.id, label: prefab.name })),
                ]}
                onChange={setTarget}
              />
              <button
                className="btn btn--block"
                disabled={!chosen}
                onClick={() => chosen && updatePrefabFrom(chosen.id, node.id)}
              >
                {chosen ? `Replace ${chosen.name} with this group` : 'Replace a prefab'}
              </button>
            </>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * The panel for a placed prefab.
 *
 * What it edits is deliberately split in two: the fields above this belong to
 * the *instance* — where it is, how big, what it is called — and the ones here
 * belong to the *definition*, shared with every other placement. The use count
 * is what makes that difference visible before the user finds it out.
 *
 * There are no controls for the contents, because an instance has none of its
 * own: they are read from the definition every time it is drawn, which is what
 * makes one edit reach every placement. Detach is the way to get editable
 * objects, and it says so.
 */
function InstanceSection({ node }: { node: GameObjectNode }) {
  const prefabs = usePrefabs();
  const uses = useEditorStore((s) =>
    node.type === 'instance' && node.props.prefabId
      ? countPrefabUses(s.project, node.props.prefabId)
      : 0,
  );
  // Counted separately and said separately, because `removePrefab` now strips
  // spawn actions as well as detaching instances. A button that quietly deletes
  // a rule is the thing this codebase keeps paying for; the count is what makes
  // the press honest.
  const spawns = useEditorStore((s) =>
    node.type === 'instance' && node.props.prefabId
      ? countPrefabSpawns(s.project, node.props.prefabId)
      : 0,
  );
  const updateProps = useEditorStore((s) => s.updateProps);
  const renamePrefab = useEditorStore((s) => s.renamePrefab);
  const removePrefab = useEditorStore((s) => s.removePrefab);
  const detachInstance = useEditorStore((s) => s.detachInstance);

  if (node.type !== 'instance') return null;
  const prefab = prefabs.find((entry) => entry.id === node.props.prefabId);

  return (
    <Section title={SECTION_TITLE.instance}>
      {prefab ? (
        <p className="hint">
          {uses === 1
            ? 'The only instance of this prefab. Editing it changes this one.'
            : `One of ${uses} instances — editing the prefab changes all of them.`}
        </p>
      ) : (
        <p className="hint">
          This prefab is no longer in the project, so there is nothing to draw. Point it at
          another one, or delete it.
        </p>
      )}

      <SelectField
        label="Prefab"
        value={node.props.prefabId ?? ''}
        options={[
          { value: '', label: prefab ? 'None' : 'Missing — choose one' },
          ...prefabs.map((entry) => ({ value: entry.id, label: entry.name })),
        ]}
        onChange={(prefabId) => updateProps(node.id, { prefabId: prefabId || null })}
      />

      {prefab && (
        /* "Prefab name", not "Name": the object's own Name field is a few rows
           up this same panel, and this one is the definition's, shared by every
           instance — and the factory function's name in exported code. */
        <TextField
          label="Prefab name"
          value={prefab.name}
          onChange={(name) => renamePrefab(prefab.id, name)}
        />
      )}

      <NumberField
        label="Alpha"
        value={node.props.alpha}
        step={0.05}
        min={0}
        max={1}
        onChange={(alpha) => updateProps(node.id, { alpha })}
      />

      <button
        className="btn btn--block"
        onClick={() => detachInstance(node.id)}
        title="Turn this into an ordinary group you can edit"
      >
        Detach into a group
      </button>
      {prefab && (
        <button
          className="btn btn--block btn--danger"
          onClick={() => removePrefab(prefab.id)}
          title={
            `Detaches ${uses} instance${uses === 1 ? '' : 's'}` +
            (spawns > 0
              ? `, removes ${spawns} spawn action${spawns === 1 ? '' : 's'}`
              : '') +
            ' and removes the prefab'
          }
        >
          Delete prefab
        </button>
      )}
    </Section>
  );
}

/** Heading for the per-type section, which is the only thing that differs. */
const SECTION_TITLE: Record<GameObjectNode['type'], string> = {
  rectangle: 'Shape',
  ellipse: 'Shape',
  text: 'Text',
  sprite: 'Image',
  nineslice: 'Panel',
  tileSprite: 'Tiled image',
  container: 'Group',
  instance: 'Prefab',
  tilemap: 'Tiles',
  particles: 'Particles',
};

/** The value the parent picker uses for "not in a group at all". */
const SCENE_PARENT = '';

/**
 * Every container the node could be moved into, with its own subtree left out —
 * a node cannot be its own ancestor.
 *
 * This is the only way to nest on a phone: the tree's drag-to-nest is HTML5
 * drag and drop, which touch browsers do not fire at all.
 */
function parentOptions(
  nodes: GameObjectNode[],
  node: GameObjectNode,
  depth = 0,
): { value: string; label: string }[] {
  return nodes.flatMap((candidate) => {
    if (candidate.type !== 'container' || containsNode(node, candidate.id)) return [];
    return [
      { value: candidate.id, label: `${'— '.repeat(depth)}${candidate.name}` },
      ...parentOptions(candidate.children, node, depth + 1),
    ];
  });
}

/**
 * Moves the node between groups, and wraps it in a new one.
 *
 * Reparenting keeps the object exactly where it is on the canvas: what changes
 * is what it moves with, not where it sits, so the transform in the fields
 * above is recomputed against the new parent rather than carried over.
 */
function ParentRow({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const moveNode = useEditorStore((s) => s.moveNode);
  const groupSelection = useEditorStore((s) => s.groupSelection);

  const parent = findParent(scene.children, node.id);
  const options = [
    { value: SCENE_PARENT, label: 'Scene' },
    ...parentOptions(scene.children, node),
  ];

  return (
    <Section title="Parent">
      <SelectField
        label="Group"
        value={parent?.id ?? SCENE_PARENT}
        options={options}
        onChange={(value) => moveNode(node.id, value === SCENE_PARENT ? null : value)}
      />
      <button className="btn btn--add" onClick={groupSelection}>
        Wrap in a new group
      </button>
    </Section>
  );
}

/**
 * Draw order controls. The labels talk about front and back rather than up and
 * down the list: array order *is* draw order, and the tree lists the array as
 * it is, so the first row is the object furthest back.
 */
function ArrangeRow({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const reorderNode = useEditorStore((s) => s.reorderNode);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);

  // Among its own siblings, not the scene's top level: draw order is array
  // order at every depth, and inside a group "to front" means the front of
  // that group.
  const siblings = siblingsOf(scene.children, node.id);
  const index = siblings.findIndex((child) => child.id === node.id);
  const last = siblings.length - 1;
  const move = (to: number) => reorderNode(node.id, to);

  return (
    <Section title="Arrange">
      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Send to back"
          disabled={index <= 0}
          onClick={() => move(0)}
        >
          ⤓
        </button>
        <button
          className="btn btn--add"
          title="Send backward"
          disabled={index <= 0}
          onClick={() => move(index - 1)}
        >
          ↓
        </button>
        <button
          className="btn btn--add"
          title="Bring forward"
          disabled={index === -1 || index >= last}
          onClick={() => move(index + 1)}
        >
          ↑
        </button>
        <button
          className="btn btn--add"
          title="Bring to front"
          disabled={index === -1 || index >= last}
          onClick={() => move(last)}
        >
          ⤒
        </button>
        <button
          className="btn btn--add"
          title="Duplicate"
          onClick={duplicateSelection}
        >
          Duplicate
        </button>
      </div>
    </Section>
  );
}

/**
 * Which frame of a sliced image a sprite shows.
 *
 * Absent for a plain image rather than shown reading 0: a one-frame image has
 * no frame to choose, and a field whose only legal value is the one already in
 * it is a control that cannot be used. It is also hidden while an animation is
 * playing on the sprite, because the animation owns the frame then — the field
 * would be a number the canvas visibly disagrees with.
 */
function FrameField({
  node,
}: {
  node: Extract<
    GameObjectNode,
    { type: 'sprite' | 'particles' | 'nineslice' | 'tileSprite' }
  >;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const asset = useEditorStore((s) => findAsset(s.project, node.props.assetId));

  // An emitter, a panel and a tile sprite all read the same cut, so this is the
  // same control rather than four copies of it. Only a sprite can have a clip
  // taking the frame over, which is why that half of the guard narrows.
  const names = frameNamesOf(asset);
  if (!asset || (!frameGridOf(asset) && names.length === 0)) return null;
  if (node.type === 'sprite' && node.props.animationId) return null;

  // A select of names, not a text field, and that is the one place this control
  // changes shape rather than range. A grid's frame is a number with a top and
  // a bottom, which a number field states; a name is an *identity*, and typed
  // by hand it is wrong by one character and the object silently draws some
  // other frame. `FontPicker`'s argument without its free-text half — unlike a
  // font family, a frame name is never something the machine might already
  // have, so there is nothing for free text to reach that the list does not.
  //
  // A native select is also the one picker that gets an OS wheel under a thumb,
  // and it stays one row however many frames the atlas holds, where a list of
  // names would push the transform fields off a 390px sheet.
  if (names.length > 0) {
    return (
      <div className="field-row">
        <SelectField
          label="Frame"
          value={String(node.props.frame)}
          options={names.map((name) => ({ value: name, label: name }))}
          onChange={(frame) => updateProps(node.id, { frame })}
        />
      </div>
    );
  }

  return (
    <div className="field-row">
      <NumberField
        label="Frame"
        value={typeof node.props.frame === 'number' ? node.props.frame : 0}
        min={0}
        max={frameCountOf(asset) - 1}
        onChange={(frame) => updateProps(node.id, { frame })}
      />
    </div>
  );
}

/**
 * The nine-slice section.
 *
 * The image controls are the picker and the slicer used verbatim, for the
 * reason an emitter and a tileset reuse them: a nine-slice source *is* an
 * image, sliced or not.
 *
 * The four insets are their own field each rather than a symmetric pair,
 * because a nine-slice's whole subject is that the sides differ — a window
 * frame with a title bar has a top unlike its bottom. They are labelled "Slice
 * …" and the box is labelled "Width"/"Height" plainly, since the transform's
 * Scale X/Y two rows up is the other thing that changes an object's size and
 * the two must not read as the same control.
 */
function NineSliceSection({
  node,
}: {
  node: Extract<GameObjectNode, { type: 'nineslice' }>;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const setProp = (patch: Partial<NineSliceProps>) => updateProps(node.id, patch);

  return (
    <>
      <Section title={SECTION_TITLE.nineslice}>
        <AssetSummary assetId={node.props.assetId} kind="panel" />
        <AssetPicker
          selectedAssetId={node.props.assetId}
          onPick={(assetId) => setProp({ assetId })}
        />
      </Section>

      {node.props.assetId && (
        <Section title="Sprite sheet">
          <SheetSection assetId={node.props.assetId} />
          <FrameField node={node} />
        </Section>
      )}

      <Section title="Size">
        <div className="field-row">
          <NumberField
            label="Width"
            value={node.props.width}
            min={1}
            onChange={(width) => setProp({ width })}
          />
          <NumberField
            label="Height"
            value={node.props.height}
            min={1}
            onChange={(height) => setProp({ height })}
          />
        </div>
      </Section>

      <Section title="Slices">
        <p className="hint">
          The corners keep their size at any width; only the edges and the middle
          stretch. Leave Slice top and bottom at 0 for a bar that stretches
          sideways only.
        </p>
        <div className="field-row">
          <NumberField
            label="Slice left"
            value={node.props.left}
            min={0}
            onChange={(left) => setProp({ left })}
          />
          <NumberField
            label="Slice right"
            value={node.props.right}
            min={0}
            onChange={(right) => setProp({ right })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Slice top"
            value={node.props.top}
            min={0}
            onChange={(top) => setProp({ top })}
          />
          <NumberField
            label="Slice bottom"
            value={node.props.bottom}
            min={0}
            onChange={(bottom) => setProp({ bottom })}
          />
        </div>
      </Section>

      <Section title="Appearance">
        <ColorField label="Tint" value={node.props.tint} onChange={(tint) => setProp({ tint })} />
        <NumberField
          label="Alpha"
          value={node.props.alpha}
          step={0.05}
          min={0}
          max={1}
          onChange={(alpha) => setProp({ alpha })}
        />
      </Section>
    </>
  );
}

/**
 * The tile-sprite section.
 *
 * "Tile offset" and "Tile scale" rather than "Offset" and "Scale": the
 * transform's own Scale X/Y is a few rows up the same panel and does something
 * genuinely different — it stretches the box and the pattern together, where
 * these leave the box alone. Two fields called Scale would be ambiguous to a
 * reader and to the suite's exact-match label locator alike, which is the
 * "Animation name, not Name" rule.
 */
function TileSpriteSection({
  node,
}: {
  node: Extract<GameObjectNode, { type: 'tileSprite' }>;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const setProp = (patch: Partial<TileSpriteProps>) => updateProps(node.id, patch);

  return (
    <>
      <Section title={SECTION_TITLE.tileSprite}>
        <AssetSummary assetId={node.props.assetId} kind="tile" />
        <AssetPicker
          selectedAssetId={node.props.assetId}
          onPick={(assetId) => setProp({ assetId })}
        />
      </Section>

      {node.props.assetId && (
        <Section title="Sprite sheet">
          <SheetSection assetId={node.props.assetId} />
          <FrameField node={node} />
        </Section>
      )}

      <Section title="Size">
        <div className="field-row">
          <NumberField
            label="Width"
            value={node.props.width}
            min={1}
            onChange={(width) => setProp({ width })}
          />
          <NumberField
            label="Height"
            value={node.props.height}
            min={1}
            onChange={(height) => setProp({ height })}
          />
        </div>
      </Section>

      <Section title="Pattern">
        <p className="hint">
          The image repeats to fill the box. Tile offset scrolls it inside the
          box; tile scale changes how big one repeat is.
        </p>
        <div className="field-row">
          <NumberField
            label="Tile offset X"
            value={node.props.tilePositionX}
            onChange={(tilePositionX) => setProp({ tilePositionX })}
          />
          <NumberField
            label="Tile offset Y"
            value={node.props.tilePositionY}
            onChange={(tilePositionY) => setProp({ tilePositionY })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Tile scale X"
            value={node.props.tileScaleX}
            step={0.1}
            onChange={(tileScaleX) => setProp({ tileScaleX })}
          />
          <NumberField
            label="Tile scale Y"
            value={node.props.tileScaleY}
            step={0.1}
            onChange={(tileScaleY) => setProp({ tileScaleY })}
          />
        </div>
      </Section>

      <Section title="Appearance">
        <ColorField label="Tint" value={node.props.tint} onChange={(tint) => setProp({ tint })} />
        <NumberField
          label="Alpha"
          value={node.props.alpha}
          step={0.05}
          min={0}
          max={1}
          onChange={(alpha) => setProp({ alpha })}
        />
      </Section>
    </>
  );
}

/**
 * The text panel: what it says, and how it is set.
 *
 * Its own component rather than the inline block it was until iteration 22,
 * because twelve more fields do not belong in the middle of `NodeInspector`.
 *
 * Split into three by what a person is doing. The top group is the object —
 * the words, their size and their colour — and is what almost every visit to
 * this panel is for. Paragraph is the group that only means anything once the
 * text has more than one line, which is why the wrap field sits beside the
 * alignment that it is usually what enables. Stroke and shadow are the two
 * decorations, last because most text has neither.
 *
 * Every label is unique by exact match within the panel, which the suite's
 * locator requires: "Font size" rather than "Size" and "Text colour" rather
 * than "Color", because this panel is now carrying three colours and two
 * widths, and Name, X, Y, Rotation, Alpha and the physics section's own
 * Bounce/Drag pairs are all a scroll away. The "Animation name, not Name" rule.
 */
function TextSection({ node }: { node: Extract<GameObjectNode, { type: 'text' }> }) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const project = useEditorStore((s) => s.project);
  const setNodeLabel = useEditorStore((s) => s.setNodeLabel);
  const setProp = (patch: Partial<TextProps>) => updateProps(node.id, patch);
  // Derived here rather than in a selector, because it builds a fresh object
  // every call — React error #185, the `tileMapOf` trap, and the warning
  // `labelOf`'s own doc comment carries.
  const label = labelOf(node.props, project);

  return (
    <>
      <Section title={SECTION_TITLE.text}>
        <TextField
          label="Content"
          value={node.props.text}
          onChange={(text) => setProp({ text })}
        />

        {/* The label goes with the words rather than under Paragraph or Stroke:
            it is part of what this object *says*. One control for on/off and for
            which variable, because a label naming nothing is not a label — the
            `setText` action's picker, one panel over. */}
        {project.variables.length === 0 ? (
          <p className="hint">
            Declare a variable in the Scene panel to have this text follow one — a score
            on screen is a caption here and a number the game keeps there.
          </p>
        ) : (
          <SelectField
            label="Shows variable"
            value={label?.variable.id ?? ''}
            options={[
              { value: '', label: 'Nothing' },
              ...project.variables.map((variable) => ({
                value: variable.id,
                label: variable.name,
              })),
            ]}
            onChange={(variableId) =>
              setNodeLabel(node.id, variableId ? { variableId } : null)
            }
          />
        )}
        {label !== null && variableKindOf(label.variable) === 'text' && (
          <p className="hint">
            The value goes on the end of the content above, and follows the variable while
            the game runs — which is the difference between this and a rule that writes the
            text once. A variable holding text is shown as it is, so there is nothing here
            to format.
          </p>
        )}
        {label !== null && variableKindOf(label.variable) === 'number' && (
          <>
            <div className="field-row">
              <NumberField
                label="Decimal places"
                value={label.decimals}
                min={RAW_DECIMALS}
                max={MAX_DECIMALS}
                onChange={(decimals) => setNodeLabel(node.id, { decimals })}
              />
              <NumberField
                label="Pad to width"
                value={label.pad}
                min={0}
                max={MAX_PAD}
                onChange={(pad) => setNodeLabel(node.id, { pad })}
              />
            </div>
            <p className="hint">
              The value goes on the end of the content above, and follows the variable
              while the game runs — which is the difference between this and a rule that
              writes the text once. Decimal places −1 leaves the number as it is and a pad
              of 0 is off. A rule that sets this object&apos;s text wins until the value
              next changes.
            </p>
          </>
        )}
        <div className="field-row">
          <NumberField
            label="Font size"
            value={node.props.fontSize}
            min={1}
            onChange={(fontSize) => setProp({ fontSize })}
          />
          <NumberField
            label="Alpha"
            value={node.props.alpha}
            step={0.05}
            min={0}
            max={1}
            onChange={(alpha) => setProp({ alpha })}
          />
        </div>
        <ColorField
          label="Text colour"
          value={node.props.color}
          onChange={(color) => setProp({ color })}
        />
        <TextField
          label="Font family"
          value={node.props.fontFamily}
          onChange={(fontFamily) => setProp({ fontFamily })}
        />
        <FontPicker
          fontFamily={node.props.fontFamily}
          onPick={(fontFamily) => setProp({ fontFamily })}
        />
        <div className="field-row">
          <CheckboxField
            label="Bold"
            value={node.props.bold}
            onChange={(bold) => setProp({ bold })}
          />
          <CheckboxField
            label="Italic"
            value={node.props.italic}
            onChange={(italic) => setProp({ italic })}
          />
        </div>
      </Section>

      <Section title="Paragraph">
        <p className="hint">
          Wrap width 0 means the text runs on in one line. Align only shows itself
          on text with more than one line — wrapped, or with a line break in it.
        </p>
        <div className="field-row">
          <NumberField
            label="Wrap width"
            value={node.props.wordWrapWidth}
            min={0}
            onChange={(wordWrapWidth) => setProp({ wordWrapWidth })}
          />
          <SelectField
            label="Align"
            value={node.props.align}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Centre' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(align) => setProp({ align: align as TextProps['align'] })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Line spacing"
            value={node.props.lineSpacing}
            onChange={(lineSpacing) => setProp({ lineSpacing })}
          />
          <NumberField
            label="Letter spacing"
            value={node.props.letterSpacing}
            onChange={(letterSpacing) => setProp({ letterSpacing })}
          />
        </div>
      </Section>

      <Section title="Stroke and shadow">
        <p className="hint">
          A stroke draws only while its width is above zero. Room for both is
          worked out from the numbers you set, so neither is clipped.
        </p>
        <div className="field-row">
          <ColorField
            label="Stroke colour"
            value={node.props.strokeColor}
            onChange={(strokeColor) => setProp({ strokeColor })}
          />
          <NumberField
            label="Stroke width"
            value={node.props.strokeThickness}
            min={0}
            onChange={(strokeThickness) => setProp({ strokeThickness })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Shadow X"
            value={node.props.shadowOffsetX}
            onChange={(shadowOffsetX) => setProp({ shadowOffsetX })}
          />
          <NumberField
            label="Shadow Y"
            value={node.props.shadowOffsetY}
            onChange={(shadowOffsetY) => setProp({ shadowOffsetY })}
          />
        </div>
        <div className="field-row">
          <ColorField
            label="Shadow colour"
            value={node.props.shadowColor}
            onChange={(shadowColor) => setProp({ shadowColor })}
          />
          <NumberField
            label="Shadow blur"
            value={node.props.shadowBlur}
            min={0}
            onChange={(shadowBlur) => setProp({ shadowBlur })}
          />
        </div>
      </Section>
    </>
  );
}

/**
 * The emitter panel.
 *
 * Long, because an emitter is eighteen numbers rather than a position and a
 * colour — but every one of them is one Phaser config key, and the set is the
 * smallest that reaches fire, sparks and falling snow. The image controls are
 * the picker and the slicer used verbatim, for the reason a tileset reuses
 * them: a particle sheet *is* a sliced image.
 *
 * The hint is not decoration. An emitter is stopped unless preview is on, so
 * without it the panel reads as broken — every dial set, and nothing moving.
 */
function ParticlesSection({
  node,
}: {
  node: Extract<GameObjectNode, { type: 'particles' }>;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const previewMotion = useEditorStore((s) => s.previewMotion);
  const setProp = (patch: Partial<ParticlesProps>) => updateProps(node.id, patch);

  return (
    <>
      <Section title={SECTION_TITLE.particles}>
        <AssetSummary assetId={node.props.assetId} kind="particle" />
        <AssetPicker
          selectedAssetId={node.props.assetId}
          onPick={(assetId) => setProp({ assetId })}
        />
      </Section>

      {/* Moved up here from between the sheet and Emission when the sections
          became collapsible: it is about the emitter as a whole rather than
          about any one of them, and left where it was it would have floated
          between two collapsed bars, belonging to neither. */}
      {!previewMotion && (
        <p className="hint">
          Stopped. Press ▶ in the toolbar to watch it run — the canvas holds
          still by default so objects stay where you put them.
        </p>
      )}

      {node.props.assetId && (
        <Section title="Sprite sheet">
          <SheetSection assetId={node.props.assetId} />
          <FrameField node={node} />
        </Section>
      )}

      <Section title="Emission">
        <NumberField
          label="Lifespan"
          value={node.props.lifespan}
          min={1}
          step={50}
          onChange={(lifespan) => setProp({ lifespan })}
        />
        <div className="field-row">
          <NumberField
            label="Quantity"
            value={node.props.quantity}
            min={1}
            step={1}
            onChange={(quantity) => setProp({ quantity })}
          />
          <NumberField
            label="Frequency"
            value={node.props.frequency}
            min={0}
            step={10}
            onChange={(frequency) => setProp({ frequency })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Speed min"
            value={node.props.speedMin}
            step={10}
            onChange={(speedMin) => setProp({ speedMin })}
          />
          <NumberField
            label="Speed max"
            value={node.props.speedMax}
            step={10}
            onChange={(speedMax) => setProp({ speedMax })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Angle min"
            value={node.props.angleMin}
            step={5}
            onChange={(angleMin) => setProp({ angleMin })}
          />
          <NumberField
            label="Angle max"
            value={node.props.angleMax}
            step={5}
            onChange={(angleMax) => setProp({ angleMax })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Gravity X"
            value={node.props.gravityX}
            step={10}
            onChange={(gravityX) => setProp({ gravityX })}
          />
          <NumberField
            label="Gravity Y"
            value={node.props.gravityY}
            step={10}
            onChange={(gravityY) => setProp({ gravityY })}
          />
        </div>
      </Section>

      <Section title="Particle">
        {/* Phaser's own names, and deliberately not "Scale"/"Alpha": the
            transform's Scale X/Y and the object's own Alpha are a few rows up
            this same panel, and two fields differing by one word is ambiguous to
            a reader and to a test locator alike. */}
        <div className="field-row">
          <NumberField
            label="Scale start"
            value={node.props.scaleStart}
            step={0.1}
            min={0}
            onChange={(scaleStart) => setProp({ scaleStart })}
          />
          <NumberField
            label="Scale end"
            value={node.props.scaleEnd}
            step={0.1}
            min={0}
            onChange={(scaleEnd) => setProp({ scaleEnd })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Alpha start"
            value={node.props.alphaStart}
            step={0.05}
            min={0}
            max={1}
            onChange={(alphaStart) => setProp({ alphaStart })}
          />
          <NumberField
            label="Alpha end"
            value={node.props.alphaEnd}
            step={0.05}
            min={0}
            max={1}
            onChange={(alphaEnd) => setProp({ alphaEnd })}
          />
        </div>
        <ColorField
          label="Tint"
          value={node.props.tint}
          onChange={(tint) => setProp({ tint })}
        />
      </Section>

      <Section title="Appearance">
        <NumberField
          label="Alpha"
          value={node.props.alpha}
          step={0.05}
          min={0}
          max={1}
          onChange={(alpha) => setProp({ alpha })}
        />
      </Section>
    </>
  );
}

/**
 * The map's layers, back to front, and what can be done to one.
 *
 * Here rather than in the scene tree, because a layer is not a `GameObjectNode`:
 * the tree's twisty, its drag-to-reparent, its selection and its delete are all
 * built on nodes, so a layer row there would be a second row kind rejecting most
 * of what the rows above it accept. The paint bar carries the same choice for
 * the moment that actually matters — mid-gesture, on a phone, where this panel
 * is a sheet over the canvas being painted. The brush already splits that way.
 *
 * Listed in array order, front-most last, which is the scene tree's rule and for
 * its reason: the array order *is* the draw order, and showing it front-first
 * would put an index flip between every press and the store.
 *
 * Every accessible name carries the word "layer" or the verb it needs. The tree
 * already owns `Hide <name>` and `Delete <name>` and the palettes own `Tile N`
 * and `Erase tiles`, and the suite matches a name exactly — a layer a user calls
 * the same thing as an object would otherwise put two identical buttons on the
 * page, which is the trap the prefab buttons' `+ ` prefix exists for.
 */
function LayerList({ nodeId, map }: { nodeId: string; map: TileMap }) {
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
  const addTilemapLayer = useEditorStore((s) => s.addTilemapLayer);
  const removeTilemapLayer = useEditorStore((s) => s.removeTilemapLayer);
  const renameTilemapLayer = useEditorStore((s) => s.renameTilemapLayer);
  const setTilemapLayerVisible = useEditorStore((s) => s.setTilemapLayerVisible);
  const moveTilemapLayer = useEditorStore((s) => s.moveTilemapLayer);

  const active = tileLayerOf(map, activeLayerId);
  const only = map.layers.length < 2;

  return (
    <>
      {map.layers.map((layer, index) => (
        <div className="layer-row" key={layer.id}>
          <button
            className={`layer-row__pick ${layer.id === active.id ? 'is-active' : ''}`}
            aria-pressed={layer.id === active.id}
            aria-label={`Paint on ${layer.name}`}
            onClick={() => setActiveLayer(layer.id)}
          >
            {layer.name}
          </button>
          <button
            className="layer-row__btn"
            aria-label={layer.visible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`}
            onClick={() => setTilemapLayerVisible(nodeId, layer.id, !layer.visible)}
          >
            {layer.visible ? '◉' : '○'}
          </button>
          <button
            className="layer-row__btn"
            aria-label={`Move ${layer.name} back`}
            disabled={index === 0}
            onClick={() => moveTilemapLayer(nodeId, layer.id, -1)}
          >
            ▾
          </button>
          <button
            className="layer-row__btn"
            aria-label={`Move ${layer.name} forward`}
            disabled={index === map.layers.length - 1}
            onClick={() => moveTilemapLayer(nodeId, layer.id, 1)}
          >
            ▴
          </button>
          {/* Disabled rather than absent on the last layer, so the panel says
              it cannot rather than quietly not offering it — `AlignSection`'s
              call for one object. */}
          <button
            className="layer-row__btn"
            aria-label={`Delete layer ${layer.name}`}
            disabled={only}
            title={only ? 'A map keeps at least one layer' : 'Delete'}
            onClick={() => removeTilemapLayer(nodeId, layer.id)}
          >
            ✕
          </button>
        </div>
      ))}

      <TextField
        label="Layer name"
        value={active.name}
        onChange={(name) => renameTilemapLayer(nodeId, active.id, name)}
      />
      <button className="btn btn--block" onClick={() => addTilemapLayer(nodeId)}>
        + Layer
      </button>
    </>
  );
}

/**
 * The tilemap panel: the tileset, the grid, the brush, and the way into paint
 * mode.
 *
 * The tileset controls are the image picker and the sheet slicer used verbatim,
 * because a tileset *is* a sliced image — the same panel that gives a sprite its
 * frames gives a map its tiles, and a second slicer here would be the same four
 * numbers in a second place.
 */
function TilemapSection({ node }: { node: Extract<GameObjectNode, { type: 'tilemap' }> }) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const resizeTilemap = useEditorStore((s) => s.resizeTilemap);
  const fillTiles = useEditorStore((s) => s.fillTiles);
  const setPainting = useEditorStore((s) => s.setPainting);
  const paintingId = useEditorStore((s) => s.paintingId);
  const brushTile = useEditorStore((s) => s.brushTile);
  const erasing = useEditorStore((s) => s.erasing);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  // Derived outside the selector, not inside one: `tileMapOf` builds a fresh
  // object every call and zustand compares snapshots by identity, so selecting
  // it would re-render on every store read for ever. The same reason
  // `useSelectionNodes` reaches for `useShallow`.
  const project = useEditorStore((s) => s.project);
  const map = tileMapOf(project, node.props);
  // The one place this panel decides which layer it is about, so the brush, the
  // fill, the collision grid and its hint cannot disagree.
  const layer = tileLayerOf(map, activeLayerId);

  const painting = paintingId === node.id;

  return (
    <>
      <Section title={SECTION_TITLE.tilemap}>
        <AssetSummary assetId={node.props.assetId} kind="tileset" />
        <AssetPicker
          selectedAssetId={node.props.assetId}
          onPick={(assetId) => updateProps(node.id, { assetId })}
        />
      </Section>

      {node.props.assetId && (
        <Section title="Tileset">
          <SheetSection assetId={node.props.assetId} />
        </Section>
      )}

      <Section title="Grid">
        <div className="field-row">
          <NumberField
            label="Columns"
            value={node.props.columns}
            min={1}
            onChange={(columns) => resizeTilemap(node.id, columns, node.props.rows)}
          />
          <NumberField
            label="Rows"
            value={node.props.rows}
            min={1}
            onChange={(rows) => resizeTilemap(node.id, node.props.columns, rows)}
          />
        </div>
        <p className="hint">
          {map.columns}×{map.rows} tiles of {map.tileWidth}×{map.tileHeight}px —{' '}
          {map.columns * map.tileWidth}×{map.rows * map.tileHeight} before scaling. The tile
          size is the tileset's frame size.
        </p>
      </Section>

      <Section title="Layers">
        <LayerList nodeId={node.id} map={map} />
      </Section>

      <Section title="Brush">
        <TilePalette assetId={node.props.assetId} />
        <p className="hint">Painting on {layer.name}.</p>

        {/* Toggling rather than only entering: the bar over the canvas has the ✓
            that leaves, but on a desktop the button that turned the mode on is
            where a user looks to turn it off again. */}
        <button
          className={`btn btn--block ${painting ? 'is-active' : ''}`}
          onClick={() => setPainting(painting ? null : node.id)}
          aria-pressed={painting}
        >
          {painting ? 'Done painting' : 'Edit tiles'}
        </button>
        <button
          className="btn btn--block"
          onClick={() => fillTiles(node.id, layer.id, erasing ? EMPTY_TILE : brushTile)}
        >
          {erasing ? 'Clear every tile' : 'Fill with this tile'}
        </button>
      </Section>

      {/* "Collision", not "Physics": a tilemap carries no Arcade body — its
          collision is `setCollision([...])`, which is about which *tiles* are
          solid rather than about a box round the layer. Naming it Physics would
          say the map has the thing it deliberately has not got. */}
      <Section title="Collision">
        <SolidPalette
          nodeId={node.id}
          layerId={layer.id}
          assetId={node.props.assetId}
          collides={layer.collides}
        />
        <p className="hint">
          {layer.collides.length > 0
            ? 'Solid tiles are outlined green while you paint. They stop nothing until this map is told what to collide with, below.'
            : 'Pick the tiles that should stop things — walls, floors. They stop nothing until this map is told what to collide with, below.'}
        </p>
      </Section>

      {/* A tilemap is a valid side of a collision without being in
          `PHYSICS_TYPES`, so `PhysicsSection` — which is where every other type
          reaches this — returns null for one and cannot carry it here. The
          hint above used to send the reader to the Scene panel instead, which
          is the panel that is off screen for as long as this one is showing. */}
      <NodeCollisionsSection node={node} />

      <Section title="Appearance">
        <NumberField
          label="Alpha"
          value={node.props.alpha}
          step={0.05}
          min={0}
          max={1}
          onChange={(alpha) => updateProps(node.id, { alpha })}
        />
      </Section>
    </>
  );
}

function NodeInspector({ node }: { node: GameObjectNode }) {
  const renameNode = useEditorStore((s) => s.renameNode);
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const updateProps = useEditorStore((s) => s.updateProps);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const scaleNode = useEditorStore((s) => s.scaleNode);
  const lockAspect = useEditorStore((s) => s.lockAspect);
  const setLockAspect = useEditorStore((s) => s.setLockAspect);

  const setProp = (patch: Record<string, unknown>) => updateProps(node.id, patch);

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{node.type}</span>
        <SectionsToggle />
        <button
          className="icon-btn icon-btn--danger"
          onClick={deleteSelection}
          title="Delete object"
        >
          ✕
        </button>
      </div>

      <TextField
        label="Name"
        value={node.name}
        onChange={(name) => renameNode(node.id, name)}
      />

      <ParentRow node={node} />

      <ArrangeRow node={node} />

      {/* Rendered for one object as well as for a set: "centre this in the
          scene" is the alignment a single object asks for most, and it has
          nowhere else to live. */}
      <AlignSection count={1} />

      {/* An instance's own prefab controls live in the per-type section below,
          under the heading `SECTION_TITLE` already gives it. */}
      {node.type !== 'instance' && <NodePrefabSection node={node} />}

      <Section title="Transform">
        <div className="field-row">
          <NumberField
            label="X"
            value={node.transform.x}
            onChange={(x) => updateTransform(node.id, { x })}
          />
          <NumberField
            label="Y"
            value={node.transform.y}
            onChange={(y) => updateTransform(node.id, { y })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Rotation°"
            value={node.transform.rotation}
            onChange={(rotation) => updateTransform(node.id, { rotation })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="Scale X"
            value={node.transform.scaleX}
            step={0.1}
            onChange={(scaleX) => scaleNode(node.id, 'x', scaleX)}
          />
          <NumberField
            label="Scale Y"
            value={node.transform.scaleY}
            step={0.1}
            onChange={(scaleY) => scaleNode(node.id, 'y', scaleY)}
          />
        </div>
        <CheckboxField
          label="Scale X and Y together"
          value={lockAspect}
          onChange={setLockAspect}
        />
      </Section>

      {/* One heading per branch rather than one above them all. Wrapping the
          whole per-type block in a single section would bury a sprite's Sprite
          sheet, Animation and Appearance inside its Image section — invisible
          while it is closed and two presses away while it is open. Sections are
          flat peers, so each branch opens its own. `SECTION_TITLE` still names
          them, so a new node type is still a compile error there.

          The union in schema.ts narrows node.props per branch, so adding a node
          type later turns every missed case here into a compile error too. */}
      {(node.type === 'rectangle' || node.type === 'ellipse') && (
        <Section title={SECTION_TITLE[node.type]}>
          <div className="field-row">
            <NumberField
              label="Width"
              value={node.props.width}
              min={1}
              onChange={(width) => setProp({ width })}
            />
            <NumberField
              label="Height"
              value={node.props.height}
              min={1}
              onChange={(height) => setProp({ height })}
            />
          </div>
          <ColorField
            label="Fill"
            value={node.props.fill}
            onChange={(fill) => setProp({ fill })}
          />
          <NumberField
            label="Alpha"
            value={node.props.alpha}
            step={0.05}
            min={0}
            max={1}
            onChange={(alpha) => setProp({ alpha })}
          />
        </Section>
      )}

      {node.type === 'sprite' && (
        <>
          <Section title={SECTION_TITLE.sprite}>
            <AssetSummary assetId={node.props.assetId} />
            <AssetPicker
              selectedAssetId={node.props.assetId}
              onPick={(assetId) => setProp({ assetId })}
            />
          </Section>

          {node.props.assetId && (
            <>
              <Section title="Sprite sheet">
                <SheetSection assetId={node.props.assetId} />
                <FrameField node={node} />
              </Section>

              <Section title="Animation">
                <AnimationEditor
                  nodeId={node.id}
                  assetId={node.props.assetId}
                  animationId={node.props.animationId}
                  onPick={(animationId) => setProp({ animationId })}
                />
              </Section>
            </>
          )}

          <Section title="Appearance">
            <ColorField
              label="Tint"
              value={node.props.tint}
              onChange={(tint) => setProp({ tint })}
            />
            <NumberField
              label="Alpha"
              value={node.props.alpha}
              step={0.05}
              min={0}
              max={1}
              onChange={(alpha) => setProp({ alpha })}
            />
            <div className="field-row">
              <CheckboxField
                label="Flip X"
                value={node.props.flipX}
                onChange={(flipX) => setProp({ flipX })}
              />
              <CheckboxField
                label="Flip Y"
                value={node.props.flipY}
                onChange={(flipY) => setProp({ flipY })}
              />
            </div>
          </Section>
        </>
      )}

      {node.type === 'nineslice' && <NineSliceSection node={node} />}

      {node.type === 'tileSprite' && <TileSpriteSection node={node} />}

      {node.type === 'particles' && <ParticlesSection node={node} />}

      {node.type === 'container' && (
        <Section title={SECTION_TITLE.container}>
          <p className="hint">
            {node.children.length === 0
              ? 'Empty. Drag objects onto this row in the scene tree, or set their Parent to this group.'
              : `Moves, rotates and scales ${node.children.length} object${
                  node.children.length === 1 ? '' : 's'
                } as one.`}
          </p>
          <NumberField
            label="Alpha"
            value={node.props.alpha}
            step={0.05}
            min={0}
            max={1}
            onChange={(alpha) => setProp({ alpha })}
          />
        </Section>
      )}

      {node.type === 'instance' && <InstanceSection node={node} />}

      {node.type === 'tilemap' && <TilemapSection node={node} />}

      {node.type === 'text' && <TextSection node={node} />}

      <PhysicsSection node={node} />

      <TweenSection node={node} />

      <BlendSection node={node} />

      <ScrollSection node={node} />

      <EffectsSection node={node} />

      {/* Last, and on this panel at all for `NodeCollisionsSection`'s reason:
          the scene-wide list lives in `SceneInspector`, which renders only with
          an empty selection — so it is off screen for the whole of the time a
          person spends building the objects a rule is about. */}
      <NodeRulesSection node={node} />
    </div>
  );
}

/**
 * The node's Arcade Physics body.
 *
 * Last in the panel, below the per-type section rather than above it. A body is
 * opt-in and most objects never get one, so switched off it is a single
 * checkbox — and putting a dozen fields between the object's name and the fill
 * colour it is actually being edited for would cost a 390px screen most of a
 * scroll on every object in the project.
 *
 * Two things are refused rather than offered and quietly ignored, which is the
 * `containsInstance` treatment of "Save as prefab": a type Arcade cannot
 * simulate, and a node inside a group. Both say why. The second is the one a
 * reader will not expect, so it says the actual reason — a body is placed from
 * its object's `x`/`y`, and inside a group those are the group's coordinates,
 * not the world's.
 */
function PhysicsSection({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const setNodePhysics = useEditorStore((s) => s.setNodePhysics);

  if (!canHavePhysics(node.type)) return null;

  // The same question the store asks, asked the same way: a body may only be on
  // a direct child of the scene.
  const topLevel = scene.children.some((child) => child.id === node.id);
  const body = physicsOf(node, topLevel);
  // Which set of dials this body actually has. Both sets are on the node and
  // neither is ever deleted, so this hides rather than discards — switching the
  // scene's engine and switching it back leaves every number where it was.
  const { engine } = scenePhysicsOf(scene);

  if (!topLevel) {
    return (
      <Section title="Physics">
          <p className="hint">
            {node.physics
              ? 'This object has a body, but it is inside a group, so nothing draws it and the export leaves it out. Move it back to the top level of the scene and it comes back exactly as you left it.'
              : "Only an object in the scene itself can have a body. Arcade places a body from its object's X and Y, and inside a group those are the group's coordinates rather than the scene's."}
          </p>
        </Section>
      );
    }

    return (
      <>
        <Section title="Physics">
          <CheckboxField
            label="Physics body"
          value={body !== null}
          onChange={(on) => setNodePhysics(node.id, on ? {} : null)}
        />

        {body && (
          <>
            <SelectField
              label="Body"
              value={body.kind}
              options={[
                { value: 'dynamic', label: 'Dynamic — moves' },
                { value: 'static', label: 'Static — never moves' },
              ]}
              onChange={(kind) =>
                setNodePhysics(node.id, { kind: kind === 'static' ? 'static' : 'dynamic' })
              }
            />

            {/* A static body genuinely has none of these — Phaser's StaticBody
                carries no velocity, bounce, drag, mass or gravity — so they are
                absent rather than disabled. A disabled field says "not now"; these
                do not exist for this kind of body at all. */}
            {body.kind === 'dynamic' && (
              <>
                <div className="field-row">
                  <NumberField
                    label="Velocity X"
                    value={body.velocityX}
                    onChange={(velocityX) => setNodePhysics(node.id, { velocityX })}
                  />
                  <NumberField
                    label="Velocity Y"
                    value={body.velocityY}
                    onChange={(velocityY) => setNodePhysics(node.id, { velocityY })}
                  />
                </div>
                {/* Two sets of dials for one body, and which one is shown is the
                    scene's engine rather than a preference. An Arcade body
                    bounces and drags per axis because it is an axis-aligned box;
                    a Matter body is a polygon that turns, so it has one
                    restitution and one friction for the whole of it, and a
                    surface friction Arcade has no notion of. Showing both sets at
                    once would put four fields on screen that the exported game
                    reads nowhere. */}
                {engine === 'arcade' ? (
                  <>
                    <div className="field-row">
                      <NumberField
                        label="Bounce X"
                        value={body.bounceX}
                        step={0.05}
                        min={0}
                        onChange={(bounceX) => setNodePhysics(node.id, { bounceX })}
                      />
                      <NumberField
                        label="Bounce Y"
                        value={body.bounceY}
                        step={0.05}
                        min={0}
                        onChange={(bounceY) => setNodePhysics(node.id, { bounceY })}
                      />
                    </div>
                    <div className="field-row">
                      <NumberField
                        label="Drag X"
                        value={body.dragX}
                        min={0}
                        onChange={(dragX) => setNodePhysics(node.id, { dragX })}
                      />
                      <NumberField
                        label="Drag Y"
                        value={body.dragY}
                        min={0}
                        onChange={(dragY) => setNodePhysics(node.id, { dragY })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field-row">
                      <NumberField
                        label="Bounciness"
                        value={body.restitution}
                        step={0.05}
                        min={0}
                        max={1}
                        onChange={(restitution) => setNodePhysics(node.id, { restitution })}
                      />
                      <NumberField
                        label="Air friction"
                        value={body.frictionAir}
                        step={0.01}
                        min={0}
                        max={1}
                        onChange={(frictionAir) => setNodePhysics(node.id, { frictionAir })}
                      />
                    </div>
                    <NumberField
                      label="Surface friction"
                      value={body.friction}
                      step={0.05}
                      min={0}
                      max={1}
                      onChange={(friction) => setNodePhysics(node.id, { friction })}
                    />
                  </>
                )}
                <div className="field-row">
                  <NumberField
                    label="Spin°/s"
                    value={body.angularVelocity}
                    onChange={(angularVelocity) =>
                      setNodePhysics(node.id, { angularVelocity })
                    }
                  />
                  <NumberField
                    label="Mass"
                    value={body.mass}
                    step={0.1}
                    min={0.0001}
                    onChange={(mass) => setNodePhysics(node.id, { mass })}
                  />
                </div>
                {/* Matter has no such flag: a body there either takes part in the
                    simulation or is static, and "dynamic but unpushable" is not a
                    state it can be in. Absent rather than disabled, by the rule
                    the static body's own missing fields already follow. */}
                {engine === 'arcade' && (
                  <CheckboxField
                    label="Immovable"
                    value={body.immovable}
                    onChange={(immovable) => setNodePhysics(node.id, { immovable })}
                  />
                )}
                <CheckboxField
                  label="Affected by gravity"
                  value={body.allowGravity}
                  onChange={(allowGravity) => setNodePhysics(node.id, { allowGravity })}
                />
              </>
            )}

            <CheckboxField
              label="Collide with world bounds"
              value={body.collideWorldBounds}
              onChange={(collideWorldBounds) =>
                setNodePhysics(node.id, { collideWorldBounds })
              }
            />
            <p className="hint">
              {engine === 'arcade'
                ? 'The green outline on the canvas is the body. It stays square to the screen however the object is turned, because an Arcade body does not rotate with what it belongs to — it grows to hold the turned object instead. Switch the scene to Matter if the collision shape has to follow the shape.'
                : 'The green outline on the canvas is the body, and it turns with the object because a Matter body is a real polygon. Matter also collides every body with every other one, so there are no pairs to list.'}{' '}
              Nothing moves in the editor — the document is what you are editing,
              so the simulation is left to the game you export.
            </p>
          </>
        )}
      </Section>

      {/* Peers of Physics rather than children of it. Sections are flat —
          a nested one is invisible while its parent is closed and two
          presses away while it is open — and `NodeCollisionsSection` in
          particular already renders flat inside `TilemapSection`, so this
          is also what gives it one shape in both places. The order is
          unchanged, which is what the two comments below still describe. */}
      {body && (
        <>
          {/* Directly after "Collide with world bounds" and its hint, because
              the world edges and the collider rows are the only two things an
              Arcade body ever stops against. Before the controls on purpose
              too: a platformer's jump is gated on there being something
              underneath, which is what a row here is for. */}
          <NodeCollisionsSection node={node} />

          {/* Only for a dynamic body, and absent rather than disabled for the
              reason the velocity rows above are: a StaticBody has no velocity
              for a key to change, so this does not exist for that kind of body
              rather than being switched off for it. */}
          {body.kind === 'dynamic' && <ControlsSection node={node} />}
        </>
      )}
    </>
  );
}

/**
 * What this object is told to collide with, on the object's own panel.
 *
 * The whole of a reported bug: a static floor, a dynamic box above it, gravity
 * on, and in the exported game the box goes straight through. Arcade never
 * stops two bodies on its own — `physics.add.collider(a, b)` has to be
 * registered — and this editor could already say so, in `CollidersSection`.
 * What it could not do was let anyone *find* it. That section lives in
 * `SceneInspector`, which renders only with an empty selection, so it is off
 * screen for the whole of the time a person spends giving two objects bodies;
 * and it hides itself below two collidable nodes, so deselecting after the
 * first body shows nothing either. Correct, and unreachable.
 *
 * So the pair is made here as well, beside the body it is about, and both
 * controls write `scene.colliders` through the same three actions. **One field,
 * two controls** — the tile eraser's rule and the emitter marker's. What would
 * be wrong is a second notion of what collides; two ways to reach the one
 * notion is the point.
 *
 * `others` mirrors `collidersOf`'s own refusals rather than restating a subset
 * of them, which is what stops this panel producing a row that vanishes on the
 * next read: not this node, and never a second tilemap when this node is one,
 * since a layer only ever collides with something that moves.
 *
 * The empty state is a sentence rather than nothing, by the rule that already
 * renders `AlignSection` disabled for one object: a control that says why it
 * cannot is worth more than an absence. It is a plain hint and not
 * `hint--error`, which is for a document that is wrong *now* — a missing image.
 * A body nobody has paired yet is a document that is merely unfinished, which
 * every project is for its first minute.
 */
function NodeCollisionsSection({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const addCollider = useEditorStore((s) => s.addCollider);
  const updateCollider = useEditorStore((s) => s.updateCollider);
  const removeCollider = useEditorStore((s) => s.removeCollider);

  // The top-level rule, asked once here rather than at both call sites: a row
  // may only name a direct child of the scene, which is `collidersOf`'s first
  // refusal and `physicsOf`'s.
  const topLevel = scene.children.some((child) => child.id === node.id);
  if (!topLevel) return null;

  // A Matter world collides everything with everything, so there is no pair to
  // pick — `collidersOf` already answers empty here, and this says why rather
  // than leaving a heading with nothing under it. `AlignSection`'s rule: a
  // control that says why it cannot beats one that is not there.
  if (scenePhysicsOf(scene).engine === 'matter') {
    return (
      <Section title="Collides with">
        <p className="hint">
          This scene runs Matter, which collides every body with every other one
          on its own. There is nothing to pair up. Any rows made under Arcade
          are kept and come back if the scene is switched back.
        </p>
      </Section>
    );
  }

  // Derived outside the selector, never inside one: both build a fresh array
  // every call, so selecting either loops forever (React error #185).
  const others = collidableNodes(scene).filter(
    (other) => other.id !== node.id && !(node.type === 'tilemap' && other.type === 'tilemap'),
  );
  const rows = collidersNaming(scene, node.id);
  const options = others.map((other) => ({ value: other.id, label: other.name }));
  const paired = new Set(rows.map((row) => (row.aId === node.id ? row.bId : row.aId)));
  const unpaired = others.find((other) => !paired.has(other.id));

  return (
    /* "Collides with", not "Collisions" and not "Collision": the Scene panel
       owns the first and a tilemap's solid-tile palette owns the second, and on
       a tilemap this renders directly under that one. Three headings, one word
       apart, would read as three features. It is also a storage key now — the
       open sections are remembered by title — so the three stay three. */
    <Section title="Collides with">
      {rows.map((row, index) => {
        // Which side this node sits on decides which field the picker writes.
        // Read once, so the value shown and the value written cannot disagree.
        const onA = row.aId === node.id;
        return (
          <div key={row.id}>
            {/* Numbered, and deliberately not the Scene panel's `With N` /
                `How N` / `Remove collision N`: the suite matches a label
                exactly, and the two sections can never render together only
                because `SceneInspector` needs an empty selection. Distinct
                names cost nothing and do not depend on that staying true. */}
            <div className="field-row">
              <SelectField
                label={`Collides with ${index + 1}`}
                value={onA ? row.bId : row.aId}
                options={options}
                onChange={(id) => updateCollider(row.id, onA ? { bId: id } : { aId: id })}
              />
              <SelectField
                label={`Collision ${index + 1} is`}
                value={row.kind}
                options={[
                  { value: 'collide', label: 'Solid' },
                  { value: 'overlap', label: 'Overlap' },
                ]}
                onChange={(kind) =>
                  updateCollider(row.id, {
                    kind: kind === 'overlap' ? 'overlap' : 'collide',
                  })
                }
              />
            </div>
            {/* On its own line rather than beside the pair above: at 390px a
                third control in that row is ~85px and truncates every object
                name in the picker to nothing, which is the reason the Scene
                panel splits its four the same way. No `--foot`, since that
                exists to bottom-align a button standing next to a field. */}
            <button
              className="btn btn--block btn--danger"
              onClick={() => removeCollider(row.id)}
              aria-label={`Remove collision with ${index + 1}`}
              title="Stop these two meeting"
            >
              Remove
            </button>
          </div>
        );
      })}

      {others.length === 0 ? (
        <p className="hint">
          Nothing else here can collide yet. Give the floor a body of its own —
          or add a tilemap with solid tiles — and the pair can be made from this
          panel.
        </p>
      ) : (
        <>
          {/* A real candidate rather than a blank row, exactly as the Scene
              panel's `+ Collision` takes the first two: a row naming nothing is
              one `collidersOf` drops on the next read, leaving nothing on
              screen to fill in. The first one *not already paired* with this
              node, so pressing this twice builds two different pairs rather
              than the same pair twice — which matters more here than it does on
              the scene panel, since this is the button people actually find. It
              falls back to the first when everything is paired, because the
              alternative is a button that silently does nothing. */}
          <button
            className="btn btn--block"
            onClick={() => addCollider(node.id, (unpaired ?? others[0]).id)}
          >
            + Add a collision
          </button>
          {rows.length === 0 && (
            <p className="hint">
              Nothing collides with this yet, so in the exported game it falls
              straight through everything — a floor with a body of its own
              included. Arcade only stops two things that are told to meet.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * What the player drives this object with.
 *
 * The first thing in this editor that is about the game *running*, and it is
 * here — under the body it needs — rather than in a panel of its own, because
 * it is a property of that body: a velocity is what a key changes, and a static
 * body has none. Only a top-level node can have one, which `PhysicsSection`
 * has already established by the time this renders.
 *
 * Two modes rather than a row of switches, for the reason `NodeControls` says:
 * a top-down game moves on four axes and never jumps, a platformer moves on two
 * and jumps, and the combinations in between are ones nobody asks for and the
 * exporter would have to answer for.
 */
function ControlsSection({ node }: { node: GameObjectNode }) {
  const setNodeControls = useEditorStore((s) => s.setNodeControls);
  // Derived outside the selector: `controlsOf` builds a fresh object every
  // call, the `tileMapOf` trap.
  const controls = controlsOf(node, true);

  return (
    <Section title="Controls">
      <CheckboxField
        label="Player controls"
        value={controls !== null}
        onChange={(on) => setNodeControls(node.id, on ? {} : null)}
      />
      {controls && (
        <>
          <SelectField
            label="Control mode"
            value={controls.mode}
            options={[
              { value: 'platformer', label: 'Platformer — walk and jump' },
              { value: 'topDown', label: 'Top-down — walk any way' },
            ]}
            onChange={(mode) =>
              setNodeControls(node.id, { mode: mode === 'topDown' ? 'topDown' : 'platformer' })
            }
          />
          <SelectField
            label="Control keys"
            value={controls.scheme}
            options={[
              { value: 'arrows', label: 'Arrow keys' },
              { value: 'wasd', label: 'W A S D' },
            ]}
            onChange={(scheme) =>
              setNodeControls(node.id, { scheme: scheme === 'wasd' ? 'wasd' : 'arrows' })
            }
          />
          {/* Beside the keys rather than a third option in them: which keys and
              whether there are also buttons are two questions, and keeping them
              apart is what lets one export play on a desktop and on a phone. */}
          <CheckboxField
            label="On-screen buttons"
            value={controls.touch}
            onChange={(touch) => setNodeControls(node.id, { touch })}
          />
          <div className="field-row">
            <NumberField
              label="Walk speed"
              value={controls.speed}
              min={0}
              onChange={(speed) => setNodeControls(node.id, { speed })}
            />
            {/* Absent in top-down for the rule this panel already follows twice
                over: there is no jump in a game with no down. */}
            {controls.mode === 'platformer' && (
              <NumberField
                label="Jump speed"
                value={controls.jump}
                min={0}
                onChange={(jump) => setNodeControls(node.id, { jump })}
              />
            )}
          </div>
          <p className="hint">
            The green arrows on the body are which object the keys drive. Nothing
            moves here either — the export gets an <code>update()</code> that
            reads the keys, and a jump needs something under it, which is a
            collision or a solid tile.
          </p>
          {controls.touch && (
            <p className="hint">
              The orange rings are where the exported game draws its buttons. They
              are the game's, not the editor's — nothing here presses them — and
              there is one set per scene, so everything driven in this scene
              reads the same buttons. A top-down object puts up and down on the
              pad; a platformer puts a jump button on the right.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * The node's tween: where its own numbers end up, and how they get there.
 *
 * Below `PhysicsSection` and for its reason — opt-in, most objects never get
 * one, and a dozen rows between the object's name and the fill colour it is
 * actually being edited for costs a 390px screen a scroll on every object in
 * the project.
 *
 * Beside that section rather than inside it, and with **no refusal branch at
 * all**, which is the thing to notice next to a neighbour whose refusals are
 * half its body. A tween works on a container, an instance, a tilemap and a
 * node nested three groups deep, because it writes the object's own local
 * properties — where a body and a drive-scheme both read world coordinates and
 * are therefore top-level only. There is nothing here to say no to.
 */
/** What each effect kind is called in the picker. */
const EFFECT_LABEL: Record<NodeEffect['kind'], string> = {
  glow: 'Glow',
  blur: 'Blur',
  shadow: 'Drop shadow',
  pixelate: 'Pixelate',
  mask: 'Mask',
};

/**
 * The dials for one effect.
 *
 * Every label carries "Effect <n>", because Alpha, Colour, X, Y, Scale X and
 * Width are all rows further up this same panel and the suite matches a label
 * exactly — the "Animation name, not Name" rule, and `NodeRulesSection`'s
 * `Rule <n> do <m>` shape one feature over.
 *
 * Two controls to a `field-row` and never three: at 390px a third is about
 * 85px, which truncates a label to nothing.
 */
function EffectFields({
  effect,
  label,
  onChange,
}: {
  effect: NodeEffect;
  label: string;
  onChange: (next: NodeEffect) => void;
}) {
  switch (effect.kind) {
    case 'glow':
      return (
        <>
          <ColorField
            label={`${label} colour`}
            value={effect.color}
            onChange={(color) => onChange({ ...effect, color })}
          />
          <div className="field-row">
            <NumberField
              label={`${label} outer strength`}
              value={effect.outerStrength}
              min={0}
              step={1}
              onChange={(outerStrength) => onChange({ ...effect, outerStrength })}
            />
            <NumberField
              label={`${label} inner strength`}
              value={effect.innerStrength}
              min={0}
              step={1}
              onChange={(innerStrength) => onChange({ ...effect, innerStrength })}
            />
          </div>
          <NumberField
            label={`${label} spread`}
            value={effect.scale}
            min={0}
            step={0.5}
            onChange={(scale) => onChange({ ...effect, scale })}
          />
        </>
      );
    case 'blur':
      return (
        <>
          <div className="field-row">
            <NumberField
              label={`${label} blur X`}
              value={effect.x}
              min={0}
              step={1}
              onChange={(x) => onChange({ ...effect, x })}
            />
            <NumberField
              label={`${label} blur Y`}
              value={effect.y}
              min={0}
              step={1}
              onChange={(y) => onChange({ ...effect, y })}
            />
          </div>
          <div className="field-row">
            <NumberField
              label={`${label} strength`}
              value={effect.strength}
              min={0}
              step={0.5}
              onChange={(strength) => onChange({ ...effect, strength })}
            />
            {/* Phaser's own three shaders, so a select rather than a number:
                between them there is nothing to interpolate. */}
            <SelectField
              label={`${label} quality`}
              value={String(effect.quality)}
              options={[
                { value: '0', label: 'Low' },
                { value: '1', label: 'Medium' },
                { value: '2', label: 'High' },
              ]}
              onChange={(quality) => onChange({ ...effect, quality: Number(quality) })}
            />
          </div>
        </>
      );
    case 'shadow':
      return (
        <>
          <ColorField
            label={`${label} colour`}
            value={effect.color}
            onChange={(color) => onChange({ ...effect, color })}
          />
          <div className="field-row">
            <NumberField
              label={`${label} offset X`}
              value={effect.x}
              step={1}
              onChange={(x) => onChange({ ...effect, x })}
            />
            <NumberField
              label={`${label} offset Y`}
              value={effect.y}
              step={1}
              onChange={(y) => onChange({ ...effect, y })}
            />
          </div>
          <div className="field-row">
            <NumberField
              label={`${label} decay`}
              value={effect.decay}
              min={0}
              step={0.05}
              onChange={(decay) => onChange({ ...effect, decay })}
            />
            <NumberField
              label={`${label} power`}
              value={effect.power}
              min={0}
              step={0.5}
              onChange={(power) => onChange({ ...effect, power })}
            />
          </div>
        </>
      );
    case 'pixelate':
      return (
        <NumberField
          label={`${label} amount`}
          value={effect.amount}
          min={0}
          step={1}
          onChange={(amount) => onChange({ ...effect, amount })}
        />
      );
    // The one kind whose dial is a reference rather than a number, and the one
    // that can arrive doing nothing — `defaultEffect` cannot seed it with an
    // image, so the summary above the picker is what says so. `AlignSection`'s
    // rule: a control that says why it cannot beats one that is not there.
    //
    // Only one labelled field, `<label> invert`, never a bare "Invert": the
    // suite matches a label exactly and `Effect 2 invert` has to be reachable
    // beside `Effect 1 invert`. The picker itself carries no label at all,
    // which is how it renders on the five per-type panels that already use it
    // — its "Import image…" button and its rows are the control, and adding
    // one here would put a second image label on a panel whose object may
    // already own one.
    case 'mask':
      return (
        <>
          <AssetSummary assetId={effect.assetId} kind="mask" />
          <AssetPicker
            selectedAssetId={effect.assetId}
            onPick={(assetId) => onChange({ ...effect, assetId })}
          />
          <CheckboxField
            label={`${label} invert`}
            value={effect.invert}
            onChange={(invert) => onChange({ ...effect, invert })}
          />
        </>
      );
  }
}

/**
 * Visual effects on this object: Phaser 4 filters, in the order they run.
 *
 * On every node type, because `Filters` is mixed into Phaser's base
 * `GameObject` — there is no eligibility list here the way `PHYSICS_TYPES` is
 * one, and nothing to keep in step with it.
 *
 * The list is the feature: filters chain, each taking the previous one's
 * output, so the arrows are not a convenience — a glow under a pixelate and a
 * pixelate under a glow are two different pictures.
 */
/**
 * How this object composites with what is already drawn behind it.
 *
 * On every node type, because Phaser mixes BlendMode into the base
 * `GameObject` — so there is no eligibility list here the way `PHYSICS_TYPES`
 * is one, and nothing to keep in step with it. `EffectsSection`'s sentence, one
 * field over, and it is why this is its own flat peer rather than a row inside
 * an `Appearance` section: there are five of those, one per type branch, so a
 * field that belongs to *every* node would be reachable on half the types and
 * missing on the rest.
 *
 * Its own section rather than a row inside Effects for the same reason those
 * are flat peers at all: a filter is a pass over this object's own pixels and a
 * blend mode is how the result meets what is under it. Neighbouring subjects,
 * not one subject — and folding it in would have meant retitling `Effects`,
 * which is a **persisted storage key** (`Section` keys its open state by
 * title), so the rename would silently reset that section for every existing
 * user.
 *
 * Above Effects in the panel, because that is the order the pixels go in.
 */
function BlendSection({ node }: { node: GameObjectNode }) {
  const setNodeBlendMode = useEditorStore((s) => s.setNodeBlendMode);

  return (
    <Section title="Blend">
      <SelectField
        // "Blend mode", never the bare "Blend" the particles panel used to
        // carry and never "Mode": the suite matches a label exactly, and this
        // panel already holds a Frame, a Name and a Kind.
        label="Blend mode"
        value={blendModeOf(node)}
        options={BLEND_MODES.map((mode) => ({
          value: mode,
          label: mode.charAt(0) + mode.slice(1).toLowerCase(),
        }))}
        onChange={(mode) => setNodeBlendMode(node.id, mode as BlendMode)}
      />
      <p className="hint">
        Add and Screen lighten what is behind; Multiply darkens it. Normal is the default
        and stores nothing.
      </p>
    </Section>
  );
}

/**
 * How far this object moves when the scene's camera does.
 *
 * On every node type, `BlendSection`'s reason one component over: Phaser mixes
 * `ScrollFactor` into the base `GameObject`, and a `TilemapLayer` and a
 * `ParticleEmitter` each carry one too — so there is no eligibility list here
 * the way `PHYSICS_TYPES` is one, and nothing to keep in step with it.
 *
 * Its own flat peer titled `Scroll`, checked against every other `Section`
 * title in this file and against the mobile tab bar's exactly-matched
 * `Scene`/`Properties`/`File`. Deliberately **not** `Camera`, which
 * `SceneInspector` already owns: a `Section` title is a persisted storage key,
 * so two panels sharing one would open and close together though they are about
 * different things. Below Blend because a blend mode is about the pixels and
 * this is about the place.
 */
function ScrollSection({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const setNodeScrollFactor = useEditorStore((s) => s.setNodeScrollFactor);
  // Derived outside any selector: `scrollFactorOf` builds a fresh object per
  // call, so `useEditorStore((s) => scrollFactorOf(...))` is React error #185 —
  // the `tileMapOf` trap. `blendModeOf` next door is safe in a selector and this
  // is not, which is exactly the assumption a reader arriving from there makes.
  const topLevel = scene.children.some((child) => child.id === node.id);
  const factor = scrollFactorOf(node, topLevel);

  // `NodeRulesSection`'s rule: say why, rather than leave the section out. A
  // silently absent control reads as a broken one, which is this file's
  // most-repeated lesson — and here the fix is one sentence that also says
  // where to put the factor instead.
  //
  // Worded deliberately clear of that section's own sentence, which says
  // "top level of the scene" a few rows down this same panel. Both are hints
  // and both render at once for a nested node, so a spec reaching either by its
  // text would have matched two — the exactly-matched-label rule arriving on a
  // paragraph, and it cost this feature's spec a run.
  if (!topLevel) {
    return (
      <Section title="Scroll">
        <p className="hint">
          Only an object the scene holds directly can have a scroll factor. Put one on the
          group instead, and everything inside it moves together.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Scroll">
      <div className="field-row">
        <NumberField
          // "Scroll factor X", never a bare "X": the Transform section a few
          // rows up this same panel owns that, and `SceneInspector` owns
          // "Camera X". The suite matches a label exactly.
          label="Scroll factor X"
          value={factor.x}
          step={0.1}
          min={-MAX_SCROLL_FACTOR}
          max={MAX_SCROLL_FACTOR}
          onChange={(x) => setNodeScrollFactor(node.id, { ...factor, x })}
        />
        <NumberField
          label="Scroll factor Y"
          value={factor.y}
          step={0.1}
          min={-MAX_SCROLL_FACTOR}
          max={MAX_SCROLL_FACTOR}
          onChange={(y) => setNodeScrollFactor(node.id, { ...factor, y })}
        />
      </div>
      <p className="hint">
        1 moves with the world, 0 pins this to the camera — a score or a health bar that
        stays put while the level scrolls past. Between the two is parallax: a distant
        background at 0.3 drifts slower than the ground.
      </p>
      {isDefaultScrollFactor(factor) || !physicsOf(node, topLevel) ? null : (
        // Phaser's own sentence, from `ScrollFactor`'s doc comment: "scroll
        // factor values other than 1 are not taken in to consideration when
        // calculating physics collisions. Bodies always collide based on their
        // world position." A combination explained beats a combination silently
        // refused — the tween-versus-dynamic-body call — and it is shown only
        // where both halves are actually present, so it is a fact about *this*
        // object rather than a warning on every object in the project.
        <p className="hint">
          This object has a body, and Phaser collides bodies on their world position — so
          it will collide where it is stored rather than where it is drawn.
        </p>
      )}
    </Section>
  );
}

function EffectsSection({ node }: { node: GameObjectNode }) {
  const addEffect = useEditorStore((s) => s.addEffect);
  const setEffect = useEditorStore((s) => s.setEffect);
  const removeEffect = useEditorStore((s) => s.removeEffect);
  const moveEffect = useEditorStore((s) => s.moveEffect);
  const effects = effectsOf(node);
  const full = effects.length >= MAX_EFFECTS;

  return (
    <Section title="Effects">
      {effects.length === 0 ? (
        // A sentence rather than an empty picker — `AlignSection`'s rule, that
        // a control saying why beats one that is not there.
        <p className="hint">
          Nothing is drawn over this object yet. Add a glow, a blur, a drop shadow or a
          pixelate — they run in the order they are listed.
        </p>
      ) : (
        effects.map((effect, index) => {
          const label = `Effect ${index + 1}`;
          return (
            <div key={index}>
              <SelectField
                label={`${label} kind`}
                value={effect.kind}
                // The whole effect is replaced rather than its `kind` patched,
                // which is what stops a glow's colour surviving underneath a
                // pixelate that has no use for one.
                onChange={(kind) =>
                  setEffect(node.id, index, defaultEffect(kind as NodeEffect['kind']))
                }
                options={EFFECT_KINDS.map((kind) => ({
                  value: kind,
                  label: EFFECT_LABEL[kind],
                }))}
              />
              <EffectFields
                effect={effect}
                label={label}
                onChange={(next) => setEffect(node.id, index, next)}
              />
              <div className="field-row">
                <button
                  className="icon-btn"
                  disabled={index === 0}
                  onClick={() => moveEffect(node.id, index, -1)}
                  title={`Run effect ${index + 1} earlier`}
                >
                  ↑
                </button>
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={() => removeEffect(node.id, index)}
                  title={`Remove effect ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })
      )}

      <button
        className="btn btn--add"
        disabled={full}
        onClick={() => addEffect(node.id, 'glow')}
        title={
          full
            ? `An object can carry ${MAX_EFFECTS} effects; each one is another pass over it`
            : 'Add a glow, then change it to whatever you want'
        }
      >
        + Add an effect
      </button>

      {/* Unconditional rather than detected: the panel is React and has no
          handle on the renderer, and plumbing one into the store to light up a
          sentence would be editor state that exists for a sentence. A silently
          absent feature reads as a broken one, which is the half this fixes. */}
      <p className="hint">
        Effects need WebGL. A browser without it draws the object plain, here and in the
        exported game alike.
      </p>
    </Section>
  );
}

function TweenSection({ node }: { node: GameObjectNode }) {
  const setNodeTween = useEditorStore((s) => s.setNodeTween);
  const setTweenTarget = useEditorStore((s) => s.setTweenTarget);
  const tween = tweenOf(node);

  // What a property is called in the panel, and what switching it on should
  // seed it with. One table, so the label and the seed cannot drift apart — and
  // every label carries "Tween", because X, Y, Rotation°, Scale X, Scale Y and
  // Alpha are all rows a little further up this same panel and the suite
  // matches a label exactly. The "Animation name, not Name" rule, sixth time.
  const rows: { property: TweenProperty; label: string; step?: number; from: number }[] = [
    { property: 'x', label: 'Tween X to', from: node.transform.x },
    { property: 'y', label: 'Tween Y to', from: node.transform.y },
    { property: 'rotation', label: 'Tween rotation° to', from: node.transform.rotation },
    { property: 'scaleX', label: 'Tween scale X to', step: 0.1, from: node.transform.scaleX },
    { property: 'scaleY', label: 'Tween scale Y to', step: 0.1, from: node.transform.scaleY },
    { property: 'alpha', label: 'Tween alpha to', step: 0.1, from: node.props.alpha },
  ];

  return (
    <Section title="Tween">
      <CheckboxField
        label="Tween this object"
        value={tween !== null}
        onChange={(on) => setNodeTween(node.id, on ? {} : null)}
      />

      {tween && (
        <>
          {/* The six switches two to a row, then a field for each one that is
              on. Not a switch paired with its own field on one row: a checkbox
              field is centred on its own height while a number field is a label
              stacked over an input, so the two would need a new alignment rule
              to stop the box floating halfway up the label beside it. Six full
              rows of switches would also cost 264px of a 390px sheet before the
              first number, which is why they are paired. */}
          {[0, 2, 4].map((start) => (
            <div className="field-row" key={start}>
              {rows.slice(start, start + 2).map(({ property, label, from }) => (
                <CheckboxField
                  key={property}
                  label={label.replace(' to', '')}
                  value={tween.to[property] !== undefined}
                  // Seeded from where the object is now, so switching one on is
                  // immediately a valid tween rather than a jump to the origin
                  // — `defaultTween`'s argument, one property at a time.
                  onChange={(on) => setTweenTarget(node.id, property, on ? from : null)}
                />
              ))}
            </div>
          ))}

          {rows.map(({ property, label, step }) => {
            const value = tween.to[property];
            return value === undefined ? null : (
              <NumberField
                key={property}
                label={label}
                value={value}
                step={step}
                onChange={(next) => setTweenTarget(node.id, property, next)}
              />
            );
          })}

          <div className="field-row">
            <NumberField
              label="Tween duration ms"
              value={tween.duration}
              min={1}
              step={100}
              onChange={(duration) => setNodeTween(node.id, { duration })}
            />
            <NumberField
              label="Tween delay ms"
              value={tween.delay}
              min={0}
              step={100}
              onChange={(delay) => setNodeTween(node.id, { delay })}
            />
          </div>

          {/* A select rather than free text: an ease is a name with no near
              neighbour, so typed by hand it is wrong by one character and
              Phaser silently falls back to linear. The atlas Frame field's
              argument. */}
          <SelectField
            label="Tween ease"
            value={tween.ease}
            options={TWEEN_EASES.map((ease) => ({ value: ease, label: ease }))}
            onChange={(ease) =>
              setNodeTween(node.id, { ease: ease as (typeof TWEEN_EASES)[number] })
            }
          />

          <CheckboxField
            label="Tween goes back again"
            value={tween.yoyo}
            onChange={(yoyo) => setNodeTween(node.id, { yoyo })}
          />

          <div className="field-row">
            <NumberField
              label="Tween repeat"
              value={tween.repeat}
              min={-1}
              step={1}
              onChange={(repeat) => setNodeTween(node.id, { repeat })}
            />
            <NumberField
              label="Tween repeat delay ms"
              value={tween.repeatDelay}
              min={0}
              step={100}
              onChange={(repeatDelay) => setNodeTween(node.id, { repeatDelay })}
            />
          </div>

          <p className="hint">
            −1 repeats forever. The dashed outline is where the tween ends up —
            press ▶ to run it. Nothing here is written back to the object: the
            numbers above stay exactly as you left them, and switching preview
            off puts everything back.
          </p>
          {node.physics && (
            <p className="hint">
              This object also has a physics body. A tween and a body both write
              the object's position, and in the exported game the tween wins.
            </p>
          )}
        </>
      )}
    </Section>
  );
}
