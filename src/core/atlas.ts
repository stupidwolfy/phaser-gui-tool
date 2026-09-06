import { BASE_FRAME, type AtlasFrame, type ImageAsset } from './schema';

/**
 * Turning an atlas JSON the user picked into `AtlasFrame[]`.
 *
 * `fonts.ts` and `audio.ts` one kind of file over, and it is the only one of
 * the three that parses a *format* rather than validating a blob. That is the
 * whole reason it is a module: an atlas is the first thing this editor reads
 * that some other tool wrote, so the shape of what arrives is not ours to
 * assume, and the shape of what we store is not the shape that arrived.
 *
 * Three things follow from that:
 *
 * **Both TexturePacker output forms are accepted.** JSON Hash keys its frames
 * by name; JSON Array carries a `filename` inside each record. They are one
 * checkbox apart in the same dialog, a user has whichever they happen to have,
 * and the difference here is a dozen lines against a support question that
 * would never stop arriving. What is *stored* is neither of them — it is the
 * flat `AtlasFrame` record, normalised once, so nothing downstream ever asks
 * which form the file was in.
 *
 * **Nothing is repaired.** A frame this cannot read is dropped and the import
 * carries on, which is `parseAssets`' bargain: one unreadable frame should not
 * cost the user the other two hundred. A file with no readable frame at all is
 * refused outright, because "imported, zero frames" is a state that looks
 * exactly like the feature not working.
 *
 * **The refusal happens at the picker.** `importAtlasFile` throws a typed error
 * while the user is still looking at the file they chose, rather than storing
 * something the canvas will quietly decline to draw — the argument the font
 * import's decode-before-accept makes, for the same silent failure.
 */

/**
 * Cap on how many frames one atlas may carry.
 *
 * Not a performance limit — Phaser is happy with thousands — but a bound on
 * what lands in `autosave.ts`'s ~5 MB localStorage draft, which the images
 * themselves are already spending. Two thousand frames is far past any hand-
 * authored atlas and is roughly a hundred kilobytes of JSON on its own.
 */
const MAX_ATLAS_FRAMES = 2048;

/**
 * Cap on the JSON file itself, before it is parsed.
 *
 * Set against the same draft quota and generously: a 2048-frame atlas from a
 * real packer is a few hundred kilobytes of text, and the point of the number
 * is to refuse a file that is not an atlas at all before `JSON.parse` is asked
 * to hold it in memory.
 */
const MAX_ATLAS_BYTES = 2 * 1024 * 1024;

/** Refusals a user should see, rather than a stack trace in the console. */
export class AtlasImportError extends Error {}

