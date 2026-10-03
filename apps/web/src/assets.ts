import { LIMITS } from '@playlist-avatar/contracts';
import type { ArtworkAsset } from '@playlist-avatar/contracts';
import { imageInfo } from '@playlist-avatar/artwork';

let decoding = Promise.resolve();
export async function normalizeAsset(blob: Blob, label: string, local = false, sourceKey?: string): Promise<ArtworkAsset> {
  if (blob.size > (local ? LIMITS.localImageBytes : LIMITS.remoteImageBytes)) throw new Error('RESPONSE_TOO_LARGE');
  const info = imageInfo(new Uint8Array(await blob.slice(0, 262144).arrayBuffer()));
  if (!info || info.width < 1 || info.height < 1 || info.width * info.height > (local ? LIMITS.localPixels : LIMITS.remotePixels)) throw new Error('INVALID_IMAGE');
  const previous = decoding; let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }); decoding = previous.then(() => held);
  await previous;
  try {
    const scale = Math.min(1, 2048 / Math.max(info.width, info.height));
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: Math.max(1, Math.round(info.width * scale)),
      resizeHeight: Math.max(1, Math.round(info.height * scale)), resizeQuality: 'high' });
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    try {
      const context = canvas.getContext('2d'); if (!context) throw new Error('INVALID_IMAGE');
      context.drawImage(bitmap, 0, 0); bitmap.close();
      const normalized = await canvasBlob(canvas);
      const width = canvas.width, height = canvas.height;
      canvas.width = Math.max(1, Math.round(width * Math.min(1, 128 / Math.max(width, height))));
      canvas.height = Math.max(1, Math.round(height * Math.min(1, 128 / Math.max(width, height))));
      const small = await createImageBitmap(normalized, { resizeWidth: canvas.width, resizeHeight: canvas.height });
      context.drawImage(small, 0, 0); small.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const bins = new Map<string, number>();
      for (let i = 0; i < pixels.length; i += 16) if (pixels[i + 3]! > 128) {
        const color = `#${[pixels[i]!, pixels[i + 1]!, pixels[i + 2]!].map(v => (Math.min(255, Math.round(v / 32) * 32)).toString(16).padStart(2, '0')).join('')}`;
        bins.set(color, (bins.get(color) || 0) + 1);
      }
      const colors = [...bins].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([color]) => color);
      const thumbnail = await canvasBlob(canvas);
      const fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await normalized.arrayBuffer()))].map(v => v.toString(16).padStart(2, '0')).join('');
      return { id: `asset:${fingerprint}`, fingerprint, blob: normalized, thumbnail, width, height, bytes: normalized.size,
        label: label.slice(0, 200), colors, sourceKey, createdAt: new Date().toISOString() };
    } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
  } finally { release(); }
}
export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('UNSUPPORTED_FORMAT')), type, quality));
}
export async function originalAssets(): Promise<ArtworkAsset[]> {
  const colors = [['#d66641', '#efc686'], ['#456f8c', '#eee8d2'], ['#233d31', '#d1cbb7'], ['#ddbb73', '#405944']];
  const assets: ArtworkAsset[] = [];
  for (const [i, pair] of colors.entries()) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d')!; c.fillStyle = pair[0]!; c.fillRect(0, 0, 512, 512); c.fillStyle = pair[1]!;
    if (i === 0) { c.beginPath(); c.arc(256, 256, 190, 0, Math.PI * 2); c.fill(); }
    if (i === 1) { c.lineWidth = 56; c.strokeStyle = pair[1]!; c.beginPath(); c.ellipse(256, 420, 170, 300, -.3, 0, Math.PI * 2); c.stroke(); }
    if (i === 2) for (let r = 40; r < 720; r += 70) { c.lineWidth = 9; c.strokeStyle = pair[1]!; c.beginPath(); c.arc(0, 512, r, 0, Math.PI * 2); c.stroke(); }
    if (i === 3) { c.beginPath(); c.arc(512, 512, 350, 0, Math.PI * 2); c.fill(); }
    assets.push(await normalizeAsset(await canvasBlob(canvas), `Original ${i + 1}`, true)); canvas.width = canvas.height = 0;
  }
  return assets;
}
