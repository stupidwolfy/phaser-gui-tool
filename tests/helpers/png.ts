import { deflateSync } from 'node:zlib';
import { rgb } from './pixels';

/**
 * A solid-colour PNG, built here rather than committed as a binary fixture.
 *
 * The image tests care about exactly two things — that the bytes survive the
 * import, and that the pixels reach the canvas — so a fixture the test can
 * state the colour and size of is worth more than a checked-in file whose
 * contents nobody can see in a diff.
 */
export function solidPng(width: number, height: number, hex: string): Buffer {
  const [r, g, b] = rgb(hex);

  // One filter byte (0 = none) in front of each row of RGBA pixels.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const start = y * (1 + width * 4);
    raw[start] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = start + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }

  return encodePng(width, height, raw);
}

/** The PNG container around already-filtered RGBA rows. */
function encodePng(width: number, height: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12: compression, filter and interlace methods, all 0.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * A horizontal strip of solid-colour frames — a sprite sheet whose frames can
 * be told apart on the canvas by colour alone.
 *
 * The animation tests are pixel tests like every other canvas test here, and
 * the thing they have to see is *which frame* is drawn. A sheet of shapes could
 * not answer that from a colour centroid; one band per frame can, and the test
 * gets to state the answer it expects as a hex string.
 */
export function stripPng(frameSize: number, hexes: string[]): Buffer {
  const width = frameSize * hexes.length;
  const height = frameSize;
  const raw = Buffer.alloc(height * (1 + width * 4));

  for (let y = 0; y < height; y += 1) {
    const start = y * (1 + width * 4);
    raw[start] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = rgb(hexes[Math.floor(x / frameSize)]);
      const i = start + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }

  return encodePng(width, height, raw);
}

/**
 * A square with a border in one colour and a middle in another — a nine-slice
 * source whose corners can be told from its middle on the canvas.
 *
 * `stripPng`'s argument one feature over. What a nine-slice test has to see is
 * that the *border keeps its size* while the middle grows, and no solid fixture
 * can state that: stretched and sliced draw the same single colour. Two colours
 * make the claim measurable — `findColorBox` on the middle says how far the
 * middle reaches, and the border is what is left.
 *
 * `border` is in source pixels and is the inset a test then asks the panel for,
 * so a fixture and the props that slice it cannot disagree.
 */
export function framePng(size: number, border: number, edgeHex: string, middleHex: string): Buffer {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const edge = rgb(edgeHex);
  const middle = rgb(middleHex);

  for (let y = 0; y < size; y += 1) {
    const start = y * (1 + size * 4);
    raw[start] = 0;
    for (let x = 0; x < size; x += 1) {
      const inside = x >= border && x < size - border && y >= border && y < size - border;
      const [r, g, b] = inside ? middle : edge;
      const i = start + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }

  return encodePng(size, size, raw);
}

/**
 * A square that is one colour with a block of another in its top-left quarter —
 * a tile whose repeats can be counted on the canvas.
 *
 * The claim a tile-sprite test has to make is that the texture *repeats* rather
 * than stretching, and a single motif cannot say it: one block stretched and one
 * block tiled both put that colour on the canvas. Placed off-centre in the tile,
 * the block appears once per repeat, so the marks span the whole object when it
 * tiles and sit alone in the middle when it does not — which `findColorBox`
 * reads as a width.
 */
export function tilePng(size: number, groundHex: string, markHex: string): Buffer {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const ground = rgb(groundHex);
  const mark = rgb(markHex);
  const half = Math.floor(size / 2);

  for (let y = 0; y < size; y += 1) {
    const start = y * (1 + size * 4);
    raw[start] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = x < half && y < half ? mark : ground;
      const i = start + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }

  return encodePng(size, size, raw);
}
