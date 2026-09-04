import { activeScene } from '../core/store';
import {
  TARGET_PHASER_VERSION,
  clampFrame,
  findAnimation,
  findAsset,
  findAudio,
  findPrefab,
  frameGridOf,
  physicsOf,
  scenePhysicsOf,
  soundsOf,
  tileMapOf,
  type AnimationClip,
  type AudioAsset,
  type GameObjectNode,
  type ImageAsset,
  type PhysicsBody,
  type Prefab,
  type Project,
  type SceneDoc,
  type TileMap,
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

/** JSON.stringify handles quotes, backslashes and newlines correctly for us. */
const str = (value: string): string => JSON.stringify(value);

/** Trims trailing zeroes so the output reads 480 rather than 480.0000001. */
const num = (value: number): string => String(Number(value.toFixed(4)));

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
 * descent is all of them.
 */
function emittedNodes(
  scene: SceneDoc,
  prefabs: Map<string, UsedPrefab>,
): GameObjectNode[][] {
  const bodies: GameObjectNode[][] = [scene.children];
  const seen = new Set<string>();
  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      const id = node.type === 'instance' ? node.props.prefabId : null;
      const entry = id ? prefabs.get(id) : undefined;
      if (entry && !seen.has(entry.prefab.id)) {
        seen.add(entry.prefab.id);
        bodies.push(entry.prefab.children);
      }
      walk(node.children);
    }
  };
  walk(scene.children);
  return bodies;
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
      const assetId =
        node.type === 'sprite' ||
        node.type === 'particles' ||
        (node.type === 'tilemap' && frameGridOf(findAsset(project, node.props.assetId)))
          ? node.props.assetId
          : null;
      if (assetId && !used.has(assetId)) {
        const asset = findAsset(project, assetId);
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
    for (const nodes of emittedNodes(scene, prefabs)) walk(nodes);
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
 * The body of `preload()`, or '' when the scene uses no images.
 *
 * Filtered to what *this* scene draws, out of a table built for the file: a
 * menu that loads the whole game's artwork is a menu that waits for it.
 *
 * A sheet loads through `load.spritesheet` with the document's own four
 * numbers, so the frames the exported game cuts are the frames the editor drew.
 * A plain image still loads through `load.image`, unchanged — emitting every
 * image as a one-frame sheet would work and would make every shape-only-plus-
 * image export differ from what it was for no gain.
 */
function buildPreloadBody(
  used: Map<string, UsedAsset>,
  ids: ReadonlySet<string>,
  audio: Map<string, UsedAudio>,
  audioIds: ReadonlySet<string>,
): string {
  const images = [...used.values()]
    .filter(({ asset }) => ids.has(asset.id))
    .map(({ asset, key }) => {
      const sheet = frameGridOf(asset);
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

  return [...images, ...sounds].join('\n');
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
          });
        }
      }
      walk(node.children);
    }
  };
  // Across every scene, so that the key a clip gets is the key it has in the
  // whole file — an animation is registered on the game's manager, which no
  // more belongs to one scene than the texture manager does.
  for (const scene of scenes) {
    for (const nodes of emittedNodes(scene, prefabs)) walk(nodes);
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
): { assets: Set<string>; animations: Set<string>; audio: Set<string> } {
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
        (node.type === 'tilemap' || node.type === 'particles') &&
        node.props.assetId
      ) {
        assets.add(node.props.assetId);
      }
      walk(node.children);
    }
  };
  for (const nodes of emittedNodes(scene, prefabs)) walk(nodes);

  // A read rather than a traversal, which is the shape of the feature and not a
  // shortcut: a sound belongs to the scene, so there is no node to walk into.
  // Getting this half wrong is worse than getting the image half wrong — a
  // texture a scene never loaded draws a missing-texture square, while
  // `sound.add` on a key the cache does not hold *throws*, inside `create()`,
  // before a single object has been added.
  const audio = new Set(soundsOf(project, scene).map((sound) => sound.audioId));
  return { assets, animations, audio };
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
  for (const { clip, key, textureKey } of used.values()) {
    if (!ids.has(clip.id)) continue;
    lines.push(`if (!this.anims.exists(${str(key)})) {`);
    lines.push('  this.anims.create({');
    lines.push(`    key: ${str(key)},`);
    // `generateFrameNumbers` with an explicit list rather than a start and an
    // end: the document stores a list, and a list is what expresses a sequence
    // that repeats or runs backwards — a ping-pong is [0, 1, 2, 1].
    lines.push(
      `    frames: this.anims.generateFrameNumbers(${str(textureKey)}, ` +
        `{ frames: [${clip.frames.join(', ')}] }),`,
    );
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
interface UsedTilemap {
  map: TileMap;
  /** Its row in the `TILEMAPS` table, and the asset key it draws from. */
  key: string;
  assetKey: string;
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
          used.set(node.id, {
            map: tileMapOf(project, node.props),
            key: toIdentifier(node.name, keys),
            assetKey: asset.key,
          });
        }
      }
      walk(node.children);
    }
  };
  for (const scene of scenes) {
    for (const nodes of emittedNodes(scene, prefabs)) walk(nodes);
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
    ...[...used.values()].flatMap(({ map, key }) => [
      `  ${str(key)}: [`,
      ...Array.from(
        { length: map.rows },
        (_, row) =>
          `    [${map.data.slice(row * map.columns, (row + 1) * map.columns).join(', ')}],`,
      ),
      '  ],',
    ]),
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
      ].join(',\n  ')
    : 'scene, x, y, tilesetKey, data, tileWidth, tileHeight, margin, spacing';
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
function physicsUsedIn(scene: SceneDoc): { any: boolean; dynamic: boolean } {
  let any = false;
  let dynamic = false;
  for (const node of scene.children) {
    const body = physicsOf(node, true);
    if (!body) continue;
    any = true;
    if (body.kind === 'dynamic') dynamic = true;
  }
  return { any, dynamic };
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
function bodyLines(id: string, body: PhysicsBody, ctx: EmitContext): string[] {
  if (body.kind === 'static') {
    // Nothing to chain: a StaticBody has no velocity, bounce, drag, mass or
    // gravity, and an immovable flag on a body that never moves would be a line
    // restating its own type.
    return [`${ctx.receiver}.physics.add.existing(${id}, true);`];
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
   * The sound table, file-wide like `assets` and read by `buildSoundLines`
   * alone. No `receiver` question attaches to it: the only place a sound is
   * ever emitted is a Scene's own `create()`.
   */
  audio: Map<string, UsedAudio>;
  /** `'this'` inside a Scene method, `'scene'` inside a factory function. */
  receiver: string;
}

/**
 * The `add.*` call for one node, without any trailing modifiers.
 *
 * Null means "emit nothing for this node": a sprite with no image chosen, or an
 * instance whose prefab is gone. Neither has a valid constructor call to make.
 */
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
      if (node.props.animationId && animations.has(node.props.animationId)) {
        return `${receiver}.add.sprite(${num(x)}, ${num(y)}, ${str(entry.key)})`;
      }
      // Frame 0 is `add.image`'s own default, so a plain image emits exactly
      // the call it always did.
      const frame = clampFrame(entry.asset, node.props.frame);
      return frame === 0
        ? `${receiver}.add.image(${num(x)}, ${num(y)}, ${str(entry.key)})`
        : `${receiver}.add.image(${num(x)}, ${num(y)}, ${str(entry.key)}, ${num(frame)})`;
    }
    case 'tilemap': {
      const entry = ctx.tilemaps.get(node.id);
      if (!entry) return null;
      const grid = frameGridOf(entry.map.asset);
      // A call rather than an `add.*`, exactly as an instance is: the helper
      // does the adding, and because it returns the layer every modifier below
      // — and the `setName` after them — chains onto it unchanged.
      return (
        `${ctx.tilemapFn}(${receiver}, ${num(x)}, ${num(y)}, ${str(entry.assetKey)}, ` +
        `TILEMAPS[${str(entry.key)}], ${num(entry.map.tileWidth)}, ${num(entry.map.tileHeight)}, ` +
        `${num(grid ? grid.margin : 0)}, ${num(grid ? grid.spacing : 0)})`
      );
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
      return (
        `${receiver}.add.particles(${num(x)}, ${num(y)}, ${str(entry.key)}, {\n` +
        `      frame: ${num(clampFrame(entry.asset, p.frame))},\n` +
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
        `      blendMode: ${str(p.blendMode)},\n` +
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
        `      fontFamily: ${str(node.props.fontFamily)},\n` +
        `      fontSize: ${str(`${node.props.fontSize}px`)},\n` +
        `      color: ${str(node.props.color)},\n` +
        `    })`
      );
  }
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
 */
function modifiersFor(node: GameObjectNode, animations: Map<string, UsedAnimation>): string[] {
  const out: string[] = [];
  const { rotation, scaleX, scaleY } = node.transform;

  // Text is created with a top-left origin; the editor centres every object.
  if (node.type === 'text') out.push('.setOrigin(0.5)');
  if (rotation !== 0) out.push(`.setAngle(${num(rotation)})`);
  if (scaleX !== 1 || scaleY !== 1) out.push(`.setScale(${num(scaleX)}, ${num(scaleY)})`);

  if (node.type === 'sprite') {
    // White is Phaser's untinted state under the default multiply mode, so
    // emitting setTint(0xffffff) would be a no-op line on every sprite.
    if (hexLiteral(node.props.tint) !== '0xffffff') {
      out.push(`.setTint(${hexLiteral(node.props.tint)})`);
    }
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
): string | null {
  const constructor = constructorFor(node, ctx);
  if (constructor === null) {
    // Say so rather than skipping silently: an object missing from the export
    // with no explanation reads as an exporter bug.
    lines.push(`// ${commentText(node.name)}: ${missingReason(node)}`);
    lines.push('');
    return null;
  }

  const id = toIdentifier(node.name, used);
  const modifiers = modifiersFor(node, ctx.animations);
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
  if (body) lines.push(...bodyLines(id, body, ctx));
  lines.push('');

  if (node.type === 'container' && node.children.length > 0) {
    const childIds = node.children
      .map((child) => emitNode(child, ctx, used, lines, true))
      .filter((childId): childId is string => childId !== null);
    // Added after the children are built, and in document order: a container's
    // list order is its draw order, exactly as the scene's array is.
    if (childIds.length > 0) {
      lines.push(`${id}.add([${childIds.join(', ')}]);`);
      lines.push('');
    }
  }

  return id;
}

/** Why a node emitted nothing, for the comment that stands in its place. */
function missingReason(node: GameObjectNode): string {
  if (node.type === 'instance') {
    return 'the prefab it placed is no longer in the project, so nothing to add.';
  }
  // Two ways for a tilemap to have no tileset, and they need different fixes:
  // one is answered in the asset picker and the other in the slicer, so the
  // comment says which.
  if (node.type === 'tilemap') {
    return node.props.assetId
      ? 'its image is not sliced into tiles, so there is no tileset to build.'
      : 'no tileset chosen in the editor, so nothing to add.';
  }
  // The fallback covers a sprite and an emitter alike, and says the same true
  // thing about both: without an image there is no object to add.
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
      ...factoryNames,
    ]);
    const lines: string[] = ['const root = scene.add.container(x, y);', ''];
    const childIds = entry.prefab.children
      .map((child) => emitNode(child, inner, used, lines, true))
      .filter((childId): childId is string => childId !== null);
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
): string[] {
  const sounds = soundsOf(project, scene);
  if (sounds.length === 0) return [];

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
  }
  lines.push('');
  return lines;
}

