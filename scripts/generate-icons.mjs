// Generates placeholder PWA icons as valid PNG files.
// Uses only built-in Node.js modules — no native canvas dependency.

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { deflateSync } from "zlib";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");

function createCRC32() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return (data) => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
}

const crc32 = createCRC32();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function generateIcon(size) {
  // RGBA pixel buffer
  const raw = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44;
  const innerR = outerR * 0.4;

  // 5-segment colors (earth, metal, wood, fire, water) with 50% opacity bg
  const segments = [
    [0.2, 0.1, 0.18, 0.9], // deep bg base
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;

      if (dist > outerR) {
        // Transparent outside circle
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Dark background inside circle
      raw[idx] = 26;
      raw[idx + 1] = 26;
      raw[idx + 2] = 46;
      raw[idx + 3] = 255;

      // Ring at outer edge
      if (dist > outerR - size * 0.04) {
        raw[idx] = 74;
        raw[idx + 1] = 144;
        raw[idx + 2] = 217;
        raw[idx + 3] = 128;
        continue;
      }

      // Inner hub circle
      if (dist < innerR) {
        raw[idx] = 74;
        raw[idx + 1] = 144;
        raw[idx + 2] = 217;
        raw[idx + 3] = 255;
        continue;
      }

      // 5 colored segments (wedge slices)
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI); // 0..1
      const segmentAngle = (angle * 5) % 5;
      const wedge = Math.floor(segmentAngle);

      // Slight radial gradient within each wedge
      const t = (dist - innerR) / (outerR - innerR);
      const brightness = 1 - t * 0.3;

      const colors = [
        [139, 105, 20], // earth
        [218, 165, 32], // metal
        [76, 160, 80], // wood
        [229, 57, 53], // fire
        [30, 136, 229], // water
      ];

      const [cr, cg, cb] = colors[wedge];
      raw[idx] = Math.min(255, Math.round(cr * brightness));
      raw[idx + 1] = Math.min(255, Math.round(cg * brightness));
      raw[idx + 2] = Math.min(255, Math.round(cb * brightness));
      raw[idx + 3] = 255;
    }
  }

  const signature = Buffer.from([137, 80, 78, 67, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Filter bytes (None filter = 0x00 per row) + raw pixels
  const filtered = Buffer.alloc(size + size * size * 4);
  for (let y = 0; y < size; y++) {
    filtered[y * (size * 4 + 1)] = 0; // filter type None
    raw.copy(filtered, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const compressed = deflateSync(filtered);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(publicDir, { recursive: true });

for (const size of [192, 512]) {
  const png = generateIcon(size);
  const outPath = resolve(publicDir, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}

console.log("Icons generated successfully.");
