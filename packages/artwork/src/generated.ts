import type { Recipe } from '@playlist-avatar/contracts';
import type { DrawingContext } from './index.ts';
import { parameter, seeded } from './geometry.ts';
export function ink(recipe: Recipe, i: number) { return recipe.palette[(i + recipe.palette.length) % recipe.palette.length]!; }
export function grain(c: DrawingContext, recipe: Recipe, strength: number) {
  if (!strength) return; const random = seeded(recipe.seed ^ 8282); c.save(); c.globalAlpha = strength * .11;
  for (let i=0;i<1800;i++) { c.fillStyle = i%2 ? '#000' : '#fff'; c.fillRect(random(),random(),.0015+random()*.001,.0015); } c.restore();
}
export function generated(c: DrawingContext, recipe: Recipe,transparent=false) {
  const random=seeded(recipe.seed), phase=recipe.materialPhase*Math.PI*2+random()*Math.PI*2;
  if (recipe.template==='aura') {
    if(!transparent){c.fillStyle='#181f2c';c.fillRect(0,0,1,1);}const spread=parameter(recipe,'spread',60)/100;
    for(let i=0;i<5;i++){const x=.15+random()*.7,y=.15+random()*.7,g=c.createRadialGradient(x,y,0,x,y,.25+spread*.45);g.addColorStop(0,ink(recipe,i));g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,1,1);}
    const core=parameter(recipe,'core',55)/100,g=c.createRadialGradient(.5,.48,0,.5,.48,.03+core*.2);g.addColorStop(0,'#ffffeccc');g.addColorStop(1,'#ffffec00');c.fillStyle=g;c.fillRect(0,0,1,1);grain(c,recipe,parameter(recipe,'grain',30)/100);
  }
  if(recipe.template==='orbit') {
    const n=parameter(recipe,'density',7),space=parameter(recipe,'space',50)/100,ecc=parameter(recipe,'eccentricity',50)/100;
    for(let i=0;i<n;i++){c.strokeStyle=ink(recipe,i);c.lineWidth=.02+(1-space)*.025;c.beginPath();c.ellipse(.5+Math.sin(i+phase)*ecc*.12,.5+Math.cos(i+phase)*ecc*.12,.09+i*.027,.13+i*.03,i*.12, .2+random(),Math.PI*1.85);c.stroke();}
    c.fillStyle=ink(recipe,1);c.beginPath();c.arc(.5,.5,.055,0,Math.PI*2);c.fill();
  }
  if(recipe.template==='pulse') {
    const n=parameter(recipe,'rhythm',12),a=parameter(recipe,'amplitude',65)/100;c.save();c.translate(.5,.5);c.rotate(parameter(recipe,'direction',25)/100*Math.PI);c.translate(-.5,-.5);
    for(let i=0;i<n;i++){c.strokeStyle=ink(recipe,i);c.lineWidth=.6/n;c.lineCap='round';c.beginPath();for(let j=0;j<=80;j++){const x=j/80,y=(i+.5)/n+Math.sin(x*Math.PI*3+phase+i*.28)*a*.08; j ? c.lineTo(x,y) : c.moveTo(x,y);}c.stroke();}c.restore();
  }
  if(recipe.template==='terrain') {
    const n=parameter(recipe,'layers',12),a=parameter(recipe,'relief',60)/100,offset=parameter(recipe,'color',0); const frequencies=[Math.floor(random()*2)+2,Math.floor(random()*3)+3,Math.floor(random()*4)+5];
    for(let i=n;i>0;i--){c.fillStyle=ink(recipe,i+offset);c.beginPath();for(let j=0;j<=120;j++){const angle=j/120*Math.PI*2,r=.035+i/n*.38+a*.035*(Math.sin(angle*frequencies[0]!+phase)+Math.cos(angle*frequencies[1]!)+Math.sin(angle*frequencies[2]!+i*.15));const x=.5+Math.cos(angle)*r,y=.5+Math.sin(angle)*r; j ? c.lineTo(x,y) : c.moveTo(x,y);}c.closePath();c.fill();c.strokeStyle='#ffffff50';c.lineWidth=.003;c.stroke();}
  }
}
