const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function createIconPng(width, height, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crcVal = zlib.crc32(Buffer.concat([t, data]));
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crcVal >>> 0);
    return Buffer.concat([len, t, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = 1 + width * 3;
  const rawData = Buffer.alloc(rowLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.5 : 0.44);

  // Background: #0f172a (15, 23, 42)
  // Inner box / badge: #1d4ed8 (29, 78, 216) -> #3b82f6 (59, 130, 246)
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowLength;
    rawData[rowStart] = 0;

    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default dark navy background
      let r = 15;
      let g = 23;
      let b = 42;

      // Central circular / rounded emblem
      if (dist < radius) {
        // Subtle radial gradient
        const factor = dist / radius;
        r = Math.round(20 + 10 * (1 - factor));
        g = Math.round(30 + 15 * (1 - factor));
        b = Math.round(55 + 25 * (1 - factor));

        // Center stylized logistics diamond / box
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const boxSize = width * 0.22;

        if (absX + absY < boxSize) {
          // Inner logistics box #3b82f6 (59, 130, 246)
          r = 59;
          g = 130;
          b = 246;

          // Inner white core arrow
          if (absX < width * 0.08 && absY < height * 0.04) {
            r = 255;
            g = 255;
            b = 255;
          }
        }
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
    }
  }

  const idat = zlib.deflateSync(rawData);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const iconsDir = path.resolve(__dirname, '../../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), createIconPng(192, 192, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), createIconPng(512, 512, false));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192x192.png'), createIconPng(192, 192, true));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512x512.png'), createIconPng(512, 512, true));

console.log('PWA icons successfully generated in public/icons/');
