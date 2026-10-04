import ExportWorker from './export.worker.ts?worker';
import{recipeAssets}from'@playlist-avatar/contracts';
import type { ArtworkAsset, ExportOptions, Recipe } from '@playlist-avatar/contracts';
export async function exportArtwork(recipe: Recipe, assets: Record<string, ArtworkAsset>, options: ExportOptions) {
  const snapshot = structuredClone(recipe), selected = recipeAssets(snapshot).map(id => assets[id]).filter((value): value is ArtworkAsset => !!value);
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    const { renderExport } = await import('./export-render.ts'); return renderExport(snapshot, selected, options);
  }
  const worker = new ExportWorker();
  try { return await new Promise<Blob>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('UPSTREAM_TIMEOUT')), 20000);
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => { clearTimeout(timer); event.data.blob ? resolve(event.data.blob) : reject(new Error(event.data.error || 'INTERNAL_ERROR')); };
    worker.onerror = () => { clearTimeout(timer); reject(new Error('INTERNAL_ERROR')); }; worker.postMessage({ recipe: snapshot, assets: selected, options });
  }); } finally { worker.terminate(); }
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
