import { DEFAULT_FRAME_RATE } from '../core/defaults';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  BASE_FRAME,
  FONT_FAMILY,
  SCHEMA_VERSION,
  type AnimationClip,
  type AtlasFrame,
  type AudioAsset,
  type FontAsset,
  type FrameGrid,
  type ImageAsset,
  type Prefab,
  type Project,
  type ProjectVariable,
} from '../core/schema';

/**
 * Saving and opening project files, entirely on the user's device.
 *
 * Two code paths, because the File System Access API (`showSaveFilePicker`) is
 * desktop-Chromium only — it is absent on Chrome for Android, on iOS Safari, and
 * in Firefox. Mobile is a first-class target here, so the download/`<input>`
 * fallback is not a degraded mode, it is the path most phone users will take.
 */

export const FILE_EXTENSION = '.phaser.zip';
export const LEGACY_FILE_EXTENSION = '.phaser.json';
const FILE_TYPE_OPTIONS = {
  description: 'Phaser GUI project archive',
  accept: { 'application/zip': [FILE_EXTENSION] as string[] },
};
const OPEN_FILE_TYPE_OPTIONS = [
  FILE_TYPE_OPTIONS,
  { description: 'Legacy Phaser GUI project', accept: { 'application/json': ['.json'] as string[] } },
];

// The File System Access API is still not in lib.dom for every TS release, and
// it is absent at runtime on most mobile browsers. Declaring only what we use
// keeps the feature detection honest instead of pretending the API is always
// there.
interface FileSystemWritable {
  write: (data: string | Blob | Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}
interface FileHandle {
  name: string;
  createWritable: () => Promise<FileSystemWritable>;
  getFile: () => Promise<File>;
}
interface PickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileHandle>;
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileHandle[]>;
}

const picker = (): PickerWindow => window as unknown as PickerWindow;

export const supportsFileSystemAccess = (): boolean =>
  typeof window !== 'undefined' && typeof picker().showSaveFilePicker === 'function';

/**
 * The handle of the file we last saved to or opened, so plain "Save" can write
 * straight back without re-prompting. Null whenever we are on the fallback path,
 * where every save is necessarily a fresh download.
 */
let currentHandle: FileHandle | null = null;

export const hasFileHandle = (): boolean => currentHandle !== null;
export const clearFileHandle = (): void => {
  currentHandle = null;
};

export function suggestedFileName(project: Project): string {
  const slug =
    project.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled';
  return `${slug}${FILE_EXTENSION}`;
}

export const serializeProject = (project: Project): string =>
  JSON.stringify(project, null, 2);

const MAX_ARCHIVE_ENTRY_SIZE = 32 * 1024 * 1024;
const MAX_ARCHIVE_SIZE = 128 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
};

const safeAssetName = (id: string): string =>
  Array.from(strToU8(id), (byte) => byte.toString(16).padStart(2, '0')).join('');

function decodeAsset(dataUrl: string, expectedMime: string): Uint8Array {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match || match[1] !== expectedMime || !MIME_EXTENSIONS[expectedMime]) {
    throw new ProjectParseError(`Asset has unsupported or mismatched MIME type "${expectedMime}".`);
  }
  try {
    const binary = atob(match[2]);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new ProjectParseError(`Asset data for "${expectedMime}" is not valid base64.`);
  }
}

