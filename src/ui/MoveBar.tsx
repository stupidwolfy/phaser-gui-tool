import { useEditorStore, useSelectedNode } from '../core/store';

/**
 * The mobile move bar.
 *
 * Touch editing is two-step: a tap selects, and only then does dragging move
 * the object. That rule is invisible on its own, so this bar appears on
 * selection to say the object is now draggable and to give the gesture an
 * explicit ending — keep it, or put it back where it started.
 */
export function MoveBar() {
  const node = useSelectedNode();
  const moveOrigin = useEditorStore((s) => s.moveOrigin);
  const cancelMove = useEditorStore((s) => s.cancelMove);
  const commitMove = useEditorStore((s) => s.commitMove);

  if (!node) return null;

  const moved =
    moveOrigin !== null &&
    (moveOrigin.transform.x !== node.transform.x ||
      moveOrigin.transform.y !== node.transform.y);

  return (
    <div className="movebar" role="toolbar" aria-label="Move object">
      <span className="movebar__label">
        <span className="tree__type" data-type={node.type} aria-hidden="true" />
        <span className="movebar__name">{node.name}</span>
        <span className="movebar__hint">
          {moved
            ? `${Math.round(node.transform.x)}, ${Math.round(node.transform.y)}`
            : 'drag to move'}
        </span>
      </span>

      <button
        className="movebar__btn movebar__btn--cancel"
        onClick={cancelMove}
        // Disabled rather than hidden, so the two buttons don't shift position
        // under a thumb that is already reaching for them.
        disabled={!moved}
        aria-label="Cancel move and put it back"
        title="Cancel move"
      >
        ✕
      </button>
      <button
        className="movebar__btn movebar__btn--done"
        onClick={commitMove}
        aria-label="Done moving"
        title="Done"
      >
        ✓
      </button>
    </div>
  );
}
