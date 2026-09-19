// Generates the PWA icon set: a small yellow taxi on the app's dark background. Pure Node —
// no image library, no network — so the icons stay free to regenerate. Shapes are drawn on a
// 512-unit canvas with 3x3 supersampling (smooth edges), then encoded to PNG by hand
// (IHDR/IDAT/IEND + CRC32).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#0F172A');

// ---- shape tests (all in the 512-unit design space, taxi centred on 256,256) ----
const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const rrect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const poly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const YELLOW = hex('#FBBF24');
const YELLOW_DARK = hex('#D9A016');
const GLASS = hex('#1E293B');
const GLASS_SHINE = hex('#334155');
const TYRE = hex('#0B1220');
const HUB = hex('#CBD5E1');
const WHITE = hex('#F8FAFC');
const BLACK = hex('#0B1220');
const RED = hex('#EF4444');
const LAMP = hex('#FFF7CC');

// Painter's order: later shapes cover earlier ones. Taxi is ~320 wide, centred on (256, 256).
const shapes = [];
const add = (test, color) => shapes.push({ test, color });

// roof sign
add(rrect(226, 150, 286, 178, 7), WHITE);
add(rect(250, 178, 262, 190), BLACK);
// cabin (roof + pillars)
add(poly([[146, 262], [190, 184], [326, 184], [372, 262]]), YELLOW);
// windows: two panes with a pillar between
add(poly([[170, 256], [200, 204], [248, 204], [248, 256]]), GLASS);
add(poly([[264, 256], [264, 204], [316, 204], [348, 256]]), GLASS);
add(poly([[186, 232], [204, 212], [220, 212], [206, 232]]), GLASS_SHINE);
// body
add(rrect(88, 250, 424, 344, 30), YELLOW);
add(rect(88, 322, 424, 344), YELLOW_DARK);
add(rrect(88, 322, 424, 344, 14), YELLOW_DARK);
// checker stripe along the door line
for (let i = 0; i < 18; i++) {
  const x0 = 108 + i * 17.4;
  add(rect(x0, 288, x0 + 8.7, 296.7), i % 2 === 0 ? BLACK : WHITE);
  add(rect(x0, 296.7, x0 + 8.7, 305.4), i % 2 === 0 ? WHITE : BLACK);
}
// lamps
add(circle(414, 278, 10), LAMP);
add(rrect(90, 268, 102, 290, 4), RED);
// wheels
for (const cx of [168, 344]) {
  add(circle(cx, 348, 40), TYRE);
  add(circle(cx, 348, 17), HUB);
  add(circle(cx, 348, 7), TYRE);
}

// ---- rasteriser ----
function colourAt(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].test(x, y)) return shapes[i].color;
  return BG;
}

// zoom > 1 enlarges the taxi (small favicons); < 1 leaves more margin (maskable safe zone).
function render(size, zoom) {
  const raw = Buffer.alloc(size * size * 4);
  const SS = 3;
  const k = 512 / size / zoom;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = (px + (sx + 0.5) / SS - size / 2) * k + 256;
          const dy = (py + (sy + 0.5) / SS - size / 2) * k + 256 + 2; // the taxi's visual centre sits ~2 units lower
          const c = colourAt(dx, dy);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const o = (py * size + px) * 4;
      raw[o] = Math.round(r / n);
      raw[o + 1] = Math.round(g / n);
      raw[o + 2] = Math.round(b / n);
      raw[o + 3] = 255;
    }
  }
  return raw;
}

// ---- PNG encoder ----
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
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9); // RGBA
  const stride = size * 4;
  const filtered = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0;
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filtered)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const targets = [
  { name: 'icon-192.png', size: 192, zoom: 1.12 },
  { name: 'icon-512.png', size: 512, zoom: 1.12 },
  { name: 'icon-maskable-512.png', size: 512, zoom: 0.92 }, // full-bleed with the taxi inside the safe zone
  { name: 'apple-touch-icon.png', size: 180, zoom: 1.12 },
  { name: 'favicon.png', size: 64, zoom: 1.3 }
];

for (const t of targets) {
  const png = encodePNG(t.size, render(t.size, t.zoom));
  writeFileSync(join(outDir, t.name), png);
  console.log(`wrote ${t.name} (${t.size}x${t.size}, ${png.length} bytes)`);
}
