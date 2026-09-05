import { useState } from 'react';
import { countFontUses, useEditorStore } from '../core/store';
import { fontStackOf, type FontAsset } from '../core/schema';
import { FontImportError, formatFontSize, importFontFile } from '../core/fonts';
import { pickFontFile } from '../io/fileIO';

/**
 * Choosing the font a text object is drawn in, and importing new ones.
 *
 * `AssetPicker`'s shape and its placement argument: this belongs in the node's
 * own inspector section, where a sprite's image picker is, rather than in
 * `SceneInspector` where the sounds are. A sound is scene state; a font is what
 * *this object* is drawn in.
 *
 * **The free-text Font family field above this stays, and that is the design
 * rather than a leftover.** A family has always been a CSS stack, and typing
 * `Georgia, serif` goes on working exactly as it did — a project has every
 * right to name a font it expects the machine to have. What the picker adds is
 * the one thing free text cannot do: make the *derived* family of an imported
 * font reachable without the user reading it off a row and retyping it. That is
 * the gap `audioKeyOf`'s "plays as jump" row can afford to leave open, because
 * an audio key is a hint for a line the user writes later, while a family is
 * the link itself — get it wrong by a letter and the font silently does
 * nothing.
 */
export function FontPicker({
  fontFamily,
  onPick,
}: {
  fontFamily: string;
  onPick: (family: string) => void;
}) {
  const fonts = useEditorStore((s) => s.project.fonts);
  const addFont = useEditorStore((s) => s.addFont);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived outside the selector: `fontStackOf` builds a fresh array every
  // call, so selecting it directly compares unequal on every store change and
  // loops forever — the `tileMapOf` trap.
  const asked = fontStackOf(fontFamily);

  const importFont = async () => {
    setError(null);
    const file = await pickFontFile();
    if (!file) return;

    setBusy(true);
    try {
      // The families already taken, so the new one cannot collide with them.
      const asset = await importFontFile(
        file,
        fonts.map((font) => font.family),
      );
      addFont(asset);
      onPick(asset.family);
    } catch (failure) {
      setError(
        failure instanceof FontImportError
          ? failure.message
          : `Could not import ${file.name}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn--block" disabled={busy} onClick={() => void importFont()}>
        {busy ? 'Importing…' : 'Import font…'}
      </button>

      {error && <p className="hint hint--error">{error}</p>}

      {fonts.length > 0 && (
        <ul className="assets">
          {fonts.map((asset) => (
            <FontRow
              key={asset.id}
              asset={asset}
              selected={asked.includes(asset.family)}
              onPick={() => onPick(asset.family)}
            />
          ))}
        </ul>
      )}

      <p className="hint">
        {fonts.length === 0
          ? 'No fonts yet. Without one, Font family names a font the player’s ' +
            'browser has to already have — so text can come out in something ' +
            'else entirely on another machine.'
          : 'An imported font travels inside the project and inside the export, ' +
            'so text looks the same everywhere.'}
      </p>
    </>
  );
}

function FontRow({
  asset,
  selected,
  onPick,
}: {
  asset: FontAsset;
  selected: boolean;
  onPick: () => void;
}) {
  const removeFont = useEditorStore((s) => s.removeFont);
  const uses = useEditorStore((s) => countFontUses(s.project, asset.family));

  const remove = () => {
    // Unlike an image, removing this leaves every object intact and still
    // drawn — the nodes keep the family name and fall back to the browser's
    // font. The warning still names the count, because "the text changes
    // appearance" is a visible thing to be warned about even when nothing is
    // lost, and the family is not one press to retype.
    if (
      uses > 0 &&
      !window.confirm(
        `${asset.name} is used by ${uses} text object${uses === 1 ? '' : 's'}. ` +
          'Remove it and let them fall back to a font the browser has?',
      )
    ) {
      return;
    }
    removeFont(asset.id);
  };

  return (
    <li className={`assets__item ${selected ? 'is-selected' : ''}`}>
      <button className="assets__pick" onClick={onPick} title={`Use ${asset.name}`}>
        {/* The font drawing its own name, which is the only preview that says
            anything — and it costs nothing, since the face is registered with
            the document the moment the scene syncs. */}
        <span className="assets__thumb assets__thumb--font" style={{ fontFamily: asset.family }}>
          Ag
        </span>
        <span className="assets__meta">
          <span className="assets__name">{asset.name}</span>
          {/* The family as well as the name, for the reason an audio row shows
              its key: "Press Start 2P.ttf" draws as `PressStart2P`, and nobody
              can guess that. Here it matters more, because this string is the
              link rather than a hint — it is what Font family has to say. */}
          <span className="assets__detail">
            {formatFontSize(asset)} · draws as {asset.family}
          </span>
        </span>
      </button>
      <button
        className="icon-btn icon-btn--danger"
        onClick={remove}
        aria-label={`Remove ${asset.name}`}
        title="Remove font from the project"
      >
        ✕
      </button>
    </li>
  );
}
