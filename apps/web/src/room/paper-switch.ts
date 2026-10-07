export function paperSwitch(previous:HTMLCanvasElement,board:HTMLElement,complete:()=>void){
 const paper=board.closest<HTMLElement>('.room-paper'),stage=paper?.parentElement;if(!paper||!stage)return;
 paper.getAnimations().forEach(animation=>animation.cancel());
 const ghost=document.createElement('div');ghost.className='room-paper room-paper-ghost';ghost.setAttribute('aria-hidden','true');
 const width=paper.offsetWidth;Object.assign(ghost.style,{left:paper.offsetLeft+'px',top:paper.offsetTop+'px',width:width+'px',height:paper.offsetHeight+'px'});ghost.append(previous);stage.append(ghost);paper.dataset.paperTransition='changing';
 let alive=true;const options:KeyframeAnimationOptions={duration:620,easing:'cubic-bezier(.22,.7,.22,1)',fill:'both'};
 const outgoing=ghost.animate([{opacity:1,transform:'perspective(1200px) translate3d(0,0,0) rotateZ(0deg) rotateY(0deg)'},{opacity:.7,transform:`perspective(1200px) translate3d(${-width*.46}px,-24px,8px) rotateZ(-4deg) rotateY(5deg)`,offset:.55},{opacity:0,transform:`perspective(1200px) translate3d(${-width*1.08}px,-8px,0) rotateZ(-8deg) rotateY(10deg)`}],options);
 const incoming=paper.animate([{opacity:0,transform:`perspective(1200px) translate3d(${width*1.08}px,14px,0) rotateZ(8deg) rotateY(-10deg)`},{opacity:.85,transform:`perspective(1200px) translate3d(${width*.34}px,-20px,8px) rotateZ(3deg) rotateY(-4deg)`,offset:.55},{opacity:1,transform:'perspective(1200px) translate3d(0,0,0) rotateZ(0deg) rotateY(0deg)'}],options);
 const settle=(apply:boolean)=>{if(!alive)return;alive=false;ghost.remove();outgoing.cancel();incoming.cancel();delete paper.dataset.paperTransition;if(apply)complete();previous.width=previous.height=0;};
 Promise.all([outgoing.finished,incoming.finished]).then(()=>settle(true),()=>settle(false));return()=>settle(false);
}
