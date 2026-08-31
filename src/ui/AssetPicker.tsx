import { useState } from 'react';
import { countAssetUses, useEditorStore } from '../core/store';
import { findAsset, type ImageAsset } from '../core/schema';
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
