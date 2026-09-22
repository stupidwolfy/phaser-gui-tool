import { activeScene } from '../core/store';
import {
  RULE_OPERATOR_JS,
  TARGET_PHASER_VERSION,
  TWEEN_PHASER_KEY,
  TWEEN_PROPERTIES,
  atlasDataOf,
  atlasOf,
  bodyIsTurned,
  cameraOf,
  collidersOf,
  controlsOf,
  drivenIn,
  findAnimation,
  findAsset,
  findAudio,
  findPrefab,
  fontByFamily,
  fontFormatOf,
  fontStackOf,
  frameGridOf,
  isDefaultCamera,
  labelFormatOf,
  physicsOf,
  resolveFrame,
  rulesOf,
  scenePhysicsOf,
  sliceInsetsOf,
  soundsOf,
  textStyleOf,
  tileMapOf,
  touchZonesOf,
  blendModeOf,
  scrollFactorOf,
  isDefaultScrollFactor,
  effectsOf,
  tweenOf,
  withoutInstances,
  type AnimationClip,
  type AudioAsset,
  type FontAsset,
  type GameObjectNode,
  type NodeEffect,
  type ImageAsset,
  type NodeControls,
  type PhysicsBody,
  type PhysicsEngine,
  type Prefab,
  type Project,
  type ProjectVariable,
  type RuleAction,
  type SceneDoc,
  type SceneRule,
  type TextStyle,
  type TileMap,
  type TouchButton,
  type VariableValue,
} from '../core/schema';

/**
 * Turns the project document into real Phaser code.
 *
 * A pure function of the document — no editor state reaches it, which is the
 * payoff for keeping Phaser a renderer rather than the source of truth.
 *
 * The two outputs share `buildCreateBody` and `buildSceneClass`: the statements
 * that construct the objects, and the class around them, are identical
 * JavaScript in both, and only the wrapper differs (a TypeScript module you
 * import, or a self-contained page you can open). Keeping one generator means
 * the runnable preview can never drift from the file you ship.
 *
 * Both emit the *whole project* — one class per scene, over one shared image
 * table and one shared set of prefab factories, which is how the document holds
 * them too.
 */

/**
 * Makes generated JavaScript safe to embed in an HTML <script> element.
 *
 * An HTML parser ends the script at the first literal `</script>`, wherever it
 * appears — inside a JS string literal included. A project whose text content
 * contained one produced an export that would not run, and could execute
 * arbitrary markup in whoever opened it. `<\/` is a valid escape in a JS string
 * and parses back to `</`, so this costs nothing at runtime.
 *
 * U+2028/U+2029 are handled for the same class of reason: they are line
 * terminators in older JS parsers but not in JSON.
 */
function escapeForScriptTag(js: string): string {
  return js
    .replace(/<\//g, '<\\/')
    .replace(/<!--/g, '<\\!--')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Escapes text interpolated into HTML markup (the document title). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A colour safe to drop into a CSS declaration. Anything that is not a plain
 * hex colour would let a malformed or hostile project break out of the rule.
 */
function cssColor(hex: string, fallback = '#000000'): string {
  const clean = String(hex).trim();
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean : fallback;
}

/** '#rrggbb' -> '0xrrggbb', the form Phaser's constructors take. */
function hexLiteral(hex: string, fallback = '0xffffff'): string {
  const clean = String(hex).replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(clean) ? `0x${clean.toLowerCase()}` : fallback;
}

/**
 * '#rrggbb' -> '255, 128, 0', the three channel arguments Phaser's camera
 * `flash` and `fade` take.
 *
 * Every colour in this document is a hex string and these two calls are the one
 * place that is not what Phaser wants, so the split lives here rather than at
 * each call site — `hexLiteral`'s sibling, and its regex. The fallback is the
 * belt to the reader's braces: `ruleActionsOf` has already repaired a bad
 * colour, so nothing the editor can produce reaches it.
 */
function rgbArgs(hex: string, fallback = '0, 0, 0'): string {
  const clean = String(hex).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  const channels = [0, 2, 4].map((at) => parseInt(clean.slice(at, at + 2), 16));
  return channels.join(', ');
}

/** JSON.stringify handles quotes, backslashes and newlines correctly for us. */
const str = (value: string): string => JSON.stringify(value);

/** Trims trailing zeroes so the output reads 480 rather than 480.0000001. */
const num = (value: number): string => String(Number(value.toFixed(4)));

/**
 * A variable-shaped value as a literal: a bare number, or a quoted string.
 *
 * One helper rather than the same ternary at the three places a
 * `VariableValue` is printed — the table, a `setVar` and a condition's
 * comparand — for `frameArg`'s reason one type over: getting it wrong is not an
 * error in the emitted code. `registry.set("score", "7")` compiles, runs, and
 * puts a string where every comparison below it expects a number, which is the
 * one sort of mistake nobody sees until the game is in their hand.
 */
const variableLiteral = (value: VariableValue): string =>
  typeof value === 'number' ? num(value) : str(value);

/**
 * A frame as an argument: a quoted name for an atlas, a bare number for a grid.
 *
 * One helper rather than the same ternary at four call sites, because getting
 * it wrong is not a type error in the *emitted* code — `add.image(k, "2")` is
 * legal JavaScript that asks a sprite sheet for a frame called "2" and gets a
 * missing texture.
 */
const frameArg = (frame: number | string): string =>
  typeof frame === 'string' ? str(frame) : num(frame);

/**
 * A safe, unique JavaScript identifier derived from the object's name. Names in
 * the editor are free text — they can be blank, start with a digit, or repeat.
 */
function toIdentifier(name: string, used: Set<string>): string {
  let base = name
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr: string | undefined) =>
      chr ? chr.toUpperCase() : '',
    )
    .replace(/^[^a-zA-Z_$]+/, '');
  if (!base) base = 'object';
  base = base[0].toLowerCase() + base.slice(1);

  let candidate = base;
  let n = 2;
  while (used.has(candidate)) candidate = `${base}${n++}`;
  used.add(candidate);
  return candidate;
}

/** PascalCase class name for the scene, e.g. "main scene 2" -> "MainScene2". */
function toClassName(name: string): string {
  const parts = name.match(/[a-zA-Z0-9]+/g) ?? [];
  const joined = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return /^[a-zA-Z_$]/.test(joined) ? joined || 'GeneratedScene' : `Scene${joined}`;
}

/**
 * Each scene's class name and Phaser key, both made unique.
 *
 * Scene names are free text and the editor does not force them apart across a
 * whole project, so two scenes may well be called the same thing — and each
 * name reaches the output twice over, as a class declaration and as the string
 * handed to `super()`. A repeat is fatal in both: two `class Main` in one module
 * will not parse, and two scenes registered under one key has Phaser's manager
 * refuse the second and a `scene.start` reach whichever it kept.
 *
 * The class names come out of the *module's* identifier set before anything
 * else draws from it, the rule the prefab factories already follow and for the
 * same reason: a prefab called "main scene" must not bind the name a class
 * declaration up the file has already taken.
 */
interface UsedScene {
  scene: SceneDoc;
  className: string;
  /** What `super(...)` registers it as, and what `scene.start` names. */
  key: string;
}

function collectScenes(project: Project, moduleNames: Set<string>): UsedScene[] {
  const keys = new Set<string>();
  return project.scenes.map((scene) => ({
    scene,
    className: uniqueClassName(scene.name, moduleNames),
    key: uniqueKey(scene.name, keys),
  }));
}

function uniqueClassName(name: string, used: Set<string>): string {
  const base = toClassName(name);
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) candidate = `${base}${n++}`;
  used.add(candidate);
  return candidate;
}

/**
 * A factory function name for each prefab the scene actually places, in use
 * order.
 *
 * This is what makes an export of twenty coins twenty lines instead of twenty
 * copies of a coin: the definition is emitted once as a function, and each
 * instance is a call. Only placed prefabs are emitted, for the reason only
 * referenced assets are — an export should not carry a definition the user
 * built and then removed from the scene.
 *
 * The names are allocated out of the *module's* identifier set, the same one
 * every object binding draws from, so a prefab called "coin" and an object
 * called "create coin" cannot both become `createCoin` and have the instance's
 * call reach the wrong one.
 */
interface UsedPrefab {
  prefab: Prefab;
  fn: string;
}

function collectPrefabs(
  project: Project,
  scenes: SceneDoc[],
  moduleNames: Set<string>,
): Map<string, UsedPrefab> {
  const used = new Map<string, UsedPrefab>();

  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'instance' && node.props.prefabId && !used.has(node.props.prefabId)) {
        const prefab = findPrefab(project, node.props.prefabId);
        // A dangling reference is possible in a hand-edited file, and is what
        // `constructorFor` turns into a comment rather than a broken call.
        if (prefab) {
          used.set(prefab.id, {
            prefab,
            fn: toIdentifier(`create ${prefab.name}`, moduleNames),
          });
        }
      }
      walk(node.children);
    }
  };
  // Every scene, into one table: the factories are module-level, so two scenes
  // placing the same prefab share one function rather than emitting a copy
  // each. That is the same "one definition, many placements" property inside a
  // file that the prefab itself is, one level up.
  for (const scene of scenes) walk(scene.children);

  // And the prefabs the *rules* build, which no node walk can reach.
  //
  // **After the whole node walk, never interleaved with it**, and that ordering
  // is the sharp thing in this feature rather than a tidiness. These names come
  // out of `moduleNames` *before* the fifteen helper names below them, and
  // `toIdentifier` suffixes a clash — so a name drawn earlier moves the suffix
  // some later helper was given, and four of those are asserted by name in the
  // suite. Running last means every prefab an existing project already places
  // keeps the exact identifier it had, and such a project exports byte for byte
  // what it exported before.
  //
  // `scenes` rather than `project.scenes`: they are the same array for the one
  // caller there is today, and reaching past the parameter would look correct
  // and silently diverge for any other.
  for (const scene of scenes) {
    for (const prefabId of prefabsNamedByRules(project, scene)) {
      if (used.has(prefabId)) continue;
      const prefab = findPrefab(project, prefabId);
      // `rulesOf` has already dropped a spawn whose prefab is gone, so this is
      // the belt to that reader's braces — `collectAssets`' own treatment of a
      // clip whose asset did not survive the open.
      if (!prefab) continue;
      used.set(prefab.id, {
        prefab,
        fn: toIdentifier(`create ${prefab.name}`, moduleNames),
      });
    }
  }
  return used;
}

/**
 * Every node the export will actually emit, scene nodes and the contents of
 * every placed definition alike.
 *
 * `collectAssets` and `collectAnimations` both read this rather than walking
 * the scene themselves: a prefab full of sprites has to load its textures, and
 * without the descent those sprites would each export the "no image chosen"
 * comment for an image that *is* chosen — a plausible-looking export that draws
 * nothing. Definitions cannot nest (see `prefabChildrenOf`), so one level of
 * descent is all of them — and `withoutInstances` is what makes that true here
 * rather than merely likely, `buildFactories` going through it for the same
 * reason.
 *
 * Since iteration 34 a prefab can also be reached by a **rule** rather than by
 * a node, and this is the one place that has to learn about it: all six callers
 * — `collectAssets`, `collectFonts`, `collectAnimations`, `usedIn`,
 * `collectTilemaps` and `collectLabels` — read this rather than walking a scene
 * themselves, so every one of them inherits a spawned prefab's contents with no
 * edit of its own. Said out loud because on that list "already covered" and
 * "forgotten" read identically. (Contrast `animationsNamedByRules`, which needs
 * a pass in *two* collectors precisely because a clip is not a list of nodes.)
 */
function emittedNodes(
  project: Project,
  scene: SceneDoc,
  prefabs: Map<string, UsedPrefab>,
): GameObjectNode[][] {
  const bodies: GameObjectNode[][] = [scene.children];
  const seen = new Set<string>();
  const add = (entry: UsedPrefab | undefined) => {
    if (!entry || seen.has(entry.prefab.id)) return;
    seen.add(entry.prefab.id);
    bodies.push(withoutInstances(entry.prefab.children));
  };
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      const id = node.type === 'instance' ? node.props.prefabId : null;
      add(id ? prefabs.get(id) : undefined);
      walk(node.children);
    }
  };
  walk(scene.children);
  for (const prefabId of prefabsNamedByRules(project, scene)) {
    add(prefabs.get(prefabId));
  }
  return bodies;
}

/**
 * Whether anything this export emits is a text node bound to a live variable.
 *
 * Through `emittedNodes` rather than a walk of `project.scenes`, which is
 * `collectAssets`' and `collectAnimations`' route and for their reason: a
 * labelled text node can sit inside a placed prefab definition, and a helper
 * gate that missed one would emit the call and not the function it calls.
 *
 * The variable table is the same unfiltered `collectVariables` the emit reads,
 * so a dangling label answers false here exactly as it emits nothing there — a
 * helper is never carried into a file with nothing to call it.
 */
function collectLabels(
  // The `project` is `emittedNodes`' and nothing else here reads it — and it is
  // load-bearing rather than a parameter carried along. Without it this gate
  // cannot see inside a prefab that is only *spawned*, so a definition holding
  // a labelled text child would have `buildFactories` emit a `bindLabel(...)`
  // call inside its factory while this answered false and the helper was never
  // declared. That is precisely the failure the paragraph above names: the gate
  // that missed one emits the call and not the function it calls.
  project: Project,
  scenes: SceneDoc[],
  prefabs: Map<string, UsedPrefab>,
  variables: Map<string, UsedVariable>,
): boolean {
  const walk = (nodes: GameObjectNode[]): boolean =>
    nodes.some(
      (node) =>
        (node.type === 'text' &&
          node.props.label !== undefined &&
          variables.has(node.props.label.variableId)) ||
        walk(node.children),
    );
  return scenes.some((scene) => emittedNodes(project, scene, prefabs).some(walk));
}

/**
 * Whether anything the file emits carries a visual effect.
 *
 * `collectLabels`' shape and its `project` for its reason: without it this gate
 * cannot see inside a prefab that is only *spawned*, so a definition holding a
 * glowing child would have `buildFactories` emit the attach call while this
 * answered false and the helper was never declared — the gate that missed one
 * emitting the call and not the function it calls.
 *
 * A boolean rather than a `Map`, unlike every `collect*` above it, because
 * there is nothing here to *name*: what an effect needs from a table it reads
 * back out of one `collectAssets` already built, so this adds no entry to the
 * output and no identifier to any set. That stayed true when masks arrived in
 * iteration 40 — a mask points at a texture, but at one some other collector is
 * already responsible for naming. On that checklist a collector with no `Used…`
 * beside it reads exactly like a missed step, which is why it says so.
 */
function collectEffects(
  project: Project,
  scenes: SceneDoc[],
  prefabs: Map<string, UsedPrefab>,
  // The asset table, so this gate asks the same question `emitNode` asks rather
  // than a looser one. Since iteration 40 an effect can answer with *no call* —
  // a mask naming an image the file does not load — so "this node has effects"
  // and "this node emits an effect call" stopped being the same statement, and
  // a gate on the first would declare a helper nothing in the file calls.
  assets: Map<string, UsedAsset>,
): boolean {
  const walk = (nodes: GameObjectNode[]): boolean =>
    nodes.some(
      (node) =>
        effectsOf(node).some((effect) => effectCallFor(effect, assets) !== null) ||
        walk(node.children),
    );
  return scenes.some((scene) => emittedNodes(project, scene, prefabs).some(walk));
}

/**
 * A texture key for each image the scene actually uses, in use order.
 *
 * Only referenced assets are emitted: an export should not carry a megabyte of
 * an image the user imported and then deleted from the scene. Keys come from
 * the file name so the generated `this.load.image('player', ...)` reads like
 * hand-written Phaser rather than like a list of UUIDs.
 */
interface UsedAsset {
  asset: ImageAsset;
  key: string;
}

function collectAssets(
  project: Project,
  scenes: SceneDoc[],
  prefabs: Map<string, UsedPrefab>,
): Map<string, UsedAsset> {
  const used = new Map<string, UsedAsset>();
  const keys = new Set<string>();

  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      // A tilemap's tileset is an image the file has to load exactly as a
      // sprite's is — and only a *sliced* one, because an unsliced image is not
      // a tileset and its map emits a comment rather than a layer. Loading it
      // anyway would ship bytes for a texture nothing then draws.
      //
      // An emitter's particle texture is collected unconditionally, unlike a
      // tileset: an unsliced image is a perfectly good one-frame particle, so
      // there is nothing here for a grid to gate. Leaving emitters out is the
      // failure worth naming — an export that boots, runs, and throws
      // missing-texture squares.
      //
      // A panel and a tile sprite go the emitter's way rather than the
      // tileset's, and for the same reason: frame 0 of a one-frame texture is
      // the whole picture, which is a perfectly good source for either.
      const assetId =
        node.type === 'sprite' ||
        node.type === 'particles' ||
        node.type === 'nineslice' ||
        node.type === 'tileSprite' ||
        (node.type === 'tilemap' && frameGridOf(findAsset(project, node.props.assetId)))
          ? node.props.assetId
          : null;
      // A mask's image, which is the one use of one that is not keyed on the
      // node's type at all: `fx` is on the base node, so any of the ten types
      // can carry one. Collected unconditionally, the emitter's and the
      // panel's reasoning rather than the tileset's — there is no cut for a
      // grid to gate, since `Mask.setTexture` samples the whole image's
      // `glTexture` whatever frame is named.
      const maskIds = effectsOf(node).flatMap((effect) =>
        effect.kind === 'mask' && effect.assetId ? [effect.assetId] : [],
      );

      for (const maskId of [...(assetId ? [assetId] : []), ...maskIds]) {
        if (used.has(maskId)) continue;
        const asset = findAsset(project, maskId);
        // A sprite can point at an image that is no longer in the table only in
        // a hand-edited file; the editor clears those references itself.
        if (asset) {
          // Strip the extension first: "player.png" should key as "player".
          used.set(asset.id, {
            asset,
            key: toIdentifier(asset.name.replace(/\.[^.]+$/, ''), keys),
          });
        }
      }
      walk(node.children);
    }
  };
  // One table for the whole file, keyed across every scene: the `ASSETS` const
  // is module-level, so two scenes using one image must agree on its key. Two
  // *different* images sharing a file name are exactly the case that decides
  // it — collected per scene they would each take the key "coin" in their own
  // pass and overwrite each other in the shared literal.
  for (const scene of scenes) {
    for (const nodes of emittedNodes(project, scene, prefabs)) walk(nodes);
    // And the images behind the clips the *rules* name, which no node walk can
    // reach: a `playAnimation` action can name a clip whose sheet nothing in
    // the scene draws. Without this the asset has no key, so
    // `collectAnimations` cannot resolve one and drops the clip — and the
    // export then plays an animation nothing registered.
    for (const id of animationsNamedByRules(project, scene)) {
      const clip = findAnimation(project, id);
      const asset = clip ? findAsset(project, clip.assetId) : undefined;
      if (asset && !used.has(asset.id)) {
        used.set(asset.id, {
          asset,
          key: toIdentifier(asset.name.replace(/\.[^.]+$/, ''), keys),
        });
      }
    }
  }
  return used;
}

/**
 * The image table, as an object literal keyed by texture key.
 *
 * Emitted as a named const rather than inlined into each `load.image` call so
 * that the one thing an exported file's reader is most likely to want to change
 * — swapping embedded bytes for real asset paths — is a single object at the
 * top, not a data URL buried in the middle of `preload`.
 */
