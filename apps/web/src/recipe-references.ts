import type { Recipe } from '@playlist-avatar/contracts';import{recipeAssets}from'@playlist-avatar/contracts';
export function remapRecipeAssets(recipe: Recipe, mapping: Map<string,string>): Recipe {
  if(recipeAssets(recipe).some(id=>!mapping.has(id)))throw new Error('INVALID_PACKAGE');
  const assetIds=recipe.slotImages===undefined?[...new Set(recipe.assetIds.map(id=>mapping.get(id)!))]:recipe.assetIds;
  const relevant=new Set(recipeAssets(recipe).map(id=>mapping.get(id)!));
  const sourceOrder=[...new Set([...recipe.sourceOrder.flatMap(id=>mapping.has(id)?[mapping.get(id)!]:[]),...(recipe.slotImages===undefined?assetIds:[])])].filter(id=>relevant.has(id)).slice(0,16);
  const assetStats=Object.fromEntries(Object.entries(recipe.assetStats).flatMap(([id,value])=>{const next=mapping.get(id);return next&&relevant.has(next)?[[next,value]]:[];}));
  const sourceRanks=Object.fromEntries(Object.entries(recipe.sourceRanks).flatMap(([id,value])=>{const next=mapping.get(id);return next&&relevant.has(next)?[[next,value]]:[];}));
  const materialIds=recipeAssets(recipe).map(id=>mapping.get(id)!),imageFrames=recipe.slotImages===undefined?Object.fromEntries(Object.entries(recipe.imageFrames||{}).flatMap(([id,value])=>{const next=mapping.get(id);return next&&materialIds.includes(next)?[[next,value]]:[];})):recipe.imageFrames;
  const slotImages=recipe.slotImages===undefined?undefined:Object.fromEntries(Object.entries(recipe.slotImages).map(([slot,id])=>[slot,mapping.get(id)!]));
  return {...recipe,assetIds,slotImages,materialIds:[...new Set(materialIds)],imageFrames,sourceOrder,assetStats,sourceRanks};
}
