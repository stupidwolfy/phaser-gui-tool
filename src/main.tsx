import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useEditorStore } from './core/store';
import { loadPrefs, savePrefs } from './io/prefs';
import './styles/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

/*
 * Editor preferences, wired up here rather than inside the store.
 *
 * Nothing in `core/` imports from `io/` — the store's job is the document and
 * the editor state over it, not where either is kept — so the composition root
 * does the reading and the writing and the store stays a leaf. It also has to
 * happen *before* `render`: hydrating in an effect instead would paint the
 * panel once with everything closed and then snap it open a frame later.
 */
const prefs = loadPrefs();
useEditorStore.getState().hydrateSections(prefs.sections.openByDefault, prefs.sections.overrides);

// A vanilla subscribe, the same channel `EditorScene` uses, because persisting
// is not a render. Writing on every change needs no debounce the way the draft
// does: this is fifty bytes at click rate, not a project full of images.
useEditorStore.subscribe((state, previous) => {
  if (
    state.sectionsOpenByDefault === previous.sectionsOpenByDefault &&
    state.sectionOverrides === previous.sectionOverrides
  ) {
    return;
  }
  savePrefs({
    sections: {
      openByDefault: state.sectionsOpenByDefault,
      overrides: state.sectionOverrides,
    },
  });
});

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