/** The body of `create()`, shared verbatim by both outputs. */
function buildCreateBody(
  project: Project,
  scene: SceneDoc,
  ctx: EmitContext,
  plays: ReadonlySet<string>,
): string {
  const { animations } = ctx;
  // Seeded with the factory names as well as `this`: the instance calls are in
  // this scope, so an object named "create coin" bound here would shadow the
  // function the call beside it is trying to reach.
  const used = new Set<string>([
    'this',
    ctx.tilemapFn,
    ctx.bodyFn,
    ...[...ctx.prefabs.values()].map((entry) => entry.fn),
  ]);
  const lines: string[] = [
    `this.cameras.main.setBackgroundColor(${str(scene.backgroundColor)});`,
  ];

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
  if (world.any) {
    const gravity = scenePhysicsOf(scene);
    lines.push('');
    lines.push(
      `this.physics.world.gravity.set(${num(gravity.gravityX)}, ${num(gravity.gravityY)});`,
    );
    lines.push(
      `this.physics.world.setBounds(0, 0, ${num(scene.width)}, ${num(scene.height)});`,
    );
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
  const sounds = buildSoundLines(project, scene, ctx.audio, used);
  if (sounds.length > 0) {
    if (lines.at(-1) !== '') lines.push('');
    lines.push(...sounds);
  }

  // The two blocks above each end on a blank, so this is the separator only
  // when there was neither to separate from.
  if (scene.children.length > 0 && lines.at(-1) !== '') lines.push('');
  for (const node of scene.children) emitNode(node, ctx, used, lines);

  while (lines.at(-1) === '') lines.pop();
  return lines.map((line) => (line ? `    ${line}` : '')).join('\n');
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
  physics: { any: boolean; dynamic: boolean };
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
  const assets = collectAssets(project, project.scenes, prefabs);
  // Position among the tables is only about reading order: this draws from no
  // shared identifier set, so nothing downstream depends on when it runs.
  const audio = collectAudio(project, project.scenes);
  const animations = collectAnimations(project, project.scenes, assets, prefabs);
  const tilemaps = collectTilemaps(project, project.scenes, prefabs, assets);
  const current = activeScene(project);
  const worlds = project.scenes.map(physicsUsedIn);
  return {
    scenes,
    ctx: { assets, audio, animations, prefabs, tilemaps, tilemapFn, bodyFn, receiver: 'this' },
    boot: scenes.find((entry) => entry.scene.id === current.id) ?? scenes[0],
    physics: {
      any: worlds.some((world) => world.any),
      dynamic: worlds.some((world) => world.dynamic),
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
  const preloadBody = buildPreloadBody(ctx.assets, usage.assets, ctx.audio, usage.audio);
  const preload = preloadBody
    ? `  preload()${returnType} {\n${preloadBody}\n  }\n\n`
    : '';

  return `${exported ? 'export ' : ''}class ${entry.className} extends Phaser.Scene {
  constructor() {
    super(${str(entry.key)});
  }

${preload}  create()${returnType} {
${buildCreateBody(project, entry.scene, ctx, usage.animations)}
  }
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
  const { scenes, ctx, boot, physics } = prepare(project);

  // A project with no images emits no ASSETS const and no preload() at all, so
  // shape-only projects export exactly what they always did.
  const table = ctx.assets.size > 0 ? `\n${buildAssetTable(ctx.assets, '')}\n` : '';
  // The same rule a fourth time, so a project that predates audio exports byte
  // for byte what it always did. Immediately after `ASSETS` because the two are
  // the same kind of thing — embedded bytes a reader swaps for paths — and
  // before `TILEMAPS`, which is derived from an asset rather than being one.
  const audio = ctx.audio.size > 0 ? `\n${buildAudioTable(ctx.audio, '')}\n` : '';
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
  const classes = scenes
    .map((entry) => buildSceneClass(project, entry, ctx, language, true))
    .join('\n\n');

  return `${header(project)}${physicsNote(physics.any)}
import Phaser from 'phaser';
${table}${audio}${tiles}${bodies}${factories}
${classes}

export default ${boot.className};
`;
}

/**
 * A self-contained page that runs the project. Phaser comes from a CDN pinned
 * to the version the project records, so an old project keeps working against
 * the Phaser it was built for.
 */
export function generateRunnableHtml(project: Project): string {
  const { scenes, ctx, boot, physics } = prepare(project);
  // phaserVersion comes from the project file, so it is not trustworthy input
  // for a URL. Anything that is not a plain version falls back to the version
  // this editor targets.
  const version = /^[0-9]+\.[0-9]+\.[0-9]+$/.test(project.phaserVersion)
    ? project.phaserVersion
    : TARGET_PHASER_VERSION;
  const cdn = `https://cdn.jsdelivr.net/npm/phaser@${version}/dist/phaser.min.js`;

  const table =
    ctx.assets.size > 0 ? `${buildAssetTable(ctx.assets, '      ')}\n\n` : '';
  const audio =
    ctx.audio.size > 0 ? `${buildAudioTable(ctx.audio, '      ')}\n\n` : '';
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

${table}${audio}${tiles}${bodies}${factories}      ${classes}

      new Phaser.Game({
        type: Phaser.AUTO,
        width: ${num(boot.scene.width)},
        height: ${num(boot.scene.height)},
        backgroundColor: ${str(boot.scene.backgroundColor)},
${arcadeConfig(physics.any)}        scale: {
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
    <script src="${cdn}"></script>
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
