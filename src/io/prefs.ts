/**
 * Small, non-document editor preferences in localStorage.
 *
 * Deliberately its own key and its own module rather than a corner of
 * `autosave.ts`. That one holds the *project*, which is the thing that can blow
 * the ~5 MB quota the moment a few images are imported; a preference is a
 * handful of bytes and must not be lost when the draft is cleared for being too
 * big — nor cost the user their panel layout when a save fails.
 *
 * Nothing here is document state. It never reaches `serializeProject`, never
 * marks the file dirty and is never undoable. That is the same line
 * `lockAspect` and `snapEnabled` sit on; the difference is only that those are
 * about what a gesture does right now, while these describe the shape of a
 * workspace, which is worth having back after a reload.
 *
 * Every read and write is swallowed. A private window throws on both, and a
 * missing preference must degrade to the default rather than break the editor.
 */

/** Exported so the Playwright harness seeds the real key rather than a copy of it. */
export const PREFS_KEY = 'phaser-gui-tool:prefs:v1';

/**
 * The open/closed state of the inspector's sections.
 *
 * Two fields rather than a list of what is open, because the default is the
 * thing Expand-all and Collapse-all actually change: with only a set, "collapse
 * everything" would have to enumerate every section title that exists, which is
 * a list that goes stale silently every time a section is added. Here an
 * override is only ever recorded for a section the user has touched, and an
 * absent one means whatever the default currently says.
 */
export interface SectionPrefs {
  openByDefault: boolean;
  overrides: Record<string, boolean>;
}

export const DEFAULT_SECTION_PREFS: SectionPrefs = {
  openByDefault: false,
  overrides: {},
};

interface Prefs {
  sections: SectionPrefs;
}

/**
 * Validated field by field rather than trusted, for `parseAssets`' reason: this
 * is a string from disk that a user can hand-edit, and a bad one should cost
 * the preference rather than the boot.
 */
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { sections: DEFAULT_SECTION_PREFS };
    const parsed: unknown = JSON.parse(raw);
    return { sections: parseSectionPrefs(parsed) };
  } catch {
    return { sections: DEFAULT_SECTION_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Private browsing, or a full quota. A lost preference is not worth a throw. */
  }
}

function parseSectionPrefs(raw: unknown): SectionPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_SECTION_PREFS;
  const sections = (raw as { sections?: unknown }).sections;
  if (!sections || typeof sections !== 'object') return DEFAULT_SECTION_PREFS;

  const { openByDefault, overrides } = sections as {
    openByDefault?: unknown;
    overrides?: unknown;
  };

  const clean: Record<string, boolean> = {};
  if (overrides && typeof overrides === 'object') {
    for (const [title, open] of Object.entries(overrides as Record<string, unknown>)) {
      if (typeof open === 'boolean') clean[title] = open;
    }
  }

  return { openByDefault: openByDefault === true, overrides: clean };
}
