import { activeScene } from '../core/store';
import {
  TARGET_PHASER_VERSION,
  type GameObjectNode,
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

/** The `add.*` call for one node, without any trailing modifiers. */
function constructorFor(node: GameObjectNode): string {
  const { x, y } = node.transform;

  switch (node.type) {
    case 'rectangle':
      return `this.add.rectangle(${num(x)}, ${num(y)}, ${num(node.props.width)}, ${num(node.props.height)}, ${hexLiteral(node.props.fill)})`;
    case 'ellipse':
      return `this.add.ellipse(${num(x)}, ${num(y)}, ${num(node.props.width)}, ${num(node.props.height)}, ${hexLiteral(node.props.fill)})`;
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
function modifiersFor(node: GameObjectNode): string[] {
  const out: string[] = [];
  const { rotation, scaleX, scaleY } = node.transform;

  // Text is created with a top-left origin; the editor centres every object.
  if (node.type === 'text') out.push('.setOrigin(0.5)');
  if (rotation !== 0) out.push(`.setAngle(${num(rotation)})`);
  if (scaleX !== 1 || scaleY !== 1) out.push(`.setScale(${num(scaleX)}, ${num(scaleY)})`);
  if (node.props.alpha !== 1) out.push(`.setAlpha(${num(node.props.alpha)})`);
  if (!node.visible) out.push('.setVisible(false)');
  return out;
}

/** The body of `create()`, shared verbatim by both outputs. */
function buildCreateBody(scene: SceneDoc): string {
  const used = new Set<string>(['this']);
  const lines: string[] = [
    `this.cameras.main.setBackgroundColor(${str(scene.backgroundColor)});`,
  ];

  if (scene.children.length > 0) lines.push('');

  for (const node of scene.children) {
    const id = toIdentifier(node.name, used);
    const modifiers = modifiersFor(node);
    const chain = modifiers.length > 0 ? `\n      ${modifiers.join('\n      ')}` : '';
    lines.push(`const ${id} = ${constructorFor(node)}${chain};`);
    // Carries the editor name through, so objects stay findable at runtime.
    lines.push(`${id}.setName(${str(node.name)});`);
    lines.push('');
  }

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

  return `${header(project)}
import Phaser from 'phaser';

export class ${className} extends Phaser.Scene {
  constructor() {
    super(${str(scene.name)});
  }

  create()${returnType} {
${buildCreateBody(scene)}
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
  const body = escapeForScriptTag(buildCreateBody(scene).replace(/^/gm, '    '));
  const comment = escapeForScriptTag(header(project)).replace(/\n/g, '\n      ');

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
      ${comment}
      class ${className} extends Phaser.Scene {
        constructor() {
          super(${str(scene.name)});
        }

        create() {
${body}
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
      });
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
