/**
 * A TrueType font, built here rather than committed as a binary fixture.
 *
 * `png.ts`'s and `wav.ts`'s argument, and it needs the most defending of the
 * three because a font is the largest thing of the three to synthesise. The
 * reason it is still worth it is the same one that made `stripPng` a strip of
 * solid frames rather than a picture: **a fixture has to let the test see which
 * font is drawn**, and no real font can do that. Every glyph here is a filled
 * em-square, so text set in it is a solid bar — a shape `findColorBox` can
 * measure and that cannot be mistaken for any face the machine happens to have
 * installed. A fixture that merely looked different would leave the assertion
 * measuring antialiasing and passing on the wrong font.
 *
 * TrueType rather than WOFF or WOFF2, for `wav.ts`'s reason exactly: it is the
 * only one of the four the import allows that can be built with no compressor
 * at all. A WOFF is this file plus a zlib-per-table container and a second set
 * of checksums, and it would prove nothing extra.
 *
 * Ten tables, which is the minimum Chrome's OpenType Sanitiser accepts — the
 * real faces on a developer machine carry fifteen to seventeen. Everything
 * here is the spec's required minimum rather than a choice, so the one thing
 * worth knowing before editing it is that **the sanitiser rejects silently**:
 * a font it refuses is a `console.warn` and a fall back to the previous family,
 * which from the canvas looks exactly like the feature not working at all.
 */

/** The em, and the box drawn inside it. Round numbers so a diff can be read. */
const UNITS_PER_EM = 1000;
const BOX = 700;
const ASCENT = 800;
const DESCENT = -200;

/**
 * A font whose every printable ASCII character is a filled `BOX`-square.
 *
 * `advance` is the only dial, and it is here so that two fixtures can differ in
 * a way a *measurement* can see: two fonts with identical glyphs and different
 * advances set the same string to two different widths, which is what proves a
 * canvas is drawing the font the document names rather than a cached one.
 */
export function blockTtf(advance = 800): Buffer {
  const glyph = filledBox();
  const tables: Record<string, Buffer> = {
    // Sorted by tag when the directory is written, so the order here is only
    // for a reader: metrics, then the outline, then the names.
    'OS/2': os2(advance),
    cmap: cmap(),
    glyf: glyph,
    head: head(),
    hhea: hhea(advance),
    hmtx: hmtx(advance),
    // Short format: an offset per glyph plus a terminator, each halved.
    loca: u16s([0, 0, glyph.length / 2]),
    maxp: maxp(),
    name: name(),
    post: post(),
  };
  return sfnt(tables);
}

/**
 * Glyph 1: one contour, four on-curve points, anticlockwise from the origin.
 *
 * Direction is not a mistake to fix. TrueType fills by the non-zero winding
 * rule, so a single contour fills whichever way it is wound; the direction
 * convention only decides which contours cut holes in which, and there is one.
 */
function filledBox(): Buffer {
  const body = Buffer.concat([
    i16s([1, 0, 0, BOX, BOX]), // one contour, then xMin yMin xMax yMax
    u16s([3, 0]), // last point of contour 0, then no instructions
    Buffer.from([0x01, 0x01, 0x01, 0x01]), // all four points on-curve
    i16s([0, BOX, 0, -BOX]), // x deltas, each from the point before
    i16s([0, 0, BOX, 0]), // y deltas
  ]);
  // Glyph data is indexed by `loca` in words, so an odd length is unaddressable.
  return body.length % 2 === 0 ? body : Buffer.concat([body, Buffer.alloc(1)]);
}

const FIRST_CHAR = 0x20;
const LAST_CHAR = 0x7e;

/**
 * A format 4 subtable mapping every printable ASCII code point to glyph 1.
 *
 * Through `glyphIdArray` rather than `idDelta`, and that is the whole subtlety
 * of this table: a delta is *added* to the code point, so one segment with a
 * delta maps a run of characters to a run of different glyphs. Sending the
 * whole segment to one glyph means spelling that glyph out per character.
 */
function cmap(): Buffer {
  const count = LAST_CHAR - FIRST_CHAR + 1;
  const subtable = Buffer.concat([
    u16s([
      4, // format
      16 + 8 * 2 + count * 2, // length: header, four arrays of two, the glyph ids
      0, // language
      2 * 2, // segCountX2: the ASCII run, then the required 0xFFFF terminator
      4, // searchRange: 2 * 2^floor(log2(2))
      1, // entrySelector
      0, // rangeShift
      LAST_CHAR,
      0xffff, // endCode
      0, // reservedPad
      FIRST_CHAR,
      0xffff, // startCode
      0, // idDelta: none, because the glyph ids are spelled out below
      1, // idDelta for the terminator, mapping 0xFFFF to glyph 0
      // idRangeOffset, counted in bytes from its own slot: four bytes ahead is
      // the first word of `glyphIdArray`, which is where this segment starts.
      2 * 2,
      0,
    ]),
    u16s(new Array<number>(count).fill(1)),
  ]);

  return Buffer.concat([
    u16s([0, 1]), // version, and one encoding record
    Buffer.concat([u16s([3, 1]), u32(12)]), // Windows / Unicode BMP, at offset 12
    subtable,
  ]);
}

