import { fontFormatOf, newId, type FontAsset } from './schema';

/**
 * Turning a font file the user picked into a `FontAsset`, and registering it
 * with the browser so the canvas can draw in it.
 *
 * `audio.ts` one medium over, and it is the audio case rather than the image
 * case in every way that matters:
 *
 * **The mime allowlist is the gate, not a consequence.** An image import
 * re-encodes through a canvas, so the stored form is normalised to PNG or JPEG
 * by construction. There is no re-encode for a font — a browser can rasterise
 * glyphs but cannot write a font file — so what a user picks is what gets
 * stored, and the allowlist has to refuse the rest on the way in.
 *
 * **The cap is the only lever there is**, for that same reason: an oversized
 * image is scaled down, an oversized font can only be refused.
 *
 * **The decode is proof, not a formality**, and it is what a canvas round-trip
 * is for an image: `FontFace.load()` runs the browser's own font sanitiser, so
 * a file that is not really a font is refused while the user is still looking
 * at the picker. That matters more here than anywhere else in this editor,
 * because the failure it prevents is *silent*: a font the sanitiser rejects
 * draws in the fallback family, which looks like nothing happening at all.
 *
 * One thing is genuinely different from both siblings, and it is the mime
 * detection — see `fontMimeOf`.
 */

/**
 * The only formats an import accepts, and exactly what `fileIO.ts`'s
 * `FONT_DATA_URL` lets back in from a saved file — the two lists are the same
 * list and have to stay that way, since one guards the import and the other
 * guards the open.
 *
 * Four rather than five, because there is no fifth worth having: WOFF2 is what
 * a modern font is delivered as, WOFF is its predecessor, and TTF and OTF are
 * what a font is *authored* as and therefore what a user has on disk. EOT and
 * SVG fonts are dead in every browser this editor runs in.
 */
const FONT_MIME_TYPES = ['font/ttf', 'font/otf', 'font/woff', 'font/woff2'];

/** The canonical mime for each extension the picker offers. */
const FONT_MIME_BY_EXTENSION: Record<string, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

/**
 * Cap on the encoded data URL.
 *
 * Half a sound's, and set by the same arithmetic against `autosave.ts`'s ~5 MB
 * localStorage draft. A megabyte is generous for what this is: a WOFF2 Latin
 * face is tens of kilobytes and a TTF one a few hundred, so the only thing this
 * refuses is a CJK face — which is megabytes on its own, would fill the draft
 * quota by itself, and needs subsetting rather than a bigger number here.
 */
const MAX_FONT_BYTES = 1024 * 1024;

export class FontImportError extends Error {}

/**
 * Loaded font faces, keyed by family *and* data URL.
 *
 * `assets.ts`' and `audio.ts`' decode cache, with one key more than either.
 * Those two key on the content alone, which cannot go stale because the key
 * *is* the bytes; a `FontFace` is bytes plus the name they are registered
 * under, so two fonts holding identical bytes under different families are two
 * different faces and must not share an entry.
 *
 * Loading a face does **not** register it with the document. That is
 * `EditorScene.syncFonts`' job, exactly as adding a decoded image to Phaser's
 * texture manager is `syncTextures`' — this file answers "can the browser read
 * these bytes", and the scene decides what is currently on screen.
 */
const decoded = new Map<string, FontFace>();

/**
 * What identifies one face: the family it is registered under and the bytes
 * behind it.
 *
 * Exported because `EditorScene` tracks what it has registered under the same
 * key, and for the same reason `textureKeyForAsset` folds a frame grid into a
 * texture key: a family on its own is not enough to say *which* face. Two
 * different projects can each hold a `Chunky`, and opening the second after the
 * first would otherwise leave the first one's bytes registered under a name the
 * new document means something else by.
 */
export const fontFaceKey = (asset: FontAsset): string =>
  `${asset.family}\n${asset.dataUrl}`;

/** The loaded face for an asset, if it has already been loaded. */
export const decodedFont = (asset: FontAsset): FontFace | undefined =>
  decoded.get(fontFaceKey(asset));

/**
 * Loads a font face, which is also the check that the bytes are a real font.
 *
 * The `format()` hint is not optional. Without it the browser guesses from the
 * bytes, and a WOFF2 announced as TrueType is refused outright — so the stored
 * mime has to reach this call, which is why `fontFormatOf` lives beside the
 * asset rather than being inferred here.
 */
export function decodeFont(asset: FontAsset): Promise<FontFace> {
  const cached = decoded.get(fontFaceKey(asset));
  if (cached) return Promise.resolve(cached);

  const source = `url(${asset.dataUrl}) format("${fontFormatOf(asset.mimeType)}")`;
  return new FontFace(asset.family, source).load().then(
    (face) => {
      decoded.set(fontFaceKey(asset), face);
      return face;
    },
    () => {
      throw new FontImportError("That font couldn't be read.");
    },
  );
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new FontImportError("That file couldn't be read."));
    reader.readAsDataURL(file);
  });

/**
 * Roughly how many bytes a data URL occupies in the saved file. The string is
 * what gets written, so its length is the honest measure.
 */
