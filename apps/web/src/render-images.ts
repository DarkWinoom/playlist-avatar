import{imageProjections,drawIllustration}from'@playlist-avatar/artwork';
import type{RenderImage,DrawingContext}from'@playlist-avatar/artwork';
import{slotAsset,SLOT_IDS}from'@playlist-avatar/contracts';
import type{ArtworkAsset,Recipe}from'@playlist-avatar/contracts';
export async function renderImages(recipe:Recipe,assets:Record<string,ArtworkAsset>,size:number,obsolete=()=>false){
 const images=new Map<string,RenderImage>();
 try{for(const[id,dimension]of imageProjections(recipe,size)){
  if(obsolete())throw Error('CANCELLED');const assetId=slotAsset(recipe,id),asset=assetId?assets[assetId]:undefined;let image:ImageBitmap;
  if(asset){const ratio=Math.min(1,dimension/Math.max(asset.width,asset.height));image=await createImageBitmap(size<=128?asset.thumbnail:asset.blob,{resizeWidth:Math.max(1,Math.round(asset.width*ratio)),resizeHeight:Math.max(1,Math.round(asset.height*ratio)),resizeQuality:'high'});}
  else if(recipe.slotImages!==undefined&&!assetId){const n=Math.min(512,dimension),canvas=typeof OffscreenCanvas==='undefined'?document.createElement('canvas'):new OffscreenCanvas(n,n);canvas.width=canvas.height=n;drawIllustration(canvas.getContext('2d') as DrawingContext,n,Math.max(0,SLOT_IDS.indexOf(id)));image=await createImageBitmap(canvas);canvas.width=canvas.height=0;}
  else continue;
  if(obsolete()){image.close();throw Error('CANCELLED');}images.set(id,{image,width:image.width,height:image.height});
 }return images;}catch(error){images.forEach(v=>(v.image as ImageBitmap).close());throw error;}
}