function encodeDataUrl(mime: string, bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Builds the portable ZIP used for explicit saves. Autosave deliberately uses serializeProject. */
export function createProjectArchive(project: Project): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const usedPaths = new Set<string>();
  const pack = <T extends ImageAsset | AudioAsset | FontAsset>(
    asset: T,
    folder: 'images' | 'audio' | 'fonts',
  ): Omit<T, 'dataUrl'> & { path: string } => {
    const extension = MIME_EXTENSIONS[asset.mimeType];
    if (!extension) throw new ProjectParseError(`Asset "${asset.name}" has unsupported MIME type "${asset.mimeType}".`);
    const path = `assets/${folder}/${safeAssetName(asset.id)}.${extension}`;
    if (usedPaths.has(path)) throw new ProjectParseError(`Duplicate asset id "${asset.id}" cannot be saved.`);
    usedPaths.add(path);
    entries[path] = decodeAsset(asset.dataUrl, asset.mimeType);
    const { dataUrl: _dataUrl, ...record } = asset;
    return { ...record, path };
  };

  const manifest = {
    ...project,
    assets: project.assets.map((asset) => pack(asset, 'images')),
    audio: project.audio.map((asset) => pack(asset, 'audio')),
    fonts: project.fonts.map((asset) => pack(asset, 'fonts')),
  };
  entries['project.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(entries, { level: 6 });
}

function validateZipDirectory(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names = new Set<string>();
  let total = 0;
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ProjectParseError('That file is not a valid ZIP project archive.');
  const count = view.getUint16(eocd + 10, true);
  let i = view.getUint32(eocd + 16, true);
  if (count === 0xffff || i === 0xffffffff) throw new ProjectParseError('ZIP64 project archives are not supported.');
  // Reading the declared central directory detects duplicate names, which an
  // object-based unzip API necessarily hides.
  for (let entry = 0; entry < count; entry++) {
    if (i + 46 > bytes.length || view.getUint32(i, true) !== 0x02014b50) {
      throw new ProjectParseError('The project archive has a malformed directory.');
    }
    const size = view.getUint32(i + 24, true);
    const nameLength = view.getUint16(i + 28, true);
    const extraLength = view.getUint16(i + 30, true);
    const commentLength = view.getUint16(i + 32, true);
    if (i + 46 + nameLength + extraLength + commentLength > bytes.length) {
      throw new ProjectParseError('The project archive has a malformed directory.');
    }
    const name = strFromU8(bytes.subarray(i + 46, i + 46 + nameLength));
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some((part) => part === '..' || part === '')) {
      throw new ProjectParseError(`The project archive contains an unsafe path: "${name}".`);
    }
    if (names.has(name)) throw new ProjectParseError(`The project archive contains duplicate entry "${name}".`);
    names.add(name);
    if (size > MAX_ARCHIVE_ENTRY_SIZE) throw new ProjectParseError(`Archive entry "${name}" is too large.`);
    total += size;
    if (total > MAX_ARCHIVE_SIZE) throw new ProjectParseError('The project archive expands beyond the 128 MB safety limit.');
    i += 46 + nameLength + extraLength + commentLength;
  }
  if (!count) throw new ProjectParseError('The project archive is empty.');
}

/** Safely restores an archive to the existing data-URL based runtime model. */
export function parseProjectArchive(bytes: Uint8Array): Project {
  validateZipDirectory(bytes);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ProjectParseError('The project archive is corrupt or uses an unsupported ZIP feature.');
  }
  const manifestBytes = files['project.json'];
  if (!manifestBytes) throw new ProjectParseError('The project archive is missing project.json.');
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new ProjectParseError('project.json is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null) throw new ProjectParseError('project.json does not contain a project object.');
  const manifest = raw as Record<string, unknown>;
  const restore = (key: 'assets' | 'audio' | 'fonts', prefix: string): unknown[] => {
    const records = manifest[key];
    if (records === undefined) return [];
    if (!Array.isArray(records)) throw new ProjectParseError(`project.json has an invalid ${key} table.`);
    return records.map((value, index) => {
      if (typeof value !== 'object' || value === null) throw new ProjectParseError(`Invalid ${key} record ${index + 1}.`);
      const record = value as Record<string, unknown>;
      if (typeof record.path !== 'string' || typeof record.mimeType !== 'string') throw new ProjectParseError(`${key} record ${index + 1} has no path or MIME type.`);
      const extension = MIME_EXTENSIONS[record.mimeType];
      const expected = typeof record.id === 'string' && extension
        ? `assets/${prefix}/${safeAssetName(record.id)}.${extension}`
        : '';
      if (!expected || record.path !== expected) throw new ProjectParseError(`Asset path "${record.path}" does not match its id and MIME type.`);
      const content = files[record.path];
      if (!content) throw new ProjectParseError(`The project archive is missing referenced asset "${record.path}".`);
      const { path: _path, ...asset } = record;
      return { ...asset, dataUrl: encodeDataUrl(record.mimeType, content) };
    });
  };
  const hydrated = { ...manifest, assets: restore('assets', 'images'), audio: restore('audio', 'audio'), fonts: restore('fonts', 'fonts') };
  const project = parseProject(JSON.stringify(hydrated));
  if (project.assets.length !== hydrated.assets.length || project.audio.length !== hydrated.audio.length || project.fonts.length !== hydrated.fonts.length) {
    throw new ProjectParseError('project.json contains an invalid asset record.');
  }
  return project;
}

