export interface ImageInfo { type: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number }
export function imageInfo(bytes: Uint8Array): ImageInfo | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    && view.getUint32(8) === 13 && ascii(12, 4) === 'IHDR')
    return { type: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8X' && bytes.length >= 30) return { type: 'image/webp',
      width: 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16), height: 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16) };
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42)
      return { type: 'image/webp', width: view.getUint16(26, true) & 16383, height: view.getUint16(28, true) & 16383 };
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) return { type: 'image/webp',
      width: 1 + bytes[21]! + ((bytes[22]! & 63) << 8), height: 1 + (bytes[22]! >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 15) << 10) };
  }
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let index = 2, orientation = 1;
    while (index + 3 < bytes.length) {
      if (bytes[index] !== 255) return;
      const marker = bytes[index + 1]!;
      if (marker === 255) { index++; continue; }
      if (marker === 217 || marker === 218) return;
      if (marker === 1 || (marker >= 208 && marker <= 215)) { index += 2; continue; }
      const length = view.getUint16(index + 2);
      if (length < 2) return;
      if (marker === 225 && index + length + 2 <= bytes.length && ascii(index + 4, 6) === 'Exif\0\0') {
        const start = index + 10, end = index + length + 2;
        if (start + 8 <= end) {
          const little = ascii(start, 2) === 'II', valid = little || ascii(start, 2) === 'MM';
          if (valid && view.getUint16(start + 2, little) === 42) {
            const ifd = start + view.getUint32(start + 4, little);
            if (ifd >= start && ifd + 2 <= end) {
              const entries = Math.min(256, view.getUint16(ifd, little));
              for (let i = 0; i < entries; i++) { const tag = ifd + 2 + i * 12; if (tag + 12 > end) break;
                if (view.getUint16(tag, little) === 274 && view.getUint16(tag + 2, little) === 3 && view.getUint32(tag + 4, little) === 1) {
                  const value = view.getUint16(tag + 8, little); if (value >= 1 && value <= 8) orientation = value;
                }
              }
            }
          }
        }
      }
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (index + 8 >= bytes.length) return;
        const width = view.getUint16(index + 7), height = view.getUint16(index + 5);
        return { type: 'image/jpeg', width: orientation >= 5 ? height : width, height: orientation >= 5 ? width : height };
      }
      index += 2 + length;
    }
  }
}
