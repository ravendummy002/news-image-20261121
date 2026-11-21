// World News in One Day: Saturday 21 November 2026
// A newspaper front page drawn entirely in code: own rasterizer, own
// 5x7 bitmap font, own PNG encoder. Node 22, standard library only,
// no network, fully deterministic (same bytes on every run).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 227];
const INK = [17, 17, 17];
const NAVY = [20, 38, 74];
const NAVY_LT = [38, 62, 110];
const RED = [179, 32, 44];
const GOLD = [217, 164, 65];
const CREAM = [255, 252, 240];
const SKY = [214, 228, 240];
const DUSK = [250, 196, 120];
const ORANGE = [232, 110, 30];
const GREY = [90, 90, 86];
const TINTS = [
  [232, 240, 246],
  [246, 236, 220],
  [232, 244, 232],
  [246, 232, 232],
  [238, 232, 246],
  [246, 244, 226],
  [232, 238, 240],
  [240, 232, 228],
];

// ------------------------------------------------------------------ canvas
const buf = Buffer.alloc(W * H * 3);
function fill(c: number[]) {
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = c[0];
    buf[i * 3 + 1] = c[1];
    buf[i * 3 + 2] = c[2];
  }
}
function px(x: number, y: number, c: number[]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, c: number[], t = 1) {
  rect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: number[], t = 1) {
  rect(x, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[]) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function circle(cx: number, cy: number, r: number, c: number[], fillIt: boolean) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (fillIt ? d <= r * r : d <= r * r && d >= (r - 1) * (r - 1)) px(cx + x, cy + y, c);
    }
  }
}
function starburst(cx: number, cy: number, r: number, c: number[]) {
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const len = i % 2 === 0 ? r : Math.floor(r * 0.45);
    line(cx, cy, Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len), c);
  }
  circle(cx, cy, Math.max(2, Math.floor(r * 0.3)), c, true);
}

