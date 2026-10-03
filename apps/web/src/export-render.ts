import { render, imageInfo, imageProjections } from '@playlist-avatar/artwork';
import type { RenderImage } from '@playlist-avatar/artwork';
import type { ArtworkAsset, ExportOptions, Recipe } from '@playlist-avatar/contracts';
import { canvasBlob } from './assets.ts';

export async function renderExport(recipe: Recipe, assets: ArtworkAsset[], options: ExportOptions) {
  const images = new Map<string, RenderImage>();
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(options.size, options.size) : document.createElement('canvas');
  canvas.width = canvas.height = options.size;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error('UNSUPPORTED_FORMAT');
  try {
    const projections = imageProjections(recipe, options.size);
    for (const asset of assets) {
      const dimension = projections.get(asset.id); if (!dimension) continue;
      const ratio = Math.min(1, dimension / Math.max(asset.width, asset.height));
      const image = await createImageBitmap(asset.blob, { resizeWidth: Math.max(1, Math.round(asset.width * ratio)), resizeHeight: Math.max(1, Math.round(asset.height * ratio)), resizeQuality: 'high' });
      images.set(asset.id, { image, width: image.width, height: image.height });
    }
    render(context, options.size, recipe, images);
    if (options.circle) { context.globalCompositeOperation = 'destination-in'; context.beginPath(); context.arc(options.size / 2, options.size / 2, options.size / 2, 0, Math.PI * 2); context.fill(); context.globalCompositeOperation = 'source-over'; }
    if (options.format === 'image/jpeg' || !options.transparent) { context.globalCompositeOperation = 'destination-over'; context.fillStyle = options.background; context.fillRect(0, 0, options.size, options.size); context.globalCompositeOperation = 'source-over'; }
    const blob = 'convertToBlob' in canvas ? await canvas.convertToBlob({ type: options.format, quality: options.quality }) : await canvasBlob(canvas, options.format, options.quality);
    const info = imageInfo(new Uint8Array(await blob.slice(0, 262144).arrayBuffer()));
    if (blob.type !== options.format || !info || info.type !== options.format || info.width !== options.size || info.height !== options.size) throw new Error('UNSUPPORTED_FORMAT');
    return blob;
  } finally { images.forEach(value => (value.image as ImageBitmap).close()); canvas.width = canvas.height = 0; }
}
