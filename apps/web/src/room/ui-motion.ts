import{useEffect,useLayoutEffect,useRef}from'react';
function reduced(){return document.documentElement.dataset.reduceMotion==='true';}
function motionLifecycle(cancel:()=>void){
 const stop=()=>{if(document.hidden||reduced())cancel();};
 const observer=new MutationObserver(stop);
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});
 document.addEventListener('visibilitychange',stop);
 return()=>{observer.disconnect();document.removeEventListener('visibilitychange',stop);cancel();};
}
export function useSlidingTabs(value:unknown){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const group=root.current;if(!group)return;
  let animation:Animation|undefined;
  const cancel=()=>{animation?.cancel();animation=undefined;};
  const update=(animate:boolean)=>{
   const active=group.querySelector<HTMLElement>('[aria-pressed="true"]');if(!active)return;
   let indicator=group.querySelector<HTMLElement>('.room-tab-indicator');
   const previous=indicator?.getBoundingClientRect();cancel();
   if(!indicator){indicator=document.createElement('span');indicator.className='room-tab-indicator';indicator.style.position='absolute';indicator.setAttribute('aria-hidden','true');group.prepend(indicator);}
   const parent=group.getBoundingClientRect(),target=active.getBoundingClientRect();
   Object.assign(indicator.style,{left:target.left-parent.left-group.clientLeft+'px',top:target.top-parent.top-group.clientTop+'px',width:target.width+'px',height:target.height+'px'});
   if(animate&&previous&&!reduced()&&!document.hidden){
    const dx=previous.left-target.left,dy=previous.top-target.top;
    if(Math.abs(dx)+Math.abs(dy)>1)animation=indicator.animate([{transform:`translate(${dx}px,${dy}px) scaleX(${previous.width/target.width})`},{transform:'none'}],{duration:340,easing:'cubic-bezier(.2,.85,.25,1)'});
   }
  };
  let resizingReady=false;update(true);const cleanup=motionLifecycle(cancel),observer=new ResizeObserver(()=>{if(resizingReady)update(false);else resizingReady=true;});observer.observe(group);
  return()=>{observer.disconnect();cleanup();};
 },[value]);return root;
}
export function useSceneMotion(scene:string,reduce:boolean){
 useEffect(()=>{
  if(reduce||document.hidden||scene==='home')return;
  const animations:Animation[]=[];
  const play=(selector:string,frames:Keyframe[],duration:number,delay=0)=>{const node=document.querySelector(selector);if(node)animations.push(node.animate(frames,{duration,delay,easing:'cubic-bezier(.22,1,.36,1)'}));};
  if(scene==='create'){
   play('.room-paper',[{opacity:0,transform:'perspective(1100px) rotateX(15deg) rotateY(-9deg) scale(.86)'},{opacity:1,transform:'none'}],670);
   play('.room-effects-panel',[{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'none'}],390,90);
  }else{
   play('.room-release-paper',[{opacity:0,transform:'perspective(1000px) rotateY(-33deg) translateX(35px) scale(.83)'},{opacity:1,transform:'none'}],780);
   play('.room-release-vinyl',[{transform:'translateX(-25%) rotate(-25deg)'},{transform:'none'}],880,120);
   play('.room-release-seal',[{opacity:0,transform:'scale(1.9) rotate(12deg)'},{opacity:1,transform:'scale(.95) rotate(-12deg)',offset:.7},{opacity:1,transform:'rotate(-12deg)'}],380,430);
  }
  return motionLifecycle(()=>animations.forEach(animation=>animation.cancel()));
 },[scene,reduce]);
}
export interface ShelfFlight{canvas:HTMLCanvasElement;rect:DOMRect;id:string}
export function captureRelease(){
 const source=document.querySelector<HTMLCanvasElement>('.room-release-paper canvas');
 if(!source?.dataset.readyMs||source.closest('[aria-busy="true"]')||source.width!==source.height)return;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=source.width;canvas.getContext('2d')!.drawImage(source,0,0);
 return{canvas,rect:source.getBoundingClientRect()};
}
export function releaseShelf(value:Pick<ShelfFlight,'canvas'>|undefined){if(value)value.canvas.width=value.canvas.height=0;}
export function flyToShelf(value:ShelfFlight){
 const target=Array.from(document.querySelectorAll<HTMLElement>('[data-work-id]')).find(node=>node.dataset.workId===value.id)?.querySelector<HTMLElement>('.room-album-cover');
 if(!target||document.hidden||reduced()){releaseShelf(value);return()=>{};}
 const initial=target.getBoundingClientRect();if(initial.top<0||initial.bottom>window.innerHeight)target.scrollIntoView({block:'nearest',behavior:'instant'});
 const to=target.getBoundingClientRect(),ghost=document.createElement('div'),dx=value.rect.x+value.rect.width/2-to.x-to.width/2,dy=value.rect.y+value.rect.height/2-to.y-to.height/2;
 ghost.className='room-shelf-flight';
 Object.assign(ghost.style,{left:to.x+'px',top:to.y+'px',width:to.width+'px',height:to.height+'px'});
 ghost.append(value.canvas);document.body.append(ghost);
 const animation=ghost.animate([{transform:`translate(${dx}px,${dy}px) rotate(0) scale(${value.rect.width/to.width})`,opacity:1},{transform:'rotate(-2deg) scale(1)',opacity:1}],{duration:770,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
 let alive=true;
 const remove=()=>{if(!alive)return;alive=false;ghost.remove();animation.cancel();releaseShelf(value);};
 const cleanup=motionLifecycle(remove);animation.finished.then(cleanup,cleanup);return cleanup;
}
