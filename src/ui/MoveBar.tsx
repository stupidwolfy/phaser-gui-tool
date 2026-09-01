import { useEditorStore, useSelectionNodes } from '../core/store';

/**
 * The mobile move bar.
 *
 * Touch editing is two-step: a tap selects, and only then does dragging move
 * the object. That rule is invisible on its own, so this bar appears on
 * selection to say the object is now draggable and to give the gesture an
 * explicit ending — keep it, or put it back where it started.
 */
export function MoveBar() {
  const nodes = useSelectionNodes();
  const moveOrigins = useEditorStore((s) => s.moveOrigins);
  const cancelMove = useEditorStore((s) => s.cancelMove);
  const commitMove = useEditorStore((s) => s.commitMove);

  if (nodes.length === 0) return null;
  const node = nodes[0];

  // Moved if *any* of them has: one drag moves the whole selection, so cancel
  // has to stay available while any part of that move is still standing.
  const moved = moveOrigins.some((origin) => {
    const current = nodes.find((candidate) => candidate.id === origin.id);
    return (
      current !== undefined &&
      (origin.transform.x !== current.transform.x ||
        origin.transform.y !== current.transform.y)
    );
  });

  return (
    <div className="movebar" role="toolbar" aria-label="Move object">
      <span className="movebar__label">
        <span className="tree__type" data-type={node.type} aria-hidden="true" />
        <span className="movebar__name">
          {nodes.length === 1 ? node.name : `${nodes.length} objects`}
        </span>
        <span className="movebar__hint">
          {moved && nodes.length === 1
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
