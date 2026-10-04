import type { Recipe } from '@playlist-avatar/contracts';
import { CATALOG } from './catalog.ts';
import {LIMITS}from'@playlist-avatar/contracts';
export interface Tile { id: string; x: number; y: number; width: number; height: number; angle: number; radius: number; alpha: number }
export function parameter(recipe: Recipe, key: string, fallback: number) {
  const value = recipe.parameters[recipe.template]?.[key], control = CATALOG.find(t => t.id === recipe.template)?.controls.find(c => c.key === key);
  return typeof value === 'number' ? Math.max(control?.min ?? -100, Math.min(control?.max ?? 100, value)) : fallback;
}
export function geometry(recipe: Recipe): Tile[] {
  const ids = [...recipe.assetIds];
  if(recipe.seed!==1701){const random=seeded(recipe.seed);for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j]!,ids[i]!];}}
  if(recipe.template==='duo'){const balance=parameter(recipe,'balance',50)/100,gap=parameter(recipe,'gap',6)/200,tilt=parameter(recipe,'tilt',12)/100;return ids.slice(0,2).map((id,i)=>({id,x:i?balance+(1-balance)/2:balance/2,y:i?.55:.45,width:(i?1-balance:balance)-gap,height:.78,angle:i?-tilt:tilt,radius:.012,alpha:1}));}
  if(recipe.template==='focus')return ids.slice(0,2).map((id,i)=>{const inset=parameter(recipe,'inset',30)/100,offset=parameter(recipe,'offset',60)/100;return{id,x:i?.65+offset*.15:.43,y:i?.63+offset*.16:.45,width:i?inset:.7,height:i?inset:.78,angle:0,radius:parameter(recipe,'radius',12)/500,alpha:1};});
  if(recipe.template==='contact'){const n=Math.round(parameter(recipe,'columns',3)),gap=parameter(recipe,'gap',5)/100,cell=(1-gap*(n+1))/n;return ids.slice(0,n*n).map((id,i)=>({id,x:gap+cell/2+i%n*(cell+gap),y:gap+cell/2+Math.floor(i/n)*(cell+gap),width:cell,height:cell*.86,angle:0,radius:0,alpha:1}));}
  if(recipe.template==='strips'){const n=Math.min(ids.length,Math.round(parameter(recipe,'count',4))),stagger=parameter(recipe,'stagger',50)/100;return ids.slice(0,n).map((id,i)=>({id,x:(i+.5)/n,y:.5+Math.sin(i*2.3)*stagger*.08,width:.82/n,height:.62+stagger*.12,angle:parameter(recipe,'tilt',5)/100,radius:0,alpha:1}));}
  if (recipe.template === 'sleeve') {
    const spread = parameter(recipe, 'spread', 55) / 100, tilt = parameter(recipe, 'rotation', 0) / 100;
    return ids.slice(0, Math.round(parameter(recipe, 'count', 5))).map((id, i, all) => ({ id, x: .5 + (i - (all.length - 1) / 2) * .08 * spread,
      y: .56 + Math.abs(i - (all.length - 1) / 2) * .015, width: .62, height: .62,
      angle: (i - (all.length - 1) / 2) * .24 * spread + tilt, radius: .005, alpha: 1 }));
  }
  if (recipe.template === 'disc') return ids.slice(0, 1).map(id => ({ id, x:.34, y:.5, width:.56, height:.56, angle:-.12, radius:.008, alpha:1 }));
  if (recipe.template === 'wall') {
    const count = Math.round(parameter(recipe,'density',12)), perspective = parameter(recipe,'perspective',60)/100;
    const focus = Math.round(parameter(recipe,'focus',0)) % Math.max(1,ids.length), ordered = [...ids.filter((_,i)=>i!==focus), ...(ids[focus] ? [ids[focus]!] : [])];
    return ordered.slice(-count).map((id,i,all) => { if(i===all.length-1) return {id,x:.5,y:.5,width:.48,height:.48,angle:0,radius:.005,alpha:1};
      const angle = i / Math.max(1,all.length-1)*Math.PI*2, radius=.32+perspective*.07;
      return {id,x:.5+Math.cos(angle)*radius,y:.5+Math.sin(angle)*radius,width:.2+perspective*.03,height:.25,angle:Math.cos(angle)*perspective*.35,radius:.005,alpha:1}; });
  }
  if (recipe.template === 'film') return ids.slice(0, Math.round(parameter(recipe,'frames',3))).map((id,i,all)=>({id,x:.5,y:(i+.5)/all.length,width:.7,height:.8/all.length,angle:0,radius:.003,alpha:1}));
  if (recipe.template === 'halftone') return ids.slice(0,1).map(id=>({id,x:.5,y:.5,width:1,height:1,angle:0,radius:0,alpha:1}));
  if (recipe.template === 'glass'){const phase=recipe.materialPhase*Math.PI*2+seeded(recipe.seed)()*Math.PI*2;return ids.slice(0,Math.round(parameter(recipe,'layers',3))).map((id,i,all)=>({id,x:.5+(i-(all.length-1)/2)*.09+Math.sin(phase)*.02,y:.5+(i-(all.length-1)/2)*.06,width:.6,height:.68,angle:(i-(all.length-1)/2)*.12,radius:parameter(recipe,'radius',45)/500,alpha:1}));}
  if (recipe.template !== 'mosaic') return [];
  const columns = Math.max(1, Math.min(4, Math.round(parameter(recipe, 'layout', Math.ceil(Math.sqrt(Math.max(1, ids.length)))))));
  const gap = parameter(recipe, 'gap', 3) / 200, radius = parameter(recipe, 'radius', 0) / 300;
  const cell = (1 - gap * (columns + 1)) / columns;
  return ids.slice(0, columns * columns).map((id, i) => ({ id, x: gap + cell / 2 + (i % columns) * (cell + gap),
    y: gap + cell / 2 + Math.floor(i / columns) * (cell + gap), width: cell, height: cell, angle: 0, radius, alpha: 1 }));
}
export function interpolateTiles(from: Tile[], to: Tile[], amount: number): Tile[] {
  amount = Math.max(0, Math.min(1, amount));
  const old = new Map(from.map(tile => [tile.id, tile]));
  return to.map(target => { const start = old.get(target.id) || { ...target, alpha: 0 }; const tile = { ...target };
    for (const field of ['x', 'y', 'width', 'height', 'angle', 'radius', 'alpha'] as const) tile[field] = start[field] + (target[field] - start[field]) * amount;
    return tile; });
}
export function imageProjections(recipe: Recipe, size: number) {
  const result = new Map<string, number>();
  for (const tile of geometry(recipe)) result.set(tile.id, Math.min(size, Math.ceil(Math.max(tile.width, tile.height) * size * (recipe.imageFrames?.[tile.id]?.zoom||1) / 128) * 128));
  const bytes=[...result.values()].reduce((sum,dimension)=>sum+dimension*dimension*4,0),ratio=Math.min(1,Math.sqrt((LIMITS.bitmapBytes/2)/Math.max(1,bytes)));
  if(ratio<1)for(const[id,dimension]of result)result.set(id,Math.max(1,Math.floor(dimension*ratio)));
  return result;
}
export function hitTile(tiles:Tile[],x:number,y:number){for(let i=tiles.length-1;i>=0;i--){const tile=tiles[i]!,dx=x-tile.x,dy=y-tile.y,a=tile.angle,tx=Math.abs(dx*Math.cos(a)+dy*Math.sin(a)),ty=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a)),radius=Math.min(tile.radius,tile.width/2,tile.height/2);if(tile.alpha>.01&&tx<=tile.width/2&&ty<=tile.height/2&&Math.max(0,tx-tile.width/2+radius)**2+Math.max(0,ty-tile.height/2+radius)**2<=radius**2+1e-12)return tile;}return undefined;}
export function seeded(seed: number) { let state = seed >>> 0; return () => { state += 0x6D2B79F5;
  let t = Math.imul(state ^ (state >>> 15), 1 | state); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
