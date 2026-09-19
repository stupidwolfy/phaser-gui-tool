import { useEffect, useMemo, useRef, useState } from 'react';
import { activeScene, useEditorStore } from '../core/store';
import { generateRunnableHtml } from '../io/exportPhaser';
import { runtimeMessageOf, type RuntimeMessage } from '../io/runtimeMessages';

/**
 * The runtime the game runs on, as a URL this page can hand to a `<script>`.
 *
 * The exported `.html` fetches Phaser from a CDN pinned to the version the
 * project records, and Play cannot: this editor is offline-capable, is served
 * from Pages, and has never made a network request in its life. A Play button
 * that fails on a plane is not this editor's Play button. So the overlay hands
 * `generateRunnableHtml` the copy the app itself ships.
 *
 * Two things about this import are deliberate and neither is obvious.
 *
 * It is the *minified IIFE* build rather than the ESM one, because the page
 * this runs is unchanged from the file a user downloads: a classic `<script>`
 * that expects `window.Phaser` to exist by the time the next one runs.
 *
 * And it is reached by path rather than by specifier because Phaser's package
 * `exports` map has no deep entry — `"."` and `"./package.json"` only — so
 * `import 'phaser/dist/phaser.min.js?url'` does not resolve at all. It is the
 * same file `tests/export.spec.ts` has been answering the CDN with since the
 * export existed, which is what makes Play that harness rather than a second
 * way of running a project.
 *
 * The one honest difference from a downloaded export, recorded rather than
 * hidden: that file runs under the Phaser the *project* pins, and this runs
 * under the Phaser the *editor* bundles. For anything made in this editor they
 * are the same version.
 */
import phaserRuntimeUrl from '../../node_modules/phaser/dist/phaser.min.js?url';

/**
 * The exported game, running over the editor.
 *
 * Sixteen iterations have emitted behaviour this editor refuses to run — a body
 * is drawn and never simulated, a camera drawn and never applied, a touch
 * button drawn and never pressed, a rule emitted and never fired. Every one of
 * those refusals has the same reason: a simulating canvas rewrites the numbers
 * the document is made of, and there is no version of "run it for a moment"
 * that leaves the document alone.
 *
 * None of that weakens here, because **none of it happens on that canvas**. The
 * game runs in a document of its own, in a sandboxed iframe, and Stop throws
 * that document away. The editor's canvas goes on refusing to simulate
 * underneath, for exactly the reason it always did; what is new is a window
 * onto what the export already produced.
 *
 * Four consequences worth having in mind before editing this file:
 *
 * - **The page is generated once, on the press**, and there is no hot-reload
 *   question to answer because the overlay covers every control that could
 *   make an edit — the toolbar, the tree and the inspector alike. A running
 *   game is a game rather than a mirror of the document, and Stop then Play is
 *   the whole of the edit-to-run path.
 * - **Restart is a new realm, not a resumed one.** Re-keying the iframe throws
 *   away every texture, timer, tween, listener and sound the old one held,
 *   which is why there is no teardown here to write — the four bookkeeping maps
 *   `EditorScene` keeps on SHUTDOWN exist because a texture outlives a scene,
 *   and nothing outlives a discarded document.
 * - **`sandbox="allow-scripts"` gives the frame an opaque origin**, so the game
 *   cannot reach `parent`, `localStorage` or the autosaved draft. A classic
 *   script from this origin still loads (no CORS on those), WebGL still works,
 *   and `phaserRuntimeUrl` is absolute so srcdoc's inherited base URL is not a
 *   question. The frame gets one deliberately narrow way out: status and
 *   sanitized error messages sent with `postMessage`. The parent validates the
 *   sending window and a per-run id; no project data or runtime state comes
 *   back, and downloaded exports keep their original bytes and behaviour.
 * - **The game takes the keyboard, and Stop is therefore the only way out.**
 *   Phaser focuses its own canvas as it boots, so the iframe becomes the
 *   editor's `activeElement` and every key after that belongs to the game —
 *   which is right, since a driven object is read with the arrow keys. There is
 *   no Escape shortcut for that reason and it is recorded in `App.tsx`: one
 *   that worked only between the press and the boot would be worse than none.
 */
