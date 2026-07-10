// Генератор иконок MYRA: PNG пишем сами (zlib + чанки), без зависимостей.
// Дизайн: тёмный градиент + три светящихся бара волны.
import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA8
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));
// расстояние до скруглённого прямоугольника (для баров и маски)
const sdRoundRect = (px, py, cx, cy, hw, hh, r) => {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
};

const BG1 = [27, 15, 58], BG2 = [5, 5, 11];          // фон: фиолетовый → чёрный
const BAR1 = [196, 181, 253], BAR2 = [139, 92, 246]; // бар: светлый верх → фиолетовый низ

function draw(size, { rounded, background, scale = 1 }) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const cornerR = size * 0.225;
  // три бара волны: [смещение X, полувысота]
  const bars = [[-0.21, 0.14], [0, 0.24], [0.21, 0.17]];
  const bw = size * 0.062 * scale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      if (background) {
        const d = Math.hypot(x - size * 0.32, y - size * 0.26) / size;
        [r, g, b] = mix(BG1, BG2, Math.min(1, d * 1.35));
        a = 255;
        if (rounded) {
          const sd = sdRoundRect(x, y, c, c, c, c, cornerR);
          if (sd > 0) a = 0;
          else if (sd > -1.5) a = Math.round(255 * -sd / 1.5); // сглаживание края
        }
      }
      // свечение + бары
      let glow = 0, barA = 0, barT = 0;
      for (const [ox, hh] of bars) {
        const bx = c + ox * size * scale;
        const sd = sdRoundRect(x, y, bx, c, bw / 2, hh * size * scale, bw / 2);
        if (sd < 0) { barA = 1; barT = (y - (c - hh * size * scale)) / (2 * hh * size * scale); }
        else if (sd < 1.2) { barA = Math.max(barA, 1 - sd / 1.2); barT = 0.5; }
        glow += Math.max(0, 1 - sd / (size * 0.16));
      }
      if (glow > 0 && a > 0) {
        const gk = Math.min(0.55, glow * glow * 0.10);
        r = lerp(r, BAR2[0], gk); g = lerp(g, BAR2[1], gk); b = lerp(b, BAR2[2], gk);
      }
      if (barA > 0) {
        const [br, bg_, bb] = mix(BAR1, BAR2, Math.min(1, Math.max(0, barT)));
        r = lerp(r, br, barA); g = lerp(g, bg_, barA); b = lerp(b, bb, barA);
        a = Math.max(a, Math.round(255 * barA));
      }
      const i = (y * size + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return png(size, size, buf);
}

const out = (rel, data) => {
  const p = join(process.cwd(), rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
  console.log(rel, Math.round(data.length / 1024) + "KB");
};

const res = "android/app/src/main/res";
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(densities)) {
  const icon = draw(s, { rounded: true, background: true });
  out(`${res}/mipmap-${d}/ic_launcher.png`, icon);
  out(`${res}/mipmap-${d}/ic_launcher_round.png`, icon);
  // adaptive foreground: 108dp, знак мельче (safe zone), без фона
  const fg = draw(Math.round(s * 2.25), { rounded: false, background: false, scale: 0.62 });
  out(`${res}/mipmap-${d}/ic_launcher_foreground.png`, fg);
}
// splash: тёмный квадрат со знаком по центру
const splash = draw(1440, { rounded: false, background: true });
for (const dir of ["drawable", "drawable-land-mdpi", "drawable-land-hdpi", "drawable-land-xhdpi", "drawable-land-xxhdpi", "drawable-land-xxxhdpi", "drawable-port-mdpi", "drawable-port-hdpi", "drawable-port-xhdpi", "drawable-port-xxhdpi", "drawable-port-xxxhdpi"]) {
  out(`${res}/${dir}/splash.png`, splash);
}
// favicon для веба/электрона
out("public/icon.png", draw(256, { rounded: true, background: true }));
console.log("done");
