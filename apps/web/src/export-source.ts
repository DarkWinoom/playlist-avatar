import { recipeAssets } from '@playlist-avatar/contracts';
import type { ArtworkAsset, Recipe, ExportOptions } from '@playlist-avatar/contracts';
export interface ExportSource {recipe:Recipe;assets:Record<string,ArtworkAsset>;name?:string;id?:string}
export function freezeExport(source:ExportSource):ExportSource {
 const recipe=structuredClone(source.recipe),assets=Object.fromEntries(recipeAssets(recipe).flatMap(id=>source.assets[id]?[[id,source.assets[id]!]]:[]));
 return {recipe,assets:structuredClone(assets),name:source.name,id:source.id};
}
export function exportFilename(source:ExportSource,options:ExportOptions){
 const slug=(source.name||source.recipe.title||'playlist-avatar').normalize().replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,60)||'playlist-avatar',ext=options.format==='image/jpeg'?'jpg':options.format==='image/webp'?'webp':'png';
 return slug+'-'+source.recipe.template+'-'+options.size+'-'+new Date().toISOString().slice(0,10)+'.'+ext;
}
