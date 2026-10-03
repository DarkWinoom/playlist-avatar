import type { Recipe } from '@playlist-avatar/contracts';
import type { DrawingContext } from './index.ts';
import type { RenderImage } from './render.ts';
import { cover } from './render.ts';
import { parameter, seeded } from './geometry.ts';
import { grain, ink } from './generated.ts';
export function printed(c: DrawingContext, recipe: Recipe, images: Map<string,RenderImage>) {
  const random=seeded(recipe.seed),phase=recipe.materialPhase*Math.PI*2+random()*Math.PI*2,image=images.values().next().value;
  if(recipe.template==='riso') {
    const inks=parameter(recipe,'inks',3),offset=parameter(recipe,'offset',40)/2000;c.save();c.globalCompositeOperation='multiply';
    for(let i=0;i<inks;i++){c.fillStyle=ink(recipe,i);c.globalAlpha=.85;c.beginPath();const cx=.35+i*.15,cy=.46+Math.sin(i+phase)*.12;for(let j=0;j<=90;j++){const a=j/90*Math.PI*2,r=.23+Math.sin(a*3+i+phase)*.035+Math.sin(a*5)*.018;const x=cx+Math.cos(a)*r+offset*i,y=cy+Math.sin(a)*r; j ? c.lineTo(x,y) : c.moveTo(x,y);}c.closePath();c.fill();}c.restore();grain(c,recipe,parameter(recipe,'grain',50)/100);
  }
  if(recipe.template==='halftone') {
    const n=Math.round(parameter(recipe,'dots',28)),contrast=.5+parameter(recipe,'contrast',60)/100,offset=parameter(recipe,'color',2);
    let pixels:Uint8ClampedArray|undefined;let scratch:OffscreenCanvas|HTMLCanvasElement|undefined;
    if(image){scratch=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(n,n):document.createElement('canvas');scratch.width=scratch.height=n;const s=scratch.getContext('2d') as DrawingContext|null;if(s){cover(s,image,0,0,n,n);pixels=s.getImageData(0,0,n,n).data;}}
    c.fillStyle=ink(recipe,offset);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,light=pixels?(pixels[i]!*.2126+pixels[i+1]!*.7152+pixels[i+2]!*.0722)/255:.5+.4*Math.sin(x/n*6+phase)*Math.cos(y/n*5);const r=Math.min(.48,Math.max(.02,(1-light)*contrast*.5))/n;c.beginPath();c.arc((x+.5+(random()-.5)*.12)/n,(y+.5+(random()-.5)*.12)/n,r,0,Math.PI*2);c.fill();}if(scratch)scratch.width=scratch.height=0;
  }
  if(recipe.template==='type') {
    const value=String(recipe.parameters.type?.text||recipe.title||'PA'),segments=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].slice(0,3).map(s=>s.segment),text=segments.join('');
    const layout=parameter(recipe,'layout',0),offset=parameter(recipe,'offset',30)/1000,weight=Math.round(parameter(recipe,'weight',80)*10);
    c.save();c.textAlign='center';c.textBaseline='middle';c.font=`${weight} ${segments.length>2?.42:.56}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    c.fillStyle=ink(recipe,1);if(layout===1){c.translate(.5,.5);c.rotate(-Math.PI/8+Math.sin(phase)*.12);c.fillText(text,offset,offset,.9);c.fillStyle=ink(recipe,0);c.fillText(text,0,0,.9);}
    else if(layout===2){segments.forEach((letter,i)=>{c.fillStyle=ink(recipe,i);c.fillText(letter,.5+(i%2?offset:-offset),.25+i*.25+Math.sin(phase)*.02,.9);});}
    else{c.fillRect(.12,.72+Math.sin(phase)*.03,.76,.12);c.fillText(text,.5+offset,.48+offset,.9);c.fillStyle=ink(recipe,0);c.fillText(text,.5,.48+Math.cos(phase)*.015,.9);}c.restore();
  }
  if(recipe.template==='film') {for(let y=.03;y<1;y+=.07){c.fillStyle='#e8e2cd';c.fillRect(.035,y,.055,.035);c.fillRect(.91,y,.055,.035);}grain(c,recipe,parameter(recipe,'grain',30)/100);}
}
