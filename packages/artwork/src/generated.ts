import type { Recipe } from '@playlist-avatar/contracts';
import type { DrawingContext } from './index.ts';
import { parameter, seeded } from './geometry.ts';
export function ink(recipe: Recipe, i: number) { return recipe.palette[(i + recipe.palette.length) % recipe.palette.length]!; }
export function grain(c: DrawingContext, recipe: Recipe, strength: number) {
  if (!strength) return; const random = seeded(recipe.seed ^ 8282); c.save(); c.globalAlpha = strength * .11;
  for (let i=0;i<1800;i++) { c.fillStyle = i%2 ? '#000' : '#fff'; c.fillRect(random(),random(),.0015+random()*.001,.0015); } c.restore();
}
export function generated(c: DrawingContext, recipe: Recipe,transparent=false,weights:number[]=[1]) {
  const weight=(index:number)=>weights[index%Math.max(1,weights.length)]||1;
  const random=seeded(recipe.seed), phase=recipe.materialPhase*Math.PI*2+random()*Math.PI*2;
  if(recipe.template==='ribbon'){const folds=Math.round(parameter(recipe,'folds',7)),width=parameter(recipe,'width',60)/100,bend=parameter(recipe,'bend',55)/100;c.save();c.translate(.5,.5);c.rotate(-.45+Math.sin(phase)*.15);for(let i=folds;i>=0;i--){c.beginPath();const y=(i/folds-.5)*.7;c.moveTo(-.36,y);c.bezierCurveTo(-.2,y-.17*bend,.15,y+.2*bend,.36,y-.035);c.lineTo(.36,y+.045+width*.04);c.bezierCurveTo(.15,y+.045+width*.04+.2*bend,-.2,y+.045+width*.04-.17*bend,-.36,y+.045+width*.04);c.closePath();const g=c.createLinearGradient(-.36,y,.36,y+.08);g.addColorStop(0,ink(recipe,i));g.addColorStop(.55,ink(recipe,i+1));g.addColorStop(1,ink(recipe,i));c.fillStyle=g;c.fill();c.strokeStyle='#ffffff55';c.lineWidth=.002;c.stroke();}c.restore();}
  if(recipe.template==='bloom'){const petals=Math.round(parameter(recipe,'petals',8)),spread=parameter(recipe,'spread',60)/100,core=parameter(recipe,'core',45)/100;c.save();c.translate(.5,.5);for(let i=0;i<petals;i++){c.save();c.rotate(i/petals*Math.PI*2+phase*.08);c.fillStyle=ink(recipe,i);c.globalAlpha=.88;c.beginPath();c.ellipse(0,-.11-spread*.06,.09,.19+spread*.09,0,0,Math.PI*2);c.fill();c.restore();}c.fillStyle=ink(recipe,2);c.beginPath();c.arc(0,0,.045+core*.08,0,Math.PI*2);c.fill();c.fillStyle='#ffffffbb';c.beginPath();c.arc(-.025,-.025,.018,0,Math.PI*2);c.fill();c.restore();}
  if(recipe.template==='mesh'){const n=Math.round(parameter(recipe,'density',8)),round=parameter(recipe,'round',65)/100,shift=parameter(recipe,'shift',40)/100,cell=.84/n,colorShift=Math.floor(random()*recipe.palette.length),gradientAngle=phase;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const px=.08+x*cell+(y%2?shift*cell*.2:0),py=.08+y*cell,g=c.createLinearGradient(px+cell*(.5-.5*Math.cos(gradientAngle)),py+cell*(.5-.5*Math.sin(gradientAngle)),px+cell*(.5+.5*Math.cos(gradientAngle)),py+cell*(.5+.5*Math.sin(gradientAngle)));g.addColorStop(0,ink(recipe,x+y+colorShift));g.addColorStop(1,ink(recipe,x+y+colorShift+1));c.fillStyle=g;c.beginPath();c.roundRect(px,py,cell*.9,cell*.9,cell*.45*round);c.fill();}}
  if(recipe.template==='waves'){const n=Math.round(parameter(recipe,'layers',6)),height=parameter(recipe,'height',60)/100,horizon=parameter(recipe,'horizon',35)/100;for(let i=0;i<n;i++){const base=horizon+i*(1-horizon)/n;c.beginPath();c.moveTo(0,1);for(let j=0;j<=80;j++){const x=j/80,y=base+Math.sin(x*Math.PI*2.2+phase+i*.7)*height*.07+Math.cos(x*Math.PI*3+i)*height*.02;c.lineTo(x,y);}c.lineTo(1,1);c.closePath();c.fillStyle=ink(recipe,i);c.fill();c.strokeStyle='#ffffff55';c.lineWidth=.002;c.stroke();}}
  if (recipe.template==='aura') {
    if(!transparent){c.fillStyle='#181f2c';c.fillRect(0,0,1,1);}const spread=parameter(recipe,'spread',60)/100;
    for(let i=0;i<5;i++){const x=.15+random()*.7,y=.15+random()*.7,g=c.createRadialGradient(x,y,0,x,y,(.25+spread*.45)*weight(i));g.addColorStop(0,ink(recipe,i));g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,1,1);}
    const core=parameter(recipe,'core',55)/100,g=c.createRadialGradient(.5,.48,0,.5,.48,.03+core*.2);g.addColorStop(0,'#ffffeccc');g.addColorStop(1,'#ffffec00');c.fillStyle=g;c.fillRect(0,0,1,1);grain(c,recipe,parameter(recipe,'grain',30)/100);
  }
  if(recipe.template==='orbit') {
    const n=parameter(recipe,'density',7),space=parameter(recipe,'space',50)/100,ecc=parameter(recipe,'eccentricity',50)/100;
    for(let i=0;i<n;i++){c.strokeStyle=ink(recipe,i);c.lineWidth=(.02+(1-space)*.025)*weight(i);c.beginPath();c.ellipse(.5+Math.sin(i+phase)*ecc*.12,.5+Math.cos(i+phase)*ecc*.12,.09+i*.027,.13+i*.03,i*.12, .2+random(),Math.PI*1.85);c.stroke();}
    c.fillStyle=ink(recipe,1);c.beginPath();c.arc(.5,.5,.055,0,Math.PI*2);c.fill();
  }
  if(recipe.template==='pulse') {
    const n=parameter(recipe,'rhythm',12),a=parameter(recipe,'amplitude',65)/100;c.save();c.translate(.5,.5);c.rotate(parameter(recipe,'direction',25)/100*Math.PI);c.translate(-.5,-.5);
    for(let i=0;i<n;i++){c.strokeStyle=ink(recipe,i);c.lineWidth=.6/n*weight(i);c.lineCap='round';c.beginPath();for(let j=0;j<=80;j++){const x=j/80,y=(i+.5)/n+Math.sin(x*Math.PI*3+phase+i*.28)*a*.08*weight(i); j ? c.lineTo(x,y) : c.moveTo(x,y);}c.stroke();}c.restore();
  }
  if(recipe.template==='terrain') {
    const n=parameter(recipe,'layers',12),a=parameter(recipe,'relief',60)/100,offset=parameter(recipe,'color',0); const frequencies=[Math.floor(random()*2)+2,Math.floor(random()*3)+3,Math.floor(random()*4)+5];
    for(let i=n;i>0;i--){c.fillStyle=ink(recipe,i+offset);c.beginPath();for(let j=0;j<=120;j++){const angle=j/120*Math.PI*2,r=Math.max(.012,.035+i/n*.38+a*.035*weight(i)*(Math.sin(angle*frequencies[0]!+phase)+Math.cos(angle*frequencies[1]!)+Math.sin(angle*frequencies[2]!+i*.15)));const x=.5+Math.cos(angle)*r,y=.5+Math.sin(angle)*r; j ? c.lineTo(x,y) : c.moveTo(x,y);}c.closePath();c.fill();c.strokeStyle='#ffffff50';c.lineWidth=.003;c.stroke();}
  }
}