function buildAssetTable(used: Map<string, UsedAsset>, indent: string): string {
  const lines = [
    '/**',
    ' * Images from the editor, embedded so this file needs nothing alongside it.',
    ' * To serve them as real files instead, replace each value with its path.',
    ' */',
    'const ASSETS = {',
    ...[...used.values()].map(({ asset, key }) => `  ${str(key)}: ${str(asset.dataUrl)},`),
    '};',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The frame data for every atlas-cut image in the file, in Phaser's own JSON
 * Hash shape.
 *
 * A named const beside `ASSETS` for `ASSETS`' reason and `TILEMAPS`': the bytes
 * and the cuts are the two things a reader swaps for real files, and both are
 * one object to edit rather than a literal buried in a `preload` line. It is
 * keyed by the same texture key the image is, so the two rows line up.
 *
 * Built through `atlasDataOf`, which is also what the editor's own
 * `textures.addAtlas` is handed — one builder, so the canvas and the export
 * cannot come to disagree about where a frame is. That is `textStyleOf`'s
 * two-consumer argument, and here it is the sharper one, because a
 * disagreement about pixel coordinates is invisible in both outputs until
 * somebody looks at the game.
 *
 * One line per frame rather than one blob, because an atlas can carry hundreds
 * and a diff of a re-packed atlas should be readable. `JSON.stringify` writes
 * each record, so a frame name is quoted by exactly the rule `str` follows and
 * the whole thing still goes through `escapeForScriptTag` on the way into the
 * runnable page.
 */
function buildAtlasTable(used: Map<string, UsedAsset>, indent: string): string {
  const rows: string[] = [];
  for (const { asset, key } of used.values()) {
    const frames = atlasOf(asset);
    if (!frames) continue;
    rows.push(`  ${str(key)}: {`);
    rows.push('    frames: {');
    for (const [name, entry] of Object.entries(atlasDataOf(frames).frames)) {
      rows.push(`      ${str(name)}: ${JSON.stringify(entry)},`);
    }
    rows.push('    },');
    rows.push('  },');
  }

  const lines = [
    '/**',
    ' * Texture atlases from the editor: which named frame sits where in each',
    ' * image. To load a real atlas file instead, replace a value with its path.',
    ' */',
    'const ATLASES = {',
    ...rows,
    '};',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/** Whether any image the file loads is cut by an atlas rather than a grid. */
function hasAtlasIn(used: Map<string, UsedAsset>): boolean {
  return [...used.values()].some(({ asset }) => atlasOf(asset) !== null);
}

/**
 * A cache key for each sound some scene registers, in use order.
 *
 * `collectAssets`' sibling, with two differences that each look like an
 * omission beside it. There is no traversal, because a sound belongs to a
 * scene rather than to an object; and there is no descent into prefab
 * definitions, because a definition holds nodes and a sound is not one — where
 * `collectAssets` not descending was a real bug that exported a prefab full of
 * sprites with no textures, here there is nowhere for one to hide.
 *
 * The keys come out of a `keys` set of its own rather than the images', which
 * matters and would have read as tidier the other way. Textures and sounds live
 * in different caches, so a project holding `coin.png` and `coin.wav` should get
 * `'coin'` twice; one shared set would silently rename whichever came second,
 * and the key is the string a person types into `this.sound.play(...)` by hand.
 */
interface UsedAudio {
  audio: AudioAsset;
  key: string;
}

/**
 * The key one sound plays by, on its own — for the panel row that shows the
 * user what to type into a `play()` call.
 *
 * Exported so that the row and the export cannot disagree about it. A second
 * implementation in the UI would be two answers to one question, and this is
 * the one question in the file whose answer a person copies out by hand.
 * Without the de-duplication a table does, since a row is shown one at a time.
 */
export const audioKeyOf = (name: string): string =>
  toIdentifier(name.replace(/\.[^.]+$/, ''), new Set());

function collectAudio(project: Project, scenes: SceneDoc[]): Map<string, UsedAudio> {
  const used = new Map<string, UsedAudio>();
  const keys = new Set<string>();
  for (const scene of scenes) {
    for (const sound of soundsOf(project, scene)) {
      if (used.has(sound.audioId)) continue;
      const asset = findAudio(project, sound.audioId);
      // `soundsOf` has already dropped a row naming a sound the project does
      // not hold, so this cannot miss — kept because the alternative is a
      // non-null assertion, and a table built from a document should not need
      // one.
      if (asset) {
        used.set(asset.id, {
          audio: asset,
          // Strip the extension first: "jump.wav" should key as "jump".
          key: toIdentifier(asset.name.replace(/\.[^.]+$/, ''), keys),
        });
      }
    }
  }
  return used;
}

/**
 * The sound table, `ASSETS`' sibling and a named const for its reason: the one
 * thing a reader is most likely to want to change — swapping embedded bytes for
 * real asset paths — should be one object at the top of the file.
 */
function buildAudioTable(used: Map<string, UsedAudio>, indent: string): string {
  const lines = [
    '/**',
    ' * Sounds from the editor, embedded so this file needs nothing alongside it.',
    ' * To serve them as real files instead, replace each value with its path.',
    ' */',
    'const AUDIO = {',
    ...[...used.values()].map(({ audio, key }) => `  ${str(key)}: ${str(audio.dataUrl)},`),
    '};',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * One variable, paired with the registry key it is read and written by.
 *
 * `UsedAudio`'s shape and for its reason: the key is *derived here* from free
 * user text, so a wrapper is what carries the derivation beside the thing.
 * The keys come out of a set of their own rather than any other table's,
 * exactly as the sounds' do — a registry key and a texture key live in
 * different namespaces, so a project holding an image called `score` and a
 * variable called `score` should get `'score'` twice.
 */
interface UsedVariable {
  variable: ProjectVariable;
  key: string;
}

/**
 * Every variable's registry key, by id — for the panel rows that show the user
 * what a hand-written line would have to say.
 *
 * `audioKeyOf`'s sibling, exported for its reason: the row and the export must
 * not disagree about it, and a second implementation in the UI would be two
 * answers to one question.
 *
 * **It answers for the whole table where `audioKeyOf` answers for one name, and
 * that difference is the point rather than an inconsistency.** An audio row can
 * afford to show an un-de-duplicated key because a key that collides is a
 * *second sound* that does not play — visibly wrong, and recoverable by
 * renaming the file. Two variables deriving one registry key is a value
 * silently shared at runtime: both rows go on showing their own number while
 * the game keeps one, and the row being edited may not be the one a rule reads.
 * The suffix is the only thing on screen that can say so, so the panel has to
 * be shown the de-duplicated answer, which means it has to be shown all of
 * them at once. `atlasOf`'s uniqueness argument, one table over.
 */
export function variableKeysOf(project: Project): Map<string, string> {
  const keys = new Map<string, string>();
  for (const [id, entry] of collectVariables(project)) keys.set(id, entry.key);
  return keys;
}

/**
 * Every variable the project declares, keyed by id.
 *
 * **Unfiltered, where `collectAssets` and `collectAudio` both emit only what a
 * scene uses** — and that difference is deliberate rather than a missed step,
 * which is why it says so here. Those two are filtered because bytes are
 * expensive and an unused image would ship a megabyte for nothing. A variable
 * is three tokens; and more to the point it exists *so that a hand-written line
 * can read it*, which is `mass` and `immovable`'s reason for being emitted when
 * nothing this exporter generates reads them.
 */
function collectVariables(project: Project): Map<string, UsedVariable> {
  const used = new Map<string, UsedVariable>();
  const keys = new Set<string>();
  for (const variable of project.variables) {
    used.set(variable.id, { variable, key: toIdentifier(variable.name, keys) });
  }
  return used;
}

/**
 * The variable table, `ASSETS`' and `AUDIO`'s sibling and a named const for
 * their reason: the numbers a reader is most likely to want to change belong in
 * one object at the top of the file rather than scattered through `create()`.
 */
function buildVariableTable(used: Map<string, UsedVariable>, indent: string): string {
  const lines = [
    '/**',
    ' * The numbers and the text the game keeps. Read one anywhere with',
    " * `this.registry.get('name')`, and change one with `set` or `inc`.",
    ' */',
    'const VARIABLES = {',
    ...[...used.values()].map(
      ({ variable, key }) => `  ${str(key)}: ${variableLiteral(variable.value)},`,
    ),
    '};',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/** Whether any variable in the table holds text, which widens the `.ts` signature. */
function textedVariables(used: Map<string, UsedVariable>): boolean {
  return [...used.values()].some(({ variable }) => typeof variable.value === 'string');
}

/**
 * The one function every scene declares its variables through.
 *
 * The `has` guard is the whole of it, and it is `anims.exists`' guard and
 * `this.sound.get(key) ??`'s for the third time: `create()` runs again every
 * time a scene starts, and `scene.start` is one of the things a rule can do —
 * so an unguarded `set` would reset the score on every change of level, which
 * would make the registry (the one store that survives a scene change) do
 * exactly nothing for the one job it is here for.
 *
 * It is also the strictly more expressive choice, which is what settles it
 * rather than taste. The document can already say "zero this when the level
 * starts", because `sceneStart -> setVar` is two things it already holds.
 * Unguarded, there would be no way for it to say *don't* — `wordWrapWidth: 0`'s
 * "the one target the user could not express", inverted.
 *
 * `Object.keys` rather than a printed list of `set` calls, so that a project
 * with forty variables is one loop rather than forty lines — and so the table
 * above stays the only place the names appear.
 *
 * The `.ts` signature widens to `number | string` **only when something in the
 * table is text**, which is the byte-for-byte rule the asset table, the tilemap
 * helper and the prefab factories all follow: a project written before a
 * variable could hold text exports the line it always exported. It is not a
 * question of what compiles — the wider type accepts both — but of a diff
 * nobody asked for.
 */
function buildVariableHelper(
  fn: string,
  language: SceneLanguage,
  indent: string,
  texted: boolean,
): string {
  const typed = language === 'ts';
  const type = texted ? 'Record<string, number | string>' : 'Record<string, number>';
  const signature = typed
    ? `function ${fn}(scene: Phaser.Scene, values: ${type}): void {`
    : `function ${fn}(scene, values) {`;
  const lines = [
    signature,
    '  for (const key of Object.keys(values)) {',
    '    if (!scene.registry.has(key)) scene.registry.set(key, values[key]);',
    '  }',
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The one function every `keyDown` rule listens through.
 *
 * It exists for exactly one reason: `scene.input.keyboard` is
 * `KeyboardPlugin | null` under `--strict`, and the `create()` body is the same
 * plain JavaScript in the `.ts`, the `.js` and the runnable page — so it can
 * carry no `!`, no cast and no annotation. `arcadeBody`'s argument to the
 * character, one plugin over. The existing narrowing in `buildKeyboardLines`
 * cannot be reused because it is gated on something being *driven*, and a rule
 * needs a keyboard whether or not anything has controls.
 *
 * The handler takes **no arguments**, and that is not a simplification. Phaser
 * types `EventEmitter#on`'s second parameter as the bare `Function`, which
 * provides no contextual typing at all — so a named parameter there is an
 * implicit `any` and fails the exported `.ts`. Every callback this feature
 * emits closes over the bindings above it instead, which is also the shape a
 * rule wants.
 */
function buildKeyHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(scene: Phaser.Scene, key: string, handler: () => void): void {`
    : `function ${fn}(scene, key, handler) {`;
  const lines = [
    signature,
    '  const keyboard = scene.input.keyboard;',
    "  if (keyboard) keyboard.on('keydown-' + key, handler);",
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The one function every `tap` rule is made pressable by.
 *
 * **A hit area built from the object at runtime, never from numbers this file
 * printed** — `buildFitHelper`'s argument, and it is what makes this a helper
 * rather than a per-type branch. A `text` node's size is measured against the
 * font when the game runs and the document does not know it; a nine-slice's and
 * a tile sprite's box is its own `width`/`height` while its *texture frame* is
 * something else entirely. One function reading `object.width` is right for all
 * six types at once, and there is nothing left for a printed number to hold.
 *
 * The rectangle is in **top-left-origin space for every type**, which is worth
 * stating because it looks wrong beside `applyContainerBounds`' half-size
 * shift. Phaser's `InputManager.pointWithinHitArea` adds `displayOriginX` back
 * to every point it tests, so a centred object and a top-left one take the same
 * rectangle. The editor's own `applyHitArea` already does exactly this.
 *
 * An ellipse gets a `Geom.Ellipse` rather than a box, so its corners are not
 * pressable — the editor's call for the same node type, and the difference is
 * visible on anything round enough to aim at.
 *
 * `pointerdown` and never `pointerup`: a finger that slides off an object never
 * fires `pointerup` on it, which is the touch helper's own recorded trap, and
 * "tap" is what the document says.
 */
function buildTapHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(\n  object: Phaser.GameObjects.Shape | Phaser.GameObjects.Sprite |\n    Phaser.GameObjects.Image | Phaser.GameObjects.Text |\n    Phaser.GameObjects.NineSlice | Phaser.GameObjects.TileSprite,\n  round: boolean,\n  handler: () => void,\n): void {`
    : `function ${fn}(object, round, handler) {`;
  const lines = [
    signature,
    '  const shape = round',
    '    ? new Phaser.Geom.Ellipse(object.width / 2, object.height / 2, object.width, object.height)',
    '    : new Phaser.Geom.Rectangle(0, 0, object.width, object.height);',
    '  const contains = round ? Phaser.Geom.Ellipse.Contains : Phaser.Geom.Rectangle.Contains;',
    '  object.setInteractive(shape, contains);',
    "  object.on('pointerdown', handler);",
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The one function every Matter `collide` rule watches through.
 *
 * Matter needs this where Arcade does not, and the reason is the inverse of the
 * one that makes `collidersOf` answer `[]` for a Matter scene. A collider *row*
 * is redundant under Matter because Matter already collides everything with
 * everything, so a row saying "these two meet" says nothing it has not done.
 * That argument does not transfer by a single word: "when these two touch, *do
 * this*" is something Matter does not do on its own at all. So this is the one
 * place a Matter scene needs more emitted code than an Arcade one — and
 * refusing it would be iteration 26's Controls-panel bug repeated on purpose.
 *
 * **Both pair orders are tested, and only a test that drops something can see
 * it.** Matter orders `bodyA` and `bodyB` by internal body id rather than by
 * the order anything was added, so a filter written one way round compiles,
 * runs, emits text that looks right, and fires on roughly half of all projects.
 * `matterGround`'s recorded lesson, one event over.
 *
 * The event parameter is annotated in the `.ts` and bare in the `.js`, which is
 * the existing `.ts`/`.js` difference — `buildGroundHelper`'s shape exactly —
 * and the whole reason this is a module-level function rather than an inline
 * listener: `world.on` is typed with the bare `Function`, so an inline
 * `(event) => …` inside `create()` is an implicit `any` the shared body has
 * nowhere to annotate.
 */
function buildMatterHitHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(\n  scene: Phaser.Scene,\n  a: Phaser.GameObjects.GameObject,\n  b: Phaser.GameObjects.GameObject,\n  handler: () => void,\n): void {`
    : `function ${fn}(scene, a, b, handler) {`;
  const param = typed
    ? 'event: Phaser.Physics.Matter.Events.CollisionStartEvent'
    : 'event';
  const lines = [
    signature,
    `  scene.matter.world.on('collisionstart', function (${param}) {`,
    '    for (const pair of event.pairs) {',
    '      const first = pair.bodyA.gameObject;',
    '      const second = pair.bodyB.gameObject;',
    '      if ((first === a && second === b) || (first === b && second === a)) {',
    '        handler();',
    '        return;',
    '      }',
    '    }',
    '  });',
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * How one variable's value reads, wherever the file puts it on screen.
 *
 * The one printed formatter, read by a bound label and by a `setText` that asks
 * for a format — so the two ways of showing a number cannot disagree about
 * whether the score is `7` or `007`. That is `textStyleOf`'s two-consumer rule
 * inside the emitted file rather than inside this one.
 *
 * It is also **the one builder in this codebase that genuinely has a copy**:
 * the generated game cannot import `formatVariable` from `src/core/schema.ts`,
 * so the editor's canvas runs that function and the exported game runs this
 * text. `cameraViewOf`'s "copies Phaser's arithmetic and has to stay copied",
 * arriving from the other side — and the answer to it is to leave nothing to
 * copy wrongly: two whole calls, `toFixed` and `padStart`, with no arithmetic
 * of our own and no sign handling to get right twice.
 *
 * `value` is `unknown` rather than `number | string`, because every call site
 * hands it `registry.get`, which answers `any` — and `String(value)` is legal
 * on `unknown` where `value.toFixed` would not be, which is what lets the
 * non-number branch come first and narrow the rest with no cast. The shared
 * `create()` body is plain JavaScript in all three outputs, so a cast is not
 * available to it at all.
 */
function buildLabelValueHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(value: unknown, decimals: number, pad: number): string {`
    : `function ${fn}(value, decimals, pad) {`;
  const lines = [
    signature,
    // A variable holding text is shown as it is: these two dials are about a
    // number, and padding a name to six characters is not a thing anyone asked
    // for. `formatVariable` says the same in the editor.
    "  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);",
    '  const shown = decimals >= 0 ? value.toFixed(decimals) : String(value);',
    "  return pad > 0 ? shown.padStart(pad, '0') : shown;",
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The one function a bound label follows its variable through.
 *
 * Three things in it are load-bearing and none is obvious.
 *
 * **It draws once before it subscribes**, because `initVariables` sets a key
 * that is absent and Phaser's `DataManager` emits `setdata-<key>` for a first
 * write and `changedata-<key>` only for a later one. A label that waited for
 * the event would sit showing its bare caption until the score first moved.
 * That first call is also what makes `constructorFor`'s `'text'` case need no
 * edit at all — the object is built with its caption and given the whole string
 * one line later.
 *
 * **The handler takes no arguments and re-reads the registry**, rather than
 * taking the `(parent, value, previous)` the event carries. `buildKeyHelper`'s
 * paragraph verbatim: Phaser types `EventEmitter#on`'s second parameter as the
 * bare `Function`, which gives a named parameter no contextual typing and makes
 * it an implicit `any` the exported `.ts` refuses. It also means the emitted
 * file depends on nothing about the event but its *name*.
 *
 * **And it unsubscribes on shutdown, which the tween deliberately does not.**
 * A Tween belongs to the scene's own manager and dies with it; the registry is
 * the *game's*, and a scene that starts another and comes back would otherwise
 * leave a listener holding a destroyed `Text` — so the next change to the score
 * throws, in the player's game, long after anything points at this line. The
 * `assetTextures` / `animationKeys` / `FontFace` bookkeeping rule, in emitted
 * code for the first time.
 */
function buildBindLabelHelper(
  fn: string,
  valueFn: string,
  language: SceneLanguage,
  indent: string,
): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(\n` +
      '  scene: Phaser.Scene,\n' +
      '  label: Phaser.GameObjects.Text,\n' +
      '  key: string,\n' +
      '  caption: string,\n' +
      '  decimals: number,\n' +
      '  pad: number,\n' +
      '): void {'
    : `function ${fn}(scene, label, key, caption, decimals, pad) {`;
  const lines = [
    ...signature.split('\n'),
    '  const show = () => {',
    `    label.setText(caption + ${valueFn}(scene.registry.get(key), decimals, pad));`,
    '  };',
    '  show();',
    "  scene.registry.events.on('changedata-' + key, show);",
    '  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {',
    "    scene.registry.events.off('changedata-' + key, show);",
    '  });',
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The one function every `varChange` rule listens through.
 *
 * It rides on `changedata-<key>`, which is the same moment `bindLabel` above
 * already subscribes to — **a moment Phaser delivers of its own accord**, which
 * is the whole of why this trigger is on the near side of the line iteration 28
 * drew and why `update()` gains nothing for it.
 *
 * Three facts about Phaser's `DataManager` shape this, and all three were read
 * out of `src/data/DataManager.js` rather than remembered:
 *
 * **`changedata-<key>` and never `setdata-<key>`.** A key's *first* write emits
 * `setdata` alone; every later one emits `changedata` and `changedata-<key>`.
 * The variable helper sets every key in `create()`'s prologue, above this, so a
 * rule listener is never in place for the first write — which is correct, since
 * a variable coming into existence is not a change to it and a `sceneStart`
 * rule is what a project uses to act at the boot.
 *
 * **A write of the value already there still emits.** There is no equality
 * check in `setValue` at all: `registry.set('score', 0)` on a score that is
 * already 0 fires this. That is a thing to know rather than a thing to fix — a
 * `setVar` is an instruction and the document says it happened.
 *
 * **And the emit is synchronous, inside `set`** — which is what makes the guard
 * below load-bearing rather than defensive. A rule that writes the variable it
 * watches would otherwise re-enter its own handler with no bottom: a stack
 * overflow in the player's game, on the first change. The flag is per listener,
 * so a cycle of any length terminates — rule A writes B, rule B writes A, and
 * A's handler finds its own flag still set and returns. `MIN_TIMER_DELAY`'s job
 * one trigger over: the whole protection against the one thing this vocabulary
 * can run away with.
 *
 * The guard lives here rather than in `rulesOf` on purpose. Refusing a
 * self-writing rule would cost the rule, and `addVar` on the watched variable is
 * a thing people legitimately write — a counter that clamps itself. This makes
 * it terminate; it does not make it unsayable.
 *
 * **And it unsubscribes on shutdown**, which matters more here than it does for
 * a label: the registry is the *game's*, and `restartScene` is one of this
 * vocabulary's own actions — so without this, every restart leaves another
 * listener behind holding bindings to objects that are gone.
 *
 * The handler takes **no arguments**, for `buildKeyHelper`'s reason to the
 * character: Phaser types `EventEmitter#on`'s second parameter as the bare
 * `Function`, so a named parameter there is an implicit `any` the exported `.ts`
 * refuses, and the `create()` body is the same plain JavaScript in all three
 * outputs and can carry no annotation.
 */
function buildOnVarHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(scene: Phaser.Scene, key: string, handler: () => void): void {`
    : `function ${fn}(scene, key, handler) {`;
  const lines = [
    signature,
    '  let busy = false;',
    '  const run = () => {',
    '    if (busy) return;',
    '    busy = true;',
    '    try {',
    '      handler();',
    '    } finally {',
    '      busy = false;',
    '    }',
    '  };',
    "  scene.registry.events.on('changedata-' + key, run);",
    '  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {',
    "    scene.registry.events.off('changedata-' + key, run);",
    '  });',
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * One effect, as the `FilterList` call that builds it.
 *
 * **Exhaustive with no `default`, which makes this the one compile error in the
 * whole feature.** Every other step — the renderer, the inspector, the store,
 * the gate — is silent, exactly as the whole of physics and cameras were, so
 * this switch is the only thing standing between a new effect kind and an
 * exporter quietly falling behind. `ruleActionLines`' arrangement, one union
 * over.
 *
 * Every call is a **prefix of Phaser's own argument list**, which is why
 * `NodeEffect` carries the dials it does: `addGlow` takes seven arguments and
 * stopping after the fourth means nothing is printed that the document does not
 * hold. The alternative is a dial in the middle, which would force a literal
 * for every argument before it.
 *
 * Emitted whole, defaults included — the emitter config's and the physics
 * body's rule rather than `modifiersFor`'s, because these dials only mean
 * anything beside each other: a glow's inner strength says nothing without its
 * outer one, and a shadow's decay nothing without its power. Here it is also
 * mechanical rather than chosen, as it was for the camera effects: these are
 * positional, so a later argument cannot be passed without an earlier one.
 */
function effectCallFor(
  effect: NodeEffect,
  assets: Map<string, UsedAsset>,
): string | null {
  switch (effect.kind) {
    case 'glow':
      return `addGlow(${hexLiteral(effect.color)}, ${num(effect.outerStrength)}, ${num(
        effect.innerStrength,
      )}, ${num(effect.scale)})`;
    case 'blur':
      return `addBlur(${num(effect.quality)}, ${num(effect.x)}, ${num(effect.y)}, ${num(
        effect.strength,
      )})`;
    case 'shadow':
      return `addShadow(${num(effect.x)}, ${num(effect.y)}, ${num(effect.decay)}, ${num(
        effect.power,
      )}, ${hexLiteral(effect.color)})`;
    case 'pixelate':
      return `addPixelate(${num(effect.amount)})`;
    case 'mask': {
      // The one kind that needs something the effect does not carry: a texture
      // *key*, which is `collectAssets`' answer to "what is this image called
      // across the file" rather than anything the node knows. So this function
      // takes the table — a **required parameter**, which the compiler names at
      // the one call site, so the `clampFrame` -> `resolveFrame` rename is not
      // needed here. That rule exists for a widened *return* type, which
      // compiles silently wherever it was not updated.
      //
      // A mask naming an image the table does not hold emits **no call at
      // all**, which is the renderer's "no usable texture, no pass" answered on
      // this side so the canvas and the export cannot disagree about a picture.
      // It is `missingReason`'s and the camera follow's treatment of a
      // reference that resolved to nothing.
      const used = effect.assetId ? assets.get(effect.assetId) : undefined;
      if (!used) return null;
      return `addMask(${str(used.key)}, ${effect.invert ? 'true' : 'false'})`;
    }
  }
}

/**
 * The narrowing an object's filter list needs, and the reason it is a function.
 *
 * `arcadeBody`'s situation to the character: Phaser declares
 * `readonly filters: FiltersInternalExternal | null`, so
 * `coin.filters.internal.addGlow(...)` does not compile under `--strict`. A cast
 * would fix that in TypeScript and be a *syntax error* in the runnable page,
 * whose `create()` body is the same plain JavaScript — and that shared body is
 * the property which stops the two outputs drifting, so it is not one to spend
 * here.
 *
 * It answers `null` rather than throwing, which is where it parts company with
 * `arcadeBody`: filters are **WebGL only** and `enableFilters` returns early
 * when the renderer has no `gl`, so a browser that cannot run them is a
 * legitimate thing for a player's to be. The object then draws plain — here and
 * on the editor's canvas alike, so the two still agree. An object with no body,
 * by contrast, is a bug worth naming.
 *
 * `internal` rather than `external`: an internal filter runs in the object's own
 * local space, so a glow on a turned object turns with it, and it is sized to
 * the object rather than to the screen.
 */
function buildEffectsHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const lines = [
    typed
      ? `function ${fn}(object: Phaser.GameObjects.GameObject): Phaser.GameObjects.Components.FilterList | null {`
      : `function ${fn}(object) {`,
    '  object.enableFilters();',
    '  return object.filters ? object.filters.internal : null;',
    '}',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * A font each scene draws some text in, by the family it is registered under.
 *
 * `collectAudio`' sibling, and **the one of the three tables with no `Used…`
 * wrapper**, which is worth saying because its absence looks like the step that
 * was skipped. `UsedAsset` and `UsedAudio` pair a thing with a `key`, because
 * an image's and a sound's key is *derived here* from a file name and lives
 * nowhere else — which is also why each gets an identifier set of its own, so
 * that `coin.png` and `coin.wav` can both key as `coin`. A font's key is its
 * stored `family`: chosen at import, unique across the table by `fontFamilyFor`,
 * and re-checked by `parseFonts` on the way in. Carrying it a second time beside
 * the asset would be two fields free to disagree about one string — and this is
 * the one string in the file that must not move, since `this.load.font`
 * registers the face under it and the text style beside it names it.
 */
function collectFonts(
  project: Project,
  scenes: SceneDoc[],
  prefabs: Map<string, UsedPrefab>,
): Map<string, FontAsset> {
  const used = new Map<string, FontAsset>();
  for (const scene of scenes) {
    for (const family of familiesIn(project, scene, prefabs)) {
      const font = fontByFamily(project, family);
      // `familiesIn` has already dropped a family the project does not hold, so
      // this cannot miss — kept because the alternative is a non-null assertion,
      // which is `collectAudio`'s call in the same position.
      if (font) used.set(font.family, font);
    }
  }
  return used;
}

/**
 * Every imported family the text in one scene asks for, definitions included.
 *
 * Shared by `collectFonts` and `usedIn` so the file-wide table and the
 * per-scene preload cannot disagree about which fonts a scene needs — the
 * `collectAssets`/`usedIn` pair written once instead of twice, because unlike
 * an image a font has no second question (what is it called) for the first half
 * to answer on its own.
 */
function familiesIn(
  project: Project,
  scene: SceneDoc,
  prefabs: Map<string, UsedPrefab>,
): Set<string> {
  const known = new Set(project.fonts.map((asset) => asset.family));
  const families = new Set<string>();
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        // Through the stack rather than the whole field: `Chunky, sans-serif`
        // asks for one imported font and one the browser already has.
        for (const family of fontStackOf(node.props.fontFamily)) {
          if (known.has(family)) families.add(family);
        }
      }
      walk(node.children);
    }
  };
  for (const nodes of emittedNodes(project, scene, prefabs)) walk(nodes);
  return families;
}

/**
 * The font table, `ASSETS`' and `AUDIO`' sibling and a named const for their
 * reason.
 */
function buildFontTable(used: Map<string, FontAsset>, indent: string): string {
  const lines = [
    '/**',
    ' * Fonts from the editor, embedded so this file needs nothing alongside it.',
    ' * To serve them as real files instead, replace each value with its path.',
    ' */',
    'const FONTS = {',
    ...[...used.values()].map((font) => `  ${str(font.family)}: ${str(font.dataUrl)},`),
    '};',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The body of `preload()`, or '' when the scene uses no images.
 *
 * Filtered to what *this* scene draws, out of a table built for the file: a
 * menu that loads the whole game's artwork is a menu that waits for it.
 *
 * A sheet loads through `load.spritesheet` with the document's own four
 * numbers, and an atlas through `load.atlas` with the document's own frames, so
 * the frames the exported game cuts are the frames the editor drew. A plain
 * image still loads through `load.image`, unchanged — emitting every image as a
 * one-frame sheet would work and would make every shape-only-plus-image export
 * differ from what it was for no gain.
 */
function buildPreloadBody(
  used: Map<string, UsedAsset>,
  ids: ReadonlySet<string>,
  audio: Map<string, UsedAudio>,
  audioIds: ReadonlySet<string>,
  fonts: Map<string, FontAsset>,
  fontFamilies: ReadonlySet<string>,
): string {
  const images = [...used.values()]
    .filter(({ asset }) => ids.has(asset.id))
    .map(({ asset, key }) => {
      const sheet = frameGridOf(asset);
      // An atlas loads through `load.atlas`, and its second argument is the
      // frame data *object* rather than a URL — Phaser's `AtlasJSONFile` takes
      // "a well formed JSON object" there and skips the fetch, which is what
      // lets the cuts ride inside this file exactly as the bytes already do.
      // It is the `load.font` shape one table over, and it is the whole reason
      // an atlas needed no second file and no boot-order question.
      if (!sheet && atlasOf(asset)) {
        return `    this.load.atlas(${str(key)}, ASSETS[${str(key)}], ATLASES[${str(key)}]);`;
      }
      if (!sheet) return `    this.load.image(${str(key)}, ASSETS[${str(key)}]);`;
      return (
        `    this.load.spritesheet(${str(key)}, ASSETS[${str(key)}], {\n` +
        `      frameWidth: ${num(sheet.frameWidth)},\n` +
        `      frameHeight: ${num(sheet.frameHeight)},\n` +
        `      margin: ${num(sheet.margin)},\n` +
        `      spacing: ${num(sheet.spacing)},\n` +
        `    });`
      );
    });

  // After the images, so a project that predates audio emits exactly the
  // `preload` it always did. One URL per key rather than Phaser's
  // array-of-fallbacks form: those exist so a game can ship an .ogg beside an
  // .mp3 for browsers that disagree, and there is one set of bytes here.
  const sounds = [...audio.values()]
    .filter((entry) => audioIds.has(entry.audio.id))
    .map(({ key }) => `    this.load.audio(${str(key)}, AUDIO[${str(key)}]);`);

  // After the sounds, so a project that predates fonts emits exactly the
  // `preload` it always did — the rule the sounds themselves followed.
  //
  // The `format` argument is not optional and is not defaulted: Phaser's own
  // default is `'truetype'`, so a WOFF2 left to it is refused by the browser
  // and the text falls back with only a console warning to say so. That is the
  // whole reason `fontFormatOf` sits beside the asset rather than being guessed
  // at either call site.
  //
  // The key is the family, which is what makes the `fontFamily` in the text
  // style a few lines below resolve at all — see `FontAsset`.
  const faces = [...fonts.values()]
    .filter((font) => fontFamilies.has(font.family))
    .map(
      (font) =>
        `    this.load.font(${str(font.family)}, FONTS[${str(font.family)}], ` +
        `${str(fontFormatOf(font.mimeType))});`,
    );

  return [...images, ...sounds, ...faces].join('\n');
}

/**
 * A clip for each animation the scene actually plays, keyed by the name the
 * user gave it.
 *
 * Only played clips are emitted, for the reason only referenced images are: an
 * export should carry the scene, not the editor's whole workbench. Keys are the
 * clip names de-duplicated — an animation key is a plain string rather than an
 * identifier, so the user's own "walk" survives verbatim, but two clips sharing
 * a name would have Phaser's manager warn and keep only the first.
 */
interface UsedAnimation {
  clip: AnimationClip;
  /** True when the clip's asset is cut by an atlas, so its frames are names. */
  named: boolean;
  key: string;
  /** The texture key its frames are read from. */
  textureKey: string;
}

function collectAnimations(
  project: Project,
  scenes: SceneDoc[],
  assets: Map<string, UsedAsset>,
  prefabs: Map<string, UsedPrefab>,
): Map<string, UsedAnimation> {
  const used = new Map<string, UsedAnimation>();
  const keys = new Set<string>();

  // Only a sprite, and that is a fact about Phaser rather than a list that
  // could go stale: a `NineSlice` and a `TileSprite` carry no AnimationState, so
  // neither can play a clip and neither has an `animationId` to find. The same
  // is why `usedIn`'s animation half gained nothing for them.
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'sprite' && node.props.animationId && !used.has(node.props.animationId)) {
        const clip = findAnimation(project, node.props.animationId);
        // A sprite can name a clip that is not in the table, or one whose sheet
        // is not in this scene, only in a hand-edited file: the editor removes
        // the references itself, and the parser drops a clip whose asset is
        // gone. Either way there is nothing to emit.
        const entry = clip ? assets.get(clip.assetId) : undefined;
        if (clip && entry) {
          used.set(clip.id, {
            clip,
            key: uniqueKey(clip.name, keys),
            textureKey: entry.key,
            // Which generator the clip needs is a fact about the *asset's* cut,
            // not about the entries in the list: a clip names one asset and an
            // asset is cut one way, so this is settled once here rather than
            // sniffed per frame where a hand-edited file could make it
            // disagree with itself halfway down the array.
            named: atlasOf(entry.asset) !== null,
          });
        }
      }
      walk(node.children);
    }
  };
  // And the clips the rules name, which no node walk can find: a
  // `playAnimation` action names a clip the sprite itself may never have been
  // given. Missing this emits `sprite.play('walk')` under a key nothing
  // registered, which is a warning and a sprite that never moves.
  const fromRules = (scene: SceneDoc) => {
    for (const id of animationsNamedByRules(project, scene)) {
      if (used.has(id)) continue;
      const clip = findAnimation(project, id);
      const entry = clip ? assets.get(clip.assetId) : undefined;
      if (clip && entry) {
        used.set(clip.id, {
          clip,
          key: uniqueKey(clip.name, keys),
          textureKey: entry.key,
          named: atlasOf(entry.asset) !== null,
        });
      }
    }
  };

  // Across every scene, so that the key a clip gets is the key it has in the
  // whole file — an animation is registered on the game's manager, which no
  // more belongs to one scene than the texture manager does.
  for (const scene of scenes) {
    for (const nodes of emittedNodes(project, scene, prefabs)) walk(nodes);
    fromRules(scene);
  }
  return used;
}

/**
 * What one scene draws out of those file-wide tables: the images it has to
 * preload, and the clips it has to register before anything plays them.
 *
 * Split from the collection rather than folded into it because the two answer
 * different questions. The tables decide what each thing is *called*, which has
 * to be settled once for the file; this decides what belongs in one scene's
 * `preload` and `create`, and a scene that registered a clip over a texture it
 * never loaded would throw in `generateFrameNumbers` before drawing anything.
 * The sounds are here for the same reason and a sharper version of it: see the
 * comment on the audio set below.
 */
function usedIn(
  project: Project,
  scene: SceneDoc,
  prefabs: Map<string, UsedPrefab>,
): {
  assets: Set<string>;
  animations: Set<string>;
  audio: Set<string>;
  fonts: Set<string>;
} {
  const assets = new Set<string>();
  const animations = new Set<string>();
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'sprite') {
        if (node.props.assetId) assets.add(node.props.assetId);
        if (node.props.animationId) animations.add(node.props.animationId);
      }
      // The other half of the pair: `collectAssets` decides what the texture is
      // called across the file, this decides what *this* scene preloads. A
      // tilemap or an emitter missing from either is built on a texture the
      // scene never loaded, which throws before anything is drawn.
      if (
        (node.type === 'tilemap' ||
          node.type === 'particles' ||
          node.type === 'nineslice' ||
          node.type === 'tileSprite') &&
        node.props.assetId
      ) {
        assets.add(node.props.assetId);
      }
      // And a mask's image, on any node type — `collectAssets`' new branch
      // answered on this side. Missing it here is the worse half of the pair:
      // the texture keeps its file-wide name, so the emitted `addMask` names a
      // key the scene never preloaded, and Phaser's `getFrame` answers null —
      // a mask that silently does nothing, which is an export that looks almost
      // right rather than one that plainly is not.
      for (const effect of effectsOf(node)) {
        if (effect.kind === 'mask' && effect.assetId) assets.add(effect.assetId);
      }
      walk(node.children);
    }
  };
  for (const nodes of emittedNodes(project, scene, prefabs)) walk(nodes);

  // A read rather than a traversal, which is the shape of the feature and not a
  // shortcut: a sound belongs to the scene, so there is no node to walk into.
  // Getting this half wrong is worse than getting the image half wrong — a
  // texture a scene never loaded draws a missing-texture square, while
  // `sound.add` on a key the cache does not hold *throws*, inside `create()`,
  // before a single object has been added.
  const audio = new Set(soundsOf(project, scene).map((sound) => sound.audioId));

  // A walk, where the sounds beside it are a read — a text node can sit inside
  // a prefab definition exactly as a sprite can, so this half has the images'
  // shape rather than the audio's. Missing it exports a scene whose text is
  // drawn in a font the page never loaded, which is the failure this whole
  // iteration exists to remove and would look identical to it.
  const fonts = familiesIn(project, scene, prefabs);

  // The other half of `collectAnimations`' rule pass, and both are needed for
  // the pair's usual reason: that one decides what a clip is *called* across
  // the file, this decides what *this* scene registers before anything plays
  // it. A clip registered nowhere makes `anims.play` a warning; a clip
  // registered over a texture this scene never loaded throws in
  // `generateFrameNumbers` before a single object is drawn — so the asset goes
  // in beside it.
  for (const id of animationsNamedByRules(project, scene)) {
    const clip = findAnimation(project, id);
    if (!clip) continue;
    animations.add(id);
    assets.add(clip.assetId);
  }

  return { assets, animations, audio, fonts };
}

/**
 * A name not already used, kept as the user wrote it wherever possible.
 *
 * Unlike `toIdentifier` this does not have to produce valid JavaScript — an
 * animation key is a string literal — so the only thing it enforces is
 * uniqueness, and a blank name still needs *something* to be called.
 */
function uniqueKey(name: string, used: Set<string>): string {
  const base = name.trim() || 'animation';
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) candidate = `${base} ${n++}`;
  used.add(candidate);
  return candidate;
}

/**
 * The `anims.create` calls, which have to run before anything plays one.
 *
 * Guarded by `anims.exists`, because an animation belongs to the *game* while
 * `create()` belongs to a scene and may run more than once against it: two
 * scenes playing the same clip both need it registered, and a scene restarted
 * — the ordinary way a game returns to its menu — runs this a second time. An
 * unguarded second `anims.create` under a key the manager already has is
 * refused with a warning, so the guard costs a line and buys a clean console
 * in both cases.
 */
function buildAnimationLines(
  used: Map<string, UsedAnimation>,
  ids: ReadonlySet<string>,
): string[] {
  const lines: string[] = [];
  for (const { clip, key, textureKey, named } of used.values()) {
    if (!ids.has(clip.id)) continue;
    lines.push(`if (!this.anims.exists(${str(key)})) {`);
    lines.push('  this.anims.create({');
    lines.push(`    key: ${str(key)},`);
    // An explicit list rather than a start and an end, either way the image is
    // cut: the document stores a list, and a list is what expresses a sequence
    // that repeats or runs backwards — a ping-pong is [0, 1, 2, 1].
    //
    // A grid keeps `generateFrameNumbers`, unchanged to the character, so every
    // export that predates atlases is byte for byte what it was.
    //
    // An atlas emits the frames themselves, and **`generateFrameNames` is not
    // usable here even though it is the obvious call**. Its runtime does the
    // right thing — `prefix + Pad(frame, 0) + suffix` leaves a name alone — but
    // Phaser's own type for its config declares `frames?: boolean | number[]`,
    // so the exported `.ts` does not compile under `--strict`, and the shared
    // `create()` body has nowhere to put a cast. `Types.Animations.AnimationFrame`
    // is `{ key, frame: string | number }`, which `anims.create` takes directly
    // — and it is exactly what `EditorScene.syncAnimations` already builds, so
    // the two halves of this feature now say the same thing the same way.
    // Only `export-toolchain.spec.ts` could have found this.
    if (named) {
      lines.push('    frames: [');
      for (const frame of clip.frames) {
        lines.push(`      { key: ${str(textureKey)}, frame: ${frameArg(frame)} },`);
      }
      lines.push('    ],');
    } else {
      lines.push(
        `    frames: this.anims.generateFrameNumbers(${str(textureKey)}, ` +
          `{ frames: [${clip.frames.join(', ')}] }),`,
      );
    }
    lines.push(`    frameRate: ${num(clip.frameRate)},`);
    lines.push(`    repeat: ${num(clip.repeat)},`);
    lines.push('  });');
    lines.push('}');
    lines.push('');
  }
  return lines;
}

/**
 * What the emitter needs to know that is not the node.
 *
 * Bundled rather than passed as five parameters because of `receiver`: the same
 * emit runs once inside a Scene method, where objects are added to `this`, and
 * once inside a prefab factory, where they are added to the `scene` it was
 * handed. One generator, two receivers — a second copy of the emitter for the
 * factory case is exactly the drift that having `buildCreateBody` shared
 * between the module and the runnable page exists to prevent.
 */
/**
 * The tilemaps the export will actually build, keyed by node id.
 *
 * A tilemap is emitted only when its tileset is an image the file is already
 * loading *and* that image has been sliced, which is the same pair of
 * conditions the canvas draws one under. An unsliced image is not a tileset:
 * its one "frame" is the whole picture, and cutting that into tile-sized pieces
 * nobody chose would export a map made of quarters of a sprite. Both misses
 * come out as a comment through `missingReason` rather than as a broken call.
 *
 * File-wide like the asset table, and for the same reason: the data goes into
 * one module-level object, so two scenes' maps sit side by side in it rather
 * than each scene carrying a copy of the table's shape.
 */
interface UsedTilemapLayer {
  /** Its row in the `TILEMAPS` table. */
  key: string;
  /** What the emitted object is called and named, when it is not the first. */
  name: string;
  visible: boolean;
  data: number[];
  solid: number[];
}

interface UsedTilemap {
  map: TileMap;
  assetKey: string;
  /**
   * One entry per document layer, in draw order, and never empty.
   *
   * The first layer's key is `toIdentifier(node.name, …)` — exactly what a
   * single-layer map's key has always been, which is the whole of why a project
   * that predates layers exports byte for byte what it exported before.
   */
  layers: UsedTilemapLayer[];
}

function collectTilemaps(
  project: Project,
  scenes: SceneDoc[],
  prefabs: Map<string, UsedPrefab>,
  assets: Map<string, UsedAsset>,
): Map<string, UsedTilemap> {
  const used = new Map<string, UsedTilemap>();
  const keys = new Set<string>();

  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'tilemap' && node.props.assetId) {
        const asset = assets.get(node.props.assetId);
        if (asset && frameGridOf(asset.asset)) {
          const map = tileMapOf(project, node.props);
          used.set(node.id, {
            map,
            assetKey: asset.key,
            layers: map.layers.map((layer, index) => ({
              // The first layer answers to the node's own name and the rest to
              // the node's name and theirs, so one layer's key is unchanged and
              // a reader of a multi-layer export can tell which row is which.
              key: toIdentifier(index === 0 ? node.name : `${node.name} ${layer.name}`, keys),
              name: index === 0 ? node.name : `${node.name} ${layer.name}`,
              visible: layer.visible,
              data: layer.data,
              solid: layer.collides,
            })),
          });
        }
      }
      walk(node.children);
    }
  };
  for (const scene of scenes) {
    for (const nodes of emittedNodes(project, scene, prefabs)) walk(nodes);
  }
  return used;
}

/**
 * The tile data, as an object literal keyed like the image table.
 *
 * A named const for `ASSETS`' reason twice over: `create()` stays a list of
 * objects rather than a wall of numbers, and the one thing a reader is likely
 * to want to change — moving a level out into a JSON file of its own — is one
 * object at the top of the module. One line per row, because a row of a map is
 * the unit a person reads it in.
 */
function buildTilemapTable(used: Map<string, UsedTilemap>, indent: string): string {
  const lines = [
    '/**',
    ' * Tile data from the editor, row by row. -1 is an empty cell.',
    ' */',
    'const TILEMAPS = {',
    ...[...used.values()].flatMap(({ map, layers }) =>
      layers.flatMap(({ key, data }) => [
        `  ${str(key)}: [`,
        ...Array.from(
          { length: map.rows },
          (_, row) => `    [${data.slice(row * map.columns, (row + 1) * map.columns).join(', ')}],`,
        ),
        '  ],',
      ]),
    ),
    '};',
  ];
  return lines.map((line) => (line ? `${indent}${line}` : '')).join('\n');
}

/**
 * The one function every tilemap in the file is built by.
 *
 * A tilemap is three statements — parse the data, link the tileset, create the
 * layer — and `constructorFor` may only answer with one expression. The
 * `instance` case settled that shape already: emit a module-level function and
 * return a call to it. The alternative was to let a node contribute statements
 * of its own before its `const`, which is a second emit shape for one node type
 * to use.
 *
 * It also happens to be what a reader wants: twenty maps is twenty calls rather
 * than sixty statements, and swapping the whole file to Tiled JSON later is one
 * function body to rewrite.
 */
function buildTilemapHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const params = typed
    ? [
        'scene: Phaser.Scene',
        'x: number',
        'y: number',
        'tilesetKey: string',
        'data: number[][]',
        'tileWidth: number',
        'tileHeight: number',
        'margin: number',
        'spacing: number',
        'solid: number[]',
      ].join(',\n  ')
    : 'scene, x, y, tilesetKey, data, tileWidth, tileHeight, margin, spacing, solid';
  const signature = typed
    ? `function ${fn}(\n  ${params},\n): Phaser.Tilemaps.TilemapLayer {`
    : `function ${fn}(${params}) {`;

  // The two guards are not defensive padding: `addTilesetImage` answers null for
  // a texture that is not loaded and `createLayer` for a layer id that is
  // already built, and under the `--strict` this file is compiled with, both
  // have to be narrowed before they can be used. Saying which one failed beats
  // a null dereference three frames later.
  const lines = [
    signature,
    '  const map = scene.make.tilemap({ data, tileWidth, tileHeight });',
    "  const tileset = map.addTilesetImage('tiles', tilesetKey, tileWidth, tileHeight, margin, spacing);",
    "  if (!tileset) throw new Error('Tileset texture not loaded: ' + tilesetKey);",
    '  const layer = map.createLayer(0, tileset, x, y);',
    "  if (!layer) throw new Error('Could not create a tilemap layer for: ' + tilesetKey);",
    // Guarded rather than called unconditionally, because `setCollision([])` is
    // a call that says nothing — and a map with no solid tiles is most maps.
    '  if (solid.length) layer.setCollision(solid);',
    typed ? '  return layer as Phaser.Tilemaps.TilemapLayer;' : '  return layer;',
    '}',
  ];
  // Shifted per physical line rather than per entry: the typed signature is
  // several lines in one entry, and only its first would otherwise move.
  // `buildFactories` indents the same way for the same reason.
  return lines.join('\n').replace(/^(?!$)/gm, indent);
}

/**
 * Which physics one scene needs: whether it has a body at all, and whether any
 * of them is dynamic.
 *
 * `scene.children` only, because a body may not live anywhere else — a prefab's
 * children are added to the Container the factory returns, which is the same
 * reason a group's children may not have one. So unlike `usedIn`, this has no
 * prefab half to get wrong.
 */
function physicsUsedIn(scene: SceneDoc): PhysicsUse {
  const { engine } = scenePhysicsOf(scene);
  let any = false;
  let dynamic = false;
  let turned = false;
  for (const node of scene.children) {
    const body = physicsOf(node, true);
    if (!body) continue;
    any = true;
    if (body.kind === 'dynamic') dynamic = true;
    if (bodyIsTurned(node.transform.rotation)) turned = true;
  }
  // `dynamic` and `turned` gate the two *Arcade* helpers, so a Matter scene
  // must not turn either on: `arcadeBody` throws on a Matter object by design,
  // and fitting a body to the box that holds a turned object is the very
  // approximation Matter exists to stop making.
  const arcade = any && engine === 'arcade';
  const matter = any && engine === 'matter';
  return {
    any,
    arcade,
    matter,
    dynamic: arcade && dynamic,
    turned: arcade && turned,
    // A jump is the only thing that has to know what is underneath, so a
    // top-down Matter scene emits no tracker and no listener.
    grounded:
      matter &&
      drivenIn(scene).some(
        (node) => controlsOf(node, true)?.mode === 'platformer',
      ),
  };
}

/** What one scene needs from the module's physics helpers and game config. */
interface PhysicsUse {
  /** A body of any kind, under either engine. */
  any: boolean;
  /** A body in an Arcade scene, which is what needs the game config's key. */
  arcade: boolean;
  /** A body in a Matter scene, which declares itself in its own `super()`. */
  matter: boolean;
  dynamic: boolean;
  turned: boolean;
  /** A Matter scene with something that jumps, which is the only thing that
   * needs the grounded tracker. */
  grounded: boolean;
}

/**
 * The one thing standing between the generated code and what a person would
 * actually have written.
 *
 * By hand this is `ball.body.setBounce(0.8)`, which is what the Phaser docs
 * show and what a reader expects. It does not compile: `GameObject.body` is
 * `Body | StaticBody | MatterJS.BodyType | null`, and only the first of those
 * has a velocity or a bounce — so under the `--strict` the exported `.ts` is
 * compiled with, the property access is an error before the call is. A cast
 * would fix it in TypeScript and would be a syntax error in the runnable page,
 * whose `create()` body is the *same* plain JavaScript; that shared body is the
 * property that stops the two outputs drifting, so it is not one to spend here.
 *
 * A three-line function narrows it once instead, reads at the call site almost
 * exactly as `.body` would, and throws with the object's name if it is ever
 * reached for something that has no dynamic body — which beats a null
 * dereference three frames later, the argument the tilemap helper's guards
 * already make.
 *
 * Only dynamic bodies need it. A static one is a single `add.existing(obj,
 * true)` with nothing to chain, because Phaser's `StaticBody` genuinely has no
 * velocity, bounce, drag, mass or gravity to set.
 */
function buildBodyHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(object: Phaser.GameObjects.GameObject): Phaser.Physics.Arcade.Body {`
    : `function ${fn}(object) {`;
  const lines = [
    signature,
    '  const body = object.body;',
    '  if (!(body instanceof Phaser.Physics.Arcade.Body)) {',
    "    throw new Error('No dynamic Arcade body on: ' + object.name);",
    '  }',
    '  return body;',
    '}',
  ];
  // Per physical line, as `buildTilemapHelper` and `buildFactories` both are:
  // the typed signature is one entry that spans none, but the rule is the same.
  return lines.join('\n').replace(/^(?!$)/gm, indent);
}

/**
 * The helper that gives a turned object a body the shape of what it draws.
 *
 * Arcade never turns a body: `Body.updateBounds` reads the object's scale and
 * never its angle, so a 300x20 platform stood on end keeps a 300x20 horizontal
 * body unless something says otherwise. The closest shape Arcade can express is
 * the box that *contains* the turned object, which is what `bodyBoxOf` draws on
 * the canvas and what this sets, so the two cannot disagree.
 *
 * It reads the object rather than being handed numbers, and that is the whole
 * reason it is a helper at all: a `text` node's size is measured against the
 * font at runtime and the document does not know it, so an angle the exporter
 * computed the box from would be right for every type but one. Reading
 * `object.angle` here rather than printing the document's rotation is the same
 * argument one step further — it cannot fall out of step with the `.setAngle`
 * the constructor chain above it emitted.
 *
 * The two branches are not tidiness, and this is the trap in the whole feature:
 * `StaticBody.setSize` takes **canvas** pixels while `Body.setSize` takes
 * **source** pixels, which Phaser then multiplies by the object's own scale. A
 * single call would be right for one kind of body and wrong by the scale for
 * the other, on a scaled object only — which is invisible on every fixture that
 * happens to sit at 1x. Both recentre, because `setSize` defaults `center` to
 * true and every type that can carry a body has a centred origin.
 *
 * `syncBounds` is the loop Phaser already ships for this and is refused: it
 * re-reads `getBounds()` every step, which does follow a spinning object, but
 * it never touches `offset` — so the body grows from its top-left corner and
 * sits off-centre by half of what it gained. A body that spins under
 * `angularVelocity` is therefore fitted to the angle the document states and
 * not to the one it reaches, which is the same thing the canvas draws.
 */
function buildFitHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  // The union rather than `GameObject`, because `angle`, `displayWidth` and
  // `scaleX` are on the components rather than on the base class — and rather
  // than a `type` alias, which would be a *statement* the runnable page's
  // shared body has nowhere to put. It is exactly `PHYSICS_TYPES`, with the two
  // shapes under the one class they both extend.
  const signature = typed
    ? `function ${fn}(\n` +
      '  object:\n' +
      '    | Phaser.GameObjects.Shape\n' +
      '    | Phaser.GameObjects.Sprite\n' +
      '    | Phaser.GameObjects.Text\n' +
      '    | Phaser.GameObjects.NineSlice\n' +
      '    | Phaser.GameObjects.TileSprite,\n' +
      '): void {'
    : `function ${fn}(object) {`;
  const lines = [
    signature,
    '  const radians = Phaser.Math.DegToRad(object.angle);',
    '  const cos = Math.abs(Math.cos(radians));',
    '  const sin = Math.abs(Math.sin(radians));',
    // Absolute because a negative scale flips an object without giving it a
    // negative-width body, which is how Phaser normalises it too.
    '  const width = Math.abs(object.displayWidth);',
    '  const height = Math.abs(object.displayHeight);',
    '  const boxWidth = width * cos + height * sin;',
    '  const boxHeight = width * sin + height * cos;',
    '  const body = object.body;',
    '  if (body instanceof Phaser.Physics.Arcade.StaticBody) {',
    '    body.setSize(boxWidth, boxHeight);',
    '  } else if (body instanceof Phaser.Physics.Arcade.Body) {',
    '    body.setSize(',
    '      boxWidth / (Math.abs(object.scaleX) || 1),',
    '      boxHeight / (Math.abs(object.scaleY) || 1),',
    '    );',
    '  }',
    '}',
  ];
  return lines.join('\n').replace(/^(?!$)/gm, indent);
}

/**
 * The helper that gives one object a Matter body the shape of what it draws.
 *
 * This is the whole of what choosing Matter buys, and it is three facts about
 * Phaser's loader that are wrong if guessed — which is what "read the source
 * rather than remembering Phaser 3" has been saying all along.
 *
 * **The shape is passed explicitly.** With no `shape` config `MatterGameObject`
 * builds `Bodies.rectangle(x, y, this.width, this.height)` — the object's
 * *unscaled* size, so a floor at `setScale(3)` would get a body a third of the
 * width it is drawn. Handing it `displayWidth`/`displayHeight` is what makes
 * the body the size of the picture.
 *
 * **The angle has to be read before the attach and applied after it.** Matter's
 * Transform component redefines `angle` on the object with a getter that
 * returns `body.angle`, so the moment the body is attached the object's
 * rotation *is* the body's — and the body is built upright. Without the
 * `setAngle` below, a floor turned 30 degrees in the editor snaps upright in
 * the exported game. It reads `object.angle` rather than a number this file
 * printed, so it cannot fall out of step with the `.setAngle` the constructor
 * chain above it emitted — `fitBodyToAngle`'s rule, one engine over.
 *
 * **The narrowing goes the other way from `arcadeBody`'s.** A Matter body is a
 * plain object rather than a class, so there is no `instanceof` to test for.
 * What there is instead is `instanceof` for the two Arcade classes, and ruling
 * both of those out plus null is exactly what leaves `MatterJS.BodyType` — a
 * narrowing TypeScript accepts, in syntax the runnable page's shared plain
 * JavaScript can also carry.
 *
 * It answers with the body rather than the object because that is what the
 * dials are set on, and because the object's own type never gains the Matter
 * components as far as the compiler is concerned.
 */
function buildMatterHelper(
  fn: string,
  accessor: string,
  language: SceneLanguage,
  indent: string,
): string {
  const typed = language === 'ts';
  // The same union `fitBodyToAngle` takes, and for its reason: `angle` and
  // `displayWidth` are on the components rather than on `GameObject`.
  const signature = typed
    ? `function ${fn}(\n` +
      '  scene: Phaser.Scene,\n' +
      '  object:\n' +
      '    | Phaser.GameObjects.Shape\n' +
      '    | Phaser.GameObjects.Sprite\n' +
      '    | Phaser.GameObjects.Text\n' +
      '    | Phaser.GameObjects.NineSlice\n' +
      '    | Phaser.GameObjects.TileSprite,\n' +
      '  config: Phaser.Types.Physics.Matter.MatterBodyConfig,\n' +
      '): MatterJS.BodyType {'
    : `function ${fn}(scene, object, config) {`;
  const lines = [
    signature,
    '  const radians = Phaser.Math.DegToRad(object.angle);',
    '  scene.matter.add.gameObject(object, {',
    '    ...config,',
    '    shape: {',
    "      type: 'rectangle',",
    '      width: Math.abs(object.displayWidth),',
    '      height: Math.abs(object.displayHeight),',
    '    },',
    '  });',
    `  const body = ${accessor}(object);`,
    '  scene.matter.body.setAngle(body, radians);',
    '  return body;',
    '}',
  ];
  return lines.join('\n').replace(/^(?!$)/gm, indent);
}

/**
 * `arcadeBody` one engine over, and the narrowing runs backwards.
 *
 * A Matter body is a plain object rather than a class, so there is no
 * `instanceof` to test *for*. What there is instead is `instanceof` for the two
 * Arcade classes, and ruling both of those out plus null is exactly what leaves
 * `MatterJS.BodyType` — a narrowing TypeScript accepts, in syntax the runnable
 * page's shared plain JavaScript can also carry.
 *
 * Split out of `matterBody` rather than written twice, because `update()` needs
 * it as well: `create()` binds `this.<field>` to the *object*, exactly as the
 * Arcade path does, so the driven block reaches the body through this on every
 * frame. Keeping `create()`'s epilogue identical under both engines is what
 * makes that worth a second function.
 */
function buildMatterAccessor(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(object: Phaser.GameObjects.GameObject): MatterJS.BodyType {`
    : `function ${fn}(object) {`;
  const lines = [
    signature,
    '  const body = object.body;',
    '  if (',
    '    !body ||',
    '    body instanceof Phaser.Physics.Arcade.Body ||',
    '    body instanceof Phaser.Physics.Arcade.StaticBody',
    '  ) {',
    "    throw new Error('No Matter body on: ' + object.name);",
    '  }',
    '  return body;',
    '}',
  ];
  return lines.join('\n').replace(/^(?!$)/gm, indent);
}

/**
 * What a Matter platformer jumps off, which Arcade hands over as a flag.
 *
 * Arcade's `body.blocked.down` is "there is something under me this step", set
 * by a world of axis-aligned boxes where "under" needs no defining. Matter has
 * no such flag and could not have one: a polygon that turns is touched at an
 * angle, and the only thing that says *where* is the collision normal.
 *
 * Two facts about that normal are wrong if guessed, and both were checked
 * against Matter's own `Collision.collides` rather than remembered. It is
 * computed so that its dot product with `bodyB.position - bodyA.position` is
 * negative — which means it points **from bodyB towards bodyA**, the opposite
 * of what the comment beside it in Matter's source suggests. So the other body
 * is underneath when the normal aims *up* out of ours: negated when we are
 * bodyA, taken as-is when we are bodyB. Get that backwards and the jump works
 * only against a ceiling, which no export assertion short of pressing the
 * button would catch.
 *
 * It records a *time* rather than a boolean because `collisionactive` fires on
 * the physics step while `update()` runs on the frame, and the two are not one
 * to one. A flag set on the step and cleared on the frame flickers; a timestamp
 * compared against a short window does not, and it costs one number.
 *
 * The 0.5 is a direction test, not a tuning knob: a normal more than 60 degrees
 * off vertical is a wall being leaned on rather than a floor being stood on.
 */
function buildGroundHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const signature = typed
    ? `function ${fn}(\n` +
      '  scene: Phaser.Scene,\n' +
      '  body: MatterJS.BodyType,\n' +
      '): { at: number } {'
    : `function ${fn}(scene, body) {`;
  // Only the callback's parameter differs between the two languages, because
  // `World.on` is typed with a bare `Function` and an unannotated parameter is
  // an implicit `any` under `--strict`. This is a module-level helper rather
  // than part of the shared `create()` body, so it is allowed to differ.
  const listener = typed
    ? "  scene.matter.world.on('collisionactive', " +
      '(event: Phaser.Physics.Matter.Events.CollisionActiveEvent) => {'
    : "  scene.matter.world.on('collisionactive', (event) => {";
  const lines = [
    signature,
    '  const state = { at: -Infinity };',
    listener,
    '    for (let i = 0; i < event.pairs.length; i += 1) {',
    '      const pair = event.pairs[i];',
    '      const isA = pair.bodyA === body;',
    '      if (!isA && pair.bodyB !== body) continue;',
    '      const under = isA ? -pair.collision.normal.y : pair.collision.normal.y;',
    '      if (under > 0.5) {',
    '        state.at = scene.time.now;',
    '        return;',
    '      }',
    '    }',
    '  });',
    '  return state;',
    '}',
  ];
  return lines.join('\n').replace(/^(?!$)/gm, indent);
}

/** The type of the flags the buttons set, written once for three places. */
const TOUCH_STATE_TYPE =
  '{ left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean }';

/**
 * The on-screen buttons, as a module-level helper.
 *
 * The tilemap helper's and the body helper's route, and for the tilemap
 * helper's reason: a pad is a dozen statements of circle geometry, and
 * `create()` is meant to stay a list of the objects in the scene rather than a
 * wall of numbers. It answers with the flags `update()` reads, so the whole
 * feature is one line in `create()` and one condition per direction.
 *
 * Three things in here are not stylistic, and each one's absence is a bug that
 * only shows up on a phone:
 *
 * - `addPointer(2)`. Phaser tracks a single active pointer unless it is asked
 *   for more, so without this the second finger is simply never delivered and
 *   a player cannot walk and jump at once — which looks like the jump button
 *   being broken rather than like an input budget.
 * - `setScrollFactor(0)`. It is what makes these a HUD rather than three
 *   objects sitting in the level, and it is the first one this exporter has
 *   ever emitted. Without it the buttons scroll away the moment the camera
 *   follows anything.
 * - `pointerout` and `pointerupoutside` beside `pointerup`. A finger that
 *   slides off a button never fires `pointerup` *on that button*, so the
 *   direction would stay held for the rest of the game.
 * - An explicit `Geom.Circle` hit area. A bare `setInteractive()` derives the
 *   hit area from the object's *texture*, and a Shape has none — so the button
 *   ends up with no hit area at all and can never be pressed. It looks exactly
 *   like a working button and does nothing, which is how it got past a review
 *   and was caught only by `export.spec` actually pressing one.
 *
 * White at a quarter alpha rather than a colour, because the buttons are drawn
 * over whatever the user built and any hue would be one that clashed with some
 * project. It is the one piece of appearance this exporter chooses, and it is
 * chosen to be the one a reader will most easily change.
 */
function buildTouchHelper(fn: string, language: SceneLanguage, indent: string): string {
  const typed = language === 'ts';
  const buttonType =
    "{ key: 'left' | 'right' | 'up' | 'down' | 'jump'; label: string; " +
    'x: number; y: number; radius: number }';
  const signature = typed
    ? `function ${fn}(scene: Phaser.Scene, buttons: ${buttonType}[]): ${TOUCH_STATE_TYPE} {`
    : `function ${fn}(scene, buttons) {`;
  const state = typed
    ? `  const state: ${TOUCH_STATE_TYPE} = ` +
      '{ left: false, right: false, up: false, down: false, jump: false };'
    : '  const state = { left: false, right: false, up: false, down: false, jump: false };';
  const lines = [
    signature,
    '  scene.input.addPointer(2);',
    state,
    '  for (const button of buttons) {',
    '    const circle = scene.add.circle(button.x, button.y, button.radius, 0xffffff, 0.25);',
    '    circle.setScrollFactor(0).setDepth(10000);',
    '    circle.setInteractive(',
    '      new Phaser.Geom.Circle(button.radius, button.radius, button.radius),',
    '      Phaser.Geom.Circle.Contains,',
    '    );',
    "    circle.on('pointerdown', () => { state[button.key] = true; });",
    "    circle.on('pointerup', () => { state[button.key] = false; });",
    "    circle.on('pointerout', () => { state[button.key] = false; });",
    "    circle.on('pointerupoutside', () => { state[button.key] = false; });",
    '    scene.add',
    "      .text(button.x, button.y, button.label, { color: '#ffffff' })",
    '      .setFontSize(Math.round(button.radius))',
    '      .setOrigin(0.5)',
    '      .setScrollFactor(0)',
    '      .setDepth(10001);',
    '  }',
    '  return state;',
    '}',
  ];
  return lines.join('\n').replace(/^(?!$)/gm, indent);
}

/** One button, as the literal the helper is handed. */
function touchButtonLine(button: TouchButton): string {
  return (
    `  { key: ${str(button.key)}, label: ${str(button.label)}, ` +
    `x: ${num(button.x)}, y: ${num(button.y)}, radius: ${num(button.radius)} },`
  );
}

/**
 * The lines that give one object its Arcade body, or none at all.
 *
 * Every dial is emitted, defaults included — the emitter config's rule rather
 * than `modifiersFor`'s. A body has a dozen numbers that interact (drag only
 * bites while acceleration is zero, bounce only shows against something to
 * bounce off, gravity is the world's unless this body opts out), so a reader
 * tuning one wants to see the others beside it rather than to remember which
 * of Phaser's defaults are in force. The chained form is one statement, so the
 * whole body still reads as a single thing.
 */
function bodyLines(
  id: string,
  node: GameObjectNode,
  body: PhysicsBody,
  engine: PhysicsEngine,
  ctx: EmitContext,
  used: Set<string>,
): string[] {
  // A Matter body is one call and one config object, emitted whole and
  // defaults included — the emitter config's rule and the Arcade chain's, for
  // their reason: these dials interact, so a reader tuning the bounciness
  // wants the friction beside it rather than having to remember which of
  // Matter's defaults are in force. Every unit is converted here rather than
  // stored twice: the document holds pixels per second and degrees per second
  // whichever engine reads it, because a scene switched from Arcade to Matter
  // must fall at the speed it already fell at.
  if (engine === 'matter') {
    // Out of the same identifier set every object draws from, so a scene
    // holding an object the user called "floor body" cannot end up with two
    // bindings of one name — the rule the sound handles and the keyboard
    // fields already follow.
    const binding = toIdentifier(`${node.name} body`, used);
    // The config carries exactly the keys `MatterBodyConfig` *declares*, and
    // the split is not tidiness. Matter's `Body.set` handles `velocity`,
    // `angularVelocity` and `mass` at runtime and assigns `ignoreGravity` as a
    // plain property, so all four work — and none of them is in the type, so
    // an object literal carrying one fails the exported `.ts` under `--strict`
    // while the `.js` and the runnable page both pass. That is iteration 24's
    // `generateFrameNames` trap exactly: a runtime that does the right thing
    // behind a type that refuses to say so, and the shared `create()` body has
    // nowhere to put a cast. **Only `export-toolchain.spec.ts` could have found
    // it.** So the declared keys ride in the literal and the rest are
    // statements on the body the helper answers with.
    const lines = [
      `const ${binding} = ${ctx.matterFn}(${ctx.receiver}, ${id}, {`,
      `  isStatic: ${body.kind === 'static'},`,
      `  restitution: ${num(body.restitution)},`,
      `  friction: ${num(body.friction)},`,
      `  frictionAir: ${num(body.frictionAir)},`,
      '});',
    ];
    // A Matter static body ignores every one of these, exactly as Phaser's
    // `StaticBody` has no velocity, bounce, drag, mass or gravity to set — so a
    // static one gets the literal and nothing else, which is the Arcade
    // branch's "nothing to chain" one engine over.
    if (body.kind === 'dynamic') {
      lines.push(`${ctx.receiver}.matter.body.setMass(${binding}, ${num(body.mass)});`);
      // Matter's velocity is pixels per *step*, and a step is its own 1000/60 ms
      // base delta rather than a second — `Body.setVelocity` divides by exactly
      // that — so px/s is px/step times 60.
      lines.push(
        `${ctx.receiver}.matter.body.setVelocity(${binding}, ` +
          `{ x: ${num(body.velocityX / 60)}, y: ${num(body.velocityY / 60)} });`,
      );
      // Radians per step, where the document says degrees per second.
      lines.push(
        `${ctx.receiver}.matter.body.setAngularVelocity(${binding}, ` +
          `${num((body.angularVelocity * Math.PI) / 180 / 60)});`,
      );
      // A plain assignment because Matter has no setter for it, and the
      // property is on `MatterJS.BodyType` so it compiles.
      lines.push(`${binding}.ignoreGravity = ${!body.allowGravity};`);
    }
    return lines;
  }
  // Immediately after the object is given a body and before any of its dials,
  // so the statement that says what shape it is sits beside the one that made
  // it. Nothing at all for an upright object — or one turned a half turn, whose
  // box is its box — so a project that predates this exports byte for byte what
  // it always did.
  const fit = bodyIsTurned(node.transform.rotation) ? [`${ctx.fitFn}(${id});`] : [];
  if (body.kind === 'static') {
    // Nothing to chain: a StaticBody has no velocity, bounce, drag, mass or
    // gravity, and an immovable flag on a body that never moves would be a line
    // restating its own type.
    return [`${ctx.receiver}.physics.add.existing(${id}, true);`, ...fit];
  }
  const setters = [
    `.setVelocity(${num(body.velocityX)}, ${num(body.velocityY)})`,
    `.setBounce(${num(body.bounceX)}, ${num(body.bounceY)})`,
    `.setDrag(${num(body.dragX)}, ${num(body.dragY)})`,
    `.setAngularVelocity(${num(body.angularVelocity)})`,
    `.setMass(${num(body.mass)})`,
    `.setImmovable(${body.immovable})`,
    `.setAllowGravity(${body.allowGravity})`,
    `.setCollideWorldBounds(${body.collideWorldBounds})`,
  ];
  return [
    `${ctx.receiver}.physics.add.existing(${id});`,
    ...fit,
    `${ctx.bodyFn}(${id})\n      ${setters.join('\n      ')};`,
  ];
}

interface EmitContext {
  assets: Map<string, UsedAsset>;
  animations: Map<string, UsedAnimation>;
  prefabs: Map<string, UsedPrefab>;
  tilemaps: Map<string, UsedTilemap>;
  /**
   * What the tilemap helper is called in this module. A field rather than a
   * constant because it is allocated from the module's identifier set like the
   * prefab factories, so an object named "create tilemap layer" cannot take it
   * out from under the calls.
   */
  tilemapFn: string;
  /**
   * What the dynamic-body accessor is called in this module, allocated from the
   * same identifier set and for the same reason as `tilemapFn`.
   */
  bodyFn: string;
  /**
   * What the on-screen button helper is called in this module, allocated from
   * the same identifier set and for the same reason as `tilemapFn`.
   */
  touchFn: string;
  /**
   * What the body-fitting helper is called in this module, allocated from the
   * same identifier set and for the same reason as `tilemapFn`.
   */
  fitFn: string;
  /**
   * What the Matter body helper is called in this module, allocated from the
   * same identifier set and for the same reason as `tilemapFn`.
   */
  matterFn: string;
  /** The Matter body accessor, `arcadeBody`'s sibling one engine over. */
  matterBodyFn: string;
  /** The grounded tracker a Matter platformer's jump reads. */
  groundFn: string;
  /**
   * What the variable-declaring helper is called in this module, allocated from
   * the same identifier set and for the same reason as `tilemapFn`.
   */
  initVariablesFn: string;
  /** The keyboard-listener helper a `keyDown` rule goes through. */
  keyFn: string;
  /** The hit-area helper a `tap` rule goes through. */
  tapFn: string;
  /** The Matter collision-pair helper a `collide` rule goes through. */
  matterHitFn: string;
  /**
   * How a variable's value is formatted, for a bound label and for a `setText`
   * that asks for a format alike — the one printed formatter, so the two ways of
   * putting a number on screen cannot read differently.
   */
  labelValueFn: string;
  /** What a bound label subscribes through, allocated like `tilemapFn`. */
  bindLabelFn: string;
  /**
   * What a `varChange` rule subscribes through — the same `changedata-<key>`
   * moment `bindLabelFn` above already rides on, one consumer over.
   */
  onVarFn: string;
  /**
   * What an object's visual effects are attached through, allocated like
   * `tilemapFn` and drawn **last of all** — see `prepare`.
   */
  effectsFn: string;
  /**
   * What each scene's `super(...)` registers it as, by scene id.
   *
   * A `startScene` action names a scene the document holds and has to emit the
   * key the *file* registered it under — which `collectScenes` de-duplicates,
   * so it cannot be re-derived from the name here without risking a second
   * answer.
   */
  sceneKeys: ReadonlyMap<string, string>;
  /**
   * Node ids a rule in **this scene** plays an animation on.
   *
   * Per scene and overwritten in `buildCreateBody` beside `engine`, whose own
   * comment is the precedent. It exists because `constructorFor` emits
   * `add.image` for a sprite with no clip of its own, and a
   * `Phaser.GameObjects.Image` has no `play` and no `anims` — so a node a rule
   * animates has to be built as a `Sprite` instead. That is a **compile error**
   * under `--strict` if it is missed, not a runtime surprise, which makes
   * `export-toolchain.spec.ts` the compiler for a semantic coupling.
   */
  ruleAnimated: ReadonlySet<string>;
  /**
   * Node id -> the `const` its paused tween is bound to, in **this scene**.
   *
   * A tween a rule starts is emitted `paused: true` and has to be named, where
   * every other tween is emitted as a bare statement. The identifiers are
   * allocated in the prologue before any object binding, which is
   * `buildSoundLines`' rule: an object a user called "box tween" must not take
   * the binding the epilogue is reaching for.
   */
  ruleTweens: ReadonlyMap<string, string>;
  /**
   * Node ids a rule in **this scene** starts or bursts particles on.
   *
   * Per scene and overwritten in `buildCreateBody` beside `ruleAnimated` and
   * `ruleTweens`, whose comments are the precedent — and this is the third
   * member of that family for the same structural reason: what a rule does to
   * an object later can change how `constructorFor` has to build it *now*.
   *
   * It exists so the document needs no `emitting` prop. Iteration 15 refused
   * one because whether an emitter runs is `previewMotion`'s answer in the
   * editor and Phaser's default in an export, and a stored field would be a
   * second answer to one question. A rule that starts or bursts an emitter is
   * a *third* thing saying it, so the answer is derived here rather than
   * stored: an emitter a rule waits to start is emitted `emitting: false`, and
   * every other one emits exactly the config it always did.
   *
   * A `stopParticles` deliberately does **not** put a node in this set. "Stop
   * the smoke when it is hit" means the smoke was running; only a start or a
   * burst describes an emitter that waits.
   *
   * Unlike `ruleAnimated` this is not a compile error if it is missed — it is
   * a silent one, and what it looks like is a game whose every emitter runs
   * from the boot, which is exactly the state this feature exists to end.
   * `rules.spec.ts` asserts both sides of it in the emitted text.
   */
  ruleEmitters: ReadonlySet<string>;
  /**
   * The variable table, file-wide like `assets` and `audio`.
   *
   * Keyed by variable id, because that is what a rule names; the registry key
   * a scene actually reads is the entry's `key`. Unfiltered — see
   * `collectVariables` — so unlike the three tables above it, its size is the
   * count of what the *project* declares rather than of what a scene uses.
   */
  variables: Map<string, UsedVariable>;
  /**
   * Which engine the scene being emitted runs. On the context rather than
   * threaded through `emitNode` because a prefab factory's bodies are refused
   * for a different reason entirely (they are container children), so nothing
   * downstream ever needs a second answer.
   */
  engine: PhysicsEngine;
  /**
   * The sound table, file-wide like `assets` and read by `buildSoundLines`
   * alone. No `receiver` question attaches to it: the only place a sound is
   * ever emitted is a Scene's own `create()`.
   */
  audio: Map<string, UsedAudio>;
  /**
   * The font table, file-wide like `assets`, and read only by `preload()`.
   *
   * It is here rather than passed alongside because both generators need it to
   * decide whether to emit a `FONTS` const at all, which is where every other
   * file-wide table is reached from. Nothing in `create()` names a font — a
   * text object names its family in the style literal `constructorFor` already
   * builds — so unlike `audio` there is no `receiver` question here even in
   * principle, and no prefab factory ever reads it.
   */
  fonts: Map<string, FontAsset>;
  /** `'this'` inside a Scene method, `'scene'` inside a factory function. */
  receiver: string;
}

/**
 * The `add.*` call for one node, without any trailing modifiers.
 *
 * Null means "emit nothing for this node": a sprite with no image chosen, or an
 * instance whose prefab is gone. Neither has a valid constructor call to make.
 */
/**
 * One `createTilemapLayer(...)` call, for one layer of one map.
 *
 * Shared by `constructorFor`, which emits the first layer as the node's own
 * binding, and by `emitNode`, which emits the rest beside it — so the two
 * cannot disagree about a margin or a tile size, which is the same reason
 * `EditorScene` and this file are both handed `tileMapOf`'s answer.
 *
 * The solid list is inline where the tile data is tabled, and the split is the
 * one `TILEMAPS` was created by: the data is thousands of numbers and the thing
 * a reader moves out to a JSON file, while which frames are walls is a handful
 * of them and a fact about the tileset rather than about this level. Putting it
 * in the table would turn every row from an array into an object for one short
 * line.
 */
function tilemapCall(
  entry: UsedTilemap,
  index: number,
  ctx: EmitContext,
  x: number,
  y: number,
): string {
  const grid = frameGridOf(entry.map.asset);
  const layer = entry.layers[index];
  return (
    `${ctx.tilemapFn}(${ctx.receiver}, ${num(x)}, ${num(y)}, ${str(entry.assetKey)}, ` +
    `TILEMAPS[${str(layer.key)}], ${num(entry.map.tileWidth)}, ${num(entry.map.tileHeight)}, ` +
    `${num(grid ? grid.margin : 0)}, ${num(grid ? grid.spacing : 0)}, ` +
    `[${layer.solid.join(', ')}])`
  );
}

function constructorFor(node: GameObjectNode, ctx: EmitContext): string | null {
  const { x, y } = node.transform;
  const { assets: used, animations, receiver } = ctx;

  switch (node.type) {
    case 'rectangle':
      return `${receiver}.add.rectangle(${num(x)}, ${num(y)}, ${num(node.props.width)}, ${num(node.props.height)}, ${hexLiteral(node.props.fill)})`;
    case 'ellipse':
      return `${receiver}.add.ellipse(${num(x)}, ${num(y)}, ${num(node.props.width)}, ${num(node.props.height)}, ${hexLiteral(node.props.fill)})`;
    case 'sprite': {
      const entry = node.props.assetId ? used.get(node.props.assetId) : undefined;
      if (!entry) return null;
      // A Sprite only when the node actually animates: an Image cannot `play`,
      // and a Sprite that never does is a heavier object and a reader's
      // question about what it is for. The editor makes the opposite choice and
      // draws every sprite node as a Sprite, because there the node has to be
      // able to start animating the moment the user gives it a clip.
      //
      // A node a *rule* animates counts, and this is the one coupling this
      // feature forces backwards into the object list. `Phaser.GameObjects.Image`
      // has no `play` and no `anims` at all, so a `playAnimation` action on a
      // node built as an image is a **compile error** in the exported `.ts`
      // rather than a runtime surprise — which makes `export-toolchain.spec.ts`
      // the compiler for a semantic coupling, where it is usually the compiler
      // for a shape. `add.sprite` is a strict superset of `add.image`
      // otherwise, so nothing else about the emit changes.
      if (
        (node.props.animationId && animations.has(node.props.animationId)) ||
        ctx.ruleAnimated.has(node.id)
      ) {
        return `${receiver}.add.sprite(${num(x)}, ${num(y)}, ${str(entry.key)})`;
      }
      // Frame 0 is `add.image`'s own default, so a plain image emits exactly
      // the call it always did.
      const frame = resolveFrame(entry.asset, node.props.frame);
      // Frame 0 is `add.image`'s own default, so a still sprite on a plain
      // image emits exactly what it always did. An atlas has no such default:
      // every frame there has a name and none of them is the one Phaser would
      // reach for, so the argument is always printed.
      return frame === 0
        ? `${receiver}.add.image(${num(x)}, ${num(y)}, ${str(entry.key)})`
        : `${receiver}.add.image(${num(x)}, ${num(y)}, ${str(entry.key)}, ${frameArg(frame)})`;
    }
    case 'nineslice': {
      const entry = node.props.assetId ? used.get(node.props.assetId) : undefined;
      if (!entry) return null;
      const p = node.props;
      const insets = sliceInsetsOf(entry.asset, p);
      // Emitted whole, insets included, and deliberately unlike `modifiersFor`,
      // which emits only what differs from Phaser's defaults. These four
      // numbers only mean anything beside each other and beside the box they
      // are cut against — a reader widening the panel wants to see what is
      // holding its corners — so this is the emitter config's call and the
      // physics body's, not the chained modifier's.
      return (
        `${receiver}.add.nineslice(${num(x)}, ${num(y)}, ${str(entry.key)}, ` +
        `${frameArg(resolveFrame(entry.asset, p.frame))}, ${num(p.width)}, ${num(p.height)}, ` +
        `${num(insets.left)}, ${num(insets.right)}, ${num(insets.top)}, ${num(insets.bottom)})`
      );
    }
    case 'tileSprite': {
      const entry = node.props.assetId ? used.get(node.props.assetId) : undefined;
      if (!entry) return null;
      const p = node.props;
      // The tile offset and the tile scale are not here: `add.tileSprite` has
      // nowhere to take them, so they are `modifiersFor`'s and are emitted only
      // when they differ from a plain repeat.
      return (
        `${receiver}.add.tileSprite(${num(x)}, ${num(y)}, ${num(p.width)}, ${num(p.height)}, ` +
        `${str(entry.key)}, ${frameArg(resolveFrame(entry.asset, p.frame))})`
      );
    }
    case 'tilemap': {
      const entry = ctx.tilemaps.get(node.id);
      if (!entry) return null;
      // The *first* layer, and the rest are emitted beside it by `emitNode`.
      // A call rather than an `add.*`, exactly as an instance is: the helper
      // does the adding, and because it returns the layer every modifier below
      // — and the `setName` after them — chains onto it unchanged.
      return tilemapCall(entry, 0, ctx, x, y);
    }
    case 'particles': {
      const entry = node.props.assetId ? used.get(node.props.assetId) : undefined;
      if (!entry) return null;
      const p = node.props;
      // A single expression, so this stays an `add.*` rather than taking the
      // helper-function route a tilemap and an instance had to.
      //
      // Every key is emitted, including `tint: 0xffffff` and
      // `blendMode: "NORMAL"` — deliberately unlike `modifiersFor`, which emits
      // only what differs from Phaser's defaults. A chained modifier left out
      // is a line that would have restated a default; this literal *is* the
      // object, so writing it whole means the generated code says exactly what
      // the document says, and every dial a reader might want to change is in
      // one place rather than half-hidden behind a default they cannot see.
      //
      // `emitting` is the one key that is *not* the document's, and it is the
      // exception the whole particles-rule feature turns on: it is derived from
      // whether a rule starts or bursts this emitter rather than stored beside
      // the dials, which is what keeps iteration 15's "there is no `emitting`
      // prop" true instead of overturning it. `ctx.ruleTweens`' `paused: true`
      // one type over, and gated the same way — an emitter no rule waits on
      // emits the config it always did, character for character.
      const waits = ctx.ruleEmitters.has(node.id);
      return (
        `${receiver}.add.particles(${num(x)}, ${num(y)}, ${str(entry.key)}, {\n` +
        `      frame: ${frameArg(resolveFrame(entry.asset, p.frame))},\n` +
        `      lifespan: ${num(p.lifespan)},\n` +
        `      speed: { min: ${num(p.speedMin)}, max: ${num(p.speedMax)} },\n` +
        `      angle: { min: ${num(p.angleMin)}, max: ${num(p.angleMax)} },\n` +
        `      scale: { start: ${num(p.scaleStart)}, end: ${num(p.scaleEnd)} },\n` +
        `      alpha: { start: ${num(p.alphaStart)}, end: ${num(p.alphaEnd)} },\n` +
        `      quantity: ${num(p.quantity)},\n` +
        `      frequency: ${num(p.frequency)},\n` +
        `      gravityX: ${num(p.gravityX)},\n` +
        `      gravityY: ${num(p.gravityY)},\n` +
        `      tint: ${hexLiteral(p.tint)},\n` +
        `      blendMode: ${str(blendModeOf(node))},\n` +
        (waits ? '      emitting: false,\n' : '') +
        `    })`
      );
    }
    case 'container':
      return `${receiver}.add.container(${num(x)}, ${num(y)})`;
    case 'instance': {
      const entry = node.props.prefabId ? ctx.prefabs.get(node.props.prefabId) : undefined;
      if (!entry) return null;
      // A call, not an `add.*`: the factory does the adding, and returns the
      // Container every modifier below then applies to exactly as it would to a
      // group's.
      return `${entry.fn}(${receiver}, ${num(x)}, ${num(y)})`;
    }
    case 'text':
      return (
        `${receiver}.add.text(${num(x)}, ${num(y)}, ${str(node.props.text)}, {\n` +
        textStyleLines(textStyleOf(node.props))
          .map((line) => `      ${line}\n`)
          .join('') +
        `    })`
      );
  }
}

/**
 * The style object's entries, one per line, without the braces.
 *
 * The three keys a text object has always had are emitted unconditionally; each
 * typography key is emitted only where it differs from Phaser's own default.
 * That is `modifiersFor`'s rule expressed inside a config literal rather than
 * along a chain, and it is the opposite call from the emitter config and the
 * physics body, which are emitted whole. The reason is that those two are
 * dials that interact — drag only bites while acceleration is zero, a lifespan
 * only means anything beside a frequency — whereas a stroke tells a reader
 * nothing about an alignment. A line restating a default is a line to check.
 *
 * It also buys the property every feature here has had to keep: a text node
 * made before iteration 22 derives a style whose every new key is at its
 * default, so it prints the same three keys it has always printed, in the same
 * order, and its export does not move by a byte.
 *
 * `textStyleOf` has already repaired the values, so nothing here validates.
 */
function textStyleLines(style: TextStyle): string[] {
  const lines = [
    `fontFamily: ${str(style.fontFamily)},`,
    `fontSize: ${str(style.fontSize)},`,
    `color: ${str(style.color)},`,
  ];

  if (style.fontStyle !== '') lines.push(`fontStyle: ${str(style.fontStyle)},`);
  if (style.align !== 'left') lines.push(`align: ${str(style.align)},`);
  if (style.wordWrap.width !== null) {
    lines.push(`wordWrap: { width: ${num(style.wordWrap.width)} },`);
  }
  if (style.lineSpacing !== 0) lines.push(`lineSpacing: ${num(style.lineSpacing)},`);
  if (style.letterSpacing !== 0) lines.push(`letterSpacing: ${num(style.letterSpacing)},`);

  // The pair or neither: a stroke colour with no thickness draws nothing, and a
  // thickness with no colour is black by accident rather than by choice.
  if (style.strokeThickness > 0) {
    lines.push(`stroke: ${str(style.stroke)},`);
    lines.push(`strokeThickness: ${num(style.strokeThickness)},`);
  }

  const { shadow } = style;
  if (shadow.offsetX !== 0 || shadow.offsetY !== 0 || shadow.blur !== 0) {
    // Whole, unlike everything above it, because these six only mean anything
    // beside each other — an offset with no colour is invisible, a blur with no
    // offset is a halo — and because `stroke` and `fill` are not decoration:
    // `TextStyle`'s property map defaults both to false, so a shadow emitted
    // without them is computed by Phaser and never painted.
    lines.push(
      `shadow: { offsetX: ${num(shadow.offsetX)}, offsetY: ${num(shadow.offsetY)}, ` +
        `color: ${str(shadow.color)}, blur: ${num(shadow.blur)}, ` +
        `stroke: ${shadow.stroke}, fill: ${shadow.fill} },`,
    );
  }

  // Derived from the stroke and the shadow, so it is non-zero exactly when
  // there is something drawn outside the glyphs for Phaser's canvas to clip.
  if (style.padding.x !== 0 || style.padding.y !== 0) {
    lines.push(`padding: { x: ${num(style.padding.x)}, y: ${num(style.padding.y)} },`);
  }

  return lines;
}

/**
 * Only the modifiers that differ from Phaser's defaults, so the generated code
 * stays readable instead of restating `setScale(1, 1)` on every object.
 *
 * There is deliberately no `particles` branch, and that is worth saying because
 * this function is not exhaustive over the union — "no branch needed" and
 * "forgot a branch" look identical here. An emitter's tint and blend mode are
 * inside its config literal, and the shared modifiers all apply to it as they
 * do to anything else: `setAngle` on a `ParticleEmitter` is Transform's, the
 * game object's own rotation, not the emission angle (that is
 * `setEmitterAngle`, which the config's `angle` already carries).
  *
 * No physics branch, and here — as with the emitter's `setAngle` — "no branch
 * needed" and "forgot a branch" look identical, so this says which. A body's
 * setters cannot be chained onto the constructor for two reasons at once:
 * `physics.add.existing` answers with the *object*, not the body, and the body
 * does not exist until that call has been made. They are emitted as their own
 * statements by `bodyLines` instead.
 *
 * And no visual-effects branch, for a third turn of the same screw.
 * `enableFilters()` does answer with the object and could chain — but the call
 * that follows it, `filters.internal.addGlow(...)`, answers with the
 * *controller*, and `filters` is nullable in a way no chain can narrow. They
 * are emitted as their own statements by `emitNode` instead.
 */
function modifiersFor(
  node: GameObjectNode,
  animations: Map<string, UsedAnimation>,
  topLevel: boolean,
): string[] {
  const out: string[] = [];
  const { rotation, scaleX, scaleY } = node.transform;

  // Text is created with a top-left origin; the editor centres every object.
  // And this stays the *only* text branch here, typography included: every
  // typography field is a key of the style object `constructorFor` already
  // passes, so the whole of iteration 22 lands in that literal and nothing
  // chains. Said out loud because on this function's checklist "no branch
  // needed" and "forgot a branch" read exactly the same, as they do for the
  // particles and physics notes below — and for a tween, which gains nothing
  // here for a mechanical reason rather than a chosen one: `tweens.add` answers
  // with a Tween, not with the object, so it cannot join a constructor chain at
  // all. `emitNode` emits it as its own statement instead.
  if (node.type === 'text') out.push('.setOrigin(0.5)');
  if (rotation !== 0) out.push(`.setAngle(${num(rotation)})`);

  // The first new branch in this function since `tileSprite`, and it follows
  // *this* function's rule rather than the emitter config's — which is the one
  // thing about it worth arguing, because the two rules sit a hundred lines
  // apart and say opposite things. The config literal, the physics body, the
  // camera block and the Matter body are all emitted **whole, defaults
  // included**, because their dials only mean anything beside each other: a
  // body's drag only bites while acceleration is zero, a lifespan only means
  // something beside a frequency, a zoom moves the shot as well as tightening
  // it. A blend mode means something entirely alone — one word about one
  // object, like a tint or a flip — so a `.setBlendMode("NORMAL")` on every
  // object in the file would be a line restating a default on every object in
  // the file. The tint branch's own call, one property over.
  //
  // `setBlendMode` returns `this` (checked in `types/phaser.d.ts`, not
  // recalled), so unlike the physics setters and the filter calls it genuinely
  // chains. And the argument is the **quoted string**, which is the spelling
  // this exporter has used for exactly this value in the emitter config literal
  // since iteration 15 — so it is already proved to type-check under
  // `tsc --strict`, it needs nothing of the shared `create()` body that can
  // carry no cast, and `Phaser.BlendModes.ADD` would say the same thing in more
  // characters. Phaser declares the parameter `string | Phaser.BlendModes |
  // number`.
  //
  // A `particles` node is excluded, and that is not the wrapper argument the
  // renderer makes — it is that an emitter's mode is already in the config
  // literal `constructorFor` emits, whole. Emitting both would be the same fact
  // twice, and moving it out of the config into the chain would break the
  // whole-config rule and the byte-for-byte rule in one go.
  if (node.type !== 'particles') {
    const blend = blendModeOf(node);
    if (blend !== 'NORMAL') out.push(`.setBlendMode(${str(blend)})`);
  }
  if (scaleX !== 1 || scaleY !== 1) out.push(`.setScale(${num(scaleX)}, ${num(scaleY)})`);

  // The second new branch in this function since `tileSprite`, and it follows
  // this function's rule as the blend mode above it does: printed only where it
  // differs from Phaser's own default, so `.setScrollFactor(1, 1)` is never one
  // line on every object in the file and every project that predates this
  // exports byte for byte what it exported before. A scroll factor means
  // something entirely alone — one fact about one object, like a tint or a flip
  // — which is what puts it on this side of the line rather than beside the
  // emitter config and the physics body, whose dials only mean anything next to
  // each other.
  //
  // `setScrollFactor(x, y?)` returns `this` (checked in `types/phaser.d.ts`,
  // not recalled), so it genuinely chains; and the one-argument form means both
  // axes, which is why an object pinned on both is `.setScrollFactor(0)` rather
  // than `.setScrollFactor(0, 0)` — Phaser's own shorthand, in Phaser's own
  // spelling.
  //
  // **A `tilemap` needs nothing here**, and that is worth saying because it is
  // the one type where one chain visibly has several objects to reach.
  // `emitNode` emits the further layers as siblings and reuses *this same
  // chain* string for each of them, so a stack scrolls as one piece for free. A
  // map whose floor lagged behind its walls is exactly the failure that would
  // read as the feature half-working.
  //
  // **A `particles` node is included**, and that is the one place this parts
  // company with the blend mode directly above. That one excludes an emitter
  // because its mode is already inside the config literal `constructorFor`
  // emits whole; `scrollFactor` is *not* a `ParticleEmitterConfig` key at all
  // (checked — the emitter reads `scrollFactorX`/`scrollFactorY` off itself in
  // its renderer), so the chain is the only place it can go.
  const scroll = scrollFactorOf(node, topLevel);
  if (!isDefaultScrollFactor(scroll)) {
    out.push(
      scroll.x === scroll.y
        ? `.setScrollFactor(${num(scroll.x)})`
        : `.setScrollFactor(${num(scroll.x)}, ${num(scroll.y)})`,
    );
  }

  // White is Phaser's untinted state under the default multiply mode, so
  // emitting setTint(0xffffff) would be a no-op line on every one of these.
  if (
    (node.type === 'sprite' || node.type === 'nineslice' || node.type === 'tileSprite') &&
    hexLiteral(node.props.tint) !== '0xffffff'
  ) {
    out.push(`.setTint(${hexLiteral(node.props.tint)})`);
  }

  if (node.type === 'tileSprite') {
    // The one pair of fields in either new type that `constructorFor` has
    // nowhere to put: `add.tileSprite` takes the box and the texture and
    // nothing else. Both setters return the object, so they chain like the
    // rest, and both are emitted only when they differ from a plain repeat —
    // this function's own rule, unlike the panel's insets.
    if (node.props.tilePositionX !== 0 || node.props.tilePositionY !== 0) {
      out.push(
        `.setTilePosition(${num(node.props.tilePositionX)}, ${num(node.props.tilePositionY)})`,
      );
    }
    if (node.props.tileScaleX !== 1 || node.props.tileScaleY !== 1) {
      out.push(`.setTileScale(${num(node.props.tileScaleX)}, ${num(node.props.tileScaleY)})`);
    }
  }

  if (node.type === 'sprite') {
    if (node.props.flipX || node.props.flipY) {
      out.push(`.setFlip(${node.props.flipX}, ${node.props.flipY})`);
    }
    // Last of the sprite modifiers, and after the tint and the flip it inherits
    // — `play` returns the sprite, so this is a chain link like the others.
    const animation = node.props.animationId
      ? animations.get(node.props.animationId)
      : undefined;
    if (animation) out.push(`.play(${str(animation.key)})`);
  }

  if (node.props.alpha !== 1) out.push(`.setAlpha(${num(node.props.alpha)})`);
  if (!node.visible) out.push('.setVisible(false)');
  return out;
}

/**
 * Emits the statements for one node and, when it is a container, for everything
 * inside it. Returns the identifier it bound the object to, or null when the
 * node produced no code at all.
 *
 * A group is emitted as its own `const`, then its children, then one
 * `group.add([...])` — the same shape the Phaser docs use, and flat rather than
 * nested so that every object in the scene stays a top-level binding the reader
 * can reach.
 */
function emitNode(
  node: GameObjectNode,
  ctx: EmitContext,
  used: Set<string>,
  lines: string[],
  nested = false,
): string[] | null {
  const constructor = constructorFor(node, ctx);
  if (constructor === null) {
    // Say so rather than skipping silently: an object missing from the export
    // with no explanation reads as an exporter bug.
    lines.push(`// ${commentText(node.name)}: ${missingReason(node)}`);
    lines.push('');
    return null;
  }

  const id = toIdentifier(node.name, used);
  // `!nested` is the top-level rule, already in hand: a container's children and
  // a prefab definition's are both emitted with `nested` true, which is exactly
  // the pair `scrollFactorOf` strips.
  const modifiers = modifiersFor(node, ctx.animations, !nested);
  const chain = modifiers.length > 0 ? `\n      ${modifiers.join('\n      ')}` : '';
  lines.push(`const ${id} = ${constructor}${chain};`);
  // Carries the editor name through, so objects stay findable at runtime.
  lines.push(`${id}.setName(${str(node.name)});`);

  // `nested` is the whole of "only a top-level object gets a body", and it is
  // one boolean rather than a rule three call sites remember: the container
  // recursion below passes it, and so does every prefab factory body. Both are
  // the same fact — an Arcade body reads its owner's `x`/`y` as world
  // coordinates, and a child of a Container has neither.
  const body = physicsOf(node, !nested);
  if (body) lines.push(...bodyLines(id, node, body, ctx.engine, ctx, used));

  // A tilemap's further layers, each one its own object beside the first.
  //
  // Siblings rather than a wrapper Container, and the reason is the one the
  // renderer answers the other way round. A `TilemapLayer` *is* the thing
  // Arcade collides against, so a collider naming this map has to name a layer;
  // wrapping them would leave it with a Container and nothing to bind to. They
  // are also created in sequence, which is exactly the display-list order the
  // document's layer order asks for. And because the first layer is emitted by
  // `constructorFor` unchanged, a map with one layer emits what it always did,
  // character for character.
  //
  // Every modifier is applied to each layer rather than to one: the transform,
  // the angle, the scale and the alpha belong to the node, and the layers are
  // the same object drawn in several passes.
  const ids = [id];
  const tilemap = node.type === 'tilemap' ? ctx.tilemaps.get(node.id) : undefined;
  if (tilemap) {
    const { x, y } = node.transform;
    tilemap.layers.slice(1).forEach((layer, offset) => {
      const layerId = toIdentifier(layer.name, used);
      const call = tilemapCall(tilemap, offset + 1, ctx, x, y);
      lines.push(`const ${layerId} = ${call}${chain};`);
      lines.push(`${layerId}.setName(${str(layer.name)});`);
      ids.push(layerId);
    });
    // A hidden layer is still built and still collides — visibility is about
    // drawing, exactly as it is for a hidden node whose Arcade body is emitted
    // all the same. It is a statement rather than part of the chain because the
    // chain is `modifiersFor`'s and belongs to the node, and the first layer's
    // has already been written by the time this is known.
    tilemap.layers.forEach((layer, index) => {
      if (!layer.visible) lines.push(`${ids[index]}.setVisible(false);`);
    });
  }

  // The tween, last in the node's own block and emitted as its own statement.
  //
  // Not the epilogue, where the camera's `startFollow` and the collider rows
  // go: those name bindings the object list has not made yet, and a tween names
  // only the binding on the line above. And `${ctx.receiver}` is what makes the
  // same emit correct in both places verbatim — `this.tweens.add` inside a
  // Scene method, `scene.tweens.add` inside a prefab factory, which a tween on
  // a definition's child needs and which the canvas already animates in every
  // instance. That is the field `EmitContext` exists for.
  //
  // `targets` is the whole `ids` list rather than the first, so a tilemap of
  // several layers travels as one object instead of sliding its floor out from
  // under its walls.
  //
  // No gate and no table: the block sits inside the successful branch, so a
  // project with no tween emits byte for byte what it emitted before, and a
  // tween on a node that emitted no object never reaches this line at all —
  // which is why `missingReason` needs no branch for one.
  // The effects, before the tween and after everything that built the object.
  //
  // Here rather than in the epilogue where the camera's `startFollow` and the
  // collider rows go, for the tween's reason: those name bindings the object
  // list has not made yet, and this names only the binding on the line above.
  // And unlike the tween it needs no `ctx.receiver` at all, which is what makes
  // the same emit correct verbatim inside a prefab factory: a filter list is
  // reached through the object rather than through the scene.
  //
  // `modifiersFor` gains nothing for this, and that is worth saying because on
  // that function "no branch needed" and "forgot a branch" look identical:
  // `enableFilters()` returns the object and could chain, but
  // `filters.internal.addGlow()` answers with the *controller*, and `filters`
  // is nullable in a way no chain can narrow.
  //
  // No gate here and nothing to suppress — a node with no effects never reaches
  // the line, and one that emitted no object never reaches it either, which is
  // why `missingReason` needs no branch for one.
  //
  // The calls are built *before* the gate rather than inside it, because a mask
  // naming an image the file does not load answers with no call — so a node
  // whose only effect is one of those would otherwise emit an `enableFilters`
  // and an empty `if` block. Only a hand-edited file can reach that, since
  // `removeAsset` clears the reference, but an empty block in generated code is
  // a reader's question with no answer.
  const effectCalls = effectsOf(node).flatMap((effect) => {
    const call = effectCallFor(effect, ctx.assets);
    return call ? [call] : [];
  });
  if (effectCalls.length > 0) {
    // Drawn from `create()`'s identifier set rather than pasted onto `id`,
    // which is `bodyLines`' binding and the sound handles' rule: an object a
    // user called "coin filters" must not take the binding the line beside it
    // reaches for. It is suffixed for their reason too — the object keeps
    // `coin` and this gets `coinFilters`, rather than one of them becoming
    // `coin2` with nothing saying which is which.
    const list = toIdentifier(`${node.name} filters`, used);
    lines.push(`const ${list} = ${ctx.effectsFn}(${id});`);
    // A plain `if`, never a `!` or a cast: this body is the same JavaScript in
    // the `.ts`, the `.js` and the runnable page, so it can carry neither. The
    // emitted keyboard block's narrowing, one helper over.
    lines.push(`if (${list}) {`);
    for (const call of effectCalls) lines.push(`  ${list}.${call};`);
    lines.push('}');
  }

  const tween = tweenOf(node);
  if (tween) {
    const targets = ids.length > 1 ? `[${ids.join(', ')}]` : id;
    const properties = TWEEN_PROPERTIES.flatMap((property) => {
      const value = tween.to[property];
      if (value === undefined) return [];
      // `TWEEN_PHASER_KEY`, never the document's own name: `rotation` on a Game
      // Object is radians and this document's is degrees, so emitting the
      // document's name is a legal tween of 180 radians that compiles, runs and
      // is wrong by a factor of 57.
      return [`${TWEEN_PHASER_KEY[property]}: ${num(value)}`];
    });
    // Emitted whole, defaults included — the emitter config's and the physics
    // body's call rather than `modifiersFor`'s, because these dials only mean
    // anything beside each other: a yoyo says nothing without a duration, a
    // repeat delay nothing without a repeat. The six properties are the
    // exception and are emitted only where they exist, because an absent one is
    // not a default — it is a property this tween is not about, and printing
    // the object's current value would emit a tween that holds it still.
    // A rule that starts this tween needs a handle to start, and a tween that
    // waits for one has to be created paused. Both only when a rule names it,
    // so a project with no `startTween` action emits the bare statement it
    // always did, character for character.
    //
    // `persist: true` goes with `paused: true` rather than being a separate
    // decision: Phaser destroys a completed tween unless told otherwise, so a
    // rule that can fire twice would find its handle pointing at a corpse.
    const started = ctx.ruleTweens.get(node.id);
    lines.push(
      started ? `const ${started} = ${ctx.receiver}.tweens.add({` : `${ctx.receiver}.tweens.add({`,
    );
    lines.push(`  targets: ${targets},`);
    for (const property of properties) lines.push(`  ${property},`);
    lines.push(`  duration: ${num(tween.duration)},`);
    lines.push(`  delay: ${num(tween.delay)},`);
    // Through `str` even though `tweenOf` has already allowlisted it, by the
    // rule that nothing free-text reaches the output unquoted.
    lines.push(`  ease: ${str(tween.ease)},`);
    lines.push(`  yoyo: ${tween.yoyo},`);
    lines.push(`  repeat: ${num(tween.repeat)},`);
    lines.push(`  repeatDelay: ${num(tween.repeatDelay)},`);
    if (started) {
      lines.push('  paused: true,');
      lines.push('  persist: true,');
    }
    lines.push('});');
  }

  // The label, after the tween and last in the node's own block, and the tween's
  // paragraph applies to it word for word: its own statement rather than a link
  // in the chain, inside the successful branch, and through `${ctx.receiver}` so
  // that a labelled text node inside a prefab definition binds against the scene
  // its factory was handed. A node that emitted no object never reaches this
  // line, which is why `missingReason` needs no branch for one.
  //
  // Resolved through `ctx.variables` rather than through `labelOf`, and only
  // because `collectVariables` is unfiltered over the whole project: the table
  // holds every declared variable, so `get` answering `undefined` *is*
  // `findVariable` answering `undefined`, and a dangling label falls back to the
  // plain caption in the export exactly as it does on the canvas. The format is
  // repaired by the reader's own `labelFormatOf`, so the two cannot drift.
  //
  // The three arguments are emitted whole, defaults included — the tween config's
  // call and the body's, because a caption, a key and a format only mean
  // anything beside each other.
  if (node.type === 'text' && node.props.label) {
    const labelled = ctx.variables.get(node.props.label.variableId);
    if (labelled) {
      const { decimals, pad } = labelFormatOf(node.props.label);
      lines.push(
        `${ctx.bindLabelFn}(${ctx.receiver}, ${id}, ${str(labelled.key)}, ` +
          `${str(node.props.text)}, ${num(decimals)}, ${num(pad)});`,
      );
    }
  }

  lines.push('');

  if (node.type === 'container' && node.children.length > 0) {
    const childIds = node.children
      .flatMap((child) => emitNode(child, ctx, used, lines, true) ?? []);
    // Added after the children are built, and in document order: a container's
    // list order is its draw order, exactly as the scene's array is.
    if (childIds.length > 0) {
      lines.push(`${id}.add([${childIds.join(', ')}]);`);
      lines.push('');
    }
  }

  return ids;
}

/**
 * Why a node emitted nothing, for the comment that stands in its place.
 *
 * A tween adds no case, and that is structural rather than an oversight: a node
 * with no constructor takes `emitNode`'s early return long before the tween
 * block, so a tween on an image-less sprite is correctly and silently absent
 * along with the sprite. There is no half-emitted state for one to explain.
 */
function missingReason(node: GameObjectNode): string {
  if (node.type === 'instance') {
    return 'the prefab it placed is no longer in the project, so nothing to add.';
  }
  // Two ways for a tilemap to have no tileset, and they need different fixes:
  // one is answered in the asset picker and the other in the slicer, so the
  // comment says which. The first now covers an atlas-cut image as well as an
  // uncut one — "not cut into a uniform grid" is the true thing about both, and
  // the fix is the same either way, so this stays one branch rather than
  // growing a project parameter it would need to tell them apart.
  if (node.type === 'tilemap') {
    return node.props.assetId
      ? 'its image is not cut into a uniform grid of tiles, so there is no tileset to build.'
      : 'no tileset chosen in the editor, so nothing to add.';
  }
  // The fallback covers a sprite, an emitter, a panel and a tile sprite alike,
  // and says the same true thing about all four: without an image there is no
  // object to add. This is the one function on the export checklist that needed
  // no edit for the two new types, which is worth saying — here "already
  // covered" and "forgotten" read the same.
  return 'no image chosen in the editor, so nothing to add.';
}

/**
 * Free user text on its way into a `//` comment.
 *
 * A line comment ends at the first newline, so a name containing one puts
 * whatever follows it into the generated file *as code*. `escapeForScriptTag`
 * does not help — a newline inside a comment is perfectly legal HTML and
 * perfectly legal JavaScript, which is the problem. U+2028/9 terminate a line
 * for the same purposes and go the same way.
 */
function commentText(text: string): string {
  return text.replace(/[\r\n\u2028\u2029]+/g, ' ');
}

/**
 * One factory function per placed prefab, above the class.
 *
 * The signature is the one place the two languages differ by more than the
 * `: void` on the methods: a bare `function createCoin(scene, x, y)` is three
 * implicit `any`s, and the exported `.ts` is compiled under `--strict`, so it
 * would not build. The annotations are therefore language-dependent, while the
 * *body* is the same `emitNode` both outputs already share — which is the
 * property that actually matters, since it is what stops the runnable page
 * drifting from the file you ship.
 *
 * Every binding inside a factory is function-scoped, so each body gets its own
 * identifier set — seeded with the parameters, the root, and every factory
 * name, because an object inside a definition called "scene" or called
 * "create coin" would otherwise shadow the thing the body is using.
 */
function buildFactories(
  ctx: EmitContext,
  language: SceneLanguage,
  indent: string,
): string {
  const factoryNames = [...ctx.prefabs.values()].map((entry) => entry.fn);
  const typed = language === 'ts';
  const params = typed ? 'scene: Phaser.Scene, x: number, y: number' : 'scene, x, y';
  const returns = typed ? ': Phaser.GameObjects.Container' : '';

  // The one thing the factory changes about the emit: objects are added to the
  // scene it was handed, not to a `this` it does not have.
  const inner: EmitContext = { ...ctx, receiver: 'scene' };

  const blocks = [...ctx.prefabs.values()].map((entry) => {
    const used = new Set<string>([
      'scene',
      'x',
      'y',
      'root',
      ctx.tilemapFn,
      ctx.bodyFn,
      ctx.touchFn,
      ctx.fitFn,
      ctx.matterFn,
      ctx.matterBodyFn,
      ctx.groundFn,
      ctx.initVariablesFn,
      ctx.keyFn,
      ctx.tapFn,
      ctx.matterHitFn,
      ctx.labelValueFn,
      ctx.bindLabelFn,
      ctx.onVarFn,
      ...factoryNames,
    ]);
    const lines: string[] = ['const root = scene.add.container(x, y);', ''];
    // Through `withoutInstances`, which is the renderer's own view of a
    // definition and until iteration 34 was the one thing this function did not
    // share with it. A nested instance that resolves to a prefab in this table
    // emits a call to that prefab's factory, and a mutual pair emits two
    // functions that call each other — unbounded recursion in the *player's*
    // game. It was survivable only because this table held placed definitions
    // alone; `spawn` widens it. Identical output for every well-formed project,
    // because the array comes back by identity when there is nothing to strip.
    const childIds = withoutInstances(entry.prefab.children).flatMap(
      (child) => emitNode(child, inner, used, lines, true) ?? [],
    );
    if (childIds.length > 0) lines.push(`root.add([${childIds.join(', ')}]);`, '');
    lines.push('return root;');

    const body = lines.map((line) => (line ? `  ${line}` : '')).join('\n');
    return `function ${entry.fn}(${params})${returns} {\n${body}\n}`;
  });

  return blocks.join('\n\n').replace(/^(?!$)/gm, indent);
}

/**
 * The `sound.add` calls for the sounds this scene registers.
 *
 * What this emits is a handle and nothing else, and that is the feature rather
 * than a limitation of it. *Registering* a sound is layout — it belongs to the
 * scene the way its background colour and its gravity do — while *when* a sound
 * plays is game logic, which is the argument that keeps `scene.start` out of
 * the document. So `jumpSound.play()` stays the one line the user writes, and
 * this is what that line reaches. `mass` and `immovable` are emitted for
 * exactly this reason one feature over: the hand-written line is the collider,
 * and those are the properties it reads.
 *
 * `this` is hardcoded rather than taken from `ctx.receiver`, and that is not an
 * oversight either. `receiver` exists because *one* emitter runs in two places,
 * inside a Scene method and inside a prefab factory; this one runs in one,
 * because a sound belongs to a scene and a definition has no scene of its own.
 * Writing `${ctx.receiver}` would read as though a factory could reach here,
 * and the day one did, its sound would be added against a key nothing in
 * `usedIn` had loaded — which throws.
 *
 * `sound.get(...) ?? sound.add(...)` is the `anims.exists` guard above by a
 * different route, and it needs one because the failure it prevents is louder.
 * `anims.create` on a key the manager already holds is refused with a warning;
 * `sound.add` on a duplicate key is *accepted*, and answers with a second sound
 * object — so a scene that runs `create()` twice, which is the ordinary way a
 * game returns to its menu, would end up with two copies of a looping theme
 * playing over each other. The `??` form was checked against Phaser 4's real
 * types before being written: `Scene.sound` is a union of three managers, and
 * both `get` and `add` synthesise a call across it.
 */
function buildSoundLines(
  project: Project,
  scene: SceneDoc,
  audio: Map<string, UsedAudio>,
  used: Set<string>,
): { lines: string[]; handles: Map<string, string> } {
  const sounds = soundsOf(project, scene);
  // Keyed by the *row's* id rather than the audio file's, because that is what
  // a `playSound` action names — one file registered twice in a scene is two
  // rows with two volumes and two handles, and an action has to say which.
  const handles = new Map<string, string>();
  if (sounds.length === 0) return { lines: [], handles };

  const lines: string[] = [
    '// Sounds from the editor, ready for a line of your own: jumpSound.play().',
  ];

  for (const sound of sounds) {
    const entry = audio.get(sound.audioId);
    // `soundsOf` has already dropped a row whose sound is missing, so every
    // row here is in the table. There is no "it emitted nothing" comment to
    // write, which is why `missingReason` needed no audio branch.
    if (!entry) continue;

    // `<key>Sound` rather than the bare key, out of `create()`'s own identifier
    // set and before any object draws from it. Both halves matter. Allocating
    // first is the prefab factories' rule one level down — an object the user
    // named "jump" must not take a binding a hand-written line is reaching for.
    // Suffixing is what stops that precedence being a theft: the sound gets
    // `jumpSound`, the object keeps `jump`, and neither is `jump2` with nothing
    // saying which is which.
    const id = toIdentifier(`${entry.key} sound`, used);
    lines.push(
      `const ${id} = this.sound.get(${str(entry.key)}) ?? ` +
        `this.sound.add(${str(entry.key)}, ` +
        `{ loop: ${sound.loop}, volume: ${num(sound.volume)} });`,
    );
    // Its own statement rather than a chain link: `BaseSound.play()` answers
    // with a boolean rather than the sound, so it is the one `.play` in this
    // file that cannot be appended to the constructor the way a Sprite's is.
    // It is also why `autoplay` is not in the config literal above — it is not
    // a `SoundConfig` key, and an excess property on a fresh object literal
    // would fail the exported `.ts` under `--strict` while the `.js` passed.
    if (sound.autoplay) lines.push(`${id}.play();`);
    handles.set(sound.id, id);
  }
  lines.push('');
  return { lines, handles };
}

/**
 * The names a `Phaser.Scene` already answers to.
 *
 * A driven object has to outlive `create()`'s `const`, so it is parked on the
 * scene — and `this.player` lands in the same namespace as `this.physics` and
 * `this.input`. Seeding the field set with these is the prefab factories' rule
 * one level over: an object a user called "input" must not take a property the
 * line beside it is reaching through.
 *
 * The list is Phaser's `Scene` instance properties plus the lifecycle methods
 * this file emits. It does not have to be exhaustive to be safe, and it is not
 * a list that goes stale in a way that breaks anything: a name it misses is one
 * the user chose that Phaser also uses, which is a collision `toIdentifier`
 * would have resolved had it known, and a name it holds that Phaser dropped
 * costs one object a suffix it did not need.
 */
const SCENE_MEMBERS: readonly string[] = [
  'add',
  'anims',
  'cache',
  'cameras',
  'children',
  'create',
  'data',
  'events',
  'game',
  'input',
  'lights',
  'load',
  'make',
  'matter',
  'physics',
  'plugins',
  'preload',
  'registry',
  'renderer',
  'scale',
  'scene',
  'sound',
  'sys',
  'textures',
  'time',
  'tweens',
  'update',
];

/** One object the player drives, resolved down to what the emitters need. */
interface DrivenObject {
  /** The `this.<field>` the object is parked on so `update()` can reach it. */
  field: string;
  /** The `const` `create()` bound it to. */
  binding: string;
  controls: NodeControls;
  /**
   * The `this.<field>` holding this object's grounded tracker, for a Matter
   * platformer and nothing else. Arcade reads `blocked.down` off the body and
   * needs no such thing.
   */
  ground?: string;
}

/**
 * The keys `create()` opens, as a `this.<field>` per scheme.
 *
 * A WASD set is emitted as a whole `CursorKeys` — six keys, `space` and `shift`
 * included — rather than the four it reads, and that is a type decision as much
 * as a convenience one: `Phaser.Types.Input.Keyboard.CursorKeys` names all six
 * and none of them is optional, so a four-key literal could not be given that
 * type, and the exported `.ts` would need a shape of its own for a difference
 * `update()` cannot see. `addKeys('W,A,S,D')` was the other route and is worse:
 * its declared return is a bare `object`, so every property access below it
 * fails under `--strict`.
 */
function buildKeyboardLines(
  schemes: ReadonlySet<NodeControls['scheme']>,
  local: string,
  fields: { arrows: string; wasd: string },
): string[] {
  // Narrowed with a plain `if` rather than a `!`, and this is the constraint
  // that shapes the whole emitted block: `this.input.keyboard` is
  // `KeyboardPlugin | null` under `--strict`, and the `create()` body is the
  // *same plain JavaScript* in the `.ts`, the `.js` and the runnable page — so
  // it cannot carry an assertion, a cast or an annotation. A `const` and an
  // `if` narrow it in a way all three accept.
  const lines = [`const ${local} = this.input.keyboard;`, `if (${local}) {`];
  if (schemes.has('arrows')) {
    lines.push(`  this.${fields.arrows} = ${local}.createCursorKeys();`);
  }
  if (schemes.has('wasd')) {
    lines.push(`  this.${fields.wasd} = {`);
    for (const [name, key] of [
      ['up', 'W'],
      ['down', 'S'],
      ['left', 'A'],
      ['right', 'D'],
      ['space', 'SPACE'],
      ['shift', 'SHIFT'],
    ]) {
      lines.push(`    ${name}: ${local}.addKey(${str(key)}),`);
    }
    lines.push('  };');
  }
  lines.push('}');
  return lines;
}

/**
 * The body of `update()` — the first thing this exporter has ever emitted that
 * runs on every frame.
 *
 * It does not make the editor simulate anything: the canvas still draws a body
 * and never runs one, and this is only what the *exported* game is handed. What
 * it does is state a standing fact about the world — which object the player
 * drives, and how it answers the keys — where what should *happen* when that
 * object reaches something is a sequence of events and stays the user's line to
 * write, exactly as the collider used to be.
 *
 * Velocity rather than acceleration, because a velocity is what "how fast does
 * this walk" means and it is the one that reads the same with and without drag.
 * The horizontal velocity is zeroed first so that letting go stops the object,
 * which is what a player expects and what an accelerating body would not do.
 *
 * A platformer's jump is gated on `blocked.down` — Arcade's own flag for
 * "there is something under me this step", which is exactly the tilemap the
 * solid tiles just built or the platform the collider just added. Without it a
 * held key flies.
 */
function buildUpdateBody(
  driven: DrivenObject[],
  fields: { arrows: string; wasd: string },
  touchField: string,
  ctx: EmitContext,
): string {
  if (driven.length === 0) return '';

  // `update()` is its own scope, so its own identifier set — seeded like
  // `create()`'s, since the module-level helpers are as reachable from here as
  // from there and an object named "arcade body" must not shadow one.
  const used = new Set<string>([
    'this',
    ctx.tilemapFn,
    ctx.bodyFn,
    ctx.touchFn,
    ctx.fitFn,
    ctx.matterFn,
    ctx.matterBodyFn,
    ctx.groundFn,
    ctx.initVariablesFn,
    ctx.keyFn,
    ctx.tapFn,
    ctx.matterHitFn,
    ctx.labelValueFn,
    ctx.bindLabelFn,
    ctx.onVarFn,
    ...[...ctx.prefabs.values()].map((entry) => entry.fn),
  ]);

  const keyLocal = new Map<NodeControls['scheme'], string>();
  const lines: string[] = [];
  for (const scheme of ['arrows', 'wasd'] as const) {
    if (!driven.some((entry) => entry.controls.scheme === scheme)) continue;
    const field = scheme === 'arrows' ? fields.arrows : fields.wasd;
    const local = toIdentifier(field, used);
    keyLocal.set(scheme, local);
    lines.push(`const ${local} = this.${field};`);
  }

  // One local for the whole scene, because there is one set of buttons for the
  // whole scene — the flags belong to the canvas rather than to any one object,
  // so two driven objects read the same five.
  const touch = touchField && driven.some((entry) => entry.controls.touch)
    ? toIdentifier(touchField, used)
    : '';
  if (touch) lines.push(`const ${touch} = this.${touchField};`);

  for (const entry of driven) {
    const { field, controls } = entry;
    const keys = keyLocal.get(controls.scheme) as string;
    const object = toIdentifier(field, used);
    const body = toIdentifier(`${field} body`, used);
    const vx = toIdentifier(`${field} vx`, used);
    const vy = toIdentifier(`${field} vy`, used);
    const ground = toIdentifier(`${field} ground`, used);
    const speed = num(controls.speed);
    // An object with no buttons emits exactly what it emitted before this
    // existed, byte for byte — the rule the asset table, the tilemap helper and
    // the prefab factories all follow, and the reason this reads as two shapes
    // rather than one widened one.
    //
    // For an object that *has* buttons the keyboard guard has to move out of
    // the `if` and into each condition, and that is not tidiness: on a phone
    // `this.input.keyboard` is null, so the field is never assigned, so the old
    // guard fails and the object is not driven at all — which would leave the
    // buttons doing nothing on precisely the device they exist for.
    const held = (direction: string, flag: string) =>
      touch && controls.touch
        ? `(${keys} && ${keys}.${direction}.isDown) || ${touch}.${flag}`
        : `${keys}.${direction}.isDown`;
    // The buttons rather than the keys, and never both: `create()` assigns the
    // flags unconditionally where it only *may* assign the key fields, so this
    // is the one that can be relied on — and it is what narrows the `.ts`'s
    // `| undefined` field for the reads below.
    const guard = touch && controls.touch ? `${object} && ${touch}` : `${keys} && ${object}`;

    lines.push('');
    lines.push(`const ${object} = this.${field};`);
    // Both guarded together, and with an `if` rather than an early `return`:
    // a second driven object below must still be updated when the first one is
    // somehow missing.
    lines.push(`if (${guard}) {`);
    if (ctx.engine === 'matter') {
      // Matter measures velocity in pixels per *step* rather than per second,
      // so the document's speed is divided by the 60 steps `Body.setVelocity`
      // works in — the same conversion the body's own dials take, for the same
      // reason: the document says one thing in one unit whichever engine reads
      // it.
      const step = (value: number) => num(value / 60);
      lines.push(`  const ${body} = ${ctx.matterBodyFn}(${object});`);
      if (controls.mode === 'topDown') {
        lines.push(`  let ${vx} = 0;`);
        lines.push(`  let ${vy} = 0;`);
        lines.push(`  if (${held('left', 'left')}) ${vx} = -${step(controls.speed)};`);
        lines.push(`  else if (${held('right', 'right')}) ${vx} = ${step(controls.speed)};`);
        lines.push(`  if (${held('up', 'up')}) ${vy} = -${step(controls.speed)};`);
        lines.push(`  else if (${held('down', 'down')}) ${vy} = ${step(controls.speed)};`);
        lines.push(
          `  this.matter.body.setVelocity(${body}, { x: ${vx}, y: ${vy} });`,
        );
      } else {
        // The vertical velocity is read back rather than zeroed, because
        // `Body.setVelocity` sets both axes where Arcade's `setVelocityX` sets
        // one — writing a zero here would hold the object in mid-air and make
        // gravity look broken.
        lines.push(`  let ${vx} = 0;`);
        lines.push(`  let ${vy} = ${body}.velocity.y;`);
        lines.push(`  if (${held('left', 'left')}) ${vx} = -${step(controls.speed)};`);
        lines.push(`  else if (${held('right', 'right')}) ${vx} = ${step(controls.speed)};`);
        const pressed = held('up', 'jump');
        const jumped = touch && controls.touch ? `(${pressed})` : pressed;
        // Arcade's `blocked.down` is a flag Matter has not got, so this is the
        // tracker's window: `collisionactive` fires on the physics step and
        // this runs on the frame, and the two are not one to one.
        lines.push(`  const ${ground} = this.${entry.ground as string};`);
        lines.push(
          `  if (${jumped} && ${ground} && this.time.now - ${ground}.at < 120) {`,
        );
        lines.push(`    ${vy} = -${step(controls.jump)};`);
        lines.push('  }');
        lines.push(
          `  this.matter.body.setVelocity(${body}, { x: ${vx}, y: ${vy} });`,
        );
      }
    } else {
      lines.push(`  const ${body} = ${ctx.bodyFn}(${object});`);
      lines.push(`  ${body}.setVelocityX(0);`);
      lines.push(`  if (${held('left', 'left')}) ${body}.setVelocityX(-${speed});`);
      lines.push(`  else if (${held('right', 'right')}) ${body}.setVelocityX(${speed});`);
      if (controls.mode === 'topDown') {
        lines.push(`  ${body}.setVelocityY(0);`);
        lines.push(`  if (${held('up', 'up')}) ${body}.setVelocityY(-${speed});`);
        lines.push(`  else if (${held('down', 'down')}) ${body}.setVelocityY(${speed});`);
      } else {
        // The pad's up is not a platformer's jump: the jump has a button of its
        // own on the other side of the canvas, which is what lets a thumb hold a
        // direction and jump at the same time.
        // Parenthesised only when there is something to parenthesise, so an
        // object with no buttons still emits this line character for character.
        const pressed = held('up', 'jump');
        const jumped = touch && controls.touch ? `(${pressed})` : pressed;
        lines.push(
          `  if (${jumped} && ${body}.blocked.down) ` +
            `${body}.setVelocityY(-${num(controls.jump)});`,
        );
      }
    }
    lines.push('}');
  }

  return lines.map((line) => (line ? `    ${line}` : '')).join('\n');
}

/** What `create()` built, and what `update()` needs to know about it. */
interface CreateBody {
  body: string;
  /** Already indented and ready to drop into the method, or '' for no method. */
  update: string;
  /**
   * The `this.<field>` declarations the `.ts` output needs, in order. Empty for
   * the `.js` and the page, which declare nothing.
   */
  fields: { name: string; type: string }[];
}

/** The body of `create()`, shared verbatim by both outputs. */
/**
 * The clips the rules of one scene name.
 *
 * Shared by `collectAnimations`, which decides what a clip is *called* across
 * the file, and by `usedIn`, which decides what *this* scene registers —
 * `familiesIn`'s shape, and for the pair's usual reason. Missing either is one
 * of the two failures this file names most often: a key nothing registered, so
 * `anims.play` warns and the sprite never moves, or a clip registered over a
 * texture the scene never loaded, which throws in `generateFrameNumbers` before
 * anything is drawn.
 */
function animationsNamedByRules(project: Project, scene: SceneDoc): Set<string> {
  const named = new Set<string>();
  for (const rule of rulesOf(project, scene)) {
    for (const action of rule.do) {
      if (action.kind === 'playAnimation') named.add(action.animationId);
    }
  }
  return named;
}

/**
 * The prefabs the rules of one scene build.
 *
 * `animationsNamedByRules`' sibling and the same shape for the same reason: a
 * rule can name something **no node walk can reach**. A prefab that is only
 * ever spawned is placed nowhere, so without this it gets no factory at all —
 * which is not a wrong picture but a `ReferenceError` in the runnable page and
 * a compile error in the exported `.ts` — and none of its images are preloaded.
 *
 * Read by exactly two places, and they are the pair this file keeps splitting:
 * `collectPrefabs`, which decides what a factory is *called* across the whole
 * file, and `emittedNodes`, which decides what *this* scene has to load.
 */
function prefabsNamedByRules(project: Project, scene: SceneDoc): Set<string> {
  const named = new Set<string>();
  for (const rule of rulesOf(project, scene)) {
    for (const action of rule.do) {
      if (action.kind === 'spawn') named.add(action.prefabId);
    }
  }
  return named;
}

/** One action, as the statements it emits. */
function ruleActionLines(
  action: RuleAction,
  ctx: EmitContext,
  bindings: Map<string, string[]>,
  soundHandles: Map<string, string>,
  animations: Map<string, UsedAnimation>,
): string[] {
  switch (action.kind) {
    case 'restartScene':
      return ['this.scene.restart();'];

    case 'startScene': {
      const key = ctx.sceneKeys.get(action.sceneId);
      return key === undefined ? [] : [`this.scene.start(${str(key)});`];
    }

    case 'destroy':
      // Every binding, not the first: a tilemap of several layers is destroyed
      // whole rather than losing its floor and keeping its walls — the tween's
      // `targets` argument, one action over.
      return (bindings.get(action.nodeId) ?? []).map((id) => `${id}.destroy();`);

    case 'spawn': {
      const entry = ctx.prefabs.get(action.prefabId);
      // The expression `constructorFor`'s `'instance'` case already builds, and
      // that is the whole feature: one factory per prefab has been emitted
      // since iteration 12, called once per placement and never again.
      //
      // **A statement, never a binding.** Nothing reads what comes back, which
      // is what keeps a rule's actions a list rather than a program — the
      // moment one action could name what another produced, the list would have
      // an order that depends on a result.
      //
      // `this` hardcoded rather than `ctx.receiver`, `buildSoundLines`' reason:
      // a rule only ever runs in a Scene's `create()`, and `${ctx.receiver}`
      // would read as though a prefab factory could reach one.
      return entry === undefined
        ? []
        : [`${entry.fn}(this, ${num(action.x)}, ${num(action.y)});`];
    }

    case 'setVisible':
      return (bindings.get(action.nodeId) ?? []).map(
        (id) => `${id}.setVisible(${action.visible});`,
      );

    case 'setText': {
      const key = action.variableId ? ctx.variables.get(action.variableId)?.key : undefined;
      // `str()` and a `+`, never a template the emit has to assemble: the
      // caption is a string literal and the value is one read, so the whole
      // expression is two terms a reader can see the shape of. `registry.get`
      // answers `any`, so the concatenation needs no annotation in a body that
      // cannot carry one — the convenience the conditions already rest on.
      // The formatter only when the action asks for one, so a `setText` written
      // before iteration 30 emits the line it always emitted, character for
      // character — the rule the asset table, the tilemap helper and the prefab
      // factories all follow. And the same formatter a bound label goes
      // through, which is the whole reason the two fields are on both.
      const format = key === undefined ? null : labelFormatOf(action);
      const formatted = format !== null && (format.decimals >= 0 || format.pad > 0);
      const read = key === undefined ? '' : `this.registry.get(${str(key)})`;
      const value =
        key === undefined
          ? str(action.text)
          : formatted
            ? `${str(action.text)} + ${ctx.labelValueFn}(${read}, ` +
              `${num(format.decimals)}, ${num(format.pad)})`
            : `${str(action.text)} + ${read}`;
      // `constructorFor`'s `'text'` case needed no edit for this, unlike
      // `playAnimation`'s (which widens an `Image` to a `Sprite`) and
      // `startTween`'s (which binds a handle): a `Text` is already a `Text`.
      return (bindings.get(action.nodeId) ?? []).map((id) => `${id}.setText(${value});`);
    }

    case 'playSound': {
      const handle = soundHandles.get(action.soundId);
      return handle === undefined ? [] : [`${handle}.play();`];
    }

    case 'stopSound': {
      const handle = soundHandles.get(action.soundId);
      return handle === undefined ? [] : [`${handle}.stop();`];
    }

    case 'playAnimation': {
      const id = bindings.get(action.nodeId)?.[0];
      const entry = animations.get(action.animationId);
      // The node is built as a `Sprite` rather than an `Image` precisely
      // because of this line — see `EmitContext.ruleAnimated`.
      return id === undefined || entry === undefined ? [] : [`${id}.play(${str(entry.key)});`];
    }

    case 'startTween': {
      const handle = ctx.ruleTweens.get(action.nodeId);
      // `play()` rather than `resume()` or `restart()`: it is the one verb that
      // works from every state a tween can be in — it clears the pause flag and
      // seeks back to the start if the tween has already finished, where
      // `resume` does neither and `restart` always rewinds.
      return handle === undefined ? [] : [`${handle}.play();`];
    }

    case 'setVelocity': {
      const id = bindings.get(action.nodeId)?.[0];
      // `[0]`, never a `.map`. A node's binding list holds more than one entry
      // only because a tilemap emits one object per layer, and a tilemap is not
      // in `PHYSICS_TYPES` — so a pushable node emits exactly one object.
      // `playAnimation`'s read rather than `destroy`'s. Undefined is a node
      // that emitted nothing at all, which is `missingReason`'s treatment and
      // the camera follow's.
      if (id === undefined) return [];
      // Two engines, two calls, and the one number the document holds is
      // converted here rather than stored twice. Matter measures velocity in
      // pixels per *step*, a step being its own 1000/60 ms base delta, so the
      // document's px/s is divided by 60 — the conversion `PhysicsBody`'s own
      // dials and the driven `update()` already make, and what lets a scene
      // switched from Arcade to Matter be pushed at exactly the same rate.
      //
      // `ctx.engine` is the *emitting scene's*: `buildCreateBody` overwrites it
      // per scene before the epilogue runs, so a project with one world of each
      // kind pushes each body the way its own world runs.
      //
      // `this` hardcoded rather than `${ctx.receiver}`, `buildSoundLines`' and
      // the camera effects' reason: a rule only ever runs in a Scene's
      // `create()`.
      //
      // **Neither helper needed a gate of its own, and that is worth saying
      // because on this checklist "already covered" and "forgotten" read
      // identically.** `physicsUsedIn` turns `physics.dynamic` on for a scene
      // holding a dynamic Arcade body and `physics.matter` on for a Matter
      // scene holding any body — and `ruleActionsOf` refuses this action unless
      // its node carries a dynamic body, which is the very same call on the
      // very same array. An accepted push cannot outrun its helper.
      return ctx.engine === 'matter'
        ? [
            `this.matter.body.setVelocity(${ctx.matterBodyFn}(${id}), ` +
              `{ x: ${num(action.x / 60)}, y: ${num(action.y / 60)} });`,
          ]
        : [`${ctx.bodyFn}(${id}).setVelocity(${num(action.x)}, ${num(action.y)});`];
    }

    case 'startParticles':
    case 'stopParticles':
    case 'burstParticles': {
      const id = bindings.get(action.nodeId)?.[0];
      // `[0]`, never a `.map` — `playAnimation`'s and `setVelocity`'s read. A
      // node's binding list holds more than one entry only because a tilemap
      // emits one object per layer, and a tilemap is not a `particles` node.
      // Undefined is an emitter that emitted nothing at all, which is an
      // emitter with no image: `missingReason` has already written the comment
      // in its place, and this is the camera follow's treatment of the same.
      if (id === undefined) return [];
      // **No helper, no cast, and therefore nothing drawn from the module
      // identifier set** — which is worth saying because `arcadeBody` and
      // `attachEffects` both exist for the opposite reason. `GameObject.body`
      // is a four-way union and `filters` is declared readonly and nullable,
      // so neither could be reached from the shared plain-JavaScript `create()`
      // body without a narrowing function. `add.particles(...)` answers with
      // the `ParticleEmitter` itself and all three verbs are on it, so these
      // lines type-check under `--strict` as they stand. Nothing above them
      // moved, and four helper names are asserted verbatim in the suite.
      //
      // The verbs are Phaser's where the document's kinds are the user's word
      // — the `collide`/`collider` split, one feature over.
      if (action.kind === 'startParticles') return [`${id}.start();`];
      // `stop()` and deliberately not `stop(true)`, which is what the editor's
      // own preview teardown uses. There, switching ▶ off has to put the canvas
      // back *immediately*, so what is in flight is killed. In a game "stop the
      // smoke" means stop making new smoke and let what is already out fade on
      // its own; killing it is a visible pop, and a field to choose between
      // them would be a dial nobody reaches for.
      if (action.kind === 'stopParticles') return [`${id}.stop();`];
      // `explode(count)` and not `explode(count, x, y)`. A burst at a point is
      // `spawn`'s question, and it would be the second thing this document can
      // say that has a *where* — which would owe the canvas a mark, since every
      // mark that canvas draws is a where. The emitter's own position is the
      // answer, and it is one the user can already see and drag.
      //
      // Worth knowing rather than discovering: `explode` sets `frequency = -1`
      // on the emitter for good, so an emitter a rule bursts does not flow
      // again afterwards. That is what a burst means, and it is also why a
      // burst puts its node in `ctx.ruleEmitters` beside a start.
      return [`${id}.explode(${num(action.count)});`];
    }

    // The five camera effects. `this` hardcoded rather than `ctx.receiver`, for
    // `buildSoundLines`' reason: a rule only ever runs in a Scene's `create()`,
    // never in a prefab factory, and `${ctx.receiver}` would read as though one
    // could reach it. Every argument is emitted whole, defaults included — the
    // camera prologue's call and the emitter config's, and here it is not even
    // a choice: these are positional arguments with no chain to leave one out
    // of. Nothing is gated, tabled or pre-passed, so a project with no camera
    // action emits byte for byte what it emitted before.
    case 'cameraShake':
      return [`this.cameras.main.shake(${num(action.duration)}, ${num(action.intensity)});`];

    case 'cameraFlash':
      return [
        `this.cameras.main.flash(${num(action.duration)}, ${rgbArgs(action.color, '255, 255, 255')});`,
      ];

    case 'cameraFade':
      // Two Phaser methods rather than a `fade(..., force)` flag: `fadeIn` is
      // how a scene comes *back* from a fade, and it is the same one verb the
      // document says with a direction.
      return [
        `this.cameras.main.${action.fadeIn ? 'fadeIn' : 'fade'}(` +
          `${num(action.duration)}, ${rgbArgs(action.color)});`,
      ];

    case 'cameraPan':
      // `pan` moves the camera's midPoint, which is why the document's own
      // `scrollX` is a top-left and these two are a centre. Named that way on
      // the panel for the same reason.
      return [
        `this.cameras.main.pan(${num(action.x)}, ${num(action.y)}, ` +
          `${num(action.duration)}, ${str(action.ease)});`,
      ];

    case 'cameraZoom':
      return [
        `this.cameras.main.zoomTo(${num(action.zoom)}, ${num(action.duration)}, ` +
          `${str(action.ease)});`,
      ];

    case 'setVar': {
      const key = ctx.variables.get(action.variableId)?.key;
      return key === undefined
        ? []
        : [`this.registry.set(${str(key)}, ${variableLiteral(action.value)});`];
    }

    case 'addVar': {
      const key = ctx.variables.get(action.variableId)?.key;
      // `inc` rather than a read-modify-write, and it is Phaser's own: it
      // treats an unset key as 0, so it cannot disagree with `initVariables`
      // about what a variable that has never been written holds.
      return key === undefined ? [] : [`this.registry.inc(${str(key)}, ${num(action.by)});`];
    }
  }
}

/**
 * One rule's body: its actions, behind its conditions.
 *
 * The conditions are **one gate on the whole list**, read once at the moment,
 * rather than a branch inside it — which is the half of this feature's line
 * that refuses OR, nesting and everything that would make a rule a program.
 * They are joined with `&&` because there is no OR: an OR is two rules.
 *
 * `registry.get` answers `any`, so the comparison compiles under `--strict`
 * with no annotation at all — which is the single most convenient thing about
 * building conditions on the registry rather than on fields of our own.
 */
function ruleBodyLines(
  rule: SceneRule,
  ctx: EmitContext,
  bindings: Map<string, string[]>,
  soundHandles: Map<string, string>,
  animations: Map<string, UsedAnimation>,
): string[] {
  const body = rule.do.flatMap((action) =>
    ruleActionLines(action, ctx, bindings, soundHandles, animations),
  );
  if (body.length === 0) return [];
  if (rule.conditions.length === 0) return body;

  const tests = rule.conditions.map((condition) => {
    const key = ctx.variables.get(condition.variableId)?.key ?? '';
    // `RULE_OPERATOR_JS`, never the document's own word: one is what a person
    // reads off a row and one is the language, and conflating them emits a
    // comparison that does not parse.
    return (
      `this.registry.get(${str(key)}) ${RULE_OPERATOR_JS[condition.op]} ` +
      variableLiteral(condition.value)
    );
  });
  return [`if (${tests.join(' && ')}) {`, ...body.map((line) => `  ${line}`), '}'];
}

/**
 * The rules of one scene, as the fourth thing emitted after the object list.
 *
 * After the objects because every rule names a binding the list has just made
 * — the reason `startFollow`, the collider rows and the driven `this.<field>`
 * assignments are already there. The epilogue then reads "where the camera
 * looks, what meets what, what the player drives, and what happens", which is
 * the right last paragraph.
 *
 * **`update()` gains nothing**, and that is the definition of this feature's
 * line rather than an implementation detail: every trigger here is a moment
 * Phaser already delivers, and not one of them is polled.
 *
 * Collide rules are **not** emitted here under Arcade — they are the third
 * argument of the `add.collider` call the collider loop above already writes,
 * because a rule changes that line rather than adding one. Under Matter they
 * are, through `matterHit`, because there is no row there to change.
 */
function buildRuleLines(
  project: Project,
  scene: SceneDoc,
  ctx: EmitContext,
  bindings: Map<string, string[]>,
  soundHandles: Map<string, string>,
): string[] {
  const lines: string[] = [];
  for (const rule of rulesOf(project, scene)) {
    const when = rule.when;
    // The Arcade collide case is written by the collider loop; a Matter one is
    // written here because Matter has no row to hang it on.
    if (when.kind === 'collide' && ctx.engine !== 'matter') continue;

    const body = ruleBodyLines(rule, ctx, bindings, soundHandles, ctx.animations);
    // A rule whose every action named something that did not reach the output
    // emits a comment rather than an empty listener — `missingReason`'s
    // treatment, and the camera follow's.
    if (body.length === 0) {
      lines.push(`// ${commentText(rule.name)}: nothing it does could be emitted.`);
      continue;
    }

    // The rule's own name above its block, because a wall of anonymous
    // listeners is unreadable and the name is the one thing that says which
    // row in the editor each one came from. Through `commentText`, which is the
    // only guard a comment has against a `</script>` in a project name.
    lines.push(`// ${commentText(rule.name)}`);

    switch (when.kind) {
      case 'sceneStart':
        lines.push(...body);
        break;

      case 'timer':
        lines.push(`this.time.addEvent({`);
        lines.push(`  delay: ${num(when.delay)},`);
        lines.push(`  loop: ${when.loop},`);
        lines.push('  callback: () => {');
        lines.push(...body.map((line) => `    ${line}`));
        lines.push('  },');
        lines.push('});');
        break;

      case 'keyDown':
        lines.push(`${ctx.keyFn}(this, ${str(when.key)}, () => {`);
        lines.push(...body.map((line) => `  ${line}`));
        lines.push('});');
        break;

      case 'tap': {
        const id = bindings.get(when.nodeId)?.[0];
        const node = scene.children.find((child) => child.id === when.nodeId);
        if (id === undefined || node === undefined) {
          lines.push('// A rule taps an object that could not be added.');
          break;
        }
        lines.push(`${ctx.tapFn}(${id}, ${node.type === 'ellipse'}, () => {`);
        lines.push(...body.map((line) => `  ${line}`));
        lines.push('});');
        break;
      }

      case 'collide': {
        const a = bindings.get(when.aId)?.[0];
        const b = bindings.get(when.bId)?.[0];
        if (a === undefined || b === undefined) {
          lines.push('// A rule watches two objects, one of which could not be added.');
          break;
        }
        lines.push(`${ctx.matterHitFn}(this, ${a}, ${b}, () => {`);
        lines.push(...body.map((line) => `  ${line}`));
        lines.push('});');
        break;
      }

      case 'varChange': {
        // `this` hardcoded rather than `${ctx.receiver}`, for `buildSoundLines`'
        // reason: a rule only ever runs in a Scene's `create()`, and writing the
        // receiver would read as though a prefab factory could reach one.
        const key = ctx.variables.get(when.variableId)?.key;
        if (key === undefined) {
          // Unreachable from a file this editor wrote — `rulesOf` drops a rule
          // whose trigger names a missing variable, and `collectVariables` is
          // unfiltered so every declared one is here. A comment rather than a
          // throw all the same: `missingReason`'s treatment, and the camera
          // follow's.
          lines.push('// A rule watches a variable that is not in the table.');
          break;
        }
        lines.push(`${ctx.onVarFn}(this, ${str(key)}, () => {`);
        lines.push(...body.map((line) => `  ${line}`));
        lines.push('});');
        break;
      }
    }
  }
  return lines;
}

function buildCreateBody(
  project: Project,
  scene: SceneDoc,
  outer: EmitContext,
  plays: ReadonlySet<string>,
): CreateBody {
  // The one place the engine can be answered, because it belongs to a scene and
  // the context handed in is file-wide. Every emit below reads it from here, so
  // a two-scene project with one world of each kind emits each scene the way
  // its own world runs.
  // Read once, at the top, because three separate things below need it: the
  // collider loop folds a rule into its own call, `constructorFor` has to know
  // which sprites a rule animates *before* the object list runs, and the
  // epilogue emits the rest.
  const rules = rulesOf(project, scene);
  const ruleAnimated = new Set<string>();
  const ruleTweens = new Map<string, string>();
  const ruleEmitters = new Set<string>();
  for (const rule of rules) {
    for (const action of rule.do) {
      if (action.kind === 'playAnimation') ruleAnimated.add(action.nodeId);
      if (action.kind === 'startTween') ruleTweens.set(action.nodeId, '');
      // Start and burst, never stop — see `EmitContext.ruleEmitters`. An
      // emitter a rule only stops is one that was running, so its config is
      // untouched and its export does not move by a byte.
      if (action.kind === 'startParticles' || action.kind === 'burstParticles') {
        ruleEmitters.add(action.nodeId);
      }
    }
  }
  const ctx: EmitContext = {
    ...outer,
    engine: scenePhysicsOf(scene).engine,
    ruleAnimated,
    ruleTweens,
    ruleEmitters,
  };
  const { animations } = ctx;
  // Seeded with the factory names as well as `this`: the instance calls are in
  // this scope, so an object named "create coin" bound here would shadow the
  // function the call beside it is trying to reach.
  const used = new Set<string>([
    'this',
    ctx.tilemapFn,
    ctx.bodyFn,
    ctx.touchFn,
    ctx.fitFn,
    ctx.matterFn,
    ctx.matterBodyFn,
    ctx.groundFn,
    ctx.initVariablesFn,
    ctx.keyFn,
    ctx.tapFn,
    ctx.matterHitFn,
    ctx.labelValueFn,
    ctx.bindLabelFn,
    ctx.onVarFn,
    ...[...ctx.prefabs.values()].map((entry) => entry.fn),
  ]);
  const lines: string[] = [
    `this.cameras.main.setBackgroundColor(${str(scene.backgroundColor)});`,
  ];

  // With the background, because it is the same camera, and emitted whole —
  // scroll, zoom and rounding, defaults included — where `modifiersFor` emits
  // only what differs from Phaser's. The physics body and the emitter config
  // made that call first and for this reason: these dials interact (a zoom
  // moves the shot as well as tightening it, and bounds only bite once the
  // scroll would leave the scene), so a reader tuning one wants the others
  // beside it. A camera still at its default emits nothing at all, which is the
  // rule the asset table, the tilemap helper and the body helper all follow.
  //
  // `setBounds` from the scene's own size rather than a second stored
  // rectangle, exactly as the physics world does below it.
  const camera = cameraOf(scene);
  if (!isDefaultCamera(camera)) {
    lines.push(
      `this.cameras.main.setScroll(${num(camera.scrollX)}, ${num(camera.scrollY)});`,
    );
    lines.push(`this.cameras.main.setZoom(${num(camera.zoom)});`);
    lines.push(`this.cameras.main.setRoundPixels(${camera.roundPixels});`);
    if (camera.boundToScene) {
      lines.push(
        `this.cameras.main.setBounds(0, 0, ${num(scene.width)}, ${num(scene.height)});`,
      );
    }
  }

  // Before the objects, for the reason the animation registrations are: a body
  // created below is added to this world, and one created against the default
  // gravity and then re-parented to another is a body that has already taken a
  // step under the wrong one.
  //
  // `setBounds` from the scene's own size rather than from a second stored
  // rectangle. Phaser defaults the world to the *game canvas*, which is this
  // size for the runnable page and is whatever the host game happens to be for
  // a module dropped into one — so the line is redundant in one output and load
  // bearing in the other, and emitting it in both is what makes
  // `collideWorldBounds` mean the same thing in each.
  const world = physicsUsedIn(scene);
  if (world.arcade) {
    const gravity = scenePhysicsOf(scene);
    lines.push('');
    lines.push(
      `this.physics.world.gravity.set(${num(gravity.gravityX)}, ${num(gravity.gravityY)});`,
    );
    lines.push(
      `this.physics.world.setBounds(0, 0, ${num(scene.width)}, ${num(scene.height)});`,
    );
  }
  // Matter's world says the same two things in its own units and its own order.
  //
  // The gravity is converted rather than stored twice. Matter applies
  // `mass * gravity.y * gravity.scale` as a force and integrates over a squared
  // delta in *milliseconds*, so with the default scale of 0.001 an acceleration
  // of `y` works out at `y * 1000` pixels per second squared — which is why the
  // document's px/s² is divided by a thousand here and nowhere else. A scene
  // switched from Arcade to Matter therefore falls at exactly the rate it fell
  // at before, which is the whole reason there is one gravity field and not
  // two.
  //
  // The bounds are walls Matter builds around the world, and unlike Arcade they
  // are not per body: `collideWorldBounds` is a property of an Arcade body and
  // Matter has only the world's own edges. So the walls go up when *anything*
  // in the scene asks to be stopped by them, which is the closest thing Matter
  // can say to what the checkbox says.
  if (world.matter) {
    const gravity = scenePhysicsOf(scene);
    const bounded = scene.children.some(
      (node) => physicsOf(node, true)?.collideWorldBounds === true,
    );
    lines.push('');
    lines.push(
      `this.matter.world.setGravity(${num(gravity.gravityX / 1000)}, ` +
        `${num(gravity.gravityY / 1000)});`,
    );
    if (bounded) {
      lines.push(
        `this.matter.world.setBounds(0, 0, ${num(scene.width)}, ${num(scene.height)});`,
      );
    }
  }

  // Before the objects, because an object's `.play(...)` names one: animations
  // are registered on the game's manager, and playing a key it has not been
  // given is a warning and a sprite that never moves.
  const registrations = buildAnimationLines(animations, plays);
  if (registrations.length > 0) {
    lines.push('');
    lines.push(...registrations);
  }

  // Last in the prologue, because it is the block with nothing below it that
  // depends on where it sits: a body needs the world above it, and an object's
  // `.play(...)` needs its clip. What does force it above the objects is the
  // identifier set — these handles are allocated out of `used` before any
  // object binding is, so an object named "jump" cannot take a name a
  // hand-written line elsewhere is reaching for.
  // Before the sound handles and after everything about the world, because it
  // is the same kind of thing as both: a fact this scene starts with. It names
  // no binding, so unlike the camera's `startFollow` and the collider rows it
  // has no reason to wait for the object list — and a `sceneStart` rule in the
  // epilogue may add to a variable immediately, so it must not.
  //
  // Gated on the project declaring one, the rule the asset table, the tilemap
  // helper, the prefab factories, the emitted `update()` and the touch buttons
  // all follow: a project that predates variables emits this line nowhere and
  // exports byte for byte what it always did.
  if (ctx.variables.size > 0) {
    if (lines.at(-1) !== '') lines.push('');
    lines.push(`${ctx.initVariablesFn}(this, VARIABLES);`);
  }

  const { lines: soundLines, handles: soundHandles } = buildSoundLines(
    project,
    scene,
    ctx.audio,
    used,
  );
  if (soundLines.length > 0) {
    if (lines.at(-1) !== '') lines.push('');
    lines.push(...soundLines);
  }

  // The paused tweens' bindings, out of `create()`'s own set and before any
  // object binding draws from it — `buildSoundLines`' rule exactly. An object a
  // user named "box tween" must not take the name the epilogue is reaching for.
  // Nothing is emitted here; `emitNode` reads the map for the name it must bind.
  for (const nodeId of [...ruleTweens.keys()]) {
    const node = scene.children.find((child) => child.id === nodeId);
    ruleTweens.set(nodeId, toIdentifier(`${node?.name ?? 'object'} tween`, used));
  }

  // The keys, last in the prologue and for the sound handles' reason: the
  // `this.<field>` names are allocated here, before any object binding is, so
  // an object a user called "cursors" cannot take the name the `update()` below
  // is reaching for. The local `const` comes out of `create()`'s own set at the
  // same moment and for the same reason.
  const drivenNodes = drivenIn(scene);
  const schemes = new Set<NodeControls['scheme']>();
  for (const node of drivenNodes) {
    schemes.add((controlsOf(node, true) as NodeControls).scheme);
  }
  const fieldNames = new Set<string>(SCENE_MEMBERS);
  const fields = {
    arrows: schemes.has('arrows') ? toIdentifier('cursors', fieldNames) : '',
    wasd: schemes.has('wasd') ? toIdentifier('wasd keys', fieldNames) : '',
  };
  if (schemes.size > 0) {
    if (lines.at(-1) !== '') lines.push('');
    lines.push(...buildKeyboardLines(schemes, toIdentifier('keyboard', used), fields));
  }

  // And the buttons immediately after them, out of the same set and at the same
  // moment: they are the keys' other half, and the `this.<field>` has to be
  // taken before any object binding is, for the keyboard fields' reason.
  //
  // The array is emitted whole and inline — the physics body's call and the
  // emitter config's rather than `modifiersFor`'s — because five short objects
  // only mean anything beside each other and beside the canvas they are
  // measured against. It is not tabled: `TILEMAPS` exists because tile data is
  // thousands of numbers, and this is twenty.
  const zones = touchZonesOf(scene);
  const touchField = zones.length > 0 ? toIdentifier('touch controls', fieldNames) : '';
  if (touchField) {
    if (lines.at(-1) !== '') lines.push('');
    lines.push(`this.${touchField} = ${ctx.touchFn}(this, [`);
    for (const button of zones) lines.push(touchButtonLine(button));
    lines.push(']);');
  }

  // The two blocks above each end on a blank, so this is the separator only
  // when there was neither to separate from.
  if (scene.children.length > 0 && lines.at(-1) !== '') lines.push('');
  // A list per node rather than one binding, because a tilemap emits one object
  // per layer. Everything else emits exactly one and reads `[0]`.
  const bindings = new Map<string, string[]>();
  for (const node of scene.children) {
    const ids = emitNode(node, ctx, used, lines);
    if (ids !== null) bindings.set(node.id, ids);
  }

  // The first of three things this exporter emits *after* the object list, and
  // the reason is the whole of it: `startFollow` names a binding, and the line
  // that makes that binding is above. Everything else about the camera is in
  // the prologue with the background, where a reader looks for how the shot is
  // set up.
  if (camera.followId !== null) {
    const target = bindings.get(camera.followId)?.[0];
    if (lines.at(-1) !== '') lines.push('');
    if (target === undefined) {
      // Say so rather than dropping it silently, the treatment `missingReason`
      // gives an object that emitted nothing: the followed node is in the
      // document, it just did not reach the output.
      lines.push('// The camera follows an object that could not be added.');
    } else {
      lines.push(
        `this.cameras.main.startFollow(${target}, ${camera.roundPixels}, ` +
          `${num(camera.followLerp)}, ${num(camera.followLerp)});`,
      );
    }
  }

  // The second thing emitted after the objects, and for the first one's reason:
  // a collider names two bindings the object list has just made. This is the
  // line iteration 16 told the user to write by hand — `mass` and `immovable`
  // were emitted *for* it — and it is here now because which pairs interact is
  // a standing fact about the world. What should happen when they touch is
  // still the user's, on the handle `add.overlap` returns.
  const colliders = collidersOf(scene);
  if (colliders.length > 0) {
    if (lines.at(-1) !== '') lines.push('');
    for (const collider of colliders) {
      const a = bindings.get(collider.aId);
      const b = bindings.get(collider.bId);
      if (a === undefined || b === undefined) {
        // The camera follow's treatment, and `missingReason`'s: the row is in
        // the document, it just names something that did not reach the output.
        lines.push('// A collider names an object that could not be added.');
        continue;
      }
      // `collider`, not `collide`: the document says "collide" because that is
      // what the row means to a person reading it, and `ArcadeFactory` calls
      // the method `collider`. One is the word and one is the API.
      //
      // One line per pair of bindings, which for a multi-layer tilemap is one
      // per layer — a layer collides through its own solid tiles, so a row that
      // named only the first would have the walls stop nothing the moment they
      // were painted on the layer above the floor. `collidersOf` refuses two
      // tilemaps, so at most one side is ever longer than one and this is a
      // loop rather than a product in practice.
      const fn = collider.kind === 'overlap' ? 'overlap' : 'collider';
      // Every rule that fires on this pair, in document order, as this call's
      // **third argument** rather than as a second call beside it. Two
      // `add.collider` calls on one pair would separate the two objects twice.
      //
      // The callback takes no parameters, and that is a decision as well as a
      // convenience: `ArcadePhysicsCallback` is properly typed, so parameters
      // *would* compile — but they are a four-way union including `Tile` with
      // no usable shape in common, so reading `o1.x` off one is TS2339. Closing
      // over the bindings is the plain-JavaScript form that works in all three
      // outputs, and it is why "which object hit which" is a refusal rather
      // than a hole: the moment the handler wants to know, it needs two
      // parameters with two types the shared `create()` body cannot hold.
      const onPair = rules.flatMap((rule) => {
        const when = rule.when;
        if (when.kind !== 'collide') return [];
        const names =
          (when.aId === collider.aId && when.bId === collider.bId) ||
          (when.aId === collider.bId && when.bId === collider.aId);
        if (!names) return [];
        const body = ruleBodyLines(rule, ctx, bindings, soundHandles, animations);
        return body.length === 0 ? [] : [`// ${commentText(rule.name)}`, ...body];
      });
      for (const left of a) {
        for (const right of b) {
          if (onPair.length === 0) {
            lines.push(`this.physics.add.${fn}(${left}, ${right});`);
            continue;
          }
          lines.push(`this.physics.add.${fn}(${left}, ${right}, () => {`);
          for (const line of onPair) lines.push(`  ${line}`);
          lines.push('});');
        }
      }
    }
  }

  // And the third, which is the one with no alternative at all: `update()` runs
  // outside this scope, so a driven object is the one object here that has to
  // outlive its `const`.
  const driven: DrivenObject[] = [];
  for (const node of drivenNodes) {
    const binding = bindings.get(node.id)?.[0];
    if (binding === undefined) continue;
    const controls = controlsOf(node, true) as NodeControls;
    const field = toIdentifier(node.name, fieldNames);
    driven.push({
      field,
      binding,
      controls,
      // Only a Matter platformer: Arcade reads `blocked.down` off its own body
      // every frame and has nothing to keep.
      ground:
        ctx.engine === 'matter' && controls.mode === 'platformer'
          ? toIdentifier(`${node.name} ground`, fieldNames)
          : undefined,
    });
  }
  if (driven.length > 0) {
    if (lines.at(-1) !== '') lines.push('');
    for (const { field, binding, ground } of driven) {
      lines.push(`this.${field} = ${binding};`);
      // The listener is registered once, here, rather than opened and closed
      // around each jump — `create()` is the one moment in a scene's life this
      // exporter already has, and a `world.on` per frame would stack up a
      // listener per frame.
      if (ground) {
        lines.push(
          `this.${ground} = ${ctx.groundFn}(this, ${ctx.matterBodyFn}(${binding}));`,
        );
      }
    }
  }

  // The fourth thing emitted after the object list, and for the first three's
  // reason: every rule names a binding the list has just made. Last of the
  // four, because it is the one that reads the other three's work — a rule
  // destroys the objects the list built, plays the sounds the prologue bound
  // and starts the tweens `emitNode` left paused.
  const ruleLines = buildRuleLines(project, scene, ctx, bindings, soundHandles);
  if (ruleLines.length > 0) {
    if (lines.at(-1) !== '') lines.push('');
    lines.push(...ruleLines);
  }

  while (lines.at(-1) === '') lines.pop();

  const declared: { name: string; type: string }[] = [];
  if (touchField) declared.push({ name: touchField, type: TOUCH_STATE_TYPE });
  if (fields.arrows) {
    declared.push({ name: fields.arrows, type: 'Phaser.Types.Input.Keyboard.CursorKeys' });
  }
  if (fields.wasd) {
    declared.push({ name: fields.wasd, type: 'Phaser.Types.Input.Keyboard.CursorKeys' });
  }
  for (const { field, ground } of driven) {
    declared.push({ name: field, type: 'Phaser.GameObjects.GameObject' });
    // The tracker's own shape, written out rather than named: it is three
    // words, and a `type` alias would be a *statement* the runnable page's
    // shared body has nowhere to put.
    if (ground) declared.push({ name: ground, type: '{ at: number }' });
  }

  return {
    body: lines.map((line) => (line ? `    ${line}` : '')).join('\n'),
    update: buildUpdateBody(driven, fields, touchField, ctx),
    fields: declared,
  };
}

/**
 * The one thing about this output a reader has to act on outside the file.
 *
 * `this.physics` is undefined unless the *game config* asks for Arcade, so a
 * scene class that uses it is a scene class that throws in a project which does
 * not — and it throws on the first body, in `create`, with a message about
 * reading a property of undefined that says nothing about the cause. The
 * runnable page sets the config itself and does not need this; a module dropped
 * into someone else's game cannot, so it says so instead.
 */
/**
 * The half of the same problem this output *can* solve for itself.
 *
 * Emitted only when the project has a body, so every project that predates
 * physics exports byte for byte what it always did — the rule the asset table,
 * the tilemap helper and the prefab factories all already follow. No `debug`
 * key: Phaser defaults it off, and a page that shipped with the debug draw on
 * would be a game whose objects all wear a green box nobody asked for. The
 * gravity lives in `create()` rather than here because it is per scene, and
 * this config is the boot scene's alone.
 */
/**
 * There is no audio note and no audio key in the game config, and beside two
 * constants that exist only because physics needed both, that absence looks
 * exactly like a forgotten branch — so this says which.
 *
 * `physicsNote` and `arcadeConfig` exist because `this.physics` is undefined
 * unless the config asks for Arcade, so a scene class using it throws in a
 * project that does not. `this.sound` is never undefined: Phaser builds a sound
 * manager for every game — Web Audio, HTML5 Audio, or the No Audio manager that
 * accepts every call and plays nothing — so `this.load.audio` and
 * `this.sound.add` are safe in a module dropped into someone else's game with
 * no config change at all. The `audio: { … }` config keys only *narrow* that
 * choice, and nothing emitted here needs them.
 *
 * The same goes for the camera, for the same kind of reason and with less room
 * to doubt it: `this.cameras.main` is created by the Camera Manager when the
 * scene boots, in every Phaser game there has ever been, at the size of the
 * game canvas. So a scene that scrolls, zooms or follows needs no config key
 * and no note — and the viewport it works against is the game's own size, which
 * is why the camera's rectangle is never stored beside the scene's. A rule's
 * `shake`, `flash`, `fade`, `pan` and `zoomTo` are methods on that same object,
 * so they extend this entry rather than needing a seventh: the effects arrived
 * in iteration 31 and the game config did not move by a key.
 *
 * And the same again for the keyboard the emitted `update()` reads.
 * `this.input.keyboard` is built by the Input Plugin for every game with a
 * keyboard to read, so a driven object needs no config key either. It is
 * nullable rather than absent — a game can be configured without keyboard
 * input, and a browser can be one that has none — which is why the emitted
 * block narrows it with an `if` instead of assuming it, and that guard is the
 * whole of what a module dropped into a keyboard-less game needs.
 *
 * And the same a fourth time for the on-screen buttons. `scene.input` is built
 * for every Phaser game, and the extra pointers the pad needs are asked for at
 * runtime with `addPointer` rather than declared in the config — which is not
 * only convenience: `input: { activePointers: n }` is the boot scene's config
 * and belongs to the whole game, where a module dropped into someone else's
 * game can only speak for its own scene. So there is no key and no note here
 * either, and the helper says it for itself.
 *
 * And a fifth time for the fonts, which is the one a reader is most likely to
 * go looking for a missing piece of. A web font in a hand-written page means an
 * `@font-face` rule, a `<link>`, or a `document.fonts.load` that has to settle
 * before anything draws — and this exporter emits none of the three. It does
 * not need to: `this.load.font` builds the `FontFace` itself, from the same
 * data URL every other asset here travels as, and `create()` runs only once the
 * loader has finished. The boot-order problem a web font usually brings is
 * answered by the `preload()` this file has emitted since images existed.
 *
 * The absence is worth having on purpose rather than by luck. `preload()` is
 * inside the one script `generateRunnableHtml` composes and escapes in a single
 * pass, while the markup around it is guarded only by `escapeHtml` and
 * `cssColor` — so an `@font-face` in a `<style>` block would be a new
 * unescaped surface, carrying a family name and a data URL, in the half of that
 * output where the escaping has historically been got wrong.
 *
 * And nothing for a tween either, the sixth entry here. `Scene.tweens` is a
 * TweenManager the plugin manager installs for every scene in every Phaser game
 * there has ever been, exactly as `cameras.main` and `sound` are — so a module
 * dropped into somebody else's game needs no key added to a config it does not
 * own, and there is no note to write. Said out loud because a tween is the one
 * thing in this list that visibly moves something, which makes "surely that
 * needed enabling" the natural assumption.
 *
 * And nothing for a visual effect either, the seventh entry here.
 * `enableFilters()` is on Phaser's base `GameObject`, so every type this
 * exporter emits already has it and a module dropped into somebody else's game
 * needs nothing added to a config it does not own. One thing is worth stating
 * rather than discovering, because it is the closest this feature comes to
 * needing a key: `glowQuality` and `glowDistance` *are* game-config keys and
 * they change how a glow looks — and the answer is that neither the editor nor
 * this exporter sets them, so both take Phaser's own 10 and cannot disagree.
 * That is also why a glow's quality and distance are not fields on the
 * document.
 */
const arcadeConfig = (needed: boolean) =>
  needed ? "        physics: { default: 'arcade' },\n" : '';

const physicsNote = (needed: boolean) =>
  needed
    ? `\n// Uses Arcade Physics. Your game config needs: physics: { default: 'arcade' }`
    : '';

const header = (project: Project) =>
  `// Generated by Phaser GUI Tool from "${project.name}".\n` +
  `// Edits here are not read back into the editor — re-export to regenerate.`;

export type SceneLanguage = 'ts' | 'js';

/**
 * Everything both outputs need to emit the whole project once.
 *
 * The tables are file-wide and the classes are per scene, and the order here is
 * what keeps that from tangling: class names are allocated first, out of the
 * module's identifier set, then the prefab factory names out of the same set,
 * and only then the things that are string keys rather than identifiers. A
 * factory that had taken `Main` before the class declaration did would produce
 * a module that does not parse.
 */
interface Emission {
  scenes: UsedScene[];
  ctx: EmitContext;
  /**
   * The scene the editor is on. It is the module's default export and the
   * scene the runnable page starts, because it is the one the user was looking
   * at when they pressed the button — and it is document state, saved with the
   * file, so the same project exports the same way for anyone who opens it.
   */
  boot: UsedScene;
  /**
   * Whether the file needs Arcade at all, and whether it needs the dynamic-body
   * accessor. File-wide, because the helper and the game config are file-wide
   * even though the world lines are per scene.
   */
  physics: PhysicsUse;
  /**
   * Whether any scene asks for on-screen buttons, and therefore whether the
   * module carries the helper at all — the rule the asset table, the tilemap
   * helper and the prefab factories all follow, so a project that predates this
   * exports byte for byte what it always did.
   */
  touch: boolean;
  /** Which rule helpers this file needs, each gated like every table above. */
  rules: { keys: boolean; taps: boolean; matterHits: boolean; vars: boolean };
  /**
   * Whether anything binds a label, and whether anything formats a value.
   *
   * Two flags rather than one, because the `setText` action can ask for a format
   * without asking for a subscription — so a project with a padded caption and
   * no bound label carries the formatter and not the binder. Gated like every
   * table above: a project that predates iteration 30 emits neither.
   */
  labels: { bind: boolean; value: boolean };
  /**
   * Whether anything in the file carries a visual effect.
   *
   * Gated like every table above, so a project that predates iteration 35 emits
   * the helper nowhere and is byte for byte what it was.
   */
  effects: boolean;
}

function prepare(project: Project): Emission {
  const moduleNames = new Set<string>();
  const scenes = collectScenes(project, moduleNames);
  const prefabs = collectPrefabs(project, project.scenes, moduleNames);
  // Out of the same set and immediately after the factories, by the rule they
  // already follow: an object called "create tilemap layer" bound inside
  // `create()` would otherwise shadow the function the call beside it needs.
  const tilemapFn = toIdentifier('create tilemap layer', moduleNames);
  // And immediately after it, by that same rule.
  const bodyFn = toIdentifier('arcade body', moduleNames);
  // And immediately after that, by that same rule a fourth time.
  const touchFn = toIdentifier('create touch controls', moduleNames);
  // And a fifth. Allocated after the other four rather than beside `bodyFn`,
  // which is where it belongs by subject: drawing earlier would move the suffix
  // a clash gives one of them, and all four of those are asserted by name.
  const fitFn = toIdentifier('fit body to angle', moduleNames);
  // And a sixth, a seventh and an eighth, by that same rule.
  const matterFn = toIdentifier('matter body', moduleNames);
  const matterBodyFn = toIdentifier('matter body of', moduleNames);
  const groundFn = toIdentifier('matter ground', moduleNames);
  // And a ninth, by that same rule. After all eight above it rather than beside
  // the table it reads, for `fitFn`'s reason: drawing earlier would move the
  // suffix a clash gives one of the others, and four of those are asserted by
  // name in the suite.
  const initVariablesFn = toIdentifier('init variables', moduleNames);
  // And a tenth, eleventh and twelfth, by that same rule and in this order.
  // Nothing above them moves, which matters: four of the earlier names are
  // asserted by name in the suite, and drawing a new one earlier would move the
  // numeric suffix a clash gives one of them.
  const keyFn = toIdentifier('on key', moduleNames);
  const tapFn = toIdentifier('on tap', moduleNames);
  const matterHitFn = toIdentifier('on matter hit', moduleNames);
  // And a thirteenth and fourteenth, last of all and in this order, by that
  // same rule for the last time: every name above them keeps the suffix it had,
  // which is what the specs asserting four of them by name depend on.
  const labelValueFn = toIdentifier('label value', moduleNames);
  const bindLabelFn = toIdentifier('bind label', moduleNames);
  // And a fifteenth, after all fourteen above it, by that same rule once more.
  // The rule is not stylistic: `toIdentifier` suffixes a clash, so drawing a
  // new name earlier moves the suffix some *earlier* helper was given — and
  // four of those are asserted by name in the suite. A new helper goes last.
  const onVarFn = toIdentifier('on variable change', moduleNames);
  // And a sixteenth, after all fifteen above it, by that same rule once more.
  // It is not stylistic: `toIdentifier` suffixes a clash, so drawing a new name
  // earlier moves the suffix some *earlier* helper was given — and four of
  // those are asserted by name in the suite. A new helper goes last.
  const effectsFn = toIdentifier('attach effects', moduleNames);
  const assets = collectAssets(project, project.scenes, prefabs);
  // Position among the tables is only about reading order: this draws from no
  // shared identifier set, so nothing downstream depends on when it runs.
  const audio = collectAudio(project, project.scenes);
  // Takes the project alone, where every other collector takes the scenes as
  // well: a variable belongs to no scene, so there is nothing here to filter by
  // one. That absence reads exactly like a forgotten argument, which is why
  // `collectVariables` says so at length.
  const variables = collectVariables(project);
  const fonts = collectFonts(project, project.scenes, prefabs);
  const animations = collectAnimations(project, project.scenes, assets, prefabs);
  const tilemaps = collectTilemaps(project, project.scenes, prefabs, assets);
  const current = activeScene(project);
  const worlds = project.scenes.map(physicsUsedIn);
  const bound = collectLabels(project, project.scenes, prefabs, variables);
  const effects = collectEffects(project, project.scenes, prefabs, assets);
  // A format on a `setText` with no variable is a dial on nothing, which
  // `ruleActionsOf` already refuses to carry — so reading the action's two
  // fields here cannot pick one up.
  const formats = project.scenes.some((scene) =>
    rulesOf(project, scene).some((rule) =>
      rule.do.some((action) => {
        if (action.kind !== 'setText' || action.variableId === undefined) return false;
        const format = labelFormatOf(action);
        return format.decimals >= 0 || format.pad > 0;
      }),
    ),
  );
  return {
    scenes,
    ctx: {
      assets,
      audio,
      animations,
      prefabs,
      tilemaps,
      tilemapFn,
      bodyFn,
      touchFn,
      fitFn,
      matterFn,
      matterBodyFn,
      groundFn,
      initVariablesFn,
      keyFn,
      tapFn,
      matterHitFn,
      labelValueFn,
      bindLabelFn,
      onVarFn,
      effectsFn,
      variables,
      sceneKeys: new Map(scenes.map((entry) => [entry.scene.id, entry.key])),
      // Placeholders the per-scene context overwrites, exactly as `engine` is:
      // a rule belongs to one scene and this object is file-wide, so
      // `buildCreateBody` is the only place that can answer either.
      ruleAnimated: new Set<string>(),
      ruleTweens: new Map<string, string>(),
      ruleEmitters: new Set<string>(),
      fonts,
      receiver: 'this',
      // A placeholder the per-scene context overwrites. The engine is a
      // property of one scene and this object is file-wide, so `buildCreateBody`
      // is the only place that can answer it — every scene there takes its own.
      engine: 'arcade',
    },
    boot: scenes.find((entry) => entry.scene.id === current.id) ?? scenes[0],
    physics: {
      any: worlds.some((world) => world.any),
      arcade: worlds.some((world) => world.arcade),
      matter: worlds.some((world) => world.matter),
      dynamic: worlds.some((world) => world.dynamic),
      turned: worlds.some((world) => world.turned),
      grounded: worlds.some((world) => world.grounded),
    },
    touch: project.scenes.some((scene) => touchZonesOf(scene).length > 0),
    // One flag per helper, each gated on a rule that actually uses it — the
    // rule the asset table, the tilemap helper, the prefab factories, the
    // emitted `update()` and the touch buttons all follow: a project that
    // predates a feature exports byte for byte what it always did.
    labels: { bind: bound, value: bound || formats },
    effects,
    rules: {
      keys: project.scenes.some((scene) =>
        rulesOf(project, scene).some((rule) => rule.when.kind === 'keyDown'),
      ),
      taps: project.scenes.some((scene) =>
        rulesOf(project, scene).some((rule) => rule.when.kind === 'tap'),
      ),
      matterHits: project.scenes.some(
        (scene) =>
          scenePhysicsOf(scene).engine === 'matter' &&
          rulesOf(project, scene).some((rule) => rule.when.kind === 'collide'),
      ),
      vars: project.scenes.some((scene) =>
        rulesOf(project, scene).some((rule) => rule.when.kind === 'varChange'),
      ),
    },
  };
}

/**
 * One Scene class, at zero indent.
 *
 * Shared by the module and the runnable page for the reason `buildCreateBody`
 * is: the class around the body is as much of the output as the body itself,
 * and a second copy of it here is a second place for the two to drift. The page
 * shifts the whole block right rather than passing an indent in, so there is
 * one layout to get right instead of one per method.
 */
function buildSceneClass(
  project: Project,
  entry: UsedScene,
  ctx: EmitContext,
  language: SceneLanguage,
  exported: boolean,
): string {
  const returnType = language === 'ts' ? ': void' : '';
  const usage = usedIn(project, entry.scene, ctx.prefabs);
  // Gated on the emitted body rather than on the set sizes, which is both the
  // smaller edit now that there are two kinds of key and the more correct one:
  // a set can hold an id no table matched — an image or a sound a hand-edited
  // file names and does not contain — and a size check would then emit an empty
  // `preload() {}`. That was already true of the images before there was a
  // second way to get it wrong.
  const preloadBody = buildPreloadBody(
    ctx.assets,
    usage.assets,
    ctx.audio,
    usage.audio,
    ctx.fonts,
    usage.fonts,
  );
  const preload = preloadBody
    ? `  preload()${returnType} {\n${preloadBody}\n  }\n\n`
    : '';

  const created = buildCreateBody(project, entry.scene, ctx, usage.animations);
  // Gated on the emitted body, exactly as `preload()` is above and for its
  // reason: a project with nothing the player drives gets no `update()` at all,
  // which is the rule the asset table, the tilemap helper and the prefab
  // factories all follow — and it is what keeps every project that predates
  // this feature exporting byte for byte what it exported before.
  const update = created.update
    ? `\n\n  update()${returnType} {\n${created.update}\n  }`
    : '';
  // Only the `.ts` declares them, which is the existing `.ts`/`.js` difference
  // — the `: void`s and the factory parameter types — rather than a new kind of
  // one. Typed `| undefined` rather than with a `!`, because that is what
  // satisfies `strictPropertyInitialization` without any syntax the shared
  // plain-JavaScript body could not also carry.
  const declarations =
    language === 'ts' && created.fields.length > 0
      ? `${created.fields
          .map((field) => `  private ${field.name}: ${field.type} | undefined;`)
          .join('\n')}\n\n`
      : '';

  // A Matter scene asks for Matter in its own settings rather than in the game
  // config, and that is not a shortcut — it is the only place a scene *can* say
  // it, since `GetPhysicsPlugins` reads `sys.settings.physics` alongside the
  // game's `defaultPhysicsSystem`. Two payoffs: a two-scene project can run one
  // world of each kind, which a single game-config key could not express; and
  // unlike Arcade this module needs nothing added to a game config it does not
  // own, so there is no header note to write. Arcade keeps the key and the note
  // it has always had — its emit is unchanged to the character, which is what
  // keeps every project that predates this exporting byte for byte what it did.
  const settings = physicsUsedIn(entry.scene).matter
    ? `{ key: ${str(entry.key)}, physics: { matter: {} } }`
    : str(entry.key);

  return `${exported ? 'export ' : ''}class ${entry.className} extends Phaser.Scene {
${declarations}  constructor() {
    super(${settings});
  }

${preload}  create()${returnType} {
${created.body}
  }${update}
}`;
}

/**
 * The Scene classes as a module to drop into an existing Phaser project — one
 * class per scene in the project, in document order.
 *
 * The `create()` body is plain JavaScript in both languages, which is what lets
 * the runnable page embed it verbatim; the two differ only in annotations —
 * `: void` on the methods, and the parameter and return types on the prefab
 * factories, which a bare `function createCoin(scene, x, y)` would leave as
 * three implicit `any`s under the `--strict` the exported `.ts` is compiled
 * with.
 *
 * Every scene is emitted, not only the one on screen: a game's scenes are
 * registered together and start each other by key, so an export that carried
 * one of them would be a game with nowhere to go. The images and the prefab
 * factories are shared across them exactly as they are shared in the document,
 * which is most of the point — two levels built from one set of prefabs export
 * as one copy of each.
 *
 * Both are ES modules that import Phaser, matching how a bundler-based project
 * consumes them. The script-tag flavour, where Phaser is a global and there are
 * no imports, is what the runnable HTML export already produces, so the three
 * outputs cover the three real cases without overlapping.
 */
export function generateScene(project: Project, language: SceneLanguage = 'ts'): string {
  const { scenes, ctx, boot, physics, touch, rules, labels, effects } = prepare(project);

  // A project with no images emits no ASSETS const and no preload() at all, so
  // shape-only projects export exactly what they always did.
  const table = ctx.assets.size > 0 ? `\n${buildAssetTable(ctx.assets, '')}\n` : '';
  // The same rule a fourth time, so a project that predates audio exports byte
  // for byte what it always did. Immediately after `ASSETS` because the two are
  // the same kind of thing — embedded bytes a reader swaps for paths — and
  // before `TILEMAPS`, which is derived from an asset rather than being one.
  const audio = ctx.audio.size > 0 ? `\n${buildAudioTable(ctx.audio, '')}\n` : '';
  // Gated on an image actually being cut by an atlas rather than on the asset
  // table having anything in it, or every project with a plain image would emit
  // an empty `const ATLASES = {}` — which passes every test and breaks the
  // byte-for-byte property every table before it has kept.
  const atlases = hasAtlasIn(ctx.assets) ? `\n${buildAtlasTable(ctx.assets, '')}\n` : '';
  const fonts = ctx.fonts.size > 0 ? `\n${buildFontTable(ctx.fonts, '')}\n` : '';
  // The table and its helper as one block, exactly as `TILEMAPS` is followed by
  // the function that reads it — because here too the helper is the table's
  // only reader, and splitting them puts a `for` loop a screen away from the
  // object it walks.
  const texted = textedVariables(ctx.variables);
  const variables =
    ctx.variables.size > 0
      ? `\n${buildVariableTable(ctx.variables, '')}\n` +
        `\n${buildVariableHelper(ctx.initVariablesFn, language, '', texted)}\n`
      : '';
  // Same rule again: no tilemaps, no table and no helper, so every project that
  // predates them exports byte for byte what it always did.
  const tiles =
    ctx.tilemaps.size > 0
      ? `\n${buildTilemapTable(ctx.tilemaps, '')}\n` +
        `\n${buildTilemapHelper(ctx.tilemapFn, language, '')}\n`
      : '';
  // Likewise: a project that places no prefab emits no factories, so every
  // project that predates them exports byte for byte what it always did.
  const factories =
    ctx.prefabs.size > 0 ? `\n${buildFactories(ctx, language, '')}\n` : '';
  // Only when something is actually dynamic: a file of static bodies has
  // nothing to chain and would carry a function nothing calls.
  const bodies = physics.dynamic
    ? `\n${buildBodyHelper(ctx.bodyFn, language, '')}\n`
    : '';
  // Same rule again: nothing turned, no helper, so a project whose bodies are
  // all upright exports byte for byte what it always did.
  const fitted = physics.turned
    ? `\n${buildFitHelper(ctx.fitFn, language, '')}\n`
    : '';
  // Same rule again: no Matter scene, no helper.
  const matter = physics.matter
    ? `\n${buildMatterAccessor(ctx.matterBodyFn, language, '')}\n` +
      `\n${buildMatterHelper(ctx.matterFn, ctx.matterBodyFn, language, '')}\n`
    : '';
  // Only a Matter scene with something that jumps, so a top-down project and
  // every Arcade one emit no tracker at all.
  const ground = physics.grounded
    ? `\n${buildGroundHelper(ctx.groundFn, language, '')}\n`
    : '';
  // Same rule again: no on-screen buttons, no helper, so every project that
  // predates them exports byte for byte what it always did.
  const buttons = touch ? `\n${buildTouchHelper(ctx.touchFn, language, '')}\n` : '';
  // Same rule again, once per helper: a project with no rule of that kind
  // emits nothing at all for it.
  const keyFn = rules.keys ? `\n${buildKeyHelper(ctx.keyFn, language, '')}\n` : '';
  const tapFn = rules.taps ? `\n${buildTapHelper(ctx.tapFn, language, '')}\n` : '';
  const matterHitFn = rules.matterHits
    ? `\n${buildMatterHitHelper(ctx.matterHitFn, language, '')}\n`
    : '';
  // Same rule once more, and two flags rather than one: a `setText` that asks
  // for a format needs the formatter without needing the binder.
  const labelValueFn = labels.value
    ? `\n${buildLabelValueHelper(ctx.labelValueFn, language, '')}\n`
    : '';
  const bindLabelFn = labels.bind
    ? `\n${buildBindLabelHelper(ctx.bindLabelFn, ctx.labelValueFn, language, '')}\n`
    : '';
  const onVarFn = rules.vars ? `\n${buildOnVarHelper(ctx.onVarFn, language, '')}\n` : '';
  const effectsFn = effects ? `\n${buildEffectsHelper(ctx.effectsFn, language, '')}\n` : '';
  const classes = scenes
    .map((entry) => buildSceneClass(project, entry, ctx, language, true))
    .join('\n\n');

  return `${header(project)}${physicsNote(physics.arcade)}
import Phaser from 'phaser';
${table}${audio}${atlases}${fonts}${variables}${tiles}${bodies}${fitted}${matter}${ground}${buttons}${keyFn}${tapFn}${matterHitFn}${labelValueFn}${bindLabelFn}${onVarFn}${effectsFn}${factories}
${classes}

export default ${boot.className};
`;
}

/**
 * A self-contained page that runs the project. Phaser comes from a CDN pinned
 * to the version the project records, so an old project keeps working against
 * the Phaser it was built for.
 *
 * `phaserSrc` overrides where that runtime is fetched from, and exists for one
 * caller: the editor's own Play overlay, which runs this very page in a
 * sandboxed iframe and cannot reach the network to do it — see "Play" in
 * CLAUDE.md. It is an argument rather than a second generator for
 * `EmitContext.receiver`'s reason: one page, two places it can run, and a
 * second copy of this function is exactly the drift that sharing
 * `buildCreateBody` exists to prevent. Omitted, the CDN URL is built as it
 * always was, so every exported file is byte for byte what it was.
 */
export function generateRunnableHtml(project: Project, phaserSrc?: string): string {
  const { scenes, ctx, boot, physics, touch, rules, labels, effects } = prepare(project);
  // phaserVersion comes from the project file, so it is not trustworthy input
  // for a URL. Anything that is not a plain version falls back to the version
  // this editor targets.
  const version = /^[0-9]+\.[0-9]+\.[0-9]+$/.test(project.phaserVersion)
    ? project.phaserVersion
    : TARGET_PHASER_VERSION;
  // Named for what it is rather than for where it usually comes from: with
  // `phaserSrc` given it is not a CDN at all.
  const runtimeSrc =
    phaserSrc ?? `https://cdn.jsdelivr.net/npm/phaser@${version}/dist/phaser.min.js`;

  const table =
    ctx.assets.size > 0 ? `${buildAssetTable(ctx.assets, '      ')}\n\n` : '';
  const audio =
    ctx.audio.size > 0 ? `${buildAudioTable(ctx.audio, '      ')}\n\n` : '';
  const atlases = hasAtlasIn(ctx.assets)
    ? `${buildAtlasTable(ctx.assets, '      ')}\n\n`
    : '';
  const fonts =
    ctx.fonts.size > 0 ? `${buildFontTable(ctx.fonts, '      ')}\n\n` : '';
  const texted = textedVariables(ctx.variables);
  const variables =
    ctx.variables.size > 0
      ? `${buildVariableTable(ctx.variables, '      ')}\n\n` +
        `${buildVariableHelper(ctx.initVariablesFn, 'js', '      ', texted)}\n\n`
      : '';
  const tiles =
    ctx.tilemaps.size > 0
      ? `${buildTilemapTable(ctx.tilemaps, '      ')}\n\n` +
        `${buildTilemapHelper(ctx.tilemapFn, 'js', '      ')}\n\n`
      : '';
  // The JavaScript flavour of the factories: this page has no type annotations
  // anywhere, and Phaser is a global here rather than an import.
  const factories =
    ctx.prefabs.size > 0 ? `${buildFactories(ctx, 'js', '      ')}\n\n` : '';
  const bodies = physics.dynamic
    ? `${buildBodyHelper(ctx.bodyFn, 'js', '      ')}\n\n`
    : '';
  const fitted = physics.turned
    ? `${buildFitHelper(ctx.fitFn, 'js', '      ')}\n\n`
    : '';
  const matter = physics.matter
    ? `${buildMatterAccessor(ctx.matterBodyFn, 'js', '      ')}\n\n` +
      `${buildMatterHelper(ctx.matterFn, ctx.matterBodyFn, 'js', '      ')}\n\n`
    : '';
  const ground = physics.grounded
    ? `${buildGroundHelper(ctx.groundFn, 'js', '      ')}\n\n`
    : '';
  const buttons = touch ? `${buildTouchHelper(ctx.touchFn, 'js', '      ')}\n\n` : '';
  const keyFn = rules.keys ? `${buildKeyHelper(ctx.keyFn, 'js', '      ')}\n\n` : '';
  const tapFn = rules.taps ? `${buildTapHelper(ctx.tapFn, 'js', '      ')}\n\n` : '';
  const matterHitFn = rules.matterHits
    ? `${buildMatterHitHelper(ctx.matterHitFn, 'js', '      ')}\n\n`
    : '';
  const labelValueFn = labels.value
    ? `${buildLabelValueHelper(ctx.labelValueFn, 'js', '      ')}\n\n`
    : '';
  const bindLabelFn = labels.bind
    ? `${buildBindLabelHelper(ctx.bindLabelFn, ctx.labelValueFn, 'js', '      ')}\n\n`
    : '';
  const onVarFn = rules.vars
    ? `${buildOnVarHelper(ctx.onVarFn, 'js', '      ')}\n\n`
    : '';
  const effectsFn = effects
    ? `${buildEffectsHelper(ctx.effectsFn, 'js', '      ')}\n\n`
    : '';
  const classes = scenes
    .map((entry) =>
      buildSceneClass(project, entry, ctx, 'js', false).replace(/^(?!$)/gm, '      '),
    )
    .join('\n\n')
    .trimStart();

  // Phaser starts the first scene in the list and registers the rest, so the
  // scene the editor was showing goes first and the others are there for it to
  // `scene.start`. A single-scene project passes the class itself, which is
  // what it always emitted.
  const registered =
    scenes.length > 1
      ? `[${[boot, ...scenes.filter((entry) => entry !== boot)]
          .map((entry) => entry.className)
          .join(', ')}]`
      : boot.className;

  /**
   * The whole script, escaped in one pass at the end rather than fragment by
   * fragment.
   *
   * Escaping the pieces individually is how the scene name and the background
   * colour were left raw here for a release: they are interpolated straight
   * into the script, and nothing about `${str(...)}` at the call site says
   * whether the result is about to be embedded in HTML. Composing first and
   * escaping once means a new interpolation cannot be forgotten — there is only
   * one place left to forget.
   */
  const script = `${header(project).replace(/\n/g, '\n      ')}

${table}${audio}${atlases}${fonts}${variables}${tiles}${bodies}${fitted}${matter}${ground}${buttons}${keyFn}${tapFn}${matterHitFn}${labelValueFn}${bindLabelFn}${onVarFn}${effectsFn}${factories}      ${classes}

      new Phaser.Game({
        type: Phaser.AUTO,
        width: ${num(boot.scene.width)},
        height: ${num(boot.scene.height)},
        backgroundColor: ${str(boot.scene.backgroundColor)},
${arcadeConfig(physics.arcade)}        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: ${registered},
      });`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(project.name)}</title>
    <style>
      html, body { margin: 0; height: 100%; background: ${cssColor(boot.scene.backgroundColor)}; }
      body { display: grid; place-items: center; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script src="${runtimeSrc}"></script>
    <script>
      ${escapeForScriptTag(script)}
    </script>
  </body>
</html>
`;
}

/**
 * File name for an export, derived from the scene being edited rather than from
 * the project.
 *
 * Still the scene rather than the project now that the file holds every scene:
 * that scene is the module's default export and the page's boot scene, so the
 * name says which game the file starts, and a single-scene project — which is
 * most of them — keeps the name it always had.
 */
export function exportFileName(project: Project, extension: string): string {
  const scene = activeScene(project);
  return `${toClassName(scene.name)}${extension}`;
}
