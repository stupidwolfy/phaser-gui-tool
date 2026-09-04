import { newId, type AudioAsset } from './schema';

/**
 * Turning a file the user picked into an `AudioAsset`, and getting its duration
 * back out again later.
 *
 * `assets.ts` one medium over, and shaped by the same single fact: the bytes
 * live inside the project document, which is what makes a project one
 * self-contained file. Two things follow differently here, and both are worth
 * knowing before touching any of it.
 *
 * **The mime allowlist is the gate, not a consequence.** An image import
 * re-encodes everything through a canvas, so the stored form is normalised to
 * PNG or JPEG by construction and no validator downstream has to sniff. There
 * is no equivalent for audio: the Web Audio API decodes and does not encode, so
 * the only re-encoding available is raw PCM into a WAV — which makes the file
 * several times *larger*. So what a user picks is what gets stored, and the
 * allowlist has to refuse the rest on the way in.
 *
 * **The cap is much tighter than an image's, and it is the only lever there
 * is.** An image that arrives too big is scaled down; audio that arrives too
 * big can only be refused. A minute of ordinary music outweighs a whole scene's
 * worth of sprites, and `autosave.ts`'s localStorage draft is about 5 MB for
 * the entire project, so this is set against that quota rather than against the
 * 4 MB an image is allowed.
 *
 * The decode at the end of an import is not a formality either. It is what a
 * canvas round-trip does for an image — proof that the stored bytes are ones a
 * browser can actually read — and it is the only chance to say so while the
 * user is still looking at the picker rather than at an exported game that
 * plays nothing. It yields the duration in passing.
 */

/**
 * The only formats an import accepts.
 *
 * What every current browser can decode between them, and exactly what
 * `fileIO.ts`'s `AUDIO_DATA_URL` lets back in from a saved file — the two lists
 * are the same list and have to stay that way, since one guards the import and
 * the other guards the open.
 */
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm'];

/**
 * Cap on the encoded data URL.
 *
 * Half what an image gets, because base64 inflates by a third and the whole
 * project has to fit in a ~5 MB autosave draft. Two megabytes is a couple of
 * minutes of 128 kbps mp3 — a loop, a jingle and a handful of effects — which
 * is what a project built in this editor actually holds.
 */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export class AudioImportError extends Error {}

/**
 * Decoded audio elements, keyed by data URL.
 *
 * `assets.ts`'s decode cache exactly, including the choice of key: two assets
 * holding identical bytes share one decode, and the cache cannot go stale
 * because the key *is* the content.
 *
 * An `HTMLAudioElement` rather than a Web Audio `AudioBuffer`, because the two
 * things this is for — reading a duration and auditioning a row — are both
 * things an `<audio>` element does without an AudioContext, and an AudioContext
 * cannot be created before a user gesture without the browser complaining.
 */
const decoded = new Map<string, HTMLAudioElement>();

/** The decoded element for a data URL, if it has already been decoded. */
export const decodedAudio = (dataUrl: string): HTMLAudioElement | undefined =>
  decoded.get(dataUrl);

export function decodeAudio(dataUrl: string): Promise<HTMLAudioElement> {
  const cached = decoded.get(dataUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const audio = new Audio();
    // Metadata is all this needs: a duration, and proof the browser can play
    // the bytes at all. Waiting for the whole file to buffer would make the
    // panel row appear seconds after the import on a slow machine.
    audio.addEventListener('loadedmetadata', () => {
      decoded.set(dataUrl, audio);
      resolve(audio);
    });
    audio.addEventListener('error', () =>
      reject(new AudioImportError("That sound couldn't be decoded.")),
    );
    audio.preload = 'metadata';
    audio.src = dataUrl;
  });
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new AudioImportError("That file couldn't be read."));
    reader.readAsDataURL(file);
  });

/**
 * Roughly how many bytes a data URL occupies in the saved file. The string is
 * what gets written, so its length is the honest measure.
 */
const dataUrlBytes = (dataUrl: string): number => dataUrl.length;

/**
 * Reads a picked file into an asset: check the type, read it, check the size,
 * prove it decodes.
 *
 * The decode at the end is not a formality. A file whose extension and mime
 * type say `audio/ogg` but whose bytes are something else would import
 * cleanly, sit in the table, and fail in the exported game — where the user has
 * no way at all to tell what went wrong. Failing here costs one await and says
 * so while they are looking at the picker.
 */
export async function importAudioFile(file: File): Promise<AudioAsset> {
  // The browser's own type, not the extension: a file picked from a phone's
  // media library often arrives with a name that says nothing.
  const mimeType = file.type.split(';')[0].trim().toLowerCase();
  if (!AUDIO_MIME_TYPES.includes(mimeType)) {
    throw new AudioImportError(
      `${file.name} is not a sound this editor can use. Try MP3, OGG, WAV, M4A or WebM.`,
    );
  }

  const dataUrl = await readAsDataUrl(file);
  if (dataUrlBytes(dataUrl) > MAX_AUDIO_BYTES) {
    const mb = (MAX_AUDIO_BYTES / (1024 * 1024)).toFixed(0);
    throw new AudioImportError(
      `${file.name} is too large — sounds are limited to about ${mb} MB, ` +
        'because the whole project is saved as one file.',
    );
  }

  // Also seeds the cache under the stored key, so the audition button has its
  // element the moment the row renders.
  const audio = await decodeAudio(dataUrl);

  return {
    id: newId(),
    name: file.name,
    mimeType,
    dataUrl,
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
  };
}

/** Human-readable size of a sound, for the picker. */
export function formatAudioSize(asset: AudioAsset): string {
  const kb = dataUrlBytes(asset.dataUrl) / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}

/** `m:ss`, which is how long a sound is written everywhere else. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
