/**
 * The file extension for every MIME type an asset in this document may carry.
 *
 * Shared by the project archive and the export bundle, which both write assets
 * out as real files: two maps would be two answers to what a `.m4a` is called,
 * and a disagreement would only show as a bundle whose loader asks for a file
 * the archive named differently.
 */
export const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
};
