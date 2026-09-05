import type { Page } from '@playwright/test';

/**
 * Reading what is actually drawn on the canvas.
 *
 * Store-level assertions are not enough here: the bug that prompted this
 * harness held the right coordinates in the document the whole time while the
 * canvas showed something else. Every canvas check therefore goes through a
 * screenshot.
 *
 * Two traps, both of which produced confident wrong answers before:
 *
 * - The canvas must be read with Playwright's element screenshot, never by
 *   drawing it into a 2D context inside the page. Phaser runs WebGL without
 *   `preserveDrawingBuffer`, so a readback after the frame is composited
 *   returns solid black — and the centroid of nothing looks exactly like "the
 *   object was never drawn".
 * - The decoding below happens in a page, but on a throwaway 2D canvas holding
 *   a PNG we hand it, which is a different thing entirely and is safe.
 */

export interface ColorBlob {
  /** Matching pixels found. Zero means the colour is not on screen at all. */
  count: number;
  /** Centroid of the matching pixels, in screenshot pixels. */
  x: number;
  y: number;
}

/** '#rrggbb' -> [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Finds every pixel within `tolerance` of `hex` and returns their centroid.
 *
 * The analysis runs inside the page rather than in Node so that a 1440x900
 * screenshot does not have to cross the protocol boundary a million numbers at
 * a time; only the three-number result comes back. `page` can be any page —
 * it is used purely as a PNG decoder.
 */
export async function findColor(
  page: Page,
  png: Buffer,
  hex: string,
  tolerance = 24,
): Promise<ColorBlob> {
  const [r, g, b] = rgb(hex);
  return page.evaluate(
    async ({ base64, target, tolerance }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context to decode the screenshot with');
      context.drawImage(bitmap, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

      let count = 0;
      let sumX = 0;
      let sumY = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          if (
            Math.abs(data[i] - target[0]) <= tolerance &&
            Math.abs(data[i + 1] - target[1]) <= tolerance &&
            Math.abs(data[i + 2] - target[2]) <= tolerance &&
            data[i + 3] > 200
          ) {
            count += 1;
            sumX += x;
            sumY += y;
          }
        }
      }
      return count === 0
        ? { count: 0, x: NaN, y: NaN }
        : { count, x: sumX / count, y: sumY / count };
    },
    { base64: png.toString('base64'), target: [r, g, b] as const, tolerance },
  );
}

/** The box a colour occupies, rather than the middle of it. */
export interface ColorBox {
  count: number;
  /** Left and top of the matching pixels, in screenshot pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The extent of every pixel matching `hex`, rather than its centroid.
 *
 * For a *filled* shape the two say the same thing and the centroid is the
 * steadier reading. For an outline they do not: a two-pixel stroke lands on a
 * different sub-pixel phase on each of its four edges, so one edge matches at
 * full strength where the opposite one is split across two half-strength
 * pixels — which drags the centroid sideways by a tenth of the shape's width
 * for a reason that has nothing to do with where it is. The extent is immune to
 * that, since an edge one pixel wide and an edge two pixels wide start in the
 * same place. It is also the only reading that can say how *big* something is
 * drawn, which for a camera frame is half of what it means.
 *
 * Both edges have to be on screen for this to mean anything: an outline running
 * off the canvas, or under the band `shot` clips away, reports the clip rather
 * than the shape.
 */
export async function findColorBox(
  page: Page,
  png: Buffer,
  hex: string,
  tolerance = 24,
): Promise<ColorBox> {
  const [r, g, b] = rgb(hex);
  return page.evaluate(
    async ({ base64, target, tolerance }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context to decode the screenshot with');
      context.drawImage(bitmap, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

      let count = 0;
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          if (
            Math.abs(data[i] - target[0]) <= tolerance &&
            Math.abs(data[i + 1] - target[1]) <= tolerance &&
            Math.abs(data[i + 2] - target[2]) <= tolerance &&
            data[i + 3] > 200
          ) {
            count += 1;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      return count === 0
        ? { count: 0, x: NaN, y: NaN, width: NaN, height: NaN }
        : { count, x: left, y: top, width: right - left, height: bottom - top };
    },
    { base64: png.toString('base64'), target: [r, g, b] as const, tolerance },
  );
}
