import type{ArtworkAsset,Recipe}from'@playlist-avatar/contracts';
export function artworkWeights(recipe:Recipe,assets:Record<string,ArtworkAsset>){
 const raw=recipe.assetIds.map(id=>{const statistics=recipe.assetStats[id]||assets[id]?.statistics;return recipe.weightMode==='equal'?1:recipe.weightMode==='occurrences'?statistics?.occurrenceCount??1:statistics?.playCount??1;});
 const transformed=raw.map(v=>Math.sqrt(Math.max(0,v))),mean=transformed.reduce((sum,v)=>sum+v,0)/Math.max(1,transformed.length);
 return transformed.map(v=>mean?Math.max(.35,Math.min(1.7,v/mean)):1);
}
