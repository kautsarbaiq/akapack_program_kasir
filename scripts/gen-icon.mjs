// Membuat placeholder ikon AKAPACK (1024x1024 PNG) tanpa dependensi.
// Pakai: node scripts/gen-icon.mjs  → menghasilkan app-icon.png
// Lalu: npm run tauri icon app-icon.png  (generate semua ukuran ke src-tauri/icons/)
import zlib from 'node:zlib'
import { writeFileSync } from 'node:fs'

const S = 1024
const raw = Buffer.alloc(S * (1 + S * 4)) // tiap baris diawali filter-byte 0 (sudah 0 dari alloc)

function setPx(x, y, r, g, b) {
  const i = y * (1 + S * 4) + 1 + x * 4
  raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255
}

// Navy gelap + kotak electric-blue di tengah (brand AKAPACK).
const margin = 170
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 30, g = 43, b = 74 // navy #1E2B4A
    if (x > margin && x < S - margin && y > margin && y < S - margin) {
      r = 37; g = 99; b = 235 // electric blue #2563EB
    }
    setPx(x, y, r, g, b)
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0)
  return Buffer.concat([len, t, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8; ihdr[9] = 6 // 8-bit, RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(new URL('../app-icon.png', import.meta.url), png)
console.log('✅ app-icon.png dibuat (' + png.length + ' bytes, 1024x1024)')
