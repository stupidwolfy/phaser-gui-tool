import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useEditorStore } from '../core/store';
import { blockingIssues, validateProject } from '../core/validation';
import { downloadFile } from '../io/fileIO';
import { bundleNameOf, createExportBundle, type ExportBundle } from '../io/exportBundle';
import type { SceneLanguage } from '../io/exportPhaser';

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/**
 * The export-bundle preflight: a name, a language, and exactly what the ZIP
 * will hold before it is downloaded.
 *
 * `HelpDialog`'s shape and for its reasons: a fixed overlay rather than a slot
 * in the layout (resizing `.app__center` re-fits the editor's camera), focus
 * moved in and handed back, and its own Escape that stops propagating so it
 * does not also deselect.
 *
 * The summary is the bundle itself, built once per change of name or language,
 * so the size and the file list are exact rather than an estimate. The project
 * is read once, on open: the dialog is modal, so nothing can edit it meanwhile,
 * and a subscription could only cost a rebuild nobody asked for.
 */
export function ExportBundleDialog({ notify }: { notify: (message: string) => void }) {
  const open = useEditorStore((s) => s.bundleDialogOpen);
  if (!open) return null;
  return <BundlePanel notify={notify} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function BundlePanel({ notify }: { notify: (message: string) => void }) {
  const close = () => useEditorStore.getState().setBundleDialogOpen(false);
  const [project] = useState(() => useEditorStore.getState().project);
  const [name, setName] = useState(() => bundleNameOf(project.name));
  const [language, setLanguage] = useState<SceneLanguage>('ts');
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    nameRef.current?.focus();
    return () => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);

  const issues = useMemo(() => validateProject(project), [project]);
  const blocking = blockingIssues(issues);
  const warnings = issues.filter((issue) => !blocking.includes(issue));

  const bundle = useMemo<ExportBundle | null>(
    () => (blocking.length > 0 ? null : createExportBundle(project, { name, language })),
    [project, name, language, blocking.length],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
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

  const download = () => {
    if (!bundle) return;
    const store = useEditorStore.getState();
    store.showValidationIssues(issues);
    downloadFile(bundle.zip, bundle.fileName, 'application/zip');
    notify(`Exported project bundle ${bundle.fileName}`);
    close();
  };

  return (
    <div className="help" onKeyDown={onKeyDown}>
      <div
        ref={panelRef}
        className="help__panel bundle"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="help__header">
          <h2 id={titleId} className="help__title">
            Export bundle
          </h2>
          <button
            className="icon-btn"
            onClick={close}
            aria-label="Close export bundle"
            title="Close export bundle"
          >
            ✕
          </button>
        </div>

        <div className="help__body">
          <p className="hint">
            A ready-to-build Vite project: the scenes as source, every image, sound and font
            as a file, and a README with the commands to run it.
          </p>

          <label className="field">
            <span className="field__label">Folder name</span>
            <input
              ref={nameRef}
              className="field__input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setName(bundleNameOf(name))}
              spellCheck={false}
              autoCapitalize="off"
            />
          </label>
          <label className="field">
            <span className="field__label">Language</span>
            <select
              className="field__input"
              value={language}
              onChange={(event) => setLanguage(event.target.value as SceneLanguage)}
            >
              <option value="ts">TypeScript</option>
              <option value="js">JavaScript</option>
            </select>
          </label>

          {bundle ? (
            <div className="bundle__summary" data-testid="bundle-summary">
              <p>
                <strong>{bundle.fileName}</strong> ·{' '}
                <span data-testid="bundle-size">{formatBytes(bundle.zip.length)}</span>
              </p>
              <ul className="bundle__facts">
                <li>
                  {plural(bundle.sceneNames.length, 'scene', 'scenes')}, starting with “
                  {bundle.sceneNames[0]}”
                </li>
                <li>
                  {plural(bundle.counts.images, 'image', 'images')},{' '}
                  {plural(bundle.counts.audio, 'sound', 'sounds')},{' '}
                  {plural(bundle.counts.fonts, 'font', 'fonts')}
                </li>
                <li>Build with npm install, then npm run build — the output is minified.</li>
                {bundle.remembersVariables && (
                  <li>
                    Remembered variables are kept in the player’s browser storage. Play in the
                    editor starts fresh every time; this build does not.
                  </li>
                )}
                {bundle.touchControls && <li>On-screen touch buttons are included.</li>}
              </ul>
              <details className="bundle__files">
                <summary>{plural(bundle.files.length, 'file', 'files')}</summary>
                <ul aria-label="Bundle files">
                  {bundle.files.map((file) => (
                    <li key={file.path}>
                      <code>{file.path.slice(bundle.name.length + 1)}</code>{' '}
                      <span className="bundle__size">{formatBytes(file.bytes.length)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : (
            <div className="hint hint--error" role="alert">
              <p>This project cannot be exported until these are fixed:</p>
              <ul>
                {blocking.map((issue, index) => (
                  <li key={`${issue.code}:${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bundle__warnings">
              <p className="hint">
                {plural(warnings.length, 'warning', 'warnings')} — the export still works:
              </p>
              <ul aria-label="Export warnings">
                {warnings.map((issue, index) => (
                  <li key={`${issue.code}:${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="bundle__footer">
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={download} disabled={!bundle}>
            Download bundle
          </button>
        </footer>
      </div>
    </div>
  );
}
