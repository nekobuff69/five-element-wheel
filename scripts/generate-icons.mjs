// Generates the 五行輪 mark: favicon.svg plus every PNG the manifest needs.
// One geometry source for all outputs — the vector and the rasters cannot drift.
// No native canvas dependency; the mark is five discs on a lacquer ground, so a
// coverage-blended rasteriser is a few dozen lines of arithmetic.
//
// Run: node scripts/generate-icons.mjs

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { deflateSync } from "zlib";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");

// --- Mark: 五石 (five stones), on the 64-unit grid ---------------------------
// The five element stones of the app, ordered by the 相剋 (overcoming) cycle
// 木→土→水→火→金. The order is deliberate: earth #8A6A3C and metal #B08D57 are
// both warm browns and merge into one blob when adjacent at 16px.
const GROUND = "#12100e";
const PENTAGON_RADIUS = 17.8;
const DISC_RADIUS = 7.0;
const STONES = [
  { angle: 180, color: "#6E8B84" }, // 木 wood   — bottom
  { angle: 252, color: "#8A6A3C" }, // 土 earth  — lower left
  { angle: 324, color: "#4A6470" }, // 水 water  — upper left
  { angle: 36, color: "#A8322A" }, // 火 fire   — upper right
  { angle: 108, color: "#B08D57" }, // 金 metal  — lower right
];

// Angle is measured clockwise from 12 o'clock, as in the Wheel's own geometry.
function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: 32 + radius * Math.sin(rad),
    y: 32 - radius * Math.cos(rad),
  };
}

const discs = STONES.map(({ angle, color }) => ({
  ...polar(angle, PENTAGON_RADIUS),
  color,
}));

const round = (n) => Number(n.toFixed(2));

function buildSvg() {
  const circles = discs
    .map(
      ({ x, y, color }) =>
        `  <circle cx="${round(x)}" cy="${round(y)}" r="${DISC_RADIUS}" fill="${color}" />`,
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="五行輪">
  <title>五行輪 · Five-Element Wheel</title>
  <!-- 五石: the five element stones on a lacquer ground, in 相剋 order 木→土→水→火→金. -->
  <rect width="64" height="64" fill="${GROUND}" />
${circles}
</svg>
`;
}

// --- PNG writer --------------------------------------------------------------
function createCRC32() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return (data) => {
    let crc = 0xffffffff;
    for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
}
const crc32 = createCRC32();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

// Opaque RGB — no alpha channel, so iOS never composites the apple-touch icon
// onto black and no platform has to guess at a transparent ground.
function renderRaster(size) {
  const scale = size / 64;
  const pixels = new Uint8Array(size * size * 3);
  const bg = hexToRgb(GROUND);

  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = bg[0];
    pixels[i * 3 + 1] = bg[1];
    pixels[i * 3 + 2] = bg[2];
  }

  const r = DISC_RADIUS * scale;
  for (const disc of discs) {
    const cx = disc.x * scale;
    const cy = disc.y * scale;
    const [cr, cg, cb] = hexToRgb(disc.color);
    const minX = Math.max(0, Math.floor(cx - r - 1));
    const maxX = Math.min(size - 1, Math.ceil(cx + r + 1));
    const minY = Math.max(0, Math.floor(cy - r - 1));
    const maxY = Math.min(size - 1, Math.ceil(cy + r + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // One device-pixel feather: coverage falls off across the boundary.
        const a = Math.min(1, Math.max(0, r + 0.5 - dist));
        if (a <= 0) continue;
        const i = (y * size + x) * 3;
        pixels[i] = Math.round(pixels[i] * (1 - a) + cr * a);
        pixels[i + 1] = Math.round(pixels[i + 1] * (1 - a) + cg * a);
        pixels[i + 2] = Math.round(pixels[i + 2] * (1 - a) + cb * a);
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour, no alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 3;
  const filtered = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0; // filter: none
    Buffer.from(pixels.buffer, y * stride, stride).copy(
      filtered,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Outputs -----------------------------------------------------------------
// The mark spans 46.6 of the 64 units (73% of the width), so it already sits
// inside the maskable 80% circle; the maskable raster carries the same drawing
// on a full-bleed ground, declared separately in the manifest.
const RASTERS = [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
];

mkdirSync(publicDir, { recursive: true });

writeFileSync(resolve(publicDir, "favicon.svg"), buildSvg());
console.log("Created favicon.svg");

for (const [name, size] of RASTERS) {
  const png = renderRaster(size);
  writeFileSync(resolve(publicDir, name), png);
  console.log(`Created ${name} (${size}x${size}, ${png.length} bytes)`);
}
