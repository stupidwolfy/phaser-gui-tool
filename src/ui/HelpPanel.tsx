import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import packageInfo from '../../package.json';
import { TARGET_PHASER_VERSION } from '../core/schema';

export interface HelpTopic {
  id: string;
  title: string;
  searchTerms: readonly string[];
  paragraphs: readonly string[];
  steps?: readonly string[];
}

/** The single source of truth for help copy and deep-linkable topic IDs. */
export const HELP_TOPICS = [
  {
    id: 'projects', title: 'Save and open projects', searchTerms: ['save', 'open', 'zip', 'project', 'backup'],
    paragraphs: ['Save writes a ZIP project to your device. The ZIP contains the project document and its imported assets, so it can be moved or shared as one file. Open accepts a ZIP created by this editor.'],
    steps: ['Choose Save (Ctrl/Cmd+S) to update the current file when the browser supports it.', 'Choose Save As to create a separate copy, or Open (Ctrl/Cmd+O) to replace the current project.'],
  },
  {
    id: 'local-storage', title: 'Local recovery draft', searchTerms: ['local storage', 'autosave', 'recovery', 'privacy', 'browser'],
    paragraphs: ['A recovery draft is kept in this browser’s local storage while you edit. It is not uploaded and is not a substitute for saving a project ZIP. Clearing site data removes the draft.'],
  },
  {
    id: 'preview', title: 'Preview motion', searchTerms: ['preview', 'motion', 'tween', 'particles'],
    paragraphs: ['Preview motion animates sprites, particles, and tweens on the editor canvas without changing the document. Press the Preview motion toolbar button again to stop it.'],
  },
  {
    id: 'play', title: 'Play game', searchTerms: ['play', 'run', 'game', 'test'],
    paragraphs: ['Play game runs the exported game in a modal surface. Use Stop to return to editing; the game owns its keyboard while running, so Escape does not stop it.'],
  },
  {
    id: 'assets', title: 'Assets', searchTerms: ['assets', 'image', 'audio', 'font', 'atlas', 'spritesheet'],
    paragraphs: ['Import images, sprite sheets, atlases, audio, and fonts in the Assets sections. Imported bytes are stored with the project, so save after adding or changing an asset.'],
  },
  {
    id: 'animation', title: 'Animation', searchTerms: ['animation', 'frames', 'sprite', 'clip'],
    paragraphs: ['Create an animation clip from frames in a sliced sheet or atlas, then select that clip on a sprite. Use Preview motion to check timing without starting the game.'],
  },
  {
    id: 'physics', title: 'Physics', searchTerms: ['physics', 'body', 'collision', 'matter', 'gravity'],
    paragraphs: ['Enable physics for a scene, then add a body to an object in its Physics inspector section. Configure shape, static behavior, sensors, and collision filters there; Play game tests the exported behavior.'],
  },
  {
    id: 'rules', title: 'Rules and variables', searchTerms: ['rules', 'variables', 'conditions', 'actions', 'behavior'],
    paragraphs: ['Variables hold game state. Rules evaluate conditions and perform actions during Play and in exported games. Create variables first, then build scene rules that refer to them.'],
  },
  {
    id: 'exports', title: 'Export formats', searchTerms: ['export', 'typescript', 'javascript', 'html', 'ts', 'js'],
    paragraphs: ['Export .ts or .js for a Phaser Scene class to add to an existing project. Export .html for a self-contained playable page. Resolve blocking validation issues before exporting.'],
  },
  {
    id: 'shortcuts', title: 'Keyboard shortcuts', searchTerms: ['keyboard', 'shortcut', 'keys', 'undo', 'copy', 'nudge'],
    paragraphs: ['Shortcuts are ignored while typing in a field, except Save and Open. Ctrl is Cmd on macOS.'],
    steps: ['Ctrl/Cmd+S Save · Ctrl/Cmd+O Open', 'Ctrl/Cmd+Z Undo · Ctrl/Cmd+Shift+Z Redo', 'Ctrl/Cmd+C Copy · Ctrl/Cmd+V Paste · Ctrl/Cmd+D Duplicate', 'Ctrl/Cmd+A Select all · Ctrl/Cmd+G Group', 'Delete or Backspace Delete selection', 'Arrow keys Nudge 1 px · Shift+Arrow keys Nudge 10 px', 'Escape leave paint mode, otherwise clear selection'],
  },
] as const satisfies readonly HelpTopic[];

export type HelpTopicId = (typeof HELP_TOPICS)[number]['id'];

/** Descendants can deep-link to shared help without reproducing its copy. */
export const OpenHelpContext = createContext<(topic?: HelpTopicId) => void>(() => undefined);
export const useOpenHelp = () => useContext(OpenHelpContext);

export function HelpPanel({ initialTopic }: { initialTopic?: HelpTopicId }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<HelpTopicId>(initialTopic ?? 'projects');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery('');
    setSelectedId(initialTopic ?? 'projects');
  }, [initialTopic]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return HELP_TOPICS;
    return HELP_TOPICS.filter((topic) =>
      [topic.title, ...topic.searchTerms, ...topic.paragraphs, ...('steps' in topic ? topic.steps : [])]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [query]);
  const selected = HELP_TOPICS.find((topic) => topic.id === selectedId) ?? HELP_TOPICS[0];

  return (
    <div className="help">
      <label className="help__search">
        <span>Search help</span>
        <input ref={searchRef} data-dialog-initial type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “save” or “physics”" />
      </label>
      <div className="help__layout">
        <nav className="help__topics" aria-label="Help topics">
          {results.map((topic) => <button key={topic.id} className={topic.id === selected.id ? 'is-active' : ''} aria-current={topic.id === selected.id ? 'page' : undefined} onClick={() => setSelectedId(topic.id)}>{topic.title}</button>)}
          {results.length === 0 && <p role="status">No topics found. Try a shorter search.</p>}
        </nav>
        <article className="help__article" id={`help-topic-${selected.id}`}>
          <h3>{selected.title}</h3>
          {selected.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {'steps' in selected && <ul>{selected.steps.map((step: string) => <li key={step}>{step}</li>)}</ul>}
        </article>
      </div>
      <footer className="help__footer">
        <span>Phaser GUI Tool {packageInfo.version} · Phaser {TARGET_PHASER_VERSION}</span>
        <span><a href="https://docs.phaser.io/" target="_blank" rel="noreferrer">Phaser documentation</a> · <a href="https://github.com/stupidwolfy/phaser-gui-tool/issues/new" target="_blank" rel="noreferrer">Send feedback</a></span>
      </footer>
    </div>
  );
}
