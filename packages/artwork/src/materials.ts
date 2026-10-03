import type { Recipe } from '@playlist-avatar/contracts';
import type { DrawingContext } from './index.ts';
import type { RenderImage } from './render.ts';
import { cover } from './render.ts';
import { geometry, parameter, seeded } from './geometry.ts';
import { ink } from './generated.ts';
export function renderMaterial(c: DrawingContext, recipe: Recipe, images: Map<string,RenderImage>, size:number,transparent=false) {
  const random=seeded(recipe.seed),phase=recipe.materialPhase*Math.PI*2+random()*Math.PI*2;
  if(recipe.template==='chrome') {
    if(!transparent){c.fillStyle='#151923';c.fillRect(0,0,1,1);}const flow=parameter(recipe,'flow',50)/100,twist=parameter(recipe,'twist',50)/100,iris=parameter(recipe,'iridescence',65)/100;
    const path=new Path2D();for(let i=0;i<=180;i++){const a=i/180*Math.PI*2,r=.27+Math.sin(a*3+phase)*flow*.05;const x=.5+Math.cos(a)*r+Math.sin(phase)*.02,y=.5+Math.sin(a)*r*(.7+twist*.3)+Math.cos(phase)*.02;i?path.lineTo(x,y):path.moveTo(x,y);}path.closePath();
    const reflected=`#${[1,3,5].map(i=>Math.round(parseInt(ink(recipe,1).slice(i,i+2),16)*iris+parseInt('#89949b'.slice(i,i+2),16)*(1-iris)).toString(16).padStart(2,'0')).join('')}`;
    const g=c.createLinearGradient(.2,.1,.8,.9);for(const [at,color] of [[0,'#f8fcff'],[.14,'#222a35'],[.25,ink(recipe,0)],[.35,'#fff'],[.42,'#373f4d'],[.58,reflected],[.72,'#f8ffff'],[.84,'#111827'],[1,'#c1cbd3']] as const)g.addColorStop(at,color);
    c.lineJoin='round';c.strokeStyle=g;c.lineWidth=.19;c.shadowColor=ink(recipe,2);c.shadowBlur=size*.05;c.stroke(path);c.shadowBlur=0;
    c.strokeStyle='#ffffffb0';c.lineWidth=.006;c.stroke(path);c.save();c.translate(.004,-.008);c.strokeStyle='#0c132588';c.lineWidth=.015;c.stroke(path);c.restore();
  }
  if(recipe.template==='prism') {
    if(!transparent){c.fillStyle='#172230';c.fillRect(0,0,1,1);}const facets=Math.round(parameter(recipe,'facets',5)),disp=parameter(recipe,'dispersion',60)/100;
    c.save();c.translate(.5,.5);c.rotate(parameter(recipe,'direction',40)/100*Math.PI+Math.sin(phase)*.3);c.translate(-.5,-.5);
    for(let i=0;i<facets;i++){const a=i/facets*Math.PI*2,b=(i+1)/facets*Math.PI*2;const x=.5+Math.cos(a)*.36,y=.5+Math.sin(a)*.36,x2=.5+Math.cos(b)*.36,y2=.5+Math.sin(b)*.36;
      const g=c.createLinearGradient(.5,.5,x,y);g.addColorStop(0,'#ffffff30');g.addColorStop(.55,ink(recipe,i)+'88');g.addColorStop(1,'#d7f5ffdd');c.fillStyle=g;c.strokeStyle='#e5ffffb0';c.lineWidth=.005;c.beginPath();c.moveTo(.5,.5);c.lineTo(x,y);c.lineTo(x2,y2);c.closePath();c.fill();c.stroke();
      if(disp){for(let j=0;j<3;j++){c.strokeStyle=['#5beeff99','#ff53d899','#fff49a99'][j]!;c.lineWidth=.012*disp;c.beginPath();c.moveTo(x,y);c.lineTo(x+disp*.15+j*.018,y-.3);c.stroke();}}
    }c.restore();
  }
  if(recipe.template==='glass') {
    const refraction=parameter(recipe,'refraction',55)/100,radius=parameter(recipe,'radius',45)/500;
    if(!transparent){const bg=c.createLinearGradient(0,0,1,1);bg.addColorStop(0,ink(recipe,0));bg.addColorStop(1,ink(recipe,1));c.fillStyle=bg;c.fillRect(0,0,1,1);}
    const tiles=geometry(recipe);const count=tiles.length||Math.round(parameter(recipe,'layers',3));
    for(let i=0;i<count;i++){const tile=tiles[i]||{id:'',x:.5+(i-(count-1)/2)*.1,y:.5+(i-(count-1)/2)*.07,width:.6,height:.68,angle:(i-(count-1)/2)*.12};
      c.save();c.translate(tile.x+Math.sin(phase)*.02,tile.y);c.rotate(tile.angle);c.beginPath();c.roundRect(-.3,-.34,.6,.68,radius);c.shadowColor='#05172766';c.shadowBlur=size*.035;c.shadowOffsetY=size*.012;c.fillStyle='#ffffff22';c.fill();c.shadowBlur=0;c.shadowOffsetY=0;c.clip();
      const image=images.get(tile.id);if(image){c.globalAlpha=.65;cover(c,image,-.3+refraction*.05,-.34,.6,.68);c.globalAlpha=1;}
      const g=c.createLinearGradient(-.3,-.34,.3,.34);g.addColorStop(0,'#ffffffc0');g.addColorStop(.08+refraction*.2,'#ffffff18');g.addColorStop(.65,ink(recipe,i)+'22');g.addColorStop(1,'#caffff88');c.fillStyle=g;c.fillRect(-.3,-.34,.6,.68);
      c.strokeStyle='#ffffffbb';c.lineWidth=.012;c.beginPath();c.roundRect(-.293,-.333,.586,.666,radius);c.stroke();c.strokeStyle=ink(recipe,i)+'cc';c.lineWidth=.008;c.beginPath();c.roundRect(-.285,-.325,.57,.65,radius);c.stroke();c.restore();
    }
  }
  if(recipe.template==='eclipse') {
    if(!transparent){c.fillStyle='#101521';c.fillRect(0,0,1,1);}const halo=parameter(recipe,'halo',60)/100,brightness=parameter(recipe,'brightness',65)/100,offset=parameter(recipe,'offset',25)/500;
    const x=.5+Math.sin(phase)*.025,y=.5,g=c.createRadialGradient(x,y,.23,x,y,.28+halo*.19);g.addColorStop(0,'#ffffff');g.addColorStop(.13,ink(recipe,0));g.addColorStop(1,'#00000000');c.globalAlpha=brightness;c.fillStyle=g;c.fillRect(0,0,1,1);c.globalAlpha=1;
    const dark=c.createRadialGradient(x-.07,y-.08,0,x+offset,y,.265);dark.addColorStop(0,'#303747');dark.addColorStop(1,'#050811');c.fillStyle=dark;c.beginPath();c.arc(x+offset,y,.25,0,Math.PI*2);c.fill();
    c.strokeStyle='#ffffff44';c.lineWidth=.002;c.beginPath();c.arc(x+offset,y,.25,Math.PI*.3,Math.PI*1.3);c.stroke();
  }
}
