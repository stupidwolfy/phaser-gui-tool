import { DEFAULT_FRAME_RATE } from '../core/defaults';
import {
  SCHEMA_VERSION,
  type AnimationClip,
  type FrameGrid,
  type ImageAsset,
  type Project,
} from '../core/schema';

/**
 * Saving and opening project files, entirely on the user's device.
 *
 * Two code paths, because the File System Access API (`showSaveFilePicker`) is
 * desktop-Chromium only — it is absent on Chrome for Android, on iOS Safari, and
 * in Firefox. Mobile is a first-class target here, so the download/`<input>`
 * fallback is not a degraded mode, it is the path most phone users will take.
 */

export const FILE_EXTENSION = '.phaser.json';
const FILE_TYPE_OPTIONS = {
  description: 'Phaser GUI project',
  accept: { 'application/json': ['.json'] as string[] },
};

// The File System Access API is still not in lib.dom for every TS release, and
// it is absent at runtime on most mobile browsers. Declaring only what we use
// keeps the feature detection honest instead of pretending the API is always
// there.
interface FileSystemWritable {
  write: (data: string) => Promise<void>;
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
    types?: typeof FILE_TYPE_OPTIONS[];
  }) => Promise<FileHandle>;
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    types?: typeof FILE_TYPE_OPTIONS[];
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
  contents: string,
  fileName: string,
  mimeType = 'application/json',
): void {
  const blob = new Blob([contents], { type: mimeType });
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
  const contents = serializeProject(project);
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

  downloadFile(contents, fileName);
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
    assets.push({
      id: asset.id,
      name: typeof asset.name === 'string' ? asset.name : 'image',
      mimeType: asset.dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
      dataUrl: asset.dataUrl,
      width,
      height,
      // Spread rather than assigned so a plain image has no `sheet` key at all,
      // which is what makes `JSON.stringify` of a shape-only project identical
      // to what it was before sheets existed.
      ...(sheet ? { sheet } : {}),
    });
  }
  return assets;
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

    const frames = Array.isArray(clip.frames)
      ? clip.frames
          .map((frame) => Number(frame))
          .filter((frame) => Number.isFinite(frame) && frame >= 0)
          .map((frame) => Math.floor(frame))
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
  if (!Array.isArray(candidate.scenes) || candidate.scenes.length === 0) {
    throw new ProjectParseError('That project has no scenes.');
  }

  const assets = parseAssets(candidate.assets);
  const scenes = candidate.scenes;
  const activeSceneId =
    candidate.activeSceneId && scenes.some((s) => s.id === candidate.activeSceneId)
      ? candidate.activeSceneId
      : scenes[0].id;

  return {
    schemaVersion: candidate.schemaVersion,
    name: typeof candidate.name === 'string' ? candidate.name : 'Untitled Project',
    phaserVersion:
      typeof candidate.phaserVersion === 'string' ? candidate.phaserVersion : 'unknown',
    // Absent in v1 files, which is a valid project with no images.
    assets,
    // Absent before v4, which is a valid project whose sprites are all still.
    animations: parseAnimations(candidate.animations, assets),
    scenes,
    activeSceneId,
  };
}

export interface OpenResult {
  project: Project;
  fileName: string;
}

/** Resolves to null if the user dismissed the picker. */
export async function openProject(): Promise<OpenResult | null> {
  const showOpenFilePicker = picker().showOpenFilePicker;
  if (showOpenFilePicker) {
    try {
      const [handle] = await showOpenFilePicker({
        multiple: false,
        types: [FILE_TYPE_OPTIONS],
      });
      const file = await handle.getFile();
      const project = parseProject(await file.text());
      currentHandle = handle;
      return { project, fileName: handle.name };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      if (error instanceof ProjectParseError) throw error;
      // Fall through to the input fallback on any picker-level failure.
    }
  }

  const file = await pickFileViaInput('application/json,.json');
  if (!file) return null;
  const project = parseProject(await file.text());
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