function head(): Buffer {
  const table = Buffer.alloc(54);
  table.writeUInt32BE(0x00010000, 0); // version
  table.writeUInt32BE(0x00010000, 4); // fontRevision
  // 8: checkSumAdjustment, left zero here and filled in by `sfnt` once the
  // whole file exists — it is a checksum *of* the file, so it cannot be known
  // until every other table is placed.
  table.writeUInt32BE(0x5f0f3cf5, 12); // magicNumber
  table.writeUInt16BE(0x0003, 16); // flags: baseline at y=0, lsb at x=0
  table.writeUInt16BE(UNITS_PER_EM, 18);
  // 20..35: created and modified, both zero.
  table.writeInt16BE(0, 36); // xMin
  table.writeInt16BE(0, 38); // yMin
  table.writeInt16BE(BOX, 40); // xMax
  table.writeInt16BE(BOX, 42); // yMax
  table.writeUInt16BE(0, 44); // macStyle
  table.writeUInt16BE(8, 46); // lowestRecPPEM
  table.writeInt16BE(2, 48); // fontDirectionHint
  table.writeInt16BE(0, 50); // indexToLocFormat: short, matching `loca` above
  table.writeInt16BE(0, 52); // glyphDataFormat
  return table;
}

function hhea(advance: number): Buffer {
  const table = Buffer.alloc(36);
  table.writeUInt32BE(0x00010000, 0);
  table.writeInt16BE(ASCENT, 4);
  table.writeInt16BE(DESCENT, 6);
  table.writeInt16BE(0, 8); // lineGap
  table.writeUInt16BE(advance, 10); // advanceWidthMax
  table.writeInt16BE(0, 12); // minLeftSideBearing
  table.writeInt16BE(advance - BOX, 14); // minRightSideBearing
  table.writeInt16BE(BOX, 16); // xMaxExtent
  table.writeInt16BE(1, 18); // caretSlopeRise: upright
  table.writeInt16BE(0, 20); // caretSlopeRun
  // 22..31: caretOffset and four reserved shorts, all zero.
  table.writeInt16BE(0, 32); // metricDataFormat
  table.writeUInt16BE(2, 34); // numberOfHMetrics: one per glyph
  return table;
}

/** One advance and side bearing per glyph, matching `hhea`'s count. */
function hmtx(advance: number): Buffer {
  return Buffer.concat([u16s([advance]), i16s([0]), u16s([advance]), i16s([0])]);
}

function maxp(): Buffer {
  const table = Buffer.alloc(32);
  table.writeUInt32BE(0x00010000, 0); // version 1.0, which is what `glyf` needs
  table.writeUInt16BE(2, 4); // numGlyphs: .notdef and the box
  table.writeUInt16BE(4, 6); // maxPoints
  table.writeUInt16BE(1, 8); // maxContours
  // 10..19: composite limits, all zero — there are no composite glyphs.
  table.writeUInt16BE(2, 20); // maxZones
  // 22..31: the rest of the hinting limits, all zero.
  return table;
}

function os2(advance: number): Buffer {
  const table = Buffer.alloc(96);
  table.writeUInt16BE(4, 0); // version
  table.writeInt16BE(advance, 2); // xAvgCharWidth
  table.writeUInt16BE(400, 4); // usWeightClass: regular, so the browser
  table.writeUInt16BE(5, 6); //   synthesises bold rather than reporting one
  table.writeUInt16BE(0, 8); // fsType: installable
  table.writeInt16BE(650, 10); // ySubscriptXSize
  table.writeInt16BE(700, 12); // ySubscriptYSize
  table.writeInt16BE(0, 14);
  table.writeInt16BE(140, 16);
  table.writeInt16BE(650, 18); // ySuperscriptXSize
  table.writeInt16BE(700, 20);
  table.writeInt16BE(0, 22);
  table.writeInt16BE(480, 24);
  table.writeInt16BE(50, 26); // yStrikeoutSize
  table.writeInt16BE(260, 28); // yStrikeoutPosition
  table.writeInt16BE(0, 30); // sFamilyClass
  // 32..41: PANOSE, all zero ("any").
  table.writeUInt32BE(0x00000001, 42); // ulUnicodeRange1: Basic Latin
  // 46..57: the other three range words, all zero.
  table.write('PGUI', 58, 'ascii'); // achVendID
  table.writeUInt16BE(0x0040, 62); // fsSelection: regular
  table.writeUInt16BE(FIRST_CHAR, 64);
  table.writeUInt16BE(LAST_CHAR, 66);
  table.writeInt16BE(ASCENT, 68); // sTypoAscender
  table.writeInt16BE(DESCENT, 70);
  table.writeInt16BE(0, 72); // sTypoLineGap
  table.writeUInt16BE(ASCENT, 74); // usWinAscent
  table.writeUInt16BE(-DESCENT, 76); // usWinDescent, unsigned and so positive
  table.writeUInt32BE(0x00000001, 78); // ulCodePageRange1: Latin 1
  table.writeUInt32BE(0, 82);
  table.writeInt16BE(BOX, 86); // sxHeight
  table.writeInt16BE(BOX, 88); // sCapHeight
  table.writeUInt16BE(0, 90); // usDefaultChar
  table.writeUInt16BE(FIRST_CHAR, 92); // usBreakChar
  table.writeUInt16BE(1, 94); // usMaxContext
  return table;
}

