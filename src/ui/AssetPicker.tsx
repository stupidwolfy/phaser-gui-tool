import { useState } from 'react';
import { countAssetUses, useEditorStore } from '../core/store';
import {
  findAsset,
  frameCountOf,
  frameGridOf,
  frameLayoutOf,
  type FrameGrid,
  type ImageAsset,
} from '../core/schema';
import { CheckboxField, NumberField } from './fields';
import { ImageImportError, formatAssetSize, importImageFile } from '../core/assets';
import { pickImageFile } from '../io/fileIO';

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

      {assets.length === 0 && !busy && (
        <p className="hint">No images yet. Import one to give this sprite something to draw.</p>
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

/** The chosen image's details, or a prompt to choose one. */
export function AssetSummary({ assetId }: { assetId: string | null }) {
  const asset = useEditorStore((s) => findAsset(s.project, assetId));

  if (!asset) {
    return (
      <p className="hint hint--error">
        No image chosen — this sprite draws a placeholder and exports as nothing.
      </p>
    );
  }

  return (
    <p className="hint">
      {asset.name} · {asset.width}×{asset.height}px. Size on the canvas is this times
      the transform scale above.
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
  const set = (patch: Partial<FrameGrid>) =>
    setAssetSheet(asset.id, { ...(asset.sheet ?? guessGrid(asset)), ...patch });

  return (
    <>
      <CheckboxField
        label="Sliced into frames"
        value={asset.sheet !== undefined}
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
    </>
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
