import { useEffect, useRef, useState } from 'react';
import { geometry, interpolateTiles, render, imageProjections } from '@playlist-avatar/artwork';
import type { RenderImage, Tile } from '@playlist-avatar/artwork';
import type { ArtworkAsset, Recipe } from '@playlist-avatar/contracts';

export function ArtworkCanvas({ recipe, assets, reduce, circle, direct = false }: { recipe: Recipe; assets: Record<string, ArtworkAsset>; reduce: boolean; circle: boolean; direct?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), holder = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(640), [images, setImages] = useState(new Map<string, RenderImage>());
  const visible = useRef<Tile[]>([]); const lastTemplate = useRef(recipe.template);
  const projections = imageProjections(recipe, size), projectionKey = [...projections].map(([id, value]) => `${id}:${value}`).join('|');
  useEffect(() => { const element = holder.current!;
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width || 320; setSize(Math.min(1280, Math.max(256, Math.round(width * Math.min(2, window.devicePixelRatio))))); });
    observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => {
    let obsolete = false, committed = false; const prepared = new Map<string, RenderImage>();
    void (async () => {
      try {
        for (const [id, projection] of projections) { const asset = assets[id]; if (!asset) continue;
          const scale = Math.min(1, projection / Math.max(asset.width, asset.height));
          const image = await createImageBitmap(asset.blob, { resizeWidth: Math.max(1, Math.round(asset.width * scale)), resizeHeight: Math.max(1, Math.round(asset.height * scale)), resizeQuality: 'high' });
          if (obsolete) { image.close(); break; } prepared.set(id, { image, width: image.width, height: image.height });
        }
        if (!obsolete) { committed = true; setImages(prepared); }
      } catch { prepared.forEach(value => (value.image as ImageBitmap).close()); }
    })();
    return () => { obsolete = true; if (!committed) prepared.forEach(value => (value.image as ImageBitmap).close()); };
  }, [projectionKey, assets]);
  useEffect(() => {
    const element = canvas.current!, context = element.getContext('2d'); if (!context) return;
    element.width = element.height = size;
    const start = visible.current, target = geometry(recipe); let frame = 0;
    const immediate = reduce || direct || !start.length || document.hidden;
    const since = performance.now(); lastTemplate.current = recipe.template;
    const draw = (now: number) => {
      const progress = immediate ? 1 : Math.min(1, (now - since) / 280), ease = 1 - Math.pow(1 - progress, 3);
      const tiles = interpolateTiles(start, target, ease); visible.current = tiles;
      render(context, size, recipe, images, tiles);
      if (progress < 1 && !document.hidden) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [recipe, size, images, reduce, direct]);
  useEffect(() => () => images.forEach(value => (value.image as ImageBitmap).close()), [images]);
  return <div ref={holder} className={`artwork-canvas${circle ? ' circle' : ''}`}><canvas ref={canvas} role="img" aria-label={`${recipe.template} artwork`} /></div>;
}