export interface SaveResult {
  /** False when the user dismissed the picker — not an error, just a no-op. */
  saved: boolean;
  fileName?: string;
}

/**
 * Hands the browser a file to save. Exported because code export uses the same
 * path: there is no picker to reuse for generated files, and this is the one
 * mechanism that works on every browser including phones.
 */
export function downloadFile(
  contents: string | Blob | Uint8Array,
  fileName: string,
  mimeType = 'application/json',
): void {
  const blob = new Blob(
    [contents instanceof Uint8Array ? Uint8Array.from(contents).buffer : contents],
    { type: mimeType },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers; one turn of
  // the event loop is enough for the navigation to have started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param forcePrompt "Save As" — always ask for a location, even if we hold a handle.
 */
export async function saveProject(
  project: Project,
  forcePrompt = false,
): Promise<SaveResult> {
  const contents = createProjectArchive(project);
  const fileName = suggestedFileName(project);

  const showSaveFilePicker = picker().showSaveFilePicker;
  if (showSaveFilePicker) {
    try {
      const handle =
        !forcePrompt && currentHandle
          ? currentHandle
          : await showSaveFilePicker({
              suggestedName: fileName,
              types: [FILE_TYPE_OPTIONS],
            });
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      currentHandle = handle;
      return { saved: true, fileName: handle.name };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { saved: false };
      }
      // A revoked permission or a handle gone stale shouldn't lose the user's
      // work — fall through to the download path rather than throwing.
      currentHandle = null;
    }
  }

  downloadFile(contents, fileName, 'application/zip');
  return { saved: true, fileName };
}

export class ProjectParseError extends Error {}

/**
 * The only data URLs an asset may carry.
 *
 * Import re-encodes every image to PNG or JPEG, so this is exactly what this
 * editor writes — but a project file is untrusted input, and its asset table is
 * the one place in the document whose contents get handed to an `<img>` and
 * embedded verbatim in exported code. An SVG data URL can carry script, and
 * `javascript:` is not an image at all; neither has any business here, and
 * neither is something the editor can produce.
 */
const ASSET_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

/**
 * The only data URLs a sound may carry.
 *
 * `ASSET_DATA_URL`'s sibling, and deliberately a second regex rather than one
 * loosened to `data:(image|audio)/…`: the two guard different tables that reach
 * different places, and a single pattern covering both would let an audio mime
 * through to the `<img>` and the `ASSETS` literal, and an image through to the
 * loader's audio path. The list is the same one `audio.ts` allows on import —
 * one guards the picker, this guards the file.
 */
const AUDIO_DATA_URL = /^data:audio\/(mpeg|ogg|wav|mp4|webm);base64,[A-Za-z0-9+/]+=*$/;

/**
 * The only data URLs a font may carry.
 *
 * A third sibling, never a loosening of either of the two above, for the reason
 * `AUDIO_DATA_URL` already gives: these guard three tables that reach three
 * different places, and one pattern covering all of them would let a font mime
 * through to the `<img>` and the `ASSETS` literal. The list is the same one
 * `fonts.ts` allows on import.
 */
const FONT_DATA_URL = /^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/]+=*$/;

/**
 * An asset's frame grid, rebuilt field by field like the asset around it.
 *
 * Undefined for anything that is not four finite non-negative numbers with a
 * positive frame size, which drops a malformed grid back to "this is a plain
 * image" — a usable state — rather than losing the image with it. Whether the
 * grid actually fits the image is `frameGridOf`'s question, asked everywhere it
 * is read; this only has to guarantee the shape.
 */
