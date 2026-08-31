import { useCallback, useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { useEditorStore } from './core/store';
import { clearDraft, loadDraft, scheduleDraftSave } from './io/autosave';
import { ProjectParseError, openProject, saveProject } from './io/fileIO';
import { Viewport, fitView } from './editor/Viewport';
import { Inspector } from './ui/Inspector';
import { Layout } from './ui/Layout';
import { SceneTree } from './ui/SceneTree';
import { FilePanel, Toolbar, type ToolbarActions } from './ui/Toolbar';
import { useIsMobile } from './ui/useMediaQuery';

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
        if (state.project !== previous.project) scheduleDraftSave(state.project);
      }),
    [],
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
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void handleSave(false);
      } else if (key === 'z' && !inField) {
        event.preventDefault();
        if (event.shiftKey) useEditorStore.getState().redo();
        else useEditorStore.getState().undo();
      } else if (key === 'o') {
        event.preventDefault();
        void handleOpen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, handleOpen]);

  const actions: ToolbarActions = {
    onNew: handleNew,
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
