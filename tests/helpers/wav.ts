/**
 * A WAV file, built here rather than committed as a binary fixture.
 *
 * `png.ts`'s argument, and it applies more strongly. The audio tests care about
 * exactly two things — that the bytes survive an import and a round trip, and
 * that Phaser's loader can decode them — so a fixture whose length and contents
 * a reader can work out from the call is worth more than a checked-in file
 * nobody can see in a diff.
 *
 * WAV rather than MP3 or OGG because it is the only audio format that can be
 * synthesised with no encoder at all: a 44-byte RIFF header and then the
 * samples. That is the reason to pick it rather than a convenience — an MP3
 * fixture would mean shipping either a binary blob or an encoder, and this file
 * is simpler than `png.ts` is, where a PNG needed CRCs and a zlib wrapper.
 *
 * Keep them short. Every byte here is base64'd into a project file, embedded
 * again into an exported page, and decoded by a real browser in the export
 * tests; a second of audio is 16 KB before any of that.
 */

/** 8 kHz mono 16-bit, which is the smallest thing every browser will decode. */
const SAMPLE_RATE = 8000;
const BITS = 16;

function wav(samples: Int16Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => data.writeInt16LE(sample, index * 2));

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE((SAMPLE_RATE * BITS) / 8, 28); // byte rate
  header.writeUInt16LE(BITS / 8, 32); // block align
  header.writeUInt16LE(BITS, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

/**
 * A sine tone, so a fixture is audibly and byte-wise distinguishable from
 * silence — which matters when a test's claim is "these are different sounds".
 */
export function toneWav(ms: number, hz = 440): Buffer {
  const count = Math.max(1, Math.round((SAMPLE_RATE * ms) / 1000));
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    samples[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE) * 12000);
  }
  return wav(samples);
}

/** Silence, for the cases that only care that a decode succeeded. */
export function silentWav(ms: number): Buffer {
  return wav(new Int16Array(Math.max(1, Math.round((SAMPLE_RATE * ms) / 1000))));
}