function parseSheet(raw: unknown): FrameGrid | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const sheet = raw as Partial<FrameGrid>;
  const size = (value: unknown, min: number): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min ? Math.floor(n) : null;
  };

  const frameWidth = size(sheet.frameWidth, 1);
  const frameHeight = size(sheet.frameHeight, 1);
  if (frameWidth === null || frameHeight === null) return undefined;

  return {
    frameWidth,
    frameHeight,
    margin: size(sheet.margin, 0) ?? 0,
    spacing: size(sheet.spacing, 0) ?? 0,
  };
}

/**
 * The atlas table on one asset, or undefined when there is not a usable one.
 *
 * `parseSheet`'s sibling, and it validates more because there is more that can
 * be wrong: a grid is four numbers, an atlas is a list of named rectangles that
 * some other program wrote. A frame that is not a rectangle is dropped and the
 * rest are kept — `parseAssets`' bargain, one level down — and an atlas with no
 * readable frame at all becomes undefined, which drops the image back to being
 * one picture rather than losing it.
 *
 * Whether a frame actually *fits* the image is `atlasOf`'s question, asked
 * everywhere it is read; this only has to guarantee the shape. The one thing it
 * does guarantee beyond shape is that a name is a non-empty string, because a
 * name is a key in the object literal the exporter emits.
 */
function parseAtlas(raw: unknown): AtlasFrame[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const size = (value: unknown, min: number): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min ? Math.floor(n) : null;
  };

  const frames: AtlasFrame[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const entry = candidate as Partial<AtlasFrame>;
    if (typeof entry.name !== 'string' || entry.name === '') continue;
    // Phaser's own reserved frame name, refused here as it is at the import and
    // for the same reason: a frame called this is dropped by `Texture.add` with
    // no warning, and every node naming it draws the whole image.
    if (entry.name === BASE_FRAME) continue;

    const x = size(entry.x, 0);
    const y = size(entry.y, 0);
    const width = size(entry.width, 1);
    const height = size(entry.height, 1);
    if (x === null || y === null || width === null || height === null) continue;

    const frame: AtlasFrame = { name: entry.name, x, y, width, height };
    // Trim is all four numbers or none, exactly as it is on the way in: Phaser
    // reads `spriteSourceSize` only when `trimmed` is set, and a frame claiming
    // to be trimmed with no size to be trimmed from draws at the wrong scale.
    const sourceWidth = size(entry.sourceWidth, 1);
    const sourceHeight = size(entry.sourceHeight, 1);
    if (entry.trimmed === true && sourceWidth !== null && sourceHeight !== null) {
      frame.trimmed = true;
      frame.sourceWidth = sourceWidth;
      frame.sourceHeight = sourceHeight;
      frame.offsetX = size(entry.offsetX, 0) ?? 0;
      frame.offsetY = size(entry.offsetY, 0) ?? 0;
    }
    frames.push(frame);
  }
  return frames.length > 0 ? frames : undefined;
}

/**
 * Keeps only the assets that are actually usable, rather than failing the whole
 * open. A project with one unreadable image should still give the user back the
 * rest of their work; the sprites pointing at it fall back to the placeholder,
 * which is the same state as an image they deleted.
 */
function parseAssets(raw: unknown): ImageAsset[] {
  if (!Array.isArray(raw)) return [];

  const assets: ImageAsset[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const asset = candidate as Partial<ImageAsset>;
    if (typeof asset.id !== 'string' || !asset.id) continue;
    if (typeof asset.dataUrl !== 'string' || !ASSET_DATA_URL.test(asset.dataUrl)) continue;

    const width = Number(asset.width);
    const height = Number(asset.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      continue;
    }

    const sheet = parseSheet(asset.sheet);
    const atlas = parseAtlas(asset.atlas);
    assets.push({
      id: asset.id,
      name: typeof asset.name === 'string' ? asset.name : 'image',
      mimeType: asset.dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
      dataUrl: asset.dataUrl,
      width,
      height,
      // Spread rather than assigned so a plain image has no `sheet` key at all,
      // which is what makes `JSON.stringify` of a shape-only project identical
      // to what it was before sheets existed. The atlas follows that rule for
      // its own reason: a project made before atlases existed has to save byte
      // for byte what it always did.
      //
      // A grid wins a file that somehow holds both, because it is the older of
      // the two and so the one an older build could have written. Nothing the
      // editor writes can be in that state — `setAssetSheet` and
      // `setAssetAtlas` delete each other's field — so this is the hand-edited
      // case, and `frameGridOf`'s strip-on-read would otherwise have the atlas
      // win by accident rather than by decision.
      ...(sheet ? { sheet } : atlas ? { atlas } : {}),
    });
  }
  return assets;
}

