import { useEditorStore } from '../core/store';
import {
  EMPTY_TILE,
  findAsset,
  frameCountOf,
  frameGridOf,
  frameLayoutOf,
  type ImageAsset,
} from '../core/schema';

/**
 * Picking the tile the brush lays.
 *
 * The tiles are drawn straight from the asset's data URL — one `background-image`
 * per cell, offset to the frame it shows — rather than sliced into images of
 * their own. The bytes are already in the document and the browser decodes them
 * once for the whole palette, so a sheet of two hundred tiles costs one decode
 * and two hundred background offsets.
 *
 * The offsets use `frameLayoutOf`'s column count and the grid's own margin and
 * spacing, which is what makes tile *n* here the same tile *n* the canvas draws
 * and the exported game loads. Deriving the layout again with arithmetic of our
 * own is exactly the drift `frameLayoutOf` says it exists to prevent.
 */

/** How big a tile is drawn in the palette, along its longer edge. */
const PREVIEW = 34;

/** Where frame `index` sits in the source image, in its own pixels. */
function frameOffset(asset: ImageAsset, index: number): { x: number; y: number } {
  const sheet = frameGridOf(asset);
  if (!sheet) return { x: 0, y: 0 };
  const { columns } = frameLayoutOf(asset);
  return {
    x: sheet.margin + (index % columns) * (sheet.frameWidth + sheet.spacing),
    y: sheet.margin + Math.floor(index / columns) * (sheet.frameHeight + sheet.spacing),
  };
}

function TileButton({
  asset,
  index,
  selected,
  onPick,
}: {
  asset: ImageAsset;
  index: number;
  selected: boolean;
  onPick: () => void;
}) {
  const sheet = frameGridOf(asset);
  if (!sheet) return null;

  const scale = PREVIEW / Math.max(sheet.frameWidth, sheet.frameHeight);
  const offset = frameOffset(asset, index);

  return (
    <button
      className={`tiles__cell ${selected ? 'is-selected' : ''}`}
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`Tile ${index}`}
      title={`Tile ${index}`}
      style={{
        width: `${sheet.frameWidth * scale}px`,
        height: `${sheet.frameHeight * scale}px`,
        backgroundImage: `url(${asset.dataUrl})`,
        backgroundSize: `${asset.width * scale}px ${asset.height * scale}px`,
        backgroundPosition: `-${offset.x * scale}px -${offset.y * scale}px`,
      }}
    />
  );
}

/**
 * The tileset as a grid of buttons, with the eraser as one of them.
 *
 * The eraser is a cell in the same row rather than a separate control because
 * it is the same choice: what the next press lays. Two places to answer one
 * question is how they come to disagree — and on a 390px screen it is also a
 * control's width that the palette can spend on tiles instead.
 */
export function TilePalette({ assetId }: { assetId: string | null }) {
  const asset = useEditorStore((s) => findAsset(s.project, assetId));
  const brushTile = useEditorStore((s) => s.brushTile);
  const erasing = useEditorStore((s) => s.erasing);
  const setBrushTile = useEditorStore((s) => s.setBrushTile);
  const setErasing = useEditorStore((s) => s.setErasing);

  if (!asset) {
    return <p className="hint">Choose an image above to use as this map's tileset.</p>;
  }

  // The same condition the canvas and the exporter draw a map under: an
  // unsliced image is one picture, not a set of tiles, and offering its single
  // "frame" as a tile would paint a map out of whole sprites.
  if (!frameGridOf(asset)) {
    return (
      <p className="hint">
        Slice this image into tiles above — its frame size is the map's tile size.
      </p>
    );
  }

  const count = frameCountOf(asset);

  return (
    <div className="tiles" role="group" aria-label="Tiles">
      <button
        className={`tiles__cell tiles__cell--erase ${erasing ? 'is-selected' : ''}`}
        onClick={() => setErasing(true)}
        aria-pressed={erasing}
        aria-label="Erase tiles"
        title="Erase"
      >
        ⌫
      </button>
      {Array.from({ length: count }, (_, index) => (
        <TileButton
          key={index}
          asset={asset}
          index={index}
          selected={!erasing && index === brushTile}
          onPick={() => {
            setBrushTile(index);
            setErasing(false);
          }}
        />
      ))}
    </div>
  );
}

/** The single cell the tile bar shows for whatever the brush is set to. */
export function BrushSwatch({ assetId }: { assetId: string | null }) {
  const asset = useEditorStore((s) => findAsset(s.project, assetId));
  const brushTile = useEditorStore((s) => s.brushTile);
  const erasing = useEditorStore((s) => s.erasing);

  const sheet = frameGridOf(asset);
  if (erasing || !asset || !sheet) {
    return (
      <span className="tiles__cell tiles__cell--erase" aria-hidden="true">
        {erasing ? '⌫' : '?'}
      </span>
    );
  }

  const scale = PREVIEW / Math.max(sheet.frameWidth, sheet.frameHeight);
  const offset = frameOffset(asset, brushTile);
  return (
    <span
      className="tiles__cell"
      aria-hidden="true"
      style={{
        width: `${sheet.frameWidth * scale}px`,
        height: `${sheet.frameHeight * scale}px`,
        backgroundImage: `url(${asset.dataUrl})`,
        backgroundSize: `${asset.width * scale}px ${asset.height * scale}px`,
        backgroundPosition: `-${offset.x * scale}px -${offset.y * scale}px`,
      }}
    />
  );
}

/** The tile the brush would lay, as the store's actions want it. */
export const brushValue = (brushTile: number, erasing: boolean): number =>
  erasing ? EMPTY_TILE : brushTile;