/** A finite number, or null — the shape check every field below shares. */
function numberOr(value: unknown, fallback: number | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * One packer record — either form — as an `AtlasFrame`, or null if it is not
 * one.
 *
 * The `frame` block is the only part that is required. Everything else is trim
 * and rotation, which are carried through verbatim for Phaser's own parser to
 * act on; this function's job is to say what they are, not to apply them.
 */
function readFrame(name: string, raw: unknown): AtlasFrame | null {
  if (typeof raw !== 'object' || raw === null) return null;
  if (name === BASE_FRAME) return null;
  const record = raw as Record<string, unknown>;
  const box = record.frame;
  if (typeof box !== 'object' || box === null) return null;
  const rect = box as Record<string, unknown>;

  const x = numberOr(rect.x, null);
  const y = numberOr(rect.y, null);
  const width = numberOr(rect.w, null);
  const height = numberOr(rect.h, null);
  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;

  const frame: AtlasFrame = {
    name,
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.floor(width),
    height: Math.floor(height),
  };

  // Trim is all-or-nothing on the way in, because it is all-or-nothing on the
  // way out: Phaser reads `spriteSourceSize` only when `trimmed` is set, and a
  // frame claiming to be trimmed with no original size to be trimmed *from* is
  // a frame it would draw at the wrong scale.
  const source = record.sourceSize as Record<string, unknown> | undefined;
  const inner = record.spriteSourceSize as Record<string, unknown> | undefined;
  if (record.trimmed === true && source && inner) {
    const sourceWidth = numberOr(source.w, null);
    const sourceHeight = numberOr(source.h, null);
    if (sourceWidth !== null && sourceHeight !== null) {
      frame.trimmed = true;
      frame.sourceWidth = Math.floor(sourceWidth);
      frame.sourceHeight = Math.floor(sourceHeight);
      frame.offsetX = Math.floor(numberOr(inner.x, 0) ?? 0);
      frame.offsetY = Math.floor(numberOr(inner.y, 0) ?? 0);
    }
  }

  return frame;
}

/**
 * The frames an atlas JSON describes, in the order it lists them.
 *
 * Order is the packer's and is kept: it is the order the artist's own export
 * produced, and it is what makes "every frame, in order" a sensible seed for a
 * new animation clip. Sorting would be this editor having an opinion about
 * somebody else's file.
 *
 * A duplicate name is dropped rather than suffixed. A suffixed name is a name
 * no packer will produce again, so the next re-import would not match it — and
 * a name is the only handle a node has on a frame.
 */
export function parseAtlasJson(text: string): AtlasFrame[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AtlasImportError('That file is not JSON the editor can read.');
  }
  if (typeof json !== 'object' || json === null) {
    throw new AtlasImportError('That file is not a texture atlas.');
  }

  const root = json as Record<string, unknown>;
  // The multipack form nests its pages under `textures`. One page is read as an
  // ordinary atlas; several are refused outright rather than silently reduced
  // to the first, because an atlas here is a property of *one* set of bytes and
  // dropping pages would leave half the frames missing with nothing said.
  const pages = root.textures;
  if (Array.isArray(pages) && pages.length > 1) {
    throw new AtlasImportError(
      'That atlas is packed across several images. Re-export it as a single page.',
    );
  }
  const source =
    Array.isArray(pages) && pages.length === 1
      ? ((pages[0] as Record<string, unknown>)?.frames ?? null)
      : (root.frames ?? null);

  const frames: AtlasFrame[] = [];
  const seen = new Set<string>();
  let rotated = false;
  const push = (name: string, raw: unknown) => {
    // Noted before any of the guards below, so a rotated frame is seen even if
    // it is past the cap or shares a name — the refusal is about the *file*
    // having been packed with rotation on, not about this one entry.
    if ((raw as Record<string, unknown> | null)?.rotated === true) rotated = true;
    if (!name || seen.has(name) || frames.length >= MAX_ATLAS_FRAMES) return;
    const frame = readFrame(name, raw);
    if (!frame) return;
    seen.add(name);
    frames.push(frame);
  };

  if (Array.isArray(source)) {
    // JSON Array: the name is a `filename` field inside each record.
    for (const raw of source) {
      const record = raw as Record<string, unknown> | null;
      const name = record && typeof record.filename === 'string' ? record.filename : '';
      push(name, raw);
    }
  } else if (typeof source === 'object' && source !== null) {
    // JSON Hash: the name is the key.
    for (const [name, raw] of Object.entries(source as Record<string, unknown>)) {
      push(name, raw);
    }
  } else {
    throw new AtlasImportError(
      'That file has no frames in it. Export a JSON Hash or JSON Array atlas.',
    );
  }

  // Refused rather than ignored, and refused here rather than drawn wrong. A
  // rotated frame is stored on its side and turned back by Phaser at draw time,
  // which this editor would be forwarding on trust — invisible on a square
  // fixture and wrong on a real sheet. Packers rotate only when asked, so the
  // fix is a checkbox in the tool that made the file.
  if (rotated) {
    throw new AtlasImportError(
      'That atlas has rotated frames, which this editor cannot draw. ' +
        'Re-export it with rotation switched off.',
    );
  }

  if (frames.length === 0) {
    throw new AtlasImportError(
      'None of the frames in that file could be read. Export a JSON Hash or JSON Array atlas.',
    );
  }
  return frames;
}

/**
 * Reads an atlas JSON the user picked, and checks it against the image it is
 * being attached to.
 *
 * The image check is the half that cannot be deferred: an atlas is only
 * meaningful beside the picture it cuts, and pairing a JSON with the wrong
 * import is the single likeliest mistake here — two atlases in a folder, two
 * PNGs, and nothing about either file name that has to match. Every frame
 * landing outside the image is exactly what that looks like, so it is said
 * plainly rather than left to `atlasOf` to drop silently.
 */
export async function importAtlasFile(file: File, asset: ImageAsset): Promise<AtlasFrame[]> {
  if (file.size > MAX_ATLAS_BYTES) {
    const mb = (MAX_ATLAS_BYTES / (1024 * 1024)).toFixed(0);
    throw new AtlasImportError(
      `${file.name} is too large — atlas data is limited to about ${mb} MB, ` +
        'because the whole project is saved as one file.',
    );
  }

  const frames = parseAtlasJson(await file.text());
  const inside = frames.filter(
    (frame) => frame.x + frame.width <= asset.width && frame.y + frame.height <= asset.height,
  );
  if (inside.length === 0) {
    throw new AtlasImportError(
      `None of ${file.name}'s frames fit inside ${asset.name}, which is ` +
        `${asset.width}×${asset.height}px. Is this the atlas for a different image?`,
    );
  }
  return inside;
}
