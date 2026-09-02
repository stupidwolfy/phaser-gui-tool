import { useEditorStore } from '../core/store';
import { supportsFileSystemAccess } from '../io/fileIO';

export interface ToolbarActions {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onFit: () => void;
  onExportSceneTs: () => void;
  onExportSceneJs: () => void;
  onExportHtml: () => void;
}

/**
 * A magnet, drawn rather than typed.
 *
 * The rest of the toolbar is Unicode glyphs, but no text-presentation magnet
 * exists — the emoji one renders in colour, so it ignores the active state's
 * white foreground and looks wrong in a row of monochrome controls. A dozen
 * lines of SVG inherit `currentColor` and render identically everywhere.
 */
function SnapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {/* A horseshoe, open downward, with the tips left square: at 14px the
          poles cannot be distinguished by colour the way a real magnet icon
          does it, so the shape has to carry it alone. */}
      <path
        d="M4 13.2V8a4 4 0 0 1 8 0v5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      />
    </svg>
  );
}

/**
 * The grid, as four lines.
 *
 * A hash rather than a checkerboard: at 14px the squares of a drawn grid merge
 * into a grey block, while four strokes stay four strokes. Like the magnet it
 * is SVG inheriting `currentColor`, so it follows the toggle's active state
 * instead of fighting it the way an emoji would.
 */
function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M6 2v12M10 2v12M2 6h12M2 10h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * Top bar.
 *
 * On a phone this keeps only what you reach for mid-edit — history, fit, save —
 * because the full set overflowed a 390px screen and clipped the Save button.
 * Everything else moves to the File sheet.
 */
export function Toolbar({
  actions,
  compact,
}: {
  actions: ToolbarActions;
  compact: boolean;
}) {
  const dirty = useEditorStore((s) => s.dirty);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const setGridEnabled = useEditorStore((s) => s.setGridEnabled);

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo" aria-hidden="true">
          ◆
        </span>
        {!compact && <span className="toolbar__title">Phaser GUI Tool</span>}
      </div>

      {!compact && <ProjectNameField />}

      {/* Nothing is stored on a server, so an explicit unsaved marker carries
          more weight here than it would in an app with a backend. */}
      <span
        className={`toolbar__dirty ${dirty ? 'is-dirty' : ''}`}
        title={dirty ? 'Unsaved changes' : 'Saved'}
        aria-label={dirty ? 'Unsaved changes' : 'Saved'}
      >
        {dirty ? '●' : ''}
      </span>

      <div className="toolbar__spacer" />

      <div className="toolbar__group">
        <button className="btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button className="btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          ↷
        </button>
        <button className="btn" onClick={actions.onFit} title="Fit scene to view">
          ⤢
        </button>
        {/* In the toolbar rather than the tree or the inspector because it is
            the one group that survives the compact layout: snapping changes what
            a drag does, so it has to be reachable without opening a panel — on a
            phone the panels are modal sheets covering the canvas you are
            dragging on. */}
        <button
          className={`btn btn--toggle ${snapEnabled ? 'is-active' : ''}`}
          aria-pressed={snapEnabled}
          onClick={() => setSnapEnabled(!snapEnabled)}
          title={snapEnabled ? 'Snapping on' : 'Snapping off'}
          aria-label="Snap to objects"
        >
          <SnapIcon />
        </button>
        {/* Beside the magnet because it is the same kind of control — what a
            drag does — and because the two are read together: which of them is
            lit is the whole answer to "why did it land there". The pitch itself
            is a number you set once, so it stays in the Scene panel. */}
        <button
          className={`btn btn--toggle ${gridEnabled ? 'is-active' : ''}`}
          aria-pressed={gridEnabled}
          onClick={() => setGridEnabled(!gridEnabled)}
          title={gridEnabled ? 'Grid on' : 'Grid off'}
          aria-label="Snap to grid"
        >
          <GridIcon />
        </button>
      </div>

      <div className="toolbar__group">
        {!compact && (
          <>
            <button className="btn" onClick={actions.onNew} title="New project">
              New
            </button>
            <button className="btn" onClick={actions.onOpen} title="Open a project file">
              Open
            </button>
          </>
        )}
        <button className="btn btn--primary" onClick={actions.onSave} title="Save (Ctrl+S)">
          Save
        </button>
        {!compact && (
          <button className="btn" onClick={actions.onSaveAs} title="Save to a new file">
            Save As
          </button>
        )}
      </div>

      {!compact && (
        <div className="toolbar__group">
          <span className="toolbar__groupLabel">Export</span>
          <button
            className="btn"
            onClick={actions.onExportSceneTs}
            title="Export a TypeScript Phaser Scene class"
          >
            .ts
          </button>
          <button
            className="btn"
            onClick={actions.onExportSceneJs}
            title="Export a JavaScript Phaser Scene class"
          >
            .js
          </button>
          <button
            className="btn"
            onClick={actions.onExportHtml}
            title="Export a self-contained page that runs this scene"
          >
            .html
          </button>
        </div>
      )}
    </header>
  );
}

function ProjectNameField() {
  const name = useEditorStore((s) => s.project.name);
  const renameProject = useEditorStore((s) => s.renameProject);
  return (
    <input
      className="toolbar__name"
      value={name}
      aria-label="Project name"
      onChange={(event) => renameProject(event.target.value)}
    />
  );
}

/** The mobile File sheet: the document actions the compact toolbar drops. */
export function FilePanel({ actions }: { actions: ToolbarActions }) {
  const name = useEditorStore((s) => s.project.name);
  const fileName = useEditorStore((s) => s.fileName);
  const dirty = useEditorStore((s) => s.dirty);
  const renameProject = useEditorStore((s) => s.renameProject);

  return (
    <div className="panel">
      <label className="field">
        <span className="field__label">Project name</span>
        <input
          className="field__input"
          value={name}
          onChange={(event) => renameProject(event.target.value)}
        />
      </label>

      <div className="panel__section">File</div>
      <div className="stack">
        <button className="btn btn--primary btn--block" onClick={actions.onSave}>
          Save to device
        </button>
        <button className="btn btn--block" onClick={actions.onOpen}>
          Open project…
        </button>
        {/* Without the File System Access API every save is a fresh download,
            so a separate "Save As" would do exactly the same thing. */}
        {supportsFileSystemAccess() && (
          <button className="btn btn--block" onClick={actions.onSaveAs}>
            Save as new file…
          </button>
        )}
        <button className="btn btn--block" onClick={actions.onNew}>
          New project
        </button>
      </div>

      <div className="panel__section">Export to Phaser</div>
      <div className="stack">
        <button className="btn btn--block" onClick={actions.onExportSceneTs}>
          Scene class (.ts)
        </button>
        <button className="btn btn--block" onClick={actions.onExportSceneJs}>
          Scene class (.js)
        </button>
        <button className="btn btn--block" onClick={actions.onExportHtml}>
          Runnable page (.html)
        </button>
      </div>
      <p className="hint">
        The .ts and .js files are ES modules that drop into an existing Phaser project.
        The .html needs nothing — open it in a browser and the scene runs.
      </p>

      <p className="hint">
        {fileName ? `Last file: ${fileName}. ` : ''}
        {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
      </p>
      <p className="hint">
        Projects are saved to your device — nothing is uploaded anywhere.
      </p>
    </div>
  );
}
