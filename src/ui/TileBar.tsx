import { useState } from 'react';
import { activeScene, useEditorStore } from '../core/store';
import { findNode } from '../core/schema';
import { BrushSwatch, TilePalette } from './TilePalette';

/**
 * The paint-mode bar, floating over the canvas.
 *
 * Paint mode takes the canvas over, and a mode with no visible edge is a mode
 * users get stuck in — so this is both the way out and the whole of the brush.
 * It sits in the move bar's slot and borrows its shape for the reason that slot
 * exists: it is the one band of a 390px screen a thumb reaches without covering
 * what it is aiming at.
 *
 * The palette opens *upward from the bar* rather than living in the Properties
 * panel, because on a phone that panel is a sheet over the canvas being
 * painted: choosing a tile and placing it could never be seen at the same time.
 * The inspector carries a palette too, which is the desktop convenience — this
 * is the one that has to work.
 */
export function TileBar() {
  const paintingId = useEditorStore((s) => s.paintingId);
  const node = useEditorStore((s) =>
    s.paintingId ? findNode(activeScene(s.project).children, s.paintingId) : undefined,
  );
  const setPainting = useEditorStore((s) => s.setPainting);
  const erasing = useEditorStore((s) => s.erasing);
  const setErasing = useEditorStore((s) => s.setErasing);
  const [open, setOpen] = useState(false);

  if (!paintingId || !node || node.type !== 'tilemap') return null;

  return (
    <>
      {open && (
        <div className="tilebar__sheet">
          <TilePalette assetId={node.props.assetId} />
        </div>
      )}

      <div className="movebar tilebar" role="toolbar" aria-label="Paint tiles">
        <button
          className="tilebar__brush"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label="Choose a tile"
          title="Choose a tile"
        >
          <BrushSwatch assetId={node.props.assetId} />
        </button>

        <span className="movebar__label">
          <span className="movebar__name">{node.name}</span>
          <span className="movebar__hint">drag to paint</span>
        </span>

        {/* The palette's erase cell writes the same field, so the two can
            never disagree — this is the one that is reachable without opening
            anything, which is what a toggle used every few strokes needs. */}
        <button
          className={`movebar__btn ${erasing ? 'is-active' : ''}`}
          onClick={() => setErasing(!erasing)}
          aria-pressed={erasing}
          aria-label="Erase tiles"
          title="Erase"
        >
          ⌫
        </button>

        <button
          className="movebar__btn movebar__btn--done"
          onClick={() => {
            setOpen(false);
            setPainting(null);
          }}
          aria-label="Done painting"
          title="Done"
        >
          ✓
        </button>
      </div>
    </>
  );
}
