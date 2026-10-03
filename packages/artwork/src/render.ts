import type { Recipe } from '@playlist-avatar/contracts';
import type { DrawingContext } from './index.ts';
import { geometry, parameter, seeded } from './geometry.ts';
import type { Tile } from './geometry.ts';
import { generated } from './generated.ts';
import { printed } from './print.ts';
import { CATALOG } from './catalog.ts';
let materials: typeof import('./materials.ts') | undefined;
export async function prepareRenderer(template: Recipe['template']) {
  if (CATALOG.find(item => item.id === template)!.group === 3) materials ??= await import('./materials.ts');
}
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
  if (recipe.template === 'disc') {
    const radius=parameter(recipe,'scale',65)/200,x=parameter(recipe,'offset',55)/100+(seeded(recipe.seed)()-.5)*.04;
    const gradient=c.createRadialGradient(x-.1,.4,.03,x,.5,radius);gradient.addColorStop(0,'#4c5055');gradient.addColorStop(.5,'#111318');gradient.addColorStop(1,'#050609');c.fillStyle=gradient;c.beginPath();c.arc(x,.5,radius,0,Math.PI*2);c.fill();
    c.strokeStyle=`rgba(210,218,230,${parameter(recipe,'texture',55)/500})`;c.lineWidth=.0015;for(let r=.06;r<radius;r+=.007){c.beginPath();c.arc(x,.5,r,0,Math.PI*2);c.stroke();}
    c.fillStyle=recipe.palette[0]!;c.beginPath();c.arc(x,.5,.07,0,Math.PI*2);c.fill();c.fillStyle='#f4f2ed';c.beginPath();c.arc(x,.5,.008,0,Math.PI*2);c.fill();
  }
  if (recipe.template === 'film') { c.fillStyle='#21241f';c.fillRect(0,0,1,1);c.filter=`brightness(${.6+parameter(recipe,'exposure',50)/100})`; }
  const group=CATALOG.find(item=>item.id===recipe.template)!.group;
  if(group===0||recipe.template==='film') drawTiles(c,tiles,images,recipe.palette,size);
  c.filter='none';
  if(group===1) printed(c,recipe,images);
  if(group===2) generated(c,recipe);
  if(group===3) { if (!materials) throw new Error('Renderer not prepared'); materials.renderMaterial(c,recipe,images,size); }
  if (!tiles.length && group===0) { c.fillStyle = recipe.palette[0]!; c.fillRect(.15, .15, .7, .7); }
  if (recipe.titleEnabled && recipe.title) { c.fillStyle = '#111'; c.fillRect(0, .82, 1, .18); c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = '600 .065px "Segoe UI", "Microsoft YaHei", sans-serif'; c.fillText(recipe.title.slice(0, 35), .5, .92, .85); }
  c.restore();
}
function drawTiles(c: DrawingContext, tiles: Tile[], images: Map<string, RenderImage>, palette: string[], size:number) {
  for (const [i, tile] of tiles.entries()) {
    c.save(); c.globalAlpha = tile.alpha; c.translate(tile.x, tile.y); c.rotate(tile.angle);
    if (tile.angle) { c.shadowColor = '#0005'; c.shadowBlur = size*.02; c.shadowOffsetY = size*.005; }
    c.fillStyle = palette[i % palette.length]!;
    c.beginPath(); c.roundRect(-tile.width / 2, -tile.height / 2, tile.width, tile.height, tile.radius); c.fill();
    c.shadowBlur = 0; c.shadowOffsetY = 0; c.clip(); const image = images.get(tile.id);
    if (image) cover(c, image, -tile.width / 2, -tile.height / 2, tile.width, tile.height);
    c.restore();
  }
}
