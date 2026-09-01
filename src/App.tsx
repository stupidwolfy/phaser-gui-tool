import { useCallback, useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { useEditorStore } from './core/store';
import { clearDraft, loadDraft, scheduleDraftSave } from './io/autosave';
import { ProjectParseError, downloadFile, openProject, saveProject } from './io/fileIO';
import {
  exportFileName,
  generateRunnableHtml,
  generateScene,
  type SceneLanguage,
} from './io/exportPhaser';
import { Viewport, fitView } from './editor/Viewport';
import { Inspector } from './ui/Inspector';
import { Layout } from './ui/Layout';
import { SceneTree } from './ui/SceneTree';
import { FilePanel, Toolbar, type ToolbarActions } from './ui/Toolbar';
import { useIsMobile } from './ui/useMediaQuery';

/** Arrow-key nudge, in scene pixels; Shift takes the coarse step. */
const COARSE_NUDGE = 10;
const NUDGE_IDLE_MS = 600;
const NUDGE_STEPS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

export default function App() {
  const isMobile = useIsMobile();
  const gameRef = useRef<Phaser.Game | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 3200);
  }, []);

  // Restore the autosaved draft on first load, so a killed tab isn't lost work.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) useEditorStore.getState().loadProject(draft, null);
  }, []);

  // Keep the draft current. Subscribing outside React avoids re-rendering the
  // whole app on every pointer-move during a drag.
  useEffect(
    () =>
      useEditorStore.subscribe((state, previous) => {
        if (state.project !== previous.project) scheduleDraftSave(state.project, notify);
      }),
    [notify],
  );

  // Browsers only honour this prompt when there is unsaved work and the user
  // has interacted with the page — exactly the case we care about.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (useEditorStore.getState().dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const handleSave = useCallback(
    async (forcePrompt: boolean) => {
      const { project, markSaved } = useEditorStore.getState();
      try {
        const result = await saveProject(project, forcePrompt);
        if (result.saved) {
          markSaved(result.fileName ?? project.name);
          notify(`Saved ${result.fileName ?? ''}`.trim());
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not save the project.');
      }
    },
    [notify],
  );

  const handleOpen = useCallback(async () => {
    try {
      const result = await openProject();
      if (!result) return;
      useEditorStore.getState().loadProject(result.project, result.fileName);
      fitView(gameRef.current);
      notify(`Opened ${result.fileName}`);
    } catch (error) {
      notify(
        error instanceof ProjectParseError
          ? error.message
          : 'Could not open that file.',
      );
    }
  }, [notify]);

  const handleNew = useCallback(() => {
    if (
      useEditorStore.getState().dirty &&
      !window.confirm('Discard unsaved changes and start a new project?')
    ) {
      return;
    }
    useEditorStore.getState().resetProject();
    clearDraft();
    fitView(gameRef.current);
  }, []);

  // Keyboard shortcuts, skipped while a field has focus so Ctrl+Z still means
  // "undo my typing" inside an input.
  useEffect(() => {
    // Held arrow keys repeat at the OS rate, and every repeat is a store edit.
    // One transaction per press-and-hold keeps a nudge to a single undo step,
    // the same way a drag does. The timer is the fallback for a keyup lost to
    // the window losing focus mid-press.
    let nudging = false;
    let nudgeTimer: number | undefined;

    const beginNudge = () => {
      if (!nudging) {
        nudging = true;
        useEditorStore.getState().beginTransaction();
      }
      window.clearTimeout(nudgeTimer);
      nudgeTimer = window.setTimeout(endNudge, NUDGE_IDLE_MS);
    };

    const endNudge = () => {
      window.clearTimeout(nudgeTimer);
      if (!nudging) return;
      nudging = false;
      useEditorStore.getState().endTransaction();
    };

    const nudge = (step: { dx: number; dy: number }, coarse: boolean) => {
      const store = useEditorStore.getState();
      if (store.selectedIds.length === 0) return;
      const distance = coarse ? COARSE_NUDGE : 1;
      beginNudge();
      store.nudgeSelection(step.dx * distance, step.dy * distance);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const store = useEditorStore.getState();

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 's') {
          event.preventDefault();
          void handleSave(false);
        } else if (key === 'o') {
          event.preventDefault();
          void handleOpen();
        } else if (inField) {
          // Everything below is an editor command; inside a field the browser's
          // own undo, copy and paste are what the user means.
          return;
        } else if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) store.redo();
          else store.undo();
        } else if (key === 'd') {
          event.preventDefault();
          store.duplicateSelection();
        } else if (key === 'c') {
          event.preventDefault();
          store.copySelection();
        } else if (key === 'v') {
          event.preventDefault();
          store.pasteNode();
        } else if (key === 'a') {
          // Top-level objects only: anything nested is already covered by the
          // group holding it. See `selectAll`.
          event.preventDefault();
          store.selectAll();
        } else if (key === 'g') {
          event.preventDefault();
          store.groupSelection();
        }
        return;
      }

      if (inField) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        store.select(null);
        return;
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        store.selectedIds.length > 0
      ) {
        event.preventDefault(); // Backspace still means "go back" in some browsers.
        store.deleteSelection();
        return;
      }

      const step = NUDGE_STEPS[event.key];
      if (step && store.selectedIds.length > 0) {
        event.preventDefault();
        nudge(step, event.shiftKey);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key in NUDGE_STEPS) endNudge();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', endNudge);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', endNudge);
      endNudge();
    };
  }, [handleSave, handleOpen]);

  // Export always downloads rather than using the file picker: there is no
  // existing handle to write back to, and generated files are throwaway output.
  const handleExportScene = useCallback(
    (language: SceneLanguage) => {
      const { project } = useEditorStore.getState();
      const name = exportFileName(project, `.${language}`);
      downloadFile(generateScene(project, language), name, 'text/plain');
      notify(`Exported ${name}`);
    },
    [notify],
  );

  const handleExportHtml = useCallback(() => {
    const { project } = useEditorStore.getState();
    const name = exportFileName(project, '.html');
    downloadFile(generateRunnableHtml(project), name, 'text/html');
    notify(`Exported ${name}`);
  }, [notify]);

  const actions: ToolbarActions = {
    onNew: handleNew,
    onExportSceneTs: () => handleExportScene('ts'),
    onExportSceneJs: () => handleExportScene('js'),
    onExportHtml: handleExportHtml,
    onOpen: () => void handleOpen(),
    onSave: () => void handleSave(false),
    onSaveAs: () => void handleSave(true),
    onFit: () => fitView(gameRef.current),
  };

  return (
    <>
      <Layout
        isMobile={isMobile}
        toolbar={<Toolbar compact={isMobile} actions={actions} />}
        viewport={
          <Viewport
            onReady={(game) => {
              gameRef.current = game;
            }}
          />
        }
        tree={<SceneTree />}
        inspector={<Inspector />}
        fileMenu={<FilePanel actions={actions} />}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