/**
 * The audio table, on the terms the asset table is parsed on: drop the entry
 * that is not usable, keep the project.
 *
 * The mime type is re-derived from the data URL rather than trusted from the
 * file, exactly as `parseAssets` does — but as a lookup rather than that
 * function's two-way ternary, because there are five of them here and a
 * ternary's fallback would quietly relabel an OGG as an MP3. The regex has
 * already established that the prefix is one of the five, so the map cannot
 * miss.
 *
 * A scene's `sounds` list is deliberately *not* parsed here. It rides in on
 * `scenes`, the one part of a file passed through verbatim, and `soundsOf` is
 * its validator — the guides arrangement exactly, and the reason the scene half
 * of this feature did not have to bump the schema version on its own.
 */
function parseAudio(raw: unknown): AudioAsset[] {
  if (!Array.isArray(raw)) return [];

  const table: AudioAsset[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const asset = candidate as Partial<AudioAsset>;
    if (typeof asset.id !== 'string' || !asset.id) continue;
    if (typeof asset.dataUrl !== 'string' || !AUDIO_DATA_URL.test(asset.dataUrl)) continue;

    table.push({
      id: asset.id,
      name: typeof asset.name === 'string' ? asset.name : 'sound',
      mimeType: asset.dataUrl.slice('data:'.length, asset.dataUrl.indexOf(';')),
      dataUrl: asset.dataUrl,
      // A duration is a label rather than a load-bearing number, so a bad one
      // costs the label and not the sound.
      duration: Number.isFinite(Number(asset.duration)) && Number(asset.duration) > 0
        ? Number(asset.duration)
        : 0,
    });
  }
  return table;
}

/**
 * The variable table, rebuilt field by field like every project table above it.
 *
 * There is deliberately no `variablesOf` beside `rulesOf` in `schema.ts`, and
 * the asymmetry is this file's rather than an oversight. Scene state gets a
 * read-site validator — `guidesOf`, `soundsOf`, `collidersOf`, `cameraOf` —
 * because `scenes` is the one part of an opened file that is *not* rebuilt
 * field by field, so a `?? []` at each call site would be trusting a string
 * from disk five times over. A project table is rebuilt here instead, once,
 * which is exactly why adding one bumps `SCHEMA_VERSION` and adding a scene
 * field does not.
 *
 * A row is dropped rather than repaired when it has no usable id, because a
 * rule names a variable by id and an invented one would name nothing. The
 * *name* is repaired, because it is free text with a sensible fallback and
 * `variableKeyOf` turns whatever survives into an identifier anyway. A
 * non-finite `value` becomes 0 rather than costing the row: it is the number
 * the game starts on, and every condition still works against zero.
 *
 * **A string `value` is kept as a string, and that is the whole of v14 on this
 * side.** A variable's kind is the type of its value, so coercing here is not a
 * repair but a change of kind — and a change of kind the rules naming it cannot
 * survive, since `rulesOf` refuses a condition comparing a number with text. It
 * is also what a v13 build does to a v14 file, which is what `SCHEMA_VERSION`'s
 * comment is about. Anything that is neither a string nor a finite number is
 * still the existing `0`.
 */
function parseVariables(raw: unknown): ProjectVariable[] {
  if (!Array.isArray(raw)) return [];

  const table: ProjectVariable[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const variable = candidate as Partial<ProjectVariable>;
    if (typeof variable.id !== 'string' || !variable.id) continue;
    // A repeated id would have `findVariable` answer with whichever it reached
    // first, so two rules naming what looks like two variables would share one
    // — `parseAssets`' concern, and `tileMapOf`'s layer ids.
    if (seen.has(variable.id)) continue;
    seen.add(variable.id);

    const number = Number(variable.value);
    table.push({
      id: variable.id,
      name: typeof variable.name === 'string' ? variable.name : 'variable',
      value:
        typeof variable.value === 'string'
          ? variable.value
          : Number.isFinite(number)
            ? number
            : 0,
    });
  }
  return table;
}

