// Generates the PWA icon set as flat PNGs with no external dependencies
// (no image library, no network fetch) so asset generation stays zero-cost
// and reproducible. Encodes raw RGBA -> PNG by hand (IHDR/IDAT/IEND + CRC32).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const BG = [15, 23, 42, 255]; // #0F172A
const FG = [255, 255, 255, 255];

// 5x7 block "C" glyph.
const GLYPH = [
  '01110',
  '10001',
  '10000',
  '10000',
  '10000',
  '10001',
  '01110'
].map((row) => row.split('').map(Number));

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, raw) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type: RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  // Filter type 0 (none) prefixed on every scanline.
  const stride = size * 4;
  const filtered = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0;
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(filtered);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function makeIcon(size, { paddingRatio = 0.24 } = {}) {
  const raw = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    raw[i * 4] = BG[0];
    raw[i * 4 + 1] = BG[1];
    raw[i * 4 + 2] = BG[2];
    raw[i * 4 + 3] = BG[3];
  }
  const rows = GLYPH.length;
  const cols = GLYPH[0].length;
  const avail = size * (1 - 2 * paddingRatio);
  const cell = Math.floor(avail / Math.max(rows, cols));
  const glyphW = cell * cols;
  const glyphH = cell * rows;
  const offX = Math.floor((size - glyphW) / 2);
  const offY = Math.floor((size - glyphH) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!GLYPH[r][c]) continue;
      const x0 = offX + c * cell;
      const y0 = offY + r * cell;
      for (let y = y0; y < y0 + cell; y++) {
        for (let x = x0; x < x0 + cell; x++) {
          const idx = (y * size + x) * 4;
          raw[idx] = FG[0];
          raw[idx + 1] = FG[1];
          raw[idx + 2] = FG[2];
          raw[idx + 3] = FG[3];
        }
      }
    }
  }
  return encodePNG(size, raw);
}

const targets = [
  { name: 'icon-192.png', size: 192, paddingRatio: 0.22 },
  { name: 'icon-512.png', size: 512, paddingRatio: 0.22 },
  { name: 'icon-maskable-512.png', size: 512, paddingRatio: 0.3 }, // safe zone for maskable
  { name: 'apple-touch-icon.png', size: 180, paddingRatio: 0.24 },
  { name: 'favicon.png', size: 64, paddingRatio: 0.2 }
];

for (const t of targets) {
  const png = makeIcon(t.size, { paddingRatio: t.paddingRatio });
  writeFileSync(join(outDir, t.name), png);
  console.log(`wrote ${t.name} (${t.size}x${t.size}, ${png.length} bytes)`);
}
