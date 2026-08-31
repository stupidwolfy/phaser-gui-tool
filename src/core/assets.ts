import { newId, type ImageAsset } from './schema';

/**
 * Turning a file the user picked into an `ImageAsset`, and getting the pixels
 * back out again later.
 *
 * Everything an image touches in this app is bounded by one fact: the bytes
 * live inside the project document. That is what makes a project one
 * self-contained file, and it is also why import re-encodes rather than storing
 * whatever the user picked — a 12 MP phone photo dropped in raw would be a
 * 5 MB document, over the localStorage draft quota and unpleasant as an export.
 */

/**
 * Longest edge an imported image is scaled down to.
 *
 * 2048 is generous for a 2D sprite and still lands well inside the texture size
 * every WebGL implementation guarantees. Images already smaller than this are
 * left at their own size — upscaling would only cost bytes.
 */
const MAX_EDGE = 2048;

/** Cap on the encoded data URL. Past this a project stops being practical. */
const MAX_DATA_URL_BYTES = 4 * 1024 * 1024;

/** JPEG quality for photographic sources. Visually clean, roughly a third the size. */
const JPEG_QUALITY = 0.92;

export class ImageImportError extends Error {}

/**
 * Decoded images, keyed by data URL.
 *
 * Phaser needs an `HTMLImageElement` (or a canvas) to build a texture from, and
 * decoding is asynchronous while the scene's store sync is not. Caching the
 * decode means a sprite only ever waits for its image once — on the first sync
 * after an import or an open — rather than on every store change.
 *
 * Keyed by data URL rather than asset id so that two assets holding identical
 * bytes share one decode, and so that the cache cannot go stale: the key *is*
 * the content.
 */
const decoded = new Map<string, HTMLImageElement>();

/** The decoded image for a data URL, if it has already been decoded. */
export const decodedImage = (dataUrl: string): HTMLImageElement | undefined =>
  decoded.get(dataUrl);

export function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  const cached = decoded.get(dataUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      decoded.set(dataUrl, image);
      resolve(image);
    };
    image.onerror = () => reject(new ImageImportError("That image couldn't be decoded."));
    image.src = dataUrl;
  });
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageImportError("That file couldn't be read."));
    reader.readAsDataURL(file);
  });

/**
 * Roughly how many bytes a data URL occupies in the saved file. The string is
 * what gets written, so its length is the honest measure, not the decoded size.
 */
const dataUrlBytes = (dataUrl: string): number => dataUrl.length;

export interface ImportedImage {
  asset: ImageAsset;
  /** True when the image was scaled down to fit `MAX_EDGE`, so the UI can say so. */
  resized: boolean;
}

/**
 * Reads a picked file into an asset: decode, scale down if oversized, re-encode.
 *
 * Everything goes through the canvas, including PNGs that would have fit as
 * they are. That normalises the stored form to exactly two mime types — which
 * is what lets the exporter emit a data URL without sniffing it — and it
 * rasterises SVG at import time, so a sprite's intrinsic size is a real number
 * of pixels rather than something the renderer has to resolve later.
 */
export async function importImageFile(file: File): Promise<ImportedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageImportError(`${file.name} is not an image.`);
  }

  const source = await decodeImage(await readAsDataUrl(file));
  const { naturalWidth, naturalHeight } = source;
  if (naturalWidth === 0 || naturalHeight === 0) {
    throw new ImageImportError(`${file.name} has no dimensions.`);
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageImportError('This browser would not give us a canvas.');
  context.drawImage(source, 0, 0, width, height);

  // JPEG has no alpha channel, so anything that might be transparent has to
  // stay PNG. Only a source that was already JPEG is safe to re-encode as one.
  const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mimeType, JPEG_QUALITY);

  if (dataUrlBytes(dataUrl) > MAX_DATA_URL_BYTES) {
    throw new ImageImportError(
      `${file.name} is too large to embed (over ${Math.round(MAX_DATA_URL_BYTES / 1024 / 1024)} MB once encoded). ` +
        'Save it smaller and import it again.',
    );
  }

  // Pre-seed the cache under the stored key: the re-encoded data URL is a
  // different string from the source file's, and it is the one every sprite
  // will ask for from here on.
  await decodeImage(dataUrl);

  return {
    resized: scale < 1,
    asset: {
      id: newId(),
      name: file.name,
      mimeType,
      dataUrl,
      width,
      height,
    },
  };
}

/** Human-readable size of an asset, for the picker. */
export function formatAssetSize(asset: ImageAsset): string {
  const kb = dataUrlBytes(asset.dataUrl) / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
