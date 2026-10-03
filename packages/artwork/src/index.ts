import type { SourceId } from '@playlist-avatar/contracts';

export interface ArtworkInput {
  id: string;
  source: SourceId;
  image: CanvasImageSource;
  width: number;
  height: number;
}

export type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
