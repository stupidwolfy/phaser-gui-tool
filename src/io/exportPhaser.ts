import { activeScene } from '../core/store';
import {
  TARGET_PHASER_VERSION,
  clampFrame,
  findAnimation,
  findAsset,
  frameGridOf,
  type AnimationClip,
  type GameObjectNode,
  type ImageAsset,
  type Project,
  type SceneDoc,
} from '../core/schema';

/**
 * Turns the project document into real Phaser code.
 *
 * A pure function of the document — no editor state reaches it, which is the
 * payoff for keeping Phaser a renderer rather than the source of truth.
 *
 * The two outputs share `buildCreateBody`: the statements that construct the
 * objects are identical JavaScript in both, and only the wrapper differs (a
 * TypeScript module you import, or a self-contained page you can open). Keeping
 * one generator means the runnable preview can never drift from the file you
 * ship.
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

function collectAssets(project: Project, scene: SceneDoc): Map<string, UsedAsset> {
  const used = new Map<string, UsedAsset>();
  const keys = new Set<string>();

  const walk = (nodes: GameObjectNode[]) => {
    for (const node of nodes) {
      if (node.type === 'sprite' && node.props.assetId && !used.has(node.props.assetId)) {
        const asset = findAsset(project, node.props.assetId);
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
  walk(scene.children);
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
 * The body of `preload()`, or '' when the scene uses no images.
 *
 * A sheet loads through `load.spritesheet` with the document's own four
 * numbers, so the frames the exported game cuts are the frames the editor drew.
 * A plain image still loads through `load.image`, unchanged — emitting every
 * image as a one-frame sheet would work and would make every shape-only-plus-
 * image export differ from what it was for no gain.
 */
function buildPreloadBody(used: Map<string, UsedAsset>): string {
  return [...used.values()]
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
    })
    .join('\n');
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
  scene: SceneDoc,
  assets: Map<string, UsedAsset>,
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
  walk(scene.children);
  return used;
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

/** The `anims.create` calls, which have to run before anything plays one. */
function buildAnimationLines(used: Map<string, UsedAnimation>): string[] {
  const lines: string[] = [];
  for (const { clip, key, textureKey } of used.values()) {
    lines.push('this.anims.create({');
    lines.push(`  key: ${str(key)},`);
    // `generateFrameNumbers` with an explicit list rather than a start and an
    // end: the document stores a list, and a list is what expresses a sequence
    // that repeats or runs backwards — a ping-pong is [0, 1, 2, 1].
    lines.push(
      `  frames: this.anims.generateFrameNumbers(${str(textureKey)}, ` +
        `{ frames: [${clip.frames.join(', ')}] }),`,
    );
    lines.push(`  frameRate: ${num(clip.frameRate)},`);
    lines.push(`  repeat: ${num(clip.repeat)},`);
    lines.push('});');
    lines.push('');
  }
  return lines;
}

/**
 * The `add.*` call for one node, without any trailing modifiers.
 *
 * Null means "emit nothing for this node" — currently only a sprite with no
 * image chosen, which has no valid constructor call to make.
 */
