import { useEffect, useRef, useState } from 'react';
import { geometry, interpolateTiles, render, imageProjections, prepareRenderer, CATALOG } from '@playlist-avatar/artwork';
import type { RenderImage, Tile } from '@playlist-avatar/artwork';
import type { ArtworkAsset, Recipe } from '@playlist-avatar/contracts';
import type { TemplateId } from '@playlist-avatar/contracts';

export function ArtworkCanvas({ recipe, assets, reduce, circle, direct = false, checks = false }: { recipe: Recipe; assets: Record<string, ArtworkAsset>; reduce: boolean; circle: boolean; direct?: boolean; checks?:boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), holder = useRef<HTMLDivElement>(null);
  const small=useRef<(HTMLCanvasElement|null)[]>([]);
  const [size, setSize] = useState(640), [images, setImages] = useState(new Map<string, RenderImage>());
  const [ready, setReady] = useState<TemplateId>();
  const painted=useRef(false);
  const visible = useRef<Tile[]>([]); const lastTemplate = useRef(recipe.template);
  const projections = imageProjections(recipe, size), projectionKey = [...projections].map(([id, value]) => `${id}:${value}`).join('|');
  useEffect(() => { const element = holder.current!;
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width || 320; setSize(Math.min(1280, Math.max(256, Math.round(width * Math.min(2, window.devicePixelRatio))))); });
    observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => {
    let obsolete = false, committed = false; const prepared = new Map<string, RenderImage>();
    void (async () => {
      try {
        await prepareRenderer(recipe.template); if(obsolete) return;
        for (const [id, projection] of projections) { const asset = assets[id]; if (!asset) continue;
          const scale = Math.min(1, projection / Math.max(asset.width, asset.height));
          const image = await createImageBitmap(asset.blob, { resizeWidth: Math.max(1, Math.round(asset.width * scale)), resizeHeight: Math.max(1, Math.round(asset.height * scale)), resizeQuality: 'high' });
          if (obsolete) { image.close(); break; } prepared.set(id, { image, width: image.width, height: image.height });
        }
        if (!obsolete) { committed = true; setImages(prepared); setReady(recipe.template); }
      } catch { prepared.forEach(value => (value.image as ImageBitmap).close()); }
    })();
    return () => { obsolete = true; if (!committed) prepared.forEach(value => (value.image as ImageBitmap).close()); };
  }, [projectionKey, assets, recipe.template]);
  useEffect(() => {
    const element = canvas.current!, context = element.getContext('2d'); if (!context || ready!==recipe.template) return;
    const crossing=CATALOG.find(item=>item.id===lastTemplate.current)!.group!==0||CATALOG.find(item=>item.id===recipe.template)!.group!==0;
    const previous=document.createElement('canvas');previous.width=previous.height=element.width;if(crossing)previous.getContext('2d')?.drawImage(element,0,0);
    element.width = element.height = size;
    const start = visible.current, target = geometry(recipe); let frame = 0;
    const immediate = reduce || direct || !painted.current || document.hidden;
    const since = performance.now(); lastTemplate.current = recipe.template;
    const draw = (now: number) => {
      const progress = immediate || document.hidden ? 1 : Math.min(1, (now - since) / 280), ease = 1 - Math.pow(1 - progress, 3);
      const tiles = interpolateTiles(start, target, ease); visible.current = tiles;
      render(context, size, recipe, images, tiles);
      painted.current=true;
      if(crossing&&progress<1){context.globalAlpha=1-progress;context.drawImage(previous,0,0,size,size);context.globalAlpha=1;}
      if(checks)small.current.forEach(check=>{if(check){const c=check.getContext('2d');c?.clearRect(0,0,check.width,check.height);c?.drawImage(element,0,0,check.width,check.height);}});
      if (progress < 1 && !document.hidden) frame = requestAnimationFrame(draw);
      else previous.width=previous.height=0;
    };
    const visibility=()=>{cancelAnimationFrame(frame);draw(performance.now());};document.addEventListener('visibilitychange',visibility);
    frame = requestAnimationFrame(draw); return () => { cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);previous.width=previous.height=0; };
  }, [recipe, size, images, reduce, direct, ready, checks]);
  useEffect(() => () => images.forEach(value => (value.image as ImageBitmap).close()), [images]);
  return <><div ref={holder} className={`artwork-canvas${circle ? ' circle' : ''}`} aria-busy={ready!==recipe.template}><canvas ref={canvas} role="img" aria-label={`${recipe.template} artwork`} /></div>{checks&&<div className="avatar-checks">{[48,96].map((value,i)=><div key={value}><canvas ref={element=>{small.current[i]=element;}} width={value} height={value} role="img" aria-label={`${value}px avatar`} /><small>{value}px</small></div>)}</div>}</>;
}
