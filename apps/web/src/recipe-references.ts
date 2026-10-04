import type { Recipe } from '@playlist-avatar/contracts';import{recipeAssets}from'@playlist-avatar/contracts';
export function remapRecipeAssets(recipe: Recipe, mapping: Map<string,string>): Recipe {
  if(recipeAssets(recipe).some(id=>!mapping.has(id)))throw new Error('INVALID_PACKAGE');
  const assetIds=[...new Set(recipe.assetIds.map(id=>mapping.get(id)!))];
  const sourceOrder=[...new Set([...recipe.sourceOrder.flatMap(id=>mapping.has(id)?[mapping.get(id)!]:[]),...assetIds])].filter(id=>assetIds.includes(id));
  const assetStats=Object.fromEntries(Object.entries(recipe.assetStats).flatMap(([id,value])=>{const next=mapping.get(id);return next&&assetIds.includes(next)?[[next,value]]:[];}));
  const sourceRanks=Object.fromEntries(Object.entries(recipe.sourceRanks).flatMap(([id,value])=>{const next=mapping.get(id);return next&&assetIds.includes(next)?[[next,value]]:[];}));
  const materialIds=recipeAssets(recipe).map(id=>mapping.get(id)!),imageFrames=Object.fromEntries(Object.entries(recipe.imageFrames||{}).flatMap(([id,value])=>{const next=mapping.get(id);return next&&materialIds.includes(next)?[[next,value]]:[];}));
  return {...recipe,assetIds,materialIds:[...new Set(materialIds)],imageFrames,sourceOrder,assetStats,sourceRanks};
}
