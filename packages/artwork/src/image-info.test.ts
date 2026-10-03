import { describe, expect, it } from 'vitest';
import { imageInfo } from './image-info.ts';
function header() {
  const bytes = new Uint8Array(33), view = new DataView(bytes.buffer);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); view.setUint32(8, 13); bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, 1024); view.setUint32(20, 512); return bytes;
}
describe('raster size preflight', () => {
  it('reads dimensions only from a PNG IHDR', () => {
    expect(imageInfo(header())).toEqual({ type: 'image/png', width: 1024, height: 512 });
    const wrongType = header(); wrongType.set([73, 68, 65, 84], 12); expect(imageInfo(wrongType)).toBeUndefined();
    const wrongLength = header(); new DataView(wrongLength.buffer).setUint32(8, 1); expect(imageInfo(wrongLength)).toBeUndefined();
    expect(imageInfo(header().slice(0, 24))).toBeUndefined();
  });
  it('does not classify HTML or SVG as raster images', () => {
    expect(imageInfo(new TextEncoder().encode('<svg width="4000" height="4000"></svg>'))).toBeUndefined();
    expect(imageInfo(new TextEncoder().encode('<html>not an image</html>'))).toBeUndefined();
  });
  it('uses oriented JPEG dimensions and ignores an out-of-range EXIF directory', () => {
    const bytes = new Uint8Array(50), view = new DataView(bytes.buffer);
    bytes.set([255,216,255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0,255,192,0,11,8,0,10,0,20,3,1,0]);
    expect(imageInfo(bytes)).toEqual({ type: 'image/jpeg', width: 10, height: 20 });
    view.setUint32(16, 0xffffffff, true);
    expect(imageInfo(bytes)).toEqual({ type: 'image/jpeg', width: 20, height: 10 });
  });
});
