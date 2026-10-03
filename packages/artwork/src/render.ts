import type { Recipe } from '@playlist-avatar/contracts';
import type { DrawingContext } from './index.ts';
import { geometry } from './geometry.ts';
import type { Tile } from './geometry.ts';
export interface RenderImage { image: CanvasImageSource; width: number; height: number }
export function cover(c: DrawingContext, image: RenderImage, x: number, y: number, width: number, height: number) {
  const ratio = Math.max(width / image.width, height / image.height), sw = width / ratio, sh = height / ratio;
  c.drawImage(image.image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, width, height);
}
export function render(c: DrawingContext, size: number, recipe: Recipe, images: Map<string, RenderImage>, tiles = geometry(recipe)) {
  c.clearRect(0, 0, size, size); c.save(); c.scale(size, size);
  const color = recipe.palette[0] || '#e7e1d5';
  const paper = `#${[1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * .2 + 244 * .8).toString(16).padStart(2, '0')).join('')}`;
  c.fillStyle = recipe.parameters[recipe.template]?.background as string || paper; c.fillRect(0, 0, 1, 1);
  drawTiles(c, tiles, images, recipe.palette);
  if (!tiles.length) { c.fillStyle = recipe.palette[0]!; c.fillRect(.15, .15, .7, .7); }
  if (recipe.titleEnabled && recipe.title) { c.fillStyle = '#111'; c.fillRect(0, .82, 1, .18); c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = '600 .065px "Segoe UI", "Microsoft YaHei", sans-serif'; c.fillText(recipe.title.slice(0, 35), .5, .92, .85); }
  c.restore();
}
function drawTiles(c: DrawingContext, tiles: Tile[], images: Map<string, RenderImage>, palette: string[]) {
  for (const [i, tile] of tiles.entries()) {
    c.save(); c.globalAlpha = tile.alpha; c.translate(tile.x, tile.y); c.rotate(tile.angle);
    if (tile.angle) { c.shadowColor = '#0005'; c.shadowBlur = 12; c.shadowOffsetY = 4; }
    c.fillStyle = palette[i % palette.length]!;
    c.beginPath(); c.roundRect(-tile.width / 2, -tile.height / 2, tile.width, tile.height, tile.radius); c.fill();
    c.shadowBlur = 0; c.shadowOffsetY = 0; c.clip(); const image = images.get(tile.id);
    if (image) cover(c, image, -tile.width / 2, -tile.height / 2, tile.width, tile.height);
    c.restore();
  }
}
