import type{PointerEvent}from'react';
import{geometry}from'@playlist-avatar/artwork';
import{slotAsset}from'@playlist-avatar/contracts';
import{useEditor}from'../editor-store.ts';
import{AssetImage}from'./AssetImage.tsx';import{Icon}from'./Icon.tsx';

export function ImageStrip({chinese,choose,armed,pick,start,consumeClick}:{chinese:boolean;choose:()=>void;armed?:string;pick:(id:string)=>void;start:(event:PointerEvent,id:string)=>void;consumeClick:()=>boolean}){
 const editor=useEditor(),tiles=geometry(editor.recipe),ids=editor.recipe.materialIds||editor.recipe.assetIds;
 return <section className="image-strip" aria-label={chinese?'本次图片':'Images for this work'}>
  <div className="strip-heading"><span>{chinese?'拖到画布 · 也可点选后放入':'Drag onto the canvas, or select and place'}</span><button className="small-button" onClick={choose}><Icon name="image-plus"/>{chinese?'选择图片':'Choose images'}<span>{ids.length}</span></button></div>
  <div className="strip-images">{ids.map(id=>{const asset=editor.assets[id];if(!asset)return null;const positions=tiles.flatMap((tile,i)=>slotAsset(editor.recipe,tile.id)===id?[i+1]:[]);return <button key={id} className="strip-image" aria-pressed={armed===id} aria-label={`${chinese?'放置图片':'Place image'} ${asset.label}`} onPointerDown={event=>{if(event.pointerType!=='touch')start(event,id);}} onClick={()=>{if(!consumeClick())pick(id);}} title={asset.label}><AssetImage asset={asset}/><span className="strip-placement">{positions.length?`${chinese?'画布':'Canvas'} ${positions.join('·')}`:chinese?'待放入':'Available'}</span></button>;})}{!ids.length&&<div className="strip-empty"><Icon name="image-plus"/><span>{chinese?'当前使用默认插画':'Using default illustrations'}</span></div>}</div>
 </section>;
}
