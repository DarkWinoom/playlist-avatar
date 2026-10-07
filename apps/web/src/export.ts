import ExportWorker from './export.worker.ts?worker';
import{recipeAssets}from'@playlist-avatar/contracts';
import type { ArtworkAsset, ExportOptions, Recipe } from '@playlist-avatar/contracts';
export async function exportArtwork(recipe: Recipe, assets: Record<string, ArtworkAsset>, options: ExportOptions, signal?:AbortSignal) {
  if(signal?.aborted)throw new Error('CANCELLED');
  const snapshot = structuredClone(recipe), selected = recipeAssets(snapshot).map(id => assets[id]).filter((value): value is ArtworkAsset => !!value), settings=structuredClone(options);
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    const { renderExport } = await import('./export-render.ts'); return renderExport(snapshot, selected, settings, 'auto', signal);
  }
  const worker = new ExportWorker();
  try { return await new Promise<Blob>((resolve, reject) => {
    let done=false;const finish=(blob?:Blob,error?:string)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);blob?resolve(blob):reject(new Error(error||'INTERNAL_ERROR'));},abort=()=>finish(undefined,'CANCELLED');
    const timer = setTimeout(() => finish(undefined,'UPSTREAM_TIMEOUT'), 20000);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => finish(event.data.blob,event.data.error);
    worker.onerror = () => finish(undefined,'INTERNAL_ERROR');try{worker.postMessage({ recipe: snapshot, assets: selected, options:settings });}catch{finish(undefined,'INTERNAL_ERROR');}
  }); } finally { worker.terminate(); }
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