// -------------------------------------------------------------------- font
// 5x7 bitmap font, each glyph 7 rows of 5 bits (bit 4 = leftmost pixel).
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 6, 4, 0, 4],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "%": [25, 26, 2, 4, 8, 19, 25],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  ";": [0, 12, 0, 0, 12, 4, 8],
  ":": [0, 12, 0, 0, 12, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  "*": [0, 4, 21, 14, 21, 4, 0],
  "•": [0, 0, 0, 12, 12, 0, 0],
  ">": [8, 4, 2, 1, 2, 4, 8],
  "<": [2, 4, 8, 16, 8, 4, 2],
};
function glyph(ch: string): number[] {
  const up = ch.toUpperCase();
  if (up === "—" || up === "–") return FONT["-"];
  if (up === "’" || up === "‘") return FONT["'"];
  return FONT[up] ?? FONT["?"];
}
function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, c: number[], bold = false) {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          rect(cx + col * scale, y + row * scale, scale, scale, c);
          if (bold) rect(cx + col * scale + 1, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: number[], bold = false) {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c, bold);
}
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur === "" ? w : cur + " " + w;
    if (textWidth(test, scale) <= maxWidth || cur === "") {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
function drawBlock(lines: string[], x: number, y: number, scale: number, c: number[], lh: number, bold = false) {
  let yy = y;
  for (const ln of lines) {
    drawText(ln, x, yy, scale, c, bold);
    yy += lh;
  }
  return yy;
}

// -------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter none
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ layout
fill(PAPER);
const M = 24; // margin
const CW = W - 2 * M; // 976

// ---- masthead ----
rect(0, 0, W, 128, NAVY);
rect(0, 128, W, 5, GOLD);
drawTextCentered("THE WORLD IN ONE DAY", W / 2, 22, 6, CREAM, true);
drawTextCentered("SATURDAY 21 NOVEMBER 2026", W / 2, 78, 4, GOLD, true);
hline(M, 148, CW, INK, 2);
drawTextCentered("THE DAY'S WORLD NEWS IN ONE PAGE", W / 2, 158, 2, GREY);

// ---- lead story ----
const leadY = 188;
const leadH = 236;
rect(M, leadY, CW, leadH, CREAM);
// border (3px)
hline(M, leadY, CW, INK, 3);
hline(M, leadY + leadH - 3, CW, INK, 3);
vline(M, leadY, leadH, INK, 3);
vline(M + CW - 3, leadY, leadH, INK, 3);
const lx = M + 22;
let ly = leadY + 16;
drawText("WAR IN UKRAINE  •  LEAD STORY", lx, ly, 2, RED, true);
ly += 30;
drawText("RUSSIA'S MASSIVE STRIKE", lx, ly, 4, INK, true);
ly += 38;
drawText("HITS KYIV — AND POLAND", lx, ly, 4, INK, true);
ly += 44;
// summary, left column
const sumLines = wrap(
  "400+ DRONES AND 110+ MISSILES HIT UKRAINE OVERNIGHT. AT LEAST 8 KILLED IN KYIV; BRIDGES AND POWER HIT. TWO MISSILES AND A SUSPECTED DRONE LAND IN POLAND. TUSK CALLS IT A DELIBERATE PROVOCATION; NATO CALLS IT A GRAVE VIOLATION.",
  600,
  2,
);
drawBlock(sumLines, lx, ly, 2, INK, 21);
// illustration, right side: dusk skyline under attack
const ix = M + CW - 340;
const iy = leadY + 52;
const iw = 318;
const ih = leadH - 64;
rect(ix, iy, iw, ih, SKY);
rect(ix, iy + Math.floor(ih * 0.45), iw, Math.floor(ih * 0.55), DUSK);
// skyline silhouettes
const blds = [46, 78, 58, 92, 66, 84, 52, 96, 70, 60];
let bx = ix + 6;
for (const bh of blds) {
  const bw = 26;
  rect(bx, iy + ih - bh, bw, bh, NAVY);
  // lit windows
  for (let wy = iy + ih - bh + 8; wy < iy + ih - 10; wy += 14) {
    for (let wx = bx + 5; wx < bx + bw - 5; wx += 9) {
      if ((wx + wy) % 3 === 0) rect(wx, wy, 3, 4, GOLD);
    }
  }
  bx += bw + 2;
}
// explosion bursts above the skyline
starburst(ix + 70, iy + 34, 22, ORANGE);
starburst(ix + 78, iy + 30, 10, GOLD);
starburst(ix + 210, iy + 44, 18, ORANGE);
starburst(ix + 218, iy + 40, 9, GOLD);
starburst(ix + 268, iy + 22, 13, RED);
// drones: small dots with trails
const drones: [number, number][] = [
  [40, 18],
  [120, 26],
  [160, 12],
  [240, 30],
  [285, 14],
];
for (const [dx, dy] of drones) {
  line(ix + dx - 14, iy + dy + 6, ix + dx, iy + dy, INK);
  circle(ix + dx, iy + dy, 3, INK, true);
}
drawText("KYIV UNDER FIRE", ix + 8, iy + ih - 22, 2, CREAM, true);

// ---- panels: 2 rows x 4 cols ----
type Panel = { kicker: string; color: number[]; title: string; body: string; draw: (x: number, y: number, w: number, h: number) => void };
function iconChart(x: number, y: number, w: number, h: number) {
  // falling market chart
  const ox = x + 14;
  const oy = y + h - 16;
  hline(ox, oy, w - 28, INK, 2);
  vline(ox, y + 10, h - 26, INK, 2);
  const pts: [number, number][] = [
    [0, 62],
    [18, 56],
    [36, 60],
    [54, 44],
    [72, 36],
    [90, 20],
    [108, 12],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    line(ox + 8 + pts[i][0], oy - 8 - pts[i][1], ox + 8 + pts[i + 1][0], oy - 8 - pts[i + 1][1], RED);
    line(ox + 8 + pts[i][0], oy - 7 - pts[i][1], ox + 8 + pts[i + 1][0], oy - 7 - pts[i + 1][1], RED);
  }
  // arrowhead pointing down-right at the end of the fall
  line(ox + 8 + 108, oy - 8 - 12, ox + 8 + 118, oy - 8 - 2, RED);
  line(ox + 8 + 108, oy - 8 - 12, ox + 8 + 96, oy - 8 - 12, RED);
  drawText("-5.3%", x + w - 66, y + 12, 2, RED, true);
}
function iconFlags(x: number, y: number, w: number, h: number) {
  // two flags side by side: UK cross and EU stars
  const fx = x + 22;
  const fy = y + 12;
  const fw = 84;
  const fh = 52;
  rect(fx, fy, fw, fh, NAVY_LT);
  rect(fx + fw / 2 - 6, fy, 12, fh, CREAM);
  rect(fx, fy + fh / 2 - 6, fw, 12, CREAM);
  rect(fx + fw / 2 - 3, fy, 6, fh, RED);
  rect(fx, fy + fh / 2 - 3, fw, 6, RED);
  rect(fx, fy, fw, 3, INK);
  rect(fx + fw + 18, fy, fw, fh, NAVY);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    circle(Math.round(fx + fw + 18 + fw / 2 + Math.cos(a) * 17), Math.round(fy + fh / 2 + Math.sin(a) * 15), 3, GOLD, true);
  }
  line(fx + fw + 4, fy + fh / 2, fx + fw + 14, fy + fh / 2, INK);
}
function iconGlobe(x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2 + 2;
  const r = 34;
  circle(cx, cy, r, [70, 130, 90], true);
  circle(cx, cy, r, INK, false);
  // latitude lines
  for (const dy of [-16, 0, 16]) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    hline(cx - half, cy + dy, half * 2, CREAM, 2);
  }
  // meridian
  for (let yy = -r; yy <= r; yy += 2) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy) * 0.45);
    px(cx - half, cy + yy, CREAM);
    px(cx + half, cy + yy, CREAM);
  }
  drawText("31", cx - 12, cy - 10, 2, CREAM, true);
}
function iconIntercept(x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  line(x + 16, y + h - 14, cx + 30, y + 12, INK);
  line(x + w - 16, y + h - 14, cx - 30, y + 12, INK);
  starburst(cx, cy - 6, 16, ORANGE);
  starburst(cx, cy - 6, 7, GOLD);
  drawText("X", cx - 40, cy + 12, 2, RED, true);
}
function iconShield(x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2 - 2;
  // shield outline
  line(cx - 30, cy - 30, cx + 30, cy - 30, INK);
  line(cx - 30, cy - 30, cx - 30, cy + 6, INK);
  line(cx + 30, cy - 30, cx + 30, cy + 6, INK);
  line(cx - 30, cy + 6, cx, cy + 32, INK);
  line(cx + 30, cy + 6, cx, cy + 32, INK);
  line(cx - 30, cy - 30, cx - 30, cy + 6, INK);
  rect(cx - 22, cy - 22, 44, 40, NAVY);
  drawText("FBI", cx - 18, cy - 12, 2, CREAM, true);
  // crack
  line(cx + 8, cy - 22, cx + 2, cy - 6, RED);
  line(cx + 2, cy - 6, cx + 10, cy + 6, RED);
  line(cx + 10, cy + 6, cx + 4, cy + 16, RED);
}
function iconPill(x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  // capsule, tilted
  for (let i = -26; i <= 26; i++) {
    const yy = Math.round(cy + i * 0.35);
    const xx = cx + i;
    circle(xx, yy, 11, i < 0 ? RED : CREAM, true);
  }
  circle(cx - 26, Math.round(cy - 26 * 0.35), 11, RED, true);
  circle(cx + 26, Math.round(cy + 26 * 0.35), 11, CREAM, true);
  // outline dots
  for (let i = -26; i <= 26; i++) {
    const yy = Math.round(cy + i * 0.35);
    px(cx + i, yy - 11, INK);
    px(cx + i, yy + 11, INK);
  }
  drawText("+", cx + 52, cy - 24, 3, RED, true);
}
function iconCrowd(x: number, y: number, w: number, h: number) {
  const cy = y + h - 18;
  const heads = [0, 1, 2, 3, 4];
  for (const i of heads) {
    const hx = x + 34 + i * 34;
    const hy = cy - (i % 2 === 0 ? 26 : 14);
    circle(hx, hy, 13, i % 2 === 0 ? NAVY : RED, true);
    rect(hx - 13, hy + 13, 26, 12, i % 2 === 0 ? NAVY : RED);
  }
  // placard
  rect(x + w - 82, y + 6, 70, 26, CREAM);
  hline(x + w - 82, y + 6, 70, INK, 2);
  hline(x + w - 82, y + 30, 70, INK, 2);
  vline(x + w - 82, y + 6, 26, INK, 2);
  vline(x + w - 14, y + 6, 26, INK, 2);
  drawText("GEN Z", x + w - 78, y + 12, 2, INK, true);
}
function iconQuake(x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2 + 12;
  // seismograph zigzag across the top
  const zx = x + 14;
  const zy = y + 10;
  const pts: [number, number][] = [
    [0, 0],
    [14, 0],
    [20, -8],
    [26, 8],
    [32, -12],
    [38, 12],
    [44, -6],
    [50, 6],
    [56, 0],
    [70, 0],
    [76, -10],
    [82, 10],
    [88, 0],
    [104, 0],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    line(zx + pts[i][0], zy + pts[i][1], zx + pts[i + 1][0], zy + pts[i + 1][1], RED);
  }
  drawText("6.9", x + w - 56, y + 4, 3, RED, true);
  // mountains below
  line(x + 14, cy + 20, cx - 30, cy - 18, INK);
  line(cx - 30, cy - 18, cx - 6, cy + 20, INK);
  line(cx - 16, cy + 20, cx + 26, cy - 26, INK);
  line(cx + 26, cy - 26, x + w - 14, cy + 20, INK);
}

