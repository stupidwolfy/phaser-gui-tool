import type { Project } from '../core/schema';
import { parseProject, serializeProject } from './fileIO';

/**
 * A debounced draft of the current project in localStorage.
 *
 * This is not a replacement for saving to a file — it is insurance. Mobile
 * browsers discard background tabs aggressively, and losing ten minutes of
 * work to a phone call is a bad first impression.
 */

const DRAFT_KEY = 'phaser-gui-tool:draft:v1';
const DEBOUNCE_MS = 800;

let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleDraftSave(project: Project): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, serializeProject(project));
    } catch {
      // Private browsing or a full quota. A missing draft is not worth an error.
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