function constructorFor(
  node: GameObjectNode,
  used: Map<string, UsedAsset>,
  animations: Map<string, UsedAnimation>,
): string | null {
  const { x, y } = node.transform;

  switch (node.type) {
    case 'rectangle':
      return `this.add.rectangle(${num(x)}, ${num(y)}, ${num(node.props.width)}, ${num(node.props.height)}, ${hexLiteral(node.props.fill)})`;
    case 'ellipse':
      return `this.add.ellipse(${num(x)}, ${num(y)}, ${num(node.props.width)}, ${num(node.props.height)}, ${hexLiteral(node.props.fill)})`;
    case 'sprite': {
      const entry = node.props.assetId ? used.get(node.props.assetId) : undefined;
      if (!entry) return null;
      // A Sprite only when the node actually animates: an Image cannot `play`,
      // and a Sprite that never does is a heavier object and a reader's
      // question about what it is for. The editor makes the opposite choice and
      // draws every sprite node as a Sprite, because there the node has to be
      // able to start animating the moment the user gives it a clip.
      if (node.props.animationId && animations.has(node.props.animationId)) {
        return `this.add.sprite(${num(x)}, ${num(y)}, ${str(entry.key)})`;
      }
      // Frame 0 is `add.image`'s own default, so a plain image emits exactly
      // the call it always did.
      const frame = clampFrame(entry.asset, node.props.frame);
      return frame === 0
        ? `this.add.image(${num(x)}, ${num(y)}, ${str(entry.key)})`
        : `this.add.image(${num(x)}, ${num(y)}, ${str(entry.key)}, ${num(frame)})`;
    }
    case 'container':
      return `this.add.container(${num(x)}, ${num(y)})`;
    case 'text':
      return (
        `this.add.text(${num(x)}, ${num(y)}, ${str(node.props.text)}, {\n` +
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
  assets: Map<string, UsedAsset>,
  animations: Map<string, UsedAnimation>,
  used: Set<string>,
  lines: string[],
): string | null {
  const constructor = constructorFor(node, assets, animations);
  if (constructor === null) {
    // Say so rather than skipping silently: an object missing from the export
    // with no explanation reads as an exporter bug.
    lines.push(`// ${node.name}: no image chosen in the editor, so nothing to add.`);
    lines.push('');
    return null;
  }

  const id = toIdentifier(node.name, used);
  const modifiers = modifiersFor(node, animations);
  const chain = modifiers.length > 0 ? `\n      ${modifiers.join('\n      ')}` : '';
  lines.push(`const ${id} = ${constructor}${chain};`);
  // Carries the editor name through, so objects stay findable at runtime.
  lines.push(`${id}.setName(${str(node.name)});`);
  lines.push('');

  if (node.type === 'container' && node.children.length > 0) {
    const childIds = node.children
      .map((child) => emitNode(child, assets, animations, used, lines))
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

/** The body of `create()`, shared verbatim by both outputs. */
function buildCreateBody(
  scene: SceneDoc,
  assets: Map<string, UsedAsset>,
  animations: Map<string, UsedAnimation>,
): string {
  const used = new Set<string>(['this']);
  const lines: string[] = [
    `this.cameras.main.setBackgroundColor(${str(scene.backgroundColor)});`,
  ];

  // Before the objects, because an object's `.play(...)` names one: animations
  // are registered on the game's manager, and playing a key it has not been
  // given is a warning and a sprite that never moves.
  if (animations.size > 0) {
    lines.push('');
    lines.push(...buildAnimationLines(animations));
  }

  // `buildAnimationLines` already ends on a blank, so this is the separator
  // only when there were no animations to separate from.
  if (scene.children.length > 0 && lines.at(-1) !== '') lines.push('');
  for (const node of scene.children) emitNode(node, assets, animations, used, lines);

  while (lines.at(-1) === '') lines.pop();
  return lines.map((line) => (line ? `    ${line}` : '')).join('\n');
}

const header = (project: Project) =>
  `// Generated by Phaser GUI Tool from "${project.name}".\n` +
  `// Edits here are not read back into the editor — re-export to regenerate.`;

export type SceneLanguage = 'ts' | 'js';

/**
 * A Scene class module to drop into an existing Phaser project.
 *
 * The two languages differ by exactly one token — the `: void` return
 * annotation — because everything `buildCreateBody` emits is already plain
 * JavaScript. That is the same property that lets the runnable page embed the
 * body verbatim.
 *
 * Both are ES modules that import Phaser, matching how a bundler-based project
 * consumes them. The script-tag flavour, where Phaser is a global and there are
 * no imports, is what the runnable HTML export already produces, so the three
 * outputs cover the three real cases without overlapping.
 */
export function generateScene(
  project: Project,
  language: SceneLanguage = 'ts',
  scene = activeScene(project),
): string {
  const className = toClassName(scene.name);
  const returnType = language === 'ts' ? ': void' : '';
  const assets = collectAssets(project, scene);
  const animations = collectAnimations(project, scene, assets);

  // A scene with no images emits no ASSETS const and no preload() at all, so
  // shape-only projects export exactly what they always did.
  const table = assets.size > 0 ? `\n${buildAssetTable(assets, '')}\n` : '';
  const preload =
    assets.size > 0 ? `  preload()${returnType} {\n${buildPreloadBody(assets)}\n  }\n\n` : '';

  return `${header(project)}
import Phaser from 'phaser';
${table}
export class ${className} extends Phaser.Scene {
  constructor() {
    super(${str(scene.name)});
  }

${preload}  create()${returnType} {
${buildCreateBody(scene, assets, animations)}
  }
}

export default ${className};
`;
}

/**
 * A self-contained page that runs the scene. Phaser comes from a CDN pinned to
 * the version the project records, so an old project keeps working against the
 * Phaser it was built for.
 */
export function generateRunnableHtml(
  project: Project,
  scene = activeScene(project),
): string {
  const className = toClassName(scene.name);
  // phaserVersion comes from the project file, so it is not trustworthy input
  // for a URL. Anything that is not a plain version falls back to the version
  // this editor targets.
  const version = /^[0-9]+\.[0-9]+\.[0-9]+$/.test(project.phaserVersion)
    ? project.phaserVersion
    : TARGET_PHASER_VERSION;
  const cdn = `https://cdn.jsdelivr.net/npm/phaser@${version}/dist/phaser.min.js`;
  const assets = collectAssets(project, scene);
  const animations = collectAnimations(project, scene, assets);

  const table =
    assets.size > 0 ? `${buildAssetTable(assets, '      ')}\n\n` : '';
  const preload =
    assets.size > 0
      ? `        preload() {\n${buildPreloadBody(assets).replace(/^/gm, '    ')}\n        }\n\n`
      : '';

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

${table}      class ${className} extends Phaser.Scene {
        constructor() {
          super(${str(scene.name)});
        }

${preload}        create() {
${buildCreateBody(scene, assets, animations).replace(/^/gm, '    ')}
        }
      }

      new Phaser.Game({
        type: Phaser.AUTO,
        width: ${num(scene.width)},
        height: ${num(scene.height)},
        backgroundColor: ${str(scene.backgroundColor)},
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: ${className},
      });`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(project.name)}</title>
    <style>
      html, body { margin: 0; height: 100%; background: ${cssColor(scene.backgroundColor)}; }
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

/** File name for an export, derived from the scene rather than the project. */
export function exportFileName(project: Project, extension: string): string {
  const scene = activeScene(project);
  return `${toClassName(scene.name)}${extension}`;
}
