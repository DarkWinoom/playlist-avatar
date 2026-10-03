import type { SourceId } from '@playlist-avatar/contracts';
export { imageInfo } from './image-info.ts';
export type { ImageInfo } from './image-info.ts';
export { geometry, interpolateTiles, seeded, parameter, imageProjections } from './geometry.ts';
export type { Tile } from './geometry.ts';
export { render, cover, prepareRenderer } from './render.ts';
export type { RenderImage } from './render.ts';
export { CATALOG, FEATURED, controlsFor } from './catalog.ts';
export type { Control } from './catalog.ts';

export interface ArtworkInput {
  id: string;
  source: SourceId;
  image: CanvasImageSource;
  width: number;
  height: number;
}

export type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
