import { strToU8, zipSync } from 'fflate';
import { TARGET_PHASER_VERSION, type Project } from '../core/schema';
import { decodeAsset } from './fileIO';
import {
  bundleManifestOf,
  escapeHtml,
  generateScene,
  type SceneLanguage,
} from './exportPhaser';

/**
 * An export bundle: a small Vite project that builds and runs the game with
 * `npm install` and `npm run dev` — the generated scenes, every asset they use
 * as a real file, an entry module, dependency metadata and a README.
 *
 * It is the fourth export beside the `.ts`, the `.js` and the runnable page, and
 * it is built from them rather than beside them: the scene module is
 * `generateScene` with `assetPaths`, and the game config is the same
 * `buildGameConfig` the runnable page — and therefore Play — boots with. So a
 * bundle cannot open differently from Play, and nothing here re-derives what a
 * class, a key or a used asset is.
 */

export interface BundleOptions {
  /** The folder name inside the archive; sanitised, so free text is fine. */
  name: string;
  language: SceneLanguage;
}

export interface BundleFile {
  /** Path inside the archive, under the root folder. */
  path: string;
  bytes: Uint8Array;
}

export interface ExportBundle {
  /** The sanitised root folder, which is also the archive's base name. */
  name: string;
  fileName: string;
  files: BundleFile[];
  zip: Uint8Array;
  sceneNames: string[];
  counts: { images: number; audio: number; fonts: number };
  remembersVariables: boolean;
  touchControls: boolean;
}

/**
 * The toolchain versions the bundle asks for: the ones this editor itself is
 * built and tested with, so a bundle is never asked to build under a Vite this
 * repository has not run. `bundle.spec.ts` asserts they match `package.json`.
 */
export const BUNDLE_VITE_VERSION = '^8.2.2';
export const BUNDLE_TYPESCRIPT_VERSION = '^5.9.3';

/**
 * Every entry carries this modification time, so the same project exports the
 * same bytes on every press — a ZIP otherwise stamps each file with "now".
 */
const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);

/**
 * A folder and package name out of free text: `suggestedFileName`'s slug rule,
 * which also makes it a valid npm package name. It can hold no separator and
 * no `..`, which is what keeps every archive entry under one root.
 */
export function bundleNameOf(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
      .replace(/-+$/, '') || 'phaser-game'
  );
}

/** The Phaser the bundle pins: the project's own, when it is a plain version. */
const phaserVersionOf = (project: Project): string =>
  /^[0-9]+\.[0-9]+\.[0-9]+$/.test(project.phaserVersion)
    ? project.phaserVersion
    : TARGET_PHASER_VERSION;

export function createExportBundle(project: Project, options: BundleOptions): ExportBundle {
  const manifest = bundleManifestOf(project);
  const name = bundleNameOf(options.name);
  const ts = options.language === 'ts';
  const ext = ts ? 'ts' : 'js';
  const phaser = phaserVersionOf(project);

  const text: Record<string, string> = {};

  text['package.json'] = `${JSON.stringify(
    {
      name,
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: ts ? 'tsc --noEmit && vite build' : 'vite build',
        preview: 'vite preview',
      },
      // Exact, so the game runs under the Phaser it was made for — the pin the
      // runnable page's CDN URL already takes from the project.
      dependencies: { phaser },
      devDependencies: ts
        ? { typescript: BUNDLE_TYPESCRIPT_VERSION, vite: BUNDLE_VITE_VERSION }
        : { vite: BUNDLE_VITE_VERSION },
    },
    null,
    2,
  )}\n`;

  text['index.html'] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(project.name)}</title>
    <style>
      html, body { margin: 0; height: 100%; background: ${manifest.pageBackground}; }
      body { display: grid; place-items: center; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.${ext}"></script>
  </body>
</html>
`;

  // A relative base, so `dist/` runs from whatever path it is deployed under —
  // the asset table's paths are relative for the same reason.
  text[`vite.config.${ext}`] = `import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Phaser alone is larger than Vite's default 500 kB warning.
  build: { chunkSizeWarningLimit: 2048 },
});
`;

  if (ts) {
    text['tsconfig.json'] = `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: [],
        },
        include: ['src'],
      },
      null,
      2,
    )}\n`;
  }

  text[`src/scenes.${ext}`] = generateScene(project, options.language, { assetPaths: true });

  const named = manifest.otherClasses.length > 0 ? `, { ${manifest.otherClasses.join(', ')} }` : '';
  text[`src/main.${ext}`] = `// Generated by Phaser GUI Tool. Boots the game exactly as the editor's Play does.
import Phaser from 'phaser';
import ${manifest.bootClass}${named} from './scenes';

${manifest.gameConfig}
`;

  text['.gitignore'] = 'node_modules\ndist\n';

  const notes: string[] = [];
  if (manifest.remembersVariables) {
    notes.push(
      '- Some variables are remembered between plays in the browser\'s `localStorage`. ' +
        "The editor's Play starts fresh every time; this build does not.",
    );
  }
  if (manifest.touchControls) {
    notes.push('- On-screen touch buttons are drawn over the game for phones and tablets.');
  }

  text['README.md'] = `# ${project.name.replace(/[\r\n]+/g, ' ') || name}

Exported from Phaser GUI Tool as a ${ts ? 'TypeScript' : 'JavaScript'} Vite project,
running Phaser ${phaser}.

## Commands

\`\`\`sh
npm install      # once
npm run dev      # development server with source maps and hot reload
npm run build    # minified production build in dist/
npm run preview  # serve dist/ locally
\`\`\`

\`dist/\` is a static site: upload its contents to any web host. It uses relative
paths, so it runs from a sub-folder as well as from the root.

## What is inside

- \`src/scenes.${ext}\` — one Phaser Scene class per scene
  (${manifest.sceneNames.length === 1 ? 'one scene' : `${manifest.sceneNames.length} scenes`}; the first starts the game).
- \`src/main.${ext}\` — the game config and entry point.
- \`public/assets/\` — every image, sound and font the scenes load, each once.

Edits to these files are not read back into the editor. Re-exporting replaces them.
${notes.length > 0 ? `\n## Notes\n\n${notes.join('\n')}\n` : ''}`;

  const entries = new Map<string, Uint8Array>();
  for (const [path, contents] of Object.entries(text)) entries.set(path, strToU8(contents));
  for (const asset of manifest.assets) {
    entries.set(`public/${asset.path}`, decodeAsset(asset.dataUrl, asset.mimeType));
  }

  const files: BundleFile[] = [...entries.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, bytes]) => ({ path: `${name}/${path}`, bytes }));

  const archive: Record<string, Uint8Array> = {};
  for (const file of files) archive[file.path] = file.bytes;
  const zip = zipSync(archive, { level: 6, mtime: FIXED_MTIME });

  const count = (folder: string) =>
    manifest.assets.filter((asset) => asset.path.startsWith(`assets/${folder}/`)).length;

  return {
    name,
    fileName: `${name}.zip`,
    files,
    zip,
    sceneNames: manifest.sceneNames,
    counts: { images: count('images'), audio: count('audio'), fonts: count('fonts') },
    remembersVariables: manifest.remembersVariables,
    touchControls: manifest.touchControls,
  };
}

