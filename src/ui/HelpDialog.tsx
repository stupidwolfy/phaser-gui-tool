import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useEditorStore } from '../core/store';
import {
  HELP_LINKS,
  HELP_VERSIONS,
  SHORTCUTS,
  findHelpTopic,
  searchHelp,
  type HelpTopic,
} from './helpContent';

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * The Help dialog: a searchable list of task topics, one topic at a time, and
 * the version line.
 *
 * A fixed overlay rather than a slot in the layout, for Play's reason: giving it
 * a share of the flow would resize `.app__center`, which re-fits the editor's
 * camera on the way in and again on the way out. Nothing underneath changes, so
 * closing it leaves the selection, the open panels and the view as they were.
 *
 * Opened through `openHelp` in the store, so a section's "?" and a validation
 * row can land on a topic directly. Focus returns to whatever opened it.
 */
export function HelpDialog() {
  const topic = useEditorStore((s) => s.helpTopic);
  if (topic === null) return null;
  return <HelpPanel topic={topic} />;
}

function HelpPanel({ topic }: { topic: string }) {
  const openHelp = useEditorStore((s) => s.openHelp);
  const closeHelp = useEditorStore((s) => s.closeHelp);
  const [query, setQuery] = useState('');
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const current = topic === 'index' ? undefined : findHelpTopic(topic);

  useEffect(() => {
    return () => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);

  // The search box on the list, the way back on a topic: the first thing either
  // view is for. Keyed on the topic so that pressing a result moves focus too.
  useEffect(() => {
    if (current) backRef.current?.focus();
    else searchRef.current?.focus();
  }, [current]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      // Stops the window handler from also deselecting: Escape closes the
      // innermost thing, and Help is above everything.
      event.stopPropagation();
      closeHelp();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const results = searchHelp(query);

  return (
    <div className="help" onKeyDown={onKeyDown}>
      <div
        ref={panelRef}
        className="help__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="help__header">
          <h2 id={titleId} className="help__title">
            Help
          </h2>
          <button className="icon-btn" onClick={closeHelp} aria-label="Close help" title="Close help">
            ✕
          </button>
        </div>

        <div className="help__body">
          {current ? (
            <TopicView topic={current} backRef={backRef} onBack={() => openHelp()} />
          ) : (
            <>
              <input
                ref={searchRef}
                type="search"
                className="field__input help__search"
                placeholder="Search help — try “save” or “physics”"
                aria-label="Search help"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {results.length === 0 ? (
                <p className="hint" role="status">
                  Nothing matches “{query}”. Try a shorter word.
                </p>
              ) : (
                <ul className="help__results" aria-label="Help topics">
                  {results.map((result) => (
                    <li key={result.id}>
                      <button
                        className="help__result"
                        data-topic={result.id}
                        onClick={() => openHelp(result.id)}
                      >
                        {result.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <footer className="help__footer">
          <span>
            Phaser GUI Tool {__APP_VERSION__} · exports Phaser {HELP_VERSIONS.phaser} · file format{' '}
            {HELP_VERSIONS.schema}
          </span>
          <span>
            <a href={HELP_LINKS.docs} target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
            {' · '}
            <a href={HELP_LINKS.feedback} target="_blank" rel="noopener noreferrer">
              Send feedback
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}

function TopicView({
  topic,
  backRef,
  onBack,
}: {
  topic: HelpTopic;
  backRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
}) {
  return (
    <article className="help__topic" data-topic={topic.id}>
      <button ref={backRef} className="btn help__back" onClick={onBack}>
        <span aria-hidden="true">←</span> All topics
      </button>
      <h3>{topic.title}</h3>
      {topic.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {topic.steps && (
        <ol>
          {topic.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {topic.id === 'shortcuts' && (
        <table className="help__keys">
          <thead>
            <tr>
              <th scope="col">Keys</th>
              <th scope="col">Does</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((row) => (
              <tr key={row.keys}>
                <td>
                  <kbd>{row.keys}</kbd>
                </td>
                <td>{row.does}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