const dataUrlBytes = (dataUrl: string): number => dataUrl.length;

/**
 * The stored mime for a picked file, or null if it is not a font this editor
 * takes.
 *
 * **This is the one place fonts do not follow audio, and the reason is the
 * browser rather than a preference.** `importAudioFile` trusts `file.type`
 * because every platform reports an audio mime; for fonts they report
 * `font/ttf`, `application/x-font-ttf`, `application/octet-stream` or the empty
 * string depending on the OS, the browser and whether the file came from a
 * picker or a share sheet. Trusting it would refuse perfectly good fonts on
 * most machines.
 *
 * So the extension decides whenever the mime is not already one of the four,
 * and the answer is always re-derived rather than passed through — which means
 * the stored `mimeType` is one of the four by construction, whatever the
 * platform claimed, and `fileIO.ts`'s regex can stay as tight as its siblings.
 */
function fontMimeOf(file: File): string | null {
  const claimed = file.type.split(';')[0].trim().toLowerCase();
  if (FONT_MIME_TYPES.includes(claimed)) return claimed;

  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  return FONT_MIME_BY_EXTENSION[extension] ?? null;
}

/**
 * CSS generic family keywords, which a stored family may not be.
 *
 * Only the ones this derivation can actually produce: a keyword with a hyphen
 * in it (`sans-serif`, `system-ui`, `ui-monospace`) comes out of `fontFamilyFor`
 * as `SansSerif` and cannot collide.
 *
 * The collision is worth guarding because of how it fails. Generic keywords are
 * matched case-insensitively and win over a registered face, so importing
 * `serif.ttf` would give a family of `Serif`, register it, write it into the
 * node — and draw the browser's default serif, with every part of the editor
 * insisting the font was applied. That is the same silent-fallback failure the
 * whole iteration exists to remove, arriving from the one direction the user
 * could never diagnose.
 */
const CSS_GENERICS = new Set([
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'math',
  'emoji',
  'fangsong',
]);

/**
 * The family name a font is stored and referred to under.
 *
 * Unlike an audio key, which `audioKeyOf` derives on demand at export time,
 * this is derived **once, at import, and stored** — because a text node names a
 * font by holding this string in its `fontFamily`, so it has to be stable for
 * the life of the project and unique within it. `taken` is the families already
 * in the table.
 *
 * An identifier-safe token, deliberately: `Press Start 2P.ttf` becomes
 * `PressStart2P`. A family with a space in it would need quoting the moment it
 * sat in a comma-separated stack, and a family with a comma in it could not be
 * written in one at all — so the character set that makes `fontStackOf` a plain
 * split is the same one that makes the name safe everywhere it is printed.
 */
export function fontFamilyFor(fileName: string, taken: Iterable<string>): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr: string | undefined) =>
      chr ? chr.toUpperCase() : '',
    )
    // A family has to start with a letter, which also drops a leading digit.
    .replace(/^[^a-zA-Z]+/, '');

  const stem = base ? base[0].toUpperCase() + base.slice(1) : 'Font';
  // A generic goes in the taken set rather than being rewritten, so it takes
  // the same numeric suffix a genuine clash would: `serif.ttf` becomes `Serif2`.
  const used = new Set(taken);
  if (CSS_GENERICS.has(stem.toLowerCase())) used.add(stem);
  let candidate = stem;
  let n = 2;
  while (used.has(candidate)) candidate = `${stem}${n++}`;
  return candidate;
}

/**
 * Reads a picked file into an asset: work out the type, read it, check the
 * size, prove it loads.
 */
export async function importFontFile(
  file: File,
  taken: Iterable<string>,
): Promise<FontAsset> {
  const mimeType = fontMimeOf(file);
  if (!mimeType) {
    throw new FontImportError(
      `${file.name} is not a font this editor can use. Try TTF, OTF, WOFF or WOFF2.`,
    );
  }

  const dataUrl = await readAsDataUrl(file);
  if (dataUrlBytes(dataUrl) > MAX_FONT_BYTES) {
    const mb = (MAX_FONT_BYTES / (1024 * 1024)).toFixed(0);
    throw new FontImportError(
      `${file.name} is too large — fonts are limited to about ${mb} MB, ` +
        'because the whole project is saved as one file.',
    );
  }

  const asset: FontAsset = {
    id: newId(),
    name: file.name,
    family: fontFamilyFor(file.name, taken),
    mimeType,
    // The data URL a `FileReader` produces carries whatever mime the platform
    // claimed, which is exactly the value `fontMimeOf` just declined to trust,
    // so it is rewritten to the derived one before anything reads it back.
    dataUrl: `data:${mimeType};base64,${dataUrl.slice(dataUrl.indexOf(';base64,') + 8)}`,
  };

  // Also seeds the cache, so the canvas has its face the moment the next sync
  // runs rather than a frame later.
  await decodeFont(asset);
  return asset;
}

/** Human-readable size of a font, for the picker. */
export function formatFontSize(asset: FontAsset): string {
  const kb = dataUrlBytes(asset.dataUrl) / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