/**
 * The font table, rebuilt field by field like the two tables above it.
 *
 * Two things are dropped rather than repaired, and the second is the one worth
 * explaining. A bad data URL, as everywhere else. And **a family that is not a
 * plain token**, because a repaired family would no longer be the string the
 * text nodes name — so the font would sit in the table, look imported, and
 * apply to nothing. Dropping it lands in the state this feature already has a
 * code path for: the text draws in the browser's fallback, which is what it did
 * before the font existed.
 *
 * That is also what means nothing downstream escapes a family. Every family
 * that survives an open matches `FONT_FAMILY`, so the exporter's `str(...)`
 * around it is belt-and-braces rather than the only guard — which is the
 * opposite of how the scene name and the background colour once reached the
 * runnable page raw.
 */
function parseFonts(raw: unknown): FontAsset[] {
  if (!Array.isArray(raw)) return [];

  const table: FontAsset[] = [];
  const families = new Set<string>();
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const asset = candidate as Partial<FontAsset>;
    if (typeof asset.id !== 'string' || !asset.id) continue;
    if (typeof asset.dataUrl !== 'string' || !FONT_DATA_URL.test(asset.dataUrl)) continue;
    if (typeof asset.family !== 'string' || !FONT_FAMILY.test(asset.family)) continue;
    // Two fonts under one family would have `fontByFamily` answer with whichever
    // it reached first, and the exporter emit one `load.font` for both.
    if (families.has(asset.family)) continue;
    families.add(asset.family);

    table.push({
      id: asset.id,
      name: typeof asset.name === 'string' ? asset.name : 'font',
      family: asset.family,
      // Re-derived from the data URL rather than trusted from the file, which
      // is `parseAudio`'s call and for its reason: there are four of them, and
      // a ternary's fallback would quietly relabel a WOFF2 as a TTF — a font
      // handed the wrong `format()` hint is refused outright by the browser.
      mimeType: asset.dataUrl.slice('data:'.length, asset.dataUrl.indexOf(';')),
      dataUrl: asset.dataUrl,
    });
  }
  return table;
}

/**
 * The animation table, validated against the assets that survived the open.
 *
 * A clip is dropped rather than repaired when it names an asset that is not
 * there. That is stricter than the treatment of a sprite pointing at a missing
 * image — which is tolerated, and draws the placeholder — and the difference is
 * that a dangling clip has no such state to fall back to: `generateFrameNumbers`
 * on a texture that was never loaded throws, so a clip like that would export a
 * game that does not boot. A sprite whose animation went with it simply shows
 * its frame, which is exactly what a sprite with no animation is.
 *
 * Everything else is clamped rather than rejected, on the same principle the
 * asset table follows: one bad number should not cost the user the clip.
 */
function parseAnimations(raw: unknown, assets: ImageAsset[]): AnimationClip[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(assets.map((asset) => asset.id));

  const clips: AnimationClip[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const clip = candidate as Partial<AnimationClip>;
    if (typeof clip.id !== 'string' || !clip.id) continue;
    if (typeof clip.assetId !== 'string' || !known.has(clip.assetId)) continue;

    // Indices or names, matching however the clip's asset is cut. Which of the
    // two a clip should hold is `recutClipFrames`' question and `updateAnimation`'s;
    // this only establishes that each entry is one or the other, so a hand-edited
    // file cannot put an object or a NaN into a list Phaser will iterate.
    const frames: (number | string)[] = Array.isArray(clip.frames)
      ? clip.frames.flatMap((frame): (number | string)[] => {
          if (typeof frame === 'string') return frame === '' ? [] : [frame];
          const index = Number(frame);
          return Number.isFinite(index) && index >= 0 ? [Math.floor(index)] : [];
        })
      : [];
    // A clip with no frames has nothing to play and cannot be given one.
    if (frames.length === 0) continue;

    const frameRate = Number(clip.frameRate);
    const repeat = Number(clip.repeat);
    clips.push({
      id: clip.id,
      name: typeof clip.name === 'string' ? clip.name : 'animation',
      assetId: clip.assetId,
      frames,
      frameRate: Number.isFinite(frameRate) && frameRate > 0 ? frameRate : DEFAULT_FRAME_RATE,
      // Anything below -1 is not a Phaser repeat count; -1 is its "forever".
      repeat: Number.isFinite(repeat) ? Math.max(-1, Math.floor(repeat)) : -1,
    });
  }
  return clips;
}

