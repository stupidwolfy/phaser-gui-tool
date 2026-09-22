import { useState } from 'react';
import { countAssetUses, useEditorStore } from '../core/store';
import {
  atlasOf,
  findAsset,
  frameCountOf,
  frameGridOf,
  frameLayoutOf,
  type FrameGrid,
  type ImageAsset,
} from '../core/schema';
import { CheckboxField, NumberField } from './fields';
import { ImageImportError, formatAssetSize, importImageFile } from '../core/assets';
import { AtlasImportError, importAtlasFile } from '../core/atlas';
import { pickAtlasFile, pickImageFile } from '../io/fileIO';

/**
 * Choosing the image a sprite draws, and importing new ones.
 *
 * The library lives in the project document, so this is the whole of asset
 * management: there is nowhere else for an image to be. Import, pick, remove.
 *
 * Errors are shown here rather than raised as a toast because this is where the
 * user is looking when one happens, and an import failure usually needs them to
 * do something about it (pick a smaller file) rather than just be told.
 */
export function AssetPicker({
  selectedAssetId,
  onPick,
}: {
  selectedAssetId: string | null;
  onPick: (assetId: string) => void;
}) {
  const assets = useEditorStore((s) => s.project.assets);
  const addAsset = useEditorStore((s) => s.addAsset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const importImage = async () => {
    setError(null);
    setNote(null);
    const file = await pickImageFile();
    if (!file) return;

    setBusy(true);
    try {
      const { asset, resized } = await importImageFile(file);
      addAsset(asset);
      onPick(asset.id);
      if (resized) {
        setNote(`Scaled down to ${asset.width}×${asset.height} to keep the project small.`);
      }
    } catch (failure) {
      setError(
        failure instanceof ImageImportError
          ? failure.message
          : `Could not import ${file.name}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="btn btn--block"
        disabled={busy}
        onClick={() => void importImage()}
      >
        {busy ? 'Importing…' : 'Import image…'}
      </button>

      {error && <p className="hint hint--error">{error}</p>}
      {note && <p className="hint">{note}</p>}

      {assets.length > 0 && (
        <ul className="assets">
          {assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              selected={asset.id === selectedAssetId}
              onPick={() => onPick(asset.id)}
            />
          ))}
        </ul>
      )}

      {/* "this object" rather than "this sprite" since iteration 40: the picker
          is reached from a mask effect now, which any of the ten node types can
          carry, and a rectangle being told to give its sprite something to draw
          is a sentence about a thing that is not there. */}
      {assets.length === 0 && !busy && (
        <p className="hint">No images yet. Import one to give this object something to draw.</p>
      )}
    </>
  );
}

function AssetRow({
  asset,
  selected,
  onPick,
}: {
  asset: ImageAsset;
  selected: boolean;
  onPick: () => void;
}) {
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const uses = useEditorStore((s) => countAssetUses(s.project, asset.id));

  const remove = () => {
    // Removing clears the image from every sprite using it, in one undo step —
    // so the warning has to say how many, not just ask "are you sure?".
    if (
      uses > 0 &&
      !window.confirm(
        `${asset.name} is used by ${uses} object${uses === 1 ? '' : 's'}. ` +
          'Remove it and leave them without an image?',
      )
    ) {
      return;
    }
    removeAsset(asset.id);
  };

  return (
    <li className={`assets__item ${selected ? 'is-selected' : ''}`}>
      <button className="assets__pick" onClick={onPick} title={`Use ${asset.name}`}>
        <img className="assets__thumb" src={asset.dataUrl} alt="" />
        <span className="assets__meta">
          <span className="assets__name">{asset.name}</span>
          <span className="assets__detail">
            {asset.width}×{asset.height} · {formatAssetSize(asset)}
          </span>
        </span>
      </button>
      <button
        className="icon-btn icon-btn--danger"
        onClick={remove}
        aria-label={`Remove ${asset.name}`}
        title="Remove image from the project"
      >
        ✕
      </button>
    </li>
  );
}

type AssetKind = 'sprite' | 'tileset' | 'particle' | 'panel' | 'tile' | 'mask';

/**
 * What each kind of image-holding object does with its image, and what it says
 * when it has none.
 *
 * The wording differs by what is drawing it, because the consequence does: a
 * sprite with no image is one placeholder square, while a tilemap with no
 * tileset is a whole grid of them — and a tilemap's size on the canvas comes
 * from its own columns and rows, not from the image. An emitter is a third case
 * again: it draws its marker and throws nothing at all. A panel and a tiled
 * image are a fourth and a fifth, since for those the image is a shape being
 * cut up or a pattern being repeated rather than the picture itself.
 *
 * Two tables rather than the chain of ternaries this was: five kinds each
 * saying something that specific is a table, and the missing-image line is the
 * one a user reads while the object is drawing a placeholder, so it says what
 * the export will do as well — the half they cannot see on the canvas.
 */
const MISSING_ASSET: Record<AssetKind, string> = {
  sprite: 'No image chosen — this sprite draws a placeholder and exports as nothing.',
  tileset: 'No tileset chosen — this map draws placeholders and exports as nothing.',
  particle:
    'No image chosen — this emitter draws its marker, throws nothing and exports as nothing.',
  panel: 'No image chosen — this panel draws a placeholder and exports as nothing.',
  tile: 'No image chosen — this tiled image draws a placeholder and exports as nothing.',
  // The one kind whose empty state is not a placeholder, because a mask is a
  // pass over an object rather than an object: with nothing to sample it runs
  // no pass at all, here and in the export alike, so the object simply draws
  // whole. See `maskTextureKeyFor` for why that is not the placeholder.
  mask: 'No image chosen — this mask does nothing until one is.',
};

const ASSET_ROLE: Record<AssetKind, string> = {
  sprite: 'Size on the canvas is this times the transform scale above.',
  tileset: 'Its frame size is the map’s tile size.',
  particle: 'Each particle draws one frame of it.',
  panel: 'Its corners keep their size; the edges and the middle stretch.',
  tile: 'It repeats to fill the box below.',
  // Alpha rather than colour, because that is what Phaser's mask shader reads;
  // and stretched rather than placed, because an internal filter samples the
  // mask at the object's own texel — which is what lets one mask image work on
  // objects of different sizes.
  mask: 'Its transparency is stretched over the object: solid parts are kept.',
};

/** The chosen image's details, or a prompt to choose one. */
export function AssetSummary({
  assetId,
  kind = 'sprite',
}: {
  assetId: string | null;
  kind?: AssetKind;
}) {
  const asset = useEditorStore((s) => findAsset(s.project, assetId));

  if (!asset) {
    return <p className="hint hint--error">{MISSING_ASSET[kind]}</p>;
  }

  return (
    <p className="hint">
      {asset.name} · {asset.width}×{asset.height}px. {ASSET_ROLE[kind]}
    </p>
  );
}

/**
 * A starting grid for an image the user has just asked to slice.
 *
 * Square frames along the longer edge: a sprite sheet is overwhelmingly a strip
 * or a grid of square cells, so the short edge is almost always exactly one
 * frame tall. It is a guess and it is meant to be — the four fields below it
 * are right there, and a guess that is usually right beats an empty form that
 * never is.
 */
function guessGrid(asset: ImageAsset): FrameGrid {
  const side = Math.min(asset.width, asset.height);
  return { frameWidth: side, frameHeight: side, margin: 0, spacing: 0 };
}

/**
 * Cutting an image into frames.
 *
 * On the image rather than on the sprite, because that is where the grid lives:
 * every sprite drawing this image reads the same cuts, and every animation is a
 * list of indices into them.
 */
export function SheetSection({ assetId }: { assetId: string | null }) {
  const asset = useEditorStore((s) => findAsset(s.project, assetId));
  const setAssetSheet = useEditorStore((s) => s.setAssetSheet);
  if (!asset) return null;

  const sheet = frameGridOf(asset);
  const atlas = atlasOf(asset);
  const set = (patch: Partial<FrameGrid>) =>
    setAssetSheet(asset.id, { ...(asset.sheet ?? guessGrid(asset)), ...patch });

  return (
    <>
      {/* An image is cut one way, so the two controls exclude each other rather
          than stacking. The checkbox is disabled while an atlas is attached
          because ticking it would silently destroy the atlas and every clip
          built on it — a control that quietly deletes work is worse than one
          that says it cannot — and the disabled state is what makes the
          exclusivity something the user sees rather than something that
          happens to them. */}
      <CheckboxField
        label="Sliced into frames"
        value={asset.sheet !== undefined}
        disabled={atlas !== null}
        onChange={(on) => setAssetSheet(asset.id, on ? guessGrid(asset) : null)}
      />

      {asset.sheet !== undefined && (
        <>
          <div className="field-row">
            <NumberField
              label="Frame W"
              value={asset.sheet.frameWidth}
              min={1}
              onChange={(frameWidth) => set({ frameWidth })}
            />
            <NumberField
              label="Frame H"
              value={asset.sheet.frameHeight}
              min={1}
              onChange={(frameHeight) => set({ frameHeight })}
            />
          </div>
          <div className="field-row">
            <NumberField
              label="Margin"
              value={asset.sheet.margin}
              min={0}
              onChange={(margin) => set({ margin })}
            />
            <NumberField
              label="Spacing"
              value={asset.sheet.spacing}
              min={0}
              onChange={(spacing) => set({ spacing })}
            />
          </div>
          <SheetSummary asset={asset} usable={sheet !== null} />
        </>
      )}

      <AtlasControls asset={asset} />
    </>
  );
}

/**
 * Attaching, replacing and removing a texture atlas.
 *
 * In `SheetSection` rather than in a section of its own, because this section
 * *is* the question "how is this image cut" and a second place to answer it is a
 * second place the two answers could disagree. It is also what makes the two
 * cuts visibly alternatives: they sit one above the other, each disabled while
 * the other is live.
 *
 * Replace is the same button as Attach, not a separate flow, because replacing
 * is the ordinary case — an atlas is re-exported every time the artwork changes,
 * and that path is the one that keeps a clip's frames by name.
 */
function AtlasControls({ asset }: { asset: ImageAsset }) {
  const setAssetAtlas = useEditorStore((s) => s.setAssetAtlas);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atlas = atlasOf(asset);
  const sliced = asset.sheet !== undefined;

  const attach = async () => {
    setError(null);
    const file = await pickAtlasFile();
    if (!file) return;
    setBusy(true);
    try {
      setAssetAtlas(asset.id, await importAtlasFile(file, asset));
    } catch (failure) {
      setError(
        failure instanceof AtlasImportError
          ? failure.message
          : `Could not read ${file.name}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="btn btn--block"
        disabled={busy || sliced}
        onClick={() => void attach()}
      >
        {busy ? 'Reading…' : atlas ? 'Replace atlas…' : 'Attach atlas…'}
      </button>

      {error && <p className="hint hint--error">{error}</p>}

      {atlas && (
        <>
          <AtlasSummary frames={atlas} />
          <button
            className="btn btn--block btn--danger"
            onClick={() => setAssetAtlas(asset.id, null)}
          >
            Remove atlas
          </button>
        </>
      )}

      {!atlas && sliced && (
        <p className="hint">An image is cut one way. Un-slice it to attach an atlas instead.</p>
      )}
    </>
  );
}

/**
 * `SheetSummary`'s sibling, and it reports a *range* of sizes where that one
 * reports a single size — because frames of one size is exactly what an atlas
 * is not, and the range is the shortest way to say the cut is doing its job.
 */
function AtlasSummary({ frames }: { frames: { name: string; width: number; height: number }[] }) {
  const widths = frames.map((frame) => frame.width);
  const heights = frames.map((frame) => frame.height);
  const smallest = `${Math.min(...widths)}×${Math.min(...heights)}`;
  const largest = `${Math.max(...widths)}×${Math.max(...heights)}`;
  return (
    <p className="hint">
      {frames.length} named frame{frames.length === 1 ? '' : 's'},{' '}
      {smallest === largest ? `${smallest}px` : `${smallest} to ${largest}px`}.
    </p>
  );
}

function SheetSummary({ asset, usable }: { asset: ImageAsset; usable: boolean }) {
  // A frame larger than the image is the shape of a mistyped number, and the
  // grid is ignored until it is fixed — so say that, rather than reporting the
  // "1 frame" the ignored grid works out to.
  if (!usable) {
    return (
      <p className="hint hint--error">
        A frame has to fit inside the {asset.width}×{asset.height} image. Drawing it whole
        until it does.
      </p>
    );
  }

  const { columns, rows } = frameLayoutOf(asset);
  const count = frameCountOf(asset);
  return (
    <p className="hint">
      {count} frame{count === 1 ? '' : 's'} ({columns}×{rows}) of {asset.sheet?.frameWidth}×
      {asset.sheet?.frameHeight}px.
    </p>
  );
}