const panels: Panel[] = [
  {
    kicker: "MARKETS",
    color: RED,
    title: "AI SELL-OFF DEEPENS",
    body: "S&P 500 AND DOW IN CORRECTION. NASDAQ WIPES OUT 2026 GAINS. NIKKEI -5.1%.",
    draw: iconChart,
  },
  {
    kicker: "UK & EU",
    color: NAVY,
    title: "BIGGEST POST-BREXIT DEAL",
    body: "FOOD TRADE, CARBON MARKETS, YOUTH MOBILITY FOR 100,000 BRITONS.",
    draw: iconFlags,
  },
  {
    kicker: "CLIMATE",
    color: [40, 110, 70],
    title: "CLIMATE TALKS OVERRUN",
    body: "COP31 IN ANTALYA RUNS PAST ITS DEADLINE, DEADLOCKED OVER FOSSIL FUELS.",
    draw: iconGlobe,
  },
  {
    kicker: "MIDDLE EAST",
    color: [120, 70, 20],
    title: "MISSILES OVER RIYADH",
    body: "HOUTHI MISSILES AIMED AT RIYADH INTERCEPTED FOR A THIRD NIGHT RUNNING.",
    draw: iconIntercept,
  },
  {
    kicker: "USA",
    color: NAVY,
    title: "FBI DATABASE 'HACKED'",
    body: "CRIMINAL DATABASE REPORTEDLY BREACHED AS US OUTAGES CONTINUE.",
    draw: iconShield,
  },
  {
    kicker: "HEALTH",
    color: [150, 40, 90],
    title: "PILL SHRINKS TUMOURS",
    body: "DARAXONRASIB MAKES PANCREATIC TUMOURS UNDETECTABLE IN 1 IN 12.",
    draw: iconPill,
  },
  {
    kicker: "EUROPE",
    color: [90, 40, 120],
    title: "GEN Z TAKES TO THE STREETS",
    body: "PROTESTS SPREAD ACROSS 25 EUROPEAN COUNTRIES.",
    draw: iconCrowd,
  },
  {
    kicker: "PERU",
    color: [110, 70, 30],
    title: "QUAKE SHAKES THE ANDES",
    body: "A 6.9-MAGNITUDE EARTHQUAKE STRIKES THE PERUVIAN ANDES.",
    draw: iconQuake,
  },
];