/**
 * Rebuilds the prefab library from an opened file.
 *
 * The same shape `parseAnimations` has, and the same trade: an entry needs an
 * id, a name and an array of children to be a prefab at all, and one that is
 * not is dropped rather than failing the open — a single unreadable definition
 * should not cost the user the rest of their project.
 *
 * The children themselves are passed through unvalidated, exactly as `scenes`
 * are, and for the same reason: they are nodes, and nothing here has ever
 * validated a node. `prefabChildrenOf` is the read-site check that makes that
 * safe, the job `guidesOf` does for a scene's guides.
 */
function parsePrefabs(raw: unknown): Prefab[] {
  if (!Array.isArray(raw)) return [];

  const prefabs: Prefab[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const prefab = candidate as Partial<Prefab>;
    if (typeof prefab.id !== 'string' || !prefab.id) continue;
    if (!Array.isArray(prefab.children)) continue;
    prefabs.push({
      id: prefab.id,
      name: typeof prefab.name === 'string' ? prefab.name : 'Prefab',
      children: prefab.children,
    });
  }
  return prefabs;
}

/** Parses and validates untrusted file contents into a Project. */
export function parseProject(contents: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch {
    throw new ProjectParseError("That file isn't valid JSON.");
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new ProjectParseError("That file doesn't look like a project.");
  }

  const candidate = raw as Partial<Project>;
  if (typeof candidate.schemaVersion !== 'number') {
    throw new ProjectParseError(
      "That file doesn't look like a Phaser GUI Tool project (no schemaVersion).",
    );
  }
  if (candidate.schemaVersion > SCHEMA_VERSION) {
    throw new ProjectParseError(
      `This project was made with a newer version of the editor ` +
        `(format v${candidate.schemaVersion}, this build reads v${SCHEMA_VERSION}).`,
    );
  }
  if (
    !Array.isArray(candidate.scenes) ||
    candidate.scenes.length === 0 ||
    candidate.scenes.some(
      (scene) => typeof scene !== 'object' || scene === null || typeof scene.id !== 'string' || !scene.id,
    )
  ) {
    throw new ProjectParseError('That project has no valid scenes.');
  }

  const assets = parseAssets(candidate.assets);
  const scenes = candidate.scenes;
  const activeSceneId =
    candidate.activeSceneId && scenes.some((s) => s.id === candidate.activeSceneId)
      ? candidate.activeSceneId
      : scenes[0].id;

  return {
    // Stamped with this build's version, not the file's. What this function
    // returns is already in this build's shape — every table below is rebuilt
    // by this build's rules — and the version is a claim about the shape. Kept
    // as the file's, a v14 project opened here, given a round body and saved
    // would still say v14, and a v14 build would open it and silently draw the
    // box `SCHEMA_VERSION`'s v15 note describes: the bump would only ever
    // protect files that were *made* in a current build.
    schemaVersion: SCHEMA_VERSION,
    name: typeof candidate.name === 'string' ? candidate.name : 'Untitled Project',
    phaserVersion:
      typeof candidate.phaserVersion === 'string' ? candidate.phaserVersion : 'unknown',
    // Absent in v1 files, which is a valid project with no images.
    assets,
    // Absent before v8, which is a valid project that makes no noise. This is
    // the line the version bump is about: an older build reaching this point
    // does not have it, so it drops the table and re-saves without it.
    audio: parseAudio(candidate.audio),
    // Absent before v10, which is a valid project whose text is all drawn in
    // fonts the machine already has. This is the line the v10 bump is about,
    // and it is the audio one made worse: a v9 build reaching here drops the
    // table and re-saves without it, leaving every text node naming a family
    // whose bytes are gone — and going on drawing, in some other face.
    fonts: parseFonts(candidate.fonts),
    // Absent before v4, which is a valid project whose sprites are all still.
    animations: parseAnimations(candidate.animations, assets),
    // Absent before v5, which is a valid project that uses no prefabs.
    prefabs: parsePrefabs(candidate.prefabs),
    // Absent before v13, which is a valid project that counts nothing. This is
    // the line the v13 bump is about, and it is the audio and font case for a
    // third time: a v12 build reaching here drops the table and re-saves
    // without it, leaving every rule in the file naming variables that are no
    // longer declared — so `rulesOf` drops the rules as well, and the project
    // goes on opening and drawing while quietly no longer being a game.
    variables: parseVariables(candidate.variables),
    scenes,
    activeSceneId,
  };
}

