import { SCHEMA_VERSION, type Project } from '../core/schema';

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

  const file = await pickFileViaInput();
  if (!file) return null;
  const project = parseProject(await file.text());
  currentHandle = null; // No handle on this path: saving re-downloads.
  return { project, fileName: file.name };
}

function pickFileViaInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
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
