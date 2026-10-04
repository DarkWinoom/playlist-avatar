import{useEffect,useRef,useState}from'react';import type{PointerEvent}from'react';import{useEditor}from'./editor-store.ts';
import{geometry,hitTile}from'@playlist-avatar/artwork';
export interface MaterialDrag{id:string;x:number;y:number;target?:string;kind?:'canvas'|'shelf'}
export function useMaterialDrag(done:(drag:MaterialDrag)=>void){
 const[state,setState]=useState<MaterialDrag>(),pending=useRef<{id:string;x:number;y:number;pointer:number;revision:number}|undefined>(undefined),current=useRef<MaterialDrag|undefined>(undefined),callback=useRef(done);callback.current=done;
 const suppress=useRef(false);
 useEffect(()=>{let frame=0;const finish=(event:globalThis.PointerEvent)=>{const start=pending.current;if(!start||start.pointer!==event.pointerId)return;cancelAnimationFrame(frame);if(current.current&&start.revision===useEditor.getState().revision)callback.current(current.current);pending.current=undefined;current.current=undefined;setState(undefined);};
 const cancel=()=>{cancelAnimationFrame(frame);pending.current=undefined;current.current=undefined;setState(undefined);};
 const move=(event:globalThis.PointerEvent)=>{const start=pending.current;if(!start||event.pointerId!==start.pointer)return;if(useEditor.getState().revision!==start.revision){cancel();return;}if(!current.current&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<6)return;suppress.current=true;
  const element=document.elementFromPoint(event.clientX,event.clientY),board=element?.closest<HTMLElement>('.artwork-canvas'),node=element?.closest<HTMLElement>('[data-material-id]');const rect=board?.getBoundingClientRect(),tile=rect?hitTile(geometry(useEditor.getState().recipe),(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height):undefined;current.current={id:start.id,x:event.clientX,y:event.clientY,target:tile?.id||node?.dataset.materialId,kind:tile?'canvas':node?.dataset.materialId?'shelf':undefined};cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setState(current.current));};
 const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&pending.current){event.preventDefault();cancel();}};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key);
 return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);};},[]);
 return{state,start(event:PointerEvent,id:string){if(event.button!==0||!event.isPrimary)return;suppress.current=false;pending.current={id,x:event.clientX,y:event.clientY,pointer:event.pointerId,revision:useEditor.getState().revision};},consumeClick(){const value=suppress.current;suppress.current=false;return value;}};
}