export interface OpenResult {
  project: Project;
  fileName: string;
}

async function parseProjectFile(file: File): Promise<Project> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
  if (isZip || file.name.toLowerCase().endsWith('.zip')) return parseProjectArchive(bytes);
  return parseProject(strFromU8(bytes));
}

/** Resolves to null if the user dismissed the picker. */
export async function openProject(): Promise<OpenResult | null> {
  const showOpenFilePicker = picker().showOpenFilePicker;
  if (showOpenFilePicker) {
    try {
      const [handle] = await showOpenFilePicker({
        multiple: false,
        types: OPEN_FILE_TYPE_OPTIONS,
      });
      const file = await handle.getFile();
      const project = await parseProjectFile(file);
      // Legacy JSON is import-only: Save always produces an archive and must
      // never silently overwrite the user's migration source with ZIP bytes.
      currentHandle = file.name.toLowerCase().endsWith(FILE_EXTENSION) ? handle : null;
      return { project, fileName: handle.name };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      if (error instanceof ProjectParseError) throw error;
      // Fall through to the input fallback on any picker-level failure.
    }
  }

  const file = await pickFileViaInput('.phaser.zip,.phaser.json,.zip,.json,application/zip,application/json');
  if (!file) return null;
  const project = await parseProjectFile(file);
  currentHandle = null; // No handle on this path: saving re-downloads.
  return { project, fileName: file.name };
}

/**
 * Asks the user for an image.
 *
 * There is no File System Access path here on purpose: `<input type="file">`
 * with an image accept list is what opens the camera roll on a phone, which is
 * where the images are, and it is the one mechanism every browser has.
 */
export const pickImageFile = (): Promise<File | null> => pickFileViaInput('image/*');

/** The same, for a sound. `audio/*` is what opens a phone's music library. */
export const pickAudioFile = (): Promise<File | null> => pickFileViaInput('audio/*');

/**
 * The same, for a font — and the one accept list that names extensions.
 *
 * `font/*` is not a wildcard browsers honour, and the mime a platform reports
 * for a font file is unreliable enough that `fonts.ts` declines to trust it at
 * all. An extension list is what actually filters the picker here.
 */
export const pickFontFile = (): Promise<File | null> =>
  pickFileViaInput('.ttf,.otf,.woff,.woff2');

/**
 * The same, for a texture atlas's JSON.
 *
 * Both the extension and the mime, because a `.json` picked out of a folder
 * reports `application/json` on every platform this runs on — unlike a font —
 * but a packer that writes `.atlas` or nothing at all is common enough that the
 * extension alone would hide files the user can see.
 */
export const pickAtlasFile = (): Promise<File | null> =>
  pickFileViaInput('.json,application/json');

function pickFileViaInput(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // Keep it in the DOM but invisible: iOS Safari ignores clicks on detached
    // inputs, and `display:none` suppresses the picker in some browsers.
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    // There is no reliable "picker dismissed" event; window focus returning
    // without a change event is the standard approximation.
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish(input.files?.[0] ?? null), 500),
      { once: true },
    );

    input.click();
  });
}
