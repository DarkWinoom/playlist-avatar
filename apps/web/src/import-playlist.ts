import { useEffect, useRef, useState } from 'react';
import { ApiErrorSchema, CollectionSchema, LIMITS } from '@playlist-avatar/contracts';
import type { Collection, ErrorCode, PublicPlatform } from '@playlist-avatar/contracts';
import { imageInfo } from '@playlist-avatar/artwork';

export interface Candidate { key: string; label: string; status: 'ready' | 'missing' | 'budget'; blob?: Blob;order?:number;statistics?:{occurrenceCount:number;playCount?:number};
  thumbnail?: Blob; url?: string; width?: number; height?: number; colors: string[] }
export interface ImportResult { collection: Collection; candidates: Candidate[] }
interface ImportState { phase: 'idle' | 'reading' | 'images' | 'ready' | 'error' | 'cancelled'; error?: ErrorCode;
  prepared: number; total: number; result?: ImportResult; pending?: ImportResult }
class ImportError extends Error { code: ErrorCode; constructor(code: ErrorCode) { super(code); this.code = code; } }
async function readError(response: Response): Promise<never> {
  const value = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  throw new ImportError(value.success ? value.data.error.code : 'INTERNAL_ERROR');
}
async function prepare(blob: Blob) {
  if (blob.size > LIMITS.remoteImageBytes) throw new ImportError('RESPONSE_TOO_LARGE');
  const info = imageInfo(new Uint8Array(await blob.slice(0, 262144).arrayBuffer()));
  if (!info || info.width <= 0 || info.height <= 0 || info.width * info.height > LIMITS.remotePixels) throw new ImportError('INVALID_IMAGE');
  const scale = Math.min(1, 128 / Math.max(info.width, info.height));
  const bitmap = await createImageBitmap(blob, { resizeWidth: Math.round(info.width * scale), resizeHeight: Math.round(info.height * scale), resizeQuality: 'high' });
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 64) { r += pixels[i]!; g += pixels[i + 1]!; b += pixels[i + 2]!; count++; }
  const color = `#${[r, g, b].map(value => Math.round(value / Math.max(1, count)).toString(16).padStart(2, '0')).join('')}`;
  const thumbnail = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new ImportError('INVALID_IMAGE')), 'image/png'));
  canvas.width = 0; canvas.height = 0;
  return { width: info.width, height: info.height, thumbnail, colors: [color], url: URL.createObjectURL(thumbnail) };
}
let decoding = Promise.resolve();
async function prepareQueued(blob: Blob, signal: AbortSignal) {
  const previous = decoding;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  decoding = previous.then(() => held);
  await previous;
  try { if (signal.aborted) throw new ImportError('CANCELLED'); return await prepare(blob); }
  finally { release(); }
}
export function usePlaylistImport() {
  const [state, setState] = useState<ImportState>({ phase: 'idle', prepared: 0, total: 0 });
  const version = useRef(0);
  const task = useRef<AbortController | undefined>(undefined);
  const retained = useRef<string[]>([]);
  useEffect(() => () => { version.current++; task.current?.abort(); retained.current.forEach(URL.revokeObjectURL); }, []);
  function cancel() { version.current++; task.current?.abort(); setState(previous => previous.phase==='reading'||previous.phase==='images'?({ ...previous, phase: 'cancelled', error: undefined }):previous); }
  async function start(input: string, source?: PublicPlatform, offset = 0) {
    return request('/api/v1/resolve',{input,source,offset});
  }
  async function request(route:string,body:unknown,token?:string) {
    const current = ++version.current; task.current?.abort();
    const controller = new AbortController(); task.current = controller;
    const created: string[] = []; let committed = false;
    setState(previous => ({ ...previous, phase: 'reading', error: undefined, pending: undefined, prepared: 0, total: 0 }));
    try {
      const headers:Record<string,string>={'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})};
      const response = await fetch(route, { method: 'POST', headers,
        body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) await readError(response);
      const collection = CollectionSchema.parse(await response.json());
      if (current !== version.current) return;
      const covers = new Map<string, { key: string; href: string; label: string }>();
      for (const track of collection.tracks) if (track.artwork && !covers.has(track.artwork.key) && covers.size < LIMITS.candidates)
        covers.set(track.artwork.key, { ...track.artwork, label: track.album || track.title });
      const work = [...covers.values()]; const candidates: Candidate[] = new Array(work.length);
      let next = 0, complete = 0, cachedBytes = 0;
      setState(previous => ({ ...previous, phase: 'images', total: work.length }));
      const workers = await Promise.allSettled(Array.from({ length: Math.min(3, work.length) }, async () => {
        while (next < work.length && current === version.current) {
          const index = next++, cover = work[index]!;
          const entries=collection.tracks.filter(t=>t.artwork?.key===cover.key),plays=entries.map(t=>t.statistics?.playCount);
          let candidate: Candidate = { key: cover.key, label: cover.label, status: 'missing', colors: [],order:entries[0]?.order,statistics:{occurrenceCount:entries.length,...(plays.every(v=>v!==undefined)?{playCount:plays.reduce<number>((sum,v)=>Math.min(Number.MAX_SAFE_INTEGER,sum+v!),0)}:{})} };
          try {
            const image = await fetch(cover.href, { headers:token?{Authorization:`Bearer ${token}`}:{},signal: controller.signal });
            if (!image.ok) throw new ImportError('IMAGE_UNAVAILABLE');
            const blob = await image.blob();
            if (cachedBytes + blob.size > LIMITS.candidateBytes / 2) candidate.status = 'budget';
            else { cachedBytes += blob.size; const prepared = await prepareQueued(blob, controller.signal); created.push(prepared.url);
              candidate = { ...candidate, ...prepared, blob, status: 'ready' }; }
          } catch { if (controller.signal.aborted) throw new ImportError('CANCELLED'); }
          candidates[index] = candidate; complete++;
          if (current === version.current) setState(previous => ({ ...previous, prepared: complete }));
        }
      }));
      if (workers.some(worker => worker.status === 'rejected')) throw new ImportError('CANCELLED');
      if (current !== version.current) return;
      if (!candidates.some(candidate => candidate.status === 'ready')) {
        setState(previous => ({ ...previous, phase: 'error', error: 'IMAGE_UNAVAILABLE', prepared: complete, total: work.length,
          pending: { collection, candidates } }));
        return;
      }
      retained.current.forEach(URL.revokeObjectURL); retained.current = created; committed = true;
      setState({ phase: 'ready', prepared: complete, total: work.length, result: { collection, candidates } });
    } catch (error) { if (current === version.current) setState(previous => ({ ...previous, phase: controller.signal.aborted ? 'cancelled' : 'error',
      error: error instanceof ImportError ? error.code : 'INTERNAL_ERROR' })); }
    finally { if (!committed) created.forEach(URL.revokeObjectURL); }
  }
  return { ...state, start, request, cancel };
}