export function PlayOverlay() {
  const playing = useEditorStore((s) => s.playing);
  if (!playing) return null;
  return <PlayFrame />;
}

/**
 * Split from the toggle above so that the whole of this — the generated page
 * included — is built when Play is pressed and discarded when it is stopped.
 * Held in the outer component instead, a `useMemo` would keep a multi-megabyte
 * string alive for the rest of the session on a project nobody is playing.
 */
function PlayFrame() {
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const stopRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  /** Bumping this re-keys the iframe, which is the whole of Restart. */
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState<'starting' | 'running' | 'failed'>('starting');
  const [runtimeError, setRuntimeError] = useState<
    Extract<RuntimeMessage, { kind: 'error' }> | null
  >(null);

  /**
   * The document as it was when this run began.
   *
   * Read through `getState()` rather than through a selector on purpose: this
   * component deliberately does **not** subscribe to the project. Nothing on
   * screen can edit it while the overlay is up, so a subscription could only
   * ever cost a re-render and a regenerated multi-megabyte string on a store
   * change nobody asked for — an autosave landing, say.
   */
  const { html, sceneName, runId } = useMemo(() => {
    const { project } = useEditorStore.getState();
    const nextRunId = crypto.randomUUID();
    return {
      html: generateRunnableHtml(project, {
        phaserSrc: phaserRuntimeUrl,
        runtimeReporter: { runId: nextRunId },
      }),
      sceneName: activeScene(project).name,
      runId: nextRunId,
    };
  }, [run]);

  useEffect(() => {
    setStatus('starting');
    setRuntimeError(null);
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = runtimeMessageOf(event.data);
      if (!message || message.runId !== runId) return;
      if (message.kind === 'ready') {
        setStatus('running');
      } else {
        setStatus('failed');
        setRuntimeError(message);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [runId]);

  // Focus the way out, for the moment before the game claims the keyboard and
  // for every moment after a press on this bar brings it back. It is not there
  // to make a shortcut work — there is no Escape here, see `App.tsx` — but so
  // that a keyboard user is not left tabbing into a frame they cannot tab back
  // out of. Stop rather than Restart, by the rule that a destructive-looking
  // default is the safe one: Stop puts the editor back.
  useEffect(() => {
    stopRef.current?.focus();
  }, []);

  return (
    <div className="play" role="dialog" aria-label="Play game">
      <div className="play__bar">
        <span className="play__title">{sceneName}</span>
        <span className={`play__status play__status--${status}`} role="status">
          {status === 'starting' ? 'Starting…' : status === 'running' ? 'Running' : 'Failed'}
        </span>
        <button className="btn" onClick={() => setRun((current) => current + 1)}>
          Restart
        </button>
        <button
          ref={stopRef}
          className="btn btn--primary"
          onClick={() => setPlaying(false)}
        >
          Stop
        </button>
      </div>
      {runtimeError && (
        <div className="play__error" role="alert">
          <div className="play__errorHead">
            <strong>Game error</strong>
            <button className="btn" onClick={() => setRuntimeError(null)}>
              Dismiss
            </button>
          </div>
          <p>{runtimeError.message}</p>
          {runtimeError.stack && runtimeError.stack !== runtimeError.message && (
            <details>
              <summary>Details</summary>
              <pre>{runtimeError.stack}</pre>
            </details>
          )}
        </div>
      )}
      {/*
        srcdoc rather than a blob URL: no origin-partitioning question to reason
        about and no URL to revoke, and the ~5 MB localStorage draft already
        caps a project well inside what an attribute holds comfortably. If that
        ever stops being true the swap is one line.
      */}
      <iframe
        ref={frameRef}
        key={run}
        className="play__frame"
        title={`${sceneName} running`}
        sandbox="allow-scripts"
        srcDoc={html}
        onLoad={() => setStatus((current) => (current === 'starting' ? 'running' : current))}
      />
    </div>
  );
}
