import{renderImages}from'../render-images.ts';
import{useEffect,useLayoutEffect,useRef,useState}from'react';import type{ReactNode}from'react';
import{geometry,render,imageProjections,prepareRenderer,artworkWeights}from'@playlist-avatar/artwork';
import type{RenderImage}from'@playlist-avatar/artwork';import{slotAsset}from'@playlist-avatar/contracts';import type{ArtworkAsset,Recipe}from'@playlist-avatar/contracts';
import{canvasFlight}from'../room/canvas-flight.ts';import type{CanvasFlight}from'../room/canvas-flight.ts';
import{paperSwitch}from'../room/paper-switch.ts';
export function ArtworkCanvas({recipe,assets,reduce,circle=false,direct=false,checks=false,onFrame,children,flight,revision=0}:{recipe:Recipe;assets:Record<string,ArtworkAsset>;reduce:boolean;circle?:boolean;direct?:boolean;checks?:boolean;onFrame?:(time:number)=>void;children?:ReactNode;flight?:CanvasFlight;revision?:number}){
 const canvas=useRef<HTMLCanvasElement>(null),holder=useRef<HTMLDivElement>(null),small=useRef<(HTMLCanvasElement|null)[]>([]),painted=useRef(false),measured=useRef(false),handled=useRef<number|undefined>(undefined),lastTemplate=useRef(recipe.template);
 const owned=useRef(new Set<Map<string,RenderImage>>()),release=(map:Map<string,RenderImage>)=>{if(owned.current.delete(map))map.forEach(value=>(value.image as ImageBitmap).close());};
 const[size,setSize]=useState(640),[loaded,setLoaded]=useState<{key:string;images:Map<string,RenderImage>}>();
 const projections=imageProjections(recipe,size),key=recipe.template+'|'+size+'|'+[...projections].map(([id,value])=>{const assetId=slotAsset(recipe,id),asset=assetId?assets[assetId]:undefined;return id+':'+(assetId||'')+':'+value+':'+(asset?.fingerprint||'')+':'+(asset?.width||0)+':'+(asset?.height||0);}).join('|');
 useLayoutEffect(()=>{const width=parseFloat(getComputedStyle(holder.current!).width)||320;setSize(Math.min(1280,Math.max(256,Math.round(width*Math.min(2,window.devicePixelRatio)))));},[recipe.template]);
 useEffect(()=>{const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||320;setSize(Math.min(1280,Math.max(256,Math.round(width*Math.min(2,window.devicePixelRatio)))));});observer.observe(holder.current!);return()=>observer.disconnect();},[]);
 useEffect(()=>{let obsolete=false,committed=false;let images:Map<string,RenderImage>|undefined;void(async()=>{try{await prepareRenderer(recipe.template);if(obsolete)return;images=await renderImages(recipe,assets,size,()=>obsolete);owned.current.add(images);if(!obsolete){committed=true;setLoaded({key,images});}else release(images);}catch{if(images)release(images);}})();return()=>{obsolete=true;if(!committed&&images)release(images);};},[key]);
 useEffect(()=>()=>{if(loaded)release(loaded.images);},[loaded]);
 useEffect(()=>()=>{for(const map of [...owned.current])release(map);},[]);
 useEffect(()=>{
  const element=canvas.current!,context=element.getContext('2d');if(!context||loaded?.key!==key)return;
  const target=document.createElement('canvas');target.width=target.height=size;render(target.getContext('2d')!,size,recipe,loaded.images,undefined,false,artworkWeights(recipe,assets));
  const previous=document.createElement('canvas');previous.width=previous.height=element.width;if(element.width)previous.getContext('2d')!.drawImage(element,0,0);
  let alive=true,cancelFlight:(()=>void)|undefined,cancelPaper:(()=>void)|undefined;
  const commit=()=>{if(!alive)return;element.width=element.height=size;context.clearRect(0,0,size,size);context.drawImage(target,0,0);element.dataset.committedRevision=String(revision);element.dataset.committedTemplate=recipe.template;painted.current=true;if(!measured.current){performance.mark('playlist-avatar:preview-ready');element.dataset.readyMs=performance.now().toFixed(1);measured.current=true;}if(checks)small.current.forEach(check=>{if(check){const c=check.getContext('2d');c?.clearRect(0,0,check.width,check.height);c?.drawImage(element,0,0,check.width,check.height);}});onFrame?.(performance.now());};
  const changing=lastTemplate.current!==recipe.template;lastTemplate.current=recipe.template;
  const tile=flight&&flight.revision===revision?geometry(recipe).find(value=>value.id===flight.slot):undefined;
  if(tile&&flight&&handled.current!==flight.id&&painted.current&&!reduce&&!document.hidden){handled.current=flight.id;element.dataset.transition='flying';cancelFlight=canvasFlight(previous,target,holder.current!,tile,flight,()=>{element.dataset.transition='settled';commit();});}
  else if(changing&&painted.current&&!reduce&&!direct&&!document.hidden){
   element.width=element.height=size;context.drawImage(target,0,0);element.dataset.transition='paper';cancelPaper=paperSwitch(previous,holder.current!,()=>{element.dataset.transition='settled';commit();});if(!cancelPaper){element.dataset.transition='settled';commit();}
  }else{element.dataset.transition='settled';commit();}
  const hidden=()=>{if(document.hidden){cancelFlight?.();cancelPaper?.();element.dataset.transition='settled';commit();}};document.addEventListener('visibilitychange',hidden);
  return()=>{alive=false;cancelFlight?.();cancelPaper?.();previous.width=previous.height=target.width=target.height=0;document.removeEventListener('visibilitychange',hidden);};
 },[recipe,size,loaded,key,reduce,direct,checks,flight,revision]);
 return <><div ref={holder} className={'artwork-canvas'+(circle?' circle':'')} aria-busy={loaded?.key!==key}><canvas ref={canvas} role="img" aria-label={recipe.template+' artwork'}/>{children}</div>{checks&&<div className="avatar-checks">{[48,96].map((value,index)=><div key={value}><canvas ref={node=>{small.current[index]=node;}} width={value} height={value} role="img" aria-label={value+'px avatar'}/><small>{value}px</small></div>)}</div>}</>;
}
