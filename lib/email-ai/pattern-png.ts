import { unzlibSync, zlibSync } from "fflate";

// Worker-compatible PNG processing. Never remove a colour: white may belong to
// the ornament. Only genuine alpha is accepted and transparent margins trimmed.
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes: Uint8Array) { let n = 0xffffffff; for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8); return (n ^ 0xffffffff) >>> 0; }
function concat(parts: Uint8Array[]) { const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0; for (const p of parts) { bytes.set(p, offset); offset += p.length; } return bytes; }
function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(data.length + 12); const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length); bytes.set(new TextEncoder().encode(type), 4); bytes.set(data, 8);
  view.setUint32(data.length + 8, crc(bytes.subarray(4, data.length + 8))); return bytes;
}
export function encodeRgbaPng(width: number, height: number, rgba: Uint8Array) {
  const header = new Uint8Array(13); const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6;
  const scan = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) scan.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return concat([signature, chunk("IHDR", header), chunk("IDAT", zlibSync(scan, { level: 6 })), chunk("IEND", new Uint8Array())]);
}
export function transparentPatternPng(bytes: Uint8Array) {
  const fail = () => { throw new Error("Нужен PNG-орнамент с настоящей прозрачностью и горизонтальной композицией."); };
  if (bytes.length < 33 || bytes.length > 10 * 1024 * 1024 || signature.some((v, i) => bytes[i] !== v)) return fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  // Image provider contract: non-interlaced 8-bit RGBA. Unknown formats fail closed.
  if (!width || !height || width * height > 4_194_304 || bytes[24] !== 8 || bytes[25] !== 6 || bytes[26] || bytes[27] || bytes[28]) return fail();
  const parts: Uint8Array[] = []; let ended = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset); if (offset + length + 12 > bytes.length) return fail();
    const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    if (crc(bytes.subarray(offset + 4, offset + length + 8)) !== view.getUint32(offset + length + 8)) return fail();
    if (type === "IDAT") parts.push(bytes.subarray(offset + 8, offset + length + 8));
    if (type === "IEND") { ended = true; break; }
    offset += length + 12;
  }
  if (!ended || !parts.length) return fail();
  const stride = width * 4; const expected = height * (stride + 1);
  const scan = unzlibSync(concat(parts), { out: new Uint8Array(expected + 1) });
  if (scan.length !== expected) return fail();
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = scan[y * (stride + 1)]; if (filter > 4) return fail();
    for (let x = 0; x < stride; x++) {
      const pos = y * stride + x; const a = x >= 4 ? rgba[pos - 4] : 0, b = y ? rgba[pos - stride] : 0, c = y && x >= 4 ? rgba[pos - stride - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? pa <= pb && pa <= pc ? a : pb <= pc ? b : c : 0;
      rgba[pos] = (scan[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  let left = width, right = -1, top = height, bottom = -1, clear = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = rgba[(y * width + x) * 4 + 3];
    if (alpha === 0) clear++;
    else { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (right < 0 || clear / (width * height) < 0.25) return fail();
  if ((right - left + 1) / (bottom - top + 1) < 3) return fail();
  let innerClear = 0;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (rgba[(y * width + x) * 4 + 3] === 0) innerClear++;
  // A white rectangle on a transparent canvas is still a background, not an overlay.
  if (innerClear / ((right - left + 1) * (bottom - top + 1)) < 0.35) return fail();
  const pad = Math.max(2, Math.round(width * 0.01));
  left = Math.max(0, left - pad); right = Math.min(width - 1, right + pad); top = Math.max(0, top - pad); bottom = Math.min(height - 1, bottom + pad);
  const w = right - left + 1, h = bottom - top + 1; const cropped = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) cropped.set(rgba.subarray(((y + top) * width + left) * 4, ((y + top) * width + right + 1) * 4), y * w * 4);
  return { bytes: encodeRgbaPng(w, h, cropped), width: w, height: h, transparentFraction: clear / (width * height) };
}
