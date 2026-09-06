import { useState } from 'react';
import { activeScene, useEditorStore } from '../core/store';
import { findNode, tileLayerOf, tileMapOf } from '../core/schema';
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
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
  // Derived outside the selector: `tileMapOf` builds a fresh object per call, so
  // selecting it is React error #185 — the trap it has carried since it existed.
  const project = useEditorStore((s) => s.project);
  // `'palette' | 'layers' | null` rather than two booleans, because the two
  // sheets share one slot over the canvas and opening either has to close the
  // other — two flags would be two notions of what is on screen, which is the
  // eraser rule from this bar's own erase button.
  const [open, setOpen] = useState<'palette' | 'layers' | null>(null);

  if (!paintingId || !node || node.type !== 'tilemap') return null;

  const map = tileMapOf(project, node.props);
  const layer = tileLayerOf(map, activeLayerId);

  return (
    <>
      {open === 'palette' && (
        <div className="tilebar__sheet">
          <TilePalette assetId={node.props.assetId} />
        </div>
      )}

      {/* The layer chooser is on the bar and not only in the panel for the
          reason the brush is: on a phone the Properties sheet covers the canvas
          being painted, so switching from the floor to the walls and then
          placing a tile could never be seen at once. */}
      {open === 'layers' && (
        <div className="tilebar__sheet" role="group" aria-label="Layers">
          {[...map.layers].reverse().map((entry) => (
            <button
              key={entry.id}
              className={`btn btn--block ${entry.id === layer.id ? 'is-active' : ''}`}
              aria-pressed={entry.id === layer.id}
              aria-label={`Paint on ${entry.name}`}
              onClick={() => {
                setActiveLayer(entry.id);
                setOpen(null);
              }}
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}

      <div className="movebar tilebar" role="toolbar" aria-label="Paint tiles">
        <button
          className="tilebar__brush"
          onClick={() => setOpen((current) => (current === 'palette' ? null : 'palette'))}
          aria-expanded={open === 'palette'}
          aria-label="Choose a tile"
          title="Choose a tile"
        >
          <BrushSwatch assetId={node.props.assetId} />
        </button>

        {/* The map's name and the layer's, because a stroke lands on one layer
            and the bar is the only thing on screen while it does. The button is
            the layer's, so it is also the control: one press says which and
            changes it. */}
        <span className="movebar__label">
          <span className="movebar__name">{node.name}</span>
          <span className="movebar__hint">drag to paint</span>
        </span>

        <button
          className={`movebar__btn ${open === 'layers' ? 'is-active' : ''}`}
          onClick={() => setOpen((current) => (current === 'layers' ? null : 'layers'))}
          aria-expanded={open === 'layers'}
          aria-label="Choose a layer"
          title={layer.name}
        >
          ▤
        </button>

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
            setOpen(null);
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
