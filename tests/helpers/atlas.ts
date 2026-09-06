import { rectsPng } from './png';

/**
 * An atlas image and the JSON that cuts it, built from one list of rectangles.
 *
 * `png.ts`, `wav.ts` and `ttf.ts`'s argument for a fourth time, with one thing
 * of its own: a texture atlas is *two* files that state one fact, and two
 * fixture helpers free to disagree about where a frame is would be precisely
 * the failure this whole iteration is built to prevent. So the image and both
 * JSON shapes come out of the same array, and a test cannot accidentally assert
 * against a cut the picture does not have.
 *
 * The frames are deliberately **irregular** — three sizes, at offsets no
 * `(frameWidth, frameHeight, margin, spacing)` can produce, with unpainted gaps
 * between them. That is what makes this a fixture for an atlas rather than for
 * a sheet whose frames happen to have names: the size claim is the one a grid
 * cannot pass, and the gaps are pixels a grid would have to include.
 *
 * The colours clear every chrome colour the editor draws — the selection
 * outline `#00e5ff`, the snap guides `#ff3ea5` and `#ffa723`, the scene frame
 * `#5a6478`, the body outline, the emitter marker `#ff6bd6` and the scene
 * background `#1d2330` — which is the cyan trap that cost the particles suite a
 * confident wrong answer.
 */
export interface AtlasFixtureFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hex: string;
}

export const ATLAS_WIDTH = 96;
export const ATLAS_HEIGHT = 64;
/** Unpainted space between the frames — a grid would have to swallow it. */
export const ATLAS_BACKGROUND = '#101418';

/**
 * Wide and short, tall and narrow, and a small square in the corner.
 *
 * Chosen so that the *aspect ratio* of what is drawn differs between frames.
 * That is the reading a drawn assertion can make without trusting a single
 * absolute pixel count, and it is the one an implementation that quietly fell
 * back to a grid — or to the whole image — cannot fake.
 */
export const ATLAS_FRAMES: readonly AtlasFixtureFrame[] = [
  { name: 'wide', x: 0, y: 0, w: 64, h: 16, hex: '#f2c14e' },
  { name: 'tall', x: 0, y: 24, w: 16, h: 40, hex: '#4ef2a1' },
  { name: 'small', x: 72, y: 8, w: 24, h: 24, hex: '#c14ef2' },
];

/** The image those frames are cut from. */
export function atlasPng(frames: readonly AtlasFixtureFrame[] = ATLAS_FRAMES): Buffer {
  return rectsPng(ATLAS_WIDTH, ATLAS_HEIGHT, ATLAS_BACKGROUND, frames);
}

/**
 * TexturePacker's JSON Hash: the frame name is the key.
 *
 * `meta` is included because a real file has one and because everything outside
 * `frames` is passed to `texture.customData` — so a fixture without it would be
 * testing a shape no packer produces.
 */
export function atlasHash(frames: readonly AtlasFixtureFrame[] = ATLAS_FRAMES): string {
  const entries: Record<string, unknown> = {};
  for (const frame of frames) {
    entries[frame.name] = {
      frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h },
      sourceSize: { w: frame.w, h: frame.h },
    };
  }
  return JSON.stringify({
    frames: entries,
    meta: { app: 'test', size: { w: ATLAS_WIDTH, h: ATLAS_HEIGHT }, scale: '1' },
  });
}

/**
 * TexturePacker's JSON Array: the same frames, with the name inside each record
 * as `filename` and the container an array.
 *
 * Both shapes exist because both are in the same dropdown in the same tool, and
 * a user has whichever their team picked. A test that imports each and compares
 * the stored result is the only thing that says the two are read as one cut.
 */
export function atlasArray(frames: readonly AtlasFixtureFrame[] = ATLAS_FRAMES): string {
  return JSON.stringify({
    frames: frames.map((frame) => ({
      filename: frame.name,
      frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h },
      sourceSize: { w: frame.w, h: frame.h },
    })),
    meta: { app: 'test', size: { w: ATLAS_WIDTH, h: ATLAS_HEIGHT }, scale: '1' },
  });
}

/**
 * The same names in different places, and one name gone.
 *
 * A repack is the ordinary life of an atlas — the artist adds a sprite and every
 * rectangle moves — and it is the only thing that tells a name-based
 * implementation from an index-based one. `small` is dropped so the clip-
 * resolution rule (survivors stay, the rest go) has something to resolve.
 */
export const REPACKED_FRAMES: readonly AtlasFixtureFrame[] = [
  { name: 'tall', x: 60, y: 0, w: 16, h: 40, hex: '#4ef2a1' },
  { name: 'wide', x: 0, y: 48, w: 64, h: 16, hex: '#f2c14e' },
];
