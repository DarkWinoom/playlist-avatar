import type { ArtworkAsset, ExportOptions, Recipe } from '@playlist-avatar/contracts';
import { renderExport } from './export-render.ts';
const worker = self as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (value: unknown) => void };
worker.onmessage = async (event: MessageEvent<{ recipe: Recipe; assets: ArtworkAsset[]; options: ExportOptions }>) => {
  try { worker.postMessage({ blob: await renderExport(event.data.recipe, event.data.assets, event.data.options) }); }
  catch (error) { worker.postMessage({ error: error instanceof Error ? error.message : 'INTERNAL_ERROR' }); }
};