/**
 * The six name records a sanitiser expects, in UTF-16BE under the Windows
 * platform.
 *
 * None of them decides what the font is *called* in use: `load.font` and the
 * editor both build a `FontFace` with a family of their own choosing, so this
 * table is here to be well formed rather than to be read.
 */
function name(): Buffer {
  const strings = [
    [1, 'Block'], // family
    [2, 'Regular'], // subfamily
    [3, 'PhaserGuiTool:Block'], // unique id
    [4, 'Block Regular'], // full name
    [5, 'Version 1.000'],
    [6, 'Block-Regular'], // PostScript name
  ] as const;

  const storage: Buffer[] = [];
  const records: Buffer[] = [];
  let offset = 0;
  for (const [id, text] of strings) {
    const encoded = Buffer.from(text, 'utf16le').swap16();
    records.push(
      Buffer.concat([u16s([3, 1, 0x0409, id, encoded.length, offset])]),
    );
    storage.push(encoded);
    offset += encoded.length;
  }

  return Buffer.concat([
    u16s([0, strings.length, 6 + strings.length * 12]), // format, count, offset
    ...records,
    ...storage,
  ]);
}

/** Version 3.0: no glyph names at all, which is what a sanitiser prefers here. */
function post(): Buffer {
  const table = Buffer.alloc(32);
  table.writeUInt32BE(0x00030000, 0);
  table.writeInt32BE(0, 4); // italicAngle
  table.writeInt16BE(-100, 8); // underlinePosition
  table.writeInt16BE(50, 10); // underlineThickness
  table.writeUInt32BE(1, 12); // isFixedPitch: every advance here is the same
  return table;
}

/**
 * The container: a sorted table directory, then the tables, each padded to a
 * four-byte boundary because every checksum is read as whole words.
 */
function sfnt(tables: Record<string, Buffer>): Buffer {
  const tags = Object.keys(tables).sort();
  const entrySelector = Math.floor(Math.log2(tags.length));
  const searchRange = 16 * 2 ** entrySelector;

  const header = Buffer.concat([
    u32(0x00010000), // sfntVersion: TrueType outlines
    u16s([tags.length, searchRange, entrySelector, tags.length * 16 - searchRange]),
  ]);

  const directory = Buffer.alloc(tags.length * 16);
  const bodies: Buffer[] = [];
  let offset = header.length + directory.length;

  tags.forEach((tag, index) => {
    const table = tables[tag];
    const padded = Buffer.concat([table, Buffer.alloc((4 - (table.length % 4)) % 4)]);
    const at = index * 16;
    directory.write(tag, at, 'ascii');
    directory.writeUInt32BE(checksum(padded), at + 4);
    directory.writeUInt32BE(offset, at + 8);
    // The *unpadded* length, which is what a reader slices by.
    directory.writeUInt32BE(table.length, at + 12);
    bodies.push(padded);
    offset += padded.length;
  });

  const file = Buffer.concat([header, directory, ...bodies]);

  // `head.checkSumAdjustment` is a checksum of the whole file taken while that
  // field reads zero, which is why it is written last and in place.
  const headAt = directory.readUInt32BE(tags.indexOf('head') * 16 + 8);
  file.writeUInt32BE((0xb1b0afba - checksum(file)) >>> 0, headAt + 8);
  return file;
}

/** The sum of a table's big-endian words, which is all a font checksum is. */
function checksum(data: Buffer): number {
  let sum = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    sum = (sum + data.readUInt32BE(i)) >>> 0;
  }
  return sum;
}

const u32 = (value: number): Buffer => {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0, 0);
  return out;
};

const u16s = (values: number[]): Buffer => {
  const out = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => out.writeUInt16BE(value & 0xffff, index * 2));
  return out;
};

const i16s = (values: number[]): Buffer => {
  const out = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => out.writeInt16BE(value, index * 2));
  return out;
};