const gridY = 440;
const gridGap = 16;
const panelW = Math.floor((CW - 3 * gridGap) / 4); // 232
const panelH = 258;
panels.forEach((p, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const px0 = M + col * (panelW + gridGap);
  const py0 = gridY + row * (panelH + gridGap);
  rect(px0, py0, panelW, panelH, TINTS[i]);
  // border
  hline(px0, py0, panelW, INK, 2);
  hline(px0, py0 + panelH - 2, panelW, INK, 2);
  vline(px0, py0, panelH, INK, 2);
  vline(px0 + panelW - 2, py0, panelH, INK, 2);
  // kicker bar
  rect(px0 + 2, py0 + 2, panelW - 4, 26, p.color);
  drawText(p.kicker, px0 + 10, py0 + 8, 2, CREAM, true);
  // icon
  p.draw(px0, py0 + 30, panelW, 78);
  // title
  const titleLines = wrap(p.title, panelW - 20, 2);
  let ty = py0 + 112;
  for (const tl of titleLines.slice(0, 2)) {
    drawText(tl, px0 + 10, ty, 2, INK, true);
    ty += 20;
  }
  // body
  const bodyLines = wrap(p.body, panelW - 20, 2);
  drawBlock(bodyLines.slice(0, 5), px0 + 10, ty + 2, 2, INK, 19);
});

// ---- footer ----
const fy = gridY + 2 * panelH + gridGap + 12;
hline(M, fy, CW, INK, 2);
drawTextCentered("WIRE REPORTS, 21 NOVEMBER 2026  •  DRAWN BY CODE, NO PHOTOGRAPHS", W / 2, fy + 10, 2, GREY);

// -------------------------------------------------------------------- main
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "entry.png"), encodePNG());
