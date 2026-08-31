import type { Project } from '../core/schema';
import { parseProject, serializeProject } from './fileIO';

/**
 * A debounced draft of the current project in localStorage.
 *
 * This is not a replacement for saving to a file — it is insurance. Mobile
 * browsers discard background tabs aggressively, and losing ten minutes of
 * work to a phone call is a bad first impression.
 *
 * Since images are embedded in the document, a project with a few of them can
 * exceed the ~5 MB localStorage quota, and then this insurance quietly stops
 * existing. That is exactly when the user most needs to know, so a failure is
 * reported once rather than swallowed — the draft is a nice-to-have, but
 * silently believing you have one is worse than knowing you don't.
 */

const DRAFT_KEY = 'phaser-gui-tool:draft:v1';
const DEBOUNCE_MS = 800;

let timer: ReturnType<typeof setTimeout> | undefined;
/** Reported at most once per session: it would otherwise fire on every edit. */
let reportedFailure = false;

export function scheduleDraftSave(
  project: Project,
  onFailure?: (message: string) => void,
): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, serializeProject(project));
      reportedFailure = false;
    } catch {
      // Private browsing, or a project whose images no longer fit the quota.
      // Clear the stale draft either way: restoring a version from before the
      // images were added would be worse than restoring nothing.
      clearDraft();
      if (!reportedFailure) {
        reportedFailure = true;
        onFailure?.(
          'This project is too large to autosave in the browser — save it to a file.',
        );
      }
    }
  }, DEBOUNCE_MS);
}

export function loadDraft(): Project | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? parseProject(raw) : null;
  } catch {
    // A corrupt or stale-format draft should never block the editor booting.
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
